# ICS Select

Plataforma interna do ICS Select — Programa de Preparação Avançada para Entrevistas Técnicas (Inteli Consulting Society).

- **Design spec:** [`docs/superpowers/specs/2026-04-11-ics-select-design.md`](docs/superpowers/specs/2026-04-11-ics-select-design.md)
- **Plano de entrega:** [`docs/superpowers/plans/`](docs/superpowers/plans/)

## Stack

- Monorepo: pnpm 9 + Turborepo 2
- Backend: NestJS 10 + Prisma 5 + PostgreSQL 16 + pgvector
- Frontend: Next.js 15 + HeroUI + Tailwind 3 + lucide-react + next-themes
- Testes: Jest + Supertest (API), Playwright (web), Vitest (shared)
- Deploy: Docker Compose + Caddy na VPS + Vercel (web) + GitHub Actions

## Pré-requisitos

- Node 20 (`.nvmrc`)
- pnpm 9 (`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- Docker 24+ e Docker Compose v2

## Setup local

```bash
# 1. Instalar dependências
pnpm install

# 2. Subir o banco local
cp .env.example .env
docker compose up -d postgres

# 3. Aplicar migrações
pnpm --filter @ics-select/prisma exec prisma migrate deploy

# 4. Configurar a API
cp apps/api/.env.example apps/api/.env

# 5. Configurar o web
cp apps/web/.env.example apps/web/.env.local

# 6. Rodar tudo (em terminais separados ou via turbo)
pnpm dev
```

- API: http://localhost:3001/health
- Web: http://localhost:3000

## Comandos úteis

```bash
pnpm lint          # lint em todos os packages
pnpm typecheck     # type-check em todos os packages
pnpm test          # todos os testes (unit + e2e + playwright)
pnpm build         # build de todos os packages
pnpm db:migrate    # roda prisma migrate dev
pnpm db:generate   # regenera o client do Prisma
```

## Deploy

### Backend (VPS)

O deploy é automático via GitHub Actions em merges na branch `main`:

1. CI roda (lint, typecheck, testes, build)
2. Deploy workflow builda a imagem Docker e faz push pra `ghcr.io/yuhtin/ics-select-api`
3. SSH na VPS → `docker compose pull && migrate && up -d`

**VPS setup inicial (uma vez):**

```bash
# Na VPS, como root ou sudo
mkdir -p /opt/ics-select
cd /opt/ics-select

# Copiar docker-compose.prod.yml, Caddyfile e criar .env
scp docker-compose.prod.yml user@vps:/opt/ics-select/
scp Caddyfile user@vps:/opt/ics-select/
scp .env.prod.example user@vps:/opt/ics-select/.env
# depois editar o .env com senhas reais

# Login no GHCR com o PAT
echo $GHCR_PAT | docker login ghcr.io -u Yuhtin --password-stdin

# Primeira subida
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml run --rm migrate
docker compose -f docker-compose.prod.yml up -d
```

### Frontend (Vercel)

- Projeto Vercel apontando pra este repositório
- **Root Directory:** `apps/web`
- **Build command:** `cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @ics-select/web build`
- **Install command:** (vazio, o build command já instala)
- **Output directory:** `.next` (default)
- Env var: `NEXT_PUBLIC_API_URL=https://ics-api.daviduarte.com.br`
- Domínio customizado: `ics.daviduarte.com.br`

## Secrets necessários no GitHub

| Nome | Descrição |
|---|---|
| `VPS_HOST` | IP ou hostname da VPS |
| `VPS_USER` | Usuário SSH |
| `VPS_SSH_KEY` | Chave privada (PEM) |

## Rollback

Para voltar pra uma versão anterior da API:

```bash
# Na VPS
cd /opt/ics-select
# Substitua <sha> pela tag que você quer (veja GHCR)
sed -i 's/IMAGE_TAG=.*/IMAGE_TAG=<sha>/' .env
docker compose -f docker-compose.prod.yml pull api
docker compose -f docker-compose.prod.yml up -d api
```

## Saúde e logs

- Health: `curl -sS https://ics-api.daviduarte.com.br/health`
- Logs: `docker compose -f docker-compose.prod.yml logs -f api`
- Caddy: `docker compose -f docker-compose.prod.yml logs -f caddy`
- Postgres shell: `docker compose -f docker-compose.prod.yml exec postgres psql -U ics ics_select`

## Troubleshooting

- **CI falha em "Apply Prisma migrations":** a service do Postgres não subiu a tempo; GitHub Actions retenta até 10x mas se falhar consistentemente, aumentar `--health-retries`.
- **Playwright snapshot diff no CI:** rodar `pnpm --filter @ics-select/web test:update` localmente no mesmo SO (use Docker se estiver no macOS) e commitar os snapshots novos.
- **Deploy falha em "SSH into VPS":** verificar que `VPS_SSH_KEY` no GitHub Secrets é a chave privada completa, incluindo `-----BEGIN ... -----` e `-----END ... -----`.

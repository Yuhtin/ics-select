# ICS Select

Plataforma interna do ICS Select — Programa de Preparação Avançada para Entrevistas Técnicas (Inteli Consulting Society).

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

**Deploy via EasyPanel:**

A API é deployada com EasyPanel na VPS, que importa a imagem publicada no GHCR pelo workflow `.github/workflows/deploy.yml`. Não há SSH no pipeline — o CI só builda e empurra a imagem; o EasyPanel cuida do pull e do restart.

Setup único no EasyPanel:
1. Criar um app do tipo "App" apontando para a imagem `ghcr.io/yuhtin/ics-select-api:latest`.
2. Adicionar credenciais do registry privado (usuário `Yuhtin` + PAT com escopo `read:packages`).
3. Criar um serviço Postgres (com extensão `pgvector` — use a imagem `pgvector/pgvector:pg16`).
4. Criar um serviço Evolution API (opcional, Fase 7).
5. Configurar todas as variáveis de ambiente (ver tabela abaixo). `DATABASE_URL` deve apontar para o serviço Postgres criado pelo EasyPanel.
6. Configurar o domínio `ics-api.daviduarte.com.br` apontando para o app — EasyPanel gera o certificado TLS automaticamente.
7. Criar um "Job" / comando de deploy para rodar `cd /app/node_modules/@ics-select/prisma && npx prisma migrate deploy` antes de cada rollout.

A cada merge em `main`, o workflow de CI roda os testes; passando, o workflow de Deploy builda a imagem e publica duas tags no GHCR (`:<sha-curto>` e `:latest`). Basta configurar o EasyPanel pra auto-pull em cima do `:latest` (ou apontar manualmente para uma tag específica para rollback).

### Frontend (Vercel)

- Projeto Vercel apontando pra este repositório
- **Root Directory:** `apps/web`
- **Build command:** `cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @ics-select/web build`
- **Install command:** (vazio, o build command já instala)
- **Output directory:** `.next` (default)
- Env var: `NEXT_PUBLIC_API_URL=https://ics-api.daviduarte.com.br`
- Domínio customizado: `ics.daviduarte.com.br`

## Secrets necessários no GitHub

Nenhum secret de SSH é necessário — o workflow só usa `GITHUB_TOKEN` (automático) pra publicar no GHCR. As credenciais da VPS ficam do lado do EasyPanel.

## Rollback

No EasyPanel, troque a tag da imagem (`ghcr.io/yuhtin/ics-select-api:<sha-anterior>`) e dispare um redeploy. As tags `:<sha-curto>` persistem indefinidamente no GHCR.

## Saúde e logs

- Health: `curl -sS https://ics-api.daviduarte.com.br/health`
- Logs: pela interface do EasyPanel (aba do app).
- Postgres shell: pela interface do EasyPanel (aba do serviço Postgres).

## Troubleshooting

- **CI falha em "Apply Prisma migrations":** a service do Postgres não subiu a tempo; GitHub Actions retenta até 10x mas se falhar consistentemente, aumentar `--health-retries`.
- **Playwright snapshot diff no CI:** rodar `pnpm --filter @ics-select/web test:update` localmente no mesmo SO (use Docker se estiver no macOS) e commitar os snapshots novos.
- **EasyPanel não consegue puxar a imagem do GHCR:** confirmar que as credenciais do registry privado estão válidas e que o PAT tem escopo `read:packages`.

## Novidades das Fases 5–8

Estas fases consolidam o produto: presença, dashboards, IA, WhatsApp, LGPD e relatórios.

### Fase 5 — Presença + Dashboard Admin

- **Aulas presenciais:** modelos `ClassSession` + `ClassAttendance`. Endpoint admin para registrar presença em lote (`POST /cycles/:id/classes/:classId/attendance`).
- **Dashboard do admin:** `GET /admin/dashboard` retorna métricas de coorte (total de membros, planos publicados, % de itens concluídos, taxa de presença) e visão por membro. UI em `/admin/dashboard` e `/admin/members/[id]`.

### Fase 6 — IA (OpenAI `gpt-5.4-mini`)

- **Draft de plano:** `POST /ai/draft-plan` gera um plano semanal sugerido a partir do histórico do membro e da biblioteca disponível.
- **Brief → plano:** `POST /ai/brief-plan` recebe texto livre do admin e converte em itens estruturados.
- **Diagnóstico do membro:** `GET /members/:id/diagnose` cacheado por 24h, retorna resumo de pontos fortes/fracos.
- **Chat streaming:** `POST /members/:memberId/chat` (SSE) — coach interno do admin com contexto do membro.
- **Auditoria de custo:** todas as chamadas registram em `AiGeneration` (tokens, custo USD). Dashboard de uso em `/admin/ai-usage`.
- Usa a mesma `OPENAI_API_KEY` dos embeddings — não há chave separada.

### Fase 7 — WhatsApp via Evolution API

- **Lembretes automáticos:** cron `@nestjs/schedule` rodando a cada minuto procura `StudySession`s programadas para começar em ~10 minutos e dispara mensagem via WhatsApp.
- **Alerta "travei":** quando o membro marca um item como travado, o admin recebe um WhatsApp.
- **Endpoint de teste:** `POST /notifications/test-whatsapp` (admin) para validar a integração.
- **Auditoria:** toda mensagem (sucesso ou falha) é registrada em `WhatsappLog`.

#### Setup do Evolution API

```bash
docker compose --profile whatsapp up -d evolution
```

Depois pareie o número via QR code no painel admin do Evolution e preencha as variáveis de ambiente abaixo. Se elas não estiverem presentes, a feature degrada graciosamente — o serviço apenas registra `error: 'Evolution API not configured'` em `WhatsappLog`.

### Fase 8 — LGPD + Relatórios

- **Exportar meus dados:** `GET /me/export` retorna JSON com tudo que o usuário possui no sistema (perfil, disponibilidade, ciclos, planos, presenças).
- **Apagar minha conta:** `DELETE /me` remove o usuário; cascatas do Prisma limpam as relações associadas. (Limpeza dos eventos do Google Calendar é best-effort em uma fase futura.)
- **Aviso de privacidade:** o gate em `/privacy` continua bloqueando o uso até o aceite explícito (`User.privacyAcceptedAt`).
- **Relatório de ciclo:** `GET /cycles/:id/report` (admin) baixa um Markdown com cobertura geral, presença por aula e estatísticas por membro. Botão "Baixar relatório" no detalhe do ciclo em `/admin/cycles/[id]`.

## Variáveis de ambiente (API)

Resumo das variáveis suportadas pelo `apps/api`. Ver `apps/api/.env.example` para os defaults locais.

| Nome | Obrigatório | Descrição |
|---|---|---|
| `NODE_ENV` | não | `development` (default), `test`, `production` |
| `PORT` | não | Porta HTTP, default `3001` |
| `DATABASE_URL` | sim | URL Postgres com `?schema=public` |
| `CORS_ALLOWED_ORIGINS` | sim | Lista CSV de origens permitidas |
| `LOG_LEVEL` | não | `info` (default) ou `debug`/`warn`/etc |
| `JWT_SECRET` | sim | ≥ 32 chars |
| `ENCRYPTION_KEY` | sim | 32 bytes em base64 (cifrar tokens Google) |
| `GOOGLE_OAUTH_CLIENT_ID` | sim | OAuth client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | sim | OAuth client secret |
| `GOOGLE_OAUTH_CALLBACK_URL` | sim | URL de callback (`/auth/google/callback`) |
| `ALLOWED_EMAIL_DOMAINS` | sim | CSV de domínios autorizados |
| `BOOTSTRAP_ADMIN_EMAILS` | não | CSV de e-mails que viram ADMIN no primeiro login |
| `FRONTEND_BASE_URL` | sim | URL pública do web (para redirect pós-login) |
| `OPENAI_API_KEY` | sim | OpenAI — embeddings + chat (`gpt-5.4-mini`) das features de IA |
| `EVOLUTION_API_BASE_URL` | não | URL do Evolution API self-hosted (Fase 7) |
| `EVOLUTION_API_KEY` | não | API key do Evolution |
| `EVOLUTION_INSTANCE` | não | Nome da instância pareada |
| `ADMIN_WHATSAPP_NUMBER` | não | Número do admin (E.164) que recebe alertas "travei" |

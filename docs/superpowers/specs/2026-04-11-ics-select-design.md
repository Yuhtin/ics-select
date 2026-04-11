# ICS Select — Design da Plataforma

**Data:** 2026-04-11
**Autor:** Davi Duarte (Diretor Educacional, Inteli Consulting Society)
**Status:** Aprovado (aguardando revisão final antes do plano de implementação)

---

## 1. Visão geral e escopo

### O que é

Plataforma interna do ICS Select, programa seletivo do Inteli Consulting Club focado em preparar alunos para entrevistas técnicas de Big Techs e braços digitais de consultorias. A plataforma suporta dois lados:

- **Admin** (Diretor Educacional): cria ciclos, cadastra membros, gerencia um acervo de materiais de autoestudo, monta planos semanais personalizados com apoio de IA, revisa progresso, marca presença em aulas presenciais.
- **Membro** (até 12 por ciclo): faz login com Google Inteli, define horas disponíveis por dia, vê o plano da semana, executa as atividades, marca fácil/difícil, sinaliza quando trava, deixa reflexões curtas.

### Por que existe

O programa já opera com aulas presenciais semanais e comunicação via WhatsApp, mas falta infraestrutura pra personalizar autoestudo por membro, integrar com a agenda real do aluno, e agregar feedback que alimente a curadoria do próximo plano. A plataforma fecha esse loop.

### Fora do escopo do MVP

- Landing page pública de marketing (fica em projeto separado)
- Seleção via formulário público (admin cadastra diretamente quem passou)
- Área de parceiros com login (parceiros recebem relatório exportado)
- App nativo (é web responsivo)
- Prova de conclusão / upload de código (confia no membro; se marcar por marcar, o problema é dele)

### Premissas duras

- Todos os membros têm conta Google do Inteli ativa; validamos por domínio do email no login
- Turma máxima de 12 participantes, então escala não é problema; priorizamos simplicidade
- Fotos de perfil vêm do `picture` do Google OAuth — zero storage, zero upload
- Reflexões dos membros são visíveis ao admin; isso é documentado no onboarding

### Personas resumidas

| Persona | Onde usa | Frequência | O que espera |
|---|---|---|---|
| Admin (desktop-first) | Notebook | Diária (picos na virada de semana) | Criar planos rapidamente com ajuda de IA, ver o estado da turma de relance |
| Membro (responsivo) | Celular + notebook | Diária | Saber o que estudar hoje, marcar feito, ver progresso |

---

## 2. Arquitetura geral

### Componentes de alto nível

```
┌────────────────────┐          ┌────────────────────────────────────────┐
│  Next.js (Vercel)  │◀── JWT ─▶│       NestJS API (Docker/VPS)          │
│  HeroUI + Tailwind │   HTTPS  │  ┌──────────────────────────────────┐  │
│  App Router        │          │  │ Auth · Cycles · Members · Plans  │  │
│  Playwright (test) │          │  │ Library · Scheduler · AI · Wpp   │  │
└────────────────────┘          │  └──────────────────────────────────┘  │
          │                     │                │                       │
          │                     │                ▼                       │
          ▼                     │    ┌────────────────────────┐          │
  Google OAuth                  │    │ Postgres + pgvector    │          │
                                │    └────────────────────────┘          │
                                └────────────────────────────────────────┘
                                       │          │          │
                                       ▼          ▼          ▼
                              Google Calendar  OpenAI   Anthropic
                              API (por user)   (embed)  (raciocínio)
                                       │
                                       ▼
                              Evolution API (Docker na mesma VPS)
                                       │
                                       ▼
                                    WhatsApp
```

### Domínios

- **Frontend (Vercel):** `ics.daviduarte.com.br`
- **Backend (VPS, via Caddy):** `ics-api.daviduarte.com.br`

### Módulos NestJS (`apps/api/src/`)

| Módulo | Responsabilidade |
|---|---|
| `auth` | Google OAuth (passport-google), JWT de sessão, guards, validação de domínio Inteli |
| `users` | Membros + admins, role, dados do Google (picture, email, nome), privacidade |
| `cycles` | Ciclo atual, histórico, aulas presenciais e presença |
| `library` (acervo) | CRUD de itens, tags, auto-import por URL, busca híbrida (tsvector + pgvector) |
| `study-plans` | Plano semanal, itens ordenados, status por item, reflexões |
| `scheduler` | Distribuir itens nos dias, respeitar disponibilidade e Calendar, quebrar em sessões |
| `google-calendar` | Wrapper OAuth por usuário, leitura de free/busy, criação/atualização de eventos |
| `ai` | Providers (OpenAI embeddings + Anthropic Claude), casos de uso: draft do plano, diagnóstico, chat, brief |
| `whatsapp` | Wrapper Evolution API, envio de lembretes, templates de mensagem |
| `notifications` | Orquestra quando disparar o quê (evento do Calendar é lembrete nativo; WhatsApp é reforço) |

### Estrutura do monorepo

```
ics-select/
├── apps/
│   ├── api/              # NestJS
│   └── web/              # Next.js
├── packages/
│   ├── shared/           # DTOs, tipos, Zod schemas compartilhados
│   └── prisma/           # schema.prisma + client gerado
├── pnpm-workspace.yaml
├── turbo.json
├── docker-compose.yml    # api + postgres + evolution, pra dev e VPS
└── Dockerfile            # build da api (multi-stage, pnpm deploy)
```

### Fluxos críticos

1. **Login membro:** cliente → Google OAuth → backend valida domínio Inteli → cria/atualiza usuário → JWT + refresh cookie → frontend armazena.
2. **Criação de plano semanal com IA:** admin abre editor → clica "Gerar rascunho" → módulo `ai` busca histórico + ratings + reflexões do membro + estado do acervo → Claude devolve lista ordenada de IDs do acervo com justificativa → admin edita → publica.
3. **Publicação → Scheduler:** ao publicar, `scheduler` lê disponibilidade + free/busy do Calendar da semana, divide itens em sessões (quebra quando excede preferência de duração), cria eventos no Google Calendar via API do membro.
4. **Execução do membro:** membro abre home → `GET /me/today` → lista sessões do dia → marca feito → atualiza status + rating → se "travei", notifica admin no dashboard.

---

## 3. Stack técnica

### Backend (`apps/api`)

| Camada | Escolha |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | NestJS 10 |
| ORM | Prisma 5 |
| DB | PostgreSQL 16 + pgvector |
| Auth | `passport-google-oauth20` + `@nestjs/jwt` |
| Validação | `class-validator` + Zod (via shared) |
| Calendar | `googleapis` oficial |
| LLM | `openai` (embeddings) + `@anthropic-ai/sdk` (Claude Sonnet 4.5) |
| WhatsApp | Axios contra Evolution API |
| Config | `@nestjs/config` + validação Zod no boot |
| Logs | `pino` via `nestjs-pino` |
| Testes | Jest (unit) + Supertest (e2e API) |
| Agendamento interno | `@nestjs/schedule` para cron jobs |

### Frontend (`apps/web`)

| Camada | Escolha |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | HeroUI (`@heroui/react`) + Tailwind CSS 4 |
| Ícones | `lucide-react` (outline, sem emojis em lugar nenhum) |
| Estado servidor | TanStack Query |
| Forms | `react-hook-form` + Zod (schemas compartilhados) |
| Tema | `next-themes` (light + dark) |
| HTTP | `ky` ou `fetch` nativo com wrapper fino |
| Testes | Playwright (e2e + visual com `toHaveScreenshot()`) + Vitest (unit onde valer) |
| i18n | Hardcode pt-BR (com acentos preservados) |

### Compartilhado (`packages/shared`)

- Zod schemas para contratos da API (request + response)
- Tipos TS inferidos (`z.infer`)
- Enums (`ItemFormato`, `ItemDificuldade`, `StatusItem`, `Role`, etc.)
- Zero lógica de negócio

### Infra

- **VPS com Docker Compose:** `api`, `postgres` (com pgvector), `evolution-api`, `caddy` (reverse proxy + TLS automático via Let's Encrypt)
- **Vercel:** `apps/web` com root directory configurado, env var `NEXT_PUBLIC_API_URL=https://ics-api.daviduarte.com.br`
- **CI/CD:** GitHub Actions — lint/test em PR; build+push da imagem Docker + deploy via SSH na VPS em merge pra `main`; Vercel auto-deploy do web
- **Backups:** `pg_dump` diário pra Cloudflare R2 (único uso de R2)
- **Secrets:** `.env` no servidor montado no compose; GitHub Secrets pros pipelines

### Observabilidade

- Logs pino → stdout → Docker logs
- Sentry (free tier) pra erros frontend e backend
- Health endpoint `/health` usado pelo Caddy

### Playwright — escopo de testes visuais

- **Smoke visual:** screenshots das 12 telas principais, light + dark, desktop + mobile onde aplicável (~40 snapshots)
- **E2E de fluxos críticos:**
  1. Login Google (mockado via `page.route`)
  2. Membro marca item como feito + dificuldade + reflexão
  3. Admin cria plano semanal → scheduler gera eventos (Google Calendar mockado)
  4. Admin usa IA pra gerar draft (LLM mockado)
  5. Admin marca presença em aula presencial

---

## 4. Modelo de dados

### Diagrama de relações

```
User ──┬── GoogleAccount (1:1, tokens encriptados)
       ├── MemberAvailability (1:1)
       ├── CycleMembership (N) ──▶ Cycle
       ├── WeeklyPlan (N) ──▶ WeeklyPlanItem (N) ──▶ LibraryItem
       │                             │
       │                             └── StudySession (N)
       └── ClassAttendance (N) ──▶ ClassSession ──▶ Cycle

LibraryItem: title, url, format, difficulty, tags[], embedding, tsvector
```

### Schema Prisma

```prisma
enum Role { ADMIN MEMBER }
enum CycleStatus { ACTIVE ARCHIVED }
enum ItemFormat { VIDEO ARTICLE BOOK PROBLEM OTHER }
enum ItemDifficulty { EASY MEDIUM HARD }
enum WeeklyPlanStatus { DRAFT PUBLISHED COMPLETED ARCHIVED }
enum ItemStatus { PENDING DONE }
enum DifficultyRating { EASY HARD }
enum StudySessionStatus { SCHEDULED COMPLETED MISSED RESCHEDULED }
enum AttendanceStatus { PRESENT ABSENT LATE }

model User {
  id                 String    @id @default(cuid())
  email              String    @unique
  name               String
  pictureUrl         String?
  role               Role      @default(MEMBER)
  privacyAcceptedAt  DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  googleAccount GoogleAccount?
  availability  MemberAvailability?
  memberships   CycleMembership[]
  weeklyPlans   WeeklyPlan[]
  attendance    ClassAttendance[]
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id         String   @id @default(cuid())
  userId     String
  tokenHash  String   @unique
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  revokedAt  DateTime?
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}

model GoogleAccount {
  id              String   @id @default(cuid())
  userId          String   @unique
  accessTokenEnc  String
  refreshTokenEnc String
  expiresAt       DateTime
  scope           String
  updatedAt       DateTime @updatedAt
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Cycle {
  id        String      @id @default(cuid())
  name      String      @unique
  startsAt  DateTime
  endsAt    DateTime
  status    CycleStatus @default(ACTIVE)
  createdAt DateTime    @default(now())

  memberships CycleMembership[]
  classes     ClassSession[]
  weeklyPlans WeeklyPlan[]
}

model CycleMembership {
  id       String   @id @default(cuid())
  userId   String
  cycleId  String
  joinedAt DateTime @default(now())
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  cycle    Cycle    @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  @@unique([userId, cycleId])
}

model MemberAvailability {
  id                      String   @id @default(cuid())
  userId                  String   @unique
  mondayMinutes           Int      @default(0)
  tuesdayMinutes          Int      @default(0)
  wednesdayMinutes        Int      @default(0)
  thursdayMinutes         Int      @default(0)
  fridayMinutes           Int      @default(0)
  saturdayMinutes         Int      @default(0)
  sundayMinutes           Int      @default(0)
  preferredSessionMinutes Int      @default(60)
  timezone                String   @default("America/Sao_Paulo")
  updatedAt               DateTime @updatedAt
  user                    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model ClassSession {
  id          String   @id @default(cuid())
  cycleId     String
  title       String
  topic       String?
  scheduledAt DateTime
  durationMin Int      @default(90)
  notes       String?
  cycle       Cycle    @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  attendance  ClassAttendance[]
}

model ClassAttendance {
  id             String           @id @default(cuid())
  classSessionId String
  userId         String
  status         AttendanceStatus
  classSession   ClassSession     @relation(fields: [classSessionId], references: [id], onDelete: Cascade)
  user           User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([classSessionId, userId])
}

model LibraryItem {
  id               String          @id @default(cuid())
  title            String
  url              String?
  description      String?
  format           ItemFormat
  difficulty       ItemDifficulty
  estimatedMinutes Int
  source           String?
  tags             String[]
  embedding        Unsupported("vector(1536)")?
  searchVector     Unsupported("tsvector")?
  createdById      String
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  planItems WeeklyPlanItem[]
  @@index([format])
  @@index([difficulty])
}

model WeeklyPlan {
  id          String           @id @default(cuid())
  userId      String
  cycleId     String
  weekStart   DateTime
  weekEnd     DateTime
  status      WeeklyPlanStatus @default(DRAFT)
  adminNotes  String?
  createdAt   DateTime         @default(now())
  publishedAt DateTime?

  user  User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  cycle Cycle            @relation(fields: [cycleId], references: [id])
  items WeeklyPlanItem[]
  @@index([userId, weekStart])
}

model WeeklyPlanItem {
  id               String            @id @default(cuid())
  weeklyPlanId     String
  libraryItemId    String
  order            Int
  status           ItemStatus        @default(PENDING)
  difficultyRating DifficultyRating?
  stuck            Boolean           @default(false)
  stuckAt          DateTime?
  reflection       String?
  completedAt      DateTime?

  weeklyPlan  WeeklyPlan      @relation(fields: [weeklyPlanId], references: [id], onDelete: Cascade)
  libraryItem LibraryItem     @relation(fields: [libraryItemId], references: [id])
  sessions    StudySession[]
  @@unique([weeklyPlanId, order])
}

model StudySession {
  id               String             @id @default(cuid())
  weeklyPlanItemId String
  scheduledAt      DateTime
  durationMinutes  Int
  googleEventId    String?
  status           StudySessionStatus @default(SCHEDULED)
  weeklyPlanItem   WeeklyPlanItem     @relation(fields: [weeklyPlanItemId], references: [id], onDelete: Cascade)
}

model AiGeneration {
  id             String   @id @default(cuid())
  userId         String?
  purpose        String
  model          String
  promptTokens   Int
  responseTokens Int
  costUsd        Decimal  @db.Decimal(10, 6)
  metadata       Json?
  createdAt      DateTime @default(now())
}

model WhatsappLog {
  id          String    @id @default(cuid())
  userId      String
  kind        String
  payload     Json
  sentAt      DateTime  @default(now())
  deliveredAt DateTime?
  error       String?
}
```

### Notas importantes sobre o schema

- **pgvector / tsvector como `Unsupported`:** Prisma ainda não suporta nativamente. Criamos via SQL puro em migration (`ALTER TABLE ... ADD COLUMN embedding vector(1536)`) e usamos `$queryRaw` pra queries vetoriais. O `tsvector` é mantido por trigger.
- **Tokens do Google encriptados:** `accessTokenEnc`/`refreshTokenEnc` usam AES-256-GCM com chave em env var (`ENCRYPTION_KEY`). Descriptografia só no `GoogleCalendarService`.
- **Unicidade de plano semanal publicado:** não há constraint forte (pra permitir drafts), mas a regra de "só um `PUBLISHED` por `(userId, weekStart)`" vive no service layer.
- **StudySession separado de WeeklyPlanItem:** um item pode gerar N sessões (quebra por duração). Cada sessão é um evento no Google Calendar.
- **Timezone:** armazenamos `weekStart`/`weekEnd` em UTC, mas a interpretação "segunda-feira" usa o `timezone` do `MemberAvailability`.
- **Soft delete:** não é usado. Membro sai da turma = deleta `CycleMembership`, histórico de planos continua ligado ao `User`.
- **`RefreshToken` como tabela:** suporta múltiplos dispositivos e revogação explícita.

---

## 5. Módulos críticos

### 5.1 Scheduler

**Responsabilidade:** pegar um `WeeklyPlan` recém-publicado e virar uma lista de `StudySession` ancoradas no Google Calendar do membro.

**Entrada:**
- `WeeklyPlan` com `items` ordenados (cada um com `estimatedMinutes` do `LibraryItem`)
- `MemberAvailability` (minutos/dia + `preferredSessionMinutes` + timezone)
- Free/busy do Google Calendar do membro na janela `[weekStart, weekEnd]`

**Algoritmo (greedy):**

```
1. Quebra cada item em chunks de até preferredSessionMinutes
   - item de 90min com preferência 45min → 2 chunks de 45min
   - item de 30min → 1 chunk de 30min
   - resíduo (item 100min, pref 45min) → 45 + 45 + 10

2. Monta janelas candidatas por dia da semana:
   - cada dia, pega os minutos disponíveis declarados
   - subtrai os busy slots do Google Calendar naquele dia
   - normaliza pra blocos contínuos >= chunk size

3. Percorre chunks em ordem e coloca no primeiro dia com janela disponível:
   - mantém a ordem dos items (ordem 1 vem antes de ordem 2)
   - adiciona buffer mínimo de 10min entre sessões
   - se não couber, anota no overflow

4. Retorna plano de agendamento + overflow (se houver)
```

**Comportamento em overflow:**
- Publicação fica **bloqueada** — retorna HTTP 409 com `error.code = PLAN_OVERFLOW` e detalhe dos itens que não couberam
- `plan.status` continua `DRAFT`, nenhuma sessão é criada, nenhum evento vai pro Calendar
- Admin decide: reduzir itens, aumentar horas do membro, ou forçar via `POST /plans/:id/publish?force=true` (que ignora overflow e cria só o que cabe, marcando os outros como não agendados)

**Criação dos eventos:**
- Batch na Google Calendar API contra `calendarId: 'primary'` do membro
- Cada evento: título `"ICS Select — <titulo do item>"`, descrição com link do item + deep link pra plataforma marcar feito
- `StudySession` salva com `googleEventId` pra update/delete futuros

**Republicação (re-scheduling):**
- Admin aperta "re-publicar" → scheduler diff entre `StudySession` existentes e nova lista:
  - iguais → mantém
  - mudaram → `events.patch` no Google
  - sobrando → `events.delete` + marca `RESCHEDULED`
- Sessões já `COMPLETED` **nunca** são mexidas

**Edge cases:**
- Membro desconectou Calendar → falha cedo com mensagem clara pro admin
- Item sem `estimatedMinutes` → bloqueia publicação no service layer
- `preferredSessionMinutes > max(dailyMinutes)` → warning, não erro

### 5.2 Busca semântica híbrida (acervo)

**Indexação (no service `library`):**

Ao criar ou editar um item:
```ts
const text = `${title}\n${description ?? ''}\n${tags.join(' ')}`;
const { data } = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: text,
});
// SQL raw:
// UPDATE "LibraryItem"
// SET embedding = $1::vector,
//     search_vector = to_tsvector('portuguese', $2)
// WHERE id = $3;
```

**Query híbrida:**

```ts
async search({ query, filters, limit = 20 }) {
  const queryEmbedding = await this.openai.embed(query);

  return prisma.$queryRaw`
    SELECT
      id, title, url, format, difficulty, estimated_minutes, tags,
      (1 - (embedding <=> ${queryEmbedding}::vector)) * 0.6
        + ts_rank(search_vector, plainto_tsquery('portuguese', ${query})) * 0.4
        AS score
    FROM "LibraryItem"
    WHERE
      (${filters.format}::text IS NULL OR format = ANY(${filters.format}))
      AND (${filters.maxMinutes}::int IS NULL OR estimated_minutes <= ${filters.maxMinutes})
      AND (${filters.tags}::text[] IS NULL OR tags && ${filters.tags})
    ORDER BY score DESC
    LIMIT ${limit};
  `;
}
```

**Atualização do `tsvector`:** via trigger SQL, criado em migration. Nunca fica stale.

**Política de re-embedding:** qualquer edição em título/descrição/tags re-embedda. O custo do `text-embedding-3-small` é baixo o suficiente pra não valer otimização.

### 5.3 Módulo AI

**Providers (ambos injetáveis como `@Injectable()`):**
- `OpenAiProvider` — apenas embeddings
- `AnthropicProvider` — Claude Sonnet 4.5 para raciocínio

**Casos de uso:**

**(a) `DraftPlanUseCase`** (Feature 1 — draft automático a partir do feedback anterior)
- Input: `memberId`, `basePlanId` opcional (default: último publicado)
- Contexto: plano anterior + ratings + reflexões + sinais de "travei", cobertura de tópicos histórica, total de minutos disponíveis na próxima semana
- Claude com **tool use**:
  - `search_library(query, filters)` → chama `library.search()` e retorna candidatos
  - `finalize_plan(items[], narrative)` → encerra o loop e devolve JSON estruturado
- Output: `{ items: [{ libraryItemId, order, rationale }], narrative, totalMinutes }`

**(b) `BriefPlanUseCase`** (Feature 2 — criação guiada por brief do admin)
- Input: `memberId`, `briefText`
- Mesma mecânica da (a), mas o prompt dá prioridade ao brief sobre o histórico
- Output: mesmo formato

**(c) `DiagnoseUseCase`** (Feature 3 — insights sobre o membro)
- Input: `memberId`
- Contexto: todos os planos do membro + ratings + reflexões + presença em aulas
- Claude sem tools, só reasoning
- Output: markdown estruturado (pontos fortes, fracos, padrões, sugestão de próximos passos)
- **Cache de 24h** por membro

**(d) `ChatContextUseCase`** (Feature 4 — chat contextual no admin)
- Input: `memberId`, `messages[]`
- Contexto do membro injetado como primeira system message
- Stream de tokens via SSE pro frontend
- Tool `search_library` disponível
- **Não persiste** mensagens no banco (ephemeral, vive só na sessão do navegador)

**Observabilidade e custo:**
- Cada chamada grava `AiGeneration` com `purpose`, `model`, tokens, `costUsd`
- Tela simples "Uso de IA" somando custo por semana

**Rate limit:**
- Draft e Brief: 1/min por membro alvo
- Diagnose: cache de 24h já limita
- Chat: 50 mensagens/dia por sessão

---

## 6. API REST

**Convenções:**
- Base URL: `https://ics-api.daviduarte.com.br`
- Auth: `Authorization: Bearer <jwt>` em tudo exceto `/auth/*` e `/health`
- JSON, `camelCase`
- Erros: `{ error: { code, message, details? } }`
- Paginação: `?page=1&pageSize=20` → `{ data, total, page, pageSize }`
- CORS permite apenas `https://ics.daviduarte.com.br` e `http://localhost:3000` em dev

### Endpoints

#### `auth`
| Método | Path | Descrição |
|---|---|---|
| `GET` | `/auth/google` | Redirect pro consent do Google |
| `GET` | `/auth/google/callback` | Handler do OAuth |
| `POST` | `/auth/refresh` | Troca refresh token por novo JWT |
| `POST` | `/auth/logout` | Invalida refresh cookie |
| `GET` | `/auth/me` | Retorna `User` atual + role |

#### `users`
| Método | Path | Descrição |
|---|---|---|
| `GET` | `/me` | Perfil do usuário autenticado |
| `PATCH` | `/me/availability` | Atualiza horas/dia e `preferredSessionMinutes` |
| `GET` | `/me/export` | Exportação LGPD (JSON) |
| `DELETE` | `/me` | Deleção LGPD em cascata |
| `GET` | `/members` | Lista membros do ciclo ativo (admin) |
| `GET` | `/members/:id` | Detalhe do membro (admin + próprio) |
| `POST` | `/members` | Admin convida novo membro |
| `DELETE` | `/members/:id` | Remove membership do ciclo atual (admin) |

#### `cycles` (admin-only)
| Método | Path | Descrição |
|---|---|---|
| `GET` | `/cycles` | Lista ciclos |
| `POST` | `/cycles` | Cria novo ciclo |
| `PATCH` | `/cycles/:id` | Edita ciclo |
| `POST` | `/cycles/:id/archive` | Arquiva ciclo |
| `GET` | `/cycles/:id/classes` | Aulas do ciclo |
| `POST` | `/cycles/:id/classes` | Cria aula |
| `PATCH` | `/classes/:classId` | Edita aula |
| `POST` | `/classes/:classId/attendance` | Marca presenças em batch |

#### `library`
| Método | Path | Descrição |
|---|---|---|
| `GET` | `/library` | Lista paginada com filtros |
| `POST` | `/library/search` | Busca híbrida |
| `POST` | `/library` | Cria item manualmente |
| `POST` | `/library/import` | Auto-import por URL |
| `PATCH` | `/library/:id` | Edita |
| `DELETE` | `/library/:id` | Remove (bloqueia se em uso em plano ativo) |

#### `study-plans`
| Método | Path | Descrição | Quem |
|---|---|---|---|
| `GET` | `/members/:id/plans` | Histórico | admin + próprio |
| `GET` | `/plans/:id` | Detalhe | admin + dono |
| `POST` | `/members/:id/plans` | Cria draft vazio | admin |
| `PATCH` | `/plans/:id` | Edita items | admin |
| `POST` | `/plans/:id/publish` | Publica → scheduler | admin |
| `POST` | `/plans/:id/republish` | Re-agenda | admin |
| `POST` | `/plans/:id/items/:itemId/done` | Marca feito + rating + reflexão | membro |
| `POST` | `/plans/:id/items/:itemId/stuck` | Marca travei | membro |
| `GET` | `/me/today` | Sessões do dia | membro |
| `GET` | `/me/week` | Plano atual + progresso | membro |

#### `ai` (admin-only)
| Método | Path | Descrição |
|---|---|---|
| `POST` | `/ai/draft-plan` | Draft automático |
| `POST` | `/ai/brief-plan` | Draft por brief |
| `GET` | `/members/:id/diagnose` | Diagnóstico (cache 24h) |
| `POST` | `/members/:id/chat` (SSE) | Chat contextual |
| `GET` | `/ai/usage` | Custo agregado |

#### `notifications`
| Método | Path | Descrição |
|---|---|---|
| `POST` | `/notifications/test-whatsapp` | Teste de mensagem |

#### `health`
| `GET` | `/health` | 200 com versão e uptime |

### Contratos-chave

**`POST /library/search`**
```ts
// request
{
  query: "programação dinâmica introdução",
  filters: {
    format: ["VIDEO", "ARTICLE"],
    difficulty: ["EASY", "MEDIUM"],
    tags: ["dp"],
    maxMinutes: 60
  },
  limit: 20
}
// response
{
  data: [
    {
      id: "clxyz...",
      title: "DP for Beginners - NeetCode",
      url: "https://...",
      format: "VIDEO",
      difficulty: "EASY",
      estimatedMinutes: 45,
      tags: ["dp", "recursion"],
      score: 0.87
    }
  ],
  total: 14
}
```

**`POST /plans/:id/publish`**
```ts
// 200 OK — publicado com sucesso
{
  plan: { id, status: "PUBLISHED", publishedAt },
  scheduling: { sessionsCreated: 8 }
}

// 409 Conflict — overflow (plano continua DRAFT, nada foi agendado)
{
  error: {
    code: "PLAN_OVERFLOW",
    message: "Não há janelas suficientes no Calendar pra este plano",
    details: {
      overflow: [
        { libraryItemId: "clxyz...", minutesRequired: 45, reason: "sem janela disponível" }
      ],
      missingMinutes: 45
    }
  }
}

// Para forçar publicação ignorando overflow:
// POST /plans/:id/publish?force=true  →  200 com apenas os itens que couberam
```

**`POST /ai/draft-plan`**
```ts
// request
{ memberId: "...", basePlanId: "..." }
// response
{
  draft: {
    items: [
      {
        libraryItemId: "...",
        order: 1,
        rationale: "Na semana passada marcou 'difícil' em 3 problemas de recursão..."
      }
    ],
    narrative: "Foco da semana: consolidar recursão antes de introduzir DP...",
    totalMinutes: 280
  },
  usage: { promptTokens, responseTokens, costUsd }
}
```

**`POST /plans/:id/items/:itemId/done`**
```ts
// request
{
  rating: "HARD",
  reflection: "Travei no passo da recursão, entendi depois de ver a solução"
}
// response
{ item: { id, status: "DONE", completedAt, rating, reflection } }
```

---

## 7. Segurança, privacidade, erros

### Autenticação e autorização

- **Google OAuth com allowlist de domínio:** backend rejeita qualquer email que não termine no domínio Inteli configurado em env var
- **JWT curto (15min) + refresh token longo (30 dias):**
  - JWT em `Authorization: Bearer ...`
  - Refresh em cookie `httpOnly`, `secure`, `sameSite=lax`, path `/auth/refresh`
  - Rotação: cada refresh invalida o anterior (tabela `RefreshToken`)
- **Guards NestJS:**
  - `JwtAuthGuard` — valida token, injeta `req.user`
  - `RolesGuard` + decorator `@Roles('ADMIN')`
  - `OwnershipGuard` — membro só acessa seus próprios recursos

### Criptografia de tokens do Google

- AES-256-GCM, chave em `ENCRYPTION_KEY` (32 bytes base64)
- Criptografia só no `GoogleCalendarService`, tokens nunca saem pra frontend
- Procedimento de rotação de chave documentado no README

### CORS

- Origins permitidas: `https://ics.daviduarte.com.br` (prod), `http://localhost:3000` (dev, só se `NODE_ENV !== 'production'`)
- `credentials: true`
- Headers: `Authorization`, `Content-Type`

### Rate limiting

- `@nestjs/throttler` global: 100 req/min por IP
- `/ai/draft-plan`, `/ai/brief-plan`: 1/min por usuário
- `/library/search`: 30/min por usuário
- `/auth/*`: 10/min por IP
- `/notifications/test-whatsapp`: 5/hora

### Validação de input

- Todos DTOs validados por Zod (schemas compartilhados via `packages/shared`)
- Mesmo schema usado no `react-hook-form` do frontend
- Rejeição = 400 com detalhes dos campos errados

### Privacidade e LGPD

**Coletamos:** nome, email, foto (URL do Google), tokens do Calendar (encriptados), disponibilidade, histórico de estudo, reflexões, ratings.

**Tela de aviso no primeiro login:** explica o que é coletado, pra quê, quem vê. Inclui explicitamente que reflexões e feedback são visíveis ao admin. Aceite registrado em `User.privacyAcceptedAt`. Sem aceite, sem acesso.

**Direitos:**
- `GET /me/export` → JSON com todos os dados do usuário
- `DELETE /me` → deleção em cascata + melhor esforço em remover eventos criados no Calendar do membro

**Não logar:**
- Reflexões, conteúdo de chat com IA, tokens — nunca vão pra logs nem pro Sentry
- `LogCleanerInterceptor` redaciona campos sensíveis do request body antes de logar

### Tratamento de erros

**Formato padrão:**
```json
{
  "error": {
    "code": "PLAN_OVERFLOW",
    "message": "Não há janelas suficientes no Calendar pra este plano",
    "details": { "overflowItems": ["clxyz..."], "missingMinutes": 45 }
  }
}
```

**Códigos:**
| Código | HTTP | Quando |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Payload inválido |
| `UNAUTHENTICATED` | 401 | JWT ausente/inválido |
| `FORBIDDEN` | 403 | Role ou ownership falha |
| `NOT_FOUND` | 404 | Recurso inexistente |
| `CONFLICT` | 409 | Ex: plano já publicado |
| `PLAN_OVERFLOW` | 409 | Scheduler não conseguiu encaixar |
| `RATE_LIMITED` | 429 | Throttler |
| `GOOGLE_CALENDAR_FAIL` | 502 | Google API fora |
| `AI_PROVIDER_FAIL` | 502 | OpenAI/Anthropic fora |
| `INTERNAL` | 500 | Qualquer outra |

**Exception filter global** converte `Error`/`HttpException`/`ZodError` pra esse formato.

**Retry automático:** só em `GOOGLE_CALENDAR_FAIL` e `AI_PROVIDER_FAIL`, só em leituras, com backoff exponencial.

### Secrets e infraestrutura

- `.env` no servidor, nunca no repo; `.env.example` committado
- Docker compose com `env_file`
- GitHub Secrets pros pipelines
- Postgres só na rede interna do compose
- Evolution API exposta só na rede interna

### Backup e recuperação

- `pg_dump` diário via cron no host → Cloudflare R2
- Retenção: 7 diários + 4 semanais + 3 mensais
- Chave do R2 guardada separada
- Recovery drill documentado e executado antes do primeiro ciclo real

---

## 8. Plano de entrega em fases

Cada fase é incremental, deployável, e fecha um fluxo de ponta a ponta.

### Fase 0 — Fundação (1 semana)

- Scaffold pnpm + Turborepo (`apps/api`, `apps/web`, `packages/shared`, `packages/prisma`)
- NestJS + Prisma + Postgres + pgvector (migration inicial criando extensão)
- Next.js 15 + HeroUI + Tailwind + lucide-react + `next-themes`
- Docker Compose (api + postgres + evolution-api + caddy) na VPS
- GitHub Actions (lint, test, build, deploy SSH; Vercel auto)
- Domínios `ics.daviduarte.com.br` e `ics-api.daviduarte.com.br` + TLS
- Health endpoint + página inicial estática
- **Verificável:** `curl https://ics-api.daviduarte.com.br/health` → 200; frontend online

### Fase 1 — Auth + usuários + ciclos (1 semana)

- Google OAuth + JWT + refresh + guards
- CRUD de `Cycle`, `User`, `CycleMembership`
- Telas: Login, Ciclos (admin), Membros com carometro (admin)
- Privacidade + aceite
- Playwright smoke: login, ver lista de membros
- **Verificável:** login como admin, cria `2026.1`, adiciona 2 membros teste, eles logam e aparecem no carometro

### Fase 2 — Acervo + busca semântica (1 semana)

- CRUD de `LibraryItem`
- Auto-import por URL (meta tags)
- Integração OpenAI embeddings + trigger de tsvector
- Endpoint `/library/search` híbrido
- Telas: Acervo (admin), Adicionar item (admin)
- Playwright: criar item, importar por URL, buscar
- **Verificável:** 20+ itens reais, busca "grafos bfs" retorna relevantes

### Fase 3 — Disponibilidade + Google Calendar (1 semana)

- Scope adicional do OAuth
- `MemberAvailability` CRUD
- `GoogleCalendarService` (free/busy, create/update/delete)
- Tela membro "Disponibilidade"
- **Verificável:** membro define 1h/dia, plataforma lê free/busy

### Fase 4 — Planos semanais + scheduler (1.5 semanas)

- CRUD `WeeklyPlan` + `WeeklyPlanItem`
- `SchedulerService` (greedy + overflow)
- Publicação cria eventos no Calendar; re-publicação via diff
- Telas: Editor de plano (admin), "Esta semana" e "Item detalhado" (membro)
- Endpoints `/me/today`, `/me/week`
- Playwright: fluxo completo admin → membro
- **Verificável:** plano de 5 itens publicado, eventos no Calendar, membro marca 1 como feito

### Fase 5 — Presença + dashboard admin (0.5 semana)

- CRUD de `ClassSession` + `ClassAttendance`
- Tela "Aulas do ciclo" (criar + marcar presença em batch)
- Tela "Dashboard" admin (12 cards com métricas, alertas)
- Tela "Detalhe do membro" (histórico + heatmap de tópicos)
- **Verificável:** presença marcada, dashboard mostra métricas

### Fase 6 — IA (1 semana)

- `AnthropicProvider` + `OpenAiProvider`
- `DraftPlanUseCase`, `BriefPlanUseCase`, `DiagnoseUseCase`, `ChatContextUseCase`
- Tool calling do Claude com `search_library`
- Tela "Uso de IA" com custo semanal
- Playwright com LLM mockado
- **Verificável:** gera plano com IA, edita, publica; chat contextual responde

### Fase 7 — WhatsApp + notificações (0.5 semana)

- Wrapper da Evolution API
- Cron `@nestjs/schedule` — lembrete 10min antes de cada `StudySession`
- Alerta ao admin quando membro marca "travei"
- `WhatsappLog` + purge job (90 dias)
- Endpoint de teste
- **Verificável:** membro recebe WhatsApp de lembrete

### Fase 8 — Exportação + polimento (0.5 semana)

- `GET /me/export` e `DELETE /me`
- Relatório do ciclo exportável (markdown/PDF) pra parceiros
- Baseline visual completa do Playwright (~40 snapshots)
- README completo (setup, deploy, rotação, recovery)
- **Verificável:** suite passa 100%, README roda em máquina limpa

### Resumo de esforço

| Fase | Duração | Entrega |
|---|---|---|
| 0 | 1 sem | Infra |
| 1 | 1 sem | Auth + ciclos + membros |
| 2 | 1 sem | Acervo + busca |
| 3 | 1 sem | Calendar + disponibilidade |
| 4 | 1.5 sem | Planos + scheduler |
| 5 | 0.5 sem | Presença + dashboard |
| 6 | 1 sem | IA |
| 7 | 0.5 sem | WhatsApp |
| 8 | 0.5 sem | Polimento |
| **Total** | **~8 semanas** | Plataforma completa |

**MVP mínimo utilizável:** Fases 0–4 (~5 semanas). A partir daí um ciclo real já roda (manual nas partes que faltam).

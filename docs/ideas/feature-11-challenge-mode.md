# Feature 11 — Challenge Mode (Simulações de Live Coding)

**Data:** 2026-05-23
**Status:** Spec v0
**Superfícies:** `/me/item/[id]` (membro), `/me/challenge/[id]` (membro, tela do challenge), `/admin/member/[id]` (Cockpit Admin), `/admin/library` (edição de test cases)

---

## Contexto

O objetivo #1 do programa é preparação para entrevistas técnicas reais. Entrevistas têm três sinais que a plataforma hoje não captura:

1. **Pressão de tempo.** O membro resolve LeetCode no próprio site, sem cronômetro. Quando chega na entrevista real ele trava com 45 minutos contados na cara.
2. **Articulação técnica em texto.** Entrevistadores avaliam o "como você pensa", não só o código final. Hoje o membro nunca pratica escrever approach antes de codar.
3. **Código executado sob pressão.** O membro resolve no LeetCode com IntelliSense, com pause infinito pra pensar, e clica Run sempre que quiser. Numa entrevista de verdade ele está num CoderPad cru, com 1-2 attempts antes de gastar credibilidade.

Esta feature adiciona um modo "Challenge" que envolve qualquer item `PROBLEM` da library com: (a) timer visível, (b) campo obrigatório de approach textual, (c) editor de código embutido com execução real contra test cases.

Os mocks (feature 4) cobrem entrevistas completas conduzidas pelo admin. Challenge mode é o complemento: prática solo, repetível, do membro.

---

## Problema

1. Membro resolve LeetCode sem timer e sem registro, então não sabe quanto demorou nem o admin sabe a evolução.
2. Não há histórico do "approach" que o membro pensou antes de codar.
3. Plataforma é passiva: a aula ensina conceitos, mas o membro sai sem ter executado código sob pressão DENTRO do produto.
4. Admin não tem visibilidade granular de "Eduardo resolveu Two Sum em 12min na 3ª tentativa, approach foi hashmap direto, 4/5 test cases passaram".

---

## Metas (v0)

- Cronometrar uma tentativa contra um item `PROBLEM` da library.
- Forçar approach textual antes de submeter.
- **Editor de código embutido** (Python 3.12 e C++ 17 no v0).
- **Code execution real** num sandbox Docker isolado na VPS.
- **Test cases curados pelo admin por item**, executados automaticamente com pass/fail por caso.
- Self-rating (Easy / Medium / Hard / Abandoned).
- Histórico de tentativas do próprio membro inline na página do item.
- **Histórico de cohort gated**: o membro só vê tentativas de outros membros DEPOIS de submeter a própria. Depois libera nome + tempo + rating + approachText.
- Cockpit do admin com aba Challenges.

## Não-metas (explícitas)

- **AI review automático.** v1 talvez.
- **Leaderboard / gamificação.** Sai da missão e desencoraja iniciante.
- **Anti-cheat de digitação.** Se o membro copia/cola código, vamos detectar via heurística simples (paste size + delta de timer), mas não bloqueamos.
- **Integração com mocks.** Domínios separados.

---

## Design

### 1. Schema

Duas mudanças no Prisma:

**(a) Test cases na library:**

```prisma
model LibraryItem {
  // ... campos existentes
  testCases       Json?              // array de TestCase, null = sem test cases curados
  testCasesLanguages String[] @default([])  // linguagens que o admin marcou como suportadas
}
```

O JSON é validado em runtime via Zod schema (não no Prisma) com shape:

```typescript
type TestCase = {
  name: string;        // ex: "small", "edge-empty", "large"
  stdin: string;       // input bruto, terminado com \n
  expectedStdout: string;  // output esperado, terminado com \n
  hidden?: boolean;    // se true, o membro vê o nome do caso mas não o input/output
};
```

Pattern stdin/stdout em vez de assinaturas de função porque (a) atravessa 5 linguagens sem precisar de N harnesses, (b) bate com o estilo de competitive programming, (c) admin escreve uma vez e roda em qualquer linguagem.

Itens da library sem `testCases` continuam funcionando: o member ainda pode usar challenge mode, mas só vê stdout/stderr do próprio Run. Sem grading.

**(b) Tentativa do membro:**

```prisma
enum ChallengeLanguage {
  PYTHON
  CPP
}

enum ChallengeRating {
  EASY
  MEDIUM
  HARD
  ABANDONED
}

model ChallengeAttempt {
  id            String            @id @default(cuid())
  userId        String
  cycleId       String
  libraryItemId String
  language      ChallengeLanguage
  startedAt     DateTime          @default(now())
  submittedAt   DateTime?
  durationSec   Int
  approachText  String
  finalCode     String            // código no momento da submissão
  selfRating    ChallengeRating
  notes         String?
  // resultado consolidado dos test cases (null se item sem test cases curados)
  testsPassed   Int?
  testsTotal    Int?
  // raw para debug do admin: por caso, pass/fail/timeout/runtime_error + stdout/stderr cortados
  testResults   Json?
  createdAt     DateTime          @default(now())

  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  cycle       Cycle       @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  libraryItem LibraryItem @relation(fields: [libraryItemId], references: [id], onDelete: Cascade)

  @@index([userId, cycleId])
  @@index([userId, libraryItemId])
  @@index([libraryItemId, submittedAt])  // pro feed de cohort por item
}
```

Adicionar relations `challenges ChallengeAttempt[]` em `User`, `Cycle` e `LibraryItem`.

Migration aditiva, letra `z` (próxima após `y_mock_interviews`).

### 2. Code execution sandbox + esteira CI/CD

**CI/CD pipeline (parte do PR1):**

- **Dockerfiles em `infra/sandbox/`** (versionados no monorepo, junto do código).
- **Dependabot** (`.github/dependabot.yml`) monitora as bases (`python:3.12-slim`, `gcc:13`-equivalent). Sai CVE patch numa base, Dependabot abre PR bumpando digest. PR é trivial de revisar (uma linha) e merge dispara o workflow.
- **GitHub Actions** `.github/workflows/sandbox-images.yml`:
  - Triggers: `push` em `main` quando muda `infra/sandbox/**`, `schedule` semanal (domingos 06:00 UTC), `workflow_dispatch` manual.
  - Steps por imagem: `docker buildx build` → `trivy image --severity HIGH,CRITICAL --exit-code 1` → push pra `ghcr.io/yuhtin/ics-sandbox-{python,cpp}` com tags `:stable` e `:stable-YYYYMMDD` (datada permite rollback).
  - Trivy bloqueia push se há vuln HIGH/CRITICAL não-corrigida.
- **VPS cron** `0 7 * * 0` (domingo 07:00 BRT): script `/opt/ics-sandbox/refresh.sh` que faz `docker pull` das duas imagens stable + `docker image prune -f`. Script versionado em `infra/sandbox/refresh.sh`, deployado uma única vez na VPS.
- **API consome** via env var `SANDBOX_PYTHON_IMAGE=ghcr.io/yuhtin/ics-sandbox-python:stable` (idem CPP). Default no `apps/api/.env.example`. Zero redeploy quando a imagem rebuilda; o próximo `docker run` na VPS pega automaticamente a versão pulled mais recente.

Resultado: CVE em base image → Dependabot PR → merge → GHA build + Trivy → push pra ghcr → cron da VPS pula no próximo domingo. Manual zero, exceto aprovar o PR do Dependabot.

**Imagens base** (build-once por release, locked):

Arquitetura: novo módulo `apps/api/src/sandbox/` que orquestra containers Docker efêmeros, um por execução. Roda na própria VPS (mesmo host do EasyPanel).

**Imagens base** (build-once, locked):

| Linguagem | Imagem | Entrypoint |
|---|---|---|
| Python 3.12 | `ics-sandbox-python:1.0` | `python3 /code/main.py` |
| C++ 17 | `ics-sandbox-cpp:1.0` | `g++ -O2 -std=c++17 main.cpp -o main && ./main` |

Cada imagem é construída a partir da base oficial (`python:3.12-slim`, `gcc:13`-derivada) + usuário não-root `runner` + dir `/code`. SEM debuggers, gerenciadores de pacote ou ferramentas extras além do necessário pra rodar.

**Flags de execução** (todos os `docker run`):

```
--rm                          # auto-cleanup
--network=none                # sem rede (impede DNS exfil, downloads, etc)
--memory=256m                 # limite de RAM
--memory-swap=256m            # sem swap (caso contrário OOM vira slow)
--cpus=0.5                    # 50% de uma CPU
--pids-limit=64               # impede fork bomb
--read-only                   # rootfs imutável
--tmpfs=/tmp:rw,noexec,size=20m   # único dir gravável
--user=runner                 # nunca root
--cap-drop=ALL                # sem capabilities
--security-opt=no-new-privileges
--ulimit=nofile=64:64         # limite de file descriptors
--ulimit=fsize=10485760       # max 10MB por arquivo escrito
```

**Timeout**: `5s wall clock por test case`. Excedeu, marca o caso como TIMEOUT e mata o container.

**Fluxo de uma execução:**

1. Frontend envia `{ language, code, stdin }` pro endpoint `/me/challenges/:id/run`.
2. Backend escreve `code` em `/tmp/ics-sandbox/<uuid>/main.<ext>` no host.
3. `docker run --rm <flags> -v /tmp/ics-sandbox/<uuid>:/code:ro <imagem>` com `stdin` redirecionado.
4. Captura stdout/stderr/exitCode + tempo decorrido. Mata se >5s.
5. Cleanup do dir do host.
6. Retorna `{ stdout, stderr, exitCode, durationMs, status: 'OK' | 'TIMEOUT' | 'COMPILE_ERROR' | 'RUNTIME_ERROR' }`.

**Submissão (versus Run avulso):** mesmo pipeline, mas executa contra TODOS os test cases do item em paralelo (pool com max 3 simultâneos pra não estourar a VPS). Compara `stdout` normalizado (trim + \r\n → \n) com `expectedStdout`. Resultado por caso é PASS, FAIL, TIMEOUT, RUNTIME_ERROR ou COMPILE_ERROR.

**Concorrência global**: novo serviço `SandboxQueueService` com semáforo (max 4 execuções simultâneas no host inteiro). Excedeu, request fica em queue (timeout 30s). Protege a VPS de overload se 10 membros submetem ao mesmo tempo.

**Hardening adicional**:
- Daemon do Docker já roda como root na VPS. Não há como evitar. **Mitigação**: rodar todo o pipeline de sandbox via socket Unix com Docker daemon configurado em `userns-remap` (mapeia root do container pra UID não-privilegiado no host). Documentar essa config no `docs/sandbox-setup.md`.
- Logs de cada execução vão pro Postgres na tabela `SandboxExecutionLog` (separada de ChallengeAttempt — útil pra debug e pra auditar abuso). Reter 30 dias.

### 3. Endpoints

**Membro (`apps/api/src/me/challenges/`):**

- `POST /me/challenges/start` — `{ libraryItemId, language }`. Retorna `{ attemptId, startedAt, starterCode }`. `starterCode` é um template por linguagem (esqueleto que lê stdin e imprime stdout, pra reduzir fricção).
- `POST /me/challenges/:id/run` — `{ language, code, stdin }`. Roda contra a stdin fornecida (não os test cases). Retorna stdout/stderr. Usado pelo botão "Run" do editor.
- `POST /me/challenges/:id/submit` — `{ language, code, approachText, selfRating, notes? }`. Roda contra todos os test cases do item, calcula `testsPassed/testsTotal`, atualiza row. Server calcula `durationSec`.
- `POST /me/challenges/:id/abandon` — body vazio. Marca ABANDONED, salva o código atual em `finalCode` pra debug.
- `GET /me/challenges?libraryItemId=...` — histórico do próprio membro (até 20).
- `GET /me/challenges/cohort?libraryItemId=...` — histórico de cohort do item. **Gate**: se o membro nunca submetou esse item (`submittedAt IS NULL` ou só tem ABANDONED), retorna `{ unlocked: false, count: N }` (mostra só contagem). Se já submetou pelo menos uma tentativa não-abandoned, retorna `{ unlocked: true, attempts: [...] }` com nome, durationSec, rating, approachText, language, testsPassed/testsTotal.

**Admin (`apps/api/src/admin/challenges/`):**

- `GET /admin/challenges?userId=...&cycleId=...` — listagem ordenada por `startedAt desc`.
- `DELETE /admin/challenges/:id` — apagar entrada errada.
- `PATCH /admin/library/:id/test-cases` — atualiza `testCases` + `testCasesLanguages` no LibraryItem. Body validado por Zod schema do TestCase.

### 4. Validação Zod

```typescript
const TestCaseSchema = z.object({
  name: z.string().min(1).max(60),
  stdin: z.string().max(8192),
  expectedStdout: z.string().max(8192),
  hidden: z.boolean().optional(),
});

const StartChallengeSchema = z.object({
  libraryItemId: z.string().min(1),
  language: z.enum(['PYTHON', 'CPP']),
}).strict();

const RunChallengeSchema = z.object({
  language: z.enum(['PYTHON', 'CPP']),
  code: z.string().min(1).max(32768),
  stdin: z.string().max(8192).default(''),
}).strict();

const SubmitChallengeSchema = z.object({
  language: z.enum(['PYTHON', 'CPP']),
  code: z.string().min(1).max(32768),
  approachText: z.string().min(20).max(8000),
  selfRating: z.enum(['EASY', 'MEDIUM', 'HARD']),
  notes: z.string().max(2000).optional(),
}).strict();

const UpdateTestCasesSchema = z.object({
  testCases: z.array(TestCaseSchema).max(30),
  testCasesLanguages: z.array(z.enum(['PYTHON', 'CPP'])).max(2),
}).strict();
```

### 5. UI do membro

**(a) Botão de entrada em `/me/item/[id]`:**

Quando `libraryItem.format === 'PROBLEM'`, aparece o botão "▶ Start challenge" ao lado de "Open on LeetCode". Sub-texto pequeno: "code editor · timer · test cases" se o item tem test cases curados, ou só "code editor · timer" se não tem.

**(b) Tela do challenge (`/me/challenge/[id]`):**

Layout 60/40 split vertical em desktop, stack em mobile.

```
┌─ Header ────────────────────────────────────────────┐
│ ◀ Cancel       Two Sum         Timer · 02:34       │
│                lang [Python ▼]                      │
├─────────────────────────────┬───────────────────────┤
│                              │ APPROACH (obrig)      │
│  ┌────────────────────────┐ │ ┌───────────────────┐ │
│  │                        │ │ │ Pensei em força   │ │
│  │   [Code editor         │ │ │ bruta primeiro    │ │
│  │    CodeMirror 6]       │ │ │ mas dá pra...     │ │
│  │                        │ │ └───────────────────┘ │
│  │                        │ │                       │
│  └────────────────────────┘ │ TEST CASES            │
│                              │ ▸ small               │
│  STDIN              [Run]    │ ▸ medium              │
│  ┌────────────────────────┐ │ ▸ edge-empty          │
│  │ 3                      │ │                       │
│  │ 1 2 3                  │ │ How was it?           │
│  └────────────────────────┘ │ [EASY][MEDIUM][HARD]  │
│                              │                       │
│  OUTPUT                      │ Notes (optional)      │
│  ┌────────────────────────┐ │ ┌───────────────────┐ │
│  │ 6                      │ │ │                   │ │
│  └────────────────────────┘ │ └───────────────────┘ │
│                              │                       │
│                              │  [Submit] [I gave up] │
└──────────────────────────────┴───────────────────────┘
```

Detalhes:
- **Timer no header**, font-mono, sem botão de pause. Server recalcula no submit.
- **Language picker** vira ChallengeLanguage. Trocar de linguagem reseta o code editor pro starter template (com confirmation modal se já tem code).
- **CodeMirror 6** com syntax highlighting + autoclose brackets. Sem IntelliSense (queremos simular CoderPad cru). Tema: light/dark via next-themes.
- **Stdin box** abaixo do editor: o membro digita um input qualquer pra testar manualmente. Botão "Run" roda contra essa stdin (não os test cases reais).
- **Output box** mostra stdout/stderr do último Run. Vermelho se exitCode ≠ 0 ou TIMEOUT.
- **Test cases sidebar** mostra a lista de casos. Antes do submit, status é "—". Hidden cases mostram só o name, não input/output. Visible cases o membro pode expandir e ver o stdin/expectedStdout.
- **Submit** roda contra TODOS os test cases. Aparece overlay com loading ("Running 5 tests..."). Resultado: lista com ● PASS / ✗ FAIL / ⏱ TIMEOUT / 💥 RUNTIME_ERROR por caso. **Submit nunca falha por test cases falhando** — submit registra o estado real. testsPassed pode ser 0/5 e a tentativa fica registrada normalmente.
- **"I gave up"** marca ABANDONED imediatamente. Confirmação modal: "Salvar tempo decorrido e código atual?"

**(c) Página do item depois de tentar:**

Mostra tentativas próprias do membro abaixo do botão start:

```
Your attempts on this:
1. May 22 · Python · 18min · HARD · 3/5 tests
2. May 18 · Python · 25min · ABANDONED · —
3. May 14 · Python · 31min · HARD · 5/5 tests

Cohort: 6 members have tried this. Solve it to see how. [locked]
```

Depois que o membro submete uma tentativa não-abandoned, o "locked" some e vira link clicável:

```
Cohort attempts (6) ▾
  Lorena · Python · 9min · EASY · 5/5
  Eduardo · Python · 14min · MEDIUM · 5/5
  Felipe · JavaScript · 17min · MEDIUM · 4/5
  ...
  [click name to see approach + final code]
```

### 6. UI do admin

**(a) Aba `Challenges` no raw-data-accordion:**

Lista de cards parecidos com os mocks, mas com mais info:

```
May 22 · Two Sum · Python · 18min
HARD · 3/5 tests passed

Approach:
"Pensei em força bruta primeiro mas dá pra usar hashmap..."

Code:
[expand] view 28 lines

Tests:
✓ small      ✓ medium    ✗ edge-empty    ✗ large    ✗ duplicates
```

`view 28 lines` expande um <pre> com syntax highlight do código submetido. O admin pode então comparar com o approach.

**(b) Editor de test cases em `/admin/library`:**

Quando o admin abre um `LibraryItem` com `format=PROBLEM`, aparece nova seção "Test cases". JSON editor (CodeMirror em modo JSON) com schema validation client-side, mais um botão "Test against my code" que abre um modal pequeno onde o admin cola código de referência (gabarito) e roda os test cases pra ver se todos passam. Não persistimos o gabarito, é só ferramenta de validação dos casos.

### 7. Impacto em superfícies existentes

| Superfície | Mudança |
|---|---|
| `/me/item/[id]` | Botão "Start challenge" + histórico próprio + cohort gated |
| `/me/challenge/[id]` | NOVA rota (split editor + sidebar) |
| `/admin/member/[id]` | Nova aba `Challenges` no raw-data-accordion |
| `/admin/library` | Nova seção "Test cases" editável por item PROBLEM |
| `DiagnoseService` | Sem mudança no v0 (v1 injeta últimas tentativas) |
| Engagement score | Sem mudança no v0 |
| Build da VPS | NOVO: dockerfiles + script de build das 2 imagens sandbox (Python, C++) |
| Ops | NOVO: documentar config de userns-remap no docker daemon |

---

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Membro escapa do sandbox e ataca a VPS | `--network=none` + `userns-remap` + `--cap-drop=ALL` + `--read-only` + `--pids-limit` + `--memory` cobrem 99% dos vetores. Auditar via `SandboxExecutionLog` |
| Fork bomb estoura a VPS | `--pids-limit=64` + `--memory=256m` + timeout 5s |
| Membro escreve loop infinito | Wall timeout 5s mata o container |
| 10 membros submetem ao mesmo tempo e a VPS fica de joelhos | `SandboxQueueService` com semáforo (max 4 simultâneas), restante em queue |
| Imagens Docker ficam outdated com CVEs | Esteira CI/CD: Dependabot monitora `FROM`, GHA rebuilda + Trivy scan, VPS faz `docker pull` semanal. Manual zero |
| Membro copia código do cohort depois de submeter uma tentativa "lixo" pra desbloquear | A primeira tentativa submetida deixa rastro permanente. Se vier 0/5 tests com 30s de timer, o admin vê e conversa. Não é tech problem |
| Admin não cura test cases pra nenhum item, feature fica fraca | testCases é opcional. Se vazio, o member ainda tem o Run + approachText, valor reduzido mas não-zero. Pode crescer organicamente |
| Test cases stdin/stdout não cobrem todos os problemas LeetCode (assinatura de função) | Aceito. Admin marca itens que cabem nesse formato. Os que não cabem ficam sem test cases curados, member usa Run cru |
| Membro digita "ok" no approachText | `min(20)` chars |
| Pause de aba conta tempo | Aceito. Documentar no copy: "o cronômetro é honra do escoteiro" |

---

## Sequência de implementação

Esse PR é gigante. Quebra em 4 PRs sequenciais:

**PR1 — Sandbox infra + esteira CI/CD + admin test cases**
1. Dockerfiles das 2 imagens (Python, C++) em `infra/sandbox/`.
2. `.github/workflows/sandbox-images.yml` (build + Trivy scan + push pra ghcr) e `.github/dependabot.yml` monitorando as bases.
3. `infra/sandbox/refresh.sh` (cron script da VPS) + instruções de instalar no crontab.
4. `apps/api/src/sandbox/`: `sandbox.service.ts` (orquestra docker run), `queue.service.ts` (semáforo), `runner.types.ts`, `templates.ts`.
5. Migration `z_challenge_attempts_and_test_cases` (aditiva — campos novos no LibraryItem + novos enums + tabelas novas).
6. `PATCH /admin/library/:id/test-cases` endpoint.
7. Editor de test cases em `/admin/library`.
8. Documentação `docs/sandbox-setup.md` com instruções de userns-remap no docker daemon + setup do cron.
9. Testes unitários do sandbox isolando 1-2 cenários (TIMEOUT, COMPILE_ERROR, OK).

**PR2 — Backend de challenges (start/run/submit/abandon)**
1. Módulo `apps/api/src/me/challenges/`.
2. Endpoints start/run/submit/abandon/list/cohort.
3. Gate de cohort (não-submetido → só count).
4. Tests cobrindo: server-side duration, gate de cohort, paralelismo do submit.

**PR3 — Frontend do challenge**
1. Rota `/me/challenge/[id]` com CodeMirror 6.
2. Botão "Start challenge" em `/me/item/[id]` + histórico próprio.
3. Cohort histórico gated abaixo do histórico próprio.
4. Hook `useStartChallenge` etc em `apps/web/lib/queries/me-challenges.ts`.

**PR4 — Cockpit admin**
1. Aba `Challenges` no raw-data-accordion.
2. Cards com code expand.

Esforço total estimado: ~8 dias de trabalho focado (foram 10 quando eram 5 linguagens). PR1 ~3 dias com só 2 imagens.

PR3 inclui também o endpoint de auto-save: `PATCH /me/challenges/:id/code` body `{ code, language }`, idempotente, atualiza só `finalCode`. Frontend debouncea localmente e dispara a cada 10s. localStorage `ics:challenge:<attemptId>:code` é a fonte de verdade local; ao montar a página, comparar com `finalCode` do server e usar o mais recente.

---

## Decisões resolvidas

1. **Persistência do código:** **auto-save local instantâneo (localStorage) + auto-save server a cada 10s** (debounced). Refresh acidental nunca perde código; reload em outro device puxa o estado salvo no server na última janela de 10s. Endpoint `PATCH /me/challenges/:id/code` body `{ code, language }` chamado a cada 10s. localStorage key `ics:challenge:<attemptId>:code` é a fonte se mais recente que o server.
2. **starterCode = template por linguagem** que já lê stdin e tem comentário marcando onde o código do membro entra. Conteúdo dos templates definido na seção "Templates por linguagem" abaixo.
3. **VPS aguenta**, com guardrails confirmados: timeout 5s/case, `--memory=256m`, `--cpus=0.5`, `--pids-limit=64`, semáforo de no máximo 4 execuções simultâneas. Documentar no `docs/sandbox-setup.md` métricas baseline a serem monitoradas depois do deploy (CPU%, RAM, count de containers ativos).
4. **Linguagens v0: Python 3.12 + C++ 17.** Só duas. Reduz surface de build/test pela metade (1 Dockerfile + 1 starter template + test cases admin têm que escrever 2x menos). Cobre Big Tech (Python) + Competitive Programming / startup back-end de performance (C++). JavaScript/Java/Go podem entrar em v1 se houver demanda real do cohort.

## Templates por linguagem

Esqueleto que o `starterCode` retorna por linguagem. Já lê stdin todo e deixa marcação clara de onde escrever:

**Python:**
```python
import sys

def main():
    data = sys.stdin.read().split()
    # Your code here. `data` is a list of whitespace-separated tokens.
    # Example: convert the first token to int.
    # n = int(data[0])
    print(0)

main()
```

**C++:**
```cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    // Your code here. Read from cin, write to cout.
    // Example: int n; cin >> n; cout << n << endl;

    return 0;
}
```

Templates ficam num arquivo `apps/api/src/sandbox/templates.ts` exportando `STARTER_CODE: Record<ChallengeLanguage, string>`.

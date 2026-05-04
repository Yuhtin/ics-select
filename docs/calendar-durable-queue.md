# Fila durável para reconciliação do Google Calendar

**Status**: proposta — ainda não implementada. Hoje a reconciliação roda como `void this.reconcileCalendarAfterOutcome(...)` fire-and-forget dentro do mesmo processo (`apps/api/src/weekly-plans/weekly-plans.service.ts`). Funciona pra latência (o usuário não espera), mas não sobrevive a deploy/crash do container e não tem retry.

Este doc descreve **por quê** queremos uma fila e **como** implementar com Redis + BullMQ.

---

## Parte 1 — explicação não-técnica

### O problema que estamos resolvendo

Quando um membro marca um estudo como feito, o sistema também precisa "limpar" o Google Calendar — ou seja, mover o bloco daquele estudo no calendário pra "agora" (quando ele realmente fez), apagar o bloco se ele pulou, ou consolidar vários blocos em um só.

Esse trabalho com o Google Calendar é **lento** (cada chamada vai pra rede, pro Google, e volta — pode levar 1-3 segundos). Antes, o usuário ficava olhando "Saving…" o tempo todo dessa ida-e-volta.

Hoje a gente resolveu o sintoma: o front mostra que tá feito imediatamente (optimistic update), e o backend devolve o sucesso assim que escreve no banco — depois cuida do calendário "no escuro" sem segurar a resposta.

Mas tem um problema novo: se o servidor reiniciar ou cair *no meio* do trabalho com calendário, esse trabalho **perde**. Não tem retry. Não tem visibilidade. O membro pode acabar com o calendário desatualizado e a gente nem sabe.

### O que é uma "fila durável"

Imagina um cesto compartilhado entre vários carteiros. A cada coisa que o sistema precisa fazer com o Google Calendar (um "envelope"), ele coloca esse envelope no cesto. Os carteiros pegam um envelope por vez, tentam entregar (chamar o Google Calendar), e:

- Se entregaram → marcam como feito e descartam o envelope.
- Se falharam → recolocam no cesto pra tentar de novo daqui a pouco (com algum delay pra não martelar o Google).
- Se falharam várias vezes → mandam pro "cesto dos errados", que a gente revisa depois.

O cesto é o **Redis** (um banco de dados rápido em memória, mas que persiste). Os envelopes são os **jobs**. Os carteiros são os **workers** — pode ser o próprio container da API ou um processo separado.

### Por que isso importa

1. **Sobrevive a crash/deploy**: se o container reiniciar no meio, os envelopes que ainda não foram entregues continuam no cesto.
2. **Retry automático**: o Google Calendar às vezes falha por causas bobas (rate limit, token expirado, internet do Google). Em vez de a gente perder a operação, a fila tenta de novo.
3. **Observabilidade**: dá pra ver quantos envelopes estão pendentes, quantos falharam, qual o tempo médio. Bom pra alarme em produção.
4. **Escalabilidade**: se um dia o volume crescer, dá pra subir mais carteiros sem mexer na API.
5. **Idempotência protegida**: a fila ajuda a garantir que o mesmo envelope não seja entregue duas vezes (ou que, se for, não cause estrago).

### Trade-offs

- Adiciona uma dependência (Redis) — já temos? (Hoje não. Precisa subir um.)
- Aumenta a complexidade operacional — mais um processo pra monitorar, mais um lugar pra olhar quando algo dá errado.
- O resultado da operação fica "eventual" — o membro vê "feito" no app antes do calendário do Google atualizar. Isso já é o caso hoje.

### Quando vale a pena

A gente já está com fire-and-forget no processo, o que cobre 95% dos casos felizes (Google respondendo rápido, container estável). A fila durável vira prioridade quando:

- Começarmos a ver Calendar dessincronizado em produção com frequência.
- Tivermos volume alto o suficiente pra rate-limit ser real.
- Quisermos confiar no Calendar como produto-chave (e não só "nice to have").

Por enquanto a recomendação é: **implementar quando aparecerem os primeiros sintomas** (logs de warning crescendo, ou um membro reclamando que o calendário tá errado).

---

## Parte 2 — detalhamento técnico

### Stack proposto

- **Redis 7+** — broker e storage de jobs.
- **BullMQ** (`bullmq` npm) — biblioteca de filas que roda sobre Redis. Já é a escolha de fato no ecossistema Node, tem TypeScript de primeira, retries com backoff exponencial, dead-letter queue, métricas, dashboard (Bull Board).
- **`@nestjs/bullmq`** — wrapper oficial do Nest que registra módulos/processadores como providers, pega DI normal, integra com lifecycle (`onModuleDestroy` fecha workers).

Alternativas consideradas:
- **PostgreSQL como fila** (`pg-boss`) — viável se quisermos evitar nova dependência. Trade-off: throughput e visibilidade piores, e o uso de `LISTEN/NOTIFY` carrega complexidade. Vale se Redis virar um problema operacional.
- **AWS SQS / GCP Pub/Sub** — overkill pro porte atual; trava em uma cloud específica.

### Topologia

```
[ NestJS API container ]              [ Redis ]                 [ Worker container(s) ]
   weekly-plans.service       ─PUSH→  bullmq:calendar  ─POLL→     calendar.processor
   setItemOutcome()                   (queue: "calendar")          - reconcileAfterOutcome
                                                                   - cleanupAfterPlanDelete
                                                                   - rescheduleEvent
                                                                   - deleteEvents
```

A API empurra jobs; um (ou mais) worker(s) consomem. Pra começar, o worker pode rodar **dentro do mesmo container da API** (single process com lifecycle gerenciado pelo Nest) — é o setup mais simples. Quando o volume justificar, separa em outro deploy do mesmo image com flag `--workers-only`.

### Schema dos jobs

Cada job tem um `name` (tipo) + `data` (payload tipado). Definir como union discriminada em `apps/api/src/calendar-queue/jobs.types.ts`:

```ts
export type CalendarJob =
  | {
      name: 'reconcile-after-outcome';
      data: {
        userId: string;
        itemId: string;
        outcome: ItemOutcome;
        // Snapshot of the item at request time. The worker re-reads from DB
        // to verify the state is still consistent before acting (idempotency).
        snapshot: {
          scheduledAt: string | null; // ISO
          scheduledMinutes: number | null;
          calendarEventIds: string[]; // googleEventIds
        };
      };
    }
  | {
      name: 'cleanup-after-plan-delete';
      data: {
        userId: string;
        planId: string;
        googleEventIds: string[];
      };
    }
  | {
      name: 'create-events';
      data: {
        userId: string;
        planId: string;
        events: Array<{ itemId: string; start: string; end: string; title: string; description: string }>;
      };
    };
```

Cada job tem um `jobId` determinístico (ver "Idempotência" abaixo) pra evitar duplicação se o produtor repetir o push.

### Estrutura de pastas (NestJS)

```
apps/api/src/calendar-queue/
├── calendar-queue.module.ts        # registra BullModule + processor
├── calendar-queue.service.ts       # API pra produtores (enqueue*)
├── calendar.processor.ts           # @Processor — consome os jobs
├── jobs.types.ts                   # union discriminada acima
└── calendar-queue.service.spec.ts
```

### Configuração do BullMQ

```ts
// calendar-queue.module.ts
BullModule.forRootAsync({
  useFactory: (cfg: ConfigService) => ({
    connection: {
      host: cfg.get('REDIS_HOST'),
      port: cfg.get('REDIS_PORT', 6379),
      password: cfg.get('REDIS_PASSWORD'),
    },
  }),
  inject: [ConfigService],
}),
BullModule.registerQueue({
  name: 'calendar',
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2_000 },     // 2s, 4s, 8s, 16s, 32s
    removeOnComplete: { age: 24 * 3600, count: 1000 },  // keep recent for ops
    removeOnFail: { age: 7 * 24 * 3600 },               // keep failures for a week
  },
});
```

### Producer (substituindo o `void this.reconcile…`)

```ts
// weekly-plans.service.ts
async setItemOutcome(itemId: string, userId: string, input: {...}) {
  const item = await this.prisma.weeklyPlanItem.findUnique({...});
  // ...validation as today...

  const updated = await this.prisma.weeklyPlanItem.update({...});

  await this.calendarQueue.enqueueReconcileAfterOutcome({
    userId,
    itemId,
    outcome: input.outcome,
    snapshot: {
      scheduledAt: item.scheduledAt?.toISOString() ?? null,
      scheduledMinutes: item.scheduledMinutes,
      calendarEventIds: item.calendarEvents.map((e) => e.googleEventId),
    },
  });

  return updated;
}
```

`enqueueReconcileAfterOutcome` retorna após escrita no Redis (~5ms), não após o trabalho do Google.

### Processor

```ts
// calendar.processor.ts
@Processor('calendar')
export class CalendarProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: GoogleCalendarService,
  ) {}

  @Process('reconcile-after-outcome')
  async reconcileAfterOutcome(job: Job<ReconcileAfterOutcomeData>) {
    const { userId, itemId, outcome, snapshot } = job.data;
    // Re-read state — snapshot may be stale (member could have re-marked).
    const fresh = await this.prisma.weeklyPlanItem.findUnique({
      where: { id: itemId },
      include: { calendarEvents: true, libraryItem: true },
    });
    if (!fresh) return; // item deleted; nothing to reconcile.
    if (fresh.outcome !== outcome) {
      // Member changed their mind between enqueue and now. The newer
      // outcome already enqueued its own reconcile; bail.
      return;
    }
    // ...same logic as today's reconcileCalendarAfterOutcome...
  }
}
```

### Idempotência

Three-layer defense:

1. **Producer-side `jobId`**: `reconcile-${itemId}-${outcome}-${nowMinute}`. Mesmo job não duplica se o produtor disparar duas vezes no mesmo minuto.
2. **Worker re-read**: o worker sempre relê o estado do banco antes de agir. Se o estado mudou (membro mudou de ideia, plano foi deletado), o worker decide se ainda faz sentido ou se aborta.
3. **Google Calendar é tolerante**: `deleteEvent` num evento já apagado retorna 410/404; o `.catch(warn)` que já temos absorve.

### Backoff e retry

Default: 5 tentativas com backoff exponencial (2s → 32s). Após esgotar, o job vai pra "failed" — o BullMQ mantém por 7 dias pra debug. Tipos de erro a tratar:

- **Token expirado** (Google retorna 401): o `clientFor(userId)` em `google-calendar.service.ts` já lida com refresh. Se o refresh-token também expirou, o job falha permanentemente — abrir alerta pra reonboardar o membro.
- **Rate limit** (429): backoff exponencial absorve.
- **Evento não existe** (404/410): considerar sucesso silencioso (já está no estado desejado).
- **5xx do Google**: retry; depois de N falhas em janela curta, pausar a fila e notificar oncall.

### Observabilidade

- **Bull Board** (`@bull-board/express`) montado em `/admin/queues` (atrás de auth admin) — UI pronta com métricas, jobs em flight, retries, falhas.
- **Métricas Prometheus** (opcional): contadores por tipo de job, latência, taxa de erro. `bullmq` exporta hooks pra plugar.
- **Logs estruturados**: cada job loga `{jobId, type, userId, attempt, durationMs, status}`. Consumível por Loki/Grafana.

### Migração

Plan de rollout em fases:

1. **Fase 0 (hoje)**: fire-and-forget in-process. Sem Redis. Sem retry persistente.
2. **Fase 1**: subir Redis (Marketplace do Vercel ou Upstash). Adicionar `calendar-queue` module com producer **off por feature flag** (`USE_CALENDAR_QUEUE=false`). Validar conectividade.
3. **Fase 2**: ligar a flag pra `setItemOutcome` apenas. Monitorar Bull Board por uma semana. O `reconcileCalendarAfterOutcome` original fica como fallback (se a flag estiver off, comportamento atual).
4. **Fase 3**: migrar `remove`/`publish` (`PublicationService.publish`) também — onde já existem chamadas síncronas ao Calendar dentro do request.
5. **Fase 4**: separar worker em deploy próprio se justificado (Vercel Cron + função dedicada, ou container EasyPanel separado).

### Testing

- Unit: `calendar.processor.spec.ts` mocka `prisma` + `calendar`, dispara `processor.reconcileAfterOutcome({ data })` direto, asserta side-effects.
- Integration: `calendar-queue.e2e-spec.ts` usa `ioredis-mock` ou Redis em container (compose adiciona `redis:7-alpine`), enfileira via `service.enqueue*`, espera o `processor` consumir, asserta DB final state.
- Failure paths: forçar `calendar.deleteEvent.mockRejectedValue` e asserir retry count + que o job acaba em "failed" após N attempts.

### Estimativa de esforço

| Etapa | Esforço |
|---|---|
| Subir Redis + var de ambiente | 0.5d |
| Module + producer + processor `reconcile-after-outcome` | 1d |
| Testes unit + integration | 0.5d |
| Bull Board + auth + observabilidade básica | 0.5d |
| Migrar `remove` e `publish` | 0.5d |
| Documentação operacional + alertas | 0.5d |
| **Total** | **~3.5 dias** |

### Variáveis de ambiente novas

```
REDIS_HOST
REDIS_PORT (default 6379)
REDIS_PASSWORD
USE_CALENDAR_QUEUE=true|false  # feature flag durante rollout
```

Adicionar ao `apps/api/.env.example` com comentário explicando o setup local (`docker compose up -d redis` ou Upstash dev URL).

### Referências

- BullMQ docs: https://docs.bullmq.io
- `@nestjs/bullmq`: https://docs.nestjs.com/techniques/queues
- Bull Board: https://github.com/felixmosh/bull-board
- Vercel Marketplace (Redis providers): Upstash, Redis Cloud

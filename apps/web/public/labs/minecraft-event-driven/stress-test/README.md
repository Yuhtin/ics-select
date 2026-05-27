# Stress test + smoke tests · ICS Minecraft Lab

Scripts em Node.js usando [mineflayer](https://github.com/PrismarineJS/mineflayer) — biblioteca de cliente headless do Minecraft (a mesma que bots reais e abusivos usam). Permitem testar o servidor sem precisar abrir o client gráfico.

---

## Setup (uma vez)

```bash
cd apps/web/public/labs/minecraft-event-driven/stress-test
npm install
```

Pré-requisitos: Node.js 20+.

---

## Comandos

### Smoke test (verificação básica · 20s)

Conecta 1 bot, valida o fluxo PIN → unlock → movimento → `/resumepackets`.

```bash
npm run smoke
```

Saída esperada: 100% verde, sem `[!!]`, e `/resumepackets` mostra ranking de packets.

### Dwell test (regressão do void · 30s)

Conecta 1 bot e NÃO manda o PIN. Bot fica caindo no void por 30s. Esperado: zero death events.

```bash
npm run dwell
```

### Stress test (ataque em massa)

Conecta N bots, todos mandam o PIN, e ficam pulando + girando a cabeça. Pra demonstrar TPS caindo + packets subindo ao vivo.

```bash
# 100 bots, ramp de 80ms entre cada (default)
npm run stress -- 100

# 50 bots, ramp 100ms
npm run stress -- 50 100

# 200 bots, ramp 50ms (max-players do servidor está em 10000)
npm run stress -- 200 50
```

Argumentos:
- 1º `count` (default 100) — número de bots
- 2º `stagger_ms` (default 80) — delay entre conexões pra evitar throttle

Auto-shutdown via env var:
```bash
DURATION_S=30 npm run stress -- 100   # mata todos os bots após 30s
```

Ou `Ctrl+C` pra encerrar manual.

---

## Roteiro pra demo na aula

Janela 1 — terminal do **professor** (essa máquina):
```bash
cd apps/web/public/labs/minecraft-event-driven/stress-test
npm install   # uma vez
```

Janela 2 — console do **servidor** (projetado, pra turma ver):
```bash
ssh -t root@212.38.89.33 'tmux attach -t mclab'
```
(no tmux: `Ctrl+B`, depois `D` pra sair sem matar o servidor)

**Antes do ataque** (servidor vazio):
```
> spark tps
TPS: 20.0/20.0/20.0  ·  MSPT p95: 0.3ms  ·  CPU 0%
```

**Lança 100 bots:**
```bash
npm run stress -- 100
```

**Captura durante o pico** (~15s depois):
```
> spark tps
TPS 1m: 19.92  ·  MSPT p95/max: 34.9 / 221.9ms  ·  CPU process 39%
> resumepackets
PLAYER_POSITION_AND_LOOK ×15389 (65%)
PLAYER_LOOK              ×7059  (30%)
PLAYER_POSITION          ×942   (4%)
TOTAL                    ×23566 packets em 60s · ~390/s
```

**Conclusão pra turma:** 100 players "jogando" geraram ~390 packets/s no servidor. O tick max passou de 0.3ms (vazio) pra 221.9ms — **4.4x o budget de 50ms**. Foi nesse pico que o TPS efetivo caiu de 20.0 pra 19.92. Visível no `spark tps`. Em produção, é exatamente esse o sintoma de "lag" que players reclamam.

---

## Resultados de referência (capturados em 27/05/26)

| Bots | TPS (5s/1m) | MSPT p95 (10s) | MSPT max (1m) | Packets/min | CPU process |
|------|-------------|----------------|---------------|-------------|-------------|
| 0    | 20.0 / 20.0 | 0.3 ms         | 8.4 ms        | 0           | 0%          |
| 10   | 20.0 / 20.0 | 6.3 ms         | 16.9 ms       | 4,028 *     | 12%         |
| 50   | 20.0 / 20.0 | 34.2 ms        | 72.3 ms       | 6,523 *     | 25%         |
| 100  | 20.0 / 19.92| 34.9 ms        | **221.9 ms**  | **23,566**  | 39%         |

*os números de 10 e 50 incluem ramp-up parcial; o de 100 é estado estável.

**Resource on VPS:**
- 5.8 GiB RAM total, ~3 GiB livre durante 100-bot peak
- 100 bots = ~390 packets/s no servidor + ~390 packets/s pra cada player (chunks, entidades) = total ~78k packets/s no fio em pico

---

## Notas operacionais

- **Conexões saem todas do MEU IP** (laptop do professor). Em produção real os bots viriam de IPs diferentes, então a "concentração" aqui é favorável ao firewall mas representativa pra teste de tick.
- **Connection throttle** do Paper foi desligado em `bukkit.yml` (`connection-throttle: -1`) pra permitir N conexões em rajada.
- **PinPlugin segura todos os bots** no void até receber `6769`. Pra contornar (que é o objetivo do stress), os scripts mandam o PIN automaticamente.
- **Whitelist** está desligada no servidor. Em produção real você quer ligar de novo.

---

## Troubleshooting

**"Outdated client! Please use 1.21.11"** — versão do protocolo errada no script. Ajuste `version` em stress.js / smoke-test.js / dwell-test.js.

**"You are not whitelisted on this server!"** — whitelist foi reativada. `ssh root@... 'tmux send-keys -t mclab "whitelist off" Enter'`.

**Bots não geram packets em /resumepackets** — provavelmente travaram no PIN. Olhe o console do servidor pra ver se há `[Lock]` sem `[Unlock]` correspondente. Pode ser delay de chat — aumente o timeout antes do PIN no script.

**ECONNRESET em massa** — connection throttle ligado, ou Paper tá rejeitando conexões por algum outro motivo. Cheque `tmux capture-pane -t mclab -p | grep -i "kicked\|throttle"`.

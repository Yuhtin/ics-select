---
name: ics-dark-ops-slides
description: Cria slides de aula no estilo "dark ops storytelling" do vídeo Friday Night Database Recovery Crash Course (youtube LoZ2kpFnqB8) - fundo preto puro, tudo em monospace (IBM Plex Mono), cards com borda 1px e raio 12, cor só com significado (vermelho = quebrou, verde = ok/nota à mão, âmbar = alvo/limite, azul = o nó principal), anotações manuscritas verdes, mocks de terminal/Slack/ChatGPT/Grafana, reveal progressivo. Use quando o Davi disser "slide estilo dark ops", "slide estilo aquele vídeo de recovery", "aula com terminal preto", "faz os slides no estilo monospace preto", ou pedir um deck de infra/backend/incidente com cara de vídeo técnico de YouTube.
metadata:
  type: project
---

# ICS Dark Ops Slides

Estilo extraído frame a frame (1023 frames) do vídeo *Friday Night Database Recovery Crash Course*.
Não é "tema escuro genérico": é um jeito específico de contar história técnica. O deck de
referência completo está em `examples/db-recovery.html` (19 slides, todos os arquétipos) e os
frames originais que justificam cada decisão estão em `assets/reference/`.

Saída: **um `.html` autocontido**, palco fixo 1280x720 escalado pra caber na janela, setas /
espaço / clique pra navegar, `?print=1` pra virar PDF (Cmd+P, paisagem, sem margens).

## 1. O que faz o estilo ser esse estilo

Ordem de importância. Se cortar, corte de baixo pra cima.

1. **Preto puro `#000` no palco.** Não é cinza escuro. Cards ficam em `#0A0A0C` com borda
   `1px #232326`. A separação de planos vem só de borda hairline, nunca de sombra.
2. **Monospace em tudo que é "nosso"**: títulos, labels, números, tabelas, diagramas. A única
   exceção é mock de UI de terceiro (Slack, ChatGPT, janela de app), que usa Inter, porque ali
   a gente está imitando o produto.
3. **Cor só quando significa algo.** O palco é preto e branco. Quando aparece cor, o olho vai
   pra lá porque ela carrega o ponto do slide:
   - vermelho `#F45B4E`: quebrou, perdeu, errado, incidente, X por cima
   - verde `#3BA35A`: funcionou, caminho certo, WAL, seta de fluxo saudável
   - verde-nota `#4CC26E` em fonte manuscrita: comentário do professor em cima do slide
   - âmbar `#F2BB3C`: alvo, limite, threshold, "expected", RTO
   - azul-céu `#45B0EA`: o nó principal do diagrama (o postgres, o pod), linha de dado
   - índigo `#9B94F0`: arquivo, dump, série de gráfico
   - pastéis (violeta, ciano, rosa) só em ícones de grade de tópicos
4. **Reveal progressivo.** Nada aparece de uma vez. O vídeo constrói cada diagrama peça a
   peça: nó, depois seta, depois o próximo nó, depois a nota à mão. No HTML isso é a classe
   `.f` (fragmento). Um slide de 8 elementos tem 5 a 7 fragmentos.
5. **Anotação manuscrita verde** (Caveat, 32px) com setinha curva. É a voz do professor
   quebrando a quarta parede: "todo dia às 4 da manhã", "são os 30 minutos", "12 days ago".
   Máximo uma por slide. Em vermelho quando aponta o erro.
6. **Mocks de UI reais** pra mostrar "o que a pessoa viu": terminal com semáforo macOS,
   Slack roxo, ChatGPT, Grafana, Google Meet, email no celular. Texto que não importa vira
   **barra de esqueleto** cinza (`.skel`), só o que importa fica legível.
7. **X vermelho canto a canto** em cima do que morreu ou do que não é a resposta.
8. **Time card**: tela preta só com hora grande em Inter light (`6:24 PM` / `Fri, Sep 6`).
   Marca a passagem de tempo da história. Usa entre atos.
9. **Interlúdio de personagem**: o vídeo usa wojak/gigachad entre blocos pra dar respiro
   emocional (raiva às 23h, demitido na segunda). Numa aula, use foto/meme/ilustração de
   tela cheia com o mesmo papel. Nunca emoji.

## 2. Tokens

```css
--bg:#000000;
--card:#0A0A0C; --card2:#111114; --line:#232326; --line2:#2E2E32;
--text:#F4F4F5; --dim:#9A9A9F; --mute:#66666B;
--skel:#39393D; --skel2:#232323;                /* barras de esqueleto */

--red:#F45B4E;   --green:#3BA35A;  --hand:#4CC26E;
--amber:#F2BB3C; --amber-soft:#C9A54F;          /* borda âmbar de chip (web/api/worker) */
--sky:#45B0EA;   --blue:#3E7ACA;   --indigo:#9B94F0;
--violet:#B06CC8; --cyan:#22D3EE;  --rose:#F06A8A;

/* cards preenchidos (só em fluxo alerta -> rota) */
--tint-green:#0B2A1A; --tint-sky:#0A2A45; --tint-indigo:#2E2270; --tint-red:#2A0F0F;
```

Medidos direto dos frames (`frame_275`, `frame_522`, `frame_042`, k-means nos saturados).
Barra de progresso: verde `#32A44F` + vermelho claro `#FF7F83` (o único vermelho pastel).

**Tipografia** (Google Fonts via `<link>`, nunca `@import`):

| Papel | Fonte | Tamanho no palco 1280x720 |
|---|---|---|
| Título de capa | IBM Plex Mono 700 | 56px, `letter-spacing:-.01em` |
| Título de slide / nome de card | IBM Plex Mono 600 | 26 a 30px |
| Corpo, tabela, terminal | IBM Plex Mono 400 | 19 a 24px |
| Eyebrow / label de campo | IBM Plex Mono 600 | 16px, `letter-spacing:.14em`, caixa alta, `--dim` |
| Número grande (stat) | IBM Plex Mono 700 | 56 a 64px |
| Nota manuscrita | Caveat 500 | 32px, `--hand` |
| Mock de app / time card | Inter 300 a 600 | conforme o produto imitado |

**Geometria**: raio 12 em card, 10 em pill, 8 em kbd/ícone-tile; borda sempre 1px (2px só
no nó azul principal); espaçamento em múltiplos de 4; padding de card 26 a 30px; gap entre
cards 24 a 40px. Setas: traço 3px (4 quando é a linha de dado azul), ponta triangular
preenchida, cinza `#B3B3B3` por padrão, verde quando é fluxo bom, vermelha quando é o caminho
errado. Ícones: lucide, stroke 1.5 a 1.75, 28px inline ou 52px em card de tópico.

## 3. Arquétipos de slide

Cada um existe no `examples/db-recovery.html` (número entre parênteses) e tem frame de
referência em `assets/reference/`.

| Arquétipo | Quando usar | Exemplo | Ref |
|---|---|---|---|
| **Capa** | eyebrow + título 3 linhas + linha dim + pill vermelho + nota à mão | 1 | |
| **Time card** | marcar hora/data entre atos da história | 2 | `18-time-card` |
| **Grade de tópicos** | agenda: cards com ícone lucide colorido + nome; um card pode ser um mini-mock | 3 | `01-topic-grid` |
| **Arquitetura** | card-grupo (cluster) com chips âmbar, nó azul principal, linha azul até o card de volume com progress bar | 4 | `04-architecture-k8s` |
| **Terminal tela cheia** | semáforo macOS, abas STAGING/PRODUCTION, prompt verde, erro vermelho, sublinhado no que importa, kbd `Ctrl+C` | 5 | `03-terminal-tabs` |
| **Session cards + árvore** | dois cards de sessão com chip `VAR = valor`, árvore de diretórios abaixo com X vermelho | 6 | `05-session-card-tree` |
| **Fluxo com nota** | A → B → C em cards, label dim na seta, nota manuscrita apontando o detalhe, listagem S3 embaixo com pill âmbar | 7 | `06-backup-flow-handnote` |
| **Linha do tempo com chave** | dois marcadores (índigo = backup, vermelho = incidente), chave vermelha embaixo com a duração | 8 | `07-timeline-brace` |
| **WAL → heap page** | cards verdes empilhados com LSN dim + linha, setas verdes pra tabela dentro de card | 9 | `08-wal-heap` |
| **PITR track** | dois cards (azul + verde) descendo setas pra card grande com trilha, tick verde no ponto de parada, X vermelho depois | 10 | `09-pitr-track` |
| **RPO / RTO** | linha vertical tracejada vermelha no centro, seta vermelha pra esquerda (dados), âmbar pra direita (tempo), termos grandes coloridos | 11 | `10-rpo-rto` |
| **Tabela de metas** | card com linhas RPO/RTO, inputs vazios, setas coloridas pra cards à direita | 12 | `11-targets-table` |
| **Gráfico com threshold** | linha índigo com pontos, tracejado âmbar, X vermelhos depois do limite, card de motivo (Reason / valor) com nota à mão | 13 | `12-chart-threshold` |
| **Alerta → rota** | os únicos cards preenchidos (tint): índigo alerta, verde on-call, azul dashboard com sparkline | 14 | `13-alert-route-tinted` |
| **App window** | "recovery workspace": barra macOS, status `incident active`, dois cards (tarefas com ícone de estado + handoff note com labels caixa alta) | 15 | `14-app-window-workspace` |
| **Stat + colisão** | número âmbar 64px, tabela com ID 56px, aviso "ID collision" vermelho com ícone lucide de alerta entre duas linhas | 16 | `15-stat-table-collision` |
| **Timeline vertical 2 colunas** | pontos vermelhos + setas brancas, cards de hora, coluna "o que deu errado" (●vermelho) e "o conserto" (●verde) | 17 | `02-vertical-timeline` |
| **Mock Slack** | roxo `#3F0E40`, canal ativo azul `#1164A3`, badge rosa, mensagem do Grafana com pill CRITICAL e sublinhado verde | 18 | `16-mock-slack-skeleton` |
| **End card** | malha de nós verde-escuro, "Obrigado", dois pills | 19 | `20-end-card` |
| Mock ChatGPT | pergunta em card, resposta com título sublinhado verde e bloco de código | | `17-mock-chatgpt` |
| Strike card | card do que **não** é a solução com X vermelho (RDS riscado ao lado do postgres) | | `21-strike-card` |
| Internet / bucket / IAM | "the internet" (4 bonequinhos) → bucket; verde = privado via IAM, vermelho = público | | `22-internet-bucket-iam` |
| Lista de tarefas com chave | linhas com ícone de estado (x vermelho / cadeado / relógio) e chave vermelha ligando causa e efeito | | `23-tasks-brace` |

## 4. Como o vídeo conta a história (use como roteiro)

O deck não é "conceito, conceito, conceito". É **incidente contado em ordem**, com o conceito
entrando na hora em que o personagem precisa dele:

1. Agenda (grade de tópicos), sem explicar nada ainda.
2. Ato 1, o erro: time card → mock do que a pessoa viu (Slack, Grafana) → terminal onde ela
   digitou a coisa errada → árvore com X vermelho. Interlúdio de personagem.
3. Ato 2, a descoberta: diagrama de como deveria funcionar (fluxo de backup) → listagem real
   mostrando que não funcionou (pill âmbar "expected", linha "not found" vermelha) → linha do
   tempo com a chave "18 h 45 min de perda". Aqui entra o conceito (WAL, PITR) porque agora
   o aluno quer saber.
4. Ato 3, a decisão: RPO/RTO, tabela de metas, gráfico com threshold explicando a causa raiz.
5. Ato 4, a recuperação: app window com tarefas e handoff note, stat de downtime, colisão de
   ID. Interlúdio de personagem.
6. Fechamento: timeline vertical "o que deu errado / o conserto" (é o resumo da aula) e end
   card.

Time cards marcam a virada de ato. Uma nota manuscrita por slide, no detalhe que o professor
comentaria em voz alta. Barra de esqueleto em tudo que o aluno não precisa ler.

## 5. Gerando um deck

### Passo 1: copiar o engine

Copie `examples/db-recovery.html` inteiro, apague as `<section>` e escreva as suas. O `<head>`
(tokens, classes, `<defs>` com markers de seta e símbolos lucide) e o `<script>` no fim são o
engine; não reescreva do zero.

Engine em resumo:

```html
<div id="deck">                       <!-- 1280x720, transform: scale() pra caber -->
  <section class="slide active">      <!-- .slide>* { position:absolute } -->
    <div class="card node sky f" style="left:370px;top:238px;width:296px;height:242px">…</div>
    <svg class="arrows"><path class="ar green f" d="M420 261H622" marker-end="url(#m-green)"/></svg>
    <div class="hand f" style="left:300px;top:318px">todo dia<br>às 4 da manhã</div>
  </section>
</div>
```

- Tudo dentro de `.slide` é posicionado em px absolutos no palco 1280x720. É assim que o
  vídeo é: cada elemento tem um lugar, não flui.
- `.f` = fragmento; aparece no próximo →. `.f.ghost` = já aparece apagado (18%) e acende
  quando chega a vez (usado no "alerta que vai pro dashboard").
- `svg.arrows` cobre o palco inteiro; desenhe setas com `path` + `marker-end`. Ordem no DOM
  manda no z-index: card depois do svg cobre a seta. Trilha dentro de card = card primeiro,
  svg depois.
- X vermelho: `<svg class="x f" viewBox="0 0 100 100" preserveAspectRatio="none"
  style="left:..;top:..;width:..;height:.."><line x1="3" y1="3" x2="97" y2="97"/><line x1="97"
  y1="3" x2="3" y2="97"/></svg>` com as mesmas dimensões do elemento riscado. Não use
  pseudo-elemento rotacionado: em caixa larga o X vaza (foi o primeiro bug deste deck).
- Logos: `https://cdn.simpleicons.org/<slug>/<hex>` (kubernetes/326CE5, postgresql/4169E1,
  grafana/F46800, stripe/635BFF). Vem monocromático. Slack **não existe** mais no simpleicons;
  o exemplo usa um tile branco com `#`. Logo colorido de verdade = SVG/PNG local em base64.
- Teclado: → / espaço / PageDown avança fragmento ou slide; ← volta; Home/End; clique na
  metade direita avança. `#n` na URL abre no slide n.
- `?print=1`: empilha todos os slides com fragmentos ligados (é o que o `render.py` usa e o
  que vira PDF).

### Passo 2: conteúdo

- Chrome de UI em inglês quando imita produto (`incident active`, `Last modified`); o resto
  em pt-BR casual, frases curtas, sem travessão, sem emoji (lucide no lugar).
- Título de capa em 3 linhas no máximo. Um slide = uma ideia = um acento de cor.
- Números sempre em mono com o valor grande e o label pequeno em caixa alta acima.
- Terminal: prompt `postgres-0:/#` verde, comando branco, `kubectl` azul `#5BA8F5`, erro
  vermelho, string âmbar. Sublinhe (3px verde `.ug` ou vermelho `.ur`) a parte que a aula
  vai comentar.

### Passo 3: renderizar e conferir numa leva só

```bash
python3 .claude/skills/ics-dark-ops-slides/scripts/render.py <deck.html> [out_dir]
```

Usa o Chrome headless local via `file://` (fontes do Google e simpleicons carregam), corta um
PNG por slide e monta `sheet.jpg` (2 colunas). Leia o `sheet.jpg` primeiro, depois só os
slides suspeitos em resolução cheia. Corrija tudo, renderize de novo, uma passada. Não abra o
browser slide a slide (ver memória `feedback-browser-tooling`).

O que procurar:

| Checagem | Sinal de problema |
|---|---|
| Fonte | serifada ou sans no palco = Google Fonts não carregou (rede) |
| Fragmentos no print | elemento faltando = classe `.f` sem `.on`; o engine liga tudo em `?print=1`, confira se não sobrescreveu isso |
| Trilha / seta sumida | card no DOM depois do svg; inverta a ordem |
| X vermelho vazando | usou o pseudo-elemento antigo; troque pelo `svg.x` |
| Texto estourando card | mono é largo: 24px ≈ 14.4px por caractere; conte |
| Logo quebrado | slug não existe no simpleicons; troque por tile com letra |
| Cor decorativa | mais de um acento por unidade visual; tire um |

Se precisar do modo interativo (testar fragmentos), suba `python3 -m http.server --bind
127.0.0.1 9977` fora do sandbox e abra no Chrome do claude-in-chrome. Nesta máquina a
extensão já recusou `localhost` e `127.0.0.1` uma vez (ERR_CONNECTION_REFUSED com o servidor
de pé); o headless não tem esse problema, então ele é o caminho padrão.

### Passo 4: entregar

Salve em `.claude/skills/ics-dark-ops-slides/examples/<slug>.html` ou onde o Davi pedir.
PDF: abrir `<deck>.html?print=1`, Cmd+P, paisagem, margens zero, "background graphics" ligado.

## 6. Checklist final

1. Palco `#000`, cards `#0A0A0C` com borda 1px; zero `box-shadow`.
2. IBM Plex Mono em tudo que não é mock de produto; Caveat só na nota à mão.
3. Cada slide tem um acento de cor com significado (tabela da seção 1).
4. Reveal progressivo: diagramas montam peça a peça (`.f`).
5. No máximo uma nota manuscrita por slide; setinha curva apontando o detalhe.
6. Mocks usam esqueleto no que não importa.
7. Time card entre atos; interlúdio visual sem emoji.
8. Fechamento com timeline vertical "deu errado / conserto".
9. `render.py` rodou, `sheet.jpg` conferido, sem texto cortado.
10. Sem travessão, sem emoji, pt-BR casual fora do chrome de UI.

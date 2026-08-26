# Prompt: aula de IA no ICS

Documento autônomo. Uma sessão futura lê este arquivo e monta a aula inteira sem
precisar da conversa que o gerou. Todas as decisões abaixo foram fechadas numa
sessão de grilling com o Davi em 26/08/2026. **Não reabra decisão fechada.** Se
algo aqui estiver ambíguo na hora de executar, pergunte antes de escolher sozinho.

---

## 0. Como usar este documento

Siga a skill `picking-class-topic-from-tech-blog` (em
`.claude/skills/picking-class-topic-from-tech-blog/SKILL.md`) com estas
alterações, que **têm precedência sobre a skill**:

- **Pule o Step 1 inteiro.** O tópico está fechado, não há mineração de blog.
- **Pule o Step 3 inteiro.** Não existe query de cohort nessa aula. A library do
  ICS não tem tópico de IA, então histórico de estudo não prevê nada aqui, e a
  aula é expositiva sem cold-call. **Não rode nada contra o banco de produção.**
- **Ignore os dois beats obrigatórios de fechamento da skill.** A skill manda
  toda aula terminar com "Arquitetura: o fluxo completo" e "AWS: managed services
  por camada". O primeiro existe aqui (beat 11), adaptado. O **beat de AWS não
  existe nessa aula**: não há infraestrutura pra mapear. Precedente:
  `websocket-rpc-blockchain` também não tem beat de AWS.
- **A skill está desatualizada quanto ao tipo `Lesson`.** Ela não documenta os
  campos `visuals` (BoardVisual: ascii ou image com credit obrigatório) nem
  `glossary` (GlossaryGroup[]). Os dois **são obrigatórios** nessa aula. Confira
  `apps/web/components/admin/meetings/lesson-types.ts` como fonte da verdade e
  `lessons/ledger-financeiro.ts` como exemplo dos dois em uso.

---

## 1. A aula em uma frase

Uma escada de vocabulário de IA, do degrau mais baixo ao mais alto, onde cada
definição só existe porque permite uma decisão, e o topo é o momento em que o
contexto deixa de ser uma pilha de arquivos e vira um grafo consultável.

**Não é** uma aula de "como eu uso IA" com vocabulário de enfeite. O fluxo real
do Davi aparece no fim, como o lugar onde todo o vocabulário aterrissa.

---

## 2. Ficha da aula

| Campo | Valor |
|---|---|
| `slug` | `vocabulario-ia` |
| `title` | a definir na autoria, ver §14 |
| `durationMin` | `120` |
| `audience` | `Hopes and Dreams 2026.3` |
| `subtitle` | a definir com o título, ver §14 |
| `blurb` | obrigatório. O parágrafo de vitrine do card em `/admin/meetings`, no formato do blurb de `ledger-financeiro.ts`: abre pelo degrau mais baixo, percorre a escada do §4 e fecha na frase de síntese. O enquadramento do §1 vale aqui. |
| `slidesUrl` | `/slides/vocabulario-ia.html` |
| beats numerados | 13 |
| nós totais | 15 (1 fundação + 13 beats + 1 síntese) |
| `askWho` | **omitido em todos os nós** |
| `scenarios` | **omitido em todos os nós** |
| `visuals` | obrigatório onde ajudar, ver §7 |
| `glossary` | obrigatório, ver §8 |

Precedente de duração: `deploy-journey` tem 120 min e 13 beats.

---

## 3. Decisões fechadas

Cada linha foi decidida explicitamente. Não reabra.

1. **Espinha:** escada de vocabulário com dificuldade crescente. Não é o setup do
   Davi como espinha, não são duas metades, não é aula prática.
2. **Topo:** contexto vira grafo.
3. **Piso:** turma partida, 2-3 avançados e o resto básico. A escada começa do
   zero. Como não há cold-call, os avançados são atendidos pela profundidade dos
   beats altos, não por serem chamados pelo nome.
4. **Token:** nada de mecanismo interno. Sem BPE, sem vetor, sem atenção, sem
   softmax, sem amostragem, sem treino. Explicação prática e útil do que um
   token significa. Isso vale para o beat de modelo também.
5. **Aula 100% expositiva.** Sem cold-call, sem atividade em sala.
6. **Produção em casa:** o checklist do beat 13 é a tarefa. O aluno instala e
   traz um print rodando.
7. **Quatro objetivos, alocados por camada:**
   - *escolher a peça certa* → critério de poda de todo beat. Definição que não
     habilita nenhuma decisão é cortada.
   - *explicar em entrevista* → o glossário, e toda âncora dizível em 60s.
   - *copiar o fluxo do Davi* → beats 11 e 12.
   - *montar o próprio setup* → beat 13, sem hands-on em sala.
8. **Ollama e pesos abertos:** sem demo ao vivo. Recorte escolhido: **panorama do
   ecossistema aberto**. Ver §6 para a mitigação obrigatória de validade.
9. **Prompting:** não ganha beat próprio. PTCF fecha o beat 3 em 2 slides.
    (O log da entrevista escreve "PTFC": é typo propagado, já corrigido no log. A decisão continua de
    pé sem arranhão, muda só a sigla e a ordem dos componentes.)
10. **Artefato:** lesson no Meetings, mesmo container das outras 9, mais o deck.
11. **Deck:** identidade do Claude Code, tema claro. Ver §9.

---

## 4. A escada

Ordem estrita. A regra do no-jumps da skill vale integralmente: no beat N a sala
só viu 1..N-1 mais a fundação. Antes de salvar, releia cada beat perguntando "tem
algo aqui que a sala ainda não podia saber?".

Armadilhas de no-jumps específicas dessa aula:

- **"janela de contexto", "mesa" e "sessão" só são termos definidos a partir do
  beat 3.** No beat 1, ao falar do limite, diga "o limite do que ele consegue ler
  de uma vez", não "a janela". No beat 2, diga "cada conversa nova começa do
  zero", não "sessão nova é mesa limpa".
- **"harness" só existe a partir do beat 7.** Nos beats 5 e 6, ao falar de onde
  uma skill mora, diga "a ferramenta que você usa", não "o harness".
- **"system prompt" só ganha nome no beat 7.** No beat 3, ao listar o que está na
  mesa, diga "as instruções do sistema". No beat 7, ao dar a definição mecânica,
  faça o vínculo em voz alta: as instruções do sistema do beat 3 têm nome, system
  prompt, e quem escreve elas é o harness, não você.
- **"plugin", "hook" e "subagente" só existem no beat 8.** No beat 5, cite as
  skills do superpowers pelo nome (`brainstorming`, `writing-plans`,
  `writing-skills`, `subagent-driven-development`) sem chamar superpowers de
  plugin. A revelação de que ele é um plugin é conteúdo do beat 8, e funciona
  melhor como virada.
- **"pesos" precisa ser plantado no beat 2** (um modelo é N bilhões de números
  fixos) para o beat 9 poder dizer "é isso que você baixa".
- **"tokenizer" não existe em nenhum ponto da aula.** O beat 1 o lista como
  proibido e nenhum beat posterior o apresenta. No beat 8, ao falar da estimativa
  do rtk, diga "ele divide bytes por 4 em vez de contar token de verdade", não
  "sem tokenizer".
- **No beat 7, CLAUDE.md e AGENTS.md aparecem só como nome do arquivo que você
  edita naquela ferramenta, e param aí.** Não diga quando eles valem: "vale
  sempre, em toda tarefa" é a linha 1 da tabela do beat 8.
- **A coluna "onde o dado mora" do beat 7 é dita em português chão** ("vai pro
  servidor deles" contra "pode ficar tudo na sua máquina"). Não use ollama, peso
  aberto nem quantização ali: é vocabulário do beat 9.

### Fundação (`group: 'foundations'`, sem `beat`, `teachFromZero: true`)

**f1 · chat × agente.** A diferença entre uma caixa que responde e um programa
que executa. Study-only, não entra no Live Mode nem no deck. Existe para o Davi
calibrar a abertura sabendo o que a sala já tem.

### Beat 1 · token

A unidade de três coisas ao mesmo tempo: o custo, a velocidade e o limite.

- O que conta como token, com exemplos concretos: um par de palavras onde o
  número de tokens não bate nem com o número de letras nem com o número de
  palavras (`"morango"` = 2, `"strawberry"` = 3, conferido em cl100k_base e
  o200k_base), e um trecho de código com indentação e pontuação. Token não é
  palavra e não é letra.
- O mesmo conteúdo custa diferente conforme está escrito. **Se for comparar
  português e inglês, meça as strings exatas que você vai imprimir, nas duas
  encodings (`cl100k_base` e `o200k_base`), e só imprima o par se o efeito valer
  nas duas.** Em palavra curta o efeito inverte e em frase curta às vezes empata.
  Pares que passaram nos dois: `computador` (2) contra `computer` (1);
  `A janela de contexto é finita e enche.` (12 / 11) contra
  `The context window is finite and fills up.` (9 / 9). Se nenhum par sobreviver,
  corte a comparação de idioma: ela não é necessária para nenhuma das três
  funções do token.
- Por que isso importa na prática: colar três arquivos grandes na conversa tem
  preço, em dinheiro e em qualidade.
- Deixe o problema em aberto: a saída de um comando pode ser gigante e entrar
  inteira. A resposta a isso é o beat 8, não antecipe.

**Proibido aqui:** BPE, subword, tokenizer, vetor, embedding.

### Beat 2 · modelo

Um previsor sem memória.

- Ele faz uma coisa: prever o próximo token, um de cada vez.
- Não tem memória entre conversas. Cada conversa nova começa do zero.
- Um modelo é um monte de números fixos, N bilhões deles. Plante isso, o beat 9
  depende.
- Família de modelos: leve e barato para tarefa simples, capaz e caro para o que
  é crítico. **A escolha é pela dificuldade da tarefa, não por gosto.**
- Alucinação como consequência direta de "prever o provável", não como bug.
- Traga a regra real do Davi como exemplo vivo (ver §5), mas **sem nomear
  subagente** ainda: fale em "quem conduz", "quem implementa", "quem revisa".

**Proibido aqui:** atenção, embedding, softmax, temperatura, top-p, pré-treino,
fine-tune, RLHF.

### Beat 3 · contexto (+ PTCF no fim)

A mesa é finita, e ela apodrece.

- Tudo que ele enxerga de uma vez: as instruções do sistema, o histórico da
  conversa, os arquivos que entraram, o resultado das ferramentas, o seu texto.
- A mesa tem tamanho, e esse tamanho tem nome canônico: **janela de contexto**.
  Quando enche, o começo some ou é comprimido.
- Contexto irrelevante não é neutro. Ocupa espaço e piora a resposta.
- Sessão e turno: sessão é a conversa inteira, turno é cada rodada.
- **Fecho em 2 slides: PTCF.** Persona, Task, Context, Format. Use a imagem do
  Google (ver §10, exige `credit`) e um par pedido fraco × pedido forte escrito
  para o público do ICS, não para vendas. O argumento de encaixe: acabei de
  mostrar que a mesa é finita, então o que você põe nela tem anatomia.

### Beat 4 · agente

O loop com ferramenta.

- O modelo não executa nada. Ele pede.
- O loop: recebe a mesa → devolve texto, e parte desse texto é um pedido de
  ferramenta → alguém executa de verdade → o resultado volta pra mesa → repete.
- Quem decide parar, e por que isso é a parte difícil.
- A diferença entre sugerir e fazer, que é onde o risco aparece.

### Beat 5 · skill

Instrução carregada sob demanda, em três camadas.

Ligue explicitamente ao beat 3: skill existe porque a mesa é finita. Se toda
instrução que você já escreveu ficasse sempre na mesa, não sobraria mesa.

- **Camada 1, instalar pronta.** `npx skills@latest add mattpocock/skills`, 37
  skills. Print do TUI na tela (ver §10, asset pendente).
- **Camada 2, usar de terceiro.** `prompt-master`
  (github.com/nidhinjs/prompt-master): uma skill só, detecta para qual IA você
  está escrevendo, aplica um de 13 templates, corrige 37 padrões que desperdiçam
  token, invocada por `/prompt-master`. Cite também as skills do superpowers que
  o Davi usa de verdade: `brainstorming`, `writing-plans`, `writing-skills`,
  `subagent-driven-development`. **Sem chamar superpowers de plugin.**
- **Camada 3, escrever a sua.** Abra uma skill do Davi na tela inteira e mostre
  que é um `SKILL.md`: frontmatter com `name` e `description`, e o resto é
  instrução em markdown. O ponto que vira a chave: **o `description` é a única
  parte que o modelo lê sempre, e é ela que decide se a skill é carregada.** A
  frase de saída é "skill é um arquivo markdown, você já sabe fazer isso".

Qual skill do Davi abrir: escolha entre `graphify` (engancha no beat 10),
`adversarial-review` (a mais impressionante) e `grilling`. **Pergunte ao Davi
antes de decidir.**

### Beat 6 · MCP

O protocolo do dado real.

- A distinção que resolve a confusão: skill é o **como fazer**, MCP é o **de onde
  vêm os dados**. Analogia do estagiário: a skill é o treinamento, o MCP é o
  crachá que dá acesso aos sistemas. Você quer os dois.
- Um servidor MCP expõe ferramentas e dados de um sistema externo.
- Exemplos reais da máquina do Davi: Linear (é o passo 2 do fluxo dele),
  Excalidraw, Chrome, computer-use, n8n.
- **Este é um dos beats de tratamento A** (ver §9): mostre uma chamada MCP
  acontecendo na simulação de sessão.

### Beat 7 · harness

Quem roda o loop.

Definição mecânica, e ela é a mesma nos cinco casos: system prompt + catálogo de
ferramentas + o loop + o que fazer quando a mesa enche.

A virada do beat: **o modelo é o mesmo. Por que a resposta muda?**

Tabela comparativa, cinco linhas, em ordem de quanto poder você entrega:

| | controla o prompt | você edita | alcança | troca de modelo | onde o dado mora |
|---|---|---|---|---|---|
| web (ChatGPT, Claude.ai) | eles | nada | nada | lista deles | preencher na autoria |
| Claude Cowork | eles | pouco | arquivos e apps locais | não | preencher na autoria |
| Claude Code | eles | CLAUDE.md + skills | shell, repo, MCP | lista deles | preencher na autoria |
| Codex | eles | AGENTS.md | shell, repo | lista deles | preencher na autoria |
| Hermes | **você** | **tudo** | **tudo** | **qualquer, local incluso** | preencher na autoria |

A coluna **onde o dado mora** pergunta uma coisa só: para onde vai o conteúdo da
mesa (o seu prompt, os arquivos que entraram, a saída das ferramentas) quando
você aperta enter. Preencha na autoria, junto da reverificação do §6 item 2. Não
leia como "onde ficam seus arquivos", que daria "na sua máquina" para todo mundo,
verdadeiro e inútil. É esse eixo que sustenta a árvore de decisão do fecho.

Momentos que fazem esse beat funcionar:

- **A revelação de abertura:** o ChatGPT que a sala usa já é um harness. Eles
  nunca controlaram a mesa, só não sabiam disso.
- **A piada que prova a aula inteira:** Hermes é nome de harness *e* nome de
  família de modelos, os dois da **Nous Research**. Mesmo nome, um é o motor e o
  outro é o carro. Se a sala consegue explicar por que os dois podem se chamar
  igual, entendeu a distinção central da aula.
- **Fecho com a árvore de decisão:** "seu TCC, dado sensível, sem internet. Qual
  você abre?"

Fatos verificados em 26/08/2026, **reverifique na autoria** (ver §6):

- *Claude Cowork*, da Anthropic. Research preview em 12/01/2026, GA em 09/04/2026
  com features de enterprise, web e mobile para assinantes Max em 07/07/2026.
  Posicionado como Claude Code para quem não abre terminal: trabalha nos
  arquivos, pastas e apps da máquina da pessoa.
- *Hermes Agent*, da Nous Research. Harness open source e model-agnostic, CLI mais
  app desktop para mac, Windows e Linux, lançado em fevereiro de 2026. Arquivo de
  instrução: `AGENTS.md` no projeto, `SOUL.md` global em `~/.hermes/SOUL.md`.
  Memória persistente, compressão de contexto por linhagem, sessões tratadas como
  infraestrutura. Traz skills de primeira mão para dirigir Claude Code, Codex
  CLI, OpenCode e OpenHands por baixo dele. (Ao escrever o beat, não use a palavra subagente
  aqui: ela abre no beat 8.)

### Beat 8 · o que você pluga

A taxonomia, e o beat que mais serve ao objetivo de escolher a peça certa.

Estruture pela pergunta, não pelo nome. A pergunta é **quando a instrução precisa
valer**:

| quando a resposta é... | a peça é | exemplo |
|---|---|---|
| "sempre, em toda tarefa" | CLAUDE.md / AGENTS.md | o CLAUDE.md desse repo |
| "às vezes, quando o assunto aparece" | skill | as 37 do Matt Pocock |
| "preciso de dado real de outro sistema" | MCP | o do Linear |
| "toda vez que ele rodar X, faz Y antes ou depois" | hook | **rtk** |
| "quero várias skills de uma vez" | plugin | **superpowers** |
| "essa parte suja muito a mesa" | subagente | o passo 11 do fluxo |

Conteúdo obrigatório aqui:

- **rtk** (github.com/rtk-ai/rtk). Hook que reescreve o comando antes de rodar:
  `git status` vira `rtk git status`, e ele filtra a saída antes de ela chegar na
  mesa. São dois passos, e a distinção é o próprio conteúdo do beat:
  `brew install rtk` traz o binário, `rtk init -g` grava o hook na config global
  do assistente. O primeiro instala a ferramenta, o segundo é o que a pluga no
  harness. Confirme os dois na doc do projeto na data da autoria (§6 item 6),
  porque `brew` cobre mac e Linux e pode existir outro caminho para Windows. Não
  imprima no slide contagem de comandos suportados que você não conferiu contra a
  versão instalada.
  **Use rtk para ensinar leitura crítica de claim de economia.** O headline diz
  "corta até 90% da saída de bash que seu agente lê". O próprio doc do projeto
  admite duas coisas: que isso é redução de saída bruta e **não** redução de
  conta, porque bash output é só uma parcela ao lado do prompt, do system prompt
  e do histórico, e que o número dele é uma estimativa: ele divide o tamanho em
  bytes por 4, em vez de contar token do jeito que a cobrança conta.
  O ponto pedagógico: a ferramenta é boa e o número é honesto, mas ler o número
  errado faz você esperar uma economia que não vem.
- **superpowers** (github.com/obra/superpowers), revelado aqui como plugin. Uma
  metodologia completa em skills componíveis. Instala com
  `/plugin install superpowers@claude-plugins-official`.
- **Subagente:** por que existe (contexto isolado, a mesa dele começa limpa) e o
  que custa (ele não viu o que você viu, então precisa receber tudo que importa).
- **Este é um dos beats de tratamento A**: mostre um hook interceptando e um
  subagente sendo disparado na simulação de sessão.

### Beat 9 · pesos abertos e ollama

Panorama do ecossistema aberto. **O beat que envelhece mais rápido da aula.** Ver
§6 antes de escrever uma linha aqui.

- **Aberto não é a mesma coisa que open source.** Peso aberto quer dizer que você
  baixa os números. Não quer dizer licença permissiva, não quer dizer uso
  comercial liberado, e quase nunca quer dizer que você sabe em que dado o modelo
  treinou.
- Quem libera peso e por quê.
- Panorama das famílias abertas relevantes hoje, com licença de cada uma.
- Parâmetro e quantização, uma frase cada. Parâmetro: quantos números o modelo
  tem. Quantização: apertar cada número para ocupar menos memória, ao custo de
  ficar um pouco mais burro.
- **Ollama:** o que é e como se usa. A analogia com Docker funciona bem aqui
  (`ollama pull` está para `docker pull` assim como o registry público está para
  o Docker Hub), mas **introduza a analogia, não a pressuponha**. A aula
  `deploy-journey` foi dada para o cohort 2026.2, não para este. Abra com "quem
  já usou Docker vai reconhecer o padrão" e explique o suficiente para quem nunca
  usou acompanhar.
- Quando rodar local vale a pena: dado que não pode sair da máquina, trabalho
  offline, custo marginal zero. Quando não vale: qualidade, velocidade, limite
  menor de contexto.
- **Sem demo ao vivo.** O Davi não tem ollama instalado e isso foi decidido.

### Beat 10 · contexto vira grafo

O topo da escada. Recorte fechado: **como funciona e como ajuda.** Sem desvio por
RAG, sem encenação.

**Como funciona.** Em vez de guardar arquivo, você extrai entidades (módulo,
função, conceito, pessoa) e as relações entre elas. Rodando no corpus inteiro,
sai um grafo. O algoritmo agrupa o que está densamente conectado em comunidades,
e cada comunidade é um assunto que ninguém nomeou de propósito, apareceu sozinho.
Cada aresta é marcada `EXTRACTED` (está escrito no arquivo) ou `INFERRED` (o
modelo deduziu, com um grau de confiança), então dá para saber no que confiar.

**Como ajuda.** Três coisas: a pergunta devolve um pedaço conectado do grafo em
vez de trechos soltos; o grafo fica salvo, então a próxima sessão não recomeça do
zero; e as comunidades mostram ligação entre partes do projeto que você nunca
pensaria em perguntar.

**Números reais, da máquina do Davi** (`~/development/neurafy/graphify-out`,
rodado em 07/08/2026, confira que ainda existe antes de citar):

- 2433 arquivos, ~2.991.246 palavras de corpus
- 21.546 nós, 53.586 arestas, 1.091 comunidades
- 97% EXTRACTED, 3% INFERRED, 0% AMBIGUOUS
- `graph.html` de 1MB, abre no navegador

Ligue ao beat 1 e ao beat 3: 3 milhões de palavras não cabem em nenhuma mesa. O
grafo é a engenharia que responde a esse limite.

### Beat 11 · arquitetura: o fluxo completo

O beat de integração. Anatomia de **um turno**, onde toda a escada se junta. Cada
caixa do desenho é um beat anterior, e o beat deve dizer isso em voz alta.

O caminho:

1. você digita
2. o harness monta a mesa: o system prompt dele, o seu CLAUDE.md, as skills que o
   assunto ativou, o histórico da conversa, o seu texto
3. o modelo devolve tokens, e alguns deles são um pedido de ferramenta
4. o harness executa de verdade, e um hook pode interceptar aqui
5. o resultado volta pra mesa
6. repete a partir do passo 3
7. quando a mesa enche: comprime, ou joga a parte suja para um subagente

Precisa de diagrama. Ver §7.

### Beat 12 · meu fluxo real

Os 15 passos do Davi, em quatro fases: Planejamento, Validação, Execução,
Produção. A imagem original existe (§10) e **precisa ser atualizada** conforme o
§5, que fixa o que muda (só os nomes de modelo) e o que fica (layout, os 15
passos, as quatro fases), porque a versão de julho já tem linha errada.

O que o beat precisa extrair do diagrama, além de mostrá-lo:

- A técnica que o Davi considera a mais valiosa: **fazer a IA te entrevistar
  antes de executar**. As duas que ele usa: `/grill-me`, que vem do pacote do Matt
  Pocock instalado no passo 2 do checklist, e `/superpowers:brainstorming`, que
  vem do plugin instalado no passo 3. O `grill-me` é uma casca fina: ele delega
  para a skill `grilling`, que é a primitiva de entrevista reusada por várias
  outras do mesmo pacote. Vale mostrar isso ao abrir a skill no beat 5, porque é
  a prova de que skill é arquivo e não produto. Por que funciona: as perguntas dela são uma janela para dentro da cabeça dela. Se as
  perguntas aprofundam o escopo, ela entendeu. Se fogem, você flagrou o erro
  antes de gastar trabalho. Ligue ao beat 3: a entrevista enche a mesa com o que
  falta **antes** de gastar contexto produzindo a coisa errada.
- **Revisão adversarial com N revisores de lentes diferentes.** O ponto não é
  quantidade, é diversidade de ângulo: quem olha arquitetura não vê o que quem
  olha segurança vê.
- **A regra de escolha de modelo por dificuldade e por lente** (§5).
- Este beat aterrissa o objetivo "copiar o fluxo do Davi".

### Beat 13 · o setup mínimo

O checklist, que é a tarefa de casa. Sem hands-on em sala.

```
1  npm i -g @anthropic-ai/claude-code
2  npx skills@latest add mattpocock/skills
3  /plugin install superpowers@claude-plugins-official
4  escreva um CLAUDE.md de 20 linhas pro seu projeto
5  ligue 1 MCP (o do sistema que você mais abre)
6  abra toda tarefa com /grill-me (o passo 2 instala)
7  ollama pull <modelo> só pra ver rodando
```

Verifique cada comando antes de imprimir no slide. A entrega é um print rodando.

### Síntese (`group: 'synthesis'`, sem `beat`)

A frase para levar. Deve amarrar as duas ideias que sustentam a escada:

- O modelo é uma coisa, o harness é outra, e quase toda confusão sobre IA vem de
  tratar os dois como a mesma.
- Quase todo problema com IA é contexto faltando ou contexto sobrando. As peças
  todas (skill, MCP, hook, plugin, subagente, grafo) existem para responder a
  essa mesma pergunta.

---

## 5. A stack atual do Davi

Confirmada por ele em 26/08/2026. Use exatamente isto no beat 12 e como exemplo
no beat 2.

| papel | modelo |
|---|---|
| orquestrador | Opus 5 |
| implementador | GPT 5.6-luna |
| revisores (N, lentes diferentes) | GPT 5.6-terra ou GPT 5.6-luna, conforme a dificuldade |
| segurança | GPT 5.6-Sol, o único nesse papel |

A regra ensinável, que é o que importa mais que os nomes: **o modelo é escolhido
pela dificuldade da tarefa e pela lente, não por preferência.**

O diagrama de julho está desatualizado. Ele nomeia Opus 4.8 (sucedido pelo Opus
5), Fable 5 nas lacunas e Sonnet 5 High nos subagents.

Decisão do Davi: opção "só atualizar". Reproduza o diagrama existente com o mesmo
layout, os mesmos 15 passos e as mesmas quatro fases (Planejamento, Validação,
Execução, Produção), trocando apenas os nomes de modelo pela stack da tabela
acima. O arquivo é um PNG sem fonte editável, então na prática você redesenha o
traço, mas o desenho de saída tem que ser reconhecível como o mesmo diagrama que
o Davi já usa. Não invente layout novo, não reagrupe fase, não corte nem funda
passo.

Como os papéis do diagrama velho mapeiam para a tabela acima:

| papel no diagrama de julho | passa a ser |
|---|---|
| adversarial: design e arquitetura (Opus 4.8) | um dos N revisores, lente de arquitetura |
| adversarial: segurança (GPT 5.6-Sol) | segurança, continua em Sol |
| adversarial: lacunas (Fable 5) | um dos N revisores, lente de lacunas |
| executa o plano com subagents (Sonnet 5 High) | implementador, GPT 5.6-luna |
| revisão (Opus 4.8) | um dos N revisores |
| post-deploy checks (GPT 5.6-Sol) | segurança, continua em Sol |
| (novo) quem conduz a sessão | orquestrador, Opus 5 |

O painel adversarial continua existindo e continua com N revisores de lentes
diferentes. O que mudou é que a diversidade agora está na lente, não em usar três
empresas de modelo distintas: todos rodam terra ou luna conforme a dificuldade,
e só segurança tem modelo próprio.

---

## 6. Validade: o que precisa ser verificado na autoria

O Davi escolheu, ciente do custo, o recorte de panorama no beat 9. Isso torna a
verificação obrigatória, não opcional.

**Nunca escreva de memória:** nome de modelo, versão, licença, preço, número de
parâmetro, requisito de RAM, benchmark, data de lançamento, nome de comando de
instalação, nome de framework de terceiro e a ordem dos seus componentes,
contagem de token. Esse último é o único da lista que se verifica rodando um
tokenizer local em vez de buscar na web.

**Verifique na web, na data da autoria:**

1. Todos os nomes de família de modelo aberto do beat 9, e a licença de cada uma.
2. Se o Claude Cowork e o Hermes Agent ainda estão como descritos no beat 7.
3. Os comandos do checklist do beat 13.
4. O comando de instalação do superpowers e do skills CLI.
5. Se GPT 5.6-luna, terra e Sol continuam sendo os nomes correntes. Se mudaram,
   **pergunte ao Davi** antes de trocar, porque é a stack pessoal dele.
6. **Os dois comandos do rtk do beat 8:** `brew install rtk` para o binário e
   `rtk init -g` para o hook. Confira se existe caminho de instalação fora do
   Homebrew, para quem não está no mac. Antes de imprimir qualquer contagem de
   comandos suportados, rode `rtk --version` e `rtk --help` na máquina do Davi e
   veja o que o headline do projeto está contando. Em 26/08/2026 a máquina estava
   na 0.38.0, com 66 subcomandos no `--help`, enquanto o README anunciava mais de
   100. O número que for para o slide precisa dizer de onde saiu.
7. **Números e claims de projeto de terceiro dos beats 5 e 8:** a contagem de
   skills do repo `mattpocock/skills`, a contagem de templates e a de padrões do
   `prompt-master`, e as duas ressalvas do próprio doc do rtk (que o corte é da
   saída bruta e não da conta, e que ele estima token dividindo bytes por 4).
   Abra o README de cada repo na data da autoria. As duas ressalvas do rtk são a
   carga do beat 8, não rodapé: se o doc do projeto tiver deixado de admiti-las,
   o exemplo de leitura crítica perde o pé. Reescreva com o que o doc diz hoje,
   ou troque de ferramenta. Não cite o que o doc não diz mais.
   A contagem de skills do Matt Pocock aparece em quatro lugares deste prompt
   (§4 beat 5, a tabela do §4 beat 8, o §10 e o exemplo do §12). Se mudou,
   corrija os quatro. O print do TUI e o slide têm que mostrar o mesmo número, e
   quem manda é o print: a sala vê os dois lado a lado. Divergência conhecida em
   26/08/2026: o CLI contou 37 skills e a seção de referência do README somava 28.
   O print é o que vai na tela, então o número dito em voz alta é o do print.

**Carimbe o beat 9 na prosa.** O último parágrafo do `pass2` diz em que data o
panorama foi verificado. Ali a validade curta é parte do que se ensina, então o
carimbo é conteúdo. Quando envelhecer, tem que dar para ver que envelheceu.

**Nos beats 5, 7 e 8 o carimbo não vai na prosa.** Vai como comentário no `.ts`,
na linha acima do nó: `// números conferidos em DD/MM/AAAA: <o que foi conferido>`.
O `pass2` tem 3 a 5 parágrafos (§12) e nenhum deles pode virar metadado de
manutenção. O que precisa existir é uma data ao lado do número, para quem mexer
depois saber que aquilo já foi conferido uma vez e quando.

---

## 7. Visuais e diagramas

São **dois campos diferentes** no `LessonNode`, e o que decide qual usar é onde a
imagem precisa aparecer, não gosto:

- **`visuals?: BoardVisual[]`** renderiza **só no pass 2 do Study Mode**
  (`study-mode.tsx`, componente `BoardVisuals`). Aceita `kind: 'ascii'` (arte
  monoespaçada, máximo ~72 colunas) e `kind: 'image'`, e nesse segundo caso
  `credit` é obrigatório. O comentário do próprio tipo diz o motivo: toda imagem
  em `visuals` é externa. Precedente: `ledger-financeiro.ts`.
- **`diagramUrl?: string`** renderiza **no Study Mode (pass 1 e 2) e também no
  Live Mode** (`live-mode.tsx`). Aponta para
  `/diagrams/vocabulario-ia/<id-do-beat>.png`, é o campo dos renders que a própria
  sessão produz, e não tem campo de crédito. Precedente: 22 usos em
  `deploy-journey.ts`, `backend-fundamentos.ts` e `websocket-rpc-blockchain.ts`.

**Regra:** render próprio, sem fonte externa, vai em `diagramUrl`. Enfiar render
próprio em `visuals kind:'image'` obriga a inventar um `credit` e faz a imagem
sumir do Live Mode, que é o modo aberto na sala.

Onde visual ganha o espaço, com o campo de cada um:

- **beat 1**, nó, `visuals kind:'ascii'`: a mesma quantidade de letras rendendo
  contagens diferentes de token, mais um trecho de código com indentação. Se
  entrar par português contra inglês, ele obedece à regra de medição do §4.
- **beat 3**, nó, `visuals kind:'ascii'`: a mesa enchendo ao longo de uma conversa.
- **beat 3**, nó, `visuals kind:'image'`: o diagrama PTCF do Google (§10), com
  `credit` e `creditUrl` preenchidos.
- **beat 4**, nó, `visuals kind:'ascii'`: o loop, quatro caixas e uma seta que volta.
- **beat 7**: no **deck**, tabela tipografada em DM Sans, nunca bloco
  monoespaçado. No **nó**, a mesma tabela vai em `visuals kind:'ascii'`, porque
  `pass2` só interpreta `**negrito**` e crase inline: tabela markdown ali sai como
  uma linha de pipes.
- **beat 8**: mesma divisão do beat 7, para a tabela das seis peças.
- **beat 10**, nó, `diagramUrl: '/diagrams/vocabulario-ia/beat-10-grafo.png'`:
  screenshot do `graph.html` do neurafy, capturado no navegador.
- **beat 11**, nó, `diagramUrl: '/diagrams/vocabulario-ia/beat-11-turno.png'`: o
  diagrama do turno, o principal da aula, gerado no Excalidraw pelo Step 6 da
  skill. Este precisa aparecer no Live Mode, então `visuals` está fora de questão.
- **beat 12**, nó, `diagramUrl: '/diagrams/vocabulario-ia/beat-12-fluxo.png'`: o
  fluxo de 15 passos atualizado conforme o §5. Este não é diagrama pra criar do
  zero no Excalidraw: é o diagrama existente com os nomes de modelo trocados.

Regra da skill que vale aqui: renderize e **olhe** cada imagem antes de commitar.
`file` dizer que é um PNG válido não quer dizer que está legível.

---

## 8. Glossário

Obrigatório. Três grupos, espelhando os blocos da escada. Cerca de 25 termos,
definição de uma linha cada, escrita para ser dita em voz alta numa entrevista.

- **Fundamentos**: token, modelo, pesos, família de modelos, contexto, janela de
  contexto, sessão, turno, alucinação, prompt, PTCF.
- **Ferramentas**: agente, loop, ferramenta, skill, MCP, harness, system prompt,
  CLAUDE.md, AGENTS.md, hook, plugin, subagente.
- **Avançado**: peso aberto, quantização, parâmetro, ollama, grafo de
  conhecimento, comunidade, EXTRACTED, INFERRED.

Este é o artefato que atende o objetivo "explicar em entrevista". Ele sai no PDF
de material do menu Exportar.

---

## 9. O deck

`apps/web/public/slides/vocabulario-ia.html`. Reaproveite **apenas o motor** de
`deploy-journey.html`: navegação por teclado e clique, o fluxo `?print=1` de PDF,
as classes de animação de entrada, o setup sem build. **Jogue fora o layout dele.**

### Identidade: Claude Code

A aula acontece dentro da coisa que ela explica. Não é uma marca escolhida por
combinar de longe: é o próprio harness que serve de moldura.

Amostra aprovada pelo Davi:
https://claude.ai/code/artifact/60604ea4-b643-424a-b6b6-d5c98b5b4b3d

A amostra vale como identidade visual e como composição. **O conteúdo dos slides
dela é rascunho e não foi verificado.** O bloco de token do beat 1 imprime
`morango` 2 contra `strawberry` 3, números corretos que não sustentam nenhuma
afirmação sobre idioma. Escreva o conteúdo pelo §4, não copie da amostra.

**Tema claro.** Projetor de sala lava preto. O tema claro existe de verdade no
Claude Code, então continua sendo fiel.

Tokens aprovados:

```
--bg      #FAFAF8   papel quente
--ink     #26221E
--mute    #8B837A
--faint   #B4ABA0
--rule    #E6E1D9
--clay    #C4643F   único acento, nunca decorativo
```

Fontes: **JetBrains Mono** (400/500/700/800) para o cromo, o mono e os títulos.
**DM Sans** (400/500/700) para corpo de painel e tabela. Ambas via `<link>` do
Google Fonts, nunca `@import` em CSS.

### Dois tratamentos

- **Tratamento B, o padrão.** A moldura do Claude Code fica (linha de topo com
  `✻ aula de IA · ICS Select` à esquerda e o modelo à direita, barra de status
  embaixo), e o conteúdo é composto como slide: título grande em mono pesado,
  tabela com tipografia de verdade em DM Sans. É o padrão porque metade dessa
  aula é tabela comparativa, e tabela em bloco monoespaçado não sobrevive à
  distância da sala.
- **Tratamento A, a sessão simulada.** A pergunta âncora aparece digitada na
  caixa de input com o `>` em clay, e a explicação desce como resposta do
  assistente, com o `⏺` em clay. **Só nos beats onde a simulação é a
  demonstração:** beat 5 (a skill sendo carregada), beat 6 (a chamada MCP), beat
  8 (o hook interceptando, o subagente disparando). Nesses momentos a simulação
  não é piada, é o conteúdo.

### A barra de status é a navegação

`1/13 · fundamentos` à esquerda, o nome do degrau à direita. Ela substitui a
sidebar: mostra a altura do degrau sem gastar largura. Os três blocos são
`fundamentos` (1-3), `ferramentas` (4-8) e `avançado` (9-10), com 11-13 em
`fechamento`.

### Cuidado de legibilidade

Fonte grande, poucas linhas por slide. A tabela dos cinco harnesses tem seis
colunas contando o rótulo da linha: se não couber legível, quebre em duas
tabelas, não diminua a fonte.

---

## 10. Assets

| asset | estado | onde |
|---|---|---|
| Diagrama do fluxo de 15 passos | **existe, desatualizado** | `~/Library/Mobile Documents/com~apple~CloudDocs/Documentos/Meu fluxo com IA.png`. Atualizar conforme o §5: só os nomes de modelo mudam. |
| Apostila IA na LocPay (13 pág) | existe, referência | `~/Library/Mobile Documents/com~apple~CloudDocs/Documentos/apostila-ia-locpay.pdf`. É o piso a superar, ver §11. |
| Print do TUI `npx skills` | **resolvido, no repo** | `apps/web/public/diagrams/vocabulario-ia/beat-05-skills-cli.png` (960×1524, capturado em 26/08/2026). Mostra "Found 37 skills" e a lista com `grill-me`, `grilling`, `grill-with-docs`, `tdd`, `code-review`, `research`, `to-spec` entre outras. Use como `diagramUrl` do beat 5 e no deck. |
| Diagrama PTCF do Google | **resolvido, no repo** | `apps/web/public/diagrams/vocabulario-ia/external/ptcf.png` (1460×420, fundo claro, recortado da página 5 do PDF em 26/08/2026). Traz as quatro pílulas coloridas mais o exemplo de prompt com cada trecho pintado da cor do seu componente. `credit`: `Google · Gemini for Google Workspace: Prompting Guide 101`. `creditUrl`: `https://services.google.com/fh/files/misc/workspace_with_gemini_prompting_guide.pdf`. A URL `gemini-for-google-workspace-prompting-guide-101.pdf` que circula em buscador retorna "File not found", não use. O exemplo do PDF é de vendas: no slide, traduza a mesma estrutura para um pedido do mundo do ICS, mantendo o esquema de cores. |
| `graph.html` do neurafy | existe | `~/development/neurafy/graphify-out/graph.html`. Capturar screenshot para o beat 10. |

Todos os assets da aula vão para `apps/web/public/diagrams/vocabulario-ia/`.

---

## 11. Relação com a apostila da LocPay

O Davi deu uma aula parecida na LocPay em julho de 2026, para público comercial.
A apostila cobre: modelo, família de modelos, token, prompt, janela de contexto,
contexto, alucinação, agente, skill, conector/MCP, sessão e turno; depois
prompting, a técnica da entrevista, casos de borda, catálogo de skills, skill ×
MCP, e um fluxo de cinco passos.

**Essa aula é a versão técnica e mais funda da mesma escada.** Duas consequências:

1. **Não repita o nível.** Onde a apostila define agente como "a IA ligada a
   ferramentas", essa aula abre o loop. Onde a apostila diz que MCP é a tomada,
   essa aula diz o que o servidor expõe.
2. **Roube o que funcionou.** A analogia estagiário / treinamento / crachá para
   skill × MCP é boa e deve ser reusada. A ideia-âncora "a IA não sabe o que você
   sabe, ela só tem o que está na mesa" é a melhor frase da apostila e serve de
   espinha para o beat 3.

Mas **não repita prompting como bloco.** Ele foi coberto lá e aqui vira 2 slides.

---

## 12. Voz

Todas as regras de escrita da skill valem. As que mais quebram nessa aula:

- **Sem travessão** (U+2014). Vírgula, ponto ou parênteses. Varra o arquivo procurando
  U+2014 antes de salvar. Vale para o `.ts`, para o HTML do deck e para a
  mensagem de commit.
- **Sem emoji.** O projeto usa `lucide-react`. O glifo de triângulo de aviso (U+26A0) conta como emoji.
- **Sem paralelismo negativo** ("não é X, é Y"). Diga o Y direto.
- **Sem voz passiva pra escolha.** "O que manda é a dificuldade da tarefa", não
  "é guiada pela dificuldade".
- **Sem vocabulário de IA**: delve, crucial, pivotal, tapestry, underscore.
- **Números concretos.** "2433 arquivos", "21.546 nós", "37 skills", não "muitos".
- **pt-BR na voz, inglês nos termos canônicos.** Harness, prompt, token, hook,
  skill e MCP ficam em inglês, porque é assim que aparecem na vaga e na doc.
- **`pass2` em 3 a 5 parágrafos curtos** separados por `\n\n`, com sub-cabeçalho
  em negrito. Parágrafo único vira parede.

Sobre o público: escreva para alguém que sabe programar e nunca ouviu falar de
harness. Nenhum termo aparece antes de ser explicado, que é a mesma regra do
commit `f465223` na aula do ledger.

---

## 13. Ordem de execução

1. Leia `lesson-types.ts` e `ledger-financeiro.ts`.
2. Faça a verificação de validade do §6 **antes** de escrever os beats 5, 7, 8, 9 e 13.
3. Pergunte ao Davi qual skill dele abrir no beat 5 (§4, beat 5).
4. Peça ao Davi o print do TUI do `npx skills` (§10). É terminal dele, só ele
   captura. A fonte da imagem PTCF já está resolvida no §10, não precisa pedir.
5. Escreva os 15 nós em ordem, um por vez, com todos os campos exceto `askWho` e
   `scenarios`. Nos beats 10, 11 e 12 já escreva o `diagramUrl` apontando para o
   caminho final em `/diagrams/vocabulario-ia/`. O PNG só passa a existir no passo
   8, e é isso que evita voltar aqui pra reescrever nó depois de gerar imagem.
6. Faça a auditoria de no-jumps: releia cada beat perguntando o que a sala ainda
   não podia saber. As armadilhas específicas estão no topo do §4.
7. Escreva o `glossary` (§8).
8. Gere os diagramas (§7).
9. Registre em `meetings-index.ts` e, se criar grupo novo, em `group-meta.ts`.
10. Rode `pnpm --filter @ics-select/web exec tsc --noEmit`.
11. Monte o deck (§9).
12. Suba o dev, abra `/admin/meetings/vocabulario-ia`, percorra Study Mode nos 3
    passes e o deck inteiro. Olhe cada imagem renderizada.
13. Varra tudo procurando travessão e emoji.

**Não commite nada com `git add -A`.** Adicione por caminho explícito.

---

## 14. Título

Nenhum título foi decidido. Proponha 3 ao Davi antes de fixar, e deixe claro que
o `subtitle` é o que carrega a escada. O `title` deve ser curto e dizer que a
aula é sobre vocabulário, não sobre "como usar IA".

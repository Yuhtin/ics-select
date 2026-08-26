import type { Lesson } from '../lesson-types';

export const vocabularioIa: Lesson = {
  slug: 'vocabulario-ia',
  title: 'Token, Harness, Grafo',
  subtitle:
    'Treze palavras de IA, do token ao grafo, na ordem em que uma depende da outra.',
  blurb:
    'Treze palavras de IA, na ordem em que uma depende da outra, e nenhuma aparece antes de ser explicada. Começa no token, que é a unidade do custo, da velocidade e do limite, e onde "morango" são 2 pedaços e "strawberry" são 3. Sobe para o modelo, um previsor sem memória feito de bilhões de números fixos, e para o contexto, a mesa finita que apodrece quando enche de coisa irrelevante. Daí em diante cada degrau é uma peça que existe para responder ao mesmo limite: o agente e seu loop, a skill que só é carregada quando o assunto aparece, o MCP que traz dado real de outro sistema, o harness que roda tudo e é a razão de a mesma pergunta render respostas diferentes no ChatGPT e no terminal, e a taxonomia do que se pluga (CLAUDE.md, hook, plugin, subagente). No alto, pesos abertos e o momento em que o contexto deixa de ser uma pilha de arquivos e vira um grafo consultável, com 21.546 nós e 1.091 comunidades sobre um corpus de quase 3 milhões de palavras. A frase que sai daqui: o modelo é uma coisa, o harness é outra, e quase todo problema com IA é contexto faltando ou contexto sobrando.',
  durationMin: 120,
  audience: 'Hopes and Dreams 2026.3',
  slidesUrl: '/slides/vocabulario-ia.html',
  nodes: [
    // ──────────────── FUNDAÇÃO (study-only) ────────────────
    {
      id: 'f-chat-agente',
      label: 'Chat x Agente',
      group: 'foundations',
      teachFromZero: true,
      tags: [
        'chat',
        'agente',
      ],
      oneLine: 'A diferença entre uma caixa que responde uma vez e um programa que continua rodando e decidindo sozinho o que fazer a seguir.',
      pass1: 'Um chat responde uma vez e para: você manda uma mensagem, ele devolve texto, e o turno acaba ali. Um agente é diferente: ele recebe uma tarefa, decide um passo, executa alguma ação no mundo, olha o resultado e decide o próximo passo sozinho, até a tarefa terminar ou travar. Essa aula inteira é uma escada de vocabulário que sobe justamente até esse ponto: o momento em que uma conversa vira um programa que age.',
      pass2: '**O chat para no primeiro turno**\nVocê escreve, ele responde, e o controle volta pra você. Nada acontece entre a pergunta e a resposta além de gerar texto. Se você quiser que algo mude no mundo, um arquivo salvo, um comando rodado, é você quem faz isso depois, copiando o que ele escreveu.\n\n**O agente continua sozinho**\nUm agente recebe uma tarefa e não devolve o controle no primeiro turno. Ele decide um passo, executa alguma ação de verdade, olha o que voltou, e decide o próximo passo, sem perguntar pra você a cada rodada. O motor por trás dos dois é o mesmo tipo de programa; o que muda é se alguém dá acesso ao mundo pra ele e deixa ele repetir o ciclo sozinho.\n\n**Por que essa distinção abre a aula**\nTodo o vocabulário que vem a seguir serve pra explicar exatamente como esse ciclo funciona por dentro: o que ele lê, quanto isso custa, e o que decide o próximo passo. Sem essa base, a palavra agente vira só um hype word em vez de um mecanismo que dá pra desenhar no quadro.\n\n**Onde essa turma já está**\nEssa aula assume que dois ou três alunos já usaram alguma ferramenta desse tipo, e o resto nunca ouviu falar. Por isso a escada começa do zero: nenhuma palavra técnica aparece antes de ser definida, nem essa.',
      pass3: [
        {
          gotcha: 'Um agente é só um chat com uma interface bonita.',
          note: 'A diferença não é de interface, é de quem decide o próximo passo depois da primeira resposta: no chat é você, no agente é o próprio ciclo.',
        },
        {
          gotcha: 'Se ele responde rápido e parece decidir sozinho, já é um agente.',
          note: 'Decidir uma resposta não é o mesmo que executar uma ação e reagir ao resultado dela; um chat pode soar confiante sem nunca ter tocado em nada fora da conversa.',
        },
        {
          gotcha: 'Agente é uma tecnologia nova, diferente do que gera a resposta do chat.',
          note: 'O mecanismo que gera cada passo é o mesmo tipo de programa dos dois lados; a diferença está em quem controla o ciclo, não no motor.',
        },
        {
          gotcha: 'Essa distinção é só semântica, não muda nada na prática.',
          note: 'Muda o que você pode confiar que aconteceu sem checar: num chat nada roda sozinho, num agente você precisa saber o que ele tinha permissão de fazer.',
        },
      ],
      anchor: 'Se você pedir a mesma tarefa pro chat e pro agente, e no meio dela for preciso ler um arquivo pra continuar, qual dos dois para pra te perguntar, e qual dos dois simplesmente lê e segue sozinho?',
      followup: 'Se um agente fica rodando sozinho, lendo arquivo atrás de arquivo e decidindo o próximo passo, o que exatamente ele está lendo a cada passo, e será que ler mais custa alguma coisa?',
      gotcha: 'Se a turma disser rápido demais que já entendeu a diferença, pergunte quem nunca viu um agente travar no meio de uma tarefa e ficar repetindo o mesmo passo sem perceber.',
    },
    // ──────────────── FUNDAMENTOS · token, modelo, contexto ────────────────
    {
      id: 'beat-01-token',
      label: 'Token',
      group: 'fundamentos',
      beat: 1,
      tags: [
        'token',
        'custo-por-token',
        'velocidade',
        'limite-de-leitura',
        'cl100k-base',
        'o200k-base',
      ],
      oneLine: 'A unidade que mede custo, velocidade e limite ao mesmo tempo, e não é letra nem palavra.',
      pass1: 'Token é a unidade que o modelo cobra, gera e lê, tudo na mesma moeda. Não é letra: strawberry vira 3 tokens e computer vira 1, mesmo computer tendo menos letras. Não é palavra: morango inteiro vira 2 tokens, mor e ango. Código é mais denso que prosa: uma linha de 58 caracteres vira 19 tokens nas duas codificações usadas hoje, cl100k_base e o200k_base. Cada token custa dinheiro, leva tempo pra sair, e ocupa espaço no que o modelo consegue ler de uma vez.',
      pass2: '**Token não é letra nem palavra**\nStrawberry tem dez letras e vira três tokens, str, aw e berry. Computer tem oito letras e vira um token só, inteiro. Morango, com sete letras, vira dois: mor e ango. Esse par, morango contra strawberry, não prova que português custa mais: ele só prova que token não acompanha nem contagem de letra nem contagem de palavra.\n\n**A comparação que aguenta os dois lados**\nPra comparar idioma de verdade, o par que sobrevive nas duas codificações é computador contra computer: computador vira 2 tokens, computer vira 1, nas duas. A frase `A janela de contexto é finita e enche.` vira 12 tokens numa codificação e 11 na outra; a versão em inglês, `The context window is finite and fills up.`, vira 9 nas duas. O inglês tende a sair mais barato, mas o efeito não é enorme.\n\n**Código é denso**\nA linha `const saldo = entries.reduce((acc, e) => acc + e.valor, 0);` tem 58 caracteres e vira 19 tokens, nas duas codificações: cerca de 3 caracteres por token, contra perto de 4 na prosa em inglês. Com 8 espaços de indentação na frente, a mesma linha vira 20 tokens: a indentação custou exatamente 1 token, não mais.\n\n**O custo de verdade**\nCada família de modelo cobra por milhão de tokens, entrada e saída separadas, e a diferença entre o mais caro e o mais barato passa de 25 vezes, tanto na entrada quanto na saída. Colar três arquivos grandes numa conversa tem preço real em dinheiro, além de ocupar espaço do que o modelo consegue ler de uma vez.\n\n**Um problema que fica em aberto**\nTem uma pergunta que essa definição ainda não responde: o que acontece quando você roda um comando e a saída dele é gigante, maior do que faz sentido colar inteira na conversa? Ela entra inteira do mesmo jeito, token por token, e alguém paga por isso. Guarda essa pergunta, ela volta.',
      visuals: [
        {
          kind: 'ascii',
          title: 'A mesma quantidade de letra, token diferente',
          art: 'PALAVRA       LETRAS   TOKENS cl100k   TOKENS o200k\nmorango          7          2                2\nstrawberry      10          3                3\ncomputador      10          2                2\ncomputer         8          1                1\n\nCODIGO (58 caracteres)\nconst saldo = entries.reduce((acc, e) => acc + e.valor, 0);\ntokens: 19 (cl100k) / 19 (o200k)\n\nMESMO CODIGO COM 8 ESPACOS DE INDENTACAO NA FRENTE\n        const saldo = entries.reduce((acc, e) => acc + e.valor, 0);\ntokens: 20 (cl100k) / 20 (o200k)   a indentacao custou 1 token',
          caption: 'Morango e strawberry têm quantidade de letra parecida mas token bem diferente, isso só prova que token não é letra nem palavra; a comparação de idioma que vale é computador contra computer, que sobrevive nas duas codificações. No código, oito espaços de indentação custaram exatamente um token a mais.',
          board: 'Desenho a tabela no quadro, uma linha por palavra, letra numa coluna e token na outra, e só depois mostro o trecho de código com e sem indentação lado a lado, circulando a diferença de um token.',
        },
      ],
      pass3: [
        {
          gotcha: 'Se a palavra tem mais letra, ela vira mais token.',
          note: 'Computer tem 8 letras e vira 1 token só; letra não prediz token.',
        },
        {
          gotcha: 'Morango contra strawberry prova que português custa mais caro.',
          note: 'Esse par só mostra que token não é letra nem palavra; a comparação de idioma que aguenta as duas codificações é computador contra computer.',
        },
        {
          gotcha: 'Indentação custa muito token, então economize espaço em branco.',
          note: 'No exemplo real, 8 espaços de indentação custaram exatamente 1 token, não uma pilha deles.',
        },
        {
          gotcha: 'Contar caractere e dividir por 4 já dá o número certo de token.',
          note: 'Isso é só uma estimativa grosseira; o número real depende de onde as palavras quebram, como mostram morango e strawberry.',
        },
      ],
      anchor: 'Quando você cola o mesmo trecho de código duas vezes, uma vez limpo e outra com oito espaços de indentação na frente, quantos tokens a mais isso custa de verdade?',
      followup: 'Se cada token que entra e cada token que sai tem custo e leva tempo, o que exatamente está do outro lado decidindo qual vai ser o próximo token?',
      gotcha: 'Se a turma disser rápido demais que já sacou a conta, pergunte quantos tokens sobram de espaço depois de colar três arquivos grandes numa conversa que já tem um histórico longo.',
    },
    {
      id: 'beat-02-modelo',
      label: 'Modelo',
      group: 'fundamentos',
      beat: 2,
      tags: [
        'modelo',
        'pesos',
        'previsor-de-token',
        'familia-de-modelos',
        'alucinacao',
      ],
      oneLine: 'Um previsor sem memória: um monte de números fixos que só sabe prever o próximo token.',
      pass1: 'Um modelo faz uma coisa: prevê o próximo token, um de cada vez, e repete até parar. Por dentro ele é um monte de números fixos, pesos, bilhões deles, que não mudam durante a conversa. Ele não lembra de conversa nenhuma anterior: cada conversa nova começa do zero. Existem famílias de modelo, leve e barato para tarefa simples, capaz e caro para o crítico, e a escolha certa é pela dificuldade da tarefa, não por preferência. Alucinação não é bug: é consequência direta de prever o token mais provável.',
      pass2: '**Uma coisa só, repetida**\nO modelo faz uma única operação: olha tudo que já tem e prevê qual é o próximo token mais provável. Ele faz isso de novo com o token que acabou de gerar somado ao resto, e de novo, até decidir parar. Uma resposta longa é só essa operação repetida muitas vezes seguidas.\n\n**Nada fica guardado entre conversas**\nCada conversa nova começa do zero. O modelo não sabe o que você perguntou ontem, nem numa outra conversa aberta agora mesmo, a não ser que alguém cole esse histórico de novo na frente dele. Não tem memória própria acontecendo por baixo.\n\n**O que ele realmente é**\nPor dentro, um modelo é um monte de números fixos, chamados de pesos, bilhões deles, que não mudam enquanto você conversa. A conversa muda o que entra na frente dele, não o número em si.\n\n**Família de modelo, escolhida pela tarefa**\nExiste modelo leve e barato para tarefa simples, e modelo capaz e caro para o que é crítico. Um exemplo real: numa rotina de trabalho, quem conduz a tarefa usa Opus 5, quem implementa usa GPT-5.6-luna, quem revisa usa GPT-5.6-terra ou GPT-5.6-luna dependendo da dificuldade da revisão, e quem cuida da parte de segurança usa sempre GPT-5.6-Sol. A escolha é pela dificuldade da tarefa e pela lente de quem está olhando, nunca por preferência.\n\n**Alucinação é o mecanismo, não um defeito**\nPrever o token mais provável não é o mesmo que prever o token verdadeiro. Quando o modelo erra um fato com total confiança, ele não quebrou: ele fez exatamente o que faz sempre, prever o que parece mais provável, só que dessa vez o mais provável estava errado.',
      pass3: [
        {
          gotcha: 'O modelo lembra do que você conversou ontem numa aba diferente.',
          note: 'Cada conversa nova começa do zero; sem ninguém colar o histórico de novo, não sobra nada.',
        },
        {
          gotcha: 'Modelo mais caro é sempre a escolha certa.',
          note: 'A escolha certa é pela dificuldade da tarefa, não pelo preço nem pela fama do modelo; por isso a mesma rotina usa modelos diferentes para papéis diferentes.',
        },
        {
          gotcha: 'Alucinação é um bug que algum dia vai ser corrigido de vez.',
          note: 'É consequência direta de como o modelo funciona, prever o token mais provável, não uma falha pontual que desaparece com mais ajuste.',
        },
        {
          gotcha: 'Os pesos mudam enquanto você conversa, então o modelo está aprendendo com você.',
          note: 'Os pesos são números fixos durante a conversa inteira; o que muda é só o que está na frente dele, não o número em si.',
        },
      ],
      anchor: 'Quando a mesma rotina de trabalho usa um modelo pra conduzir, outro pra implementar e um terceiro fixo só pra segurança, o que está decidindo qual modelo entra em cada papel?',
      followup: 'Se o modelo não guarda nada de uma conversa pra outra e só prevê o próximo token olhando pro que está na frente dele, o que exatamente está na frente dele numa conversa em andamento?',
      gotcha: 'Se alguém disser que basta usar sempre o modelo mais capaz pra garantir qualidade, pergunte quanto isso custaria multiplicado pelo volume real de tarefas do dia, e se a diferença de qualidade nas tarefas simples paga essa conta.',
    },
    {
      id: 'beat-03-contexto',
      label: 'Contexto',
      group: 'fundamentos',
      beat: 3,
      tags: [
        'contexto',
        'janela-de-contexto',
        'sessao',
        'turno',
        'ptcf',
        'persona',
        'task',
        'format',
      ],
      oneLine: 'A IA não sabe o que você sabe, ela só tem o que está na mesa, e a mesa é finita.',
      pass1: 'Tudo que o modelo enxerga de uma vez cabe numa mesa: as instruções do sistema, o histórico da conversa, os arquivos que entraram, o resultado de ferramentas, e o seu texto. Essa mesa tem tamanho, e o tamanho dela tem nome: janela de contexto. Quando enche, o começo some ou é comprimido. Sessão é a conversa inteira; turno é cada rodada dentro dela. E como a mesa é finita, o que você põe nela tem anatomia: fecha com PTCF, persona, task, context, format.',
      pass2: '**A frase que resume tudo**\nA IA não sabe o que você sabe, ela só tem o que está na mesa. Tudo que o modelo enxerga num turno cabe nessa mesa: as instruções do sistema, o histórico da conversa até ali, os arquivos que entraram, o resultado do que alguma ferramenta trouxe, e o seu texto agora. Nada além disso existe pra ele naquele momento.\n\n**A mesa tem tamanho, e o tamanho tem nome**\nAquele limite do beat anterior agora ganha nome: janela de contexto. É o tamanho máximo da mesa, medido em token. Quando a conversa cresce mais do que esse tamanho, alguma coisa precisa sair: o começo da conversa some ou é comprimido pra abrir espaço pro que é novo.\n\n**Sessão e turno**\nSessão é a conversa inteira, do primeiro ao último turno. Turno é cada rodada dentro dela: você escreve, ele responde, isso é um turno. Uma sessão longa acumula turno atrás de turno, e cada um deles fica em cima da mesa até ela encher.\n\n**Contexto irrelevante não é neutro**\nColar informação que não serve pra nada não é grátis: ela ocupa espaço na mesa e ainda piora a resposta, porque o modelo tem que separar o que importa em meio a mais coisa. Uma mesa cheia de coisa inútil deixa menos espaço pro que realmente importa.\n\n**PTCF: a anatomia do que você põe na mesa**\nJá que a mesa é finita, o que você põe nela tem estrutura, não é só um monte de texto solto. PTCF quer dizer Persona, quem o modelo deve agir como, Task, a tarefa exata, Context, o material que ele precisa pra fazer essa tarefa, e Format, como a resposta deve sair. Um pedido fraco, tipo `me ajuda com esse código`, não define nenhum dos quatro. Um pedido forte nomeia os quatro: `aja como revisor de código sênior do ICS` (persona), `revise a função de cálculo de saldo abaixo` (task), `aqui está o arquivo e o teste que está falhando` (context), `responda em bullets, no máximo cinco linhas por item` (format).',
      visuals: [
        {
          kind: 'ascii',
          title: 'A mesa enchendo ao longo da conversa',
          art: 'TURNO 1 (mesa quase vazia)\n+------------------------------+\n| instrucoes do sistema        |\n| seu texto                    |\n+------------------------------+\n\nTURNO 4 (mesa enchendo)\n+------------------------------+\n| instrucoes do sistema        |\n| historico (turnos 1 a 3)     |\n| arquivo.ts                   |\n| seu texto                    |\n+------------------------------+\n\nTURNO 9 (mesa quase cheia)\n+------------------------------+\n| instrucoes do sistema        |\n| historico (turnos 1 a 8)     |\n| arquivo.ts                   |\n| resultado de ferramenta      |\n| seu texto                    |\n+------------------------------+',
          caption: 'A cada turno novo, o histórico anterior continua ocupando espaço na mesa; por isso ela enche mesmo sem ninguém colar nada novo de propósito.',
          board: 'Desenho a mesma caixa três vezes, turno 1, turno 4 e turno 9, empilhando uma linha nova a cada vez até a caixa quase estourar, pra mostrar que o histórico nunca sai sozinho.',
        },
        {
          kind: 'image',
          title: 'PTCF: a anatomia do pedido',
          src: '/diagrams/vocabulario-ia/external/ptcf.png',
          alt: 'Diagrama do Google mostrando quatro pilulas coloridas, Persona em azul, Task em rosa, Context em amarelo e Format em verde, com um exemplo de prompt destacado nas mesmas cores.',
          credit: 'Google · Gemini for Google Workspace: Prompting Guide 101',
          creditUrl: 'https://services.google.com/fh/files/misc/workspace_with_gemini_prompting_guide.pdf',
          caption: 'Pedido fraco: `me ajuda com esse código`. Pedido forte com PTCF: Persona (azul) `aja como revisor de código sênior do ICS`; Task (rosa) `revise a função de cálculo de saldo abaixo`; Context (amarelo) `aqui está o arquivo e o teste que está falhando`; Format (verde) `responda em bullets, no máximo cinco linhas por item`.',
          board: 'Aponto pra cada pílula colorida na imagem e leio o pedido forte reescrito pro nosso mundo, campo por campo, na mesma ordem das cores.',
        },
      ],
      pass3: [
        {
          gotcha: 'A janela de contexto é a memória permanente do modelo.',
          note: 'É só o tamanho da mesa naquele momento; quando a sessão acaba ou a mesa enche e o começo sai, isso não fica guardado em lugar nenhum.',
        },
        {
          gotcha: 'Colar mais contexto sempre ajuda, nunca atrapalha.',
          note: 'Contexto irrelevante ocupa espaço e piora a resposta, porque o modelo tem que separar o que importa em meio a mais coisa.',
        },
        {
          gotcha: 'PTCF é só formalidade, dá pra pular direto pra task.',
          note: 'Sem persona e context, o modelo preenche essas lacunas com a suposição mais provável, que pode não ser a que você queria.',
        },
        {
          gotcha: 'Sessão e turno são a mesma coisa, dois nomes pra mesma ideia.',
          note: 'Sessão é a conversa inteira; turno é cada rodada dentro dela, e uma sessão longa tem muitos turnos empilhados na mesma mesa.',
        },
      ],
      anchor: 'Se a mesa já tem instruções do sistema, histórico, arquivos e resultado de ferramentas empilhados, o que sobra dela pra caber a sua pergunta de agora quando a sessão já está longa?',
      followup: 'Se a mesa é finita e o modelo só prevê o próximo token olhando pro que está nela, o que precisa acontecer pra ele conseguir ler um arquivo que ainda não está na mesa?',
      gotcha: 'Se a turma disser rápido demais que já sacou PTCF, peça pra reescrever um pedido fraco real que eles mandariam numa entrevista técnica, e contar quantos dos quatro campos já estavam implícitos na cabeça deles mas nunca no texto.',
    },
    // ──────────────── FERRAMENTAS · agente, skill, MCP, harness, peças ────────────────
    {
      id: 'beat-04-agente',
      label: 'Agente',
      group: 'ferramentas',
      beat: 4,
      teachFromZero: true,
      tags: [
        'agente',
        'loop',
        'ferramenta',
        'tool-call',
        'criterio-de-parada',
      ],
      oneLine: 'O modelo nunca executa nada, só pede: o agente é o loop que pega esse pedido, manda executar de verdade e devolve o resultado pra mesa.',
      pass1: 'O beat anterior perguntou como um arquivo que ainda não está na mesa chega lá. A resposta é o agente: não um modelo diferente, mas o mesmo previsor de token do beat 2 rodando dentro de um loop. A cada volta ele lê a mesa inteira e devolve texto, e parte desse texto pode ser um pedido de ferramenta. Algo fora do modelo executa esse pedido de verdade e cola o resultado de volta na mesa. O modelo nunca toca o disco, ele só pede.',
      pass2: '**O mesmo previsor, agora em loop**\n\nO agente não é um modelo diferente do beat 2. É o mesmo previsor de token, sem memória, rodando dentro de um programa que repete uma pergunta pra ele várias vezes seguidas: dado o que está na mesa agora, qual é o próximo pedaço de texto. A diferença toda está em volta do modelo, não dentro dele.\n\n**O pedido de ferramenta**\n\nParte do texto que o modelo devolve não é resposta pro humano, é um pedido estruturado, algo como ler tal arquivo ou rodar tal busca. O modelo produz esse pedido do mesmo jeito que produz qualquer outro token, previsto um atrás do outro. Ele não sabe se aquele pedido vai funcionar, só sabe que aquele é o próximo pedaço de texto mais provável.\n\n**Quem executa de verdade**\n\nAlguém fora do modelo, o código que roda o loop, pega esse pedido e executa contra o mundo real: abre o arquivo, chama a busca, roda o comando. O resultado bruto volta e vira parte da mesa, como se o modelo sempre tivesse sabido aquilo. Na próxima volta ele lê a mesa de novo, agora maior.\n\n**Quem decide parar**\n\nNão existe um número fixo de voltas. A cada turno o próprio modelo decide, olhando pra mesa como ela está naquele momento, se já tem o suficiente pra responder ou se precisa pedir mais uma ferramenta. Essa decisão é a parte difícil: parar cedo demais deixa a tarefa pela metade, e não parar vira loop sem fim gastando token atrás de token.\n\n**Sugerir não é fazer**\n\nUm chat que sugere apagar um arquivo não apaga nada, o texto só fica na tela. Um agente que chama a ferramenta de apagar, apaga de verdade. É exatamente nesse ponto, o pedido de ferramenta virando execução real, que o risco aparece: o que um agente pode sugerir é livre, o que ele pode de fato fazer depende de quais ferramentas estão na mão dele.',
      visuals: [
        {
          kind: 'ascii',
          title: 'O loop do agente',
          art: '        +-------------+\n   +--->|    MESA     |\n   |    |  (contexto) |\n   |    +-------------+\n   |           |\n   |           v\n   |    +-------------+\n   |    |   MODELO    |\n   |    | preve texto |\n   |    +-------------+\n   |           |\n   |    pedido de ferramenta\n   |           v\n   |    +-------------+\n   |    |  FERRAMENTA |\n   |    | executa de  |\n   |    |   verdade   |\n   |    +-------------+\n   |           |\n   |    resultado volta\n   |           v\n   +----- pra mesa, loop de novo',
          caption: 'O mesmo previsor do beat 2, agora dentro de um loop que executa de verdade e devolve o resultado pra mesa.',
          board: 'Desenho as quatro caixas no quadro e refaço a seta que volta enquanto explico cada volta do loop, parando na caixa do meio pra frisar que o modelo só pede.',
        },
      ],
      pass3: [
        {
          gotcha: 'O agente é um modelo diferente e mais inteligente que o modelo de chat comum.',
          note: 'É o mesmo previsor de token do beat 2, sem memória, rodando dentro de um loop escrito por fora dele. A inteligência extra vem do loop e das ferramentas disponíveis, não de um modelo diferente por baixo.',
        },
        {
          gotcha: 'O modelo lê o arquivo direto do disco quando precisa dele.',
          note: 'Nunca. Ele pede a leitura, algo fora do modelo executa de verdade e cola o resultado na mesa. Se essa ferramenta falhar ou não existir, o modelo só vê o erro que voltou, não o arquivo.',
        },
        {
          gotcha: 'Existe um número fixo de voltas que o loop roda antes de responder.',
          note: 'Não existe. O próprio modelo decide a cada turno se já tem o suficiente na mesa pra responder ou se pede mais uma ferramenta, e essa decisão pode falhar pros dois lados: parar cedo demais ou repetir chamada sem necessidade.',
        },
        {
          gotcha: 'Sugerir uma ação e fazer essa ação são praticamente a mesma coisa.',
          note: 'Sugerir é só texto na tela, sem custo nenhum. Fazer é a ferramenta executando de verdade contra o mundo, apagando arquivo ou mandando alguma coisa. O risco mora exatamente na virada de um pro outro.',
        },
      ],
      anchor: 'Quando alguém descreve a IA lendo um arquivo sozinha no meio de uma tarefa longa, o que exatamente aconteceu entre o pedido dela e o conteúdo aparecer na mesa?',
      followup: 'Se o agente decide sozinho, turno a turno, quando parar de pedir ferramenta, o que decide QUAIS instruções já chegam prontas na mesa antes mesmo da primeira pergunta do usuário?',
      gotcha: 'Se a sala concordar rápido demais que o modelo decide quando parar, pergunte de volta: decide baseado em que informação, e o que acontece quando ele erra essa decisão, para cedo demais ou roda em loop sem fim.',
    },
    // números conferidos em 26/08/2026: 37 SKILL.md no repo mattpocock/skills e no print do TUI,
    // prompt-master com 13 templates e 37 padrões, grill-me com 6 linhas e grilling com 12.
    {
      id: 'beat-05-skill',
      label: 'Skill',
      group: 'ferramentas',
      beat: 5,
      teachFromZero: true,
      tags: [
        'skill',
        'skill-md',
        'description',
        'frontmatter',
        'sob-demanda',
      ],
      oneLine: 'Instrução que só entra na mesa quando o pedido bate com ela, guardada num arquivo markdown cujo description é a única parte sempre lida.',
      pass1: 'Skill resolve o que o beat 3 deixou em aberto: a mesa é finita, então nenhuma instrução pode ficar sempre nela. Skill é instrução guardada num arquivo separado, carregada só quando o pedido bate com ela. Dá pra usar em três camadas: instalar um pacote pronto de terceiro, usar uma skill de terceiro dentro de uma tarefa, ou escrever a sua própria. As três camadas são a mesma coisa por baixo: um arquivo markdown com um cabeçalho que decide quando o resto carrega.',
      pass2: '**A mesa que não sobra**\n\nO beat 3 deixou a mesa finita instalada como regra. Se toda instrução que você já escreveu, cada guia de estilo, cada checklist, cada convenção de projeto, ficasse sempre nela, não sobraria mesa pra tarefa em si. Skill é a resposta: instrução guardada num arquivo separado, fora da mesa, que só entra quando o pedido bate com ela.\n\n**Camada 1, instalar pronta**\n\nO comando `npx skills@latest add mattpocock/skills` abre um instalador no terminal que mostra Found 37 skills antes de perguntar quais delas você quer levar. É seletivo: se você não marcar uma skill naquela lista, ela simplesmente não existe depois na ferramenta que você usa.\n\n**Camada 2, usar de terceiro**\n\nprompt-master é uma skill só, que detecta pra qual ferramenta o seu prompt é destinado, aplica 1 de 13 templates e reporta 37 padrões que desperdiçam token, tudo invocado por `/prompt-master`. Do mesmo jeito, o pacote de skills chamado superpowers traz brainstorming, writing-plans, writing-skills e subagent-driven-development, as skills que entram de verdade no fluxo do Davi.\n\n**O par que cabe numa tela**\n\ngrill-me e grilling, do mesmo pacote da camada 1, provam o que skill é por baixo. grill-me tem 6 linhas, e o corpo inteiro dela é literalmente Run a /grilling session. grilling, a skill que faz o trabalho de verdade, tem 12 linhas. As duas cabem inteiras numa tela, e isso é o ponto: skill é arquivo, não produto.\n\n**Camada 3, escrever a sua**\n\nadversarial-review, a skill que o Davi escreveu, tem 297 linhas em português, e é um SKILL.md como qualquer outro: um frontmatter com `name` e `description` no topo, e o resto é instrução em markdown normal. O `description` é a única parte que o modelo lê sempre, e é ela que decide se o resto da skill carrega. Skill é um arquivo markdown, você já sabe fazer isso.',
      diagramUrl: '/diagrams/vocabulario-ia/beat-05-skills-cli.png',
      pass3: [
        {
          gotcha: '37 skills instaladas de uma vez quer dizer 37 programas rodando na sua máquina.',
          note: 'São 37 arquivos SKILL.md esperando na ferramenta, cada um carregado só quando o description dele bate com o pedido. Não há execução contínua, não há processo rodando por conta própria.',
        },
        {
          gotcha: 'Todas as skills de um pacote instalado ficam disponíveis depois, mesmo sem escolher.',
          note: 'O instalador do npx skills@latest add é seletivo: se você não marcar uma skill específica na lista, ela não existe depois na sua ferramenta, o comando dela simplesmente não roda.',
        },
        {
          gotcha: 'Ter mais skills instaladas deixa a mesa mais cheia o tempo todo.',
          note: 'Só o description de cada skill fica sempre disponível pro modelo olhar. O corpo inteiro da instrução só entra na mesa quando aquele description bate com o pedido, então ter 37 skills instaladas não enche a mesa sozinho.',
        },
        {
          gotcha: 'prompt-master é um pacote com várias skills dentro.',
          note: 'É uma skill só. Ela que detecta pra qual ferramenta o prompt é destinado e escolhe 1 entre 13 templates por conta própria, não são 13 skills separadas.',
        },
        {
          gotcha: 'grill-me e grilling são a mesma skill com nomes diferentes.',
          note: 'grill-me é uma casca de 6 linhas cujo corpo inteiro é chamar /grilling. grilling, com 12 linhas, é quem carrega a instrução de verdade. Uma aponta pra outra, não são a mesma coisa.',
        },
      ],
      anchor: 'Quando 37 skills aparecem instaladas de uma vez na tela, o que exatamente foi baixado: um programa novo rodando, ou um punhado de arquivos de texto esperando serem lidos?',
      followup: 'Se skill é só instrução de como fazer, guardada num arquivo, o que garante que essa instrução consiga de fato tocar um sistema real lá fora, tipo um board de tarefas ou o navegador?',
      gotcha: 'Se a sala achar óbvio que é só um arquivo, pergunte quantos ali já abriram um SKILL.md antes de hoje. A resposta costuma ser zero, e esse é o ponto: é simples, mas quase ninguém olhou por baixo.',
    },
    {
      id: 'beat-06-mcp',
      label: 'MCP',
      group: 'ferramentas',
      beat: 6,
      teachFromZero: true,
      tags: [
        'mcp',
        'servidor-mcp',
        'protocolo',
        'cracha',
        'dado-real',
      ],
      oneLine: 'MCP é o protocolo que dá acesso a dado e sistema real fora da mesa; skill diz como fazer, MCP diz de onde vem o dado.',
      pass1: 'O beat anterior mostrou skill como instrução guardada num arquivo, e instrução sozinha não alcança nada fora da mesa. MCP é o protocolo que resolve essa outra metade: um servidor MCP expõe ferramentas e dados de um sistema externo pro agente do beat 4 chamar dentro do próprio loop. A analogia que resolve a confusão entre os dois é a do estagiário: skill é o treinamento que ele recebeu, MCP é o crachá que abre a porta dos sistemas de verdade. Você quer os dois.',
      pass2: '**A distinção que resolve a confusão**\n\nSkill, do beat anterior, é como fazer: instrução guardada num arquivo. MCP é de onde vem o dado: um protocolo que dá acesso a sistema real fora da mesa. Uma skill pode até te instruir a usar tal MCP, mas sozinha ela não alcança nada lá fora, só descreve o passo a passo.\n\n**O estagiário**\n\nA analogia que resolve a confusão: skill é o treinamento que o estagiário recebeu antes do primeiro dia, MCP é o crachá que abre a porta dos sistemas de verdade. Um estagiário só com treinamento tem opinião sobre como fazer e nenhum acesso. Um estagiário só com crachá tem acesso e nenhuma ideia do que fazer com ele. Você quer os dois.\n\n**O que um servidor MCP expõe**\n\nDo outro lado do protocolo, um sistema externo oferece um conjunto de ferramentas e dados que o agente pode chamar, exatamente do jeito que o beat 4 descreveu: o modelo pede, algo fora dele executa contra o sistema real, o resultado volta pra mesa. A diferença é só qual sistema está do outro lado do pedido.\n\n**Os MCPs reais da máquina do Davi**\n\nNa máquina do Davi hoje: Linear, que é o passo 2 do fluxo dele, Excalidraw, Chrome, computer-use e n8n. Cada um abre acesso a um sistema diferente, board de tarefas, canvas de desenho, navegador, controle de tela, automação, e todos são chamados dentro do mesmo loop do beat 4.\n\n**O crachá não liga sozinho**\n\nTer um MCP disponível na máquina não significa que ele fica ligado em toda sessão. Quem decide quais MCPs entram numa sessão, e quem escreve as instruções do sistema que abrem toda conversa antes da sua primeira pergunta, é a ferramenta que você usa.',
      pass3: [
        {
          gotcha: 'MCP é só mais uma skill, com outro nome.',
          note: 'São camadas diferentes. Skill é instrução de como fazer, guardada num arquivo. MCP é o canal que dá acesso a dado e sistema real fora da mesa. Uma pode citar a outra, mas nenhuma substitui a outra.',
        },
        {
          gotcha: 'Dá pra escolher entre ter skill ou ter MCP, dependendo da tarefa.',
          note: 'A analogia do estagiário mostra por que não: só treinamento sem crachá é opinião sem acesso, só crachá sem treinamento é acesso sem direção. As tarefas reais do Davi usam os dois juntos.',
        },
        {
          gotcha: 'Cada servidor MCP é escrito sob medida pra uma ferramenta específica.',
          note: 'É um protocolo padronizado, por isso o mesmo servidor MCP, tipo o do Linear, funciona em ferramentas diferentes sem precisar reescrever nada por dentro.',
        },
        {
          gotcha: 'MCP só serve pra ferramenta que escreve código.',
          note: 'Os exemplos reais da máquina do Davi cobrem gestão de tarefa (Linear), desenho (Excalidraw), navegador (Chrome), controle de tela (computer-use) e automação (n8n), nenhum deles é sobre escrever código.',
        },
      ],
      anchor: 'Quando o agente do loop chama uma ferramenta e ela devolve um card do Linear em vez do conteúdo de um arquivo local, o que exatamente mudou por baixo do pedido?',
      followup: 'Se skill e MCP moram os dois na ferramenta que você usa, quem decide quais deles ficam ligados numa sessão e escreve as instruções do sistema que abrem toda conversa antes da sua primeira pergunta?',
      gotcha: 'Se a sala disser rápido que MCP é só mais uma API, pergunte o que o protocolo padroniza que uma chamada de API crua, escrita à mão pra cada sistema, não padroniza.',
    },
    // fatos conferidos em 26/08/2026: Cowork em GA 09/04/2026 e processando na nuvem da Anthropic por
    // padrão, Codex CLI com flag --oss para provedor local, Hermes Agent (MIT) da Nous Research.
    {
      id: 'beat-07-harness',
      label: 'Harness',
      group: 'ferramentas',
      beat: 7,
      tags: [
        'harness',
        'system-prompt',
        'catalogo-de-ferramentas',
        'claude-cowork',
        'claude-code',
        'codex',
        'hermes-agent',
      ],
      oneLine: 'O programa que roda o loop: system prompt, catálogo de ferramentas e a regra pra quando a mesa enche, a mesma receita atrás de cinco produtos diferentes.',
      pass1: 'Harness é o programa que roda o loop do beat anterior: ele escreve as instruções do sistema antes da sua primeira pergunta, decide qual catálogo de ferramentas o modelo enxerga, e resolve o que fazer quando a mesa enche. A definição é mecânica e vale igual nos cinco casos que a sala vai comparar aqui: web, Claude Cowork, Claude Code, Codex e Hermes. O modelo por baixo às vezes é exatamente o mesmo em dois harnesses diferentes. Mesmo assim a resposta muda. Por quê?',
      pass2: '**A revelação**\nO ChatGPT que a sala usa todo dia já é um harness. Antes da primeira pergunta do usuário, o produto injeta instruções do sistema, decide quais ferramentas aquele modelo pode chamar, busca na web, interpretador de código, geração de imagem, e resolve sozinho o que fazer quando a conversa fica longa demais pra mesa. Ninguém nessa sala escreveu essa parte e ninguém viu o texto dela. A sala nunca controlou a mesa, só não sabia disso.\n\n**A definição mecânica**\nA definição é sempre a mesma, tenha o nome que tiver: um harness é system prompt mais catálogo de ferramentas mais o loop mais uma regra pro que fazer quando a mesa enche. As instruções do sistema que apareceram lá atrás, no beat sobre contexto, têm nome agora: `system prompt`. Quem escreve esse texto não é você, é o harness. No Claude Code, parte desse texto vive num arquivo que você edita, chamado `CLAUDE.md`. No Codex, o arquivo equivalente chama `AGENTS.md`. Você nunca vê o system prompt completo de um produto fechado, só o efeito dele.\n\n**Os cinco casos**\nIsso explica a virada do beat: o modelo por baixo pode ser exatamente o mesmo, e a resposta ainda muda, porque o system prompt mudou, o catálogo de ferramentas mudou ou a política de mesa cheia mudou. A tabela ao lado compara cinco casos em ordem de quanto poder cada um te entrega, do web, que não deixa você editar nada, até o Hermes, onde você controla o prompt inteiro. A coluna que mais pesa na decisão é pra onde vai o conteúdo da mesa quando você aperta enter, o seu prompt, os arquivos que entraram, a saída das ferramentas. No web e no Claude Code, tudo sobe pro servidor do fornecedor a cada turno, sem opção de ficar só na sua máquina. No Claude Cowork, por padrão a sessão roda na nuvem da Anthropic, num espaço isolado e temporário, mesmo quando parece que você só está olhando pastas do seu computador: o pedido passa pelo app da sua máquina e o arquivo é processado lá, nos servidores deles. Parece local. Roda na nuvem. No Codex existe um caminho documentado pra apontar pra um provedor rodando na sua própria máquina, e nesse caminho o código não sai dali. No Hermes esse caminho é ainda mais fácil de ligar.\n\n**O mesmo nome nas duas camadas**\nHermes é o nome do harness que acabou de aparecer na tabela, e é também o nome de uma família de modelos. Os dois saem da Nous Research, e não há contradição nisso: um é o programa que roda o loop, o outro é o previsor de token que roda dentro dele. Saber dizer qual dos dois a frase está citando, só pelo contexto, é o teste prático de que a distinção entre modelo e harness ficou de pé.\n\n**A árvore de decisão**\nPra fechar, uma pergunta que a sala responde sozinha: seu TCC, um dado sensível, sem internet no prédio. Qual harness você abre? A resposta empurra pro Hermes com um provedor local, porque é o único caso da tabela onde o dado pode ficar preso na sua máquina o tempo inteiro. Web e Claude Code saem da lista de cara, porque sobem pro servidor do fornecedor sem opção de recusa. Essa árvore é o motivo prático de saber ler a tabela inteira, não só decorar cinco nomes.',
      visuals: [
        {
          kind: 'ascii',
          title: 'Os cinco harnesses (1 de 2): quem controla e ate onde chega',
          art: 'HARNESS      PROMPT  VOCE EDITA     ALCANCA\nweb          eles    nada           nada\nCowork       eles    pouco          arquivos e apps locais\nClaude Code  eles    CLAUDE.md      shell, repo, MCP\nCodex        eles    AGENTS.md      shell, repo\nHermes       voce    tudo           tudo',
          caption: 'Ordem de poder crescente: do fornecedor fechando tudo até você escrevendo o próprio system prompt.',
          board: 'Desenho cinco colunas no quadro, uma por harness, e marco com X onde cada um deixa você mexer.',
        },
        {
          kind: 'ascii',
          title: 'Os cinco harnesses (2 de 2): troca de modelo e onde o dado mora',
          art: 'HARNESS      TROCA DE MODELO           ONDE O DADO MORA\nweb          lista deles               vai pro servidor deles\nCowork       nao                       nuvem da Anthropic por padrao\nClaude Code  so Anthropic              sobe pra API a cada turno\nCodex        mais aberto, --oss local  servidor deles ou so na maquina\nHermes       qualquer, local incluso   so na maquina, se voce ligar',
          caption: 'A coluna da direita é a que decide a árvore do fecho: seu TCC com dado sensível sem internet abre qual desses cinco?',
          board: 'Mesmo quadro, duas colunas novas: pergunto pra sala qual harness sobe menos dado pra fora antes de revelar a resposta.',
        },
      ],
      pass3: [
        {
          gotcha: 'Mesmo modelo, harness diferente, resposta deveria sair igual.',
          note: 'Não sai. O harness muda o system prompt, o catálogo de ferramentas e a regra de mesa cheia, e isso muda a resposta mesmo com o modelo idêntico rodando por baixo dos dois.',
        },
        {
          gotcha: 'O Claude Cowork mexe nos arquivos da minha máquina, então roda local.',
          note: 'Não por padrão. A sessão roda na nuvem da Anthropic; quando precisa de um arquivo local, o pedido passa pelo app desktop numa conexão brokerada e o arquivo é processado nos servidores deles. Existe um modo local, mas não é o padrão.',
        },
        {
          gotcha: 'Codex só aceita modelo da OpenAI, é o harness mais fechado da lista.',
          note: 'É o oposto. Codex tem a flag --oss oficial, que aponta pra um provedor rodando na sua própria máquina, e também suporta Amazon Bedrock. Na coluna de troca de modelo ele é mais aberto que o Claude Code.',
        },
        {
          gotcha: 'Hermes harness e Hermes modelo são a mesma coisa, nome duplicado por acaso.',
          note: 'São produtos diferentes da mesma empresa, a Nous Research. Um é o motor, o harness que roda o loop, o outro é o carro, a família de modelos que anda por dentro. Nome igual, coisas diferentes.',
        },
        {
          gotcha: 'Se o harness controla tudo, o modelo deixou de importar.',
          note: 'Importa e muito: o harness decide o que entra na mesa, mas quem prevê o próximo token, pode alucinar, ter janela menor ou custar mais por token continua sendo o modelo, como nos beats 1 e 2.',
        },
      ],
      anchor: 'Se eu abrir o ChatGPT, o Claude Code e o Hermes agora e perguntar exatamente a mesma coisa pros três, por que a resposta não sai igual, mesmo quando o modelo por baixo é o mesmo?',
      followup: 'Se o harness fixa o system prompt e o catálogo de ferramentas antes da sua primeira pergunta, o que decide, dentro de uma sessão específica, se uma instrução entra sempre, entra só às vezes, ou só entra quando um sistema de fora precisa ser tocado?',
      gotcha: 'Se o Hermes te dá controle total do system prompt, do catálogo de ferramentas, e roda qualquer modelo, inclusive local, por que a maioria das pessoas nessa sala provavelmente nunca vai abrir ele no dia a dia?',
    },
    // números conferidos em 26/08/2026: rtk 0.38.0 com 66 subcomandos no --help contra "100+" no README,
    // as duas ressalvas literais na seção "How Savings Work", superpowers com 14 skills.
    {
      id: 'beat-08-o-que-voce-pluga',
      label: 'O que você pluga',
      group: 'ferramentas',
      beat: 8,
      tags: [
        'hook',
        'plugin',
        'subagente',
        'rtk',
        'superpowers',
        'contexto-isolado',
      ],
      oneLine: 'Seis perguntas, seis peças: a instrução vale sempre, às vezes, precisa de dado real, roda em gatilho, empacota junto, ou pede uma mesa própria.',
      pass1: 'Este beat organiza pela pergunta, não pelo nome: quando a instrução precisa valer? Sempre, em toda tarefa, e `CLAUDE.md` ou `AGENTS.md`, os arquivos que a sala já viu no beat anterior sem saber o motivo. Às vezes, quando o assunto aparece, e skill. Preciso de dado real de outro sistema, e MCP. Toda vez que ele rodar X, faz Y antes ou depois, e hook. Quero várias skills de uma vez, e plugin. Essa parte suja muito a mesa, e subagente. Seis perguntas, seis peças.',
      pass2: '**A pergunta, não o nome**\nA pergunta que organiza este beat não é qual o nome dessa peça, é quando essa instrução precisa valer. Sempre, em toda tarefa, a resposta é um arquivo, `CLAUDE.md` ou `AGENTS.md`, o mesmo arquivo que apareceu no beat anterior sem explicação, agora com o motivo. Às vezes, só quando o assunto aparece, a resposta é skill, como as 37 do Matt Pocock que a sala já viu. Preciso de dado real de um sistema de fora, a resposta é MCP, como o do Linear. Faltam três perguntas, e as três próximas seções respondem cada uma.\n\n**rtk: dois comandos, uma pluga**\nToda vez que ele rodar X, faz Y antes ou depois é a definição de hook, e o exemplo é o rtk. Instalar o rtk é um passo, `brew install rtk`, e traz só o binário pra sua máquina. Plugar o rtk no assistente é outro passo, `rtk init -g`, e grava o hook na configuração global da ferramenta. Depois disso, todo `git status` que você digita vira `rtk git status` por baixo, e a saída já chega filtrada na mesa antes de você ler. O primeiro comando instala a ferramenta. O segundo é o que a pluga no harness. Confundir os dois é achar que baixar o binário já liga alguma coisa.\n\n**A leitura crítica do número**\nO README do rtk promete cortar até 90% da saída de bash que o agente lê, e essa parte é verdade. O mesmo README admite duas coisas na sequência. A saída de bash é só uma fatia do que entra na mesa, ao lado do seu prompt, do system prompt e do histórico da conversa, então cortar 90% da saída de bash não vira cortar 90% da conta. E o número que o rtk mostra é estimado: ele divide bytes por 4 em vez de contar token do jeito que a cobrança conta, então a porcentagem é confiável mas o número absoluto de tokens é aproximado. Na máquina do Davi hoje, `rtk gain` mostra 164.740 comandos e 77% economizado, calculado por essa mesma conta de bytes dividido por 4. O README também anuncia 100+ comandos suportados, e `rtk --help` na mesma máquina lista 66. A ferramenta é boa e o número é honesto. Ler o número errado é que te faz esperar uma economia que não vem.\n\n**superpowers é um plugin**\nAs skills `brainstorming`, `writing-plans`, `writing-skills` e `subagent-driven-development`, que a sala conheceu soltas no beat sobre skill, vieram todas do mesmo lugar: um pacote chamado `superpowers`. A peça que empacota várias skills de uma vez é o plugin. Quero várias skills de uma vez, a resposta é plugin, e o `superpowers` instala com um único comando, `/plugin install superpowers@claude-plugins-official`, sem precisar cadastrar nenhum marketplace antes.\n\n**Subagente: mesa nova, custo novo**\nEssa parte suja muito a mesa é a última pergunta, e a resposta é subagente. Ele existe porque a mesa dele começa limpa, um contexto isolado que não carrega o histórico da sua sessão principal, então uma tarefa que gastaria a janela inteira com arquivo atrás de arquivo pode rodar lá sem lotar a sua mesa. O custo é o espelho do benefício: o subagente não viu nada do que você já viu, então alguém, no caso você, precisa escrever pra ele tudo que importa antes de mandar rodar.',
      visuals: [
        {
          kind: 'ascii',
          title: 'As seis pecas: quando a instrucao precisa valer',
          art: 'QUANDO VALE                 PECA                   EXEMPLO\nsempre, toda tarefa         CLAUDE.md / AGENTS.md  o CLAUDE.md do repo\nas vezes, tema aparece      skill                  as 37 do Matt Pocock\npreciso de dado real        MCP                    o MCP do Linear\nantes/depois de rodar X     hook                   rtk\nquero varias skills juntas  plugin                 superpowers\nessa parte suja a mesa      subagente              passo 11 do fluxo',
          caption: 'Cada linha é uma pergunta que você responde antes de decidir onde escrever a instrução.',
          board: 'Escrevo as seis perguntas numa coluna no quadro e vou riscando a peça certa conforme a sala responde comigo.',
        },
      ],
      pass3: [
        {
          gotcha: 'Instalar o rtk, brew install rtk, já liga ele no assistente.',
          note: 'Não, são dois passos. brew install rtk só traz o binário; rtk init -g é o comando que grava o hook na config global e pluga de fato no harness.',
        },
        {
          gotcha: 'Se o rtk corta 90% da saída de bash, ele corta 90% da minha conta de tokens.',
          note: 'Não. Bash output é só uma fatia do que entra na mesa, ao lado do prompt, do system prompt e do histórico. O próprio README avisa disso.',
        },
        {
          gotcha: 'O número que o rtk mostra, tipo 77% economizado, é uma contagem exata de token.',
          note: 'Não, é estimativa: ele divide bytes por 4 em vez de contar token do jeito que a cobrança conta. Confiável na porcentagem, aproximado no número absoluto.',
        },
        {
          gotcha: 'superpowers é só um nome que apareceu junto de umas skills, sem estrutura por trás.',
          note: 'É um plugin, um pacote de skills instalado de uma vez com um comando único; brainstorming, writing-plans, writing-skills e subagent-driven-development são só quatro delas.',
        },
        {
          gotcha: 'Subagente é só um jeito de rodar coisa em paralelo, sem custo nenhum.',
          note: 'Tem custo: ele começa com a mesa vazia e não viu nada da sua sessão principal. Quem manda a tarefa precisa escrever pra ele tudo que importa.',
        },
      ],
      anchor: 'Se eu pegar uma instrução qualquer que você quer dar pro seu assistente e perguntar quando ela precisa valer, sempre, às vezes, ou só quando um sistema de fora entra em cena, pra qual dessas seis peças isso aponta?',
      followup: 'Se o Hermes, no beat anterior, pode apontar pra um modelo rodando direto na sua máquina, o que exatamente está guardado nesse notebook quando isso acontece, e será que qualquer modelo deixa você baixar esse tanto de número?',
      gotcha: 'Se plugin te dá várias skills de uma vez, por que não instalar todo plugin que aparecer e deixar tudo ligado o tempo todo?',
    },
    // ──────────────── AVANÇADO · pesos abertos e grafo ────────────────
    // GLM conferido em 26/08/2026 em huggingface.co/zai-org: GLM-5.3-Flash (320B/18B) e
    // GLM-5.2 (753B), ambos MIT. O GLM-5.3 completo saiu por API antes dos pesos.
    {
      id: 'beat-09-pesos-abertos',
      label: 'Pesos abertos',
      group: 'avancado',
      beat: 9,
      tags: [
        'peso-aberto',
        'parametro',
        'quantizacao',
        'ollama',
        'licenca',
        'gguf',
      ],
      oneLine: 'Peso aberto quer dizer que você baixa os números do modelo, não que ele seja open source, licença permissiva, ou que você saiba em que dado ele treinou.',
      pass1: 'Hermes pode apontar pra um endpoint na sua própria máquina porque dá pra baixar o modelo inteiro: os pesos, os bilhões de números fixos do beat 2. Isso se chama peso aberto, e não é sinônimo de open source: quase sempre você recebe só os números, sem o dado de treino nem o código. Cada família tem sua própria licença, algumas permissivas, outras com pegadinha de escala. Pra rodar local sem virar engenheiro de infraestrutura, existe o Ollama, que baixa e serve o modelo do jeito que o Docker baixa e serve um contêiner.',
      pass2: '**Peso aberto não é open source**\n\nPeso aberto quer dizer uma coisa específica: você baixa os números fixos do modelo, os pesos do beat 2, e roda eles na sua própria máquina. Não quer dizer licença permissiva, não quer dizer uso comercial liberado, e quase nunca quer dizer que você sabe em que dado o modelo treinou. Em outubro de 2024 a OSI publicou a Open Source AI Definition, a OSAID 1.0, e a definição exige três coisas juntas: peso, dado de treino e código de treino. Quase toda família que você vai ver aqui entrega só a primeira.\n\n**O panorama de hoje**\n\nLlama 4, da Meta, usa licença própria, a Llama 4 Community License, com uma cláusula específica: empresa com mais de 700 milhões de usuários ativos mensais precisa pedir licença separada. Muse Glimmer, também da Meta, é Apache 2.0 de verdade, 30B de parâmetros (29,6B na conta exata), lançado em 10 de agosto de 2026, contexto acima de 131k, e roda em GPU de consumo quantizado em 4 bits. Qwen3.8, da Alibaba, diverge por tamanho dentro da própria família: o denso de 27B é Apache 2.0, mas o topo de linha, o Max, usa licença própria que cobra licença comercial de quem fatura acima de US$ 50 milhões. DeepSeek V4 é MIT, o mais volátil da lista, com lançamentos em julho e agosto de 2026. A família GLM, da Z.ai, também é MIT: o GLM-5.2 tem 753 bilhões de parâmetros e o GLM-5.3-Flash tem 320 bilhões no total e 18 bilhões ativos, publicado em 26 de agosto de 2026. O GLM-5.3 completo abriu por API antes de os pesos saírem, que é um padrão comum e vale notar: "vai ser aberto" e "está aberto hoje" são coisas diferentes na hora de decidir. A família Mistral Large 3 e Small 4 é Apache 2.0, a mais consistentemente permissiva do panorama. Gemma 4, do Google, também é Apache 2.0, uma virada real: Gemma 1 a 3 usavam licença própria restritiva. gpt-oss 20b e 120b, da OpenAI, são Apache 2.0, os únicos modelos abertos que a OpenAI publica. E tem o OLMo, do Ai2 (Allen Institute): Apache 2.0 mais o dado de treino mais o código de treino, publicados junto, o único da lista que atende a definição completa da OSI. Uma ressalva antes de seguir: não existe Llama 5, esse nome circula em fonte de baixa qualidade e é falso.\n\n**Parâmetro e quantização**\n\nParâmetro é quantos números o modelo tem, cada peso do beat 2 é um parâmetro. Quantização é apertar cada número pra ocupar menos memória, ao custo de o modelo ficar um pouco mais burro. Nos nomes do formato GGUF, Q4_K_M pesa cerca de 4,9 bits por peso e é o mais popular como equilíbrio, Q5_K_M fica em 5,7, Q6_K em 6,6, e Q8_0 fica em 8,5, quase sem perda. Como regra de bolso, e não como número oficial, Q4_K_M pede cerca de 0,6 GB por bilhão de parâmetro, Q8_0 pede cerca de 1,0. Um exemplo concreto: gpt-oss-20b tem 21B de parâmetros totais e 3,6B ativos por token, quantização nativa de 4 bits, e roda num laptop de 16GB segundo o blog oficial de lançamento.\n\n**Ollama, o Docker dos pesos**\n\nQuem já usou Docker vai reconhecer o padrão. Pra quem nunca usou: Docker baixa um pacote pronto pra rodar um programa e sobe ele rodando, sem você instalar nada por baixo na mão. O Ollama faz a mesma coisa com modelo. `ollama pull` baixa o pacote do modelo, `ollama run` sobe ele rodando e pronto pra responder pergunta. Existe um repositório público disso, a Ollama Library, em ollama.com/library. Por dentro, o Ollama guarda o modelo em manifest mais camadas endereçáveis por conteúdo, a mesma ideia usada pelo Docker: cada pedaço é identificado pelo próprio conteúdo, então baixar uma versão parecida não duplica tudo de novo.\n\n**Quando vale rodar local**\n\nVale quando o dado não pode sair da máquina, quando o trabalho é offline, ou quando o custo marginal de rodar de novo precisa ser zero. Não vale quando o que pesa mais é qualidade, velocidade, ou o limite menor do que ele lê de uma vez, os modelos que cabem numa máquina comum perdem pros modelos grandes de servidor nesses três pontos. Esse panorama inteiro foi conferido em 26 de agosto de 2026, direto na fonte de cada família. Ele tem validade curta de propósito: uma licença muda, um modelo novo sai, e a tabela acima envelhece rápido, e saber que ela vai envelhecer é parte do que esse beat ensina.',
      pass3: [
        {
          gotcha: 'Peso aberto é a mesma coisa que open source.',
          note: 'Não é. A OSAID da OSI exige peso, dado de treino e código juntos. Só o OLMo, da lista, entrega os três, o resto é peso aberto e para por aí.',
        },
        {
          gotcha: 'Não existe Llama 5, mas alguém pode jurar que viu.',
          note: 'O nome circula em fonte de baixa qualidade e é falso. A família mais recente confirmada é Llama 4.',
        },
        {
          gotcha: 'Toda família com selo Apache 2.0 é igualmente permissiva.',
          note: 'Qwen3.8 diverge por tamanho: o denso de 27B é Apache 2.0, mas o topo, o Max, tem licença própria que cobra empresa acima de US$ 50 milhões de faturamento. Ler a licença do modelo específico, não da família.',
        },
        {
          gotcha: 'Quantização só economiza espaço, sem custo nenhum.',
          note: 'Custa em qualidade, o modelo fica um pouco mais burro. Q4_K_M é o equilíbrio popular (cerca de 4,9 bits por peso), Q8_0 é quase sem perda mas pesa quase o dobro em memória.',
        },
        {
          gotcha: 'Rodar local é sempre a melhor opção porque é de graça.',
          note: 'O custo marginal é zero, mas troca qualidade, velocidade e quanto o modelo lê de uma vez. Vale quando o dado não pode sair da máquina ou o trabalho é offline, não como regra geral.',
        },
      ],
      anchor: 'Se dá pra baixar os pesos de um modelo pro seu notebook, o que exatamente você ganhou com esse peso aberto, e o que ainda falta pra chamar aquilo de open source de verdade?',
      followup: 'Se hoje já dá pra guardar peso, modelo e ferramenta local na sua própria máquina, o que acontece quando o que você quer guardar não é um modelo, e sim um projeto inteiro, com milhões de palavras espalhadas em milhares de arquivo, que não cabe em nenhuma mesa?',
      gotcha: 'Antes de sair baixando peso pra rodar tudo local: quantas dessas licenças você já leu de verdade, linha por linha, e sabe dizer qual delas te deixa vender o que você construiu em cima?',
    },
    {
      id: 'beat-10-grafo',
      label: 'Grafo',
      group: 'avancado',
      beat: 10,
      tags: [
        'grafo',
        'entidade',
        'relacao',
        'comunidade',
        'aresta',
        'extracted',
        'inferred',
        'ambiguous',
      ],
      oneLine: 'O contexto de um projeto inteiro vira grafo de entidade e relação, salvo entre sessões, pra IA consultar sem te obrigar a caber tudo numa mesa só.',
      pass1: 'O grafo é o topo da escada porque resolve, em escala de projeto inteiro, o problema do beat 3: em vez de guardar arquivo, você extrai entidade e relação, e a soma vira um grafo com comunidades que ninguém nomeou de propósito, elas aparecem sozinhas. Cada aresta é marcada EXTRACTED, INFERRED ou AMBIGUOUS. Isso ajuda de três jeitos: a pergunta devolve um pedaço conectado do grafo em vez de trecho solto, o grafo fica salvo entre sessões, e as comunidades mostram ligação entre partes do projeto que você nunca pensaria em perguntar.',
      pass2: '**Como funciona**\n\nEm vez de guardar arquivo, você extrai entidades (módulo, função, conceito, pessoa) e as relações entre elas. Rodando isso no corpus inteiro, sai um grafo. O algoritmo agrupa o que está densamente conectado em comunidades, e cada comunidade é um assunto que ninguém nomeou de propósito, ele apareceu sozinho. Cada aresta é marcada EXTRACTED, INFERRED ou AMBIGUOUS, então dá pra saber no que confiar.\n\n**Como ajuda**\n\nTrês coisas. A pergunta devolve um pedaço conectado do grafo em vez de trechos soltos. O grafo fica salvo, então a próxima sessão não recomeça do zero. E as comunidades mostram ligação entre partes do projeto que você nunca pensaria em perguntar, porque ninguém desenhou aquela ligação de propósito, ela emergiu do jeito que as entidades se conectaram.\n\n**Você não é quem lê aquele desenho**\n\nNinguém entende como o grafo fica depois de rodar em milhares de arquivo, e não precisa: quem consulta aquilo é a IA, você não é o consumidor daquele desenho. O `graph.html` mostra isso na prática. Seu rodapé traz 1.091 nós e 2.344 arestas, mas esse é o rollup por comunidade que o visualizador desenha, não o grafo inteiro: o `GRAPH_REPORT.md` completo tem 21.546 nós e 53.586 arestas. 21 mil nós não se desenha numa tela, por isso a ferramenta desenha as comunidades, e o resultado é proposital ilegível pra um humano ler.\n\n**Os números da máquina do Davi**\n\nRodado em 07 de agosto de 2026 sobre `~/development/neurafy/graphify-out`: 2433 arquivos de corpus, cerca de 2.991.246 palavras, virando os 21.546 nós e 53.586 arestas do parágrafo anterior, organizados em 1.091 comunidades (686 exibidas, 405 finas omitidas). Das arestas, 97% são EXTRACTED, 3% são INFERRED, com confiança média de 0,55 nas 1.624 arestas inferidas, e 0% ficaram AMBIGUOUS. O `graph.html` final pesa 1.054.564 bytes, cerca de 1 MB, e abre direto no navegador. Quase 3 milhões de palavras não cabem em nenhuma mesa do beat 3, nem perto: o grafo é a engenharia que responde exatamente a esse limite do beat 1.',
      diagramUrl: '/diagrams/vocabulario-ia/beat-10-grafo.png',
      pass3: [
        {
          gotcha: 'O grafo é só um jeito bonito de mostrar RAG.',
          note: 'RAG busca trecho por similaridade de texto solto. O grafo devolve um pedaço conectado de entidade e relação, é outro mecanismo, e essa aula não entra em RAG de propósito.',
        },
        {
          gotcha: 'Toda aresta do grafo é um fato confirmado no texto.',
          note: '97% é EXTRACTED, está escrito no arquivo, mas 3% é INFERRED, o modelo deduziu, com confiança média de 0,55 nas 1.624 arestas inferidas. INFERRED não carrega o mesmo peso de confiança que EXTRACTED.',
        },
        {
          gotcha: 'Se o desenho do grafo está ilegível, a ferramenta está quebrada.',
          note: 'É proposital. 21.546 nós não cabem numa tela, então o `graph.html` já desenha o rollup por comunidade, 1.091 nós e 2.344 arestas no rodapé. Você não é quem lê aquele desenho, é a IA que consulta.',
        },
        {
          gotcha: 'Precisa entender a estrutura inteira do grafo pra usar ele.',
          note: 'Ninguém entende como o grafo de 21.546 nós fica depois de rodar em 2433 arquivos, e não precisa: quem consulta é a IA.',
        },
        {
          gotcha: 'Um grafo grande resolve o limite de leitura só juntando tudo numa mesa maior.',
          note: 'Não junta tudo. A consulta devolve só o pedaço conectado relevante, não os quase 3 milhões de palavras do corpus inteiro de uma vez.',
        },
      ],
      anchor: 'Se um projeto tem quase 3 milhões de palavras espalhadas em 2433 arquivos e nenhuma mesa cabe isso, o que exatamente você constrói pra não perder a ligação entre as partes?',
      followup: 'Se o grafo guarda a ligação entre as partes do projeto pra IA consultar depois, o que acontece dentro de um turno só, do instante em que você aperta enter até a resposta aparecer na tela?',
      gotcha: 'Antes de achar que todo projeto precisa de grafo: rodar isso em 2433 arquivos gerou 21.546 nós que ninguém vai ler direto, então quando é que vale esse esforço e quando é overkill?',
    },
    // ──────────────── FECHAMENTO · turno, fluxo, setup ────────────────
    {
      id: 'beat-11-turno',
      label: 'Anatomia do turno',
      group: 'fechamento',
      beat: 11,
      tags: [
        'turno',
        'ciclo-do-turno',
        'compressao-de-contexto',
        'mesa-cheia',
        'contexto-sujo',
      ],
      oneLine: 'O ciclo completo entre você apertar enter e a resposta parar na tela, e cada caixa desse ciclo já tem nome porque você já viu ela antes.',
      pass1: 'Um turno é o ciclo inteiro entre você apertar enter e a resposta parar de escrever na tela, e cada caixa desse ciclo já tem nome nesta escada. Você digita, o harness monta a mesa com o system prompt dele, o seu CLAUDE.md, as skills que o assunto ativou e o histórico da conversa, o modelo devolve token atrás de token até pedir uma ferramenta, o harness executa de verdade e o resultado volta pra mesa, e o ciclo recomeça. Quando a mesa enche, alguma coisa precisa dar lugar.',
      pass2: '**A mesa se monta antes do modelo ver qualquer coisa**\n\nAntes do modelo processar uma única palavra sua, o harness já montou a mesa inteira. Primeiro entra o system prompt dele, fixo pra toda sessão. Depois entra o seu CLAUDE.md, se o projeto tiver um. Depois entram as skills que o assunto da sua mensagem ativou, cada uma como um arquivo a mais na pilha. Depois entra o histórico da conversa, tudo que já foi dito nesse turno pra trás. Só por último entra o seu texto, a última coisa a chegar na mesa antes do modelo começar a prever o próximo token.\n\n**O modelo só sabe prever o próximo token**\n\nO modelo não decide nada fora disso. Ele lê a mesa inteira e devolve token atrás de token, e de vez em quando esses tokens formam um pedido de ferramenta, um tool call. É a mesma peça do beat 4: o modelo pede, ele não executa. Quem decide se aquele pedido vira ação de verdade é o harness.\n\n**O harness executa, e um hook pode interceptar bem ali**\n\nÉ aqui que o pedido vira execução de verdade: leitura de arquivo, comando de terminal, chamada num sistema externo. É exatamente nesse ponto, entre o pedido e a execução, que um hook pode interceptar, agindo sobre o que roda de fato, do jeito que o hook do rtk reescreve um comando de shell antes dele sair do lugar.\n\n**O resultado volta pra mesa e o ciclo recomeça**\n\nO resultado da ferramenta volta pra mesa como mais uma linha de contexto, e o modelo lê a mesa de novo, agora com essa linha a mais, e decide se pede outra ferramenta ou já responde. É o loop do beat 4 rodando turno adentro, passo 3 ao passo 6, quantas vezes o critério de parada permitir.\n\n**Quando a mesa enche**\n\nSe o turno se arrasta com muita ferramenta chamada em sequência, a mesa enche antes da tarefa acabar. Sobram duas saídas: comprimir o que já está ali, resumindo o histórico pra abrir espaço, ou jogar a parte suja do trabalho pra um subagente, que abre a própria mesa vazia, faz o trabalho sujo lá e devolve só o resultado limpo pro turno principal. As duas saídas existem pelo mesmo motivo: a mesa é finita, e finita quer dizer que ela acaba enchendo.',
      diagramUrl: '/diagrams/vocabulario-ia/beat-11-turno.png',
      pass3: [
        {
          gotcha: 'Pensar que o hook intercepta o modelo.',
          note: 'O hook fica entre o pedido de ferramenta e a execução real feita pelo harness. O modelo nunca sabe que o hook existe, ele só vê o resultado que volta pra mesa.',
        },
        {
          gotcha: 'Confundir turno com sessão.',
          note: 'Turno é um ciclo só, do enter até a resposta parar. Sessão é a conversa inteira, que empilha vários turnos um atrás do outro.',
        },
        {
          gotcha: 'Achar que o modelo decide comprimir a mesa ou chamar um subagente.',
          note: 'Essa decisão é do harness, seguindo a lógica programada pra quando a mesa enche. O modelo só continua prevendo token com o que estiver na mesa naquele momento.',
        },
        {
          gotcha: 'Achar que todo turno passa pelas sete caixas inteiras.',
          note: 'Um turno sem nenhum pedido de ferramenta pula direto do passo 3 pra fora do loop: o modelo respondeu e parou, sem passar pelos passos 4, 5 e 6.',
        },
      ],
      anchor: 'Se eu apertar enter agora, quantas dessas sete caixas vão acender antes da resposta aparecer na tela?',
      followup: 'Se um turno sozinho já tem sete passos, o que muda quando alguém empilha dezenas de turnos numa rotina de trabalho real, do jeito que o próprio professor usa todo dia?',
      gotcha: 'Peça pra alguém nomear as sete caixas de cabeça, sem olhar o desenho: quase ninguém recita a sequência inteira solta, e o beat que amarra tudo é sempre o mais difícil de repetir sem o quadro na frente.',
    },
    {
      id: 'beat-12-fluxo',
      label: 'Fluxo do Davi',
      group: 'fechamento',
      beat: 12,
      tags: [
        'entrevista-antes-de-executar',
        'revisao-adversarial',
        'orquestrador',
        'implementador',
        'revisor-de-lente',
        'quatro-fases',
      ],
      oneLine: 'Os quinze passos reais do professor, divididos em quatro fases, onde a técnica mais valiosa é fazer a IA te entrevistar antes de deixar ela trabalhar.',
      pass1: 'O fluxo do Davi tem quinze passos organizados em quatro fases: Planejamento, Validação, Execução e Produção. A técnica que ele mais valoriza acontece logo na primeira fase, fazer a IA te entrevistar antes de qualquer linha de código, com /grill-me ou /superpowers:brainstorming. Na Execução, papéis diferentes usam modelos diferentes: um orquestrador, um implementador, N revisores de lentes diferentes e um revisor de segurança fixo. A regra que sustenta tudo isso é simples: o modelo certo depende da dificuldade da tarefa e da lente aplicada.',
      pass2: '**Quatro fases, quinze passos**\n\nO fluxo inteiro cabe em quatro fases: Planejamento, Validação, Execução e Produção. Planejamento é onde a tarefa ainda está sendo desenhada, antes de qualquer código. Validação confere se o desenho aguenta a realidade. Execução é onde o trabalho é feito de verdade, com os papéis certos em cada parte. Produção fecha o ciclo com revisão e entrega. O passo 2 já liga o MCP do Linear, o board real onde a tarefa vive.\n\n**A entrevista antes de executar**\n\nA técnica que o Davi considera mais valiosa é simples de descrever e difícil de pular na pressa: fazer a IA te entrevistar antes de executar qualquer coisa. Ele usa duas, /grill-me, que vem do pacote do Matt Pocock instalado no passo 2 do checklist, e /superpowers:brainstorming, do plugin instalado no passo 3. Por que funciona: as perguntas dela são uma janela pra dentro da cabeça dela. Se as perguntas aprofundam o escopo, ela entendeu o pedido. Se elas fogem do assunto, você acabou de flagrar o erro antes de gastar trabalho de verdade. É o mesmo princípio do beat 3: a entrevista enche a mesa com o que está faltando antes de gastar contexto produzindo a coisa errada.\n\n**Revisão adversarial com N lentes**\n\nDepois que o código existe, entra a revisão adversarial. O critério real é diversidade de ângulo entre os revisores: quem olha arquitetura não vê o que quem olha segurança vê, e quem olha segurança não vê o que quem olha performance vê. N revisores de lentes diferentes cobrem mais buraco do que um revisor só relendo o mesmo código duas vezes.\n\n**Quem faz o que**\n\nCada papel do fluxo usa um modelo diferente. O que manda na escolha é a dificuldade da tarefa e a lente aplicada, não o papel em si. O orquestrador, que planeja e costura o trabalho, usa Opus 5. O implementador, que escreve o código, usa GPT 5.6-luna. Os revisores usam GPT 5.6-terra ou GPT 5.6-luna, dependendo da dificuldade daquela revisão específica. A segurança é o único papel fixo: sempre GPT 5.6-Sol. A regra que importa mais que os nomes é essa: o modelo certo depende da dificuldade da tarefa e da lente que está sendo aplicada.',
      diagramUrl: '/diagrams/vocabulario-ia/beat-12-fluxo.png',
      pass3: [
        {
          gotcha: 'Achar que o orquestrador usa sempre o modelo mais caro porque manda mais.',
          note: 'A escolha segue dificuldade e lente. Um orquestrador pode planejar uma tarefa simples sem precisar do modelo mais caro pra isso.',
        },
        {
          gotcha: 'Achar que /grill-me é uma skill grande, cheia de lógica própria.',
          note: 'Ela tem 6 linhas, e o corpo inteiro é literalmente rodar uma sessão de /grilling, a skill de verdade por trás dela, com 12 linhas. Skill é arquivo, não produto.',
        },
        {
          gotcha: 'Achar que revisão adversarial melhora só empilhando mais revisor.',
          note: 'O ganho vem da diversidade de ângulo entre os revisores. Dois revisores com a mesma lente enxergam o mesmo buraco duas vezes.',
        },
        {
          gotcha: 'Achar que a segurança também varia por dificuldade, igual o resto dos papéis.',
          note: 'É o único papel fixo do fluxo: sempre GPT 5.6-Sol, independente da tarefa ser simples ou difícil.',
        },
      ],
      anchor: 'Se eu contar quantos dos quinze passos do Davi acontecem antes da primeira linha de código ser escrita, quantos sobram pra depois?',
      followup: 'Depois de ver o fluxo inteiro, se você quisesse copiar só o essencial hoje à noite, sem instalar as quinze peças de uma vez, qual seria o menor pedaço que já deixa você na frente amanhã?',
      gotcha: 'Pergunte quem acha que precisa dos quinze passos toda vez: ninguém precisa, o próprio Davi pula etapa em tarefa pequena, e o que importa é saber qual pular sem perder a entrevista do passo 1.',
    },
    {
      id: 'beat-13-setup',
      label: 'Setup mínimo',
      group: 'fechamento',
      beat: 13,
      tags: [
        'checklist',
        'instalacao-seletiva',
        'claude-code-install',
        'ollama-install',
        'tarefa-de-casa',
      ],
      oneLine: 'Oito passos pra instalar a escada inteira na sua máquina hoje à noite, cada um amarrado a um beat que você acabou de ver.',
      pass1: 'Este é o setup mínimo, e é tarefa de casa, sem mão na massa em sala hoje. A entrega é simples: um print da sua tela rodando o que você instalou. O checklist tem oito passos, do Claude Code até o Ollama, e dois deles têm uma pegadinha de ordem que já foi corrigida aqui: o instalador de skills é seletivo, então um comando do passo 6 só existe se você marcar a skill certa no passo 2, e o Ollama precisa estar instalado antes de qualquer pull.',
      pass2: '**Tarefa de casa, sem mão na massa em sala**\n\nHoje não tem hands-on. O setup inteiro fica pra você rodar depois da aula, no seu tempo, na sua máquina. A entrega é um print da tela com o resultado rodando, nada mais elaborado que isso.\n\n**O checklist, passo a passo**\n\n1. instale o Claude Code pelo caminho oficial de hoje, `curl -fsSL https://claude.ai/install.sh | bash` em mac, Linux ou WSL; `brew install --cask claude-code` e o WinGet são alternativas, e o antigo `npm i -g @anthropic-ai/claude-code` ainda funciona, mas virou opção avançada que exige Node 22 ou superior. 2. instale as skills do Matt Pocock com `npx skills@latest add mattpocock/skills`, ou pelo caminho que o próprio pacote recomenda hoje pra quem usa Claude Code, `/plugin install mattpocock-skills`; o instalador é seletivo, então marque a skill `grill-me` se quiser o passo 6 funcionando. 3. instale o plugin superpowers com `/plugin install superpowers@claude-plugins-official`, um comando só. 4. escreva um CLAUDE.md de 20 linhas pro seu projeto. 5. ligue 1 MCP, o do sistema que você mais abre no dia a dia. 6. abra toda tarefa nova com `/grill-me`; se você não marcou essa skill no passo 2, o comando não existe, e dá pra trocar por `/superpowers:brainstorming`, que já veio no passo 3. 7. instale o Ollama antes de puxar qualquer peso, com `curl -fsSL https://ollama.com/install.sh | sh` ou o instalador gráfico em ollama.com/download. 8. rode `ollama pull <modelo>` só pra ver um peso aberto rodando local na sua máquina.\n\n**Duas pegadinhas de ordem**\n\nA primeira: `/grill-me` só existe se você escolheu essa skill na instalação seletiva do passo 2, então quem pular essa marcação chega no passo 6 sem o comando. A segunda: `ollama pull` só funciona depois do Ollama instalado, e essa é a razão de o passo 7 existir separado do passo 8 aqui, mesmo quando outros checklists por aí juntam os dois num só.',
      pass3: [
        {
          gotcha: 'Instalar o Claude Code com `npm i -g @anthropic-ai/claude-code` achando que é o caminho principal.',
          note: 'Hoje isso virou opção avançada. O caminho oficial é o curl, e o npm ainda exige Node 22 ou superior pra funcionar.',
        },
        {
          gotcha: 'Rodar `/grill-me` sem ter marcado a skill no passo 2.',
          note: 'O instalador é seletivo. Sem marcar `grill-me` na hora de instalar, o comando simplesmente não existe depois, mesmo com o pacote inteiro instalado.',
        },
        {
          gotcha: 'Rodar `ollama pull` achando que ele instala o Ollama sozinho.',
          note: 'O pull baixa o modelo, não o programa. Sem o Ollama instalado antes, com o curl ou o instalador gráfico, o pull não tem em que rodar.',
        },
        {
          gotcha: 'Achar que `npx skills@latest add mattpocock/skills` é a única forma de instalar.',
          note: 'O pacote hoje recomenda outro caminho pra quem já usa Claude Code, `/plugin install mattpocock-skills`, sem precisar do npx.',
        },
      ],
      anchor: 'Se eu fizer os oito passos desse checklist hoje à noite, o que já muda na minha primeira tarefa real amanhã?',
      followup: 'Depois de instalado tudo isso, o que continua sendo verdade em toda ferramenta, arquivo e peça que essa escada nomeou, do token lá embaixo até o grafo lá em cima?',
      gotcha: 'Pergunte quem já tem o Claude Code instalado agora: boa parte da sala vai levantar a mão sem nunca ter marcado `grill-me` no instalador seletivo, e essa é a pegadinha viva do passo 6.',
    },
    // ──────────────── SÍNTESE ────────────────
    {
      id: 'sintese',
      label: 'A frase pra levar',
      group: 'synthesis',
      oneLine: 'Modelo e harness são coisas diferentes, e quase todo problema com IA é contexto faltando ou contexto sobrando.',
      pass1: 'A escada inteira sustenta duas ideias. A primeira: modelo é uma coisa, harness é outra, e quase toda confusão sobre IA vem de tratar os dois como se fossem o mesmo produto. A segunda: quase todo problema real com IA é contexto faltando ou contexto sobrando, e cada peça que você viu aqui, skill, MCP, hook, plugin, subagente, grafo, existe pra responder essa mesma pergunta de um jeito diferente. Aprender o nome certo da peça é aprender qual decisão ela habilita.',
      pass2: '**Modelo e harness não são a mesma coisa**\n\nO modelo é o previsor de token, um monte de pesos fixos que não guarda nada de uma sessão pra outra. O harness é o programa que roda o loop em volta dele: monta a mesa, executa o pedido de ferramenta, decide quando comprimir. Hermes prova isso melhor que qualquer slide, porque é nome de harness e nome de família de modelo ao mesmo tempo, os dois da Nous Research. Saber separar qual é qual, na hora, é o teste de verdade de que você entendeu a diferença.\n\n**Contexto faltando ou contexto sobrando**\n\nQuase todo problema prático com IA cai numa dessas duas caixas. Contexto faltando é o modelo respondendo sem saber o que você sabe, e skill e MCP existem pra resolver isso, um trazendo instrução sob demanda, o outro trazendo dado e sistema real. Contexto sobrando é a mesa enchendo até parar de caber o que importa, e hook, plugin, subagente e grafo existem pra resolver isso de formas diferentes: filtrando o que entra, empacotando o que se repete, isolando o trabalho sujo numa mesa própria, ou guardando o projeto inteiro fora da mesa, num grafo que a IA consulta sob demanda.\n\n**A pergunta que sobra depois da aula**\n\nToda peça nova de IA que aparecer depois de hoje carrega as duas mesmas perguntas. Isso é modelo ou é harness? Isso resolve mesa vazia ou mesa cheia? Quem sabe responder as duas já sabe onde encaixar a peça nova sem precisar decorar o nome dela primeiro.',
      pass3: [
        {
          gotcha: 'Achar que aprender mais nome de ferramenta é aprender mais sobre IA.',
          note: 'É vocabulário de mecanismo. O nome novo só importa se ele muda uma decisão que você toma.',
        },
        {
          gotcha: 'Achar que harness mais caro é sempre harness melhor.',
          note: 'A pergunta certa é o que aquele harness deixa você plugar, e onde o dado mora enquanto ele roda.',
        },
        {
          gotcha: 'Achar que resolver mesa cheia é sempre comprimir.',
          note: 'Às vezes é subagente, às vezes é grafo, às vezes é simplesmente não colocar aquilo na mesa desde o início.',
        },
        {
          gotcha: 'Achar que peso aberto resolve o problema de contexto sozinho.',
          note: 'Peso aberto muda onde o modelo roda. Mesa cheia ou vazia é um eixo separado, resolvido por peças diferentes.',
        },
      ],
      anchor: 'Se eu perguntar qual peça dessa escada resolve mesa vazia e qual resolve mesa cheia, você consegue separar as seis numa lista rápida agora?',
      followup: 'Da próxima vez que uma ferramenta de IA prometer alguma coisa nova, qual das duas perguntas dessa aula você vai fazer primeiro, isso é modelo ou harness, ou isso resolve mesa vazia ou mesa cheia?',
      gotcha: 'Pergunte quem consegue explicar peso aberto pra alguém de fora da aula numa frase só, sem usar nenhum termo em inglês: quase impossível, e isso mostra o quanto vocabulário técnico carrega decisão junto.',
    },
  ],

  glossary: [
    {
      title: 'Fundamentos',
      terms: [
        { term: 'token', definition: 'O pedaço de texto que o modelo lê e escreve. Não é palavra e não é letra: "morango" são 2 tokens e "strawberry" são 3. É a unidade do custo, da velocidade e do limite.' },
        { term: 'modelo', definition: 'Um previsor do próximo token, um de cada vez. Não executa nada e não guarda memória de uma conversa para a outra.' },
        { term: 'pesos', definition: 'Os números fixos que formam o modelo, bilhões deles. Treinar é achar esses números, e usar o modelo é só fazer conta com eles.' },
        { term: 'família de modelos', definition: 'A mesma linha em tamanhos diferentes, do leve e barato ao capaz e caro. O que manda na escolha é a dificuldade da tarefa.' },
        { term: 'contexto', definition: 'Tudo que o modelo enxerga de uma vez num turno: instruções do sistema, histórico, arquivos que entraram, resultado de ferramenta e o seu texto.' },
        { term: 'janela de contexto', definition: 'O tamanho máximo desse "tudo de uma vez". Quando enche, o começo some ou é comprimido.' },
        { term: 'sessão', definition: 'A conversa inteira, do primeiro ao último turno. Sessão nova começa com a mesa limpa.' },
        { term: 'turno', definition: 'Uma rodada: você manda, ele responde. O contexto é remontado do zero a cada turno.' },
        { term: 'alucinação', definition: 'Resposta plausível e errada. É consequência direta de prever o provável, não um defeito que dá para desligar.' },
        { term: 'prompt', definition: 'O texto que você põe na mesa. É a única parte do contexto que você escreve diretamente.' },
        { term: 'PTCF', definition: 'A anatomia de um pedido: Persona, Task, Context, Format. Quem você quer que ele seja, o que fazer, com que informação, e em que formato entregar.' },
      ],
    },
    {
      title: 'Ferramentas',
      terms: [
        { term: 'agente', definition: 'O modelo dentro de um loop que executa. A diferença entre sugerir e fazer mora aqui.' },
        { term: 'loop', definition: 'Recebe o contexto, devolve texto, parte do texto é um pedido de ferramenta, alguém executa, o resultado volta e repete. Decidir parar é a parte difícil.' },
        { term: 'ferramenta', definition: 'Uma ação que o modelo pode pedir: rodar um comando, ler um arquivo, chamar uma API. Ele pede, e quem executa é outro.' },
        { term: 'skill', definition: 'Um arquivo markdown com instrução, carregado só quando o assunto aparece. O campo description é a única parte lida sempre, e é ela que decide se a skill entra.' },
        { term: 'MCP', definition: 'O protocolo que liga o agente a um sistema externo e expõe as ferramentas e os dados dele. Skill é o como fazer, MCP é de onde vem o dado.' },
        { term: 'harness', definition: 'O programa que roda o loop: monta o contexto, oferece o catálogo de ferramentas, executa o que foi pedido e decide o que fazer quando a janela enche.' },
        { term: 'system prompt', definition: 'A instrução que o harness põe na frente de tudo, a cada turno. Quem escreve é ele, não você.' },
        { term: 'CLAUDE.md', definition: 'O arquivo de instrução do projeto no Claude Code. Vale sempre, em toda tarefa daquele repositório.' },
        { term: 'AGENTS.md', definition: 'O mesmo papel no Codex e no Hermes Agent. Nome diferente, função igual.' },
        { term: 'hook', definition: 'Código que intercepta uma ação do agente antes ou depois dela rodar. O rtk usa isso para reescrever o comando e encolher a saída antes de ela chegar no contexto.' },
        { term: 'plugin', definition: 'Um pacote que instala várias skills de uma vez. O superpowers traz 14 numa instalação só.' },
        { term: 'subagente', definition: 'Um agente disparado com contexto isolado, para a parte que sujaria muito a mesa. A mesa dele começa limpa, e é por isso que ele precisa receber tudo que importa.' },
      ],
    },
    {
      title: 'Avançado',
      terms: [
        { term: 'parâmetro', definition: 'Cada um dos números do modelo. "20B" quer dizer 20 bilhões deles, e é o que determina o tamanho do arquivo e a memória que ele pede.' },
        { term: 'peso aberto', definition: 'O laboratório publica os números para você baixar. Não implica licença permissiva, não implica uso comercial liberado, e quase nunca implica saber em que dado ele treinou.' },
        { term: 'open source de verdade', definition: 'Pesos mais dado de treino mais código, pela definição da OSI. Quase nenhum modelo aberto atende: o OLMo, do Ai2, é o contraexemplo que atende.' },
        { term: 'quantização', definition: 'Apertar cada número do modelo para ocupar menos memória, ao custo de ficar um pouco mais burro. Q4_K_M é o equilíbrio mais usado.' },
        { term: 'ollama', definition: 'A ferramenta que baixa e roda modelo aberto na sua máquina. Quem já usou Docker reconhece o padrão: ollama pull está para docker pull, e a Ollama Library está para o registry público.' },
        { term: 'grafo de conhecimento', definition: 'Em vez de guardar arquivo, você guarda entidades e as relações entre elas. A pergunta devolve um pedaço conectado, e o grafo fica salvo entre sessões.' },
        { term: 'comunidade', definition: 'Um agrupamento de nós densamente conectados que o algoritmo acha sozinho. Cada uma é um assunto que ninguém nomeou de propósito.' },
        { term: 'EXTRACTED', definition: 'A marca da aresta que está escrita no arquivo. É o que foi encontrado, não deduzido.' },
        { term: 'INFERRED', definition: 'A marca da aresta que o modelo deduziu. No grafo de 53.586 arestas do exemplo, são 3% delas.' },
        { term: 'AMBIGUOUS', definition: 'A terceira marca, para a relação que ficou em dúvida. É ter esses três rótulos que permite saber no que confiar.' },
      ],
    },
  ],
};

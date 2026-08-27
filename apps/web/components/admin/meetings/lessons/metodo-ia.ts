import type { Lesson } from '../lesson-types';

export const metodoIa: Lesson = {
  slug: 'metodo-ia',
  title: 'Método com IA',
  subtitle:
    'Cinco passos que fazem a IA acertar mais vezes de primeira, mais o MCP que traz o dado sozinho.',
  blurb:
    'Uma aula para quem já usa Claude Code, Codex e Cursor todo dia e usa no braço. O eixo é parar de refazer, e não melhorar a forma do código. Abre medindo o custo real de descrever a tarefa em duas linhas, o modelo completa o resto com o palpite dele, e quando o palpite está errado você só descobre com o trabalho pronto. Daí vêm cinco passos que atacam esse mesmo custo. A entrevista antes de executar, com /grill-me, onde as perguntas do modelo mostram em trinta segundos o que ele entendeu. A mesma entrevista com /grill-with-docs, que deixa a decisão escrita sem ninguém parar para documentar. O plano separado do fazer, porque revisar vinte linhas de plano é barato e revisar seiscentas linhas prontas é caro. O subagente, que roda o próprio loop com contexto limpo e permite atacar tarefas independentes ao mesmo tempo. E a revisão adversarial, com revisores de lentes diferentes, que acha o que quebra sem exigir que você passe a se importar com qualidade. Fecha em MCP, com o mcp-brasil e as setenta fontes públicas que entram direto numa análise: DataJud e STF para litígio, BNDES para dívida, CVM, PNCP e Portal da Transparência para empresa que vive de contrato público.',
  durationMin: 60,
  audience: 'Time que já usa Claude Code, Codex e Cursor',
  slidesUrl: '/slides/metodo-ia.html',
  nodes: [
    // ──────────────── FUNDAÇÃO (study-only) ────────────────
    {
      id: 'f-pedido-curto',
      label: 'Pedido curto, tarefa longa',
      group: 'foundations',
      teachFromZero: true,
      diagramUrl: '/diagrams/metodo-ia/retrabalho.drawio.png',
      oneLine:
        'Descrever a tarefa em duas linhas e deixar o modelo completar o resto funciona até a tarefa crescer, e o que quebra não é a ferramenta.',
      pass1:
        'O jeito mais rápido de usar Claude Code, Codex ou Cursor é abrir, escrever duas linhas do que você quer e deixar rodar. Funciona bem em tarefa pequena e é por isso que todo mundo faz assim. O problema aparece quando a tarefa cresce: você descreveu 20% do que queria, o modelo preencheu os outros 80% com o palpite dele, e você só descobre qual foi o palpite quando o trabalho está pronto. Se o palpite estava errado, o custo não foi o prompt, foi o tempo até você perceber.',
      pass2:
        '**Onde exatamente quebra**\n\nUm pedido curto não é um pedido incompleto do ponto de vista do modelo. Ele sempre completa. Toda lacuna que você deixou vira uma escolha que alguém fez, e nesse caso foi ele. Em tarefa de 5 minutos isso é irrelevante, porque ler o resultado custa menos que especificar. Em tarefa de uma hora, cada lacuna é uma aposta que você fez sem saber que estava apostando.\n\n**Qualidade e retrabalho são problemas diferentes**\n\nEssa aula não vai pedir para você se importar mais com o código. Se o que você produz funciona e resolve, ótimo. O que ela ataca é outra coisa: a quantidade de vezes que você refaz porque o resultado não era o que você queria. Esses dois problemas parecem o mesmo e não são, e é por isso que conselho de qualidade costuma não colar em quem trabalha rápido.\n\n**Cinco passos, um alvo só**\n\nOs cinco degraus daqui em diante atacam o mesmo alvo por ângulos diferentes: descobrir o mal-entendido antes de gastar o trabalho, deixar a decisão registrada sem parar para documentar, revisar o barato em vez do caro, paralelizar o que é independente, e achar o que quebra sem depender da sua atenção. Nenhum deles pede que você mude a velocidade com que trabalha.\n\n**O que não muda**\n\nContinua sendo você quem decide o que vale a pena fazer, e continua sendo você quem assina o resultado. Nenhum passo aqui transfere julgamento para a máquina, e nenhum deles funciona se você não souber dizer o que quer.',
      pass3: [
        {
          gotcha: 'Prompt curto é prompt ruim.',
          note: 'Não é. Em tarefa pequena o prompt curto é o certo, porque ler o resultado é mais barato do que especificar. O que muda a conta é o tamanho da tarefa, não o tamanho do prompt.',
        },
        {
          gotcha: 'O problema é o modelo ser burro.',
          note: 'O modelo completa a lacuna com o mais provável, e o mais provável no geral não é o mais provável no seu caso. Trocar por um modelo melhor reduz a taxa de erro, não elimina a lacuna.',
        },
        {
          gotcha: 'Se eu escrever um prompt gigante, resolve.',
          note: 'Prompt gigante escrito de uma vez continua tendo lacuna, porque você não sabe quais lacunas deixou. É justamente isso que a entrevista do próximo passo resolve, e por isso ela funciona melhor que um prompt longo.',
        },
        {
          gotcha: 'Isso só vale para código.',
          note: 'Vale para qualquer tarefa longa: análise de documento, pesquisa, extração. O que importa é a proporção entre o que você especificou e o que o modelo completou sozinho.',
        },
      ],
      anchor:
        'Pensa na última vez que você teve que mandar a IA refazer do zero. Em que momento ficou claro que ela tinha entendido outra coisa, e quanto trabalho já tinha sido feito até ali?',
      followup:
        'Se o problema é descobrir tarde demais o que ele entendeu, existe algum jeito de ver isso antes de ele começar a trabalhar?',
      gotcha:
        'Se a sala disser que isso não acontece com eles, pergunte quantas vezes na última semana começaram uma conversa nova porque a anterior tinha ido pro lado errado. Conversa nova por engano é retrabalho com outro nome.',
    },

    // ──────────────── ANTES DE EXECUTAR ────────────────
    {
      id: 'beat-01-grill-me',
      label: 'A entrevista antes',
      group: 'antes',
      beat: 1,
      teachFromZero: true,
      tags: ['grill-me', 'grilling', 'entrevista', 'retrabalho', 'skill'],
      oneLine:
        'Fazer o modelo te entrevistar antes de executar mostra em trinta segundos o que ele entendeu, em vez de em quarenta minutos.',
      pass1:
        'Existe um comando que inverte a ordem: em vez de você descrever e ele executar, ele te entrevista primeiro, uma pergunta por vez, até vocês dois estarem falando da mesma coisa. Chama `/grill-me`. O ganho não está nas respostas que você dá, está nas perguntas que ele faz: elas são a leitura mais direta que existe do que ele entendeu. Pergunta que aprofunda o escopo quer dizer que ele pegou. Pergunta que foge quer dizer que você achou o mal-entendido antes de gastar o trabalho.',
      pass2:
        '**Como funciona na prática**\n\nVocê descreve a tarefa como descreveria normalmente, do jeito curto mesmo, e roda `/grill-me`. Em vez de sair fazendo, ele começa a perguntar. Uma por vez, esperando resposta, resolvendo as dependências entre as decisões em ordem. Para cada pergunta ele já sugere a resposta que acha certa, então na maioria das vezes você só confirma.\n\n**Por que as perguntas valem mais que as respostas**\n\nUm modelo que entendeu a tarefa faz pergunta de detalhe: qual caso de borda importa, o que fazer quando o dado vem vazio, qual das duas leituras do requisito vale. Um modelo que não entendeu faz pergunta de fundação, e você percebe na primeira. Ler três perguntas custa trinta segundos. Ler o resultado de quarenta minutos de trabalho errado custa quarenta minutos mais o tempo de refazer.\n\n**O custo real**\n\nA entrevista leva de três a dez minutos, dependendo do tamanho da coisa. Em tarefa de meia hora, isso raramente compensa. Em tarefa de meio dia, compensa quase sempre. O que decide é o tempo até você conseguir avaliar o resultado: quanto mais longe estiver esse momento, mais a entrevista paga.\n\n**Ela é um arquivo, não um produto**\n\n`/grill-me` tem seis linhas, e o corpo dele é literalmente uma linha mandando rodar a skill `grilling`, que por sua vez tem doze. Ninguém construiu um produto para isso. É markdown num arquivo, e é por isso que dá para ler, mudar e escrever a sua versão em dez minutos.',
      pass3: [
        {
          gotcha: 'Responder tudo com "tanto faz" para acelerar.',
          note: 'Quando você responde tanto faz, quem decide é ele, e você voltou pro pedido curto com dez minutos a mais gastos. Se a resposta é realmente indiferente, diga por que, porque isso também é informação.',
        },
        {
          gotcha: 'Rodar a entrevista e depois abrir conversa nova para executar.',
          note: 'A entrevista inteira estava no contexto daquela conversa. Conversa nova começa sem nada disso, e você jogou fora o que acabou de construir. Execute na mesma conversa, ou peça o resumo escrito antes de sair.',
        },
        {
          gotcha: 'Usar em tarefa pequena.',
          note: 'Em tarefa de cinco minutos a entrevista custa mais que o retrabalho que ela evita. Ela paga quando o tempo até você conseguir avaliar o resultado é longo.',
        },
        {
          gotcha: 'Achar que perguntas boas garantem execução boa.',
          note: 'A entrevista resolve o mal-entendido, e mal-entendido é só uma das causas de resultado ruim. Ele ainda pode entender certo e executar mal, e é para isso que servem os passos de revisão mais adiante.',
        },
      ],
      anchor:
        'Você pede uma análise que vai levar meio dia. Antes de ele começar, ele te faz três perguntas. Quais três perguntas te fariam confiar que ele entendeu, e quais te fariam parar tudo na hora?',
      followup:
        'A entrevista alinha vocês dois naquele momento. Uma semana depois, quando outra pessoa mexer nisso, o que sobrou daquele alinhamento?',
      gotcha:
        'Se alguém disser que já faz isso escrevendo prompt longo, devolva: prompt longo é você adivinhando quais lacunas deixou. A entrevista é ele te dizendo quais lacunas ele encontrou. São informações diferentes.',
    },
    {
      id: 'beat-02-grill-with-docs',
      label: 'A entrevista que deixa registro',
      group: 'antes',
      beat: 2,
      tags: ['grill-with-docs', 'adr', 'glossario', 'domain-modeling', 'registro'],
      oneLine:
        'A mesma entrevista, com a decisão saindo escrita no fim, sem ninguém ter parado para documentar.',
      pass1:
        'Existe uma segunda versão do mesmo comando, `/grill-with-docs`. Ela roda a entrevista igual, e no fim grava o que foi decidido: os registros de decisão e o glossário dos termos que vocês usaram. A diferença importa quando outra pessoa vai mexer no que você fez, ou quando você mesmo vai voltar dali a três semanas. O registro sai como subproduto da conversa que você já ia ter, não como uma tarefa a mais no fim.',
      pass2:
        '**O que ela grava**\n\nDois artefatos. O primeiro é um registro de decisão: qual escolha foi feita, quais alternativas existiam e por que essa ganhou. O segundo é um glossário: os termos do domínio que apareceram na conversa, cada um com a definição que vocês combinaram naquele momento. Os dois saem do que já foi dito na entrevista.\n\n**Por que isso importa em time que trabalha rápido**\n\nDocumentação não pega em time rápido porque ela é sempre uma tarefa a mais, feita depois, por alguém que já resolveu o problema e não tem mais interesse nele. Aqui ela não é uma tarefa: é o resíduo de uma conversa que aconteceu de qualquer jeito. O custo marginal de gravar é próximo de zero, e é isso que muda a conta.\n\n**Quando usar qual**\n\nUse `/grill-me` quando a tarefa é sua, você vai executar agora e ninguém mais precisa entender a decisão. Use `/grill-with-docs` quando outra pessoa vai mexer depois, quando a decisão vai ser questionada, ou quando duas pessoas do time usam a mesma palavra para coisas diferentes sem ter percebido.\n\n**O glossário resolve um problema específico**\n\nDuas pessoas do time podem usar a mesma palavra para coisas diferentes sem nunca ter notado, e aí todo pedido que vocês fazem para a IA carrega essa ambiguidade sem ninguém ver. O glossário não é enfeite: ele é o que faz o próximo pedido ser entendido do mesmo jeito pelas duas pessoas e pela máquina.',
      pass3: [
        {
          gotcha: 'Achar que gerar documento é o objetivo.',
          note: 'O objetivo é a decisão ficar registrada no momento em que ela é tomada, com o motivo junto. Documento sem o motivo da escolha é quase inútil três semanas depois, porque o que você esquece primeiro é por que descartou a outra opção.',
        },
        {
          gotcha: 'Usar sempre, em toda tarefa.',
          note: 'Registro de decisão para tarefa que ninguém vai revisitar é trabalho jogado fora, e pior, enterra os registros que importam no meio dos que não importam.',
        },
        {
          gotcha: 'Confiar no glossário sem ler.',
          note: 'Ele grava a definição que vocês combinaram na conversa, não a definição correta do domínio. Se alguém definiu errado durante a entrevista, o erro fica gravado com cara de oficial.',
        },
      ],
      anchor:
        'Três semanas depois, outra pessoa do time pega o que você fez e pergunta por que você escolheu daquele jeito. O que existe hoje, no seu fluxo, que responde isso sem depender da sua memória?',
      followup:
        'A entrevista alinha o que vai ser feito. O que garante que a execução siga o que foi alinhado, em vez de ele sair fazendo à moda dele de novo?',
      gotcha:
        'Se a sala disser que documentação não serve para nada, concorde em parte: documentação escrita depois, por obrigação, realmente não serve. Aí pergunte qual é a objeção ao registro que sai de graça de uma conversa que já ia acontecer.',
    },
    {
      id: 'beat-03-plano',
      label: 'O plano separado do fazer',
      group: 'antes',
      beat: 3,
      tags: ['superpowers', 'plugin', 'brainstorming', 'writing-plans', 'plano'],
      oneLine:
        'Revisar vinte linhas de plano custa dois minutos, e revisar seiscentas linhas prontas custa a tarde inteira.',
      pass1:
        'O `superpowers` é um plugin, instalado com um comando só, que traz catorze skills. Duas delas montam este passo: `brainstorming`, que explora o problema antes de qualquer construção, e `writing-plans`, que transforma o que foi explorado num plano escrito. O plano é curto de propósito, feito para ser lido em dois minutos. E é aí que está o ganho: você corrige o rumo no momento em que corrigir é barato, em vez de no momento em que já existe trabalho pronto para jogar fora.',
      pass2:
        '**A economia é assimétrica**\n\nCorrigir um plano de vinte linhas custa dois minutos e nenhum apego. Corrigir seiscentas linhas que já foram escritas custa a tarde, e custa também a resistência natural de jogar fora algo que já existe. Essa assimetria é a razão inteira do passo, e ela não depende de você se importar com a qualidade do que sai.\n\n**Onde ele encaixa**\n\nDepois da entrevista e antes da execução. A entrevista alinha o que é para fazer, o plano fixa como vai ser feito e em que ordem. Um plano escrito também é o único artefato que dá para passar para outra pessoa ou para outra sessão sem levar junto a conversa inteira.\n\n**O que instalar**\n\nO comando é `/plugin install superpowers@claude-plugins-official`, um só, sem precisar adicionar marketplace antes. Ele traz catorze skills, entre elas `brainstorming`, `writing-plans`, `executing-plans` e `subagent-driven-development`, que é o assunto do próximo passo.\n\n**O erro comum**\n\nGerar o plano e não ler. O passo inteiro existe para você gastar dois minutos lendo. Plano gerado e aprovado no automático é o mesmo pedido curto, com uma etapa a mais e a mesma taxa de erro, o que é pior do que não ter feito.',
      pass3: [
        {
          gotcha: 'Aprovar o plano sem ler.',
          note: 'O valor do passo está inteiro nos dois minutos de leitura. Plano aprovado no automático adiciona etapa sem reduzir retrabalho, e ainda te dá a sensação falsa de ter checado.',
        },
        {
          gotcha: 'Plano longo é plano melhor.',
          note: 'Plano que você não lê não vale nada, e plano de cem linhas ninguém lê. Se o plano ficou grande, normalmente é sinal de que a tarefa devia ser quebrada, não de que o plano devia ser resumido.',
        },
        {
          gotcha: 'Pular a exploração e pedir o plano direto.',
          note: 'O plano herda as decisões da exploração. Pedir plano sem explorar produz um plano bem formatado em cima do primeiro palpite, que é o mesmo problema do pedido curto com uma camada de organização por cima.',
        },
        {
          gotcha: 'Achar que plano trava mudança de ideia.',
          note: 'Mudar o plano é barato justamente porque ele é curto. O que trava mudança de ideia é trabalho já feito, não plano escrito.',
        },
      ],
      anchor:
        'Você tem duas opções de revisão: ler vinte linhas descrevendo o que vai ser feito, ou ler seiscentas linhas do que já foi feito. Em qual das duas você tem chance real de pegar um erro de direção?',
      followup:
        'O plano está escrito e tem seis tarefas que não dependem uma da outra. Existe motivo para executar as seis em fila?',
      gotcha:
        'Se alguém disser que plano é burocracia, pergunte quanto tempo custou o último retrabalho grande e se dois minutos de leitura teriam pegado a causa.',
    },

    // ──────────────── EXECUTANDO ────────────────
    {
      id: 'beat-04-subagente',
      label: 'Subagente',
      group: 'executando',
      beat: 4,
      diagramUrl: '/diagrams/metodo-ia/loop.drawio.png',
      tags: ['subagente', 'loop', 'contexto-isolado', 'paralelismo', 'briefing'],
      oneLine:
        'Um agente disparado com contexto limpo, rodando o próprio loop, que devolve só a conclusão em vez do caminho inteiro.',
      pass1:
        'Subagente é um agente que você dispara de dentro do seu, com contexto próprio e limpo. Ele roda o loop dele sozinho, recebe uma tarefa, decide um passo, executa, olha o resultado, decide o próximo, até terminar, e volta com a conclusão em vez do caminho inteiro. Duas coisas vêm disso: a parte que sujaria muito a sua conversa acontece fora dela, e tarefas que não dependem uma da outra rodam ao mesmo tempo em vez de em fila.',
      pass2:
        '**O loop, que é o mecanismo por baixo**\n\nUm agente não responde uma vez e para. Ele recebe o contexto, devolve texto, e parte desse texto é um pedido de ferramenta: rodar um comando, abrir um arquivo, chamar uma API. Alguém executa esse pedido de verdade, o resultado volta para o contexto, e ele decide o próximo passo com o resultado já dentro. Repete até concluir. Cada subagente roda esse ciclo inteiro por conta própria.\n\n**O ganho de contexto**\n\nLer trinta arquivos para achar uma coisa enche o contexto de vinte e nove arquivos irrelevantes, e contexto cheio de coisa irrelevante piora a resposta seguinte. Mandando isso para um subagente, o custo fica na conversa dele: ele lê os trinta e volta com uma frase. A sua conversa recebe a frase.\n\n**O ganho de tempo**\n\nSeis tarefas independentes em fila levam a soma dos seis tempos. As mesmas seis em subagentes levam o tempo da mais lenta. Para trabalho que já é rápido e sujo, esse é o passo que mais devolve tempo, e ele não pede nenhuma mudança no cuidado com o resultado.\n\n**O custo, que é real**\n\nO contexto dele começa vazio. Ele não viu a sua conversa, não sabe o que vocês combinaram, não conhece a convenção do projeto. Subagente mal briefado devolve trabalho errado com a mesma confiança de um bem briefado. Tudo que importa precisa entrar no pedido, e é por isso que o plano escrito do passo anterior é o que torna este passo prático: o briefing já existe.',
      pass3: [
        {
          gotcha: 'Paralelizar tarefa que depende de outra.',
          note: 'Se a tarefa B precisa do resultado de A, dois subagentes ao mesmo tempo produzem B em cima de um palpite. Paralelismo só vale sobre trabalho genuinamente independente.',
        },
        {
          gotcha: 'Briefing curto porque o subagente é esperto.',
          note: 'Ele é tão esperto quanto o principal e sabe muito menos, porque não viu nada do que você viu. A esperteza dele não compensa a informação que faltou.',
        },
        {
          gotcha: 'Disparar muitos e não ler nenhum.',
          note: 'Cada um volta com uma conclusão que parece pronta. Seis conclusões não lidas é seis vezes o risco de uma, e sai mais caro que ter feito em fila.',
        },
        {
          gotcha: 'Confundir subagente com modelo mais fraco.',
          note: 'Não é uma questão de tamanho de modelo. O que define subagente é o contexto isolado e o loop próprio, e ele pode rodar no mesmo modelo do principal.',
        },
      ],
      anchor:
        'Seu plano tem seis tarefas e nenhuma depende do resultado da outra. Você dispara seis subagentes. O que precisa estar escrito no pedido de cada um para a conclusão dele servir?',
      followup:
        'Os seis voltaram com a tarefa feita e todos parecem confiantes. O que, no seu fluxo hoje, olha esse resultado antes de você?',
      gotcha:
        'Se a sala achar que é só velocidade, devolva: o subagente que não recebeu contexto suficiente devolve trabalho errado no mesmo tempo em que devolveria o certo. Velocidade sem briefing multiplica erro em vez de trabalho.',
    },
    {
      id: 'beat-05-adversarial',
      label: 'Revisão adversarial',
      group: 'executando',
      beat: 5,
      tags: ['revisao-adversarial', 'lentes', 'verificacao', 'falso-positivo'],
      oneLine:
        'Vários revisores com lentes diferentes olhando a mesma coisa, cada um procurando o tipo de falha que os outros não enxergam.',
      pass1:
        'Depois que o trabalho está feito, você dispara revisores com mandato de achar defeito. O ponto não é quantidade, é ângulo: quem está olhando arquitetura não enxerga o que quem está olhando segurança enxerga, e quem procura caso de borda não procura a mesma coisa que quem procura desempenho. Rodar cinco revisores com a mesma lente devolve cinco vezes o mesmo achado. Rodar cinco com lentes diferentes cobre cinco superfícies. Este é o passo que acha o que quebra sem exigir que você passe a se importar com qualidade.',
      pass2:
        '**Por que a lente importa mais que o número**\n\nUm revisor sem lente definida procura o defeito mais óbvio, e o mais óbvio é o mesmo para todos. Dando a cada um um mandato específico, você força cobertura em vez de repetição. É a mesma lógica de mandar duas pessoas diferentes lerem um contrato: se as duas leem procurando a mesma coisa, a segunda não acrescenta nada.\n\n**Por que combina com trabalho rápido**\n\nEste passo não pede que você mude nada no jeito que produz. Você continua rápido e continua sem se importar com a forma do que sai. O que muda é que existe uma etapa depois, automática, cujo trabalho inteiro é achar onde aquilo quebra. Você continua produzindo do mesmo jeito, e passa a saber onde vai doer.\n\n**O falso positivo faz parte**\n\nRevisor com mandato de achar defeito acha defeito, inclusive onde não tem. Isso é esperado, e é o custo do formato. O que resolve é uma segunda passada que tenta refutar cada achado antes de você olhar, para que o que chega até você já tenha sobrevivido a alguém tentando derrubar.\n\n**Separar o que é defeito do que é decisão**\n\nParte do que a revisão levanta não é erro, é escolha que dava para fazer diferente. Misturar as duas coisas transforma a revisão numa lista de opinião que ninguém lê. Defeito é o que quebra e precisa de correção. Decisão é o que precisa de alguém para responder, e esse alguém é você.',
      pass3: [
        {
          gotcha: 'Mais revisores é sempre melhor.',
          note: 'Sem lentes distintas, o segundo revisor devolve o achado do primeiro. O que aumenta cobertura é diversidade de ângulo, e ela satura: passado certo ponto você paga sem receber superfície nova.',
        },
        {
          gotcha: 'Tratar todo achado como bug.',
          note: 'Revisor com mandato de achar defeito produz falso positivo por construção. Sem uma etapa que tente refutar cada achado, você troca retrabalho de execução por retrabalho de triagem.',
        },
        {
          gotcha: 'Rodar revisão adversarial em tudo.',
          note: 'Custa tempo e atenção. Ela paga onde o erro é caro: coisa que vai para produção, coisa que outra pessoa vai usar, coisa que mexe com dado sensível. Script que você roda uma vez e joga fora não precisa.',
        },
        {
          gotcha: 'Revisão substitui teste.',
          note: 'Revisão lê e opina, teste executa e falha. Um revisor pode aprovar código que não roda, e roda muito rápido para você não notar.',
        },
      ],
      anchor:
        'Você vai mandar três revisores olharem o mesmo trabalho. Que mandato você dá para cada um, sabendo que dois com o mesmo mandato devolvem o mesmo achado?',
      followup:
        'Todos esses passos melhoram o que a IA faz com o que ela já tem. E quando o que falta não é método, é o dado que ela não tem acesso?',
      gotcha:
        'Se a sala disser que não precisa revisar porque o que eles fazem é descartável, pergunte quanto do que foi feito para ser descartável ainda está rodando hoje.',
    },

    // ──────────────── O DADO REAL ────────────────
    {
      id: 'beat-06-mcp',
      label: 'MCP e o mcp-brasil',
      group: 'dado',
      beat: 6,
      // fontes conferidas em 27/08/2026 no README e no SOURCES.md de github.com/Mcp-Brasil/mcp-brasil
      tags: ['mcp', 'mcp-brasil', 'datajud', 'bndes', 'cvm', 'pncp', 'dado-publico'],
      oneLine:
        'O protocolo que liga o agente num sistema externo, e um servidor brasileiro que abre setenta fontes públicas de uma vez.',
      pass1:
        'MCP é o protocolo que conecta o agente a um sistema de fora e expõe para ele as ferramentas e os dados daquele sistema. Sem MCP, você é quem busca o dado, copia e cola no pedido. Com MCP, ele busca sozinho enquanto trabalha. A diferença prática não é conveniência: é a distância entre pedir análise sobre o que coube no seu copiar e colar, e pedir análise sobre a fonte inteira.',
      pass2:
        '**A distinção que resolve a confusão**\n\nSkill é instrução, diz como fazer alguma coisa. MCP é acesso, diz de onde vem o dado. Os dois resolvem problemas diferentes e você normalmente quer os dois: um agente com instrução boa e sem acesso fica adivinhando, e um agente com acesso e sem instrução busca a coisa errada com eficiência.\n\n**O mcp-brasil**\n\nÉ um servidor MCP comunitário, licença MIT, que expõe setenta fontes de dado público brasileiro em 533 ferramentas. Sessenta e seis dessas fontes não pedem chave nenhuma, e quatro pedem chave gratuita. Instala com `claude mcp add mcp-brasil -- uvx --from mcp-brasil python -m mcp_brasil.server`. Duas ressalvas que precisam ser ditas junto: ele não é serviço oficial do governo, é projeto independente, e cada fonte tem a licença de dado dela, o que importa se o uso for comercial.\n\n**O que dele serve no dia a dia**\n\nJudiciário é o mais direto: DataJud, do CNJ, mais STF e STJ, para exposição a litígio, recuperação judicial e falência. BNDES, para financiamento e exposição de dívida. CVM, para informação de fundo. PNCP, ComprasNet, Portal da Transparência e os tribunais de contas, para empresa cuja receita depende de contrato público, que é onde muita situação especial nasce. Banco Central, para as séries de Selic e IPCA que entram no modelo.\n\n**A ressalva de acesso**\n\nDataJud exige chave, gerada pelo CNJ sob a Resolução 331/2020, então esse não é ligar e usar. Os acórdãos publicados de STF e STJ são informação pública e não exigem chave. Vale checar isso antes de montar qualquer rotina em cima, porque é a diferença entre uma consulta que roda hoje e uma que depende de cadastro.\n\n**O que o MCP não conserta**\n\nAcesso a mais dado não melhora um pedido mal feito, só faz ele buscar mais coisa errada. Os cinco passos anteriores continuam valendo, e na verdade valem mais: quanto mais alcance o agente tem, mais caro fica o mal-entendido.',
      pass3: [
        {
          gotcha: 'Ligar todos os MCPs disponíveis.',
          note: 'Cada servidor ligado ocupa espaço no contexto com a descrição das ferramentas dele, e ferramenta demais atrapalha a escolha da certa. Ligue o do sistema que você mais abre, e depois o segundo.',
        },
        {
          gotcha: 'Tratar dado público como dado verificado.',
          note: 'O mcp-brasil entrega o que a fonte publica, do jeito que ela publica. Base pública tem atraso, tem campo vazio e tem erro de preenchimento, e nada disso vira erro visível na resposta do agente.',
        },
        {
          gotcha: 'Achar que é serviço oficial do governo.',
          note: 'O próprio projeto diz que não é, e nem tem endosso das instituições cujos dados acessa. Para uso comercial, a licença de cada uma das setenta fontes precisa ser olhada antes.',
        },
        {
          gotcha: 'MCP resolve o problema de contexto.',
          note: 'Ele resolve alcance, não capacidade. O resultado que ele traz entra no contexto e ocupa lugar como qualquer outra coisa, então busca larga demais enche o contexto mais rápido do que copiar e colar enchia.',
        },
      ],
      anchor:
        'Uma tese sua depende de saber a exposição a litígio de uma empresa. Hoje, quantos passos existem entre a pergunta e a resposta, e quantos deles são você buscando e colando?',
      followup:
        'Dos cinco passos e do MCP, qual deles resolve o retrabalho que mais te custou tempo nesta semana?',
      gotcha:
        'Se a sala se empolgar com as setenta fontes, devolva: quantas dessas vocês consultariam hoje se fosse manual? As que não entram no fluxo manual dificilmente entram no automático, e o valor está nas duas ou três que já são rotina.',
    },

    // ──────────────── SÍNTESE ────────────────
    {
      id: 'sintese',
      label: 'O que levar',
      group: 'synthesis',
      diagramUrl: '/diagrams/metodo-ia/fluxo.drawio.png',
      oneLine:
        'Os cinco passos atacam o mesmo custo, que é refazer, e nenhum deles pede que você trabalhe mais devagar.',
      pass1:
        'Nada aqui pediu que você mudasse a velocidade nem a forma do que produz. Os cinco passos atacam um custo só, que é o retrabalho, por ângulos diferentes: a entrevista acha o mal-entendido antes do trabalho, o registro guarda a decisão sem custo extra, o plano move a revisão para onde ela é barata, o subagente isola contexto e paraleliza o independente, e a revisão adversarial acha o que quebra sem depender da sua atenção. O MCP é outro eixo: ele não melhora o método, aumenta o alcance.',
      pass2:
        '**O eixo**\n\nQuase todo tempo perdido com IA em tarefa longa vem de duas coisas: ela entendeu outra coisa, ou ela não tinha o que precisava. Os cinco passos atacam a primeira. O MCP ataca a segunda. Quando você souber em qual das duas caiu na última vez que perdeu meio dia, já sabe qual passo adotar primeiro.\n\n**Por onde começar**\n\nUm de cada vez, e o primeiro é `/grill-me`, porque é o que custa menos para experimentar e o que devolve resposta mais rápido. Adotar os cinco de uma vez é a maneira mais confiável de não adotar nenhum.\n\n**O que continua sendo seu**\n\nDecidir o que vale a pena fazer, e assinar o resultado. Nenhum passo daqui transfere isso, e nenhum deles funciona se você não souber dizer o que quer. A máquina fica muito boa em executar uma intenção clara, e continua sem ter opinião sobre qual intenção valia a pena.\n\n**Alcance e método são coisas separadas**\n\nQuanto mais alcance você dá para o agente, mais caro sai o mal-entendido. Ligar MCP sem ter adotado nenhum dos cinco passos aumenta a velocidade com que você produz a coisa errada.',
      pass3: [
        {
          gotcha: 'Adotar os cinco de uma vez.',
          note: 'Cada um muda um hábito, e hábito não muda em bloco. Um por vez, começando pelo que custa menos, é o que costuma pegar.',
        },
        {
          gotcha: 'Achar que o assunto é qualidade de código.',
          note: 'Nenhum dos passos pede código melhor. Todos pedem menos vezes refazendo, que é uma métrica diferente e mais fácil de você mesmo medir na semana seguinte.',
        },
        {
          gotcha: 'Ligar MCP antes de adotar qualquer um dos cinco passos.',
          note: 'Mais alcance com o mesmo método aumenta a velocidade de produzir a coisa errada. O método vem antes do alcance.',
        },
      ],
      anchor:
        'Qual foi o retrabalho mais caro que você teve com IA neste mês, e qual dos passos de hoje teria pegado ele antes?',
      followup:
        'Escolha um passo, o mais barato de experimentar, e use na próxima tarefa longa que aparecer. Depois compare com a anterior.',
      gotcha:
        'Se a sala sair querendo montar o fluxo inteiro amanhã, corte pela metade: peça um passo, numa tarefa, nesta semana. Fluxo inteiro adotado de uma vez volta pro pedido curto na segunda tarefa.',
    },
  ],

  glossary: [
    {
      title: 'Antes de executar',
      terms: [
        { term: 'pedido curto', definition: 'Descrever a tarefa em duas linhas e deixar o modelo completar o resto. Funciona em tarefa curta e cobra caro em tarefa longa.' },
        { term: 'retrabalho', definition: 'O tempo entre o modelo entender errado e você descobrir. É o custo que todos os passos desta aula atacam.' },
        { term: '/grill-me', definition: 'Comando que inverte a ordem: ele te entrevista antes de executar, uma pergunta por vez. As perguntas mostram o que ele entendeu.' },
        { term: 'grilling', definition: 'A skill que o /grill-me chama. Tem doze linhas, e o /grill-me tem seis. É arquivo markdown, não produto.' },
        { term: '/grill-with-docs', definition: 'A mesma entrevista, gravando registro de decisão e glossário no fim. Documentação como subproduto, não como tarefa.' },
        { term: 'ADR', definition: 'Registro de decisão: qual escolha foi feita, quais alternativas existiam e por que essa ganhou. O que você esquece primeiro é o porquê.' },
        { term: 'skill', definition: 'Instrução guardada num arquivo markdown, carregada só quando o assunto aparece. Diz como fazer.' },
        { term: 'plugin', definition: 'Um pacote que instala várias skills de uma vez. O superpowers traz catorze numa instalação só.' },
        { term: 'superpowers', definition: 'O plugin com o fluxo de spec e plano. Instala com /plugin install superpowers@claude-plugins-official.' },
      ],
    },
    {
      title: 'Executando',
      terms: [
        { term: 'agente', definition: 'O modelo dentro de um loop que executa de verdade. A diferença entre sugerir e fazer mora aqui.' },
        { term: 'loop', definition: 'Recebe o contexto, devolve texto, parte do texto é um pedido de ferramenta, alguém executa, o resultado volta e repete até concluir.' },
        { term: 'contexto', definition: 'Tudo que o modelo enxerga de uma vez: instruções, histórico, arquivos que entraram e resultado de ferramenta. Tem tamanho, e enche.' },
        { term: 'subagente', definition: 'Agente disparado com contexto limpo, rodando o próprio loop, que devolve só a conclusão. Isola contexto e permite paralelizar.' },
        { term: 'briefing', definition: 'O que entra no pedido do subagente. Ele não viu o que você viu, então o que ficou de fora ele inventa com confiança.' },
        { term: 'revisão adversarial', definition: 'Vários revisores com mandato de achar defeito, cada um com uma lente diferente. Ângulo cobre mais que quantidade.' },
        { term: 'lente', definition: 'O mandato específico de um revisor: arquitetura, segurança, caso de borda, desempenho. Dois revisores com a mesma lente devolvem o mesmo achado.' },
        { term: 'falso positivo', definition: 'Achado que parece defeito e não é. Sai por construção de quem foi mandado achar defeito, e por isso precisa de uma passada que tente refutar.' },
      ],
    },
    {
      title: 'O dado real',
      terms: [
        { term: 'MCP', definition: 'O protocolo que liga o agente a um sistema externo e expõe as ferramentas e os dados dele. Skill diz como fazer, MCP diz de onde vem o dado.' },
        { term: 'mcp-brasil', definition: 'Servidor MCP comunitário, licença MIT, com setenta fontes de dado público brasileiro em 533 ferramentas. Não é serviço oficial do governo.' },
        { term: 'DataJud', definition: 'Base do CNJ com dados processuais. Exige chave gerada pelo CNJ sob a Resolução 331/2020, então não é ligar e usar.' },
        { term: 'PNCP', definition: 'Portal Nacional de Contratações Públicas. Serve para empresa cuja receita depende de contrato com o poder público.' },
        { term: 'Portal da Transparência', definition: 'Gastos e desembolsos federais, da CGU. Reuso comercial permitido com atribuição.' },
      ],
    },
  ],
};

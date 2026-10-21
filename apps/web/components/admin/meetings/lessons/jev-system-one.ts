import type { Lesson } from '../lesson-types';

/**
 * Aula sobre o Jev (TypeSafe AI) e os modelos de decisão "System One".
 * Fontes: o guia do unicodeveloper no Medium (17/set/2026) e a pesquisa sobre a
 * TypeSafe feita pra esta aula. Todo número de custo, velocidade ou benchmark é
 * autorreportado (pela TypeSafe ou pelos autores de cada projeto).
 *
 * Sem `anchor`, `followup`, `gotcha`, `askWho` e `scenarios` de propósito: a aula
 * não usa roteiro de perguntas para a sala.
 */
export const jevSystemOne: Lesson = {
  slug: 'jev-system-one',
  title: 'Jev: decisões em vez de texto',
  subtitle:
    'O modelo que não conversa com pessoas: recebe um state e perguntas tipadas e devolve decisões com confiança.',
  blurb:
    'Uma aula para quem já usa LLM todo dia e escreve, sem perceber, um segundo programa só para arrancar a decisão de dentro do texto. O ponto de partida é o Jev, da TypeSafe AI: um modelo que não gera texto, e sim responde perguntas tipadas (Choice, Score, Noul) sobre um state, todas numa passada só, com uma confiança que diz se dá pra agir sem perguntar a ninguém. A aula passa pela empresa e pela tese dela ("smart if-statements"), pelo que já existia antes (encoder treinado, zero-shot, JSON forçado), pelo jeito de usar (limiar de confiança, cascade, decidir o que é o state), por casos reais (triagem de papers e candidatos, agentes que clicam, um drone) e pelos limites que a própria TypeSafe publica. Fecha na enxurrada de classifiers que veio nas três semanas seguintes, inclusive a Decisions API da OpenAI em gpt-6-luna, o modelo que o próprio ICS Select usa. A mensagem que fica: toda decisão em tempo de execução, quebre em perguntas tipadas.',
  durationMin: 30,
  audience: 'Membros do ciclo ICS Select que já usam LLMs no dia a dia',
  slidesUrl: '/slides/jev-system-one.html',
  nodes: [
    // ──────────────── FUNDAÇÃO (study-only) ────────────────
    {
      id: 'f-classifier',
      label: 'O que é um classifier',
      group: 'foundations',
      teachFromZero: true,
      tags: ['classifier', 'conjunto fechado', 'triagem'],
      oneLine:
        'Um classifier recebe um texto e devolve uma opção de um conjunto fechado que você definiu antes. Nada de resposta livre.',
      pass1:
        'Antes de falar do Jev, uma palavra: classifier. É qualquer coisa que recebe uma entrada (um e-mail, um ticket, um comentário) e devolve uma opção de uma lista fechada que você escolheu antes: spam ou não spam, billing, technical ou sales, aprovado ou recusado. O valor do classifier está justamente em não poder responder outra coisa: o seu código sabe de antemão todas as saídas possíveis e tem um `if` pronto para cada uma.',
      pass2:
        '**Por que conjunto fechado importa**\n\nQuando a saída é texto livre, o seu código precisa interpretar o texto antes de agir. Quando a saída é uma opção de uma lista que você definiu, o código só compara. É a diferença entre ler uma carta e ler um checkbox.\n\n**Onde você já usa sem chamar assim**\n\nFiltro de spam, triagem de suporte, moderação de comentário, roteamento de pedido para o time certo, guardrail que bloqueia uma ação. Todos são classifiers, mesmo quando por trás alguém colocou um LLM e um prompt "responda só com uma destas palavras".\n\n**O exemplo da aula inteira**\n\nUm ticket: o cliente tenta conectar a conta Stripe há 3 dias e escreve "I\'m losing sales. Please help ASAP." O departamento é uma de três opções (billing, technical, sales). A resposta certa é technical, e o resto da aula é sobre como chegar nela de forma barata, rápida e com uma medida de quanto confiar.',
      pass3: [
        {
          gotcha: 'Classifier é coisa antiga, de antes dos LLMs.',
          note: 'A tarefa é antiga; o jeito de resolver mudou várias vezes. Hoje muita gente resolve classificação pedindo texto a um LLM, e é exatamente esse arranjo que a aula questiona.',
        },
        {
          gotcha: 'Se tem só duas opções, não é classifier.',
          note: 'Sim ou não também é conjunto fechado. No Jev isso tem até um tipo próprio de pergunta, o Noul.',
        },
        {
          gotcha: 'Classifier só serve para texto curto.',
          note: 'A entrada pode ser grande e estruturada (um JSON com o estado de um jogo, o texto de uma tela inteira). O que define o classifier é a saída fechada, não o tamanho da entrada.',
        },
      ],
    },

    // ──────────────── O PROBLEMA ────────────────
    {
      id: 'beat-01-typesafe-tese',
      label: 'A TypeSafe e a tese',
      group: 'fundamentos',
      beat: 1,
      tags: ['TypeSafe', 'System One', 'System Two', 'smart if-statements', 'Jevons'],
      oneLine:
        'Uma empresa fundada por quem ajudou a criar o RLHF aposta que o gargalo da IA não é inteligência, é ser difícil de usar dentro de software.',
      pass1:
        'A TypeSafe AI nasceu em San Francisco, por volta de 2024, e passou dois anos em stealth. O fundador e CEO, Diogo Almeida, veio da OpenAI e é co-inventor do RLHF, o método que deixou os modelos bons em seguir instrução e virou a base do ChatGPT. Os co-founders são Erik Gafni (CTO, que lidera os times de treino do modelo e go-to-market) e Sasha Sheng (capacidade do modelo, vinda da Meta AI). Em setembro de 2026 lançaram o Jev com um seed de US$ 40M liderado pela DCVC; em 9 de outubro anunciaram uma Série A de US$ 870M a US$ 7,5B de valuation, liderada pela a16z.',
      pass2:
        '**A tese em uma frase**\n\nO manifesto deles ("Build Prod, Not God") diz que o gargalo não é inteligência bruta: é que a inteligência de hoje "is hard to build on". A IA atual tem forma de assistente de chat, e software não conversa. Eles comparam com bancos de dados antes do SQL e chamam o que querem de "smart if-statements": um `if` cuja condição é julgamento de senso comum, não um bit.\n\n**System One e System Two**\n\nO nome vem de Kahneman: System Two é o raciocínio lento e deliberado, System One é o julgamento rápido. Quase todo laboratório está correndo atrás de System Two (modelos que pensam por minutos). A aposta da TypeSafe é que a maior parte das decisões dentro de software é System One: rápida, estreita, repetida milhões de vezes.\n\n**Por que "Jev"**\n\nWilliam Stanley Jevons percebeu que, quando o carvão ficou mais barato de usar, o consumo total subiu em vez de cair. A aposta é a mesma: se uma decisão de IA ficar muito mais barata, aparecem muito mais lugares para usar.',
      pass3: [
        {
          gotcha: 'Os cargos dos três fundadores vêm todos da mesma fonte.',
          note: 'O do Almeida (CEO) está no post de lançamento da TypeSafe. O do Gafni (CTO) e a área da Sheng (capacidade do modelo) vêm das bios deles no X. Diretórios que dizem "COO" para a Sheng não batem com a bio dela.',
        },
        {
          gotcha: 'System One quer dizer modelo burro.',
          note: 'Quer dizer julgamento rápido sobre uma pergunta estreita. A própria TypeSafe reconhece que o nome sugere "propenso a erro" e argumenta que dá para torná-lo mais confiável que as alternativas.',
        },
        {
          gotcha: 'Paradoxo de Jevons é sobre economizar.',
          note: 'É o contrário: ficar mais eficiente aumenta o uso total. Aplicado aqui, decisão barata não é para gastar menos no que você já faz, é para julgar coisas que antes não compensava julgar.',
        },
      ],
    },
    {
      id: 'beat-02-antes',
      label: 'Como já se fazia antes',
      group: 'fundamentos',
      beat: 2,
      tags: ['encoder', 'zero-shot', 'NLI', 'constrained decoding', 'JSON mode'],
      oneLine:
        'Treinar um modelo pequeno, perguntar por similaridade, ou forçar o LLM a cuspir JSON: cada um resolve um pedaço e deixa outro de fora.',
      pass1:
        'Classificar com IA não começou com o Jev. Três caminhos já existiam. Um encoder treinado (ModernBERT, DeBERTa, SetFit) é barato e rápido, mas precisa de rótulos fixos no treino e a confiança dele não é calibrada. Um classifier zero-shot (NLI, GLiNER, GLiClass) aceita rótulos na hora, mas é raso em julgamento de vários passos. E o JSON forçado (JSON mode, Outlines, XGrammar) garante formato válido de um LLM comum, mas continua gerando token a token e não diz quanto confiar em cada opção.',
      pass2:
        '**Encoder treinado**\n\nVocê junta exemplos rotulados, treina, e o modelo vira uma função rápida e barata, que roda até local. O preço: os rótulos ficam fixos no treino (mudou a lista, treina de novo) e o número que ele devolve como "probabilidade" não é calibrado a menos que você calibre.\n\n**Zero-shot**\n\nModelos de NLI e a família GLiNER aceitam os rótulos na hora da chamada e rodam em CPU. Funcionam bem em pergunta direta; ficam fracos quando o julgamento depende de várias partes de um estado longo.\n\n**JSON forçado (constrained decoding)**\n\nVocê pega um LLM comum e restringe a geração para só sair JSON válido no schema. Resolve o formato. Não resolve a latência (ainda é um token por vez), não resolve o custo da saída e não dá probabilidade por opção: a resposta pode ser válida, errada e confiante.\n\n**O que o Jev junta**\n\nO argumento da TypeSafe é ter as três coisas numa chamada só: opções definidas na hora, formato garantido por construção e uma probabilidade calibrada por opção, avaliando todas as perguntas de uma vez.',
      pass3: [
        {
          gotcha: 'JSON mode já resolve o problema do Jev.',
          note: 'Resolve o formato, não a confiança nem a latência. Um JSON válido dizendo "technical" não te diz se o modelo estava 51% ou 99% seguro.',
        },
        {
          gotcha: 'Encoder treinado ficou obsoleto.',
          note: 'Continua sendo a opção mais barata quando os rótulos são estáveis e você tem dados rotulados. A comparação certa é custo de manter versus flexibilidade.',
        },
        {
          gotcha: 'O número que o classifier devolve já é a chance de estar certo.',
          note: 'Só se ele for calibrado. Um score de 0,9 de um modelo não calibrado pode acertar bem menos que 90% das vezes.',
        },
      ],
    },
    {
      id: 'beat-03-segundo-programa',
      label: 'O segundo programa',
      group: 'fundamentos',
      beat: 3,
      tags: ['parse', 'retry', 'fallback', 'LLM como classifier'],
      oneLine:
        'Quem usa LLM para decidir acaba escrevendo outro programa só para arrancar a decisão de volta do texto.',
      pass1:
        'O jeito mais comum de classificar hoje é pedir ao LLM: "responda só com billing, technical ou sales". Ele quase sempre obedece. Quase. Às vezes devolve a palavra dentro de um bloco de markdown, às vezes escreve "technical support", às vezes pede desculpa antes. Aí você escreve um parser, depois validação, depois retry, depois fallback. Esse é o segundo programa: código que só existe para transformar texto em decisão.',
      pass2:
        '**Como ele cresce**\n\nPrimeiro é um `strip()`. Depois uma regex para tirar a cerca de markdown. Depois um mapa de sinônimos ("technical support" vira technical). Depois um retry quando nada bate, um limite de tentativas, um fallback para humano, um log para descobrir por que falhou. O artigo do lançamento resume a comparação: o Jev compete com "o classifier feito de LLM barato mais 400 linhas de parsing".\n\n**O custo escondido**\n\nAlém das linhas, a latência: o LLM gera um token por vez, e cada retry é outra ida e volta. E você ainda não tem uma medida de confiança. Quando ele responde "technical", você não sabe se era óbvio ou chute.\n\n**O que muda com uma pergunta tipada**\n\nSe a resposta só pode ser uma das opções declaradas, o parse, a validação e o retry por formato desaparecem. O que sobra no seu código é o `if` que você queria escrever desde o começo.',
      pass3: [
        {
          gotcha: 'Basta um prompt melhor para o LLM nunca sair do formato.',
          note: 'Um prompt melhor reduz a taxa de falha, não zera. Em milhões de chamadas, uma taxa pequena vira muito retry e muito caso estranho em produção.',
        },
        {
          gotcha: 'Sem erro de formato, sem erro.',
          note: 'Tirar o erro de formato não tira o erro de julgamento. O próprio FAQ do Jev diz: "zero type errors is not zero mistakes".',
        },
        {
          gotcha: 'O segundo programa é pós-processamento normal.',
          note: 'Ele parece normal porque todo mundo escreve. Mas é código que existe só porque a interface devolve texto quando o software queria uma opção.',
        },
      ],
    },

    // ──────────────── COMO FUNCIONA ────────────────
    {
      id: 'beat-04-uma-passada',
      label: 'Um token por vez × uma passada só',
      group: 'ferramentas',
      beat: 4,
      tags: ['autoregressivo', 'uma passada', 'latência', 'preço'],
      oneLine:
        'O LLM escreve a resposta um token por vez; o Jev avalia todas as perguntas de uma vez, numa passada paralela.',
      pass1:
        'Um LLM gera texto um token por vez, e cada token depende do anterior. Por isso a latência cresce com o tamanho da resposta e a resposta chega como uma string qualquer. O Jev recebe o state e todas as perguntas tipadas e responde todas numa passada só, em paralelo, em 70 a 500 ms. O preço também muda de forma: US$ 0,042 por milhão de tokens de entrada, e a saída é grátis.',
      pass2:
        '**Por que a saída pode ser grátis**\n\nNum LLM, a saída é o trabalho caro: cada token gerado é uma rodada do modelo. No Jev não existe texto gerado; existe uma probabilidade para cada opção de cada pergunta, calculada de uma vez. O que custa é ler a entrada.\n\n**Várias perguntas, uma ida e volta**\n\nNo ticket Stripe, departamento, frustração e urgência saem da mesma chamada, em cerca de 400 ms. Com um LLM você ou faz três chamadas, ou pede um JSON com três campos e volta a depender do parse.\n\n**O que isso libera**\n\nQuando a decisão custa frações de centavo e menos de meio segundo, ela cabe em lugares onde antes não cabia: dentro de um loop de jogo, a cada passo de um agente, em cada item de uma pilha de milhares.',
      pass3: [
        {
          gotcha: 'Uma passada só quer dizer que ele não pensa.',
          note: 'Quer dizer que ele não escreve um raciocínio antes de responder. Para pergunta estreita isso basta; para pergunta que precisa de conta ou de vários passos, a resposta é decompor ou usar outro modelo.',
        },
        {
          gotcha: '70 a 500 ms vale para qualquer entrada.',
          note: 'É a faixa que a TypeSafe divulga, e ela mesma admite que a demo lado a lado favorece o Jev porque as entradas são curtas. Entrada grande demora mais.',
        },
        {
          gotcha: 'Saída grátis quer dizer chamada grátis.',
          note: 'A entrada é cobrada. Um state inchado custa mais e, como aparece adiante, ainda piora a acurácia.',
        },
      ],
    },
    {
      id: 'beat-05-tres-perguntas',
      label: 'Choice, Score, Noul',
      group: 'ferramentas',
      beat: 5,
      tags: ['Choice', 'Score', 'Noul', 'pergunta tipada', 'state'],
      oneLine:
        'Três tipos de pergunta e nenhum outro: o formato da resposta é decidido por você, não pelo modelo.',
      pass1:
        'Toda pergunta ao Jev é de um de três tipos. Choice escolhe uma opção de até 255. Score posiciona numa escala ordenada de 2 a 10 níveis, e pode cair entre dois níveis. Noul devolve a probabilidade de uma afirmação de sim ou não ser verdade. No ticket Stripe: department (Choice) volta technical, frustration (Score de 3 níveis) volta 1.035, is_urgent (Noul) volta 0.999. Tudo numa ida e volta de uns 400 ms.',
      pass2:
        '**Choice**\n\nVocê lista as opções; ele devolve uma probabilidade para cada uma e a escolhida. Como as opções são as suas, não existe "technical support": ou é technical, ou é outra da lista.\n\n**Score**\n\nVocê define níveis ordenados (por exemplo calmo, frustrado mas educado, furioso). A resposta é uma posição na escala, não um rótulo: 1.035 quer dizer um pouco além de "frustrated but civil". Isso guarda informação que um rótulo jogaria fora.\n\n**Noul**\n\nUma afirmação ("este ticket é urgente") e a probabilidade de ela ser verdade. 0.999 é quase certeza. Não vem campo de confiança separado: a própria probabilidade já diz o quanto.\n\n**O state**\n\nO que vai ser julgado (o ticket, um JSON, o texto de uma tela) entra como state. As perguntas são sobre ele. Separar o state das perguntas é o que deixa fazer várias perguntas sobre a mesma coisa numa chamada só.',
      pass3: [
        {
          gotcha: 'Score devolve um dos níveis.',
          note: 'Devolve uma posição, que pode cair entre níveis. 1.035 não é "nível 1 arredondado", é um pouco acima do meio de uma escala de 0 a 2.',
        },
        {
          gotcha: 'Noul é um Choice com duas opções.',
          note: 'Na prática parecem, mas o Noul devolve a probabilidade da afirmação ser verdade, sem campo de confiança separado. A sugestão da TypeSafe para medir certeza é |2p − 1|.',
        },
        {
          gotcha: 'Dá para pedir uma explicação junto.',
          note: 'Não. O Jev não gera texto. Se você precisa da explicação, chama um modelo de escrita depois, só quando precisar.',
        },
      ],
    },

    // ──────────────── COMO USAR ────────────────
    {
      id: 'beat-06-confianca',
      label: 'A confiança diz se você age',
      group: 'ferramentas',
      beat: 6,
      tags: ['confiança calibrada', 'limiar', 'RLCD', 'RLHF'],
      oneLine:
        'A resposta diz o quê; a confiança diz se dá para agir sem perguntar a ninguém, e o limiar sobe com o custo de errar.',
      pass1:
        'O Jev é treinado com RLCD (Reinforcement Learning for Calibrated Decisions), que otimiza as probabilidades contra o que de fato aconteceu. O RLHF otimiza preferência humana, e isso empurra modelos para respostas confiantes demais. Calibrado quer dizer: das respostas marcadas com 0,9, umas 90% acertam. Com isso o limiar vira código: "ver saldo" passa com barra baixa, "aprovar transferência" só passa acima de 0,85, e abaixo de 0,5 vai para um humano.',
      pass2:
        '**Calibração é propriedade de grupo**\n\nUm 0,95 não é promessa sobre aquela resposta. É uma estatística: se você juntar mil respostas marcadas 0,95, umas 950 estão certas. Isso quer dizer que um 0,95 específico ainda pode estar errado, e o seu sistema tem que aguentar isso.\n\n**O limiar sobe com a consequência**\n\nErrar "ver saldo" custa pouco: mostrou a tela errada, o usuário volta. Errar "aprovar transferência" custa dinheiro. Por isso a mesma confiança pode bastar para uma ação e não para outra. No exemplo do artigo, transferência só segue sozinha acima de 0,85; abaixo disso, pede confirmação. Abaixo de 0,5, qualquer ação vai para humano.\n\n**Onde mora o limiar**\n\nNo seu código, não no modelo. É um número que você decide por ação, olhando o custo do erro, e pode mudar sem mexer em nada do lado da IA.',
      pass3: [
        {
          gotcha: 'Confiança 0,95 quer dizer que essa resposta está certa.',
          note: 'Quer dizer que, em grupo, respostas assim acertam umas 95%. Uma resposta específica ainda pode estar errada.',
        },
        {
          gotcha: 'Um limiar único serve para o sistema todo.',
          note: 'O limiar depende do custo de errar cada ação. Ver saldo e aprovar transferência não podem ter a mesma barra.',
        },
        {
          gotcha: 'RLHF e RLCD são a mesma coisa com nome novo.',
          note: 'Otimizam coisas diferentes: RLHF a preferência de quem avalia a resposta, RLCD a probabilidade contra o resultado real. Preferência humana tende a premiar resposta confiante.',
        },
      ],
    },
    {
      id: 'beat-07-quando-cascade',
      label: 'Quando usar e o cascade',
      group: 'ferramentas',
      beat: 7,
      tags: ['cascade', 'porta de entrada', 'quando usar'],
      oneLine:
        'Jev para respostas fechadas em volume; LLM para palavras, contas e explicação. Juntos, o Jev decide quais pedidos merecem um LLM.',
      pass1:
        'Use o Jev quando o espaço de resposta é fechado e conhecido, quando volume ou latência são o gargalo, ou quando você precisa de uma confiança para liberar uma ação. Use um LLM quando precisa de palavras, contas ou explicação. O melhor arranjo é o cascade: o Jev é a porta de entrada, a maioria dos pedidos sai por código comum, parte vai para um especialista e a minoria difícil vai para um modelo frontier ou um humano.',
      pass2:
        '**Do lado do Jev**\n\nTriagem, roteamento, moderação, guardrail antes de uma ação, filtro de trechos num RAG. Perguntas com opções conhecidas, feitas muitas vezes.\n\n**Do lado do LLM**\n\nResumo, código, explicação, matemática. Tudo que precisa produzir texto novo ou fazer conta. O Jev não compete com Opus 5 nem com GPT-5.6; compete com o classifier improvisado com LLM barato.\n\n**O cascade**\n\nO Jev classifica cada pedido. Se a resposta cai numa categoria que código comum resolve, resolve. Se precisa de um especialista, vai. Se é difícil ou a confiança é baixa, sobe para o frontier ou para um humano. O limiar de confiança é o botão que decide essa divisão, e ele mora no seu código.\n\n**A ordem de grandeza (autorreportada)**\n\nNo exemplo do artigo, um milhão de tickets custaria cerca de US$ 30.400 tudo no frontier e cerca de US$ 6.480 em cascade, com 800 mil respondidos em menos de meio segundo em vez de uns 10 s.',
      pass3: [
        {
          gotcha: 'O Jev substitui o LLM.',
          note: 'Ele decide quais pedidos merecem um LLM. A parte que precisa de texto continua indo para um modelo de escrita.',
        },
        {
          gotcha: 'Os US$ 30.400 → US$ 6.480 valem para o meu caso.',
          note: 'São números do artigo, num cenário específico, autorreportados. A economia real depende de quanto do seu tráfego cai na faixa que código comum resolve.',
        },
        {
          gotcha: 'Limiar alto é sempre mais seguro.',
          note: 'Limiar alto manda mais coisa para o caminho caro e lento. É uma troca entre custo e risco, decidida por ação.',
        },
      ],
    },
    {
      id: 'beat-08-state',
      label: 'Decida o que é o state',
      group: 'ferramentas',
      beat: 8,
      tags: ['state', 'disciplina', 'Mario'],
      oneLine:
        'Loop, segurança e contas ficam no código; o Jev fica com o julgamento estreito do meio, sobre um state que você escolheu.',
      pass1:
        'A disciplina que o artigo repete: deixe o loop, a segurança e a aritmética em código comum, e use o Jev só para o julgamento estreito do meio. No exemplo do Mario (fhshaik/typesafe-mario), o Jev nunca vê uma screenshot: a RAM do jogo vira um JSON compacto, esse JSON é o state, e a pergunta é qual das ações tomar. Antes de perguntar, você precisa decidir o que é o state.',
      pass2:
        '**Por que não mandar a tela**\n\nUma imagem tem muito mais coisa do que a decisão precisa. Extrair da RAM a posição do Mario, dos inimigos e dos buracos dá um state pequeno, barato e sem ruído. A decisão fica melhor e mais barata ao mesmo tempo.\n\n**O que fica no código**\n\nO loop do jogo, o que é proibido fazer, qualquer conta. O Jev não é calculadora e não é dono de segurança. Ele escolhe entre opções que o código já considera seguras.\n\n**Decidir o state é o trabalho de design**\n\nA mesma pergunta sobre um state bem escolhido e sobre um state inchado dá respostas diferentes. Escolher o que entra é a parte do sistema que é sua, e é onde mora a maior parte da qualidade.',
      pass3: [
        {
          gotcha: 'Quanto mais contexto no state, melhor.',
          note: 'A própria TypeSafe lista state inchado com detalhe irrelevante como modo de falha: a acurácia cai. Filtre antes de perguntar.',
        },
        {
          gotcha: 'O Jev pode controlar o loop inteiro.',
          note: 'O loop fica no código. O Jev responde uma pergunta por passo sobre o state daquele passo.',
        },
        {
          gotcha: 'Ele faz a conta se eu pedir.',
          note: 'Contagem e matemática estão na lista de falhas publicada. Faça a conta no código e passe o resultado no state.',
        },
      ],
    },

    // ──────────────── CASOS E LIMITES ────────────────
    {
      id: 'beat-09-casos',
      label: 'Casos de uso',
      group: 'avancado',
      beat: 9,
      tags: ['triagem', 'Valyu', 'Jack & Jill', 'browser agent', 'drone'],
      oneLine:
        'Julgar cada item de uma pilha grande, escolher o próximo clique de um agente, aconselhar um drone: sempre a pergunta estreita no meio de código comum.',
      pass1:
        'Quatro casos mostram o padrão. Papers: busca em fontes primárias com Valyu e o Jev julgando cada paper (is_rct, evidence_strength) por uns US$ 0,0004 cada. Candidatos: a Jack & Jill trocou o Gemini Flash Lite e o custo por mil candidatos caiu de US$ 0,755 para US$ 0,092, com a mesma qualidade. Um agente de browser reservou Zurique → Londres no Google Flights em 7,1 s. E um drone simulado usa o Jev como conselheiro a 2,5 Hz, com a segurança no código.',
      pass2:
        '**Triagem de pilha grande**\n\nQuando julgar um item custa frações de centavo, dá para julgar todos. 1.018 papers foram classificados por 8 centavos (1kpapers.com). Na Jack & Jill, o tempo mediano caiu de 20,3 s para 10,3 s e o recall ficou igual (94,6% contra 93,9%, diferença não significativa).\n\n**Agentes sem screenshot**\n\nO agente lê a tela por OCR, vira texto, e pergunta ao Jev a próxima ação: click, type e select saem na mesma ida e volta, só a escolhida executa. Um modelo de escrita só entra quando precisa de texto livre.\n\n**Tempo real em camadas**\n\nNo drone (MuJoCo), o controlador roda a 500 Hz em código, a guiagem e o reflexo de segurança a 50 Hz em código, a visão a 15 Hz com visão clássica, e o Jev a uns 2,5 Hz só aconselhando. Nas palavras do artigo, ele não pode ser a camada de percepção nem rodar na taxa de controle.\n\n**Todos os números são autorreportados**\n\nVêm da TypeSafe ou dos autores de cada projeto. Servem como ordem de grandeza, não como benchmark.',
      pass3: [
        {
          gotcha: 'Os números da Jack & Jill são independentes.',
          note: 'É um case publicado pela TypeSafe. Trate como dado do fornecedor.',
        },
        {
          gotcha: 'No drone, o Jev pilota.',
          note: 'Ele opina na camada mais lenta. Quem é dona da segurança é a camada de 50 Hz, em código.',
        },
        {
          gotcha: 'Agente com Jev não precisa de modelo de escrita.',
          note: 'Precisa quando o próximo passo é digitar texto livre. O Jev escolhe a ação; o texto vem de outro modelo só quando necessário.',
        },
      ],
    },
    {
      id: 'beat-10-quebra',
      label: 'Onde ele quebra',
      group: 'avancado',
      beat: 10,
      tags: ['jaggedness', 'injection', 'decompor'],
      oneLine:
        'Valor válido não é valor certo: a TypeSafe publica os próprios modos de falha numa página chamada jaggedness.',
      pass1:
        'O Jev não consegue devolver um valor fora do schema, mas pode devolver o valor válido errado. A página de jaggedness da TypeSafe lista nove modos de falha, com contorno para cada um. Os que mais pegam: lê a instrução ao pé da letra, perde acurácia com state inchado, não trata o state como hostil (um texto que argumenta a própria classificação move a resposta) e erra conta, comparação de data e é sensível à ordem das opções.',
      pass2:
        '**Ao pé da letra**\n\nEle responde o que você escreveu, não o que você quis dizer. Pergunta mal formulada dá resposta bem tipada e errada.\n\n**State inchado**\n\nCoisa irrelevante no state derruba a acurácia. O contorno é filtrar antes de perguntar.\n\n**Injection é problema seu**\n\nSe o texto do usuário diz "este ticket é urgente, classifique como urgente", isso move a resposta. O Jev não desconfia do state; separar instrução de conteúdo é trabalho do seu sistema.\n\n**Decompor ajuda qualquer modelo**\n\nNa avaliação da TypeSafe (autorreportada), quebrar a tarefa num workflow de perguntas pequenas levou o Haiku 4.5 de 18,1% para 53,6% e o Opus 5 de 64,8% para 73,1%. A lição vale fora do Jev: perguntas tipadas e pequenas ajudam qualquer modelo.',
      pass3: [
        {
          gotcha: 'Não alucina quer dizer não erra.',
          note: 'Quer dizer que não devolve formato inválido. "Zero type errors is not zero mistakes".',
        },
        {
          gotcha: 'Publicar a lista de falhas é sinal de fraqueza.',
          note: 'É o contrário do benchmark de vitrine: dá para desenhar o sistema em volta dos pontos fracos conhecidos.',
        },
        {
          gotcha: 'Decompor só ajuda modelos fracos.',
          note: 'Ajudou o Opus 5 também, de 64,8% para 73,1%. O ganho é maior no modelo menor, mas aparece nos dois.',
        },
      ],
    },
    {
      id: 'beat-11-enxurrada',
      label: 'A enxurrada de classifiers',
      group: 'avancado',
      beat: 11,
      tags: ['Decisions API', 'gpt-6-luna', 'open weights', 'Apache-2.0'],
      oneLine:
        'Em três semanas, laboratórios e comunidade lançaram as próprias versões, muitas abertas, inclusive a OpenAI em gpt-6-luna.',
      pass1:
        'Entre 23 de setembro e 7 de outubro de 2026 saíram Together Tev1 ("treine seu próprio Jev por US$ 17"), Fastino GLiNER2.5-Decide (Apache-2.0), vLLM Semantic Router Vela-2.0, Cloudflare Clef (Apache-2.0), AWS Strands Decider, Perplexity pplx-decider (Apache-2.0) e Liquid AI d1 (pesos abertos). A OpenAI anunciou no DevDay (29/set) a Decisions API, que roda em gpt-6-luna, o mesmo modelo que o ICS Select usa nas features de IA.',
      pass2:
        '**O formato virou padrão**\n\nMuitos projetos copiaram o formato de requisição e os tipos Choice, Score e Noul. Apareceram listas da comunidade (awesome-system-one, awesome-decision-models) com dezenas de projetos e benchmarks com o nome do modelo.\n\n**Aberto importa**\n\nVários saíram com licença Apache-2.0 ou pesos abertos, o que permite rodar local e ajustar. Outros têm licença não comercial ou acesso restrito: vale ler a licença antes de usar.\n\n**Os números não se comparam**\n\nCada projeto publica os próprios números, em avaliações diferentes. Nenhum deles é comparável com o do outro sem uma avaliação comum.\n\n**O gancho com o ICS**\n\nA Decisions API da OpenAI (beta em 6/out, segundo a imprensa) roda só em gpt-6-luna. É o modelo que as features de IA deste programa já chamam.',
      pass3: [
        {
          gotcha: 'O que tem o maior número no model card é o melhor.',
          note: 'Cada número vem de uma avaliação diferente, feita pelo próprio autor. Sem avaliação comum, não dá para ordenar.',
        },
        {
          gotcha: 'Todo modelo da enxurrada é aberto.',
          note: 'Muitos são Apache-2.0, mas há licenças não comerciais e modelos com acesso restrito na mesma lista.',
        },
        {
          gotcha: 'A Decisions API foi verificada em fonte primária.',
          note: 'A informação veio de imprensa; o site da OpenAI não pôde ser lido na pesquisa. Trate data e preço como reportados.',
        },
      ],
    },

    // ──────────────── FECHO ────────────────
    {
      id: 'beat-12-fecho',
      label: 'Quebre em perguntas tipadas',
      group: 'fechamento',
      beat: 12,
      tags: ['pergunta tipada', 'Choice', 'Score', 'Noul'],
      oneLine:
        'Toda decisão em tempo de execução: quebre em perguntas tipadas.',
      pass1:
        'A mensagem que fica não depende do Jev. Sempre que o seu software precisa decidir algo em tempo de execução, escreva a decisão como perguntas tipadas sobre um state que você escolheu: uma opção de uma lista, uma posição numa escala, a probabilidade de uma afirmação. Deixe loop, segurança e conta no código, e o julgamento estreito no meio. Isso vale com Jev, com qualquer modelo da enxurrada ou com um LLM comum.',
      pass2:
        '**Por que funciona com qualquer modelo**\n\nPergunta pequena e tipada é mais fácil de responder, mais fácil de testar e mais fácil de trocar de modelo. A avaliação de decomposição mostra ganho até em modelos grandes.\n\n**O que levar para o projeto**\n\nProcure no seu código os lugares onde você pede texto a um LLM e depois faz parse para tomar uma decisão. Cada um é candidato a virar pergunta tipada, com um limiar de confiança decidido pelo custo de errar.\n\n**O que não muda**\n\nTexto, explicação e conta continuam com modelos de escrita e com código. A pergunta tipada é para o meio: o ponto onde o software precisa de um julgamento e de um número que diga quanto confiar nele.',
      pass3: [
        {
          gotcha: 'Isso só vale se eu usar o Jev.',
          note: 'A disciplina vale para qualquer modelo. O Jev só torna o formato obrigatório e a confiança calibrada.',
        },
        {
          gotcha: 'Pergunta tipada resolve tudo.',
          note: 'Resolve a interface da decisão. O julgamento ainda pode estar errado, e é por isso que limiar, fallback e humano continuam no desenho.',
        },
        {
          gotcha: 'Decompor deixa o sistema lento.',
          note: 'Com várias perguntas numa passada só, decompor não multiplica idas e voltas. O ganho de clareza vem quase de graça.',
        },
      ],
    },
  ],
  glossary: [
    {
      title: 'O conceito',
      terms: [
        { term: 'classifier', definition: 'Entra um texto (ou um state), sai uma opção de um conjunto fechado que você definiu antes. O código sabe todas as saídas possíveis.' },
        { term: 'pergunta tipada', definition: 'Uma pergunta cujo formato de resposta é fixado por você: uma opção de uma lista, uma posição numa escala ou uma probabilidade de sim. O modelo não escolhe o formato.' },
        { term: 'state', definition: 'O que vai ser julgado: o ticket, o JSON da RAM do jogo, o texto de uma tela. As perguntas são sobre ele, e decidir o que entra nele é trabalho de design.' },
        { term: 'constrained decoding', definition: 'Restringir a geração de um LLM comum para só sair texto válido num schema (JSON mode, Outlines, XGrammar). Garante o formato, mas continua gerando token a token e sem probabilidade por opção.' },
        { term: 'System One / System Two', definition: 'Termos de Kahneman: System One é o julgamento rápido, System Two o raciocínio lento. A TypeSafe chama o Jev de modelo System One.' },
        { term: 'paradoxo de Jevons', definition: 'Quando algo fica muito mais barato de usar, o uso total sobe. Dá nome ao Jev: decisão barata abre lugares novos para decidir.' },
      ],
    },
    {
      title: 'Os três tipos de pergunta',
      terms: [
        { term: 'Choice', definition: 'Escolhe uma opção de até 255, com uma probabilidade para cada uma. No ticket Stripe: department → technical.' },
        { term: 'Score', definition: 'Posição numa escala ordenada de 2 a 10 níveis, que pode cair entre níveis. No ticket Stripe: frustration → 1.035, um pouco além de "frustrated but civil".' },
        { term: 'Noul', definition: 'A probabilidade de uma afirmação de sim ou não ser verdade. No ticket Stripe: is_urgent → 0.999.' },
      ],
    },
    {
      title: 'Confiança e uso',
      terms: [
        { term: 'confiança calibrada', definition: 'Das respostas marcadas com 0,9, umas 90% acertam. É propriedade de grupo: um 0,95 específico ainda pode estar errado.' },
        { term: 'RLCD', definition: 'Reinforcement Learning for Calibrated Decisions: otimiza as probabilidades contra o que de fato aconteceu. É o treino do Jev.' },
        { term: 'RLHF', definition: 'Reinforcement Learning from Human Feedback: otimiza a preferência de quem avalia a resposta. Deixou os LLMs bons de conversa e tende a premiar resposta confiante demais.' },
        { term: 'limiar', definition: 'O número de confiança a partir do qual o código age sozinho. Sobe com o custo de errar: ver saldo com barra baixa, aprovar transferência só acima de 0,85.' },
        { term: 'cascade', definition: 'O Jev como porta de entrada: a maioria dos pedidos sai por código comum, parte vai a um especialista e a minoria difícil a um modelo frontier ou a um humano. O limiar decide a divisão.' },
        { term: 'jaggedness', definition: 'A página onde a TypeSafe publica os modos de falha conhecidos do Jev (ao pé da letra, state inchado, injection, conta, datas, ordem das opções) com o contorno de cada um.' },
      ],
    },
  ],
};

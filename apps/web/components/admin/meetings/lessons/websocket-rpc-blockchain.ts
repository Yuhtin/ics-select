import type { Lesson } from '../lesson-types';

// Fontes: Ethereum JSON-RPC spec (ethereum.org/developers/docs/apis/json-rpc)
// - EIP-1559 (eips.ethereum.org/EIPS/eip-1559) - Alchemy docs (eth_subscribe / newHeads)
// - MDN (Server-Sent Events, EventSource, WebSockets API) - RFC 6455 (WebSocket handshake)
// - Uber Eng "Real-time Push Platform" (o numero dos ~80% de polling vazio)
// - TAP Inteli Blockchain x Alphractal (escopo do modulo Fees, stack recomendada)
//
// Convencao de escrita desta aula: termo tecnico fica em ingles (gas, block,
// base fee, priority fee, node, API key, fee history), porque e assim que a
// turma vai encontrar na documentacao. Frase completa, sem cortar artigo nem
// verbo: esse texto e lido em voz alta na frente da sala.
export const websocketRpcBlockchain: Lesson = {
  slug: 'websocket-rpc-blockchain',
  title: 'WebSocket e RPC: do node ao pixel',
  subtitle: 'Por que um painel de gas em tempo real precisa de duas conexões abertas, e não de uma.',
  blurb:
    'A aula que destrava o projeto da parceria com a Alphractal. O time vai construir um painel que mostra o custo de gas do Ethereum ao vivo, e o TAP já entrega a stack decidida: WebSocket contra o node, SSE contra o painel. O que ninguém explicou foi o porquê. A gente parte do número que envelhece em 12 segundos, faz a conta do desperdício do polling, descobre o que é um node RPC e que o JSON-RPC é o formato da mensagem e não o transporte dela, abre uma conexão de verdade ao vivo com wscat contra a Alchemy e vê block chegando na tela, quebra essa conexão de propósito para achar o buraco que o retry sozinho não preenche, converte wei em dólar, e chega no beat que justifica o projeto inteiro (por que não plugar o React direto no node) e no que responde a objeção natural dele (o Next.js já é esse backend, e o que ele resolve e o que não resolve). Fecha com o desenho completo, que tem dois caminhos e não um. A regra que sai daqui: quem começa a conversa define o transporte, e o backend existe porque as duas pontas trabalham em ritmos diferentes.',
  durationMin: 90,
  audience: 'Inteli Blockchain · 1º e 2º ano · projeto Alphractal',
  slidesUrl: '/slides/websocket-rpc-blockchain.html',
  nodes: [
    // ──────────────── FOUNDATIONS (study-only) ────────────────
    {
      id: 'f-request-response',
      label: 'Request e response: o fetch que morre',
      group: 'foundations',
      teachFromZero: true,
      tags: ['http', 'fetch', 'request/response', 'keep-alive'],
      oneLine:
        'Todo backend que vocês escreveram até hoje funciona no mesmo ciclo: o cliente pergunta, o servidor responde, e a conversa acaba. A aula inteira é sobre quebrar esse ciclo.',
      pass1:
        'Quando o React chama `fetch("/api/fees")`, acontece uma sequência curta e fechada: o navegador abre a conexão, manda a requisição, o servidor responde, e a conexão se encerra. No Express é o espelho disso, `app.get("/fees", handler)`, e o handler só existe enquanto alguém está batendo na porta. Esse é o único modelo que a maioria de vocês usou até hoje, e ele tem uma limitação que quase ninguém diz em voz alta.',
      pass2:
        '**O ciclo completo**: o cliente abre a conexão, manda `GET /api/fees`, o servidor monta a resposta, devolve, e o assunto acaba ali. O servidor volta a não saber que você existe.\n\n**A limitação**: o servidor não consegue falar primeiro. Ele não guardou o seu endereço, não tem canal aberto com você, e mesmo que quisesse te avisar de alguma coisa, não teria por onde. Toda informação que você recebe é a resposta de uma pergunta que você fez.\n\n**O keep-alive não resolve isso**: o HTTP/1.1 reaproveita o mesmo socket TCP para as próximas requisições, o que economiza handshake. Mas o modelo continua sendo pergunta e resposta. Reaproveitar o canal não dá ao servidor o direito de falar sem ser perguntado.\n\n**No projeto**: a aba Fees da Alphractal hoje funciona exatamente assim. Você abre a página, o React faz um fetch, recebe a média histórica, e o número congela na tela. O TAP chama isso de "ponto cego em relação à volatilidade instantânea". O ponto cego não está no dado, está no modelo de conexão.',
      pass3: [
        {
          gotcha: 'Achar que o servidor "manda" a resposta',
          note: 'Ele devolve. A diferença importa: devolver é reagir a uma pergunta, e mandar é começar a conversa. Nenhum servidor HTTP comum começa uma conversa.',
        },
        {
          gotcha: 'Confundir keep-alive com conexão viva',
          note: 'O keep-alive mantém o socket TCP disponível para reuso, mas o servidor continua calado enquanto você não perguntar. O canal fica aberto, a boca fica fechada.',
        },
        {
          gotcha: 'Achar que isso é uma limitação do JavaScript',
          note: 'É uma limitação do modelo request e response do HTTP. Vale igual em Python, Go ou Java. O que muda o jogo é o protocolo, não a linguagem.',
        },
      ],
      anchor:
        'Você chamou `fetch("/api/fees")` e recebeu o número. Um segundo depois, o valor mudou no servidor. O que o servidor pode fazer para te avisar?',
      followup:
        'Se ele não tem como te avisar, e você precisa do número novo, o que sobra para o cliente fazer?',
      gotcha:
        'Se alguém responder "o servidor manda um push", devolva: "por qual conexão? A sua fechou no instante em que a resposta chegou".',
    },

    // ──────────────── O NODE E O PROTOCOLO ────────────────
    {
      id: 'numero-que-envelhece',
      label: 'O número que envelhece',
      group: 'rpc',
      beat: 1,
      teachFromZero: true,
      tags: ['block time', 'base fee', 'polling', 'cota do provedor'],
      oneLine:
        'O preço de gas muda a cada block novo, e um block novo sai a cada 12 segundos. Um número lido uma vez já está errado 12 segundos depois.',
      pass1:
        'O Ethereum fecha um block a cada 12 segundos, num relógio fixo. Cada block carrega o seu próprio preço de gas, e esse preço pode subir ou descer até 12,5% em relação ao block anterior. Ou seja: o número que você mostra na tela tem prazo de validade de 12 segundos, e ele vence sem avisar ninguém. O primeiro instinto para resolver isso é perguntar de novo, então vamos fazer a conta desse instinto.',
      pass2:
        '**O relógio da rede**: são 12 segundos por block, fixos desde o Merge. A cada block novo o **base fee** é recalculado, e a variação máxima de um block para o seguinte é de 12,5%. Em cinco minutos de rede congestionada, o custo dobra.\n\n**O instinto e a conta**: perguntar ao servidor de 1 em 1 segundo. Isso se chama **polling**. Em 12 segundos você faz 12 perguntas, e 11 delas devolvem exatamente o mesmo número. São 92% de respostas repetidas.\n\n**Nenhuma frequência conserta isso**: acelerar para 200 milissegundos multiplica o desperdício por cinco. Desacelerar para 30 segundos coloca um número velho na tela de alguém que está prestes a mandar uma ordem. O problema não está na frequência, está em quem faz a pergunta.\n\n**Você paga em três moedas**: banda, bateria do cliente, e cota do provedor de node. Um polling de 1 segundo dá 86.400 requisições por dia, por aba aberta. Com 50 pessoas com o painel aberto, são 4,3 milhões de requisições diárias para receber 7.200 blocks.\n\n**No projeto**: o TAP pede "ingestão contínua de dados ao vivo, capturando a volatilidade das taxas e o lançamento de novos blocos instantaneamente". A palavra que resolve isso não é "mais rápido". É "quem avisa quem".',
      pass3: [
        {
          gotcha: 'Achar que um polling de 200ms é "tempo real"',
          note: 'Parece tempo real, e é o mesmo desperdício multiplicado por cinco. O block continua saindo de 12 em 12 segundos. Você só passou a perguntar mais vezes no vazio.',
        },
        {
          gotcha: 'Esquecer que a cota do provedor é finita',
          note: 'A Alchemy e a Infura cobram por volume de requisição. Um polling agressivo queima o plano do projeto em poucos dias, e a demo do dia 05/10 morre com um erro 429.',
        },
        {
          gotcha: 'Confundir block novo com transação nova',
          note: 'Um block sai a cada 12 segundos. Transações entram na mempool o tempo todo, muito mais rápido que isso. São duas taxas de chegada diferentes, e vocês vão ter que escolher qual delas escutar.',
        },
        {
          gotcha: 'Assumir que o preço só sobe',
          note: 'O base fee cai quando o block anterior ficou abaixo da meta de gas. O painel precisa mostrar a queda com o mesmo destaque que mostra a alta.',
        },
      ],
      anchor:
        'Você abre a aba Fees às 15:00:00 e o custo estimado está certo. Às 15:00:13 ele está errado, e ninguém avisou a tela. O que mudou nesses 13 segundos? E o que o navegador teria que fazer para descobrir isso sozinho?',
      askWho: [
        {
          name: 'quem já consumiu API com fetch ou axios',
          why: 'A resposta natural dessa pessoa vai ser "faz outro fetch", que é exatamente o polling. Você quer essa resposta em voz alta para poder fazer a conta em cima dela.',
        },
        {
          name: 'quem já rodou um node ou usou o Etherscan',
          why: 'Provavelmente sabe o block time de cor. É bom para ancorar os 12 segundos sem que você precise afirmar.',
        },
        { name: 'open', why: 'É a pergunta de abertura, então vale deixar a sala responder junto antes de nomear alguém.' },
      ],
      followup:
        'Você perguntou 12 vezes e ouviu a mesma coisa 11 vezes. Quem nesse desenho sabia, o tempo todo, o instante exato em que o número mudou?',
      gotcha:
        'Se alguém disser "é só diminuir o intervalo do setInterval", devolva: "para 100 milissegundos? Então são 120 perguntas por block e 119 respostas iguais. Qual intervalo faz esse desperdício virar zero?"',
      scenarios: {
        right: {
          shape:
            'Identifica que saiu um block novo e que o base fee mudou junto, e percebe que o navegador só descobre isso perguntando de novo. É um bônus se já sente que perguntar em loop é desperdício.',
          redirect:
            'Faça a conta com ele na lousa: "12 perguntas, 11 respostas iguais. Agora, quem no sistema inteiro sabia na hora exata que o block tinha saído?"',
        },
        close: {
          shape:
            'Diz que o dado ficou velho, mas não conecta isso com o block, ou propõe recarregar a página como solução.',
          redirect:
            'Aterre no relógio: "de quanto em quanto tempo o Ethereum fecha um block? E o preço muda junto com ele, ou é independente?"',
        },
        wayOff: {
          shape:
            'Acha que a blockchain notifica o site sozinha, ou que o valor deveria vir sempre atualizado só por ser blockchain.',
          redirect:
            'Puxe para o concreto sem corrigir: "o seu site tem um endereço fixo na internet? Como a rede saberia para onde mandar esse aviso?"',
        },
      },
      diagram:
        'sequenceDiagram\n  participant B as Backend\n  participant N as Nó Ethereum\n  Note over B,N: POLLING: pergunta a cada 1s\n  B->>N: eth_blockNumber\n  N-->>B: 0x1699A32\n  B->>N: eth_blockNumber\n  N-->>B: 0x1699A32 (igual, resposta jogada fora)\n  Note over B,N: 12 perguntas por bloco, 11 repetidas (92% desperdício)\n  Note over B,N: PUSH: assina uma vez\n  B->>N: eth_subscribe ["newHeads"]\n  N-->>B: subscription id\n  N-->>B: bloco 23481902\n  N-->>B: bloco 23481903\n  Note over B,N: 1 mensagem por bloco, zero perguntas',
      diagramUrl: '/diagrams/websocket-rpc-blockchain/polling-vs-push.png',
    },
    {
      id: 'no-rpc',
      label: 'O node: onde a blockchain atende',
      group: 'rpc',
      beat: 2,
      teachFromZero: true,
      tags: ['node', 'estado', 'mempool', 'Alchemy / Infura', 'API key'],
      oneLine:
        'Não existe uma api.ethereum.org. Existem milhares de nodes, cada um com uma cópia da rede, e o seu backend conversa com um deles.',
      pass1:
        'A blockchain não é um servidor com uma API oficial. Ela é uma rede de milhares de máquinas, e cada uma guarda a mesma cópia da cadeia e do estado atual. Para ler qualquer coisa, o seu backend precisa falar com **um node**. Rodar o seu próprio node exige cerca de 1,2 TB de SSD e alguns dias sincronizando, então na prática você aluga: a Alchemy, a Infura e a QuickNode mantêm nodes de pé e entregam uma URL com uma API key.',
      pass2:
        '**O que um node guarda**: a cadeia inteira de blocks, o estado atual (saldos e contratos), e a **mempool**, que é a fila de transações já enviadas mas que ainda não entraram em nenhum block. A mempool é o lugar onde a pressão de gas aparece antes de o preço subir.\n\n**Dois endereços para o mesmo node**: `https://eth-mainnet.g.alchemy.com/v2/API_KEY` e `wss://eth-mainnet.g.alchemy.com/v2/API_KEY`. É a mesma máquina, com os mesmos métodos disponíveis. O que muda entre as duas é o transporte. Guarde essa frase, porque o beat seguinte vive dela.\n\n**A API key é duas coisas ao mesmo tempo**: ela é a sua identidade e é a sua cota. Ela conta quanto você já consumiu e quanto ainda pode consumir. Quem tiver a chave gasta no seu nome, então ela é um segredo que mora no backend.\n\n**No projeto**: o TAP recomenda literalmente "WebSockets via provedores RPC (ex.: Alchemy/Infura)". A chave vai numa variável de ambiente do backend em Node, num `.env` que não entra no commit. E o repositório do projeto é público sob licença MIT, então uma chave commitada ali é uma chave publicada para o mundo.',
      pass3: [
        {
          gotcha: 'Achar que "a blockchain" responde',
          note: 'Quem responde é um node. Se esse node estiver desatualizado ou fora do ar, você vê dado velho ou não vê dado nenhum. A sua leitura vale o que valer a máquina que você escolheu.',
        },
        {
          gotcha: 'Commitar a API key',
          note: 'Bots de scraping encontram chaves em repositório público em questão de minutos. E o TAP determina repositório público sob MIT, então aqui o risco é certo, não hipotético.',
        },
        {
          gotcha: 'Confundir mempool com block',
          note: 'A mempool é o que ainda não aconteceu, e o block é o que já aconteceu. As duas coisas têm taxas de chegada muito diferentes, e escolher a errada é o que vai travar o painel.',
        },
        {
          gotcha: 'Achar que precisa rodar um node próprio para aprender',
          note: 'Não precisa. A chave gratuita da Alchemy resolve a aula inteira e o protótipo inteiro. Rodar node próprio é uma decisão de custo e de soberania, não de aprendizado.',
        },
      ],
      anchor:
        'Você precisa do preço de gas atual do Ethereum, e descobre que não existe uma api.ethereum.org. Qual servidor o seu backend vai chamar, e por que é esse servidor que tem a resposta?',
      askWho: [
        {
          name: 'quem já criou uma chave na Alchemy ou na Infura',
          why: 'Já viu as duas URLs (a https e a wss) na tela do dashboard, e provavelmente nunca parou para pensar por que existem duas. É o gancho perfeito.',
        },
        {
          name: 'quem já configurou uma rede customizada na MetaMask',
          why: 'Já colou uma RPC URL na mão em algum momento. Esse é o gancho concreto: aquilo ali era o endereço de um node.',
        },
        { name: 'open', why: 'Se ninguém tiver prática, deixe a sala especular antes de você entregar o conceito.' },
      ],
      followup:
        'Você já tem a URL do node. O que exatamente você manda dentro dessa requisição para ele entender que você quer o último block?',
      gotcha:
        'Se alguém disser "é só chamar a API do Ethereum", devolva: "quem mantém essa API de pé, e quem paga a conta dessa máquina?"',
      scenarios: {
        right: {
          shape:
            'Diz que fala com um node, e entende que esse node guarda uma cópia da cadeia. É um bônus se cita um provedor hospedado como Alchemy ou Infura e menciona que existe uma chave.',
          redirect:
            'Confirme e avance para o protocolo: "esse node te dá duas URLs, uma https e uma wss, com os mesmos métodos nas duas. Então o que muda entre elas?"',
        },
        close: {
          shape:
            'Sabe que precisa de um provedor, mas trata isso como caixa preta, sem entender que é um node completo, com estado e mempool.',
          redirect:
            'Abra a caixa: "o que essa máquina precisa guardar para conseguir te responder qual é o saldo de um endereço qualquer?"',
        },
        wayOff: {
          shape:
            'Propõe raspar o Etherscan, ou acha que existe um endpoint oficial e central mantido pela Ethereum Foundation.',
          redirect:
            'Sem corrigir direto: "se existisse um servidor central oficial e ele caísse, a rede toda pararia? Então onde o dado realmente mora?"',
        },
      },
    },
    {
      id: 'json-rpc',
      label: 'JSON-RPC: o formato não é o transporte',
      group: 'rpc',
      beat: 3,
      teachFromZero: true,
      tags: ['JSON-RPC 2.0', 'method', 'params', 'id', 'eth_feeHistory', 'hexadecimal'],
      oneLine:
        'O JSON-RPC define o que você escreve. O HTTP e o WebSocket definem por onde essa mensagem viaja. Trocar o transporte não muda nada na mensagem.',
      pass1:
        'Todo pedido para um node Ethereum tem a mesma forma, definida pelo padrão JSON-RPC 2.0: um objeto com `jsonrpc`, `method`, `params` e `id`. O node responde com um objeto que carrega o mesmo `id`, e é assim que você casa uma resposta com a pergunta que a originou. É simples de propósito, porque a graça está em outro lugar: esse mesmo envelope viaja por HTTP ou por WebSocket sem mudar nada.',
      pass2:
        '**O envelope, campo a campo**: o `method` é o que você quer (`eth_blockNumber`), o `params` é a lista de argumentos, e o `id` é um número que você escolhe e que volta na resposta. O `jsonrpc` é sempre "2.0".\n\n**A separação que trava a maioria**: o JSON-RPC é o **formato**, e o HTTP e o WebSocket são o **transporte**. O mesmo `{"method":"eth_blockNumber","params":[]}` sai idêntico nos dois. O que a troca de transporte muda não é o conteúdo da mensagem, e sim **quem tem permissão de falar primeiro**.\n\n**Os métodos que vocês vão usar no projeto**: o `eth_blockNumber` devolve o número do último block, e é a chamada mais barata que existe, boa para verificar se a conexão com o node está funcionando. O `eth_getBlockByNumber` devolve o block inteiro, com o base fee, o gas consumido e o timestamp. O `eth_feeHistory` devolve o histórico de priority fee dos últimos N blocks, já separado por percentil, e é a partir desses percentis que o painel monta as faixas lenta, média e rápida.\n\n**Os valores voltam em hexadecimal**: `"baseFeePerGas": "0x2540be400"` é uma string, começa com 0x, e você converte antes de fazer qualquer conta. Valores em wei passam de 2^53, então o `parseInt` perde precisão e o certo é usar `BigInt`.\n\n**No projeto**: o `eth_feeHistory` é o método que entrega as três faixas de velocidade que o painel do TAP precisa mostrar, sem que vocês tenham que inventar heurística nenhuma.',
      pass3: [
        {
          gotcha: 'Fazer conta direto no hexadecimal',
          note: 'O "0x2540be400" não é um número em JavaScript, é uma string. Some com outro e você concatena texto em vez de somar valores.',
        },
        {
          gotcha: 'Usar Number para guardar wei',
          note: 'Um ETH são 10^18 wei, e o inteiro seguro do JavaScript vai até cerca de 9 × 10^15. Use BigInt para guardar, e só converta para float depois de dividir para gwei.',
        },
        {
          gotcha: 'Ignorar o campo id',
          note: 'Com HTTP ele não incomoda, porque a resposta vem na mesma requisição. Com WebSocket você tem várias respostas chegando pelo mesmo canal, e o id é a única forma de saber qual é qual.',
        },
        {
          gotcha: 'Achar que precisa trocar de biblioteca para trocar de transporte',
          note: 'A viem e a ethers têm o mesmo cliente para os dois. Você troca `http(url)` por `webSocket(url)` e o resto do código continua igual.',
        },
      ],
      anchor:
        'Rode um `curl` num node pedindo o número do último block. Agora mande exatamente o mesmo pedido por WebSocket. O que muda de um para o outro, e o que continua idêntico nos dois?',
      askWho: [
        {
          name: 'quem já usou ethers.js ou viem',
          why: 'Já chamou `provider.getBlockNumber()` sem ver o JSON por baixo. O ganho aqui é mostrar que aquilo era um envelope JSON-RPC o tempo todo.',
        },
        {
          name: 'quem já leu documentação de API REST',
          why: 'Vai estranhar que o método vai no corpo e não na URL. Esse estranhamento é o ponto: o JSON-RPC não é REST, e tudo é POST no mesmo endpoint.',
        },
        { name: 'open', why: 'A pergunta funciona bem em grupo, porque quase ninguém pensou na diferença entre formato e transporte.' },
      ],
      followup:
        'Se o envelope é igual nos dois, então trocar HTTP por WebSocket não muda o que você manda. O que é que muda, então?',
      gotcha:
        'Se alguém disser "WebSocket é mais rápido", devolva: "mais rápido para quê? O JSON tem o mesmo tamanho e a rede é a mesma. O que ele te dá que o HTTP não dá?"',
      scenarios: {
        right: {
          shape:
            'Percebe que o JSON é idêntico e que só o canal muda, e nomeia que no WebSocket a conexão continua aberta depois da resposta. É um bônus se já intui que isso permite ao servidor mandar mensagem sem ser perguntado.',
          redirect:
            'Confirme e entregue o próximo beat: "isso. E se a conexão continua aberta, o que o node passa a poder fazer que antes era impossível?"',
        },
        close: {
          shape:
            'Vê que o JSON é o mesmo, mas atribui a diferença a performance ou a ser mais moderno, sem chegar em quem começa a conversa.',
          redirect:
            'Force a direção: "depois que a resposta chega, o que acontece com a conexão em cada caso? E quem consegue mandar a próxima mensagem?"',
        },
        wayOff: {
          shape:
            'Acha que o WebSocket usa outro formato de mensagem, ou que precisaria de outra biblioteca e de outros métodos.',
          redirect:
            'Mostre os dois lado a lado sem corrigir: "esse é o JSON do curl, e esse é o que eu mando no wscat. Aponta para mim a diferença entre os dois textos."',
        },
      },
    },

    // ──────────────── A CONEXÃO VIVA ────────────────
    {
      id: 'websocket',
      label: 'WebSocket: a conexão que não fecha',
      group: 'live',
      beat: 4,
      teachFromZero: true,
      tags: ['upgrade', '101', 'frames', 'eth_subscribe', 'newHeads', 'wscat'],
      oneLine:
        'Ele começa como uma requisição HTTP normal, ganha um 101, e a partir daí os dois lados falam quando quiserem pelo mesmo socket.',
      pass1:
        'O WebSocket resolve exatamente o problema do beat 1: ele deixa o servidor falar primeiro. E o truque é elegante. Ele **começa** como uma requisição HTTP comum, com um cabeçalho pedindo `Upgrade: websocket`. O servidor responde `101 Switching Protocols`, e aquele mesmo socket TCP para de falar HTTP e passa a trocar frames nos dois sentidos. É por isso que o WebSocket atravessa firewall e proxy corporativo: na porta de entrada, ele parecia HTTP.',
      pass2:
        '**O handshake**: o cliente manda um `GET` com `Upgrade: websocket`, `Connection: Upgrade` e uma `Sec-WebSocket-Key` aleatória. O servidor responde `101` com a `Sec-WebSocket-Accept` derivada dessa chave. Isso acontece uma vez só, no começo. Depois disso ninguém manda cabeçalho HTTP nunca mais, só frames.\n\n**A inversão acontece aqui**: você manda `{"jsonrpc":"2.0","id":1,"method":"eth_subscribe","params":["newHeads"]}` e recebe de volta um id de assinatura. A partir desse instante, a cada block novo, o node manda a mensagem sozinho. Você não pergunta mais nada.\n\n**Repare no campo que sumiu**: as mensagens que o node envia **não têm `id`**. Elas chegam com `"method":"eth_subscription"` e o payload dentro de `params.result`. E faz todo sentido: o `id` serve para casar uma resposta com a pergunta que a originou, e aqui não houve pergunta nenhuma.\n\n**Existem outros canais além do newHeads**: o canal `logs` entrega eventos emitidos por contratos, e dá para filtrar por endereço e por tópico. O `newPendingTransactions` entrega a mempool crua, transação por transação. Guardem o nome desse último, porque ele volta como armadilha no beat 9.\n\n**No projeto**: isso aqui é o salto 1 inteiro. Quando o TAP escreve "conexão blockchain: WebSockets via provedores RPC", ele está falando exatamente desse `eth_subscribe`. A semana 2 do cronograma de vocês é fazer essa linha funcionar.',
      pass3: [
        {
          gotcha: 'Achar que o WebSocket é um protocolo separado desde o começo',
          note: 'Ele nasce de um GET HTTP. Sem o handshake de upgrade não existe WebSocket. E é justamente por nascer como HTTP que ele passa em proxy e em firewall.',
        },
        {
          gotcha: 'Procurar o campo id nas mensagens de push',
          note: 'Elas não têm esse campo. Se o seu código casa mensagens por id, os blocks vão chegar e ser descartados em silêncio. O campo certo para identificar essas mensagens é o method.',
        },
        {
          gotcha: 'Assinar newPendingTransactions "para ter mais dado"',
          note: 'São milhares de mensagens por segundo. Você satura o processo e estoura a cota sem ter olhado uma linha do resultado. Para custo de gas, o newHeads basta.',
        },
        {
          gotcha: 'Esquecer que a assinatura morre junto com a conexão',
          note: 'Se reconectou, a assinatura se perdeu. É preciso mandar o eth_subscribe de novo, sempre. Esse é o beat seguinte.',
        },
      ],
      anchor:
        'O node precisa te avisar quando sair um block novo. Só que ele não sabe o seu endereço, e a sua conexão HTTP já fechou. O que precisa acontecer antes disso, para que ele consiga falar primeiro?',
      askWho: [
        {
          name: 'quem já mexeu com socket.io ou com chat em tempo real',
          why: 'Provavelmente usou WebSocket sem nunca ver o handshake. Comece por essa pessoa para tirar o "é mágica" da mesa e chegar no 101.',
        },
        {
          name: 'quem fez o módulo de redes',
          why: 'Tem TCP na bagagem e consegue articular que a conexão é a mesma, e que só o protocolo que roda em cima dela é que muda.',
        },
        {
          name: 'quem já abriu a aba Network do DevTools',
          why: 'Dá para pedir que ela descreva o que aparece ali quando uma conexão WebSocket sobe. O 101 fica visível na tela.',
        },
      ],
      followup:
        'A conexão está aberta e os blocks estão chegando sozinhos. Agora eu vou tirar a máquina da rede por 40 segundos. O que acontece?',
      gotcha:
        'Se alguém disser "WebSocket é sempre melhor que HTTP", devolva: "então por que o handshake dele é feito em HTTP? E por que você ainda vai precisar de HTTP no beat 5?"',
      scenarios: {
        right: {
          shape:
            'Chega em manter a conexão aberta, e no melhor caso nomeia que o cliente precisa se registrar antes, o que é a assinatura. É um bônus se cita o upgrade ou o 101.',
          redirect:
            'Confirme e abra o lab: "exato, e essa conexão aberta é o que o handshake faz. Vamos abrir uma agora e ver o block chegando."',
        },
        close: {
          shape:
            'Diz "usa WebSocket", mas não sabe como ele começa, ou acha que ele roda numa porta separada, num protocolo sem nenhuma relação com o HTTP.',
          redirect:
            'Puxe para o handshake: "se fosse um protocolo totalmente separado, ele passaria no firewall de uma empresa? Como é que ele consegue passar?"',
        },
        wayOff: {
          shape:
            'Propõe que o backend exponha um endpoint para o node chamar (um webhook), ou acha que o node guarda o seu IP e conecta de volta depois.',
          redirect:
            'Exponha a contradição: "para ele te chamar, o seu backend precisa ter endereço público e estar de pé. E se ele estiver atrás de um NAT, na sua casa? Quem consegue começar a conexão nesse cenário?"',
        },
      },
      diagram:
        'sequenceDiagram\n  participant C as Backend Node.js\n  participant N as Nó (Alchemy)\n  Note over C,N: 1. começa como HTTP comum\n  C->>N: GET /v2/CHAVE + Upgrade: websocket\n  N-->>C: 101 Switching Protocols\n  Note over C,N: 2. mesmo TCP, agora em frames\n  C->>N: eth_subscribe ["newHeads"]\n  N-->>C: id 1, result 0x9ce59a13 (subscription)\n  Note over C,N: 3. daqui pra frente o nó fala sozinho\n  N-->>C: eth_subscription (bloco 23481902)\n  N-->>C: eth_subscription (bloco 23481903)\n  Note over C,N: repare: as mensagens de push não têm id',
      diagramUrl: '/diagrams/websocket-rpc-blockchain/handshake.png',
    },
    {
      id: 'reconexao',
      label: 'Quando a conexão cai: retry e backfill',
      group: 'live',
      beat: 5,
      tags: ['retry', 'backoff', 'jitter', 'heartbeat', 'backfill'],
      oneLine:
        'A conexão vai cair, e reconectar é trabalho seu. Só que reconectar sozinho não devolve os blocks que passaram enquanto você estava fora.',
      pass1:
        'Uma conexão que fica aberta por horas vai cair. Um deploy reinicia o processo, o wifi do Inteli oscila, o provedor derruba conexões ociosas, a máquina dorme. O WebSocket não reconecta sozinho, diferente do SSE que vocês vão ver mais para a frente. E existe um problema pior do que a reconexão: enquanto você esteve fora, a rede continuou produzindo blocks, e ninguém guardou esses blocks para você.',
      pass2:
        '**O retry é código seu**: no evento `close`, tente de novo com **backoff exponencial** (1s, 2s, 4s, 8s, até um teto de 30s) e some um valor aleatório em cima, que é o **jitter**. Sem esse valor aleatório, quando o provedor cair e voltar, todos os seus clientes reconectam no mesmo milissegundo e derrubam ele de novo.\n\n**Uma conexão morta continua parecendo viva**: o TCP não te avisa quando o outro lado sumiu sem fechar direito. Você fica escutando um canal vazio achando que a rede está calma. O jeito de saber é mandar um **ping** a cada 30 segundos e derrubar a conexão se o pong não voltar.\n\n**O buraco é o bug de verdade**: 40 segundos fora são cerca de 3 blocks que você nunca viu. Você reconecta, manda o `eth_subscribe` de novo, e o stream volta a partir do block atual. O gráfico do painel fica com um dente e ninguém entende de onde ele veio.\n\n**O conserto se chama backfill, e a ordem dele importa**: guarde o número do último block que você processou. Ao reconectar, **assine primeiro** e guarde num buffer o que já começar a chegar. Só então descubra onde a rede está (`eth_blockNumber` por HTTP), busque do seu último até lá (`eth_getBlockByNumber`, com o número em hexadecimal e o segundo parâmetro em `false`, para não trazer as transações inteiras), e no fim solte o buffer. Se você inverter e assinar por último, os blocks que saírem durante a busca não entram nem no backfill nem no stream, e você abre um buraco novo consertando o antigo.\n\n**A regra que sai daqui**: o WebSocket entrega o presente, e o HTTP busca o passado. Os dois convivem no mesmo serviço, e é por isso que você configura os dois transportes.\n\n**No projeto**: a semana 3 do cronograma é "resolução de bugs e polimento". Esse é o bug, e ele tem uma característica cruel: em vinte minutos de teste local ele nunca aparece. Ele aparece na demo do dia 05/10.',
      pass3: [
        {
          gotcha: 'Fazer retry em loop apertado',
          note: 'Sem backoff você bate no provedor 50 vezes por segundo durante a queda dele, toma rate limit, e vira parte do problema. Backoff exponencial com jitter, sempre.',
        },
        {
          gotcha: 'Reconectar e não assinar de novo',
          note: 'A assinatura vive dentro da conexão. Conexão nova significa assinatura zerada. O socket abre, tudo parece certo, e não chega block nenhum.',
        },
        {
          gotcha: 'Confiar que "sem erro" significa "conectado"',
          note: 'Uma conexão meio-aberta não dispara erro nenhum. Sem heartbeat você fica horas achando que está escutando, com a tela congelada.',
        },
        {
          gotcha: 'Achar que dá para assinar de novo e receber o passado',
          note: 'O eth_subscribe entrega do momento da assinatura em diante. O passado só sai por chamada HTTP explícita. Não existe replay no stream.',
        },
        {
          gotcha: 'Assinar depois de preencher o buraco',
          note: 'Se o backfill leva oito segundos, os blocks que saírem nesses oito segundos já passaram do alvo da busca e ainda não estão na assinatura. Some um buraco novo ao antigo. Assine primeiro, guarde num buffer, e solte no final.',
        },
        {
          gotcha: 'Buscar o intervalo inteiro, sem teto',
          note: 'Três dias fora são 21.600 blocks. Ponha um teto (umas 300 cobrem quatro horas) e marque o resto como buraco no gráfico. Se ainda for muita chamada, o JSON-RPC aceita um array de requisições, mas aí a resposta volta fora de ordem e é o id que casa cada uma.',
        },
        {
          gotcha: 'Passar o número do block em decimal',
          note: 'O eth_getBlockByNumber quer hexadecimal. E o segundo parâmetro não é opcional: com `true` cada block vem com todas as transações completas, e para o base fee você só precisa do header.',
        },
      ],
      anchor:
        'O seu backend fica 40 segundos sem rede, volta, reconecta e assina o `newHeads` de novo. O que aconteceu com os blocks daquele intervalo? E como o painel percebe que perdeu alguma coisa?',
      askWho: [
        {
          name: 'quem já perdeu conexão no meio de um deploy',
          why: 'Tem a cicatriz e vai reconhecer o cenário rápido. É bom para trazer o problema para o concreto antes de você nomear ele.',
        },
        {
          name: 'quem já implementou retry em chamada de API',
          why: 'Provavelmente fez um retry de intervalo fixo. O ganho aqui é a diferença entre isso e backoff exponencial com jitter.',
        },
        { name: 'open', why: 'A parte do buraco de dados quase nunca ocorre a ninguém de primeira. Deixe a sala tropeçar antes de entregar.' },
      ],
      followup:
        'Você preencheu o buraco por HTTP, e agora o dado bruto está completo. Só que ele está em hexadecimal e em wei, e o investidor quer ver dólar.',
      gotcha:
        'Se alguém disser "é só reconectar", devolva: "você reconectou às 15:00:40. O block das 15:00:12 chega para você depois disso?"',
      scenarios: {
        right: {
          shape:
            'Diz que perdeu os blocks do intervalo e que precisa buscar eles de outro jeito. É um bônus se propõe guardar o último block visto e buscar o intervalo por chamada HTTP.',
          redirect:
            'Nomeie a regra junto com ele: "isso se chama backfill. Então no mesmo serviço vocês vão ter dois transportes. Qual deles serve para quê?"',
        },
        close: {
          shape:
            'Trata só da reconexão (backoff, retry) e não percebe que existe um buraco de dados que continua lá mesmo com o retry perfeito.',
          redirect:
            'Isole o problema: "você reconectou perfeitamente, em 1 segundo. Os 3 blocks que saíram enquanto você estava fora chegam sozinhos agora?"',
        },
        wayOff: {
          shape:
            'Acha que o node guarda uma fila do que você perdeu e entrega tudo no momento em que você reconecta, como o Kafka faria.',
          redirect:
            'Puxe a consequência: "se o node guardasse uma fila para cada cliente desconectado, quanto de memória isso custaria para ele com 100 mil clientes?"',
        },
      },
    },

    // ──────────────── DO DADO AO PAINEL ────────────────
    {
      id: 'gwei-usd',
      label: 'Do wei ao dólar',
      group: 'panel',
      beat: 6,
      teachFromZero: true,
      tags: ['wei', 'gwei', 'EIP-1559', 'base fee', 'priority fee', '21.000 gas'],
      oneLine:
        'O block entrega wei por unidade de gas, em hexadecimal. O investidor quer ver dólar por operação. Entre os dois existem quatro passos, e o último não vem da blockchain.',
      pass1:
        'Chegou o block com `"baseFeePerGas": "0x2540be400"`. Esse número é o preço de UMA unidade de gas, em wei. Ninguém toma decisão olhando para isso. A entrega que o TAP pede é "converter as métricas brutas da blockchain em estimativas financeiras reais", e essa conversão tem uma etapa que não vem do node.',
      pass2:
        '**As unidades**: um ETH são 10^18 wei. Um gwei são 10^9 wei, e gwei é a unidade em que o mundo fala de gas. O `0x2540be400` são 10.000.000.000 wei, ou seja, 10 gwei.\n\n**O EIP-1559, que é o modelo de preço**: cada block define um **base fee** que é queimado, e o usuário adiciona um **priority fee** que vai para o validador. O custo total de uma transação é `gas consumido × (base fee + priority fee)`. O base fee sobe até 12,5% quando o block anterior passou de 15 milhões de gas, e cai quando ficou abaixo disso, então ele funciona como um termômetro de congestionamento.\n\n**A conta que vira o número da tela**: uma transferência simples de ETH consome **21.000 de gas**, sempre, por especificação. Então 21.000 × 10 gwei dá 210.000 gwei, que dá 0,00021 ETH. Com o ETH a 3.000 dólares, dá **US$ 0,63**. Esse é o número que o painel mostra.\n\n**Cuidado com as duas divisões por 10^9**: a primeira converte wei para gwei, e a segunda converte gwei para ETH. Cada degrau dessa escala é de 10^9, então o mesmo fator aparece duas vezes no código e parece um erro de digitação. Não é, e vale explicar isso em voz alta, porque a sala trava aí.\n\n**O passo que não vem do node**: a cotação do ETH em dólar. O node não tem como saber quanto vale um ETH, porque isso é informação de mercado. Vocês vão precisar de uma segunda fonte (a própria Alphractal tem), com cache, e com um valor de reserva para quando ela falhar. Se essa fonte cair e vocês não tratarem, o painel inteiro mostra `NaN`.',
      pass3: [
        {
          gotcha: 'Usar Number para guardar wei',
          note: '10^18 passa do inteiro seguro do JavaScript. Some dois valores e o resultado vem errado, sem lançar erro nenhum. Use BigInt para guardar, e converta para float só depois de dividir para gwei.',
        },
        {
          gotcha: 'Mostrar gwei achando que aquilo é o custo',
          note: 'Gwei é preço por unidade de gas, não é o custo da operação. Sem multiplicar pelo gas consumido, o número não significa nada para o usuário.',
        },
        {
          gotcha: 'Assumir 21.000 de gas para qualquer coisa',
          note: 'Os 21.000 valem para uma transferência simples de ETH. Um swap na Uniswap passa de 150.000. O painel precisa deixar claro qual operação ele está precificando.',
        },
        {
          gotcha: 'Esquecer que a cotação do ETH tem o ritmo dela',
          note: 'O gas atualiza a cada 12 segundos, e o preço do ETH atualiza em outro ritmo. São dois relógios, e o número em dólar é o produto dos dois.',
        },
      ],
      anchor:
        'Chegou o block com `baseFeePerGas: "0x2540be400"`. O investidor precisa ler "transferência simples: US$ 0,63". Quais conversões existem entre um e outro, e qual delas não vem do node?',
      askWho: [
        {
          name: 'quem já pagou gas numa carteira',
          why: 'Já viu a MetaMask mostrar gwei e dólar lado a lado. Peça que ela descreva o que a carteira estava fazendo por baixo.',
        },
        {
          name: 'quem estudou o EIP-1559',
          why: 'Consegue separar base fee de priority fee sem você entregar, e a distinção entre o que é queimado e o que é pago ao validador vale a pena vir da sala.',
        },
        { name: 'open', why: 'A parte da cotação externa costuma ser esquecida por todo mundo. É uma boa pergunta para deixar a sala travar um pouco.' },
      ],
      followup:
        'Você já tem a conta pronta. Onde ela roda: no backend, uma vez, ou no navegador de cada usuário?',
      gotcha:
        'Se alguém disser "é só dividir por 10^9", devolva: "certo, você chegou em 10 gwei. Isso é caro ou é barato? Quanto custa mandar 1 ETH para o seu amigo?"',
      scenarios: {
        right: {
          shape:
            'Nomeia a conversão de hexadecimal para decimal, de wei para gwei, a multiplicação pelo gas consumido e a conversão para dólar. E percebe que a cotação vem de fora.',
          redirect:
            'Aperte no ponto fraco: "a fonte de cotação caiu no meio da demo. O que aparece na tela?"',
        },
        close: {
          shape:
            'Faz a conversão de unidade certinho mas para em gwei, sem multiplicar pelo gas, ou esquece que precisa da cotação do ETH.',
          redirect:
            'Complete a cadeia com uma pergunta: "são 10 gwei por unidade de gas. Quantas unidades uma transferência simples consome?"',
        },
        wayOff: {
          shape:
            'Acha que o node devolve o valor em dólar, ou que dá para derivar o preço do ETH da própria blockchain, sem fonte externa.',
          redirect:
            'Sem corrigir: "o node sabe quanto o dólar vale hoje? De onde ele tiraria essa informação?"',
        },
      },
    },
    {
      id: 'segundo-salto',
      label: 'Por que existe um backend',
      group: 'panel',
      beat: 7,
      tags: ['fan-in / fan-out', 'API key no bundle', 'cota', 'divergência', 'snapshot'],
      oneLine:
        'O navegador fala WebSocket sozinho, então daria para abrir a conexão com a Alchemy direto do React e apagar o backend. Quatro coisas quebram quando você faz isso.',
      pass1:
        'Esse é o beat que justifica a arquitetura inteira do projeto. O navegador tem WebSocket nativo, a Alchemy aceita conexão de qualquer lugar, e o React consegue chamar `eth_subscribe` sozinho. A tentação é legítima, e o protótipo até funciona na sua máquina. Ele quebra no instante em que existe um segundo usuário.',
      pass2:
        '**A API key vai junto no bundle**: tudo que o React precisa em tempo de execução é baixado pelo navegador. Abra o DevTools, vá na aba Network, e em dez segundos a sua chave da Alchemy é pública. A sua cota vira cota de estranhos, e o TAP ainda determina repositório aberto sob MIT.\n\n**N abas viram N conexões**: 200 pessoas com o painel aberto são 200 conexões contra o provedor para receber exatamente o mesmo block. Você paga 200 vezes por um dado que é um só. Com um backend no meio, é 1 conexão para cima e 200 para baixo.\n\n**A conta diverge entre as abas**: se cada navegador busca a cotação do ETH por conta própria, cada um pega essa cotação num instante diferente. Duas telas lado a lado, na mesma sala, mostram números diferentes. Para um produto que vende previsibilidade para investidor institucional, isso é fatal e é impossível de explicar.\n\n**Não sobra nada guardado**: recarregou a página, e o histórico evaporou. Sem backend não existe onde guardar a série para o gráfico, nem de onde servir o primeiro número quando a tela abre. O usuário esperaria até 12 segundos olhando para o vazio.\n\n**A forma certa tem nome**: uma conexão para cima (**fan-in**) e muitas para baixo (**fan-out**). O backend é o único cliente do node e o único servidor do painel. Ele guarda a chave, faz a conta uma vez, guarda o último valor, e repassa o resultado pronto.\n\n**No projeto**: é exatamente por isso que o TAP separa "serviço de backend estruturado em Node.js" de "componente visual de frontend em React". Não é uma exigência acadêmica de arquitetura em camadas, são esses quatro problemas.',
      pass3: [
        {
          gotcha: 'Achar que variável de ambiente no frontend esconde a chave',
          note: 'As variáveis com prefixo NEXT_PUBLIC_ ou VITE_ vão para o bundle por definição. Variável de ambiente no frontend é um jeito de organizar, nunca de esconder.',
        },
        {
          gotcha: 'Achar que um proxy resolve tudo',
          note: 'O proxy esconde a chave e resolve um dos quatro problemas. Continuam de pé as N conexões, as contas divergentes e o fato de nada ficar guardado. Vocês precisam de um serviço com estado, não de um repassador.',
        },
        {
          gotcha: 'Testar sozinho e concluir que funciona',
          note: 'Com um único usuário os quatro problemas somem. Todos eles nascem do segundo usuário. É o tipo de bug que só aparece na demo.',
        },
        {
          gotcha: 'Confundir fan-out com repassar tudo',
          note: 'Fan-out é o backend decidir o que cada tela precisa e mandar pronto. Repassar o stream cru para todo mundo é o que trava a aba, e é o assunto do beat 9.',
        },
      ],
      anchor:
        'O navegador fala WebSocket sozinho. Daria para abrir a conexão com a Alchemy direto do React e apagar o backend do projeto. Me deem três motivos concretos para não fazer isso.',
      askWho: [
        {
          name: 'quem já expôs uma chave sem querer',
          why: 'Se tiver alguém, comece por essa pessoa: a história vale mais que o argumento. Se não tiver, use o próprio DevTools e mostre ao vivo.',
        },
        {
          name: 'quem vai ser responsável pelo backend no projeto',
          why: 'Esse beat é a justificativa do trabalho dessa pessoa. Vale que ela articule em voz alta por que o serviço existe.',
        },
        {
          name: 'quem já fez frontend consumindo API de terceiro',
          why: 'Já esbarrou em CORS ou em chave de API. É bom para trazer o problema para um terreno que ela conhece.',
        },
      ],
      followup:
        'Fechado, existe um backend. Só que vocês já vão escrever um frontend em React, e o Next.js roda servidor no mesmo projeto. Precisa mesmo de um serviço separado?',
      gotcha:
        'Se alguém disser "coloca a chave no .env do Vite", abra o DevTools na hora e mostre a chave dentro do bundle. Um minuto e o argumento acaba.',
      scenarios: {
        right: {
          shape:
            'Cita a chave exposta e pelo menos mais um problema: o custo das N conexões, a divergência entre abas, ou a falta de histórico. É um bônus se desenha uma conexão para cima e N para baixo.',
          redirect:
            'Nomeie o padrão: "isso é fan-in e fan-out. Agora vamos para a perna de baixo: o painel só recebe, ou ele também precisa mandar alguma coisa?"',
        },
        close: {
          shape:
            'Só enxerga a chave exposta e propõe um proxy, sem ver que os outros três problemas continuam de pé.',
          redirect:
            'Estenda o cenário: "o proxy resolve a chave. Com 200 usuários, quantas conexões chegam na Alchemy? E o número em dólar é o mesmo nas 200 telas?"',
        },
        wayOff: {
          shape:
            'Defende que ir direto é melhor porque tem menos latência, ou acha que o backend é só uma camada burocrática do trabalho acadêmico.',
          redirect:
            'Puxe para a escala sem contradizer: "você economizou alguns milissegundos por tela. Quanto você gastou a mais de cota do provedor com 200 telas abertas?"',
        },
      },
      diagram:
        'flowchart TB\n  subgraph ERRADO["ERRADO: N abas, N conexões, chave no bundle"]\n    direction LR\n    R1["React aba 1"] -.->|"wss + chave exposta"| A1[("Nó Alchemy")]\n    R2["React aba 2"] -.->|wss| A1\n    R3["React aba N"] -.->|wss| A1\n  end\n  subgraph CERTO["CERTO: 1 conexão pra cima (fan-in), N pra baixo (fan-out)"]\n    direction LR\n    A2[("Nó Alchemy")] -->|"SALTO 1: wss + eth_subscribe"| B["Backend Node.js<br/>guarda a chave<br/>faz a conta uma vez<br/>guarda o último valor"]\n    B -->|"SALTO 2: SSE"| C1["React aba 1"]\n    B -->|SSE| C2["React aba 2"]\n    B -->|SSE| C3["React aba N"]\n  end\n  ERRADO ~~~ CERTO',
      diagramUrl: '/diagrams/websocket-rpc-blockchain/dois-saltos.png',
    },
    {
      id: 'next-vercel',
      label: 'Onde esse backend mora',
      group: 'panel',
      beat: 8,
      teachFromZero: true,
      tags: ['Next.js', 'route handler', 'NEXT_PUBLIC_', '300 segundos', 'Vercel'],
      oneLine:
        'O beat anterior fechou que precisa de um backend. O Next.js já é esse backend, no mesmo projeto do frontend. Ele resolve três dos quatro problemas, e o quarto vira outra coisa.',
      pass1:
        'A objeção natural do beat 7 é esta: se a gente já vai escrever React, e o Next.js roda código de servidor no mesmo projeto, precisa mesmo de um serviço separado? A resposta curta é não, e vale entender por quê, porque isso muda o desenho do projeto de vocês e o esforço de deploy.',
      pass2:
        '**O que é um route handler**: um arquivo em `app/api/fees/snapshot/route.ts` que exporta uma função `GET` responde em `/api/fees/snapshot`. O caminho da pasta é a URL, sem router para configurar e sem segundo projeto. Esse arquivo é compilado só para o servidor e nunca é enviado ao navegador, então o `process.env.ALCHEMY_KEY` existe ali dentro com segurança. E como o front e a API saem do mesmo domínio, o CORS deixa de ser assunto.\n\n**O prefixo que decide quem enxerga**: variável de ambiente sem `NEXT_PUBLIC_` fica no servidor. Com o prefixo, ela vai para o bundle e é pública. É a mesma armadilha do beat 7 com nome novo, e é o erro mais comum de quem começa em Next.\n\n**Três dos quatro problemas somem**: a chave fica no servidor, a conta roda uma vez e o histórico tem onde morar. O que não some é a contagem de conexões, e o motivo é um fato simples da Vercel: **toda chamada de API roda por no máximo 300 segundos** (800 no plano Pro) e depois é encerrada. Ela não fica de pé esperando. Quando ela é encerrada, o WebSocket que ela mantinha aberto com o node cai junto. E duas chamadas diferentes não enxergam a memória uma da outra, então o último valor não pode viver numa variável do processo, precisa de um lugar externo como um Redis.\n\n**O ciclo que salva, e o que ainda morde**: a chamada é encerrada, o `EventSource` do navegador reconecta sozinho, e a chamada nova assina de novo e roda o backfill. As duas coisas que vocês escrevem nos beats 5 e 9 são exatamente o que faz o teto de 300 segundos ser sobrevivível. O que ainda morde é que, se cada aba disparar a própria chamada com a própria assinatura, voltam as N conexões do beat 7, agora escondidas atrás da Vercel. A saída é separar quem busca do node de quem entrega para as telas, com o valor passando por um Redis no meio.\n\n**No projeto**: o deploy fica trivial. Conecta o repositório do GitHub e a Vercel publica a cada push, com domínio, HTTPS e CDN inclusos, e o plano Hobby é gratuito e cobre o protótipo do TAP com folga. O TAP recomenda "backend em Node.js" e "frontend em React", e o Next entrega os dois num projeto só, sem contrariar nada. Se forem por esse caminho, levem essa decisão para a demo do dia 05/10, porque é justamente o tipo de coisa que a Alphractal pediu para validar.',
      pass3: [
        {
          gotcha: 'Achar que NEXT_PUBLIC_ esconde a chave',
          note: 'É o contrário. O prefixo é o que manda a variável para o bundle. A chave da Alchemy vai numa variável SEM prefixo, e aí ela só existe dentro do route handler.',
        },
        {
          gotcha: 'Achar que a chamada fica de pé esperando',
          note: 'Não fica. Toda chamada de API na Vercel tem 300 segundos de teto e depois é encerrada. Nada que precise viver por horas sobrevive ali sem um ciclo de reconexão.',
        },
        {
          gotcha: 'Guardar o último valor numa variável de módulo',
          note: 'Funciona no seu teste local, onde o processo é um só, e falha em produção, porque a próxima chamada pode cair em outra máquina. O estado compartilhado tem que ser externo.',
        },
        {
          gotcha: 'Achar que precisa do runtime Edge para fazer streaming',
          note: 'Não precisa, e é engano comum. SSE funciona no runtime Node.js padrão, e o Edge não traz vantagem nenhuma aqui, só tira o acesso às APIs completas do Node.',
        },
        {
          gotcha: 'Deixar cada aba abrir a própria assinatura',
          note: 'É o problema das N conexões do beat 7 voltando disfarçado. Com poucos usuários no protótipo isso funciona, e vale saber nomear o que quebra quando escala.',
        },
      ],
      anchor:
        'Peraí. Vocês já vão escrever um frontend em React, e o Next.js roda servidor no mesmo projeto. Precisa mesmo de um serviço separado? Digam quais dos quatro problemas do beat anterior o Next resolve sozinho, e qual deles continua de pé.',
      askWho: [
        {
          name: 'quem já usou Next.js',
          why: 'Provavelmente já criou um route handler sem pensar que aquilo era o backend. O ganho é fazer a ficha cair de que já era.',
        },
        {
          name: 'quem já fez deploy na Vercel',
          why: 'Consegue descrever o fluxo de conectar o repositório e publicar a cada push, que é o argumento de esforço zero.',
        },
        {
          name: 'quem vai cuidar do deploy no projeto',
          why: 'É essa pessoa que economiza uma semana se a decisão for tomada agora, e não na véspera da demo.',
        },
      ],
      followup:
        'O backend existe e mora no Next. Agora ele tem o número pronto e precisa entregar para 200 navegadores. Que transporte ele usa nessa perna?',
      gotcha:
        'Se alguém disser "então é só usar Next e acabou", devolva: "200 pessoas abrem o painel, e cada aba dispara a própria chamada. Quantas conexões chegam na Alchemy?"',
      scenarios: {
        right: {
          shape:
            'Percebe que a chave, a conta única e o histórico ficam resolvidos porque o route handler roda no servidor, e que a contagem de conexões não se resolve sozinha. É um bônus se já desconfia que a chamada não fica de pé.',
          redirect:
            'Confirme e nomeie o motivo: "e por que a conexão continua sendo problema? O que acontece com a chamada depois que ela responde?"',
        },
        close: {
          shape:
            'Vê que o Next resolve a chave e o CORS, mas trata a chamada como se fosse um servidor de pé, sem perceber que ela é encerrada depois de responder.',
          redirect:
            'Aterre no concreto: "a chamada responde. Passaram 300 segundos. O que ainda está rodando? E o socket que ela tinha aberto com o node?"',
        },
        wayOff: {
          shape:
            'Conclui que o Next dispensa o backend inteiro e que dá para chamar a Alchemy do componente React, ou acha que basta pôr a chave numa variável NEXT_PUBLIC_.',
          redirect:
            'Volte ao beat 7 com uma pergunta: "esse componente roda onde? E se ele roda no navegador, quem consegue ler a chave que ele usa?"',
        },
      },
    },
    {
      id: 'sse',
      label: 'SSE: o caminho de volta',
      group: 'panel',
      beat: 9,
      teachFromZero: true,
      tags: ['text/event-stream', 'EventSource', 'Last-Event-ID', 'backpressure', 'throttle'],
      oneLine:
        'Do backend até o navegador o dado anda num sentido só. O SSE é uma resposta HTTP que você nunca fecha, ele reconecta sozinho, e no React são três linhas.',
      pass1:
        'Server-Sent Events é a resposta mais simples possível para "o servidor precisa enviar e o cliente só recebe". É uma requisição HTTP normal que o servidor **não encerra**: ele responde com `Content-Type: text/event-stream` e vai escrevendo no corpo conforme tem novidade. No navegador, o `EventSource` cuida do resto, incluindo o retry.',
      pass2:
        '**O formato inteiro**: uma linha `data: {"baseFee":8.4}` seguida de uma linha em branco. Opcionalmente um `event: gas` para nomear o tipo e um `id: 23481902` para numerar. É só isso, é texto puro.\n\n**Por que SSE e não WebSocket nessa perna**: o painel só recebe. O `EventSource` reconecta sozinho e ainda reenvia o cabeçalho `Last-Event-ID` com o último id que viu, então o servidor sabe de onde continuar. Com WebSocket, todo o retry e a retomada que vocês escreveram no beat 5 teriam que ser escritos de novo, para ganhar um sentido de comunicação que ninguém vai usar.\n\n**A taxa de entrada não é a taxa de saída**: o `newHeads` chega uma vez a cada 12 segundos e cabe folgado. O `newPendingTransactions` chega milhares de vezes por segundo. Se vocês repassarem uma para uma ao navegador, a aba trava. O backend precisa **juntar o que chegou numa janela** de 1 segundo e mandar só o resultado. Vocês mandam a conclusão, não a matéria-prima.\n\n**Duas armadilhas de ambiente**: no HTTP/1.1 o navegador só abre 6 conexões simultâneas por domínio, e um stream SSE ocupa uma delas o tempo todo. Abra 6 abas do painel e a sétima requisição fica presa na fila. Com HTTP/2 as conexões multiplexam e o problema desaparece. A outra armadilha é o Nginx: com buffering ligado, ele segura a resposta inteira até o final, então funciona local e quebra atrás do proxy.\n\n**No projeto**: o TAP já decidiu isso ("entrega ao painel: SSE para o stream de dados em tempo real"). Agora vocês conseguem defender a decisão na demo, em vez de só cumprir ela.',
      pass3: [
        {
          gotcha: 'Esquecer a linha em branco',
          note: 'O `\\n\\n` é o que fecha o evento. Sem ele o navegador segura o buffer esperando o resto, e a tela nunca atualiza, sem nenhum erro no console.',
        },
        {
          gotcha: 'Repassar o stream do node cru para o navegador',
          note: 'A sua taxa de entrada não é a sua taxa de saída. Junte numa janela e mande o valor final. Isso vale para qualquer painel de tempo real, não só para esse.',
        },
        {
          gotcha: 'Testar SSE atrás de um proxy que buferiza',
          note: 'O Nginx com buffering ligado segura a resposta e entrega tudo junto no final. Funciona local, quebra em produção. Desliguem o buffering nessa rota.',
        },
        {
          gotcha: 'Achar que o SSE serve para o salto de cima também',
          note: 'O node não fala SSE, ele fala JSON-RPC sobre WebSocket. Os dois saltos usam transportes diferentes porque as necessidades deles são diferentes.',
        },
      ],
      anchor:
        'Do backend até o navegador o dado anda num sentido só: o painel recebe, e nunca responde nada. Qual transporte vocês escolhem para essa parte, e por quê?',
      askWho: [
        {
          name: 'quem já usou EventSource ou já viu SSE',
          why: 'É raro, e por isso vale procurar. Se alguém tiver, essa pessoa ancora o formato e você economiza cinco minutos.',
        },
        {
          name: 'quem respondeu WebSocket no beat 4',
          why: 'Vai querer usar WebSocket aqui também. É a hora de fazer essa pessoa justificar pela direção do dado, e não pela familiaridade.',
        },
        {
          name: 'quem vai fazer o frontend no projeto',
          why: 'É ela que vai escrever o `new EventSource("/api/fees/stream")`. Vale que ela saiba por que são três linhas e não trinta.',
        },
      ],
      followup:
        'Os dois saltos estão de pé. Agora alguém abre a aba Fees do zero, agora. O que aparece na tela no primeiro segundo?',
      gotcha:
        'Se alguém insistir em WebSocket nessa perna, devolva: "o que o painel vai mandar para o servidor por esse canal? Se a resposta é nada, vocês estão escrevendo retry na mão para ganhar um sentido que não usam."',
      scenarios: {
        right: {
          shape:
            'Escolhe SSE e justifica pela direção única e pelo retry que já vem pronto. É um bônus se lembra que o WebSocket exigiria backoff escrito à mão.',
          redirect:
            'Leve para o backpressure: "certo. E se em vez do newHeads vocês tivessem assinado o newPendingTransactions, que chega milhares de vezes por segundo, vocês repassam tudo?"',
        },
        close: {
          shape:
            'Chega em SSE, mas por eliminação ("é mais simples"), sem articular a direção do dado nem o retry que já vem pronto.',
          redirect:
            'Force os critérios: "quais são os dois sentidos possíveis, e quantos vocês usam aqui? E quem escreve o retry em cada opção?"',
        },
        wayOff: {
          shape:
            'Propõe polling do frontend contra o próprio backend, ou WebSocket porque é o que essa pessoa já conhece.',
          redirect:
            'Para o polling: "a gente acabou de gastar 40 minutos matando o polling no salto de cima. Por que ele voltaria aqui embaixo?"',
        },
      },
    },

    // ──────────────── O DESENHO COMPLETO ────────────────
    {
      id: 'arquitetura',
      label: 'Arquitetura: os dois caminhos',
      group: 'panel',
      beat: 10,
      tags: ['snapshot', 'stream', 'estado em memória', 'primeira renderização'],
      oneLine:
        'São dois caminhos, e não um: o que pinta a tela quando ela abre, e o que mantém ela viva depois. Quem esquece o primeiro entrega uma tela em branco.',
      pass1:
        'Hora de desenhar tudo junto. E existe uma assimetria aqui que a maioria dos projetos de tempo real descobre tarde: existem **dois caminhos** independentes. Um serve a primeira renderização, e o outro serve todas as atualizações seguintes. Eles usam transportes diferentes e falham de jeitos diferentes.',
      pass2:
        '**O caminho de abertura (snapshot)**: o navegador faz `GET /api/fees/snapshot`, o backend responde na hora com o último valor que ele tem em memória (ou chama `eth_feeHistory` por HTTP se acabou de subir e ainda está frio), e o React pinta. Se vocês só tivessem o stream, a tela ficaria vazia por até 12 segundos esperando o próximo block, e o usuário concluiria que quebrou.\n\n**O caminho do stream**: o node envia o `newHeads` pela conexão WebSocket, o backend converte o hexadecimal, aplica a cotação do ETH e calcula as faixas, grava esse resultado como "último valor" e num buffer curto para o gráfico, e escreve para todos os navegadores conectados por SSE.\n\n**A assimetria**: a primeira renderização é request e response, e todo o resto é push. Todo painel de tempo real tem essas duas pernas, e a de abertura é a que os times esquecem, porque ela nunca aparece durante o desenvolvimento (quando você testa, a aba já está aberta há uma hora).\n\n**Onde o estado mora**: o último valor e o buffer do gráfico ficam em memória, no processo Node. Para o protótipo do TAP isso é suficiente e é a escolha certa: uma instância, um estado, zero infraestrutura extra. Se um dia isso rodar em duas instâncias, cada uma abre a própria conexão com o node e guarda o próprio último valor, e aí o número muda dependendo de qual instância atendeu. Nesse dia a resposta é separar os papéis: um processo único cuidando da conexão com o node, e os processos de entrega lendo de um lugar comum.\n\n**No projeto**: quando o TAP fala em "protótipo funcional de ponta a ponta", esse desenho é a ponta a ponta. Vale desenhar ele na lousa no kick-off do dia 14/09 e conferir contra ele na semana 3.',
      pass3: [
        {
          gotcha: 'Ter só o stream',
          note: 'A tela abre vazia e fica assim por até 12 segundos. Quem estiver avaliando a demo vai concluir que não funcionou, antes de o primeiro block chegar.',
        },
        {
          gotcha: 'Ter só o snapshot, com um refresh de tempos em tempos',
          note: 'Isso é polling com outro nome. Vocês teriam feito a aula inteira para voltar ao beat 1.',
        },
        {
          gotcha: 'Não separar quem cuida da conexão de quem entrega',
          note: 'No protótipo funciona tudo junto, e está certo assim. Mas deixem essa fronteira desenhada, porque no dia em que existir uma segunda instância é ela que evita duas conexões com o node e dois valores diferentes na tela.',
        },
        {
          gotcha: 'Não ter reserva para quando a cotação do ETH cai',
          note: 'Sem um valor anterior guardado, uma fonte fora do ar transforma a tela inteira em NaN. Guardem o último preço bom e marquem ele como estimado.',
        },
      ],
      anchor:
        'Alguém abre a aba Fees agora, do zero. Desenhem tudo que acontece até o primeiro número aparecer. Depois desenhem tudo que acontece quando o próximo block sai. São dois caminhos diferentes.',
      askWho: [
        {
          name: 'quem tem a visão mais completa da stack no time',
          why: 'É um beat de integração, então você quer alguém que consiga atravessar as camadas sem travar numa só. Normalmente é quem faz a ponte entre o front e o back.',
        },
        {
          name: 'quem vai apresentar na demo do dia 05/10',
          why: 'É esse desenho que essa pessoa vai ter que explicar para o parceiro. É melhor descobrir agora se ela consegue.',
        },
        { name: 'open', why: 'Vale fazer na lousa, com a sala inteira ditando as caixas, uma por vez.' },
      ],
      followup:
        'Agora, sem falar de Ethereum: descrevam esse mesmo desenho. Se vocês conseguirem, ele serve para o próximo projeto de vocês também.',
      gotcha:
        'Se o desenho vier só com o stream, pergunte: "eu abri a aba agora, e faltam 11 segundos para o próximo block. O que eu estou vendo na tela nesses 11 segundos?"',
      scenarios: {
        right: {
          shape:
            'Desenha as duas pernas separadas e nomeia que a abertura é HTTP e que o resto é push. É um bônus se coloca o estado em memória como origem do snapshot.',
          redirect:
            'Feche a aula: "agora descrevam esse desenho para mim sem usar a palavra Ethereum. Onde mais ele aparece?"',
        },
        close: {
          shape:
            'Desenha o stream inteiro corretamente, mas esquece a primeira renderização, ou coloca a conversão para dólar dentro do navegador.',
          redirect:
            'Aponte o buraco com uma pergunta: "eu abri a aba faltando 11 segundos para o block. Descrevam a tela nesse intervalo."',
        },
        wayOff: {
          shape:
            'Desenha uma caixa só, ou coloca o navegador falando com o node de novo, esquecendo o beat 7.',
          redirect:
            'Volte ao argumento sem repetir a aula: "quantas conexões chegam na Alchemy nesse desenho, com 200 usuários?"',
        },
      },
      diagram:
        'flowchart LR\n  N[("Node Ethereum<br/>Alchemy / Infura")] -->|"1 · STREAM<br/>wss · eth_subscribe(newHeads)"| B["Backend Node.js<br/>converte, calcula,<br/>guarda o último valor"]\n  B -->|"1 · STREAM<br/>SSE · text/event-stream"| R["React · aba Fees"]\n  R -.->|"2 · ABERTURA<br/>GET /api/fees/snapshot"| B',
      diagramUrl: '/diagrams/websocket-rpc-blockchain/arquitetura.png',
    },

    // ──────────────── SÍNTESE ────────────────
    {
      id: 'synthesis',
      label: 'Quem fala primeiro define o transporte',
      group: 'synthesis',
      tags: ['fan-in / fan-out', 'push', 'backfill', 'backpressure'],
      oneLine:
        'A pergunta que resolve todo painel ao vivo não é qual protocolo usar. É quem começa a conversa em cada perna do desenho.',
      pass1:
        'A aula inteira cabe numa pergunta. Em cada perna do desenho, alguém precisa começar a conversa. Se é o cliente que pergunta, você tem polling e todo o desperdício que vem junto. Se é o servidor que avisa, você precisa de uma conexão que fica aberta, e aí escolhe o transporte pela direção do dado: WebSocket quando os dois lados falam, SSE quando só um fala.',
      pass2:
        '**Uma conexão para cima, muitas para baixo**: o dado é um só, então você busca uma vez. As telas são muitas, então você distribui. Fan-in e fan-out são o formato de qualquer sistema de tempo real, do painel de gas ao mapa da Uber.\n\n**O transporte se escolhe pela direção, não pela moda**: nos dois saltos o servidor envia, mas no salto de cima você também precisa mandar comandos (assinar, cancelar), e por isso ele é WebSocket. No salto de baixo você só recebe, e por isso o SSE basta, e ainda entrega o retry pronto.\n\n**O stream conta o presente, e o HTTP conta o passado**: a assinatura entrega do momento em que você assinou em diante, e nada antes disso. Todo buraco, seja uma queda de conexão ou a primeira vez que a tela abre, se preenche com uma requisição comum. Os dois transportes convivem no mesmo serviço porque respondem perguntas diferentes.\n\n**A taxa de entrada não é a taxa de saída**: entre o que chega e o que você repassa existe uma decisão sua. Junte, converta, resuma. Mande a conclusão pronta.\n\n**E esse desenho não é sobre blockchain**: ele aparece em qualquer tela que mostra dado ao vivo, seja preço de ação, ônibus no mapa ou sensor de fábrica. O que muda é a fonte no começo da linha. Do backend para a frente, continua tudo igual.',
      pass3: [
        {
          gotcha: 'Sair daqui achando que a aula foi sobre WebSocket',
          note: 'Ela foi sobre quem começa a conversa. WebSocket, SSE e polling são três respostas para essa pergunta, e a resposta certa depende da direção do dado.',
        },
        {
          gotcha: 'Achar que push substitui request e response',
          note: 'Ele complementa. Todo sistema de push de verdade tem um caminho request e response para o estado inicial e para o backfill.',
        },
        {
          gotcha: 'Guardar as ferramentas em vez do critério',
          note: 'Daqui a um ano ninguém vai lembrar a sintaxe do eth_subscribe. O que fica é: quem fala primeiro, quantas conexões existem, e onde a conta acontece.',
        },
      ],
      anchor:
        'Sem usar a palavra Ethereum, descrevam o desenho que a gente construiu hoje. Onde mais vocês já viram esse mesmo desenho?',
      followup:
        'E se a fonte, em vez de um node, fosse o preço de uma ação atualizando a cada segundo? O que vocês mudariam no desenho?',
      gotcha:
        'Se a sala responder a síntese com nomes de tecnologia, peça de novo sem citar nenhuma tecnologia. O desenho tem que sobreviver à troca de ferramenta.',
    },
  ],
};

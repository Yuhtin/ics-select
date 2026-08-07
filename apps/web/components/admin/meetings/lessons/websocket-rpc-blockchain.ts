import type { Lesson } from '../lesson-types';

// Fontes: Ethereum JSON-RPC spec (ethereum.org/developers/docs/apis/json-rpc)
// - EIP-1559 (eips.ethereum.org/EIPS/eip-1559) - Alchemy docs (eth_subscribe / newHeads)
// - MDN (Server-Sent Events, EventSource, WebSockets API) - RFC 6455 (WebSocket handshake)
// - Uber Eng "Real-time Push Platform" (numero dos ~80% de polling vazio)
// - AWS docs (ALB idle timeout, API Gateway WebSocket API, Lambda execution model)
// - TAP Inteli Blockchain x Alphractal (escopo do modulo Fees, stack recomendada)
export const websocketRpcBlockchain: Lesson = {
  slug: 'websocket-rpc-blockchain',
  title: 'WebSocket e RPC: do nó ao pixel',
  subtitle: 'Por que um painel de gás em tempo real precisa de duas conexões abertas, e não de uma.',
  blurb:
    'A aula que destrava o projeto da Alphractal. O time vai construir um painel que mostra o custo de gás do Ethereum ao vivo, e o TAP já entrega a stack pronta: WebSocket pro nó, SSE pro painel. Ninguém explicou por quê. A gente parte do número que envelhece em 12 segundos, conta o desperdício do polling, descobre o que é um nó RPC e que JSON-RPC é envelope e não cano, abre uma conexão de verdade num nó da Alchemy ao vivo com wscat e vê bloco caindo na tela, quebra ela de propósito pra achar o buraco que a reconexão deixa, converte wei em dólar, e chega no beat que justifica o projeto inteiro: por que não plugar o React direto no nó. Fecha com arquitetura completa e o que acontece quando isso sobe pra AWS. A regra que sai daqui: o mundo produz evento no ritmo dele e a tela consome no ritmo dela, e o backend existe pra ser o amortecedor entre os dois.',
  durationMin: 90,
  audience: 'Inteli Blockchain · 1º e 2º ano · projeto Alphractal',
  slidesUrl: '/slides/websocket-rpc-blockchain.html',
  nodes: [
    // ──────────────── FOUNDATIONS (study-only) ────────────────
    {
      id: 'f-request-response',
      label: 'Request/response: o fetch que morre',
      group: 'foundations',
      teachFromZero: true,
      tags: ['http', 'fetch', 'request/response', 'keep-alive'],
      oneLine:
        'Todo backend que vocês escreveram até hoje roda no mesmo ciclo: o cliente pergunta, o servidor responde, acabou. A aula inteira é sobre quebrar esse ciclo.',
      pass1:
        'Quando o React chama `fetch("/api/fees")`, acontece uma sequência curta e fechada: abre conexão, manda a request, o servidor responde, a conexão se encerra. No Express é o espelho disso, `app.get("/fees", handler)`, e o handler só existe enquanto alguém está batendo na porta. Esse é o único modelo que a maioria de vocês usou até hoje, e ele tem uma limitação que ninguém costuma dizer em voz alta.',
      pass2:
        '**O ciclo completo**: o cliente abre a conexão, manda `GET /api/fees`, o servidor monta a resposta, devolve, e o assunto morre ali. O servidor volta a não saber que você existe.\n\n**A limitação**: o servidor não consegue falar primeiro. Ele não guardou seu endereço, não tem canal aberto com você, e mesmo que quisesse te avisar de algo, não tem por onde. Toda informação que você recebe é resposta de uma pergunta sua.\n\n**Keep-alive não resolve isso**: o HTTP/1.1 reaproveita o mesmo socket TCP pras próximas requests, o que economiza handshake. Mas o modelo continua pergunta e resposta. Reaproveitar o cano não te dá o direito de falar sem ser perguntado.\n\n**No projeto**: a aba Fees da Alphractal hoje é exatamente isso. Você abre a página, o React faz um fetch, recebe a média histórica, e o número congela na tela. O TAP chama isso de "ponto cego em relação à volatilidade instantânea". O ponto cego não está no dado, está no modelo de conexão.',
      pass3: [
        {
          gotcha: 'Achar que o servidor "manda" a resposta',
          note: 'Ele devolve. A diferença importa: devolver é reagir a uma pergunta, mandar é iniciar. Nenhum servidor HTTP comum inicia nada.',
        },
        {
          gotcha: 'Confundir keep-alive com conexão viva',
          note: 'Keep-alive mantém o socket TCP disponível pra reuso, mas o servidor continua mudo enquanto você não perguntar. Cano aberto, boca fechada.',
        },
        {
          gotcha: 'Achar que isso é limitação do JavaScript',
          note: 'É do HTTP request/response. Vale igual em Python, Go, Java. O que muda o jogo é o protocolo, não a linguagem.',
        },
      ],
      anchor:
        'Você deu `fetch("/api/fees")` e recebeu o número. Um segundo depois o valor mudou no servidor. Diga o que o servidor pode fazer pra te avisar.',
      followup:
        'Se ele não pode avisar, e você precisa do número novo, o que sobra pro cliente fazer?',
      gotcha:
        'Se alguém disser "o servidor manda um push", devolva: "por qual conexão? A sua fechou quando a resposta chegou".',
    },

    // ──────────────── O NÓ E O PROTOCOLO ────────────────
    {
      id: 'numero-que-envelhece',
      label: 'O número que envelhece',
      group: 'rpc',
      beat: 1,
      teachFromZero: true,
      tags: ['block time 12s', 'baseFeePerGas', 'polling', 'cota do provedor'],
      oneLine:
        'O gás muda a cada bloco novo, e bloco novo sai a cada 12 segundos. Um número lido uma vez está errado 12 segundos depois.',
      pass1:
        'O Ethereum produz um bloco a cada 12 segundos, num relógio fixo. Cada bloco carrega seu próprio preço de gás, e esse preço pode subir ou descer até 12,5% em relação ao bloco anterior. Ou seja: o número que você mostra na tela tem prazo de validade de 12 segundos, e ele expira sem avisar ninguém. O primeiro instinto pra resolver isso é perguntar de novo. Vamos fazer a conta desse instinto.',
      pass2:
        '**O relógio da rede**: 12 segundos por bloco, fixo desde o Merge. A cada bloco novo o `baseFeePerGas` é recalculado, e a variação máxima entre um bloco e o seguinte é de 12,5%. Em 5 minutos de rede congestionada o custo dobra.\n\n**O instinto e a conta**: perguntar ao servidor a cada 1 segundo. Isso se chama **polling**. Em 12 segundos você faz 12 perguntas e 11 delas devolvem exatamente o mesmo número. São 92% de respostas repetidas.\n\n**Nenhuma frequência conserta**: acelerar pra 200ms multiplica o desperdício por 5. Desacelerar pra 30 segundos coloca número velho na tela de um investidor que está prestes a mandar uma ordem. O problema não está na frequência, está em quem faz a pergunta.\n\n**Você paga em três moedas**: banda, bateria do cliente, e cota do provedor de nó. Polling de 1 segundo dá 86.400 requisições por dia por aba aberta. Com 50 pessoas com o painel aberto são 4,3 milhões de requisições diárias pra receber 7.200 blocos.\n\n**No projeto**: o TAP pede "ingestão contínua de dados ao vivo, capturando a volatilidade das taxas e o lançamento de novos blocos instantaneamente". A palavra que resolve isso não é "mais rápido", é "quem avisa quem".',
      pass3: [
        {
          gotcha: 'Achar que polling de 200ms é "tempo real"',
          note: 'Parece tempo real e é desperdício multiplicado por 5. O bloco continua saindo de 12 em 12 segundos. Você só ficou perguntando mais no vazio.',
        },
        {
          gotcha: 'Esquecer que a cota do provedor é finita',
          note: 'Alchemy e Infura cobram por volume de requisição. Polling agressivo queima o plano do projeto em dias e a demo do dia 05/10 morre com erro 429.',
        },
        {
          gotcha: 'Confundir bloco novo com transação nova',
          note: 'Bloco sai de 12 em 12 segundos. Transações entram na mempool o tempo todo, muito mais rápido. São duas taxas diferentes e você vai escolher qual escutar.',
        },
        {
          gotcha: 'Assumir que o preço só sobe',
          note: 'O base fee cai quando o bloco anterior ficou abaixo da meta de gás. O painel precisa mostrar queda com o mesmo destaque que mostra alta.',
        },
      ],
      anchor:
        'Você abre a aba Fees às 15:00:00 e o custo estimado está certo. Às 15:00:13 ele está errado, e ninguém avisou a tela. Diga o que mudou nesses 13 segundos, e o que o navegador teria que fazer pra descobrir sozinho.',
      askWho: [
        {
          name: 'quem já consumiu API com fetch ou axios',
          why: 'A resposta natural dessa pessoa vai ser "faz outro fetch", que é exatamente o polling. Você quer essa resposta em voz alta pra poder fazer a conta em cima dela.',
        },
        {
          name: 'quem já rodou um nó ou usou Etherscan',
          why: 'Provavelmente sabe o block time de cor. Bom pra ancorar os 12 segundos sem você precisar afirmar.',
        },
        { name: 'open', why: 'Pergunta de abertura, vale deixar a sala responder junto antes de nomear alguém.' },
      ],
      followup:
        'Você perguntou 12 vezes e ouviu a mesma coisa 11. Quem nesse desenho sabia, o tempo todo, exatamente quando o número mudou?',
      gotcha:
        'Quando alguém disser "só diminuir o intervalo do setInterval", devolva: "pra 100ms? Então são 120 perguntas por bloco e 119 respostas iguais. Qual intervalo faz esse desperdício virar zero?"',
      scenarios: {
        right: {
          shape:
            'Identifica que saiu bloco novo e que o base fee mudou junto, e percebe que o navegador só descobre perguntando de novo. Bônus se já sente que perguntar em loop é desperdício.',
          redirect:
            'Faça a conta com ele na lousa: "12 perguntas, 11 iguais. Agora, quem no sistema inteiro sabia na hora exata que o bloco saiu?"',
        },
        close: {
          shape:
            'Diz que "o dado ficou velho" mas não conecta com bloco, ou propõe recarregar a página como solução.',
          redirect:
            'Aterre no relógio: "de quanto em quanto tempo o Ethereum fecha um bloco? E o preço muda junto ou é independente?"',
        },
        wayOff: {
          shape:
            'Acha que a blockchain notifica o site sozinha, ou que o valor deveria vir "atualizado" porque é blockchain.',
          redirect:
            'Puxe pro concreto sem corrigir: "seu site tem endereço fixo na internet? Como a rede saberia pra onde mandar o aviso?"',
        },
      },
      diagram:
        'sequenceDiagram\n  participant B as Backend\n  participant N as Nó Ethereum\n  Note over B,N: POLLING: pergunta a cada 1s\n  B->>N: eth_blockNumber\n  N-->>B: 0x1699A32\n  B->>N: eth_blockNumber\n  N-->>B: 0x1699A32 (igual, resposta jogada fora)\n  Note over B,N: 12 perguntas por bloco, 11 repetidas (92% desperdício)\n  Note over B,N: PUSH: assina uma vez\n  B->>N: eth_subscribe ["newHeads"]\n  N-->>B: subscription id\n  N-->>B: bloco 23481902\n  N-->>B: bloco 23481903\n  Note over B,N: 1 mensagem por bloco, zero perguntas',
      diagramUrl: '/diagrams/websocket-rpc-blockchain/polling-vs-push.png',
    },
    {
      id: 'no-rpc',
      label: 'O nó: onde a blockchain atende',
      group: 'rpc',
      beat: 2,
      teachFromZero: true,
      tags: ['nó', 'estado', 'mempool', 'alchemy/infura', 'api key'],
      oneLine:
        'Não existe api.ethereum.org. Existem milhares de nós, cada um com uma cópia da rede, e você conversa com um deles.',
      pass1:
        'A blockchain não é um servidor com uma API oficial. É uma rede de milhares de máquinas, cada uma guardando a mesma cópia da cadeia e do estado atual. Pra ler qualquer coisa, seu backend precisa falar com **um nó**. Rodar o seu próprio exige uns 1,2 TB de SSD e dias sincronizando, então na prática você aluga: Alchemy, Infura e QuickNode mantêm nós de pé e te entregam uma URL com uma chave.',
      pass2:
        '**O que um nó tem**: a cadeia inteira de blocos, o estado atual (saldos, contratos), e a **mempool**, que é a fila de transações que já foram enviadas mas ainda não entraram em nenhum bloco. A mempool é o lugar onde a pressão de gás aparece antes do preço subir.\n\n**Dois endereços pro mesmo nó**: `https://eth-mainnet.g.alchemy.com/v2/SUA_CHAVE` e `wss://eth-mainnet.g.alchemy.com/v2/SUA_CHAVE`. Mesma máquina, mesmos métodos disponíveis. O que muda é o cano. Guarde essa frase, o próximo beat vive dela.\n\n**A chave é duas coisas ao mesmo tempo**: sua identidade e sua cota. Ela conta quanto você consumiu e quanto ainda pode consumir. Quem tiver a chave gasta no seu nome, então ela é segredo do backend.\n\n**No projeto**: o TAP recomenda literalmente "WebSockets via provedores RPC (ex.: Alchemy/Infura)". A chave vai numa variável de ambiente do backend Node, num `.env` que não entra no commit. Repositório do projeto é público sob licença MIT, então chave vazada ali é chave vazada pro mundo.',
      pass3: [
        {
          gotcha: 'Achar que "a blockchain" responde',
          note: 'Um nó responde. Se esse nó estiver desatualizado ou fora do ar, você vê dado velho ou nenhum dado. Sua leitura vale o que vale a máquina que você escolheu.',
        },
        {
          gotcha: 'Commitar a chave',
          note: 'Bot de scraping acha chave em repositório público em minutos. E o TAP determina repositório público sob MIT, então o risco é certo, não hipotético.',
        },
        {
          gotcha: 'Confundir mempool com bloco',
          note: 'Mempool é o que ainda não aconteceu, bloco é o que aconteceu. As duas coisas têm taxas de chegada muito diferentes, e escolher errado é o que vai travar o painel.',
        },
        {
          gotcha: 'Achar que precisa rodar um nó pra aprender',
          note: 'Não precisa. A chave grátis da Alchemy resolve a aula inteira e o protótipo inteiro. Rodar nó próprio é decisão de custo e de soberania, não de aprendizado.',
        },
      ],
      anchor:
        'Você quer o custo de gás atual do Ethereum e descobre que não existe api.ethereum.org. Diga em quem exatamente seu backend vai bater, e por que aquela máquina sabe a resposta.',
      askWho: [
        {
          name: 'quem já criou chave na Alchemy ou Infura',
          why: 'Já viu as duas URLs (https e wss) na tela do dashboard e provavelmente não parou pra pensar por que tem duas. Perfeito pra puxar isso.',
        },
        {
          name: 'quem já usou MetaMask em rede customizada',
          why: 'Já colou uma RPC URL na mão em algum momento. Esse é o gancho concreto: aquilo era o endereço de um nó.',
        },
        { name: 'open', why: 'Se ninguém tem prática, deixe a sala especular antes de você entregar o conceito.' },
      ],
      followup:
        'Você tem a URL do nó. O que exatamente você manda dentro dessa requisição pra ele entender que você quer o último bloco?',
      gotcha:
        'Se alguém disser "é só chamar a API do Ethereum", devolva: "quem mantém essa API de pé, e quem paga a conta da máquina?"',
      scenarios: {
        right: {
          shape:
            'Diz que fala com um nó, e entende que o nó guarda uma cópia da cadeia. Bônus se cita provedor hospedado como Alchemy ou Infura e menciona que existe uma chave.',
          redirect:
            'Confirme e avance pro protocolo: "esse nó te dá duas URLs, uma https e uma wss. Mesmos métodos nas duas. Então o que muda entre elas?"',
        },
        close: {
          shape:
            'Sabe que precisa de um provedor mas trata como caixa preta, sem entender que é um nó completo com estado e mempool.',
          redirect:
            'Abra a caixa: "o que essa máquina precisa guardar pra conseguir te responder qual o saldo de um endereço qualquer?"',
        },
        wayOff: {
          shape:
            'Propõe raspar o Etherscan, ou acha que existe um endpoint oficial central mantido pela Ethereum Foundation.',
          redirect:
            'Sem corrigir direto: "se existisse um servidor central oficial e ele caísse, a rede parava? Então onde o dado realmente mora?"',
        },
      },
    },
    {
      id: 'json-rpc',
      label: 'JSON-RPC: o envelope não é o cano',
      group: 'rpc',
      beat: 3,
      teachFromZero: true,
      tags: ['json-rpc 2.0', 'method', 'params', 'id', 'eth_feeHistory', 'hex'],
      oneLine:
        'JSON-RPC é o formato da mensagem. HTTP e WebSocket são o transporte. Trocar de transporte não muda uma vírgula da mensagem.',
      pass1:
        'Todo pedido pra um nó Ethereum tem a mesma forma, definida pelo padrão JSON-RPC 2.0: um objeto com `jsonrpc`, `method`, `params` e `id`. O nó responde com um objeto que carrega o mesmo `id`, e é assim que você casa resposta com pergunta. É simples de propósito, porque a graça está em outra coisa: esse mesmo envelope viaja por HTTP ou por WebSocket sem mudar nada.',
      pass2:
        '**O envelope, campo a campo**: `method` é o que você quer (`eth_blockNumber`), `params` é a lista de argumentos, `id` é um número que você escolhe e que volta na resposta. `jsonrpc` é sempre "2.0".\n\n**A separação que trava a maioria**: JSON-RPC é o **formato**, HTTP e WebSocket são o **transporte**. O mesmo `{"method":"eth_blockNumber","params":[]}` sai idêntico nos dois. O que a troca de transporte muda não é o conteúdo, é **quem tem permissão de falar primeiro**.\n\n**Os métodos que vocês vão usar no projeto**: `eth_blockNumber` (número do último bloco), `eth_getBlockByNumber` (o bloco inteiro, com `baseFeePerGas`, `gasUsed`, `timestamp`), `eth_feeHistory` (percentis de gorjeta dos últimos N blocos, que é como se monta as faixas lenta, média e rápida) e `eth_gasPrice`.\n\n**Tudo volta em hexadecimal**: `"baseFeePerGas": "0x2540be400"`. É string, começa com 0x, e você converte antes de qualquer conta. Valores em wei passam de 2^53, então `parseInt` perde precisão e o certo é `BigInt`.\n\n**No projeto**: `eth_feeHistory` é o método que entrega as três faixas de velocidade que o painel do TAP precisa mostrar, sem você ter que inventar heurística.',
      pass3: [
        {
          gotcha: 'Fazer conta direto no hex',
          note: '"0x2540be400" não é número em JavaScript, é string. Some com outro e você concatena texto.',
        },
        {
          gotcha: 'Usar Number pra valor em wei',
          note: '1 ETH são 10^18 wei e o Number seguro do JS vai até ~9×10^15. Use BigInt e só converta pra float depois de dividir pra gwei.',
        },
        {
          gotcha: 'Ignorar o campo id',
          note: 'Com HTTP não incomoda porque a resposta vem na mesma requisição. Com WebSocket você tem várias respostas chegando pelo mesmo cano, e o id é a única forma de saber qual é qual.',
        },
        {
          gotcha: 'Achar que muda de biblioteca pra trocar de transporte',
          note: 'viem e ethers têm o mesmo cliente pros dois. Você troca `http(url)` por `webSocket(url)` e o resto do código continua igual.',
        },
      ],
      anchor:
        'Rode um `curl` num nó pedindo o número do último bloco. Agora mande o MESMO pedido por WebSocket. Diga o que muda entre os dois, e o que fica exatamente igual.',
      askWho: [
        {
          name: 'quem já usou ethers.js ou viem',
          why: 'Já chamou `provider.getBlockNumber()` sem ver o JSON por baixo. O ganho aqui é mostrar que aquilo era um envelope JSON-RPC o tempo todo.',
        },
        {
          name: 'quem já leu doc de API REST',
          why: 'Vai estranhar que o método vai no corpo e não na URL. Esse estranhamento é o ponto: JSON-RPC não é REST, tudo é POST no mesmo endpoint.',
        },
        { name: 'open', why: 'A pergunta funciona bem coletiva porque quase ninguém pensou na diferença entre formato e transporte.' },
      ],
      followup:
        'Se o envelope é igual nos dois, então trocar HTTP por WebSocket não muda o que você manda. O que muda?',
      gotcha:
        'Se alguém disser "WebSocket é mais rápido", devolva: "mais rápido pra quê? O JSON tem o mesmo tamanho e a rede é a mesma. O que ele te dá que o HTTP não dá?"',
      scenarios: {
        right: {
          shape:
            'Percebe que o JSON é idêntico e que só o canal muda. Nomeia que no WebSocket a conexão continua aberta depois da resposta. Bônus se já intui que isso permite o servidor mandar sem ser perguntado.',
          redirect:
            'Confirme e entregue o próximo beat: "isso. E se a conexão continua aberta, o que o nó pode fazer que antes era impossível?"',
        },
        close: {
          shape:
            'Vê que o JSON é o mesmo mas atribui a diferença a performance ou a "ser mais moderno", sem chegar em quem inicia a conversa.',
          redirect:
            'Force a direção: "depois que a resposta chega, o que acontece com a conexão em cada caso? E quem consegue mandar a próxima mensagem?"',
        },
        wayOff: {
          shape:
            'Acha que WebSocket usa outro formato de mensagem, ou que precisaria de outra biblioteca e outros métodos.',
          redirect:
            'Mostre lado a lado sem corrigir: "esse é o JSON do curl. Esse é o que eu mando no wscat. Aponte a diferença entre os dois textos."',
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
        'Começa como uma request HTTP normal, ganha um 101, e a partir daí os dois lados falam quando quiserem pelo mesmo socket.',
      pass1:
        'WebSocket resolve o problema exato do beat 1: ele deixa o servidor falar primeiro. E o truque é elegante. Ele **começa** como uma requisição HTTP comum, com um cabeçalho pedindo `Upgrade: websocket`. O servidor responde `101 Switching Protocols`, e aquele mesmo socket TCP para de falar HTTP e passa a trocar frames nos dois sentidos. É por isso que WebSocket atravessa firewall e proxy corporativo: na porta de entrada, ele parecia HTTP.',
      pass2:
        '**O handshake**: o cliente manda um `GET` com `Upgrade: websocket`, `Connection: Upgrade` e uma `Sec-WebSocket-Key` aleatória. O servidor responde `101` com a `Sec-WebSocket-Accept` derivada dessa chave. Uma vez só, no começo. Depois disso ninguém manda cabeçalho HTTP nunca mais, só frames.\n\n**A inversão acontece aqui**: você manda `{"jsonrpc":"2.0","id":1,"method":"eth_subscribe","params":["newHeads"]}` e recebe de volta um id de assinatura. A partir desse instante, a cada bloco novo, o nó manda sozinho. Você não pergunta mais nada.\n\n**A pegadinha do formato**: as mensagens que o nó empurra **não têm `id`**. Elas chegam com `"method":"eth_subscription"` e o payload dentro de `params.result`. Faz todo sentido: o `id` serve pra casar resposta com pergunta, e aqui ninguém perguntou.\n\n**Outros canais de assinatura**: `logs` (eventos emitidos por contratos, filtráveis por endereço e tópico) e `newPendingTransactions` (a mempool crua, transação por transação). Guarde o nome desse último, ele volta como armadilha no beat 8.\n\n**No projeto**: isso aqui é o salto 1 inteiro. Quando o TAP escreve "conexão blockchain: WebSockets via provedores RPC", ele está falando exatamente desse `eth_subscribe`. A semana 2 do cronograma de vocês é fazer essa linha funcionar.',
      pass3: [
        {
          gotcha: 'Achar que WebSocket é outro protocolo do zero',
          note: 'Ele nasce de um GET HTTP. Sem o handshake de upgrade não existe WebSocket. E é justamente por nascer HTTP que ele passa em proxy e firewall.',
        },
        {
          gotcha: 'Procurar o campo id nas mensagens de push',
          note: 'Elas não têm. Se seu código faz match por id, os blocos vão chegar e ser ignorados em silêncio. O discriminador é `method === "eth_subscription"`.',
        },
        {
          gotcha: 'Assinar newPendingTransactions "pra ter mais dado"',
          note: 'São milhares de mensagens por segundo. Você satura o processo e estoura a cota sem ter olhado uma linha. Pra custo de gás, `newHeads` basta.',
        },
        {
          gotcha: 'Esquecer que a assinatura morre junto com a conexão',
          note: 'Reconectou, perdeu a assinatura. Tem que mandar `eth_subscribe` de novo, sempre. É o beat seguinte.',
        },
      ],
      anchor:
        'O nó precisa te avisar quando sair bloco novo, mas ele não sabe seu endereço e sua conexão HTTP já fechou. Diga o que precisa acontecer ANTES pra ele conseguir falar primeiro.',
      askWho: [
        {
          name: 'quem já mexeu com socket.io ou chat em tempo real',
          why: 'Provavelmente usou WebSocket sem ver o handshake. Comece por ela pra tirar o "é mágica" da mesa e chegar no 101.',
        },
        {
          name: 'quem fez o módulo de redes',
          why: 'Tem TCP na bagagem e consegue articular que a conexão é a mesma, só o protocolo em cima dela é que muda.',
        },
        {
          name: 'quem já abriu a aba Network do DevTools',
          why: 'Dá pra pedir pra ela descrever o que aparece ali quando uma conexão WS sobe. O 101 fica visível na tela.',
        },
      ],
      followup:
        'A conexão está aberta e os blocos estão chegando sozinhos. Agora eu vou puxar o cabo de rede da máquina por 40 segundos. O que acontece?',
      gotcha:
        'Se alguém disser "WebSocket é sempre melhor que HTTP", devolva: "então por que o handshake dele é feito em HTTP? E por que você ainda vai precisar de HTTP no beat 5?"',
      scenarios: {
        right: {
          shape:
            'Chega em manter a conexão aberta, e idealmente nomeia que o cliente precisa se registrar antes (a assinatura). Bônus se cita o upgrade ou o 101.',
          redirect:
            'Confirme e abra o lab: "exato, e a conexão aberta é o handshake. Vamos abrir uma agora e ver bloco chegando."',
        },
        close: {
          shape:
            'Diz "usa WebSocket" mas não sabe como ele começa, ou acha que é uma porta separada e um protocolo sem relação com HTTP.',
          redirect:
            'Puxe pro handshake: "se fosse um protocolo totalmente separado, ele passaria no firewall da empresa? Como ele consegue passar?"',
        },
        wayOff: {
          shape:
            'Propõe o backend expor um endpoint pro nó chamar (webhook), ou acha que o nó guarda seu IP e conecta de volta.',
          redirect:
            'Exponha a contradição: "pra ele te chamar, seu backend precisa ter endereço público e estar de pé. E se estiver atrás de NAT, na sua casa? Quem consegue iniciar a conexão nesse cenário?"',
        },
      },
      diagram:
        'sequenceDiagram\n  participant C as Backend Node.js\n  participant N as Nó (Alchemy)\n  Note over C,N: 1. começa como HTTP comum\n  C->>N: GET /v2/CHAVE + Upgrade: websocket\n  N-->>C: 101 Switching Protocols\n  Note over C,N: 2. mesmo TCP, agora em frames\n  C->>N: eth_subscribe ["newHeads"]\n  N-->>C: id 1, result 0x9ce59a13 (subscription)\n  Note over C,N: 3. daqui pra frente o nó fala sozinho\n  N-->>C: eth_subscription (bloco 23481902)\n  N-->>C: eth_subscription (bloco 23481903)\n  Note over C,N: repare: as mensagens de push não têm id',
      diagramUrl: '/diagrams/websocket-rpc-blockchain/handshake.png',
    },
    {
      id: 'reconexao',
      label: 'A conexão cai (e você perde blocos)',
      group: 'live',
      beat: 5,
      tags: ['backoff', 'jitter', 'ping/pong', 'gap', 'backfill'],
      oneLine:
        'Conexão viva cai por deploy, wifi, timeout do provedor. Reconectar é trabalho seu, e reconectar não devolve o que passou enquanto você estava fora.',
      pass1:
        'Uma conexão que fica aberta por horas vai cair. Deploy reinicia o processo, o wifi do Inteli oscila, o provedor derruba conexões ociosas, a máquina dorme. O WebSocket não reconecta sozinho, diferente do que vocês vão ver no SSE lá na frente. E tem um problema pior que a reconexão: enquanto você esteve fora, a rede continuou produzindo blocos, e ninguém guardou eles pra você.',
      pass2:
        '**Reconectar é código seu**: no evento `close`, tente de novo com **backoff exponencial** (1s, 2s, 4s, 8s, com teto em 30s) e um **jitter** aleatório. Sem jitter, se o provedor cair e voltar, todos os seus clientes reconectam no mesmo milissegundo e derrubam ele de novo.\n\n**Uma conexão morta parece viva**: o TCP não te avisa quando o outro lado sumiu sem fechar direito. Você fica escutando um cano vazio achando que a rede está calma. O jeito de saber é mandar um **ping** a cada 30 segundos e derrubar a conexão se o pong não voltar. Silêncio não é sinal de saúde, é ausência de sinal.\n\n**O buraco é o bug de verdade**: 40 segundos fora são uns 3 blocos que você nunca viu. Você reconecta, manda `eth_subscribe` de novo, e o stream volta do bloco atual. O gráfico do painel fica com um dente e ninguém entende por quê.\n\n**O conserto**: guarde o número do último bloco que você processou. Ao reconectar, busque de `ultimo + 1` até o atual **por HTTP** (`eth_getBlockByNumber` em loop), preencha o buraco, e só então volte a confiar no stream. A regra que sai daqui: **WebSocket pro que está acontecendo, HTTP pro que já aconteceu**. Os dois convivem no mesmo serviço, e é por isso que você configura os dois transportes.\n\n**No projeto**: a semana 3 do cronograma é "resolução de bugs e polimento". Esse é o bug, e ele tem uma característica cruel: em 20 minutos de teste local ele nunca aparece. Ele aparece na demo do dia 05/10.',
      pass3: [
        {
          gotcha: 'Reconectar em loop apertado',
          note: 'Sem backoff você bate no provedor 50 vezes por segundo durante a queda dele, toma rate limit, e vira parte do problema. Backoff exponencial com jitter, sempre.',
        },
        {
          gotcha: 'Reconectar e não reassinar',
          note: 'A assinatura vive dentro da conexão. Conexão nova, assinatura zerada. O socket abre, tudo parece ok, e não chega bloco nenhum.',
        },
        {
          gotcha: 'Confiar que "sem erro" significa "conectado"',
          note: 'Conexão meio-aberta não dispara erro. Sem heartbeat você fica horas achando que está escutando e a tela congelada.',
        },
        {
          gotcha: 'Achar que dá pra reassinar e receber o passado',
          note: 'eth_subscribe entrega do momento da assinatura pra frente. O passado só sai por chamada HTTP explícita. Não existe replay no stream.',
        },
      ],
      anchor:
        'Seu backend fica 40 segundos sem rede, volta, reconecta e assina `newHeads` de novo. Diga o que aconteceu com os blocos daquele intervalo, e como o painel descobre que perdeu alguma coisa.',
      askWho: [
        {
          name: 'quem já perdeu conexão no meio de um deploy',
          why: 'Tem a cicatriz e vai reconhecer o cenário rápido. Bom pra trazer o problema pro concreto antes de você nomear ele.',
        },
        {
          name: 'quem já implementou retry em chamada de API',
          why: 'Provavelmente fez retry fixo. O ganho aqui é a diferença entre retry fixo e backoff exponencial com jitter.',
        },
        { name: 'open', why: 'A parte do buraco de dados quase nunca ocorre a ninguém de primeira. Deixe a sala tropeçar antes de entregar.' },
      ],
      followup:
        'Você preencheu o buraco por HTTP. Agora o dado bruto está completo, mas ele está em hexadecimal e em wei. O investidor quer ver dólar.',
      gotcha:
        'Se alguém disser "é só reconectar", devolva: "reconectou às 15:00:40. O bloco das 15:00:12 chega pra você depois disso?"',
      scenarios: {
        right: {
          shape:
            'Diz que perdeu os blocos do intervalo e que precisa buscar eles de outro jeito. Bônus se propõe guardar o último bloco visto e buscar o intervalo por chamada HTTP.',
          redirect:
            'Nomeie a regra com ele: "isso é backfill. Então no mesmo serviço você vai ter dois transportes. Qual serve pra quê?"',
        },
        close: {
          shape:
            'Trata só da reconexão (backoff, retry) e não percebe que existe um buraco de dados independente de reconectar bem.',
          redirect:
            'Isole o problema: "reconectou perfeito, em 1 segundo. Os 3 blocos que saíram enquanto você estava fora chegam sozinhos agora?"',
        },
        wayOff: {
          shape:
            'Acha que o nó guarda uma fila do que você perdeu e entrega ao reconectar, tipo Kafka.',
          redirect:
            'Puxe a consequência: "se o nó guardasse a fila de cada cliente desconectado, quanto de memória isso custaria pra ele com 100 mil clientes?"',
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
      tags: ['wei', 'gwei', 'eip-1559', 'baseFeePerGas', 'priority fee', '21000 gas'],
      oneLine:
        'O bloco entrega wei por unidade de gás em hexadecimal. O investidor quer ver dólar por operação. Entre os dois tem quatro passos e uma fonte externa.',
      pass1:
        'Chegou o bloco com `"baseFeePerGas": "0x2540be400"`. Esse número é o preço de UMA unidade de gás, em wei. Ninguém toma decisão olhando pra isso. A entrega que o TAP pede é "converter as métricas brutas da blockchain em estimativas financeiras reais", e essa conversão tem uma etapa que não vem do nó.',
      pass2:
        '**As unidades**: 1 ETH são 10^18 wei. 1 gwei são 10^9 wei, e gwei é a unidade em que o mundo fala de gás. `0x2540be400` são 10.000.000.000 wei, ou seja, 10 gwei.\n\n**EIP-1559, o modelo de preço**: cada bloco define um **base fee** que é queimado, e o usuário adiciona uma **gorjeta** (priority fee) que vai pro validador. O custo total de uma transação é `gasUsed × (base + gorjeta)`. O base sobe até 12,5% quando o bloco anterior passou de 15 milhões de gás e cai quando ficou abaixo disso, então ele é um termômetro de congestionamento.\n\n**A conta que vira o número da tela**: uma transferência simples de ETH consome **21.000 de gás**, sempre, é fixo por especificação. Então 21.000 × 10 gwei = 210.000 gwei = 0,00021 ETH. Com ETH a US$ 3.000, dá **US$ 0,63**. Esse é o número que o painel mostra.\n\n**O passo que não vem do nó**: a cotação do ETH em dólar. O nó não faz ideia de quanto vale ETH, isso é informação de mercado. Você precisa de uma segunda fonte (a própria Alphractal tem), com cache, e com um valor de fallback pra quando ela falhar. Se essa fonte cair e você não tratar, o painel inteiro mostra `NaN`.\n\n**No projeto**: essa conta roda **uma vez, no backend**. O beat seguinte explica por que fazer ela no navegador é o erro que estraga o produto.',
      pass3: [
        {
          gotcha: 'Usar Number pra guardar wei',
          note: '10^18 passa do inteiro seguro do JavaScript. Some dois valores e o resultado vem errado sem lançar erro nenhum. BigInt pra guardar, float só depois de dividir pra gwei.',
        },
        {
          gotcha: 'Mostrar gwei achando que é o custo',
          note: 'Gwei é preço por unidade de gás, não custo da operação. Sem multiplicar pelo gás consumido, o número não significa nada pro usuário.',
        },
        {
          gotcha: 'Assumir 21.000 de gás pra tudo',
          note: '21.000 vale pra transferência simples de ETH. Um swap na Uniswap passa de 150.000. O painel precisa deixar claro qual operação ele está precificando.',
        },
        {
          gotcha: 'Esquecer que a cotação do ETH tem latência própria',
          note: 'O gás atualiza a cada 12 segundos, o preço do ETH atualiza noutro ritmo. São dois relógios, e o número em dólar é o produto dos dois.',
        },
      ],
      anchor:
        'Chegou o bloco com `baseFeePerGas: "0x2540be400"`. O investidor precisa ler "transferência simples: US$ 0,63". Liste as conversões entre um e outro, e aponte a que não vem do nó.',
      askWho: [
        {
          name: 'quem já pagou gás numa carteira',
          why: 'Já viu a MetaMask mostrar gwei e dólar lado a lado. Peça pra ela descrever o que a carteira estava fazendo por baixo.',
        },
        {
          name: 'quem estudou EIP-1559',
          why: 'Consegue separar base fee de gorjeta sem você entregar, e a distinção entre queimado e pago ao validador vale a pena vir da sala.',
        },
        { name: 'open', why: 'A parte da cotação externa costuma ser esquecida por todo mundo. Boa pergunta pra deixar a sala travar um pouco.' },
      ],
      followup:
        'Você tem a conta pronta. Onde ela roda: no backend uma vez, ou no navegador de cada usuário?',
      gotcha:
        'Se alguém disser "é só dividir por 10^9", devolva: "ok, você chegou em 10 gwei. Isso é caro ou barato? Quanto custa mandar 1 ETH pro seu amigo?"',
      scenarios: {
        right: {
          shape:
            'Nomeia hex para decimal, wei para gwei, multiplicação pelo gás consumido e conversão para dólar. Percebe que a cotação vem de fora.',
          redirect:
            'Aperte no ponto fraco: "a fonte de cotação caiu no meio da demo. O que aparece na tela?"',
        },
        close: {
          shape:
            'Faz a conversão de unidade certinho mas para em gwei, sem multiplicar pelo gás, ou esquece que precisa da cotação do ETH.',
          redirect:
            'Complete a cadeia com pergunta: "10 gwei por unidade de gás. Quantas unidades uma transferência simples consome?"',
        },
        wayOff: {
          shape:
            'Acha que o nó devolve o valor em dólar, ou que dá pra derivar o preço do ETH da própria blockchain sem fonte externa.',
          redirect:
            'Sem corrigir: "o nó sabe quanto o dólar vale hoje? De onde ele tiraria isso?"',
        },
      },
    },
    {
      id: 'segundo-salto',
      label: 'Por que não plugar o React direto no nó?',
      group: 'panel',
      beat: 7,
      tags: ['fan-in/fan-out', 'chave no bundle', 'cota', 'divergência', 'snapshot'],
      oneLine:
        'O navegador fala WebSocket nativamente, então dá pra abrir a WSS da Alchemy direto do React e apagar o backend. Quatro coisas quebram quando você faz isso.',
      pass1:
        'Esse é o beat que justifica a arquitetura inteira do projeto. O navegador tem WebSocket nativo, a Alchemy aceita conexão de qualquer lugar, e o React consegue chamar `eth_subscribe` sozinho. A tentação é legítima e o protótipo até funciona na sua máquina. Ele quebra na hora que existe um segundo usuário.',
      pass2:
        '**A chave vai junto no bundle**: tudo que o React precisa em runtime é baixado pelo navegador. DevTools, aba Network, dez segundos, e sua chave da Alchemy é pública. Sua cota vira cota de estranhos e o TAP ainda determina repositório aberto sob MIT.\n\n**N abas, N conexões upstream**: 200 pessoas com o painel aberto são 200 conexões contra o provedor pra receber exatamente o mesmo bloco. Você paga 200 vezes por um dado que é um só. Com backend no meio, é 1 conexão pra cima e 200 pra baixo.\n\n**A conta diverge entre abas**: se cada navegador busca a cotação do ETH por conta própria, cada um pega ela num instante diferente. Duas telas lado a lado, na mesma sala, mostram números diferentes. Pra um produto que vende previsibilidade pra investidor institucional, isso é fatal e é impossível de explicar.\n\n**Não sobra nada**: recarregou a página, o histórico evaporou. Sem backend não existe onde guardar a série pro gráfico, nem de onde servir o primeiro número quando a tela abre (você esperaria até 12 segundos olhando pro vazio).\n\n**A forma certa tem nome**: uma conexão pra cima (**fan-in**) e muitas pra baixo (**fan-out**). O backend é o único cliente do nó e o único servidor do painel. Ele guarda a chave, faz a conta uma vez, guarda o último valor, e repassa pronto.\n\n**No projeto**: é exatamente por isso que o TAP separa "serviço de backend estruturado em Node.js" de "componente visual de frontend em React". Não é burocracia acadêmica de arquitetura em camadas, são essas quatro razões.',
      pass3: [
        {
          gotcha: 'Achar que variável de ambiente no frontend esconde a chave',
          note: 'NEXT_PUBLIC_ ou VITE_ vão pro bundle por definição. Variável de ambiente no frontend é um jeito de organizar, nunca de esconder.',
        },
        {
          gotcha: 'Achar que proxy resolve tudo',
          note: 'Proxy esconde a chave e resolve um dos quatro problemas. Continua sendo N conexões, contas divergentes e nada guardado. Você precisa de um serviço com estado, não de um repassador.',
        },
        {
          gotcha: 'Testar sozinho e concluir que funciona',
          note: 'Com um usuário os quatro problemas somem. Todos eles nascem do segundo usuário. É o tipo de bug que só aparece na demo.',
        },
        {
          gotcha: 'Confundir fan-out com broadcast burro',
          note: 'Fan-out é o backend decidir o que cada tela precisa e mandar pronto. Repassar cru pra todo mundo é o que trava a aba no beat 8.',
        },
      ],
      anchor:
        'O navegador fala WebSocket nativamente. Você poderia abrir a WSS da Alchemy direto do React e apagar o backend do projeto. Dê três motivos concretos pra não fazer isso.',
      askWho: [
        {
          name: 'quem já expôs uma chave sem querer',
          why: 'Se tiver alguém, começa por ela: a história vale mais que o argumento. Se não, use o próprio DevTools pra mostrar ao vivo.',
        },
        {
          name: 'quem vai ser responsável pelo backend no projeto',
          why: 'Esse beat é a justificativa do trabalho dela. Vale ela articular em voz alta por que o serviço existe.',
        },
        {
          name: 'quem já fez frontend consumindo API de terceiro',
          why: 'Já esbarrou em CORS ou em chave de API. Bom pra trazer o problema pro terreno que ela conhece.',
        },
      ],
      followup:
        'Fechado, o backend fica no meio. Agora ele tem o número pronto e precisa entregar pra 200 navegadores. Que transporte ele usa nessa perna?',
      gotcha:
        'Se alguém disser "coloca a chave no .env do Vite", abra o DevTools na hora e mostre a chave no bundle. Um minuto e o argumento acaba.',
      scenarios: {
        right: {
          shape:
            'Cita chave exposta e pelo menos mais um: custo de N conexões, divergência entre abas ou falta de histórico. Bônus se desenha 1 conexão pra cima e N pra baixo.',
          redirect:
            'Nomeie o padrão: "isso é fan-in e fan-out. Agora, a perna de baixo: o painel só recebe ou também precisa mandar?"',
        },
        close: {
          shape:
            'Só enxerga a chave exposta e propõe proxy, sem ver que os outros três problemas continuam de pé.',
          redirect:
            'Estenda o cenário: "proxy resolve a chave. Com 200 usuários, quantas conexões chegam na Alchemy? E o número em dólar é o mesmo nas 200 telas?"',
        },
        wayOff: {
          shape:
            'Defende que direto é melhor porque tem menos latência, ou acha que o backend é só uma camada burocrática do trabalho acadêmico.',
          redirect:
            'Puxe pra escala sem contradizer: "você economizou uns milissegundos por tela. Quanto você gastou a mais de cota do provedor com 200 telas?"',
        },
      },
      diagram:
        'flowchart TB\n  subgraph ERRADO["ERRADO: N abas, N conexões, chave no bundle"]\n    direction LR\n    R1["React aba 1"] -.->|"wss + chave exposta"| A1[("Nó Alchemy")]\n    R2["React aba 2"] -.->|wss| A1\n    R3["React aba N"] -.->|wss| A1\n  end\n  subgraph CERTO["CERTO: 1 conexão pra cima (fan-in), N pra baixo (fan-out)"]\n    direction LR\n    A2[("Nó Alchemy")] -->|"SALTO 1: wss + eth_subscribe"| B["Backend Node.js<br/>guarda a chave<br/>faz a conta uma vez<br/>guarda o último valor"]\n    B -->|"SALTO 2: SSE"| C1["React aba 1"]\n    B -->|SSE| C2["React aba 2"]\n    B -->|SSE| C3["React aba N"]\n  end\n  ERRADO ~~~ CERTO\n  classDef ok fill:#f2ecff,stroke:#7132f5,stroke-width:2px,color:#101114\n  classDef bad fill:#f4f4f6,stroke:#9497a9,stroke-width:1px,color:#686b82\n  classDef hub fill:#e7f5ee,stroke:#149e61,stroke-width:2px,color:#101114\n  class R1,R2,R3,A1 bad\n  class A2,C1,C2,C3 ok\n  class B hub\n  style ERRADO fill:#ffffff,stroke:#dedee5,color:#686b82\n  style CERTO fill:#ffffff,stroke:#7132f5,color:#5741d8',
      diagramUrl: '/diagrams/websocket-rpc-blockchain/dois-saltos.png',
    },
    {
      id: 'sse',
      label: 'SSE: o caminho de volta',
      group: 'panel',
      beat: 8,
      teachFromZero: true,
      tags: ['text/event-stream', 'EventSource', 'Last-Event-ID', 'backpressure', 'throttle'],
      oneLine:
        'Do backend pro navegador o dado anda num sentido só. SSE é HTTP que não termina, reconecta sozinho, e cabe em três linhas no React.',
      pass1:
        'Server-Sent Events é a resposta mais simples possível pra "o servidor precisa empurrar e o cliente só recebe". É uma requisição HTTP normal que o servidor **não encerra**: ele responde com `Content-Type: text/event-stream` e vai escrevendo no corpo conforme tem novidade. No navegador, o `EventSource` cuida do resto, incluindo reconectar.',
      pass2:
        '**O formato inteiro**: `data: {"baseFee":8.4,"transferUsd":0.63}` seguido de uma linha em branco. Opcionalmente `event: gas` pra nomear o tipo e `id: 23481902` pra numerar. É só isso, é texto puro.\n\n**Por que SSE e não WebSocket nessa perna**: o painel só recebe. O `EventSource` reconecta sozinho e ainda reenvia o cabeçalho `Last-Event-ID` com o último id que viu, então o servidor sabe de onde continuar. Com WebSocket você reescreveria backoff, heartbeat e retomada à mão pra ganhar um sentido de comunicação que ninguém vai usar.\n\n**Backpressure, a armadilha**: `newHeads` chega 1 vez a cada 12 segundos e cabe folgado. `newPendingTransactions` chega milhares de vezes por segundo. Se você repassar 1 pra 1 pro navegador, a aba trava. O backend precisa **agregar numa janela**: acumule por 1 segundo e mande só o resultado. Você manda conclusão, não matéria-prima.\n\n**A pegadinha do HTTP/1.1**: o navegador limita 6 conexões simultâneas por domínio, e um stream SSE ocupa uma delas o tempo todo. Abra 6 abas do painel e a sétima requisição fica presa na fila. Com HTTP/2 as conexões multiplexam e o problema desaparece, então sirva por HTTPS com HTTP/2 ativo.\n\n**No projeto**: o TAP já decidiu isso ("entrega ao painel: SSE para o stream de dados em tempo real"). Agora vocês conseguem defender a decisão na demo em vez de só cumprir ela.',
      pass3: [
        {
          gotcha: 'Esquecer a linha em branco',
          note: 'O `\\n\\n` é o que fecha o evento. Sem ele o navegador segura o buffer esperando o resto e a tela nunca atualiza, sem erro nenhum no console.',
        },
        {
          gotcha: 'Repassar o stream do nó cru pro browser',
          note: 'Sua taxa de entrada não é a taxa de saída. Agregue numa janela e mande o valor final. Isso vale pra qualquer painel de tempo real, não só esse.',
        },
        {
          gotcha: 'Testar SSE com proxy que buferiza',
          note: 'Nginx com buffering ligado segura a resposta e entrega tudo junto no final. Funciona local, quebra atrás do proxy. Desligue o buffering nessa rota.',
        },
        {
          gotcha: 'Achar que SSE serve pro salto de cima também',
          note: 'O nó não fala SSE, ele fala JSON-RPC sobre WebSocket. Os dois saltos usam transportes diferentes porque as necessidades são diferentes.',
        },
      ],
      anchor:
        'Do backend pro navegador o dado anda num sentido só: o painel recebe e nunca responde. Escolha o transporte dessa perna e justifique pela direção, não pelo hype.',
      askWho: [
        {
          name: 'quem já usou EventSource ou viu SSE',
          why: 'Raro, e por isso vale procurar. Se alguém tiver, ela ancora o formato e você economiza cinco minutos.',
        },
        {
          name: 'quem respondeu WebSocket no beat 4',
          why: 'Vai querer usar WebSocket aqui também. É a hora de fazer ela justificar pela direcionalidade em vez de por familiaridade.',
        },
        {
          name: 'quem vai fazer o frontend no projeto',
          why: 'É ela que vai escrever o `new EventSource("/api/fees/stream")`. Vale ela saber por que são três linhas e não trinta.',
        },
      ],
      followup:
        'Os dois saltos estão de pé. Agora alguém abre a aba Fees do zero, agora. O que aparece na tela no primeiro segundo?',
      gotcha:
        'Se alguém insistir em WebSocket nessa perna, devolva: "o que o painel vai MANDAR pro servidor por esse canal? Se a resposta é nada, você está pagando reconexão manual por um sentido que não usa."',
      scenarios: {
        right: {
          shape:
            'Escolhe SSE e justifica pela direção única e pela reconexão automática. Bônus se lembra que WebSocket exigiria backoff manual.',
          redirect:
            'Leve pro backpressure: "beleza. E se em vez de newHeads você tivesse assinado newPendingTransactions, milhares por segundo. Você repassa tudo?"',
        },
        close: {
          shape:
            'Chega em SSE mas por eliminação ("é mais simples"), sem articular direcionalidade nem a reconexão de graça.',
          redirect:
            'Force os critérios: "quais são os dois sentidos possíveis, e quantos você usa aqui? E quem reconecta em cada opção?"',
        },
        wayOff: {
          shape:
            'Propõe polling do frontend contra o próprio backend, ou WebSocket porque é o que ele já conhece.',
          redirect:
            'Pro polling: "a gente acabou de gastar 40 minutos matando polling no salto de cima. Por que ele voltaria aqui embaixo?"',
        },
      },
    },
    {
      id: 'arquitetura',
      label: 'Arquitetura: o fluxo completo',
      group: 'panel',
      beat: 9,
      tags: ['snapshot path', 'stream path', 'estado em memória', 'primeira renderização'],
      oneLine:
        'Dois caminhos, não um: o que pinta a tela quando ela abre, e o que a mantém viva depois. Quem esquece o primeiro entrega tela em branco.',
      pass1:
        'Hora de desenhar tudo junto. E tem uma assimetria aqui que a maioria dos projetos de tempo real descobre tarde: existem **dois caminhos** independentes. Um serve a primeira renderização, o outro serve todas as atualizações seguintes. Eles usam transportes diferentes e falham de jeitos diferentes.',
      pass2:
        '**Caminho de abertura (snapshot)**: o navegador faz `GET /api/fees/snapshot`, o backend responde na hora com o último valor que ele tem em memória (ou chama `eth_feeHistory` por HTTP se acabou de subir e está frio), e o React pinta. Se você só tivesse stream, a tela ficaria vazia por até 12 segundos esperando o próximo bloco, e o usuário concluiria que quebrou.\n\n**Caminho do stream**: o nó empurra `newHeads` pela WSS, o ingestor converte o hex, aplica a cotação do ETH e calcula as faixas, grava como "último valor" e num buffer curto pro gráfico, e publica pro hub SSE, que escreve pra todos os navegadores conectados.\n\n**A assimetria**: a primeira renderização é request/response, todo o resto é push. Todo painel de tempo real tem essas duas pernas, e a de abertura é a que os times esquecem porque ela nunca aparece durante o desenvolvimento (a aba já está aberta há uma hora quando você testa).\n\n**Onde o estado mora**: o último valor e o buffer do gráfico ficam em memória no processo Node. Pro protótipo do TAP isso é suficiente e é a escolha certa: uma instância, um estado, zero infraestrutura. É exatamente essa escolha que quebra na segunda instância, e é sobre isso que fala o próximo beat.\n\n**No projeto**: quando o TAP fala em "protótipo funcional de ponta a ponta", esse desenho é a ponta a ponta. Vale desenhar ele na lousa no kick-off do dia 14/09 e checar contra ele na semana 3.',
      pass3: [
        {
          gotcha: 'Ter só o stream',
          note: 'Tela abre vazia e fica assim por até 12 segundos. O avaliador da demo vai concluir que não funcionou antes do primeiro bloco chegar.',
        },
        {
          gotcha: 'Ter só o snapshot com refresh',
          note: 'É polling com outro nome. Você teria feito a aula inteira pra chegar de volta no beat 1.',
        },
        {
          gotcha: 'Deixar o ingestor e o servidor SSE no mesmo lugar sem separar as responsabilidades',
          note: 'Funciona no protótipo, mas o dia que você escalar vai querer um ingestor único e vários servidores de entrega. Deixe a fronteira desenhada mesmo que o processo seja um só.',
        },
        {
          gotcha: 'Não ter fallback quando a cotação do ETH cai',
          note: 'Sem valor anterior guardado, uma fonte fora do ar transforma a tela inteira em NaN. Guarde o último preço bom e marque como estimado.',
        },
      ],
      anchor:
        'Alguém abre a aba Fees agora, do zero. Desenhe tudo que acontece até o primeiro número aparecer. Depois desenhe tudo que acontece quando o próximo bloco sai. São dois caminhos diferentes.',
      askWho: [
        {
          name: 'quem tem a visão mais completa do stack no time',
          why: 'Beat de integração, então quer alguém que consiga atravessar as camadas sem travar numa. Normalmente é quem vai fazer a ponte entre front e back.',
        },
        {
          name: 'quem vai apresentar na demo do dia 05/10',
          why: 'É esse desenho que ela vai ter que explicar pro parceiro. Melhor descobrir agora se ela consegue.',
        },
        { name: 'open', why: 'Vale fazer na lousa com a sala inteira ditando as caixas, uma por vez.' },
      ],
      followup:
        'Esse desenho roda numa instância só, com o estado na memória do processo. Você sobe pra AWS e o autoscaling cria a segunda instância. O que quebra?',
      gotcha:
        'Se o desenho vier só com o stream, pergunte: "eu abri a aba agora, faltam 11 segundos pro próximo bloco. O que eu estou vendo na tela nesses 11 segundos?"',
      scenarios: {
        right: {
          shape:
            'Desenha as duas pernas separadas e nomeia que a abertura é HTTP e o resto é push. Bônus se coloca o estado em memória como origem do snapshot.',
          redirect:
            'Vá pro próximo problema: "esse estado está na memória de um processo. E se existirem dois processos?"',
        },
        close: {
          shape:
            'Desenha o stream inteiro corretamente mas esquece a primeira renderização, ou põe a conversão de dólar no navegador.',
          redirect:
            'Aponte o buraco com pergunta: "abri a aba faltando 11 segundos pro bloco. Descreva a tela nesse intervalo."',
        },
        wayOff: {
          shape:
            'Desenha uma caixa só, ou coloca o navegador falando com o nó de novo, esquecendo o beat 7.',
          redirect:
            'Volte ao argumento sem repetir a aula: "quantas conexões chegam na Alchemy nesse seu desenho com 200 usuários?"',
        },
      },
      diagram:
        'flowchart LR\n  N[("Nó Ethereum<br/>Alchemy")] -->|"wss: eth_subscribe newHeads"| I["Ingestor<br/>hex para decimal<br/>aplica ETH/USD<br/>calcula as faixas"]\n  N -->|"https: eth_getBlockByNumber<br/>backfill do buraco"| I\n  X["Fonte ETH/USD<br/>cache + fallback"] --> I\n  I --> S["Estado em memória<br/>último valor<br/>+ buffer do gráfico"]\n  S --> H["Hub SSE"]\n  H -->|"CAMINHO DO STREAM<br/>text/event-stream"| B["React: aba Fees"]\n  B -->|"CAMINHO DE ABERTURA<br/>GET /api/fees/snapshot"| S\n  classDef ok fill:#f2ecff,stroke:#7132f5,stroke-width:2px,color:#101114\n  classDef hub fill:#e7f5ee,stroke:#149e61,stroke-width:2px,color:#101114\n  classDef ext fill:#f4f4f6,stroke:#9497a9,stroke-width:1px,color:#686b82\n  class N,B,H ok\n  class I,S hub\n  class X ext',
      diagramUrl: '/diagrams/websocket-rpc-blockchain/arquitetura.png',
    },

    // ──────────────── ONDE ISSO RODA ────────────────
    {
      id: 'aws',
      label: 'AWS: onde uma conexão longa roda',
      group: 'cloud',
      beat: 10,
      tags: ['lambda', 'fargate', 'alb idle timeout', 'api gateway ws', 'elasticache'],
      oneLine:
        'Toda escolha aqui é ditada por um fato só: a conexão fica viva por horas. Isso elimina o serviço que todo mundo escolhe primeiro.',
      pass1:
        'Pra cada caixa do desenho anterior, qual serviço da AWS. E o critério aqui não é preço nem familiaridade, é o perfil da conexão: ela fica **viva por horas**, dos dois lados. Esse único fato elimina o primeiro serviço que todo mundo escolhe.',
      pass2:
        '**Lambda não segura conexão**: o modelo dela é invocar, responder, morrer. Não existe onde manter um socket aberto com o nó nem com o navegador entre invocações, e o teto de 15 minutos só piora. Compute que fica de pé é o que serve: **ECS Fargate** (container gerenciado, sem servidor pra cuidar) ou **EC2** com auto scaling.\n\n**O ALB derruba seu stream em silêncio**: o Application Load Balancer tem **idle timeout padrão de 60 segundos**. Um stream SSE que passa 60 segundos sem escrever nada é cortado, e o navegador reconecta em loop. O conserto é mandar um comentário de keep-alive (`: ping\\n\\n`) a cada 15 segundos, ou subir o timeout. Esse bug funciona perfeitamente na sua máquina e só aparece depois do deploy.\n\n**Duas instâncias, dois problemas novos**: cada uma abre a própria conexão com o nó, então você dobra o consumo de cota pra receber o mesmo bloco. E cada uma tem o próprio "último valor" em memória, então o número muda dependendo de qual instância te atendeu. O conserto é separar os papéis: **um** ingestor mantendo o `eth_subscribe` e publicando num **ElastiCache (Redis)**, e as instâncias de entrega só lendo do Redis e repassando por SSE.\n\n**A alternativa gerenciada**: o **API Gateway WebSocket API** segura as conexões dos navegadores por você e invoca Lambda por mensagem. Resolve bem a perna de baixo. Não resolve a de cima: você continua precisando de algo de pé mantendo o `eth_subscribe` contra o nó.\n\n**No projeto**: o TAP diz explicitamente que **não** contempla deploy em produção, então nada disso é entrega obrigatória. Mas o benefício que a Alphractal listou é "validação de nova arquitetura de dados... prova de conceito pra escalar o monitoramento pra outras redes L1 e L2". Essa conversa é o que entrega esse benefício. Levem um slide dela pra demo do dia 05/10.',
      pass3: [
        {
          gotcha: 'Escolher Lambda por hábito',
          note: 'Ela é excelente pro snapshot (request curta, sem estado) e inútil pro stream. Dá pra usar as duas coisas, cada uma no caminho certo.',
        },
        {
          gotcha: 'Ignorar o idle timeout do balanceador',
          note: '60 segundos é o padrão do ALB. Sem keep-alive, todo cliente reconecta de minuto em minuto e você acha que é bug de rede do cliente.',
        },
        {
          gotcha: 'Escalar horizontalmente sem separar ingestão de entrega',
          note: 'Cada réplica vira um cliente a mais do nó e uma versão a mais da verdade. Ingestor único, entrega replicada.',
        },
        {
          gotcha: 'Achar que sticky session resolve o estado divergente',
          note: 'Sticky prende o usuário numa instância, o que esconde a divergência sem eliminar ela. Dois usuários em instâncias diferentes continuam vendo números diferentes.',
        },
      ],
      anchor:
        'Vocês vão subir isso na AWS e o primeiro reflexo de todo mundo é Lambda. Diga por que Lambda não serve nesse desenho, e o que serve no lugar.',
      askWho: [
        {
          name: 'quem já subiu algo na AWS ou fez o curso de cloud',
          why: 'Vai chegar em Lambda por reflexo, e é isso que você quer que apareça pra poder atacar com o perfil de conexão.',
        },
        {
          name: 'quem já usou Docker',
          why: 'Fargate cai fácil pra quem já pensou em container. Bom segundo pra puxar a alternativa depois que Lambda cair.',
        },
        { name: 'open', why: 'Se ninguém tem cloud na bagagem, ensine do zero: esse beat não depende de conhecimento prévio, depende do desenho do beat 9.' },
      ],
      followup:
        'Fecha o ciclo: qual foi a única pergunta que decidiu cada um desses serviços?',
      gotcha:
        'Se alguém disser "Lambda com timeout de 15 minutos resolve", devolva: "e no minuto 16? E os outros 200 usuários conectados, cada um segura uma Lambda de pé?"',
      scenarios: {
        right: {
          shape:
            'Percebe que Lambda é request/response e não mantém conexão, e propõe compute persistente (Fargate ou EC2). Bônus se levanta o problema de estado compartilhado entre réplicas.',
          redirect:
            'Aprofunde no operacional: "subiu no Fargate atrás de um ALB. Sessenta segundos sem bloco novo. O que o ALB faz com sua conexão SSE?"',
        },
        close: {
          shape:
            'Sabe que Lambda tem limite de tempo mas não articula que o modelo dela é incompatível com conexão persistente, ou não vê o problema das réplicas.',
          redirect:
            'Separe as duas coisas: "esqueça o timeout. Entre duas invocações, onde o socket com o nó ficaria guardado?"',
        },
        wayOff: {
          shape:
            'Escolhe serviços pelo que já usou, sem conectar com o perfil de conexão longa. Ou propõe cron chamando Lambda de tempos em tempos.',
          redirect:
            'O cron é polling disfarçado: "de quanto em quanto tempo esse cron roda? E o que a gente concluiu sobre perguntar em intervalo fixo?"',
        },
      },
      diagram:
        'flowchart LR\n  N[("Nó Alchemy")] -->|"wss, conexão viva por horas"| ING["Ingestor ÚNICO<br/>ECS Fargate<br/>mantém o eth_subscribe"]\n  ING --> R[("ElastiCache Redis<br/>último valor + pub/sub")]\n  R --> A1["SSE server 1<br/>Fargate"]\n  R --> A2["SSE server 2<br/>Fargate"]\n  R --> LAM["Lambda<br/>GET /snapshot<br/>request curta, aqui serve"]\n  A1 --> ALB["ALB<br/>idle timeout 60s<br/>exige keep-alive"]\n  A2 --> ALB\n  LAM --> ALB\n  ALB --> BR["Navegadores"]\n  classDef ok fill:#f2ecff,stroke:#7132f5,stroke-width:2px,color:#101114\n  classDef hub fill:#e7f5ee,stroke:#149e61,stroke-width:2px,color:#101114\n  classDef warn fill:#fff8e8,stroke:#b07d1a,stroke-width:2px,color:#101114\n  class N,A1,A2,LAM,BR ok\n  class ING,R hub\n  class ALB warn',
      diagramUrl: '/diagrams/websocket-rpc-blockchain/aws.png',
    },

    // ──────────────── SÍNTESE ────────────────
    {
      id: 'synthesis',
      label: 'Dois ritmos, e um amortecedor no meio',
      group: 'synthesis',
      tags: ['fan-in/fan-out', 'push', 'backfill', 'backpressure'],
      oneLine:
        'O mundo produz evento no ritmo dele. A tela consome no ritmo dela. Todo o trabalho é o amortecedor entre os dois.',
      pass1:
        'A aula inteira cabe numa frase. De um lado, a rede Ethereum produz um evento a cada 12 segundos, em hexadecimal, sem avisar, e às vezes a conexão cai no meio. Do outro, uma tela precisa de um número em dólar no primeiro frame, igual pra todo mundo, e sem travar. Esses dois ritmos não conversam. O backend existe pra ser o amortecedor entre eles.',
      pass2:
        '**Uma conexão pra cima, muitas pra baixo**: o dado é um só, então você o busca uma vez. As telas são muitas, então você distribui. Fan-in e fan-out são o formato de qualquer sistema de tempo real, do painel de gás ao mapa da Uber.\n\n**Transporte se escolhe por direção, não por moda**: dos dois lados o servidor empurra, mas de cima você precisa mandar comandos (assinar, cancelar) e por isso é WebSocket, e de baixo você só recebe e por isso SSE basta e ainda reconecta de graça.\n\n**Stream conta o presente, HTTP conta o passado**: a assinatura entrega do momento em que você assinou pra frente e nada mais. Todo buraco (reconexão, primeira renderização) se preenche com chamada request/response. Os dois transportes convivem no mesmo serviço porque respondem perguntas diferentes.\n\n**A taxa de entrada não é a taxa de saída**: entre o que chega e o que você repassa tem uma decisão sua. Agregue, converta, resuma. Mande conclusão pronta.\n\n**E isso não é sobre blockchain**: troque o nó Ethereum por cotação de ação, ônibus no GPS, sensor de temperatura ou fila do Kafka. O desenho não muda uma caixa. Vocês aprenderam a arquitetura de painel ao vivo, e o Ethereum foi só o exemplo com o melhor lab.',
      pass3: [
        {
          gotcha: 'Sair daqui achando que a aula foi sobre WebSocket',
          note: 'Foi sobre quem inicia a conversa. WebSocket, SSE e polling são três respostas pra essa pergunta, e a resposta certa depende da direção do dado.',
        },
        {
          gotcha: 'Achar que push substitui request/response',
          note: 'Ele complementa. Todo sistema push de verdade tem um caminho request/response pro estado inicial e pro backfill.',
        },
        {
          gotcha: 'Guardar as ferramentas em vez do critério',
          note: 'Daqui a um ano ninguém lembra a sintaxe do eth_subscribe. O que fica é: quem fala primeiro, quantas conexões, e onde a conta acontece.',
        },
      ],
      anchor:
        'Sem falar de Ethereum, descreva o desenho que a gente construiu hoje. Se você conseguir, ele serve pro próximo projeto de vocês também.',
      followup:
        'Onde mais vocês já viram esse mesmo desenho, sem saber que era ele?',
      gotcha:
        'Se a sala responder a síntese com nomes de tecnologia, peça de novo sem citar nenhuma tecnologia. O desenho tem que sobreviver à troca de ferramenta.',
    },
  ],
};

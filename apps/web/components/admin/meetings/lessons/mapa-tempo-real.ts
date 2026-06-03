import type { Lesson } from '../lesson-types';

// Fontes: Uber Eng "Real-time Push Platform" + "Next-gen push on gRPC" (uber.com/blog)
// - Medium "smooth real-time map" (ndriqim.muhadri99) - Gabriel Gambetta (client-side prediction
// - / entity interpolation) - "Believable Dead Reckoning" (Game Engine Gems) - MDN (SSE/WebSocket)
// - PubNub (Kalman/dead-reckoning) - Uber H3 (uber.com/blog/h3)
export const mapaTempoReal: Lesson = {
  slug: 'mapa-tempo-real',
  title: 'O Mapa em Tempo Real da Uber',
  subtitle: 'Por que o carro anda liso com GPS de 4 em 4 segundos: push, interpolação e Kalman.',
  blurb:
    'A aula irmã do "motorista mais perto", agora do lado do CLIENTE. O GPS do motorista manda posição só a cada ~4 segundos, mas o carro desliza liso na sua tela a 60 quadros por segundo. Como o app preenche o vão? A gente separa dois relógios (o dos dados e o da tela), troca polling por push (na Uber, ~80% das requisições eram só polling vazio), preenche o vão entre dois pontos com interpolação ou dead reckoning (e paga o preço de cada um), limpa o tremor do GPS com Kalman e snap-to-road, e no fim escala a entrega: o RAMEN da Uber segura 1,5 milhão de conexões vivas, e o custo é o estado por conexão, não o throughput. A regra que sai daqui: desacople a taxa dos dados da taxa da tela, com um buffer no meio. É o mesmo truque de netcode de jogo, interpolação de vídeo e fusão de sensores.',
  durationMin: 60,
  audience: 'Hot Stuff 2026.2 · Big Tech',
  slidesUrl: '/slides/mapa-tempo-real.html',
  nodes: [
    // ──────────────── FOUNDATIONS (study-only) ────────────────
    {
      id: 'f-dois-relogios',
      label: 'Os dois relógios',
      group: 'foundations',
      teachFromZero: true,
      oneLine:
        'A tela atualiza ~60 vezes por segundo. O GPS chega ~uma vez a cada 4 segundos. A aula inteira é sobre como preencher o vão entre esses dois ritmos.',
      pass1:
        'Tem dois relógios batendo em ritmos muito diferentes, e entender isso destrava a aula toda. O relógio da TELA bate rápido: ~60 quadros por segundo, um quadro a cada ~16 milissegundos, e a cada quadro o app precisa desenhar o carro em ALGUM lugar. O relógio dos DADOS bate devagar: o GPS do motorista manda a posição dele só a cada ~4 segundos. Entre um ponto e o outro, a tela desenhou ~240 quadros sem nenhum dado novo. A pergunta da aula é: o que o app põe nesses 240 quadros pra o carro andar liso em vez de pular?',
      pass2:
        'Reescrevendo o problema com nome: existe uma **taxa de atualização** (quão rápido o dado novo chega) e uma **taxa de renderização** (quão rápido a tela redesenha). Quando a renderização é muito mais rápida que a atualização, você tem um vão pra preencher a cada quadro.\n\nO ingênuo é mover o carro só quando chega um ponto novo. O resultado é um carro que teleporta de 4 em 4 segundos, um sapinho pulando pela tela. Inaceitável pra um produto que as pessoas ficam olhando.\n\nA saída tem duas metades, e elas são o esqueleto da aula. Primeiro, o dado precisa CHEGAR rápido e barato (push em vez de polling). Segundo, entre dois dados, o cliente precisa INVENTAR os quadros do meio de um jeito convincente (interpolação, dead reckoning, Kalman). A entrega cuida do relógio dos dados; o cliente cuida do relógio da tela.\n\nGuarde a frase que volta na síntese: desacoplar a taxa dos dados da taxa da tela, com um buffer no meio. É o mesmo padrão de jogo online, de interpolação de vídeo e de fusão de sensores.',
      pass3: [
        {
          gotcha: 'Mover o carro só quando chega dado',
          note: 'Atualizar a posição só no ping de GPS faz o carro pular de 4 em 4 segundos. A tela bate a ~60fps; ela precisa de uma posição pra desenhar em TODO quadro, não só nos pings.',
        },
        {
          gotcha: 'Achar que é só "animar mais rápido"',
          note: 'Mais FPS não resolve. Falta dado entre dois pontos: você precisa de uma regra pra decidir onde o carro está nos 240 quadros sem GPS, não de mais quadros.',
        },
        {
          gotcha: 'Confundir os dois relógios',
          note: 'Taxa de dados (quando o GPS chega) e taxa de tela (quando redesenha) são independentes. Misturar as duas é a raiz da confusão. O buffer entre elas é o que a aula constrói.',
        },
      ],
      anchor:
        'A tela redesenha ~60 vezes por segundo, mas o GPS do motorista chega só a cada ~4 segundos. Quantos quadros a tela desenha sem nenhum dado novo, e o que ela põe neles?',
      followup: 'Antes de preencher o vão, o dado precisa chegar. Qual o jeito mais barato do servidor te avisar que o carro se moveu?',
      gotcha:
        'Se alguém disser "é só pegar a posição e desenhar", devolva: "a posição nova chega a cada 4s. A tela desenha 240 vezes nesse meio tempo. O que ela desenha no quadro 100?"',
    },
    // ──────────────── STREAM: push ────────────────
    {
      id: 'o-carro-liso',
      label: 'O carro que não pula',
      group: 'stream',
      beat: 1,
      teachFromZero: true,
      tags: ['taxa-de-atualizacao', 'taxa-de-render', '60fps', 'gps-4s'],
      oneLine:
        'O GPS chega a cada ~4s, mas o carro desliza liso na tela. O segredo está em separar o relógio dos dados do relógio da tela.',
      pass1:
        'Você pede um Uber e fica olhando o carrinho se aproximar. Ele anda suave, contínuo, como se você tivesse um rastreador perfeito do motorista. Você NÃO tem. O celular dele manda a posição por GPS só a cada ~4 segundos, e ainda por cima tremida. Tudo que parece suave na sua tela é, em boa parte, o app preenchendo o vão entre dois pontos esparsos e te contando uma história convincente. A aula inteira é desmontar essa mágica em duas partes: como o dado chega (rápido e barato) e como a tela inventa o que tem no meio (de um jeito que não parece mentira).',
      pass2:
        'O carro liso é uma ilusão construída em duas frentes, e vale separar as duas desde já porque elas têm soluções diferentes.\n\nA primeira frente é a **entrega**: como o servidor te avisa, rápido e sem desperdício, que o motorista se moveu. É aqui que entra push em vez de polling, e o transporte (SSE, WebSocket, gRPC) que segura milhões de conexões vivas.\n\nA segunda frente é a **suavização no cliente**: dado o último ponto conhecido (e talvez velocidade e direção), onde desenhar o carro AGORA, nesse quadro, antes do próximo GPS chegar. É aqui que entram interpolação, dead reckoning e o filtro de Kalman.\n\nNo fim a gente junta tudo num sistema que escala pra milhões de telas ao mesmo tempo, e esse é o último beat da aula. Mas começa pelo dado: ele precisa chegar antes de você poder suavizar nada.',
      pass3: [
        {
          gotcha: 'Achar que existe um rastreador perfeito',
          note: 'Não tem stream contínuo de posição. Tem pontos esparsos (~4s) e tremidos. O "suave" é construído pelo app. Saber disso é o ponto de partida.',
        },
        {
          gotcha: 'Misturar entrega com suavização',
          note: 'São dois problemas separados: como o dado CHEGA (push/transporte) e como a tela PREENCHE o vão (interpolação/Kalman). Resolver um não resolve o outro.',
        },
        {
          gotcha: 'Subestimar a escala da entrega',
          note: 'Não é uma tela, são milhões olhando ao mesmo tempo, cada uma com uma conexão viva. A entrega em escala é metade do problema, e a parte cara.',
        },
      ],
      anchor:
        'Você acompanha o motorista chegar e o carro anda liso na tela. Mas o GPS dele só manda posição a cada ~4 segundos. Aponte as DUAS coisas que o app precisa resolver pra essa suavidade existir.',
      askWho: [
        {
          name: 'open',
          why: 'Beat de abertura, desmonta uma ilusão que todo mundo já viu (o carrinho do Uber andando). Deixe a sala perceber sozinha que o GPS é esparso e que o suave é inventado. Território novo pra todos.',
        },
        {
          name: 'Maria Clara',
          why: 'Maior breadth do cohort. Se precisar puxar alguém pra separar "entrega" de "suavização", ela tem a base mais ampla pra enxergar as duas frentes.',
        },
      ],
      followup: 'Vamos pela entrega primeiro. Pra mostrar o carro andando, seu primeiro instinto é o app ficar perguntando "cadê o motorista?". Por que isso é um desperdício?',
      gotcha:
        'Quando alguém disser "o servidor manda a posição direto", devolva: "manda como? Você fica perguntando de 1 em 1 segundo? E quando o carro está parado no sinal por 40s, são 40 perguntas pra ouvir a mesma resposta?"',
      scenarios: {
        right: {
          shape:
            'Separa as duas frentes: o dado precisa CHEGAR (entrega rápida) e a tela precisa PREENCHER o vão entre pontos esparsos (suavização). Sacou que o GPS é ~4s e a tela é ~60fps.',
          redirect:
            'Confirme a divisão e empurre pra entrega: "perfeito, entrega e suavização. Vamos pela entrega: como o servidor te avisa que o carro se moveu, sem você ficar perguntando?"',
        },
        close: {
          shape:
            'Percebe que o GPS é esparso mas acha que o app "só desenha quando chega", sem ver que isso faz o carro pular, ou foca só na suavização e esquece a entrega.',
          redirect:
            'Puxe a outra metade: "desenhar só quando chega faz o carro teleportar de 4 em 4s. E mesmo a suavização depende do dado chegar rápido. Como o dado chega?"',
        },
        wayOff: {
          shape:
            'Acha que o celular manda um stream contínuo de posição, ou que é tudo pré-calculado pela rota.',
          redirect:
            'Desfaça a suposição: "o GPS manda ponto a cada ~4s, não um stream. E a rota muda (o motorista vira numa rua errada). O que preenche os 4 segundos entre dois pontos reais?"',
        },
      },
    },
    {
      id: 'push-nao-polling',
      label: 'Push, não polling',
      group: 'stream',
      beat: 2,
      tags: ['push', 'polling', 'sse', 'websocket', 'grpc'],
      oneLine:
        'Perguntar "cadê o motorista?" toda hora desperdiça (na Uber, ~80% das requisições eram polling vazio). Push inverte: o servidor avisa quando muda.',
      pass1:
        'O instinto pra "mostrar o carro andando" é o app perguntar pro servidor "cadê o motorista?" a cada segundo. Isso é **polling**, e é caro do jeito errado: a maioria das perguntas volta sem novidade (o carro não mudou de posição desde a última), então você gasta rede, bateria e servidor pra ouvir "nada mudou" repetidamente. Na Uber, cerca de **80% das requisições do API gateway eram polling que não trazia dado novo**. A virada é **push**: em vez de o cliente perguntar, o servidor AVISA quando algo muda, por uma conexão que fica aberta. O app só recebe quando há o que receber.',
      pass2:
        'Por que push ganha quando as novidades são esparsas: no polling você paga por TODA pergunta, inclusive as vazias, e ainda escolhe mal a frequência (rápido demais desperdiça, devagar demais atrasa). No push você paga por uma conexão aberta e recebe só quando o servidor tem algo. Para localização, que muda devagar e às vezes nem muda (carro parado no sinal), a diferença é enorme.\n\nO push precisa de um transporte que mantenha a conexão viva. As opções, em ordem de poder:\n\n**SSE** (Server-Sent Events): mão única, servidor pro cliente, sobre HTTP comum, com reconexão automática de graça. Perfeito pra "o servidor me empurra updates" quando o cliente não precisa responder pelo mesmo canal.\n\n**WebSocket**: mão dupla, cliente e servidor falam pelo mesmo canal aberto, com o menor overhead por mensagem. Você ganha a bidirecionalidade, mas passa a cuidar da reconexão e do backoff na mão.\n\n**gRPC streaming**: mão dupla, binário, sobre HTTP/2. É pra onde a Uber foi, porque em escala o binário e o multiplexing do HTTP/2 pagam. A escolha entre os três é por direcionalidade, overhead e quem cuida da reconexão, não por moda.',
      pass3: [
        {
          gotcha: 'Achar que polling rápido "resolve"',
          note: 'Polling de 200ms parece tempo real, mas a maioria das respostas é vazia (o carro não mudou). Você multiplica o desperdício. O custo do polling está em pagar por toda pergunta, inclusive as vazias, e nenhuma frequência conserta isso.',
        },
        {
          gotcha: 'Usar WebSocket quando SSE basta',
          note: 'Se o fluxo é só servidor pro cliente (te empurrar a posição), SSE já resolve, com reconexão de graça. WebSocket é pra quando o cliente também precisa falar muito pelo mesmo canal. Mais poder, mais responsabilidade (reconexão sua).',
        },
        {
          gotcha: 'Esquecer a reconexão',
          note: 'Conexão viva cai (túnel, troca de rede). SSE reconecta sozinho; com WebSocket você implementa backoff e retomada. Um push que não reconecta direito vira uma tela congelada.',
        },
        {
          gotcha: 'Tratar push como "tempo real mágico"',
          note: 'Push te dá entrega eficiente, não suavidade. O carro continua chegando de 4 em 4s. Suavizar o movimento entre os pushes é o próximo problema, separado.',
        },
      ],
      anchor:
        'Pra mostrar o carro andando, seu primeiro instinto é o app perguntar "cadê o motorista?" a cada segundo. O carro fica parado no sinal por 40 segundos. Conte o desperdício, e diga o que o servidor faz no lugar.',
      askWho: [
        {
          name: 'Maria Clara',
          why: 'Estudou o WebSockets Crash Course (handshake, use-cases, prós e contras) + UDP/TCP + DNS. É a pessoa do cohort que mais tem base real em transporte de tempo real. Começa com ela.',
        },
        {
          name: 'Messias Olivindo',
          why: 'Também fez o WebSockets Crash Course. Bom segundo pra puxar a diferença mão-única vs mão-dupla e quando cada um serve.',
        },
        {
          name: 'Eduardo Hirohito',
          why: 'Fez o crash course de HTTP 1.0/1.1/2/3. Forte pra ancorar por que gRPC (binário sobre HTTP/2) e o que o HTTP/2 traz pro streaming.',
        },
      ],
      followup:
        'O dado agora chega rápido por push, mas ainda só a cada ~4s. Chegou o ponto A, e o próximo só daqui 4 segundos. Onde você desenha o carro nesse meio tempo?',
      gotcha:
        'Quando alguém disser "uso WebSocket porque é o mais moderno", devolva: "o cliente precisa MANDAR algo pelo mesmo canal, ou só receber a posição? Se é só receber, por que pagar a complexidade da mão dupla?"',
      scenarios: {
        right: {
          shape:
            'Identifica que polling paga por perguntas vazias (40 perguntas pro carro parado) e propõe push: conexão viva onde o servidor avisa quando muda. Bônus se cita SSE (mão única) vs WebSocket (mão dupla) e escolhe pelo fluxo.',
          redirect:
            'Confirme e refine o transporte se faltou: "isso, push evita as perguntas vazias. Agora, o fluxo é só o servidor te empurrando a posição? Então SSE ou WebSocket, e por quê?"',
        },
        close: {
          shape:
            'Chega em push mas não distingue os transportes, ou acha que WebSocket é sempre a resposta sem pensar na direcionalidade e na reconexão.',
          redirect:
            'Puxe a escolha: "mão única ou mão dupla? Quem cuida da reconexão em cada um? Se o cliente só recebe a posição, qual o mais simples que serve?"',
        },
        wayOff: {
          shape:
            'Defende polling rápido como tempo real, ou propõe gravar a posição num banco e o cliente consultar de tempos em tempos (que é polling com mais passos).',
          redirect:
            'Mostre o desperdício: "polling de 1s pro carro parado 40s são 40 respostas iguais. Multiplica por milhões de telas. Quem PERGUNTA nesse modelo, e quem deveria AVISAR?"',
        },
      },
    },
    // ──────────────── SMOOTH: o cliente ────────────────
    {
      id: 'preencher-o-vao',
      label: 'Preencher o vão: interpolar ou prever',
      group: 'smooth',
      beat: 3,
      teachFromZero: true,
      tags: ['interpolacao', 'dead-reckoning', 'lerp', 'rubber-banding', 'latencia-vs-suavidade'],
      oneLine:
        'Entre dois pontos de GPS você tem duas escolhas: interpolar entre os dois (suave, atrasado, sempre certo) ou prever pra frente (zero atraso, mas o erro cresce).',
      pass1:
        'Chegou a posição A às 12:00:00 e a B vai chegar só às 12:00:04. São 12:00:02 e a tela precisa desenhar o carro AGORA. Onde? Tem duas filosofias, e elas brigam. **Interpolação**: espere ter os DOIS pontos (A e B) e desenhe o carro deslizando de A pra B ao longo dos 4 segundos. Suave e sempre certo, porque você só desenha entre pontos REAIS, mas você fica sempre um pouco no passado (precisa esperar B chegar). **Dead reckoning** (extrapolação): não espere; a partir de A mais a velocidade e a direção, ADIVINHE onde o carro deve estar agora. Zero atraso, mas se o motorista virou ou parou, sua adivinhação erra, e o erro cresce quanto mais demora o próximo ponto.',
      pass2:
        'A interpolação é só uma média ponderada, o **LERP**: posição = A + v × (B menos A), onde v vai de 0 (no ponto A) a 1 (no ponto B). Um temporizador empurra v de 0 a 1 ao longo da janela de update, e a cada quadro você desenha o carro na fração v do caminho. Como você precisa de B pra interpolar até ele, o carro mostrado fica sempre ~uma janela atrás do tempo real. Você trocou atraso por suavidade perfeita e zero ultrapassagem.\n\nO **dead reckoning** projeta pra frente: posição_agora = A + velocidade × tempo_decorrido (e, se quiser, mais meia aceleração vezes tempo ao quadrado, física de projétil). Os ingredientes que a Uber cita são exatamente: última posição, velocidade, direção (course) e tempo. Zero atraso, mas a aposta degrada: funciona bem quando o movimento é previsível (carro numa via, em velocidade), e falha quando a direção pode mudar de repente.\n\nO problema espinhoso é a **correção**. Você previu que o carro estaria num ponto, e chega um GPS real dizendo que ele está noutro. Se você TELEPORTAR pra posição nova, aparece um salto feio na tela, o **rubber-banding** (efeito elástico). A solução é convergir suave: misture da posição prevista pra nova ao longo de uma janelinha, em vez de saltar. Técnicas como projective velocity blending ou splines fazem isso.\n\nNa prática você usa os dois: interpolação pra suavidade base, dead reckoning pra matar o atraso quando o movimento é previsível, e convergência pra esconder a correção. O próximo beat adiciona uma camada que limpa o tremor do próprio GPS.',
      pass3: [
        {
          gotcha: 'Teleportar na correção',
          note: 'Quando o GPS real discorda da sua previsão, saltar pra posição nova faz o rubber-banding (o carro pula). Converja suave: misture da previsão pra o dado real ao longo de uma janelinha.',
        },
        {
          gotcha: 'Extrapolar movimento imprevisível',
          note: 'Dead reckoning assume que o carro segue reto na velocidade atual. Em cruzamento, conversão, freada, ele erra feio. Quanto mais tempo sem GPS novo, maior o erro. Em movimento errático, prefira interpolar.',
        },
        {
          gotcha: 'Esquecer que interpolação atrasa',
          note: 'Pra interpolar de A pra B você precisa de B, então mostra sempre ~uma janela no passado. Pra um carro chegando isso é aceitável; pra reação instantânea, não. Saber o atraso que você aceitou é o ponto.',
        },
        {
          gotcha: 'Largar updates que chegam no meio da animação',
          note: 'Se um ponto novo chega enquanto a animação anterior roda, não descarte: enfileire e re-mire o alvo, senão o carro engasga ou pula etapas. O heading entre dois pontos também rotaciona o ícone pra apontar pra frente.',
        },
      ],
      anchor:
        'Chegou a posição A às 12:00:00 e a B só chega às 12:00:04. São 12:00:02 e você precisa desenhar o carro AGORA. Dê duas posições possíveis (uma esperando B, uma sem esperar) e o risco de cada uma.',
      askWho: [
        {
          name: 'open',
          why: 'Ninguém no cohort estudou animação de cliente / netcode (interpolação, dead reckoning). É um beat de raciocinar, não de lembrar. Abra: a sala consegue derivar "espero o segundo ponto" vs "chuto pra frente" sozinha.',
        },
        {
          name: 'Maria Clara',
          why: 'Maior breadth + base de matemática. Backup pra formalizar o LERP (média ponderada) e a ideia de prever por velocidade e tempo.',
        },
        {
          name: 'open',
          why: 'Pergunta aberta de novo na correção (rubber-banding): deixe alguém propor o "teleporta pra posição certa" e use o salto feio resultante pra introduzir convergência suave.',
        },
      ],
      followup:
        'Tanto interpolar quanto prever assumem que o ponto de GPS é confiável. Mas o GPS treme: num cruzamento ele te joga 10 metros pro lado. Como você limpa esse tremor?',
      gotcha:
        'Quando alguém escolher só uma filosofia, devolva: "interpolar te deixa no passado; prever te faz errar nas conversões. Os dois têm preço. Quando você usaria cada um?"',
      scenarios: {
        right: {
          shape:
            'Dá as duas: esperar B e deslizar de A pra B (interpolação, suave mas atrasada), ou projetar de A pela velocidade/direção (dead reckoning, sem atraso mas erra na conversão). Nomeia o tradeoff atraso vs suavidade.',
          redirect:
            'Confirme e adicione a correção: "perfeito, os dois caminhos. Agora, você previu e chega um GPS dizendo outra coisa. Se você teleporta pro ponto certo, o que o usuário vê?" (rubber-banding → convergir).',
        },
        close: {
          shape:
            'Descreve uma das duas (geralmente interpolar) mas não vê o tradeoff, ou não sabe o que fazer quando o próximo ponto desmente a previsão.',
          redirect:
            'Puxe o outro lado: "e se você não puder esperar o ponto B (quer zero atraso)? Como adivinha agora? E quando a adivinhação erra, como conserta sem saltar?"',
        },
        wayOff: {
          shape:
            'Quer só desenhar o último ponto recebido (volta ao carro pulando), ou calcular a rota inteira e seguir cegamente por ela ignorando o GPS.',
          redirect:
            'Reancore no vão: "desenhar o último ponto faz pular. Seguir a rota cega ignora que o motorista pode desviar. Você tem A agora e B daqui 4s. O que põe ENTRE os dois?"',
        },
      },
    },
    {
      id: 'kalman-via',
      label: 'Kalman e grudar na via',
      group: 'smooth',
      beat: 4,
      teachFromZero: true,
      tags: ['kalman', 'predict-update', 'ganho', 'map-matching', 'snap-to-road'],
      oneLine:
        'O GPS treme. O filtro de Kalman funde a previsão do movimento com a medição ruidosa, pesando cada uma pela confiança. E grudar na via projeta o carro na rua mais provável.',
      pass1:
        'Tem um problema embaixo do problema: o próprio GPS é ruidoso. Num cruzamento cercado de prédios, ele pode te reportar 10 metros pro lado, dentro de um edifício, fora da rua. Se você interpolar ou prever em cima de pontos tremidos, propaga o tremor. Duas ferramentas limpam isso. O **filtro de Kalman** funde a sua PREVISÃO de onde o carro deveria estar com a MEDIÇÃO ruidosa que chegou, dando mais peso a quem está mais confiante. E o **map-matching** (grudar na via) projeta o ponto na rua mais provável, porque você sabe que um carro está numa rua, não atravessando o quarteirão pela diagonal.',
      pass2:
        'O Kalman é um loop de dois passos que roda pra sempre. No passo **prever**, ele usa um modelo de movimento (tipicamente velocidade constante: próxima posição = posição atual mais velocidade vezes tempo) pra adivinhar onde o carro deveria estar agora, e aumenta a incerteza, porque previsão envelhece. No passo **atualizar**, chega a medição do GPS e o filtro mistura previsão e medição usando o **ganho de Kalman** K, um peso de 0 a 1: K perto de 1 confia mais no sensor, K perto de 0 confia mais no modelo. O peso sai sozinho da razão entre as incertezas.\n\nO nome geral disso é **estimativa bayesiana recursiva**: você guarda uma crença sobre o estado escondido (a posição real) mais a incerteza dela, e a cada tique prevê pra frente e corrige com a evidência ruidosa, pesando pela confiança. A média móvel exponencial (se você já cruzou com ela) é um Kalman de ganho fixo. Mesmo padrão, versão simplificada.\n\nNa prática, Kalman cheio às vezes é overkill. O atalho de produção pra rastrear veículo é o **snap-to-road**: em vez de filtrar pesado, gruda o ponto na rua mais provável. Casar uma SÉRIE de pontos (não um só) desambigua cruzamentos, viadutos e túneis, onde um ponto isolado não diz em qual via você está. Google Roads API e Mapbox Map Matching fazem exatamente isso.\n\nJuntando as camadas da aula até aqui: push entrega o ponto, Kalman e snap-to-road limpam o ponto, e interpolação ou dead reckoning preenchem os quadros entre os pontos limpos. Três camadas, cada uma resolvendo um pedaço da ilusão de suavidade.',
      pass3: [
        {
          gotcha: 'Achar que Kalman "adivinha o futuro"',
          note: 'Kalman não prevê magicamente. Ele funde uma previsão simples (modelo de velocidade) com a medição ruidosa, pesando pela confiança de cada uma. O poder está na fusão ponderada, não numa bola de cristal.',
        },
        {
          gotcha: 'Filtrar pesado quando snap-to-road resolve',
          note: 'Pra carro numa rua, grudar na via mais provável costuma resolver mais barato que um Kalman completo. Use a estrutura do problema (existe uma malha de ruas) antes de jogar matemática pesada.',
        },
        {
          gotcha: 'Casar um ponto só na via',
          note: 'Um ponto isolado num viaduto não diz se você está em cima ou embaixo. Casar a SÉRIE de pontos recentes desambigua cruzamentos e túneis. Map-matching é sobre a sequência, não o ponto.',
        },
        {
          gotcha: 'Tentar suavizar GPS de quem está parado',
          note: 'Em velocidade muito baixa o GPS nunca dá posição estável, por limite da tecnologia. Filtrar mais não conserta. Melhor grudar na via ou segurar a posição do que animar o tremor de um carro parado.',
        },
      ],
      anchor:
        'O carro atravessa um cruzamento cercado de prédios a ~30 km/h e o GPS reporta ele 10 metros pra dentro de um edifício. Você tem a posição anterior e a velocidade. Como você decide onde o carro realmente está?',
      askWho: [
        {
          name: 'open',
          why: 'Kalman e map-matching ninguém estudou (é processamento de sinal / matemática aplicada). Beat de raciocínio: a sala consegue chegar em "confio mais no sensor ou no que eu esperava?" sozinha antes do nome formal.',
        },
        {
          name: 'Maria Clara',
          why: 'Tem matemática na bagagem e a maior breadth. Melhor posicionada pra formalizar o "pesar previsão vs medição pela confiança" sem assustar a sala com álgebra.',
        },
        {
          name: 'open',
          why: 'Abra de novo pro snap-to-road: alguém quase sempre sugere "mas o carro está numa rua", e essa intuição É o map-matching. Premie a ideia antes do termo.',
        },
      ],
      followup:
        'Já sabemos entregar e suavizar pra UMA tela. Mas são milhões olhando, e 1 milhão de motoristas mandando posição. Como o servidor não vira um broadcast de N vezes M?',
      gotcha:
        'Quando alguém propuser "só faz a média dos últimos pontos", devolva: "média trata o ponto tremido e o ponto bom com o mesmo peso. Como você dá MAIS peso ao ponto em que você confia mais?"',
      scenarios: {
        right: {
          shape:
            'Propõe confiar mais na previsão (posição anterior + velocidade) que na medição absurda, e/ou grudar na via mais provável (o carro está numa rua, não num prédio). Sacou a ideia de pesar por confiança e/ou usar a malha viária.',
          redirect:
            'Confirme e nomeie: "isso é o coração do Kalman (pesar previsão vs medição pela confiança) e do map-matching (grudar na via). Agora sobe a escala: e quando são milhões de telas e motoristas?"',
        },
        close: {
          shape:
            'Quer suavizar com média móvel simples (trata todos os pontos igual) ou só descartar o ponto ruim por um limiar, sem a ideia de fusão ponderada nem da malha viária.',
          redirect:
            'Refine: "média dá o mesmo peso pro ponto tremido e pro bom. E você SABE que ele está numa rua. Como usa essas duas coisas, peso por confiança e a malha?"',
        },
        wayOff: {
          shape:
            'Confia cegamente no GPS e desenha o carro dentro do prédio, ou acha que precisa de um modelo de ML pesado pra um problema de fusão de dois números.',
          redirect:
            'Traga ao concreto: "o GPS diz dentro do prédio. Você confia? Você tinha uma previsão (posição anterior + velocidade) que dizia outra coisa. Em qual você confia mais, e por quê?"',
        },
      },
    },
    // ──────────────── FANOUT + ARQUITETURA ────────────────
    {
      id: 'fan-out',
      label: 'Fan-out: quem recebe o quê',
      group: 'fanout',
      beat: 5,
      teachFromZero: true,
      tags: ['pub-sub', 'celula-canal', 'geohash', '9-celulas', 'broadcast-storm'],
      oneLine:
        'Mandar a posição de cada motorista pra todo mundo seria N vezes M. A saída: cada célula do mapa é um canal pub/sub, e você só assina a sua célula e as vizinhas.',
      pass1:
        'Subindo a escala: 1 milhão de motoristas mandando posição, milhões de passageiros olhando. Se cada update de um motorista fosse entregue pra todas as telas, seria N vezes M, uma tempestade de broadcast que derruba qualquer sistema. Mas você não precisa: o passageiro só liga pra os carros perto dele. A saída reaproveita o índice espacial da aula anterior. Divida o mundo em células (geohash ou os hexágonos H3) e trate cada célula como um **canal de pub/sub**. O motorista PUBLICA a posição só no canal da célula onde ele está. O passageiro ASSINA só o canal da célula dele mais o anel de células vizinhas. Ninguém recebe o que não interessa.',
      pass2:
        'O modelo é publish/subscribe com a chave de partição vinda do espaço. O motorista calcula a célula a partir do seu lat/long e publica ali. A tela do passageiro mantém a conexão viva (do beat de push) assinando a célula dele e o anel ao redor (a vizinhança 3x3 que vimos no índice espacial: a célula central e as 8 ao redor). Quando o passageiro arrasta o mapa, o cliente CANCELA a assinatura das células que saíram da tela e ASSINA as que entraram.\n\nA conta muda de figura. Sem isso, um update vira N×M (todos os motoristas pra todas as telas). Com células, um update toca só os assinantes daquela célula, que são poucos. Você transformou um broadcast global O(N×M) numa entrega O(assinantes-por-célula).\n\nO pulo transferível, que vale pra muito além de mapa: **pub/sub com tópico-por-shard, chaveado por um índice hierárquico que os dois lados calculam sozinhos**. O motorista sabe sua célula a partir do lat/long; o passageiro sabe quais células olhar a partir da viewport. Ninguém precisa de um diretório central dizendo quem fala com quem. É o mesmo movimento de shardar um chat por sala, ou um feed por autor: a chave de partição é algo que publisher e subscriber derivam do próprio estado.',
      pass3: [
        {
          gotcha: 'Broadcast pra todo mundo',
          note: 'Mandar cada update pra todas as telas é O(N×M) e não escala. O passageiro só liga pros carros perto. A célula recorta "perto" num canal barato.',
        },
        {
          gotcha: 'Esquecer o anel de vizinhas',
          note: 'Assinar só a própria célula perde o carro que está logo do outro lado da borda. Assine a célula central e as 8 vizinhas. É a mesma regra das 9 células do índice espacial, agora aplicada à assinatura.',
        },
        {
          gotcha: 'Não atualizar a assinatura ao mover o mapa',
          note: 'Quando o passageiro arrasta ou dá zoom, a viewport muda de células. Cancele as que saíram, assine as que entraram, senão você recebe carros fora da tela e perde os que entraram.',
        },
        {
          gotcha: 'Precisar de um diretório central de quem-fala-com-quem',
          note: 'A graça do pub/sub por célula é que a chave (a célula) sai do lat/long dos dois lados. Ninguém mantém uma lista de "tela X quer motorista Y". O espaço é a chave.',
        },
      ],
      anchor:
        '1 milhão de motoristas mandando posição, milhões de telas olhando. Se cada update fosse pra todo mundo, seria N vezes M. Como o servidor entrega a posição de UM motorista só pra quem precisa ver?',
      askWho: [
        {
          name: 'Maria Clara',
          why: 'Estudou WebSockets (que é o transporte do pub/sub) e tem a maior breadth. Âncora pra ligar "conexão viva assina um canal" com "célula é o canal".',
        },
        {
          name: 'Messias Olivindo',
          why: 'Também fez WebSockets. Bom pra parte de assinar/cancelar canal conforme a viewport muda.',
        },
        {
          name: 'Rayssa Guedes',
          why: 'Callback direto: ela ancorou o geohash na aula do motorista mais perto (consistent hashing, células). Aqui a célula vira a chave do canal. Puxe a conexão entre as duas aulas com ela.',
        },
      ],
      followup:
        'Junta tudo: o GPS entra de um lado, o pixel anda na minha tela do outro. Qual é o caminho completo, e onde está o gargalo de escala?',
      gotcha:
        'Quando alguém disser "manda pra todo mundo e o cliente filtra", devolva: "o cliente filtra 1 milhão de posições por segundo? Quem deveria filtrar, e ANTES de mandar pela rede?"',
      scenarios: {
        right: {
          shape:
            'Propõe particionar o mapa em células e usar cada célula como canal pub/sub: motorista publica na sua célula, passageiro assina a dele + vizinhas. Sacou que isso troca O(N×M) por O(assinantes-por-célula). Bônus: liga com o geohash/H3 da aula anterior.',
          redirect:
            'Confirme e generalize: "exato, a célula é a chave do canal, e os dois lados a derivam do lat/long. Esse é o padrão tópico-por-shard. Agora junta o sistema inteiro num diagrama."',
        },
        close: {
          shape:
            'Chega em "só manda pros que estão perto" mas não estrutura como (sem células/canais), ou esquece o anel de vizinhas e perde quem está na borda.',
          redirect:
            'Dê a estrutura: "como o servidor sabe quem está perto sem comparar todo mundo com todo mundo? E se o carro está na borda da sua célula?" (célula como canal + anel).',
        },
        wayOff: {
          shape:
            'Quer mandar tudo pra todas as telas e filtrar no cliente, ou manter uma lista central de qual tela quer qual motorista.',
          redirect:
            'Mostre o custo: "filtrar 1M de updates/s em cada celular não escala, e a lista central vira um gargalo. O que os DOIS lados conseguem calcular sozinhos pra virar a chave de entrega?"',
        },
      },
    },
    {
      id: 'arquitetura',
      label: 'Arquitetura: do GPS ao pixel',
      group: 'fanout',
      beat: 6,
      tags: ['ramen', 'fireball', 'grpc-quic', 'conexoes-vivas', 'stateless'],
      oneLine:
        'O fluxo completo: Fireball decide QUANDO empurrar, o Gateway decide O QUÊ, o RAMEN ENTREGA por gRPC, e o cliente suaviza. Segurar 1,5 milhão de conexões é o custo.',
      pass1:
        'Hora de juntar tudo num diagrama. O GPS do motorista entra de um lado, e o carro anda na sua tela do outro, e no meio tem um pipeline desenhado pra empurrar dado pra milhões de telas ao mesmo tempo. Na Uber, esse sistema é o RAMEN (Real-time Asynchronous Messaging Network), com uma divisão limpa de responsabilidades: um componente decide QUANDO empurrar, outro decide O QUÊ mandar, e o RAMEN faz a ENTREGA. O detalhe que vira a chave do design: o caro é segurar 1,5 milhão de conexões vivas ao mesmo tempo, cada uma com seu estado, não a vazão de mensagens.',
      pass2:
        'O caminho, ponta a ponta. A posição do motorista chega e atualiza o índice espacial em memória (da aula anterior). O **Fireball** decide o timing (quando vale empurrar um update pra uma tela). O **API Gateway** monta o payload (o quê mandar). O **RAMEN** entrega pela conexão viva. O cliente recebe, limpa com Kalman/snap-to-road e suaviza com interpolação/dead reckoning. Cada caixa é um beat anterior, agora conectado.\n\nO transporte evoluiu. A Uber começou em SSE e migrou pra **gRPC sobre QUIC**, com confirmações (acks) embutidas no próprio canal, porque em escala o binário e o multiplexing do HTTP/2 pagam, e o QUIC reconecta mais rápido em rede móvel instável.\n\nO gargalo de verdade é a **conexão viva**. Segurar 1,5 milhão de conexões concorrentes custa em ESTADO por conexão, não em throughput. A regra de ouro: mantenha os servidores que terminam as conexões **sem estado** (stateless), guardando a sessão num store externo (tipo Redis), pra qualquer servidor atender qualquer conexão e você poder escalar horizontal. Some os parâmetros que mantêm a malha viva: heartbeat a cada ~4s, reconexão em ~7s, TTL de sessão de ~30min. E o fan-out continua recortado por célula (do beat anterior), com caches na borda servindo o dado quente. Os números que isso sustenta: ~70 mil requisições por segundo, 99,99% de confiabilidade, ~45% de melhora no p95 de latência ao trocar polling por push.',
      pass3: [
        {
          gotcha: 'Achar que o gargalo é throughput',
          note: 'O custo de 1,5M de conexões é o ESTADO por conexão (buffers, sessão, heartbeat), não a vazão de bytes. Dimensionar por throughput e esquecer o estado por conexão é o erro clássico.',
        },
        {
          gotcha: 'Servidor de conexão com estado',
          note: 'Se o servidor que termina a conexão guarda a sessão localmente, você não consegue reequilibrar nem escalar. Mantenha-o stateless e ponha a sessão num Redis. Qualquer nó atende qualquer conexão.',
        },
        {
          gotcha: 'Misturar QUANDO, O QUÊ e ENTREGAR numa coisa só',
          note: 'Fireball (timing), Gateway (payload) e RAMEN (entrega) são responsabilidades separadas de propósito, pra escalar e evoluir cada uma sozinha. Fundir as três num monolito de push tira essa folga.',
        },
        {
          gotcha: 'Ignorar a reconexão em rede móvel',
          note: 'Celular troca de torre, entra em túnel, cai. Sem heartbeat e reconexão rápida (e QUIC ajuda aqui), a tela congela. Os parâmetros (~4s heartbeat, ~7s reconnect) existem pra detectar e religar rápido.',
        },
      ],
      anchor:
        'Desenhe do GPS do motorista até o pixel andando na minha tela. Separe quem decide QUANDO empurrar, quem decide O QUÊ, e quem ENTREGA. E diga por que segurar 1,5 milhão de conexões é o problema caro.',
      askWho: [
        {
          name: 'Eduardo Hirohito',
          why: 'O perfil de rede/infra mais completo: HTTP 1/2/3, SSL/TLS, DNS, scalability, sharding. É quem desenha o pipeline e justifica gRPC sobre HTTP/2 e o custo de estado por conexão. Começa com ele.',
        },
        {
          name: 'Maria Clara',
          why: 'WebSockets + networking + maior breadth. Forte pra parte de conexão viva e por que manter o terminador stateless.',
        },
        {
          name: 'Livia Tavares',
          why: 'Fez Load Balancer dedicado. Âncora natural pra "como distribuir 1,5 milhão de conexões vivas entre os nós" e o porquê do sticky/stateless.',
        },
      ],
      followup:
        'Diagrama no quadro. Pra cada caixa (terminar as conexões, decidir o push, entregar, cachear na borda), qual managed service da AWS, e por quê?',
      gotcha:
        'Quando o desenho puser a sessão dentro do servidor de conexão, devolva: "esse nó caiu. As 200 mil conexões dele reconectam noutro nó, que não sabe nada delas. Onde a sessão deveria estar pra qualquer nó assumir?"',
      scenarios: {
        right: {
          shape:
            'Desenha o pipeline: índice em memória → Fireball (quando) → Gateway (o quê) → RAMEN (entrega via gRPC) → cliente (Kalman + interpolação). Aponta que o caro é o estado de 1,5M conexões e propõe terminadores stateless + Redis de sessão.',
          redirect:
            'Confirme a separação e empurre pra nuvem: "perfeito, três responsabilidades e o estado fora do terminador. Agora mapeia cada caixa pra um serviço da AWS."',
        },
        close: {
          shape:
            'Acerta o caminho de entrega mas dimensiona por throughput (esquece o estado por conexão), ou deixa a sessão no servidor de conexão.',
          redirect:
            'Puxe o estado: "1,5M conexões custam o quê, bytes ou estado? E se o nó cai, as conexões dele reconectam onde? O terminador pode ser stateless?"',
        },
        wayOff: {
          shape:
            'Desenha polling num banco, ou um monolito que faz tudo, sem conexões vivas nem separação de responsabilidades.',
          redirect:
            'Resgate as peças: "cadê o push? Quem segura a conexão viva? Refaz começando pelo update de posição que chega: quem decide se vale empurrar pra essa tela agora?"',
        },
      },
    },
    // ──────────────── AWS (mandatory) ────────────────
    {
      id: 'aws',
      label: 'AWS: cada caixa, um managed service',
      group: 'cloud',
      beat: 7,
      tags: ['api-gateway-websocket', 'elasticache', 'kinesis', 'cloudfront', 'connection-state'],
      oneLine:
        'Pra cada caixa existe um serviço gerenciado, e o que manda a escolha aqui é uma coisa: a conexão fica VIVA por minutos, não milissegundos.',
      pass1:
        'Com o diagrama no quadro, a pergunta de sempre: se subisse na AWS amanhã, qual serviço entra em cada caixa? A bússola desta aula é específica: a conexão fica VIVA por minutos. Isso muda tudo, porque a maioria dos serviços serverless é otimizada pra requisições curtas e sem estado, e aqui você precisa segurar milhões de canais abertos com sessão. O perfil de "conexão longa" elimina alguns candidatos óbvios e escolhe outros.',
      pass2:
        '**Terminar as conexões vivas (o coração)**: **API Gateway WebSocket API** (ou AWS AppSync pra subscriptions GraphQL) gerencia conexões persistentes sem você manter o servidor de socket na mão. Se quiser controle fino, um **ALB** (que suporta WebSocket) na frente de uma frota **ECS/EC2**. O que você NÃO quer é Lambda comum pra segurar a conexão: ela é feita pra invocação curta, e o modelo de cobrança e de ciclo de vida não combina com um canal aberto por 30 minutos.\n\n**O estado da sessão (pra deixar o terminador stateless)**: **ElastiCache for Redis**. Guarda qual conexão assina qual célula, o heartbeat, o cursor. Qualquer nó terminador lê do Redis e atende qualquer conexão, então você escala horizontal e sobrevive a um nó caindo.\n\n**O firehose de localização (entrada)**: **Kinesis Data Streams** ou **MSK** (Kafka gerenciado) absorvem o rio de pings dos motoristas e alimentam quem decide o push e quem atualiza o índice.\n\n**Dado quente na borda**: **CloudFront** (e Lambda@Edge) pra servir o conteúdo cacheado perto do usuário, o equivalente aos edge servers que a Uber cita. **Caching de dado quente** (posições recentes, payloads montados) também no ElastiCache. O fio condutor: o que dita cada escolha é a conexão longa e o estado por conexão, não a familiaridade com o serviço.',
      pass3: [
        {
          gotcha: 'Lambda pra segurar a conexão viva',
          note: 'Lambda é pra invocação curta e stateless. Segurar um WebSocket aberto por 30min nela briga com o modelo. Use API Gateway WebSocket API (que gerencia a conexão) ou ALB + ECS/EC2 com processos quentes.',
        },
        {
          gotcha: 'Sessão no nó terminador',
          note: 'Se a sessão (qual conexão assina o quê) mora no servidor de socket, perder o nó perde tudo. Ponha no ElastiCache Redis e deixe o terminador stateless. É o que permite reequilibrar 1,5M conexões.',
        },
        {
          gotcha: 'Banco durável pro firehose de posição',
          note: 'O rio de pings de localização não vai num banco durável (mesma lição da aula de matching). Vai num stream (Kinesis/MSK), que desacopla e absorve a vazão. Durabilidade do histórico é async, fora do caminho quente.',
        },
        {
          gotcha: 'Esquecer a borda',
          note: 'Servir tudo da origem ignora que milhões de telas no mundo pedem dado parecido. CloudFront/edge cacheia o quente perto do usuário e tira carga da origem. É o papel dos edge servers da Uber.',
        },
      ],
      anchor:
        'Diagrama no quadro. Pra cada caixa (terminar 1,5 milhão de conexões VIVAS, guardar a sessão, absorver o firehose de localização, cachear na borda), qual serviço da AWS, e por que a conexão longa muda a escolha?',
      askWho: [
        {
          name: 'Maria Clara',
          why: 'Maior breadth + WebSockets + networking. Maior chance de mapear caixa a serviço com fluência e de justificar por que API Gateway WebSocket e não Lambda comum. Começa com ela.',
        },
        {
          name: 'Eduardo Hirohito',
          why: 'Infra completa (HTTP, scalability, sharding). Forte pra cravar o stateless + Redis de sessão e o stream pro firehose.',
        },
        {
          name: 'Leunam Sousa',
          why: 'Especialista de caching do cohort (Cache System Design, invalidation, estratégias, Redis). Âncora pra o ElastiCache de sessão e o CloudFront/edge de dado quente.',
        },
      ],
      followup:
        'Olhando o sistema inteiro: o que se repetiu das outras aulas (matching, ledger), e qual foi a virada que destravou tudo aqui?',
      gotcha:
        'Quando alguém botar Lambda pra tudo, devolva: "Lambda segura um WebSocket aberto por 30 minutos? O modelo dela é invocação curta. Quem termina uma conexão que fica viva por minutos?"',
      scenarios: {
        right: {
          shape:
            'Mapeia API Gateway WebSocket (ou ALB+ECS) pros canais vivos, ElastiCache Redis pra sessão (terminador stateless), Kinesis/MSK pro firehose, CloudFront/edge pro dado quente. Justifica pela conexão longa e pelo estado por conexão. Bônus: por que NÃO Lambda comum.',
          redirect:
            'Feche o arco: "cada caixa pelo perfil de conexão longa, não pela familiaridade. Pergunta de síntese: o que se repetiu das outras aulas, e qual foi a virada aqui?" (desacoplar os relógios + push).',
        },
        close: {
          shape:
            'Escolhe serviços razoáveis mas justifica por familiaridade, ou usa Lambda pra segurar a conexão, ou deixa a sessão no terminador.',
          redirect:
            'Puxe o perfil: "a conexão fica viva por minutos. Isso é perfil de Lambda (invocação curta) ou de um serviço que gerencia conexão persistente? E a sessão, fica onde pra qualquer nó assumir?"',
        },
        wayOff: {
          shape:
            'Joga tudo num servidor único, ou bota o firehose de localização num RDS, ou ignora a borda e serve tudo da origem.',
          redirect:
            'Reancore no perfil: "essa caixa segura conexão longa, guarda sessão, absorve firehose, ou cacheia frio? Cada uma pede um serviço diferente. Começa pela que segura 1,5M conexões vivas."',
        },
      },
    },
    // ──────────────── SYNTHESIS (study-only) ────────────────
    {
      id: 'synthesis',
      label: 'Desacople o relógio dos dados do relógio da tela',
      group: 'synthesis',
      oneLine:
        'A aula inteira cabe numa frase: separe a taxa em que o dado chega da taxa em que a tela desenha, e ponha um buffer esperto no meio.',
      pass1:
        'A gente começou com uma pergunta boba (por que o carro não pula?) e terminou no RAMEN da Uber segurando 1,5 milhão de conexões. O fio que conecta tudo é uma única ideia: os dados chegam num ritmo (lento, esparso, ruidoso) e a tela consome noutro (rápido, contínuo, exigente), e o trabalho todo é o buffer esperto que fica no meio reconciliando os dois. Quase todo sistema de tempo real é essa reconciliação.',
      pass2:
        'Reconstruindo a escada: a tela bate a ~60fps, o GPS chega a ~4s, então tem um vão a preencher. Primeiro o dado precisa chegar barato, e push ganha de polling porque você para de pagar pelas perguntas vazias (80% na Uber). Depois o cliente preenche o vão entre dois pontos: interpolação (suave, atrasada, sempre certa) ou dead reckoning (sem atraso, mas erra na conversão), com convergência suave pra esconder a correção e não dar rubber-banding. Por baixo, Kalman e snap-to-road limpam o tremor do próprio GPS pesando previsão contra medição.\n\nQuando sobe pra milhões, o problema vira entrega: fan-out recortado por célula (pub/sub onde a chave sai do espaço) pra não virar N×M, e a percepção de que o gargalo é o estado de cada conexão viva, não o throughput, o que força terminadores stateless com a sessão num Redis.\n\nO que se repete das outras aulas: a **célula** (geohash/H3) volta como chave de canal, igual ela foi chave de shard no matching; a regra de que o **perfil de carga dita a tecnologia** volta (conexão longa tira o Lambda da mesa, igual 1M writes/s tirou o Postgres); e a separação de **caminhos com perfis opostos** volta. Sistema diferente, primitivas iguais.\n\nO pulo final, pra fora de mapas: desacoplar a taxa de produção da taxa de consumo com um buffer no meio é o padrão de netcode de jogo (entidades remotas interpoladas), de interpolação de vídeo (frames intermediários), de fusão de sensores (Kalman) e de qualquer UI que precise parecer contínua sobre eventos discretos. O carrinho do Uber é a versão mais visível de uma ideia que está em todo lugar.',
      pass3: [
        {
          gotcha: 'Levar só "usa push e Kalman"',
          note: 'Essas são duas peças. O miolo é "desacople a taxa dos dados da taxa da tela, com um buffer no meio". Quem sai só com os nomes das ferramentas perdeu o padrão que a aula existe pra entregar.',
        },
        {
          gotcha: 'Achar que é truque de mapa',
          note: 'É netcode, interpolação de vídeo, fusão de sensor. Qualquer coisa que precise parecer contínua sobre updates discretos usa o mesmo desacoplamento. Mapa é só o exemplo mais visível.',
        },
        {
          gotcha: 'Esquecer que o custo migra pra conexão',
          note: 'Push e suavização resolvem a suavidade, mas em escala o problema vira segurar milhões de conexões vivas, e o custo é o estado por conexão. Todo design move o gargalo de lugar. Saber pra onde foi é a maturidade.',
        },
      ],
      anchor:
        'Em uma frase, sem usar a palavra "suave": o que o cliente faz entre dois pontos de GPS, e por que ele precisa fazer isso?',
      followup:
        'Onde, fora de mapa, você usaria "desacoplar a taxa de produção da taxa de consumo com um buffer no meio"?',
      gotcha:
        'Se a síntese da sala for "usa push", devolva: "push é o minuto 10, e resolve a entrega. E os 240 quadros entre dois GPS? O que a aula passou os outros 50 minutos construindo?"',
    },
  ],
};

import type { Lesson } from '../lesson-types';

export const chatMessaging: Lesson = {
  slug: 'chat-messaging',
  title: 'Chat & Messaging',
  subtitle: 'Stateful, real-time, ordered — o outro extremo do espectro.',
  blurb:
    'O case clássico de chat real-time, do WhatsApp ao Discord. Foundation sobre estimativa de capacidade pra sistemas write-heavy, seguida de 6 beats que cobrem as primitivas centrais do perfil real-time com conexão persistente: requisitos, transport (WebSocket), fan-out (push via PubSub vs pull/inbox), ordering com Snowflake por conversa, presence e catch-up offline, e sharding por conv_id pra preservar locality. A regra que sai daqui: connection model + fan-out pattern dominam o design de qualquer sistema real-time.',
  durationMin: 65,
  audience: 'Hot Stuff · Big Tech · semana 3',
  nodes: [
    // ──────────────── FOUNDATIONS ────────────────
    {
      id: 'f-write-heavy-estimation',
      label: 'Capacity for write-heavy systems',
      group: 'foundations',
      teachFromZero: true,
      oneLine:
        'Em sistema write-heavy três números dominam o cálculo: write QPS no pico, storage por mês, e fan-out médio por mensagem.',
      pass1:
        'Antes de qualquer caixinha, três números importam mais do que qualquer outro num sistema write-heavy: quantas mensagens por segundo, quanto de storage por mês, e qual é o fan-out médio (quantas pessoas recebem cada mensagem escrita). A diferença pra sistemas read-heavy é que aqui o pico de escrita é o que define a arquitetura — cache não te salva quando cada item escrito é lido só uma vez por destinatário.',
      pass2:
        '**Write QPS**: pegue mensagens por dia, divida por 86400 pra ter a média, multiplique por 3 a 5 pra ter o pico. 1 bilhão de mensagens por dia dá cerca de 12 mil writes por segundo na média e 60 mil no pico. Esse número dita o tipo de storage (Cassandra append-only vence Postgres MVCC), o tipo de fila (Kafka aguenta, Redis Streams aguenta com limites) e a quantidade mínima de shards (uma instância não absorve 60 mil writes por segundo sozinha).\n\n**Storage growth**: 1 bilhão de mensagens × 500 bytes médios = 500 GB por dia, ou cerca de 15 TB por mês. Aqui shard é obrigatório desde o dia um. Compare com um sistema read-heavy típico, que pode acumular 250 GB ao longo de 5 anos — chat acumula isso em meio dia.\n\n**Fan-out médio**: 1 milhão de usuários ativos × fan-out médio de 20 destinatários por mensagem = 20 milhões de entregas por segundo no horário de pico. Esse número é o que distingue chat de outros sistemas write-heavy. Se você esquecer ele no dimensionamento, calibra o fan-out cluster pra baixo e ele cai no pico.\n\n**Connection count**: o quarto número, que aparece mais adiante. 1 milhão de usuários simultâneos online, com cerca de 50 mil conexões por servidor, dá 20 servidores de WebSocket. Cada um carrega estado in-memory (cursor de leitura, presence), então o scaling não é elástico — é discreto. Você adiciona servidor inteiro, não capacidade gradual.',
      pass3: [
        {
          gotcha: 'Esquecer o fan-out na conta',
          note: 'Calcula só write QPS e esquece que cada mensagem escrita vira N entregas. O sistema parece dimensionado, mas no pico o fan-out cluster cai porque ninguém somou as entregas.',
        },
        {
          gotcha: 'Tratar storage anual igual a sistema read-heavy',
          note: 'Em sistemas write-heavy storage acumula TB por mês, não por ano. Política de retenção e tiering (hot vs cold) entra no requisito desde cedo.',
        },
        {
          gotcha: 'Misturar usuário ativo com usuário registrado',
          note: '1 bilhão de usuários registrados não significa 1 bilhão online ao mesmo tempo. DAU pode ser 30 a 50% do total. Use o número certo pra estimar conexões abertas.',
        },
      ],
      anchor:
        'Pra um chat estilo WhatsApp com 1 bilhão de mensagens por dia, você precisa estimar 3 números antes de desenhar qualquer coisa. Quais?',
      askWho: [
        {
          name: 'open',
          why: 'Pergunta de aquecimento que pede só conta de matemática básica. Todos podem participar, e isso ajuda a alinhar a sala nos mesmos números antes da aula descer.',
        },
      ],
      followup:
        'OK, números na mesa. Antes de pensar em tecnologia, qual a primeira pergunta de design pra esse perfil específico?',
      gotcha:
        'Se alguém só fizer a conta de write QPS, devolva: "essas 12 mil mensagens por segundo viram quantas ENTREGAS por segundo?"',
      scenarios: {
        right: {
          shape:
            'Calcula write QPS (12 mil na média, 60 mil no pico), storage mensal (cerca de 15 TB), e multiplica por fan-out médio pra ter o número real de entregas. Reconhece que cache não resolve write-heavy do mesmo jeito que resolve read-heavy.',
          redirect:
            'Confirme os números (60 mil writes pico, 15 TB/mês, 20 M entregas/s) e avance: "agora pra esse perfil específico, qual a primeira pergunta de design?"',
        },
        close: {
          shape:
            'Faz a conta de write QPS e storage, mas esquece de multiplicar pelo fan-out. Acaba calibrando o sistema pra entregar 12 mil mensagens por segundo em vez das 20 milhões reais.',
          redirect:
            'Aponte o gap: "cada mensagem escrita vai pra quantos destinatários? Quantas entregas isso vira no agregado?"',
        },
        wayOff: {
          shape:
            'Pula a estimativa e parte direto pra "vou usar Kafka com Cassandra atrás" sem números.',
          redirect:
            'Interrompa: "espera, antes de escolher tecnologia — quantas writes por segundo o sistema vai aguentar no pico? Faça a conta no quadro." Force a fazer matemática antes de nomear tecnologia.',
        },
      },
    },
    // ──────────────── CHAT ARC ────────────────
    {
      id: 'chat-requirements',
      label: 'Requirements & profile',
      group: 'chat',
      beat: 1,
      oneLine:
        'Antes de qualquer caixinha, três perguntas guiam o design: o que precisa ser real-time, qual o ordering esperado, e qual é o tamanho típico de um grupo.',
      pass1:
        'Antes de pensar em WebSocket, fila ou banco, você precisa entender o que diferencia chat de um CRUD qualquer. O sistema vai aceitar mensagens, distribuir essas mensagens em tempo real pros destinatários certos, manter o histórico, e dar conta de usuários offline que precisam alcançar o que perderam. Mas três restrições específicas tornam o problema diferente: a conexão precisa ser persistente, mensagens dentro de uma conversa precisam chegar em ordem, e o fan-out depende de quantas pessoas tem em cada grupo.',
      pass2:
        'O que perguntar antes de desenhar.\n\n**Statefulness e latência**: o que precisa ser real-time? Mensagem nova, presence (quem está online), digitando, read receipt? Cada um tem latência aceitável diferente. Mensagem precisa chegar abaixo de 500ms end-to-end. Presence pode tolerar 1 a 2 segundos. Read receipt pode ser eventual sem ninguém notar.\n\n**Ordering**: as mensagens precisam chegar em ordem dentro de uma conversa? Quase sempre sim — ler a resposta antes da pergunta quebra a UX. Mas o ordering precisa ser global ou só por conversa? Quase sempre só por conversa, e essa diferença libera particionamento massivo lá adiante.\n\n**Grupo médio e máximo**: quantas pessoas em uma conversa típica? E qual o máximo permitido? WhatsApp limita grupos a 256 (decisão deliberada de produto pra evitar o problema de mega-grupo). Discord permite servidores com 1 milhão de membros, mas paga o preço em complexidade de fan-out. O limite vira parte do contrato do produto.\n\n**Offline e histórico**: o que acontece quando o usuário fica offline e volta? Recebe todas as mensagens perdidas? Recebe só as últimas N? Recebe a notificação? Histórico é guardado por quanto tempo? Cada resposta dessas afeta o design de persistência e de catch-up.\n\n**Escopo**: o que NÃO vamos resolver? Edição de mensagem, reactions, threading, voice notes, encryption end-to-end? Tudo opcional. Pergunte explicitamente — em entrevista, o entrevistador é quem escolhe o que aprofundar.',
      pass3: [
        {
          gotcha: 'Tratar chat como "outro CRUD"',
          note: 'Chat tem conexão persistente, ordering por partição, e fan-out — três restrições que CRUD não tem. Quem trata como CRUD vai parar no primeiro beat de transport.',
        },
        {
          gotcha: 'Esquecer que ordering é por conversa, não global',
          note: 'Pedir ordering global cria coordenação distribuída desnecessária. Ordering dentro de uma conversa basta e é o que destrava particionamento.',
        },
        {
          gotcha: 'Não perguntar tamanho de grupo',
          note: 'Grupo de 50 vs grupo de 100 mil tem arquiteturas diferentes. Saber o limite (ou que existe um) muda a estratégia de fan-out fundamentalmente.',
        },
      ],
      anchor:
        'Você vai construir o WhatsApp. Antes de desenhar qualquer caixa, quais são as 3 perguntas que destravam o resto?',
      askWho: [
        {
          name: 'Pedro Souza',
          why: 'Beat de entrada. Pergunta mais sobre framing do problema que sobre tecnologia, então cai confortável pra quem tem só hashmap na bagagem.',
        },
        {
          name: 'Rayssa Guedes',
          why: 'Backup com perfil parecido. Se Pedro travar, joga pra ela.',
        },
      ],
      followup:
        'OK, mensagem real-time tá no requisito. Por que HTTP polling não basta?',
      gotcha:
        'Se alguém disser "preciso de strong consistency global", devolva: "ordering entre o seu grupo com seus pais e o grupo de outro usuário com a esposa dele — isso importa pra UI?"',
      scenarios: {
        right: {
          shape:
            'Faz perguntas concretas sobre o uso: latência aceitável por tipo de evento (mensagem vs presence vs read receipt), tamanho típico e máximo de grupo, comportamento offline, política de histórico. Reconhece que ordering é por conversa, não global.',
          redirect:
            'Confirme as premissas (real-time pra mensagem, ordering por conv, grupos limitados) e avance: "OK, real-time tá no requisito. Como o servidor empurra mensagem pro cliente?"',
        },
        close: {
          shape:
            'Faz perguntas de uso (volume, latência) mas não percebe que ordering por conversa é diferente de ordering global. Ou esquece de perguntar tamanho de grupo.',
          redirect:
            'Devolva: "se as mensagens entre dois grupos completamente diferentes chegam fora de ordem, alguém liga? E dentro do mesmo grupo?" Força a separar os dois.',
        },
        wayOff: {
          shape:
            'Começa desenhando caixinhas direto ("API Gateway → Mensagens Service → DB") sem perguntar nada sobre o uso. Trata como um CRUD qualquer.',
          redirect:
            'Interrompa: "espera, antes de desenhar — o cliente precisa receber a mensagem do outro usuário em quanto tempo? E como ele recebe sem fazer polling?" Force a chegar em statefulness.',
        },
      },
    },
    {
      id: 'chat-transport',
      label: 'Transport: WebSocket vs HTTP',
      group: 'chat',
      beat: 2,
      oneLine:
        'Pro server empurrar mensagem em tempo real, HTTP request-response não basta. WebSocket é o padrão moderno, long polling é o meio-termo legado.',
      pass1:
        'Pro chat funcionar em tempo real, o servidor precisa empurrar a mensagem pro cliente assim que ela chega — não o contrário. HTTP tradicional é request-response, ou seja, sempre o cliente pergunta primeiro. Pra inverter esse fluxo você tem três opções práticas, cada uma com um custo operacional diferente.',
      pass2:
        '**Short polling** é o jeito ingênuo: o cliente bate no servidor a cada N segundos perguntando "tem mensagem nova?". A latência fica presa em N segundos no pior caso, e o servidor gasta CPU e banda em request vazio na maior parte do tempo. É inaceitável pra chat moderno.\n\n**Long polling** é o meio-termo legado. O cliente abre uma request HTTP, e o servidor segura ela por até 30 segundos esperando alguma mensagem chegar. Se chegar, responde imediatamente; se não, devolve vazio depois do timeout e o cliente reabre. A latência fica em milissegundos quando tem mensagem, mas você ainda mantém cerca de uma conexão HTTP por usuário. Slack usou esse padrão até 2020. Funciona até uns 10 mil usuários por servidor.\n\n**WebSocket** é o padrão moderno. É um upgrade do HTTP pra uma conexão TCP bidirecional persistente — o servidor pode empurrar qualquer hora, o cliente pode mandar qualquer hora. Latência em milissegundos, throughput alto, mas a conexão é stateful: cada servidor segura entre 10 mil e 100 mil conexões abertas, limitado por file descriptors e RAM (cada conexão consome cerca de 10 KB).\n\nO custo operacional do WebSocket é maior do que parece. O load balancer precisa de sticky sessions porque o estado in-memory (cursor de mensagens, presence) está naquele servidor específico. Deploy precisa de drain gracioso, porque reiniciar o servidor derruba todas as conexões. Scaling horizontal é discreto: um servidor novo recebe conexões novas, mas as antigas ficam onde estavam até reconectarem.\n\n**SSE** (Server-Sent Events) é o WebSocket "só server→client". Útil quando você só precisa receber, mas chat precisa dos dois sentidos, então WebSocket vence.',
      pass3: [
        {
          gotcha: 'Achar que load balancer round-robin resolve',
          note: 'Cada conexão WebSocket é stateful. Round-robin pra conexão nova tudo bem, mas reconexão precisa voltar pro mesmo servidor pra retomar estado in-memory.',
        },
        {
          gotcha: 'Ignorar custo de file descriptors',
          note: 'O teto teórico é 65 mil portas por NIC. Na prática, entre 10 mil e 100 mil conexões por máquina, dependendo do kernel tuning (ulimit, sysctl).',
        },
        {
          gotcha: 'Não pensar em deploy e restart',
          note: 'Reiniciar um servidor WebSocket derruba TODAS as conexões dele. O cliente precisa reconectar com exponential backoff e re-hidratar o estado a partir de um cursor.',
        },
        {
          gotcha: 'Confundir HTTP/2 push com WebSocket',
          note: 'HTTP/2 push é um hint do servidor pra pre-carregar recursos (CSS, JS). Não substitui WebSocket pra empurrar payload arbitrário em tempo real.',
        },
      ],
      anchor:
        'Por que HTTP polling não basta? E quanto custa manter 1 milhão de conexões WebSocket abertas?',
      askWho: [
        {
          name: 'Maria Clara',
          why: 'Tem networking na bagagem. Gancho perfeito porque o próximo beat (fan-out via PubSub) é exatamente onde ela é única — quer ela "presente" na conversa desde aqui.',
        },
        {
          name: 'Eduardo Izawa',
          why: 'Também tem networking. Backup se Maria Clara travar — ele pode puxar o custo de file descriptors e RAM.',
        },
      ],
      followup:
        'OK, conexão aberta. Você manda mensagem num grupo de 50 pessoas. Como exatamente as 50 recebem em menos de 1 segundo?',
      gotcha:
        'Se alguém disser "manda HTTP request pra cada um", responda: "1 milhão de usuários online, 100 mil grupos, fan-out médio de 20 — quantas requests por segundo isso vira no agregado?"',
      scenarios: {
        right: {
          shape:
            'WebSocket pra bidirecional, com sticky sessions no load balancer e custo entre 10 mil e 100 mil conexões por servidor por causa de file descriptors e RAM. Menciona deploy gracioso (drain) e reconnect exponencial. Sabe que SSE seria opção pra unidirecional.',
          redirect:
            'Avance pro fan-out: "OK, 1 milhão de conexões abertas, distribuídas em N servidores. Você manda numa conversa de 50 — como as 50 recebem?"',
        },
        close: {
          shape:
            'Sabe WebSocket bidirecional e que é stateful, mas não articula o custo concreto: file descriptors, RAM por conexão, problema de deploy.',
          redirect:
            'Aterre num número: "quantas conexões cabem num servidor de 16 GB de RAM? Por quê?" Força a ver os limites operacionais.',
        },
        wayOff: {
          shape:
            'Defende long polling como suficiente pra tudo. Ou propõe HTTP/2 push como se substituísse WebSocket.',
          redirect:
            'Pra long polling: "30 segundos de latência entre mensagens é OK pra chat?". Pra HTTP/2 push: "ele empurra um stream de mensagens arbitrárias ou só recursos estáticos pra o navegador pré-carregar?"',
        },
      },
    },
    {
      id: 'chat-fanout',
      label: 'Fan-out & PubSub',
      group: 'chat',
      beat: 3,
      oneLine:
        'Quando uma mensagem é escrita, N destinatários precisam receber. Push via PubSub é o padrão pra grupos pequenos, pull/inbox escala pra mega-grupos.',
      pass1:
        'Você escreveu uma mensagem. Agora N destinatários precisam receber, e isso é o problema central de qualquer chat. Existem duas famílias de solução: push, em que o servidor distribui ativamente, e pull, em que cada destinatário consulta sua própria inbox. Cada uma tem uma zona ótima de tamanho de grupo, e sistemas reais geralmente combinam as duas.',
      pass2:
        '**Push-based fan-out** acontece no momento da escrita. Quando o servidor recebe a mensagem, ele publica num bus interno (Redis PubSub ou Kafka) usando um tópico do tipo `topic:conv:{conv_id}`. Todos os servidores WebSocket que têm conexão pra esse conv estão subscritos no tópico, então recebem a notificação e empurram pela conexão. A latência fica abaixo de 10ms e escala bem pra grupos pequenos e médios (até alguns milhares de membros).\n\nO problema do push aparece em mega-grupos. Um canal Discord com 100 mil membros transforma cada mensagem em 100 mil pushes — inviável. Por isso o WhatsApp limita grupos a 256 (decisão deliberada de produto), e o Discord usa um modelo híbrido: push pra grupos abaixo de 100 membros, pull pra grupos maiores.\n\n**Pull-based fan-out** acontece no momento da leitura. A mensagem vai pra uma fila persistente única por conversa, e os clientes consultam essa fila quando reconectam ou fazem poll. A latência é maior, mas o custo é proporcional aos usuários ATIVOS no momento, não aos membros totais do grupo. É a única opção pra mega-grupos.\n\nPra que isso funcione, precisa de uma **message queue** entre o gateway WebSocket e o storage. O gateway recebe a mensagem, publica num Kafka (ou similar), e dois consumers diferentes processam: um escreve no banco de mensagens (Cassandra), outro publica no PubSub pra fan-out. Esse desacoplamento é importante porque se o banco de storage ficar lento, o fan-out continua acontecendo.\n\nUm cuidado importante: deduplicação. Quando o cliente recebe a mensagem via push e depois faz resync e recebe a mesma mensagem via pull, pode duplicar. A solução é cada mensagem ter um `message_id` idempotente, e o cliente ignorar duplicatas.',
      pass3: [
        {
          gotcha: 'Push pra todos sempre',
          note: 'O custo é linear no fan-out, então explode em mega-grupo. Pull/inbox model vence pra grupos acima de uns 1 mil membros.',
        },
        {
          gotcha: 'Esquecer usuários offline',
          note: 'Push só funciona se o cara está online no momento. Quem está offline depende de a mensagem ter sido persistida e de um catch-up por cursor quando reconectar.',
        },
        {
          gotcha: 'Tratar PubSub e Message Queue como sinônimos',
          note: 'PubSub (estilo Redis) é broadcast efêmero — quem não estava subscrito na hora perde a mensagem. Queue (estilo Kafka) é durável e ordenada. Chat geralmente precisa dos dois: queue pra persistência e ordering, PubSub pra delivery rápido.',
        },
        {
          gotcha: 'Não pensar em deduplicação',
          note: 'Cliente recebe via push e depois via pull no resync. Pode duplicar. Resolve com `message_id` idempotente no cliente.',
        },
      ],
      anchor:
        'Você manda uma mensagem num grupo de 50 pessoas. Como exatamente as 50 recebem em menos de 1 segundo?',
      askWho: [
        {
          name: 'Maria Clara',
          why: 'ÚNICA com pubsub na bagagem do cohort. Esse é O beat dela — deixa ela puxar a discussão. Se ela for fundo, joga o gotcha de mega-grupo (canal Discord com 100 mil membros). Se travar, pingue: "Redis PubSub serve?"',
        },
      ],
      followup:
        'Se a mensagem viajou via PubSub, ela está persistida em algum lugar? Como o usuário que ficou offline alcança o que perdeu?',
      gotcha:
        'Se Maria Clara matar push rápido demais: "OK, e grupo de 100 mil membros, tipo um servidor do Discord. Ainda push?" Força ela a chegar em pull/inbox.',
      scenarios: {
        right: {
          shape:
            'Push via PubSub (Redis ou Kafka) com tópico por conversa pra grupos pequenos e médios. Reconhece o problema de mega-grupo e propõe pull/inbox. Diferencia PubSub (broadcast efêmero) de Message Queue (durável e ordenada), e percebe que chat precisa dos dois.',
          redirect:
            'Avance pra persistência: "OK, mensagem saiu via PubSub e chegou nas conexões abertas. Ela está PERSISTIDA? Em que ordem o histórico aparece quando alguém reabre o app?"',
        },
        close: {
          shape:
            'Push pra todos os destinatários online sempre. Não menciona o problema de mega-grupo nem distingue PubSub de Message Queue.',
          redirect:
            'Aterre no mega-grupo: "canal do Discord com 100 mil membros. Cada mensagem dispara 100 mil pushes. Quantas mensagens por segundo isso aguenta no pico?"',
        },
        wayOff: {
          shape:
            'Manda HTTP request do servidor pra cada destinatário individual. Ou propõe que cada cliente faça poll de um endpoint próprio.',
          redirect:
            'Faça a conta junto: "1 milhão de usuários online, fan-out médio de 20, 100 mensagens por segundo no agregado. Quantas requests HTTP isso vira? Compare com um único publish no PubSub."',
        },
      },
    },
    {
      id: 'chat-ordering',
      label: 'Ordering & persistence',
      group: 'chat',
      beat: 4,
      oneLine:
        'Mensagens precisam chegar EM ORDEM dentro de uma conversa, mas não entre conversas distintas. Esse "ordering por partição" destrava todo o resto.',
      pass1:
        'Chat tem semântica de sequência: a mensagem 5 vem depois da 4. Se chegar fora de ordem, a UI fica confusa — você lê "respondi sim" antes de ver "você topa?". Mas essa restrição só vale DENTRO de uma conversa. Entre conversas diferentes (o grupo dos seus pais e o grupo do trabalho), o ordering relativo não importa. Esse detalhe — ordering por partição em vez de global — é o que destrava todo o resto.',
      pass2:
        'O mecanismo padrão é dar a cada mensagem um ID monotônico **por conversa**, não global. O padrão clássico é Snowflake: 64 bits divididos em timestamp (41 bits), machine ID (10 bits) e sequence (12 bits). Esse formato garante ordering temporal e unicidade sem coordenação global, e ainda permite range scan eficiente porque IDs próximos no tempo estão próximos numericamente.\n\nO fluxo é: cliente envia, o gateway atribui o ID, e o write vai pra uma tabela `messages` particionada por `conv_id` e ordenada por `message_id` em ordem decrescente. Cassandra usa exatamente esse padrão — partition key igual `conv_id`, clustering key igual `message_id DESC` — e queries do tipo "leia as últimas 50 mensagens" viram leitura sequencial direta sem precisar de índice extra.\n\nDentro de uma conversa, o ordering é **causal consistency**: se a mensagem A precede B, então o ID de A é menor que o de B, e todos os clientes veem A antes de B. Entre conversas distintas, não tem garantia nenhuma — e tudo bem, porque não importa.\n\nReplicação dentro de cada shard segue master + réplicas. O master ordena os writes naquele shard, e as réplicas seguem. Read-after-write próprio (o usuário lê a mensagem que ele acabou de mandar) vem do master pra evitar o problema de replication lag. Reads históricos podem ir nas réplicas tranquilo.\n\nUm edge case interessante: dois usuários escrevem simultaneamente no mesmo conv. Snowflake resolve pelo timestamp combinado com sequence — quem chegou no gateway primeiro vence, mesmo que a diferença seja em microssegundos. A UI mostra ambas com timestamps muito próximos, mas a ordem é fixa.',
      pass3: [
        {
          gotcha: 'Achar que precisa ordering GLOBAL entre todas as mensagens do sistema',
          note: 'Não precisa. Mensagens entre conversas distintas não têm relação causal. Ordering por conv basta, e essa restrição mais frouxa destrava particionamento massivo.',
        },
        {
          gotcha: 'Usar UUID v4 como message_id',
          note: 'UUID v4 é random, não ordenado. Você perde a query "leia as últimas 50" como range scan, e cada read vira um lookup. UUID v7 (timestamp-prefixed) ou Snowflake resolvem.',
        },
        {
          gotcha: 'Relógio do servidor desincronizado',
          note: 'NTP drift entre máquinas pode dar IDs out-of-order entre shards diferentes. É exatamente por isso que ordering é dentro da partição (conv), não global — você não precisa que os relógios estejam sincronizados entre shards.',
        },
        {
          gotcha: 'Read-after-write em réplica com lag',
          note: 'Usuário envia mensagem e tenta ler imediatamente. A réplica ainda não recebeu o write. Solução: pra o próprio usuário dentro de uma janela curta, lê do master. Ou então o cliente mantém um cursor que ele já viu até a mensagem N e ignora respostas anteriores.',
        },
      ],
      anchor:
        'Mensagens chegam fora de ordem no cliente. O usuário vai aceitar isso?',
      askWho: [
        {
          name: 'Eduardo Izawa',
          why: 'Tem replication na bagagem, e consistency model é o frame mental dele. Ordering aqui é exatamente causal consistency dentro da partição.',
        },
      ],
      followup:
        'Se Snowflake gera o ID, isso afeta a escolha de sharding key?',
      gotcha:
        'Se alguém disser "uso timestamp Unix em milissegundos como ID", devolva: "dois writes chegam no mesmo milissegundo. Quem fica em primeiro?"',
      scenarios: {
        right: {
          shape:
            'Snowflake ID (timestamp + machine + sequence) ordenado por conv, não global. Partition key igual conv_id, clustering key igual message_id em ordem decrescente. Causal consistency dentro da partição. Menciona read-after-write próprio via master ou cursor no cliente.',
          redirect:
            'Avance pro sharding: "se o ID já carrega timestamp e é gerado por conv, qual a sharding key natural pra essa tabela?"',
        },
        close: {
          shape:
            'Usa timestamp Unix em milissegundos ou UUID v7 como message_id. Sabe que precisa ordenar mas não considera colisão de timestamp nem a vantagem do sequence number do Snowflake.',
          redirect:
            '"Dois writes chegam no mesmo milissegundo no gateway. Quem fica em primeiro? E qual usuário vê A antes de B vs B antes de A?"',
        },
        wayOff: {
          shape:
            'Defende strong consistency global pra todas as mensagens do sistema. Ou usa UUID v4 (random) sem perceber que perde range scan.',
          redirect:
            'Pra strong global: "ordering entre o seu grupo familiar e o grupo de trabalho de outro usuário — isso importa pra UI?" Pra UUID v4: "como você lê as 50 mensagens mais recentes nesse modelo?"',
        },
      },
    },
    {
      id: 'chat-presence',
      label: 'Presence & offline catch-up',
      group: 'chat',
      beat: 5,
      oneLine:
        'Quando o usuário sai e volta, precisa receber tudo que perdeu na ordem certa, sem travar a UI carregando o backlog inteiro.',
      pass1:
        'O sistema funciona em real-time enquanto o usuário está online, mas o caso real interessante é quando ele fecha o app, fica offline por horas, e volta. Precisa receber tudo que perdeu, na ordem certa, sem travar a interface tentando carregar 10 mil mensagens de uma vez. Esse beat trata dois problemas relacionados que aparecem juntos: presence (saber quem está online em tempo real) e catch-up (entregar o backlog de quem volta).',
      pass2:
        '**Presence (quem está online)**: cada conexão WebSocket aberta marca o usuário como online. Quando a conexão fecha, marca como offline. Em Redis, isso costuma ser uma chave por user_id com TTL curto (30 a 60 segundos), renovada por heartbeat do cliente. O servidor que mantém a conexão atualiza a presence direto — desacoplar isso de uma fonte central facilita o scaling. Limitação importante: presence em larga escala é caro de manter atualizado em tempo real. Discord paga esse preço, mas o WhatsApp simplifica mostrando só "online" ou "visto há X minutos" pra evitar a pressão constante de updates.\n\n**Offline detection**: o servidor detecta que a conexão caiu por TCP keepalive ou por timeout no ping/pong (geralmente 30 a 60 segundos sem resposta). Existe um trade-off entre velocidade e estabilidade: timeout curto detecta queda rápido mas gera falsos positivos em redes instáveis; timeout longo é mais tolerante mas demora a marcar o usuário como offline.\n\n**Catch-up por cursor**: cada cliente mantém um cursor `last_seen_message_id` por conversa. Quando reconecta, envia esse cursor pro servidor, que faz um range scan: `SELECT * FROM messages WHERE conv_id = ? AND message_id > cursor ORDER BY message_id LIMIT N`. A query é eficiente porque o message_id é ordenado (graças ao Snowflake do beat anterior), então o backlog vira leitura sequencial direta.\n\n**Paginação do backlog**: se o usuário tem 50 mensagens pendentes, manda em um burst. Se tem 10 mil mensagens de uma conversa abandonada, pagina — envia as últimas 50 e o cliente puxa mais quando o usuário scrollar pra cima. Sem paginação, o cliente trava por dezenas de segundos no spinner.\n\n**Push externo pra offline real**: quando o usuário está offline de verdade (app fechado, não só desconectado), o canal pra alcançá-lo é externo — APNS no iOS, FCM no Android. O fluxo muda: o servidor publica numa fila de notificações, e um worker dedicado dispara via API do provedor. Esse caminho não tem WebSocket envolvido.',
      pass3: [
        {
          gotcha: 'Armazenar presence num único Redis central',
          note: 'Vira gargalo no pico. Você precisa shardar a presence por user_id ou manter local em cada servidor WebSocket, sincronizando via PubSub se outro servidor precisar consultar.',
        },
        {
          gotcha: 'Esquecer paginação no catch-up',
          note: 'Cliente fica 30 segundos no spinner carregando 50 mil mensagens. Sempre pagine, entregue as últimas N primeiro, e deixe o usuário puxar histórico antigo quando quiser.',
        },
        {
          gotcha: 'Confundir desconectado com offline real',
          note: 'Desconectado (rede caiu) é diferente de offline (app fechado). O primeiro mantém estado no servidor por alguns segundos; o segundo precisa de push externo via APNS/FCM. O tratamento de delivery é diferente.',
        },
        {
          gotcha: 'Salvar o cursor no servidor a cada mensagem lida',
          note: '1 milhão de usuários ativos lendo 100 mensagens por minuto vira muito write desnecessário no banco. O cursor mora no cliente — o servidor só precisa dele quando há reconexão.',
        },
      ],
      anchor:
        'O usuário fechou o WhatsApp ontem, recebeu 200 mensagens em vários grupos, e abre o app agora. Como o sistema entrega tudo isso sem travar a interface?',
      askWho: [
        {
          name: 'Eduardo Izawa',
          why: 'Tem cache + replication na bagagem. Cursor é exatamente "estado do client" e o trade-off de onde manter cursor (cliente vs servidor) é uma decisão de consistency familiar pra ele.',
        },
        {
          name: 'Maria Clara',
          why: 'Backup com networking. Presence over WebSocket é um caso clássico de heartbeat — ela pode ajudar com a parte de detecção de queda.',
        },
      ],
      followup:
        'OK, online e offline resolvidos. Mas tudo isso fica num único servidor? Como você divide quando 1 milhão de usuários estão online ao mesmo tempo?',
      gotcha:
        'Se alguém propor armazenar cursor no servidor a cada msg lida: "1 milhão de usuários ativos lendo 100 mensagens por minuto — quantos updates por segundo isso vira no banco?"',
      scenarios: {
        right: {
          shape:
            'Presence em Redis com TTL curto e heartbeat, cursor last_seen_message_id mantido no cliente, catch-up paginado via range scan no message_id ordenado. Reconhece que push externo (APNS/FCM) é caminho separado pra usuário com app fechado.',
          redirect:
            'Avance pro sharding: "tudo isso funcionando num único servidor é uma coisa. Em 20 servidores WebSocket simultâneos, como você divide?"',
        },
        close: {
          shape:
            'Sabe que precisa de cursor mas armazena no banco a cada mensagem lida, sem perceber que isso vira write-heavy desnecessário. Ou tenta entregar todo o backlog num único burst.',
          redirect:
            'Aponte o custo escondido: "se cada msg lida vira um update no banco, 1 milhão de usuários ativos = quantos writes por segundo SÓ pra atualizar cursor?"',
        },
        wayOff: {
          shape:
            'Propõe armazenar todas as mensagens não lidas numa fila por usuário ("inbox por usuário"). Vira fan-out por usuário, que é exatamente o oposto da locality por conv que vai vir no próximo beat.',
          redirect:
            'Force a comparar: "fila por usuário, com 1 milhão de usuários, cada um podendo ter dezenas de grupos com mensagens pendentes. Quantas filas no total? Quem coordena escrever em todas elas quando uma msg chega num grupo de 50?"',
        },
      },
    },
    {
      id: 'chat-shard',
      label: 'Sharding by conversation',
      group: 'chat',
      beat: 6,
      oneLine:
        'A sharding key natural é `conv_id` por causa de locality — todas as conexões e mensagens da mesma conversa precisam viver no mesmo servidor.',
      pass1:
        'Quando uma única instância não cabe mais, você precisa shardar. A pergunta crítica é qual a sharding key correta, e a resposta vem do que o sistema faz no caminho quente: mandar uma mensagem afeta N usuários da MESMA conversa. Se você sharda por user_id, uma mensagem em grupo de 50 precisaria tocar 50 shards diferentes pra entregar. Sharda por conv_id, e a mensagem vive em um shard só — o fan-out fica local.',
      pass2:
        'A propriedade técnica que isso compra se chama **locality**: todas as conexões WebSocket do mesmo conv DEVEM ir pro mesmo servidor (ou conjunto de servidores replicados). Isso é session affinity por conversa. O gateway calcula `target_server = hash(conv_id) % N` e roteia o handshake WebSocket. Quando um usuário entra numa conversa nova, ele pode precisar abrir uma segunda conexão pra outro servidor, ou usar multiplexing no mesmo socket.\n\nO ponto sutil é que o eixo de sharding não é o usuário, e sim a conversa. Mesmo que o cliente faça request com user_id, o roteamento real acontece por conv_id. Isso é contra-intuitivo, mas necessário pra fan-out local.\n\nUm trade-off importante surge com hot conversation: um canal do Discord viral, ou um broadcast pra 1 milhão de membros ativos, sobrecarrega um único shard. As soluções práticas são split partition (sub-shardar a conversa por ranges de message_id) ou replicar o conv quente em vários servidores que se comunicam via PubSub interno.\n\nO custo dessa escolha é que a query "listar todos os convs do usuário X" deixa de ser point lookup. As conversas do usuário X estão espalhadas em vários shards (porque cada uma foi shardada por conv_id, não por user_id). A solução é manter um índice secundário separado: uma tabela inversa `user → convs[]` em outro shard, ou um Global Secondary Index no Cassandra. Aceita-se esse custo porque a query "listar convs" é muito mais rara que "mandar mensagem no conv".\n\nUma decisão de arquitetura que vale separar: o servidor de WebSocket e o shard de storage podem ser entidades diferentes. Você pode ter WebSocket com round-robin (qualquer servidor aceita qualquer conexão) e storage com hash por conv_id, conectando os dois via PubSub. Isso é mais simples operacionalmente mas tem mais hops de latência.',
      pass3: [
        {
          gotcha: 'Shardar por user_id porque "é mais intuitivo"',
          note: 'Mensagem é da CONVERSA, não do usuário. Sharding por user faz cada fan-out tocar N shards, e isso vira o gargalo do sistema.',
        },
        {
          gotcha: 'Esquecer hot partition',
          note: 'Canal Twitch global, broadcast Discord. Uma única conversa pode lotar um shard inteiro. A detecção de hot partition + split é mandatória em produção.',
        },
        {
          gotcha: 'Não desenhar a query "convs do usuário X"',
          note: 'Se você sharda por conv, essa query precisa de índice inverso. Antecipar isso na conversa mostra que você desenha o sistema inteiro, não só o caminho feliz.',
        },
        {
          gotcha: 'Confundir locality de WebSocket com locality de storage',
          note: 'WebSocket server e storage shard podem ser entidades separadas. Você pode ter WS round-robin com storage sharded por conv, conectando via PubSub. Trade-off latência versus simplicidade.',
        },
      ],
      anchor:
        'Mensagem em grupo de 50 pessoas. Você precisa decidir a sharding key. Por que conv_id e não user_id?',
      askWho: [
        {
          name: 'Eduardo Izawa',
          why: 'Único com sharding na bagagem. Fecha o arco do chat. Se ele só responder "hash mod N", pergunte sobre o routing das conexões WebSocket — força ele a chegar em locality.',
        },
      ],
      followup:
        'Como você lista todos os convs do usuário X agora que cada conv vive em um shard diferente?',
      gotcha:
        'Se ele disser "sharda por user_id" sem hesitar: "usuário num grupo de 50, fan-out toca quantos shards?"',
      scenarios: {
        right: {
          shape:
            'Hash de conv_id com locality — todas as conexões WebSocket de uma conversa vão pro mesmo servidor. Antecipa que "listar convs do user" deixa de ser point lookup e aceita o custo de manter índice inverso. Menciona hot partition e estratégia de split ou replicação.',
          redirect:
            'Avance pro fechamento: "aula fechada. Quais foram as 3 decisões aqui que dependeram diretamente de conexão persistente + ordering por partição?"',
        },
        close: {
          shape:
            'Sharda por conv_id mas não percebe que "todos os convs do user X" deixa de ser point lookup. Ou não menciona hot partition.',
          redirect:
            '"Cliente abre o app — precisa carregar a lista de conversas dele. Como você acha essas conversas se cada uma está em um shard diferente?"',
        },
        wayOff: {
          shape:
            'Sharda por user_id porque "o cliente faz request com user_id". Não pensa em onde a mensagem mora.',
          redirect:
            '"Grupo com 50 pessoas. User A manda uma mensagem. A mensagem precisa ir pra storage — em QUAL shard? E os outros 49 — precisam consultar quantos shards pra ler essa mensagem?"',
        },
      },
    },
    // ──────────────── SYNTHESIS ────────────────
    {
      id: 'synthesis',
      label: 'Synthesis: connection model dominates the design',
      group: 'synthesis',
      oneLine:
        'Conexão persistente + ordering por partição + fan-out são as três restrições que dominam todo o resto do design.',
      pass1:
        'Chat é o caso canônico do perfil real-time stateful, e os 6 beats te dão o vocabulário central que reaparece em qualquer sistema com perfil parecido — WebSocket com sticky sessions, fan-out híbrido (push para pequenos, pull para grandes), Snowflake pra ordering causal por partição, presence e catch-up por cursor, sharding por entidade que owna a operação. A regra que sai daqui é que o connection model (request-response vs persistent) é a primeira decisão, e ela cascateia em todas as outras.',
      pass2:
        'O resumo das 6 decisões que tomamos, lado a lado com a restrição que guiou cada uma:\n\n**Statefulness é o salto fundamental**: chat exige conexão persistente, e isso muda tudo — load balancer com sticky sessions, deploy gracioso com drain, scaling discreto. Não é mais request-response stateless.\n\n**Transport (WebSocket)**: real-time bidirecional + custo de cerca de 10 KB por conexão dita a escala (10 mil a 100 mil conexões por servidor). SSE é alternativa unidirecional, long polling é legado.\n\n**Fan-out (PubSub híbrido)**: distribuição em tempo real pra N destinatários é o problema central. Push via PubSub pra grupos pequenos, pull/inbox pra mega-grupos. Tamanho de grupo determina a estratégia.\n\n**Ordering (Snowflake por partição)**: causal consistency dentro da conversa basta — ordering global cria coordenação desnecessária. Snowflake dá ID temporal + sequence sem coordenação central.\n\n**Presence + offline catch-up**: presence em Redis com TTL curto e heartbeat, cursor mantido no cliente, backlog paginado por range scan. Push externo (APNS/FCM) é o caminho separado pra app fechado.\n\n**Sharding (por conv_id)**: locality força que toda atividade da mesma conversa fique no mesmo shard. O custo é que a query "convs do usuário X" deixa de ser point lookup, mas essa é a query rara.\n\nO ponto pedagógico final: connection model + fan-out pattern dominam o design. Tudo o que vem depois (banco, cache, replication) tem que respeitar essas duas decisões. Em entrevista, o candidato que estabelece essas duas restrições logo no começo é o que separa pleno de senior.',
      pass3: [
        {
          gotcha: 'Tratar chat como "request-response com WebSocket por cima"',
          note: 'WebSocket muda o modelo inteiro, não é só um detalhe de transport. Cada decisão a partir dele tem que respeitar statefulness.',
        },
        {
          gotcha: 'Aceitar "uso o padrão" como justificativa',
          note: 'Force "por quê esse padrão pra ESSE perfil específico?". A primitiva é a mesma em vários sistemas, mas o trade-off muda com o perfil.',
        },
        {
          gotcha: 'Sair sem nome de produto na cabeça',
          note: 'Chat real existe — WhatsApp, Slack, Discord, Telegram. Em entrevista, ancorar em produto real ajuda a raciocinar sobre escala.',
        },
      ],
      anchor:
        'Liste as 3 decisões dessa aula que dependeram diretamente do connection model persistente, e a que foi a mais surpresa pra você.',
      askWho: [
        {
          name: 'open',
          why: 'Fechamento aberto pro grupo. Quem responder primeiro mostra que pegou o frame mental. Bom indicador de quem internalizou.',
        },
      ],
      followup:
        'Em sistemas com perfil oposto (read-heavy, request-response, imutável), quais dessas 6 decisões teriam respostas completamente diferentes?',
      gotcha:
        'Se ninguém citar que cache de mensagens não resolve o problema de fan-out (resolve só presence), dê o insight e pergunte por quê — separa quem internalizou de quem só decorou.',
    },
  ],
};

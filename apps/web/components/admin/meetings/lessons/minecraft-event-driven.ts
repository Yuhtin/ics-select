import type { Lesson } from '../lesson-types';

export const minecraftEventDriven: Lesson = {
  slug: 'minecraft-event-driven',
  title: 'Minecraft é Event-Driven',
  subtitle: 'Packets · Tick · Events — três primitivas que cobrem 80% de qualquer backend.',
  blurb:
    'A gente vai entender event-driven architecture (o mesmo primitivo que Netflix usa pra processar 1 bilhão de eventos por dia) usando algo que você já joga: um servidor de Minecraft. São 7 beats que cobrem o caminho do byte até o gameplay — protocolo de packets, tick loop a 20 TPS, sistema de eventos do Bukkit, fan-out de listeners, pegadinhas de async. Tem lab ao vivo no meio: a gente sobe um Paper local, voluntário entra, vocês veem 3 plugins reagindo em paralelo ao PlayerJoinEvent. No fim, o twist: o mesmo modelo mental que explica Minecraft explica Kafka, SQS e o slide da Netflix. Só que aprendido via algo concreto, com player se mexendo na tela.',
  durationMin: 90,
  audience: 'Hot Stuff 2026.2 · semana atual',
  slidesUrl: '/slides/minecraft-event-driven.html',
  nodes: [
    // ──────────────── FOUNDATIONS ────────────────
    {
      id: 'f-protocol',
      label: 'Protocolo: como dois processos conversam',
      group: 'foundations',
      teachFromZero: true,
      tags: ['tcp', 'socket', 'bytes', 'serialização', 'stateful'],
      oneLine:
        'Dois processos conversam abrindo um socket TCP, mandando bytes estruturados, e seguindo um protocolo combinado pelos dois lados.',
      pass1:
        'Antes de qualquer coisa Minecraft, é preciso fixar uma ideia: dois processos rodando em máquinas diferentes não conversam por mágica. Um abre uma porta TCP (socket), o outro conecta nessa porta, e os dois mandam bytes pra frente e pra trás. O que esses bytes significam é uma combinação prévia, escrita num documento — isso é o protocolo. Sem protocolo, o byte 0x01 não quer dizer nada.',
      pass2:
        '**TCP entrega bytes em ordem, sem perda.** Quem manda, manda numa ponta. Quem recebe, lê do outro lado. Não tem "mensagem" no TCP — é um stream contínuo de bytes. Quem decide onde uma mensagem termina e outra começa é o protocolo da aplicação por cima.\n\n**Protocolo é o contrato sobre o significado dos bytes.** "Os primeiros 4 bytes são o tamanho da mensagem. Depois vem 1 byte que diz o tipo. Aí vem o payload no formato X." Quem manda e quem recebe têm que concordar nessa convenção, ou a comunicação quebra. HTTP, gRPC, Postgres wire protocol, Redis RESP, Minecraft — todos são protocolos por cima de TCP.\n\n**Stateful vs stateless.** Um protocolo é stateful quando o significado de um byte depende do que veio antes. HTTP é (quase) stateless: cada request é independente. Minecraft é fortemente stateful: o servidor tem que lembrar em que estado da conexão você está (handshake, login, configuration, play) pra interpretar os próximos bytes. Esse detalhe muda tudo no design.\n\n**Serialização** é o jeito que você transforma uma estrutura em código (`{ name: "Davi", health: 20 }`) em bytes que entram no socket. JSON é uma forma textual e legível. Protocol Buffers, Avro, e o formato binário do Minecraft são formas compactas otimizadas pra velocidade. Em jogos, cada byte conta.',
      pass3: [
        {
          gotcha: 'Achar que TCP entrega "mensagens"',
          note: 'TCP entrega um stream contínuo de bytes. Quem agrupa em mensagem é o seu código, lendo o header de tamanho. Esquecer disso vira o bug clássico de "metade da mensagem chegou em uma leitura, outra metade na próxima".',
        },
        {
          gotcha: 'Confundir formato com protocolo',
          note: 'JSON é um formato (como serializar dados). HTTP é um protocolo (sequência de mensagens, semântica de verbos). Você pode usar HTTP com XML, JSON, Protobuf — formato e protocolo são camadas diferentes.',
        },
        {
          gotcha: 'Esquecer que o socket é uma identidade',
          note: 'Cada socket aberto representa um cliente conectado. O servidor mantém um mapa `socket → estado do cliente`. Se você perder essa associação, perdeu quem é o player do outro lado.',
        },
      ],
      anchor:
        'Dois processos numa rede precisam conversar. Liste o que precisa existir antes de qualquer byte ser enviado.',
      askWho: [
        {
          name: 'Eduardo Izawa',
          why: 'Tem networking + databases na bagagem. Voz natural pra puxar a discussão sobre stream vs message-frame. Pergunta de aquecimento que ele consegue ancorar tecnicamente.',
        },
        {
          name: 'Livia Tavares',
          why: 'Networking + caching + load-balancers. Segunda voz forte. Se Eduardo focar em TCP, Livia pode preencher com a parte de estado da conexão.',
        },
        {
          name: 'Maria Clara',
          why: 'Tem networking na bagagem e o maior breadth do cohort (15 tópicos). Backup confiável que conecta com qualquer ponta da resposta.',
        },
      ],
      followup:
        'Então tem socket, tem stream de bytes, tem protocolo. Como o servidor sabe onde uma mensagem termina e a próxima começa?',
      gotcha:
        'Se alguém disser "TCP separa as mensagens": "manda 3 mil bytes seguidos. Quem decide que isso é uma ou três mensagens?"',
    },
    {
      id: 'f-event-broker',
      label: 'Evento, listener, broker',
      group: 'foundations',
      teachFromZero: true,
      tags: ['evento', 'listener', 'broker', 'pub/sub', 'fan-out'],
      oneLine:
        'Em vez de A chamar B direto, A publica um evento num broker. B (e C, D, E) se inscrevem nesse tipo de evento e recebem quando acontece. Esse é o primitive central de event-driven.',
      pass1:
        'Existe um jeito de dois sistemas conversarem que não é "A chama B". É "A grita pro mundo que algo aconteceu, e quem se importa, escuta". Esse modelo é a base de event-driven architecture, e ele aparece em todo lugar: Bukkit, Kafka, SNS+SQS, RabbitMQ, o DOM do browser. Antes da gente entrar em Minecraft, precisa fixar o vocabulário.',
      pass2:
        '**Evento.** Um fato que aconteceu, imutável, no passado. Não é um comando ("delete o usuário 42"), é uma narração ("o usuário 42 foi deletado"). A diferença é sutil mas decisiva: comando exige um destinatário; evento não. Quem se importa, reage; quem não, ignora.\n\n**Listener / consumer / handler.** Um pedaço de código que diz "quando esse tipo de evento acontecer, executa essa função". O listener se inscreve uma vez e fica aguardando. No Bukkit é `@EventHandler public void onJoin(...)`. No Kafka é um consumer subscrito a um topic. No browser é `element.addEventListener("click", ...)`. A primitiva é a mesma.\n\n**Broker / event bus.** O lugar onde os eventos passam. Quem publica não conhece quem consome. Quem consome não conhece quem publica. O broker é a peça que desacopla os dois lados. Pode ser na memória (EventEmitter, Bukkit interno) ou na rede (Kafka, SQS, Redis pub/sub) — o conceito é idêntico.\n\n**Fan-out.** Um evento, N listeners reagindo. Player entrou no servidor → 5 plugins reagem ao mesmo tempo. Usuário pausou o vídeo no Netflix → recommendation engine, billing, analytics, content protection, todos consomem. Esse fan-out é o que viabiliza escala: você adiciona um novo consumer sem mexer no produtor.',
      pass3: [
        {
          gotcha: 'Confundir comando com evento',
          note: 'Comando: "delete o usuário 42" (imperativo, exige destinatário). Evento: "usuário 42 foi deletado" (narração, no passado). Sistemas baseados em eventos só funcionam se os payloads forem narrações, não imperativos. Misturar os dois ressuscita o acoplamento que você quis evitar.',
        },
        {
          gotcha: 'Achar que listener é sinônimo de callback',
          note: 'Callback é "execute essa função quando essa operação terminar" — relação 1:1, vida curta. Listener é inscrição persistente que dispara toda vez que o evento acontecer — relação 1:N, vida longa. São primitivas diferentes mesmo parecendo iguais em sintaxe.',
        },
        {
          gotcha: 'Pensar que precisa de Kafka pra fazer event-driven',
          note: 'Event-driven é o padrão. Kafka é uma implementação distribuída. EventEmitter no Node.js é event-driven. O bus interno do Bukkit é event-driven. A escolha de Kafka vem de requisitos (durabilidade, ordem, replay), não do paradigma.',
        },
      ],
      anchor:
        'Em vez de o serviço A chamar o serviço B direto, o que muda quando A publica um evento e B se inscreve?',
      askWho: [
        {
          name: 'Maria Clara',
          why: 'Única com pubsub + scalability + load-balancers. O vocabulário de fan-out cai exatamente na bagagem dela. Faz ela liderar.',
        },
        {
          name: 'Messias Olivindo',
          why: 'Tem pubsub também. Segunda voz se Maria Clara quiser passar adiante.',
        },
        {
          name: 'open',
          why: 'Pergunta de fundamento, qualquer um pode contribuir. Use a abertura pra ver quem se arrisca antes de chamar os especialistas.',
        },
      ],
      followup:
        'Se um listener demora 10 segundos pra processar, o que acontece com o resto?',
      gotcha:
        'Se alguém disser "comando e evento são a mesma coisa": "`delete o usuário 42` e `o usuário 42 foi deletado` — qual dos dois precisa ter alguém escutando pra fazer sentido?"',
    },
    // ──────────────── PACKETS ARC ────────────────
    {
      id: 'mc-packets',
      label: 'Packets · o protocolo binário',
      group: 'packets',
      beat: 1,
      tags: ['packet', 'varint', 'handshake', 'state-machine', 'wireshark'],
      oneLine:
        'Minecraft tem um protocolo binário próprio. Centenas de tipos de packet, divididos em estados (handshake, status, login, configuration, play). Cada byte tem significado contratado.',
      pass1:
        'Quando você aperta "Conectar a um servidor", o cliente Minecraft abre um socket TCP na porta 25565 e começa a falar um protocolo binário muito bem documentado em wiki.vg. Não é HTTP. Não é JSON. É um stream de packets, cada um com um ID que diz o tipo e um payload no formato específico daquele tipo. E o significado de um packet depende do estado da conexão — o byte 0x00 quer dizer coisas diferentes no handshake e no play.',
      pass2:
        '**Anatomia de um packet.** Cada packet tem três partes: tamanho (VarInt — inteiro de tamanho variável, 1 a 5 bytes), ID (VarInt, indica o tipo), e payload (formato definido pelo ID). O VarInt é uma compressão clássica: números pequenos cabem em 1 byte; números grandes em até 5. Pra um sistema onde a maioria dos IDs é baixa, isso economiza largura de banda.\n\n**Estado da conexão (state machine).** Logo após o socket abrir, a conexão está no estado **handshake**. O cliente manda 1 packet dizendo "quero ir pro estado login" ou "quero ir pro estado status". O servidor muda o estado da conexão. A partir daí, o byte ID 0x00 quer dizer outra coisa. Os estados são: handshake → (status OU login → configuration → play). Cada estado tem seu próprio conjunto de packets, próprios IDs, próprios payloads. Confundir estados é a primeira fonte de bug em qualquer implementação de cliente customizado.\n\n**Direções.** Packets são classificados em duas direções: **serverbound** (cliente → servidor: digitar comando, mover personagem, quebrar bloco) e **clientbound** (servidor → cliente: spawn de mob, mudança de bloco, mensagem no chat). O mesmo ID 0x00 pode existir nas duas direções, com semântica diferente. Direção sempre faz parte da identidade do packet.\n\n**Volume e cadência.** Em gameplay típico, o servidor manda dezenas de packets por tick pra cada player conectado (chunks visíveis, entidades próximas, animações). Multiplica por 100 players, multiplica por 20 ticks por segundo, e você tem milhares de packets por segundo saindo da NIC. Por isso o protocolo é binário — JSON nesse volume mataria a CPU em serialização.\n\n**Wireshark mostra tudo.** Ligar Wireshark filtrando `tcp port 25565` enquanto você conecta no servidor mostra cada packet aparecendo na tela. Você vê o handshake, o login, o tsunami de packets de chunk quando o player entra no mundo. É essa visibilidade que torna o Minecraft um lab pedagógico tão bom — você consegue olhar pro byte.',
      pass3: [
        {
          gotcha: 'Achar que ID 0x00 quer dizer sempre a mesma coisa',
          note: 'O ID só faz sentido junto com o estado da conexão. Em handshake, 0x00 inicia o handshake. Em play, 0x00 é Confirm Teleportation. Sem state machine, o byte é ambíguo.',
        },
        {
          gotcha: 'Esquecer a direção',
          note: 'Packets serverbound e clientbound são listas separadas. O mesmo ID pode existir nos dois, com semântica diferente. Implementações customizadas que não tipam direção viram um caos.',
        },
        {
          gotcha: 'Tratar o stream como mensagens auto-delimitadas',
          note: 'TCP não delimita. Você lê o VarInt de tamanho primeiro, aí lê exatamente N bytes pro payload, aí volta a ler o próximo VarInt. Esse loop "read length, read payload" é o coração de qualquer leitor de protocolo binário.',
        },
        {
          gotcha: 'Subestimar o overhead de JSON',
          note: 'JSON é ~10x maior em bytes e ~100x mais caro em CPU de parse comparado com o binário do Minecraft. Em um servidor com 100 players a 20 TPS, isso é a diferença entre TPS estável e servidor lagado.',
        },
      ],
      anchor:
        'Você aperta `Connect` no client. Primeiro byte sai do socket. Qual? E como o servidor sabe o que ele significa?',
      askWho: [
        {
          name: 'Eduardo Izawa',
          why: 'Tem networking + databases. O conceito de protocolo binário + state machine encaixa direto no que ele estudou de wire protocols. Lider técnico desse beat.',
        },
        {
          name: 'Livia Tavares',
          why: 'Networking + load-balancers. Segunda voz boa, especialmente quando entrar no tema de "direções" (serverbound vs clientbound).',
        },
        {
          name: 'Maria Clara',
          why: 'Networking + breadth alto. Backup se a discussão pegar volume e precisar abrir pra cadência (packets por tick × players).',
        },
      ],
      followup:
        'OK, o cliente mandou packets em sequência. Quem do lado do servidor pega esse stream e transforma em "ah, o Davi quebrou um bloco"?',
      gotcha:
        'Se alguém pular pra "deserializa o JSON": "Minecraft usa JSON no wire protocol? Aposta a bagagem da semana?"',
    },
    // ──────────────── TICK LOOP ARC ────────────────
    {
      id: 'mc-tick',
      label: 'Tick loop · 20 TPS é a heartbeat',
      group: 'tick',
      beat: 2,
      tags: ['tick', 'tps', 'main-thread', 'game-loop', 'scheduler'],
      oneLine:
        'O servidor processa o mundo em ticks discretos a 20 por segundo. Cada tick: lê packets pendentes, atualiza estado, dispara eventos, manda packets de saída. Tudo no main thread.',
      pass1:
        'Servidor Minecraft não é request-response. Não tem um handler que acorda quando uma request chega e devolve uma response. Ele tem um loop fixo, rodando 20 vezes por segundo, fazendo as mesmas etapas em ordem: ler tudo que chegou, atualizar o mundo, decidir o que mandar, mandar. Esse loop é o tick, e entender ele é entender por que tudo no Minecraft funciona do jeito que funciona.',
      pass2:
        '**20 TPS, 50ms por tick.** Um segundo de gameplay tem 20 ticks. Cada tick tem um budget de 50 milissegundos pra fazer todo o trabalho. Se um tick demora mais que 50ms, o próximo começa atrasado e o TPS efetivo cai. Players sentem isso como "lag": animações engasgando, mobs travando, comandos respondendo devagar. TPS abaixo de 18 é alerta; abaixo de 10, o servidor virou inviável.\n\n**O que acontece em um tick.** Em ordem aproximada: processa packets que chegaram nos sockets dos players, atualiza física e movimento, processa redstone, atualiza entidades (mobs caminhando, projéteis voando), dispara eventos pra plugins reagirem, faz autosave incremental do mundo, e finalmente envia packets de saída pra cada player. Tudo rodando no mesmo thread (o main thread). Se qualquer uma dessas etapas demora, o tick inteiro atrasa.\n\n**Por que single-threaded?** Mundo do Minecraft é altamente conectado: um bloco quebrado dispara update em vizinhos, que disparam em vizinhos, que afetam física, que move entidades. Lockar e desbloquear isso entre threads geraria contenção catastrófica. O design escolhe simplicidade single-thread em troca de aceitar que trabalho pesado tem que sair desse thread por outras vias (async tasks, scheduler).\n\n**Game loop vs request-response.** É a diferença mental que esse beat existe pra fixar. Servidor web: thread pool atende requests independentes; sem pedido, fica idle. Game server: loop constante, mesmo sem ninguém conectado o servidor tá processando ticks. Essa diferença muda como você projeta TODO o resto — caching, escalabilidade, performance, observabilidade. Um servidor de jogo é fundamentalmente síncrono e periódico; um servidor web é fundamentalmente assíncrono e reativo.\n\n**Scheduler do Bukkit.** Plugins podem agendar tarefas pra rodar em ticks futuros: "daqui a 20 ticks (1 segundo), execute X". O scheduler é uma fila ordenada por tick, processada como uma das etapas do tick. Importante: tasks **síncronas** rodam no main thread (podem mexer no mundo, mas precisam ser rápidas); tasks **assíncronas** rodam num thread pool separado (não podem tocar no mundo direto, mas podem fazer I/O pesado).',
      pass3: [
        {
          gotcha: 'Achar que async resolve qualquer trabalho pesado',
          note: 'Async no Bukkit não pode tocar no mundo direto — chamar `block.setType()` de um async task quebra o estado. O padrão é: trabalho pesado vai pra async (ex: query HTTP), e o resultado volta pro main thread via `Bukkit.getScheduler().runTask(...)` pra aplicar no mundo. Misturar é causa #1 de crash com `ConcurrentModificationException`.',
        },
        {
          gotcha: 'Confundir "FPS" com "TPS"',
          note: 'FPS é do cliente (quantas vezes a tela é renderizada por segundo). TPS é do servidor (quantos ticks o servidor processa por segundo). Player pode ter 200 FPS e estar conectado num servidor com 5 TPS — vai sentir lag mesmo sem problema gráfico.',
        },
        {
          gotcha: 'Esperar latência sub-tick',
          note: 'O menor delay perceptível no Minecraft é 1 tick (50ms). Comando que precisa reagir mais rápido não tem como — você está limitado pela cadência do loop. Mecânicas competitivas (PVP, BedWars) sofrem com isso, e por isso clusters de servidor evitam round-trips internos no caminho crítico.',
        },
        {
          gotcha: 'Bloquear o main thread pra esperar I/O',
          note: 'Chamar uma API HTTP no main thread durante um evento congela o servidor todo até a resposta chegar. Tudo (movimento, redstone, outros eventos) pausa. O pattern certo é: agendar async task → fazer o HTTP → voltar pro main thread pra aplicar.',
        },
      ],
      anchor:
        'O servidor tá ligado, ninguém conectou. O que ele tá fazendo, milissegundo por milissegundo?',
      askWho: [
        {
          name: 'Eduardo Izawa',
          why: 'Tem databases + replication + sharding na bagagem — quem mais consegue articular "single-threaded por design pra evitar contenção" da turma. Beat dele.',
        },
        {
          name: 'Maria Clara',
          why: 'Scalability + load-balancers. Forte na contraste game-loop vs request-response (que é exatamente sobre topologia de servidor).',
        },
        {
          name: 'Livia Tavares',
          why: 'Networking + caching. Backup pra puxar "por que single-thread implica em estratégia diferente de cache".',
        },
      ],
      followup:
        'Beleza, o tick processa packets, atualiza mundo, manda packets. Mas onde, exatamente, o servidor decide "ah, o player entrou, dispara o welcome"?',
      gotcha:
        'Se alguém disser "joga tudo em async pra ser rápido": "como `player.teleport()` em async task não crashou? Aposta na próxima.""',
    },
    // ──────────────── EVENTS ARC ────────────────
    {
      id: 'mc-event-anatomy',
      label: 'Event + Listener · anatomia de um @EventHandler',
      group: 'events',
      beat: 3,
      tags: ['event', 'listener', 'event-handler', 'priority', 'cancellable'],
      oneLine:
        'Quando algo muda no mundo, o servidor cria um Event e chama os Listeners inscritos. Plugin é literalmente uma coleção de listeners — código que reage, não código que pede.',
      pass1:
        'Bukkit é um framework de eventos. Plugin não tem `main()` no sentido tradicional. Plugin tem um `onEnable()` que registra listeners no event bus do servidor, e a partir daí o código do plugin só roda quando o servidor decide chamá-lo. Você não pede. Você reage. Essa inversão de controle é a essência do paradigma event-driven, e Bukkit é a forma mais limpa que existe pra ver isso na prática.',
      pass2:
        '**Anatomia de um listener.** Você cria uma classe que implementa `Listener`, define um método com a annotation `@EventHandler` recebendo o tipo de evento que você quer escutar como parâmetro, e registra a classe no event manager: `Bukkit.getPluginManager().registerEvents(this, plugin)`. Pronto. Toda vez que o servidor dispara aquele evento, seu método roda. Sem polling, sem callback chain, sem subscribe explícito por evento.\n\n**O catálogo de eventos é gigante.** PlayerJoinEvent, PlayerQuitEvent, BlockBreakEvent, EntityDamageEvent, AsyncChatEvent, ServerCommandEvent, InventoryClickEvent — centenas deles, organizados por área (Player, Block, Entity, Inventory, Server, World). Cada um tem campos específicos (`getPlayer()`, `getBlock()`, `getDamage()`) com o contexto relevante.\n\n**Priority controla ordem de execução.** Quando 5 plugins inscrevem listeners no mesmo evento, eles rodam em ordem definida por `EventPriority`: LOWEST → LOW → NORMAL → HIGH → HIGHEST → MONITOR. Plugins decidem prioridade pelo tipo de trabalho: anti-cheat usa LOWEST/LOW (chega primeiro pra cancelar antes dos outros agirem); estatísticas usam MONITOR (rodam por último, só observando, nunca alterando). Essa convenção é cultural mas crítica — um plugin que altera o evento em MONITOR quebra todos os outros que confiaram que MONITOR é só leitura.\n\n**Cancellable.** Vários eventos implementam a interface `Cancellable`. O listener pode chamar `event.setCancelled(true)` pra desfazer a ação. PlayerInteractEvent cancelado → o clique do player simplesmente não tem efeito. BlockBreakEvent cancelado → o bloco não quebra, e o cliente até começa a quebrar mas o servidor desfaz com um packet de correção. Essa é a alavanca mais poderosa do sistema: anti-cheat, world protection, e plugins de gameplay usam isso pra mudar regras sem reescrever o servidor.\n\n**Async event vs sync event.** A maioria dos eventos é síncrona — dispara no main thread, processa serialmente todos os listeners, e segue o tick. Alguns eventos (AsyncChatEvent, AsyncPlayerPreLoginEvent) são disparados em threads worker porque a operação geradora não precisa do main thread. Listener inscrito em evento async não pode tocar no mundo direto. Confundir os dois quebra o servidor.',
      pass3: [
        {
          gotcha: 'Esquecer de chamar registerEvents',
          note: 'Criar a classe Listener e colocar @EventHandler nos métodos não basta. Sem `Bukkit.getPluginManager().registerEvents(this, plugin)` no onEnable, o listener nunca é chamado. Bug clássico: "meu plugin não faz nada" porque essa linha foi esquecida.',
        },
        {
          gotcha: 'Usar MONITOR pra alterar o evento',
          note: 'MONITOR é convenção de "só leitura, só observa". Anti-cheats e outros plugins lêem o estado final do evento em MONITOR confiando nisso. Cancelar ou modificar em MONITOR quebra a expectativa e gera bugs sutis em produção.',
        },
        {
          gotcha: 'Inscrever em evento errado por causa de nome parecido',
          note: 'PlayerInteractEvent é o clique no mundo. PlayerInteractEntityEvent é o clique em uma entidade. EntityDamageEvent é qualquer dano. EntityDamageByEntityEvent é dano causado por outra entidade. Inscrever no evento "errado-mas-parecido" é causa comum de "meu listener não dispara".',
        },
        {
          gotcha: 'Achar que mudar o evento muda a ação automaticamente',
          note: 'Em alguns eventos você pode chamar `setDamage(0)` no EntityDamageEvent e o dano não acontece. Em outros, modificar campos não tem efeito — só `setCancelled(true)` impede. A regra é: leia a javadoc do evento específico antes de assumir.',
        },
      ],
      anchor:
        'Player entra no servidor. Plugin Welcome quer mostrar "Bem-vindo, Davi!". Quantas linhas de Java precisam existir e onde elas moram?',
      askWho: [
        {
          name: 'Maria Clara',
          why: 'Maior breadth do cohort (15 tópicos) + pubsub estudado. A primitiva é exatamente o que ela tem na cabeça. Pergunta de articulação fina cai pra ela.',
        },
        {
          name: 'Messias Olivindo',
          why: 'Tem pubsub. Segunda voz forte, especialmente pra contrastar com mensagens de fila assíncrona que ele provavelmente viu.',
        },
        {
          name: 'Eduardo Izawa',
          why: 'Não tem pubsub mas tem todo o resto. Backup pra quando entrar em priority + cancellable (que conectam com transações + ordem).',
        },
      ],
      followup:
        'E se eu quiser que 5 plugins reajam ao mesmo PlayerJoinEvent — quem chama quem, e em que ordem?',
      gotcha:
        'Se alguém disser "o servidor avisa um plugin de cada vez via SDK": "o servidor mantém uma lista de quem? E itera quando?"',
    },
    {
      id: 'mc-fanout',
      label: 'Fan-out · 1 evento, N reações independentes',
      group: 'events',
      beat: 4,
      tags: ['fan-out', 'decoupling', 'event-bus', 'multiple-listeners', 'plugin'],
      oneLine:
        'Quando um PlayerJoinEvent dispara, o servidor itera todos os listeners inscritos e chama cada um. Eles não se conhecem. Adicionar um sexto plugin não exige mexer em nenhum dos cinco existentes.',
      pass1:
        'Esse é o beat onde o paradigma vira algo visceral. Você tem o servidor. Você tem 5 plugins instalados, cada um com seu próprio listener no PlayerJoinEvent. Um player entra. O que acontece é mágico no primeiro contato com isso, e é o coração do que torna o sistema escalável: o servidor itera a lista de listeners inscritos, e chama cada um, em sequência, sem que eles se conheçam. Esse é o fan-out clássico. E é o mesmo padrão de Kafka, SQS, e qualquer sistema event-driven em produção.',
      pass2:
        '**O loop interno é simples.** O servidor mantém uma lista de listeners pra cada tipo de evento. Quando o evento é disparado, ele varre essa lista (na ordem de priority) e chama cada listener com o mesmo objeto Event como parâmetro. Cada listener faz sua coisa, retorna, e o próximo executa. O evento "termina" quando o último listener retorna.\n\n**Os listeners não sabem da existência uns dos outros.** O WelcomePlugin não importa nada do ScoreboardPlugin. O AnalyticsPlugin não chama o AntiCheatPlugin. Eles só veem o evento. Esse é o desacoplamento que muda tudo: você adiciona um sexto plugin sem mexer nos cinco anteriores. Você remove um plugin sem afetar nenhum outro. Essa propriedade não é só conveniência — é o que viabiliza ecossistemas de plugins de centenas de desenvolvedores independentes (Spigot tem ~50 mil plugins publicados).\n\n**Tradução pro mundo enterprise.** O exato mesmo padrão é o que faz Netflix escalar. Um VideoStartedEvent é publicado em um Kafka topic. Recommendation engine, billing, analytics, content protection, parental controls — cada um é um consumer subscrito no topic. Adicionar um sexto serviço (digamos, "geographic license check") significa subir um novo consumer e subscrevê-lo no topic. Os outros cinco não sabem. Não precisam saber.\n\n**Falha isolada.** Se o ScoreboardPlugin crashar dentro do listener, o Bukkit captura a exception, loga, e segue chamando os próximos listeners. Welcome ainda mostra a mensagem. Analytics ainda registra a entrada. AntiCheat ainda verifica o player. Isolamento de falha era o argumento "técnico" da microservices, mas no Bukkit ele aparece naturalmente sem nenhum esforço — só por causa do design event-driven.\n\n**Custo.** O preço dessa elegância é que **a ordem fica não-determinística** entre listeners no mesmo priority, **não tem garantia de tempo de execução** (5 listeners lentos = 5x mais lento que 1), e **debug fica mais difícil** (quem alterou o evento? qual listener disparou um efeito colateral?). O paradigma resolve um problema (acoplamento) trocando por outro (rastreabilidade), e você tem que estar consciente do tradeoff.',
      pass3: [
        {
          gotcha: 'Achar que listeners rodam em paralelo',
          note: 'No Bukkit síncrono eles rodam serialmente, um depois do outro, no main thread. 5 listeners pesados = 5x o tempo. Pra paralelismo de verdade, você precisa de Kafka com consumer groups, ou processar em threads worker async.',
        },
        {
          gotcha: 'Esperar ordem determinística entre prioridades iguais',
          note: 'Dois plugins ambos em NORMAL podem rodar em ordens diferentes em servidores diferentes. Se a ordem importa, você precisa de prioridades diferentes — e nesse caso, é melhor pensar se o problema não é design.',
        },
        {
          gotcha: 'Não isolar exception no listener',
          note: 'Bukkit captura a exception genérica e segue, mas se você não logar com contexto (qual plugin, qual evento, qual player), debugar fica impossível. Sempre tente-catch dentro de listeners pesados.',
        },
        {
          gotcha: 'Esquecer que mais plugins = mais ms por evento',
          note: 'PlayerJoinEvent dispara várias vezes por minuto em servidores grandes. Cada listener adiciona latência ao tick. Servidores com 30 plugins pesados sofrem TPS no horário de pico — não é "bug", é matemática.',
        },
      ],
      anchor:
        'Você tem 5 plugins instalados, cada um com um listener no PlayerJoinEvent. O player entra. Em que ordem eles rodam, e o que acontece se um deles trava?',
      askWho: [
        {
          name: 'Maria Clara',
          why: 'Pubsub + scalability + load-balancers. Esse é literalmente o beat onde ela explica fan-out melhor que ninguém da turma. Lider.',
        },
        {
          name: 'Messias Olivindo',
          why: 'Pubsub também. Bom contraste com Maria Clara se o tópico abrir pra "ok mas e em Kafka como isso fica".',
        },
        {
          name: 'Eduardo Izawa',
          why: 'Tem databases + scale. Backup pra quando entrar em performance (custo de N listeners no tick).',
        },
      ],
      followup:
        'OK, fan-out demonstrado. E se um dos listeners tiver que fazer query HTTP, segura todos os outros?',
      gotcha:
        'Se a turma cair na ideia de "rodam em paralelo": "no Bukkit síncrono, são threads diferentes ou é o mesmo thread iterando?"',
    },
    // ──────────────── PEGADINHAS ARC ────────────────
    {
      id: 'mc-pitfalls',
      label: 'Pegadinhas · async, ordering, cancellable',
      group: 'events',
      beat: 5,
      tags: ['async', 'thread-safety', 'ordering', 'cancellable', 'tps'],
      oneLine:
        'Três armadilhas que aparecem em todo sistema event-driven: bloquear o main thread, depender de ordem entre listeners, e cancelar eventos sem cuidado.',
      pass1:
        'Com o paradigma na mão, vem a parte que separa quem leu o tutorial de quem rodou plugins em produção. Bukkit, Kafka, SQS — qualquer sistema event-driven sofre das mesmas três pegadinhas. Vale gastar 10 minutos aqui porque essas armadilhas reaparecem em qualquer entrevista de design distribuído.',
      pass2:
        '**Pegadinha 1: bloquear no main thread.** O listener síncrono roda no thread do tick. Se você chamar uma API HTTP esperando resposta (`HttpClient.send` bloqueante) dentro de um PlayerJoinEvent, o tick inteiro pausa até a resposta voltar. Servidor congela. TPS cai a zero. Players desconectam por timeout. A solução é o padrão clássico: o listener síncrono dispara uma task assíncrona (`Bukkit.getScheduler().runTaskAsynchronously(...)`), retorna imediatamente, e a task async faz o HTTP. Quando o resultado chega, ela agenda uma task síncrona pra aplicar no mundo. Esse "main thread → async → main thread" é exatamente o pattern que aparece em Node.js (event loop + worker pool), em Android (UI thread + AsyncTask), em qualquer GUI moderna.\n\n**Pegadinha 2: ordering entre listeners.** Você não controla a ordem entre listeners no mesmo priority, e você quase nunca quer depender dela. Se Welcome precisa rodar antes de Scoreboard, a tentação é colocar Welcome em HIGH e Scoreboard em LOW. Funciona — até o dia que um terceiro plugin entra com sua própria opinião sobre prioridade. A solução robusta é: cada listener deve ser idempotente e independente. Se a ordem REALMENTE importa, considere se isso não é um sinal de que o evento deveria ser dois eventos diferentes em sequência (PlayerJoinedRawEvent → PlayerJoinedReadyEvent), não dois listeners no mesmo.\n\n**Pegadinha 3: cancellable como faca de dois gumes.** `event.setCancelled(true)` é a alavanca mais poderosa do Bukkit, e por isso a mais perigosa. Plugin A cancela o BlockBreakEvent porque o player não tem permissão. Plugin B (anti-cheat) ESPERAVA o evento acontecer pra atualizar contagem de blocos. O cancelamento do A invalida o estado interno do B sem ele saber. O remédio é: leia o estado de cancelamento (`event.isCancelled()`) antes de assumir, e considere usar `@EventHandler(ignoreCancelled = true)` se você só se importa com eventos que NÃO foram cancelados.\n\n**Onde isso reaparece em backend de verdade.** A pegadinha 1 é o problema clássico de "synchronous I/O na request thread" em qualquer servidor web (Node ficou famoso por resolver isso por design; Java/Spring resolveu com WebFlux/Reactive). A pegadinha 2 é exatamente o problema de "consumer ordering" em Kafka — solução padrão é particionar por uma chave que preserve ordem onde importa (player_id, conversation_id), e aceitar ordem global como impossível. A pegadinha 3 é a versão local do problema distribuído de "compensating transactions" em sagas: como você desfaz algo que já foi parcialmente processado? Não tem solução fácil, tem disciplina.',
      pass3: [
        {
          gotcha: 'Async task que toca direto no mundo',
          note: '`player.teleport()` num async task crasha o servidor com ConcurrentModificationException. Async serve pra I/O e cálculo puro. Mudança no mundo SEMPRE volta pro main thread via `runTask`.',
        },
        {
          gotcha: 'Usar HIGHEST pra "ser o último"',
          note: 'HIGHEST roda antes de MONITOR. Quem quer ser literalmente o último a observar (sem modificar) usa MONITOR. Quem quer modificar por último usa HIGHEST. Confundir os dois quebra a convenção que outros plugins assumem.',
        },
        {
          gotcha: 'Cancelar um evento async em outro thread',
          note: 'Modificar o objeto Event de um thread diferente de quem disparou é race condition garantida. Listeners async têm que tratar o evento como imutável; se precisar reagir mudando estado, agenda uma task síncrona.',
        },
        {
          gotcha: 'Não medir o impacto no tick',
          note: 'Plugin pesado adiciona ms ao tick que processou o evento. Em produção, sempre tem que medir: spigot tem `/timings` e Paper tem `/mspt`, e essas ferramentas dizem qual plugin tá custando quanto. Sem medir, você adivinha — e adivinhar errado custa TPS.',
        },
      ],
      anchor:
        'Você escreve um listener no PlayerJoinEvent que faz `httpClient.send(...)` bloqueante pra checar o usuário num webhook externo. O webhook demora 2 segundos. Descreve o que acontece, tick por tick, no servidor.',
      askWho: [
        {
          name: 'Eduardo Izawa',
          why: 'Databases + replication + scale. Esse beat é sobre concorrência e ordering — tópicos exatamente cobertos por replication. Lider.',
        },
        {
          name: 'Maria Clara',
          why: 'Scalability + pubsub. Pra puxar o paralelo com Kafka consumer ordering e mostrar que é o mesmo problema.',
        },
        {
          name: 'Livia Tavares',
          why: 'Networking + caching. Backup pra puxar "como a galera resolve isso na prática com pool de threads".',
        },
      ],
      followup:
        'Beleza, agora a gente sabe como o servidor processa cada player isoladamente. Mas se eu quero rodar 100 servidores juntos atendendo 10 mil players? Como isso fica?',
      gotcha:
        'Se ninguém citar o problema de ordering, devolva: "5 plugins, cada um em prioridade NORMAL, todos dependem da ordem entre si. Aposta pessoal que eu desinstalo um e tudo quebra?"',
    },
    // ──────────────── ARCHITECTURE (mandatory) ────────────────
    {
      id: 'mc-architecture',
      label: 'Arquitetura completa · servidor de Minecraft moderno',
      group: 'events',
      beat: 6,
      tags: ['velocity', 'proxy', 'cluster', 'redis-pubsub', 'plugin-messaging'],
      oneLine:
        'Um único Paper aguenta ~100 players. Pra escalar pra 10 mil, você cluster Minecraft com proxy (Velocity), separa server por shard de mundo, e usa Redis pub/sub pra eventos cross-server.',
      pass1:
        'Tudo que a gente viu até aqui foi um Paper rodando sozinho com seus plugins. Bom pra ~100 players concorrentes. Em servidores reais (Hypixel, Mineplex, 2b2t), são dezenas de milhares de players simultâneos. Como você passa de "um servidor" pra "uma infra de servidores"? Esse beat é o desenho no quadro — junta tudo dos beats anteriores e mostra como packets, tick loop e events se compõem numa arquitetura distribuída.',
      pass2:
        '**Proxy na frente (Velocity ou BungeeCord).** O player não conecta direto num server Minecraft. Ele conecta num **proxy**, que abre socket pra ele, faz o handshake, e roteia pacotes pro server Minecraft real onde o player tá atualmente. Vantagem: o player pode "trocar de servidor" sem fechar a conexão (entra na lobby, depois entra no mini-game X, depois no mini-game Y, tudo sem reconectar). Outra vantagem: o proxy é o único exposto na internet — os Minecraft servers ficam em rede privada, atrás dele.\n\n**Sharding por mundo / por mini-game.** Cada Minecraft server é um shard. Lobby roda em um. SkyBlock roda em outro. BedWars roda em N (um por arena). Players são roteados pelo proxy pro shard certo. Carga é distribuída por shard, e cada shard mantém o tick a 20 TPS dentro de suas próprias 100 entidades.\n\n**Estado compartilhado via cache distribuído.** "Quem é o nick do player no lobby?" é um dado que todos os shards precisam saber. A solução é um Redis (ou similar) que todos os Minecraft servers leem. Username, party, economy balance, friends list — tudo em Redis. Cada shard mantém localmente só o estado do gameplay (posição do bloco, HP do mob), porque esses mudam 20 vezes por segundo e o overhead de remote seria fatal pra TPS.\n\n**Eventos cross-server via pub/sub.** Quando um player muda de status (entrou em party, comprou item, foi banido), o shard origem publica um evento num topic Redis. Todos os outros shards têm um listener inscrito que processa esse evento. É exatamente o mesmo padrão dos plugins locais, só que distribuído. Aqui o broker virou Redis em vez do bus interno do Bukkit — a primitiva é idêntica.\n\n**Plugin messaging (BungeeCord protocol).** Pra ações que precisam ir DO server pro proxy (mandar o player pro server X, ou pra outro server), Bukkit oferece `Plugin Messaging`: um canal nomeado por onde plugins do server enviam bytes pro plugin equivalente no proxy. É um pequeno protocolo dentro do protocolo.\n\n**Persistência.** Mundo (blocos colocados/quebrados) salva incrementalmente em região files no disco do shard. Dados de player (inventário, XP, posição) salvam em banco central — PostgreSQL ou Mongo. Esse split (mundo local, player remote) é o que viabiliza um player trocar de shard sem perder progresso.\n\n**O fluxo completo, de ponta a ponta, na entrada de um player.** Player clica connect → DNS → IP do proxy → handshake no proxy → proxy faz lookup de "qual lobby pegar?" via Redis → proxy abre socket interno com o server da lobby → forwarda packets do player → server da lobby recebe packets → dispara PlayerJoinEvent → 5 plugins reagem → mensagem de welcome publicada no Redis topic `chat.global` → todos os outros shards (que têm listener nesse topic) mostram a mensagem no chat global → player aparece online no scoreboard.',
      pass3: [
        {
          gotcha: 'Achar que dá pra rodar 10 mil players num único Paper',
          note: 'O tick é serial. Adicione entidades e plugins suficientes, um tick estoura 50ms. ~100 players é o teto prático de um Paper bem otimizado. Acima disso, sharding é obrigatório, não opção.',
        },
        {
          gotcha: 'Subestimar latência interna',
          note: 'Toda chamada Redis adiciona ~1ms. Em 20 TPS você tem 50ms por tick. Não dá pra fazer 20 chamadas Redis por tick — cabe ~5 antes de o tick estourar. Cache local agressivo + invalidação por pub/sub é a solução.',
        },
        {
          gotcha: 'Esquecer que o proxy é stateful',
          note: 'O proxy mantém socket TCP aberto com cada player. Não é serverless. Pra HA, você precisa de N proxies em load balancer L4 (não L7), porque a conexão é persistente — não pode trocar de proxy no meio.',
        },
        {
          gotcha: 'Confundir BungeeCord plugin messaging com Redis pub/sub',
          note: 'Plugin messaging é channel direto server↔proxy via socket interno. Redis pub/sub é channel server↔todos os outros servers. Os dois coexistem e resolvem problemas diferentes.',
        },
      ],
      anchor:
        'Player abre Minecraft, digita `play.hypixel.net`, aperta connect. Desenha CADA camada que o packet dele atravessa até ele aparecer correndo na lobby.',
      askWho: [
        {
          name: 'Eduardo Izawa',
          why: 'Databases + replication + sharding + caching — única pessoa com todos os 4 tópicos. Ele consegue puxar o diagrama inteiro sem esquecer camada. Lider absoluto deste beat.',
        },
        {
          name: 'Maria Clara',
          why: 'Scalability + load-balancers + pubsub. Backup forte, especialmente pra puxar o paralelo com Kafka cross-region.',
        },
        {
          name: 'Livia Tavares',
          why: 'Networking + caching + load-balancers. Terceira voz pra preencher o que Eduardo pular.',
        },
      ],
      followup:
        'OK, diagrama no quadro. Pra cada caixa, qual managed service da AWS você usaria?',
      gotcha:
        'Se desenharem só "Player → Server → DB", devolva: "cadê o proxy? Cadê o Redis? Cadê o shard de gameplay separado da lobby? Esse desenho aguenta 100 players, não 10 mil."',
    },
    // ──────────────── AWS (mandatory) ────────────────
    {
      id: 'mc-aws',
      label: 'AWS · managed services por camada',
      group: 'events',
      beat: 7,
      tags: ['ec2', 'fargate', 'nlb', 'elasticache', 'rds', 'cloudfront-not'],
      oneLine:
        'Servidor de Minecraft é stateful + TCP persistente + game-loop, então mapa pra AWS NÃO é igual ao de uma API REST. EC2 vence Lambda. NLB vence ALB. ElastiCache pra estado quente.',
      pass1:
        'O exercício de mapear cada caixa pra um managed service AWS é onde você descobre se o paradigma virou intuição ou ficou na decoração. Servidor de Minecraft tem três restrições que tornam o mapping diferente de qualquer outro caso que vocês viram: 1) conexões TCP persistentes (não-curtas como HTTP), 2) estado em memória que tem que sobreviver entre ticks, 3) latência sub-50ms exigida. Cada restrição corta opções da AWS.',
      pass2:
        '**Compute: EC2, não Fargate, definitivamente não Lambda.** Lambda morre depois de 15 minutos e não mantém estado. Fora. Fargate é container-friendly mas Bukkit usa muita RAM (cada player = ~10MB de heap, mundo carregado = ~2GB) e a Fargate tem caps de RAM que ficam caros nesse perfil. EC2 com auto-scaling group é o padrão: você escolhe o tipo de instância (c5.large pra lobby leve, c5.xlarge pra BedWars CPU-intensive), instala Paper, e escala manualmente ou via Spot. Há quem use **EKS** (Kubernetes na AWS) pra orquestrar — funciona, mas overhead extra.\n\n**Load balancer: NLB, não ALB.** ALB é HTTP/HTTPS L7 — não fala TCP raw, não persiste conexão indefinidamente. Minecraft é TCP raw com conexão persistente por horas. NLB (Network Load Balancer) é L4, opera com TCP puro, mantém a conexão estável. Outra opção é Global Accelerator pra reduzir latência global. CloudFront não entra — o protocolo não é HTTP, não há cache de resposta.\n\n**Cache: ElastiCache (Redis).** Estado compartilhado entre shards (username, party, economy) vive aqui. Latência sub-ms é mandatória — qualquer hop extra mata TPS. Cluster mode pra HA, com réplicas em AZs diferentes.\n\n**Persistência de player: RDS (Postgres ou MySQL).** Inventário, XP, ban list — estado durável. Operações são raras comparadas com gameplay (1-2 writes por minuto por player), então Postgres aguenta bem. Aurora se quiser HA automática.\n\n**Persistência de mundo: EBS gp3 ou S3.** Mundo do Minecraft é arquivo grande (~GB por shard). EBS pra hot (montado no EC2 do shard). Snapshot pro S3 a cada N minutos pra disaster recovery.\n\n**Eventos cross-server: Redis pub/sub OU MSK (Kafka gerenciado).** Pra escala pequena/média (até 10k players), Redis pub/sub no ElastiCache resolve. Pra muitos shards + durabilidade de evento + replay, MSK é o upgrade.\n\n**Monitoring: CloudWatch + custom metrics.** TPS, MSPT (milissegundos por tick), heap, players online — todos exportados pra CloudWatch. Alarmes em TPS < 18 e heap > 80%. Tracing com X-Ray pra entender qual plugin custa quanto.\n\n**O ponto pedagógico final.** A escolha de service não é "qual conheço melhor". É "qual encaixa no perfil de carga e nas restrições do protocolo". EC2 vence porque é stateful + custom networking. NLB vence porque o protocolo é TCP raw. Lambda perde porque não persiste conexão. Esse mesmo raciocínio aplica a qualquer outro caso — você nunca decora a stack, você sempre deriva ela da carga.',
      pass3: [
        {
          gotcha: 'Escolher ALB porque "é o padrão pra web"',
          note: 'ALB é HTTP. Minecraft não é HTTP. Quando o protocolo não é HTTP, ALB é a escolha errada por design — não é questão de tradeoff. Sempre confirme primeiro qual protocolo da aplicação antes de escolher o LB.',
        },
        {
          gotcha: 'Tentar Lambda pra economizar',
          note: 'Lambda morre depois de 15 min e tem cold start. Conexão de Minecraft dura horas. Mesmo que coubesse, cold start de 200ms = todos os players desconectam por timeout. Não tem "tweak" que resolva — é arquiteturalmente incompatível.',
        },
        {
          gotcha: 'Esquecer que CloudFront não cacheia TCP',
          note: 'CloudFront é HTTP edge. Pra latência global em Minecraft, a alternativa é Global Accelerator (Anycast routing) ou colocar EC2 em regiões diferentes e roteá-las via DNS.',
        },
        {
          gotcha: 'Não pensar em custo de RAM',
          note: 'Player ~= 10MB de heap. Mundo carregado ~= 2GB. Um servidor com 100 players precisa de ~3GB de RAM só de Bukkit. Spot instance vence a fatura, mas você precisa de orquestração pra mover players quando uma spot for terminated.',
        },
      ],
      anchor:
        'Você desenhou a arquitetura. Hypixel-like, 10 mil players, mini-games. Pra cada caixa, qual AWS service e por quê — justifica pela restrição do protocolo, não pela familiaridade.',
      askWho: [
        {
          name: 'Eduardo Izawa',
          why: 'Tem databases + caching + replication + sharding. Esse beat é literalmente uma sequência de tradeoffs que mapeia nas decisões de storage e cache que ele estudou. Lider.',
        },
        {
          name: 'Maria Clara',
          why: 'Scalability + load-balancers. Pra puxar a discussão de NLB vs ALB e por que CloudFront não entra.',
        },
        {
          name: 'Livia Tavares',
          why: 'Networking + load-balancers. Backup forte. Se Eduardo focar em storage, Livia pode preencher o lado de rede.',
        },
      ],
      followup:
        'Stack escolhida. Em que ordem você ia deployar pra subir um MVP de Hypixel-like com 1k players?',
      gotcha:
        'Se alguém disser "Lambda pra economizar": "Lambda morre depois de 15 min. Minecraft conecta por quanto tempo? Aposta a próxima entrevista?"',
    },
    // ──────────────── SYNTHESIS ────────────────
    {
      id: 'synthesis',
      label: 'Synthesis · Minecraft = Kafka = Netflix',
      group: 'synthesis',
      oneLine:
        'A primitiva event-driven é a mesma. Trocou de bus interno (Bukkit) pra bus distribuído (Kafka). Trocou de PlayerJoinEvent pra VideoStartedEvent. O modelo mental não muda.',
      pass1:
        'A gente passou 80 minutos em Minecraft. Agora a virada: tudo que vocês acabaram de aprender, ponto por ponto, é também a infraestrutura por trás de Netflix, Uber, e qualquer arquitetura event-driven em produção. O modelo mental que vocês construíram olhando pra um plugin Bukkit é o mesmo que descreve como um VideoStartedEvent fan-outa pra recommendation, billing, e analytics. Esse beat é a coda — fecha o paralelo, e deixa o vocabulário pronto pra reaparecer em qualquer entrevista.',
      pass2:
        '**Mapping um pra um.**\n\nPlayerJoinEvent → VideoStartedEvent. BlockBreakEvent → PaymentProcessedEvent. ChatMessageEvent → UserActionEvent. A diferença é cosmética — o esquema é idêntico: um fato passado, imutável, com payload contextual.\n\n@EventHandler do Bukkit → Kafka consumer subscribe. O método anotado vira um consumer dentro de um consumer group. A inscrição é estática (anotação no source) em Bukkit, dinâmica (config em runtime) em Kafka. O contrato é o mesmo: "quando isso acontecer, execute esse código".\n\nEvent bus interno do Bukkit → Kafka cluster (ou SNS+SQS, ou Redis pub/sub, ou RabbitMQ). O broker mudou de in-process pra distribuído na rede, com persistência, replay, e durabilidade. Mas a topologia (1 produtor, N consumidores independentes) é a mesma.\n\nPlugins reagindo em sequência no tick → microservices reagindo em paralelo em containers. O ganho do distribuído é paralelismo verdadeiro (5 consumidores em 5 instâncias = 5x throughput); o custo é latência de rede + eventual consistency entre eles.\n\nEventPriority no Bukkit → consumer groups e particionamento por chave em Kafka. O mecanismo de garantir ordem onde importa é diferente em cada lado, mas o problema (ordering parcial) é idêntico.\n\nMain thread blocking → consumer lag e back-pressure. O sintoma de "trabalho lento bloqueia o sistema" reaparece de forma análoga: no Bukkit, o tick estoura; em Kafka, o consumer lag cresce e o sistema empilha eventos não processados.\n\n**Por que essa aula foi assim?** A maioria das introduções a EDA começa com slide de Kafka, exemplo abstrato de "evento de payment", e perdem 60% da turma na primeira ponte. A gente foi pelo caminho oposto: começa com algo concreto que todos jogaram, mostra a primitiva ao vivo num servidor real, e SÓ DEPOIS faz a generalização. O custo é só os 80 minutos. O ganho é que vocês vão lembrar.\n\n**O que sai daqui.** Vocês saem sabendo que:\n1. Event-driven é um paradigma (não uma tecnologia).\n2. As primitivas (evento, listener, broker, fan-out) são as mesmas em qualquer escala.\n3. Os tradeoffs (acoplamento vs rastreabilidade, simplicidade vs ordering) são intrínsecos.\n4. A escolha de tech (Bukkit interno, Kafka, SNS+SQS, Redis pub/sub) depende de durabilidade, ordem, escala, e replay — não de "qual conheço".',
      pass3: [
        {
          gotcha: 'Decorar Kafka achando que é EDA',
          note: 'Kafka é uma implementação. Decorar a API do consumer não ensina o paradigma. Quem aprendeu via Bukkit primeiro tem mais facilidade de ver Kafka como "um broker distribuído com features X, Y, Z" em vez de "isso é EDA".',
        },
        {
          gotcha: 'Achar que precisa de Kafka pra projeto pequeno',
          note: 'EventEmitter no Node.js é EDA. Spring ApplicationEvent é EDA. O bus interno do Bukkit é EDA. Kafka só é necessário quando você tem escala distribuída + durabilidade + replay. Pra MVP, o bus in-process resolve.',
        },
      ],
      anchor:
        'Liste 3 conceitos do Bukkit que aparecem com nome diferente em Kafka. E 1 que NÃO tem equivalente direto.',
      askWho: [
        {
          name: 'open',
          why: 'Fechamento aberto. Quem responder primeiro mostra que pegou o paralelo. Bom diagnóstico de quem internalizou e quem ainda tá com os dois modelos separados.',
        },
      ],
      followup:
        'E em sistemas onde EDA não cabe (banco transacional, gateway de pagamento síncrono), o que ainda fica útil dessa aula?',
      gotcha:
        'Se ninguém citar "evento é narrativa, não comando", devolva: "qual é a diferença entre `delete o usuário 42` e `o usuário 42 foi deletado`? E por que isso é a fronteira entre EDA funcionar e não funcionar?"',
    },
  ],
};

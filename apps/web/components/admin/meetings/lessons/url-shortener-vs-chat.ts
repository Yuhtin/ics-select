import type { Lesson } from '../lesson-types';

export const urlShortenerVsChat: Lesson = {
  slug: 'url-shortener-vs-chat',
  title: 'URL Shortener × Chat',
  subtitle: 'Mesmas primitives, perfis de carga opostos.',
  blurb:
    'Dois cases clássicos de system design lado a lado. URL Shortener é write-once, read-many — eventual consistency, hot keys, scale por cache. Chat é write-many, real-time, fan-out — ordering matters, presence, scale por particionamento de conversa. A aula vai e volta entre os dois pra ensinar que a primitiva é a mesma, o que muda é o profile.',
  durationMin: 90,
  audience: 'Hot Stuff · Big Tech · semana 3',
  nodes: [
    // ──────────────── FOUNDATIONS ────────────────
    {
      id: 'f-scalability',
      label: 'Capacity estimation',
      group: 'foundations',
      teachFromZero: true,
      oneLine:
        'Antes de qualquer caixinha, estimar QPS, storage growth e read/write ratio. É o filtro que decide o resto.',
      pass1:
        'Toda entrevista de system design abre pedindo pra você estimar volume. Não é trivia — é o filtro que separa "preciso de cache" de "Redis aguenta", "shardear" de "uma instância dá", "Postgres" de "Cassandra". Você não chuta. Você assume usuários ativos, multiplica por ações/dia, divide pelo segundos do dia, e tem o write QPS. Storage = QPS × tamanho_médio × tempo_retido.',
      pass2:
        'O cálculo padrão é DAU × ações_por_user / 86400 = QPS médio. Pico costuma ser 3-5× a média. Para URL Shortener: 100M URLs criadas/mês → ~40 writes/s média, ~200 pico; leituras 100× isso (1:100 é a heurística pra link shortener) → 4k reads/s média, 20k pico. Storage: 100M × 500 bytes × 5 anos = 250GB — cabe num server, não precisa shardar por capacity, só por throughput. Pra Chat: 1B mensagens/dia → 12k writes/s média, 60k pico. Storage cresce em ~TB/mês — aqui shard é obrigatório. Read/write ratio é mais próximo de 1:1 (cada msg lida por ~todos do grupo). O ponto pedagógico: write QPS, read QPS, storage e ratio não são 4 perguntas separadas — eles juntos te dizem qual primitiva você precisa.',
      pass3: [
        {
          gotcha: 'Esquecer o pico vs média',
          note: 'Sistemas falham no pico, não na média. Sempre multiplique por 3-5×. Black Friday/horário nobre/cascata viral.',
        },
        {
          gotcha: 'Confundir armazenamento total com working set',
          note: 'Não é "quanto cabe", é "quanto fica acessível em RAM". 250GB cabe em SSD, mas working set quente pode ser 10GB — esse é o tamanho do cache.',
        },
        {
          gotcha: 'Tratar leitura e escrita com o mesmo critério',
          note: 'URL: 1:100 → cache resolve. Chat: 1:1 a 1:50 (group fan-out) → cache resolve presença, não mensagens.',
        },
      ],
      anchor:
        'Antes de desenhar caixa nenhuma — quantos usuários, quantas requests por segundo, quanto de storage por ano?',
      askWho: [
        {
          name: 'open',
          why: 'Pergunta de aquecimento — qualquer pessoa pode jogar números. Use pra que TODOS façam essa conta uma vez antes da aula descer.',
        },
      ],
      followup: 'Qual a ordem de magnitude do read/write ratio aqui?',
      gotcha: 'Se o aluno disser "pico = média", devolve: "e o Twitter quando o Elon posta?"',
    },
    // ──────────────── URL SHORTENER ARC ────────────────
    {
      id: 'url-requirements',
      label: 'Requirements & profile',
      group: 'url',
      beat: 1,
      oneLine:
        'O que perguntar antes de uma linha de código. Read/write ratio dita 80% da arquitetura.',
      pass1:
        'Antes de qualquer arquitetura, você pergunta: quem usa, quanto, com que padrão. Para URL Shortener, três respostas definem tudo o que vem depois: (1) write-light, read-heavy (1:100 fácil); (2) URL é imutável depois de criada; (3) consistency frouxa OK — se um usuário não vê o seu link recém-criado por 100ms, ninguém liga.',
      pass2:
        'Funcional: encurtar (URL longa → key curta), expandir (key → 301/302), analytics opcional. Non-functional: alta disponibilidade (link quebrado = brand damage), latência baixa na leitura (<100ms p99), custom slugs opcionais, expiração opcional. O killer feature é a IMMUTABILITY: uma vez criada, a tupla `short_key → long_url` nunca muda. Isso libera cache agressivo, libera réplicas read-only com lag, libera CDN edge caching. Nada disso seria possível num sistema mutável. Esse é o argumento que você fecha aqui — write-once + read-many + immutable = arquitetura completamente diferente de "outro CRUD qualquer".',
      pass3: [
        {
          gotcha: 'Trazer features que não foram pedidas',
          note: 'Analytics, A/B test de slugs, link com expiração, anti-abuse — tudo opcional. Foque no core primeiro. Em entrevista, o entrevistador escolhe o que aprofundar.',
        },
        {
          gotcha: 'Assumir strong consistency',
          note: 'Não precisa. Read-after-write próprio só (eventual replicas OK). Isso é GIGANTE pro design.',
        },
        {
          gotcha: 'Esquecer que a operação é GET, não POST',
          note: 'Cacheável em CDN. Browsers cacheiam 301. O sistema pode "morrer" e ainda servir.',
        },
      ],
      anchor:
        'Você precisa transformar uma URL longa em `bit.ly/abc123`. Antes de escrever código, qual é a PRIMEIRA pergunta que você faz?',
      askWho: [
        {
          name: 'Rayssa Guedes',
          why: 'Beat de entrada — ela tem só hashmap na bagagem, fica confortável numa pergunta que é mais sobre processo que sobre sistema. Puxa a voz cedo.',
        },
        {
          name: 'Pedro Souza',
          why: 'Backup se Rayssa travar — perfil parecido.',
        },
      ],
      followup:
        'Quantas leituras pra cada escrita você acha que isso tem? E isso muda alguma coisa?',
      gotcha:
        'Quando alguém disser "preciso de consistência forte", devolva: "se um usuário viu o link 200ms depois de criar, alguém perde a vida?"',
    },
    {
      id: 'url-keygen',
      label: 'Short key generation',
      group: 'url',
      beat: 2,
      oneLine:
        'Base62 de um contador, ou hash da URL truncado. Trade-off: previsibilidade vs colisão.',
      pass1:
        'O `abc123` precisa ser curto (~7 chars), único e idealmente não-adivinhável. Duas famílias: (a) counter monotônico convertido pra base62, ou (b) hash da URL + truncate. Cada uma tem trade-offs claros que aparecem em interview.',
      pass2:
        'Base62 = [a-zA-Z0-9], 62 caracteres. 7 chars = 62^7 ≈ 3.5 trilhões de keys. Vai durar. **Counter → base62**: começa em 1, cada nova URL pega o próximo número, converte. Garante unicidade sem checar DB. Problema: keys são sequenciais ("aaaab" → "aaaac"), expõe volume e dá enumeração de URLs alheias. Solução: usar um global ID generator (Snowflake) ou bloquear ranges (Zookeeper distribui blocos de 1M IDs pra cada server) — o segundo é o padrão real do Bit.ly. **Hash da URL** (MD5/SHA256, pega primeiros 7 chars em base62): determinístico, mesma URL sempre dá a mesma key, mas precisa CHECAR DB pra ver se já existe ou se outra URL bateu na mesma key (collision). Hash bom pra "uma URL = uma key sempre". Counter bom pra throughput puro de write.',
      pass3: [
        {
          gotcha: 'Achar que base64 dá pra usar',
          note: 'Tem "+" e "/", quebram em URL sem encoding. Base62 (sem símbolos) é o padrão.',
        },
        {
          gotcha: 'Esquecer que hash colide',
          note: 'Truncar SHA pra 7 chars aumenta colisão drasticamente. Birthday paradox em 62^7 → ~1M URLs antes do primeiro conflito provável.',
        },
        {
          gotcha: 'Centralizar o counter',
          note: 'Counter único global = bottleneck. Solução: blocos de IDs pré-alocados por server (Ticket Server pattern do Flickr/Bit.ly).',
        },
      ],
      anchor:
        'Tenho um contador 1, 2, 3, ... no DB. Como ele vira `abc123`? E por que base62 e não base64?',
      askWho: [
        {
          name: 'Lucas Faria',
          why: 'Tem hashmap fresco — base conversion é o aplicativo direto. Bom pra ver a roda girar na cabeça dele.',
        },
        {
          name: 'Cauan da Rocha',
          why: 'Mesma cesta — segunda voz se Lucas matar rápido.',
        },
        {
          name: 'Julia Khristina',
          why: 'Terceira opção — todos com hashmap, distribui voz.',
        },
      ],
      followup:
        'OK, e se dois usuários submetem a mesma URL no mesmo milissegundo?',
      gotcha:
        'Se alguém disser "uso UUID", devolve: "UUID tem 36 chars. Cabe num link encurtado?"',
    },
    {
      id: 'url-collision',
      label: 'Collision handling',
      group: 'url',
      beat: 3,
      oneLine:
        'Race condition vs hash collision. Resposta certa depende de qual estratégia de keygen você escolheu.',
      pass1:
        'Duas situações coexistem: (a) DUAS URLs diferentes que viram a mesma short_key (colisão real de hash) e (b) MESMA URL submetida 2× ao mesmo tempo (race condition na escrita). Resposta diferente pra cada.',
      pass2:
        'No esquema de **counter**: não tem colisão por design — cada write pega um ID único do pool. Mas race condition na MESMA URL ainda existe: dois usuários submetem `youtube.com/x` ao mesmo tempo, dois IDs distintos viram dois short_keys distintos. Isso é OK funcionalmente (links diferentes apontam pro mesmo destino) mas desperdiça keyspace. Solução opcional: lookup `long_url → short_key` antes de inserir (custa uma leitura). No esquema de **hash**: colisão é matemática. Estratégia clássica é "compute, check, retry com salt": hash da URL, checa se a short_key existe e aponta pra OUTRA URL; se sim, anexa um nonce e re-hasha. INSERT precisa ser CAS (compare-and-swap) ou usar unique constraint do DB com upsert + retry. Tudo isso é UMA round-trip extra no path do write — o que é OK porque write é raro. Em produção, Bit.ly usa híbrido: hash pra detectar dedup de URL idêntica, counter pra novos IDs.',
      pass3: [
        {
          gotcha: 'Confundir "dois usuários, mesma URL" com colisão',
          note: 'Não é colisão. É dedup opcional. Cada usuário pode ter SEU short_key.',
        },
        {
          gotcha: 'Achar que hashmap em memória resolve',
          note: 'Em memória single-node sim. Distribuído precisa de DB constraint (UNIQUE) ou Redis SETNX.',
        },
        {
          gotcha: 'Não pensar em retry budget',
          note: 'Hash colide → re-hash → ainda colide? Limite o retry. 3 tentativas e cai pra counter.',
        },
      ],
      anchor:
        'Dois usuários submetem `youtube.com/whatever` no mesmo ms. O que acontece? E se eles submetem URLs DIFERENTES que coincidentemente geram a mesma `abc123`?',
      askWho: [
        {
          name: 'Marcos Vinicius',
          why: 'Hashmap na bagagem — força ele a raciocinar com a estrutura mental "set de keys ocupadas". Ótimo pra ouvir como ele descreve race.',
        },
        {
          name: 'Messias Olivindo',
          why: 'Backup com mesma base. Se Marcos travar, joga pra ele.',
        },
      ],
      followup: 'OK, decidida a estratégia. Onde isso mora? Postgres ou Redis?',
      gotcha:
        'Se ninguém pensar em race: "Redis e Postgres são single-threaded por shard?" Provoca eles a separarem concorrência lógica de concorrência física.',
    },
    {
      id: 'url-storage',
      label: 'Storage choice',
      group: 'url',
      beat: 4,
      oneLine:
        'Schema é trivial (key → url). Acesso pattern (point lookup) decide. KV vence relacional aqui.',
      pass1:
        'O schema é literalmente `(short_key, long_url, created_at, owner_id?)`. Não tem join, não tem range scan, não tem agregação no path crítico. É o caso canônico de key-value store. Postgres dá conta, mas você está pagando relational features que não usa.',
      pass2:
        'Pra 250GB e 20k QPS de leitura, qualquer KV serve. **DynamoDB**: PaaS, hash partition na short_key dá leitura O(1), single-digit ms; escala horizontal automática. **Cassandra**: open-source, mesma propriedade, melhor pra controle on-prem. **Redis**: in-memory, mas 250GB em RAM custa caro — Redis serve só pra cache aqui, não como source of truth. **Postgres**: funciona, mas você está usando 10% das features e pagando 100% do overhead de WAL/MVCC/joins. A resposta interview-pronta é: "KV (DynamoDB/Cassandra) pra primary store, Redis pra cache de hot keys, Postgres se já tem o operacional e o volume é baixo (<100M URLs)". O ponto sutil: tabela imutável ⇒ você pode usar storage barato (S3 + index) pra long tail; só os últimos N dias precisam estar em hot storage.',
      pass3: [
        {
          gotcha: 'Defender Postgres por "é o padrão"',
          note: 'Argumente o ACCESS PATTERN, não o conforto. Aqui é point lookup puro. Relacional não agrega valor.',
        },
        {
          gotcha: 'Esquecer que immutable habilita cold storage',
          note: 'URLs com 2 anos sem acesso podem ir pra S3. Hot path nunca precisa olhar pra elas.',
        },
        {
          gotcha: 'Não pensar no índice secundário',
          note: 'Se quiser "listar URLs do usuário X", precisa de index por owner_id. Em DynamoDB = GSI, custo separado.',
        },
      ],
      anchor:
        'Postgres ou Redis pra essa tabela? Justifica.',
      askWho: [
        {
          name: 'Lorena Garcia',
          why: 'Única com hashmap + databases — tem o vocab pra entender tanto "point lookup" quanto "schema relacional". Pergunta cai no exato cruzamento dos dois topics que ela viu.',
        },
        {
          name: 'Leunam Sousa',
          why: 'Tem db + cache. Backup forte.',
        },
      ],
      followup:
        'Beleza, KV de primary. E pra escala de leitura — vamos só na primary store?',
      gotcha:
        'Se alguém disser "Redis como source of truth": "250GB em RAM custa quanto/mês?"',
    },
    {
      id: 'url-cache',
      label: 'Caching the hot path',
      group: 'url',
      beat: 5,
      oneLine:
        '80/20: 20% das keys recebem 80% das leituras. Cache LRU resolve, mas a estratégia (write-around vs read-through) importa.',
      pass1:
        'Distribuição de acesso a URLs encurtadas segue lei de potência: poucos links viralizam, milhões nunca são clicados. O working set ativo é pequeno (~GB) mesmo com primary store em TB. Cache de leitura aqui é mandatory — não pra latência, pra reduzir hit no DB primary.',
      pass2:
        'Padrão é **read-through cache** com Redis ou Memcached: request chega → checa cache → miss → vai no DB → grava no cache → retorna. TTL longo (horas/dias) porque imutável. Eviction: LRU clássica funciona porque o pareto é estável. Question: **write-around ou write-through**? URLs criadas raramente recebem hit imediato — quem criou ainda vai compartilhar, leva minutos. Então **write-around** (escreve só no DB, deixa o cache popular naturalmente no primeiro read) é mais eficiente que write-through (que poluiria cache com keys cold). Edge caching: 301 permanente é cacheável em CDN — uma vez Cloudflare aprende `bit.ly/abc → youtube.com/x`, ele responde sem nunca chegar no seu server. Isso é a cereja: ~70% do traffic real do bit.ly nunca chega no origin. Failure mode: cache cai → DB precisa absorver 5× a carga normal. Solução: thundering herd protection (request coalescing) e graceful degradation.',
      pass3: [
        {
          gotcha: 'Write-through "by reflex"',
          note: 'Reflexo de quem só viu write-heavy systems. Aqui write é raro e read tem skew brutal — write-around vence.',
        },
        {
          gotcha: 'Esquecer thundering herd',
          note: 'Cache de uma URL viral expira → 50k requests batem no DB simultaneamente. Use single-flight ou lock por key.',
        },
        {
          gotcha: 'Cache local in-process vs cache distribuído',
          note: 'In-process (Caffeine, etc) tem custo zero de network mas duplica memória por server e tem invalidação difícil. Imutável aqui ajuda — você pode usar in-process puro.',
        },
        {
          gotcha: 'Cacheability do 301 em CDN',
          note: 'Maioria esquece esse "free win". 301 é cacheável; 302 não é (semântica de "temporary"). Use 301 se o link é permanente.',
        },
      ],
      anchor:
        '100M URLs, 80% das requests batem em 20% das chaves. Como cacheia? Read-through ou write-through? Quando invalida?',
      askWho: [
        {
          name: 'Eduardo Izawa',
          why: 'ÚNICO com cache + db + replication na bagagem. Esse é o beat dele — deixa ele puxar a discussão de eviction e working set. Se ele engatar, joga "thundering herd" como gotcha.',
        },
        {
          name: 'Leunam Sousa',
          why: 'Tem cache + db. Segunda voz pra contraste — talvez puxando write-through e Eduardo corrige.',
        },
      ],
      followup:
        '1 bilhão de URLs no total. Cabe num server? E se não cabe?',
      gotcha:
        'Se eles travarem em "que TTL?": "imutável tem TTL?" — força ver que TTL aqui é de eviction, não de staleness.',
    },
    {
      id: 'url-shard',
      label: 'Sharding by key hash',
      group: 'url',
      beat: 6,
      oneLine:
        'Partition por hash(short_key). Sem range queries, sem rebalanço difícil. URL Shortener é o caso fácil de sharding.',
      pass1:
        'Quando 1 instância não cabe (storage OU throughput), você shard. Pra URL Shortener é o caso mais fácil possível: lookup é sempre por short_key, então `shard_id = hash(short_key) % N` resolve. Sem cross-shard query, sem range, sem JOIN. É quase trivial — mas tem armadilhas de rebalanço.',
      pass2:
        'Hash partition simples (`mod N`) funciona, mas quando N muda (adicionar shard) você precisa relocar `(N-1)/N` das keys — quase tudo. Solução: **consistent hashing** (com virtual nodes) — adicionar shard remove só `1/N` das keys. Cada shard guarda um pedaço da tabela `short_key → long_url`. O router (proxy ou client-side) calcula `hash(short_key)` e roteia. Replicação: cada shard tem master + 2 replicas (read replicas pra absorver leitura, master pra write). Failover automático via Raft/Zookeeper. Hot shard? Em URL Shortener é raro porque `hash(key)` distribui uniformemente — uma URL viral só está em UM shard, mas o WORKING SET viral está distribuído. Cache aliviz o hot shard problem aqui. Pra contraste com Chat (beat 11): URL shard por `hash(key)` é stateless. Chat shard por `hash(conv_id)` é stateful — todas as conexões WS de um conv vão pro mesmo server (locality).',
      pass3: [
        {
          gotcha: 'Sharding por geographic region',
          note: 'Tentador, mas URL Shortener é global — alguém no Brasil clica em link criado nos EUA. Sharding por hash > geo.',
        },
        {
          gotcha: 'Não diferenciar hash partition de range partition',
          note: 'Range partition (a-f no shard 1, g-l no shard 2) seria útil pra "listar URLs do usuário" mas péssimo pra point lookup distribuído.',
        },
        {
          gotcha: 'Esquecer custom slugs',
          note: 'Se você permite slug customizado ("/davi/blog"), precisa checar unicidade GLOBAL — não é mais um hash partition limpo.',
        },
      ],
      anchor:
        '1 bilhão de rows, não cabe num server só. Como divide os dados em N servers? E quando adicionar o N+1?',
      askWho: [
        {
          name: 'Eduardo Izawa',
          why: 'ÚNICO com sharding na bagagem. Esse é o beat onde ele lidera. Você vai pingar `case-url-shortener` aqui pra ver se ele aprofunda.',
        },
      ],
      followup:
        'Beleza, URL Shortener fechado. Mesma arquitetura serve pro WhatsApp? O que muda?',
      gotcha:
        'Se Eduardo só falar "hash mod N": pergunta "e quando adiciona o servidor 11?" — força ele a vomitar consistent hashing.',
    },
    // ──────────────── PIVOT ────────────────
    {
      id: 'pivot',
      label: 'Pivot: read/write profile flip',
      group: 'pivot',
      beat: 7,
      oneLine:
        'URL é write-once, read-many, eventual consistency. Chat é write-many, real-time, fan-out. As primitivas são as mesmas — o que muda é o profile.',
      pass1:
        'Esse é o momento de respirar e fazer a transição explícita. URL Shortener fechou. WhatsApp/Slack/Discord. Mesmas caixinhas — DB, cache, shard, replica, load balancer — vão aparecer. Mas a resposta de CADA uma muda porque o profile inverte.',
      pass2:
        'Eixo por eixo. **Read/write ratio**: URL ~1:100, Chat ~1:5 a 1:50 dependendo de grupo. **Consistency**: URL eventual OK, Chat precisa de ordering forte (ler msg #5 antes da #4 é confuso). **Latency budget**: URL p99 <100ms (web request), Chat <500ms end-to-end (write→fan-out→delivery) com PRESENCE em <50ms. **Storage profile**: URL imutável, append-only fácil. Chat também é append-only mas com SCHEMA mutável (read receipts, edits, reactions). **Connection model**: URL é stateless HTTP, Chat é STATEFUL — conexão persistente (WebSocket) por usuário. Isso é o maior salto. **Sharding key**: URL por hash(key), Chat por hash(conv_id) — locality muda tudo. **Cache value**: URL cacheia conteúdo (a URL longa), Chat cacheia presença/recentes (read state mutável → cache invalidation problem). Conclusão pedagógica: a árvore de caixinhas é a mesma, o conteúdo de cada nó muda completamente.',
      pass3: [
        {
          gotcha: 'Tratar Chat como "outro CRUD"',
          note: 'Reflexo errado. A stateful long-lived connection é o que define toda a arquitetura.',
        },
        {
          gotcha: 'Achar que cache resolve Chat também',
          note: 'Resolve presence, não delivery. Delivery precisa de pubsub/queue.',
        },
        {
          gotcha: 'Misturar consistency models',
          note: 'URL: eventual. Chat: ordering por conv (causal consistency). Não é "strong" — é "ordered within partition".',
        },
      ],
      anchor:
        'Mesma arquitetura serve pro WhatsApp? Liste 3 coisas que mudam.',
      askWho: [
        {
          name: 'open',
          why: 'Beat de transição — pergunta aberta pro grupo, não pra alguém específico. Você guia até read/write ratio + statefulness + ordering. Se a sala travar, dê o primeiro: "read/write ratio inverte?"',
        },
      ],
      followup:
        'Statefulness é o salto maior. Por que HTTP polling não basta?',
      gotcha:
        'Se alguém disser "uso o mesmo DB": "qual o write QPS agora? E o storage cresce no mesmo ritmo?"',
    },
    // ──────────────── CHAT ARC ────────────────
    {
      id: 'chat-transport',
      label: 'Transport: WebSocket vs HTTP',
      group: 'chat',
      beat: 8,
      oneLine:
        'HTTP polling não escala. WebSocket é stateful long-lived. Long-polling é o meio-termo legado.',
      pass1:
        'Pro chat funcionar em tempo real, o server precisa empurrar mensagem pro cliente — não o contrário. HTTP request/response é pull. Você tem 3 opções práticas: short polling (péssimo), long polling (decente, legado), WebSocket (padrão moderno).',
      pass2:
        '**Short polling**: cliente bate no server a cada N segundos perguntando "tem msg nova?". Latência = N segundos, server gasta CPU/banda em request vazio. Inaceitável. **Long polling**: cliente abre HTTP request, server segura por até 30s aguardando msg, responde quando tem. Cliente reabre. Latência ~ms quando há msg, mas mantém ~1 conn HTTP por user — funciona até ~10k users por server. Legado mas usado em Slack até 2020. **WebSocket**: upgrade do HTTP pra conexão TCP bidirecional persistente. Server empurra qualquer hora. Latência ms, throughput alto, mas STATEFUL: cada server segura ~10-100k conexões (limite de file descriptors + memória ~10KB/conn). Custo: load balancer precisa de sticky sessions, deploy precisa de drain graceful, scaling horizontal é discreto (não pode "adicionar capacity" suave — uma nova conn vai pra novo server, conexões antigas continuam onde estavam). **SSE** (Server-Sent Events) é o "WebSocket só pra server→client" — útil se você só recebe, mas chat precisa bidirecional.',
      pass3: [
        {
          gotcha: 'Achar que load balancer round-robin funciona',
          note: 'Cada conn WS é stateful. Round-robin novo cliente OK, mas reconexão precisa voltar pro mesmo server pra retomar estado in-memory (cursor de fila, presence).',
        },
        {
          gotcha: 'Ignorar custo de file descriptors',
          note: '65k portas é o teto teórico por NIC. Na prática 10-100k conexões por box dependendo do kernel tuning (ulimit, sysctl).',
        },
        {
          gotcha: 'Não pensar em deploy/restart',
          note: 'Reiniciar um WS server derruba TODAS as conexões. Cliente precisa reconectar exponential backoff + reidratar estado.',
        },
        {
          gotcha: 'Confundir HTTP/2 push com WebSocket',
          note: 'HTTP/2 push é server hint de resource (CSS, JS). Não substitui WS pra payload arbitrário.',
        },
      ],
      anchor:
        'Por que HTTP polling não basta? E quanto custa manter 1 milhão de conexões WebSocket abertas?',
      askWho: [
        {
          name: 'Maria Clara',
          why: 'Tem networking — gancho perfeito porque o próximo beat (fan-out) é pubsub, onde ela é única. Quer ela "presente" desde aqui.',
        },
        {
          name: 'Eduardo Izawa',
          why: 'Também tem networking. Backup se Maria Clara travar — ele pode puxar o custo de FD/RAM.',
        },
      ],
      followup:
        'OK, conexão aberta. Você manda msg num grupo de 50. Como as 50 recebem?',
      gotcha:
        'Se alguém disser "manda HTTP request pra cada um": "1M users online, 100 mil grupos, fan-out médio 20 — quantas requests por segundo isso vira?"',
    },
    {
      id: 'chat-fanout',
      label: 'Fan-out & PubSub',
      group: 'chat',
      beat: 9,
      oneLine:
        'Mensagem em grupo de 50 → 50 destinos. Push-based via pubsub é padrão; pull-based escala melhor pra megagrupos.',
      pass1:
        'Você escreveu uma mensagem. Agora N destinatários precisam receber. Esse é o problema central do chat. Duas famílias: **push** (server distribui ativamente) e **pull** (destinatário consulta sua inbox). Cada uma tem zona ótima.',
      pass2:
        '**Push-based fan-out (write-time)**: ao escrever, o server publica pra todas as conexões dos N destinatários. Implementação: Redis PubSub ou Kafka como bus interno entre WS servers. Server A recebe msg, publica em `topic:conv:{conv_id}`. Todos os WS servers subscritos no topic recebem. Cada um filtra "qual dos meus users conectados está nesse conv?" e empurra pela conn. Latência baixíssima (~10ms). Escala bem pra grupos pequenos-médios (<1k). Problema com megagrupos (Discord, broadcast channels): 100k membros = 100k pushes por msg. Inviável. **Pull-based fan-out (read-time)**: ao escrever, msg vai pra fila persistente única do conv. Clientes pollam ou se conectam à fila. Server distribui sob demanda. Latência maior, mas custo proporcional aos ATIVOS, não aos membros. Discord usa híbrido: <100 membros push, >100 pull. WhatsApp grupos topo de 256 membros (decisão deliberada de produto pra evitar o megagroup problem). **Message queue** entre WS gateway e storage: gateway recebe msg, publica em Kafka, storage consumer escreve em Cassandra, fan-out consumer publica no PubSub. Desacopla escrita de entrega — se o storage está lento, msg continua sendo entregue.',
      pass3: [
        {
          gotcha: 'Push pra todos sempre',
          note: 'Linear no fan-out — explode em megagrupo. Pull/inbox model é melhor pra >1k membros.',
        },
        {
          gotcha: 'Esquecer offline users',
          note: 'Push só funciona se o cara está online. Offline = msg vai pra storage e cliente puxa ao reconectar (resync por cursor).',
        },
        {
          gotcha: 'Tratar PubSub e Message Queue como sinônimos',
          note: 'PubSub (Redis): broadcast efêmero, perde se sub não estava na hora. Queue (Kafka): durável, ordenado, consumível depois. Chat geralmente precisa dos DOIS — queue pra persistência, pubsub pra delivery rápido.',
        },
        {
          gotcha: 'Não pensar em deduplicação',
          note: 'Cliente recebe via push + também via pull no resync. Pode duplicar. Resolve com `message_id` idempotente.',
        },
      ],
      anchor:
        'Você manda mensagem num grupo de 50 pessoas. Como exatamente as 50 recebem em menos de 1s?',
      askWho: [
        {
          name: 'Maria Clara',
          why: 'ÚNICA com pubsub na bagagem. Esse é O beat dela. Deixa ela puxar. Se ela for fundo, joga o gotcha de megagrupo. Se travar, pingue: "Redis PubSub serve?"',
        },
      ],
      followup:
        'Se a mensagem viajou via pubsub, ela está persistida? Onde?',
      gotcha:
        'Se Maria Clara matar push rápido: "OK, e grupo de 100 mil membros — Discord?" Força ela a chegar em pull/inbox.',
    },
    {
      id: 'chat-ordering',
      label: 'Ordering & persistence',
      group: 'chat',
      beat: 10,
      oneLine:
        'Mensagens precisam chegar EM ORDEM no mesmo conv. ID monotônico por shard (Snowflake) + escrita append-only ordenada.',
      pass1:
        'Chat tem semântica de SEQUÊNCIA: msg #5 vem depois da #4. Se chegar fora de ordem, a UI fica confusa ("respondeu antes da pergunta"). Mas precisamos disso só DENTRO de um conv — entre convs distintos, ordering não importa. Esse "ordering por partição" é o que ditá o resto.',
      pass2:
        'Mecanismo: cada msg ganha um ID monotônico **por conv** (não global). Padrão Snowflake — 64-bit: timestamp(41) + machine(10) + sequence(12). Garante ordering temporal + unicidade sem coordenação global. Cliente envia, gateway atribui ID, write goes em `messages` table particionada por `conv_id`, ordenada por `message_id`. Cassandra usa esse exato pattern: partition key = conv_id, clustering key = message_id DESC (queries "últimas 50" são leitura sequencial direto). Causal consistency dentro do conv: msg A precede msg B sse A.id < B.id. Replicação: master por shard ordena writes; replicas seguem. Read-after-write próprio: leio do master que escreveu. Reads históricos: replicas servem. **Edge case**: dois usuários escrevem simultaneamente no mesmo conv. Snowflake resolve por timestamp + sequence — quem chegou ao gateway primeiro vence (mas a diferença é ms). UI mostra ambas com timestamps próximos, ordem fixa.',
      pass3: [
        {
          gotcha: 'Achar que precisa ordering GLOBAL',
          note: 'Não precisa. Mensagens entre o conv #1 e o conv #2 não têm relação. Ordering por conv basta — desbloqueia particionamento massivo.',
        },
        {
          gotcha: 'Usar UUID v4 como message_id',
          note: 'UUID v4 é random, não ordenado. Você perde "leia as últimas 50" como range scan. UUID v7 (timestamp-prefixed) OU Snowflake.',
        },
        {
          gotcha: 'Relógio do servidor desincronizado',
          note: 'NTP drift entre máquinas pode dar IDs out-of-order entre shards. Por isso ordering é dentro do PARTITION (conv), não global.',
        },
        {
          gotcha: 'Read-after-write em replica',
          note: 'Usuário envia, lê imediato — replica não recebeu ainda. Solução: master read pra próprio user dentro de window curto, OU bookmark/cursor no cliente que ele já viu até #N.',
        },
      ],
      anchor:
        'Mensagens chegam fora de ordem no cliente. Cliente vai aceitar isso?',
      askWho: [
        {
          name: 'Eduardo Izawa',
          why: 'Tem replication na bagagem — consistency model é o frame mental dele. Ordering = causal consistency dentro da partição.',
        },
      ],
      followup:
        'Se Snowflake gera o ID, como isso afeta o sharding?',
      gotcha:
        'Se alguém disser "uso timestamp Unix em ms": "dois writes no mesmo ms?"',
    },
    {
      id: 'chat-shard',
      label: 'Sharding by conversation',
      group: 'chat',
      beat: 11,
      oneLine:
        'URL shard por hash(key), stateless. Chat shard por hash(conv_id), STATEFUL — todas as conn WS de um conv vão pro mesmo server (locality).',
      pass1:
        'Volta do beat 6: contraste explícito. URL Shortener shardou por `hash(short_key)` — qualquer server serve qualquer request. Chat precisa de algo diferente porque conexões e mensagens do MESMO conv têm que conversar entre si. Sharding key vira `conv_id`.',
      pass2:
        'Por que `conv_id`? Porque a operação dominante (mandar msg num conv) afeta N usuários do MESMO conv. Se você sharda por user_id, uma msg em grupo de 50 vai precisar tocar 50 shards. Sharda por conv_id, a msg vive num shard só — fan-out é local. Conexões WS do mesmo conv DEVEM ir pro mesmo server (ou conjunto de servers replicados). Isso é o que chama **session affinity / locality**. Implementação: gateway calcula `target_server = hash(conv_id) % N`, roteia WS handshake. Quando user entra em conv novo, pode precisar abrir 2ª conn (ou multiplexar). **Trade-off**: hot conv (canal Discord viral, 1M membros ativos) sobrecarrega 1 server. Solução: split partition (sub-shard por message_id ranges) ou replicar o conv hot em vários servers com pubsub interno. **Cross-shard query**: "listar todos os convs do user X" é cross-shard porque user.convs[] é polyglot. Solução: índice secundário separado (Cassandra GSI ou tabela inversa user→convs em outro shard). Esse é o custo de shardar por conv: a query "lista de convs do user" deixa de ser point lookup. Aceita-se porque ela é rara comparada com "manda msg no conv".',
      pass3: [
        {
          gotcha: 'Shardar por user_id "porque é mais intuitivo"',
          note: 'Reflexo errado. Mensagem é da CONVERSA, não do usuário. Shardar por user é fazer fan-out cross-shard sempre.',
        },
        {
          gotcha: 'Esquecer hot partition',
          note: 'Canal Twitch global, broadcast Discord. Uma conv = um shard = pode lotar. Detecção + split é mandatório em produção.',
        },
        {
          gotcha: 'Não desenhar a query "convs do user X"',
          note: 'Se você sharda por conv, essa query precisa de índice inverso. Falar disso mostra que você antecipa, não só desenha o happy path.',
        },
        {
          gotcha: 'Confundir locality de WS com locality de storage',
          note: 'WS server e storage shard podem ser FORÇAS separadas. Você pode ter WS round-robin + storage shard por conv, comunicando via pubsub. Trade off latência vs simplicidade.',
        },
      ],
      anchor:
        'URL Shortener shard por hash(short_key). Chat shard por...? E qual a consequência prática?',
      askWho: [
        {
          name: 'Eduardo Izawa',
          why: 'Único com sharding — fecha o arco. Aqui ele puxa contraste explícito com beat 6. Se ele só repetir "hash mod N": pergunta "e o que muda em termos de routing das conexões?"',
        },
      ],
      followup:
        'Listar todos os convs do usuário X. Onde isso mora?',
      gotcha:
        'Se ele disser "shardo por user_id": "user num grupo de 50, fan-out toca quantos shards?"',
    },
    // ──────────────── SYNTHESIS ────────────────
    {
      id: 'synthesis',
      label: 'Synthesis: same primitives, opposite profiles',
      group: 'synthesis',
      oneLine:
        'A árvore de caixinhas é a mesma. O conteúdo de cada nó muda porque o profile de carga inverte.',
      pass1:
        'Última parada. URL e Chat compartilham 100% da lista de primitivas: DB, cache, shard, replica, load balancer, fan-out (presence em URL é fan-out trivial), ordering. Mas cada uma delas recebe resposta diferente porque READ/WRITE PROFILE muda. Interview takeaway: "qual é a primitiva?" é a pergunta menos importante. "Qual o profile do load?" é a que separa um candidate de outro.',
      pass2:
        'Quadro comparativo final pra fechar:\n\n• Profile — URL: 1:100 read-heavy, immutable, eventual OK. Chat: 1:5 a 1:50, append-only mas mutável (read receipts), causal por conv.\n• Transport — URL: HTTP stateless. Chat: WS stateful long-lived.\n• Storage — URL: KV point lookup. Chat: append-only wide-column by conv_id.\n• Cache — URL: read-through, write-around, cacheia o conteúdo. Chat: cacheia presence + recent msgs do conv ativo.\n• Sharding — URL: hash(key), stateless. Chat: hash(conv_id), stateful, locality routing.\n• Fan-out — URL: trivial (cliente é um). Chat: pubsub para grupos pequenos, pull/inbox para megagrupos.\n• Ordering — URL: irrelevante. Chat: causal dentro do conv via Snowflake.\n• Consistency — URL: eventual. Chat: read-after-write próprio, causal por conv.\n\nO valor da aula é esse pareamento. Em entrevista, o candidato que reconhece "isso é parecido com X mas com profile invertido" liga primitivas — e ligar primitivas é o que distingue um senior. Estudar 1 case isolado ensina vocabulário. Comparar 2 cases ensina mapeamento.',
      pass3: [
        {
          gotcha: 'Aceitar "uso a mesma arquitetura" como resposta',
          note: 'Sempre force "o que MUDA em cada caixa". A primitiva é a mesma, a configuração e o trade-off mudam.',
        },
        {
          gotcha: 'Sair sem nome de produto na cabeça',
          note: 'URL = Bit.ly/TinyURL. Chat = WhatsApp/Slack/Discord. Em entrevista, ancorar em produto real ajuda raciocínio.',
        },
      ],
      anchor:
        'Liste 3 coisas que mudaram do URL pro Chat. E qual primitiva apareceu nos dois com a MESMA resposta?',
      askWho: [
        {
          name: 'open',
          why: 'Fechamento — grupo aberto. Quem responder primeiro mostra que pegou. Bom indicador de quem ficou e quem ficou pra trás.',
        },
      ],
      followup:
        'Próxima aula: News Feed (Facebook/Twitter). Antes de entrar nela, qual case desses dois ela vai parecer mais? Por quê?',
      gotcha:
        'Se ninguém citar "cache resolve URL mas não resolve chat": dê. É o insight central. Pergunte "por quê?" pra ver quem internalizou.',
    },
  ],
};

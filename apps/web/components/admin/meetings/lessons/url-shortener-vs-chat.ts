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
        'Antes de desenhar qualquer caixinha, você precisa entender o problema. Pra um encurtador, três respostas vão guiar todo o resto: quem usa e quanto, se a URL pode mudar depois de criada, e qual é a proporção entre leituras e escritas. Tudo o que vem depois — banco, cache, sharding — depende dessas respostas.',
      pass2:
        'O que perguntar, em ordem de prioridade.\n\n**Volume e proporção**: quantas URLs criadas por dia? Quantas leituras por URL? URL Shortener tem ratio típico de 1:100 — pra cada URL criada, ela é clicada 100 vezes. Esse número é o que separa "preciso de cache" de "uma instância dá conta".\n\n**Imutabilidade**: a URL longa pode ser alterada depois de criada? Pode ser deletada? A resposta na maioria dos casos é "não" — e isso é libertador, porque permite estratégias de armazenamento e replicação muito mais simples mais à frente.\n\n**Consistência aceitável**: se o usuário criar um link e ver "404" por 200ms enquanto a réplica recebe a escrita, isso é tolerável? Quase sempre sim. Confirmar isso aqui evita debate desnecessário sobre transações ACID lá na frente.\n\n**Escopo**: o que NÃO vamos resolver? Analytics? Custom slugs? Expiração? Anti-abuse? Liste o que ficou de fora pra não inflar o problema sozinho. Em entrevista, o entrevistador escolhe o que aprofundar — você não precisa antecipar tudo.',
      pass3: [
        {
          gotcha: 'Pular direto pra implementação',
          note: 'Começar desenhando "Load Balancer → API → DB" antes de perguntar nada é o erro mais comum. O entrevistador quer ver você FRAMING o problema antes de resolver. Pergunte primeiro.',
        },
        {
          gotcha: 'Trazer features que não foram pedidas',
          note: 'Analytics, A/B test de slugs, expiração de link, anti-abuse — tudo opcional. Liste e pergunte "isso está no escopo?". Não invente requisitos.',
        },
        {
          gotcha: 'Esquecer de perguntar volume',
          note: 'Sem volume, você não pode dimensionar nada depois. "Quantas URLs criadas por mês?" e "quantas leituras por URL?" são as duas perguntas que mais destravam.',
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
      scenarios: {
        right: {
          shape:
            'Lista perguntas concretas antes de qualquer solução: quantos usuários, quantas URLs criadas vs lidas, se URL pode ser editada depois, qual latência é aceitável. Reconhece que essas respostas vão definir o resto — não tenta resolver ainda.',
          redirect:
            'Confirme as premissas com a turma (1:100 reads, imutável, eventual OK) e avance pra próxima pergunta: "agora que sabemos o problema, como o sistema gera o `abc123`?"',
        },
        close: {
          shape:
            'Faz algumas perguntas de requisito (volume, latência) mas esquece de perguntar a coisa mais importante: a proporção entre leituras e escritas.',
          redirect:
            'Devolva: "dos requisitos que você listou, qual a pergunta que muda mais a arquitetura?" Guie até read/write ratio.',
        },
        wayOff: {
          shape:
            'Já começa desenhando caixinhas no quadro ("Load Balancer, API Gateway, Database...") sem perguntar nada sobre o uso do sistema.',
          redirect:
            'Interrompa: "espera — antes de desenhar nada, que perguntas você precisaria responder pra saber se essa arquitetura faz sentido?" Force voltar pra requisitos.',
        },
      },
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
      scenarios: {
        right: {
          shape:
            'Explica counter → base62 (sem +/=, URL-safe), 7 chars dá 3.5T keys, mostra a divisão sucessiva por 62. Cita Snowflake ou Ticket Server pra distribuir o counter sem bottleneck.',
          redirect:
            'Avance: "se duas pessoas submetem URLs DIFERENTES e bate o mesmo hash, ou submetem a MESMA URL ao mesmo tempo — o que acontece?"',
        },
        close: {
          shape:
            'Sabe base62 e justifica vs base64, mas defende hash truncado da URL sem mencionar que truncar gera colisão. OU usa counter mas global single-instance.',
          redirect:
            'Pergunte: "1 bilhão de URLs geradas, hash de 7 chars em base62. Qual a probabilidade de duas URLs darem a mesma key?" Força ver birthday paradox.',
        },
        wayOff: {
          shape:
            'Propõe UUID v4 ("é único, problema resolvido"). Não considera tamanho do link nem legibilidade.',
          redirect:
            'Mostre a comparação visual: "bit.ly/abc123 vs bit.ly/3f4a7c2b-1d0e-4f8a-9b3c-7e1d2a8f5c4b. Qual cabe num tweet?" Não derrube a ideia — força perceber o tradeoff.',
        },
      },
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
      scenarios: {
        right: {
          shape:
            'Separa colisão de hash (URLs diferentes, mesma key) de race condition (mesma URL, dois writes). Propõe UNIQUE constraint do DB ou Redis SETNX + retry com salt. Menciona retry budget.',
          redirect:
            'Avance: "OK, estratégia decidida. Onde isso mora — Postgres, Redis, ou Cassandra?"',
        },
        close: {
          shape:
            'Fala de UNIQUE constraint mas confunde os dois problemas — trata race de dedup como se fosse o mesmo que hash colision. OU resolve um e esquece o outro.',
          redirect:
            'Force a separar: "duas URLs DIFERENTES dando a mesma key — UNIQUE resolve? E a MESMA URL submetida duas vezes — UNIQUE resolve igual?"',
        },
        wayOff: {
          shape:
            'Diz "uso um Set em memória pra checar se a key já existe".',
          redirect:
            'Lembre o contexto: "tem 10 servers atendendo. Set local de cada server não conversa com o do outro. O que acontece?"',
        },
      },
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
      scenarios: {
        right: {
          shape:
            'Argumenta access pattern: point lookup + immutability ⇒ KV (DynamoDB/Cassandra). Postgres só se volume baixo. Redis pra cache, S3 pra cold storage de URLs antigas. Justifica pelo padrão de uso, não por familiaridade.',
          redirect:
            'Avance: "agora 1B URLs no total, working set quente são uns 20% — como cacheia?"',
        },
        close: {
          shape:
            'Vai de Postgres por reflexo ("é o que eu conheço"). Reconhece que KV poderia ser opção mas não defende com argumento técnico.',
          redirect:
            'Pergunte: "que feature do Postgres você está USANDO aqui? JOIN? Range scan? Transação multi-row?" Força ver que paga overhead por features não usadas.',
        },
        wayOff: {
          shape:
            'Propõe Redis como source of truth ("é rápido"). Não considera custo de RAM nem durabilidade.',
          redirect:
            'Compare numericamente: "250GB em RAM no AWS ElastiCache custa ~$3000/mês. Em SSD no S3 custa ~$6/mês. Vale a diferença pra um sistema que aceita 10ms de latência?"',
        },
      },
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
      scenarios: {
        right: {
          shape:
            'Read-through Redis, write-around (writes raros, não vale poluir cache). LRU clássica. Menciona thundering herd e protege com single-flight. Cita CDN cacheando o 301 como "free win".',
          redirect:
            'Avance: "OK, cache resolve. Mas 1B URLs ainda não cabem num server só. Como divide?"',
        },
        close: {
          shape:
            'Sabe cache mas diz "read-through E write-through". Esquece que write-rare + read-heavy favorece write-around.',
          redirect:
            'Pergunte: "se você popular o cache no write, e 90% das URLs nunca recebem hit, o que aconteceu com a sua RAM?"',
        },
        wayOff: {
          shape:
            'Diz que cache não é necessário porque "o DB já é rápido".',
          redirect:
            'Aterre nos números: "20k QPS no pico, p99 < 100ms exigido, working set de ~10GB. DB sozinho aguentando isso custa quanto? E sobrevive um pico 5×?"',
        },
      },
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
        'Hash partition simples (`mod N`) funciona, mas quando N muda (adicionar shard) você precisa relocar `(N-1)/N` das keys — quase tudo. A solução é **consistent hashing** (com virtual nodes): adicionar shard remove só `1/N` das keys. Cada shard guarda um pedaço da tabela `short_key → long_url`. O router (proxy ou client-side) calcula `hash(short_key)` e roteia.\n\nReplicação: cada shard tem master + 2 réplicas. As réplicas absorvem leitura, o master recebe write. Failover automático via Raft/Zookeeper.\n\nHot shard? Em URL Shortener é raro. `hash(key)` distribui uniformemente — uma URL viral está em UM shard só, mas o working set viral fica espalhado por muitas keys diferentes. O cache da etapa anterior também ajuda — o hot path quase não chega ao DB.',
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
      scenarios: {
        right: {
          shape:
            'Hash partition por short_key. Reconhece que `hash mod N` quebra ao adicionar shard e propõe consistent hashing com virtual nodes. Diferencia hash partition de range partition.',
          redirect:
            'Avance pro pivot: "URL Shortener fechado. Mesma arquitetura serve pro WhatsApp? Lista 3 coisas que mudam."',
        },
        close: {
          shape:
            'Hash mod N sem mencionar problema de rebalanço. Sabe shardear mas não pensou em adicionar capacidade depois.',
          redirect:
            '"Adicionei o shard #11. Quantas keys vão precisar se mover entre shards?" Força chegar em consistent hashing.',
        },
        wayOff: {
          shape:
            'Sharda por geographic region "pra latência". Ou shardar por intervalo alfabético (a-f no shard 1, g-l no shard 2).',
          redirect:
            'Devolva: "URL Shortener é global. Um brasileiro clica em link criado por um americano. Em que shard a key está?" Força ver que geo não casa com o access pattern.',
        },
      },
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
      scenarios: {
        right: {
          shape:
            'Lista 3+ diferenças concretas: read/write ratio inverte, statefulness do WebSocket, ordering causal por conv. Reconhece que primitivas são as mesmas (DB, cache, shard) mas a config muda.',
          redirect:
            'Avance pra transport: "statefulness é o salto maior. Por que HTTP polling não basta?"',
        },
        close: {
          shape:
            'Diz "preciso de WebSocket" mas trata o resto como se fosse igual. Não menciona ordering nem o fato do storage crescer em outra ordem de magnitude.',
          redirect:
            'Pegue uma dimensão por vez: "storage cresce no mesmo ritmo? Read/write ratio é parecido? Cache resolve a mesma coisa?"',
        },
        wayOff: {
          shape:
            'Diz que é a mesma arquitetura, só muda o schema do banco. Não percebe a mudança de profile.',
          redirect:
            'Aterre com um cenário: "msg num grupo de 50 pessoas, todas online — como as 50 recebem em <1s?" Quando ele tentar HTTP request por destinatário, conte o QPS.',
        },
      },
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
      scenarios: {
        right: {
          shape:
            'WebSocket pra bidirecional, sticky sessions no load balancer, custo de ~10-100k conexões por server por causa de FD + RAM. Menciona deploy graceful (drain) e reconnect exponencial. Sabe que SSE seria opção pra unidirecional.',
          redirect:
            'Avance pro fan-out: "OK, 1M conexões abertas, distribuídas em N servers. Você manda numa conversa de 50 — como as 50 recebem?"',
        },
        close: {
          shape:
            'Sabe WebSocket bidirecional e que é "stateful", mas não articula o CUSTO concreto: file descriptors, RAM por conn, problema de deploy.',
          redirect:
            'Aterre num número: "quantas conexões cabem num server de 16GB de RAM? Por quê?" Força ver os limites operacionais.',
        },
        wayOff: {
          shape:
            'Defende que long polling resolve tudo. Ou propõe HTTP/2 push como se substituísse WebSocket.',
          redirect:
            'Para long polling: "30 segundos de latência entre mensagens é OK pra chat?" Pra HTTP/2 push: "ele empurra do server pro cliente um stream de mensagens arbitrárias, ou só resource hints?"',
        },
      },
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
      scenarios: {
        right: {
          shape:
            'Push via PubSub (Redis ou Kafka) com tópico por conv para grupos pequenos-médios. Reconhece o problema de megagrupo e propõe pull/inbox. Diferencia PubSub (efêmero) de Message Queue (durável) — sabe que precisa dos dois.',
          redirect:
            'Avance: "OK, msg saiu via pubsub. Ela está PERSISTIDA? Onde, em que ordem, e o que acontece se um user reconectar amanhã?"',
        },
        close: {
          shape:
            'Push pra todos os destinatários online sempre. Não menciona o problema do megagrupo nem distingue PubSub de Message Queue.',
          redirect:
            'Aterre no megagrupo: "canal do Discord com 100 mil membros. Cada mensagem dispara 100 mil pushes — quantas msgs por segundo isso tem que aguentar no pico?"',
        },
        wayOff: {
          shape:
            'Manda HTTP request do server pra cada destinatário individual. Ou propõe que cada cliente faça poll de um endpoint próprio.',
          redirect:
            'Faça a conta junto: "1M usuários online, fan-out médio 20, 100 msgs/s no agregado. Quantas requests HTTP isso vira? Compare com um único publish no PubSub."',
        },
      },
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
      scenarios: {
        right: {
          shape:
            'Snowflake ID (timestamp+machine+sequence) ordenado POR conv, não global. Partition key = conv_id, clustering key = message_id DESC pra Cassandra. Causal consistency dentro da partição. Menciona read-after-write próprio (cursor cliente).',
          redirect:
            'Avance pro sharding: "se o ID é gerado por conv, qual a sharding key natural?"',
        },
        close: {
          shape:
            'Usa timestamp Unix em ms ou UUID v7 como message_id. Sabe que precisa ordenar mas não pensa em coliscão de timestamp ou na vantagem do Snowflake sequence.',
          redirect:
            '"Dois writes chegam no mesmo ms no gateway. Quem fica em primeiro lugar? Qual usuário vê A → B e qual vê B → A?"',
        },
        wayOff: {
          shape:
            'Defende strong consistency global pra todas as mensagens. Ou usa UUID v4 (random) sem perceber que perde range scan.',
          redirect:
            'Para strong global: "ordering entre o seu conv com seu pai e o conv de outro user com a esposa dele — isso importa pra UI?" Pra UUID v4: "como você busca \'últimas 50 mensagens\' nesse modelo?"',
        },
      },
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
      scenarios: {
        right: {
          shape:
            'Hash(conv_id) com locality — todas as conexões WS de um conv vão pro mesmo server. Contrasta explicitamente com URL (hash(short_key), stateless). Antecipa que "listar convs do user" precisa de índice inverso e aceita o custo. Menciona hot partition + estratégia (split / replicar).',
          redirect:
            'Avance pro fechamento: "URL e Chat usam as mesmas primitivas (cache, shard, replica, fan-out). Liste 3 coisas que CADA uma respondeu de maneira diferente."',
        },
        close: {
          shape:
            'Sharda por conv_id mas não percebe que "todos os convs do user X" deixa de ser point lookup. Ou não fala de hot partition.',
          redirect:
            '"Cliente abre o app — você precisa carregar a lista de convs dele. Como você acha esses convs se eles estão espalhados por shards diferentes?"',
        },
        wayOff: {
          shape:
            'Sharda por user_id "porque o cliente faz request com user_id". Não pensa em onde a mensagem vive.',
          redirect:
            '"Grupo com 50 pessoas. User A manda mensagem. A mensagem precisa ir pra storage — em QUAL shard? E os outros 49 — precisam consultar quantos shards pra LER essa mensagem?"',
        },
      },
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

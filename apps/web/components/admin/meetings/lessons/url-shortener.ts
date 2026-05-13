import type { Lesson } from '../lesson-types';

export const urlShortener: Lesson = {
  slug: 'url-shortener',
  title: 'URL Shortener',
  subtitle: 'Read-heavy, immutable, point lookup — o caso canônico.',
  blurb:
    'O case clássico de system design pra entender o perfil read-heavy. A gente percorre 8 beats que cobrem o vocabulário central — geração de short key em base62, escolha de KV store, cache write-around, consistent hashing, diagrama completo da arquitetura, e o mapping pra managed services da AWS — usando o profile de carga como bússola pra cada decisão. A regra que sai daqui: read/write ratio, mutabilidade e consistency aceitável ditam 80% da arquitetura antes de qualquer caixa ser desenhada.',
  durationMin: 80,
  audience: 'Hot Stuff · Big Tech · semana 3',
  nodes: [
    // ──────────────── FOUNDATIONS ────────────────
    {
      id: 'f-scalability',
      label: 'Capacity estimation',
      group: 'foundations',
      teachFromZero: true,
      oneLine:
        'Antes de qualquer caixa no quadro, você estima QPS, storage e read/write ratio — esse cálculo filtra todo o resto do design.',
      pass1:
        'Toda entrevista de system design começa com o entrevistador pedindo pra você estimar volume. Não é uma curiosidade — é o filtro que separa "preciso de cache" de "uma instância dá conta", "preciso shardar" de "cabe num server só", "Postgres" de "Cassandra". Você não chuta. Você assume usuários ativos, multiplica por ações por dia, divide pelos segundos do dia, e tem o write QPS. Storage é QPS multiplicado pelo tamanho médio do registro multiplicado pelo tempo de retenção.',
      pass2:
        'O cálculo padrão é DAU × ações_por_usuário ÷ 86400 = QPS médio. O pico costuma ser de 3 a 5 vezes a média, e sistemas falham no pico, não na média. Sempre dimensione pra ele.\n\nPra um encurtador de URL típico: 100 milhões de URLs criadas por mês resultam em cerca de 40 writes por segundo na média e 200 no pico. As leituras costumam ser 100 vezes maior que as escritas (1:100 é a heurística pra link shortener), então estamos falando de 4 mil reads por segundo na média e 20 mil no pico. O storage cresce na ordem de 100 milhões × 500 bytes × 5 anos, ou seja, 250 GB no total — isso cabe num servidor só, então não precisamos shardar por capacidade, só eventualmente por throughput.\n\nA mesma conta serve pra qualquer outro sistema — o que muda é o ratio. Sistemas com perfil write-heavy (chat, feed) têm storage crescendo na ordem de TB por mês e write QPS muito maior, então shard se torna obrigatório desde o início. Sistemas read-heavy como o nosso podem sobreviver com uma instância só e cache na frente por muito mais tempo.\n\nO ponto pedagógico é que write QPS, read QPS, storage e ratio não são quatro perguntas separadas. Juntas, elas te dizem qual primitiva você precisa.',
      pass3: [
        {
          gotcha: 'Esquecer que o pico não é a média',
          note: 'Sistemas falham no pico. Sempre multiplique a média por 3 a 5. Pense em Black Friday, em horário nobre, em um post viral.',
        },
        {
          gotcha: 'Confundir storage total com working set',
          note: 'A pergunta não é "quanto cabe", é "quanto fica acessível em RAM". 250 GB cabe em SSD tranquilo, mas o working set quente pode ser só 10 GB — esse é o tamanho real do cache.',
        },
        {
          gotcha: 'Tratar leitura e escrita com o mesmo critério',
          note: 'Em URL Shortener o ratio é 1:100, então cache de leitura resolve a maior parte dos hits. Sistemas com ratio próximo de 1:1 precisam de outra estratégia — cache não resolve quando cada item escrito é lido só uma vez.',
        },
      ],
      anchor:
        'Antes de qualquer caixa, você tem quantos usuários, quantas requests por segundo, e quanto de storage por ano?',
      askWho: [
        {
          name: 'open',
          why: 'Pergunta de aquecimento. Qualquer pessoa pode jogar números. Use pra todos fazerem essa conta uma vez antes da aula descer.',
        },
      ],
      followup: 'Desses números, qual a ordem de magnitude do read/write ratio?',
      gotcha:
        'Se alguém disser "pico igual a média", devolva: "e o Twitter quando o Elon posta?"',
      scenarios: {
        right: {
          shape:
            'Lista DAU estimado, ações por dia, faz a divisão pra chegar em QPS, multiplica pelo fator de pico, calcula storage com tempo de retenção. Reconhece que read/write ratio é uma quinta dimensão que muda tudo.',
          redirect:
            'Confirme os números e avance pro requisito: "ótimo, agora pra esse perfil específico — o que perguntar antes de começar a desenhar?"',
        },
        close: {
          shape:
            'Faz a conta de QPS mas esquece o fator de pico, ou estima storage sem considerar o tempo de retenção. Sabe que o cálculo importa mas omite uma das dimensões.',
          redirect:
            'Aponte a dimensão que faltou: "esse número que você calculou é a média ou o pico? Quanto tempo o sistema retém os dados?"',
        },
        wayOff: {
          shape:
            'Pula a estimativa inteira e parte pra "vou usar Postgres com Redis na frente" sem números.',
          redirect:
            'Interrompa antes de prosseguir: "espera, antes de escolher tecnologia — quanto é 1 milhão de usuários, em QPS?" Force a fazer a conta no quadro.',
        },
      },
    },
    // ──────────────── URL ARC ────────────────
    {
      id: 'url-requirements',
      label: 'Requirements & profile',
      group: 'url',
      beat: 1,
      oneLine:
        'Antes de qualquer linha de código, três perguntas definem 80% da arquitetura: volume, mutabilidade e read/write ratio.',
      pass1:
        'Antes de pensar em banco, cache ou load balancer, você precisa entender o que o sistema vai fazer e como vai ser usado. Pra um encurtador de URL, três respostas guiam todo o resto: quem usa e quanto, se a URL pode mudar depois de criada, e qual é a proporção entre leituras e escritas. Tudo o que vem depois depende dessas respostas, então faz sentido investir tempo aqui antes de desenhar qualquer caixa.',
      pass2:
        'O que perguntar, em ordem de prioridade.\n\n**Volume e proporção entre leitura e escrita**: quantas URLs criadas por dia, e quantas vezes cada URL é clicada? Um encurtador de URL típico tem proporção de 1:100 — pra cada URL criada, ela é clicada cerca de 100 vezes. Esse número é o que separa "preciso de cache na frente" de "uma instância dá conta".\n\n**Mutabilidade**: a URL longa pode ser alterada depois de criada? Pode ser deletada? Na maioria dos casos a resposta é não, e isso é libertador, porque permite estratégias de armazenamento e replicação muito mais simples adiante. Imutabilidade é a melhor amiga da simplicidade.\n\n**Consistência aceitável**: se o usuário criar um link e ver um 404 por 200ms enquanto a réplica recebe a escrita, isso é tolerável? Quase sempre sim. Confirmar isso aqui evita um debate desnecessário sobre transações ACID lá adiante.\n\n**Escopo**: o que NÃO vamos resolver? Analytics? Custom slugs? Expiração? Anti-abuse? Liste explicitamente o que ficou de fora pra não inflar o problema sozinho. Em entrevista, o entrevistador é que escolhe o que aprofundar — você não precisa antecipar tudo.',
      pass3: [
        {
          gotcha: 'Pular direto pra implementação',
          note: 'Começar desenhando "Load Balancer → API → DB" antes de perguntar nada é o erro mais comum. O entrevistador quer ver você framing o problema antes de resolver. Pergunte primeiro, desenhe depois.',
        },
        {
          gotcha: 'Trazer features que não foram pedidas',
          note: 'Analytics, A/B test de slugs, link com expiração, anti-abuse — tudo opcional. Liste e pergunte "isso está no escopo?". Não invente requisitos pra mostrar que você conhece.',
        },
        {
          gotcha: 'Esquecer de perguntar volume',
          note: 'Sem volume, você não consegue dimensionar nada depois. "Quantas URLs criadas por mês?" e "quantas leituras por URL?" são as duas perguntas que destravam mais.',
        },
      ],
      anchor:
        'Você precisa transformar uma URL longa em `bit.ly/abc123`. Antes de escrever código, qual é a PRIMEIRA pergunta que você faz?',
      askWho: [
        {
          name: 'Rayssa Guedes',
          why: 'Beat de entrada. Ela tem só hashmap na bagagem, então fica confortável numa pergunta que é mais sobre processo que sobre sistema. Bom pra puxar a voz dela cedo.',
        },
        {
          name: 'Pedro Souza',
          why: 'Backup se Rayssa travar. Perfil de bagagem parecido.',
        },
      ],
      followup:
        'Quantas leituras pra cada escrita você acha que isso tem? E isso muda alguma coisa?',
      gotcha:
        'Quando alguém disser "preciso de consistência forte", devolva: "se o usuário viu o link 200ms depois de criar, alguém perde alguma coisa?"',
      scenarios: {
        right: {
          shape:
            'Lista perguntas concretas antes de qualquer solução — quantos usuários, quantas URLs criadas vs lidas, se a URL pode ser editada depois, qual latência é aceitável. Reconhece que essas respostas vão definir o resto e não tenta resolver ainda.',
          redirect:
            'Confirme as premissas com a turma (1:100 reads, imutável, eventual OK) e avance pra próxima pergunta: "agora que entendemos o problema, como o sistema gera o `abc123`?"',
        },
        close: {
          shape:
            'Faz algumas perguntas de requisito como volume e latência, mas esquece a coisa mais importante, que é a proporção entre leituras e escritas.',
          redirect:
            'Devolva: "dos requisitos que você listou, qual a pergunta que muda mais a arquitetura?" Guie até read/write ratio.',
        },
        wayOff: {
          shape:
            'Já começa a desenhar caixinhas no quadro, tipo "Load Balancer → API Gateway → Database", sem perguntar nada sobre o uso do sistema.',
          redirect:
            'Interrompa: "espera, antes de desenhar qualquer coisa, que perguntas você precisaria responder pra saber se essa arquitetura faz sentido?" Force a voltar pra requisitos.',
        },
      },
    },
    {
      id: 'url-keygen',
      label: 'Short key generation',
      group: 'url',
      beat: 2,
      oneLine:
        'A short key precisa ser curta, única e não-adivinhável. Duas estratégias possíveis: contador com base62, ou hash da URL.',
      pass1:
        'O `abc123` tem que ser curto (cerca de 7 caracteres), único e idealmente não-adivinhável. Existem duas famílias de solução: ou você mantém um contador que cresce a cada nova URL e converte pra base62, ou você calcula um hash da URL e pega os primeiros caracteres. Cada uma tem trade-offs claros que aparecem em entrevista.',
      pass2:
        'Base62 usa o alfabeto [a-zA-Z0-9], totalizando 62 caracteres. Com 7 posições isso dá 62^7, ou aproximadamente 3.5 trilhões de keys possíveis — espaço de sobra pra qualquer encurtador real. A pergunta sobre por que base62 e não base64 é simples: base64 inclui os caracteres `+` e `/`, que quebram dentro de uma URL sem encoding. Base62 não tem símbolos, então é URL-safe sem precisar escapar nada.\n\nNa estratégia de **contador convertido pra base62**, você mantém um número monotônico que começa em 1, e cada nova URL pega o próximo valor disponível e converte pra base62 (uma série de divisões sucessivas por 62). Garante unicidade sem precisar consultar o banco. O problema é que as keys ficam sequenciais — `aaaab` vira `aaaac` vira `aaaad` — o que expõe volume e permite enumerar URLs alheias. A solução aceita em produção é usar um gerador de IDs distribuído estilo Snowflake, ou pré-alocar blocos de IDs pra cada server (esse é o padrão real do Bit.ly).\n\nNa estratégia de **hash da URL**, você calcula um MD5 ou SHA256 e pega os primeiros 7 caracteres convertidos pra base62. A vantagem é que é determinístico: a mesma URL sempre dá a mesma key, então dedup acontece naturalmente. A desvantagem é que truncar um hash gera colisão estatística, e você precisa verificar contra o banco antes de confirmar.\n\nNa prática, muitos encurtadores combinam: hash pra detectar URLs idênticas (deduplica), e contador pra atribuir keys novas quando o hash não casa.',
      pass3: [
        {
          gotcha: 'Achar que base64 dá pra usar',
          note: 'Tem `+` e `/` no alfabeto, e esses dois caracteres quebram dentro de uma URL sem encoding. Base62 é o padrão exatamente porque elimina símbolos.',
        },
        {
          gotcha: 'Esquecer que hash colide',
          note: 'Truncar um SHA256 pra 7 caracteres aumenta a probabilidade de colisão drasticamente. Pelo birthday paradox, com cerca de 1 milhão de URLs já dá conflito provável em 62^7.',
        },
        {
          gotcha: 'Centralizar o contador num único server',
          note: 'Um contador global vira gargalo no write. A solução é pré-alocar blocos de IDs pra cada server (padrão Ticket Server, usado pelo Flickr e pelo Bit.ly), ou usar Snowflake distribuído.',
        },
      ],
      anchor:
        'Tenho um contador 1, 2, 3, ... no banco. Como ele vira `abc123`? E por que base62 e não base64?',
      askWho: [
        {
          name: 'Lucas Faria',
          why: 'Tem hashmap fresco, e conversão de base é a aplicação direta. Bom pra ver a roda girar na cabeça dele.',
        },
        {
          name: 'Cauan da Rocha',
          why: 'Mesma cesta de bagagem. Segunda voz se o Lucas matar rápido.',
        },
        {
          name: 'Julia Khristina',
          why: 'Terceira opção. Todos com hashmap, distribui voz entre os três.',
        },
      ],
      followup:
        'OK, e se dois usuários submetem a mesma URL no mesmo milissegundo?',
      gotcha:
        'Se alguém disser "uso UUID", devolva: "UUID tem 36 caracteres. Cabe num link encurtado?"',
      scenarios: {
        right: {
          shape:
            'Explica contador convertido pra base62 (URL-safe sem `+` ou `/`), com 7 caracteres dando 3.5 trilhões de keys. Mostra a divisão sucessiva por 62. Reconhece que centralizar o contador vira gargalo e cita Snowflake ou Ticket Server pra distribuir.',
          redirect:
            'Avance pra colisão: "se duas pessoas submetem URLs DIFERENTES e bate a mesma key, ou submetem a MESMA URL ao mesmo tempo, o que acontece?"',
        },
        close: {
          shape:
            'Sabe base62 e justifica vs base64, mas defende hash truncado da URL sem mencionar que truncar gera colisão. Ou então usa contador mas num único server global, sem perceber que vira gargalo.',
          redirect:
            'Pergunte: "1 bilhão de URLs geradas, hash de 7 caracteres em base62. Qual a probabilidade de duas URLs darem a mesma key?" Força a ver o birthday paradox.',
        },
        wayOff: {
          shape:
            'Propõe UUID v4 como solução, no estilo "é único, problema resolvido". Não considera o tamanho do link nem a legibilidade.',
          redirect:
            'Mostre a comparação visual: "bit.ly/abc123 vs bit.ly/3f4a7c2b-1d0e-4f8a-9b3c-7e1d2a8f5c4b. Qual deles cabe num tweet?" Não derrube a ideia, deixe ele perceber o trade-off.',
        },
      },
    },
    {
      id: 'url-collision',
      label: 'Collision handling',
      group: 'url',
      beat: 3,
      oneLine:
        'Existem duas situações distintas: race condition (mesma URL submetida 2× ao mesmo tempo) e collision propriamente dita (URLs diferentes gerando a mesma key).',
      pass1:
        'Quando o keygen entra em produção, duas situações distintas precisam ser tratadas, e cada uma tem uma solução diferente. A primeira é race condition: dois usuários submetem a MESMA URL no mesmo milissegundo, e o sistema precisa decidir se gera duas keys ou se reusa uma. A segunda é collision matemática: dois usuários submetem URLs DIFERENTES que coincidentemente geram a mesma key (acontece só na estratégia de hash truncado). Confundir as duas é o erro mais comum nesse beat.',
      pass2:
        'No esquema de **contador**, não existe collision por design — cada write pega um ID único do pool e converte. Mas race condition na mesma URL continua existindo: se dois usuários submetem `youtube.com/whatever` ao mesmo tempo, eles vão receber duas keys diferentes apontando pro mesmo destino. Isso é funcionalmente correto (os dois links levam pro mesmo lugar), mas desperdiça espaço de chaves. A solução opcional é fazer um lookup `long_url → short_key` antes de inserir, o que custa uma leitura extra, mas dedupliica.\n\nNo esquema de **hash**, collision é matemática e inevitável. A estratégia clássica é "compute, check, retry com salt": você calcula o hash da URL, verifica se aquela key já existe e aponta pra OUTRA URL. Se já existe e aponta pra outra, você anexa um nonce e recalcula. O INSERT precisa ser atômico — ou usando compare-and-swap, ou usando uma unique constraint no banco com upsert e retry.\n\nIsso adiciona uma round-trip extra no caminho de escrita, mas como o write é raro num encurtador, o custo é aceitável. Em produção, muitos encurtadores combinam as duas estratégias: hash pra detectar dedup de URL idêntica, contador pra novos IDs quando precisa.\n\nDetalhe importante: limite o retry budget. Se três tentativas de salt ainda colidirem, caia pra contador como fallback. Loop infinito de retry é receita pra latência subir no pico.',
      pass3: [
        {
          gotcha: 'Confundir "dois usuários submetem a mesma URL" com colisão',
          note: 'Isso não é colisão, é dedup opcional. Cada usuário pode ter sua própria short_key apontando pro mesmo destino, e isso é correto funcionalmente.',
        },
        {
          gotcha: 'Achar que um hashmap em memória resolve',
          note: 'Em memória num único server, sim, resolveria. Mas o sistema tem múltiplos servers, e cada um tem seu próprio hashmap local. Precisa de um mecanismo distribuído.',
        },
        {
          gotcha: 'Não pensar em retry budget',
          note: 'Hash colidiu, gerou salt e re-hashou, e colidiu de novo? Limite o número de tentativas. Três é razoável, depois disso cai pro contador.',
        },
      ],
      anchor:
        'Dois usuários submetem `youtube.com/whatever` no mesmo milissegundo. O que acontece? E se eles submetem URLs DIFERENTES que coincidentemente geram a mesma `abc123`?',
      askWho: [
        {
          name: 'Marcos Vinicius',
          why: 'Tem hashmap na bagagem, então força ele a raciocinar com a estrutura mental de "set de keys ocupadas". Ótimo pra ouvir como ele descreve o conceito de race condition.',
        },
        {
          name: 'Messias Olivindo',
          why: 'Backup com mesma base. Se Marcos travar, joga pra ele.',
        },
      ],
      followup: 'OK, estratégia decidida. Onde isso mora — Postgres, Redis, ou algum KV?',
      gotcha:
        'Se ninguém pensar em race: "Redis e Postgres são single-threaded por shard?" Provoca eles a separarem concorrência lógica de concorrência física.',
      scenarios: {
        right: {
          shape:
            'Separa explicitamente collision de hash (URLs diferentes, mesma key) de race condition (mesma URL, dois writes simultâneos). Propõe unique constraint do banco ou um primitivo atômico tipo SETNX, com retry budget limitado.',
          redirect:
            'Avance pro storage: "OK, a estratégia tá definida. Onde isso mora — qual tipo de banco faz sentido pra esse caso?"',
        },
        close: {
          shape:
            'Fala de unique constraint mas confunde as duas situações, tratando race de dedup como se fosse o mesmo problema que collision de hash. Ou então resolve uma delas e esquece da outra.',
          redirect:
            'Force a separar: "duas URLs DIFERENTES dando a mesma key — unique constraint resolve? E a MESMA URL submetida duas vezes — unique constraint resolve igual?"',
        },
        wayOff: {
          shape:
            'Diz "uso um Set em memória pra verificar se a key já existe", sem perceber que cada server tem seu próprio Set.',
          redirect:
            'Lembre o contexto: "tem 10 servers atendendo simultaneamente. O Set local de cada server não conversa com o do outro. O que acontece quando dois servers escolhem a mesma key?"',
        },
      },
    },
    {
      id: 'url-storage',
      label: 'Storage choice',
      group: 'url',
      beat: 4,
      oneLine:
        'O schema é simples, literalmente uma key aponta pra uma URL, por tanto um Key-Value vence qualquer arquitetura relacional nesse caso.',
      pass1:
        'O schema é simples: literalmente uma key aponta pra uma URL, com talvez um timestamp e um owner. Não tem join, não tem range scan, não tem agregação no caminho crítico. É o caso canônico de Key-Value store. Postgres dá conta tranquilamente, mas você está pagando todo o overhead de features relacionais que esse caso não usa.',
      pass2:
        'Pra um volume de 250 GB e 20 mil QPS de leitura, qualquer KV store serve. As opções principais são:\n\n**DynamoDB** é a opção PaaS da AWS. Hash partition na short_key dá leitura O(1) em poucos milissegundos, e a escala horizontal é automática. Você paga por request e storage. Ótimo se você não quer operar banco.\n\n**Cassandra** é o equivalente open-source com a mesma propriedade fundamental. Melhor pra quem quer controle on-prem ou em outras clouds. Mais operacional, mas sem lock-in.\n\n**Redis** entra como cache na frente, não como source of truth. 250 GB em RAM custa caro — cerca de 3 mil dólares por mês em RAM AWS — e Redis não foi pensado pra ser banco persistente principal.\n\n**Postgres** funciona, mas você está usando 10% das features e pagando 100% do overhead de WAL, MVCC e transações que esse caso não precisa. Vale a pena se o time já opera Postgres e o volume é pequeno (abaixo de 100 milhões de URLs).\n\nUm ponto sutil que vale mencionar: como a tabela é imutável (a URL nunca muda depois de criada), você pode usar storage barato (S3 com índice) pra long tail. Só os últimos N dias precisam estar em hot storage. Esse split entre hot e cold só existe porque a imutabilidade permite — em um sistema mutável seria muito mais complicado.',
      pass3: [
        {
          gotcha: 'Defender Postgres só porque "é o padrão"',
          note: 'Argumente o access pattern, não o conforto. Aqui é point lookup puro, e relacional não agrega valor pra esse padrão.',
        },
        {
          gotcha: 'Esquecer que imutabilidade habilita cold storage',
          note: 'URLs com 2 anos sem acesso podem viver no S3 com um índice apontando. O caminho quente nunca precisa olhar pra elas, e isso reduz custo dramaticamente.',
        },
        {
          gotcha: 'Não pensar no índice secundário',
          note: 'Se você quiser "listar URLs do usuário X", precisa de um índice por owner_id. Em DynamoDB isso é um Global Secondary Index, que tem custo separado de storage e throughput.',
        },
      ],
      anchor:
        'Postgres ou Redis pra essa tabela? Justifica.',
      askWho: [
        {
          name: 'Lorena Garcia',
          why: 'Única com hashmap + databases na bagagem. Tem o vocabulário pra entender tanto "point lookup" quanto "schema relacional". A pergunta cai no cruzamento exato dos dois tópicos que ela viu.',
        },
        {
          name: 'Leunam Sousa',
          why: 'Tem databases + cache. Backup forte se Lorena travar.',
        },
      ],
      followup:
        'Beleza, KV escolhido. E pra escala de leitura, a gente vai só na primary store?',
      gotcha:
        'Se alguém disser "Redis como source of truth": "250 GB em RAM custa quanto por mês comparado com SSD?"',
      scenarios: {
        right: {
          shape:
            'Argumenta pelo access pattern: point lookup + imutabilidade leva a KV (DynamoDB ou Cassandra), com Redis como cache na frente e S3 pra cold storage de URLs antigas. Justifica pelo padrão de uso, não pela familiaridade.',
          redirect:
            'Avance pro cache: "agora 1 bilhão de URLs no total, mas o working set quente são uns 20%. Como você cacheia?"',
        },
        close: {
          shape:
            'Vai de Postgres por reflexo de "é o que eu conheço". Reconhece que KV poderia ser opção mas não defende com argumento técnico.',
          redirect:
            'Pergunte: "que feature do Postgres você está USANDO aqui? JOIN? Range scan? Transação multi-row?" Force ele a ver que paga overhead sem usar.',
        },
        wayOff: {
          shape:
            'Propõe Redis como source of truth principal, justificando com "é rápido". Não considera o custo de RAM nem o problema de durabilidade.',
          redirect:
            'Compare numericamente: "250 GB em RAM no ElastiCache custa cerca de 3 mil dólares por mês. Em SSD via S3 custa 6 dólares. Vale a diferença pra um sistema que aceita 10ms de latência?"',
        },
      },
    },
    {
      id: 'url-cache',
      label: 'Caching the hot path',
      group: 'url',
      beat: 5,
      oneLine:
        '20% das keys recebem 80% das leituras, então cache LRU resolve, mas a estratégia (write-around vs read-through) importa.',
      pass1:
        'A distribuição de acesso a URLs encurtadas segue lei de potência: poucos links viralizam, milhões nunca são clicados. Isso significa que o working set ativo é pequeno (alguns GB) mesmo quando a primary store tem TB. Cache de leitura aqui é mandatório, não tanto pra latência mas pra reduzir o número de hits no banco principal.',
      pass2:
        'O padrão é **read-through cache** com Redis ou Memcached na frente do banco. Quando a request chega, o sistema checa primeiro o cache, e se for miss, vai no banco, grava no cache, e retorna. O TTL pode ser longo (horas ou dias) porque a tabela é imutável — uma URL nunca muda depois de criada, então o cache nunca fica stale. A eviction usa LRU clássica, e funciona bem porque a distribuição de acesso (pareto) é estável.\n\nA pergunta interessante é se vale write-through ou write-around. **Write-through** popula o cache no momento da escrita. **Write-around** escreve só no banco e deixa o cache popular naturalmente no primeiro read. Pra esse perfil, write-around vence porque a maioria das URLs criadas nunca recebem hit imediato (quem cria leva minutos pra compartilhar), então popular o cache antecipadamente só polui RAM com keys que nunca vão ser lidas.\n\nEdge caching também entra aqui: um redirect 301 (permanent) é cacheável em CDN. Uma vez que o Cloudflare aprende que `bit.ly/abc` aponta pra `youtube.com/x`, ele responde direto sem nunca chegar no seu servidor. Isso é a cereja: cerca de 70% do tráfego real do Bit.ly nunca chega no origin. Importante usar 301 e não 302 — o 302 (temporary) não é cacheável por design.\n\nUm cuidado operacional importante: thundering herd. Se o cache de uma URL viral expira ao mesmo tempo, 50 mil requests batem no banco simultaneamente. A solução é request coalescing, ou também chamado de single-flight: o primeiro request popula o cache, e os outros 49.999 esperam o resultado dele.',
      pass3: [
        {
          gotcha: 'Reflexo de write-through',
          note: 'Quem viu sistemas write-heavy joga write-through por reflexo. Aqui write é raro e read tem skew brutal, então write-around vence — não tem porque poluir cache com keys que nunca vão receber hit.',
        },
        {
          gotcha: 'Esquecer thundering herd',
          note: 'Cache de uma URL viral expira e 50 mil requests batem no banco juntos. Use single-flight ou lock por key pra evitar.',
        },
        {
          gotcha: 'Não pensar em CDN cacheando o 301',
          note: 'A maioria esquece esse free win. Use 301 (permanent), não 302, e o Cloudflare cacheia naturalmente. Cerca de 70% do tráfego nunca chega no seu origin.',
        },
        {
          gotcha: 'Cache local in-process vs cache distribuído',
          note: 'Cache local (in-process, tipo Caffeine) tem custo zero de network mas duplica memória por server e tem invalidação difícil. Aqui ajuda — como o dado é imutável, você pode usar in-process puro sem se preocupar com invalidação.',
        },
      ],
      anchor:
        '100 milhões de URLs e 80% das requests batem em 20% das chaves. Como você cacheia, e quando invalida?',
      askWho: [
        {
          name: 'Eduardo Izawa',
          why: 'Único com cache + databases + replication na bagagem. Esse é o beat dele — deixa ele puxar a discussão de eviction e working set. Se ele engatar, joga thundering herd como gotcha.',
        },
        {
          name: 'Leunam Sousa',
          why: 'Tem cache + databases. Segunda voz pra contraste, talvez defendendo write-through pra Eduardo corrigir.',
        },
      ],
      followup:
        '1 bilhão de URLs no total. Cabe num único server? E se não cabe?',
      gotcha:
        'Se eles travarem na pergunta "que TTL?": "se a URL é imutável, qual o TTL semântico?" Força ver que TTL aqui é só pra eviction, não pra staleness.',
      scenarios: {
        right: {
          shape:
            'Read-through Redis na frente do banco, com write-around porque writes são raros e não vale poluir cache. LRU pra eviction. Menciona thundering herd e protege com single-flight. Cita CDN cacheando o 301 como bonus.',
          redirect:
            'Avance pro sharding: "OK, cache resolve a leitura. Mas 1 bilhão de URLs ainda não cabem num único server. Como você divide?"',
        },
        close: {
          shape:
            'Sabe cache mas defende read-through E write-through ao mesmo tempo, sem perceber que com write raro + read heavy, write-around é estritamente melhor.',
          redirect:
            'Pergunte: "se você popular o cache no momento do write, e 90% dessas URLs nunca vão ser lidas, o que aconteceu com a sua RAM?"',
        },
        wayOff: {
          shape:
            'Diz que cache não é necessário porque "o banco já é rápido".',
          redirect:
            'Aterre nos números: "20 mil QPS no pico, p99 abaixo de 100ms exigido, working set quente de uns 10 GB. O banco sozinho aguentando isso custa quanto? E sobrevive um pico de 5×?"',
        },
      },
    },
    {
      id: 'url-shard',
      label: 'Sharding by key hash',
      group: 'url',
      beat: 6,
      oneLine:
        'Partition por hash da short_key. Sem range queries e sem rebalanço difícil — URL Shortener é o caso fácil de sharding.',
      pass1:
        'Quando uma única instância não cabe (seja por storage ou throughput), você precisa shardar. Pra URL Shortener esse é o caso mais simples possível: o lookup é sempre por short_key, então `shard_id = hash(short_key) % N` resolve. Não tem query cross-shard, não tem range scan, não tem JOIN. É quase trivial — mas tem algumas armadilhas no rebalanço.',
      pass2:
        'Hash partition simples (`mod N`) funciona bem até você precisar adicionar um shard. Quando N muda, você precisa relocar `(N-1)/N` das keys — quase tudo. A solução é **consistent hashing** com virtual nodes, que reduz isso pra apenas `1/N` das keys movidas quando você adiciona o shard `N+1`.\n\nCada shard guarda um pedaço da tabela `short_key → long_url`. O router (que pode ser um proxy dedicado ou client-side) calcula o hash da short_key e roteia pra ele. Esse roteamento é stateless — qualquer request pode bater em qualquer shard, e o resultado é sempre o mesmo.\n\nReplicação dentro de cada shard segue o padrão master + 2 réplicas: as réplicas absorvem leitura e o master recebe write, com failover automático via Raft ou Zookeeper.\n\nHot shard é raro nesse caso. Como `hash(key)` distribui uniformemente, uma URL viral está em um único shard, mas o working set viral total fica espalhado por muitas keys diferentes. O cache da etapa anterior também ajuda — o caminho quente quase não chega ao banco mesmo.\n\nUm caso particular vale mencionar: se você permite custom slugs (do tipo `/davi/blog`), precisa checar unicidade GLOBAL antes de aceitar, e isso quebra o particionamento limpo. Em produção, custom slugs geralmente vivem numa tabela separada com hash partition diferente.',
      pass3: [
        {
          gotcha: 'Shardar por geographic region',
          note: 'Tentador, mas URL Shortener é global — um brasileiro clica em link criado por um americano. Sharding por hash da key vence sharding geográfico aqui.',
        },
        {
          gotcha: 'Não diferenciar hash partition de range partition',
          note: 'Range partition (a-f no shard 1, g-l no shard 2) seria útil pra "listar URLs do usuário", mas péssimo pra point lookup distribuído. Cada padrão de acesso pede um tipo de partition diferente.',
        },
        {
          gotcha: 'Esquecer o caso de custom slugs',
          note: 'Se você permite slug customizado, precisa checar unicidade global antes de aceitar. Isso quebra o particionamento limpo, então custom slugs geralmente vivem numa tabela separada.',
        },
      ],
      anchor:
        '1 bilhão de rows e não cabe num único server. Como você divide os dados em N servers, e o que acontece quando você precisa adicionar o servidor 11?',
      askWho: [
        {
          name: 'Eduardo Izawa',
          why: 'Único com sharding na bagagem. Esse é o beat onde ele lidera. Você vai pingar o tópico `case-url-shortener` se ele aprofundar bem.',
        },
      ],
      followup:
        'OK, as 6 decisões de design estão na mesa. Agora desenha no quadro: o request do usuário entra, quais camadas ele atravessa?',
      gotcha:
        'Se Eduardo só disser "hash mod N", pergunte: "adicionei o servidor 11. Quantas keys vão precisar se mover entre shards?" Força ele a falar de consistent hashing.',
      scenarios: {
        right: {
          shape:
            'Hash partition por short_key, com consistent hashing e virtual nodes pra rebalanço suave quando adicionar shard. Diferencia hash partition de range partition e explica quando cada um faz sentido.',
          redirect:
            'Avance pro fechamento: "encurtador fechado. Quais foram as três decisões que dependeram diretamente do perfil read-heavy?"',
        },
        close: {
          shape:
            'Diz "hash mod N" sem mencionar o problema de rebalanço. Sabe shardear mas não pensou no que acontece quando precisa adicionar capacidade.',
          redirect:
            '"Adicionei o shard 11. Quantas keys vão precisar se mover entre shards no esquema atual?" Força chegar em consistent hashing.',
        },
        wayOff: {
          shape:
            'Sharda por geographic region "pra latência". Ou sharda por intervalo alfabético, tipo a-f no shard 1 e g-l no shard 2.',
          redirect:
            'Devolva: "encurtador é global. Um brasileiro clica num link criado por um americano. Em que shard a key está?" Força ver que geo não casa com o padrão de acesso.',
        },
      },
    },
    {
      id: 'url-architecture',
      label: 'Architecture: o fluxo completo',
      group: 'url',
      beat: 7,
      oneLine:
        'Walkthrough do request: do navegador até o banco e de volta. Mostra como as decisões dos beats anteriores se compõem em camadas.',
      pass1:
        'Agora a gente junta as peças. Nos beats anteriores você decidiu base62, KV store, cache com write-around, consistent hashing. Esse beat é desenhar no quadro como tudo isso se conecta — por onde a request entra, em que camadas ela passa, e onde termina. É um teste de coerência: se alguma das decisões anteriores não fizer sentido no diagrama, é hora de voltar e revisar.',
      pass2:
        '**Read path** (o caminho mais comum, cerca de 99% do tráfego). O navegador resolve o domínio via DNS e bate em um edge node do CDN. Se o CDN tem o 301 cacheado (e como o link é imutável, isso acontece muito), devolve direto e nunca chega no nosso sistema. Se não tem, passa pro load balancer, que distribui pra uma instância de compute via round-robin. A instância consulta o cache distribuído (Redis) primeiro. Cache hit retorna o long_url e termina. Cache miss faz a instância buscar no banco primário, popular o cache, e responder com 301. O CDN cacheia esse 301 com TTL longo, então o próximo request da mesma key nunca mais chega no origin.\n\n**Write path** (raro, cerca de 1% do tráfego). O navegador bate no CDN, que detecta o método POST e passa pro load balancer (CDN não cacheia writes). O load balancer encaminha pra compute. A instância gera o short_key (counter via Snowflake ou similar), confirma unicidade via constraint atômica, escreve no banco primário, e devolve a key gerada. Não popula cache no write — write-around deixa o primeiro read fazer isso.\n\n**Camadas que você desenha**: edge (CDN) → load balancer → compute → cache distribuído → banco primário → storage frio (S3 com index pra URLs antigas). Setas separadas pra leitura e escrita. Marca o cache hit como early-exit no read path. Marca o CDN cache como o early-exit ainda mais cedo. Esses dois early-exits são onde 95% do tráfego sai sem nunca tocar no banco.\n\n**Asymmetry crítica**: o read path tem 3 níveis de cache (CDN, cache distribuído, e implicitamente o cache local da instância). O write path tem zero cache. Isso é o reflexo direto do read/write ratio 1:100 — investir em hierarquia de cache na leitura compensa, no write não.',
      pass3: [
        {
          gotcha: 'Desenhar só `LB → API → DB`',
          note: 'É o desenho de um CRUD genérico. Falta o CDN (que absorve 70% do tráfego no padrão real do Bit.ly) e falta o cache distribuído (que absorve mais 20%). Esses dois sumiram do diagrama e com eles a maior parte da arquitetura.',
        },
        {
          gotcha: 'Misturar read path e write path no mesmo desenho',
          note: 'Os perfis são tão diferentes (read tem 3 camadas de cache, write tem zero) que merecem setas e cores distintas. Misturar esconde a assimetria que é a chave do design.',
        },
        {
          gotcha: 'Esquecer o storage frio',
          note: 'URLs com 2 anos sem acesso podem viver em S3 com um índice apontando. Esse hot/cold split só é possível porque o dado é imutável, e cabe um bullet no diagrama mesmo que seja "opcional".',
        },
        {
          gotcha: 'Não marcar onde os early-exits acontecem',
          note: 'O CDN serve 70% sem chegar no origin. O cache distribuído serve mais 20%. Marcar esses dois pontos com "X% sai aqui" deixa o diagrama tão claro quanto a prosa.',
        },
      ],
      anchor:
        'Request do navegador entra. Desenha no quadro CADA camada que ela passa antes do 301 voltar pro usuário.',
      askWho: [
        {
          name: 'Eduardo Izawa',
          why: 'Tem cache + replication + sharding na bagagem — é a pessoa que consegue puxar o diagrama inteiro sem esquecer camada. Se ele engatar bem, deixa ele guiar a sala.',
        },
        {
          name: 'Leunam Sousa',
          why: 'Backup com cache + database. Se Eduardo esquecer algo, ele pode preencher os buracos.',
        },
      ],
      followup:
        'OK, diagrama no quadro. Pra cada caixa, qual serviço da AWS você usaria pra deployar?',
      gotcha:
        'Se desenharem só `LB → API → DB`, devolva: "cadê o CDN? Onde mora os 70% do tráfego do Bit.ly real?"',
      scenarios: {
        right: {
          shape:
            'Desenha as 5 camadas (CDN, load balancer, compute, cache, banco) com setas separadas pra read e write paths. Marca explicitamente o CDN como primeiro early-exit e o cache como segundo. Cita imutabilidade como o que destrava esse hierarchy.',
          redirect:
            'Avance pro deploy: "agora pra cada caixa, qual serviço AWS escolheria? Justifica pelo perfil de carga, não pela preferência."',
        },
        close: {
          shape:
            'Desenha as camadas principais mas esquece o CDN (foca só no cache distribuído), ou não separa read e write paths, ou esquece de marcar os early-exits.',
          redirect:
            'Aponte o gap: "esse desenho assume que toda request chega no seu servidor. Mas no padrão real do Bit.ly, quanto % do tráfego SAI antes de chegar?" Force chegar em CDN.',
        },
        wayOff: {
          shape:
            'Desenha "usuário → servidor → banco" como se fosse uma arquitetura monolítica. Não pensa em camadas nem em onde o tráfego é filtrado.',
          redirect:
            'Volte aos fatos: "1B URLs, 20 mil QPS no pico, p99 abaixo de 100ms. Esse desenho de 3 caixas aguenta isso? Onde o tráfego é absorvido?"',
        },
      },
    },
    {
      id: 'url-aws',
      label: 'AWS: managed services por camada',
      group: 'url',
      beat: 8,
      oneLine:
        'Cada caixa do diagrama mapeia pra um managed service. Pro perfil read-heavy + write-rare, o stack canônico é Lambda + DynamoDB + ElastiCache + CloudFront.',
      pass1:
        'Você tem o desenho da arquitetura. Agora pra cada caixa, qual managed service da AWS você usaria pra deployar? Esse beat é sobre tradeoffs operacionais reais — Lambda versus EC2, DynamoDB versus RDS, CloudFront versus colocar Nginx na sua frente. A regra é a mesma de antes: a escolha depende do perfil da carga, não da preferência ou da familiaridade.',
      pass2:
        '**CDN: CloudFront**. Edge global da AWS, cacheia o 301 com TTL longo. Integra direto com Route 53 e ALB. Cobra por GB de transferência e por request, mas pra encurtador (onde 70% do tráfego sai aqui) é barato e indispensável.\n\n**DNS: Route 53**. O DNS authoritative da AWS. Aceita geo-routing pra mandar usuário pro CloudFront mais próximo. Latency-based routing pro próprio API endpoint.\n\n**Load balancer: ALB ou API Gateway**. Pra Lambda, API Gateway entra naturalmente. Pra EC2, ALB. Não precisa de NLB nesse caso porque a conexão é HTTP curta, não persistente.\n\n**Compute: Lambda**. Esse é o ponto interessante. Lambda funciona muito bem aqui porque o write QPS é baixo (200 no pico), e a maior parte do tráfego de leitura já foi absorvido pelo CloudFront e pelo ElastiCache antes de chegar. A Lambda invoca raramente, paga por invocação, e escala automaticamente. EC2 seria justificado só se você precisasse de cold-start zero ou de uma biblioteca pesada que não cabe em Lambda.\n\n**Cache: ElastiCache (Redis)**. Cluster Redis gerenciado. Read-through pattern pra cache hit em poucos ms. Suporta autoscaling de nós e replicação automática.\n\n**Banco primário: DynamoDB**. KV gerenciado, hash partition automática na short_key, leitura O(1) em poucos ms. Cobra por request + storage. DynamoDB Streams pode disparar Lambda em cada write se precisar de analytics.\n\n**Cold storage: S3 + Athena**. URLs antigas migram pra S3 (cobrança por GB armazenado, muito barata) e ficam queryáveis via Athena se algum dia for preciso. Hot path nunca toca esse storage.\n\n**Observabilidade: CloudWatch + X-Ray**. Métricas (cache hit rate, p99 latência, erro %) em CloudWatch, distributed tracing em X-Ray. Alarmes em métricas críticas.\n\n**Infra como código: CDK ou Terraform**. Não importa muito qual — o ponto é que a stack inteira é definida em código e versionada.',
      pass3: [
        {
          gotcha: 'Escolher EC2 sem justificar',
          note: 'EC2 cobra 24/7 mesmo quando não tem tráfego, e o write QPS aqui é baixo o suficiente pra Lambda absorver sem nem cold-start ser problema. Sem justificativa concreta (latência mínima, biblioteca pesada), Lambda vence.',
        },
        {
          gotcha: 'Defender RDS pra esse caso',
          note: 'RDS (Postgres ou MySQL gerenciado) cobra por instância 24/7, faz MVCC e WAL que não usamos, e tem limite de conexões. DynamoDB encaixa no padrão de uso (point lookup) e cobra por request — paga só o que usa.',
        },
        {
          gotcha: 'Esquecer o CloudFront',
          note: 'Sem CloudFront, todo o tráfego bate no ALB e na sua compute. Isso multiplica custo de Lambda por 5× e mata o p99. CloudFront cacheia 70% do tráfego antes — não é opcional, é central no design.',
        },
        {
          gotcha: 'Não pensar em DynamoDB on-demand vs provisioned',
          note: 'On-demand cobra por request, escala automaticamente, ótimo pra tráfego irregular ou desconhecido. Provisioned reserva capacidade e é mais barato em volume previsível. Pra encurtador novo, on-demand pra começar; provisioned quando o tráfego estabiliza.',
        },
      ],
      anchor:
        'Pro encurtador, qual a sua escolha de compute — Lambda ou EC2? Justifica pelo perfil de carga.',
      askWho: [
        {
          name: 'Eduardo Izawa',
          why: 'Tem cache + database + scale na bagagem. As decisões aqui (Lambda vs EC2, DynamoDB vs RDS, escolha de cache) caem exatamente nos topics que ele estudou. Ótimo pra puxar tradeoffs.',
        },
      ],
      followup:
        'OK, stack escolhida. Em que ordem você ia deployar pra subir um MVP e depois escalar?',
      gotcha:
        'Se alguém escolher EC2 sem justificar, devolva: "quantas writes por segundo a Lambda absorve no pico aqui? E quanto custa uma instância EC2 t3.medium 24/7 idle?"',
      scenarios: {
        right: {
          shape:
            'Lambda + DynamoDB + ElastiCache + CloudFront + Route 53 + S3 pra long tail. Justifica cada escolha pelo perfil — Lambda porque write é raro e read já foi absorvido por cache, DynamoDB porque point lookup é o padrão de acesso, CloudFront porque a operação é GET de dado imutável.',
          redirect:
            'Avance pro fechamento: "cadeia montada. Quais decisões dessa stack são consequência direta do read/write ratio 1:100?"',
        },
        close: {
          shape:
            'Escolhe os serviços certos (Lambda, DynamoDB, ElastiCache) mas não justifica pelo perfil de carga. A resposta sai como uma lista de "uso isso, isso e isso" sem o "por quê".',
          redirect:
            'Force o porquê: "Lambda em vez de EC2 — qual número específico do nosso perfil justifica essa escolha?"',
        },
        wayOff: {
          shape:
            'Vai de EC2 + RDS porque "é o que eu conheço". Não considera Lambda nem KV gerenciado.',
          redirect:
            'Aterre numericamente: "1 instância EC2 t3.medium custa 30 dólares por mês idle. Lambda com nosso volume custaria quanto? RDS provisioned custa 100+ dólares; DynamoDB on-demand com nosso volume custa quanto?"',
        },
      },
    },
    // ──────────────── SYNTHESIS ────────────────
    {
      id: 'synthesis',
      label: 'Synthesis: profile drives every decision',
      group: 'synthesis',
      oneLine:
        'O perfil de carga (read-heavy + imutável + eventual OK) dita 80% da arquitetura antes de qualquer caixa ser desenhada.',
      pass1:
        'URL Shortener é o caso canônico read-heavy com point lookup, e os 8 beats que acabamos de cobrir te dão o vocabulário central que reaparece em qualquer sistema com perfil parecido — base62, KV store, cache write-around, consistent hashing, e o stack de managed services que materializa isso na nuvem. A regra que sai daqui não é nenhum nome de tecnologia específico, e sim que o perfil de carga (read/write ratio + mutabilidade + consistency aceitável) dita 80% das decisões antes de você desenhar qualquer caixa.',
      pass2:
        'O resumo das 8 decisões que tomamos, lado a lado com o critério que guiou cada uma:\n\n**Keygen** (base62 + Snowflake): perfil pede unicidade distribuída sem coordenação central, e legibilidade pra caber em link. Base62 ganha de UUID e de hash truncado.\n\n**Collision handling**: race condition de dedup é diferente de collision matemática, e cada uma tem sua solução. Imutabilidade ajuda — o dado nunca muda depois, então o retry é seguro.\n\n**Storage choice** (KV): o access pattern é point lookup puro, sem JOIN nem range. Relacional é overkill, e Redis como source of truth é desperdício de RAM.\n\n**Cache** (read-through, write-around): a distribuição de leitura é skewed (lei de potência), o write é raro, e o dado é imutável. Esses três fatos juntos quase escrevem a estratégia de cache sozinhos.\n\n**Sharding** (hash partition): point lookup uniformemente distribuído resolve com hash mod N + consistent hashing pra rebalanço. Sem cross-shard query no caminho quente.\n\n**Architecture diagram**: cinco camadas separando read path (com 3 níveis de cache) de write path (sem cache). O CDN absorve 70% do tráfego, o cache distribuído absorve mais 20%, e só 10% chega no banco — assimetria que reflete diretamente o ratio 1:100.\n\n**AWS stack**: Lambda + DynamoDB + ElastiCache + CloudFront + Route 53. Cada escolha justificada pelo perfil — Lambda porque o write é raro e a Lambda escala bem, DynamoDB porque point lookup é o access pattern, CloudFront porque o dado é imutável e a operação é GET cacheável.\n\nO ponto pedagógico final: nenhuma dessas decisões foi tomada por "é o padrão". Cada uma seguiu do perfil específico do sistema. Em entrevista, o candidato que articula essa lógica (perfil → decisão → trade-off → managed service) é o que separa pleno de senior.',
      pass3: [
        {
          gotcha: 'Aceitar "uso o padrão" como justificativa',
          note: 'Sempre force "por quê esse padrão pra ESSE perfil?". A primitiva é a mesma em vários sistemas, mas o trade-off muda com o perfil.',
        },
        {
          gotcha: 'Sair sem nome de produto na cabeça',
          note: 'URL Shortener real existe — Bit.ly, TinyURL, t.co. Em entrevista, ancorar em produto real ajuda a raciocinar sobre escala.',
        },
      ],
      anchor:
        'Liste as 3 decisões dessa aula que dependeram diretamente do perfil read-heavy + imutável.',
      askWho: [
        {
          name: 'open',
          why: 'Fechamento aberto pro grupo. Quem responder primeiro mostra que pegou. Bom indicador de quem ficou e quem ficou pra trás.',
        },
      ],
      followup:
        'Em sistemas com perfil oposto (write-heavy, stateful, real-time), quais dessas primitivas ainda apareceriam e quais ficariam de fora?',
      gotcha:
        'Se ninguém citar cache resolveu URL mas não resolve tudo, dê: é o insight central. Pergunte "em que tipo de sistema cache não resolve?" pra ver quem internalizou.',
    },
  ],
};

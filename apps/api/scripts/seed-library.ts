/**
 * Library seed — topics taxonomy + library items.
 *
 * Idempotent: topics upsert by slug, items upsert by (title + url).
 * Embedding: generated via OpenAI when OPENAI_API_KEY is set; skipped otherwise
 * (items can be re-embedded later by editing them through the admin UI, which
 * triggers LibraryService.writeEmbedding).
 *
 * Run from repo root:
 *   pnpm --filter @ics-select/api seed:library
 */
import { PrismaClient } from '@ics-select/prisma';
import OpenAI from 'openai';
import type { Track } from '@ics-select/shared';

const prisma = new PrismaClient();

type TopicSeed = { slug: string; label: string; order: number };
type ItemSeed = {
  title: string;
  url: string | null;
  description: string | null;
  format: 'VIDEO' | 'ARTICLE' | 'BOOK' | 'PROBLEM' | 'OTHER';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  estimatedMinutes: number;
  // First slug is the PRIMARY topic (the item's "home" — where the admin
  // navigates to find it). Additional slugs are secondary covers: every
  // topic in the array contributes to that topic's coverage %.
  topicSlugs: string[];
  tracks: Track[];
  source: string | null;
  tags: string[];
};

// -----------------------------------------------------------------------------
// Topics taxonomy (37 topics across 5 buckets)
//
// Naming principle: atomic concepts, single-noun slugs where possible.
// Drop `eng-` and `sd-` prefixes (universals & SD building blocks use bare
// slugs). Case studies keep `case-` prefix for grouping.
//
// Flavor (tradeoffs/practice/case-study) is expressed via the `tags` array
// on LibraryItem, not via separate topics. See `.claude/skills/ics-library-
// curate/SKILL.md` "Tag vocabulary" section.
// -----------------------------------------------------------------------------

const TOPICS: TopicSeed[] = [
  // Foundations — negative order so it always shows up first.
  // Davi: "MUITO IMPORTANTE, esse video é uma ótima forma de começar os estudos".
  // Entry point for any member before starting their track-specific ladder.
  { slug: 'foundations', label: 'Foundations', order: -1 },

  // Algorithms & Data Structures (order 0–12)
  { slug: 'array', label: 'Array', order: 0 },
  { slug: 'lists', label: 'Lists', order: 1 },
  { slug: 'tree', label: 'Tree', order: 2 },
  { slug: 'trie', label: 'Trie', order: 3 },
  { slug: 'heap', label: 'Heap', order: 4 },
  { slug: 'graph', label: 'Graph', order: 5 },
  { slug: 'sorting', label: 'Sorting', order: 6 },
  { slug: 'searching', label: 'Searching', order: 7 },
  { slug: 'recursion', label: 'Recursion & Backtracking', order: 8 },
  { slug: 'dp', label: 'Dynamic Programming', order: 9 },
  { slug: 'greedy', label: 'Greedy', order: 10 },
  { slug: 'bit-manipulation', label: 'Bit Manipulation', order: 11 },
  { slug: 'math', label: 'Math', order: 12 },
  { slug: 'hashmap', label: 'Hash Map', order: 13 },

  // Fundamentos de Engenharia (order 20–27) — universais, tracks múltiplas
  { slug: 'databases', label: 'Databases', order: 20 },
  { slug: 'networking', label: 'Networking', order: 21 },
  { slug: 'containers', label: 'Containers', order: 22 },
  { slug: 'cloud', label: 'Cloud', order: 23 },
  { slug: 'security', label: 'Security', order: 24 },
  { slug: 'cicd', label: 'CI/CD', order: 25 },
  { slug: 'deploy', label: 'Deploy', order: 26 },
  { slug: 'observability', label: 'Observability', order: 27 },
  { slug: 'design-patterns', label: 'Design Patterns', order: 28 },

  // System Design — Building Blocks (order 30–36)
  { slug: 'load-balancers', label: 'Load Balancers', order: 30 },
  { slug: 'caching', label: 'Caching', order: 31 },
  { slug: 'sharding', label: 'Sharding', order: 32 },
  { slug: 'replication', label: 'Replication', order: 33 },
  { slug: 'message-queues', label: 'Message Queues', order: 34 },
  { slug: 'pubsub', label: 'Pub/Sub', order: 35 },
  { slug: 'rate-limiting', label: 'Rate Limiting', order: 36 },

  // System Design — Concepts (order 40–43)
  { slug: 'scalability', label: 'Scalability', order: 40 },
  { slug: 'cap-consistency', label: 'CAP & Consistency', order: 41 },
  { slug: 'idempotency', label: 'Idempotency', order: 42 },
  { slug: 'reliability', label: 'Reliability', order: 43 },

  // System Design — Case Studies (order 50–54) — case- prefix groups them
  { slug: 'case-url-shortener', label: 'Case — URL Shortener', order: 50 },
  { slug: 'case-feeds', label: 'Case — Social Feeds', order: 51 },
  { slug: 'case-chat', label: 'Case — Chat & Messaging', order: 52 },
  { slug: 'case-streaming', label: 'Case — Video Streaming', order: 53 },
  { slug: 'case-maps-rideshare', label: 'Case — Maps & Ride-sharing', order: 54 },
];

// -----------------------------------------------------------------------------
// Library items — piloto `sd-caching` (7 items)
// -----------------------------------------------------------------------------

const ITEMS: ItemSeed[] = [
  {
    title: 'Redis in 100 Seconds',
    url: 'https://www.youtube.com/watch?v=G1rOthIU-uo',
    description:
      'Fireship — o que é Redis e quando usar, em 100s.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 3,
    topicSlugs: ['caching'],
    tracks: [],
    source: 'YouTube — Fireship',
    tags: ['concept', 'redis', 'intro', 'fireship'],
  },
  {
    title: 'Top 5 Caching Strategies',
    url: 'https://www.youtube.com/watch?v=2zIFUqTx_TU',
    description:
      'ByteByteGo — as 5 estratégias de cache (cache-aside, read-through, write-around, write-back, write-through) com diagrama de cada uma.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 9,
    topicSlugs: ['caching'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['tradeoffs', 'cache-aside', 'read-through', 'write-through', 'write-back'],
  },
  {
    title: 'Cache Systems Every Developer Should Know',
    url: 'https://www.youtube.com/watch?v=dGAgxozNWFE',
    description:
      'ByteByteGo — onde tem cache numa stack web: browser, CDN, app, database.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 6,
    topicSlugs: ['caching'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'cdn', 'layers', 'browser-cache'],
  },
  {
    title: 'Caching Pitfalls Every Developer Should Know',
    url: 'https://www.youtube.com/watch?v=wh98s0XhMmQ',
    description:
      'ByteByteGo — o que dá errado em cache: thundering herd, cache stampede, stale data.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 7,
    topicSlugs: ['caching'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'pitfalls', 'thundering-herd', 'stampede'],
  },
  {
    title: 'Cache Invalidation Explained',
    url: 'https://www.youtube.com/watch?v=VxeppdirKgE',
    description:
      'ByteByteGo — 90s em cima da frase "only two hard things in CS: cache invalidation and naming things". Por que é difícil e o que fazer.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 2,
    topicSlugs: ['caching'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'cache-invalidation', 'consistency'],
  },
  {
    title: 'Top Caching Strategies — ByteByteGo Blog',
    url: 'https://blog.bytebytego.com/p/top-caching-strategies',
    description:
      'Alex Xu — versão escrita das estratégias de write (write-around, write-back, write-through) e read (cache-aside, read-through), com quando escolher cada uma.',
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 15,
    topicSlugs: ['caching'],
    tracks: [],
    source: 'Blog — ByteByteGo',
    tags: ['tradeoffs', 'write-through', 'cache-aside', 'write-back'],
  },
  // ---------------------------------------------------------------------------
  // databases (10 items) — 2026-04-19
  // ---------------------------------------------------------------------------
  {
    title: 'PostgreSQL in 100 Seconds',
    url: 'https://www.youtube.com/watch?v=n2Fluyr3lbc',
    description:
      'Fireship — o que é Postgres e por que todo mundo usa, em 100s.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 3,
    topicSlugs: ['databases'],
    tracks: [],
    source: 'YouTube — Fireship',
    tags: ['concept', 'postgresql', 'intro', 'fireship'],
  },
  {
    title: 'SQL Explained in 100 Seconds',
    url: 'https://www.youtube.com/watch?v=zsjvFFKOm3c',
    description:
      'Fireship — SQL e o modelo relacional em 100s.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 3,
    topicSlugs: ['databases'],
    tracks: [],
    source: 'YouTube — Fireship',
    tags: ['concept', 'sql', 'intro', 'fireship'],
  },
  {
    title: '7 Database Paradigms',
    url: 'https://www.youtube.com/watch?v=W2Z7fbCLSTw',
    description:
      'Fireship — os 7 paradigmas (relational, document, graph, key-value, wide-column, search, multi-model) com exemplo de quando cada um faz sentido.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 10,
    topicSlugs: ['databases'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Fireship',
    tags: ['tradeoffs', 'paradigms', 'sql', 'nosql', 'graph-db', 'key-value'],
  },
  {
    title: 'Database Index Fundamentals',
    url: 'https://www.youtube.com/watch?v=xAQga907NVU',
    description:
      'ByteByteGo — como funcionam B-Tree, hash index e índice composto, com diagrama.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 5,
    topicSlugs: ['databases'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'index', 'b-tree', 'hash-index'],
  },
  {
    title: "99% of Developers Don't Get PostgreSQL",
    url: 'https://www.youtube.com/watch?v=P8rrhZTPEAQ',
    description:
      'The Coding Gopher — internals do Postgres: MVCC, TOAST tuples, visibility maps, page layout.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 13,
    topicSlugs: ['databases'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — The Coding Gopher',
    tags: ['concept', 'postgresql', 'mvcc', 'internals'],
  },
  {
    title: 'PostgreSQL Internal Architecture Explained',
    url: 'https://www.youtube.com/watch?v=Q56kljmIN14',
    description:
      'Hussein Nasser — 33min na arquitetura de processos do Postgres: postmaster, backend workers, shared buffers, autovacuum, WAL.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 33,
    topicSlugs: ['databases'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Hussein Nasser',
    tags: ['concept', 'postgresql', 'architecture', 'mvcc', 'wal', 'internals'],
  },
  {
    title: 'A Deep Dive in How Slow SELECT * is',
    url: 'https://www.youtube.com/watch?v=wybjsKtA9hI',
    description:
      'Hussein Nasser — 40min em por que SELECT * é caro: IO, projection, coverage de índice, tráfego de rede.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 40,
    topicSlugs: ['databases'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Hussein Nasser',
    tags: ['concept', 'postgresql', 'query-performance', 'internals'],
  },
  {
    title: 'Database Indexing Strategies',
    url: 'https://blog.bytebytego.com/p/database-indexing-strategies',
    description:
      'ByteByteGo — artigo com clustered/non-clustered, covering, composite, partial, expression-based.',
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 15,
    topicSlugs: ['databases'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'Blog — ByteByteGo',
    tags: ['concept', 'index', 'clustered', 'covering-index'],
  },
  {
    title: '8 Data Structures That Power Your Databases',
    url: 'https://bytebytego.com/guides/8-data-structures-that-power-your-databases/',
    description:
      'ByteByteGo — as 8 estruturas que aparecem por dentro de DBs: B-Tree, LSM, skiplist, hash index, SSTable, bloom filter, inverted index, R-tree.',
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 12,
    topicSlugs: ['databases'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'Guide — ByteByteGo',
    tags: ['concept', 'data-structures', 'b-tree', 'lsm-tree', 'bloom-filter'],
  },
  {
    title: 'Database Pages — A Deep Dive',
    url: 'https://medium.com/@hnasr/database-pages-a-deep-dive-38cdb2c79eb5',
    description:
      'Hussein Nasser (Medium) — storage físico: por que DBs usam páginas de tamanho fixo, layout de row, tuple headers, slotted pages.',
    format: 'ARTICLE',
    difficulty: 'HARD',
    estimatedMinutes: 10,
    topicSlugs: ['databases'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'Medium — Hussein Nasser',
    tags: ['concept', 'pages', 'storage', 'rows', 'internals'],
  },
  {
    title: 'Why Netflix, Instagram, and Twitter Pick Different Databases',
    url: 'https://www.youtube.com/watch?v=XjHZCprrEgk',
    description:
      'ByteMonk — comparativo das escolhas de banco de Netflix, Instagram e Twitter e os trade-offs por trás: padrão de leitura/escrita, escala e consistência.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 11,
    topicSlugs: ['databases'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteMonk',
    tags: ['case-study', 'database-selection', 'netflix', 'instagram', 'twitter'],
  },

  // ---------------------------------------------------------------------------
  // array (7 items) — 2026-04-19
  // ---------------------------------------------------------------------------
  {
    title: 'Array Map in 100 Seconds',
    url: 'https://www.youtube.com/watch?v=DC471a9qrU4',
    description:
      'Fireship — .map() do JavaScript em 100s.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 2,
    topicSlugs: ['array'],
    tracks: [],
    source: 'YouTube — Fireship',
    tags: ['practice', 'javascript', 'map', 'fireship'],
  },
  {
    title: 'Arrays in Programming — Fundamentals',
    url: 'https://www.youtube.com/watch?v=5tPLyHCZdU0',
    description:
      'mycodeschool — array na memória, indexing, static vs dynamic. Whiteboard puro.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 11,
    topicSlugs: ['array'],
    tracks: [],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'memory', 'indexing', 'static-vs-dynamic'],
  },
  {
    title: 'Data Structures: Arrays vs Linked Lists',
    url: 'https://www.youtube.com/watch?v=lC-yYCOnN8Q',
    description:
      'mycodeschool — array vs linked list em cada operação (acesso, inserção, busca) com custo explícito.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 13,
    topicSlugs: ['array'],
    tracks: [],
    source: 'YouTube — mycodeschool',
    tags: ['tradeoffs', 'linked-list', 'operations', 'complexity'],
  },
  {
    title: 'Implementando um hashmap do ZERO em Python',
    url: 'https://www.youtube.com/watch?v=J4ELMYEGVS0',
    description:
      'Augusto Galego — implementação de hashmap em Python do zero: hash function, buckets, collision via chaining, resize quando o load factor estoura.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 13,
    topicSlugs: ['hashmap', 'array'],
    tracks: [],
    source: 'YouTube — Augusto Galego',
    tags: ['practice', 'hashmap', 'python', 'implementation', 'collision', 'galego'],
  },
  {
    title: '10 Key Data Structures We Use Every Day',
    url: 'https://blog.bytebytego.com/p/ep58-10-key-data-structures-we-use',
    description:
      'ByteByteGo — as 10 ED que todo dev bate na semana: array, hashmap, linked list, stack, queue, tree, graph, e mais.',
    format: 'ARTICLE',
    difficulty: 'EASY',
    estimatedMinutes: 10,
    // First cross-topic item: primary = array (indexed/keyed family), cover = lists.
    // Once `tree` and `graph` are populated, add them as covers too.
    topicSlugs: ['array', 'lists'],
    tracks: [],
    source: 'Blog — ByteByteGo',
    tags: ['concept', 'data-structures', 'overview', 'hashmap'],
  },
  {
    title: 'Grokking Data Structures — Arrays (chapter)',
    url: 'https://github.com/mlarocca/grokking_data_structures',
    description:
      'Capítulo de arrays do Grokking Data Structures (La Rocca, Manning). Static vs dynamic, memory layout, resize amortizado. Livro pago — ver biblioteca da Inteli ou Manning. O GitHub tem só o código de apoio, não o PDF.',
    format: 'BOOK',
    difficulty: 'MEDIUM',
    estimatedMinutes: 25,
    topicSlugs: ['array'],
    tracks: [],
    source: 'Book — Grokking Data Structures',
    tags: ['concept', 'book', 'grokking', 'array', 'static-vs-dynamic'],
  },

  // ---------------------------------------------------------------------------
  // lists (8 items) — 2026-04-19
  // Linked lists + stacks + queues. mycodeschool is the anchor channel —
  // whiteboard-pure, canonical for these DS. Augusto Galego adds PT-BR
  // practice-oriented material tied to classic LC problems.
  // ---------------------------------------------------------------------------
  {
    title: 'Introduction to Linked List',
    url: 'https://www.youtube.com/watch?v=NobHlGUjV3g',
    description:
      'mycodeschool — linked list do zero: por que não array, nós + ponteiros, memory layout. Whiteboard puro.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 18,
    topicSlugs: ['lists'],
    tracks: [],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'linked-list', 'pointers', 'memory-layout'],
  },
  {
    title: 'Introduction to Doubly Linked List',
    url: 'https://www.youtube.com/watch?v=JdQeNxWCguQ',
    description:
      'mycodeschool — linked list com dois ponteiros (forward + back). Custo extra de memória vs inserção/remoção bidirecional barata.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 8,
    topicSlugs: ['lists'],
    tracks: [],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'doubly-linked-list', 'pointers'],
  },
  {
    title: 'Linked List in C/C++ — Inserting a node at beginning',
    url: 'https://www.youtube.com/watch?v=cAZ8CyDY56s',
    description:
      'mycodeschool — inserir no começo da linked list: mover head + novo nó. Diagrama + pseudocódigo em C.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 13,
    topicSlugs: ['lists'],
    tracks: [],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'linked-list', 'insertion', 'pointers'],
  },
  {
    title: 'Introduction to Stack',
    url: 'https://www.youtube.com/watch?v=F1F2imiOJfk',
    description:
      'mycodeschool — stack (LIFO): push/pop/peek, overflow/underflow, com exemplos reais (function calls, undo, parsing).',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 9,
    topicSlugs: ['lists'],
    tracks: [],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'stack', 'lifo', 'push-pop'],
  },
  {
    title: 'Como Rodar uma Linked List?',
    url: 'https://www.youtube.com/watch?v=-BU34jnMasc',
    description:
      'Augusto Galego — traversal de linked list em Python: current + current.next até cair em null.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 8,
    topicSlugs: ['lists'],
    tracks: [],
    source: 'YouTube — Augusto Galego',
    tags: ['practice', 'linked-list', 'traversal', 'python'],
  },
  {
    title: 'Como inverter uma Linked List (LeetCode 206)',
    url: 'https://www.youtube.com/watch?v=8kmAY2O4SBg',
    description:
      'Augusto Galego — LC 206 (reverse linked list) iterativo com três ponteiros: prev, curr, next.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 5,
    topicSlugs: ['lists'],
    tracks: [],
    source: 'YouTube — Augusto Galego',
    tags: ['concept', 'linked-list', 'reverse', 'leetcode-206', 'iterative'],
  },
  {
    title: 'Linked List implementation of Queue',
    url: 'https://www.youtube.com/watch?v=A5_XdiK4J8A',
    description:
      'mycodeschool — queue (FIFO) com enqueue/dequeue O(1) construída em cima de linked list.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 15,
    topicSlugs: ['lists'],
    tracks: [],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'queue', 'linked-list', 'fifo', 'composition'],
  },
  {
    title: 'Grokking Data Structures — Linked Lists (chapter)',
    url: 'https://github.com/mlarocca/grokking_data_structures',
    description:
      'Capítulo de linked lists do Grokking Data Structures (La Rocca, Manning). Single vs doubly, manipulação de ponteiros, operações fundamentais. Livro pago — ver biblioteca da Inteli ou Manning. O GitHub tem só o código de apoio, não o PDF.',
    format: 'BOOK',
    difficulty: 'MEDIUM',
    estimatedMinutes: 25,
    topicSlugs: ['lists'],
    tracks: [],
    source: 'Book — Grokking Data Structures',
    tags: ['concept', 'book', 'grokking', 'linked-list'],
  },

  // ---------------------------------------------------------------------------
  // tree (8 items) — 2026-04-19
  // Third básicos-de-algos topic after array + lists. mycodeschool anchors the
  // fundamentals (intro → binary tree → BST), Back To Back SWE layers
  // traversals + AVL rotations. Fireship "5 wild data structures" is the
  // cross-topic entry (covers tree/array/databases). B-Tree vs LSM-Tree bridges
  // to databases for the storage-engine angle.
  // ---------------------------------------------------------------------------
  {
    title: '5 wild data structures every developer should know',
    url: 'https://www.youtube.com/watch?v=6fnmXX8RK0s',
    description:
      'Fireship — 5 ED que você não vê na graduação: B-tree, radix tree, rope, bloom filter, cuckoo hashing.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 5,
    topicSlugs: ['tree', 'array', 'databases', 'trie'],
    tracks: [],
    source: 'YouTube — Fireship',
    tags: ['concept', 'b-tree', 'radix-tree', 'rope', 'bloom-filter', 'cuckoo-hashing', 'fireship'],
  },
  {
    title: 'Data structures: Introduction to Trees',
    url: 'https://www.youtube.com/watch?v=qH6yxkw0u78',
    description:
      'mycodeschool — árvores do zero: terminologia (root, leaf, parent, child, depth, height), representação em memória, quando tree ganha de array/list.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 16,
    topicSlugs: ['tree'],
    tracks: [],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'tree', 'terminology', 'fundamentals'],
  },
  {
    title: 'Data structures: Binary Tree',
    url: 'https://www.youtube.com/watch?v=H5JubkIy_p8',
    description:
      'mycodeschool — binary tree: max nodes por nível, strictly/complete/perfect/balanced, altura mín/máx.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 17,
    topicSlugs: ['tree'],
    tracks: [],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'binary-tree', 'complete-tree', 'perfect-tree'],
  },
  {
    title: 'Data structures: Binary Search Tree',
    url: 'https://www.youtube.com/watch?v=pYT9F8_LFTM',
    description:
      'mycodeschool — BST: invariante left < root < right, operações O(log n) quando balanceada, O(n) quando degenera.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 20,
    topicSlugs: ['tree'],
    tracks: [],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'bst', 'binary-search-tree', 'operations'],
  },
  {
    title: 'Binary Tree Bootcamp: Full, Complete, & Perfect Trees + Traversals',
    url: 'https://www.youtube.com/watch?v=BHB0B1jFKQc',
    description:
      'Back To Back SWE — full/complete/perfect + os 3 DFS traversals (preorder/inorder/postorder) animados. Quase todo LC de árvore cai num desses.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 20,
    topicSlugs: ['tree'],
    tracks: [],
    source: 'YouTube — Back To Back SWE',
    tags: ['concept', 'traversal', 'preorder', 'inorder', 'postorder', 'dfs'],
  },
  {
    title: 'AVL Trees & Rotations (Self-Balancing Binary Search Trees)',
    url: 'https://www.youtube.com/watch?v=vRwi_UcZGjU',
    description:
      'Back To Back SWE — como BSTs desbalanceiam, fator de balanceamento e as 4 rotações (LL/RR/LR/RL) pra restaurar O(log n).',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 21,
    topicSlugs: ['tree'],
    tracks: [],
    source: 'YouTube — Back To Back SWE',
    tags: ['concept', 'avl-tree', 'self-balancing', 'rotations', 'bst'],
  },
  {
    title: 'B-Tree vs. LSM-Tree',
    url: 'https://bytebytego.com/guides/b-tree-vs/',
    description:
      'ByteByteGo — B-Tree (Postgres, MySQL) vs LSM-Tree (Cassandra, RocksDB): read vs write, write amplification, compaction.',
    format: 'ARTICLE',
    difficulty: 'HARD',
    estimatedMinutes: 12,
    topicSlugs: ['tree', 'databases'],
    tracks: [],
    source: 'Guide — ByteByteGo',
    tags: ['tradeoffs', 'b-tree', 'lsm-tree', 'storage-engine', 'write-amplification'],
  },
  {
    title: 'Grokking Data Structures — Trees (chapter)',
    url: 'https://github.com/mlarocca/grokking_data_structures',
    description:
      'Capítulo de trees do Grokking Data Structures (La Rocca, Manning). Binary trees, BSTs, traversals, balanced trees no estilo visual-heavy do livro. Livro pago — ver biblioteca da Inteli ou Manning. O GitHub tem só o código de apoio, não o PDF.',
    format: 'BOOK',
    difficulty: 'MEDIUM',
    estimatedMinutes: 25,
    topicSlugs: ['tree'],
    tracks: [],
    source: 'Book — Grokking Data Structures',
    tags: ['concept', 'book', 'grokking', 'tree', 'bst'],
  },
  {
    title: 'Binary Tree Inorder e Preorder',
    url: 'https://www.youtube.com/watch?v=kdSrjg9N1Yg',
    description:
      'Augusto Galego — inorder e preorder traversal em Python resolvendo um LeetCode. 6min direto pro código.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 6,
    topicSlugs: ['tree'],
    tracks: [],
    source: 'YouTube — Augusto Galego',
    tags: ['practice', 'tree', 'inorder', 'preorder', 'traversal', 'leetcode'],
  },

  // ---------------------------------------------------------------------------
  // sorting (6 items) — 2026-04-19
  // Diversified beyond the default mycodeschool anchor: Augusto Galego (BR)
  // carries the Python implementation angle for merge+quick, mycodeschool
  // covers the canonical whiteboard intro/selection/quicksort-analysis, and
  // Grokking Algorithms (Bhargava) provides the illustrated book chapter.
  // Big-O como prerequisito vive em foundations (Lucas Montano), não aqui.
  // ---------------------------------------------------------------------------
  {
    title: 'Introduction to sorting algorithms',
    url: 'https://www.youtube.com/watch?v=pkkFqlG0Hds',
    description:
      'mycodeschool — por que ordenar, comparison-based vs non-comparison, primeiro contato com bubble sort. Whiteboard puro.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 9,
    topicSlugs: ['sorting'],
    tracks: [],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'sorting', 'bubble-sort', 'fundamentals'],
  },
  {
    title: 'Selection sort algorithm',
    url: 'https://www.youtube.com/watch?v=GUDLRan2DWM',
    description:
      'mycodeschool — selection sort em diagrama: escolhe o mínimo e troca. Análise O(n²) com número exato de comparações/trocas.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 11,
    topicSlugs: ['sorting'],
    tracks: [],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'selection-sort', 'complexity'],
  },
  {
    title: 'Algoritmo MergeSort Explicado',
    url: 'https://www.youtube.com/watch?v=a5LfKZp34d8',
    description:
      'Augusto Galego — merge sort em Python: recursão que divide ao meio + merge de dois arrays ordenados.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 15,
    topicSlugs: ['sorting'],
    tracks: [],
    source: 'YouTube — Augusto Galego',
    tags: ['practice', 'merge-sort', 'divide-and-conquer', 'python', 'pt-br'],
  },
  {
    title: 'Quicksort: Implementação e Explicação',
    url: 'https://www.youtube.com/watch?v=nV_WE8SEuGE',
    description:
      'Augusto Galego — quicksort em Python: escolha de pivô, partição, recursão.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 12,
    topicSlugs: ['sorting'],
    tracks: [],
    source: 'YouTube — Augusto Galego',
    tags: ['practice', 'quicksort', 'partition', 'python', 'pt-br'],
  },
  {
    title: 'Analysis of quicksort',
    url: 'https://www.youtube.com/watch?v=3Bbm3Prd5Fo',
    description:
      'mycodeschool — análise do quicksort: caso médio O(n log n), pior caso O(n²), sensibilidade ao pivô, por que random quicksort funciona.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 21,
    topicSlugs: ['sorting'],
    tracks: [],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'quicksort', 'analysis', 'complexity', 'average-case'],
  },
  {
    title: 'Grokking Algorithms — Quicksort (chapter 4)',
    url: 'https://github.com/egonSchiele/grokking_algorithms',
    description:
      'Capítulo 4 do Grokking Algorithms / Entendendo Algoritmos (Bhargava, Manning). Divide-and-conquer + quicksort no estilo cartoon do livro. Livro pago — ver biblioteca da Inteli ou Manning. O GitHub (do próprio autor) tem só o código de apoio, não o PDF.',
    format: 'BOOK',
    difficulty: 'MEDIUM',
    estimatedMinutes: 25,
    topicSlugs: ['sorting'],
    tracks: [],
    source: 'Book — Grokking Algorithms',
    tags: ['concept', 'book', 'grokking', 'quicksort', 'divide-and-conquer'],
  },

  // ---------------------------------------------------------------------------
  // Arthur Takeda (@arthur.takeda) — 9 items across SD + fundamentos — 2026-04-19
  // Davi: "liste todos os videos dele, quero colocar o maximo de videos dele
  // possiveis ja". Channel is BR conceitual (8-12min sweet spot). This batch
  // seeds SD #1-5 canonical series + fundamentals (Docker, auth, AWS, VPN).
  // Tracks: BIG_TECH + CONSULTING_TECH for SD, plus STARTUP for fundamentos
  // (universais: containers/cloud/security/networking).
  // ---------------------------------------------------------------------------
  {
    title: 'O Dilema da Computação — System Design #1',
    url: 'https://www.youtube.com/watch?v=g9DfXmDfE_Q',
    description:
      'Arthur Takeda — abertura da série de SD: por que todo sistema faz trade-off entre consistência, disponibilidade e tolerância a partição. CAP em 8min.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 8,
    topicSlugs: ['cap-consistency', 'reliability'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Arthur Takeda',
    tags: ['concept', 'cap-theorem', 'consistency', 'availability', 'partition-tolerance', 'pt-br'],
  },
  {
    title: 'A Arte de Não Quebrar Seu App — System Design #2',
    url: 'https://www.youtube.com/watch?v=Xiod8w7QtQ4',
    description:
      'Arthur Takeda — reliability em 12min: failure modes, redundância, graceful degradation. Por que "o app caiu" quase sempre é falha arquitetural, não bug de código.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 12,
    topicSlugs: ['reliability'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Arthur Takeda',
    tags: ['concept', 'reliability', 'uptime', 'failure-modes', 'redundancy', 'pt-br'],
  },
  {
    title: 'Cache — System Design #3',
    url: 'https://www.youtube.com/watch?v=i3Y2NmCGfuA',
    description:
      'Arthur Takeda — cache em 8min: por que, onde e como cachear. Versão BR do tópico.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 8,
    topicSlugs: ['caching'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Arthur Takeda',
    tags: ['concept', 'cache', 'system-design', 'pt-br'],
  },
  {
    title: 'Relacional vs Não-Relacional — System Design #4',
    url: 'https://www.youtube.com/watch?v=ILt31254Up4',
    description:
      'Arthur Takeda — SQL vs NoSQL em 8min: quando usar cada um, schema rígido vs flexível, JOIN vs denormalização.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 8,
    topicSlugs: ['databases'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Arthur Takeda',
    tags: ['tradeoffs', 'sql', 'nosql', 'relational', 'document', 'pt-br'],
  },
  {
    title: 'Como Escalar Banco de Dados? — System Design #5',
    url: 'https://www.youtube.com/watch?v=czMY_ATOej0',
    description:
      'Arthur Takeda — sharding + replicação em 8min: vertical vs horizontal, leader-follower, particionamento.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 8,
    topicSlugs: ['sharding', 'replication', 'databases'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Arthur Takeda',
    tags: ['concept', 'sharding', 'replication', 'scaling', 'horizontal-scale', 'pt-br'],
  },
  {
    title: 'Docker Explicado em 8 Minutos',
    url: 'https://www.youtube.com/watch?v=jftIzkXbKKY',
    description:
      'Arthur Takeda — Docker do zero: imagens vs containers, layers, networking básico, por que "funciona na minha máquina" deixou de ser desculpa.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 9,
    topicSlugs: ['containers'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Arthur Takeda',
    tags: ['concept', 'docker', 'containers', 'intro', 'pt-br'],
  },
  {
    title: 'Autenticação Moderna em 20 Minutos',
    url: 'https://www.youtube.com/watch?v=uLY1CuLi9ac',
    description:
      'Arthur Takeda — auth em 20min: sessões vs tokens, OAuth 2.0, JWT, refresh tokens, MFA, por que "hash simples de senha" é ruim.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 20,
    topicSlugs: ['security'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Arthur Takeda',
    tags: ['concept', 'authentication', 'oauth', 'jwt', 'mfa', 'pt-br'],
  },
  {
    title: 'AWS do Zero: Os Únicos Serviços que Você Precisa Conhecer',
    url: 'https://www.youtube.com/watch?v=8chgJEuDzYM',
    description:
      'Arthur Takeda — AWS em 18min: EC2, S3, RDS, Lambda, CloudFront, IAM. Os serviços que aparecem em 95% dos projetos.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 18,
    topicSlugs: ['cloud'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Arthur Takeda',
    tags: ['practice', 'aws', 'cloud', 'ec2', 's3', 'lambda', 'pt-br'],
  },
  {
    title: 'A Mentira do "100% Anônimo" das VPNs',
    url: 'https://www.youtube.com/watch?v=idD_vk3bTCQ',
    description:
      'Arthur Takeda — como VPN realmente funciona em 8min: túnel IP, DNS leaks, o provedor virando o novo middleman.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 8,
    topicSlugs: ['networking', 'security'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Arthur Takeda',
    tags: ['tradeoffs', 'vpn', 'privacy', 'dns', 'networking', 'pt-br'],
  },
  {
    title: '10 Conceitos-Base de Computação Que Você Precisa Saber',
    url: 'https://www.youtube.com/watch?v=zLV586SXHsU',
    description:
      'Arthur Takeda — 10 fundamentos que qualquer dev precisa ter internalizado: binário, memória, CPU, file system, processos, threads, concorrência. Davi: "primeiro item que qualquer membro novo deve consumir antes de atacar a trilha dele".',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 11,
    topicSlugs: ['foundations'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Arthur Takeda',
    tags: ['concept', 'fundamentals', 'computer-science', 'onboarding', 'first-study', 'pt-br'],
  },
  {
    title: 'Saber Isso Te Faz Um Dev MUITO Melhor (Design Patterns)',
    url: 'https://www.youtube.com/watch?v=G-O90vR7SCU',
    description:
      'Arthur Takeda — Design Patterns em 11min: por que padrões importam, GoF (Gang of Four), exemplos (Observer, Factory, Strategy, Singleton).',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 11,
    topicSlugs: ['design-patterns'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Arthur Takeda',
    tags: ['concept', 'design-patterns', 'gof', 'oop', 'pt-br'],
  },

  // ---------------------------------------------------------------------------
  // FOUNDATIONS — onboarding universal da primeira semana.
  // Ferramentas e plataformas que todo membro usa: LeetCode, Git/GitHub, Bash.
  // Tracks vazias (universal) exceto quando o item é track-específico.
  // ---------------------------------------------------------------------------
  {
    title: 'LeetCode vai te fazer melhorar como dev?',
    url: 'https://www.youtube.com/watch?v=6FK5nCbrvYw',
    description:
      'Augusto Galego — o que é LeetCode, por que o mercado usa em entrevista e quando (de fato) vale grindar. 8min, sem resolver problema aqui, só o mapa.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 8,
    topicSlugs: ['foundations'],
    tracks: [],
    source: 'YouTube — Augusto Galego',
    tags: ['concept', 'leetcode', 'interview-prep', 'onboarding', 'pt-br'],
  },
  {
    title: 'Big O Notation: O Pesadelo do Programador Iniciante',
    url: 'https://www.youtube.com/watch?v=GLKDo13920k',
    description:
      'Lucas Montano — Big-O em 14min. O vocabulário universal pra comparar O(n²) vs O(n log n). Skippable pra quem já tem a intuição.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 14,
    topicSlugs: ['foundations'],
    tracks: [],
    source: 'YouTube — Lucas Montano',
    tags: ['concept', 'big-o', 'complexity', 'prerequisite', 'onboarding', 'pt-br'],
  },
  {
    title: 'Git Explained in 100 Seconds',
    url: 'https://www.youtube.com/watch?v=hwP7WQkmECE',
    description: 'Fireship — init, add, commit, branch, merge em 2min.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 2,
    topicSlugs: ['foundations'],
    tracks: [],
    source: 'YouTube — Fireship',
    tags: ['practice', 'git', 'onboarding', 'fireship'],
  },
  {
    title: 'GitHub Pull Request in 100 Seconds',
    url: 'https://www.youtube.com/watch?v=8lGpZkjnkt4',
    description: 'Fireship — fork, branch, commit, abrir PR. O fluxo de contribuir em repo alheio.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 2,
    topicSlugs: ['foundations'],
    tracks: [],
    source: 'YouTube — Fireship',
    tags: ['practice', 'github', 'pull-request', 'onboarding', 'fireship'],
  },
  {
    title: 'Bash in 100 Seconds',
    url: 'https://www.youtube.com/watch?v=I4EWvMFj37g',
    description: 'Fireship — cd, ls, pipes, variáveis de ambiente.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 3,
    topicSlugs: ['foundations'],
    tracks: [],
    source: 'YouTube — Fireship',
    tags: ['practice', 'bash', 'terminal', 'cli', 'onboarding', 'fireship'],
  },

  // ---------------------------------------------------------------------------
  // HASHMAP — ED canônica pra interview prep.
  // ---------------------------------------------------------------------------
  {
    title: 'Two Sum - Leetcode 1 - HashMap - Python',
    url: 'https://www.youtube.com/watch?v=KLlXCFG5TnA',
    description:
      'NeetCode — Two Sum no LeetCode: lê o enunciado, tenta bruteforce O(n²), otimiza com hashmap pra O(n).',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 9,
    topicSlugs: ['hashmap'],
    tracks: [],
    source: 'YouTube — NeetCode',
    tags: ['concept', 'hashmap', 'two-sum', 'leetcode', 'neetcode'],
  },
  {
    title: 'I ACED my Technical Interviews knowing these System Design Basics',
    url: 'https://www.youtube.com/watch?v=FxAom29OEKE',
    description:
      "Kiki's Bytes — passa de um servidor único pra sistema escalável: load balancing, cache, SQL vs NoSQL, CAP theorem.",
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 10,
    topicSlugs: ['scalability', 'load-balancers', 'cap-consistency'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: "YouTube — Kiki's Bytes",
    tags: ['concept', 'system-design-overview', 'load-balancing', 'caching', 'cap-theorem', 'sql-vs-nosql'],
  },

  // ---------------------------------------------------------------------------
  // heap (5 items) — 2026-04-25
  // ---------------------------------------------------------------------------
  {
    title: 'Substituir array por HEAP???',
    url: 'https://www.youtube.com/watch?v=4Gr4LozxccY',
    description:
      'Augusto Galego — quando trocar array por heap em Python: heapq na biblioteca padrão, custo O(log n) pra extract-min vs O(n) na busca em array.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 7,
    topicSlugs: ['heap'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Augusto Galego',
    tags: ['concept', 'heap', 'heapq', 'python', 'galego'],
  },
  {
    title: 'Implement A Binary Heap — An Efficient Implementation of The Priority Queue ADT',
    url: 'https://www.youtube.com/watch?v=g9YK6sftDi0',
    description:
      'Back to Back SWE — implementação de binary heap como priority queue: insert, extract-min, heapify, índice pai/filho num array.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 21,
    topicSlugs: ['heap'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Back To Back SWE',
    tags: ['concept', 'binary-heap', 'priority-queue', 'heapify', 'min-heap', 'max-heap'],
  },
  {
    title: 'Merge K Sorted Arrays — Min Heap Algorithm',
    url: 'https://www.youtube.com/watch?v=ptYUCjfNhJY',
    description:
      'Back to Back SWE — merge K listas ordenadas com min-heap: complexidade O(N log K), por que ganha do merge linear.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 12,
    topicSlugs: ['heap'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Back To Back SWE',
    tags: ['concept', 'merge-k-sorted', 'min-heap', 'priority-queue', 'interview'],
  },
  {
    title: "Find the k'th Largest or Smallest Element of an Array: From Sorting To Heaps To Partitioning",
    url: 'https://www.youtube.com/watch?v=hGK_5n81drs',
    description:
      'Back to Back SWE — três abordagens pro k-ésimo maior: sort O(n log n), min-heap de tamanho k O(n log k), quickselect O(n) médio. 30min comparando.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 30,
    topicSlugs: ['heap', 'sorting'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Back To Back SWE',
    tags: ['concept', 'kth-largest', 'min-heap', 'quickselect', 'partitioning', 'interview'],
  },
  {
    title: 'Grokking Data Structures — Heaps (chapter)',
    url: 'https://github.com/mlarocca/grokking_data_structures',
    description:
      'Capítulo de heaps do Grokking Data Structures (La Rocca, Manning). Representação em array, sift-up/sift-down, priority queue. Livro pago — ver biblioteca da Inteli ou Manning. O GitHub tem só o código de apoio, não o PDF.',
    format: 'BOOK',
    difficulty: 'MEDIUM',
    estimatedMinutes: 25,
    topicSlugs: ['heap'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'Book — Grokking Data Structures',
    tags: ['concept', 'book', 'grokking', 'heap', 'priority-queue'],
  },

  // ---------------------------------------------------------------------------
  // graph (7 items) — 2026-04-25
  // ---------------------------------------------------------------------------
  {
    title: 'Data structures: Introduction to graphs',
    url: 'https://www.youtube.com/watch?v=gXgEDyodOJU',
    description:
      'mycodeschool — graphs do zero: vertex, edge, directed/undirected, weighted/unweighted, ciclos e conexão.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 17,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'graph', 'terminology', 'fundamentals'],
  },
  {
    title: 'Graph Representation part 02 — Adjacency Matrix',
    url: 'https://www.youtube.com/watch?v=9C2cpQZVRBA',
    description:
      'mycodeschool — adjacency matrix como representação: matriz V×V, custo O(V²) de memória, lookup O(1) pra checar aresta.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 15,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'graph', 'adjacency-matrix', 'representation'],
  },
  {
    title: 'Breadth First Search (BFS): Visualized and Explained',
    url: 'https://www.youtube.com/watch?v=xlVX7dXLS64',
    description:
      'Reducible — BFS visualizado: queue, visita level-by-level, animação passo a passo.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 11,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Reducible',
    tags: ['concept', 'graph', 'bfs', 'queue', 'visualization'],
  },
  {
    title: 'Depth First Search Algorithm | Graph Theory',
    url: 'https://www.youtube.com/watch?v=7fujbpJ0LB4',
    description:
      'William Fiset — DFS no grafo: stack/recursão, ordem de visita, grafo conectado vs desconectado.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 11,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — William Fiset',
    tags: ['concept', 'graph', 'dfs', 'recursion', 'stack'],
  },
  {
    title: "Dijkstra's Shortest Path Algorithm | Graph Theory",
    url: 'https://www.youtube.com/watch?v=pSqmAO-m7Lk',
    description:
      'William Fiset — Dijkstra com priority queue: caminho mais curto em grafos com pesos não-negativos. 25min.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 25,
    topicSlugs: ['graph', 'heap'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — William Fiset',
    tags: ['concept', 'graph', 'dijkstra', 'shortest-path', 'priority-queue'],
  },
  {
    title: "Topological Sort | Kahn's Algorithm | Graph Theory",
    url: 'https://www.youtube.com/watch?v=cIBFEhD77b4',
    description:
      "William Fiset — topological sort com Kahn's: DAGs e ordem que respeita dependências, BFS modificada.",
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 14,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — William Fiset',
    tags: ['concept', 'graph', 'topological-sort', 'dag', 'kahn'],
  },
  {
    title: 'Grokking Algorithms — Breadth-First Search (chapter)',
    url: 'https://github.com/egonSchiele/grokking_algorithms',
    description:
      'Capítulo de BFS do Grokking Algorithms (Bhargava, Manning). Queue, shortest path em grafos não-pesados, exemplo de busca de amigos. Livro pago — ver biblioteca da Inteli ou Manning. O GitHub tem só o código de apoio, não o PDF.',
    format: 'BOOK',
    difficulty: 'MEDIUM',
    estimatedMinutes: 25,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'Book — Grokking Algorithms',
    tags: ['concept', 'book', 'grokking', 'graph', 'bfs'],
  },
  {
    title: "Grokking Algorithms — Dijkstra's Algorithm (chapter)",
    url: 'https://github.com/egonSchiele/grokking_algorithms',
    description:
      "Capítulo de Dijkstra do Grokking Algorithms (Bhargava, Manning). Caminho mais curto em grafos com pesos não-negativos, exemplo do mapa de São Francisco. Livro pago — ver biblioteca da Inteli ou Manning. O GitHub tem só o código de apoio, não o PDF.",
    format: 'BOOK',
    difficulty: 'MEDIUM',
    estimatedMinutes: 25,
    topicSlugs: ['graph', 'heap'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'Book — Grokking Algorithms',
    tags: ['concept', 'book', 'grokking', 'graph', 'dijkstra', 'shortest-path'],
  },

  // ---------------------------------------------------------------------------
  // searching (6 items) — 2026-04-25
  // ---------------------------------------------------------------------------
  {
    title: 'Binary Search em 5 minutos',
    url: 'https://www.youtube.com/watch?v=zSyV0VaTF3k',
    description:
      'Augusto Galego — binary search em 5min: meio do array ordenado, descarta metade a cada passo, O(log n).',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 5,
    topicSlugs: ['searching'],
    tracks: [],
    source: 'YouTube — Augusto Galego',
    tags: ['concept', 'binary-search', 'galego'],
  },
  {
    title: 'What is binary search',
    url: 'https://www.youtube.com/watch?v=j5uXyPJ0Pew',
    description:
      'mycodeschool — binary search do zero: por que requer array ordenado, intuição do meio, complexidade O(log n).',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 13,
    topicSlugs: ['searching'],
    tracks: [],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'binary-search', 'fundamentals'],
  },
  {
    title: 'Binary Search — Iterative Implementation and common errors',
    url: 'https://www.youtube.com/watch?v=OAZc1zwjERU',
    description:
      'mycodeschool — binary search iterativo: low/high/mid, integer overflow no cálculo de mid, erros off-by-one comuns.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 11,
    topicSlugs: ['searching'],
    tracks: [],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'binary-search', 'iterative', 'overflow', 'off-by-one'],
  },
  {
    title: 'Binary search — finding first or last occurrence of a number',
    url: 'https://www.youtube.com/watch?v=OE7wUUpJw6I',
    description:
      'mycodeschool — variante: achar primeira ou última ocorrência num array com duplicatas, ajuste do passo após encontrar.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 11,
    topicSlugs: ['searching'],
    tracks: [],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'binary-search', 'duplicates', 'first-last-occurrence'],
  },
  {
    title: 'Total Occurrences Of K In A Sorted Array (Facebook Software Engineering Interview Question)',
    url: 'https://www.youtube.com/watch?v=RlXtTF34nnE',
    description:
      'Back to Back SWE — combinação de duas binary searches pra contar quantas vezes K aparece num array ordenado. Pergunta de entrevista do Facebook.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 14,
    topicSlugs: ['searching'],
    tracks: [],
    source: 'YouTube — Back To Back SWE',
    tags: ['concept', 'binary-search', 'duplicates', 'interview', 'facebook'],
  },
  {
    title: 'Grokking Algorithms — Binary Search (chapter 1)',
    url: 'https://github.com/egonSchiele/grokking_algorithms',
    description:
      'Capítulo 1 do Grokking Algorithms (Bhargava, Manning). Binary search com exemplos visuais, comparação com busca linear, complexidade. Livro pago — ver biblioteca da Inteli ou Manning. O GitHub tem só o código de apoio, não o PDF.',
    format: 'BOOK',
    difficulty: 'MEDIUM',
    estimatedMinutes: 20,
    topicSlugs: ['searching'],
    tracks: [],
    source: 'Book — Grokking Algorithms',
    tags: ['concept', 'book', 'grokking', 'binary-search'],
  },

  // ---------------------------------------------------------------------------
  // recursion (1 item) — 2026-04-25
  // ---------------------------------------------------------------------------
  {
    title: 'Algoritmo de Torre de Hanoi Explicado',
    url: 'https://www.youtube.com/watch?v=Ug6hIyn3txE',
    description:
      'Augusto Galego — Tower of Hanoi: por que recursão é a forma natural, T(n) = 2T(n-1) + 1.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 16,
    topicSlugs: ['recursion'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Augusto Galego',
    tags: ['concept', 'recursion', 'tower-of-hanoi', 'galego'],
  },

  // ---------------------------------------------------------------------------
  // dp (7 items) — 2026-04-25
  // ---------------------------------------------------------------------------
  {
    title: 'Fibonacci Sequence — Recursion with memoization',
    url: 'https://www.youtube.com/watch?v=UxICsjrdlJA',
    description:
      'mycodeschool — Fibonacci com memoization: cache dos resultados intermediários, reduz O(2^n) recursivo pra O(n) com tradeoff de memória.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 9,
    topicSlugs: ['dp', 'recursion'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'dp', 'memoization', 'fibonacci', 'recursion-to-dp'],
  },
  {
    title: 'Dynamic Programming | Leetcode 70 (Climbing Stairs)',
    url: 'https://www.youtube.com/watch?v=sBZtJs0WmgQ',
    description:
      'Augusto Galego — climbing stairs (LC 70) com DP: identificar o subproblema e construir bottom-up.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 8,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Augusto Galego',
    tags: ['concept', 'dp', 'climbing-stairs', 'leetcode-70', 'galego'],
  },
  {
    title: 'Top 5 Dynamic Programming Patterns for Coding Interviews — For Beginners',
    url: 'https://www.youtube.com/watch?v=mBNrRy2_hVs',
    description:
      'NeetCode — os 5 padrões de DP que mais aparecem em entrevistas: 1D, 2D, knapsack, decisão, intervalos. 29min.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 29,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — NeetCode',
    tags: ['concept', 'dp', 'patterns', 'overview', 'neetcode'],
  },
  {
    title: 'The Recursive Staircase — Top Down & Bottom Up Dynamic Programming',
    url: 'https://www.youtube.com/watch?v=NFJ3m9a1oJQ',
    description:
      'Back to Back SWE — recursive staircase com top-down (memoization) e bottom-up (tabulation), as duas abordagens lado a lado.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 20,
    topicSlugs: ['dp', 'recursion'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Back To Back SWE',
    tags: ['concept', 'dp', 'top-down', 'bottom-up', 'staircase', 'memoization', 'tabulation'],
  },
  {
    title: 'The 0/1 Knapsack Problem (Demystifying Dynamic Programming)',
    url: 'https://www.youtube.com/watch?v=xCbYmUPvc2Q',
    description:
      'Back to Back SWE — 0/1 Knapsack: tabela 2D itens × capacidade, decisão pegar ou não a cada passo.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 21,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Back To Back SWE',
    tags: ['concept', 'dp', '0-1-knapsack', '2d-dp', 'classic'],
  },
  {
    title: 'Edit Distance Between 2 Strings — The Levenshtein Distance',
    url: 'https://www.youtube.com/watch?v=MiqoA-yF-0M',
    description:
      'Back to Back SWE — Levenshtein/Edit Distance: tabela 2D, três operações (insert, delete, replace) custam 1 cada.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 17,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Back To Back SWE',
    tags: ['concept', 'dp', 'edit-distance', 'levenshtein', 'string-dp', '2d-dp'],
  },
  {
    title: 'Grokking Algorithms — Dynamic Programming (chapter 9)',
    url: 'https://github.com/egonSchiele/grokking_algorithms',
    description:
      'Capítulo 9 do Grokking Algorithms (Bhargava, Manning). DP com exemplos visuais de knapsack e longest common subsequence. Livro pago — ver biblioteca da Inteli ou Manning. O GitHub tem só o código de apoio, não o PDF.',
    format: 'BOOK',
    difficulty: 'MEDIUM',
    estimatedMinutes: 25,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'Book — Grokking Algorithms',
    tags: ['concept', 'book', 'grokking', 'dp', 'knapsack', 'lcs'],
  },
  {
    title: 'O que é replicação de Banco de Dados?',
    url: 'https://www.youtube.com/watch?v=e6r7Uqe6Tn4',
    description:
      'Augusto Galego — replicação de banco: master/replica, sync vs async, trade-offs de consistência e disponibilidade.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 12,
    topicSlugs: ['replication', 'databases'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Augusto Galego',
    tags: ['concept', 'replication', 'master-replica', 'sync-async', 'galego'],
  },

  // ---------------------------------------------------------------------------
  // trie (2 items) — 2026-04-25
  // ---------------------------------------------------------------------------
  {
    title: 'Implement Trie (Prefix Tree) — Leetcode 208',
    url: 'https://www.youtube.com/watch?v=oobqoCJlHA0',
    description:
      'NeetCode — explica trie no Excalidraw antes de implementar: nó com filhos por caractere, insert e search percorrem caractere a caractere.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 19,
    topicSlugs: ['trie'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — NeetCode',
    tags: ['concept', 'trie', 'prefix-tree', 'leetcode-208', 'neetcode'],
  },
  {
    title: 'Grokking Data Structures — Tries (chapter)',
    url: 'https://github.com/mlarocca/grokking_data_structures',
    description:
      'Capítulo de tries do Grokking Data Structures (La Rocca, Manning). Prefix tree, inserção, busca, aplicações em autocomplete e dictionary. Livro pago — ver biblioteca da Inteli ou Manning. O GitHub tem só o código de apoio, não o PDF.',
    format: 'BOOK',
    difficulty: 'MEDIUM',
    estimatedMinutes: 25,
    topicSlugs: ['trie'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'Book — Grokking Data Structures',
    tags: ['concept', 'book', 'grokking', 'trie', 'prefix-tree', 'autocomplete'],
  },

  // ---------------------------------------------------------------------------
  // AlgoViz interactive visualizers (16 items) — 2026-04-25
  // pt-BR, Davi's own algorithm visualization site
  // ---------------------------------------------------------------------------
  {
    title: 'AlgoViz — Bubble Sort',
    url: 'https://algorithms.daviduarte.com.br/algoritmos/bubble-sort',
    description:
      'AlgoViz — visualizador interativo de bubble sort: comparações de pares adjacentes e swaps até a lista ordenar. pt-BR.',
    format: 'ARTICLE',
    difficulty: 'EASY',
    estimatedMinutes: 6,
    topicSlugs: ['sorting'],
    tracks: [],
    source: 'Site — AlgoViz (Davi Duarte)',
    tags: ['concept', 'sorting', 'bubble-sort', 'algoviz', 'visualization', 'pt-br'],
  },
  {
    title: 'AlgoViz — Selection Sort',
    url: 'https://algorithms.daviduarte.com.br/algoritmos/selection-sort',
    description:
      'AlgoViz — visualizador interativo de selection sort: encontra o menor a cada passo e troca pra posição correta. pt-BR.',
    format: 'ARTICLE',
    difficulty: 'EASY',
    estimatedMinutes: 6,
    topicSlugs: ['sorting'],
    tracks: [],
    source: 'Site — AlgoViz (Davi Duarte)',
    tags: ['concept', 'sorting', 'selection-sort', 'algoviz', 'visualization', 'pt-br'],
  },
  {
    title: 'AlgoViz — Insertion Sort',
    url: 'https://algorithms.daviduarte.com.br/algoritmos/insertion-sort',
    description:
      'AlgoViz — visualizador interativo de insertion sort: insere cada elemento na posição certa do prefixo já ordenado. pt-BR.',
    format: 'ARTICLE',
    difficulty: 'EASY',
    estimatedMinutes: 6,
    topicSlugs: ['sorting'],
    tracks: [],
    source: 'Site — AlgoViz (Davi Duarte)',
    tags: ['concept', 'sorting', 'insertion-sort', 'algoviz', 'visualization', 'pt-br'],
  },
  {
    title: 'AlgoViz — Merge Sort',
    url: 'https://algorithms.daviduarte.com.br/algoritmos/merge-sort',
    description:
      'AlgoViz — visualizador interativo de merge sort: divide pela metade recursivamente e faz o merge das duas halves ordenadas. pt-BR.',
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 8,
    topicSlugs: ['sorting', 'recursion'],
    tracks: [],
    source: 'Site — AlgoViz (Davi Duarte)',
    tags: ['concept', 'sorting', 'merge-sort', 'divide-and-conquer', 'algoviz', 'visualization', 'pt-br'],
  },
  {
    title: 'AlgoViz — Quick Sort',
    url: 'https://algorithms.daviduarte.com.br/algoritmos/quick-sort',
    description:
      'AlgoViz — visualizador interativo de quick sort: escolhe pivot, particiona em <pivot e >pivot, recurso nas duas partes. pt-BR.',
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 8,
    topicSlugs: ['sorting', 'recursion'],
    tracks: [],
    source: 'Site — AlgoViz (Davi Duarte)',
    tags: ['concept', 'sorting', 'quick-sort', 'partitioning', 'algoviz', 'visualization', 'pt-br'],
  },
  {
    title: 'AlgoViz — Counting Sort',
    url: 'https://algorithms.daviduarte.com.br/algoritmos/counting-sort',
    description:
      'AlgoViz — visualizador interativo de counting sort: array de contagem de ocorrências, sort em O(n+k) sem comparações. pt-BR.',
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 7,
    topicSlugs: ['sorting'],
    tracks: [],
    source: 'Site — AlgoViz (Davi Duarte)',
    tags: ['concept', 'sorting', 'counting-sort', 'non-comparison', 'algoviz', 'visualization', 'pt-br'],
  },
  {
    title: 'AlgoViz — Bucket Sort',
    url: 'https://algorithms.daviduarte.com.br/algoritmos/bucket-sort',
    description:
      'AlgoViz — visualizador interativo de bucket sort: distribui em buckets por range, ordena cada bucket e concatena. pt-BR.',
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 7,
    topicSlugs: ['sorting'],
    tracks: [],
    source: 'Site — AlgoViz (Davi Duarte)',
    tags: ['concept', 'sorting', 'bucket-sort', 'algoviz', 'visualization', 'pt-br'],
  },
  {
    title: 'AlgoViz — BFS (Breadth-First Search)',
    url: 'https://algorithms.daviduarte.com.br/algoritmos/bfs',
    description:
      'AlgoViz — visualizador interativo de BFS: queue, visita level-by-level, caminho mais curto em grafos não-pesados. pt-BR.',
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 8,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'Site — AlgoViz (Davi Duarte)',
    tags: ['concept', 'graph', 'bfs', 'queue', 'algoviz', 'visualization', 'pt-br'],
  },
  {
    title: 'AlgoViz — DFS (Depth-First Search)',
    url: 'https://algorithms.daviduarte.com.br/algoritmos/dfs',
    description:
      'AlgoViz — visualizador interativo de DFS: stack/recursão, exploração completa de cada caminho antes de retroceder. pt-BR.',
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 8,
    topicSlugs: ['graph', 'recursion'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'Site — AlgoViz (Davi Duarte)',
    tags: ['concept', 'graph', 'dfs', 'recursion', 'stack', 'algoviz', 'visualization', 'pt-br'],
  },
  {
    title: 'AlgoViz — Dijkstra',
    url: 'https://algorithms.daviduarte.com.br/algoritmos/dijkstra',
    description:
      'AlgoViz — visualizador interativo de Dijkstra: priority queue, caminho mais curto em grafo com pesos não-negativos. pt-BR.',
    format: 'ARTICLE',
    difficulty: 'HARD',
    estimatedMinutes: 10,
    topicSlugs: ['graph', 'heap'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'Site — AlgoViz (Davi Duarte)',
    tags: ['concept', 'graph', 'dijkstra', 'shortest-path', 'priority-queue', 'algoviz', 'visualization', 'pt-br'],
  },
  {
    title: 'AlgoViz — Topological Sort',
    url: 'https://algorithms.daviduarte.com.br/algoritmos/topological-sort',
    description:
      'AlgoViz — visualizador interativo de topological sort: DAG, ordem que respeita dependências, Kahn ou DFS-based. pt-BR.',
    format: 'ARTICLE',
    difficulty: 'HARD',
    estimatedMinutes: 10,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'Site — AlgoViz (Davi Duarte)',
    tags: ['concept', 'graph', 'topological-sort', 'dag', 'kahn', 'algoviz', 'visualization', 'pt-br'],
  },
  {
    title: 'AlgoViz — Union-Find (DSU)',
    url: 'https://algorithms.daviduarte.com.br/algoritmos/union-find',
    description:
      'AlgoViz — visualizador interativo de Union-Find (DSU): union, find, path compression, detecção de componentes conexos. pt-BR.',
    format: 'ARTICLE',
    difficulty: 'HARD',
    estimatedMinutes: 10,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'Site — AlgoViz (Davi Duarte)',
    tags: ['concept', 'graph', 'union-find', 'dsu', 'path-compression', 'algoviz', 'visualization', 'pt-br'],
  },
  {
    title: 'AlgoViz — Ciclo Único em Array',
    url: 'https://algorithms.daviduarte.com.br/algoritmos/single-cycle-check',
    description:
      'AlgoViz — visualizador interativo de Ciclo Único em Array: verifica se dá pra visitar todos os elementos saltando os valores e voltar ao início em exatamente n passos. pt-BR.',
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 7,
    topicSlugs: ['array'],
    tracks: [],
    source: 'Site — AlgoViz (Davi Duarte)',
    tags: ['concept', 'array', 'cycle-detection', 'simulation', 'algoviz', 'visualization', 'pt-br'],
  },
  {
    title: 'AlgoViz — Two Sum',
    url: 'https://algorithms.daviduarte.com.br/algoritmos/two-sum',
    description:
      'AlgoViz — visualizador interativo de Two Sum (LC 1): hashmap mapeia valor → índice, busca complemento em O(1). pt-BR.',
    format: 'ARTICLE',
    difficulty: 'EASY',
    estimatedMinutes: 6,
    topicSlugs: ['hashmap', 'array'],
    tracks: [],
    source: 'Site — AlgoViz (Davi Duarte)',
    tags: ['concept', 'hashmap', 'two-sum', 'leetcode-1', 'algoviz', 'visualization', 'pt-br'],
  },
  {
    title: 'AlgoViz — LRU Cache',
    url: 'https://algorithms.daviduarte.com.br/algoritmos/lru-cache',
    description:
      'AlgoViz — visualizador interativo de LRU Cache: doubly linked list + hashmap, get/put em O(1), evicta o least recently used. pt-BR.',
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 8,
    topicSlugs: ['caching', 'lists', 'hashmap'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'Site — AlgoViz (Davi Duarte)',
    tags: ['concept', 'caching', 'lru', 'doubly-linked-list', 'hashmap', 'algoviz', 'visualization', 'pt-br'],
  },
  {
    title: 'AlgoViz — Trie (Prefix Tree)',
    url: 'https://algorithms.daviduarte.com.br/algoritmos/trie',
    description:
      'AlgoViz — visualizador interativo de Trie (Prefix Tree): nó por caractere, insert/search em O(m), aplicações em autocomplete. pt-BR.',
    format: 'ARTICLE',
    difficulty: 'EASY',
    estimatedMinutes: 7,
    topicSlugs: ['trie', 'tree'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'Site — AlgoViz (Davi Duarte)',
    tags: ['concept', 'trie', 'prefix-tree', 'autocomplete', 'algoviz', 'visualization', 'pt-br'],
  },

  // ---------------------------------------------------------------------------
  // hashmap (3 items) — 2026-04-25
  // ---------------------------------------------------------------------------
  {
    title: 'Consistent Hashing — Algorithms You Should Know #1',
    url: 'https://www.youtube.com/watch?v=UF9Iqmg94tk',
    description:
      'ByteByteGo — consistent hashing pra distribuir chaves em servidores: anel de hash, virtual nodes, rebalanceamento mínimo quando um servidor entra ou sai.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 9,
    topicSlugs: ['hashmap', 'sharding'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'hashmap', 'consistent-hashing', 'sharding', 'distributed', 'bytebytego'],
  },
  {
    title: 'Grokking Algorithms — Hash Tables (chapter 5)',
    url: 'https://github.com/egonSchiele/grokking_algorithms',
    description:
      'Capítulo 5 do Grokking Algorithms (Bhargava, Manning). Hash tables com exemplos visuais, hash function, collision e applications. Livro pago — ver biblioteca da Inteli ou Manning. O GitHub tem só o código de apoio, não o PDF.',
    format: 'BOOK',
    difficulty: 'MEDIUM',
    estimatedMinutes: 25,
    topicSlugs: ['hashmap'],
    tracks: [],
    source: 'Book — Grokking Algorithms',
    tags: ['concept', 'book', 'grokking', 'hashmap', 'hash-function'],
  },
  {
    title: 'Group Anagrams — Categorize Strings by Count — Leetcode 49',
    url: 'https://www.youtube.com/watch?v=vzdNOK2oB2E',
    description:
      'NeetCode — LC 49 com Excalidraw: hashmap onde a chave é a contagem de caracteres, agrupa strings que têm a mesma assinatura.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 9,
    topicSlugs: ['hashmap'],
    tracks: [],
    source: 'YouTube — NeetCode',
    tags: ['practice', 'hashmap', 'leetcode-49', 'group-anagrams', 'neetcode'],
  },

  // ---------------------------------------------------------------------------
  // message-queues (6 items) — 2026-04-26
  // ---------------------------------------------------------------------------
  {
    title: 'Kafka in 100 Seconds',
    url: 'https://www.youtube.com/watch?v=uvb00oaa3k8',
    description:
      'Fireship — Kafka em 100s: log distribuído particionado, producers, consumers, brokers.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 3,
    topicSlugs: ['message-queues'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Fireship',
    tags: ['concept', 'kafka', 'log-based', 'fireship'],
  },
  {
    title: 'RabbitMQ in 100 Seconds',
    url: 'https://www.youtube.com/watch?v=NQ3fZtyXji0',
    description:
      'Fireship — RabbitMQ em 100s: broker tradicional, exchanges, queues, routing keys.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 3,
    topicSlugs: ['message-queues'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Fireship',
    tags: ['concept', 'rabbitmq', 'broker', 'fireship'],
  },
  {
    title: 'What is a Message Queue and When should you use Messaging Queue Systems Like RabbitMQ and Kafka',
    url: 'https://www.youtube.com/watch?v=W4_aGb_MOls',
    description:
      'Hussein Nasser — o que é message queue e quando usar: desacoplamento producer/consumer, retry, ordering, comparação Kafka vs RabbitMQ.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 14,
    topicSlugs: ['message-queues'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Hussein Nasser',
    tags: ['concept', 'message-queues', 'overview', 'when-to-use', 'hussein-nasser'],
  },
  {
    title: 'Kafka vs. RabbitMQ vs. Messaging Middleware vs. Pulsar',
    url: 'https://www.youtube.com/watch?v=x4k1XEjNzYQ',
    description:
      'ByteByteGo — comparativo Kafka vs RabbitMQ vs Pulsar: log-based vs broker tradicional, trade-offs de throughput, ordering, retention.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 5,
    topicSlugs: ['message-queues', 'pubsub'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['tradeoffs', 'kafka', 'rabbitmq', 'pulsar', 'comparison'],
  },
  {
    title: 'Apache Kafka Fundamentals You Should Know',
    url: 'https://www.youtube.com/watch?v=-RDyEFvnTXI',
    description:
      'ByteByteGo — fundamentos de Kafka: tópicos, partitions, consumer groups, replication.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 5,
    topicSlugs: ['message-queues'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'kafka', 'partitions', 'consumer-groups', 'replication'],
  },
  {
    title: 'System Design: Why is Kafka fast?',
    url: 'https://www.youtube.com/watch?v=UNUz1-msbOM',
    description:
      'ByteByteGo — por que Kafka é rápido: zero-copy, sequential I/O, batch + compression no producer.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 6,
    topicSlugs: ['message-queues'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'kafka', 'internals', 'zero-copy', 'sequential-io'],
  },

  // ---------------------------------------------------------------------------
  // greedy (6 items) — 2026-04-26
  // ---------------------------------------------------------------------------
  {
    title: 'Jump Game — Greedy — Leetcode 55',
    url: 'https://www.youtube.com/watch?v=Yan0cv2cLy8',
    description:
      'NeetCode — LC 55 com Excalidraw: greedy de "máximo alcance", track o índice mais distante alcançável a cada passo.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 16,
    topicSlugs: ['greedy'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — NeetCode',
    tags: ['practice', 'greedy', 'leetcode-55', 'jump-game', 'neetcode'],
  },
  {
    title: 'Gas Station — Greedy — Leetcode 134',
    url: 'https://www.youtube.com/watch?v=lJwbPZGo05A',
    description:
      'NeetCode — LC 134: se a soma total de gas - cost é positiva, existe ponto de partida válido. Greedy reseta ao saldo negativo.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 16,
    topicSlugs: ['greedy'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — NeetCode',
    tags: ['practice', 'greedy', 'leetcode-134', 'gas-station', 'neetcode'],
  },
  {
    title: 'Jump Game II — Greedy — Leetcode 45',
    url: 'https://www.youtube.com/watch?v=dJ7sWiOoK7g',
    description:
      'NeetCode — LC 45: variante do Jump Game que pede o número mínimo de saltos. BFS implícito com greedy de fronteira.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 12,
    topicSlugs: ['greedy'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — NeetCode',
    tags: ['practice', 'greedy', 'leetcode-45', 'jump-game-ii', 'bfs', 'neetcode'],
  },
  {
    title: 'Interval Scheduling Maximization (Proof w/ Exchange Argument)',
    url: 'https://www.youtube.com/watch?v=hVhOeaONg1Y',
    description:
      'Back to Back SWE — interval scheduling: ordena por end time e pega o que termina antes. Prova de optimalidade pelo exchange argument.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 20,
    topicSlugs: ['greedy'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Back To Back SWE',
    tags: ['concept', 'greedy', 'interval-scheduling', 'exchange-argument', 'proof'],
  },
  {
    title: 'Huffman Codes: An Information Theory Perspective',
    url: 'https://www.youtube.com/watch?v=B3y0RsVCyrw',
    description:
      'Reducible — Huffman codes pela lente de teoria da informação: por que combinar greedy os dois símbolos menos frequentes produz a árvore ótima.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 29,
    topicSlugs: ['greedy', 'tree'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Reducible',
    tags: ['concept', 'greedy', 'huffman', 'compression', 'information-theory', 'tree'],
  },
  {
    title: 'Grokking Algorithms — Greedy Algorithms (chapter 8)',
    url: 'https://github.com/egonSchiele/grokking_algorithms',
    description:
      'Capítulo 8 do Grokking Algorithms (Bhargava, Manning). Greedy com set cover, NP-completude e aproximação pra traveling salesman. Livro pago — ver biblioteca da Inteli ou Manning. O GitHub tem só o código de apoio, não o PDF.',
    format: 'BOOK',
    difficulty: 'MEDIUM',
    estimatedMinutes: 25,
    topicSlugs: ['greedy'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'Book — Grokking Algorithms',
    tags: ['concept', 'book', 'grokking', 'greedy', 'set-cover', 'np-complete'],
  },

  // ---------------------------------------------------------------------------
  // rate-limiting (4 items) — 2026-04-26
  // ---------------------------------------------------------------------------
  {
    title: 'O que é um Rate Limiter?',
    url: 'https://www.youtube.com/watch?v=H8gOOqC1WDQ',
    description:
      'Augusto Galego — entry de rate limiter em 6min: o que é, pra que serve (proteção de API, fairness entre usuários, evitar abuse), onde implementar.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 6,
    topicSlugs: ['rate-limiting'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Augusto Galego',
    tags: ['concept', 'rate-limiting', 'fundamentals', 'galego'],
  },
  {
    title: 'Rate Limiting Fundamentals',
    url: 'https://blog.bytebytego.com/p/rate-limiting-fundamentals',
    description:
      'ByteByteGo Blog — rate limiting como padrão de sistema distribuído: por que existe (proteção de recursos, fairness entre usuários), onde implementa e quando aplicar.',
    format: 'ARTICLE',
    difficulty: 'EASY',
    estimatedMinutes: 12,
    topicSlugs: ['rate-limiting'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'Blog — ByteByteGo',
    tags: ['concept', 'rate-limiting', 'fundamentals', 'distributed-systems', 'bytebytego'],
  },
  {
    title: 'Rate Limiter System Design: Token Bucket, Leaky Bucket, Scaling',
    url: 'https://www.youtube.com/watch?v=YXkOdWBwqaA',
    description:
      'ByteByteGo — design de rate limiter: token bucket vs leaky bucket vs sliding window, throttling, escala em sistema distribuído.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 8,
    topicSlugs: ['rate-limiting'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'rate-limiting', 'token-bucket', 'leaky-bucket', 'distributed', 'bytebytego'],
  },
  {
    title: 'How Rate Limiting and Throttling Saves Your API Server From CRASHING',
    url: 'https://www.youtube.com/watch?v=_qNHROq0pGk',
    description:
      'ByteMonk — token bucket e leaky bucket implementados em Java, foco em quando cada um aplica e diferença entre rate limiting e throttling.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 8,
    topicSlugs: ['rate-limiting'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteMonk',
    tags: ['practice', 'rate-limiting', 'token-bucket', 'leaky-bucket', 'java', 'throttling'],
  },
  {
    title: 'Five Rate Limiting Algorithms — Key Concepts in System Design',
    url: 'https://www.youtube.com/watch?v=mQCJJqUfn9Y',
    description:
      'Hello Byte — 5 algoritmos de rate limiting comparados: token bucket, leaky bucket, fixed window, sliding window log, sliding window counter.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 18,
    topicSlugs: ['rate-limiting'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Hello Byte',
    tags: ['concept', 'rate-limiting', 'algorithms', 'overview', 'sliding-window'],
  },
  {
    title: 'Rate Limiter | Explicação Completa',
    url: 'https://www.youtube.com/watch?v=mlzPJlQeqBM',
    description:
      'Augusto Galego — deep dive em rate limiter (28min): algoritmos completos, distributed state, com challenge prático leaky bucket da Woovi.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 28,
    topicSlugs: ['rate-limiting'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Augusto Galego',
    tags: ['concept', 'rate-limiting', 'leaky-bucket', 'distributed', 'practice', 'galego'],
  },

  // ---------------------------------------------------------------------------
  // networking (7 items) — 2026-04-26 Hussein Nasser sweep
  // ---------------------------------------------------------------------------
  {
    title: 'Computer Networking in 100 Seconds',
    url: 'https://www.youtube.com/watch?v=keeqnciDVOo',
    description:
      'Fireship — networking em 100s: pilha TCP/IP, OSI vs TCP/IP model, packet routing, do bit ao protocolo de aplicação.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 3,
    topicSlugs: ['networking'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Fireship',
    tags: ['concept', 'networking', 'overview', 'tcp-ip', 'fireship'],
  },
  {
    title: 'DNS Explained in 100 Seconds',
    url: 'https://www.youtube.com/watch?v=UVR9lhUGAyU',
    description:
      'Fireship — DNS em 100s: como nome de domínio vira IP, hierarquia de servidores (root, TLD, authoritative), cache local.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 3,
    topicSlugs: ['networking'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Fireship',
    tags: ['concept', 'networking', 'dns', 'fireship'],
  },
  {
    title: 'When to use UDP vs TCP in Building a Backend Application?',
    url: 'https://www.youtube.com/watch?v=G86axGfnWag',
    description:
      'Hussein Nasser — quando escolher UDP ou TCP num backend: garantias de entrega vs latência, ordering, casos de uso reais (vídeo, gaming, banking).',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 21,
    topicSlugs: ['networking'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Hussein Nasser',
    tags: ['tradeoffs', 'networking', 'tcp', 'udp', 'protocol', 'hussein-nasser'],
  },
  {
    title: 'What are SSL/TLS Certificates? Why do we Need them? and How do they Work?',
    url: 'https://www.youtube.com/watch?v=r1nJT63BFQ0',
    description:
      'Hussein Nasser — SSL/TLS: o que é certificado, cadeia de confiança, CAs, handshake, por que HTTPS importa.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 15,
    topicSlugs: ['networking', 'security'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Hussein Nasser',
    tags: ['concept', 'networking', 'ssl', 'tls', 'certificates', 'security', 'hussein-nasser'],
  },
  {
    title: 'This is why gRPC was invented',
    url: 'https://www.youtube.com/watch?v=u4LWEXDP7_M',
    description:
      'Hussein Nasser — porque gRPC nasceu: limitações do REST, binary protocol via Protocol Buffers, streaming bidirecional via HTTP/2.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 9,
    topicSlugs: ['networking'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Hussein Nasser',
    tags: ['concept', 'networking', 'grpc', 'rpc', 'http2', 'protobuf', 'hussein-nasser'],
  },
  {
    title: 'Hyper Text Transfer Protocol Crash Course — HTTP 1.0, 1.1, HTTP/2, HTTP/3',
    url: 'https://www.youtube.com/watch?v=0OrmKCB0UrQ',
    description:
      'Hussein Nasser — HTTP histórico em 46min: 1.0 (uma conexão por request), 1.1 (keep-alive), HTTP/2 (multiplex), HTTP/3 (QUIC sobre UDP).',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 46,
    topicSlugs: ['networking'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Hussein Nasser',
    tags: ['concept', 'networking', 'http', 'http2', 'http3', 'quic', 'hussein-nasser'],
  },
  {
    title: 'WebSockets Crash Course — Handshake, Use-cases, Pros & Cons and more',
    url: 'https://www.youtube.com/watch?v=2Nt-ZrNP22A',
    description:
      'Hussein Nasser — WebSockets em 48min: upgrade handshake do HTTP, conexão full-duplex persistente, casos de uso (chat, streaming, jogos), prós e contras.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 48,
    topicSlugs: ['networking', 'pubsub'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Hussein Nasser',
    tags: ['concept', 'networking', 'websockets', 'realtime', 'full-duplex', 'hussein-nasser'],
  },

  // ---------------------------------------------------------------------------
  // Galego SD sweep (8 items) — 2026-04-26
  // ---------------------------------------------------------------------------
  {
    title: 'Cache explicado — O que é e como funciona cache?',
    url: 'https://www.youtube.com/watch?v=r-tiD2MYnWE',
    description:
      'Augusto Galego — cache do zero em 19min: o que é, hit/miss, write-through vs write-back, expiração e invalidação.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 19,
    topicSlugs: ['caching'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Augusto Galego',
    tags: ['concept', 'caching', 'fundamentals', 'hit-miss', 'galego'],
  },
  {
    title: 'O que é Load Balancer?',
    url: 'https://www.youtube.com/watch?v=OIw0kWQwGis',
    description:
      'Augusto Galego — load balancer em 9min: o que é, round robin, least connections, sticky sessions, L4 vs L7.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 9,
    topicSlugs: ['load-balancers'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Augusto Galego',
    tags: ['concept', 'load-balancer', 'fundamentals', 'l4', 'l7', 'galego'],
  },
  {
    title: 'O que é DB Sharding?',
    url: 'https://www.youtube.com/watch?v=Um7XlWJsPxw',
    description:
      'Augusto Galego — sharding em 9min: por que dividir o banco, horizontal vs vertical, escolha de shard key.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 9,
    topicSlugs: ['sharding'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Augusto Galego',
    tags: ['concept', 'sharding', 'database', 'shard-key', 'galego'],
  },
  {
    title: 'O que são sharded counters?',
    url: 'https://www.youtube.com/watch?v=eAnuBiiReVc',
    description:
      'Augusto Galego — sharded counters: como evitar contenção em counters de alta escrita distribuindo em múltiplas chaves.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 9,
    topicSlugs: ['sharding'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Augusto Galego',
    tags: ['concept', 'sharding', 'counters', 'high-write', 'contention', 'galego'],
  },
  {
    title: 'Concorrência é DIFERENTE de Paralelismo!',
    url: 'https://www.youtube.com/watch?v=74RLgpAV6LQ',
    description:
      'Augusto Galego — concorrência (intercalar tarefas) vs paralelismo (executar simultâneo): por que JS é concorrente single-threaded, exemplos práticos.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 13,
    topicSlugs: ['scalability'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Augusto Galego',
    tags: ['concept', 'concurrency', 'parallelism', 'threading', 'galego'],
  },
  {
    title: 'Quando usar Monolitos vs Microserviços',
    url: 'https://www.youtube.com/watch?v=ooJjxNsQnK4',
    description:
      'Augusto Galego — monolitos vs microserviços em 23min: trade-offs reais, quando vale, custos operacionais.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 23,
    topicSlugs: ['scalability', 'design-patterns'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Augusto Galego',
    tags: ['tradeoffs', 'monolith', 'microservices', 'architecture', 'galego'],
  },
  {
    title: 'Princípios SOLID Pelos Olhos de um Dev Sr.',
    url: 'https://www.youtube.com/watch?v=2yqHlJ2HbTo',
    description:
      'Augusto Galego — os 5 princípios SOLID com exemplos práticos: SRP, Open/Closed, Liskov, ISP, DIP. 21min.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 21,
    topicSlugs: ['design-patterns'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Augusto Galego',
    tags: ['concept', 'solid', 'design-principles', 'srp', 'liskov', 'galego'],
  },
  {
    title: 'Padrão SAGA | Orquestrando diferentes microsserviços',
    url: 'https://www.youtube.com/watch?v=Q5qZVWTQQOE',
    description:
      'Augusto Galego — padrão SAGA em microserviços: transações distribuídas via choreography ou orchestration, compensações em caso de falha.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 20,
    topicSlugs: ['design-patterns', 'reliability'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Augusto Galego',
    tags: ['concept', 'saga', 'microservices', 'distributed-transactions', 'compensation', 'galego'],
  },
  {
    title: 'Top 6 Load Balancing Algorithms Every Developer Should Know',
    url: 'https://www.youtube.com/watch?v=dBmxNsS3BGE',
    description:
      'ByteByteGo — 6 algoritmos de load balancing comparados: round robin, weighted round robin, least connections, IP hash, least response time, random.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 6,
    topicSlugs: ['load-balancers'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['tradeoffs', 'load-balancer', 'algorithms', 'round-robin', 'least-connections', 'bytebytego'],
  },

  // ---------------------------------------------------------------------------
  // containers (5 items) — 2026-04-26
  // ---------------------------------------------------------------------------
  {
    title: 'Docker in 100 Seconds',
    url: 'https://www.youtube.com/watch?v=Gjnup-PuquQ',
    description:
      'Fireship — Docker em 100s: imagem vs container, layered filesystem, Dockerfile, por que existe (resolve "funciona na minha máquina").',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 3,
    topicSlugs: ['containers'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Fireship',
    tags: ['concept', 'containers', 'docker', 'fireship'],
  },
  {
    title: 'Kubernetes Explained in 100 Seconds',
    url: 'https://www.youtube.com/watch?v=PziYflu8cB8',
    description:
      'Fireship — Kubernetes em 100s: orquestração de containers, pods, deployments, services, control plane vs worker nodes.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 3,
    topicSlugs: ['containers'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Fireship',
    tags: ['concept', 'containers', 'kubernetes', 'k8s', 'orchestration', 'fireship'],
  },
  {
    title: 'Kubernetes Explained in 6 Minutes | k8s Architecture',
    url: 'https://www.youtube.com/watch?v=TlHvYWVUZyc',
    description:
      'ByteByteGo — arquitetura do Kubernetes: API server, etcd, scheduler, controller manager, kubelet, kube-proxy. Como tudo se conecta.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 7,
    topicSlugs: ['containers', 'scalability'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'containers', 'kubernetes', 'architecture', 'etcd', 'scheduler', 'bytebytego'],
  },
  {
    title: 'The evolution from virtual machines to containers',
    url: 'https://www.youtube.com/watch?v=8qU3hZOXlBE',
    description:
      'Hussein Nasser — história de VMs → containers: hypervisor vs container engine, overhead de boot, isolação via cgroups e namespaces.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 18,
    topicSlugs: ['containers'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Hussein Nasser',
    tags: ['concept', 'containers', 'virtual-machines', 'history', 'hussein-nasser'],
  },
  {
    title: "99% of Developers Don't Get Docker",
    url: 'https://www.youtube.com/watch?v=Sz2ayy2NomY',
    description:
      'The Coding Gopher — Docker além do `docker run`: como o container engine usa namespaces e cgroups do Linux pra isolar processos sem virtualização.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 15,
    topicSlugs: ['containers'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — The Coding Gopher',
    tags: ['concept', 'containers', 'docker', 'namespaces', 'cgroups', 'linux', 'internals', 'coding-gopher'],
  },
  {
    title: 'Eu não sabia o que era Docker até agora...',
    url: 'https://www.youtube.com/watch?v=LGpJuDUaHXY',
    description:
      'Augusto Galego — Docker em pt-BR: o que resolve, imagem vs container, layered filesystem, exemplos práticos.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 26,
    topicSlugs: ['containers'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Augusto Galego',
    tags: ['concept', 'containers', 'docker', 'fundamentals', 'galego'],
  },

  // ---------------------------------------------------------------------------
  // cloud (5 items) — 2026-04-26
  // ---------------------------------------------------------------------------
  {
    title: 'AWS for the Haters in 100 Seconds',
    url: 'https://www.youtube.com/watch?v=ZzI9JE0i6Lc',
    description:
      'Fireship — entry crítico em AWS: por que é difícil de usar, vendor lock-in, complexidade dos serviços, mas por que ainda é dominante.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 3,
    topicSlugs: ['cloud'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Fireship',
    tags: ['concept', 'cloud', 'aws', 'fireship'],
  },
  {
    title: 'Top 50+ AWS Services Explained in 10 Minutes',
    url: 'https://www.youtube.com/watch?v=JIbIYCM48to',
    description:
      'Fireship — tour por 50+ serviços AWS em 12min: compute (EC2, Lambda), storage (S3, EBS), DBs (RDS, DynamoDB), networking (VPC, Route 53) e mais.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 12,
    topicSlugs: ['cloud'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Fireship',
    tags: ['concept', 'cloud', 'aws', 'services', 'overview', 'fireship'],
  },
  {
    title: 'But What Is Cloud Native Really All About?',
    url: 'https://www.youtube.com/watch?v=p-88GN1WVs8',
    description:
      'ByteByteGo — Cloud Native como prática: containers + microservices + orquestração + DevOps + observabilidade. Não é só rodar na cloud.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 8,
    topicSlugs: ['cloud'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'cloud', 'cloud-native', 'microservices', 'devops', 'bytebytego'],
  },
  {
    title: 'Serverless Computing in 100 Seconds',
    url: 'https://www.youtube.com/watch?v=W_VV2Fx32_Y',
    description:
      'Fireship — serverless explicado: FaaS (Lambda, Cloud Functions), pay-per-execution, cold start, quando vale e quando não.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 17,
    topicSlugs: ['cloud'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Fireship',
    tags: ['concept', 'cloud', 'serverless', 'faas', 'lambda', 'fireship'],
  },
  {
    title: 'Amazon Prime Video Ditches AWS Serverless, Saves 90%',
    url: 'https://www.youtube.com/watch?v=JTp0TY_2hXM',
    description:
      'ByteByteGo — case real Prime Video: por que migraram de serverless distribuído pra monolith, custos de orquestração, lições sobre escolha de arquitetura.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 5,
    topicSlugs: ['cloud', 'scalability'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['case-study', 'cloud', 'serverless', 'monolith', 'prime-video', 'bytebytego'],
  },

  // ---------------------------------------------------------------------------
  // security (7 items) — 2026-04-26
  // ---------------------------------------------------------------------------
  {
    title: 'O MÍNIMO que um dev precisa saber sobre segurança',
    url: 'https://www.youtube.com/watch?v=aGVN6aHKkE0',
    description:
      'Augusto Galego — entry BR de segurança em 18min: ataques comuns (SQL injection, XSS, CSRF), princípios básicos pra dev não-especialista.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 18,
    topicSlugs: ['security'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Augusto Galego',
    tags: ['concept', 'security', 'fundamentals', 'sql-injection', 'xss', 'csrf', 'galego'],
  },
  {
    title: 'Session vs Token Authentication in 100 Seconds',
    url: 'https://www.youtube.com/watch?v=UBUNrFtufWo',
    description:
      'Fireship — session vs token em 100s: stateful (server lembra) vs stateless (cliente carrega), trade-offs de revogação e escala.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 3,
    topicSlugs: ['security'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Fireship',
    tags: ['concept', 'security', 'session', 'token', 'authentication', 'fireship'],
  },
  {
    title: '7 Cryptography Concepts EVERY Developer Should Know',
    url: 'https://www.youtube.com/watch?v=NuyzuNBFWxQ',
    description:
      'Fireship — 7 conceitos de criptografia: hashing, salting, symmetric/asymmetric encryption, signatures, MAC, key exchange.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 12,
    topicSlugs: ['security'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Fireship',
    tags: ['concept', 'security', 'cryptography', 'hashing', 'encryption', 'fireship'],
  },
  {
    title: 'OAuth 2 Explained In Simple Terms',
    url: 'https://www.youtube.com/watch?v=ZV5yTm4pT8g',
    description:
      'ByteByteGo — OAuth 2 sem jargão: roles (resource owner, client, auth server, resource server), flows authorization code e client credentials.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 5,
    topicSlugs: ['security'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'security', 'oauth', 'oauth2', 'authorization', 'bytebytego'],
  },
  {
    title: 'JSON Web Tokens (JWTs) Explained',
    url: 'https://www.youtube.com/watch?v=fCP2FttGkt8',
    description:
      'The Coding Gopher — JWT em 11min: estrutura (header.payload.signature), HMAC vs RSA, verificação no servidor, riscos comuns.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 11,
    topicSlugs: ['security'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — The Coding Gopher',
    tags: ['concept', 'security', 'jwt', 'token', 'hmac', 'coding-gopher'],
  },
  {
    title: 'Five Password Authentications From Least to Most Secure (Explained with NodeJS & Postgres)',
    url: 'https://www.youtube.com/watch?v=_t8EPImx9LI',
    description:
      'Hussein Nasser — 5 níveis de armazenamento de senha: plaintext, MD5, salted hash, bcrypt, argon2. Por que cada nível ainda quebra ou resiste.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 25,
    topicSlugs: ['security'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Hussein Nasser',
    tags: ['concept', 'security', 'password', 'hashing', 'bcrypt', 'argon2', 'hussein-nasser'],
  },
  {
    title: 'Securing Backend Applications (OWASP recommendations)',
    url: 'https://www.youtube.com/watch?v=Vc6kWFivQtw',
    description:
      'Hussein Nasser — OWASP top 10 para backend em 28min: injection, broken auth, exposed data, XXE, broken access, misconfig, XSS, deserialization, components, logging.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 28,
    topicSlugs: ['security'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Hussein Nasser',
    tags: ['concept', 'security', 'owasp', 'backend', 'injection', 'hussein-nasser'],
  },

  // ---------------------------------------------------------------------------
  // reliability (3 items) — 2026-04-26
  // ---------------------------------------------------------------------------
  {
    title: '8 Most Important Tips for Designing Fault-Tolerant System',
    url: 'https://www.youtube.com/watch?v=3Lis4w4_bBc',
    description:
      'ByteByteGo — 8 dicas práticas pra fault tolerance: redundância, failover, circuit breaker, retries com backoff, timeouts, graceful degradation.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 6,
    topicSlugs: ['reliability'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'reliability', 'fault-tolerance', 'circuit-breaker', 'retry', 'bytebytego'],
  },
  {
    title: 'Top 7 Most-Used Distributed System Patterns',
    url: 'https://www.youtube.com/watch?v=nH4qjmP2KEE',
    description:
      'ByteByteGo — 7 padrões clássicos de sistemas distribuídos: leader/follower, consensus (Paxos/Raft), heartbeat, sharding, write-ahead log, gossip.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 7,
    topicSlugs: ['reliability', 'cap-consistency'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'reliability', 'distributed-systems', 'consensus', 'paxos', 'raft', 'bytebytego'],
  },
  {
    title: 'Fail-over and High-Availability (Explained by Example)',
    url: 'https://www.youtube.com/watch?v=Zgy1miPsTNs',
    description:
      'Hussein Nasser — failover e alta disponibilidade com exemplo prático: active-passive vs active-active, health checks, split-brain, RTO vs RPO.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 20,
    topicSlugs: ['reliability'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Hussein Nasser',
    tags: ['concept', 'reliability', 'failover', 'high-availability', 'split-brain', 'hussein-nasser'],
  },

  // ---------------------------------------------------------------------------
  // pubsub (3 items) — 2026-04-26
  // ---------------------------------------------------------------------------
  {
    title: 'Top 5 Most Used Architecture Patterns',
    url: 'https://www.youtube.com/watch?v=f6zXyq4VPP8',
    description:
      'ByteByteGo — 5 padrões arquiteturais clássicos: layered, event-driven (pub/sub), microservices, microkernel, space-based. Quando aplicar cada um.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 6,
    topicSlugs: ['pubsub', 'design-patterns'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'pubsub', 'architecture-patterns', 'overview', 'event-driven', 'bytebytego'],
  },
  {
    title: 'Publish-Subscribe Architecture (Explained by Example)',
    url: 'https://www.youtube.com/watch?v=O1PgqUqZKTA',
    description:
      'Hussein Nasser — pub/sub explicado com exemplo prático: producer/topic/subscriber, desacoplamento, fan-out, casos de uso reais. 30min.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 30,
    topicSlugs: ['pubsub'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Hussein Nasser',
    tags: ['concept', 'pubsub', 'publish-subscribe', 'event-driven', 'fan-out', 'hussein-nasser'],
  },
  {
    title: 'Publish-Subscribe Pattern vs Message Queues vs Request Response (Detailed Discussion with Examples)',
    url: 'https://www.youtube.com/watch?v=DXTHb9TqJOs',
    description:
      'Hussein Nasser — comparativo profundo de 3 padrões de comunicação: pub/sub (fan-out), message queues (work distribution), request-response (síncrono). 44min.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 44,
    topicSlugs: ['pubsub', 'message-queues'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Hussein Nasser',
    tags: ['tradeoffs', 'pubsub', 'message-queues', 'request-response', 'comparison', 'hussein-nasser'],
  },

  // ---------------------------------------------------------------------------
  // cap-consistency (4 items) — 2026-04-26
  // ---------------------------------------------------------------------------
  {
    title: 'CAP Theorem Simplified',
    url: 'https://www.youtube.com/watch?v=BHqjEjzAicA',
    description:
      'ByteByteGo — CAP em 6min: consistência, disponibilidade, tolerância a partição, por que só dá pra escolher 2 quando partition acontece.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 6,
    topicSlugs: ['cap-consistency'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'cap-theorem', 'consistency', 'availability', 'partition-tolerance', 'bytebytego'],
  },
  {
    title: 'ACID Properties in Databases With Examples',
    url: 'https://www.youtube.com/watch?v=GAe5oB742dw',
    description:
      'ByteByteGo — ACID em 5min com exemplos: atomicity, consistency, isolation, durability. Por que cada propriedade importa.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 5,
    topicSlugs: ['cap-consistency', 'databases'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'acid', 'transactions', 'consistency', 'isolation', 'bytebytego'],
  },
  {
    title: 'My thoughts on the CAP theorem',
    url: 'https://www.youtube.com/watch?v=KmGy3sU6Xw8',
    description:
      'Hussein Nasser — perspectiva crítica sobre CAP em 18min: por que o teorema é mal interpretado, partition tolerance não é opcional na prática.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 18,
    topicSlugs: ['cap-consistency'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Hussein Nasser',
    tags: ['concept', 'cap-theorem', 'partition-tolerance', 'distributed', 'opinion', 'hussein-nasser'],
  },
  {
    title: 'Relational Database ACID Transactions (Explained by Example)',
    url: 'https://www.youtube.com/watch?v=pomxJOFVcQs',
    description:
      'Hussein Nasser — ACID transactions deep dive em 43min: cada propriedade implementada na prática (Postgres), isolation levels, locks, MVCC.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 43,
    topicSlugs: ['cap-consistency', 'databases'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Hussein Nasser',
    tags: ['concept', 'acid', 'transactions', 'isolation-levels', 'mvcc', 'postgres', 'hussein-nasser'],
  },

  // ---------------------------------------------------------------------------
  // recursion (6 items) — 2026-04-27
  // ---------------------------------------------------------------------------
  {
    title: 'Recursion basics — using factorial',
    url: 'https://www.youtube.com/watch?v=_OmRGjbyzno',
    description:
      'mycodeschool — recursion do zero com factorial: base case, chamada recursiva, stack frames empilhados.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 9,
    topicSlugs: ['recursion'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'recursion', 'factorial', 'base-case', 'stack-frames'],
  },
  {
    title: 'Mentiram pra você sobre recursão...',
    url: 'https://www.youtube.com/watch?v=5Zmc6f420rg',
    description:
      'Augusto Galego — perspectiva BR mais ampla sobre recursão em 24min: quando vale, quando não, por que iteração às vezes ganha.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 24,
    topicSlugs: ['recursion'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Augusto Galego',
    tags: ['concept', 'recursion', 'iteration', 'tradeoffs', 'galego'],
  },
  {
    title: 'Time and space complexity analysis of recursive programs — using factorial',
    url: 'https://www.youtube.com/watch?v=ncpTxqK35PI',
    description:
      'mycodeschool — análise de complexidade de recursão: stack depth, ocupação de memória pelas chamadas, custo extra vs iteração.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 8,
    topicSlugs: ['recursion'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'recursion', 'complexity', 'stack-depth', 'memory'],
  },
  {
    title: 'The Backtracking Blueprint — The Legendary 3 Keys to Backtracking Algorithms',
    url: 'https://www.youtube.com/watch?v=Zq4upTEaQyM',
    description:
      'Back to Back SWE — backtracking como paradigma: 3 perguntas-chave (escolha, restrições, fim) com template aplicável a qualquer problema.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 14,
    topicSlugs: ['recursion'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Back To Back SWE',
    tags: ['concept', 'recursion', 'backtracking', 'paradigm', 'template'],
  },
  {
    title: 'The N Queens Problem using Backtracking/Recursion — Explained',
    url: 'https://www.youtube.com/watch?v=wGbuCyNpxIg',
    description:
      'Back to Back SWE — N Queens: como backtracking explora o tabuleiro coluna a coluna podando posições inválidas.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 14,
    topicSlugs: ['recursion'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Back To Back SWE',
    tags: ['concept', 'recursion', 'backtracking', 'n-queens', 'application'],
  },
  {
    title: 'Grokking Algorithms — Recursion (chapter 3)',
    url: 'https://github.com/egonSchiele/grokking_algorithms',
    description:
      'Capítulo 3 do Grokking Algorithms (Bhargava, Manning). Recursion: base case, recursive case, stack das chamadas, exemplos visuais. Livro pago — ver biblioteca da Inteli ou Manning. O GitHub tem só o código de apoio, não o PDF.',
    format: 'BOOK',
    difficulty: 'MEDIUM',
    estimatedMinutes: 25,
    topicSlugs: ['recursion'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'Book — Grokking Algorithms',
    tags: ['concept', 'book', 'grokking', 'recursion'],
  },

  // ---------------------------------------------------------------------------
  // PROBLEMs — Arrays & Hashing (NeetCode 150) — 2026-04-28
  // 9 itens · 3 Easy + 6 Medium · primary=array, cover=hashmap (universal)
  // ---------------------------------------------------------------------------
  {
    title: 'LeetCode 217 — Contains Duplicate',
    url: 'https://leetcode.com/problems/contains-duplicate/',
    description:
      'Checar se um array tem algum valor duplicado. Set em uma passada O(n), ou sort + scan O(n log n).',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['array', 'hashmap'],
    tracks: [],
    source: 'LeetCode — Arrays & Hashing',
    tags: ['practice', 'leetcode', 'lc-217', 'arrays-hashing', 'hashset'],
  },
  {
    title: 'LeetCode 1 — Two Sum',
    url: 'https://leetcode.com/problems/two-sum/',
    description:
      'Encontrar índices de dois elementos que somam um target. Hash map em uma passada faz O(n) — guarda o complemento conforme percorre.',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['array', 'hashmap'],
    tracks: [],
    source: 'LeetCode — Arrays & Hashing',
    tags: ['practice', 'leetcode', 'lc-1', 'arrays-hashing', 'hashmap'],
  },
  {
    title: 'LeetCode 242 — Valid Anagram',
    url: 'https://leetcode.com/problems/valid-anagram/',
    description:
      'Decidir se duas strings são anagramas. Conta caracteres com hash map (ou array de 26) e compara.',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['array', 'hashmap'],
    tracks: [],
    source: 'LeetCode — Arrays & Hashing',
    tags: ['practice', 'leetcode', 'lc-242', 'arrays-hashing', 'string', 'counting'],
  },
  {
    title: 'LeetCode 49 — Group Anagrams',
    url: 'https://leetcode.com/problems/group-anagrams/',
    description:
      'Agrupar strings que são anagramas entre si. Key do hash map = sorted chars (O(nk log k)) ou tuple de contagens (O(nk)).',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array', 'hashmap'],
    tracks: [],
    source: 'LeetCode — Arrays & Hashing',
    tags: ['practice', 'leetcode', 'lc-49', 'arrays-hashing', 'hashmap', 'string'],
  },
  {
    title: 'LeetCode 347 — Top K Frequent Elements',
    url: 'https://leetcode.com/problems/top-k-frequent-elements/',
    description:
      'Top K elementos mais frequentes do array. Bucket sort por contagem em O(n), ou min-heap de tamanho K em O(n log k).',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array', 'hashmap', 'heap'],
    tracks: [],
    source: 'LeetCode — Arrays & Hashing',
    tags: ['practice', 'leetcode', 'lc-347', 'arrays-hashing', 'bucket-sort', 'heap'],
  },
  {
    title: 'LeetCode 238 — Product of Array Except Self',
    url: 'https://leetcode.com/problems/product-of-array-except-self/',
    description:
      'Produto de todos os elementos exceto o próprio, sem divisão. Prefix * suffix em duas passadas, O(n) tempo, O(1) extra.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array'],
    tracks: [],
    source: 'LeetCode — Arrays & Hashing',
    tags: ['practice', 'leetcode', 'lc-238', 'arrays-hashing', 'prefix-product'],
  },
  {
    title: 'LeetCode 36 — Valid Sudoku',
    url: 'https://leetcode.com/problems/valid-sudoku/',
    description:
      'Validar tabuleiro de Sudoku 9×9 (sem precisar resolver). Três conjuntos simultâneos: linhas, colunas, boxes 3×3.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array', 'hashmap'],
    tracks: [],
    source: 'LeetCode — Arrays & Hashing',
    tags: ['practice', 'leetcode', 'lc-36', 'arrays-hashing', 'matrix', 'hashset'],
  },
  {
    title: 'LeetCode 271 — Encode and Decode Strings',
    url: 'https://leetcode.com/problems/encode-and-decode-strings/',
    description:
      'Serializar e desserializar uma lista de strings. Length-prefix encoding (`<n>#<string>`) é a solução robusta — funciona com qualquer caractere.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array'],
    tracks: [],
    source: 'LeetCode — Arrays & Hashing',
    tags: ['practice', 'leetcode', 'lc-271', 'arrays-hashing', 'string', 'serialization'],
  },
  {
    title: 'LeetCode 128 — Longest Consecutive Sequence',
    url: 'https://leetcode.com/problems/longest-consecutive-sequence/',
    description:
      'Maior sequência de números consecutivos no array, em O(n). Set + começa a contar só de `n` quando `n-1` não existe (evita re-trabalho).',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array', 'hashmap'],
    tracks: [],
    source: 'LeetCode — Arrays & Hashing',
    tags: ['practice', 'leetcode', 'lc-128', 'arrays-hashing', 'hashset'],
  },
];

// -----------------------------------------------------------------------------
// Embedding helper — optional, skipped when OPENAI_API_KEY is missing
// -----------------------------------------------------------------------------

async function maybeEmbed(
  openai: OpenAI | null,
  title: string,
  description: string | null,
  tags: string[],
): Promise<number[] | null> {
  if (!openai) return null;
  const text = [title, description ?? '', tags.join(' ')].join('\n').trim();
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return res.data[0]?.embedding ?? null;
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true, email: true },
  });
  if (!admin) {
    throw new Error(
      'No admin user found. Create one via Google OAuth first (role ADMIN).',
    );
  }
  console.log(`Using admin: ${admin.email}`);

  const openai = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;
  if (!openai) {
    console.warn(
      'OPENAI_API_KEY not set — items will be created without embeddings. ' +
        'Re-save them via the admin UI later to generate embeddings.',
    );
  }

  // 1) Topics: upsert by slug
  console.log(`Upserting ${TOPICS.length} topics...`);
  const topicIdBySlug = new Map<string, string>();
  for (const t of TOPICS) {
    const topic = await prisma.topic.upsert({
      where: { slug: t.slug },
      update: { label: t.label, order: t.order },
      create: t,
    });
    topicIdBySlug.set(topic.slug, topic.id);
  }
  console.log(`  ✓ ${topicIdBySlug.size} topics ready`);

  // 2) Items: upsert by (title, url) — find-then-update/create.
  // For topics, we resolve slugs → ids and then rewrite the LibraryItemTopic
  // join rows in a single transaction per item (idempotent: primary =
  // first slug, secondary covers = the rest).
  console.log(`Upserting ${ITEMS.length} library items...`);
  let created = 0;
  let updated = 0;
  for (const item of ITEMS) {
    if (!item.topicSlugs || item.topicSlugs.length === 0) {
      throw new Error(`Item "${item.title}" has empty topicSlugs`);
    }
    const topicIds = item.topicSlugs.map((slug) => {
      const id = topicIdBySlug.get(slug);
      if (!id) throw new Error(`Unknown topicSlug: ${slug}`);
      return { slug, id };
    });

    const existing = await prisma.libraryItem.findFirst({
      where: { title: item.title, url: item.url ?? undefined },
      select: { id: true },
    });

    const data = {
      title: item.title,
      url: item.url,
      description: item.description,
      format: item.format,
      difficulty: item.difficulty,
      estimatedMinutes: item.estimatedMinutes,
      tracks: item.tracks,
      source: item.source,
      tags: item.tags,
      createdById: admin.id,
    };

    const saved = existing
      ? await prisma.libraryItem.update({ where: { id: existing.id }, data })
      : await prisma.libraryItem.create({ data });

    await prisma.$transaction([
      prisma.libraryItemTopic.deleteMany({ where: { itemId: saved.id } }),
      ...topicIds.map((t, idx) =>
        prisma.libraryItemTopic.create({
          data: {
            itemId: saved.id,
            topicId: t.id,
            isPrimary: idx === 0,
          },
        }),
      ),
    ]);

    existing ? updated++ : created++;

    const embedding = await maybeEmbed(
      openai,
      item.title,
      item.description,
      item.tags,
    );
    if (embedding) {
      const vectorLiteral = `[${embedding.join(',')}]`;
      await prisma.$executeRawUnsafe(
        `UPDATE "LibraryItem" SET "embedding" = $2::vector WHERE "id" = $1`,
        saved.id,
        vectorLiteral,
      );
    }
  }
  console.log(`  ✓ ${created} created, ${updated} updated`);
  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * Library seed — topics taxonomy + library items.
 *
 * Idempotent: topics upsert by slug, items upsert by (title + url).
 *
 * Run from repo root:
 *   pnpm --filter @ics-select/api seed:library
 */
import { PrismaClient } from '@ics-select/prisma';
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
  // Optional per-topic pedagogical order. Map of slug → integer. Items
  // shown under a topic are sorted by this order ASC NULLS LAST, then by
  // difficulty (E→M→H), then title. Cross-topic items can have different
  // orders in different topics. Use sequential 1, 2, 3... within a topic.
  topicOrder?: Record<string, number>;
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

  // Algorithms & Data Structures (order 0–14)
  // Order reflects pedagogical flow: foundational DS first (array/hashmap/lists),
  // then algorithmic concepts that come up in interview reasoning (sorting,
  // searching, recursion), then hierarchical structures (tree/trie/heap/graph),
  // then advanced patterns. Sorting/Searching come early because they're
  // conceitos-chave (Big-O, estabilidade, "quando ordenar?") mesmo sem LC heavy.
  // Reordered 2026-05-04 from the layout that left hashmap at 13.
  { slug: 'array', label: 'Array', order: 0 },
  { slug: 'hashmap', label: 'Hash Map', order: 1 },
  { slug: 'lists', label: 'Lists', order: 2 },
  { slug: 'sorting', label: 'Sorting', order: 3 },
  { slug: 'searching', label: 'Searching', order: 4 },
  { slug: 'recursion', label: 'Recursion & Backtracking', order: 5 },
  { slug: 'tree', label: 'Tree', order: 6 },
  { slug: 'trie', label: 'Trie', order: 7 },
  { slug: 'heap', label: 'Heap', order: 8 },
  { slug: 'graph', label: 'Graph', order: 9 },
  { slug: 'dp', label: 'Dynamic Programming', order: 10 },
  { slug: 'greedy', label: 'Greedy', order: 11 },
  { slug: 'bit-manipulation', label: 'Bit Manipulation', order: 12 },
  { slug: 'math', label: 'Math (foundations for ML/DS)', order: 13 },
  { slug: 'data-science', label: 'Data Science & ML', order: 14 },

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
    topicOrder: { 'caching': 1 },
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
    topicOrder: { 'caching': 5 },
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
    topicOrder: { 'caching': 4 },
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
    topicOrder: { 'caching': 8 },
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
    topicOrder: { 'caching': 6 },
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
    topicOrder: { 'databases': 2 },
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
    topicOrder: { 'databases': 1 },
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
    topicOrder: { 'databases': 3 },
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
    topicOrder: { 'databases': 7 },
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
    topicOrder: { 'databases': 16 },
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
    topicOrder: { 'databases': 17 },
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
    topicOrder: { 'databases': 14 },
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
    topicOrder: { 'databases': 8 },
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
    topicOrder: { 'databases': 11 },
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
    topicOrder: { 'databases': 13 },
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
    topicOrder: { 'databases': 20 },
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
    topicOrder: { 'array': 3 },
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
    topicOrder: { 'array': 2 },
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
    topicOrder: { 'array': 4 },
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
    topicOrder: { 'array': 44, 'hashmap': 3 },
  },
  {
    title: '10 Key Data Structures We Use Every Day',
    url: 'https://www.youtube.com/watch?v=ouipSd_5ivQ',
    description:
      'Pequeno resumo de quais estruturas existem, mais um reforço apenas para consolidar quais vamos estudar em breve.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 9,
    // Cross-topic overview: primary = array (foundation everyone hits first),
    // covers the rest of the families mentioned in the video.
    topicSlugs: ['array', 'lists', 'hashmap', 'tree', 'graph'],
    tracks: [],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'data-structures', 'overview'],
    topicOrder: { 'array': 1, 'graph': 1, 'hashmap': 10, 'lists': 1, 'tree': 1 },
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
    topicOrder: { 'array': 5 },
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
    topicOrder: { 'lists': 2 },
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
    topicOrder: { 'lists': 6 },
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
    topicOrder: { 'lists': 4 },
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
    topicOrder: { 'lists': 7 },
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
    topicOrder: { 'lists': 3 },
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
    topicOrder: { 'lists': 10 },
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
    topicOrder: { 'lists': 8 },
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
    topicOrder: { 'lists': 5 },
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
    difficulty: 'MEDIUM',
    estimatedMinutes: 5,
    topicSlugs: ['tree', 'array', 'databases', 'trie'],
    tracks: [],
    source: 'YouTube — Fireship',
    tags: ['concept', 'b-tree', 'radix-tree', 'rope', 'bloom-filter', 'cuckoo-hashing', 'fireship'],
    topicOrder: { 'array': 45, 'databases': 9, 'tree': 25, 'trie': 7 },
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
    topicOrder: { 'tree': 2 },
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
    topicOrder: { 'tree': 3 },
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
    topicOrder: { 'tree': 6 },
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
    topicOrder: { 'tree': 4 },
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
    topicOrder: { 'tree': 21 },
  },
  {
    title: 'B-Tree vs. LSM-Tree',
    url: 'https://bytebytego.com/guides/b-tree-vs/',
    description:
      'ByteByteGo — B-Tree (Postgres, MySQL) vs LSM-Tree (Cassandra, RocksDB): read vs write, write amplification, compaction.',
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 12,
    topicSlugs: ['tree', 'databases'],
    tracks: [],
    source: 'Guide — ByteByteGo',
    tags: ['tradeoffs', 'b-tree', 'lsm-tree', 'storage-engine', 'write-amplification'],
    topicOrder: { 'databases': 12, 'tree': 26 },
  },
  {
    title: 'Grokking Data Structures — Trees (chapter)',
    url: 'https://github.com/mlarocca/grokking_data_structures',
    description:
      'Capítulo de trees do Grokking Data Structures (La Rocca, Manning). Binary trees, BSTs, traversals, balanced trees no estilo visual-heavy do livro. Livro pago — ver biblioteca da Inteli ou Manning. O GitHub tem só o código de apoio, não o PDF.',
    format: 'BOOK',
    difficulty: 'EASY',
    estimatedMinutes: 25,
    topicSlugs: ['tree'],
    tracks: [],
    source: 'Book — Grokking Data Structures',
    tags: ['concept', 'book', 'grokking', 'tree', 'bst'],
    topicOrder: { 'tree': 7 },
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
    topicOrder: { 'tree': 5 },
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
    topicOrder: { 'sorting': 1 },
  },
  {
    title: 'Selection sort algorithm',
    url: 'https://www.youtube.com/watch?v=GUDLRan2DWM',
    description:
      'mycodeschool — selection sort em diagrama: escolhe o mínimo e troca. Análise O(n²) com número exato de comparações/trocas.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 11,
    topicSlugs: ['sorting'],
    tracks: [],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'selection-sort', 'complexity'],
    topicOrder: { 'sorting': 5 },
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
    topicOrder: { 'sorting': 7 },
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
    topicOrder: { 'sorting': 9 },
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
    topicOrder: { 'sorting': 11 },
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
    topicOrder: { 'sorting': 10 },
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
    topicOrder: { 'cap-consistency': 3, 'reliability': 1 },
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
    topicOrder: { 'reliability': 3 },
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
    topicOrder: { 'caching': 3 },
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
    topicOrder: { 'databases': 4 },
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
    topicOrder: { 'databases': 19, 'sharding': 2 },
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
    topicOrder: { 'containers': 3 },
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
    topicOrder: { 'security': 4 },
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
    topicOrder: { 'cloud': 2 },
  },
  {
    title: 'A Mentira do "100% Anônimo" das VPNs',
    url: 'https://www.youtube.com/watch?v=idD_vk3bTCQ',
    description:
      'Arthur Takeda — como VPN realmente funciona em 8min: túnel IP, DNS leaks, o provedor virando o novo middleman.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 8,
    topicSlugs: ['networking', 'security'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Arthur Takeda',
    tags: ['tradeoffs', 'vpn', 'privacy', 'dns', 'networking', 'pt-br'],
    topicOrder: { 'networking': 8, 'security': 13 },
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
    topicOrder: { 'foundations': 1 },
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
    topicOrder: { 'design-patterns': 2 },
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
    topicOrder: { 'foundations': 6 },
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
    topicOrder: { 'foundations': 5 },
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
    topicOrder: { 'foundations': 3 },
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
    topicOrder: { 'foundations': 4 },
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
    topicOrder: { 'foundations': 2 },
  },
  {
    title: 'How to Read Code in the AI Era (6 Techniques)',
    url: 'https://www.youtube.com/watch?v=4t8QcDdrL6Y',
    description:
      'KodeKloud — 6 técnicas pra ler código que você não escreveu, demonstradas num endpoint de login: seguir a variável que importa, ignorar o ruído, achar os bugs de segurança que a IA deixou passar (timing attack, enumeração de usuário). 4min.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 4,
    topicSlugs: ['foundations'],
    tracks: [],
    source: 'YouTube — KodeKloud',
    tags: ['concept', 'code-reading', 'ai-coding', 'code-review', 'onboarding'],
    topicOrder: { 'foundations': 15 },
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
    topicOrder: { hashmap: 6 },
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
    topicOrder: { 'cap-consistency': 4, 'load-balancers': 3, 'scalability': 1 },
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
    topicOrder: { 'heap': 1 },
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
    topicOrder: { 'heap': 3 },
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
    topicOrder: { 'heap': 10 },
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
    topicOrder: { 'heap': 6, 'sorting': 14 },
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
    topicOrder: { 'heap': 2 },
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
    topicOrder: { 'graph': 2 },
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
    topicOrder: { 'graph': 3 },
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
    topicOrder: { 'graph': 5 },
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
    topicOrder: { 'graph': 8 },
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
    topicOrder: { 'graph': 25, 'heap': 15 },
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
    topicOrder: { 'graph': 18 },
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
    topicOrder: { 'graph': 6 },
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
    topicOrder: { 'graph': 26, 'heap': 16 },
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
    topicOrder: { 'searching': 1 },
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
    topicOrder: { 'searching': 2 },
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
    topicOrder: { 'searching': 4 },
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
    topicOrder: { 'searching': 6 },
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
    topicOrder: { 'searching': 7 },
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
    topicOrder: { 'searching': 3 },
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
    topicOrder: { 'recursion': 6 },
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
    topicOrder: { 'dp': 2, 'recursion': 2 },
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
    topicOrder: { 'dp': 1 },
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
    topicOrder: { 'dp': 3, 'recursion': 10 },
  },
  {
    title: 'The 0/1 Knapsack Problem (Demystifying Dynamic Programming)',
    url: 'https://www.youtube.com/watch?v=xCbYmUPvc2Q',
    description:
      'Back to Back SWE — 0/1 Knapsack: tabela 2D itens × capacidade, decisão pegar ou não a cada passo.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 21,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Back To Back SWE',
    tags: ['concept', 'dp', '0-1-knapsack', '2d-dp', 'classic'],
    topicOrder: { 'dp': 15 },
  },
  {
    title: 'Edit Distance Between 2 Strings — The Levenshtein Distance',
    url: 'https://www.youtube.com/watch?v=MiqoA-yF-0M',
    description:
      'Back to Back SWE — Levenshtein/Edit Distance: tabela 2D, três operações (insert, delete, replace) custam 1 cada.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 17,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Back To Back SWE',
    tags: ['concept', 'dp', 'edit-distance', 'levenshtein', 'string-dp', '2d-dp'],
    topicOrder: { 'dp': 23 },
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
    topicOrder: { 'dp': 12 },
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
    topicOrder: { 'databases': 18 },
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
    topicOrder: { 'trie': 3 },
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
    topicOrder: { 'trie': 2 },
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
    topicOrder: { 'sorting': 2 },
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
    topicOrder: { 'sorting': 4 },
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
    topicOrder: { 'sorting': 3 },
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
    topicOrder: { 'recursion': 7, 'sorting': 6 },
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
    topicOrder: { 'recursion': 8, 'sorting': 8 },
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
    topicOrder: { 'sorting': 12 },
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
    topicOrder: { 'sorting': 13 },
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
    topicOrder: { 'graph': 4 },
  },
  {
    title: 'AlgoViz — DFS (Depth-First Search)',
    url: 'https://algorithms.daviduarte.com.br/algoritmos/dfs',
    description:
      'AlgoViz — visualizador interativo de DFS: stack/recursão, exploração completa de cada caminho antes de retroceder. pt-BR.',
    format: 'ARTICLE',
    difficulty: 'EASY',
    estimatedMinutes: 8,
    topicSlugs: ['graph', 'recursion'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'Site — AlgoViz (Davi Duarte)',
    tags: ['concept', 'graph', 'dfs', 'recursion', 'stack', 'algoviz', 'visualization', 'pt-br'],
    topicOrder: { 'graph': 7, 'recursion': 9 },
  },
  {
    title: 'AlgoViz — Dijkstra',
    url: 'https://algorithms.daviduarte.com.br/algoritmos/dijkstra',
    description:
      'AlgoViz — visualizador interativo de Dijkstra: priority queue, caminho mais curto em grafo com pesos não-negativos. pt-BR.',
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 10,
    topicSlugs: ['graph', 'heap'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'Site — AlgoViz (Davi Duarte)',
    tags: ['concept', 'graph', 'dijkstra', 'shortest-path', 'priority-queue', 'algoviz', 'visualization', 'pt-br'],
    topicOrder: { 'graph': 24, 'heap': 14 },
  },
  {
    title: 'AlgoViz — Topological Sort',
    url: 'https://algorithms.daviduarte.com.br/algoritmos/topological-sort',
    description:
      'AlgoViz — visualizador interativo de topological sort: DAG, ordem que respeita dependências, Kahn ou DFS-based. pt-BR.',
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 10,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'Site — AlgoViz (Davi Duarte)',
    tags: ['concept', 'graph', 'topological-sort', 'dag', 'kahn', 'algoviz', 'visualization', 'pt-br'],
    topicOrder: { 'graph': 17 },
  },
  {
    title: 'AlgoViz — Union-Find (DSU)',
    url: 'https://algorithms.daviduarte.com.br/algoritmos/union-find',
    description:
      'AlgoViz — visualizador interativo de Union-Find (DSU): union, find, path compression, detecção de componentes conexos. pt-BR.',
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 10,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'Site — AlgoViz (Davi Duarte)',
    tags: ['concept', 'graph', 'union-find', 'dsu', 'path-compression', 'algoviz', 'visualization', 'pt-br'],
    topicOrder: { 'graph': 21 },
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
    topicOrder: { 'array': 25 },
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
    topicOrder: { 'array': 9, 'hashmap': 7 },
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
    topicOrder: { 'caching': 7, 'hashmap': 11, 'lists': 18 },
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
    topicOrder: { 'tree': 24, 'trie': 1 },
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
    difficulty: 'MEDIUM',
    estimatedMinutes: 9,
    topicSlugs: ['hashmap', 'sharding'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'hashmap', 'consistent-hashing', 'sharding', 'distributed', 'bytebytego'],
    topicOrder: { 'hashmap': 13, 'sharding': 3 },
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
    topicOrder: { hashmap: 9 },
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
    topicOrder: { hashmap: 8 },
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
    topicOrder: { 'message-queues': 3 },
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
    topicOrder: { 'message-queues': 2 },
  },
  {
    title: 'What is a Message Queue and When should you use Messaging Queue Systems Like RabbitMQ and Kafka',
    url: 'https://www.youtube.com/watch?v=W4_aGb_MOls',
    description:
      'Hussein Nasser — o que é message queue e quando usar: desacoplamento producer/consumer, retry, ordering, comparação Kafka vs RabbitMQ.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 14,
    topicSlugs: ['message-queues'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Hussein Nasser',
    tags: ['concept', 'message-queues', 'overview', 'when-to-use', 'hussein-nasser'],
    topicOrder: { 'message-queues': 1 },
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
    topicOrder: { 'message-queues': 5, 'pubsub': 4 },
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
    topicOrder: { 'message-queues': 4 },
  },
  {
    title: 'System Design: Why is Kafka fast?',
    url: 'https://www.youtube.com/watch?v=UNUz1-msbOM',
    description:
      'ByteByteGo — por que Kafka é rápido: zero-copy, sequential I/O, batch + compression no producer.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 6,
    topicSlugs: ['message-queues'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'kafka', 'internals', 'zero-copy', 'sequential-io'],
    topicOrder: { 'message-queues': 7 },
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
    topicOrder: { 'greedy': 9 },
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
    topicOrder: { 'greedy': 13 },
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
    topicOrder: { 'greedy': 11 },
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
    topicOrder: { 'greedy': 2 },
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
    topicOrder: { 'greedy': 3, 'tree': 27 },
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
    topicOrder: { 'greedy': 1 },
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
    topicOrder: { 'rate-limiting': 1 },
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
    topicOrder: { 'rate-limiting': 2 },
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
    topicOrder: { 'rate-limiting': 5 },
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
    topicOrder: { 'rate-limiting': 4 },
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
    topicOrder: { 'rate-limiting': 3 },
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
    topicOrder: { 'rate-limiting': 6 },
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
    topicOrder: { 'networking': 1 },
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
    topicOrder: { 'networking': 2 },
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
    topicOrder: { 'networking': 4 },
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
    topicOrder: { 'networking': 3, 'security': 12 },
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
    topicOrder: { 'networking': 7 },
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
    topicOrder: { 'networking': 5 },
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
    topicOrder: { 'networking': 6, 'pubsub': 5 },
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
    difficulty: 'MEDIUM',
    estimatedMinutes: 19,
    topicSlugs: ['caching'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Augusto Galego',
    tags: ['concept', 'caching', 'fundamentals', 'hit-miss', 'galego'],
    topicOrder: { 'caching': 2 },
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
    topicOrder: { 'load-balancers': 2 },
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
    topicOrder: { 'sharding': 1 },
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
    topicOrder: { 'sharding': 4 },
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
    topicOrder: { 'scalability': 2 },
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
    topicOrder: { 'design-patterns': 7, 'scalability': 4 },
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
    topicOrder: { 'design-patterns': 3 },
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
    topicOrder: { 'design-patterns': 9, 'reliability': 6 },
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
    topicOrder: { 'load-balancers': 4 },
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
    topicOrder: { 'containers': 1 },
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
    topicOrder: { 'containers': 2 },
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
    topicOrder: { 'containers': 7, 'scalability': 3 },
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
    topicOrder: { 'containers': 5 },
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
    topicOrder: { 'containers': 6 },
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
    topicOrder: { 'containers': 4 },
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
    topicOrder: { 'cloud': 1 },
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
    topicOrder: { 'cloud': 3 },
  },
  {
    title: 'But What Is Cloud Native Really All About?',
    url: 'https://www.youtube.com/watch?v=p-88GN1WVs8',
    description:
      'ByteByteGo — Cloud Native como prática: containers + microservices + orquestração + DevOps + observabilidade. Não é só rodar na cloud.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 8,
    topicSlugs: ['cloud'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'cloud', 'cloud-native', 'microservices', 'devops', 'bytebytego'],
    topicOrder: { 'cloud': 4 },
  },
  {
    title: 'Serverless Computing in 100 Seconds',
    url: 'https://www.youtube.com/watch?v=W_VV2Fx32_Y',
    description:
      'Fireship — serverless explicado: FaaS (Lambda, Cloud Functions), pay-per-execution, cold start, quando vale e quando não.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 17,
    topicSlugs: ['cloud'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Fireship',
    tags: ['concept', 'cloud', 'serverless', 'faas', 'lambda', 'fireship'],
    topicOrder: { 'cloud': 5 },
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
    topicOrder: { 'cloud': 6, 'scalability': 5 },
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
    topicOrder: { 'security': 1 },
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
    topicOrder: { 'security': 3 },
  },
  {
    title: '7 Cryptography Concepts EVERY Developer Should Know',
    url: 'https://www.youtube.com/watch?v=NuyzuNBFWxQ',
    description:
      'Fireship — 7 conceitos de criptografia: hashing, salting, symmetric/asymmetric encryption, signatures, MAC, key exchange.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 12,
    topicSlugs: ['security'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Fireship',
    tags: ['concept', 'security', 'cryptography', 'hashing', 'encryption', 'fireship'],
    topicOrder: { 'security': 11 },
  },
  {
    title: 'OAuth 2 Explained In Simple Terms',
    url: 'https://www.youtube.com/watch?v=ZV5yTm4pT8g',
    description:
      'ByteByteGo — OAuth 2 sem jargão: roles (resource owner, client, auth server, resource server), flows authorization code e client credentials.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 5,
    topicSlugs: ['security'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'security', 'oauth', 'oauth2', 'authorization', 'bytebytego'],
    topicOrder: { 'security': 10 },
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
    topicOrder: { 'security': 9 },
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
    topicOrder: { 'security': 7 },
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
    topicOrder: { 'security': 2 },
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
    topicOrder: { 'reliability': 2 },
  },
  {
    title: 'Top 7 Most-Used Distributed System Patterns',
    url: 'https://www.youtube.com/watch?v=nH4qjmP2KEE',
    description:
      'ByteByteGo — 7 padrões clássicos de sistemas distribuídos: leader/follower, consensus (Paxos/Raft), heartbeat, sharding, write-ahead log, gossip.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 7,
    topicSlugs: ['reliability', 'cap-consistency'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'reliability', 'distributed-systems', 'consensus', 'paxos', 'raft', 'bytebytego'],
    topicOrder: { 'cap-consistency': 6, 'reliability': 4 },
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
    topicOrder: { 'reliability': 5 },
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
    topicOrder: { 'design-patterns': 1, 'pubsub': 1 },
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
    topicOrder: { 'pubsub': 2 },
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
    topicOrder: { 'message-queues': 6, 'pubsub': 3 },
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
    topicOrder: { 'cap-consistency': 2 },
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
    topicOrder: { 'cap-consistency': 1, 'databases': 5 },
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
    topicOrder: { 'cap-consistency': 5 },
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
    topicOrder: { 'cap-consistency': 7, 'databases': 15 },
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
    topicOrder: { 'recursion': 1 },
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
    topicOrder: { 'recursion': 5 },
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
    topicOrder: { 'recursion': 3 },
  },
  {
    title: 'The Backtracking Blueprint — The Legendary 3 Keys to Backtracking Algorithms',
    url: 'https://www.youtube.com/watch?v=Zq4upTEaQyM',
    description:
      'Back to Back SWE — backtracking como paradigma: 3 perguntas-chave (escolha, restrições, fim) com template aplicável a qualquer problema.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 14,
    topicSlugs: ['recursion'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Back To Back SWE',
    tags: ['concept', 'recursion', 'backtracking', 'paradigm', 'template'],
    topicOrder: { 'recursion': 11 },
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
    topicOrder: { 'recursion': 20 },
  },
  {
    title: 'Grokking Algorithms — Recursion (chapter 3)',
    url: 'https://github.com/egonSchiele/grokking_algorithms',
    description:
      'Capítulo 3 do Grokking Algorithms (Bhargava, Manning). Recursion: base case, recursive case, stack das chamadas, exemplos visuais. Livro pago — ver biblioteca da Inteli ou Manning. O GitHub tem só o código de apoio, não o PDF.',
    format: 'BOOK',
    difficulty: 'EASY',
    estimatedMinutes: 25,
    topicSlugs: ['recursion'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'Book — Grokking Algorithms',
    tags: ['concept', 'book', 'grokking', 'recursion'],
    topicOrder: { 'recursion': 4 },
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
    topicOrder: { 'array': 7 },
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
    topicOrder: { 'array': 8 },
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
    topicOrder: { 'array': 10 },
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
    topicOrder: { 'array': 19 },
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
    topicOrder: { 'array': 20, 'heap': 8 },
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
    topicOrder: { 'array': 21 },
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
    topicOrder: { 'array': 22 },
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
    topicOrder: { 'array': 23 },
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
    topicOrder: { 'array': 24 },
  },
  // ---------------------------------------------------------------------------
  // PROBLEMs — Two Pointers (NeetCode 150) — 2026-04-28
  // 5 itens · 1 Easy + 3 Medium + 1 Hard
  // primary=array, tracks=[] universal
  // ---------------------------------------------------------------------------
  {
    title: 'LeetCode 125 — Valid Palindrome',
    url: 'https://leetcode.com/problems/valid-palindrome/',
    description:
      'Verifica se string é palíndromo ignorando não-alfanuméricos. Two pointers das pontas pro meio.',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['array'],
    tracks: [],
    source: 'LeetCode — Two Pointers',
    tags: ['practice', 'leetcode', 'lc-125', 'two-pointers'],
    topicOrder: { 'array': 11 },
  },
  {
    title: 'LeetCode 15 — 3Sum',
    url: 'https://leetcode.com/problems/3sum/',
    description:
      'Três números que somam zero, sem duplicatas. Sort + iterar fixando i e two pointers em [i+1..n).',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array'],
    tracks: [],
    source: 'LeetCode — Two Pointers',
    tags: ['practice', 'leetcode', 'lc-15', 'two-pointers'],
    topicOrder: { 'array': 15 },
  },
  {
    title: 'LeetCode 11 — Container With Most Water',
    url: 'https://leetcode.com/problems/container-with-most-water/',
    description:
      'Maior área entre duas linhas verticais. Two pointers nas pontas, move o menor lado.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array'],
    tracks: [],
    source: 'LeetCode — Two Pointers',
    tags: ['practice', 'leetcode', 'lc-11', 'two-pointers'],
    topicOrder: { 'array': 14 },
  },
  {
    title: 'LeetCode 167 — Two Sum II Input Array Is Sorted',
    url: 'https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/',
    description:
      'Two Sum mas com array ordenado. Two pointers nas pontas, ajusta L/R conforme soma vs target.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array'],
    tracks: [],
    source: 'LeetCode — Two Pointers',
    tags: ['practice', 'leetcode', 'lc-167', 'two-pointers'],
    topicOrder: { 'array': 12 },
  },
  {
    title: 'LeetCode 42 — Trapping Rain Water',
    url: 'https://leetcode.com/problems/trapping-rain-water/',
    description:
      'Volume de água acumulada. Two pointers + max esquerdo/direito — clássico mas não é trivial.',
    format: 'PROBLEM',
    difficulty: 'HARD',
    estimatedMinutes: 90,
    topicSlugs: ['array'],
    tracks: [],
    source: 'LeetCode — Two Pointers',
    tags: ['practice', 'leetcode', 'lc-42', 'two-pointers'],
    topicOrder: { 'array': 46 },
  },

  // ---------------------------------------------------------------------------
  // PROBLEMs — Sliding Window (NeetCode 150) — 2026-04-28
  // 6 itens · 1 Easy + 3 Medium + 2 Hard
  // primary=array, tracks=[] universal
  // ---------------------------------------------------------------------------
  {
    title: 'LeetCode 121 — Best Time to Buy And Sell Stock',
    url: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/',
    description:
      'Lucro máximo comprando e vendendo uma vez. Slide right, mantém min visto até agora.',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['array'],
    tracks: [],
    source: 'LeetCode — Sliding Window',
    tags: ['practice', 'leetcode', 'lc-121', 'sliding-window'],
    topicOrder: { 'array': 13 },
  },
  {
    title: 'LeetCode 424 — Longest Repeating Character Replacement',
    url: 'https://leetcode.com/problems/longest-repeating-character-replacement/',
    description:
      'Maior substring após trocar até K chars. Window — válida quando window_len - max_freq <= k.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array'],
    tracks: [],
    source: 'LeetCode — Sliding Window',
    tags: ['practice', 'leetcode', 'lc-424', 'sliding-window'],
    topicOrder: { 'array': 17 },
  },
  {
    title: 'LeetCode 3 — Longest Substring Without Repeating Characters',
    url: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/',
    description:
      'Maior substring sem char repetido. Sliding window + set, expand right e shrink left ao colidir.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array'],
    tracks: [],
    source: 'LeetCode — Sliding Window',
    tags: ['practice', 'leetcode', 'lc-3', 'sliding-window'],
    topicOrder: { 'array': 16 },
  },
  {
    title: 'LeetCode 567 — Permutation In String',
    url: 'https://leetcode.com/problems/permutation-in-string/',
    description:
      'String s2 contém alguma permutação de s1? Sliding window de tamanho fixo + match de contagens.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array'],
    tracks: [],
    source: 'LeetCode — Sliding Window',
    tags: ['practice', 'leetcode', 'lc-567', 'sliding-window'],
    topicOrder: { 'array': 18 },
  },
  {
    title: 'LeetCode 76 — Minimum Window Substring',
    url: 'https://leetcode.com/problems/minimum-window-substring/',
    description:
      'Menor janela em s que contém todos chars de t. Two pointers + dict de contagens, contrai quando válida.',
    format: 'PROBLEM',
    difficulty: 'HARD',
    estimatedMinutes: 90,
    topicSlugs: ['array'],
    tracks: [],
    source: 'LeetCode — Sliding Window',
    tags: ['practice', 'leetcode', 'lc-76', 'sliding-window'],
    topicOrder: { 'array': 48 },
  },
  {
    title: 'LeetCode 239 — Sliding Window Maximum',
    url: 'https://leetcode.com/problems/sliding-window-maximum/',
    description:
      'Max em cada janela de tamanho k. Deque monotônica — mantém candidatos em ordem decrescente.',
    format: 'PROBLEM',
    difficulty: 'HARD',
    estimatedMinutes: 90,
    topicSlugs: ['array'],
    tracks: [],
    source: 'LeetCode — Sliding Window',
    tags: ['practice', 'leetcode', 'lc-239', 'sliding-window'],
    topicOrder: { 'array': 47 },
  },

  // ---------------------------------------------------------------------------
  // PROBLEMs — Stack (NeetCode 150) — 2026-04-28
  // 7 itens · 1 Easy + 5 Medium + 1 Hard
  // primary=array, tracks=[] universal
  // ---------------------------------------------------------------------------
  {
    title: 'LeetCode 20 — Valid Parentheses',
    url: 'https://leetcode.com/problems/valid-parentheses/',
    description:
      'Parênteses balanceados. Stack — push abertura, pop e checa quando fecha.',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['array'],
    tracks: [],
    source: 'LeetCode — Stack',
    tags: ['practice', 'leetcode', 'lc-20', 'stack'],
    topicOrder: { 'array': 31 },
  },
  {
    title: 'LeetCode 853 — Car Fleet',
    url: 'https://leetcode.com/problems/car-fleet/',
    description:
      'Quantas frotas chegam no destino. Sort por posição desc, calcula tempo, conta fleets.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array'],
    tracks: [],
    source: 'LeetCode — Stack',
    tags: ['practice', 'leetcode', 'lc-853', 'stack'],
    topicOrder: { 'array': 36 },
  },
  {
    title: 'LeetCode 739 — Daily Temperatures',
    url: 'https://leetcode.com/problems/daily-temperatures/',
    description:
      'Pra cada dia, quantos até temperatura maior. Stack monotônica decrescente — pop quando acha maior.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array'],
    tracks: [],
    source: 'LeetCode — Stack',
    tags: ['practice', 'leetcode', 'lc-739', 'stack'],
    topicOrder: { 'array': 35 },
  },
  {
    title: 'LeetCode 150 — Evaluate Reverse Polish Notation',
    url: 'https://leetcode.com/problems/evaluate-reverse-polish-notation/',
    description:
      'Avaliar expressão em RPN. Stack — push números, pop dois e aplica quando é operador.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array'],
    tracks: [],
    source: 'LeetCode — Stack',
    tags: ['practice', 'leetcode', 'lc-150', 'stack'],
    topicOrder: { 'array': 34 },
  },
  {
    title: 'LeetCode 22 — Generate Parentheses',
    url: 'https://leetcode.com/problems/generate-parentheses/',
    description:
      'Todas combinações válidas de N pares. Backtracking contando abertos < n e fechados < abertos.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array'],
    tracks: [],
    source: 'LeetCode — Stack',
    tags: ['practice', 'leetcode', 'lc-22', 'stack'],
    topicOrder: { 'array': 33 },
  },
  {
    title: 'LeetCode 155 — Min Stack',
    url: 'https://leetcode.com/problems/min-stack/',
    description:
      'Stack que retorna min em O(1). Stack auxiliar guardando o min até cada nível.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array'],
    tracks: [],
    source: 'LeetCode — Stack',
    tags: ['practice', 'leetcode', 'lc-155', 'stack'],
    topicOrder: { 'array': 32 },
  },
  {
    title: 'LeetCode 84 — Largest Rectangle In Histogram',
    url: 'https://leetcode.com/problems/largest-rectangle-in-histogram/',
    description:
      'Maior retângulo no histograma. Stack monotônica — pra cada barra, expansão até barra menor.',
    format: 'PROBLEM',
    difficulty: 'HARD',
    estimatedMinutes: 90,
    topicSlugs: ['array'],
    tracks: [],
    source: 'LeetCode — Stack',
    tags: ['practice', 'leetcode', 'lc-84', 'stack'],
    topicOrder: { 'array': 49 },
  },

  // ---------------------------------------------------------------------------
  // PROBLEMs — Binary Search (NeetCode 150) — 2026-04-28
  // 7 itens · 1 Easy + 5 Medium + 1 Hard
  // primary=searching, tracks=[] universal
  // ---------------------------------------------------------------------------
  {
    title: 'LeetCode 704 — Binary Search',
    url: 'https://leetcode.com/problems/binary-search/',
    description:
      'Binary search clássica em array ordenado. Mid = L + (R-L)/2 pra evitar overflow.',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['searching'],
    tracks: [],
    source: 'LeetCode — Binary Search',
    tags: ['practice', 'leetcode', 'lc-704', 'binary-search'],
    topicOrder: { 'searching': 5 },
  },
  {
    title: 'LeetCode 153 — Find Minimum In Rotated Sorted Array',
    url: 'https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/',
    description:
      'Min em array rotacionado e ordenado. Binary search comparando mid com right.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['searching'],
    tracks: [],
    source: 'LeetCode — Binary Search',
    tags: ['practice', 'leetcode', 'lc-153', 'binary-search'],
    topicOrder: { 'searching': 8 },
  },
  {
    title: 'LeetCode 875 — Koko Eating Bananas',
    url: 'https://leetcode.com/problems/koko-eating-bananas/',
    description:
      'Menor velocidade pra terminar em h horas. Binary search no espaço de respostas.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['searching'],
    tracks: [],
    source: 'LeetCode — Binary Search',
    tags: ['practice', 'leetcode', 'lc-875', 'binary-search'],
    topicOrder: { 'searching': 12 },
  },
  {
    title: 'LeetCode 33 — Search In Rotated Sorted Array',
    url: 'https://leetcode.com/problems/search-in-rotated-sorted-array/',
    description:
      'Busca target em array rotacionado. Binary search descobrindo qual metade está ordenada.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['searching'],
    tracks: [],
    source: 'LeetCode — Binary Search',
    tags: ['practice', 'leetcode', 'lc-33', 'binary-search'],
    topicOrder: { 'searching': 9 },
  },
  {
    title: 'LeetCode 74 — Search a 2D Matrix',
    url: 'https://leetcode.com/problems/search-a-2d-matrix/',
    description:
      'Busca em matriz com linhas/colunas ordenadas. Trata como array linear ou two-pointer da quina.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['searching'],
    tracks: [],
    source: 'LeetCode — Binary Search',
    tags: ['practice', 'leetcode', 'lc-74', 'binary-search'],
    topicOrder: { 'searching': 10 },
  },
  {
    title: 'LeetCode 981 — Time Based Key Value Store',
    url: 'https://leetcode.com/problems/time-based-key-value-store/',
    description:
      'Get retorna valor com timestamp <= t. Hash map de key → lista (timestamp, value); binary search na lista.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['searching'],
    tracks: [],
    source: 'LeetCode — Binary Search',
    tags: ['practice', 'leetcode', 'lc-981', 'binary-search'],
    topicOrder: { 'searching': 11 },
  },
  {
    title: 'LeetCode 4 — Median of Two Sorted Arrays',
    url: 'https://leetcode.com/problems/median-of-two-sorted-arrays/',
    description:
      'Mediana de dois arrays ordenados em O(log min(m,n)). Binary search no array menor partindo a soma das metades.',
    format: 'PROBLEM',
    difficulty: 'HARD',
    estimatedMinutes: 90,
    topicSlugs: ['searching'],
    tracks: [],
    source: 'LeetCode — Binary Search',
    tags: ['practice', 'leetcode', 'lc-4', 'binary-search'],
    topicOrder: { 'searching': 13 },
  },

  // ---------------------------------------------------------------------------
  // PROBLEMs — Linked List (NeetCode 150) — 2026-04-28
  // 11 itens · 3 Easy + 6 Medium + 2 Hard
  // primary=lists, tracks=[] universal
  // ---------------------------------------------------------------------------
  {
    title: 'LeetCode 141 — Linked List Cycle',
    url: 'https://leetcode.com/problems/linked-list-cycle/',
    description:
      'Detectar ciclo. Floyd: fast/slow pointers, encontram se houver ciclo.',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['lists'],
    tracks: [],
    source: 'LeetCode — Linked List',
    tags: ['practice', 'leetcode', 'lc-141', 'linked-list'],
    topicOrder: { 'lists': 11 },
  },
  {
    title: 'LeetCode 21 — Merge Two Sorted Lists',
    url: 'https://leetcode.com/problems/merge-two-sorted-lists/',
    description:
      'Merge de duas listas ordenadas. Dummy head + dois ponteiros, ata o menor.',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['lists'],
    tracks: [],
    source: 'LeetCode — Linked List',
    tags: ['practice', 'leetcode', 'lc-21', 'linked-list'],
    topicOrder: { 'lists': 12 },
  },
  {
    title: 'LeetCode 206 — Reverse Linked List',
    url: 'https://leetcode.com/problems/reverse-linked-list/',
    description:
      'Inverter lista ligada. Iterativo: prev/curr/next; recursivo: chama no resto e reaponta.',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['lists'],
    tracks: [],
    source: 'LeetCode — Linked List',
    tags: ['practice', 'leetcode', 'lc-206', 'linked-list'],
    topicOrder: { 'lists': 9 },
  },
  {
    title: 'LeetCode 2 — Add Two Numbers',
    url: 'https://leetcode.com/problems/add-two-numbers/',
    description:
      'Soma dois números em listas ligadas (LSB primeiro). Iterar com carry, criar novos nodes.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['lists'],
    tracks: [],
    source: 'LeetCode — Linked List',
    tags: ['practice', 'leetcode', 'lc-2', 'linked-list'],
    topicOrder: { 'lists': 14 },
  },
  {
    title: 'LeetCode 138 — Copy List With Random Pointer',
    url: 'https://leetcode.com/problems/copy-list-with-random-pointer/',
    description:
      'Deep copy com ponteiro random. Dois passes (hashmap) ou interleaved nodes O(1) extra.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['lists'],
    tracks: [],
    source: 'LeetCode — Linked List',
    tags: ['practice', 'leetcode', 'lc-138', 'linked-list'],
    topicOrder: { 'lists': 17 },
  },
  {
    title: 'LeetCode 287 — Find The Duplicate Number',
    url: 'https://leetcode.com/problems/find-the-duplicate-number/',
    description:
      'Achar duplicado em [1..n] num array de tamanho n+1. Floyd cycle detection no functional graph.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['lists'],
    tracks: [],
    source: 'LeetCode — Linked List',
    tags: ['practice', 'leetcode', 'lc-287', 'linked-list'],
    topicOrder: { 'lists': 16 },
  },
  {
    title: 'LeetCode 146 — LRU Cache',
    url: 'https://leetcode.com/problems/lru-cache/',
    description:
      'LRU cache O(1). Doubly linked list + hashmap apontando pros nodes.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['lists'],
    tracks: [],
    source: 'LeetCode — Linked List',
    tags: ['practice', 'leetcode', 'lc-146', 'linked-list'],
    topicOrder: { 'lists': 19 },
  },
  {
    title: 'LeetCode 19 — Remove Nth Node From End of List',
    url: 'https://leetcode.com/problems/remove-nth-node-from-end-of-list/',
    description:
      'Remove n-ésimo do fim em uma passada. Two pointers com gap n, anda juntos até o fim.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['lists'],
    tracks: [],
    source: 'LeetCode — Linked List',
    tags: ['practice', 'leetcode', 'lc-19', 'linked-list'],
    topicOrder: { 'lists': 13 },
  },
  {
    title: 'LeetCode 143 — Reorder List',
    url: 'https://leetcode.com/problems/reorder-list/',
    description:
      'Reorder L0 → Ln → L1 → Ln-1... Reverse segunda metade + merge alternado.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['lists'],
    tracks: [],
    source: 'LeetCode — Linked List',
    tags: ['practice', 'leetcode', 'lc-143', 'linked-list'],
    topicOrder: { 'lists': 15 },
  },
  {
    title: 'LeetCode 23 — Merge K Sorted Lists',
    url: 'https://leetcode.com/problems/merge-k-sorted-lists/',
    description:
      'Merge de K listas. Min-heap de heads, ou divide-and-conquer parando aos pares.',
    format: 'PROBLEM',
    difficulty: 'HARD',
    estimatedMinutes: 90,
    topicSlugs: ['lists'],
    tracks: [],
    source: 'LeetCode — Linked List',
    tags: ['practice', 'leetcode', 'lc-23', 'linked-list'],
    topicOrder: { 'lists': 20 },
  },
  {
    title: 'LeetCode 25 — Reverse Nodes In K Group',
    url: 'https://leetcode.com/problems/reverse-nodes-in-k-group/',
    description:
      'Inverter em grupos de K. Reverse local + atar com prev grupo, ignora resto < k.',
    format: 'PROBLEM',
    difficulty: 'HARD',
    estimatedMinutes: 90,
    topicSlugs: ['lists'],
    tracks: [],
    source: 'LeetCode — Linked List',
    tags: ['practice', 'leetcode', 'lc-25', 'linked-list'],
    topicOrder: { 'lists': 21 },
  },

  // ---------------------------------------------------------------------------
  // PROBLEMs — Trees (NeetCode 150) — 2026-04-28
  // 15 itens · 6 Easy + 7 Medium + 2 Hard
  // primary=tree, tracks=[] universal
  // ---------------------------------------------------------------------------
  {
    title: 'LeetCode 110 — Balanced Binary Tree',
    url: 'https://leetcode.com/problems/balanced-binary-tree/',
    description:
      'Árvore balanceada (alturas diff <= 1 em todo nó). DFS retorna height + flag de imbalance.',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['tree'],
    tracks: [],
    source: 'LeetCode — Trees',
    tags: ['practice', 'leetcode', 'lc-110', 'trees'],
    topicOrder: { 'tree': 11 },
  },
  {
    title: 'LeetCode 543 — Diameter of Binary Tree',
    url: 'https://leetcode.com/problems/diameter-of-binary-tree/',
    description:
      'Maior distância entre dois nós. DFS retornando altura; diâmetro = max(left+right) por nó.',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['tree'],
    tracks: [],
    source: 'LeetCode — Trees',
    tags: ['practice', 'leetcode', 'lc-543', 'trees'],
    topicOrder: { 'tree': 12 },
  },
  {
    title: 'LeetCode 226 — Invert Binary Tree',
    url: 'https://leetcode.com/problems/invert-binary-tree/',
    description:
      'Inverter árvore binária (espelho). Swap left/right recursivo, ou BFS com swap por nó.',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['tree'],
    tracks: [],
    source: 'LeetCode — Trees',
    tags: ['practice', 'leetcode', 'lc-226', 'trees'],
    topicOrder: { 'tree': 9 },
  },
  {
    title: 'LeetCode 104 — Maximum Depth of Binary Tree',
    url: 'https://leetcode.com/problems/maximum-depth-of-binary-tree/',
    description:
      'Profundidade máxima. DFS recursivo: 1 + max(left, right), ou BFS contando níveis.',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['tree'],
    tracks: [],
    source: 'LeetCode — Trees',
    tags: ['practice', 'leetcode', 'lc-104', 'trees'],
    topicOrder: { 'tree': 10 },
  },
  {
    title: 'LeetCode 100 — Same Tree',
    url: 'https://leetcode.com/problems/same-tree/',
    description:
      'Duas árvores são idênticas. DFS comparando valor + recursão em left/right.',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['tree'],
    tracks: [],
    source: 'LeetCode — Trees',
    tags: ['practice', 'leetcode', 'lc-100', 'trees'],
    topicOrder: { 'tree': 8 },
  },
  {
    title: 'LeetCode 572 — Subtree of Another Tree',
    url: 'https://leetcode.com/problems/subtree-of-another-tree/',
    description:
      'subRoot existe como subárvore de root. DFS — em cada nó do root testa same-tree contra subRoot.',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['tree'],
    tracks: [],
    source: 'LeetCode — Trees',
    tags: ['practice', 'leetcode', 'lc-572', 'trees'],
    topicOrder: { 'tree': 13 },
  },
  {
    title: 'LeetCode 102 — Binary Tree Level Order Traversal',
    url: 'https://leetcode.com/problems/binary-tree-level-order-traversal/',
    description:
      'Traversal por níveis. BFS com queue, processa size do nível por iteração.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['tree'],
    tracks: [],
    source: 'LeetCode — Trees',
    tags: ['practice', 'leetcode', 'lc-102', 'trees'],
    topicOrder: { 'tree': 14 },
  },
  {
    title: 'LeetCode 199 — Binary Tree Right Side View',
    url: 'https://leetcode.com/problems/binary-tree-right-side-view/',
    description:
      'Última coluna visível pela direita. BFS pegando o último de cada nível.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['tree'],
    tracks: [],
    source: 'LeetCode — Trees',
    tags: ['practice', 'leetcode', 'lc-199', 'trees'],
    topicOrder: { 'tree': 15 },
  },
  {
    title: 'LeetCode 105 — Construct Binary Tree From Preorder And Inorder Traversal',
    url: 'https://leetcode.com/problems/construct-binary-tree-from-preorder-and-inorder-traversal/',
    description:
      'Reconstruir árvore de preorder + inorder. Root = preorder[0]; split inorder na posição do root.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['tree'],
    tracks: [],
    source: 'LeetCode — Trees',
    tags: ['practice', 'leetcode', 'lc-105', 'trees'],
    topicOrder: { 'tree': 20 },
  },
  {
    title: 'LeetCode 1448 — Count Good Nodes In Binary Tree',
    url: 'https://leetcode.com/problems/count-good-nodes-in-binary-tree/',
    description:
      'Nós cujo path do root tem max <= o nó. DFS passando max acumulado.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['tree'],
    tracks: [],
    source: 'LeetCode — Trees',
    tags: ['practice', 'leetcode', 'lc-1448', 'trees'],
    topicOrder: { 'tree': 16 },
  },
  {
    title: 'LeetCode 230 — Kth Smallest Element In a Bst',
    url: 'https://leetcode.com/problems/kth-smallest-element-in-a-bst/',
    description:
      'K-ésimo menor em BST. Inorder traversal — incrementa contador, retorna no K-ésimo.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['tree'],
    tracks: [],
    source: 'LeetCode — Trees',
    tags: ['practice', 'leetcode', 'lc-230', 'trees'],
    topicOrder: { 'tree': 18 },
  },
  {
    title: 'LeetCode 235 — Lowest Common Ancestor of a Binary Search Tree',
    url: 'https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-search-tree/',
    description:
      'LeetCode 235 — Lowest Common Ancestor of a Binary Search Tree. Reveja o pattern e tente antes de ver a solução.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['tree'],
    tracks: [],
    source: 'LeetCode — Trees',
    tags: ['practice', 'leetcode', 'lc-235', 'trees'],
    topicOrder: { 'tree': 19 },
  },
  {
    title: 'LeetCode 98 — Validate Binary Search Tree',
    url: 'https://leetcode.com/problems/validate-binary-search-tree/',
    description:
      'Validar BST. DFS passando bounds (min, max) por nó — não basta comparar com pai.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['tree'],
    tracks: [],
    source: 'LeetCode — Trees',
    tags: ['practice', 'leetcode', 'lc-98', 'trees'],
    topicOrder: { 'tree': 17 },
  },
  {
    title: 'LeetCode 124 — Binary Tree Maximum Path Sum',
    url: 'https://leetcode.com/problems/binary-tree-maximum-path-sum/',
    description:
      'Soma máxima de path entre quaisquer dois nós. DFS retornando maior gain (≥0); atualiza global incluindo split.',
    format: 'PROBLEM',
    difficulty: 'HARD',
    estimatedMinutes: 90,
    topicSlugs: ['tree'],
    tracks: [],
    source: 'LeetCode — Trees',
    tags: ['practice', 'leetcode', 'lc-124', 'trees'],
    topicOrder: { 'tree': 22 },
  },
  {
    title: 'LeetCode 297 — Serialize And Deserialize Binary Tree',
    url: 'https://leetcode.com/problems/serialize-and-deserialize-binary-tree/',
    description:
      'Serializar e desserializar árvore binária. Preorder com null sentinel; deserialize consome em ordem.',
    format: 'PROBLEM',
    difficulty: 'HARD',
    estimatedMinutes: 90,
    topicSlugs: ['tree'],
    tracks: [],
    source: 'LeetCode — Trees',
    tags: ['practice', 'leetcode', 'lc-297', 'trees'],
    topicOrder: { 'tree': 23 },
  },

  // ---------------------------------------------------------------------------
  // PROBLEMs — Tries (NeetCode 150) — 2026-04-28
  // 3 itens · 2 Medium + 1 Hard
  // primary=trie, tracks=[BIG_TECH, COMPETITIVE_PROGRAMMING]
  // ---------------------------------------------------------------------------
  {
    title: 'LeetCode 211 — Design Add And Search Words Data Structure',
    url: 'https://leetcode.com/problems/design-add-and-search-words-data-structure/',
    description:
      'Trie com search aceitando "." (wildcard). DFS recursivo no trie quando bate ponto.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['trie'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Tries',
    tags: ['practice', 'leetcode', 'lc-211', 'tries'],
    topicOrder: { 'trie': 5 },
  },
  {
    title: 'LeetCode 208 — Implement Trie Prefix Tree',
    url: 'https://leetcode.com/problems/implement-trie-prefix-tree/',
    description:
      'Trie do zero — insert, search, startsWith. Cada nó tem map de chars + flag isEnd.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['trie'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Tries',
    tags: ['practice', 'leetcode', 'lc-208', 'tries'],
    topicOrder: { 'trie': 4 },
  },
  {
    title: 'LeetCode 212 — Word Search II',
    url: 'https://leetcode.com/problems/word-search-ii/',
    description:
      'Achar todas palavras do dicionário no grid. Trie das palavras + DFS no grid podando por trie.',
    format: 'PROBLEM',
    difficulty: 'HARD',
    estimatedMinutes: 90,
    topicSlugs: ['trie'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Tries',
    tags: ['practice', 'leetcode', 'lc-212', 'tries'],
    topicOrder: { 'trie': 6 },
  },

  // ---------------------------------------------------------------------------
  // PROBLEMs — Heap / Priority Queue (NeetCode 150) — 2026-04-28
  // 7 itens · 2 Easy + 4 Medium + 1 Hard
  // primary=heap, tracks=[BIG_TECH, COMPETITIVE_PROGRAMMING]
  // ---------------------------------------------------------------------------
  {
    title: 'LeetCode 703 — Kth Largest Element In a Stream',
    url: 'https://leetcode.com/problems/kth-largest-element-in-a-stream/',
    description:
      'K-ésimo maior em stream contínuo. Min-heap de tamanho K — peek é a resposta.',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['heap'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Heap / Priority Queue',
    tags: ['practice', 'leetcode', 'lc-703', 'heap'],
    topicOrder: { 'heap': 4 },
  },
  {
    title: 'LeetCode 1046 — Last Stone Weight',
    url: 'https://leetcode.com/problems/last-stone-weight/',
    description:
      'Smash das pedras maiores até sobrar uma. Max-heap, pop dois e push diferença.',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['heap'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Heap / Priority Queue',
    tags: ['practice', 'leetcode', 'lc-1046', 'heap'],
    topicOrder: { 'heap': 5 },
  },
  {
    title: 'LeetCode 355 — Design Twitter',
    url: 'https://leetcode.com/problems/design-twitter/',
    description:
      'Feed do Twitter (followees, top 10 recent). Heap dos últimos tweets de cada followee.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['heap'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Heap / Priority Queue',
    tags: ['practice', 'leetcode', 'lc-355', 'heap'],
    topicOrder: { 'heap': 12 },
  },
  {
    title: 'LeetCode 973 — K Closest Points to Origin',
    url: 'https://leetcode.com/problems/k-closest-points-to-origin/',
    description:
      'K pontos mais próximos da origem. Max-heap de tamanho K com -distance, ou quickselect.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['heap'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Heap / Priority Queue',
    tags: ['practice', 'leetcode', 'lc-973', 'heap'],
    topicOrder: { 'heap': 9 },
  },
  {
    title: 'LeetCode 215 — Kth Largest Element In An Array',
    url: 'https://leetcode.com/problems/kth-largest-element-in-an-array/',
    description:
      'K-ésimo maior do array. Quickselect O(n) average, ou min-heap O(n log k).',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['heap'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Heap / Priority Queue',
    tags: ['practice', 'leetcode', 'lc-215', 'heap'],
    topicOrder: { 'heap': 7 },
  },
  {
    title: 'LeetCode 621 — Task Scheduler',
    url: 'https://leetcode.com/problems/task-scheduler/',
    description:
      'Schedule de tarefas com cooldown N entre iguais. Max-heap por contagem + queue de cooldown.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['heap'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Heap / Priority Queue',
    tags: ['practice', 'leetcode', 'lc-621', 'heap'],
    topicOrder: { 'heap': 11 },
  },
  {
    title: 'LeetCode 295 — Find Median From Data Stream',
    url: 'https://leetcode.com/problems/find-median-from-data-stream/',
    description:
      'Mediana em stream. Two heaps — max-heap (bottom half) e min-heap (top half), balanceadas.',
    format: 'PROBLEM',
    difficulty: 'HARD',
    estimatedMinutes: 90,
    topicSlugs: ['heap'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Heap / Priority Queue',
    tags: ['practice', 'leetcode', 'lc-295', 'heap'],
    topicOrder: { 'heap': 13 },
  },

  // ---------------------------------------------------------------------------
  // PROBLEMs — Backtracking (NeetCode 150) — 2026-04-28
  // 9 itens · 8 Medium + 1 Hard
  // primary=recursion, tracks=[BIG_TECH, COMPETITIVE_PROGRAMMING]
  // ---------------------------------------------------------------------------
  {
    title: 'LeetCode 39 — Combination Sum',
    url: 'https://leetcode.com/problems/combination-sum/',
    description:
      'Combinações que somam target (reuso ilimitado). Backtracking explorando index + remaining.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['recursion'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Backtracking',
    tags: ['practice', 'leetcode', 'lc-39', 'backtracking'],
    topicOrder: { 'recursion': 16 },
  },
  {
    title: 'LeetCode 40 — Combination Sum II',
    url: 'https://leetcode.com/problems/combination-sum-ii/',
    description:
      'Combinações que somam target sem reuso e sem duplicar. Sort + skip duplicates por nível.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['recursion'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Backtracking',
    tags: ['practice', 'leetcode', 'lc-40', 'backtracking'],
    topicOrder: { 'recursion': 17 },
  },
  {
    title: 'LeetCode 17 — Letter Combinations of a Phone Number',
    url: 'https://leetcode.com/problems/letter-combinations-of-a-phone-number/',
    description:
      'Combinações de letras das teclas. Backtracking iterando dígito por dígito.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['recursion'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Backtracking',
    tags: ['practice', 'leetcode', 'lc-17', 'backtracking'],
    topicOrder: { 'recursion': 15 },
  },
  {
    title: 'LeetCode 131 — Palindrome Partitioning',
    url: 'https://leetcode.com/problems/palindrome-partitioning/',
    description:
      'Particionar string em palíndromos. Backtracking — try cada prefix palindrome.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['recursion'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Backtracking',
    tags: ['practice', 'leetcode', 'lc-131', 'backtracking'],
    topicOrder: { 'recursion': 18 },
  },
  {
    title: 'LeetCode 46 — Permutations',
    url: 'https://leetcode.com/problems/permutations/',
    description:
      'Todas permutações. Backtracking marcando used[]; ou swap-in-place.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['recursion'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Backtracking',
    tags: ['practice', 'leetcode', 'lc-46', 'backtracking'],
    topicOrder: { 'recursion': 14 },
  },
  {
    title: 'LeetCode 78 — Subsets',
    url: 'https://leetcode.com/problems/subsets/',
    description:
      'Todos subsets distintos. Backtracking — em cada índice, escolhe incluir ou não.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['recursion'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Backtracking',
    tags: ['practice', 'leetcode', 'lc-78', 'backtracking'],
    topicOrder: { 'recursion': 12 },
  },
  {
    title: 'LeetCode 90 — Subsets II',
    url: 'https://leetcode.com/problems/subsets-ii/',
    description:
      'Subsets sem duplicar. Sort + skip duplicates no mesmo nível.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['recursion'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Backtracking',
    tags: ['practice', 'leetcode', 'lc-90', 'backtracking'],
    topicOrder: { 'recursion': 13 },
  },
  {
    title: 'LeetCode 79 — Word Search',
    url: 'https://leetcode.com/problems/word-search/',
    description:
      'Palavra existe no grid (caminho 4-conectado). Backtracking marcando visited.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['recursion'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Backtracking',
    tags: ['practice', 'leetcode', 'lc-79', 'backtracking'],
    topicOrder: { 'recursion': 19 },
  },
  {
    title: 'LeetCode 51 — N Queens',
    url: 'https://leetcode.com/problems/n-queens/',
    description:
      'N rainhas no tabuleiro. Backtracking por linha + sets pra colunas/diagonais.',
    format: 'PROBLEM',
    difficulty: 'HARD',
    estimatedMinutes: 90,
    topicSlugs: ['recursion'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Backtracking',
    tags: ['practice', 'leetcode', 'lc-51', 'backtracking'],
    topicOrder: { 'recursion': 21 },
  },

  // ---------------------------------------------------------------------------
  // PROBLEMs — Graphs (NeetCode 150) — 2026-04-28
  // 13 itens · 12 Medium + 1 Hard
  // primary=graph, tracks=[BIG_TECH, COMPETITIVE_PROGRAMMING]
  // ---------------------------------------------------------------------------
  {
    title: 'LeetCode 133 — Clone Graph',
    url: 'https://leetcode.com/problems/clone-graph/',
    description:
      'Deep copy de grafo. DFS/BFS + hashmap original → copy.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Graphs',
    tags: ['practice', 'leetcode', 'lc-133', 'graphs'],
    topicOrder: { 'graph': 11 },
  },
  {
    title: 'LeetCode 207 — Course Schedule',
    url: 'https://leetcode.com/problems/course-schedule/',
    description:
      'Detectar ciclo no DAG de pré-requisitos. DFS com 3 estados, ou Kahn (topological sort).',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Graphs',
    tags: ['practice', 'leetcode', 'lc-207', 'graphs'],
    topicOrder: { 'graph': 19 },
  },
  {
    title: 'LeetCode 210 — Course Schedule II',
    url: 'https://leetcode.com/problems/course-schedule-ii/',
    description:
      'Ordem topológica das aulas. Kahn — BFS dos in-degree 0; ciclo se sobrar nó.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Graphs',
    tags: ['practice', 'leetcode', 'lc-210', 'graphs'],
    topicOrder: { 'graph': 20 },
  },
  {
    title: 'LeetCode 261 — Graph Valid Tree',
    url: 'https://leetcode.com/problems/graph-valid-tree/',
    description:
      'É árvore (n-1 arestas + sem ciclo + conectado). Union-find detectando ciclo + n-1 arestas.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Graphs',
    tags: ['practice', 'leetcode', 'lc-261', 'graphs'],
    topicOrder: { 'graph': 22 },
  },
  {
    title: 'LeetCode 695 — Max Area of Island',
    url: 'https://leetcode.com/problems/max-area-of-island/',
    description:
      'Maior ilha por área. DFS retornando contagem, mantém max global.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Graphs',
    tags: ['practice', 'leetcode', 'lc-695', 'graphs'],
    topicOrder: { 'graph': 10 },
  },
  {
    title: 'LeetCode 323 — Number of Connected Components In An Undirected Graph',
    url: 'https://leetcode.com/problems/number-of-connected-components-in-an-undirected-graph/',
    description:
      'Componentes conectados. Union-find ou DFS contando trees.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Graphs',
    tags: ['practice', 'leetcode', 'lc-323', 'graphs'],
    topicOrder: { 'graph': 16 },
  },
  {
    title: 'LeetCode 200 — Number of Islands',
    url: 'https://leetcode.com/problems/number-of-islands/',
    description:
      'Contar ilhas no grid. DFS/BFS marcando visited a cada descoberta.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Graphs',
    tags: ['practice', 'leetcode', 'lc-200', 'graphs'],
    topicOrder: { 'graph': 9 },
  },
  {
    title: 'LeetCode 417 — Pacific Atlantic Water Flow',
    url: 'https://leetcode.com/problems/pacific-atlantic-water-flow/',
    description:
      'Cells que drenam pra ambos oceanos. BFS/DFS reverso a partir das bordas dos dois oceanos.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Graphs',
    tags: ['practice', 'leetcode', 'lc-417', 'graphs'],
    topicOrder: { 'graph': 15 },
  },
  {
    title: 'LeetCode 684 — Redundant Connection',
    url: 'https://leetcode.com/problems/redundant-connection/',
    description:
      'Aresta extra que cria ciclo. Union-find — rejeita a que une dois já no mesmo set.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Graphs',
    tags: ['practice', 'leetcode', 'lc-684', 'graphs'],
    topicOrder: { 'graph': 23 },
  },
  {
    title: 'LeetCode 994 — Rotting Oranges',
    url: 'https://leetcode.com/problems/rotting-oranges/',
    description:
      'Tempo pra apodrecer todas. BFS multi-source dos podres iniciais.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Graphs',
    tags: ['practice', 'leetcode', 'lc-994', 'graphs'],
    topicOrder: { 'graph': 14 },
  },
  {
    title: 'LeetCode 130 — Surrounded Regions',
    url: 'https://leetcode.com/problems/surrounded-regions/',
    description:
      'Capturar Os cercados. Mark Os conectados às bordas, depois flip o resto.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Graphs',
    tags: ['practice', 'leetcode', 'lc-130', 'graphs'],
    topicOrder: { 'graph': 12 },
  },
  {
    title: 'LeetCode 286 — Walls And Gates',
    url: 'https://leetcode.com/problems/walls-and-gates/',
    description:
      'Distância da gate mais próxima. BFS multi-source das gates.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Graphs',
    tags: ['practice', 'leetcode', 'lc-286', 'graphs'],
    topicOrder: { 'graph': 13 },
  },
  {
    title: 'LeetCode 127 — Word Ladder',
    url: 'https://leetcode.com/problems/word-ladder/',
    description:
      'Menor transformação word→word com 1-letter changes. BFS no grafo implícito; pré-compute padrões com wildcard.',
    format: 'PROBLEM',
    difficulty: 'HARD',
    estimatedMinutes: 90,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Graphs',
    tags: ['practice', 'leetcode', 'lc-127', 'graphs'],
    topicOrder: { 'graph': 31 },
  },

  // ---------------------------------------------------------------------------
  // PROBLEMs — Advanced Graphs (NeetCode 150) — 2026-04-28
  // 6 itens · 3 Medium + 3 Hard
  // primary=graph, tracks=[BIG_TECH, COMPETITIVE_PROGRAMMING]
  // ---------------------------------------------------------------------------
  {
    title: 'LeetCode 787 — Cheapest Flights Within K Stops',
    url: 'https://leetcode.com/problems/cheapest-flights-within-k-stops/',
    description:
      'Voos mais baratos com no máximo K paradas. Bellman-Ford limitado a K iterações.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Advanced Graphs',
    tags: ['practice', 'leetcode', 'lc-787', 'advanced-graphs'],
    topicOrder: { 'graph': 28 },
  },
  {
    title: 'LeetCode 1584 — Min Cost to Connect All Points',
    url: 'https://leetcode.com/problems/min-cost-to-connect-all-points/',
    description:
      'MST do grafo completo. Prim com heap (V² é OK pra V≤1000), ou Kruskal + union-find.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Advanced Graphs',
    tags: ['practice', 'leetcode', 'lc-1584', 'advanced-graphs'],
    topicOrder: { 'graph': 30 },
  },
  {
    title: 'LeetCode 743 — Network Delay Time',
    url: 'https://leetcode.com/problems/network-delay-time/',
    description:
      'Tempo até último nó receber. Dijkstra padrão — heap dos shortest distances.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Advanced Graphs',
    tags: ['practice', 'leetcode', 'lc-743', 'advanced-graphs'],
    topicOrder: { 'graph': 27 },
  },
  {
    title: 'LeetCode 269 — Alien Dictionary',
    url: 'https://leetcode.com/problems/alien-dictionary/',
    description:
      'Ordem de letras de palavras ordenadas. Build DAG das diferenças primeiras + topological sort.',
    format: 'PROBLEM',
    difficulty: 'HARD',
    estimatedMinutes: 90,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Advanced Graphs',
    tags: ['practice', 'leetcode', 'lc-269', 'advanced-graphs'],
    topicOrder: { 'graph': 32 },
  },
  {
    title: 'LeetCode 332 — Reconstruct Itinerary',
    url: 'https://leetcode.com/problems/reconstruct-itinerary/',
    description:
      'Itinerário de voos consumindo todos. Hierholzer (Eulerian path) com priority queue por destino.',
    format: 'PROBLEM',
    difficulty: 'HARD',
    estimatedMinutes: 90,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Advanced Graphs',
    tags: ['practice', 'leetcode', 'lc-332', 'advanced-graphs'],
    topicOrder: { 'graph': 33 },
  },
  {
    title: 'LeetCode 778 — Swim In Rising Water',
    url: 'https://leetcode.com/problems/swim-in-rising-water/',
    description:
      'Caminho onde max elevation é mínimo. Dijkstra com cost = max(elev, neighbor); ou union-find por elevation.',
    format: 'PROBLEM',
    difficulty: 'HARD',
    estimatedMinutes: 90,
    topicSlugs: ['graph'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Advanced Graphs',
    tags: ['practice', 'leetcode', 'lc-778', 'advanced-graphs'],
    topicOrder: { 'graph': 29 },
  },

  // ---------------------------------------------------------------------------
  // PROBLEMs — 1-D Dynamic Programming (NeetCode 150) — 2026-04-28
  // 12 itens · 2 Easy + 10 Medium
  // primary=dp, tracks=[BIG_TECH, COMPETITIVE_PROGRAMMING]
  // ---------------------------------------------------------------------------
  {
    title: 'LeetCode 70 — Climbing Stairs',
    url: 'https://leetcode.com/problems/climbing-stairs/',
    description:
      'Quantas formas de subir N escadas (1 ou 2 por vez). Fibonacci — dp[i] = dp[i-1] + dp[i-2].',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — 1-D Dynamic Programming',
    tags: ['practice', 'leetcode', 'lc-70', 'dp-1d'],
    topicOrder: { 'dp': 5 },
  },
  {
    title: 'LeetCode 746 — Min Cost Climbing Stairs',
    url: 'https://leetcode.com/problems/min-cost-climbing-stairs/',
    description:
      'Custo mínimo pra chegar no topo (entrando do step 0 ou 1). dp[i] = cost[i] + min(dp[i-1], dp[i-2]).',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — 1-D Dynamic Programming',
    tags: ['practice', 'leetcode', 'lc-746', 'dp-1d'],
    topicOrder: { 'dp': 6 },
  },
  {
    title: 'LeetCode 322 — Coin Change',
    url: 'https://leetcode.com/problems/coin-change/',
    description:
      'Mínimo de moedas pra somar amount. dp[i] = min(dp[i - coin] + 1) pra cada coin.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — 1-D Dynamic Programming',
    tags: ['practice', 'leetcode', 'lc-322', 'dp-1d'],
    topicOrder: { 'dp': 18 },
  },
  {
    title: 'LeetCode 91 — Decode Ways',
    url: 'https://leetcode.com/problems/decode-ways/',
    description:
      'Formas de decodificar string numérica em A-Z. dp[i] = dp[i-1] (se 1-9) + dp[i-2] (se 10-26).',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — 1-D Dynamic Programming',
    tags: ['practice', 'leetcode', 'lc-91', 'dp-1d'],
    topicOrder: { 'dp': 9 },
  },
  {
    title: 'LeetCode 198 — House Robber',
    url: 'https://leetcode.com/problems/house-robber/',
    description:
      'Roubar casas sem duas adjacentes. dp[i] = max(dp[i-1], dp[i-2] + nums[i]).',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — 1-D Dynamic Programming',
    tags: ['practice', 'leetcode', 'lc-198', 'dp-1d'],
    topicOrder: { 'dp': 7 },
  },
  {
    title: 'LeetCode 213 — House Robber II',
    url: 'https://leetcode.com/problems/house-robber-ii/',
    description:
      'House Robber em círculo. Resolve duas vezes — sem casa 0, sem última casa.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — 1-D Dynamic Programming',
    tags: ['practice', 'leetcode', 'lc-213', 'dp-1d'],
    topicOrder: { 'dp': 8 },
  },
  {
    title: 'LeetCode 300 — Longest Increasing Subsequence',
    url: 'https://leetcode.com/problems/longest-increasing-subsequence/',
    description:
      'LIS. dp[i] = max(dp[j])+1 pra j<i e nums[j]<nums[i] em O(n²); ou patience sort em O(n log n).',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — 1-D Dynamic Programming',
    tags: ['practice', 'leetcode', 'lc-300', 'dp-1d'],
    topicOrder: { 'dp': 20 },
  },
  {
    title: 'LeetCode 5 — Longest Palindromic Substring',
    url: 'https://leetcode.com/problems/longest-palindromic-substring/',
    description:
      'Maior palíndromo substring. Expand around center O(n²); ou Manacher O(n).',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — 1-D Dynamic Programming',
    tags: ['practice', 'leetcode', 'lc-5', 'dp-1d'],
    topicOrder: { 'dp': 21 },
  },
  {
    title: 'LeetCode 152 — Maximum Product Subarray',
    url: 'https://leetcode.com/problems/maximum-product-subarray/',
    description:
      'Maior produto de subarray. Mantém max e min correntes (negativo flipa).',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — 1-D Dynamic Programming',
    tags: ['practice', 'leetcode', 'lc-152', 'dp-1d'],
    topicOrder: { 'dp': 11 },
  },
  {
    title: 'LeetCode 647 — Palindromic Substrings',
    url: 'https://leetcode.com/problems/palindromic-substrings/',
    description:
      'Quantos palíndromos substring existem. Expand around center contando expansões.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — 1-D Dynamic Programming',
    tags: ['practice', 'leetcode', 'lc-647', 'dp-1d'],
    topicOrder: { 'dp': 22 },
  },
  {
    title: 'LeetCode 416 — Partition Equal Subset Sum',
    url: 'https://leetcode.com/problems/partition-equal-subset-sum/',
    description:
      'Particionar em dois subsets de soma igual. Subset sum DP — dp[s] = dp[s] || dp[s-num].',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — 1-D Dynamic Programming',
    tags: ['practice', 'leetcode', 'lc-416', 'dp-1d'],
    topicOrder: { 'dp': 16 },
  },
  {
    title: 'LeetCode 139 — Word Break',
    url: 'https://leetcode.com/problems/word-break/',
    description:
      'String se decompõe em palavras do dict. dp[i] = OR(dp[j] && s[j:i] in dict).',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — 1-D Dynamic Programming',
    tags: ['practice', 'leetcode', 'lc-139', 'dp-1d'],
    topicOrder: { 'dp': 10 },
  },

  // ---------------------------------------------------------------------------
  // PROBLEMs — 2-D Dynamic Programming (NeetCode 150) — 2026-04-28
  // 11 itens · 7 Medium + 4 Hard
  // primary=dp, tracks=[BIG_TECH, COMPETITIVE_PROGRAMMING]
  // ---------------------------------------------------------------------------
  {
    title: 'LeetCode 309 — Best Time to Buy And Sell Stock With Cooldown',
    url: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock-with-cooldown/',
    description:
      'Stock com cooldown 1 dia. Three states: hold, sold, rest — transições por dia.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — 2-D Dynamic Programming',
    tags: ['practice', 'leetcode', 'lc-309', 'dp-2d'],
    topicOrder: { 'dp': 26 },
  },
  {
    title: 'LeetCode 518 — Coin Change II',
    url: 'https://leetcode.com/problems/coin-change-ii/',
    description:
      'Quantas formas de somar amount. dp[c][s] processa cada coin uma vez (ordem importa pra não duplicar).',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — 2-D Dynamic Programming',
    tags: ['practice', 'leetcode', 'lc-518', 'dp-2d'],
    topicOrder: { 'dp': 19 },
  },
  {
    title: 'LeetCode 72 — Edit Distance',
    url: 'https://leetcode.com/problems/edit-distance/',
    description:
      'Levenshtein distance. dp[i][j] = match? dp[i-1][j-1] : 1 + min(insert, delete, replace).',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — 2-D Dynamic Programming',
    tags: ['practice', 'leetcode', 'lc-72', 'dp-2d'],
    topicOrder: { 'dp': 24 },
  },
  {
    title: 'LeetCode 97 — Interleaving String',
    url: 'https://leetcode.com/problems/interleaving-string/',
    description:
      's3 é interleaving de s1 e s2. dp[i][j] = (s1[i-1]==s3[i+j-1] && dp[i-1][j]) || (s2[j-1]==s3[i+j-1] && dp[i][j-1]).',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — 2-D Dynamic Programming',
    tags: ['practice', 'leetcode', 'lc-97', 'dp-2d'],
    topicOrder: { 'dp': 25 },
  },
  {
    title: 'LeetCode 1143 — Longest Common Subsequence',
    url: 'https://leetcode.com/problems/longest-common-subsequence/',
    description:
      'LCS de duas strings. dp[i][j] = match? dp[i-1][j-1]+1 : max(dp[i-1][j], dp[i][j-1]).',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — 2-D Dynamic Programming',
    tags: ['practice', 'leetcode', 'lc-1143', 'dp-2d'],
    topicOrder: { 'dp': 14 },
  },
  {
    title: 'LeetCode 494 — Target Sum',
    url: 'https://leetcode.com/problems/target-sum/',
    description:
      'Sinais ± pra somar target. Reduz pra subset sum: subset que soma (S+target)/2.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — 2-D Dynamic Programming',
    tags: ['practice', 'leetcode', 'lc-494', 'dp-2d'],
    topicOrder: { 'dp': 17 },
  },
  {
    title: 'LeetCode 62 — Unique Paths',
    url: 'https://leetcode.com/problems/unique-paths/',
    description:
      'Caminhos do (0,0) ao (m-1,n-1) só pra direita/baixo. dp[i][j] = dp[i-1][j] + dp[i][j-1].',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — 2-D Dynamic Programming',
    tags: ['practice', 'leetcode', 'lc-62', 'dp-2d'],
    topicOrder: { 'dp': 13 },
  },
  {
    title: 'LeetCode 312 — Burst Balloons',
    url: 'https://leetcode.com/problems/burst-balloons/',
    description:
      'Max coins estourando balões. Interval DP — dp[L][R] = max sobre k em [L+1, R-1].',
    format: 'PROBLEM',
    difficulty: 'HARD',
    estimatedMinutes: 90,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — 2-D Dynamic Programming',
    tags: ['practice', 'leetcode', 'lc-312', 'dp-2d'],
    topicOrder: { 'dp': 30 },
  },
  {
    title: 'LeetCode 115 — Distinct Subsequences',
    url: 'https://leetcode.com/problems/distinct-subsequences/',
    description:
      'Quantas formas s contém t como subsequence. dp[i][j] = (s[i]==t[j]? dp[i-1][j-1] : 0) + dp[i-1][j].',
    format: 'PROBLEM',
    difficulty: 'HARD',
    estimatedMinutes: 90,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — 2-D Dynamic Programming',
    tags: ['practice', 'leetcode', 'lc-115', 'dp-2d'],
    topicOrder: { 'dp': 28 },
  },
  {
    title: 'LeetCode 329 — Longest Increasing Path In a Matrix',
    url: 'https://leetcode.com/problems/longest-increasing-path-in-a-matrix/',
    description:
      'LIP em matriz (4-conectado). DFS + memoização — cada cell vira subproblema.',
    format: 'PROBLEM',
    difficulty: 'HARD',
    estimatedMinutes: 90,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — 2-D Dynamic Programming',
    tags: ['practice', 'leetcode', 'lc-329', 'dp-2d'],
    topicOrder: { 'dp': 27 },
  },
  {
    title: 'LeetCode 10 — Regular Expression Matching',
    url: 'https://leetcode.com/problems/regular-expression-matching/',
    description:
      'Regex com `.` e `*`. dp[i][j] casos por padrão; `*` pode zero ou múltiplas matches.',
    format: 'PROBLEM',
    difficulty: 'HARD',
    estimatedMinutes: 90,
    topicSlugs: ['dp'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — 2-D Dynamic Programming',
    tags: ['practice', 'leetcode', 'lc-10', 'dp-2d'],
    topicOrder: { 'dp': 29 },
  },

  // ---------------------------------------------------------------------------
  // PROBLEMs — Greedy (NeetCode 150) — 2026-04-28
  // 8 itens · 8 Medium
  // primary=greedy, tracks=[BIG_TECH, COMPETITIVE_PROGRAMMING]
  // ---------------------------------------------------------------------------
  {
    title: 'LeetCode 134 — Gas Station',
    url: 'https://leetcode.com/problems/gas-station/',
    description:
      'Indice de partida que completa o circuito. Soma total >= 0 garante existência; reset start quando tank fica negativo.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['greedy'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Greedy',
    tags: ['practice', 'leetcode', 'lc-134', 'greedy'],
    topicOrder: { 'greedy': 14 },
  },
  {
    title: 'LeetCode 846 — Hand of Straights',
    url: 'https://leetcode.com/problems/hand-of-straights/',
    description:
      'Cartas particionáveis em runs de tamanho W. Min-heap + remove W consecutivos a partir do menor.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['greedy'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Greedy',
    tags: ['practice', 'leetcode', 'lc-846', 'greedy'],
    topicOrder: { 'greedy': 18 },
  },
  {
    title: 'LeetCode 55 — Jump Game',
    url: 'https://leetcode.com/problems/jump-game/',
    description:
      'Atinge último índice. Greedy — mantém max reachable, falha se i > maxReach.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['greedy'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Greedy',
    tags: ['practice', 'leetcode', 'lc-55', 'greedy'],
    topicOrder: { 'greedy': 10 },
  },
  {
    title: 'LeetCode 45 — Jump Game II',
    url: 'https://leetcode.com/problems/jump-game-ii/',
    description:
      'Mínimo de jumps até o fim. Greedy BFS — processa intervalos por nível.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['greedy'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Greedy',
    tags: ['practice', 'leetcode', 'lc-45', 'greedy'],
    topicOrder: { 'greedy': 12 },
  },
  {
    title: 'LeetCode 53 — Maximum Subarray',
    url: 'https://leetcode.com/problems/maximum-subarray/',
    description:
      'Subarray contíguo de maior soma. Kadane — dp[i] = max(nums[i], dp[i-1]+nums[i]).',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['greedy'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Greedy',
    tags: ['practice', 'leetcode', 'lc-53', 'greedy'],
    topicOrder: { 'greedy': 15 },
  },
  {
    title: 'LeetCode 1899 — Merge Triplets to Form Target Triplet',
    url: 'https://leetcode.com/problems/merge-triplets-to-form-target-triplet/',
    description:
      'É possível chegar no target merging triplets (max-merge). Pula triplet se algum elem > target; checa se cada componente do target aparece.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['greedy'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Greedy',
    tags: ['practice', 'leetcode', 'lc-1899', 'greedy'],
    topicOrder: { 'greedy': 19 },
  },
  {
    title: 'LeetCode 763 — Partition Labels',
    url: 'https://leetcode.com/problems/partition-labels/',
    description:
      'Particionar string em pedaços onde cada char aparece em só 1. Last index por char + greedy expand.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['greedy'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Greedy',
    tags: ['practice', 'leetcode', 'lc-763', 'greedy'],
    topicOrder: { 'greedy': 16 },
  },
  {
    title: 'LeetCode 678 — Valid Parenthesis String',
    url: 'https://leetcode.com/problems/valid-parenthesis-string/',
    description:
      'Validar parens com `*` (vira `(`, `)` ou vazio). Two passes ou range [low, high] de abertos possíveis.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['greedy'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Greedy',
    tags: ['practice', 'leetcode', 'lc-678', 'greedy'],
    topicOrder: { 'greedy': 17 },
  },

  // ---------------------------------------------------------------------------
  // PROBLEMs — Intervals (NeetCode 150) — 2026-04-28
  // 6 itens · 1 Easy + 4 Medium + 1 Hard
  // primary=array, tracks=[BIG_TECH, COMPETITIVE_PROGRAMMING]
  // ---------------------------------------------------------------------------
  {
    title: 'LeetCode 252 — Meeting Rooms',
    url: 'https://leetcode.com/problems/meeting-rooms/',
    description:
      'Tem reunião sobreposta? Sort por start + check overlap consecutivo.',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['array', 'greedy'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Intervals',
    tags: ['practice', 'leetcode', 'lc-252', 'intervals'],
    topicOrder: { 'array': 26, 'greedy': 4 },
  },
  {
    title: 'LeetCode 57 — Insert Interval',
    url: 'https://leetcode.com/problems/insert-interval/',
    description:
      'Inserir interval em lista ordenada não-sobreposta. Pre, merge, post — pega antes do new, mescla overlapping, anexa rest.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array', 'greedy'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Intervals',
    tags: ['practice', 'leetcode', 'lc-57', 'intervals'],
    topicOrder: { 'array': 28, 'greedy': 6 },
  },
  {
    title: 'LeetCode 253 — Meeting Rooms II',
    url: 'https://leetcode.com/problems/meeting-rooms-ii/',
    description:
      'Min salas necessárias. Sort starts + ends, two pointers contando overlap simultâneo. Ou min-heap de end times.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array', 'greedy'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Intervals',
    tags: ['practice', 'leetcode', 'lc-253', 'intervals'],
    topicOrder: { 'array': 30, 'greedy': 7 },
  },
  {
    title: 'LeetCode 56 — Merge Intervals',
    url: 'https://leetcode.com/problems/merge-intervals/',
    description:
      'Merge intervals sobrepostos. Sort por start, walk + estende last.end ou push novo.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array', 'greedy'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Intervals',
    tags: ['practice', 'leetcode', 'lc-56', 'intervals'],
    topicOrder: { 'array': 27, 'greedy': 5 },
  },
  {
    title: 'LeetCode 435 — Non Overlapping Intervals',
    url: 'https://leetcode.com/problems/non-overlapping-intervals/',
    description:
      'Min remoções pra ficar sem overlap. Sort por end, greedy keep o que termina antes.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array', 'greedy'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Intervals',
    tags: ['practice', 'leetcode', 'lc-435', 'intervals'],
    topicOrder: { 'array': 29, 'greedy': 8 },
  },
  {
    title: 'LeetCode 1851 — Minimum Interval to Include Each Query',
    url: 'https://leetcode.com/problems/minimum-interval-to-include-each-query/',
    description:
      'Pra cada query, menor interval que a contém. Sort intervals + queries; min-heap por size, processa por query order.',
    format: 'PROBLEM',
    difficulty: 'HARD',
    estimatedMinutes: 90,
    topicSlugs: ['array', 'greedy'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Intervals',
    tags: ['practice', 'leetcode', 'lc-1851', 'intervals'],
    topicOrder: { 'array': 50, 'greedy': 20 },
  },

  // ---------------------------------------------------------------------------
  // PROBLEMs — NeetCode 150 "Math & Geometry" pattern — 2026-04-28
  // 8 itens · 2 Easy + 6 Medium
  // primary=array. NeetCode chamou de "Math & Geometry" mas a maioria são
  // matrix/digit tricks — não math conceitual. Retagueado em 2026-04-28: o
  // topic `math` agora é reservado pra foundations matemáticas pra ML/DS
  // (linear algebra, calc, stats), e topic `data-science` pra ML como tema.
  // ---------------------------------------------------------------------------
  {
    title: 'LeetCode 202 — Happy Number',
    url: 'https://leetcode.com/problems/happy-number/',
    description:
      'Soma quadrados dos dígitos converge a 1. Floyd cycle detection ou hashset visited.',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['array'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Math & Geometry',
    tags: ['practice', 'leetcode', 'lc-202', 'math'],
    topicOrder: { 'array': 37 },
  },
  {
    title: 'LeetCode 66 — Plus One',
    url: 'https://leetcode.com/problems/plus-one/',
    description:
      'Soma 1 ao número representado em array. Iterar do fim, propagar carry.',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['array'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Math & Geometry',
    tags: ['practice', 'leetcode', 'lc-66', 'math'],
    topicOrder: { 'array': 6 },
  },
  {
    title: 'LeetCode 2013 — Detect Squares',
    url: 'https://leetcode.com/problems/detect-squares/',
    description:
      'Quantos quadrados se formam adicionando pontos. Hash count por (x,y); pra cada par diagonal, conta vértices restantes.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Math & Geometry',
    tags: ['practice', 'leetcode', 'lc-2013', 'math'],
    topicOrder: { 'array': 40 },
  },
  {
    title: 'LeetCode 43 — Multiply Strings',
    url: 'https://leetcode.com/problems/multiply-strings/',
    description:
      'Multiplicar dois números em string. Simula multiplicação dígito a dígito + carry.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Math & Geometry',
    tags: ['practice', 'leetcode', 'lc-43', 'math'],
    topicOrder: { 'array': 38 },
  },
  {
    title: 'LeetCode 50 — Pow(x, n)',
    url: 'https://leetcode.com/problems/powx-n/',
    description:
      'LeetCode 50 — Pow(x, n). Reveja o pattern e tente antes de ver a solução.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Math & Geometry',
    tags: ['practice', 'leetcode', 'lc-50', 'math'],
    topicOrder: { 'array': 39 },
  },
  {
    title: 'LeetCode 48 — Rotate Image',
    url: 'https://leetcode.com/problems/rotate-image/',
    description:
      'Rotaciona matriz 90° in-place. Transpose + reverse cada linha; ou rotate por camadas.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Math & Geometry',
    tags: ['practice', 'leetcode', 'lc-48', 'math'],
    topicOrder: { 'array': 41 },
  },
  {
    title: 'LeetCode 73 — Set Matrix Zeroes',
    url: 'https://leetcode.com/problems/set-matrix-zeroes/',
    description:
      'Zera linha+coluna de cada 0. Use primeira linha e coluna como flags + flag pra primeira linha.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Math & Geometry',
    tags: ['practice', 'leetcode', 'lc-73', 'math'],
    topicOrder: { 'array': 43 },
  },
  {
    title: 'LeetCode 54 — Spiral Matrix',
    url: 'https://leetcode.com/problems/spiral-matrix/',
    description:
      'Traversal espiral. Boundaries top/bottom/left/right encolhendo a cada lap.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['array'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Math & Geometry',
    tags: ['practice', 'leetcode', 'lc-54', 'math'],
    topicOrder: { 'array': 42 },
  },

  // ---------------------------------------------------------------------------
  // Bit Manipulation — TEACHING (2026-04-28)
  // 5 itens pareados com os LC problems abaixo. Itens 1-2 (concept geral)
  // ficam universais; 3-5 (walkthrough de LC) restritos ao track avançado.
  // ---------------------------------------------------------------------------
  {
    title: 'Binary Explained in 01100100 Seconds',
    url: 'https://www.youtube.com/watch?v=zDNaUi2cjv4',
    description:
      'Fireship — binário em 100 segundos: bit, byte, hex, complemento de 2 e por que computadores pensam em zeros e uns.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 3,
    topicSlugs: ['bit-manipulation'],
    tracks: [],
    source: 'YouTube — Fireship',
    tags: ['concept', 'binary', 'fireship'],
    topicOrder: { 'bit-manipulation': 1 },
  },
  {
    title: 'How to count to 1000 on two hands',
    url: 'https://www.youtube.com/watch?v=1SMmc9gQmHQ',
    description:
      '3Blue1Brown — contar até 1023 usando 10 dedos. Cada dedo vira um bit e a sequência reproduz binário, jeito visceral de internalizar a base 2.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 3,
    topicSlugs: ['bit-manipulation'],
    tracks: [],
    source: 'YouTube — 3Blue1Brown',
    tags: ['concept', 'binary', 'counting'],
    topicOrder: { 'bit-manipulation': 2 },
  },
  {
    title: 'Single Number — Leetcode 136 (XOR trick)',
    url: 'https://www.youtube.com/watch?v=qMPX1AOa83k',
    description:
      'NeetCode — walkthrough do LC136. XOR cancela duplicatas (a^a=0, a^0=a), o único elemento sem par sobra. Pareia com lc-136 no acervo.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 8,
    topicSlugs: ['bit-manipulation'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — NeetCode',
    tags: ['concept', 'xor', 'leetcode-walkthrough', 'lc-136'],
    topicOrder: { 'bit-manipulation': 3 },
  },
  {
    title: 'Number of 1 Bits — Leetcode 191 (Brian Kernighan)',
    url: 'https://www.youtube.com/watch?v=5Km3utixwZs',
    description:
      'NeetCode — walkthrough do LC191. Brian Kernighan: `n & (n-1)` zera o bit 1 menos significativo a cada iteração. Pareia com lc-191.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 12,
    topicSlugs: ['bit-manipulation'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — NeetCode',
    tags: ['concept', 'kernighan', 'popcount', 'leetcode-walkthrough', 'lc-191'],
    topicOrder: { 'bit-manipulation': 5 },
  },
  {
    title: 'Add Two Numbers Without The "+" Sign (Bit Shifting Basics)',
    url: 'https://www.youtube.com/watch?v=qq64FrA2UXQ',
    description:
      'Back To Back SWE — somar dois inteiros sem operadores aritméticos. XOR é soma sem carry, AND << 1 é o carry; loop até zerar. 19min de fundamentação. Pareia com lc-371.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 19,
    topicSlugs: ['bit-manipulation'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Back To Back SWE',
    tags: ['concept', 'xor', 'carry', 'arithmetic', 'leetcode-walkthrough', 'lc-371'],
    topicOrder: { 'bit-manipulation': 11 },
  },

  // ---------------------------------------------------------------------------
  // PROBLEMs — Bit Manipulation (NeetCode 150) — 2026-04-28
  // 7 itens · 5 Easy + 2 Medium
  // primary=bit-manipulation, tracks=[BIG_TECH, COMPETITIVE_PROGRAMMING]
  // ---------------------------------------------------------------------------
  {
    title: 'LeetCode 338 — Counting Bits',
    url: 'https://leetcode.com/problems/counting-bits/',
    description:
      'Pra cada i de 0..n, conta bits 1. dp[i] = dp[i>>1] + (i&1).',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['bit-manipulation'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Bit Manipulation',
    tags: ['practice', 'leetcode', 'lc-338', 'bit-manipulation'],
    topicOrder: { 'bit-manipulation': 7 },
  },
  {
    title: 'LeetCode 268 — Missing Number',
    url: 'https://leetcode.com/problems/missing-number/',
    description:
      'Missing num em [0..n]. XOR de [0..n] com array, ou Gauss soma esperada - soma real.',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['bit-manipulation'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Bit Manipulation',
    tags: ['practice', 'leetcode', 'lc-268', 'bit-manipulation'],
    topicOrder: { 'bit-manipulation': 8 },
  },
  {
    title: 'LeetCode 191 — Number of 1 Bits',
    url: 'https://leetcode.com/problems/number-of-1-bits/',
    description:
      'Conta bits 1 (popcount). Brian Kernighan — n & (n-1) zera o bit 1 menos significativo.',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['bit-manipulation'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Bit Manipulation',
    tags: ['practice', 'leetcode', 'lc-191', 'bit-manipulation'],
    topicOrder: { 'bit-manipulation': 6 },
  },
  {
    title: 'LeetCode 190 — Reverse Bits',
    url: 'https://leetcode.com/problems/reverse-bits/',
    description:
      'Inverter bits de inteiro 32 bits. Shift bit a bit ou divide-and-conquer com masks.',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['bit-manipulation'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Bit Manipulation',
    tags: ['practice', 'leetcode', 'lc-190', 'bit-manipulation'],
    topicOrder: { 'bit-manipulation': 9 },
  },
  {
    title: 'LeetCode 136 — Single Number',
    url: 'https://leetcode.com/problems/single-number/',
    description:
      'Único número não-duplicado. XOR de tudo cancela duplicatas (a^a=0, a^0=a).',
    format: 'PROBLEM',
    difficulty: 'EASY',
    estimatedMinutes: 30,
    topicSlugs: ['bit-manipulation'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Bit Manipulation',
    tags: ['practice', 'leetcode', 'lc-136', 'bit-manipulation'],
    topicOrder: { 'bit-manipulation': 4 },
  },
  {
    title: 'LeetCode 7 — Reverse Integer',
    url: 'https://leetcode.com/problems/reverse-integer/',
    description:
      'Inverter dígitos de int32. Modulo + multiplicação verificando overflow.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['bit-manipulation'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Bit Manipulation',
    tags: ['practice', 'leetcode', 'lc-7', 'bit-manipulation'],
    topicOrder: { 'bit-manipulation': 10 },
  },
  {
    title: 'LeetCode 371 — Sum of Two Integers',
    url: 'https://leetcode.com/problems/sum-of-two-integers/',
    description:
      'Soma sem usar +/-. Bitwise — sum = a^b, carry = (a&b)<<1, repeat.',
    format: 'PROBLEM',
    difficulty: 'MEDIUM',
    estimatedMinutes: 60,
    topicSlugs: ['bit-manipulation'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'LeetCode — Bit Manipulation',
    tags: ['practice', 'leetcode', 'lc-371', 'bit-manipulation'],
    topicOrder: { 'bit-manipulation': 12 },
  },

  // ===========================================================================
  // math (foundations for ML/DS) — 2026-04-28
  // 6 itens: 3Blue1Brown "Essence of Linear Algebra" — fundação universal
  // pra quem vai mexer com ML/DS. CP não usa, fica fora.
  // ===========================================================================
  {
    title: 'Vectors | Chapter 1, Essence of Linear Algebra',
    url: 'https://www.youtube.com/watch?v=fNk_zzaMoSs',
    description:
      '3Blue1Brown — o que é um vetor sob 3 perspectivas (físico, programador, matemático). Animação clarifica por que a setinha da origem importa.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 10,
    topicSlugs: ['math'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — 3Blue1Brown',
    tags: ['concept', 'linear-algebra', 'vectors', '3blue1brown'],
    topicOrder: { 'math': 1 },
  },
  {
    title: 'Linear combinations, span, basis vectors | Chapter 2',
    url: 'https://www.youtube.com/watch?v=k7RM-ot2NWY',
    description:
      '3Blue1Brown — combinação linear, span, base. Como qualquer vetor 2D vira combinação de 2 base vectors, e o que muda em 3D.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 10,
    topicSlugs: ['math'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — 3Blue1Brown',
    tags: ['concept', 'linear-algebra', 'span', 'basis', '3blue1brown'],
    topicOrder: { 'math': 2 },
  },
  {
    title: 'Linear transformations and matrices | Chapter 3',
    url: 'https://www.youtube.com/watch?v=kYB8IZa5AuE',
    description:
      '3Blue1Brown — transformações lineares como movimento do espaço. A matriz só guarda onde os vetores base aterrissam.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 11,
    topicSlugs: ['math'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — 3Blue1Brown',
    tags: ['concept', 'linear-algebra', 'transformations', 'matrices', '3blue1brown'],
    topicOrder: { 'math': 3 },
  },
  {
    title: 'Matrix multiplication as composition | Chapter 4',
    url: 'https://www.youtube.com/watch?v=XkY2DOUCWMU',
    description:
      '3Blue1Brown — multiplicação de matriz é composição de duas transformações. Por que A·B ≠ B·A: ordem importa, não comuta.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 11,
    topicSlugs: ['math'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — 3Blue1Brown',
    tags: ['concept', 'linear-algebra', 'matrix-multiplication', '3blue1brown'],
    topicOrder: { 'math': 4 },
  },
  {
    title: 'The determinant | Chapter 6',
    url: 'https://www.youtube.com/watch?v=Ip3X9LOh2dk',
    description:
      '3Blue1Brown — determinante = fator de escala da área (2D) ou volume (3D) após a transformação. Negativo = orientação invertida.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 11,
    topicSlugs: ['math'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — 3Blue1Brown',
    tags: ['concept', 'linear-algebra', 'determinant', '3blue1brown'],
    topicOrder: { 'math': 5 },
  },
  {
    title: 'Eigenvectors and eigenvalues | Chapter 14',
    url: 'https://www.youtube.com/watch?v=PFDu9oVAE-g',
    description:
      '3Blue1Brown — eigenvectors são as direções que a transformação só estica/comprime (sem rotacionar). Eigenvalue = quanto. Base de PCA, SVD, espectral.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 18,
    topicSlugs: ['math'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — 3Blue1Brown',
    tags: ['concept', 'linear-algebra', 'eigenvectors', 'eigenvalues', '3blue1brown'],
    topicOrder: { 'math': 10 },
  },

  // --- Calculus essentials (4 items) ---
  {
    title: 'The essence of calculus | Chapter 1',
    url: 'https://www.youtube.com/watch?v=WUvTyaaNkzM',
    description:
      '3Blue1Brown — abertura da série Essence of Calculus. Inventa derivada e integral do zero a partir do problema de área de um círculo.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 18,
    topicSlugs: ['math'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — 3Blue1Brown',
    tags: ['concept', 'calculus', 'derivative', 'integral', '3blue1brown'],
    topicOrder: { 'math': 6 },
  },
  {
    title: 'The paradox of the derivative | Chapter 2',
    url: 'https://www.youtube.com/watch?v=9vKqVkMQHKk',
    description:
      '3Blue1Brown — derivada como taxa instantânea de mudança. Resolve o paradoxo do "no exato instante" via limite.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 17,
    topicSlugs: ['math'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — 3Blue1Brown',
    tags: ['concept', 'calculus', 'derivative', '3blue1brown'],
    topicOrder: { 'math': 7 },
  },
  {
    title: 'Visualizing the chain rule and product rule | Chapter 4',
    url: 'https://www.youtube.com/watch?v=YG15m2VwSjA',
    description:
      '3Blue1Brown — chain rule e product rule visualmente. Chain rule é o motor do backpropagation em redes neurais.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 16,
    topicSlugs: ['math'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — 3Blue1Brown',
    tags: ['concept', 'calculus', 'chain-rule', 'product-rule', '3blue1brown'],
    topicOrder: { 'math': 8 },
  },
  {
    title: 'Integration and the fundamental theorem of calculus | Chapter 8',
    url: 'https://www.youtube.com/watch?v=rfG8ce4nNh0',
    description:
      '3Blue1Brown — integração como soma infinitesimal e o teorema fundamental que conecta derivada e integral.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 21,
    topicSlugs: ['math'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — 3Blue1Brown',
    tags: ['concept', 'calculus', 'integration', 'fundamental-theorem', '3blue1brown'],
    topicOrder: { 'math': 9 },
  },

  // --- Probability + stats (3 items) ---
  {
    title: 'The Normal Distribution, Clearly Explained',
    url: 'https://www.youtube.com/watch?v=rzFX5NWojp0',
    description:
      'StatQuest — distribuição normal: média, desvio padrão, regra 68/95/99,7%. Base estatística pra todo modelo paramétrico.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 6,
    topicSlugs: ['math'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — StatQuest with Josh Starmer',
    tags: ['concept', 'statistics', 'normal-distribution', 'statquest'],
    topicOrder: { 'math': 12 },
  },
  {
    title: 'p-values: What they are and how to interpret them',
    url: 'https://www.youtube.com/watch?v=vemZtEM63GY',
    description:
      'StatQuest — p-values sem mistério. Hipótese nula, significância, por que p<0.05 não prova nada sozinho.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 12,
    topicSlugs: ['math'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — StatQuest with Josh Starmer',
    tags: ['concept', 'statistics', 'p-value', 'hypothesis-testing', 'statquest'],
    topicOrder: { 'math': 13 },
  },
  {
    title: 'Bayes theorem, the geometry of changing beliefs',
    url: 'https://www.youtube.com/watch?v=HZGCoVF3YvM',
    description:
      '3Blue1Brown — Bayes via geometria de áreas (não fórmula). Como atualizar uma crença ao receber nova evidência.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 16,
    topicSlugs: ['math'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — 3Blue1Brown',
    tags: ['concept', 'probability', 'bayes-theorem', '3blue1brown'],
    topicOrder: { 'math': 11 },
  },

  // ===========================================================================
  // data-science (ML primary) — 2026-04-28
  // 11 itens. Fireship abre vocabulário, StatQuest para modelos clássicos
  // (regressão, árvores), 3Blue1Brown para neural nets visualizados, Karpathy
  // para o coding hands-on (micrograd from scratch — 146min, scheduler chunka
  // em ~3 sessões de 60min via [60, 60, 26]).
  // ===========================================================================
  {
    title: 'Machine Learning Explained in 100 Seconds',
    url: 'https://www.youtube.com/watch?v=PeMlggyqz0Y',
    description:
      'Fireship — ML em 100 segundos: training, features, modelo, inference. Vocabulário pra entrar no campo.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 3,
    topicSlugs: ['data-science'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Fireship',
    tags: ['concept', 'machine-learning', 'fireship'],
    topicOrder: { 'data-science': 1 },
  },
  {
    title: 'PyTorch in 100 Seconds',
    url: 'https://www.youtube.com/watch?v=ORMx45xqWkA',
    description:
      'Fireship — PyTorch em 100 segundos. Tensores, autograd, modelos. Vocabulário básico do framework mais usado em ML em 2026.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 3,
    topicSlugs: ['data-science'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Fireship',
    tags: ['concept', 'pytorch', 'tensors', 'fireship'],
    topicOrder: { 'data-science': 11 },
  },
  {
    title: 'The Essential Main Ideas of Neural Networks',
    url: 'https://www.youtube.com/watch?v=CqOfi41LfDw',
    description:
      'StatQuest — neural net por dentro: input/hidden/output layers, weights, bias, activation function. Animação acessível, sem matemática pesada.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 19,
    topicSlugs: ['data-science'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — StatQuest with Josh Starmer',
    tags: ['concept', 'neural-network', 'statquest'],
    topicOrder: { 'data-science': 5 },
  },
  {
    title: 'Linear Regression, Clearly Explained',
    url: 'https://www.youtube.com/watch?v=7ArmBVF2dCs',
    description:
      'StatQuest — regressão linear do começo: ajuste por mínimos quadrados, R², p-values. Modelo mais básico de ML.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 28,
    topicSlugs: ['data-science'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — StatQuest with Josh Starmer',
    tags: ['concept', 'linear-regression', 'least-squares', 'statquest'],
    topicOrder: { 'data-science': 2 },
  },
  {
    title: 'StatQuest: Logistic Regression',
    url: 'https://www.youtube.com/watch?v=yIYKR4sgzI8',
    description:
      'StatQuest — regressão logística: classificação binária via sigmoid, maximum likelihood, predição de probabilidades.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 9,
    topicSlugs: ['data-science'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — StatQuest with Josh Starmer',
    tags: ['concept', 'logistic-regression', 'classification', 'statquest'],
    topicOrder: { 'data-science': 3 },
  },
  {
    title: 'Decision and Classification Trees, Clearly Explained',
    url: 'https://www.youtube.com/watch?v=_L39rN6gz7Y',
    description:
      'StatQuest — árvore de decisão: como cada split escolhe a feature que mais reduz impureza (Gini ou entropia). Base pra Random Forest e XGBoost.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 19,
    topicSlugs: ['data-science'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — StatQuest with Josh Starmer',
    tags: ['concept', 'decision-tree', 'classification', 'gini', 'statquest'],
    topicOrder: { 'data-science': 4 },
  },
  {
    title: 'But what is a neural network? | Deep Learning Chapter 1',
    url: 'https://www.youtube.com/watch?v=aircAruvnKk',
    description:
      '3Blue1Brown — primeira parte da série Deep Learning. Reconhecimento de dígitos como exemplo, layers/neurons/weights/biases visualizados.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 19,
    topicSlugs: ['data-science'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — 3Blue1Brown',
    tags: ['concept', 'neural-network', 'deep-learning', '3blue1brown'],
    topicOrder: { 'data-science': 6 },
  },
  {
    title: 'Gradient descent, how neural networks learn | Deep Learning Chapter 2',
    url: 'https://www.youtube.com/watch?v=IHZwWFHWa-w',
    description:
      '3Blue1Brown — gradient descent visualmente: superfície de cost function, descer o gradiente a passos pequenos. Por que a rede "aprende".',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 21,
    topicSlugs: ['data-science'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — 3Blue1Brown',
    tags: ['concept', 'gradient-descent', 'cost-function', '3blue1brown'],
    topicOrder: { 'data-science': 7 },
  },
  {
    title: 'Backpropagation, intuitively | Deep Learning Chapter 3',
    url: 'https://www.youtube.com/watch?v=Ilg3gGewQ5U',
    description:
      '3Blue1Brown — backprop sem o cálculo. Por que cada peso muda e quanto, baseado na propagação reversa do erro pelas camadas.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 13,
    topicSlugs: ['data-science'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — 3Blue1Brown',
    tags: ['concept', 'backpropagation', '3blue1brown'],
    topicOrder: { 'data-science': 8 },
  },
  {
    title: 'Backpropagation calculus | Deep Learning Chapter 4',
    url: 'https://www.youtube.com/watch?v=tIeHLnjs5U8',
    description:
      '3Blue1Brown — backprop com cálculo. Chain rule encadeada pra computar derivadas das losses em relação a cada peso. 11min densos.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 11,
    topicSlugs: ['data-science'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — 3Blue1Brown',
    tags: ['concept', 'backpropagation', 'chain-rule', 'calculus', '3blue1brown'],
    topicOrder: { 'data-science': 9 },
  },
  {
    title: 'Transformers, the tech behind LLMs | Deep Learning Chapter 5',
    url: 'https://www.youtube.com/watch?v=wjZofJX0v4M',
    description:
      '3Blue1Brown — como funciona o transformer (arquitetura por trás de GPT/Claude). Embeddings, attention, predição token-a-token.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 28,
    topicSlugs: ['data-science'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — 3Blue1Brown',
    tags: ['concept', 'transformer', 'llm', 'attention', '3blue1brown'],
    topicOrder: { 'data-science': 10 },
  },
  {
    title: 'The spelled-out intro to neural networks and backpropagation: building micrograd',
    url: 'https://www.youtube.com/watch?v=VMj-3S1tku0',
    description:
      'Andrej Karpathy — implementa autograd e MLP do zero em Python. 146min (~2.5h), denso, padrão ouro pra entender backprop. Scheduler vai chunkar em ~3 sessões.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 146,
    topicSlugs: ['data-science'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Andrej Karpathy',
    tags: ['concept', 'neural-network', 'autograd', 'micrograd', 'from-scratch', 'python', 'karpathy'],
    topicOrder: { 'data-science': 12 },
  },

  // ===========================================================================
  // cicd — 2026-04-28
  // 4 itens. Sem HARD: canais aprovados não têm deep-dive específico de
  // CI/CD pipeline internals. Item 4 é cross-topic com 'deploy'.
  // ===========================================================================
  {
    title: 'DevOps CI/CD Explained in 100 Seconds',
    url: 'https://www.youtube.com/watch?v=scEDHsr3APg',
    description:
      'Fireship — CI/CD em 100 segundos. Pipeline integrando build → test → deploy automático.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 2,
    topicSlugs: ['cicd'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Fireship',
    tags: ['concept', 'cicd', 'devops', 'fireship'],
    topicOrder: { 'cicd': 1 },
  },
  {
    title: 'CI/CD In 5 Minutes — Crash Course System Design #2',
    url: 'https://www.youtube.com/watch?v=42UP1fxi2SY',
    description:
      'ByteByteGo — crash course de 6min sobre CI/CD: o que é, por que vale o esforço, etapas comuns (commit → build → test → staging → prod).',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 6,
    topicSlugs: ['cicd'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'cicd', 'pipeline', 'bytebytego'],
    topicOrder: { 'cicd': 2 },
  },
  {
    title: '5 Ways to DevOps-ify your App — GitHub Actions Tutorial',
    url: 'https://www.youtube.com/watch?v=eB0nUzAI7M8',
    description:
      'Fireship — 5 padrões de DevOps no GitHub Actions: lint, test, build, deploy, release. 13min com exemplos de workflow YAML.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 13,
    topicSlugs: ['cicd'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Fireship',
    tags: ['practice', 'cicd', 'github-actions', 'workflow', 'yaml', 'fireship'],
    topicOrder: { 'cicd': 3 },
  },
  {
    title: 'Top 5 Most-Used Deployment Strategies',
    url: 'https://www.youtube.com/watch?v=AWVTKBUnoIg',
    description:
      'ByteByteGo — 5 estratégias de deploy: blue-green, canary, rolling, A/B, recreate. Trade-offs visuais de risco vs custo.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 10,
    topicSlugs: ['cicd', 'deploy'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['tradeoffs', 'cicd', 'deployment', 'blue-green', 'canary', 'rolling', 'bytebytego'],
    topicOrder: { 'cicd': 4 },
  },

  // --- hashmap teaching (article do Davi) — 2026-04-28 ---
  {
    title: 'Hashing in the Real World: From TLS to Secure Password Storage',
    url: 'https://medium.com/@yuhtin/hashing-in-the-real-world-from-tls-to-secure-password-storage-765627b57cde',
    description:
      'Davi Duarte (Medium) — o que é uma função hash: input variável → output fixo, determinística e irreversível. Aplicações: integridade no TLS e password storage com bcrypt/Argon2 vs MD5/SHA-1. Pré-requisito conceitual antes de mexer com hashmap.',
    format: 'ARTICLE',
    difficulty: 'EASY',
    estimatedMinutes: 10,
    topicSlugs: ['hashmap', 'security'],
    tracks: [],
    source: 'Medium — Davi Duarte',
    tags: ['concept', 'hashing', 'sha-256', 'bcrypt', 'argon2', 'tls', 'password-storage'],
    topicOrder: { 'hashmap': 4, 'security': 5 },
  },

  // --- hashmap intro + Python dict — 2026-05-04 ---
  {
    title: 'What is a HashTable Data Structure — Introduction to Hash Tables, Part 0',
    url: 'https://www.youtube.com/watch?v=MfhjkfocRR0',
    description:
      'mycodeschool — o que é uma hash table: array indexado por string, função de hash, e por que colisões acontecem. Whiteboard, parte 0 da série.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 8,
    topicSlugs: ['hashmap'],
    tracks: [],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'hashmap', 'introduction', 'hash-function', 'collision', 'mycodeschool'],
    topicOrder: { hashmap: 2 },
  },
  {
    title: 'Python behind the scenes #10: how Python dictionaries work',
    url: 'https://tenthousandmeters.com/blog/python-behind-the-scenes-10-how-python-dictionaries-work/',
    description:
      'Ten Thousand Meters — como o dict do CPython funciona por dentro: open addressing com perturbação, resize em 2/3 de load, layout do PyDictObject.',
    format: 'ARTICLE',
    difficulty: 'HARD',
    estimatedMinutes: 30,
    topicSlugs: ['hashmap'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'Blog — Ten Thousand Meters',
    tags: ['concept', 'hashmap', 'python', 'dict', 'cpython', 'internals', 'open-addressing'],
    topicOrder: { hashmap: 12 },
  },

  // --- hashmap entry-point: hash function explained — 2026-05-05 ---
  {
    title: 'What is Hashing? Hashing Algorithm, Hash Collisions & Hash Functions',
    url: 'https://www.youtube.com/watch?v=pMM9cIAFAug',
    description:
      'Monis Yousuf — o que é uma função de hash, propriedades (determinística, output fixo, irreversível) e por que colisões acontecem.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 10,
    topicSlugs: ['hashmap'],
    tracks: [],
    source: 'YouTube — Monis Yousuf',
    tags: ['concept', 'hashmap', 'hash-function', 'collision'],
    topicOrder: { hashmap: 1 },
  },

  // ---------------------------------------------------------------------------
  // PawelCodeStuff (8 items) — 2026-05-08
  // Davi: "E muito bom". Vídeos curtos (3-10min) com animação, zero IDE.
  // Estilo Fireship-adjacente com mais profundidade técnica.
  // Catálogo completo do canal nesta data (channel ID UCLvVXWEcwO68vBIfLl9VirQ).
  // ---------------------------------------------------------------------------
  {
    title: 'Load Balancing Explained in 3 Minutes',
    url: 'https://www.youtube.com/watch?v=kGTqxMaKEY0',
    description:
      'PawelCodeStuff — load balancer em 3min: o que é, por que distribui, animação clara da ideia. Entry-point ultra-rápido antes do Galego (9min) e dos algoritmos do ByteByteGo.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 3,
    topicSlugs: ['load-balancers'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — PawelCodeStuff',
    tags: ['concept', 'load-balancer', 'intro', 'pawel-code-stuff'],
    topicOrder: { 'load-balancers': 1 },
  },
  {
    title: 'Database Indexes Explained In 6 Minutes',
    url: 'https://www.youtube.com/watch?v=YC50j-nozZs',
    description:
      'PawelCodeStuff — por que índices existem e como mudam o custo de busca em SELECT. Animação da diferença full-scan vs lookup. Entry pré-ByteByteGo "Database Index Fundamentals".',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 7,
    topicSlugs: ['databases'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — PawelCodeStuff',
    tags: ['concept', 'index', 'database', 'pawel-code-stuff'],
    topicOrder: { 'databases': 6 },
  },
  {
    title: 'Auto-Increment vs UUID Explained in 5 Minutes',
    url: 'https://www.youtube.com/watch?v=JbdvmQ_HgJo',
    description:
      'PawelCodeStuff — escolha de primary key: auto-increment vs UUID. Trade-offs de unicidade global, índices clusterizados, fragmentação, segurança e enumeração de IDs.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 6,
    topicSlugs: ['databases'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — PawelCodeStuff',
    tags: ['tradeoffs', 'primary-key', 'uuid', 'auto-increment', 'database', 'pawel-code-stuff'],
    topicOrder: { 'databases': 10 },
  },
  {
    title: '3 Databases Built for Specific Problems',
    url: 'https://www.youtube.com/watch?v=rZbJLJIESZg',
    description:
      'PawelCodeStuff — três bancos especializados (time-series, vector, graph) e o problema que cada um resolve melhor que um relacional. Complementa "7 Database Paradigms" com fits concretos.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 8,
    topicSlugs: ['databases'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — PawelCodeStuff',
    tags: ['tradeoffs', 'database-selection', 'time-series', 'vector-db', 'graph-db', 'pawel-code-stuff'],
    topicOrder: { 'databases': 21 },
  },
  {
    title: 'Why Good Password Hashing is Intentionally Slow',
    url: 'https://www.youtube.com/watch?v=lLDZ9O8E62Y',
    description:
      'PawelCodeStuff — por que bcrypt/argon2 são lentos de propósito: tornar brute-force economicamente inviável. Entry pré-Hussein Nasser sobre níveis de password storage.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 6,
    topicSlugs: ['security'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — PawelCodeStuff',
    tags: ['concept', 'security', 'password', 'hashing', 'bcrypt', 'argon2', 'pawel-code-stuff'],
    topicOrder: { 'security': 6 },
  },
  {
    title: 'Why Moving Your Mouse Generates Secure Keys',
    url: 'https://www.youtube.com/watch?v=DB0dEPDCm24',
    description:
      'PawelCodeStuff — entropia e CSPRNG: por que sistemas usam input físico (mouse, teclado, ruído) pra semear geradores criptográficos e o que dá errado quando essa entropia é fraca.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 10,
    topicSlugs: ['security'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — PawelCodeStuff',
    tags: ['concept', 'security', 'entropy', 'csprng', 'cryptography', 'pawel-code-stuff'],
    topicOrder: { 'security': 14 },
  },
  {
    title: 'Why is rendering text so complicated?',
    url: 'https://www.youtube.com/watch?v=4soZ33MvlW4',
    description:
      'PawelCodeStuff — a profundidade da pilha de renderização de texto: Unicode, encoding, glyphs, ligaturas, shaping, layout. Curiosity piece pra abrir o apetite pela depth de CS.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 6,
    topicSlugs: ['foundations'],
    tracks: [],
    source: 'YouTube — PawelCodeStuff',
    tags: ['concept', 'fundamentals', 'unicode', 'rendering', 'curiosity', 'pawel-code-stuff'],
    topicOrder: { 'foundations': 10 },
  },
  {
    title: 'File Compression Explained In 4 Minutes',
    url: 'https://www.youtube.com/watch?v=jy148D4iB_Q',
    description:
      'PawelCodeStuff — compressão sem-perda em 4min: redundância, RLE, codificação por dicionário (LZ77), Huffman. Curiosity piece sobre algoritmos do dia-a-dia.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 4,
    topicSlugs: ['foundations'],
    tracks: [],
    source: 'YouTube — PawelCodeStuff',
    tags: ['concept', 'fundamentals', 'compression', 'huffman', 'lz77', 'curiosity', 'pawel-code-stuff'],
    topicOrder: { 'foundations': 11 },
  },

  // --- senior-eng case studies + URL shortener case + SD overview — 2026-05-13 ---
  {
    title: 'I was laid off by Atlassian',
    url: 'https://www.youtube.com/watch?v=55pTFVoclvE',
    description:
      'Vasilios Syrakis — 41min de relato técnico do que ele construiu como senior eng na Atlassian: Open Service Broker, Envoy como proxy com XDS Control Plane, AMI na AWS, extending load balancing platform, edge compute, manutenção long-term. Capítulos no vídeo pra navegar.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 41,
    topicSlugs: ['load-balancers', 'cloud', 'networking'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Vasilios Syrakis',
    tags: ['case-study', 'envoy', 'xds', 'proxy', 'aws', 'ami', 'load-balancing', 'edge-compute', 'atlassian'],
    topicOrder: { 'load-balancers': 5, 'cloud': 8, 'networking': 9 },
  },
  {
    title: '20 System Design Concepts Explained in 10 Minutes',
    url: 'https://www.youtube.com/watch?v=i53Gi_K3o7I',
    description:
      'NeetCode — panorama de 20 conceitos de system design em 12min: CAP, ACID, vertical vs horizontal scaling, load balancing, caching, sharding, replication, CDN, message queues, microservices, REST vs GraphQL vs gRPC.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 12,
    topicSlugs: ['foundations', 'scalability'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — NeetCode',
    tags: ['concept', 'system-design', 'overview', 'cap', 'acid', 'neetcode'],
    topicOrder: { 'foundations': 12, 'scalability': 8 },
  },
  {
    title: 'Tiny URL — System Design Interview Question (URL shortener)',
    url: 'https://www.youtube.com/watch?v=Cg3XIqs_-4c',
    description:
      'TechPrep — 10min de TinyURL: API design, schema do DB, geração de short code, base62, trade-offs de hash vs counter.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 10,
    topicSlugs: ['case-url-shortener'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH'],
    source: 'YouTube — TechPrep',
    tags: ['case-study', 'url-shortener', 'base62', 'api-design'],
    topicOrder: { 'case-url-shortener': 1 },
  },
  {
    title: 'System Design Interview Question: Design URL Shortener',
    url: 'https://www.youtube.com/watch?v=16d35un5a9Q',
    description:
      'Hayk Simonyan — 14min de URL shortener: requirements, geração de short URL (base62, MD5 + tratamento de colisão), schema do DB, cache layer, rate limiting.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 14,
    topicSlugs: ['case-url-shortener'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH'],
    source: 'YouTube — Hayk Simonyan',
    tags: ['case-study', 'url-shortener', 'base62', 'md5', 'rate-limiting', 'cache'],
    topicOrder: { 'case-url-shortener': 2 },
  },

  // --- Renato Augusto (BR) — primeiro item, 2026-05-13 ---
  {
    title: 'Arquitetando um Encurtador de URL: O Maior Desafio dos Programadores em Entrevistas de System Design',
    url: 'https://www.youtube.com/watch?v=m_anIoKW7Jg',
    description:
      'Renato Augusto — 48min de URL shortener arquitetado do zero: geração de IDs (Hashids, Base62, Redis), modelagem de dados, cache-aside pattern, colisões e gargalos, escalabilidade horizontal e particionamento. Diagrama no Miro linkado na descrição.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 48,
    topicSlugs: ['case-url-shortener'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH'],
    source: 'YouTube — Renato Augusto',
    tags: ['case-study', 'url-shortener', 'base62', 'hashids', 'redis', 'cache-aside', 'sharding', 'renato-augusto'],
    topicOrder: { 'case-url-shortener': 3 },
  },

  // --- case-streaming ladder — 2026-05-13 ---
  {
    title: 'Netflix: What Happens When You Press Play?',
    url: 'https://blog.bytebytego.com/p/netflix-what-happens-when-you-press',
    description:
      'ByteByteGo — capítulo de "Explain the Cloud Like I\'m 10". O que acontece da hora que você aperta play: CDN Open Connect, ABR (adaptive bitrate), transcoding em múltiplas qualidades, AWS backend.',
    format: 'ARTICLE',
    difficulty: 'EASY',
    estimatedMinutes: 12,
    topicSlugs: ['case-streaming'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH'],
    source: 'ByteByteGo Blog',
    tags: ['case-study', 'netflix', 'cdn', 'open-connect', 'abr', 'bytebytego'],
    topicOrder: { 'case-streaming': 1 },
  },
  {
    title: 'Demystifying the Unusual Evolution of the Netflix API Architecture',
    url: 'https://www.youtube.com/watch?v=Uu32ggF-DWg',
    description:
      'ByteByteGo — 5min sobre a evolução da API do Netflix: monolito → microsserviços → BFF (backend-for-frontend) com GraphQL Federation. Por que a evolução foi "unusual".',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 5,
    topicSlugs: ['case-streaming'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH'],
    source: 'YouTube — ByteByteGo',
    tags: ['case-study', 'netflix', 'api', 'microservices', 'graphql', 'bff', 'bytebytego'],
    topicOrder: { 'case-streaming': 2 },
  },
  {
    title: 'System Design Netflix — A Complete Architecture',
    url: 'https://www.geeksforgeeks.org/system-design/system-design-netflix-a-complete-architecture/',
    description:
      'GeeksforGeeks — overview da arquitetura do Netflix: AWS backend, Open Connect CDN, EVCache + Cassandra + MySQL, Zuul/Eureka, ABR streaming, Kafka pra eventos.',
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 25,
    topicSlugs: ['case-streaming'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH'],
    source: 'GeeksforGeeks',
    tags: ['case-study', 'netflix', 'cdn', 'evcache', 'cassandra', 'zuul', 'kafka', 'abr'],
    topicOrder: { 'case-streaming': 3 },
  },
  {
    title: 'ARQUITETANDO O YOUTUBE NA PRÁTICA | SYSTEM DESIGN',
    url: 'https://www.youtube.com/watch?v=JBivKeZVex0',
    description:
      'Renato Augusto — 50min do YouTube arquitetado: upload pipeline com Multipart Upload, object storage distribuído, encoding em múltiplas qualidades, CDNs pra entrega global, escalabilidade horizontal pra bilhões de vídeos. Diagrama no Miro linkado.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 50,
    topicSlugs: ['case-streaming'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH'],
    source: 'YouTube — Renato Augusto',
    tags: ['case-study', 'youtube', 'multipart-upload', 'object-storage', 'encoding', 'cdn', 'horizontal-scaling', 'renato-augusto'],
    topicOrder: { 'case-streaming': 4 },
  },

  // --- sharding HARD deep-dive — 2026-05-13 ---
  {
    title: 'Aprenda a Escalar Bancos de Dados Usando SHARDING',
    url: 'https://www.youtube.com/watch?v=xJllDyCIyws',
    description:
      'Renato Augusto — 44min de sharding na prática: shard keys e como evitar hotspots, problema de IDs sequenciais resolvido com hash, joins/transactions/migrations/re-sharding, quando NÃO usar sharding, ligações com microsserviços e DDD.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 44,
    topicSlugs: ['sharding', 'databases'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH'],
    source: 'YouTube — Renato Augusto',
    tags: ['concept', 'sharding', 'shard-key', 'hotspot', 'horizontal-scaling', 're-sharding', 'renato-augusto'],
    topicOrder: { 'sharding': 5, 'databases': 25 },
  },

  // --- databases batch — 2026-05-13 ---
  {
    title: 'Por Que Você NUNCA Deve Usar FLOAT pra Representar Dinheiro no Código',
    url: 'https://www.youtube.com/watch?v=vFBUWtrzz48',
    description:
      'Renato Augusto — 14min sobre por que FLOAT é impreciso pra valores monetários: armazenamento IEEE 754, exemplos reais de bugs por arredondamento, e como Python/Java/JS/PHP lidam com o problema. O que usar no lugar.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 14,
    topicSlugs: ['databases'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Renato Augusto',
    tags: ['concept', 'data-types', 'float', 'precision', 'money', 'ieee-754', 'renato-augusto'],
    topicOrder: { 'databases': 22 },
  },
  {
    title: 'Como Escolher o Banco de Dados Correto pra sua Aplicação',
    url: 'https://www.youtube.com/watch?v=bhw4-Kq_RPs',
    description:
      'Renato Augusto — 45min escolhendo BD na prática: diferenças SQL vs NoSQL, Teorema CAP e PACELC, quando usar PostgreSQL/MongoDB/Cassandra/DynamoDB/CockroachDB. Diagrama no Miro linkado.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 45,
    topicSlugs: ['databases', 'cap-consistency'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Renato Augusto',
    tags: ['tradeoffs', 'sql', 'nosql', 'cap', 'pacelc', 'postgres', 'mongo', 'cassandra', 'dynamodb', 'cockroachdb', 'renato-augusto'],
    topicOrder: { 'databases': 23, 'cap-consistency': 10 },
  },
  {
    title: 'O Que Ninguém Te Ensinou Sobre Armazenar Senhas no Banco de Dados',
    url: 'https://www.youtube.com/watch?v=VW2mywTTz80',
    description:
      'Renato Augusto — 39min sobre a evolução do armazenamento de senhas: plaintext → MD5/SHA-1 → salt → bcrypt/PBKDF2/Argon2id. Linha do tempo dos ataques e das soluções, e os erros graves que empresas ainda cometem hoje.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 39,
    topicSlugs: ['security', 'databases'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Renato Augusto',
    tags: ['concept', 'password-storage', 'bcrypt', 'argon2', 'pbkdf2', 'salt', 'md5', 'sha-1', 'renato-augusto'],
    topicOrder: { 'databases': 24, 'security': 8 },
  },

  // --- scalability batch — 2026-05-13 ---
  {
    title: 'Microsserviços: A Maior Armadilha da Arquitetura Moderna | E o Que Domain Driven Design Tem a Ver?',
    url: 'https://www.youtube.com/watch?v=JXeJUfBCg4U',
    description:
      'Renato Augusto — 18min sobre por que microsserviços prematuramente é tiro no pé: monolito modular como ponto de partida, Domain Driven Design + Clean Architecture, Bounded Contexts. Amazon (re)adotando essa abordagem.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 18,
    topicSlugs: ['scalability', 'design-patterns'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Renato Augusto',
    tags: ['tradeoffs', 'microservices', 'monolith', 'modular-monolith', 'ddd', 'bounded-contexts', 'clean-architecture', 'renato-augusto'],
    topicOrder: { 'scalability': 6, 'design-patterns': 8 },
  },
  {
    title: 'System Design: Escalando uma Arquitetura do Zero a Um Milhão de Usuários',
    url: 'https://www.youtube.com/watch?v=9g7twJrXqoY',
    description:
      'Renato Augusto — 40min escalando arquitetura web do zero a 1M usuários: como responder esse cenário em entrevistas, decisões de arquitetura, performance e escalabilidade conforme o sistema cresce. Diagrama no Miro linkado.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 40,
    topicSlugs: ['scalability'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Renato Augusto',
    tags: ['case-study', 'scaling', 'load-balancing', 'caching', 'database-scaling', 'cdn', 'renato-augusto'],
    topicOrder: { 'scalability': 7 },
  },

  // --- pubsub/message-queues — 2026-05-13 ---
  {
    title: 'Arquitetura Orientada a Eventos | O Guia Completo para ESCALAR MICROSSERVIÇOS do Jeito Certo',
    url: 'https://www.youtube.com/watch?v=8xFBQc1A4B8',
    description:
      'Renato Augusto — 42min sobre Event Driven Architecture: por que request/response síncrono quebra em escala, acoplamento temporal e cascata de falhas, produtores/consumidores/eventos, Event Storming + DDD na modelagem. Como Netflix, Uber e Amazon usam.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 42,
    topicSlugs: ['pubsub', 'message-queues'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Renato Augusto',
    tags: ['concept', 'event-driven', 'eda', 'microservices', 'event-storming', 'ddd', 'coupling', 'renato-augusto'],
    topicOrder: { 'pubsub': 6, 'message-queues': 8 },
  },

  // --- foundations disaster storytelling — 2026-05-13 ---
  {
    title: 'O Erro de Software Mais Letal da História | THERAC-25',
    url: 'https://www.youtube.com/watch?v=4WCYIdJxTQw',
    description:
      'Renato Augusto — 31min sobre o Therac-25: a máquina médica controlada por software que matou pacientes por bugs de concorrência, estados globais e ausência de testes. Falhas de projeto e responsabilidade técnica em sistema crítico.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 31,
    topicSlugs: ['foundations'],
    tracks: [],
    source: 'YouTube — Renato Augusto',
    tags: ['case-study', 'software-failure', 'concurrency', 'critical-systems', 'testing', 'renato-augusto'],
    topicOrder: { 'foundations': 13 },
  },
  {
    title: 'A História Não Contada do Desastre do Ariane 5',
    url: 'https://www.youtube.com/watch?v=fybymNqbzLg',
    description:
      'Renato Augusto — 44min sobre o desastre do Ariane 5: o erro de conversão float→inteiro explicado bit a bit, reaproveitamento de código do Ariane 4 sem validar, ausência de testes com dados reais. Análise da comissão Jacques-Louis Lions e paralelos com o Challenger.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 44,
    topicSlugs: ['foundations'],
    tracks: [],
    source: 'YouTube — Renato Augusto',
    tags: ['case-study', 'software-failure', 'type-conversion', 'testing', 'critical-systems', 'code-reuse', 'renato-augusto'],
    topicOrder: { 'foundations': 14 },
  },

  // --- Renato case-studies: Google Drive + Ticketmaster — 2026-05-13 ---
  {
    title: 'ARQUITETANDO O GOOGLE DRIVE NA PRÁTICA | SYSTEM DESIGN',
    url: 'https://www.youtube.com/watch?v=qMPfjCH3qQU',
    description:
      'Renato Augusto — 45min do Google Drive arquitetado: Signed URLs e Multipart Upload pra arquivos grandes, Amazon S3 como object storage, sincronização local↔nuvem com inotify/FSEvents, retomada de upload e tolerância a falhas, download direto do Object Storage.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 45,
    topicSlugs: ['cloud', 'scalability'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH'],
    source: 'YouTube — Renato Augusto',
    tags: ['case-study', 'google-drive', 'dropbox', 's3', 'object-storage', 'multipart-upload', 'signed-urls', 'sync', 'fault-tolerance', 'renato-augusto'],
    topicOrder: { 'cloud': 7, 'scalability': 9 },
  },
  {
    title: 'ARQUITETANDO O TICKETMASTER NA PRÁTICA | SYSTEM DESIGN',
    url: 'https://www.youtube.com/watch?v=3XSijmIZxXU',
    description:
      'Renato Augusto — 50min do Ticketmaster: como evitar overselling em picos massivos de acesso, reserva temporária de ingressos (locking/hold de assentos), filas + rate limiting + processamento assíncrono, controle de concorrência, escalabilidade horizontal.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 50,
    topicSlugs: ['cap-consistency', 'rate-limiting', 'scalability'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH'],
    source: 'YouTube — Renato Augusto',
    tags: ['case-study', 'ticketmaster', 'overselling', 'concurrency', 'race-conditions', 'queues', 'rate-limiting', 'locking', 'horizontal-scaling', 'renato-augusto'],
    topicOrder: { 'cap-consistency': 11, 'rate-limiting': 7, 'scalability': 10 },
  },

  // --- Object Calisthenics série pra design-patterns — 2026-05-13 ---
  {
    title: 'Object Calisthenics: A Armadilha dos Tipos Primitivos',
    url: 'https://www.youtube.com/watch?v=YGNH71KPIes',
    description:
      'Renato Augusto — 29min sobre primitive obsession: usar int/string/boolean pra tudo viola coesão, encapsulamento e SRP. Como encapsular dados em Value Objects e alinhar com SOLID e DDD.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 29,
    topicSlugs: ['design-patterns'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Renato Augusto',
    tags: ['concept', 'object-calisthenics', 'primitive-obsession', 'value-objects', 'solid', 'srp', 'ddd', 'renato-augusto'],
    topicOrder: { 'design-patterns': 4 },
  },
  {
    title: 'Object Calisthenics: Lei de Demeter — A Técnica Para Eliminar Dependências Ocultas',
    url: 'https://www.youtube.com/watch?v=KXaPJhG9yCk',
    description:
      'Renato Augusto — 17min sobre a Lei de Demeter (não fale com estranhos): chamadas encadeadas, dependências ocultas, e como aplicar pra desacoplar o código. Relação com Aggregate Root do DDD. Antes-depois de refactor agnóstico de linguagem.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 17,
    topicSlugs: ['design-patterns'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Renato Augusto',
    tags: ['concept', 'object-calisthenics', 'law-of-demeter', 'coupling', 'oo', 'aggregate-root', 'ddd', 'renato-augusto'],
    topicOrder: { 'design-patterns': 5 },
  },
  {
    title: 'Object Calisthenics: Técnicas Para Eliminar o ELSE do Seu Código',
    url: 'https://www.youtube.com/watch?v=pW9Bb4PteWU',
    description:
      'Renato Augusto — 25min eliminando o else: Guard Clauses, Early Return, Fail Fast, e padrões de projeto que substituem cadeias de else.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 25,
    topicSlugs: ['design-patterns'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Renato Augusto',
    tags: ['concept', 'object-calisthenics', 'guard-clauses', 'early-return', 'fail-fast', 'refactoring', 'renato-augusto'],
    topicOrder: { 'design-patterns': 6 },
  },

  // --- caching CACHE-ASIDE deep-dive — 2026-05-13 ---
  {
    title: 'CACHE-ASIDE: Escalabilidade, Performance e Arquitetura de Software pra Mandar Bem na Entrevista',
    url: 'https://www.youtube.com/watch?v=vRO0UfvsbDw',
    description:
      'Renato Augusto — 30min sobre o padrão Cache-Aside: por que queries repetidas viram gargalo invisível, fluxo aplicação→cache→DB com fallback, write strategy, e o que isso te dá em escalabilidade e performance.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 30,
    topicSlugs: ['caching'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Renato Augusto',
    tags: ['concept', 'cache-aside', 'read-through', 'database-bottleneck', 'performance', 'renato-augusto'],
    topicOrder: { 'caching': 9 },
  },

  // ---------------------------------------------------------------------------
  // consistent hashing (3 items) — 2026-05-30
  // ---------------------------------------------------------------------------
  {
    title: 'Consistent Hashing: Easy Explanation for System Design Interviews',
    url: 'https://www.youtube.com/watch?v=vccwdhfqIrI',
    description:
      'Hello Interview — consistent hashing montado passo a passo no Excalidraw: do problema (re-hashear tudo quando um nó entra ou sai) até o anel. 8min, focado em system design interview.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 8,
    topicSlugs: ['hashmap', 'sharding', 'caching', 'load-balancers'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Hello Interview',
    tags: ['concept', 'hashmap', 'consistent-hashing', 'sharding', 'distributed', 'hello-interview'],
  },
  {
    title: 'Consistent Hashing 101',
    url: 'https://thecodinggopher.substack.com/p/consistent-hashing-for-dummies',
    description:
      'The Coding Gopher — o anel de hash, virtual nodes pra distribuição uniforme, e como Amazon, Netflix e Discord usam isso na prática. ~7min de leitura.',
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 7,
    topicSlugs: ['hashmap', 'sharding', 'caching', 'load-balancers'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'The Coding Gopher',
    tags: ['concept', 'hashmap', 'consistent-hashing', 'virtual-nodes', 'sharding', 'distributed', 'the-coding-gopher'],
  },
  {
    title: 'Consistent Hashing — The Backend Engineering Show',
    url: 'https://www.youtube.com/watch?v=p6wwj0ozifw',
    description:
      'Hussein Nasser — por que simple hashing quebra ao adicionar ou remover um nó, e como consistent hashing resolve. 24min passando por adicionar servidor, remover servidor e as limitações do algoritmo. Aparece em Cassandra e DynamoDB.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 24,
    topicSlugs: ['hashmap', 'sharding', 'caching', 'load-balancers'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Hussein Nasser',
    tags: ['concept', 'hashmap', 'consistent-hashing', 'sharding', 'distributed', 'cassandra', 'dynamodb', 'hussein-nasser'],
  },

  // ---------------------------------------------------------------------------
  // case-chat — Discord (1 item) — 2026-05-30
  // ---------------------------------------------------------------------------
  {
    title: 'How Discord Stores TRILLIONS of Messages',
    url: 'https://www.youtube.com/watch?v=lLrzoyU4BPc',
    description:
      'Coding with Lewis — a evolução de storage do Discord: MongoDB virou gargalo, migraram pra Cassandra e depois ScyllaDB. Mostra como eles bucketizam mensagens por canal e tempo e o problema das hot partitions. 14min.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 14,
    topicSlugs: ['case-chat', 'databases', 'sharding'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Coding with Lewis',
    tags: ['case-study', 'discord', 'cassandra', 'scylladb', 'sharding', 'hot-partition', 'coding-with-lewis'],
  },

  // ---------------------------------------------------------------------------
  // Coding with Lewis case studies (8 items) — 2026-05-30
  // ---------------------------------------------------------------------------
  {
    title: "How Discord Handled the World's Largest Server",
    url: 'https://www.youtube.com/watch?v=fv_MPosiINw',
    description:
      'Coding with Lewis — como o Discord lidou com o maior servidor da plataforma (milhões de membros num só server): por que isso quebra o modelo normal de fan-out de mensagens e o que eles fizeram. 8min.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 8,
    topicSlugs: ['case-chat', 'scalability'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Coding with Lewis',
    tags: ['case-study', 'discord', 'fan-out', 'scalability', 'coding-with-lewis'],
  },
  {
    title: 'How Notion Handles 200 BILLION Notes',
    url: 'https://www.youtube.com/watch?v=NwZ26lxl8wU',
    description:
      'Coding with Lewis — como o Notion guarda 200 bilhões de blocos: o modelo de dados em blocks no Postgres e o sharding que fizeram quando uma tabela só não dava mais conta. 11min.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 11,
    topicSlugs: ['databases', 'sharding'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Coding with Lewis',
    tags: ['case-study', 'notion', 'postgres', 'sharding', 'data-model', 'coding-with-lewis'],
  },
  {
    title: 'What a Billion Database Rows Look Like in Real Life',
    url: 'https://www.youtube.com/watch?v=sEQ1ecQq0HI',
    description:
      'Coding with Lewis — o que muda quando uma tabela passa de um bilhão de linhas: índice que não cabe em memória, query que era rápida e vira lenta, e as saídas. 10min.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 10,
    topicSlugs: ['databases'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Coding with Lewis',
    tags: ['case-study', 'database-scale', 'indexing', 'query-performance', 'coding-with-lewis'],
  },
  {
    title: 'How Much Does it Cost to Scale an App to 100,000 Users?',
    url: 'https://www.youtube.com/watch?v=AuodUoWEWw0',
    description:
      'Coding with Lewis — quanto custa de verdade escalar um app de zero a 100 mil usuários: onde o dinheiro vai (banco, servidores, CDN) e quais decisões de arquitetura mexem na conta. 14min.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 14,
    topicSlugs: ['scalability', 'cloud'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Coding with Lewis',
    tags: ['case-study', 'scalability', 'cloud-cost', 'cdn', 'coding-with-lewis'],
  },
  {
    title: 'The Engineering That Saved Slack During COVID',
    url: 'https://www.youtube.com/watch?v=WFpEvs2sjgs',
    description:
      'Coding with Lewis — o pico de carga que o Slack levou quando o mundo foi pra home office em 2020 e a engenharia que segurou o serviço de pé. 19min.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 19,
    topicSlugs: ['reliability', 'scalability', 'case-chat'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Coding with Lewis',
    tags: ['case-study', 'slack', 'load-spike', 'reliability', 'scalability', 'coding-with-lewis'],
  },
  {
    title: "GitHub's Code Was Breaking Every 8 Hours. Here's Why",
    url: 'https://www.youtube.com/watch?v=JJZQr2AuEI0',
    description:
      'Coding with Lewis — o bug que derrubava o GitHub a cada 8 horas e a investigação até a causa raiz. 19min de debugging de produção em escala.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 19,
    topicSlugs: ['reliability'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Coding with Lewis',
    tags: ['case-study', 'github', 'root-cause', 'production-debugging', 'reliability', 'coding-with-lewis'],
  },
  {
    title: '3 Algorithms Netflix Uses to Scan BILLIONS of Frames',
    url: 'https://www.youtube.com/watch?v=T5gTIFhPDaY',
    description:
      'Coding with Lewis — três algoritmos que a Netflix usa pra varrer bilhões de frames de vídeo: detecção de cena, geração de thumbnail e checagem de qualidade. 16min.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 16,
    topicSlugs: ['case-streaming'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Coding with Lewis',
    tags: ['case-study', 'netflix', 'video-processing', 'algorithms', 'coding-with-lewis'],
  },
  {
    title: 'How the New York Times Beat Paywall Hackers For Good',
    url: 'https://www.youtube.com/watch?v=9Ej9JUnFCO0',
    description:
      'Coding with Lewis — como o New York Times fechou as brechas que deixavam furar o paywall, e o jogo de gato e rato com quem burlava. 12min.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 12,
    topicSlugs: ['security'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Coding with Lewis',
    tags: ['case-study', 'nyt', 'paywall', 'security', 'coding-with-lewis'],
  },

  // ---------------------------------------------------------------------------
  // OBSERVABILITY — 2026-06-07. Tópico magro nos canais aprovados; ladder ancorado
  // no Coding Gopher (aprovado) + CodeOpinion (novo, arquitetura/EDA, não-vendor).
  // ---------------------------------------------------------------------------
  {
    title: 'Distributed Tracing Explained: Understanding Microservice Observability',
    url: 'https://www.youtube.com/watch?v=fldLP22QUKg',
    description:
      'The Coding Gopher — tracing distribuído num diagrama: traces (a jornada completa de uma request entre serviços) e spans (cada passo). Como você debuga quando algo quebra no meio de vários microsserviços.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 5,
    topicSlugs: ['observability'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — The Coding Gopher',
    tags: ['concept', 'distributed-tracing', 'spans', 'microservices', 'coding-gopher'],
    topicOrder: { 'observability': 1 },
  },
  {
    title: 'Logging, Tracing, and Metrics',
    url: 'https://bytebytego.com/guides/logging-tracing-metrics/',
    description:
      'ByteByteGo — os 3 pilares de observability: logs (eventos discretos), métricas (agregados tipo QPS e latência) e traces (a request atravessando os serviços). Guia ilustrado.',
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 8,
    topicSlugs: ['observability'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'ByteByteGo',
    tags: ['concept', 'logs', 'metrics', 'tracing', 'three-pillars', 'bytebytego'],
    topicOrder: { 'observability': 2 },
  },
  {
    title: 'Percentile Tail Latency Explained (95%, 99%)',
    url: 'https://www.youtube.com/watch?v=3JdQOExKtUY',
    description:
      'Hussein Nasser — o que significa "meu p95 é 30ms, meu p99 é 100ms". Por que percentil de cauda mede performance de backend melhor que média, e onde percentil engana.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 7,
    topicSlugs: ['observability'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Hussein Nasser',
    tags: ['concept', 'tail-latency', 'percentile', 'p99', 'metrics', 'hussein-nasser'],
    topicOrder: { 'observability': 3 },
  },
  {
    title: 'Consumer Lag: Event Driven Architecture Monitoring',
    url: 'https://www.youtube.com/watch?v=jguxDV1gWk8',
    description:
      'CodeOpinion — consumer lag em event-driven architecture: a fila crescendo é o primeiro sinal de que um serviço travou. Como ler throughput de publishers e consumers antes do sistema desmoronar.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 11,
    topicSlugs: ['observability'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — CodeOpinion',
    tags: ['concept', 'consumer-lag', 'event-driven', 'throughput', 'monitoring', 'codeopinion'],
    topicOrder: { 'observability': 4 },
  },
  {
    title: 'Discover a Distributed Big Ball of Mud with Distributed Tracing',
    url: 'https://www.youtube.com/watch?v=94pr3XEB0L0',
    description:
      'CodeOpinion — tracing distribuído mostra como uma request flui entre serviços, mas também vira band-aid que esconde acoplamento que você nem precisava ter. Quando o trace revela um big ball of mud.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 15,
    topicSlugs: ['observability'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — CodeOpinion',
    tags: ['case-study', 'distributed-tracing', 'coupling', 'big-ball-of-mud', 'codeopinion'],
    topicOrder: { 'observability': 5 },
  },
  {
    title: 'Erasure Coding',
    url: 'https://blog.bytebytego.com/p/erasure-coding',
    description:
      'ByteByteGo — erasure coding contra replicação tripla: 11 noves com 50% de overhead versus 6 noves com 200%.',
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 3,
    topicSlugs: ['cloud', 'reliability', 'replication'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'Blog — ByteByteGo',
    tags: ['tradeoffs', 'erasure-coding', 'reed-solomon', 'durability', 'replication', 'bytebytego'],
    topicOrder: { 'cloud': 9, 'reliability': 6, 'replication': 6 },
  },
  {
    title: 'How Amazon S3 Stores 350 Trillion Objects with 11 Nines of Durability',
    url: 'https://blog.bytebytego.com/p/how-amazon-s3-stores-350-trillion',
    description:
      'ByteByteGo — S3 por dentro: 350+ microserviços, indexação lexicográfica pra evitar hotspot, erasure coding Reed-Solomon, replicação multi-AZ. É de onde saem os 11 noves.',
    format: 'ARTICLE',
    difficulty: 'HARD',
    estimatedMinutes: 18,
    topicSlugs: ['cloud', 'scalability', 'reliability'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'Blog — ByteByteGo',
    tags: ['concept', 's3', 'object-storage', 'durability', 'erasure-coding', 'multi-az', 'bytebytego'],
    topicOrder: { 'cloud': 10, 'scalability': 10, 'reliability': 7 },
  },
  {
    title: 'A Deep Dive into Amazon DynamoDB Architecture',
    url: 'https://blog.bytebytego.com/p/a-deep-dive-into-amazon-dynamodb',
    description:
      'ByteByteGo — como o DynamoDB particiona, replica com multi-Paxos entre AZs, controla throughput com token bucket e lida com hot partitions.',
    format: 'ARTICLE',
    difficulty: 'HARD',
    estimatedMinutes: 18,
    topicSlugs: ['cloud', 'databases', 'sharding', 'replication'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'Blog — ByteByteGo',
    tags: ['concept', 'dynamodb', 'partitioning', 'multi-paxos', 'token-bucket', 'hot-partition', 'bytebytego'],
    topicOrder: { 'cloud': 11, 'databases': 20, 'sharding': 8, 'replication': 7 },
  },
  // Amazon Builders' Library. The aws.amazon.com URLs 301 to
  // builder.aws.com/content/<opaque-hash>/... — we register the old ones on
  // purpose: they redirect on their own and survive the next migration, which
  // a hash-based URL would not.
  {
    title: 'Timeouts, retries and backoff with jitter',
    url: 'https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/',
    description:
      "Amazon Builders' Library — por que retry sem jitter transforma uma falha pequena em retry storm, e como o backoff exponencial com jitter espalha os picos.",
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 20,
    topicSlugs: ['reliability', 'cloud'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: "Article — Amazon Builders' Library",
    tags: ['concept', 'retry', 'backoff', 'jitter', 'timeout', 'retry-storm', 'aws-builders-library'],
    topicOrder: { 'reliability': 8, 'cloud': 12 },
  },
  {
    title: 'Workload isolation using shuffle-sharding',
    url: 'https://aws.amazon.com/builders-library/workload-isolation-using-shuffle-sharding/',
    description:
      "Amazon Builders' Library — shuffle sharding dá a cada cliente uma combinação diferente de workers, então a falha de um não derruba todo mundo junto.",
    format: 'ARTICLE',
    difficulty: 'HARD',
    estimatedMinutes: 15,
    topicSlugs: ['sharding', 'reliability', 'cloud'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: "Article — Amazon Builders' Library",
    tags: ['concept', 'shuffle-sharding', 'workload-isolation', 'blast-radius', 'multi-tenant', 'aws-builders-library'],
    topicOrder: { 'sharding': 9, 'reliability': 9, 'cloud': 13 },
  },
  {
    title: 'Minimizing correlated failures in distributed systems',
    url: 'https://aws.amazon.com/builders-library/minimizing-correlated-failures-in-distributed-systems/',
    description:
      "Amazon Builders' Library — o que faz componentes supostamente independentes caírem ao mesmo tempo, e como quebrar essa correlação.",
    format: 'ARTICLE',
    difficulty: 'HARD',
    estimatedMinutes: 20,
    topicSlugs: ['reliability', 'scalability', 'cloud'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: "Article — Amazon Builders' Library",
    tags: ['concept', 'correlated-failure', 'blast-radius', 'cell-based-architecture', 'aws-builders-library'],
    topicOrder: { 'reliability': 10, 'cloud': 14 },
  },
  {
    title: 'Making retries safe with idempotent APIs',
    url: 'https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/',
    description:
      "Amazon Builders' Library — retry só é seguro se a API for idempotente. Como desenhar token de idempotência e o que acontece quando a mesma request chega duas vezes.",
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 15,
    topicSlugs: ['idempotency', 'reliability', 'cloud'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: "Article — Amazon Builders' Library",
    tags: ['concept', 'idempotency', 'idempotency-token', 'retry', 'exactly-once', 'aws-builders-library'],
    topicOrder: { 'idempotency': 1, 'reliability': 11, 'cloud': 15 },
  },
  {
    title: 'Cloud Computing Explained: The Most Important Concepts To Know',
    url: 'https://www.youtube.com/watch?v=ZaA0kNm18pE',
    description:
      'Be A Better Dev — 46min de whiteboard cobrindo scaling, load balancing, autoscaling, serverless, event-driven, orquestração de containers, storage, availability, durability, IaC e redes.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 46,
    // Covers stop at scalability + reliability on purpose. The video touches 11
    // themes in 46min, so tagging container orchestration or pub/sub as covers
    // would raise those topics' completion off ~4min of material and mislead
    // the planner into thinking the member already studied them.
    topicSlugs: ['cloud', 'scalability', 'reliability'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Be A Better Dev',
    tags: ['concept', 'autoscaling', 'serverless', 'availability', 'durability', 'iac', 'whiteboard', 'be-a-better-dev'],
    topicOrder: { 'cloud': 16, 'scalability': 11, 'reliability': 12 },
  },
  {
    title: 'What Does a Cloud Engineer ACTUALLY Do?',
    url: 'https://www.youtube.com/watch?v=kriafQfqGZE',
    description:
      'Tech With Soleyman — o que um cloud engineer faz no dia a dia e como o papel se separa de DevOps e solutions architect.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 12,
    topicSlugs: ['foundations', 'cloud'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Tech With Soleyman',
    tags: ['career', 'cloud-engineer', 'devops', 'solutions-architect', 'tech-with-soleyman'],
    topicOrder: { 'foundations': 16, 'cloud': 17 },
  },
  {
    title: 'AWS Cloud Engineer Full Course For Beginners (2026)',
    url: 'https://www.youtube.com/watch?v=ewNuSlRdZfw',
    description:
      'Tech With Soleyman — curso introdutório de AWS na prática, do zero. São 72min, então não cabe em uma sessão só.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 72,
    topicSlugs: ['cloud'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Tech With Soleyman',
    tags: ['practice', 'aws', 'hands-on', 'iam', 'ec2', 'tech-with-soleyman'],
    topicOrder: { 'cloud': 18 },
  },
  // Career guides. Approved per video, never per channel (see SKILL.md): each
  // path lives on a different niche channel and none of these enter the
  // whitelist — the `career-oneoff` tag keeps that greppable.
  //
  // tracks: [] on all of them, deliberately. A career guide exists to show a
  // member a path they had not considered; routing "solutions engineer" only
  // to CONSULTING_TECH would hide it from exactly the person who needs to
  // discover it.
  {
    title: 'What is a Back End Software Engineer?',
    url: 'https://www.youtube.com/watch?v=U_LEBXQ2KqY',
    description:
      'Cadams Tech — o que um back end engineer faz de fato, em 6min: responsabilidades, stack e onde termina o front.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 6,
    topicSlugs: ['foundations'],
    tracks: [],
    source: 'YouTube — Cadams Tech',
    tags: ['career', 'career-oneoff', 'backend', 'cadams-tech'],
    topicOrder: { 'foundations': 17 },
  },
  {
    title: 'What Does A Solutions Engineer Actually Do?',
    url: 'https://www.youtube.com/watch?v=OcfslMVcgwo',
    description:
      'Seraphine Young — solutions engineer é a ponte entre o time técnico e o cliente. O vídeo mostra como o papel se separa de engenharia de software.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 10,
    topicSlugs: ['foundations'],
    tracks: [],
    source: 'YouTube — Seraphine Young',
    tags: ['career', 'career-oneoff', 'solutions-engineer', 'pre-sales', 'seraphine-young'],
    topicOrder: { 'foundations': 18 },
  },
  {
    title: 'Who A Blockchain Developer REALLY Is? Revealing the Myths',
    url: 'https://www.youtube.com/watch?v=iYFSiEDl_qg',
    description:
      'Jelvix — quais mitos sobre blockchain developer não se sustentam, e o que sobra do papel depois que você tira eles.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 6,
    topicSlugs: ['foundations'],
    tracks: [],
    source: 'YouTube — Jelvix',
    tags: ['career', 'career-oneoff', 'blockchain', 'web3', 'jelvix'],
    topicOrder: { 'foundations': 19 },
  },
  {
    title: 'So You Want To Be A Security Engineer',
    url: 'https://www.youtube.com/watch?v=6cmZMpTssdo',
    description:
      'A Cloud Guru — por onde alguém entra em security engineering e o que a rotina do papel exige.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 9,
    topicSlugs: ['foundations', 'security'],
    tracks: [],
    source: 'YouTube — A Cloud Guru',
    tags: ['career', 'career-oneoff', 'security-engineer', 'cybersecurity', 'a-cloud-guru'],
    topicOrder: { 'foundations': 20, 'security': 15 },
  },
  {
    title: 'Red vs Blue vs Purple Team Explained for Beginners!',
    url: 'https://www.youtube.com/watch?v=qFp1h9Etldo',
    description:
      'LabCyber — red, blue e purple team lado a lado: o que cada um ataca, defende ou costura entre os dois.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 7,
    topicSlugs: ['foundations', 'security'],
    tracks: [],
    source: 'YouTube — LabCyber',
    tags: ['career', 'career-oneoff', 'red-team', 'blue-team', 'purple-team', 'labcyber'],
    topicOrder: { 'foundations': 21, 'security': 16 },
  },

  // ---------------------------------------------------------------------------
  // FOUNDATIONS — método de LeetCode. Entram logo depois do "LeetCode vai te
  // fazer melhorar como dev?" (Galego, order 6): como abordar uma questão,
  // que padrões existem, e como montar a rotina de estudo.
  //
  // Os três canais NÃO entram na whitelist — Davi aprovou estes vídeos, não os
  // canais (mesmo precedente do KodeKloud). Tag `channel-oneoff` pra rastrear.
  // NeetCodeIO segue filtrado pro resto: o filtro existe por causa dos
  // solve-alongs de VSCode, e este vídeo não é um.
  // ---------------------------------------------------------------------------
  {
    title: 'How to Solve ANY LeetCode Problem (Step-by-Step)',
    url: 'https://www.youtube.com/watch?v=OTNe0eV8418',
    description:
      'Codebagel — método em 5 passos pra atacar qualquer questão: simplificar o enunciado, reconhecer o padrão, montar o plano de implementação, codar, debugar. No fim ele roda os passos numa questão HARD.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 13,
    topicSlugs: ['foundations'],
    tracks: [],
    source: 'YouTube — Codebagel',
    tags: ['concept', 'channel-oneoff', 'leetcode', 'problem-solving', 'interview-prep', 'codebagel'],
    topicOrder: { 'foundations': 7 },
  },
  {
    title: '8 patterns to solve 80% Leetcode problems',
    url: 'https://www.youtube.com/watch?v=xo7XrRVxH8Y',
    description:
      'Sahil & Sarra — os 8 padrões que aparecem na maioria das questões de LeetCode. 8min, é uma passada de nome em cada padrão, não o ensino de cada um.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 8,
    topicSlugs: ['foundations', 'array'],
    tracks: [],
    source: 'YouTube — Sahil & Sarra',
    tags: ['concept', 'channel-oneoff', 'leetcode', 'patterns', 'interview-prep', 'sahil-sarra'],
    topicOrder: { 'foundations': 8, 'array': 51 },
  },
  {
    title: 'How I would learn Leetcode if I could start over',
    url: 'https://www.youtube.com/watch?v=aHZW7TuY_yo',
    description:
      'NeetCodeIO — como o autor do NeetCode 150 estudaria LeetCode se recomeçasse: o erro que ele cometeu no início, por que só aumentar o volume de questões trava, e como montar um sistema de estudo.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 19,
    topicSlugs: ['foundations'],
    tracks: [],
    source: 'YouTube — NeetCodeIO',
    tags: ['concept', 'channel-oneoff', 'leetcode', 'study-method', 'interview-prep', 'neetcode'],
    topicOrder: { 'foundations': 9 },
  },
];

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
            order: item.topicOrder?.[t.slug] ?? null,
          },
        }),
      ),
    ]);

    existing ? updated++ : created++;
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

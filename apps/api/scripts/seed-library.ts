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
    tracks: ['BIG_TECH', 'CONSULTING_TECH'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'pitfalls', 'thundering-herd', 'stampede'],
  },
  {
    title: 'Cache Invalidation Explained',
    url: 'https://www.youtube.com/watch?v=VxeppdirKgE',
    description:
      'ByteByteGo — 90s em cima da frase "only two hard things in CS: cache invalidation and naming things". Por que é difícil e o que fazer.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 2,
    topicSlugs: ['caching'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH'],
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
    difficulty: 'MEDIUM',
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

  // ---------------------------------------------------------------------------
  // array (9 items) — 2026-04-19
  // ---------------------------------------------------------------------------
  {
    title: 'Big-O Notation in 100 Seconds',
    url: 'https://www.youtube.com/watch?v=g2o22C3CRfU',
    description:
      'Fireship — notação Big-O em 100s. O vocabulário pra comparar algoritmos em array e hashmap.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 2,
    topicSlugs: ['array'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Fireship',
    tags: ['concept', 'big-o', 'complexity', 'fireship'],
  },
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
    difficulty: 'MEDIUM',
    estimatedMinutes: 11,
    topicSlugs: ['array'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'memory', 'indexing', 'static-vs-dynamic'],
  },
  {
    title: 'Data Structures: Arrays vs Linked Lists',
    url: 'https://www.youtube.com/watch?v=lC-yYCOnN8Q',
    description:
      'mycodeschool — array vs linked list em cada operação (acesso, inserção, busca) com custo explícito.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 13,
    topicSlugs: ['array'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — mycodeschool',
    tags: ['tradeoffs', 'linked-list', 'operations', 'complexity'],
  },
  {
    title: 'Implementando um hashmap do ZERO em Python',
    url: 'https://www.youtube.com/watch?v=J4ELMYEGVS0',
    description:
      'Augusto Galego — implementa uma hashmap em Python do zero: hash function, colisões, chaining.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 13,
    topicSlugs: ['array'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Augusto Galego',
    tags: ['concept', 'hashmap', 'hash-function', 'collisions', 'python'],
  },
  {
    title: 'Asymptotic Notations 101: Big O, Big Omega, & Theta',
    url: 'https://www.youtube.com/watch?v=0oDAlMwTrLo',
    description:
      'Back To Back SWE — Big O, Big Omega e Theta com a matemática por trás, não só a intuição.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 23,
    topicSlugs: ['array'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Back To Back SWE',
    tags: ['concept', 'big-o', 'big-omega', 'theta', 'asymptotic'],
  },
  {
    title: 'NeetCode 150 Ep.1: Arrays & Hashing Explained',
    url: 'https://www.youtube.com/watch?v=IiDuXLqV6e4',
    description:
      'NeetCode — 1h54min animados em arrays e hashing pra entrevista. Pode ser dividido em várias sessões na semana.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 114,
    topicSlugs: ['array'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — NeetCode',
    tags: ['concept', 'hashing', 'masterclass', 'blind75', 'interview'],
  },
  {
    title: '10 Key Data Structures We Use Every Day',
    url: 'https://blog.bytebytego.com/p/ep58-10-key-data-structures-we-use',
    description:
      'ByteByteGo — as 10 ED que todo dev bate na semana: array, hashmap, linked list, stack, queue, tree, graph, e mais.',
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 10,
    // First cross-topic item: primary = array (indexed/keyed family), cover = lists.
    // Once `tree` and `graph` are populated, add them as covers too.
    topicSlugs: ['array', 'lists'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
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
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
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
    difficulty: 'MEDIUM',
    estimatedMinutes: 18,
    topicSlugs: ['lists'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'linked-list', 'pointers', 'memory-layout'],
  },
  {
    title: 'Introduction to Doubly Linked List',
    url: 'https://www.youtube.com/watch?v=JdQeNxWCguQ',
    description:
      'mycodeschool — linked list com dois ponteiros (forward + back). Custo extra de memória vs inserção/remoção bidirecional barata.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 8,
    topicSlugs: ['lists'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
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
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'linked-list', 'insertion', 'pointers'],
  },
  {
    title: 'Introduction to Stack',
    url: 'https://www.youtube.com/watch?v=F1F2imiOJfk',
    description:
      'mycodeschool — stack (LIFO): push/pop/peek, overflow/underflow, com exemplos reais (function calls, undo, parsing).',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 9,
    topicSlugs: ['lists'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — mycodeschool',
    tags: ['concept', 'stack', 'lifo', 'push-pop'],
  },
  {
    title: 'Como Rodar uma Linked List?',
    url: 'https://www.youtube.com/watch?v=-BU34jnMasc',
    description:
      'Augusto Galego — traversal de linked list em Python: current + current.next até cair em null.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 8,
    topicSlugs: ['lists'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
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
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Augusto Galego',
    tags: ['concept', 'linked-list', 'reverse', 'leetcode-206', 'iterative'],
  },
  {
    title: 'Linked List implementation of Queue',
    url: 'https://www.youtube.com/watch?v=A5_XdiK4J8A',
    description:
      'mycodeschool — queue (FIFO) com enqueue/dequeue O(1) construída em cima de linked list.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 15,
    topicSlugs: ['lists'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
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
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
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
    topicSlugs: ['tree', 'array', 'databases'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Fireship',
    tags: ['concept', 'b-tree', 'radix-tree', 'rope', 'bloom-filter', 'cuckoo-hashing', 'fireship'],
  },
  {
    title: 'Data structures: Introduction to Trees',
    url: 'https://www.youtube.com/watch?v=qH6yxkw0u78',
    description:
      'mycodeschool — árvores do zero: terminologia (root, leaf, parent, child, depth, height), representação em memória, quando tree ganha de array/list.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 16,
    topicSlugs: ['tree'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
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
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
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
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
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
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
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
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
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
    tracks: ['BIG_TECH', 'CONSULTING_TECH'],
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
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'Book — Grokking Data Structures',
    tags: ['concept', 'book', 'grokking', 'tree', 'bst'],
  },

  // ---------------------------------------------------------------------------
  // sorting (7 items) — 2026-04-19
  // Diversified beyond the default mycodeschool anchor: Lucas Montano (BR) sets
  // up Big-O as prerequisite (cross-topic sorting+array, complements the
  // Fireship 100s Big-O in array), Augusto Galego (BR) carries the Python
  // implementation angle for merge+quick, mycodeschool covers the canonical
  // whiteboard intro/selection/quicksort-analysis, and Grokking Algorithms
  // (Bhargava) provides the illustrated book chapter.
  // ---------------------------------------------------------------------------
  {
    title: 'Big O Notation: O Pesadelo do Programador Iniciante',
    url: 'https://www.youtube.com/watch?v=GLKDo13920k',
    description:
      'Lucas Montano — Big-O em 14min. Sem esse vocabulário não dá pra comparar O(n²) vs O(n log n) nos algoritmos de sort.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 14,
    topicSlugs: ['sorting', 'array', 'foundations'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — Lucas Montano',
    tags: ['concept', 'big-o', 'complexity', 'prerequisite', 'pt-br'],
  },
  {
    title: 'Introduction to sorting algorithms',
    url: 'https://www.youtube.com/watch?v=pkkFqlG0Hds',
    description:
      'mycodeschool — por que ordenar, comparison-based vs non-comparison, primeiro contato com bubble sort. Whiteboard puro.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 9,
    topicSlugs: ['sorting'],
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
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
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
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
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
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
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
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
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
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
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
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
    topicSlugs: ['cap-consistency'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH'],
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
    tracks: ['BIG_TECH', 'CONSULTING_TECH'],
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
    tracks: ['BIG_TECH', 'CONSULTING_TECH'],
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
    tracks: ['BIG_TECH', 'COMPETITIVE_PROGRAMMING'],
    source: 'YouTube — NeetCode',
    tags: ['concept', 'hashmap', 'two-sum', 'leetcode', 'neetcode'],
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

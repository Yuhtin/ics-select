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
  topicSlug: string;
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

  // Fundamentos de Engenharia (order 20–27) — universais, tracks múltiplas
  { slug: 'databases', label: 'Databases', order: 20 },
  { slug: 'networking', label: 'Networking', order: 21 },
  { slug: 'containers', label: 'Containers', order: 22 },
  { slug: 'cloud', label: 'Cloud', order: 23 },
  { slug: 'security', label: 'Security', order: 24 },
  { slug: 'cicd', label: 'CI/CD', order: 25 },
  { slug: 'deploy', label: 'Deploy', order: 26 },
  { slug: 'observability', label: 'Observability', order: 27 },

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
      'Fireship — intro rápida do que é Redis em 100 segundos. Entry point para o tópico.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 3,
    topicSlug: 'caching',
    tracks: [],
    source: 'YouTube — Fireship',
    tags: ['concept', 'redis', 'intro', 'fireship'],
  },
  {
    title: 'Top 5 Caching Strategies',
    url: 'https://www.youtube.com/watch?v=2zIFUqTx_TU',
    description:
      'ByteByteGo — as 5 estratégias fundamentais de cache (cache-aside, read-through, write-around, write-back, write-through) com diagramas.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 9,
    topicSlug: 'caching',
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['tradeoffs', 'cache-aside', 'read-through', 'write-through', 'write-back'],
  },
  {
    title: 'Cache Systems Every Developer Should Know',
    url: 'https://www.youtube.com/watch?v=dGAgxozNWFE',
    description:
      'ByteByteGo — panorama dos sistemas de cache em uma aplicação moderna (browser, CDN, app-level, database).',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 6,
    topicSlug: 'caching',
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'cdn', 'layers', 'browser-cache'],
  },
  {
    title: 'Caching Pitfalls Every Developer Should Know',
    url: 'https://www.youtube.com/watch?v=wh98s0XhMmQ',
    description:
      'ByteByteGo — armadilhas comuns (thundering herd, cache stampede, stale data). Para quem já entendeu o básico.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 7,
    topicSlug: 'caching',
    tracks: ['BIG_TECH', 'CONSULTING_TECH'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'pitfalls', 'thundering-herd', 'stampede'],
  },
  {
    title: 'Cache Invalidation Explained',
    url: 'https://www.youtube.com/watch?v=VxeppdirKgE',
    description:
      'ByteByteGo — "There are only two hard things in Computer Science: cache invalidation and naming things." Short but dense (~90s) mental model.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 2,
    topicSlug: 'caching',
    tracks: ['BIG_TECH', 'CONSULTING_TECH'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'cache-invalidation', 'consistency'],
  },
  {
    title: 'Top Caching Strategies — ByteByteGo Blog',
    url: 'https://blog.bytebytego.com/p/top-caching-strategies',
    description:
      'Post escrito do Alex Xu cobrindo as estratégias de escrita (write-around, write-back, write-through) e leitura (cache-aside, read-through) com trade-offs.',
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 15,
    topicSlug: 'caching',
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
      'Fireship — intro rápida do PostgreSQL. Entry point pro tópico de databases.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 3,
    topicSlug: 'databases',
    tracks: [],
    source: 'YouTube — Fireship',
    tags: ['concept', 'postgresql', 'intro', 'fireship'],
  },
  {
    title: 'SQL Explained in 100 Seconds',
    url: 'https://www.youtube.com/watch?v=zsjvFFKOm3c',
    description:
      'Fireship — o que é SQL e relacional em 100 segundos. Complementar ao vídeo de PostgreSQL.',
    format: 'VIDEO',
    difficulty: 'EASY',
    estimatedMinutes: 3,
    topicSlug: 'databases',
    tracks: [],
    source: 'YouTube — Fireship',
    tags: ['concept', 'sql', 'intro', 'fireship'],
  },
  {
    title: '7 Database Paradigms',
    url: 'https://www.youtube.com/watch?v=W2Z7fbCLSTw',
    description:
      'Fireship — compara 7 paradigmas (relational, document, graph, key-value, wide-column, search, multi-model). Ideal para "qual banco usar quando?".',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 10,
    topicSlug: 'databases',
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Fireship',
    tags: ['tradeoffs', 'paradigms', 'sql', 'nosql', 'graph-db', 'key-value'],
  },
  {
    title: 'Database Index Fundamentals',
    url: 'https://www.youtube.com/watch?v=xAQga907NVU',
    description:
      'ByteByteGo — fundamentos de indexação (B-Tree, hash index, índice composto) com diagramas.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 5,
    topicSlug: 'databases',
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'index', 'b-tree', 'hash-index'],
  },
  {
    title: "99% of Developers Don't Get PostgreSQL",
    url: 'https://www.youtube.com/watch?v=P8rrhZTPEAQ',
    description:
      'The Coding Gopher — deep dive em internals do PostgreSQL: MVCC, toasted tuples, tabelas visible-only, page layout. Primeiro canal no estilo que Davi ama.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 13,
    topicSlug: 'databases',
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — The Coding Gopher',
    tags: ['concept', 'postgresql', 'mvcc', 'internals'],
  },
  {
    title: 'PostgreSQL Internal Architecture Explained',
    url: 'https://www.youtube.com/watch?v=Q56kljmIN14',
    description:
      'Hussein Nasser — 33min desmontando a arquitetura de processos do Postgres: postmaster, backend workers, shared buffers, autovacuum, WAL. Canônico.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 33,
    topicSlug: 'databases',
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Hussein Nasser',
    tags: ['concept', 'postgresql', 'architecture', 'mvcc', 'wal', 'internals'],
  },
  {
    title: 'A Deep Dive in How Slow SELECT * is',
    url: 'https://www.youtube.com/watch?v=wybjsKtA9hI',
    description:
      'Hussein Nasser — 40min mostrando por que SELECT * é caro: IO, projection, índice coverage, network. Para quem já conhece o básico de Postgres.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 40,
    topicSlug: 'databases',
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — Hussein Nasser',
    tags: ['concept', 'postgresql', 'query-performance', 'internals'],
  },
  {
    title: 'Database Indexing Strategies',
    url: 'https://blog.bytebytego.com/p/database-indexing-strategies',
    description:
      'ByteByteGo — artigo cobrindo clustered/non-clustered, covering index, composite, partial, expression-based. Complementa o vídeo de fundamentos.',
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 15,
    topicSlug: 'databases',
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'Blog — ByteByteGo',
    tags: ['concept', 'index', 'clustered', 'covering-index'],
  },
  {
    title: '8 Data Structures That Power Your Databases',
    url: 'https://bytebytego.com/guides/8-data-structures-that-power-your-databases/',
    description:
      'ByteByteGo Guide — as 8 estruturas que sustentam DBs modernos: B-Tree, LSM tree, skiplist, hash index, SSTable, bloom filter, inverted index, R-tree.',
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 12,
    topicSlug: 'databases',
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'Guide — ByteByteGo',
    tags: ['concept', 'data-structures', 'b-tree', 'lsm-tree', 'bloom-filter'],
  },
  {
    title: 'Database Pages — A Deep Dive',
    url: 'https://medium.com/@hnasr/database-pages-a-deep-dive-38cdb2c79eb5',
    description:
      'Hussein Nasser (Medium) — armazenamento físico: por que DBs usam páginas fixas, layout de row, tuple headers, slotted pages. Pairs com o vídeo do Postgres.',
    format: 'ARTICLE',
    difficulty: 'HARD',
    estimatedMinutes: 10,
    topicSlug: 'databases',
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'Medium — Hussein Nasser',
    tags: ['concept', 'pages', 'storage', 'rows', 'internals'],
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

  // 2) Items: upsert by (title, url) — find-then-update/create
  console.log(`Upserting ${ITEMS.length} library items...`);
  let created = 0;
  let updated = 0;
  for (const item of ITEMS) {
    const topicId = topicIdBySlug.get(item.topicSlug);
    if (!topicId) throw new Error(`Unknown topicSlug: ${item.topicSlug}`);

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
      topicId,
      tracks: item.tracks,
      source: item.source,
      tags: item.tags,
      createdById: admin.id,
    };

    const saved = existing
      ? await prisma.libraryItem.update({ where: { id: existing.id }, data })
      : await prisma.libraryItem.create({ data });

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

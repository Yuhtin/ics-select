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
// Topics taxonomy (31 topics across 5 buckets)
// -----------------------------------------------------------------------------

const TOPICS: TopicSeed[] = [
  // Algoritmos & Estruturas de Dados (order 0–9)
  { slug: 'arrays-hashing', label: 'Arrays & Hashing', order: 0 },
  { slug: 'linked-stack-queue', label: 'Linked Lists, Stacks & Queues', order: 1 },
  { slug: 'trees-tries-heaps', label: 'Trees, Tries & Heaps', order: 2 },
  { slug: 'graphs', label: 'Graphs', order: 3 },
  { slug: 'sorting-searching', label: 'Sorting & Searching', order: 4 },
  { slug: 'dp-recursion', label: 'Recursion, Backtracking & DP', order: 5 },
  { slug: 'greedy-math-bits', label: 'Greedy, Math & Bitwise', order: 6 },

  // Engenharia (internals) (order 10–19)
  { slug: 'eng-databases-internals', label: 'Databases — Internals', order: 10 },
  { slug: 'eng-http-networking', label: 'HTTP, TCP/IP & Networking', order: 11 },
  { slug: 'eng-containers-orchestration', label: 'Containers & Kubernetes', order: 12 },
  { slug: 'eng-cloud-basics', label: 'Cloud Fundamentals', order: 13 },
  { slug: 'eng-auth-security', label: 'Auth & Security', order: 14 },

  // System Design — Building Blocks (order 20–29)
  { slug: 'sd-load-balancers', label: 'SD — Load Balancers', order: 20 },
  { slug: 'sd-caching', label: 'SD — Caching', order: 21 },
  { slug: 'sd-sharding-replication', label: 'SD — Sharding & Replication', order: 22 },
  { slug: 'sd-queues-pubsub', label: 'SD — Queues & Pub/Sub', order: 23 },
  { slug: 'sd-cdn-dns', label: 'SD — CDN & DNS', order: 24 },
  { slug: 'sd-rate-limiting', label: 'SD — Rate Limiting', order: 25 },
  { slug: 'sd-databases-choice', label: 'SD — Databases & Storage Choice', order: 26 },

  // System Design — Concepts & Trade-offs (order 30–34)
  { slug: 'sd-scalability', label: 'SD — Scalability & Estimation', order: 30 },
  { slug: 'sd-cap-consistency', label: 'SD — CAP & Consistency', order: 31 },
  { slug: 'sd-idempotency-reliability', label: 'SD — Idempotency & Reliability', order: 32 },
  { slug: 'sd-consistent-hashing', label: 'SD — Consistent Hashing', order: 33 },

  // System Design — Infra/Ops (order 40–42)
  { slug: 'sd-serverless-cloud-native', label: 'SD — Serverless & Cloud-Native', order: 40 },
  { slug: 'sd-observability', label: 'SD — Observability', order: 41 },
  { slug: 'sd-deploy-cicd', label: 'SD — Deploy & CI/CD', order: 42 },

  // System Design — Case Studies (order 50–59)
  { slug: 'sd-case-url-shortener', label: 'SD Case — URL Shortener', order: 50 },
  { slug: 'sd-case-feeds', label: 'SD Case — Social Feeds', order: 51 },
  { slug: 'sd-case-chat', label: 'SD Case — Chat & Messaging', order: 52 },
  { slug: 'sd-case-streaming', label: 'SD Case — Video Streaming', order: 53 },
  { slug: 'sd-case-maps-rideshare', label: 'SD Case — Maps & Ride-sharing', order: 54 },
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
    estimatedMinutes: 2,
    topicSlug: 'sd-caching',
    tracks: [],
    source: 'YouTube — Fireship',
    tags: ['redis', 'caching', 'intro', 'fireship'],
  },
  {
    title: 'Top 5 Caching Strategies',
    url: 'https://www.youtube.com/watch?v=2zIFUqTx_TU',
    description:
      'ByteByteGo — as 5 estratégias fundamentais de cache (cache-aside, read-through, write-around, write-back, write-through) com diagramas.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 8,
    topicSlug: 'sd-caching',
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['caching', 'cache-aside', 'write-through', 'system-design'],
  },
  {
    title: 'Cache Systems Every Developer Should Know',
    url: 'https://www.youtube.com/watch?v=dGAgxozNWFE',
    description:
      'ByteByteGo — panorama dos sistemas de cache em uma aplicação moderna (browser, CDN, app-level, database).',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 7,
    topicSlug: 'sd-caching',
    tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
    source: 'YouTube — ByteByteGo',
    tags: ['caching', 'cdn', 'layers', 'system-design'],
  },
  {
    title: 'Caching Pitfalls Every Developer Should Know',
    url: 'https://www.youtube.com/watch?v=wh98s0XhMmQ',
    description:
      'ByteByteGo — armadilhas comuns (thundering herd, cache stampede, stale data). Para quem já entendeu o básico.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 8,
    topicSlug: 'sd-caching',
    tracks: ['BIG_TECH', 'CONSULTING_TECH'],
    source: 'YouTube — ByteByteGo',
    tags: ['caching', 'pitfalls', 'thundering-herd', 'system-design'],
  },
  {
    title: 'Cache Invalidation Explained',
    url: 'https://www.youtube.com/watch?v=VxeppdirKgE',
    description:
      'ByteByteGo — "There are only two hard things in Computer Science: cache invalidation and naming things." Deep dive nas estratégias.',
    format: 'VIDEO',
    difficulty: 'HARD',
    estimatedMinutes: 8,
    topicSlug: 'sd-caching',
    tracks: ['BIG_TECH', 'CONSULTING_TECH'],
    source: 'YouTube — ByteByteGo',
    tags: ['caching', 'cache-invalidation', 'consistency', 'system-design'],
  },
  {
    title: 'Top Caching Strategies — ByteByteGo Blog',
    url: 'https://blog.bytebytego.com/p/top-caching-strategies',
    description:
      'Post escrito do Alex Xu cobrindo as estratégias de escrita (write-around, write-back, write-through) e leitura (cache-aside, read-through) com trade-offs.',
    format: 'ARTICLE',
    difficulty: 'MEDIUM',
    estimatedMinutes: 15,
    topicSlug: 'sd-caching',
    tracks: [],
    source: 'Blog — ByteByteGo',
    tags: ['caching', 'write-through', 'cache-aside', 'system-design'],
  },
  {
    title: 'Grokking System Design — Caching (chapter)',
    url: 'https://github.com/mukul96/System-Design-AlexXu/blob/master/Grokking-the-system-design-interviewpdf-5-pdf-free%20(1).pdf',
    description:
      'Capítulo "Caching" do Grokking System Design Interview. Cobre colocação (client/CDN/app/db), políticas de eviction (LRU/LFU/FIFO) e cache distribuído. Ler apenas a seção de Caching (não o livro inteiro).',
    format: 'BOOK',
    difficulty: 'MEDIUM',
    estimatedMinutes: 20,
    topicSlug: 'sd-caching',
    tracks: ['BIG_TECH', 'CONSULTING_TECH'],
    source: 'Book — Grokking System Design Interview',
    tags: ['caching', 'book', 'grokking', 'eviction', 'system-design'],
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

---
name: picking-class-topic-from-tech-blog
description: Use when planning a class for ICS (or another interview-prep audience) and the deliverable is a structured lesson file in the Meetings tab — Study Mode + Live Mode, beats, scenarios, asker mapping. Covers picking the topic (optional, if user doesn't have one), pulling cohort knowledge, drafting beats with the no-jumps rule, and registering the lesson. Triggers — "vou dar uma aula", "preciso preparar aula sobre X", "monta uma aula", "cria roteiro de aula".
---

# Building a Class Lesson

## What this skill produces

A typed `Lesson` file at `apps/web/components/admin/meetings/lessons/<slug>.ts`, registered in `apps/web/components/admin/meetings/meetings-index.ts`. Once registered, it renders automatically at `/admin/meetings/<slug>` with two modes:

- **Study Mode** — sidebar nav, 3 toggle-able passes (Overview / Deep dive / Mastery) for solo prep
- **Live Mode** — 11-beat stepper + focus card with anchor question, asker mapping with cohort names, 3 response scenarios (🟢 Acertou / 🟡 Tá quase / 🔴 Passou longe), pegadinhas, provocação, default forward

You do not write any HTML or React. The system renders the data structure.

## When to use

User says things like "vou dar uma aula de X", "monta a aula sobre Y", "preciso preparar essa class".

## When NOT to use

- User just wants to summarize a tech blog post (not turn it into a class) — just summarize
- User already has a written lesson and wants formatting changes — skip the workflow, edit directly
- User wants to research a topic in general — use plain web research

---

## Workflow

### Step 1 — If the topic isn't picked yet, mine a tech blog

Skip if user already has the topic. If they want to pick a real-world engineering blog post as the spine of the class:

**List recent posts.** Most major engineering blogs are on Medium (Netflix, Uber, Airbnb, Lyft, Pinterest, Dropbox, Capital One). Medium archive pages are JS-rendered — scraping them returns empty. Reliable sources, in order:

1. **RSS** at `<blog-url>/feed` — last ~10 posts with exact dates.
   ```python
   import re
   items = re.findall(r'<item>(.*?)</item>', content, re.DOTALL)
   for it in items:
       t = re.search(r'<title><!\[CDATA\[(.*?)\]\]></title>', it)
       d = re.search(r'<pubDate>(.*?)</pubDate>', it)
       print(f'{d.group(1)} | {t.group(1)}')
   ```

2. **WebSearch** with `site:<blog>.com <year> <month-words>` — fills in older posts. Run 3-4 parallel quarter buckets. Dates are approximate.

3. **WebFetch** — try `.medium.com` subdomain if the bare domain fails TLS. Works for non-Medium blogs directly.

**Filter for interview transferability.** Keep posts that touch a transferable primitive: caching, replication, indexing, load balancing, hashing, queuing, consensus, batching, partitioning, fan-out, ordering. Drop posts that are domain-specific to the company's product (video codecs at Netflix, ride-matching at Uber, search relevance at Airbnb), process/culture posts, or that assume prior knowledge the audience doesn't have.

**Sketch the concept tree** for the top 2-3 finalists. ~3-4 levels of indented markdown. Every leaf should terminate at a canonical CS primitive (hash function, big-O, tree DS), not at "another big topic". If multiple branches each warrant their own class, the post is a whole course, not aula 1.

**Recommend with rationale.** Present concept tree per finalist, one-line trade-off, single pick justified by boundedness — not by hype.

### Step 2 — Confirm structure with the user

Before authoring, confirm:

- **How long is the class?** (90 min default → 8-12 beats; 60 min → 6-8; 120 min → 12-15)
- **One arc or comparative?** Single case (depth) or two cases contrasted via a pivot (better for "same primitives, different profile" lessons like URL Shortener × Chat)
- **Foundations needed?** Concepts the room hasn't seen that the class needs to "teach from zero" before the beats start (e.g., capacity estimation, load balancers basics, message queues basics)
- **Audience track and cycle** (e.g., Hot Stuff, Big Tech, week 3) — feeds into estimating depth and naming the audience field

### Step 3 — Pull the cohort knowledge map

This is the crucial step that makes the lesson personal. Before writing any beat, you need to know **who studied what** so you can assign the right asker per beat.

**Confirm prod-read with the user** if not already authorized. Then run:

```sql
WITH cohort AS (
  SELECT u.id, u.name
  FROM "User" u
  JOIN "CycleMembership" m ON m."userId" = u.id
  WHERE m."cycleId" = '<active-cycle-id>'
),
done AS (
  SELECT wpi.id, wp."userId", wpi."libraryItemId"
  FROM "WeeklyPlanItem" wpi
  JOIN "WeeklyPlan" wp ON wp.id = wpi."weeklyPlanId"
  WHERE wp."cycleId" = '<active-cycle-id>'
    AND wpi.outcome IN ('DONE_EASY','DONE_HARD','DOUBTS','SKIPPED')
),
done_topics AS (
  SELECT DISTINCT d."userId", t.slug
  FROM done d
  JOIN "LibraryItemTopic" lit ON lit."itemId" = d."libraryItemId"
  JOIN "Topic" t ON t.id = lit."topicId"
)
SELECT c.name,
  COUNT(*) FILTER (WHERE dt.slug = '<topic-1>') AS t1,
  COUNT(*) FILTER (WHERE dt.slug = '<topic-2>') AS t2,
  ...
FROM cohort c
LEFT JOIN done_topics dt ON dt."userId" = c.id
GROUP BY c.id, c.name ORDER BY c.name;
```

List the topics that matter for the class (e.g., for system design: `hashmap, databases, caching, sharding, replication, load-balancers, networking, message-queues, pubsub, scalability`, plus any `case-*` topics).

The output gives you the matrix `member × topic`. From it, identify:

- **Specialists** — members with unique coverage (only one with `pubsub` → they own the fan-out beat)
- **Strong voices** — members with 2+ relevant topics
- **Everyone-knows-this** — topics 80%+ have studied → safe pra cold-call qualquer um
- **Gaps** — topics nobody studied → these MUST be taught from zero, not cold-called

Save this matrix in your scratch notes. Each beat's `askWho` will be derived from it.

### Step 4 — Draft beats one at a time

For EACH beat, complete every field of `LessonNode`. The contract is:

```ts
{
  id: string,              // kebab-case: 'url-cache', 'chat-fanout'
  label: string,           // short title for sidebar + stepper
  group: NodeGroup,        // 'foundations' | <case-a-slug> | 'pivot' | <case-b-slug> | 'synthesis'
  beat?: number,           // 1..N for beats; omit for foundations/synthesis (study-only)
  teachFromZero?: boolean, // true if the room hasn't seen this — mark explicitly
  oneLine: string,         // 1 sentence; appears as subtitle in both modes
  pass1: string,           // Overview, 1 short paragraph (~60 words). What this beat is about.
  pass2: string,           // Deep dive, 3-5 short paragraphs. Use \n\n between paragraphs and **bold** for key terms.
  pass3: Pegadinha[],      // 3-5 mastery pegadinhas: { gotcha: string, note: string }
  anchor: string,          // The anchor question, in your voice as facilitator. Will display in quotes.
  askWho: Asker[],         // 1-2 cohort members with name + 1-line justification
  followup: string,        // Default forward question for after this beat
  gotcha: string,          // A provocation YOU throw if the room engages too easily
  scenarios: {             // The 3 response cards in Live Mode
    right:  { shape: string, redirect: string },
    close:  { shape: string, redirect: string },
    wayOff: { shape: string, redirect: string },
  }
}
```

For `group`, pick a slug for each "section" of the class. Then update `GROUP_META` in `apps/web/components/admin/meetings/group-meta.ts` to give the new group its color + label, OR reuse an existing group if it fits semantically.

### Writing voice

**Body content (pass1, pass2)** is read in sans-serif. Don't write like a paper. Write like a clear, concrete teacher.

- **Don't be prolix.** No "It is important to note that...", no "in conclusion", no padding. Lead with the point.
- **Don't strip too much.** Keep articles. Keep examples. The humanizer pattern of cutting "the/a/an" makes text robotic — don't do it.
- **Use concrete numbers.** "100M URLs/month", "20k QPS at peak", "p99 < 100ms" — not "high volume" or "low latency".
- **Use bold for terms** that name a concept the first time it appears in the deep dive (`**read-through cache**`, `**consistent hashing**`).
- **Split deep dives** into 3-5 short paragraphs separated by `\n\n`. Each paragraph covers ONE idea. Sub-headers via bold-prefix work well (`**Volume e proporção**: ...`).
- **Pt-BR for member-facing voice**; English for technical terms when canonical (the system design vocabulary IS in English).

### The no-jumps rule (most important)

The class is **sequential**. By the time the room reaches beat N, they have seen beats 1..N-1 and nothing else. Every beat's content must obey this constraint.

For each beat, before writing, list **what the room knows by now** — the union of concepts introduced in previous beats plus declared foundations. While writing, refuse to reference anything outside that set.

Concrete checks before saving:

- pass1/pass2/pass3: any product name (Postgres, Redis, Kafka, Cassandra) mentioned BEFORE the beat that picks the storage / queue / cache? If yes, either rephrase ("the database", "a key-value store") or move the content to the correct beat.
- scenarios.right.shape: are you describing a "right answer" that uses concepts the room hasn't met yet? The answer needs to be reachable from what they already have.
- scenarios.right.redirect / followup: forward-reference to NEXT beat is OK (that's the bridge). Forward-reference to beat N+3 is not.
- Beat 6 of URL Shortener × Chat originally said "Pra contraste com Chat (beat 11): URL shard por hash(key) é stateless. Chat shard por hash(conv_id) é stateful." — that's the kind of jump to catch. The contrast is the TOPIC of beat 11. Cut it from beat 6.

After drafting all beats, do one explicit pass: read each beat's content and ask "is there anything here that the room couldn't know yet?". This is the single most valuable QA step.

### Authoring `askWho`

Each beat's `askWho` must reference real members from the cohort knowledge map. Two patterns:

- **Specialist beat** — 1 name, justification cites unique coverage. Example: "Maria Clara — única com `pubsub` na bagagem. Esse é O beat dela."
- **Distribute voice** — 2-3 names from a group that all studied the prereq. Example: "Lucas, Cauan, Julia — todos com `hashmap`. Roda voz."
- **Open floor** — use `name: 'open'` when the question is intro-level or transition (no specialist needed). The justification explains why opening makes sense.

The justification should be specific to what that person studied, not generic. "Tem hashmap" is useful; "is smart" is not.

### Authoring scenarios

This is where the live mode earns its keep. For each beat, write the 3 response cards as if you're imagining 3 specific students:

- 🟢 **right** — what does the on-target answer LOOK like? (Not "they answered correctly" — describe the shape: which concepts they named, which tradeoff they articulated.) The `redirect` is how you advance to the next beat after they nailed it.
- 🟡 **close** — the classic close-but-wrong (they got 70% but missed something specific). The `redirect` is the question that completes their thought, doesn't give them the answer.
- 🔴 **wayOff** — the classic categorically-wrong answer (different framing entirely — e.g. proposing UUID when asked about base62, or "use a Set in memory" when asked about distributed unique check). The `redirect` does NOT correct directly — it asks a follow-up question that exposes the contradiction.

The `redirect` should always be question-based, not "explain X". Keep facilitation Socratic.

### Step 5 — Build foundations + synthesis nodes

**Foundations** (group = 'foundations', no `beat`):
- Concepts everyone needs but that the room hasn't seen — `teachFromZero: true`
- Lives only in Study Mode (Live Mode skips nodes without a beat)
- Pass 1 explains what + why; pass 2 explains how concretely; pass 3 lists common gotchas

**Synthesis** (group = 'synthesis', no `beat`):
- The closing reflection — what changed, what stayed
- Comparative lessons benefit most; single-arc may not need it

### Step 6 — Save + register

1. Create `apps/web/components/admin/meetings/lessons/<slug>.ts` — import `Lesson` from `'../lesson-types'` and export the typed const.
2. Open `apps/web/components/admin/meetings/meetings-index.ts` and add:
   ```ts
   import { <yourLesson> } from './lessons/<slug>';
   const LESSONS: Record<string, Lesson> = {
     ...,
     [<yourLesson>.slug]: <yourLesson>,
   };
   ```
3. If you added a new group, update `apps/web/components/admin/meetings/group-meta.ts` with its label, eyebrow text, accent class, and ring class.
4. Run `pnpm --filter @ics-select/web exec tsc --noEmit` from `apps/web` to verify the file typechecks.

The Meetings index at `/admin/meetings` will auto-list the new lesson. `/admin/meetings/<slug>` renders both modes.

### Step 7 — Visual check

Boot dev (`pnpm --filter @ics-select/web dev`), log in, and walk the lesson:

- Toggle Study Mode → click through 3 passes per node → confirm content reads naturally
- Toggle Live Mode → step through every beat → confirm the focus card is scannable in 5s and the scenarios match the moment

If anything reads dense or jumps ahead, fix it before reporting done.

---

## Output template at the END of step 1 (topic mining)

If you ran topic mining, your reply includes:

1. **Full list of posts found** (table: date | title), grouped by year, finalists in bold
2. **Tier ranking** of top 5-8 by interview transferability (S/A/B tiers)
3. **Concept tree** for top 2-3 finalists (indented markdown)
4. **Recommendation** — single pick + 2-3 sentence justification under boundedness
5. **Sources** with hyperlinks

Then ask the user the structure questions from Step 2 before proceeding to author.

## Common mistakes

- **Picking the most exciting post.** "Distributed graph at internet scale" sounds amazing, but its tree fans into Cassandra + Kafka + replication — three classes' worth of dependencies. Run over time, finish nothing.
- **Picking teacher-cool but learner-cold.** SIMD intrinsics are gorgeous but assume the audience touched JIT/assembly. Aula 1 should land in territory the room can already half-see.
- **Skipping the cohort query.** You'll write generic `askWho: { name: 'someone with experience' }` placeholders that defeat the entire point of the format. Pull the matrix, USE it.
- **Skipping the no-jumps audit.** Easy to slip "uses Redis SETNX" into beat 3 when storage is beat 4. Read every beat in order before saving.
- **Writing pass2 as one giant paragraph.** Sans-serif body needs 3-5 short paragraphs separated by `\n\n` with bold headers — otherwise it's a wall.
- **Trusting Medium HTML.** Archive pages and `/all` are JS-rendered. RSS + WebSearch is the only reliable path.

## Quick reference

| Need | Tool | Notes |
|---|---|---|
| Last ~10 posts with exact dates | `curl <blog>/feed` + parse `<item>` | Most reliable |
| Posts older than ~10 most recent | `WebSearch site:<blog>.com <year>` | Run 3-4 quarter-buckets in parallel |
| Single post details | `WebFetch <blog>.medium.com/<slug>` | Use `.medium.com` if bare domain fails TLS |
| Cohort knowledge | SQL on prod DB | Confirm prod-read with user first |
| Test typecheck | `pnpm exec tsc --noEmit` | From `apps/web` |

## File locations cheat sheet

| What | Where |
|---|---|
| Lesson data | `apps/web/components/admin/meetings/lessons/<slug>.ts` |
| Index registry | `apps/web/components/admin/meetings/meetings-index.ts` |
| Lesson types | `apps/web/components/admin/meetings/lesson-types.ts` |
| Group colors/labels | `apps/web/components/admin/meetings/group-meta.ts` |
| Study Mode component | `apps/web/components/admin/meetings/study-mode.tsx` |
| Live Mode component | `apps/web/components/admin/meetings/live-mode.tsx` |
| Page routes | `apps/web/app/(admin)/admin/meetings/` |

## Reference example

See `apps/web/components/admin/meetings/lessons/url-shortener-vs-chat.ts` for a complete worked example: 14 nodes (1 foundation + 6 URL beats + 1 pivot + 4 chat beats + 1 synthesis), 11 beats numbered, asker mapping derived from the Hot Stuff cohort knowledge query.

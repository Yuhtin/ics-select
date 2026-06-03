---
name: picking-class-topic-from-tech-blog
description: Use when planning a class for ICS (or another interview-prep audience) and the deliverable is a structured lesson file in the Meetings tab — Study Mode + Live Mode, beats, scenarios, asker mapping. Covers picking the topic (optional, if user doesn't have one), pulling cohort knowledge, drafting beats with the no-jumps rule, and registering the lesson. Triggers — "vou dar uma aula", "preciso preparar aula sobre X", "monta uma aula", "cria roteiro de aula".
---

# Building a Class Lesson

## What this skill produces

A typed `Lesson` file at `apps/web/components/admin/meetings/lessons/<slug>.ts`, registered in `apps/web/components/admin/meetings/meetings-index.ts`. Once registered, it renders automatically at `/admin/meetings/<slug>` with two facilitator views, an export menu, and an optional student-facing slide deck:

- **Study Mode** — sidebar nav, 3 toggle-able passes (Overview / Deep dive / Mastery) for solo prep. Tags chips per beat, diagram image if present.
- **Live Mode** — beat stepper + focus card with anchor question, top-3 asker mapping with cohort names, 3 response scenarios (Acertou / Tá quase / Passou longe), pegadinhas, provocação, default forward, diagram image.
- **Exportar menu** — dropdown on both tabs with Slides PDF + Material PDF (uses the print() flow on the slide deck HTML and the existing PrintView).
- **Slides (optional)** — a self-contained HTML deck at `apps/web/public/slides/<slug>.html` for student-facing presentation. Different audience from the Study/Live modes, different design rules.

You do not write any HTML or React for the lesson page itself. The system renders the typed data structure. If you add slides, you write the deck HTML by hand (or copy the deploy-journey.html template).

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

### Required structural beats — every lesson has these

Two beats are **mandatory and come at the end**, right before synthesis. They make the lesson concrete and deployable instead of academic:

**1. Architecture: o fluxo completo** — the second-to-last beat. Walks the full request flow as prose: from the user's browser through every layer (DNS, CDN, load balancer, compute, cache, primary store, cold storage, async paths) until the response or delivery comes back. Always separates **read path** from **write path** because the asymmetry between them is often the design's key insight. Mentions where state lives, where early-exits happen, and where the heavy lifting actually concentrates. The anchor question is typically "request entra. Desenha CADA camada que ela atravessa." The asker is usually whoever has the deepest mental model of the full stack (look for cache + database + replication in the cohort knowledge map).

**2. AWS: managed services por camada** — the last beat before synthesis. Maps each box of the architecture diagram to a specific AWS managed service, with concrete tradeoffs (Lambda vs EC2, DynamoDB vs RDS, NLB vs ALB, MSK vs SQS, CloudFront vs nothing). Always use **AWS** as the cloud (project default). The pedagogical point is that managed-service choice is dictated by the load profile, not by personal familiarity — Lambda fits write-rare + stateless workloads, EC2 with ASG fits persistent connections, etc.

For both, the standard fields apply (oneLine, pass1, pass2, pass3, anchor, askWho, followup, gotcha, scenarios). The architecture beat's followup naturally bridges into the AWS beat ("OK, diagrama no quadro. Pra cada caixa, qual managed service?"). The AWS beat's followup bridges into synthesis ("Quais escolhas mudaram em comparação com sistemas de perfil oposto?").

Both beats reference and synthesize the design decisions from the earlier beats — they're integration moments, not new content. If you find yourself introducing a new concept in either beat that should have been covered earlier, escalate to revise the earlier beats instead.

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
  group: NodeGroup,        // 'foundations' | <section-slug> | 'pivot' | 'synthesis' | one of: 'local','containers','cloud','scale','devops','infra'
  beat?: number,           // 1..N for beats; omit for foundations/synthesis (study-only)
  teachFromZero?: boolean, // true if the room hasn't seen this concept before, mark explicitly
  tags?: string[],         // 4-8 terms introduced in this beat (kebab-case). Shown as chips in both modes. Tags help the teacher seed vocabulary and signal what's about to come.
  oneLine: string,         // 1 sentence; appears as subtitle in both modes
  pass1: string,           // Overview, 1 short paragraph (~60 words). What this beat is about.
  pass2: string,           // Deep dive, 3-5 short paragraphs. Use \n\n between paragraphs and **bold** for key terms.
  pass3: Pegadinha[],      // 3-5 mastery pegadinhas: { gotcha: string, note: string }
  anchor: string,          // The anchor question, in your voice as facilitator. Will display in quotes.
  askWho: Asker[],         // EXACTLY 3 cohort members ranked by relevance + 1-line justification each. See "Authoring askWho" below.
  followup: string,        // Default forward question for after this beat
  gotcha: string,          // A provocation YOU throw if the room engages too easily
  scenarios: {             // The 3 response cards in Live Mode
    right:  { shape: string, redirect: string },
    close:  { shape: string, redirect: string },
    wayOff: { shape: string, redirect: string },
  },
  diagram?: string,        // Optional Mermaid source. Used as a fallback when no diagramUrl is set. Stored in the .ts file for version control.
  diagramUrl?: string,     // Optional path under /public to a rendered diagram PNG (e.g. '/diagrams/<slug>/<beat-id>.png'). Takes precedence over `diagram` for rendering. Generate with the excalidraw-skill workflow (see "Step 5 - Generate diagrams" below).
}
```

For `group`, pick a slug for each "section" of the class. Then update `GROUP_META` in `apps/web/components/admin/meetings/group-meta.ts` to give the new group its color + label, OR reuse an existing group if it fits semantically. The current palette covers: `foundations` (slate), `url`/`chat`/`pivot` (URL × Chat lesson colors), `synthesis` (emerald), `local` (blue), `containers` (cyan), `cloud` (orange), `scale` (warn), `devops` (green), `infra` (reflect/purple).

### Writing voice (apply the humanizer skill mindset)

**Body content (pass1, pass2)** is read in sans-serif. Don't write like a paper. Write like a clear, concrete teacher.

- **No em dashes.** Use commas, periods, or parentheses instead. Em dashes are the most obvious AI tell.
- **No robotic imperatives** in subtitles or anchors. "Liste, em ordem..." sounds like a prompt. "Em que ordem?" sounds like a person asking.
- **No "Não é X, é Y" negative parallelism.** Direct framing is better: "A pergunta certa é Y."
- **No passive voice for choices.** "É guiada pelo perfil de carga" sounds AI. "O que manda é o perfil de carga" sounds human.
- **No filler phrases** like "exatamente o que vem depois", "vale destacar que", "é importante notar".
- **No AI vocabulary**: stands as, serves as, delve, pivotal, crucial, underscore, highlight, intricate, tapestry, fostering, showcasing.
- **No emojis** anywhere in the lesson data. The project uses lucide-react icons (CLAUDE.md rule). Even compare-card "category" emojis violate this.
- **Don't be prolix.** No "It is important to note that...", no "in conclusion", no padding. Lead with the point.
- **Don't strip too much.** Keep articles. Keep examples. Cutting "the/a/an" makes text robotic, don't do it.
- **Use concrete numbers.** "100M URLs/month", "20k QPS at peak", "p99 < 100ms" instead of "high volume" or "low latency".
- **Use bold for terms** that name a concept the first time it appears in the deep dive (`**read-through cache**`, `**consistent hashing**`).
- **Split deep dives** into 3-5 short paragraphs separated by `\n\n`. Each paragraph covers ONE idea. Sub-headers via bold-prefix work well (`**Volume e proporção**: ...`).
- **Pt-BR for member-facing voice.** English for technical terms when canonical (system design vocabulary IS in English).

Before saving any lesson, scan the file for `—` (U+2014). If you find one, replace with comma, period, or parens. This applies to lesson data AND slide deck HTML AND your own commit messages.

### Writing hooks (anchor + oneLine + subtitle)

The anchor question is the single most important sentence in the beat. It's what the teacher reads out loud. The student looks at it and has to know **what direction to start thinking**.

**The pattern that works**: a concrete ACTION the student takes + a specific TRIGGER or constraint + a DIRECTED question that names the kind of answer expected.

- **Bad (abstract)**: "O que é uma porta?" The student doesn't know if you want a definition, an example, an analogy, or a use case.
- **Good (action + trigger + direction)**: "Você aperta Enter em `npm run dev`. O que acontece até `localhost:3000` responder?" The student can mentally simulate the sequence.

More examples of the shift:

| Abstract (avoid) | Action + trigger + direction (use) |
|---|---|
| "O que é um container?" | "Você roda `docker run` no Mac. Seu colega no Linux. Mesmo comportamento. Como?" |
| "Cada linha do Dockerfile vira uma camada cacheada." (declarative) | "Você muda uma linha de TypeScript e roda `docker build` de novo. O que precisa rodar?" |
| "Por que SSM Parameter Store?" | "Seu container em produção precisa da senha do banco. Não pode commitar. Não pode env var. De onde ele lê?" |
| "EC2 vs ECS?" | "Seu Dockerfile funciona local. Você quer subir na AWS. EC2 ou ECS?" |
| "Qual banco usar?" | "O projeto da EJ começa amanhã. Qual banco você sobe primeiro, e por quê?" |

The **subtitle** (oneLine for hooks, when present in the slide deck) names the direction the answer should take. "Liste em ordem", "Compare X e Y", "Justifique pelo perfil de carga". Keep it one short sentence.

If you find yourself writing an anchor like "O que é X?" or "Por que X?", stop. Find the action a student would take that surfaces X, and frame the question around that action.

### The no-jumps rule (most important)

The class is **sequential**. By the time the room reaches beat N, they have seen beats 1..N-1 and nothing else. Every beat's content must obey this constraint.

For each beat, before writing, list **what the room knows by now** — the union of concepts introduced in previous beats plus declared foundations. While writing, refuse to reference anything outside that set.

Concrete checks before saving:

- pass1/pass2/pass3: any product name (Postgres, Redis, Kafka, Cassandra) mentioned BEFORE the beat that picks the storage / queue / cache? If yes, either rephrase ("the database", "a key-value store") or move the content to the correct beat.
- scenarios.right.shape: are you describing a "right answer" that uses concepts the room hasn't met yet? The answer needs to be reachable from what they already have.
- scenarios.right.redirect / followup: forward-reference to NEXT beat is OK (that's the bridge). Forward-reference to beat N+3 is not.
- Beat 6 of URL Shortener × Chat originally said "Pra contraste com Chat (beat 11): URL shard por hash(key) é stateless. Chat shard por hash(conv_id) é stateful." — that's the kind of jump to catch. The contrast is the TOPIC of beat 11. Cut it from beat 6.

After drafting all beats, do one explicit pass: read each beat's content and ask "is there anything here that the room couldn't know yet?". This is the single most valuable QA step.

### Authoring `askWho` (always top-3 ranked)

Each beat's `askWho` must list **exactly 3 cohort members** ranked by relevance to that beat. The UI shows them as a numbered list (1, 2, 3) and the Overview pass shows them as `(Name1, Name2, Name3)`. The teacher uses position 1 first, falls back to 2 and 3 if needed.

Ranking rules:

1. **Specialist first.** If someone uniquely studied the topic (e.g., the only person with `containers`), they're position 1. Justification cites the unique coverage.
2. **Then breadth of relevant coverage.** Positions 2-3 go to members with the most adjacent topics studied. If beat is about secrets, prefer people who studied `security` over people who studied only `databases`.
3. **Fallback to general breadth.** If nobody studied the topic, fill positions 1-3 with the cohort members who have the most overall topic coverage. Their justification names what they DO have plus framing like "maior breadth do cohort" or "background técnico amplo".
4. **Open floor only as last resort.** Use `name: 'open'` with a justification when the question is genuinely intro-level and no one's prior knowledge gives them an edge.

The justification must be specific. Good: "Networking estudado, de longe quem mais cobriu o tema. Começa com ele." Bad: "É inteligente". Bad: "Estuda bastante".

Don't pad the list. If the cohort matrix only gives 2 strong candidates, the third can be open floor with explicit rationale ("Pergunta aberta ao grupo, nessa área ninguém estudou ainda, ver quem se arrisca").

### Authoring scenarios

This is where the live mode earns its keep. For each beat, write the 3 response cards as if you're imagining 3 specific students:

- 🟢 **right** — what does the on-target answer LOOK like? (Not "they answered correctly" — describe the shape: which concepts they named, which tradeoff they articulated.) The `redirect` is how you advance to the next beat after they nailed it.
- 🟡 **close** — the classic close-but-wrong (they got 70% but missed something specific). The `redirect` is the question that completes their thought, doesn't give them the answer.
- 🔴 **wayOff** — the classic categorically-wrong answer (different framing entirely — e.g. proposing UUID when asked about base62, or "use a Set in memory" when asked about distributed unique check). The `redirect` does NOT correct directly — it asks a follow-up question that exposes the contradiction.

The `redirect` should always be question-based, not "explain X". Keep facilitation Socratic.

### Step 5 — Build foundations + synthesis nodes

**Foundations** (group = 'foundations', no `beat`):
- Concepts everyone needs but that the room hasn't seen, `teachFromZero: true`
- Lives only in Study Mode (Live Mode skips nodes without a beat)
- Pass 1 explains what + why; pass 2 explains how concretely; pass 3 lists common gotchas

**Synthesis** (group = 'synthesis', no `beat`):
- The closing reflection, what changed, what stayed
- Comparative lessons benefit most; single-arc may not need it

### Step 6 — Generate diagrams (optional but expected)

If your beats reference architecture (and most should), generate diagrams instead of leaving long captions.

**Two-tier rendering on the lesson page**: the `LessonNode` has `diagram?: string` (Mermaid source) and `diagramUrl?: string` (path to a rendered PNG). If `diagramUrl` is set, it takes precedence. Mermaid is the version-controlled source that always travels with the lesson; PNG is the polished render.

**Use the `excalidraw-skill`** for diagram generation. Quick summary of the workflow it documents:

1. Start the canvas server in Docker: `docker run -d --name excalidraw-canvas -p 3002:3000 node:20-alpine sh -c "apk add --no-cache git && git clone https://github.com/yctimlin/mcp_excalidraw /app && cd /app && npm ci && npm run build && HOST=0.0.0.0 PORT=3000 npm run canvas"`
2. Wait for it to boot (~60s), then `curl http://localhost:3002/health` should return healthy.
3. Open the canvas with Playwright (`browser_navigate` to `http://localhost:3002`). The browser needs to be open for `POST /api/export/image` to work.
4. For each beat with `diagram`:
   - `DELETE /api/elements/clear`
   - `POST /api/elements/batch` with elements (rectangles, arrows, text). Use the helper functions from the deploy-journey diagrams script as a template.
   - `POST /api/export/image` with `{format: 'png', padding: 60}`, save base64 to `apps/web/public/diagrams/<slug>/<beat-id>.png`.
5. Set `diagramUrl: '/diagrams/<slug>/<beat-id>.png'` on the beat.

**AWS service icons** (for the architecture and AWS-services synthesis beats): the cloudflightio/architecture-icons repo on the `master` branch has PNG icons for every AWS service.
- Base URL: `https://raw.githubusercontent.com/cloudflightio/architecture-icons/master/aws-icons/Architecture-Service/<Category>/<ServiceName>.png`
- Categories you'll need: Compute, Containers, Networking-Content-Delivery, Database, Management-Governance, Security-Identity-Compliance
- To embed an icon in a diagram, the Excalidraw server's `image` element type works, but the canvas browser needs the file data injected via `window.__excalidrawAPI.addFiles([...])`. Use Playwright `addScriptTag` to load a JS file that sets `window.__awsIcons`, then `browser_evaluate` to call `addFiles`. The detailed pattern is in the excalidraw-skill.

**Use external reference images for canonical diagrams.** Some diagrams (Container vs VM architecture stack, OSI layers, generic CAP theorem) are better as classic industry images than as custom drawings. Save those under `apps/web/public/diagrams/<slug>/external/<name>.png` to keep them separate from generated diagrams, and reference them the same way via `diagramUrl`.

**Always render the slide and look at it before committing an external image.** The `diagramFull` template renders inside `bg-neutral-950` with `filter: brightness(0.95)` — any image that already has a dark background (screenshots from dev.to dark mode, diagrams with black canvases) goes invisible. `file` and `sips` saying "valid PNG, 800×264" doesn't mean it's readable; if you can't visualize the PNG directly, render the slide page and screenshot it. If it's illegible, either find a brighter source or redraw in Excalidraw — don't ship and hope.

**Diagram quality checklist before exporting**: no overlapping arrow labels (use shorter labels or remove on fan-outs), at least 300px between boxes on horizontal layouts, text in boxes fits the box width, kernel/base layers wider than the elements above them.

### Step 7 — Build the slide deck (optional, for in-class presentation)

Study Mode and Live Mode are **facilitator-facing**. They contain askWho, scenarios, gotchas, the stuff a teacher needs but a student should never see. If you want a deck the students see during class, build a separate HTML slide deck.

Output: `apps/web/public/slides/<slug>.html`, then set `slidesUrl: '/slides/<slug>.html'` on the `Lesson` (top-level field, not on a node). The lesson page exposes a "Slides · apresentar" button and the Exportar menu picks it up automatically.

#### Step 7.0 — Pick the brand visual style FIRST (mandatory before writing any HTML)

Every deck adopts the visual identity of a real company, pulled from the **awesome-design-md** repo (`github.com/VoltAgent/awesome-design-md`). It holds 72 brand `DESIGN.md` specs (exact palette, typography, radius, shadow, signature traits). Before you write a single slide, **choose the brand whose identity best fits THIS class**, fetch its spec, and build the deck's design tokens from it. This replaces the default deploy-journey look (Geist + blue) with a deliberate, topic-matched aesthetic.

**How to pick.** Match the brand to the lesson's subject, in priority order:

1. **The class IS about that company.** A LedgerStore class → `uber`. A Stripe-payments or idempotency class → `stripe`. A Spotify recommendation class → `spotify`. The strongest possible match: the deck wears the brand it studies.
2. **The class is about that company's domain.** Fintech / money / ledger with no single company → `stripe`, `wise`, `coinbase`, `mastercard`, `revolut`, `binance`, `kraken`. Databases / backend → `supabase`, `mongodb`, `clickhouse`, `sentry`, `posthog`, `hashicorp`. AI / ML → `claude`, `openai`-adjacent (`cohere`, `mistral`, `elevenlabs`, `runway`), `together`. Dev tooling / DX → `vercel`, `linear`, `raycast`, `warp`, `cursor`. Design / frontend → `figma`, `framer`, `webflow`, `linear`.
3. **Fallback by mood.** Clean editorial / neutral system-design class → `linear`, `vercel`, `notion`, `apple`. Bold / high-energy → `nike`, `spacex`, `tesla`, a supercar brand (`ferrari`, `lamborghini`, `bugatti`, `bmw-m`).

**Full brand list (folder names under `design-md/`):**
`airbnb, apple, airtable, binance, bmw, bmw-m, bugatti, cal-com, claude, clay, clickhouse, coinbase, cohere, composio, cursor, dell-1996, elevenlabs, expo, ferrari, figma, framer, hashicorp, hp, ibm, intercom, kraken, lamborghini, linear, lovable, mastercard, meta, minimax, mintlify, miro, mistral, mongodb, nike, notion, nvidia, ollama, opencode, pinterest, playstation, posthog, raycast, renault, replicate, resend, revolut, runway, sanity, sentry, shopify, spacex, spotify, starbucks, stripe, superhuman, supabase, tesla, the-verge, together, uber, vercel, vodafone, voltagent, warp, webflow, wired, wise, xai`
(If a slug 404s, list the folder via `https://api.github.com/repos/VoltAgent/awesome-design-md/contents/design-md` and match the exact name.)

**Fetch the spec:**
```bash
curl -s "https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md/<brand>/DESIGN.md"
```

**Apply it.** Read the spec and translate it into the deck's CSS custom properties / Tailwind config: page bg, surface, ink/text hierarchy, the ONE accent (many brands, like Uber, deliberately have none — respect that), display + body font families (load via Google Fonts `<link>`, or the closest available substitute when the brand ships a proprietary face like UberMove → use Inter/Geist tight 700), border-radius signature (Uber = 999px pills, 16px cards), and shadow/elevation rules. Honor the brand's do's/don'ts: if the spec says "no second accent color" or "no shadows, flat by default," follow it. The `GROUP` accent map in the deck JS should be re-tinted to the brand palette, not the generic blue/cyan/orange.

**State your pick to the user** with a one-line rationale ("Deck no estilo Uber, porque a aula é o case do LedgerStore deles") before building, and note any substitution you made (proprietary font → fallback).

**Use `apps/web/public/slides/deploy-journey.html` as the structural template** (slide types, navigation, print CSS, animations). It's self-contained: Tailwind CDN, fonts loaded inline, no React, no build step. **Keep its structure, swap its design tokens** for the brand you chose in Step 7.0.

Structure per beat (3 slides each on average): **hook** (the action-trigger-question pattern) → **support** (code | compare | list) → **diagram** (the PNG you generated in step 6). Plus section dividers between groups and a closing recap. A 13-beat lesson becomes ~30-40 slides.

Available slide types in the template:
- `cover` — title, audience meta, accent rail
- `divider` — big colored numeral + section name + one-sentence intro
- `hook` — large title with the question, optional subtitle, tags chips
- `hookBig` — same as hook but bigger title (for synthesis beats)
- `diagram` — title + PNG, image takes ~60% of viewport
- `diagramFull` — image takes ~75% of viewport, minimal text (used for the synthesis architecture and AWS map slides)
- `code` — syntax-highlighted code block (purple keywords, amber strings, gray comments) with right-side annotations
- `list` — numbered items (e.g., "5 camadas de diferença") with kw + supporting text
- `compare` — 2-up cards side by side (no emojis, use `sub` for category label)
- `compare3` — 3-up cards with `tag`/`title`/`sub`/`points` (great for "X vs Y vs Z" decisions)
- `closing` — recap of the section names and a wrap-up line

**Animations**: each slide has CSS keyframe animations (`slideUp`, `fadeIn`, `scaleIn`) triggered when `.active` is added. The `.stagger > *` selector auto-delays children for sequential reveal. Don't over-animate; the defaults work.

**Color accents per group**: the `GROUP` constant in the slide deck JS maps each group name to an accent + soft-bg pair. The deploy-journey defaults (blue `local`, cyan `containers`, orange `cloud`, purple `infra`, green `devops`, emerald `synthesis`) are a STARTING POINT — re-tint them to the brand palette you picked in Step 7.0. If the brand has a single accent (or none, like Uber's pure black/white), collapse the group colors into shades of that palette instead of a rainbow.

**Print CSS for PDF export**: the template includes `@media print` rules that stack all slides one-per-page when the page is opened with `?print=1` (the page auto-triggers `window.print()` on load). The Exportar menu uses this URL form.

**Slide deck voice rules apply**: same anti-em-dash, anti-robot rules as the lesson data. Anchor questions on hook slides follow the same action-trigger-direction pattern as anchors in the lesson file. Hook subtitles are NOT facilitator prompts ("Liste em ordem"); they're framing for the student ("Em que ordem?").

### Step 8 — Save + register

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
- **Adding a slide because you have a related image.** "I found a Docker bridge diagram, let me add a `diagramFull` after the docker-compose slide" — the concept is already covered by the previous slide; the extra one only adds depth the audience doesn't need. Every slide must answer "what does the student understand after this that they didn't before?" If the answer is "nothing, but they see a cool picture", cut it.
- **Sneaking in unintroduced jargon.** `veth`, `L2 switch`, `cgroup`, `kubelet`, `etcd quorum` — if a term wasn't defined earlier in the same lesson and isn't strictly required to grasp the beat, it's noise. The audience has no anchor for it; the term reads as decoration that signals "you don't get it" instead of teaching. Audit every caption for nouns the cohort hasn't seen yet, and either define them inline (one sentence) or remove them.

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

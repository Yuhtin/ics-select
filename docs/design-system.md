# ICS Select — Design System Reference

**Context:** see `docs/superpowers/specs/2026-04-16-revamp-design.md` for the design rationale. This doc is the **cheat sheet** devs apply when building screens — when to use which token, which font, which accent.

**Last updated:** 2026-04-17 (PR 2a + 2b).

---

## Core principle: restraint + earned accent

Ink on paper is the default for 80–90% of a page. Color appears only when a specific **signal** needs to cut through — a state that the member must *notice*. Color is never decorative; it is earned.

Pages that look too flat are cheap to fix by adding an accent **to the signal that actually matters**. Pages that look chaotic are cheap to fix by removing accents from everything except the top-priority signal.

---

## Color token map

| Token | Hex | Role | Use for |
|---|---|---|---|
| `--paper` | `#FAFAF7` | Page bg | Default background. |
| `--paper-warm` | `#EFEEE8` | Section bg | Cards in a card context, hover tint, soft pills. |
| `--surface` | `#FFFFFF` | Raised bg | Cards, inputs, dropdowns. |
| `--ink` | `#1A1A1A` | Primary text + CTA | Default text, default button bg, serif headings. |
| `--ink-soft` | `#44403C` | Secondary text | Paragraph body, captions on paper. |
| `--ink-mute` | `#78716C` | Meta | Eyebrow labels, inline meta, mono hints. |
| `--ink-faint` | `#A8A29E` | Placeholder | Disabled text, input placeholder. |
| `--rule` | `#E5E4DF` | Borders | Dividers, card borders, input borders. |

### The four accents (use carefully)

| Token | Hex | Role |
|---|---|---|
| `--focus` | `#4F46E5` indigo | **Momentum / act-now.** "This is your moment." |
| `--accent` | `#C45D3A` terracotta | **Returning / reflective.** "Pay attention — context from before." |
| `--outcome-stuck` | `#991B1B` vinho | **Urgent / needs attention.** "Right now, not later." |
| `--outcome-done-hard` | `#B45309` âmbar | **Past-due warning.** "You missed this; catch up." |

### Outcome dot family (fixed meanings on `ItemOutcome`)

| Token | Hex | Outcome |
|---|---|---|
| `--outcome-pending` | `#A8A29E` | PENDING |
| `--outcome-done-easy` | `#065F46` | DONE_EASY |
| `--outcome-done-hard` | `#B45309` | DONE_HARD |
| `--outcome-doubts` | `#6B21A8` | DOUBTS |
| `--outcome-stuck` | `#991B1B` | STUCK |

Outcome tokens appear as **dots (6–10px)** or **left borders (3–4px)**. Never as full background.

### Platform colors

Used as **3px vertical stripes** before item titles in lists. Creates natural variety without decoration. Can also mark card borders in item focus (future polish). Never as text color, never as backgrounds bigger than a pill.

---

## When to use which accent — concrete examples

### `--focus` (indigo) — Momentum

- Hero state `now`: eyebrow in `text-focus`, hero section gets `border-l-4 border-focus pl-6`.
- Hero state `now` CTA: button `bg-focus text-paper` instead of `bg-ink`.
- Streak card when `current >= 30` days: big number `text-focus`, dots filled with `bg-focus`, label `30-DAY MILESTONE`.
- **Not for:** static links, plain navigation, default buttons.

### `--accent` (terracotta) — Reflective

- Carry-over item in a list: `border-l-2 border-accent` + badge "CARRIED OVER" with `bg-accent text-paper`.
- Carry-over section on item focus: `border-l-4 border-accent pl-6`, eyebrow `text-accent`.
- Streak card at `14–29` days: `text-accent` on number.
- AI rationale (future, plan editor Panel 2): `border-l-2 border-accent` on the rationale block.
- **Not for:** urgent states, current action.

### `--outcome-stuck` (vinho) — Urgent

- Hero state `running_late`: eyebrow in `text-outcome-stuck`, hero section `border-l-4 border-outcome-stuck pl-6`.
- Item focus header when overdue: same border treatment.
- Stuck banner on item focus: `border-l-4 border-outcome-stuck` with eyebrow text in that color.
- Admin triage "Urgent" section (future): same border language.
- **Not for:** routine progress markers.

### `--outcome-done-hard` (âmbar) — Past-due warning

- List row with pending-past-scheduled-time item: `border-l-2 border-outcome-done-hard` + badge "LATE".
- Admin alerts at "Needs attention" severity (future).
- **Not for:** in-progress current work (use `focus` instead).

---

## Typography rules

| Font | Use | Never |
|---|---|---|
| **Newsreader** (serif) | Hero headlines (H1 40px), moment-of-impact titles on member pages, quoted reflections (italic), retro quotes. | Long body text on member pages. List row titles. Meta/eyebrow text. |
| **Source Serif 4** (serif, tabular) | All admin dense-data surfaces — plan editor, cycle page, library, ai-usage. Numbers in stats. | Member-side lists, short button text, eyebrows. |
| **Inter** (sans) | UI chrome: buttons, pills, list row titles, nav, meta beyond "eyebrow". Member body copy. | Hero h1 that's meant to anchor. Emotional quote blocks. |
| **IBM Plex Mono** | Eyebrow labels (10–11px uppercase), clock times (`19:00`), IDs, meta tags (`LEETCODE · 45 MIN`). | Long passages. Anything larger than 16px. |

**Rule of thumb for the member side:** serif is a **moment** (hero, quote, carry-over echo), sans is a **surface** (list, form, card). If a heading repeats 5+ times on the same page (a day header, a section label), use sans — it's a UI element, not a moment.

---

## Component patterns you can copy-paste

### Eyebrow + H1 + meta pills

```tsx
<header>
  <Eyebrow>Scheduled · Fri, Apr 17 19:00</Eyebrow>
  <h1 className="mt-3 font-serif text-[40px] font-medium leading-[1.05] tracking-tight">
    {title}
  </h1>
  <div className="mt-3 flex flex-wrap items-center gap-2">
    <Pill>{platformLabel}</Pill>
    <span className="font-mono text-xs text-ink-mute">{estimatedMinutes} MIN</span>
    {topic && <Pill variant="soft">{topic.label}</Pill>}
  </div>
</header>
```

Applies to: `/me` hero, item focus, member profile cards.

### Accent left-border block

```tsx
<section className="border-l-4 border-accent pl-5 md:pl-6">
  <Eyebrow className="!text-accent">Carried from last week · your note</Eyebrow>
  {/* content */}
</section>
```

Use `border-focus`, `border-outcome-stuck`, `border-outcome-done-hard` with the matching eyebrow class for the other three accents. The `md:pl-6` keeps spacing comfortable on desktop.

### Item row in a day list

```tsx
<ListRow
  time="19:00"
  outcome={item.outcome}
  intent={isLate ? 'late' : isCarried ? 'carried' : 'default'}
  platform={detectedPlatform}
  title={item.title}
  meta={`${platformLabel} · ${formatMinutes(item.estimatedMinutes)}`}
  badge={isLate ? 'Late' : isCarried ? 'Carried over' : null}
  active={isNowItem}
  onClick={() => router.push(`/me/item/${item.id}`)}
/>
```

The component handles all the border colors and badge tones internally based on `intent` — don't re-derive them at the call site.

### Primary CTA

```tsx
// Neutral action (save, submit, publish, open external link)
<Button variant="primary">Save outcome</Button>

// Act-now moment (start studying when it's scheduled now)
<Button variant="primary" className="bg-focus hover:bg-focus/90">
  Start study
</Button>
```

If `bg-focus` CTAs become common, promote them to a `variant="focus"` on `Button`.

---

## Spacing, geometry, motion

- **Base unit:** 4px. Always multiples: 4, 8, 12, 16, 24, 32, 48, 64.
- **Card radius:** 12px (`rounded-card`).
- **Pill radius:** 9999px (`rounded-pill`).
- **No box-shadow** on the main design. Plane separation via `paper → paper-warm → surface` + 1px `rule` border.
- **`shadow-lift`** allowed on hover for clickable card-sized elements (`0 1px 2px rgba(0,0,0,.04), 0 2px 6px rgba(0,0,0,.06)`) — tiny, barely-there, magazine-safe.
- **`shadow-modal`** for modal / focus ring only (`0 1px 3px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.08)`).
- **Motion:** Framer Motion. 150ms hover, 200ms modal/slide, 300ms page transition. Easing `[0.16, 1, 0.3, 1]` (available as `ease-magazine`).
- **Icons:** `lucide-react`, strokeWidth 1.5 for neutral, 2 for active/selected.
- **Never emoji** anywhere.

---

## Anti-patterns (don't)

- Using two accent colors in the same section. Pick the most urgent: `stuck > late > focus > accent > default`.
- Using accent colors as backgrounds bigger than a small badge.
- Putting Newsreader on list-row titles (it reads heavy, you scroll past it slowly — bad for "I'm doing things").
- Adding arbitrary shadows to "make cards pop". Borders + bg tones already separate planes.
- Using `text-foreground-*` (legacy HeroUI tokens) on new member code. Use `text-ink-*` instead. The shim exists only to keep admin pages from exploding until PR 3.
- Emoji in UI (use `lucide-react` icons).

---

## When in doubt

The question to ask yourself: **"Would a member standing at the top of the page at a glance see which thing needs their attention first?"**

- If yes, the design is working.
- If they see a page of paragraphs and have to read to find it, add one accent to the priority signal.
- If they see five colored sections competing, remove four.

---

## Further reading

- Typography rationale: `docs/superpowers/specs/2026-04-16-revamp-design.md` §2.1.
- Palette rationale: `docs/superpowers/specs/2026-04-16-revamp-design.md` §2.2.
- Component inventory: `apps/web/components/ui/` + `apps/web/components/member/`.
- Live showcase: `/dev/design-system` (delete before ship).
- Live preview with mock data: `/dev/me-preview` (delete before ship).

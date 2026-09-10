# Academy Fellow Studio Member Experience

**Date:** 2026-09-09

**Status:** Approved

**Parent identity:** [Academy Fellow Visual Identity Redesign](./2026-09-09-academy-fellow-visual-identity-design.md)

## Context

The Academy Fellow rebrand established a strong public landing page and authentication experience, but the authenticated fellow area retained the previous dashboard composition. Repeated cards, a horizontal product header, metadata pills, and conventional boxed forms make the member experience feel less intentional than the public brand.

This specification replaces the visual structure of the member area with the approved **Studio** direction. Studio combines a calm stone workspace with the precision and pacing associated with focused software tools. It also introduces a conversational presentation for reflective input, informed by Typeform's one-question-at-a-time model.

This document supersedes only the member-experience presentation rules in the parent identity specification and older member redesign documents. The Academy identity tokens, official assets, product behavior, and backend contracts remain authoritative.

## Goal

Make the entire fellow area feel like one focused learning workspace whose structure changes appropriately for planning, studying, reflecting, and managing preferences.

Success means:

- the member area has a new composition rather than a restyled version of the old dashboard;
- a fellow can identify every navigation destination without memorizing icons;
- the current study task is immediately obvious;
- information is grouped through alignment, spacing, and dividers instead of nested cards;
- reflective forms feel calm and conversational;
- light theme, dark theme, keyboard use, touch use, and reduced motion are equally complete; and
- every current route, query, mutation, form field, permission, and product rule continues to work.

## Scope

### Included

- Replace the desktop member top bar with a compact left rail.
- Retain and refine the labeled mobile bottom navigation.
- Recompose member home, calendar, item focus, cohort, retro, settings, onboarding, reconnect, loading, empty, and error surfaces.
- Replace card stacks with open canvases, dividers, contextual columns, and semantic state markers.
- Present Retro and the post-study outcome flow as focused sequences.
- Add purposeful transitions with the existing Framer Motion dependency.
- Use the existing Lucide and HeroUI dependencies where they provide accessible primitives.
- Update relevant member screenshots and automated visual expectations.

### Excluded

- Copy rewrites beyond small labels needed by the new navigation or step controls.
- New routes, API endpoints, mutations, payload fields, database changes, or scoring rules.
- Changes to scheduling, Google Calendar synchronization, cohort visibility, retro availability, or onboarding requirements.
- New achievements, notifications, social features, study content, or artificial metrics.
- Redesigning administration, the landing page, or authentication again.
- Adding shadcn/ui or another component-system dependency.

## Approved Direction

The approved direction is **Studio A**:

- stone workspace with a dark structural rail;
- Academy blue reserved for current location, current task, focus, and the primary action;
- compact Lucide icons accompanied by visible labels;
- open content areas rather than a page made from equal cards;
- one main action per context;
- narrow contextual columns only where they help a decision;
- large, borderless response areas for reflective text; and
- sequenced, interruptible motion for guided flows.

The direction borrows principles from focused productivity products and conversational forms without copying another company's components or claiming its design system.

## Design Rules

### Hierarchy

- The page background is the primary surface. Content does not need a card merely to exist.
- A border or background may be used when an element is independently interactive, floating, modal, selected, or semantically distinct.
- Dividers, indentation, baseline alignment, and whitespace group ordinary content.
- Current study receives a four-pixel Academy blue left rule and one primary CTA.
- Completion remains green. Warning, blocked, doubt, and platform colors retain their semantic roles.
- Metadata uses plain text separated by spacing or short vertical rules. Metadata does not use pills.
- Pills remain limited to actions and actual states.

### Typography

- Inter remains the member-interface family.
- JetBrains Mono remains limited to dates, times, counts, progress, and compact technical metadata.
- Newsreader is not used inside routine member workspaces.
- Page titles use 32 to 40 pixels on desktop and 28 to 32 pixels on mobile.
- Guided questions use 28 to 36 pixels on desktop and 24 to 30 pixels on mobile, with a readable maximum line length.
- Labels stay direct and sentence-cased unless the existing content is a compact eyebrow.

### Icons

- Lucide is the only interface icon family.
- Standard stroke width is 1.5; selected or emphasized navigation may use 1.75 or 2.
- Navigation icons always have visible labels. Tooltips may supplement labels but never replace them.
- Icons are not used as decoration when text communicates the same thing.
- Every icon-only control retains an accessible name and a 44-pixel touch target.

## Member Shell

### Desktop rail

At viewports from 768 pixels upward, `MemberShell` renders a 94-pixel dark rail and a flexible workspace. The rail remains visible while the main document scrolls.

The rail contains:

1. the official IA mark linking to Today;
2. Today, Calendar, and Cohort destinations;
3. Retro when the window is open or while the current route is Retro;
4. Theme and Settings actions near the bottom;
5. the member avatar or initials with a visible profile label; and
6. Sign out with both icon and label.

The current destination uses an Academy blue background. Inactive destinations use neutral text and gain a quiet dark-surface hover state. Retro availability is communicated with text and a small semantic indicator; color alone is insufficient.

The rail owns navigation only. It does not contain progress metrics, help links, version labels, or invented product actions.

### Main workspace

The workspace uses the full remaining width with a maximum content width of 1,360 pixels. Standard horizontal padding is 24 pixels on tablet, 32 pixels from 1,200 to 1,439 pixels, and 40 pixels at 1,440 pixels and above. The route sections below define when content uses a narrower reading measure.

`OnboardingGate` and `GoogleReconnectGate` continue to wrap the same content boundary. Their redirect and authorization behavior is unchanged.

### Mobile navigation

Below 768 pixels, the desktop rail is replaced by the current fixed bottom navigation with four labeled destinations: Today, Calendar, Cohort, and Profile. Each item remains at least 44 pixels high and accounts for the safe-area inset.

When Retro is open, a compact labeled action appears directly above the bottom navigation on member pages. It is a real state/action control rather than a decorative badge. On the Retro route, it is omitted because the user is already there.

Main content reserves enough bottom padding that fixed navigation never covers controls or validation messages.

## Route Compositions

### Today

Today uses a two-column workspace on wide screens:

- the primary column contains the greeting, current focus, overdue work, today's work, later days, unscheduled work, and carry-over reflection in chronological order;
- the context column contains ranking, streak, study time, and topic coverage, separated by a single left divider and internal rules.

The current item is integrated into the page with a blue left rule and lower divider. It is not enclosed in a generic card. Its title, time, platform, topic, and CTA retain the same values and links.

Day items become open list rows with a time, semantic outcome marker, title, and compact metadata. Late and Carried over use text state labels. Platform and duration remain plain text.

At narrower widths, the context column follows the study list. Current focus remains above both.

### Calendar

Calendar becomes the widest member workspace. The week grid is the primary surface rather than content inside a large card.

- The header keeps the current week label, previous, next, Today, and refresh behavior.
- The existing calendar sidebar becomes a narrow study-block agenda separated from the week grid by a vertical rule.
- The connection banner appears above the grid when needed.
- The legend moves below the grid and remains textually explicit.
- Study and external event interactions, rescheduling, timezone calculations, and dynamic loading remain unchanged.

On small screens, the existing accessible calendar behavior is preserved and refined for horizontal access. The design does not invent a new day/week mode or gesture unless the current component already supports it.

### Item focus

The item route becomes a study workspace:

- a quiet Back link establishes location;
- the title block uses the current-focus rule and plain metadata;
- Open resource is the only primary action before completion;
- description and carry-over context use open sections with dividers;
- the outcome flow begins only when the fellow interacts with How did it go?; and
- the complete reading and response flow stays in a single column no wider than 800 pixels.

Existing outcome values, time requirements, optimistic cache behavior, edit behavior, skip behavior, and stuck notification text remain unchanged.

### Cohort

Cohort uses a split composition rather than a grid of member cards:

- the roster or ranking occupies the primary column;
- recent activity occupies the secondary column behind one vertical divider;
- member rows use avatar, name, progress, and rank on a shared baseline;
- the current member row uses a blue left rule and subtle selected background; and
- privacy remains unchanged: no other member's item-level activity is exposed beyond the current API response.

The columns stack on small screens, with roster before activity.

### Retro

When Retro is open, it uses the guided-flow structure described below. Weekly recap sits in a quiet context column on desktop and becomes an introductory summary above the first step on mobile.

When Retro is closed:

- the page explains when it reopens;
- an existing submission is shown as a readable review;
- empty disabled fields are not displayed as a form; and
- no action suggests that changes can currently be saved.

The current retro availability calculation, conditional questions, visibility to the program director, mutation, and toast results remain unchanged.

### Settings

Settings keeps direct editing because a one-question-at-a-time flow would slow routine changes.

- Desktop uses a simple vertical local navigation separated by a rule.
- Mobile uses a horizontally scrollable text tab row with an active underline, not rounded metadata pills.
- Form sections use spacing and dividers.
- Text fields use restrained low-emphasis surfaces or a bottom-rule treatment based on their control type.
- Labels, descriptions, validation, disabled states, and save feedback remain visible.
- The global save indicator stays associated with the settings workspace and retains its current data behavior.

Profile, appearance, and availability routes retain all current controls and mutations.

### Onboarding and reconnect

Onboarding already uses a step model and Framer Motion. It adopts the new guided-flow typography, progress line, control styling, and motion tokens without changing its four steps, validation, write order, or redirect.

Reconnect uses an open centered composition with a single primary action. It preserves the same Google OAuth destination and gating logic.

The `/me/plan` redirect to `/me/calendar` remains unchanged.

## Guided Input Experience

Guided input applies to Retro and the item outcome flow. It does not become a generic replacement for settings forms.

### Flow model

A reusable `GuidedFlow` presentation component receives an ordered list of visible steps and the active step index. It owns only presentation and local navigation. Each feature continues to own its values, validation, conditional visibility, and submit mutation.

The flow provides:

- a Back or Exit affordance;
- a thin progress line and a textual `current of total` value;
- one decision or reflective question at a time;
- Previous and Continue controls;
- a final Submit action;
- an announcement when the active step changes; and
- directional transitions based on forward or backward movement.

The component does not fetch data, call APIs, infer domain rules, or persist drafts.

### Retro steps

The visible step list is derived from the existing data:

1. If stuck or doubt items exist, choose the blocked item.
2. If stuck or doubt items exist, answer what would unblock the work.
3. If a weekly recap exists, choose the item that was most valuable, including the existing `Nenhum` option.
4. Explain why that item was valuable.
5. Describe one change desired in the next plan.

Steps whose current source condition is false are removed before progress is calculated. Existing values prefill the flow when editing a submitted retro. Values remain local until the final existing submit mutation. No autosave or new endpoint is introduced.

### Item outcome steps

The item outcome flow uses the current local state and final save mutation:

1. Choose an existing outcome.
2. Add the existing optional reflection when the selected outcome permits it.
3. Enter actual minutes when the current domain rule requires time.
4. Save the result.

Skip, undo, already-completed, and stuck states retain their current behavior. Validation remains adjacent to the active question and prevents forward navigation when a required value is invalid.

### Text response visual

Reflective text is presented as content on the workspace rather than text inside a large box:

- transparent background;
- no enclosing card;
- a two-pixel neutral bottom rule that becomes Academy blue on focus;
- 18 to 24-pixel response text depending on viewport;
- a short human placeholder;
- a clear visible label or question connected through `aria-labelledby`;
- enough height for the expected answer without forcing a small internal scroll area; and
- validation below the rule without shifting the main question excessively.

Conventional account fields retain their current underlying control primitive and receive the approved low-emphasis Academy styling. The conversational response style is reserved for reflective writing.

### Choice visual and keyboard behavior

Choice steps use native radio groups rendered as vertically stacked rows with dividers, visible labels, and a selected state supported by color, weight, and an icon. Existing item outcomes may keep `OutcomePicker` after its semantics and appearance are aligned with the same row pattern.

When displayed, A through D key hints activate the corresponding visible option unless focus is inside a text control. Arrow-key navigation and Space or Enter activation remain available through the underlying accessible control.

## Component Strategy

No new package is required.

- `lucide-react` remains the sole icon library.
- `framer-motion` provides guided-step presence, progress, and direct feedback.
- `@heroui/react` remains available for accessible selection, popover, toast, and field primitives where its behavior fits.
- Existing Academy tokens and Tailwind utilities define the visual layer.
- The current shared `Button`, outcome, progress, and calendar domain components remain in use where their behavior is correct.

The component boundaries are:

- `MemberRail`: desktop navigation, theme, member, retro, and logout actions;
- `MemberMobileRetroAction`: conditional mobile entry into Retro;
- `StudioPageHeader`: optional eyebrow, title, supporting copy, and page actions;
- `StudioContextRail`: layout-only secondary column with divider semantics;
- `GuidedFlow`: progress, active-step transition, navigation, and announcements;
- `GuidedTextResponse`: accessible borderless reflective input;
- `GuidedChoice`: accessible row-based choices and optional key hints; and
- page-specific compositions that continue to use existing query and mutation hooks.

Shared components are introduced only when at least two real consumers need the same behavior. Page-specific layout is not hidden behind a configurable catch-all component.

## Data Flow and State

All existing query hooks remain attached to their current routes. The shell continues querying current Retro status to decide whether to render its entry point.

Guided flows introduce only local presentation state:

- active step index;
- navigation direction; and
- existing form values already held locally by the page.

Conditional step arrays are derived from query data and current answers. Going backward never clears a value. Changing an answer may remove a later conditional step, but it does not mutate the server until the existing final action is used.

Successful mutations preserve current cache updates, invalidation, navigation, and toast messages. Error payloads remain unchanged.

## Motion

Motion explains progress or confirms direct manipulation. It is not ambient decoration.

- Forward step: current content moves up 20 to 24 pixels while fading; the next step enters from 24 to 28 pixels below.
- Backward step: direction reverses.
- Step transition uses `AnimatePresence` with `mode="wait"`, 240 to 360 milliseconds, and the existing focused ease curve.
- Progress uses a short layout or scale transition with a soft spring and no bounce-heavy overshoot.
- Enabled primary and guided-flow buttons scale to 0.98 on press. Hover movement is limited to two pixels or a color change.
- Navigation location changes color immediately; it does not animate the whole page.
- Loading, error, and empty states do not pulse indefinitely unless an existing skeleton already communicates loading.

`useReducedMotion` removes translation and spring behavior. Reduced mode uses an immediate state change or a short opacity transition of at most 120 milliseconds. Focus is moved to the new question heading after a step change without creating a visible scroll jump.

## Responsive Behavior

### Wide desktop, 1,200 pixels and above

- 94-pixel rail.
- Today and Cohort use their defined primary and context columns; other routes follow their route-specific composition.
- Calendar uses sidebar plus week grid.
- Guided flows use recap context plus a centered question column.

### Tablet and compact desktop, 768 to 1,199 pixels

- 94-pixel rail remains.
- Context columns either narrow or move below primary content based on readable width.
- Calendar retains horizontal access to the full week.
- Guided-flow recap becomes a compact summary before the question when two columns no longer fit.

### Mobile, below 768 pixels

- bottom navigation replaces the rail;
- content uses 18 to 24 pixels of horizontal padding;
- all targets are at least 44 by 44 pixels;
- current focus CTA becomes full width when necessary;
- list metadata wraps beneath titles without horizontal clipping;
- cohort and settings columns stack;
- guided questions stay within one viewport where practical, while the document remains scrollable; and
- fixed controls respect the safe area and never cover focused inputs when the virtual keyboard opens.

The layout remains usable at 200 percent browser zoom without hiding navigation or requiring two-dimensional scrolling outside the calendar grid.

## Light and Dark Themes

The existing Academy palette remains authoritative. The dark rail is structural in both themes, with contrast adjusted through existing tokens. Main content uses light or dark background and text tokens according to the saved theme.

No component introduces a parallel hard-coded palette. Semantic colors are checked separately in each theme. The borderless reflective input must retain a visible resting rule, focus rule, placeholder, caret, and validation message in both themes.

## Accessibility

- Each navigation region has a distinct accessible label and active links use `aria-current="page"`.
- Visible rail labels remove dependence on tooltip memory.
- Dynamic Retro availability includes text, not only a dot.
- Guided progress exposes textual position; the decorative progress line is hidden from assistive technology.
- Step headings receive programmatic focus after navigation and an `aria-live="polite"` region announces the new position.
- Questions and inputs use explicit label relationships.
- Choice groups expose one group label and selected state.
- Errors are connected to their control and announced without replacing the user's answer.
- Focus indicators meet contrast requirements on stone, dark rail, and dark-theme surfaces.
- Color never carries outcome, error, completion, or selection alone.
- Motion respects the operating-system reduced-motion preference.
- Touch controls meet the 44-pixel target rule.

## Loading, Empty, Closed, and Error States

- Loading skeletons match open Studio geometry and avoid generic enclosing cards.
- Page-level load errors occupy the normal content column, retain readable headings, and expose any existing recovery action.
- An empty day or cohort uses a short explanation and the existing next action, if one exists.
- No-active-plan and free-day states use the current-focus position without a false primary CTA.
- Closed Retro uses a readable summary and availability notice instead of disabled input chrome.
- Reconnect and onboarding redirects preserve status semantics and never flash protected content.
- Mutation errors stay adjacent to the action or active step while preserving local answers.

## Verification

### Automated

- Run the web TypeScript check.
- Run existing unit tests.
- Run the complete Playwright suite.
- Run the production web build.
- Add or update focused tests for desktop and mobile member navigation, active-route behavior, conditional Retro entry, and shell gates.
- Add or update focused tests for Retro conditional steps, backward navigation, prefilled editing, closed state, final payload, pending state, success, and failure.
- Add or update focused tests for item outcome reflection, required time validation, final payload, skip, undo, and optimistic completion.
- Verify keyboard choice behavior and reduced-motion output where these behaviors are implemented.

### Visual

Inspect at 390, 768, and 1,440 pixels in light and dark themes:

- Today with current, upcoming, late, complete, free-day, and no-plan states;
- Calendar connected and disconnected, with reschedule modal;
- Item pending, completed, carried, invalid-time, and stuck states;
- Cohort populated and empty;
- Retro open, editing, closed with submission, and closed without submission;
- all Settings sections and save states;
- onboarding steps and reconnect gate; and
- loading, error, and empty states.

Also inspect keyboard-only navigation, visible focus, 200 percent zoom, reduced motion, long titles, and mobile virtual-keyboard behavior.

## Acceptance Criteria

- Desktop member routes use the labeled 94-pixel Studio rail.
- Mobile member routes use labeled bottom navigation and retain access to an open Retro.
- No member route depends on unlabeled navigation icons.
- Today, Calendar, Item, Cohort, Retro, and Settings have distinct task-appropriate compositions.
- Ordinary member content is grouped primarily through whitespace and dividers rather than nested cards.
- Metadata pills are removed; status and action pills remain allowed.
- Reflective text inputs use the approved large, borderless response presentation.
- Retro and post-study response flows present one decision at a time and submit through existing mutations.
- Settings remains a direct-edit experience.
- Lucide, HeroUI, and Framer Motion are used consistently; shadcn/ui is not added.
- All existing member routes, data contracts, content fields, permissions, theme persistence, and business rules remain intact.
- The member area passes automated checks and visual review in both themes and at the specified widths.

## Risks and Controls

- **Large member surface:** implement shell and shared composition primitives first, then migrate one route at a time with focused verification.
- **Form regression:** keep feature state and mutations inside current feature components; `GuidedFlow` owns presentation only.
- **Animation discomfort:** use short interruptible transitions and make reduced motion a first-class path.
- **Calendar density:** preserve existing grid calculations and interactions; limit changes to surrounding composition and visual tokens.
- **Component-library mismatch:** use HeroUI for behavior only where its installed version already supports the needed primitive, and style through Academy tokens.
- **Dark-theme regressions:** review every new divider, focus state, input rule, and rail action in both themes.
- **Scope drift:** do not change copy, backend behavior, scheduling, scoring, or permissions while implementing this member presentation redesign.

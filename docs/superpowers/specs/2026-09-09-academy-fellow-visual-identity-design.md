# Academy Fellow Visual Identity Redesign

**Date:** 2026-09-09

**Status:** Approved

**Figma source:** [ID Academy copy](https://www.figma.com/design/jZFcepE7ZQJbaipCR2pYpO/ID-Academy--Copy-?node-id=0-1&p=f&t=xv5VWF2VMmMSoaHX-0)

## Goal

Rebrand every user-facing web surface from ICS Select to Academy Fellow and apply a coherent Inteli Academy visual system to the landing page, authentication, member experience, administration, and embedded branded learning surfaces.

The product proposition, rules, routes, data model, APIs, forms, and workflows remain unchanged.

## Scope

### Included

- Replace user-facing ICS Select and Inteli Consulting Society branding with Academy Fellow and Inteli Academy.
- Replace improvised ICS marks with the official IA monogram from the Figma source.
- Rebuild the landing page composition while preserving its information architecture, claims, metrics, and conversion flow.
- Restyle member and admin shells, pages, shared components, loading states, empty states, errors, dialogs, and forms.
- Preserve and restyle light and dark themes on authenticated surfaces.
- Update metadata, Open Graph copy, image alt text, and user-facing static learning assets that carry old brand attribution.
- Update the development design-system page so it documents the Academy Fellow system.

### Excluded

- Changes to program duration, participant limits, selection rules, curriculum, scheduling, scoring, or permissions.
- Changes to URLs, route slugs, form fields, API contracts, database schemas, and Google Calendar behavior.
- Renaming technical identifiers such as the `@ics-select/*` package scope, repository directory, database values, migration history, or the calendar event discriminator `kind: 'ICS'`.
- Rewriting lesson content where ICS appears as part of an authored code example rather than brand attribution.
- A new marketing claim, metric, testimonial, partner, or cohort member not already backed by product data or the existing copy.

## Design Read

This is a full visual rebrand of a selective technology program for Inteli students. The language is editorial, precise, energetic, and recognizably Inteli Academy. The landing page carries the expressive brand work; the product surfaces translate the same system into a calmer operational interface.

### Design dials

| Surface | Design variance | Motion intensity | Visual density |
| --- | ---: | ---: | ---: |
| Landing and login | 8 | 6 | 4 |
| Member experience | 5 | 3 | 6 |
| Admin experience | 4 | 2 | 8 |

## Chosen Direction

The approved direction is **Academy editorial**.

It combines the IA monogram, electric blue, off-white, charcoal, editorial scale changes, asymmetric grids, real photography, and selected 3D imagery from the Figma guide. Expressive devices are concentrated on public and narrative surfaces. Dense operational pages use the same tokens with restrained motion and fewer decorative elements.

## Brand Foundations

### Naming

| Existing user-facing name | Replacement |
| --- | --- |
| ICS Select | Academy Fellow |
| Inteli Consulting Society | Inteli Academy |
| ICS mark in site chrome | Official IA monogram |
| Sou membro in the public header | Sou fellow |
| ICS Admin in site chrome | Academy Fellow with an Admin label |

Ordinary references to members can remain in functional copy. The rebrand does not rename domain concepts or API values.

### Color

The base palette is cool and high contrast. Academy blue is the only decorative accent.

#### Light theme

| Token | Value | Purpose |
| --- | --- | --- |
| `--bg` | `#F3F3F1` | Page background |
| `--bg-subtle` | `#EDEEF2` | Grouped regions and hover states |
| `--surface` | `#FCFCFB` | Cards, forms, and raised panels |
| `--surface-strong` | `#E3E4EA` | Selected neutral regions |
| `--fg` | `#18181C` | Primary text |
| `--fg-soft` | `#45464E` | Secondary text |
| `--fg-mute` | `#686A74` | Metadata |
| `--fg-faint` | `#8E909A` | Disabled and placeholder text |
| `--border` | `#DADBE2` | Standard dividers |
| `--border-strong` | `#BFC1CB` | Emphasized dividers |
| `--primary` | `#2E00FF` | Academy action and focus |
| `--primary-soft` | `#E8E3FF` | Selected and informational background |
| `--primary-fg` | `#F8F7FF` | Text on Academy blue |

#### Dark theme

| Token | Value | Purpose |
| --- | --- | --- |
| `--bg` | `#111114` | Page background |
| `--bg-subtle` | `#17171C` | Grouped regions |
| `--surface` | `#1D1D23` | Cards and forms |
| `--surface-strong` | `#282830` | Selected neutral regions |
| `--fg` | `#F4F4F1` | Primary text |
| `--fg-soft` | `#CBCBD1` | Secondary text |
| `--fg-mute` | `#A2A3AC` | Metadata |
| `--fg-faint` | `#777983` | Disabled and placeholder text |
| `--border` | `#30313A` | Standard dividers |
| `--border-strong` | `#474852` | Emphasized dividers |
| `--primary` | `#6747FF` | Academy action and focus |
| `--primary-soft` | `#292050` | Selected and informational background |
| `--primary-fg` | `#F8F7FF` | Text on Academy blue |

Functional colors remain semantic and secondary:

- Green communicates completion or success.
- Amber communicates delay, difficulty, or caution.
- Red communicates failure, blocking, or destructive action.
- Violet can remain tied to the existing doubts outcome.
- Platform colors remain restricted to platform identity and narrow indicators.

Large green borders and decorative multicolor frames are removed. Current focus and the primary CTA use Academy blue. Completion uses green.

### Typography

- `Inter` remains the interface and body family because the product already depends on it and its neutral structure matches the Academy presentation system.
- `Newsreader` remains the editorial family and appears only in brand moments, display headings, narrative summaries, and selected empty states.
- `JetBrains Mono` remains limited to IDs, times, counts, compact metadata, and tabular numerics.
- Fonts move from a render-blocking external stylesheet to `next/font` so the same families are self-hosted by Next.js and layout shift is controlled.
- Landing display headings use dominant sans-serif construction with selective Newsreader emphasis, matching the Figma pattern where Academy is the editorial accent.
- Product and admin body copy never use the display serif.

### Shape and depth

- Standard panel radius: 16px.
- Input and compact control radius: 10px.
- Buttons and status controls may use a full pill radius.
- Image radius: 12px.
- The IA monogram is rendered as the official vector without an improvised rounded-square container.
- Borders and background changes create most hierarchy. Shadows are limited to floating navigation, modals, and the landing product showcase.
- Shadows use a cool charcoal tint and remain subtle in light and dark themes.

### Icons

The existing Lucide dependency remains for this visual-only rebrand. Icon size, stroke width, active color, and accessible labels are standardized. A library migration is outside scope because it would add churn without improving brand fidelity.

### Motion

- Landing hero layers enter in a short sequence to explain visual hierarchy.
- Major landing sections use one-time opacity and transform reveals.
- Buttons and interactive cards use tactile press and restrained hover movement.
- Product, member, and admin interfaces use motion only for state transitions, dialogs, and direct feedback.
- Continuous cursor effects, decorative status pulses, and raw `window` scroll listeners are removed.
- Every automatic animation respects `prefers-reduced-motion` and becomes static when reduction is requested.

## Assets

The Figma file is the source for the official monogram and Academy campaign imagery. Implementation exports these assets into:

- `apps/web/public/brand/academy/ia-mark.svg`
- `apps/web/public/brand/academy/academy-robot.webp`
- `apps/web/public/brand/academy/academy-community.webp`

The landing page uses real product screenshots and these supplied brand assets. It does not create fake dashboard screenshots, hand-drawn logo vectors, or invented partner marks.

All exported raster assets receive explicit dimensions, responsive `sizes`, meaningful alt text when informative, and empty alt text when decorative.

## Landing Page

The route, anchors, data requests, and waitlist flow remain intact. The visual composition changes.

### Navigation

- Height remains between 64px and 72px on desktop.
- The left side uses the official IA mark and Academy Fellow wordmark.
- Existing anchor destinations remain available.
- The desktop navigation stays on one line.
- The member login CTA becomes `Sou fellow`.
- Mobile keeps brand and login visible without crowding the header.

### Hero

- Use an asymmetric split composition.
- Preserve the current value proposition and supporting claim.
- Keep the headline within two lines at desktop through copy-safe sizing and a controlled text measure.
- Place real Academy imagery on the right, using a layered photograph and blue field inspired by the supplied presentation frames.
- Keep the primary CTA and cycle status visible within the initial viewport.
- Replace the current animated pill-word and large unused white region with a composition that balances copy and imagery.

### Program pillars

- Preserve the three existing pillars and their supporting content.
- Replace the equal three-card row with an asymmetric editorial grid.
- Give each pillar a distinct visual role: plan preview, cohort proof, and architecture lesson.
- Reuse actual product elements or screenshots in the visual regions.
- Keep a strict one-column mobile fallback.

### Company targets

- Preserve the existing company set and logos.
- Present the companies as a logo-only proof band.
- Remove city labels, decorative hover glows, and invented mark treatments where a real asset exists.
- Preserve accessible company names through alt text.

### Product showcase

- Use the real member-home screenshot at a larger scale.
- Present the three explanatory points in a layout distinct from the pillars.
- Remove simulated browser chrome unless it contributes real hierarchy.
- Re-export the screenshot after the authenticated product receives the new visual system so public and private surfaces agree.

### Cohort and application

- Preserve the live `/public/cohort` data request, roster rendering, cycle messaging, and waitlist action.
- Use member photography as social proof without decorative labels.
- Keep one primary conversion label for entering the selection.
- Restyle the waitlist dialog with the new tokens while preserving all steps, validation, focus behavior, submission states, and fields.

### Footer

- Replace old organization attribution with Academy Fellow and Inteli Academy.
- Preserve the existing author link.
- Keep the footer compact and free of build or version decoration.

## Authentication

- Replace all visible ICS branding with the official Academy Fellow lockup.
- Preserve Google authentication behavior and every existing error branch.
- Update access-denied and invitation messages only where they name the old organization or product.
- Use Academy blue for the primary sign-in action and focus state.
- Keep a compact, responsive layout with a real Academy visual rather than decorative gradients.

## Member Experience

### Shell

- Replace the ICS square and Select text with the IA monogram and Academy Fellow.
- Preserve navigation destinations and active-route logic.
- Retain theme, profile, retro, logout, mobile navigation, onboarding, and reconnect gates.
- Use Academy blue for active navigation and current work.

### Home and item focus

- The next study item remains the dominant element.
- Replace the current heavy green frames with quiet surfaces and a single Academy blue current-item indicator.
- Keep green for completed items and completion metrics.
- Group daily plan, progress, streak, and cohort through spacing and shared baselines rather than nested cards.
- Preserve all item actions, outcome values, dates, times, and data-fetch behavior.

### Calendar, plan, cohort, retro, and settings

- Keep the information architecture and controls unchanged.
- Apply the new hierarchy, token palette, type scale, spacing, focus states, and radius rules.
- Map the internal calendar `ICS` event kind to the user-facing Academy Fellow label without changing the underlying value.
- Preserve platform and outcome semantics.
- Make loading, empty, reconnect, and error states look intentional in both themes.

## Admin Experience

### Shell

- Use the Academy Fellow lockup with a restrained Admin label.
- Preserve every navigation destination and permission check.
- Keep density high and motion low.
- Allow horizontal navigation to collapse cleanly on narrower admin viewports instead of wrapping.

### Operational pages

- Apply the shared Academy tokens to members, cycles, plans, library, waitlist, meetings, configuration, AI usage, receipts, and member detail.
- Keep tables, filters, editors, dialogs, and forms structurally unchanged unless a small layout correction is required for the new spacing scale.
- Remove decorative serif text from dense data regions.
- Use monospaced typography only for IDs, times, money, counts, and compact technical metadata.
- Preserve chart semantics while recalibrating grid, axis, tooltip, and series contrast for both themes.
- Keep print layouts light, legible, and independent of the active theme.

## Shared Component Strategy

The rebrand begins with semantic foundations so page-level work does not duplicate style decisions.

1. Global tokens, font variables, and Tailwind aliases establish the Academy system.
2. Brand lockup, buttons, cards, fields, pills, dialogs, tables, progress components, and state indicators adopt the tokens.
3. Member and admin shells adopt the brand and navigation rules.
4. Authenticated pages inherit the shared system and receive targeted composition fixes.
5. The landing page is recomposed after the member home is stable, allowing it to show an accurate product screenshot.
6. Login, static branded learning surfaces, metadata, and documentation receive the final brand pass.

Legacy color aliases may remain temporarily when they resolve to the new Academy tokens. No page may introduce a second hard-coded brand palette.

## Data Flow and Behavior

This project is a visual rebrand. Existing React Query hooks, fetch requests, authentication context, API clients, server components, and route boundaries remain unchanged.

- The landing cohort section continues to load `/public/cohort` and silently omit the roster when no public data is available.
- The waitlist continues to load its cycle configuration and submit the same payload.
- Member and admin pages continue to use their existing queries, mutations, guards, and authorization.
- Theme persistence continues through `next-themes` and the current `data-theme` contract.
- Existing analytics integration remains mounted in the root layout.

## Error, Loading, and Empty States

- Existing state logic and messages remain, except for direct old-brand references.
- Skeletons follow the final component geometry and do not use generic spinners when a skeleton already exists.
- Form errors remain adjacent to the relevant field or action.
- Dialogs retain Escape handling, backdrop dismissal where already supported, focus restoration, and scroll locking.
- Empty states explain the next available action without adding new product behavior.
- Disabled controls retain readable contrast in light and dark themes.

## Responsive Rules

- Landing multi-column compositions collapse below 768px into a strict single-column reading order.
- The hero uses `min-height` based on `dvh`, never a fixed `100vh`.
- Desktop navigation remains one line; smaller viewports use the existing mobile patterns or a compact overflow treatment.
- Tables preserve horizontal access where they cannot collapse without losing meaning.
- Tap targets are at least 44px in touch-first contexts.
- Text and controls remain usable at 200 percent browser zoom.

## Accessibility

- Body and control text meet WCAG AA contrast in both themes.
- Hero and large display text target AAA contrast where practical.
- Every interactive element keeps a visible keyboard focus indicator.
- Images have meaningful or intentionally empty alt text.
- Motion is disabled or simplified under reduced-motion preferences.
- Color never communicates outcome or state without text, icon, shape, or position support.
- Existing keyboard navigation, form labels, dialog semantics, and auth error announcements must not regress.

## Content Rules

- Keep the current Portuguese register and program proposition.
- Change only brand names, organization attribution, and labels directly required by the rebrand.
- Preserve all verified numbers and live values.
- Do not introduce generic marketing language, new partner claims, or artificial precision.
- Use Academy Fellow consistently in user-facing copy.
- Keep technical package names, enum values, and source-code identifiers unchanged.

## Verification

### Automated

- Run the web typecheck.
- Run relevant unit tests for components whose behavior is touched.
- Run the existing Playwright suite.
- Run the production web build.
- Search user-facing web sources for old-brand strings and review every remaining occurrence against the technical-identifier allowlist.

### Visual

Capture and inspect these surfaces at 390px, 768px, and 1440px where applicable:

- Landing page and waitlist dialog
- Login and each authentication error state
- Member home, item, calendar, plan, cohort, retro, onboarding, and settings
- Admin members, cycles, active cycle, plans, library, waitlist, meetings, configuration, AI usage, member detail, and receipt
- The design-system development page

Authenticated surfaces are inspected in light and dark themes. The landing page is inspected for initial-viewport fit, navigation wrapping, CTA contrast, section rhythm, image loading, and reduced motion.

### Completion criteria

- No improvised ICS logo remains in visible application chrome.
- No user-facing ICS Select or Inteli Consulting Society attribution remains unless it is intentionally historical content.
- Public and authenticated surfaces clearly belong to the same Academy Fellow system.
- Primary action, success, warning, error, platform, and outcome colors remain semantically distinct.
- No existing route, request, mutation, form field, or product rule changes.
- Typecheck, Playwright, and production build pass.

## Risks and Controls

- **Large surface area:** work proceeds foundation-first and verifies representative routes after each layer.
- **Dirty worktree:** implementation preserves existing user changes and commits only files explicitly changed for this rebrand.
- **Brand assets:** use assets exported from the user-provided Figma file; do not redraw the IA mark.
- **Visual regressions in dense admin pages:** keep layout changes targeted and validate tables, editors, charts, and dialogs separately.
- **Theme regressions:** inspect every shared primitive in light and dark before page-level rollout.
- **Stale product screenshot:** regenerate the landing screenshot only after the member home visual pass is complete.

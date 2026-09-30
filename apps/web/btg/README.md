# BTG skin (POC)

An alternative frontend for ICS Select in the BTG Pactual visual identity. It uses the same API, users, cycles, AI and library — only the presentation layer changes.

- **Member:** `/btg-poc` (Hoje), `/btg-poc/plano`, `/btg-poc/turma`, `/btg-poc/item/[id]`
- **Admin:** `/btgadmin-poc` (active cycle), `/btgadmin-poc/cycle/[id]`, `/btgadmin-poc/member/[id]/plan/[planId|new]`

Design reference: `docs/btg/design.md` and the "ICS Select BTG" canvas.

## Isolation

The skin only adds files. It changes no existing project file: no shared components, hooks, auth flow, routes, CSS or `package.json`. It reads `lib/queries`, `lib/api/client` and `lib/auth/auth-context` but never edits them.

- **Sign-in:** Google OAuth runs in a popup that ends on the classic `/auth/callback`. That page writes the token to `localStorage`, and the BTG page picks it up through the `storage` event and reloads in place (`auth.tsx`).
- **Sign-out:** calls `/auth/logout` and returns to the BTG sign-in screen.
- **Limitation:** if the session expires, the classic auto-logout still sends the user to `/login`.

## Running locally (fully mocked)

```bash
pnpm install
node apps/web/btg/mock/dev.mjs   # from the repo root
```

This starts a mock API on `:3999` (`mock/server.mjs`) and `next dev` on `:3000` pointed at it. You don't need a database, a Google account or an OpenAI key.

- `http://localhost:3000/btg-poc`: member view (Ana Lima)
- `http://localhost:3000/btgadmin-poc`: admin view (Diretor Educacional)

Logging in opens a mock profile picker instead of Google. The mock keeps state in memory:
- Marking an outcome updates the home screen, the ranking and the admin feed.
- Marking "Travei" creates an alert in triage.
- Drafts, AI drafts, preview, publish and scheduling all work.

State resets when the process restarts. Endpoints outside the POC return 404, so the classic pages linked from the menu don't work in mock mode.

To use the real API, run `pnpm dev` with `NEXT_PUBLIC_API_URL` pointing at the backend.

## What lives where

Everything BTG-specific is in this folder. Nothing outside it depends on it except the thin route files in `app/btg-poc/` and `app/btgadmin-poc/`.

| What | File | How to swap it |
|---|---|---|
| Logos (SVG) | `assets/btg-logo.svg`, `assets/btg-logo-white.svg` | Replace the files. They are imported only in `ui.tsx`. |
| Fonts | `theme/fonts.tsx` | Figtree stands in for the proprietary "BTG Pactual Sans". Put the official files in `assets/fonts/` and switch to `next/font/local` with the same `--btg-font-sans` variable. |
| Icons | `theme/fonts.tsx` (`BtgIconFont`) | Material Symbols Outlined, loaded only on BTG routes. |
| Colors, radii, layout | `theme/btg.css` | Every token is a `--btg-*` variable scoped under `.btg`. |
| Screens | `member/*.tsx`, `admin/*.tsx` | They reuse the hooks in `lib/queries` unchanged. |

## Removing it

Delete `apps/web/btg/`, `apps/web/app/btg-poc/`, `apps/web/app/btgadmin-poc/` and `docs/btg/`. The skin changes no other file in the project.

## Scope

Every classic screen has a BTG equivalent:
- **Member (`/btg-poc`):** hoje, plano, turma, item, agenda, retro, configurações (perfil, aparência with dark theme, disponibilidade) and onboarding.
- **Admin (`/btgadmin-poc`):** ciclo ativo, ciclos, resumo do ciclo, membros, member cockpit, plan editor, planos, acervo, aulas, uso de IA, lista de espera and configurações.

Mock endpoints are split by screen group in `mock/routes/*.mjs`.

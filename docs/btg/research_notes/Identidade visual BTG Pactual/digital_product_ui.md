# BTG Pactual digital product UI patterns (apps + web), as of Sep 2026

Method note: logged-in surfaces (the investments app, BTG Banking, the BTG Empresas internet banking) can't be reached without an account, and App Store / Play screenshots can't be viewed through text fetch. The strongest evidence here is BTG's **public production CSS**: the Orquestra design-system theme files served from `orquestracdn.btgpactual.com`, plus the markup and bundle of `empresas.btgpactual.com` (fetched 2026-09-29). Those are primary sources. Anything about how the logged-in screens look is marked as inference.

## 1. Does BTG have a known design system?

### Takeaway
Yes. It is called **Orquestra**, a multi-brand design system. It ships as versioned CSS theme files (currently `themes/v7/`) with light and dark variants, a proprietary typeface ("BTG Pactual Sans"), an icon font ("icomoon-orquestra") and a set of Angular web components prefixed `btg-`. No public Figma community file or public documentation site turned up.

### Cited Findings
- "Orquestra" is BTG's multi-brand design system. The iF Design winner "BTG AI-Driven Banking Experience" is described as "built on Orquestra... consistent and human-centered across channels, from app to smartwatch". — [iF Design](https://ifdesign.com/en/winner-ranking/project/btg-ai-driven-banking-experience/767529) (page returned 403 to fetch; content taken from the search-engine snippet)
- A BTG designer's portfolio describes Orquestra as "the Design System of BTG Pactual". BTG also has a "Senior Design System Analyst" role (Iure Figueira). — [iurefigueira.design/sobre](https://iurefigueira.design/sobre) (search snippet; the site did not resolve on fetch), [LinkedIn](https://br.linkedin.com/in/iurefigueira)
- Production theme CSS: `https://orquestracdn.btgpactual.com/themes/v7/btg_styles_lightmode.theme.css` (loaded by empresas.btgpactual.com). A dark variant exists at `.../themes/v7/btg_styles_darkmode.theme.css` (HTTP 200). — [light theme](https://orquestracdn.btgpactual.com/themes/v7/btg_styles_lightmode.theme.css), [dark theme](https://orquestracdn.btgpactual.com/themes/v7/btg_styles_darkmode.theme.css)
- Font file: `orquestracdn.btgpactual.com/fonts/Btg-fonts/BTGPactualSans-Regular.woff2`. The CSS declares `font-family: BTG Pactual Sans` (58 occurrences on the Empresas home) with a `'BTG Pactual Sans', Helvetica` fallback. — [empresas.btgpactual.com](https://empresas.btgpactual.com/) (page source)
- Components found in Empresas markup and JS: `btg-card` (+ `-header`, `-content`, `-footer`, `-image`, with `data-orientation="vertical"` and a `divider` class on the header), `btg-section-header/footer/slot`, `btg-accordion(-item)`, `btg-carousel`, `btg-badge` (`type="default" size="large" color="blue" text="Novo"`), `btg-hero` (`appearance="dark-blue"`), `btg-modal(-header)`, `btg-input`, `btg-select(-option)`, `btg-switch`, `btg-loading`, `btg-empty-state`, `btg-grid`. The shared global menu is a separately hosted web component: `https://components.btgpactual.com/libs/btg-pactual-menu/btg-pactual-menu.js`. — [empresas.btgpactual.com](https://empresas.btgpactual.com/) (HTML + `main-*.js`)
- The Empresas site is Angular (`_ngcontent-ng-*` attributes, `ng-event-dispatch-contract`). — same source
- There's a separate brand center with a visual guide at [brandcenter.btgpactual.com/guia-visual](https://brandcenter.btgpactual.com/guia-visual), plus a PDF "Linguagem Visual" guide ([Guide.BTGPactual_PT.pdf](https://www.btgpactual.mx/assets/images/our-dna/press/download/Guide.BTGPactual_PT.pdf)). The brand center is a JS SPA and its contents couldn't be extracted.

### Inferences
- Because it is "multi-brand" and exposes a `primary-*` / `surface-brand-*` token layer, sub-brands (Empresas, Banking, Investimentos, possibly Empiricus and others) probably swap only the brand ramp and keep the same neutrals, status colors and components.
- The token names follow a Material-3-like semantic model (`action-*-enabled/hover/pressed/focus/selected`, `emphasis-high/medium/low`, `*-inverse`, `on-color-*`). A web UI that reuses these token names will map cleanly onto BTG's system.

### Gaps
- No public Storybook, docs site, Figma community file or Medium/tech-blog post about Orquestra was found.
- The npm registry has no public Orquestra package (search returned unrelated packages).

## 2. Colors, status colors and positive/negative numbers (Orquestra v7 tokens)

### Takeaway
The brand primary is **#195AB4** (a medium royal blue) on a 10–100 ramp that runs down to near-black navy **#05132A**. Light-mode page background is **#F5F5F6** with **white (#FFFFFF) cards**. Positive and negative values use green **#128850** and red **#CE363F**, each with a tinted surface. Text is black or white at fixed alpha levels (96/80/64%) rather than separate grey hexes.

### Cited Findings (all from [light theme CSS](https://orquestracdn.btgpactual.com/themes/v7/btg_styles_lightmode.theme.css) unless noted)
- **Primary ramp:** `--primary-extended-10 #d2e5ff`, `20 #b1d2ff`, `30 #87baff`, `40 #6baaff`, `50 #549cff`, `60 #307ae0`, `70 #195ab4` (= `--primary-base`), `80 #10408d`, `90 #0b2859`, `100 #05132a`. `--secondary-base: #10408d`.
- **Brand surfaces (for dark-blue heroes/banners):** `--surface-brand-01 #05132a`, `02 #0b2859`, `03 #10408d`, `04 #195ab4`, `05 #6baaff`. Text on brand surfaces 01–04 is white at 96/80/74% opacity; on 05 it's black.
- **Backgrounds/neutrals (light):** `--background-base #f5f5f6` (page), `--neutral-base #ffffff` (card/surface). Neutral ramp: `10 #ffffff`, `20 #f5f6f9`, `30 #d7dbdf`, `40 #b8bec4`, `50 #959ca2`, `60 #61686e`, `70 #464c51`, `80 #34383c`, `90 #272a2e`, `100 #1b1e20`.
- **Outline/border:** `--outline-base: rgba(0,0,0,0.16)`. Focus ring color `--outline-base-focus: #195ab4`.
- **Text emphasis:** high `rgba(0,0,0,0.96)`, medium `rgba(0,0,0,0.8)`, low `rgba(0,0,0,0.64)`, disabled `rgba(0,0,0,0.4)` (`--on-color-emphasis-*`, `--action-neutral-emphasis-*`).
- **Actions:** `--action-main-enabled #195ab4`, hover `#3e75c0`, pressed `#134489`. Text on main actions is white at 96% opacity. Secondary action hover is `#234f96`. Disabled fill is `rgba(0,0,0,0.1)` with text at `rgba(0,0,0,0.4)`. Neutral action: enabled `#ffffff`, hover `#e8e8e8`, selected `#e6e6e6`, pressed `#c2c2c2`.
- **Status:** success `#159e5c` (surface `#daece5`), warning `#f05800` (surface `#ffe7cc`), error `#eb3d47` (surface `#ffdbdd`), informative `#1f7dff` (surface `#d2e5ff`).
- **Financial indicators (the tokens for positive/negative numbers):** `--on-color-indicator-positive-base #128850` / surface `#d0ebdf`; `--on-color-indicator-negative-base #ce363f` / surface `#fccacc`; `--on-color-indicator-highlight-base #174e9f` / surface `#d2e5ff`. Dark-mode ("inverse") versions: positive `#62c395` on `#0e613a`, negative `#f2757c` on `#7a1f24`.
- **Supporting categorical palette (likely used for charts and categories):** 10-step ramps for brown, purple, aqua, lime, red, pink, grey, green, blue, orange, yellow and violet. Examples: `--support-aqua-60 #329fb5`, `--support-violet-60 #754cc5`, `--support-yellow-50 #ffca43`, `--support-orange-50 #ff7e44`, `--support-pink-60 #c0549c`, `--support-lime-60 #6baa23`.
- **Skeleton loading:** shimmer gradient `#e0e0e1 → #bababb` in light mode and `#5c5d6c → #2e2e38` in dark mode (`--special-shimmer-*`).

### Inferences
- The "support" ramps are the most likely source of chart and allocation-donut colors (portfolio by asset class), since the core palette has only one brand hue. This is inferred from the naming; I didn't see it in a rendered chart.
- For P&L numbers, use `indicator-positive/negative` (the darker `#128850` / `#CE363F`) for text, not the `status-*` tokens. The indicator values are darker, which suggests they were tuned for text contrast.

### Gaps
- No token file for chart-specific colors or number formatting was found. Brazilian conventions (R$ 1.234,56, +1,23%) are standard for BRL apps, but no BTG source confirming BTG's exact sign/arrow treatment was fetched.

## 3. Geometry: radius, shadows, density, grid, typography

### Takeaway
BTG's web UI is mostly flat. Radii are small (4px on small controls, 8px on cards and modals, fully rounded pills). Shadows are rare and soft. Focus is shown with a 2px blue ring. Everything uses a single typeface at weight 400, with hierarchy carried by size (32/24/16/14/12) rather than weight.

### Cited Findings (source: [empresas.btgpactual.com](https://empresas.btgpactual.com/) HTML + `main-Y6I4NF5Z.js`, and [btgpactual.com/investimentos](https://www.btgpactual.com/investimentos) HTML)
- **Border-radius counts:** `4px` ×10, `8px` (and `8px 8px 0 0` for top-rounded sheets/cards), `1000px` (pills), `50%` (avatars/icon buttons). No values above 8px except pills.
- **Shadows:** mostly focus rings, `box-shadow: 0 0 0 2px var(--outline-base-focus)`. Card and elevation shadows are light: `0 1px 8px rgba(0,0,0,.16)` and, for the modal, `0 3px 18px #39445614, 0 12px 48px #3944563d`. Hairline borders come from `0 0 0 1px var(--outline-base)`.
- **Typography:** `font-weight:400` appears 60 times on the Empresas home and 12 times in its bundle; `700` appears once. Font sizes seen: 40, 32, 28, 24, 18, 16, 14, 12, 10px. Line-heights are `150%` (body) and `125%` (headings).
- **Layout/grid** (btgpactual.com/investimentos): `--btg-grid-max-width` is `calc(100% - 48px)` on mobile, then 936px (≥1024), 1032px (≥1280), 1224px (≥1366), 1320px (≥1440), 1416px (≥1920). `--mdc-layout-grid-margin-desktop: 24px` points to a Material Components grid base. Header height is 56px on mobile and 72–80px on desktop.
- **Icons:** the Empresas site uses an icon font, `icomoon-orquestra`, and the investimentos page also loads `Material Icons`.

### Inferences
- "Feels like BTG" means flat white cards on a #F5F5F6 page with 1px `rgba(0,0,0,.16)` borders or a very soft shadow, 8px card radius, 4px input/button radius or pill buttons, weight-400 text, and blue #195AB4 as the only saturated color outside of P&L.
- Buttons are probably solid #195AB4 with white text for primary, outline or blue-text for secondary, and neutral white-to-grey hover for tertiary. This is inferred from the `action-main/secondary/neutral` token sets. I didn't inspect a rendered button's CSS.
- The icon style is most likely a monoline/outline set (Material Icons plus a custom IcoMoon font), but the stroke weight couldn't be verified. See Gaps.

### Gaps
- The glyph shapes and stroke weight of `icomoon-orquestra` weren't inspected. The font file could be downloaded and rendered to check.
- Button and input heights weren't confirmed (only `height:32px` and `48px` appear in the Empresas CSS).

## 4. Dark vs light mode: which surfaces are dark navy?

### Takeaway
Orquestra v7 **has a full dark theme**, but it is neutral near-black (#101010 background, #1F2023 cards), not navy. Dark navy (#05132A / #0B2859) appears as **brand-surface heroes** on marketing and product pages (`btg-hero appearance="dark-blue"`), not as the app background. The public web (Empresas, Investimentos marketing) loads the light theme. As of the most recent developer reply I found (May 2024), the **investments iOS app did not offer a dark mode that follows the system setting**.

### Cited Findings
- Dark theme tokens: `--background-base #101010`, `--neutral-base #1f2023` (cards), `--neutral-extended-10 #252629`, `--neutral-extended-100 #f2f2f2` (text end of ramp), `--outline-base rgba(255,255,255,.16)`, status success `#62c395`, error `#f76970`, warning `#ff8752`, informative `#4795ff`. `--primary-base` stays `#195ab4`. — [dark theme CSS](https://orquestracdn.btgpactual.com/themes/v7/btg_styles_darkmode.theme.css)
- The light theme also carries `*-inverse` tokens (`--background-base-inverse #101010`, `--neutral-base-inverse #1f2023`), so dark sections can sit inside light pages. — [light theme CSS](https://orquestracdn.btgpactual.com/themes/v7/btg_styles_lightmode.theme.css)
- The Empresas home hero uses `<btg-hero appearance="dark-blue">`. — [empresas.btgpactual.com](https://empresas.btgpactual.com/)
- On the BTG Pactual Investimentos App Store page, a 2020 user review asked for dark mode that follows iOS settings. BTG replied on 2024-05-20 that it "will evaluate this possibility". Recent release notes (v7.6.190) are generic "bug fixes". — [App Store (CA)](https://apps.apple.com/ca/app/btg-pactual-investimentos/id1041958375)

### Inferences
- The widespread idea that "the BTG investments app is dark UI" isn't supported by anything I found. The design system's default is light, and dark exists as a theme. The trading app (BTG Pactual Trader / home broker) may default to dark, which is common for trading platforms, but I couldn't verify that.
- For a "BTG-native" web UI: use a light default, dark-blue brand heroes/banners, and an optional dark theme with neutral greys, not navy.

### Gaps
- Screenshots of the Banking, Investimentos and Trader apps weren't viewable, so I couldn't confirm per-app dark/light defaults for 2026.
- It's unconfirmed whether the dark theme is exposed to users in any app, or only to specific surfaces or the Watch app.

## 5. Per-product notes, navigation, redesigns (2022–2026)

### Takeaway
Public evidence is thin. There was a 2022 investments-app redesign focused on navigation clarity and per-product performance views, and a 2025 iF Design award for the AI-driven Banking app. Both confirm modular cards, a "My Finances" spending view, an AI assistant, and an Apple Watch companion. No source describes the navigation chrome (bottom tabs vs sidebar).

### Cited Findings
- **Investimentos app redesign (Mar 15, 2022, historical):** "based on customer feedback". It covers intuitive navigation, clearer access to product info/rules before transacting, returns shown per product and broken down "by market and by strategy", AutoInvest, direct advisor chat, and content (videos/articles/lives). — [Migalhas](https://www.migalhas.com.br/coluna/investimentos-financeiros/361425/novo-app-do-btg-pactual-mais-intuitivo-e-novas-funcoes)
- **BTG Banking (iF Design winner):** an AI-driven ecosystem with real-time insights, enriched transactions, a "My Finances" view of spending patterns, "modular cards", advanced security layers and a conversational assistant, running on Orquestra from app to smartwatch. — [iF Design](https://ifdesign.com/en/winner-ranking/project/btg-ai-driven-banking-experience/767529) (search snippet)
- **Apple Watch app** exists ("BTG Pactual - App Watch", id6738363597). — [App Store](https://apps.apple.com/us/app/btg-pactual-app-watch/id6738363597)
- Current app lineup on the stores: BTG Pactual Investimentos (`com.btg.pactual.digital.mobile`), BTG Pactual Banking (`com.btg.pactual.banking`), BTG Pactual Trader (`com.btg.pactual.homebroker.mobile`), BTG Pactual Parceiros. — [Google Play Investimentos](https://play.google.com/store/apps/details?id=com.btg.pactual.digital.mobile&hl=en_US), [Banking](https://play.google.com/store/apps/details?id=com.btg.pactual.banking), [Trader](https://play.google.com/store/apps/details?id=com.btg.pactual.homebroker.mobile&hl=en_US), [Parceiros](https://apps.apple.com/us/app/-/id1423243100)
- Euromoney named BTG Pactual "Latin America's best for digital solutions 2025" (private banking). — [Euromoney](https://www.euromoney.com/article/2eeghms0rod7fdjm2v75t/awards/private-banking-awards/latin-americas-best-for-digital-solutions-2025-btg-pactual/)
- **Web:** the public sites share one global menu web component (`btg-pactual-menu`) across btgpactual.com properties. Logged-in web lives on separate subdomains (`investimentos.btgpactual.com`, `banking.btgpactual.com`, `id.btgpactual.com` for login). — [empresas.btgpactual.com](https://empresas.btgpactual.com/) page source

### Inferences
- The mobile apps probably use standard bottom-tab navigation, which is the norm for Brazilian banking apps. This is not verified for BTG.
- "BTG+" appears to have been folded into "BTG Pactual Banking" (no current "BTG+" store listing surfaced). This is unverified.

### Gaps
- No UX reviews, Dribbble shots or BTG tech-blog posts describing the logged-in UI were found. Behance only has third-party student case studies (e.g., [Behance search "btg pactual"](https://www.behance.net/search/projects/btg%20pactual)), which aren't authoritative.
- Chart styles (line vs area, gridlines, donut allocation) and table density in the logged-in investment platform couldn't be verified without screenshots.
- Photography and illustration style was not researched here. It likely belongs to the brand-identity notes ([brand center](https://brandcenter.btgpactual.com/guia-visual)).

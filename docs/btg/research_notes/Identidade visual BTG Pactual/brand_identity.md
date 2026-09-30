# Identidade visual BTG Pactual: sistema azul/branco (estado em 2026-09)

Method note: most hex values below were read directly from BTG's live production CSS on 2026-09-29 (curl of the pages and stylesheets). `www.btgpactual.com` returns an Akamai "Access Denied" (HTTP 403) to non-browser clients, so the corporate homepage CSS itself could not be inspected. The subdomains `empresas.btgpactual.com`, `investimentos.btgpactual.com`, `ri.btgpactual.com` and `brandcenter.btgpactual.com` could be, and all of them load the same shared design-system CDN (`orquestracdn.btgpactual.com`, design system "Orquestra", theme v7).

## 1. Official brand colors (hex / RGB / Pantone), by surface

### Takeaway
There are two blues. The **logo navy is `#001E61`**, a single flat fill in the official SVG. The **digital UI system (Orquestra v7)** is built on a 10-step blue ramp whose **primary is `#195AB4`**, secondary `#10408D`, and darkest brand surface `#05132A`. The same Orquestra theme is shared across Empresas, Investimentos and Brand Center, so there is no separate palette per business unit at the token level. No Pantone or CMYK values were found in any public source.

### Cited Findings

**Logo color**
- The official logo SVG (`btg-logo-blue.svg`, originally served at `https://www.btgpactual.com/assets/images/btg-logo-blue.svg`, mirrored on Wikimedia Commons and uploaded 2020-10-20) is one `<path>` with `fill="#001e61"`, viewBox `0 0 398 158`. `#001E61` = RGB(0, 30, 97). Sources: [Wikimedia Commons: File:Btg-logo-blue.svg](https://commons.wikimedia.org/wiki/File:Btg-logo-blue.svg), [SVG original](https://upload.wikimedia.org/wikipedia/commons/c/c2/Btg-logo-blue.svg)
- The 2020 rebrand moved to "a single shade of navy blue, in contrast with a more grayish and lighter blue from the previous logo." Source: [Brandemia, 2020-09-17](https://brandemia.org/btg-pactual-estrena-una-nueva-identidad-abierta-al-mundo)
- Press at launch described the new identity as "mais moderna e com novos tons de azul" (more modern, with new shades of blue). Source: [Marcas Mais](https://marcasmais.com.br/minforma/noticias/negocios/btg-pactual-anuncia-nova-marca-e-apresenta-btg-e-btg-business/)

**Orquestra v7 light theme: brand/primary ramp** ([btg_styles_lightmode.theme.css](https://orquestracdn.btgpactual.com/themes/v7/btg_styles_lightmode.theme.css))

| Token | Hex |
|---|---|
| `--primary-extended-10` | `#D2E5FF` |
| `--primary-extended-20` | `#B1D2FF` |
| `--primary-extended-30` | `#87BAFF` |
| `--primary-extended-40` | `#6BAAFF` |
| `--primary-extended-50` | `#549CFF` |
| `--primary-extended-60` | `#307AE0` |
| `--primary-extended-70` = **`--primary-base`** | **`#195AB4`** |
| `--primary-extended-80` = **`--secondary-base`** | **`#10408D`** |
| `--primary-extended-90` | `#0B2859` |
| `--primary-extended-100` | `#05132A` |

- Brand surfaces: `--surface-brand-01 #05132A` (deepest navy), `-02 #0B2859`, `-03 #10408D`, `-04 #195AB4`, `-05 #6BAAFF`. Text on brand surfaces 01 to 04 is white at 96% / 80% / 74% opacity (high / medium / low emphasis), with outline `rgba(255,255,255,0.16)`. Text on surface 05 (light blue) is black at 96% / 80% / 64%. Source: same CSS.
- Focus ring: `--outline-base-focus #195AB4`. Default outline: `rgba(0,0,0,0.16)`. Source: same CSS.
- Secondary action states: enabled `#10408D`, hover `#234F96`, pressed `#0C316B`. On dark (inverse): enabled `#87BAFF`, hover `#90BFFF`, pressed `#719CD6`. Source: same CSS.
- A separate "support-blue" ramp is almost identical but differs at the dark end: 80 `#174E9F`, 90 `#123570`, 100 `#0B2859`. Source: same CSS.

**Neutrals / backgrounds** (same CSS)
- `--background-base #F5F5F6` (page background, light), `--background-base-inverse #101010`.
- `--neutral-base #FFFFFF` (cards and surfaces), `--neutral-base-inverse #1F2023`.
- Neutral ramp 10 to 100: `#FFFFFF, #F5F6F9, #D7DBDF, #B8BEC4, #959CA2, #61686E, #464C51, #34383C, #272A2E, #1B1E20` (cool, slightly blue-tinted greys).
- Text is done with black/white opacity, not hex: high `rgba(0,0,0,0.96)`, medium `0.80`, low `0.64`, disabled `0.40`. Inverse versions use white at `0.96 / 0.80 / 0.74 / 0.40`.
- Neutral action hover `#E8E8E8`, selected `#E6E6E6`, pressed `#C2C2C2`.

**Status colors** (same CSS)
- Success `#159E5C` (surface `#DAECE5`), Error `#EB3D47` (surface `#FFDBDD`), Warning `#F05800` (surface `#FFE7CC`), Informative `#1F7DFF` (surface `#D2E5FF`).
- Indicator text: positive `#128850`, negative `#CE363F`, highlight `#174E9F`.

**Support (data-viz / illustration) ramps**, 10 steps each (same CSS): aqua, brown, green, grey, lime, orange, pink, purple, red, violet, yellow, blue. Mid (50) values: aqua `#45B6CD`, brown `#AA7A64`, green `#2DB071`, grey `#9A9A9A`, lime `#7EB63E`, orange `#FF7E44`, pink `#C768A7`, purple `#5B66CD`, red `#ED515A`, violet `#8562CB`, yellow `#FFCA43`. The full ramps are in the CSS file.

**Dark mode**
- [btg_styles_darkmode.theme.css](https://orquestracdn.btgpactual.com/themes/v7/btg_styles_darkmode.theme.css) is the same size (12,317 bytes) and **inverts the primary ramp**: `--primary-extended-10 #05132A` through `-40 #195AB4` and so on. The dark theme is a mirror of the light one, not a separate palette.

**Per-surface observations**
- **BTG Empresas** (`empresas.btgpactual.com`) loads the Orquestra v7 light theme. Its inline HTML also uses `#05132A`, `#10408D`, `#071833`, `#F5F5F6`, `#E6E7EA`, `#101010`. Source: [empresas.btgpactual.com](https://empresas.btgpactual.com/)
- **BTG Pactual investimentos** (`investimentos.btgpactual.com`) sets `<meta name="theme-color" content="#195AB4">`. Its compiled CSS also contains many `#3F51B5 / #FF4081 / #F44336`. Those are Angular Material's default Indigo/Pink theme leaking through the framework, not brand colors. Source: [investimentos.btgpactual.com](https://investimentos.btgpactual.com/)
- **Brand Center** (`brandcenter.btgpactual.com/guia-visual`), BTG's own public brand guide, is an Angular SPA on the same Orquestra CDN and font. Its content is rendered by obfuscated JS, so the guide text (colors, clear space and so on) could not be extracted without a browser. Source: [Brand Center | Guia visual](https://brandcenter.btgpactual.com/guia-visual)
- **RI** (`ri.btgpactual.com`) is an Astro site. No brand hex values appear in the HTML. Source: [ri.btgpactual.com](https://ri.btgpactual.com/)

### Inferences
- For design tokens: use `#001E61` for the logo and wordmark only, `#195AB4` as the interactive/primary blue (buttons, links, focus), `#10408D` as secondary, and `#05132A` / `#0B2859` as deep navy hero or section backgrounds, on `#F5F5F6` page and `#FFFFFF` cards. This matches how the Orquestra tokens are wired: `surface-brand-01` is the navy block and `primary-base` is the action color.
- The logo navy `#001E61` sits between Orquestra's `#0B2859` and `#05132A` but is more saturated. It is not a token in the UI CSS, so the logo color and the UI ramp are managed separately.
- Estimate, not sourced: `#001E61` is visually very close to Pantone 2758 C / 281 C territory. Treat any Pantone as unverified.
- BTG+ (the retail app launched in 2020) appears to have been folded into the main "BTG Pactual" app and web presence. The Empresas and investimentos sites now run on the same Orquestra theme with no visible separate BTG+ palette. This is inferred from the shared CSS; no press confirmation was found.

### Gaps
- No official Pantone, CMYK or RGB print specs were found in public sources. The Brand Center page probably has them but is JS-rendered.
- The main `www.btgpactual.com` CSS could not be inspected (Akamai 403 to non-browser clients).
- The exact color of the pre-2020 logo was not found. It is described only as a "more grayish and lighter blue" ([Brandemia](https://brandemia.org/btg-pactual-estrena-una-nueva-identidad-abierta-al-mundo)).
- Brandfetch (`brandfetch.com/btgpactual.com`) returned 403, so its palette was not checked.

## 2. Typeface(s)

### Takeaway
BTG uses a **proprietary custom typeface, "BTG Pactual Sans"**, made by the Brazilian foundry **Plau** (from the font's embedded foundry metadata). It is served from BTG's CDN in six styles and used as the only UI/body font across the web properties, with fallback `Helvetica, sans-serif`. It is not licensed for third parties. Free substitutes are given below as estimates.

### Cited Findings
- `@font-face{font-family:'BTG Pactual Sans';src:url('https://orquestracdn.btgpactual.com/fonts/Btg-fonts/BTGPactualSans-Regular.woff2')...font-weight:400;font-display:swap}`. Source: [empresas.btgpactual.com/styles/global.css](https://empresas.btgpactual.com/styles/global.css)
- Font stacks in production: `'BTG Pactual Sans', Helvetica` (Empresas HTML, 29 uses of `font-family:BTG Pactual Sans`) and `BTG Pactual Sans,Helvetica,sans-serif` (investimentos CSS). The Brand Center body is `font-family:BTG Pactual Sans;font-weight:400`. Sources: [empresas.btgpactual.com](https://empresas.btgpactual.com/), [investimentos.btgpactual.com](https://investimentos.btgpactual.com/), [brandcenter.btgpactual.com](https://brandcenter.btgpactual.com/guia-visual)
- These files exist on the CDN (HTTP 200, about 31 to 33 KB woff2 each): `BTGPactualSans-Light`, `-Regular`, `-Italic`, `-SemiBold`, `-Bold`, `-Black`. `-Medium` returns 403 (not present). Source: `https://orquestracdn.btgpactual.com/fonts/Btg-fonts/` (probed directly)
- The embedded font metadata (read with `fc-scan`) says family "BTG Pactual Sans", foundry "**Plau**", version 1.0. Plau is a type foundry based in Rio de Janeiro. Source: the font file above.
- Weights used in the investimentos CSS: 400 (16 uses), 800 (9), 700 (1). Source: [investimentos CSS](https://investimentos.btgpactual.com/styles-M7CY33BF.css)
- Press description of the 2020 type: "a typeface that is more approachable, contemporary, and adaptable" with "rounded finishes and varying font weights." Source: [Brandemia](https://brandemia.org/btg-pactual-estrena-una-nueva-identidad-abierta-al-mundo)
- Brand New tagged the 2020 logo as "lowercase." Source: [Brand New / UnderConsideration, 2020-10-07](https://www.underconsideration.com/brandnew/archives/new_logo_for_btg_pactual_by_futurebrand.php)
- Icons are a custom icon font, `icomoon-orquestra` (v38), also on the Orquestra CDN. Source: [empresas global.css](https://empresas.btgpactual.com/styles/global.css)

### Inferences
- The Plau attribution comes from font metadata, not from a press release. It is strong evidence, but no public Plau case study was found to confirm it.
- **Free substitutes (ESTIMATE, not visually checked side by side):** a geometric-humanist grotesque with softened/rounded terminals. Candidates on Google Fonts: **Figtree**, **Plus Jakarta Sans**, **Manrope**, **Nunito Sans**. Figtree or Plus Jakarta Sans are the safest defaults for a neutral banking UI. Keep the Helvetica/Arial fallback that BTG itself uses.
- Suggested weights for a token set that mirrors BTG's: 300 / 400 / 600 / 700 / 900. BTG's CSS asks for 800, which the browser renders from the nearest face (Black 900 or Bold 700).

### Gaps
- No official statement naming the typeface, its designer, or when it was commissioned was found.
- The type scale (sizes and line heights) was not extracted. Orquestra's typography tokens are not in the theme CSS.

## 3. Logo: construction, rules, versions, history

### Takeaway
The current logo dates from the **September 2020 rebrand by FutureBrand São Paulo**. It is a single-color navy (`#001E61`) mark and lowercase wordmark, with a circular element according to Brand New's tags. It replaced a two-tone, lighter and greyer blue logo. Clear-space and minimum-size rules exist on BTG's Brand Center but could not be extracted.

### Cited Findings
- Agency: "O projeto foi desenvolvido pela FutureBrand São Paulo." The renewal "se propõe a seguir uma linha mais moderna e com diferenciação entre as unidades de negócios." Source: [Meio & Mensagem](https://www.meioemensagem.com.br/marketing/btg-pactual-lanca-banco-digital-e-plataforma-para-pmes)
- Launch date: Monday 14 September 2020, together with BTG+ (retail digital bank) and BTG+ business (SME platform). The identity was built "para acompanhar a evolução do banco para um universo cada vez mais digital." Source: [TI Inside, 2020-09-14](https://tiinside.com.br/14/09/2020/btg-pactual-anuncia-nova-marca-e-apresenta-btg-e-btg-business/); also [Marcas Mais](https://marcasmais.com.br/minforma/noticias/negocios/btg-pactual-anuncia-nova-marca-e-apresenta-btg-e-btg-business/)
- Brand New "Spotted" post, "New Logo for BTG Pactual by FutureBrand," 2020-10-07, tagged *blue*, *circle*, *lowercase*. There was no critique; the full content is paywalled. Source: [Brand New](https://www.underconsideration.com/brandnew/archives/new_logo_for_btg_pactual_by_futurebrand.php)
- Change summary: from a two-color logo to "a single shade of navy blue"; the goal was to "bring the bank closer to new generations." Source: [Brandemia](https://brandemia.org/btg-pactual-estrena-una-nueva-identidad-abierta-al-mundo)
- Official SVG: one compound path, single fill `#001E61`, viewBox 398×158 (aspect ratio about 2.52:1, so a horizontal lockup). Source: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Btg-logo-blue.svg), credited to `btgpactual.com/assets/images/btg-logo-blue.svg`
- Official brand guide location: [brandcenter.btgpactual.com](https://brandcenter.btgpactual.com/) ("Brand Center | Guia de marca do BTG Pactual"), with a "guia-visual" section.
- An older Behance project, "Brand BTG Pactual" (gallery 62975415, a 2018 upload based on its ID range), exists but returned 403. Its author and scope are unverified. Source: [Behance](https://www.behance.net/gallery/62975415/Brand-BTG-Pactual)
- Corporate naming history: Pactual DTVM founded 1983 in Rio; UBS bought it in 2006 (UBS Pactual); André Esteves founded BTG in 2008; BTG bought UBS Pactual in 2009, forming Banco BTG Pactual. Source: [Wikipedia](https://en.wikipedia.org/wiki/BTG_Pactual)

### Inferences
- Because the logo file is a single path with one fill, monochrome versions are easy: an all-white reversed version on `#05132A` / `#001E61` backgrounds is standard practice. BTG's own UI puts white text on `surface-brand-01`. The official reversed-version rules themselves were not found.
- The "BTG Pactual" name is still the master brand in 2026. Sub-products ("BTG+", "BTG Empresas", "BTG Pactual investimentos") appear as descriptors on the shared visual system. BTG+ was a 2020 sub-brand, and current web properties use "BTG Pactual" plus the product name.

### Gaps
- Clear-space, minimum-size, prohibited-use and color-version rules were not found in any fetchable source. They are probably on brandcenter.btgpactual.com (JS-rendered; would need a real browser).
- The exact geometry of the symbol was not documented in accessible sources: Brand New's tags imply a circle, but no text describes its construction.
- No FutureBrand case study page for BTG was found. The FutureBrand São Paulo and iF Design pages did not show up with BTG content.
- No evidence was found of any rebrand after 2020 (2021 to 2026). Searches for 2025/2026 identity updates turned up only the 2020 launch coverage.

## 4. Press on the brand refresh

### Takeaway
Coverage is thin and only about the launch (September/October 2020). It confirms FutureBrand São Paulo, the single navy tone, a more "approachable" rounded typography, and the tie-in with BTG+ and BTG+ business. No in-depth agency case study (Behance, FutureBrand site) was accessible.

### Cited Findings
- [Meio & Mensagem](https://www.meioemensagem.com.br/marketing/btg-pactual-lanca-banco-digital-e-plataforma-para-pmes): names FutureBrand São Paulo; "diferenciação entre as unidades de negócios."
- [TI Inside, 2020-09-14](https://tiinside.com.br/14/09/2020/btg-pactual-anuncia-nova-marca-e-apresenta-btg-e-btg-business/): launch date and digital positioning.
- [Marcas Mais](https://marcasmais.com.br/minforma/noticias/negocios/btg-pactual-anuncia-nova-marca-e-apresenta-btg-e-btg-business/): "novos tons de azul."
- [Brandemia, 2020-09-17 (updated 2024-01-23)](https://brandemia.org/btg-pactual-estrena-una-nueva-identidad-abierta-al-mundo): typography and color details; a quote from Juan Rafael Pérez (CEO, BTG Colombia).
- [Brand New, 2020-10-07](https://www.underconsideration.com/brandnew/archives/new_logo_for_btg_pactual_by_futurebrand.php): before/after images only.
- The Propmark article "BTG Pactual apresenta logo e marcas da sua expansão" is indexed by search, but [the URL](https://propmark.com.br/btg-pactual-apresenta-logo-e-marcas-da-sua-expansao/) returned 404.

### Gaps
- No agency-authored case study with rationale, grids or construction drawings was found.
- The Propmark article was unavailable (404).

# Reference Visual Design System

## 6.1 Layout

| Token / Pattern | Value | Status | Evidence |
|---|---:|---|---|
| Page max width | 1280 px | Verified | `max-w-7xl`; measured at 1440 viewport |
| Header height | 64 px | Verified | DOM rect |
| Desktop page padding | 32-80 px depending viewport | Estimated | Container x positions |
| Tablet page padding | 24 px | Estimated | 768/1024 measurements |
| Mobile page padding | 16 px | Verified/estimated | 390/430 measurements |
| Hero desktop columns | `1fr` + 520 px | Verified | Rendered class `lg:grid-cols-[1fr_520px]` |
| Feature grid | 3 columns desktop, 1 column mobile | Verified | Screenshot and DOM |
| Use-case grid | 4 columns desktop, 1 column mobile | Verified | Screenshot |
| Section spacing | 64 px vertical padding | Verified | `py-16` classes |

The layout uses constrained content containers inside full-width sections. Background bands alternate between white and very light muted surfaces. Cards are never visually nested inside heavier cards, except for the hero product preview where nested surfaces intentionally simulate an app panel.

## 6.2 Typography

| Element | Estimated / Verified Value | Status | Notes |
|---|---|---|---|
| Font family | Inter, Noto Sans SC, PingFang SC, Microsoft YaHei, system UI | Verified | `bodyFont` computed style |
| Logo text | 20 px, bold | Verified | DOM computed measurement |
| Hero heading desktop | 60 px at 1440/1280/1024 | Verified | responsive inspection |
| Hero heading tablet | 48 px at 768 | Verified | responsive inspection |
| Hero heading mobile | 30-36 px | Verified | responsive inspection |
| Section heading | ~30 px | Estimated | Tailwind `text-3xl` |
| Card heading | 18-20 px | Estimated | `text-lg` / `text-xl` |
| Body text | 14-20 px depending context | Estimated | Tailwind classes |
| Label/caption | 12-14 px | Estimated | badges, status, nav |
| Line height | Relaxed in hero body, normal in cards | Estimated | `leading-8`, card rhythm |
| Letter spacing | Tight hero tracking | Verified | `tracking-tight` on hero heading |

Chinese and English mixed text is handled with a Chinese fallback stack, while the Latin-first Inter choice keeps numbers and UI labels crisp.

## 6.3 Colors

Verified CSS variables use OKLCH:

| Role | Value | Status |
|---|---|---|
| Background | `oklch(100% 0 0)` | Verified |
| Foreground | `oklch(14.8% .004 228.8)` | Verified |
| Card | `oklch(100% 0 0)` | Verified |
| Primary | `oklch(50% .134 242.749)` | Verified |
| Primary foreground | `oklch(97.7% .013 236.62)` | Verified |
| Muted | `oklch(96.3% .002 197.1)` | Verified |
| Muted foreground | `oklch(56% .021 213.5)` | Verified |
| Border | `oklch(92.5% .005 214.3)` | Verified |
| Ring | `oklch(72.3% .014 214.4)` | Verified |

Observed accents include blue, cyan, violet, emerald for success/online state, and muted gray-blue text. Gradients are used for primary CTAs, headline emphasis, icon tiles, and large blurred background glows.

## 6.4 Shape And Depth

| Element | Estimated Value | Status |
|---|---:|---|
| Base radius variable | 10 px (`.625rem`) | Verified |
| Button radius | 8-12 px | Estimated |
| Card radius | 12-16 px | Estimated |
| Hero preview radius | 16-24 px | Estimated |
| Badge radius | Full pill | Verified visually |
| Border thickness | 1 px | Verified via utility classes |
| Shadow style | Soft low-opacity blue/primary shadows | Verified visually |
| Glass effect | Card backdrop blur in hero | Verified via classes |

Depth is restrained. Shadows support hierarchy but do not dominate. The strongest elevation appears on the hero product preview and active sample card.

## 6.5 Spacing

| Spacing Use | Estimated Value | Status |
|---|---:|---|
| Base spacing unit | 4 px | Inferred from Tailwind utilities |
| Navigation item gap | 24-32 px | Verified/estimated |
| Hero top padding | 96-112 px | Verified from classes |
| Section vertical padding | 64 px | Verified |
| Card padding | 24 px | Verified via classes |
| Form/input preview padding | 12-20 px | Verified via classes |
| Grid gaps | 24-32 px | Estimated |
| Mobile section spacing | 64 px but visually elongated by stacked cards | Verified/estimated |

## Visual Strengths

- The blue/violet accent system creates a coherent AI/SaaS feel.
- The product preview grounds the abstract AI promise in a concrete workflow.
- White cards on pale muted bands keep dense text readable.
- Role and platform segmentation are visually simple and easy to scan.

## Visual Risks

- The palette leans strongly blue/violet; an original adaptation should shift hue balance and brand assets.
- Many card grids can become monotonous.
- Long public-example text blocks create mobile density and scanning fatigue.
- Focus states exist in classes, but visual strength needs keyboard verification.


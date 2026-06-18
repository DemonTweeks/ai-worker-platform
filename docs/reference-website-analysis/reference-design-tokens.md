# Estimated Design Tokens

These tokens are an analytical approximation for future original work. Verified values come from rendered CSS variables or measured DOM data. Estimated values should not be treated as exact source values.

## Color Tokens

| Token | Estimated Value | Status | Usage |
|---|---|---|---|
| `color-background` | `oklch(100% 0 0)` | Verified | Page background |
| `color-background-secondary` | `oklch(96.3% .002 197.1)` | Verified | Muted section bands |
| `color-surface` | `oklch(100% 0 0)` | Verified | Cards and panels |
| `color-surface-muted` | `oklch(96.3% .002 197.1 / 0.3-0.4)` | Estimated | Light card fills |
| `color-surface-elevated` | `oklch(100% 0 0 / 0.95)` | Estimated | Hero preview |
| `color-text-primary` | `oklch(14.8% .004 228.8)` | Verified | Headings and primary UI text |
| `color-text-secondary` | `oklch(35% .012 220)` | Estimated | Body copy |
| `color-text-muted` | `oklch(56% .021 213.5)` | Verified | Captions, helper text |
| `color-border` | `oklch(92.5% .005 214.3)` | Verified | Card/input borders |
| `color-border-strong` | `oklch(80% .03 230)` | Estimated | Hover/active outlines |
| `color-accent` | `oklch(50% .134 242.749)` | Verified | Links, primary buttons, icon color |
| `color-accent-hover` | `oklch(45% .14 242)` | Estimated | Hovered primary states |
| `color-accent-active` | `oklch(40% .13 242)` | Estimated | Pressed states |
| `color-success` | `#10b981` / emerald | Estimated | Online status and check icons |
| `color-warning` | `#f59e0b` | Estimated | Not prominent on homepage |
| `color-error` | `#ef4444` | Estimated | Failure task status on task page |
| `color-info` | `#0ea5e9` | Estimated | Link/info accents |
| `color-focus` | `oklch(72.3% .014 214.4)` | Verified | Focus ring token |
| `color-disabled` | `oklch(92% .004 214)` | Estimated | Disabled surfaces |

## Radius Tokens

| Token | Estimated Value | Status | Usage |
|---|---:|---|---|
| `radius-xs` | 4 px | Estimated | Small icons or subtle controls |
| `radius-sm` | 6 px | Estimated | Small buttons |
| `radius-md` | 10 px | Verified | Base radius variable |
| `radius-lg` | 12 px | Estimated | Buttons and inputs |
| `radius-xl` | 16 px | Estimated | Cards and panels |
| `radius-full` | 9999 px | Verified visually | Pills and badges |

## Shadow Tokens

| Token | Estimated Value | Status | Usage |
|---|---|---|---|
| `shadow-xs` | `0 1px 2px rgb(15 23 42 / 0.06)` | Estimated | Small buttons |
| `shadow-sm` | `0 2px 8px rgb(15 23 42 / 0.06)` | Estimated | Cards |
| `shadow-card` | `0 10px 30px rgb(14 165 233 / 0.08)` | Estimated | Hover cards |
| `shadow-modal` | `0 24px 60px rgb(15 23 42 / 0.18)` | Estimated | Dialogs if used |
| `shadow-floating` | `0 20px 50px rgb(2 132 199 / 0.18)` | Estimated | Hero preview |

## Spacing Tokens

| Token | Estimated Value | Status | Usage |
|---|---:|---|---|
| `spacing-2xs` | 4 px | Inferred | Fine icon gaps |
| `spacing-xs` | 8 px | Inferred | Badge gaps |
| `spacing-sm` | 12 px | Inferred | Form internal spacing |
| `spacing-md` | 16 px | Inferred | Mobile padding |
| `spacing-lg` | 24 px | Verified/estimated | Card padding |
| `spacing-xl` | 32 px | Estimated | Grid gaps and CTA groups |
| `spacing-2xl` | 40 px | Estimated | Hero internal gaps |
| `spacing-section` | 64 px | Verified | Section vertical padding |
| `spacing-section-mobile` | 64 px | Verified/estimated | Mobile stacked sections |

## Layout Tokens

| Token | Estimated Value | Status | Usage |
|---|---:|---|---|
| `content-max-width` | 1280 px | Verified | Main containers |
| `content-reading-width` | 896 px | Verified/estimated | FAQ and centered text |
| `page-padding-desktop` | 32-80 px | Estimated | Container gutters |
| `page-padding-tablet` | 24 px | Estimated | Tablet gutters |
| `page-padding-mobile` | 16 px | Verified/estimated | Mobile gutters |
| `header-height` | 64 px | Verified | Sticky header |

## Typography Tokens

| Token | Estimated Value | Status | Usage |
|---|---|---|---|
| `font-family-primary` | `Inter, Noto Sans SC, PingFang SC, Microsoft YaHei, system-ui, sans-serif` | Verified | Body/UI |
| `font-size-xs` | 12 px | Estimated | Captions/status |
| `font-size-sm` | 14 px | Estimated | Nav, labels |
| `font-size-md` | 16 px | Estimated | Body/default |
| `font-size-lg` | 18 px | Estimated | Small headings |
| `font-size-xl` | 20 px | Verified/estimated | Logo/card headings |
| `font-size-2xl` | 24 px | Estimated | Result title |
| `font-size-hero` | 60 px desktop, 48 px tablet, 30-36 px mobile | Verified | Hero headline |
| `line-height-tight` | 1.1-1.2 | Estimated | Hero heading |
| `line-height-normal` | 1.5 | Estimated | UI text |
| `line-height-relaxed` | 1.75-2 | Estimated | Hero paragraph |
| `font-weight-normal` | 400 | Estimated | Body |
| `font-weight-medium` | 500 | Estimated | Nav/badges |
| `font-weight-semibold` | 600 | Estimated | Buttons/cards |
| `font-weight-bold` | 700 | Estimated | Headings |


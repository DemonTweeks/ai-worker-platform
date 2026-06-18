# Reference Information Architecture

## Method

The public homepage and primary navigation routes were inspected without logging in. Authenticated areas were not bypassed; login redirects are documented as access behavior.

## Page Map

| Page / Route | Purpose | Access Observed | Notes |
|---|---|---|---|
| `/` | Homepage, product overview, conversion entry | Public | Marketing/product hybrid |
| `/tasks` | Public task/example library | Public | Shows completed public analyses and filters; search requires login |
| `/tools` | Tool directory | Public | Lists video and content tools; usage may require login and credits |
| `/guide` | New-user onboarding guide | Public | Explains recommended workflow and common entries |
| `/developers/mcp` | MCP and API developer documentation | Public | Shows setup guidance, API key flow, available tools |
| `/about` | Company/team/about page | Public | Mission, values, team, community, public-account reminders |
| `/login` | Login form | Public | Email/password, Google login, registration link |
| `/register` | Registration form | Public | Username/email/password, optional invite code, Google registration |
| `/analysis` | Main analysis workflow | Redirects to login when unauthenticated | Observed as `/login?redirect=%2Fanalysis` |
| `/tools/video-download` | Video download URL tool | Redirects to login when unauthenticated | Observed as `/login?redirect=%2Ftools%2Fvideo-download` |
| `/solutions/douyin-video-summary` | Platform solution page | Public | SEO-oriented platform page |
| `/solutions/xiaohongshu-video-analysis` | Platform solution page | Public | SEO-oriented platform page |
| `/solutions/bilibili-video-summary` | Platform solution page | Public | SEO-oriented platform page |

## Header Structure

Verified desktop header:

- Left logo text links to home.
- Desktop navigation: Home, Tasks, Tools, Guide, MCP, About.
- Right side: small icon-only control, Login, Register.
- Active page receives a bottom border.
- Header height is approximately 64 px.
- Header is sticky and transparent at the top.

Verified mobile header:

- Logo remains left aligned.
- Desktop nav and auth links collapse.
- A small icon-only control remains near the menu button.
- Hamburger opens a full-width vertical mobile menu.
- Mobile menu includes primary nav items, then login/register separated by a divider.

## Homepage Section-By-Section Sitemap

| Order | Section | Purpose | Screenshot |
|---:|---|---|---|
| 1 | Header | Navigation, auth, brand anchoring | [desktop-header](screenshots/desktop-header.png), [mobile-header](screenshots/mobile-header.png) |
| 2 | Hero with interaction preview | Explain outcome and invite action | [desktop-hero](screenshots/desktop-hero.png), [mobile-hero](screenshots/mobile-hero.png) |
| 3 | Three compact benefit cards | Clarify users/jobs immediately after hero | [desktop-hero](screenshots/desktop-hero.png) |
| 4 | Analysis effect showcase | Show sample outputs and public-task style result | [desktop-analysis-preview](screenshots/desktop-analysis-preview.png) |
| 5 | Feature cards | Explain core capabilities | [desktop-features](screenshots/desktop-features.png) |
| 6 | Use cases | Segment audience by role | [desktop-use-cases](screenshots/desktop-use-cases.png) |
| 7 | Solutions | Segment by supported platforms | [desktop-solutions](screenshots/desktop-solutions.png) |
| 8 | FAQ | Resolve common objections | [desktop-faq](screenshots/desktop-faq.png) |

No conventional footer was visible in the captured homepage. This is a verified absence in the rendered public page, not an assumption about the wider application.

## Navigation Hierarchy

```text
Homepage
├── Tasks
│   └── Public analysis examples
├── Tools
│   ├── Video download URL parser
│   ├── Video summary / AI analysis
│   ├── Douyin profile works parser
│   └── WeChat article search
├── Guide
│   ├── Recommended first workflow
│   ├── Public-account usage articles
│   └── Common entry links
├── Developers
│   └── MCP documentation
├── About
├── Login
├── Register
└── Platform Solutions
    ├── Douyin video summary
    ├── Xiaohongshu video analysis
    └── Bilibili video summary
```

## Purpose By Area

- Marketing pages answer what the tool does, who it helps, and why it is worth trying.
- App/workflow routes answer how to act: analyze, retrieve download URLs, inspect task history, and manage tool usage.
- Developer routes broaden the product from a manual web app into an automatable workflow.
- Public task examples create proof by showing approximate outputs before login.


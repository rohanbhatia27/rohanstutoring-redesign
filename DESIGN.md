---
version: alpha
name: Rohan's GAMSAT
description: Dark navy authority with electric blue accents. Premium, editorial, conversion-focused GAMSAT coaching site.
colors:
  primary: "#1677BE"
  primary-hover: "#1a8ce0"
  primary-light: "#5BA4E0"
  ice-blue: "#A9D6F5"
  navy: "#080F1A"
  navy-mid: "#0D1827"
  navy-light: "#162236"
  navy-dark: "#050C16"
  white: "#FFFFFF"
  off-white: "#F4F7FB"
  cream: "#F9F7F3"
  text: "#0D1117"
  text-muted: "#4B5563"
  text-light: "#C9D5E4"
  text-dark-soft: "#D7E2EE"
  text-dark-muted: "#B8C7D8"
  border-soft: "#E5EAF0"
  border-strong: "#E0E8F2"
  success: "#10BF7A"
  indigo: "#7C6FE0"
  premium-gold: "#D4AF53"
  premium-gold-deep: "#B8922A"
  premium-ink: "#1A0F00"
typography:
  display:
    fontFamily: Figtree
    fontSize: clamp(2.6rem, 5.5vw, 6rem)
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: -0.035em
  headline:
    fontFamily: Figtree
    fontSize: clamp(1.9rem, 3.5vw, 3.25rem)
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: -0.035em
  title:
    fontFamily: Geist
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: Geist
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.7
  lead:
    fontFamily: Geist
    fontSize: clamp(1.14rem, 1.15vw, 1.34rem)
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: Geist
    fontSize: 0.75rem
    fontWeight: 700
    letterSpacing: 0.1em
  button:
    fontFamily: Geist
    fontSize: 0.95rem
    fontWeight: 600
    lineHeight: 1.3
  price:
    fontFamily: Figtree
    fontSize: 2.4rem
    fontWeight: 400
    lineHeight: 1
rounded:
  sm: 6px
  md: 12px
  lg: 20px
  xl: 32px
  pill: 100px
spacing:
  container: 1200px
  gutter: 24px
  section: 96px
  section-lg: 120px
  card: 36px
  stack: 16px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: 12px 28px
    typography: "{typography.button}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: 12px 28px
  button-outline:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    padding: 12px 28px
  button-gold:
    backgroundColor: "{colors.premium-gold}"
    textColor: "{colors.premium-ink}"
    rounded: "{rounded.pill}"
    padding: 12px 28px
  button-lg:
    padding: 16px 36px
  card-course:
    backgroundColor: "{colors.white}"
    textColor: "{colors.text}"
    rounded: "{rounded.xl}"
    padding: 40px 34px
  card-course-featured:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.white}"
    rounded: "{rounded.xl}"
  card-course-premium:
    backgroundColor: "{colors.navy-mid}"
    textColor: "{colors.white}"
    rounded: "{rounded.xl}"
  card-resource:
    backgroundColor: "{colors.white}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: 36px 32px
  eyebrow-label:
    textColor: "{colors.primary}"
    typography: "{typography.label}"
  nav-scrolled:
    backgroundColor: "rgba(8, 15, 26, 0.92)"
    textColor: "{colors.text-dark-soft}"
---

# Rohan's GAMSAT Design System

Source of truth for tokens is `css/style.css` (`:root`). This file describes the system as it ships today. If the two disagree, the CSS wins; update this file to match.

## Overview

The site sells GAMSAT coaching to high-achieving pre-med students who are anxious about a single high-stakes exam. The design has to carry **authority** (this person knows the exam), **calm** (you will be guided), and **momentum** (act now, cohorts fill).

The look is a dark navy stage with one electric blue accent, broken up by bright white and warm cream reading sections. It should feel like a premium editorial product, not a SaaS dashboard or an ed-tech template. Confident type, generous whitespace, few colours, hard contrast between dark "stage" sections and light "reading" sections.

Personality: precise, direct, quietly premium. Motion is restrained. Decoration only appears where it signals value, such as the gold premium tier.

## Colors

The palette is navy plus one accent. Everything else is neutral or has a single job.

**Surfaces**
- **Navy (#080F1A):** Default dark stage. Hero, booking CTA, featured course card, product heroes.
- **Navy Dark (#050C16):** Deepest layer. Footer and the "versus" comparison section.
- **Navy Mid (#0D1827):** Raised dark surface. Premium course card, free-resource strip.
- **Navy Light (#162236):** Tertiary dark surface for nested panels on navy.
- **White (#FFFFFF):** Primary light reading surface (How it works, FAQ, cards).
- **Off-white (#F4F7FB):** Cool alternate light section (Courses, Resources) so adjacent light sections separate without a border.
- **Cream (#F9F7F3):** Warm light section reserved for social proof and testimonials.

**Accent**
- **Blue (#1677BE):** The only action colour. Primary buttons, eyebrow labels, links, FAQ toggles, focus rings. Hover lifts to **#1a8ce0**.
- **Blue Light (#5BA4E0):** Accent on dark backgrounds, where #1677BE is too dim: kickers, logo "R", small arrows.
- **Ice Blue (#A9D6F5):** Soft highlight on navy for tinted text or chips.
- **Blue glow (rgba(22,119,190,0.25)):** Coloured shadow under primary buttons, and radial glows behind hero and CTA sections.

**Text**
- On light: **Text (#0D1117)** for headings and emphasis, **Text Muted (#4B5563)** for paragraphs.
- On dark: **White** for headings, **Text Light (#C9D5E4)** for body, **Text Dark Soft (#D7E2EE)** for nav links, **Text Dark Muted (#B8C7D8)** for tertiary copy.

**Semantic**
- **Green (#10BF7A):** Live status only (the pulsing "enrolments open" dot, success states). Never a CTA colour on marketing pages.
- **Indigo (#7C6FE0):** Occasional secondary data accent. Use sparingly.
- **Premium Gold (#D4AF53 → #B8922A):** Reserved for the top-tier offer (premium course card, premium badge, gold button). Text on gold is **Premium Ink (#1A0F00)**. Gold must never become a general accent, or it stops meaning "top tier".

**Borders**
- On dark: `rgba(255,255,255,0.08)`.
- On light: **#E5EAF0** (soft, dividers and resource cards) and **#E0E8F2** (strong, course cards).

## Typography

Two sans-serif families from Google Fonts: **Figtree** (400/600/700) for display, and **Geist** (400/500/600/700) for everything else.

- **Display (h1):** Figtree 700, `clamp(2.6rem, 5.5vw, 6rem)`, line-height 1.05 (0.98 in the hero), tracking -0.035em. Hero headlines are capped at roughly 12.5ch so they break into short, punchy lines.
- **Headline (h2):** Figtree 700, `clamp(1.9rem, 3.5vw, 3.25rem)`, same tight tracking.
- **Title (h3):** Geist 600, 1.25rem, line-height 1.3.
- **Lead:** Geist 600 at about 1.15 to 1.35rem, line-height 1.4, `text-wrap: balance`. Used for hero and section subheads.
- **Body:** Geist 400, 1rem, line-height 1.7, muted colour. FAQ answers use 0.95rem at 1.75.
- **Eyebrow label:** Geist 700, 0.75rem, uppercase, 0.1em tracking, blue. Sits above every major h2 and sets the section's topic in two to four words.
- **Price:** Figtree 400 at 2.4rem. The lighter weight against bold headings makes prices read as calm and confident, not shouty.
- **Emphasis:** `.heading-accent` italicises a word or phrase inside a heading. Use it for one key phrase per heading, not decoration.

Rules: headings are tight and large, body is loose and readable. Keep line length under about 38rem for leads and 760px for long-form lists such as the FAQ.

## Layout

- **Container:** max-width 1200px, centred, 24px side padding. Wide-screen tweaks only kick in at 1280px and up.
- **Section rhythm:** sections are full-bleed bands with vertical padding of 96px (standard), 100 to 112px (feature sections), and 120px (closing CTA). Fluid variants use `clamp(80px, 10vw, 120px)`.
- **Band alternation (homepage):** Hero (navy) → Proof (cream) → Courses (off-white) → Versus (navy-dark) → How (white) → Resources (off-white) → FAQ (white) → Book (navy) → Footer (navy-dark). Never stack two sections with the same background. Alternate dark and light to create pacing.
- **Header:** fixed nav, `--header-height: 148px` (120px logo plus padding). Anchored sections use `scroll-margin-top` so headings clear it.
- **Hero:** full viewport height on desktop, text column max about 580px with a photo column on the right. Below 860px the photo column hides and content goes full width.
- **Product pages:** two-column hero grid (`1fr 480px`, 64px gap) with the purchase panel on the right.
- **Breakpoints:** the codebase uses max-width queries. The main ones are 960px (tablet), 860px (hero stacks), 760px and 640px (mobile layout), and 480px (small phones). Reuse these values rather than adding new ones.

## Elevation & Depth

Depth comes from contrast between bands and from soft, dark, wide shadows. Hard drop shadows are never used.

- **shadow-sm:** `0 2px 8px rgba(0,0,0,0.12)`: small lifts.
- **shadow-md:** `0 8px 32px rgba(0,0,0,0.18)`: card hover state.
- **shadow-lg:** `0 24px 64px rgba(0,0,0,0.24)`: large floating elements.
- **Blue glow:** `0 4px 24px rgba(22,119,190,0.25)` under primary buttons, growing to `0 8px 32px` on hover.
- **Featured ring:** featured cards add a 1px coloured ring via `box-shadow: 0 0 0 1px` (blue for featured, 12% gold for premium).
- **Glass nav:** once scrolled, the nav becomes `rgba(8,15,26,0.92)` with `backdrop-filter: blur(16px)` and a hairline bottom border.
- **Atmosphere:** dark sections may carry large, low-opacity radial gradients of blue (and rarely green) to add depth. Keep them under about 0.2 alpha and behind content.

## Shapes

- **Pill (100px):** all buttons, status chips, the skip link, and small dismiss buttons.
- **xl (32px):** course cards and large feature panels (the S2 "slam" panel).
- **lg (20px):** resource cards and mid-size panels.
- **md (12px):** inputs, small cards, and images inside cards.
- **sm (6px):** tags and tight UI details.
- The floating quiz CTA uses 18px, sitting between md and lg.

Corners get rounder as the element gets bigger. Avoid square corners on interactive elements.

## Components

**Buttons** (`.btn` plus a modifier). Pill shape, Geist 600, 12px × 28px padding, 2px border. Every button lifts `translateY(-2px)` on hover.
- `--primary`: blue fill, white text, blue glow. One per view is the main action.
- `--ghost`: transparent with a 30% white border, for secondary actions on dark.
- `--ghost-alt`: faint navy tint, for secondary actions on light.
- `--outline`: blue border and text, which fills blue on hover.
- `--white`: white fill with navy text, for high-contrast CTAs on navy.
- `--gold`: premium tier only.
- `--nav`: compact primary button in the header (no lift).
- `--lg`: 16px × 36px, 1.05rem, for hero and closing CTAs.
- `.btn__sub`: optional second line inside a button (for example a price or scarcity note).

**Course tier cards** (`.course-tier`). White, 32px radius, strong border, lifts 4px with shadow-md on hover. Centred pill badge overlapping the top edge. Price uses Figtree 400.
- `--featured`: navy card with a blue ring. This is the recommended option.
- `--premium`: navy-mid card with gold ring, gold badge, gold "includes" text.

**Resource cards** (`.resource-card`). White, 20px radius, soft border, 36 × 32px padding. On hover they lift 4px and the border turns blue.

**Eyebrow label** (`.label`). Uppercase blue kicker above headings. On dark backgrounds, use blue-light (`.hero__seo-kicker`).

**Status line** (`.hero__urgency`). Uppercase 0.82rem text with an 8px green dot and a soft 6px green halo. Used for live enrolment status. Only show it when the status is true.

**Navigation** (`.nav`). Transparent over the hero, glass navy once scrolled. Links are Geist 500, 0.9rem, dark-soft colour, turning white on hover. The current page gets white 600 via `aria-current="page"`. On mobile the menu overlays a 76% navy scrim and locks body scroll.

**FAQ** (`.faq__item`). Native `<details>`/`<summary>`, 760px max width, divided by soft borders. A blue "+" toggle rotates 45° when open.

**Floating quiz CTA** (`.floating-quiz-cta`). Mobile-only fixed card, bottom-centred, respecting safe-area insets. Navy at 94% opacity, 18px radius, blue-light eyebrow, and a dismiss button.

**Scroll reveal** (`.reveal`, `.reveal--delay-1..4`). Fades up 30px over 0.7s with staggered 0.1s delays. Only runs under `prefers-reduced-motion: no-preference`. Content in the hero is never hidden by reveals.

## Motion

- Standard transition: `0.3s cubic-bezier(0.4, 0, 0.2, 1)` (`--transition`) for colour, shadow, border, and transform.
- Hover language: buttons lift 2px, cards lift 4px, and shadows deepen.
- Entrance: reveal-on-scroll only, with no parallax and no autoplaying loops in content areas.
- All motion must respect `prefers-reduced-motion`.

## Accessibility

- Visible focus on every interactive element: 2px blue outline (`rgba(22,119,190,0.7)` on light, `rgba(149,204,255,0.9)` on dark) with a 3 to 4px offset.
- A skip link comes first in the body and slides into view on focus.
- Use Blue Light, not Blue, for small text on navy, because #1677BE on #080F1A is too low contrast for body text.
- Paragraph text on light is #4B5563 or darker. Never go lighter for body copy.
- Use semantic landmarks, `aria-current` for nav state, native `<details>` for disclosure, and alt text on all photos and logos.

## Do's and Don'ts

**Do**
- Use a single blue primary CTA per section. Make it obvious.
- Alternate dark and light bands to pace the page.
- Use tokens from `:root` before adding any new hex value.
- Keep headings short and tight. Let whitespace do the work.
- Save gold for the top-tier offer and green for live status.
- Check every layout at 860px and 640px as well as desktop.

**Don't**
- Introduce new accent colours, gradients-as-brand, or rainbow UI.
- Use gold or green as general decoration.
- Put body text in pure grey on navy. Use the text-light tokens.
- Use square-cornered buttons or heavy, hard-edged shadows.
- Add motion that ignores reduced-motion preferences, or animate the hero content in.
- Use em dashes in any on-page copy.
- Invent prices, dates, or enrolment states in mockups. Pull them from the live pages.

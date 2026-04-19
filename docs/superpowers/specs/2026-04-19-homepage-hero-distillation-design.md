# Homepage Hero Distillation Design

- Date: 2026-04-19
- Area: Homepage hero
- Status: Approved for planning

## Objective

Simplify the homepage hero so it earns trust quickly through typography, spacing, and proof rather than layered visual effects or floating UI chrome.

The hero's primary job is to make cold visitors trust the offer. Conversion actions remain visible, but they should feel secondary to credibility.

## Design Context

- Audience: Prospective GAMSAT students in Australia, the UK, and Ireland, many arriving cold on mobile.
- Use case: Assess whether Rohan's tutoring is credible, current, and worth exploring further.
- Brand tone: Balanced mix of editorial profile and high-trust institution.
- Constraint: Keep visible urgency for live enrolments.

## Core Design Decision

Adopt the approved `Balanced Trust` direction.

This direction keeps urgency, but moves the hero away from "premium by effects budget" and toward a calmer, more authoritative reading experience. The hero should feel like a refined masthead rather than a feature stack.

## Hero Structure

The hero should be reduced to four beats in one clear reading flow:

1. Urgency line
2. Headline
3. Support line
4. Compact proof row

Below that, keep two CTAs with a clear hierarchy.

## Content Hierarchy

### Urgency

Use a slim enrolment notice with minimal treatment:

`September 2026 enrolments now live`

This should remain visible above the fold, but it should no longer read like a separate promotional card.

### Headline

Use:

`Stop guessing. Start getting in.`

The headline should carry most of the emotional weight. It should feel decisive, premium, and easy to scan.

### Support Line

Use a single sentence that ties proof to the tutoring offer:

`GAMSAT tutoring shaped by a top 1% scorer, trusted by 1,200+ future doctors across Australia, the UK, and Ireland.`

This line should replace more layered or repeated framing around the same idea.

### Proof Row

Only keep these two proof points:

- `1,200+ students coached`
- `Top 1% scorer`

Do not keep `USyd medical student` in the immediate proof row. It can remain elsewhere on the page or in deeper supporting copy, but it should not compete with the two strongest trust signals above the fold.

## CTA Hierarchy

- Primary CTA: `See the Courses`
- Secondary CTA: `Join This Week's Free GAMSAT Webinar`

The primary CTA should remain visually dominant. The webinar CTA should feel available and credible, but not compete with the main browsing path.

## Visual Direction

### Composition

- Keep the existing left-weighted hero composition.
- Narrow the text column slightly so the headline and support line feel more intentional.
- Keep the composition spacious, with visible breathing room between urgency, headline, support line, proof, and CTAs.

### Background And Image

- Further reduce decorative intensity.
- Keep Rohan's image only if it behaves like atmosphere rather than a second focal point.
- Remove any remaining hero accessories that read as "extra" rather than essential.

### Proof Presentation

- Replace the current stat-strip feeling with a compact inline proof row.
- The proof should read as part of the trust narrative, not as a separate feature block.
- Avoid oversized metric styling that makes the hero feel like a landing-page template.

## Elements To Remove

- Floating credential card
- Scroll indicator
- Any remaining hero chrome that competes with the reading flow
- Over-segmented stat-strip treatment
- Promotional-card styling on the urgency line

## Elements To Keep

- Premium navy editorial frame
- Live-enrolment urgency
- Two CTA choices
- Rohan's presence in the hero atmosphere, if visually restrained
- Strong trust cues above the fold

## Implementation Notes

- Prefer simplification over replacement. Remove layers before adding new ones.
- Reuse the existing brand palette and shared typography system unless a change is required to support the approved hierarchy.
- Ensure the hero remains strong on mobile without relying on hidden decorative elements.
- Preserve the current performance improvements already made to reduce runtime cost.

## Success Criteria

The hero will be considered successful if:

- It feels calmer and more premium at first glance.
- The main message can be understood in one fast scan.
- Trust signals are clearer than decorative effects.
- Urgency is present without making the hero feel sales-heavy.
- The mobile experience feels composed and authoritative rather than visually busy.

## Out Of Scope

- Rewriting the whole homepage
- Repositioning deeper proof sections below the hero
- Rebranding the site
- Reintroducing heavy runtime effects or decorative animation in the hero

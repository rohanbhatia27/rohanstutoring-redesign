# Hormozi Landing Pages Skill Design

## Goal

Create a global skill named `hormozi-landing-pages` that works in both Codex and Claude. The skill should help the agent create and improve landing pages using Alex Hormozi's philosophy:

- stop the right person with a headline that promises a clear outcome
- clarify the promise with a subheadline
- use the hero visual as proof rather than decoration
- make the CTA explicit about what the visitor gets and how they get it
- address the top three likely objections immediately under the fold
- surface relevant social proof early
- keep the page sparse enough that attention stays on the primary CTA

The skill should stay explicit about Hormozi's philosophy rather than reframing it into generic CRO language. It should still allow tasteful brand expression when a host project has a premium, editorial, or established visual identity, as long as the aesthetic never weakens clarity, proof, or focus.

## Why This Skill Exists

The user uses both Codex and Claude for similar landing-page work and wants a reusable, global skill rather than project-local instructions. The skill should reduce drift between agents by using one shared framework and workflow, while still fitting each agent's native skill conventions.

## Scope

The skill supports two primary modes:

1. `Create mode`
   Audit the brief, funnel, offer, existing page, and project context; propose a rebuild plan; pause for approval; then write the copy and implement the landing page in the host project's codebase.
2. `Audit mode`
   Review an existing landing page, score it against the Hormozi rubric, and produce prioritized recommendations plus a proposed rebuild sequence.

The skill should be suitable for:

- lead magnet pages
- webinar or event registration pages
- consultation or discovery-call pages
- service offer pages
- product sales pages
- application pages

The skill should also adapt its objection strategy to the offer's threshold of action:

- low-threshold actions such as free PDFs, lead magnets, and low-friction opt-ins should use minimal, stealthy objection handling
- mid-threshold actions such as webinar registration or consultation booking may need light explicit reassurance
- high-threshold actions such as applications, premium services, and high-ticket offers should use more explicit objection handling, stronger specificity, and a clear articulation of the cost of inaction

The skill should not force a standalone HTML-only workflow. It should adapt implementation to the host project's stack, code patterns, and existing visual system.

## Non-Goals

- Do not imitate Alex Hormozi's exact brand voice or page designs line-for-line.
- Do not generate pages that feel like generic direct-response templates if the host project already has a strong brand system.
- Do not add long-form section sprawl by default.
- Do not skip the diagnosis and planning phase in order to jump straight into copy or code.
- Do not prioritize aesthetics over conversion clarity.

## Product Decision

Use one canonical framework with two runtime-specific skill packages.

### Rationale

This gives the user consistent behavior across agents while still allowing each platform to use its own skill metadata and conventions cleanly. It avoids a Codex-first or Claude-first compromise and reduces long-term maintenance drift.

## Deliverables

Create two global skill folders:

- `~/.codex/skills/hormozi-landing-pages/`
- `~/.claude/skills/hormozi-landing-pages/`

Each package should share the same core framework and include:

- `SKILL.md`
  The main operating instructions, trigger guidance, workflow, audit rubric, approval gates, and output rules.
- `references/framework.md`
  The canonical distilled method based on the user's notes, Hormozi-inspired patterns, and supporting landing-page best practices.
- `references/templates.md`
  Reusable templates for headlines, subheadlines, CTAs, objections, social proof, and page structures.
- `references/examples.md`
  Short examples showing how the framework applies across different landing-page types.

For Codex only:

- `agents/openai.yaml`
  UI-facing metadata for discovery and invocation.

For Claude:

- use the local Claude skill structure and frontmatter conventions already present in `~/.claude/skills/`
- avoid extra documentation files unless they are materially useful and unlikely to drift

## Triggering Behavior

The skill should trigger when the user asks to:

- create a landing page
- improve or optimize a landing page
- audit a landing page
- rewrite a hero, CTA, or offer section for conversion
- turn a brief or offer into a landing page
- make a page more Hormozi-style, direct-response, conversion-focused, sparse, or proof-driven

The description should make clear that the skill is for both creation and critique, and that it applies Alex Hormozi's philosophy directly.

## Core Workflow

The skill should enforce this sequence:

1. Inspect the target project, page, brief, offer, and funnel context.
2. Determine whether the task is primarily create mode or audit mode.
3. Run a brief or audit first.
4. Produce a concise diagnosis of conversion strengths and leaks.
5. Propose a focused rebuild plan.
6. Pause for user approval before writing copy or code.
7. After approval, write the full landing-page copy.
8. Implement the page in the host project's codebase and aesthetic system.
9. Self-check the result against the rubric before finishing.

The skill should explicitly forbid skipping straight from request to implementation unless the user has already approved the brief or plan.

## Audit Rubric

Before writing, the skill should evaluate the page or brief across these dimensions:

- `Attention`
  Does the headline stop the right person quickly?
- `Outcome clarity`
  Is the promised result concrete and easy to picture?
- `Offer comprehension`
  Can a cold visitor understand what they get?
- `Proof strength`
  Does the hero and early page show evidence rather than decoration?
- `CTA specificity`
  Does the CTA tell the visitor what they get and how they get it?
- `Objection coverage`
  Are the three biggest likely objections handled early?
- `Threshold fit`
  Is the level of objection handling appropriate for the action being asked of the visitor?
- `Social proof relevance`
  Is proof specific, credible, and near high-anxiety decision moments?
- `Focus`
  Is there one clear conversion goal, or is attention split?
- `Aesthetic fit`
  Does the design fit the host brand without weakening conversion?
- `Mobile conversion integrity`
  Are headline, proof, and CTA still obvious on mobile?

## Hard Rules

The skill should enforce these rules:

- no vague hero headlines
- no decorative hero imagery unless it also provides proof or context
- no buried CTA
- no feature sprawl before the visitor understands outcome, proof, and next step
- no extra sections added just because they are common on landing pages
- no brand expression that competes with the conversion goal
- no heavy objection handling on low-threshold lead magnet pages when that extra explanation would create friction
- no generic objections on high-ticket pages when the real doubts are segment-specific and situational
- no implementation before the brief or audit and user approval

## Output Requirements

### Audit Output

The audit step should return:

- a short summary of what the page is trying to do
- the biggest conversion leaks in priority order
- the strongest existing elements worth preserving
- a proposed rebuild sequence
- an explicit request for approval before copy or code

### Plan Output

The plan step should show:

- what stays
- what changes
- what gets deleted
- proposed section order
- proof strategy
- objection strategy
- CTA strategy
- implementation approach inside the host project

### Copy Output

After approval, the skill should produce:

- headline
- subheadline
- CTA copy
- hero proof direction
- top-of-page trust or proof line if appropriate
- objection bullets under the fold
- early social proof block
- any additional sections only if they materially improve conversion

The copy step should adjust objection handling by offer type:

- for lead magnets and other low-threshold offers, default to stealth objection handling baked into the subheadline, CTA support copy, or a small trust line near the CTA
- for higher-ticket offers, explicitly surface the most relevant objections early when doing so reduces uncertainty rather than adding noise
- for premium and high-ticket services, include the cost of inaction when that contrast helps the visitor understand the price of staying stuck

### Build Output

After copy is approved or the user asks to proceed, the skill should implement the page:

- in the target project's existing stack and structure
- using the host project's design language, spacing system, and components where possible
- while still simplifying toward one core CTA and a sparse, high-focus layout

## Aesthetic Policy

The skill should aim for `Hormozi-core with room for tasteful brand expression`.

This means:

- keep the conversion architecture fixed
- allow typography, surface treatment, spacing character, imagery style, and polish to reflect the host brand
- preserve premium or editorial aesthetics when they support trust and quality perception
- remove or suppress visual decisions that distract from the primary action

## Canonical Framework Reference

The shared framework should distill the following principles:

1. Above the fold has one job: stop attention, promise the outcome, prove it, and direct the next step.
2. The hero image is not decoration. It should show the result, the asset, the mechanism, or social proof.
3. The CTA should say what the person receives and how they receive it.
4. Under the fold should neutralize the biggest objections, but the visibility and intensity of objection handling should match the threshold of action.
5. Social proof should appear early and be specific.
6. Sparse pages usually outperform busy ones when the offer is clear and traffic is reasonably matched.
7. Brand expression is allowed only if it supports comprehension, trust, and focus.
8. High-ticket pages should address the cost of doing nothing when that contrast sharpens urgency without becoming manipulative.

## Reference Content Plan

### `references/framework.md`

Include:

- distilled philosophy
- page anatomy
- threshold-of-action guidance for low-, mid-, and high-friction offers
- decision rules for when to stay minimal versus add depth
- proof hierarchy
- objection-handling logic
- cost-of-inaction guidance for high-ticket pages
- mobile integrity checks

### `references/templates.md`

Include:

- headline formulas
- subheadline formulas
- CTA formulas
- objection bullet formulas
- stealth trust-line formulas for low-threshold pages
- segment-specific objection prompt formulas for high-ticket pages
- cost-of-inaction formulas for premium offers
- trust-line formulas
- social-proof block formulas
- section-order templates for the main landing-page types

### `references/examples.md`

Include short worked examples for:

- lead magnet
- consultation booking
- info-product or digital offer
- webinar or workshop signup
- application funnel

Each example should show:

- what the visitor wants
- what threshold of action the ask represents
- what the page leads with
- what proof appears in the hero
- what objections get handled first
- what the CTA promises

The examples should demonstrate that objection handling changes by offer:

- a free lead magnet should use stealth reassurance rather than heavy visible objection blocks
- a webinar or booking page can use light explicit reassurance
- a high-ticket application or service page should surface segment-specific doubts and may need a cost-of-inaction contrast

## Research Inputs

The skill should incorporate:

- the user's notes from Hormozi content
- observed public Hormozi page patterns such as strong outcome-led headlines, proof-heavy visuals, early social proof, and sparse CTA-focused layouts
- supporting landing-page best practices that align with those principles, especially hero clarity, proof visibility, objection handling, and mobile CTA visibility

The skill should present these as practical rules, not a literature review.

## Implementation Notes

### Codex package

Use Codex skill conventions:

- concise trigger-rich frontmatter
- imperative instructions
- `agents/openai.yaml` with a clear display name, short description, and default prompt

### Claude package

Use the established Claude skill frontmatter format in `~/.claude/skills/`, including tool permissions only if they materially help the skill. Keep it lean and consistent with the user's existing Claude setup.

## Open Questions Resolved

- `Generator or critic?`
  Both.
- `Minimalist or brand-flexible?`
  Hormozi-core with tasteful brand expression.
- `Explicitly name Hormozi?`
  Yes.
- `Copy-first or audit-first?`
  Audit-first, then plan, then approval, then copy, then build.
- `Standalone HTML or adapt to project stack?`
  Adapt to the host project while following fixed conversion rules.
- `One skill or two separate approaches?`
  One canonical framework with two runtime-specific skill packages.
- `Skill name?`
  `hormozi-landing-pages`
- `How should objections work on low-threshold offers?`
  Use stealth reassurance rather than heavy visible objection handling.
- `How should objections work on high-ticket offers?`
  Prompt for segment-specific, situational doubts rather than generic objections.
- `Should the framework include the cost of inaction?`
  Yes, for high-ticket scenarios where staying the same is part of the sale.

## Risks

- The skill could become too generic if the Hormozi philosophy is softened into broad CRO advice.
- The skill could become too rigid if it refuses all brand expression.
- The skill could overuse objection handling on low-friction offers and accidentally add doubt.
- The skill could use generic objections on high-ticket pages and miss the real situational friction.
- The skill could be annoying if it over-expands the diagnosis step.
- The skill could produce bad implementations if it defaults to standalone templates instead of reading project context first.

## Mitigations

- Keep the philosophy explicit and structural.
- Keep the workflow concise and approval-gated.
- Make project inspection mandatory before implementation.
- Keep templates as helpers rather than mandatory outputs.
- Enforce sparse default sectioning and strong proof requirements.
- Make threshold-of-action analysis mandatory before deciding how explicit objection handling should be.
- Require segment-specific objection prompts for premium and high-ticket pages.
- Reserve cost-of-inaction framing for higher-ticket offers where it clarifies stakes rather than inflating pressure.

## Success Criteria

The skill is successful if:

- both Codex and Claude can discover and use it globally
- both versions behave similarly in practice
- the skill consistently audits before writing
- it produces conversion-focused pages without flattening project aesthetics
- it improves weak landing pages by tightening headline, proof, objections, social proof, and CTA clarity

## Implementation Readiness

This design is ready to implement after user review of the written spec.

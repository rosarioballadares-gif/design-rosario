---
name: pattern-research
description: What does everyone else do with this pattern - modal or drawer, is it settled. Audits shipped systems instead of taste.
---

# Pattern research — what everyone else does

The expensive part of a cross-system sweep is not running it: it is **knowing where to look, which
sources lie, and what to re-check afterwards**. That is what is written down here, so the next audit
does not start from zero.

## This repo has no internal evidence base yet

There is **no research corpus and no distilled study index** in this workspace, and no way to query
one. Every finding a sweep produces here comes from outside. That is a real limitation: a finding
about someone else's users is precedent, while a finding about this product's users would be evidence, and
evidence wins when the two disagree.

**Product context is the exception, and it is not research.** `## The client` in
[workspace-wiring](../../../docs/foundation/workspace-wiring.md) says what the product is, who it is
for and where it lives, as the client intake recorded it; it holds no study, no session and no
measured user behaviour. Read it before a sweep, so that a review of external precedent at least
knows which product it is arguing about.

Two consequences, both non-optional. **Say so in the review** — a section named *What we already
knew internally* that reads "this workspace holds no internal research; everything below is external
precedent" is itself a finding about the corpus, and it stops the next reader from assuming the
sweep reconciled against something. And **record the gap**: when a sweep would obviously have been
answered by internal research nobody can reach from here, add a line to
[the backlog](../../../backlog/README.md), which is where this repo keeps what is missing on purpose.

The older repo measured the cost of skipping this: a sweep re-derived from the outside a conclusion
its own research had already answered, because no document in the working repo could reach it. Here
nothing can reach it, so the honest move is to label the whole review as external.

## Three tracks

Pick the track by what gets decided with the result. It changes the roster and the deliverable, not
the protocol.

- **A. Pattern rule** — "drawer, modal or panel?", "where does back go?", "does the stepper mark
  the current step or the completed one?" Roster: design systems, accessibility specs, literature.
- **B. Component or API** — "what props does this have elsewhere?", "does this component exist
  outside?" Same systems, **entered through the code**, not the docs. See the fetch doctrine.
- **C. Product benchmark** — "how do Notion or Linear or Stripe solve this?" This is **evidence of
  practice, not doctrine.** Label it that way or someone will quote it as a rule.

## The recipe

1. **Write the question in one line, as a fork.** Not "research drawers" but "when do we use a
   centred modal, an overlay drawer, or a persistent panel?" A sweep returns whatever the question
   discriminates; a question without a fork returns component summaries.
2. **Build the roster** from the tables below — around 20 sources, **weighted**. Weight by how
   close a source sits to what this product actually is.

   > GAP: this product's segment, buyer and closest peers are not recorded, so
   > nothing here can weight the roster for you. State the weighting you chose
   > in the report, so the next person can disagree with it.
   for small businesses, so conclusions anchor on the enterprise column. Material and the Apple HIG
   enter as platform precedent, not an equal vote: they solve an operating-system problem.
3. **Always add the three cross-cutting sources**, even unasked: the **accessibility specs** (they
   decide more than taste and win arguments), the **substrate layer** (Base UI and Radix, the real
   ceiling on what the design system can do), and **one agent per transverse axis**. The axes
   outperform one more system, because they see what no single system's docs put together.
4. **Run one agent per source, with a chained adversarial verifier for each.** The verifier is
   the second step of the same run, not a later pass someone might skip.
5. **Measure the design system too.** A review that never checks what it ships today is a
   reading note. Read its type declarations and its stylesheet out of `node_modules/`, or ask
   its MCP server or CLI where it publishes one. Do not quote a remembered figure — run
   whatever counts it in one place, so that two lists of the same
   thing cannot drift apart. The point of measuring rather than recalling: in the system this
   skill was written against, the whole application-shell family and every chart were
   **absent** from a package everyone assumed was complete. A pattern that assumes a shell
   or a chart is one this repo would have to author itself, and the review should say so.
6. **Write the review yourself**, in the main loop, not through an agent. The synthesis is the work.
7. **Then design it, before documenting it.** Research ends in a rule, and the rule gets drawn
   against real components before it becomes doctrine. Compose in your own design file against
   the published library — never in the library itself, which is read-only for everyone but its
   owner.

## The deliverable

**One written review, and it belongs to the person who asked for it.** There is no research corpus
and no pattern catalogue here — `docs/` holds only the voice guide — so do not invent a path and file
it where nobody will look.
Write it out in full where it was asked for; if the human wants it kept, save it where they say.

If it has to travel outside this workspace, publish the same review as an artifact: one scroll,
pasteable, and **private** until the human shares it from the page. Do not promise anyone can
already see it. Same content on a second surface, not a softer version.

## Fetch doctrine

- **Design system documentation sites are client-rendered and return an empty shell.** Confirmed on
  Material, Spectrum and — worst case — Atlassian, whose layout examples page renders a title and
  one line while the source file behind it carries every width table and breakpoint. Escalate in
  this order:
  1. **A raw fetch with a browser User-Agent.** Most of what looks client-rendered is server-rendered
     React or Next.js with the whole page already in the markup, and every rung below this one loses
     material this one keeps. Spend one call to find out which kind of page you have.
  2. **The GitHub repository.** Fetch `raw.githubusercontent.com` for the docs source file, the
     stories file, the spec file, the JSDoc in the type declarations. The rule the site hints at
     lives here. Search for the docs source by filename, not for the page.
  3. **`https://r.jina.ai/<url>`** as a render proxy.
  4. **Search snippets** — lowest confidence. If a quote exists only in a snippet, say so in the
     confidence notes.
- **Engineering repo prose is not published design guidance,** and confusing the two was the most
  systematic error in the founding sweep: 9 of 19 Fluent misattributions dressed spec-file text in
  a design-site URL. Cite the source where it actually is. If a rule only lives in the repo, that
  **is** the finding — the system never published it.
- **Watch the version.** SAP publishes at least seven live versions at once, and a numeric threshold
  can exist in the old ones and be gone from the new. An agent that fetches whatever ranks first
  reports retired doctrine as current. Pin the version and name it.
- **Documentation source files live in the website repo, not the component repo.** Finding nothing
  in the component repo does not prove absence.
- **A render proxy is lossy, and what it drops is invisible.** It returns rendered prose, so a page
  whose numbers live inside a custom element comes back reading complete with the numbers gone.
  Measured 2026-09-07 on `mobbin.com/pricing`, which wraps every price in
  `<scritto-text role="img" aria-label="$10">$10</scritto-text>`: the proxy returned the `<span>`
  siblings on either side and dropped the element between them, so three agents reported that the
  labels render and the amounts are not in the served markup, and the verifier that checked them
  called it a real hole rather than laziness. A raw `curl` returned HTTP 200 and 562,588 bytes with
  every price present. The same reflex cost that sweep three further findings — the app corpus, the
  competitor roster, and a flow count taken from a stale press release while the live figure sat in
  the homepage markup. Reach for the proxy once the raw markup has shown you the page needs JS.
- **A render proxy fixes client-rendering, not bot-blocking.** Against a WAF it returns **200 with
  the body of a 403 inside**, so an agent that only reads the status code files the block page as
  content. Read the body before quoting it. Confirmed on Workday Canvas, which has to be entered
  through its GitHub repo instead.

## Adversarial verification (not optional)

The sweep that founded this skill produced **2,430 claims. 259 were misattributed and 5 were
invented.** Without the second pass, every one would have entered the document with a URL attached.
**A finding nobody tried to refute is a draft, not a finding.**

- **One verifier per source, chained to that source's research**, instructed to distrust it:
  re-fetch every cited URL and mark each claim confirmed, reworded (with the true text),
  unsupported, or unreachable.
- **Ask for the misses too:** "read the same pages with fresh eyes and tell me what was skipped,
  especially an explicit 'use X instead of Y', a numeric threshold, or two pages of the same system
  contradicting each other." **The misses were worth more than the original findings** — they
  overturned six headline conclusions, including one where the first agent found the rule, discarded
  it as unverified, and reported the opposite.
- **Separate misattribution from fabrication.** Almost everything unsupported is a real quote under
  the wrong URL, and the verifier hands you the right one. Real fabrication is rare and serious: the
  five included two normative claims attributed to the HTML spec that do not exist. Name them in the
  review so nobody reintroduces them.
- **Schema trap, not a model failure:** an array of quotes with a single sibling `url` field makes
  every quote inherit the first one's URL, and you find out only when fifteen come back unsupported.
  It happened three times in one sweep. **Put the URL inside each quote.**

## The roster

### Enterprise and SaaS — where the conclusions anchor

| System | Enter at | Documents well | The trap |
| --- | --- | --- | --- |
| **Carbon (IBM)** | `carbondesignsystem.com`, source in `carbon-design-system/carbon-website`; product components in `carbon-design-system/ibm-products` | The most explicit corpus there is: decision tables under community patterns, surface ladders, numeric thresholds. If a rule exists, Carbon wrote it. | Contradicts itself between pages. Carbon core and Carbon for IBM Products are two systems — side panel and tearsheet exist only in the second. |
| **Fluent 2 (Microsoft)** | `fluent2.microsoft.design`, plus the react-components packages in `microsoft/fluentui` | Props that split axes others merge. The spec, best-practices and stories files carry rules the site does not. | **Worst misattribution rate measured.** Site and repo disagree and it is easy to dress one as the other; the spec file lags the code. |
| **Atlassian** | `atlassian.design`, plus the constellation docs shipped inside each Atlaskit npm package | Rules about relationships between tasks, and a case study of a decision collapsing by deprecation rather than by criterion. | **Live pages render a title and one line.** The body is in the package docs source. Sending a reader to the live URL sends them to a blank page — say so. |
| **Cloudscape (AWS)** | `cloudscape.design` | Decision tables under general patterns. One of the few that ties responsive to **accessibility** (320px, 400% zoom) rather than to devices. | Selection vocabulary is centralised on the pattern pages, not the component pages. |
| **PatternFly (Red Hat)** | `patternfly.org` | The usage-and-behavior foundations are a **cross-component matrix**. Accessibility rules tied to mechanics. | Many components have no accessibility tab at all; a 404 is the norm, not the anomaly. |
| **Elastic EUI** | `eui.elastic.co/docs`, source in `elastic/eui` | Push versus overlay with a configurable breakpoint. Content thresholds quantified in words and paragraphs. | The Guidelines section of each page is easy to skip and is usually where the prescriptive rule lives. |
| **Twilio Paste** | `paste.twilio.design`, source in `twilio-labs/paste` | When it ships two similar components, the difference is stated in **mechanical, testable** terms. | Patterns contradict components. Real measurements come only from the code. |
| **Salesforce (SLDS)** | `v1.lightningdesignsystem.com`, plus `salesforce-ux/design-system` | The **accessibility taxonomy** is the system's real rule, written by the accessibility team. Published z-index ladder. | SLDS 2 returns a shell to any proxy. The v1 site and the current branch diverged. Runs some axes backwards — good counter-evidence, bad consensus. |
| **SAP Fiori** | `sap.com/design-system/fiori-design-web/` at a pinned version | Pure enterprise: floorplans, column layouts, rules about not putting long tasks in dialogs. | **Several live versions at once**, with quantified rules present in the old and withdrawn from the new. |
| **Workday Canvas** | **Enter through `workday/canvas-kit` on raw GitHub.** | Symmetric "when to use" and "when to use something else" on every page. Decisions expressed as affordance. | `canvas.workday.com` blocks fetches at the CDN, and a render proxy returns the block page with a 200. Never cross-references its own two taxonomies. |
| **GitLab Pajamas** | `design.gitlab.com` | The most direct corpus here. When it compares two things it makes a four-row table and stops. | Comparison tables are rarely on the component page you would expect. |
| **HashiCorp Helios** | `helios.hashicorp.design` | Explicit "X versus Y" sections with named sub-axes. The patterns carry more rule than the components. | Small system: many topics are simply not covered. |
| **Zendesk Garden** | `garden.zendesk.com` | The patterns, filters especially, carry behavioural rules no component doc has. | Component docs almost never compare with each other. |

### Platform — precedent, not an equal vote

| System | Enter at | Note |
| --- | --- | --- |
| **Material 3** | `m3.material.io` (client-rendered), the M2 archive, the Android component docs | The sharpest prose is usually in the Android or Compose docs, and it is very easy to quote one with the other's URL. |
| **Apple HIG** | `developer.apple.com/design/human-interface-guidelines/` | The best writing anywhere on the **cost** of a decision. Operating-system doctrine, not web-app doctrine, and sibling pages contradict each other. |
| **Ant Design** | `ant.design`, plus the spec folder in `ant-design/ant-design` | The only system with numeric field thresholds in a research template. Rarely compares its own components. |
| **Primer (GitHub)** | `primer.style/product`, plus `primer/design` and `primer/react` | Escalation rules and ergonomics as criteria. Much lives in experimental packages: exists in code, not blessed. |
| **Polaris (Shopify)** | `polaris.shopify.com`, plus `Shopify/polaris-react` | A case study in **deprecation with a written reason**. Three Polaris variants exist and disagree; deprecation notices are in the code, not the docs. |
| **Adobe Spectrum** | `spectrum.adobe.com` (client-rendered), then `react-spectrum.adobe.com` | The rule often exists only in the React docs. Spectrum 2 and v3 coexist. |

### Substrate, normative, practice, literature

| Source | Enter at | Why |
| --- | --- | --- |
| **Base UI** | `base-ui.com/react/components/` | Many design systems are built on it, so what Base UI can do bounds what they can offer, and its defaults are the implicit policy. |
| **Radix and shadcn** | `radix-ui.com/primitives`, `ui.shadcn.com` | The neighbourhood: what counts as "a different component" versus "the same one restyled". |
| **WAI-ARIA APG** | `w3.org/WAI/ARIA/apg/patterns/` | Names roles, keyboard and focus. Wins arguments no design system wins. |
| **WAI-ARIA 1.2** | `w3.org/TR/wai-aria-1.2/` | Normative role definitions. A semantic test usually discriminates better than a design rule. |
| **WCAG 2.2 Understanding** | `w3.org/WAI/WCAG22/Understanding/` | **Underrated** — these pages carry whole UI taxonomies. Look here before concluding nobody wrote the rule. |
| **MDN and the HTML spec** | `developer.mozilla.org`, `html.spec.whatwg.org` | What the platform already solves. **Double-check every normative quote**; this is the most fabricated source. |
| **Product practice** | `docs.stripe.com/stripe-apps/design`, `docs.slack.dev/surfaces/`, HubSpot UI extensions, Atlassian Forge UI Kit, Intercom Canvas Kit | Developer docs describe what the platform permits, which is not always what its designers do. Notion, Linear and Figma help centres are silent on structure, useful for surface names. |
| **Literature** | `nngroup.com/articles/`, `smart-interface-design-patterns.com/articles/` | NN/g is what a reviewer checks first and frames decisions as cost; SIDP has explicit decision trees and names patterns the systems do not. |

### The transverse axes — one agent each, always

Not systems: questions that cut across all of them and that no single system's docs assemble.

- **Responsive and degradation** — what happens to the surface below about 768px, **with numbers**,
  plus WCAG reflow and 400% zoom.
- **Nesting and combination** — what is forbidden, what is prescribed, and, crucially, **which
  combination nobody mentions**, which is not the same as forbidden.
- **Accessibility of the decision** — focus, landmarks, inert, Escape.
- **The published package** — see step 5. Measure the design system, do not remember it.

## What the review has to carry

1. **The finding in one line**, at the top, before the evidence.
2. **What we already knew internally** — here, the honest statement that there is no internal corpus
   to reconcile against, and where you looked.
3. **A verbatim quote and a URL per claim.** Never paraphrase inside quotation marks. If you could
   not get the exact string, the paraphrase goes **outside** the marks, flagged.
4. **The caveat travels with the claim**, not in a disclaimer section at the end.
5. **Absence is a finding.** "No system documents X" is worth as much as a rule, and you have to say
   how many were checked to support it.
6. **Dissent is published, not averaged.** If three systems say the opposite, name them; the one
   that breaks consensus is usually the most useful.
7. **Confidence notes:** what was read through a proxy, what was inferred from a diagram, what could
   not be reached, which sources fell over.
8. **Close with a recommendation:** what to do first, what to do if that falls through, and what is
   lost by choosing one over the other. Other options go in an appendix with the reason they did not
   win. Recommending is not deciding — it is saying what the person who read the evidence would do,
   and why, so the person deciding can disagree with something concrete. If the evidence genuinely
   does not discriminate, say that, name the question that does decide it, and name who has to
   answer it. A declared tie is a recommendation; an unranked menu is not.

## Remember

- **Weighting is not discarding.** All 20 get read; the weight is applied when concluding. A
  consumer system that solves the problem differently is signal, not noise.
- **Numeric thresholds are the most fragile part.** Of nine systems with a published threshold in
  the founding sweep, two were withdrawing it and one contradicted itself on the same page. Publish
  the disagreement table rather than an average.
- **Absent documentation is not an absent pattern.** A product that does not document its side peek
  still has one.
- A full sweep is expensive — the founding one ran about 38 minutes and 4.8M subagent tokens. Scope
  it to the fork in the question. Reusing an earlier review would be cheaper still, but there is
  nowhere here to find one — ask whoever commissioned it where they kept it, and see the backlog.

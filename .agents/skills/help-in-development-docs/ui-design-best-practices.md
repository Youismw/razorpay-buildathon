# What Makes Great UI
*Best practices distilled from high-usage products across industries — use alongside the Don't-Do list*

**How to use this file:** The Don't-Do list is a hard filter — those patterns get removed regardless of context. This file is a menu of positive practices to draw from — not every point applies to every project. Which ones matter depends on what you're building and what stage it's at (see the decision sections near the end).

## Foundational Principles
- Design around actual user needs and behavior, not assumptions about them
- Keep one consistent visual language — color, type, spacing, and components — across every screen
- Give clear feedback for every user action (a state change, animation, or message), so the interface never feels unresponsive
- Keep text readable: sufficient contrast, sane font sizes, no novelty fonts for functional/body text
- Make layout and interactions hold up across screen sizes and devices
- Treat performance as a design constraint — visual richness should never cost load or response time

## Typography
- Limit to one or two type families, used consistently everywhere
- Build hierarchy with size and weight, not decoration
- Give body text enough size and line-height to be comfortable to read at a glance
- Use type consistently to reinforce the product's tone rather than switching styles per section

## Color
- Use a small, deliberate palette (a couple of core colors plus one or two accents) tied to what the product represents
- Use color with purpose — to mark state, draw attention to key actions, or distinguish categories — not as background decoration
- Keep the palette consistent across the whole product so users always recognize where they are

## Icons & Imagery
- Icons should be instantly legible and clearly mapped to what they represent
- Keep icon style, weight, and alignment consistent throughout
- Use high-quality imagery when the content itself is the product; otherwise keep imagery minimal and functional
- Every icon or image should be doing a job — clarifying, identifying, or drawing attention to something specific

## Layout, Spacing & Hierarchy
- Build layouts on a spacing/grid system so they can scale as content grows without breaking consistency
- Make the most important content or action the most visually prominent thing on the screen
- Give elements room to breathe — but don't over-correct into empty minimalism when users need visual guidance to know what to do next
- Group related content clearly and separate unrelated content
- Prefer fewer, well-defined categories over exhaustive lists

## Navigation & Core Interactions
- Make key actions reachable in one or two steps
- For content-heavy products, offer a few clear pathways to the same destination (search, browse, recommendations); for single-purpose flows, keep it to one obvious path
- One clear primary call-to-action per screen — don't make it compete with secondary actions
- Use interaction patterns users already know before inventing new ones
- If there's one core action the whole product revolves around, make it simple, fast, and satisfying to repeat

## Feedback, Motion & Micro-interactions
- Use small animations to confirm an action or highlight a state change — not purely for decoration
- Immediate feedback on hover, tap, or input builds a sense of trust in the interface
- Every motion should have a functional or emotional reason to exist

## Personalization & Data-Driven Refinement
- Adapt content, suggestions, or defaults to the individual user wherever the product allows it
- Use real usage data and user testing to keep refining the design after launch, not just before it
- Anticipate friction points and address them proactively (in-context guidance, sensible defaults) rather than only reacting to support requests afterward

## Content & Copy
- Be specific and concrete in copy — describe what something actually does rather than reaching for vague, aspirational language
- Favor short, guided explanations or visuals over dense text walls when introducing something new

## Process
- Go from research to wireframes/prototypes to validation with real users before finalizing a direction
- Treat every design as a draft — test it, gather feedback, and keep refining after shipping

## Choosing What to Apply — By Project Stage

**Demo / proof of concept**
- Prioritize: a clear hierarchy, one obvious primary action, basic visual consistency, and staying clear of the Don't-Do list
- Fine to defer: a fully scalable grid system, micro-interaction polish, personalization, edge-case accessibility work
- Goal: prove the idea and get a direction validated quickly — polish comes later

**Internal tool / limited deployment**
- Prioritize: consistency, clear feedback on actions, efficient navigation for a repeat/power-user audience, performance
- Fine to defer: heavy visual polish, brand storytelling through imagery, deep personalization — your users already know why the tool exists
- Goal: reliability and speed for a known, recurring audience over external-facing polish

**Public / global deployment**
- Prioritize everything above, together: full design-system consistency, responsive behavior across devices, accessibility and readability, performance at scale, proactive onboarding/guidance, and post-launch iteration from real data
- Nothing gets skipped here without a specific reason
- Goal: the product has to work for a wide, unfamiliar range of users, contexts, and devices, and has to earn trust fast

## Choosing What to Apply — By Product Type

- **Content-heavy (media, feeds, catalogues):** lean into rich imagery/previews and personalization; keep the surrounding navigation and chrome minimal and consistent so it doesn't compete with the content
- **Utility / productivity tools:** lean into speed, keyboard/shortcut-friendly navigation, minimal decoration, and strong information hierarchy; personalization matters less than reliability
- **Transactional flows (checkout, signup, onboarding):** lean into focused content, high-quality supporting imagery where relevant, a short conversion path, and one clear call-to-action per step
- **Community / social features:** lean into real-time or live signals, clear categorization, and emotionally engaging feedback (micro-interactions, positive reinforcement)
- **Data or finance-oriented tools:** lean into clarity over decoration, proactive/predictive insights where possible, and consistent, precise typographic treatment of numbers

## When Good Practices Pull in Different Directions
- **Expressive vs. restrained:** put visual richness in the content areas (imagery, previews, brand moments) and keep the structural chrome — nav, menus, settings — restrained and consistent. This is the pattern the largest, most widely used products actually ship.
- **Many pathways vs. few choices:** it's fine to offer several routes to the same destination (search, categories, recommendations). What to actually limit is the number of competing choices at a single decision point — one clear primary action per screen, not five.
- **Minimalism vs. guidance:** minimalism only works once users already understand the product. If an interaction is novel, add just enough guidance (labels, brief copy, onboarding) to remove ambiguity, then strip it back once users are familiar with it.

## Using This With the Don't-Do List
- The Don't-Do list is a hard filter: those patterns get removed at every stage, for every product, regardless of context.
- This file is a menu to select from: not everything here belongs in every design — use the stage and product-type sections above to decide what actually applies.
- When two practices seem to conflict, default to what a large, high-usage product in the same category actually ships: usually a restrained, consistent structure with polish concentrated only where the content or core action lives.

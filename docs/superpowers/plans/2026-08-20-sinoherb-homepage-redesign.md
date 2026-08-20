# SinoHerb Static Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static SinoHerb homepage in plain HTML and CSS with a modern Chinese herbal wellness look and a strong desktop/mobile presentation.

**Architecture:** Use one `index.html` file for structure and one shared `styles.css` file for all layout, color, typography, and responsive behavior. Keep the page fully static so it is easy to open, inspect, and edit without a build step.

**Tech Stack:** HTML, CSS, browser-based QA, optional inline SVG for illustration and icons.

---

### Task 1: Build the static page structure

**Files:**
- Create: `index.html`
- Create: `styles.css`

- [ ] **Step 1: Add the semantic page skeleton**

Create a single landing page with an announcement bar, header, hero, trust strip, products, ingredients, process, results, founder story, signup, and footer.

- [ ] **Step 2: Add the brand copy**

Use SinoHerb as the brand name and write fresh Chinese copy for the hero, product cards, ingredient story, process, results, and footer.

- [ ] **Step 3: Add the global stylesheet**

Define the off-white base, plum primary color, blush and sage surfaces, serif headline styling, and card/button/section spacing in `styles.css`.

- [ ] **Step 4: Verify the page opens directly**

Open `index.html` in the browser and confirm the document renders without any JavaScript or build tooling.

### Task 2: Add the product illustrations and section art

**Files:**
- Modify: `index.html`
- Modify: `styles.css`

- [ ] **Step 1: Create the hero product illustration**

Use inline SVG to draw the bottle pair in the hero so the page has a real branded focal point.

- [ ] **Step 2: Create supporting art for the ingredients and founder sections**

Use inline SVG shapes and gradients for the botanical panel and founder-story card so the page feels designed rather than empty.

- [ ] **Step 3: Style the cards and section bands**

Tune the product cards, metrics, quote blocks, and story band so the page reads as one cohesive system.

- [ ] **Step 4: Check that the illustrations scale cleanly**

Resize the browser and confirm the SVG art stays centered, proportional, and crisp.

### Task 3: Polish mobile behavior and final browser QA

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Tighten the mobile layout**

Adjust the header, hero, cards, and footer so the page stacks cleanly on narrow screens.

- [ ] **Step 2: Prevent overflow and clipped text**

Check every section for accidental horizontal scrolling, cramped headings, or broken spacing.

- [ ] **Step 3: Capture and review desktop and mobile screenshots**

Run browser screenshots at desktop and mobile sizes, then compare them against the approved design concept.

- [ ] **Step 4: Commit the finished static page**

Run:
`git add index.html styles.css docs/superpowers/plans/2026-08-20-sinoherb-homepage-redesign.md && git commit -m "feat: build static SinoHerb homepage"`


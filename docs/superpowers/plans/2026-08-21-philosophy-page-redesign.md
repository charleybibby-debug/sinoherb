# SinoHerb Philosophy Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current card-based philosophy page with the approved image-rich hybrid editorial design that explains TCM principles and leads naturally into the constitution conversation.

**Architecture:** Keep the existing static HTML/CSS/JavaScript architecture. Replace only the philosophy page main content, add page-scoped `.philosophy-page-*` styles to the shared stylesheet, and update the philosophy mega-menu anchors in the existing navigation configuration. Use semantic HTML and local inline SVG visuals so the page has no third-party image hotlink dependency.

**Tech Stack:** Static HTML5, CSS Grid/Flexbox, inline SVG, existing vanilla JavaScript navigation behavior.

---

## File Structure

- Modify `philosophy.html`: complete approved page structure, copy, CTA links, accessible visual markup.
- Modify `styles.css`: page-scoped desktop, tablet, mobile, reduced-motion, and visual illustration styles.
- Modify `script.js`: update only the `philosophy.html` mega-menu anchors and labels.
- Create `assets/philosophy/*.svg`: local hero, principle, comparison, routine, and translation visuals extracted from the approved concept.
- Reference `docs/superpowers/specs/2026-08-21-philosophy-page-design.md`: approved content and behavior contract.
- Reference `/Users/goran/.codex/visualizations/2026/08/21/01a02226-1c5e-7a53-8d50-c6167e280713/philosophy-hybrid-full-concept.html`: approved visual composition.

### Task 1: Replace the philosophy page content structure

**Files:**
- Modify: `philosophy.html:43-121`
- Reference: `docs/superpowers/specs/2026-08-21-philosophy-page-design.md`

- [ ] **Step 1: Run the structural baseline check and confirm it fails**

Run:

```bash
node -e "const fs=require('fs');const html=fs.readFileSync('philosophy.html','utf8');const ids=['philosophy-overview','holistic-view','core-principles','philosophy-method','same-signal-different-pattern','daily-support','modern-translation','philosophy-cta'];const missing=ids.filter(id=>!html.includes('id=\"'+id+'\"'));if(missing.length){console.error('Missing:',missing.join(', '));process.exit(1)}"
```

Expected: FAIL and list the new section IDs not yet present.

- [ ] **Step 2: Replace the current `<main>` with the approved semantic section skeleton**

Use this complete section order and preserve the existing announcement and header above it:

```html
<main class="philosophy-page-main">
  <section class="philosophy-page-hero" id="philosophy-overview">
    <div class="philosophy-page-hero__copy">
      <h1>先理解身体，再选择适合你的日常支持。</h1>
      <p>传统中医提供观察身体的方法，现代生活让这套方法变得清晰、轻盈，也更容易坚持。</p>
      <a class="button button--primary" href="./my-constitution.html">了解你的体质方向</a>
    </div>
    <figure class="philosophy-page-hero__visual">
      <img src="./assets/philosophy/hero-hybrid.svg" alt="人物生活场景、阴阳平衡与草本植物组成的理念视觉" />
    </figure>
  </section>

  <section class="philosophy-page-section philosophy-page-holistic" id="holistic-view">
    <div class="philosophy-page-section__copy">
      <h2>身体从来不是孤立的部件。</h2>
      <p>睡眠、消化、情绪、精力与季节彼此牵动。整体观念，就是把这些细微变化放回同一张身体地图里理解。</p>
    </div>
    <div class="philosophy-page-holistic__visual">
      <figure><img src="./assets/philosophy/holistic-lifestyle.svg" alt="户外舒展的日常生活场景" /></figure>
      <ul aria-label="身体关系地图">
        <li><strong>睡眠</strong><span>影响恢复</span></li>
        <li><strong>情绪</strong><span>牵动节律</span></li>
        <li><strong>消化</strong><span>回应压力</span></li>
        <li><strong>季节</strong><span>改变状态</span></li>
        <li><strong>节律</strong><span>持续调整</span></li>
      </ul>
    </div>
  </section>

  <section class="philosophy-page-section philosophy-page-principles" id="core-principles">
    <header class="philosophy-page-heading">
      <h2>四个原则，把古老的观察翻译成今天的生活方式。</h2>
      <p>真实生活场景建立信任，植物与身体插画解释看不见的关系。</p>
    </header>
    <div class="philosophy-page-principles__list">
      <article class="philosophy-page-principle" data-principle="holistic">
        <span>01</span><div><h3>整体观察</h3><p>从睡眠、消化、情绪、精力与生活环境一起看身体。</p></div><figure><img src="./assets/philosophy/principle-holistic.svg" alt="草本饮品与身体关系" /></figure>
      </article>
      <article class="philosophy-page-principle" data-principle="balance">
        <span>02</span><div><h3>动态平衡</h3><p>阴与阳不是固定标签，而是寒热、动静、消耗与恢复之间不断调整的关系。</p></div><figure><img src="./assets/philosophy/principle-balance.svg" alt="阴阳动态轨道" /></figure>
      </article>
      <article class="philosophy-page-principle" data-principle="personalized">
        <span>03</span><div><h3>辨证施养</h3><p>相似的感受可能来自不同的体质方向，调养方式也需要因人、因时而改变。</p></div><figure><img src="./assets/philosophy/principle-personalized.svg" alt="相似感受对应不同身体方向" /></figure>
      </article>
      <article class="philosophy-page-principle" data-principle="preventive">
        <span>04</span><div><h3>预防为先</h3><p>在明显不适出现之前读懂微小信号，把支持放进每天。</p></div><figure><img src="./assets/philosophy/principle-preventive.svg" alt="植物生长与持续调养" /></figure>
      </article>
    </div>
  </section>

  <section class="philosophy-page-method" id="philosophy-method">
    <header class="philosophy-page-heading">
      <h2>从身体信号，到适合你的日常方案。</h2>
      <p>先理解，再判断方向，最后才推荐产品与体验。</p>
    </header>
    <ol>
      <li><span>感</span><h3>读懂身体信号</h3><p>从最近的睡眠、压力、消化、情绪与能量状态开始。</p></li>
      <li><span>辨</span><h3>理解体质方向</h3><p>把复杂概念翻译成身体倾向，而不是给你贴标签。</p></li>
      <li><span>养</span><h3>建立日常节奏</h3><p>围绕作息、情绪、饮食与草本支持，形成更容易坚持的方案。</p></li>
    </ol>
  </section>

  <section class="philosophy-page-section philosophy-page-patterns" id="same-signal-different-pattern">
    <div><h2>同一种感受，可能来自不同的身体模式。</h2><p>“睡不好”只是表面描述。辨证施养，就是先看清差异。</p></div>
    <div class="philosophy-page-patterns__grid">
      <article><figure><img src="./assets/philosophy/pattern-tension.svg" alt="思绪紧绷难以入睡" /></figure><h3>紧绷难放松</h3><p>需要先帮助情绪与思绪慢下来。</p></article>
      <article><figure><img src="./assets/philosophy/pattern-recovery.svg" alt="疲惫并且恢复不足" /></figure><h3>疲惫恢复不足</h3><p>需要先建立稳定的休息与补充节奏。</p></article>
    </div>
  </section>

  <section class="philosophy-page-section philosophy-page-routines" id="daily-support">
    <header class="philosophy-page-heading"><h2>调养，应该自然地发生在生活里。</h2><p>从常见的五种日常需求出发，选择与你当前状态更匹配的支持。</p></header>
    <div class="philosophy-page-routines__grid">
      <a href="./products.html#product-showcase" data-routine="sleep"><figure><img src="./assets/philosophy/routine-sleep.svg" alt="安静睡眠场景" /></figure><span>睡眠 · 恢复</span></a>
      <a href="./products.html#product-showcase" data-routine="pressure"><figure><img src="./assets/philosophy/routine-pressure.svg" alt="放松呼吸场景" /></figure><span>压力 · 呼吸</span></a>
      <a href="./products.html#product-showcase" data-routine="digestive"><figure><img src="./assets/philosophy/routine-digestive.svg" alt="草本饮品场景" /></figure><span>消化 · 草本</span></a>
      <a href="./products.html#product-showcase" data-routine="emotion"><figure><img src="./assets/philosophy/routine-emotion.svg" alt="户外散步场景" /></figure><span>情绪 · 松弛</span></a>
      <a href="./products.html#product-showcase" data-routine="experience"><figure><img src="./assets/philosophy/routine-experience.svg" alt="草本体验与身体节律" /></figure><span>体验 · 节律</span></a>
    </div>
  </section>

  <section class="philosophy-page-translation" id="modern-translation">
    <figure><img src="./assets/philosophy/modern-translation.svg" alt="传统草本图谱与现代身体模式说明" /></figure>
    <div><h2>传统语言，现代解释。</h2><p>我们不把中医包装成神秘术语，也不做医疗诊断或夸大承诺。先讲感受，再讲可能的身体倾向，最后给出日常支持。</p><p>体质不是永久标签，而是一种帮助你更早觉察身体、持续调整生活的观察方法。</p></div>
  </section>

  <section class="philosophy-page-final" id="philosophy-cta">
    <blockquote>不是找到一个永久不变的答案，而是更早听见身体，并随着生活持续调整。</blockquote>
    <p>从一次轻量的体质对话开始，找到你当前更值得优先关注的方向。</p>
    <a class="button button--primary" href="./my-constitution.html">开始了解自己的体质</a>
  </section>
</main>
```

- [ ] **Step 3: Create the local SVG visual set**

Extract the matching vector compositions from the approved concept into the exact filenames referenced by the HTML. Each file must contain a root `<svg>` with its original `viewBox`, local gradients only, and no external `<image href>` dependency. Preserve the approved low-saturation sage, blush, cream, gold, and skin-tone palette.

- [ ] **Step 4: Run the structural check again**

Run the command from Step 1.

Expected: PASS with exit code 0 and no output.

### Task 2: Add the page-scoped visual system and responsive layout

**Files:**
- Modify: `styles.css:1288` (insert after the old philosophy component rules and before quiz styles)

- [ ] **Step 1: Confirm the new page selectors do not exist yet**

Run:

```bash
rg -n "^\.philosophy-page-(main|hero|section|principles|method|patterns|routines|translation|final)" styles.css
```

Expected: no matches before implementation.

- [ ] **Step 2: Add the complete page-scoped desktop styles**

Implement these selector families with the existing design tokens:

```css
.philosophy-page-main { display: grid; gap: 0; overflow: hidden; border-radius: var(--radius-xl); }
.philosophy-page-hero { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); align-items: center; min-height: 590px; padding: 72px 48px; background: var(--surface-blush); }
.philosophy-page-hero__copy { max-width: 34rem; }
.philosophy-page-hero__copy p { margin-top: 22px; color: var(--muted); font-size: 1.05rem; line-height: 1.75; }
.philosophy-page-hero__copy .button { margin-top: 28px; }
.philosophy-page-hero__visual { min-height: 430px; margin: 0; }
.philosophy-page-hero__visual svg { width: 100%; height: 100%; }
.philosophy-page-section { padding: 92px 48px; background: var(--surface); }
.philosophy-page-heading { max-width: 46rem; margin-bottom: 52px; }
.philosophy-page-heading p { margin-top: 18px; color: var(--muted); line-height: 1.7; }
.philosophy-page-holistic { display: grid; grid-template-columns: minmax(0, .7fr) minmax(0, 1.3fr); gap: 56px; }
.philosophy-page-holistic__visual { display: grid; grid-template-columns: 1.1fr .9fr; gap: 18px; }
.philosophy-page-holistic__visual figure { min-height: 330px; margin: 0; overflow: hidden; border-radius: 160px 160px var(--radius-sm) var(--radius-sm); }
.philosophy-page-holistic__visual ul { display: grid; align-content: center; gap: 0; margin: 0; padding: 0; list-style: none; }
.philosophy-page-holistic__visual li { display: flex; justify-content: space-between; gap: 16px; padding: 15px 2px; border-bottom: 1px solid var(--line); }
.philosophy-page-holistic__visual li span { color: var(--muted); }
.philosophy-page-principles { background: var(--bg); }
.philosophy-page-principles__list { display: grid; }
.philosophy-page-principle { display: grid; grid-template-columns: 64px minmax(0, .8fr) minmax(0, 1.2fr); gap: 30px; align-items: center; padding: 26px 0; border-top: 1px solid var(--line); }
.philosophy-page-principle:last-child { border-bottom: 1px solid var(--line); }
.philosophy-page-principle > span { align-self: start; color: var(--gold); font-family: "Cormorant Garamond", Georgia, serif; font-size: 1.35rem; }
.philosophy-page-principle p { margin-top: 12px; color: var(--muted); line-height: 1.7; }
.philosophy-page-principle figure { min-height: 178px; margin: 0; overflow: hidden; background: var(--surface-sage); }
.philosophy-page-method { padding: 92px 48px; background: var(--sage-dark); color: #f8f1e8; }
.philosophy-page-method h2, .philosophy-page-method h3 { color: #f8f1e8; }
.philosophy-page-method .philosophy-page-heading p { color: rgba(248, 241, 232, .72); }
.philosophy-page-method ol { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; margin: 0; padding: 0; list-style: none; background: rgba(248, 241, 232, .25); }
.philosophy-page-method li { min-height: 240px; padding: 28px; background: var(--sage-dark); }
.philosophy-page-method li > span { display: grid; place-items: center; width: 68px; height: 68px; margin-bottom: 28px; border: 1px solid rgba(248, 241, 232, .38); border-radius: 50%; font-family: "Cormorant Garamond", Georgia, serif; font-size: 1.8rem; }
.philosophy-page-method li p { margin-top: 12px; color: rgba(248, 241, 232, .72); line-height: 1.7; }
.philosophy-page-patterns { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); gap: 52px; }
.philosophy-page-patterns__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.philosophy-page-patterns article { overflow: hidden; background: var(--bg); }
.philosophy-page-patterns figure { margin: 0; aspect-ratio: 1.22; }
.philosophy-page-patterns article h3, .philosophy-page-patterns article p { margin-right: 18px; margin-left: 18px; }
.philosophy-page-patterns article h3 { margin-top: 18px; }
.philosophy-page-patterns article p { margin-top: 8px; margin-bottom: 20px; color: var(--muted); line-height: 1.65; }
.philosophy-page-routines { background: var(--bg); }
.philosophy-page-routines__grid { display: grid; grid-template-columns: 1.15fr .85fr .85fr; grid-template-rows: repeat(2, 220px); gap: 14px; }
.philosophy-page-routines__grid > a { position: relative; overflow: hidden; background: var(--surface-sage); }
.philosophy-page-routines__grid > a:first-child { grid-row: 1 / 3; }
.philosophy-page-routines__grid > a:last-child { grid-column: 2 / 4; }
.philosophy-page-routines figure { width: 100%; height: 100%; margin: 0; transition: transform 300ms ease; }
.philosophy-page-routines a:hover figure { transform: scale(1.025); }
.philosophy-page-routines a > span { position: absolute; right: 14px; bottom: 14px; left: 14px; padding: 10px 12px; background: rgba(255, 250, 244, .88); color: var(--heading); }
.philosophy-page-translation { display: grid; grid-template-columns: 1fr 1fr; min-height: 430px; background: var(--surface-blush); }
.philosophy-page-translation figure { min-height: 430px; margin: 0; }
.philosophy-page-translation > div { display: flex; flex-direction: column; justify-content: center; padding: 48px; }
.philosophy-page-translation p { margin-top: 18px; color: var(--muted); line-height: 1.7; }
.philosophy-page-final { padding: 96px 48px; background: var(--surface-sage); text-align: center; }
.philosophy-page-final blockquote { max-width: 52rem; margin: 0 auto 24px; font-family: "Cormorant Garamond", Georgia, serif; font-size: clamp(2.2rem, 4vw, 4rem); line-height: 1; color: var(--heading); }
.philosophy-page-final p { max-width: 38rem; margin: 0 auto 26px; color: var(--muted); line-height: 1.7; }
```

- [ ] **Step 3: Add tablet and mobile rules inside the existing media queries**

At `max-width: 960px`, stack the hero, holistic, pattern, and translation sections; reduce padding; change principle rows to two columns; keep method steps readable.

At `max-width: 640px`, use this exact behavior:

```css
.philosophy-page-hero,
.philosophy-page-holistic,
.philosophy-page-patterns,
.philosophy-page-translation { grid-template-columns: 1fr; }
.philosophy-page-hero,
.philosophy-page-section,
.philosophy-page-method,
.philosophy-page-final { padding: 54px 22px; }
.philosophy-page-hero__visual { min-height: 320px; }
.philosophy-page-holistic__visual,
.philosophy-page-patterns__grid { grid-template-columns: 1fr; }
.philosophy-page-principle { grid-template-columns: 42px minmax(0, 1fr); gap: 16px; }
.philosophy-page-principle figure { grid-column: 2; }
.philosophy-page-method ol { grid-template-columns: 1fr; }
.philosophy-page-method li { min-height: 0; }
.philosophy-page-routines__grid { grid-template-columns: 1fr; grid-template-rows: repeat(5, 200px); }
.philosophy-page-routines__grid > a:first-child,
.philosophy-page-routines__grid > a:last-child { grid-row: auto; grid-column: auto; }
.philosophy-page-translation > div { padding: 40px 22px 54px; }
```

- [ ] **Step 4: Add reduced-motion behavior**

```css
@media (prefers-reduced-motion: reduce) {
  .philosophy-page-routines figure { transition: none; }
  .philosophy-page-routines a:hover figure { transform: none; }
}
```

- [ ] **Step 5: Verify the new selector families exist**

Run the command from Step 1.

Expected: matches for all major selector families.

### Task 3: Update the philosophy navigation menu anchors

**Files:**
- Modify: `script.js:86-103`

- [ ] **Step 1: Replace the old philosophy mega-menu entries**

Use this exact configuration:

```js
"philosophy.html": {
  eyebrow: "理念",
  title: "理解身体的平衡方式",
  description: "从身体信号、体质方向到日常节奏，认识 SinoHerb 的中医理念。",
  overview: { label: "理念总览", href: "./philosophy.html#philosophy-overview" },
  links: [
    { label: "整体观念", description: "身体、情绪与环境彼此连接", href: "./philosophy.html#holistic-view" },
    { label: "四大原则", description: "整体、平衡、辨证与预防", href: "./philosophy.html#core-principles" },
    { label: "同感不同因", description: "相似感受也可能需要不同方向", href: "./philosophy.html#same-signal-different-pattern" },
    { label: "日常调养", description: "睡眠、压力、消化、情绪与体验", href: "./philosophy.html#daily-support" },
  ],
  feature: {
    eyebrow: "把理念变成行动",
    title: "找到你的体质方向",
    description: "从看懂自己的身体信号开始。",
    label: "进入体质对话",
    href: "./my-constitution.html#constitutionChat",
  },
},
```

- [ ] **Step 2: Update the cross-page constitution link**

Change the `my-constitution.html` menu link from `./philosophy.html#translation-method` to `./philosophy.html#philosophy-method`.

- [ ] **Step 3: Validate JavaScript syntax**

Run:

```bash
node --check script.js
```

Expected: exit code 0 and no output.

### Task 4: Run static content and safety validation

**Files:**
- Verify: `philosophy.html`
- Verify: `styles.css`
- Verify: `script.js`

- [ ] **Step 1: Verify required content and links**

Run:

```bash
node -e "const fs=require('fs');const html=fs.readFileSync('philosophy.html','utf8');const required=['整体观察','动态平衡','辨证施养','预防为先','睡眠 · 恢复','压力 · 呼吸','消化 · 草本','情绪 · 松弛','体验 · 节律','./my-constitution.html'];const missing=required.filter(value=>!html.includes(value));if(missing.length){console.error('Missing:',missing.join(', '));process.exit(1)}"
```

Expected: exit code 0 and no output.

- [ ] **Step 2: Verify forbidden product and medical claims are absent**

Run:

```bash
node -e "const fs=require('fs');const html=fs.readFileSync('philosophy.html','utf8');const forbidden=['捆绑包','治愈','治疗疾病','100%有效','临床证明'];const found=forbidden.filter(value=>html.includes(value));if(found.length){console.error('Forbidden:',found.join(', '));process.exit(1)}"
```

Expected: exit code 0 and no output.

- [ ] **Step 3: Check patch whitespace and syntax**

Run:

```bash
git diff --check -- philosophy.html styles.css script.js
node --check script.js
```

Expected: both commands exit with code 0.

### Task 5: Perform desktop and mobile visual QA

**Files:**
- Verify: `philosophy.html`

- [ ] **Step 1: Open the page in the Browser tool at desktop width**

Open:

```text
file:///Users/goran/Documents/AI项目/SinoHerb/philosophy.html
```

Use a desktop viewport near 1440 × 1000. Verify:

- Header and navigation remain unchanged.
- Hero copy, CTA, person, yin-yang, and botanical visual are visible above the fold.
- Every section appears in the approved order.
- Inline SVGs render without blank areas.
- Method steps have sufficient contrast.
- Routine collage contains exactly five categories and no bundle option.
- No horizontal overflow or clipped text.

- [ ] **Step 2: Verify the main interaction path**

Check that:

- Hovering the philosophy nav opens the updated menu.
- Philosophy menu links scroll to the correct section IDs.
- Both constitution CTAs navigate to `my-constitution.html`.
- Routine items link to the product showcase.
- The cart link continues its existing behavior without JavaScript errors.

- [ ] **Step 3: Check mobile width**

Use a viewport near 390 × 844. Verify:

- Hero copy appears before the visual.
- Principle visuals sit below their text.
- Method steps stack vertically.
- Routine collage becomes five readable rows.
- Navigation remains horizontally usable according to existing behavior.
- No text or SVG extends beyond the viewport.

- [ ] **Step 4: Compare against the approved concept and fix material mismatches**

Compare the rendered page with:

```text
/Users/goran/.codex/visualizations/2026/08/21/01a02226-1c5e-7a53-8d50-c6167e280713/philosophy-hybrid-full-concept.html
```

Fix any differences in section order, palette, spacing, headline hierarchy, image-to-text balance, CTA placement, or responsive behavior before completion.

- [ ] **Step 5: Re-run final verification**

Run:

```bash
git diff --check -- philosophy.html styles.css script.js
node --check script.js
```

Expected: both commands exit with code 0.

## Completion Notes

- Do not commit changes unless the user explicitly requests a commit.
- Preserve unrelated existing work in the dirty worktree.
- Do not modify product filtering, constitution dialogue logic, or cart data structures.
- Remove any temporary browser screenshots or QA files before handoff.

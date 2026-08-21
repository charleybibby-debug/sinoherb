# Product Recommendation Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the products page's current two-panel introduction with the approved featured-product recommendation hero while preserving the existing storefront filters, sorting, product grid, detail links, and cart drawer.

**Architecture:** Keep the existing static HTML/CSS/vanilla JavaScript architecture. Replace only `#products-overview` with semantic recommendation markup, add page-scoped `.product-recommendation*` styles to the shared stylesheet, and reuse the existing `.product-bottle` visual primitive and existing product detail query parameters.

**Tech Stack:** Static HTML5, CSS Grid/Flexbox, existing vanilla JavaScript behavior.

---

## File Structure

- Modify `products.html`: replace the old `.page-hero` with the approved featured and related product links.
- Modify `styles.css`: add desktop, tablet, and mobile styles scoped to `.product-recommendation*`.
- Reference `docs/superpowers/specs/2026-08-21-product-recommendation-hero-design.md`: approved content and layout contract.
- Reference `/Users/goran/.codex/visualizations/2026/08/21/01a02226-1c5e-7a53-8d50-c6167e280713/product-recommendation-options.html`: approved option A visual.

### Task 1: Replace the product page introduction

**Files:**
- Modify: `products.html:46`

- [ ] **Step 1: Run the structural test and confirm it fails**

Run:

```bash
node -e "const fs=require('fs');const html=fs.readFileSync('products.html','utf8');const required=['product-recommendation','product-recommendation__visual','product-recommendation__copy','product-recommendation__related'];const missing=required.filter(name=>!html.includes(name));if(missing.length){console.error('Missing:',missing.join(', '));process.exit(1)}"
```

Expected: FAIL because the approved recommendation structure is not present yet.

- [ ] **Step 2: Replace the old `#products-overview` section**

Use this semantic structure and leave `#product-showcase` untouched:

```html
<section class="product-recommendation" id="products-overview" aria-labelledby="productRecommendationTitle">
  <div class="product-recommendation__feature">
    <div class="product-recommendation__visual" aria-label="Balance Daily Pack 产品展示">
      <div class="product-recommendation__bottle product-bottle"><span>Balance<br /><small>DAILY</small></span></div>
    </div>
    <div class="product-recommendation__copy">
      <span class="product-recommendation__label">本周推荐 · 平和质 / 气虚质</span>
      <h1 id="productRecommendationTitle">从一件真正适合当下的产品开始</h1>
      <p>以日常精力、消化与恢复节奏为核心的基础支持。先看主推产品，再按体质延伸到更具体的睡眠、压力和情绪方案。</p>
      <div class="product-recommendation__points"><span>日常精力</span><span>消化支持</span><span>规律节奏</span></div>
      <div class="product-recommendation__actions"><a class="button button--primary" href="./product-detail.html?product=balance-daily-pack">查看主推产品</a><a class="button button--ghost" href="#product-showcase">按体质选购</a></div>
    </div>
  </div>
  <div class="product-recommendation__related" aria-label="关联产品推荐">
    <!-- Three linked product-recommendation-card entries for Yin Time Tea, Calm Pressure Blend, and Light Body Food Pack. -->
  </div>
</section>
```

Each related entry must include a miniature `.product-bottle`, product name, Chinese subtitle, category, constitution, price, and its existing product detail link.

- [ ] **Step 3: Run the structural test again**

Expected: PASS with exit code 0 and no output.

### Task 2: Add the approved responsive visual system

**Files:**
- Modify: `styles.css:494`

- [ ] **Step 1: Confirm the new selectors do not exist yet**

Run:

```bash
rg -n "^\.product-recommendation" styles.css
```

Expected: no matches before implementation.

- [ ] **Step 2: Add the desktop styles**

Add page-scoped rules for these exact selector families:

```css
.product-recommendation {}
.product-recommendation__feature {}
.product-recommendation__visual {}
.product-recommendation__copy {}
.product-recommendation__label {}
.product-recommendation__points {}
.product-recommendation__actions {}
.product-recommendation__related {}
.product-recommendation-card {}
.product-recommendation-card__visual {}
.product-recommendation-card__body {}
```

Use CSS Grid for the main two-column feature and three-column related row, the existing palette variables, an editorial border/radius treatment, and the existing `.product-bottle` primitive. Keep all selectors scoped so other pages remain unchanged.

- [ ] **Step 3: Add tablet and mobile behavior**

At `max-width: 1200px`, stack `.product-recommendation__feature` into one column and keep the visual at a controlled height. At `max-width: 640px`, make `.product-recommendation__related` a single column, reduce internal padding, and stack the two CTA buttons.

- [ ] **Step 4: Confirm selector coverage**

Run the command from Step 1 and confirm every selector family appears.

### Task 3: Verify preserved behavior and links

**Files:**
- Verify: `products.html`
- Verify: `styles.css`
- Verify: `script.js`

- [ ] **Step 1: Validate JavaScript syntax**

Run:

```bash
node --check script.js
```

Expected: PASS with exit code 0.

- [ ] **Step 2: Validate patch whitespace**

Run:

```bash
git diff --check -- products.html styles.css
```

Expected: PASS with no output.

- [ ] **Step 3: Validate product links and existing storefront controls**

Run:

```bash
node -e "const fs=require('fs');const html=fs.readFileSync('products.html','utf8');const links=['balance-daily-pack','yin-time-tea','calm-pressure-blend','light-body-food-pack'];const required=['data-product-filter','data-constitution-filter','data-product-sort','data-product-grid'];const missing=[...links,...required].filter(value=>!html.includes(value));if(missing.length){console.error('Missing:',missing.join(', '));process.exit(1)}"
```

Expected: PASS with exit code 0.

- [ ] **Step 4: Review desktop and mobile rendering**

Serve the static site locally, inspect the products page at a desktop viewport and a narrow mobile viewport, and confirm the recommendation area does not overflow, all four links are reachable, and the existing storefront remains directly below it.

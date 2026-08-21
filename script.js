let cartDrawer = null;
let openCartButtons = [];
let closeCartButtons = [];
const chatTranscript = document.getElementById("chatTranscript");
const chatComposer = document.getElementById("chatComposer");
const chatInput = document.getElementById("chatInput");
const chatSendButton = chatComposer?.querySelector('button[type="submit"]');
const chatResult = document.getElementById("chatResult");
const chatRestart = document.getElementById("chatRestart");
const chatStepLabel = document.getElementById("chatStepLabel");

let cartTrigger = null;

function openCart(event) {
  if (!cartDrawer) return;

  event?.preventDefault();
  cartTrigger = event.currentTarget;
  document.body.classList.add("cart-open");
  cartDrawer.setAttribute("aria-hidden", "false");
  openCartButtons.forEach((button) => button.setAttribute("aria-expanded", "true"));
  cartDrawer.querySelector("[data-close-cart]")?.focus();
}

function closeCart() {
  if (!cartDrawer || !document.body.classList.contains("cart-open")) return;

  document.body.classList.remove("cart-open");
  cartDrawer.setAttribute("aria-hidden", "true");
  openCartButtons.forEach((button) => button.setAttribute("aria-expanded", "false"));
  cartTrigger?.focus();
}

function getCartDrawerMarkup() {
  return `
    <aside
      class="cart-drawer"
      id="cartDrawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cartDrawerTitle"
      aria-hidden="true"
    >
      <div class="cart-drawer__top">
        <div>
          <span class="eyebrow">购物车</span>
          <h2 id="cartDrawerTitle">Your cart</h2>
        </div>
        <button class="icon-button" type="button" data-close-cart aria-label="关闭购物车">×</button>
      </div>

      <div class="cart-drawer__body">
        <div class="cart-drawer__items"><p>正在加载购物车…</p></div>

        <div class="cart-drawer__summary">
          <div>
            <span>Subtotal</span>
          <strong>$0.00</strong>
          </div>
          <p>可查看完整购物车，或直接进入结算页。</p>
        </div>
      </div>

      <div class="cart-drawer__actions">
        <a class="button button--primary" href="./checkout.html">去结算</a>
        <a class="button button--ghost" href="./cart.html">查看完整购物车</a>
      </div>
    </aside>

    <button class="drawer-backdrop" type="button" data-close-cart aria-label="关闭购物车"></button>
  `;
}

function setupCartDrawer() {
  const currentFile = normalizePath(window.location.pathname);
  if (["cart.html", "checkout.html"].includes(currentFile)) return;

  const page = document.querySelector(".page");
  if (!page) return;

  if (!document.getElementById("cartDrawer")) {
    page.insertAdjacentHTML("beforeend", getCartDrawerMarkup());
  }

  cartDrawer = document.getElementById("cartDrawer");
  openCartButtons = [...document.querySelectorAll("[data-open-cart], .site-nav .cart-button[href$='cart.html']")];
  closeCartButtons = [...document.querySelectorAll("[data-close-cart]")];

  openCartButtons.forEach((button) => {
    button.setAttribute("data-open-cart", "");
    button.setAttribute("aria-controls", "cartDrawer");
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", openCart);
  });
  closeCartButtons.forEach((button) => button.addEventListener("click", closeCart));
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCart();
  }
});

const megaMenuDefinitions = {
  "index.html": {
    eyebrow: "首页",
    title: "探索 SinoHerb",
    description: "从体质理解到产品选择，用一条清晰路径认识品牌。",
    overview: { label: "首页概览", href: "./index.html#home-overview" },
    links: [
      { label: "品牌入口", description: "了解 SinoHerb 的核心方式", href: "./index.html#home-overview" },
      { label: "产品路径", description: "按体质浏览五类支持产品", href: "./products.html" },
      { label: "体质理念", description: "用日常语言理解中医体质", href: "./philosophy.html" },
      { label: "关于我们", description: "品牌故事、团队与信任", href: "./about.html" },
    ],
    feature: {
      eyebrow: "推荐入口",
      title: "从一次体质对话开始",
      description: "用三步聊天找到更接近你的体质方向。",
      label: "开始对话",
      href: "./my-constitution.html#constitutionChat",
    },
  },
  "products.html": {
    eyebrow: "产品",
    title: "九种体质，五类支持",
    description: "先按体质找到自己，再从睡眠、压力、消化、情绪与体验中选择产品。",
    overview: { label: "产品总览", href: "./products.html#products-overview" },
    groups: [
      { label: "平和质", description: "健康型", anchor: "constitution-01" },
      { label: "气虚质", description: "容易累", anchor: "constitution-02" },
      { label: "阳虚质", description: "怕冷", anchor: "constitution-03" },
      { label: "阴虚质", description: "怕热缺水", anchor: "constitution-04" },
      { label: "痰湿质", description: "多痰肥胖", anchor: "constitution-05" },
      { label: "湿热质", description: "长痘出油", anchor: "constitution-06" },
      { label: "血瘀质", description: "长斑瘀堵", anchor: "constitution-07" },
      { label: "气郁质", description: "情绪压抑", anchor: "constitution-08" },
      { label: "特禀质", description: "过敏先天", anchor: "constitution-09" },
    ],
    constitutionOnly: true,
    categories: ["睡眠", "压力", "消化", "情绪", "体验"],
    feature: {
      eyebrow: "不确定选什么？",
      title: "先聊体质，再看推荐",
      description: "回答三个日常问题，获得更清晰的产品方向。",
      label: "开始体质对话",
      href: "./my-constitution.html#constitutionChat",
    },
  },
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
  "my-constitution.html": {
    eyebrow: "我的体质",
    title: "聊天式体质入口",
    description: "不用填写长表单，像聊天一样找到更接近的体质方向。",
    overview: { label: "体质入口", href: "./my-constitution.html#constitutionChat" },
    links: [
      { label: "开始三步对话", description: "从最近的身体感受开始", href: "./my-constitution.html#constitutionChat" },
      { label: "选择体质", description: "用下拉菜单筛选对应产品", href: "./products.html#product-showcase" },
      { label: "理解体质理念", description: "为什么先看感受再看产品", href: "./philosophy.html#philosophy-method" },
      { label: "查看产品路径", description: "睡眠、压力、消化、情绪与体验", href: "./products.html#product-showcase" },
    ],
    feature: {
      eyebrow: "3 steps",
      title: "感受 → 体质 → 方案",
      description: "完成后会得到体质解释和产品方向建议。",
      label: "立即开始",
      href: "./my-constitution.html#constitutionChat",
    },
  },
  "about.html": {
    eyebrow: "关于我们",
    title: "认识 SinoHerb",
    description: "了解品牌为什么这样解释中医，以及我们如何建立信任。",
    overview: { label: "品牌总览", href: "./about.html#about-overview" },
    links: [
      { label: "品牌故事", description: "让中医变成可理解的日常支持", href: "./about.html#brand-story" },
      { label: "团队方式", description: "品牌、内容、产品与体验协同", href: "./about.html#team" },
      { label: "信任原则", description: "透明推荐与简洁购买路径", href: "./about.html#trust" },
      { label: "我们的理念", description: "先理解感受，再提供方案", href: "./philosophy.html" },
    ],
    feature: {
      eyebrow: "认识之后",
      title: "亲自体验这条路径",
      description: "从聊天式体质入口开始了解自己。",
      label: "开始体质对话",
      href: "./my-constitution.html#constitutionChat",
    },
  },
};

function setupMegaMenu() {
  const siteHeader = document.querySelector(".site-header");
  const siteNav = siteHeader?.querySelector(".site-nav");
  if (!siteHeader || !siteNav) return;

  const megaMenu = document.createElement("div");
  megaMenu.className = "mega-menu";
  megaMenu.id = "siteMegaMenu";
  megaMenu.setAttribute("aria-hidden", "true");
  siteHeader.appendChild(megaMenu);

  const triggers = [...siteNav.querySelectorAll("a[href]")].filter((link) => {
    const menuKey = normalizePath(new URL(link.href, window.location.href).pathname);
    if (!megaMenuDefinitions[menuKey]) return false;

    link.classList.add("nav-menu-trigger");
    link.dataset.menuKey = menuKey;
    link.setAttribute("aria-controls", megaMenu.id);
    link.setAttribute("aria-expanded", "false");
    link.setAttribute("aria-haspopup", "true");
    return true;
  });

  let activeTrigger = null;
  let closeTimer = null;

  function renderMegaMenu(definition) {
    const linksMarkup = definition.groups
      ? `<div class="mega-menu__constitution-groups${definition.constitutionOnly ? " mega-menu__constitution-groups--only" : ""}">
          ${definition.groups
            .map(
              (group) => `
                <section class="mega-menu__constitution-group">
                  <a class="mega-menu__group-title" href="./products.html#product-showcase">
                    <strong>${group.label}</strong>
                    <span>${group.description}</span>
                  </a>
                  ${
                    definition.constitutionOnly
                      ? ""
                      : `<div class="mega-menu__sub-links">
                          ${definition.categories
                            .map((category) => `<a href="./products.html#product-showcase">${category}</a>`)
                            .join("")}
                        </div>`
                  }
                </section>
              `,
            )
            .join("")}
        </div>`
      : `<div class="mega-menu__links">
          ${definition.links
            .map(
              (item) => `
                <a class="mega-menu__link" href="${item.href}">
                  <strong>${item.label}</strong>
                  <span>${item.description}</span>
                </a>
              `,
            )
            .join("")}
        </div>`;

    megaMenu.setAttribute("aria-label", `${definition.title}菜单`);
    megaMenu.innerHTML = `
      <div class="mega-menu__intro">
        <span class="mega-menu__eyebrow">${definition.eyebrow}</span>
        <h2>${definition.title}</h2>
        <p>${definition.description}</p>
        <a class="mega-menu__overview" href="${definition.overview.href}">${definition.overview.label}<span aria-hidden="true">↗</span></a>
      </div>
      ${linksMarkup}
      <aside class="mega-menu__feature">
        <span class="mega-menu__eyebrow">${definition.feature.eyebrow}</span>
        <h3>${definition.feature.title}</h3>
        <p>${definition.feature.description}</p>
        <a href="${definition.feature.href}">${definition.feature.label}<span aria-hidden="true">→</span></a>
      </aside>
    `;
  }

  function cancelClose() {
    window.clearTimeout(closeTimer);
  }

  function openMegaMenu(trigger) {
    if (window.innerWidth <= 960) return;

    cancelClose();
    activeTrigger?.setAttribute("aria-expanded", "false");
    activeTrigger = trigger;
    activeTrigger.setAttribute("aria-expanded", "true");
    renderMegaMenu(megaMenuDefinitions[trigger.dataset.menuKey]);
    megaMenu.setAttribute("aria-hidden", "false");
    siteHeader.classList.add("mega-menu-open");
  }

  function closeMegaMenu({ restoreFocus = false } = {}) {
    cancelClose();
    if (restoreFocus) {
      activeTrigger?.focus();
    }
    siteHeader.classList.remove("mega-menu-open");
    megaMenu.setAttribute("aria-hidden", "true");
    activeTrigger?.setAttribute("aria-expanded", "false");
  }

  function scheduleClose() {
    cancelClose();
    closeTimer = window.setTimeout(() => closeMegaMenu(), 120);
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener("mouseenter", () => openMegaMenu(trigger));
    trigger.addEventListener("focus", () => openMegaMenu(trigger));
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        openMegaMenu(trigger);
        megaMenu.querySelector("a")?.focus();
      }
    });
  });

  siteHeader.addEventListener("mouseenter", cancelClose);
  siteHeader.addEventListener("mouseleave", scheduleClose);
  siteHeader.addEventListener("focusout", () => {
    window.setTimeout(() => {
      if (!siteHeader.contains(document.activeElement)) {
        closeMegaMenu();
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && siteHeader.classList.contains("mega-menu-open")) {
      closeMegaMenu({ restoreFocus: true });
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth <= 960) {
      closeMegaMenu();
    }
  });
}

function setupProductShowcase() {
  const grid = document.querySelector("[data-product-grid]");
  if (!grid) return;

  const cards = [...grid.querySelectorAll("[data-product-card]")];
  const filters = [...document.querySelectorAll("[data-product-filter]")];
  const count = document.querySelector("[data-product-count]");
  const emptyState = document.querySelector("[data-product-empty]");
  const sortSelect = document.querySelector("[data-product-sort]");
  const constitutionSelect = document.querySelector("[data-constitution-filter]");

  function sortCards() {
    const sort = sortSelect?.value || "featured";
    if (sort === "featured") return;

    cards.sort((first, second) => {
      if (sort === "name") {
        return first.dataset.name.localeCompare(second.dataset.name);
      }

      const firstPrice = Number(first.dataset.price);
      const secondPrice = Number(second.dataset.price);
      return sort === "price-low" ? firstPrice - secondPrice : secondPrice - firstPrice;
    });

    cards.forEach((card) => grid.appendChild(card));
  }

  function applyFilter(category = "all", constitution = constitutionSelect?.value || "all") {
    const visibleCards = cards.filter((card) => {
      const categories = (card.dataset.category || "").split(" ");
      const matchesCategory = category === "all" || categories.includes(category);
      const matchesConstitution = constitution === "all" || card.dataset.constitution === constitution;
      const isVisible = matchesCategory && matchesConstitution;
      card.hidden = !isVisible;
      return isVisible;
    });

    filters.forEach((filter) => {
      const isActive = filter.dataset.productFilter === category;
      filter.classList.toggle("is-active", isActive);
      filter.setAttribute("aria-pressed", String(isActive));
    });

    if (count) count.textContent = String(visibleCards.length);
    if (emptyState) emptyState.hidden = visibleCards.length > 0;
  }

  filters.forEach((filter) => {
    filter.addEventListener("click", () => {
      applyFilter(filter.dataset.productFilter, constitutionSelect?.value || "all");
    });
  });

  constitutionSelect?.addEventListener("change", () => {
    applyFilter(document.querySelector(".product-filter.is-active")?.dataset.productFilter || "all", constitutionSelect.value);
  });

  sortSelect?.addEventListener("change", () => {
    sortCards();
    applyFilter(
      document.querySelector(".product-filter.is-active")?.dataset.productFilter || "all",
      constitutionSelect?.value || "all",
    );
  });

  applyFilter("all");
}

function setupWisdomCarousel() {
  const carousel = document.querySelector("[data-wisdom-carousel]");
  const track = carousel?.querySelector("[data-wisdom-track]");
  const cards = track ? [...track.children] : [];
  const previousButton = document.querySelector("[data-wisdom-prev]");
  const nextButton = document.querySelector("[data-wisdom-next]");
  if (!carousel || !track || !cards.length || !previousButton || !nextButton) return;

  let index = 0;

  function visibleCount() {
    if (window.innerWidth <= 640) return 1;
    if (window.innerWidth <= 960) return 2;
    return 4;
  }

  function updateCarousel() {
    const visibleCards = visibleCount();
    const maximumIndex = Math.max(0, cards.length - visibleCards);
    index = Math.min(index, maximumIndex);
    const cardWidth = cards[0].getBoundingClientRect().width;
    const gap = Number.parseFloat(window.getComputedStyle(track).gap) || 0;
    track.style.transform = `translateX(-${index * (cardWidth + gap)}px)`;
    previousButton.disabled = index === 0;
    nextButton.disabled = index === maximumIndex;
    previousButton.setAttribute("aria-disabled", String(previousButton.disabled));
    nextButton.setAttribute("aria-disabled", String(nextButton.disabled));
  }

  previousButton?.addEventListener("click", () => {
    index = Math.max(0, index - 1);
    updateCarousel();
  });

  nextButton?.addEventListener("click", () => {
    index += 1;
    updateCarousel();
  });

  window.addEventListener("resize", updateCarousel);
  updateCarousel();
}

const productDetailData = {
  "balance-daily-pack": { title: "Balance Daily Pack", subtitle: "均衡日常餐包", category: "消化 · 平和质", price: "$48.00", compare: "$56.00" },
  "yin-time-tea": { title: "Yin Time Tea", subtitle: "睡前舒润茶", category: "睡眠 · 阴虚质", price: "$32.00", compare: "$38.00" },
  "calm-pressure-blend": { title: "Calm Pressure Blend", subtitle: "日常减压饮", category: "压力 · 气郁质", price: "$36.00", compare: "$42.00" },
  "warm-qi-bundle": { title: "Warm Qi Bundle", subtitle: "益气健脾早餐组合", category: "消化 · 气虚质", price: "$68.00", compare: "$78.00" },
  "night-ritual-set": { title: "Night Ritual Set", subtitle: "暖身睡前组合", category: "睡眠 · 阳虚质", price: "$74.00", compare: "$86.00" },
  "emotional-balance-tea": { title: "Emotional Balance Tea", subtitle: "平衡情绪花草茶", category: "情绪 · 气郁质", price: "$29.00", compare: "$34.00" },
  "workday-reset-kit": { title: "Workday Reset Kit", subtitle: "工作日压力恢复工具", category: "压力 · 气虚质", price: "$42.00", compare: "$49.00" },
  "breathing-experience": { title: "Breathing Experience", subtitle: "呼吸与户外体验", category: "体验 · 血瘀质", price: "$56.00", compare: "$64.00" },
  "light-body-food-pack": { title: "Light Body Food Pack", subtitle: "轻体祛湿餐包", category: "消化 · 痰湿质", price: "$46.00", compare: "$54.00" },
  "sleep-down-guide": { title: "Sleep Down Guide", subtitle: "温和晚间节律工具", category: "睡眠 · 特禀质", price: "$24.00", compare: "$29.00" },
  "clear-heart-bundle": { title: "Clear Heart Bundle", subtitle: "清心舒缓组合", category: "情绪 · 阴虚质", price: "$64.00", compare: "$74.00" },
  "seasonal-care-session": { title: "Seasonal Care Session", subtitle: "季节防护体验", category: "体验 · 特禀质", price: "$62.00", compare: "$72.00" },
  "warm-recovery-soup": { title: "Warm Recovery Soup", subtitle: "温阳汤饮组合", category: "消化 · 阳虚质", price: "$38.00", compare: "$45.00" },
  "clear-damp-tea": { title: "Clear Damp Tea", subtitle: "清热利湿茶饮", category: "消化 · 湿热质", price: "$34.00", compare: "$40.00" },
  "night-recovery-session": { title: "Night Recovery Session", subtitle: "夜间修复体验", category: "睡眠 · 血瘀质", price: "$58.00", compare: "$68.00" },
};

function setupProductDetail() {
  const title = document.querySelector("[data-detail-title]");
  if (!title) return;

  const key = new URLSearchParams(window.location.search).get("product") || "balance-daily-pack";
  const product = productDetailData[key] || productDetailData["balance-daily-pack"];
  title.textContent = product.title;
  document.querySelector("[data-detail-subtitle]").textContent = product.subtitle;
  document.querySelector("[data-detail-category]").textContent = product.category;
  document.querySelector("[data-detail-price]").textContent = product.price;
  document.querySelector("[data-detail-compare]").textContent = product.compare;
  document.title = `${product.title} | SinoHerb`;
}

function setupFaqAccordion() {
  const faq = document.getElementById("constitutionFaq");
  if (!faq) return;

  const items = [...faq.querySelectorAll(".constitution-faq__item")];
  const categoryLinks = [...faq.querySelectorAll(".constitution-faq__nav a")];

  items.forEach((item) => {
    item.addEventListener("toggle", () => {
      if (!item.open) return;
      items.forEach((otherItem) => {
        if (otherItem !== item) {
          otherItem.open = false;
        }
      });
    });
  });

  categoryLinks.forEach((link) => {
    link.addEventListener("click", () => {
      categoryLinks.forEach((item) => item.classList.remove("is-active"));
      link.classList.add("is-active");
    });
  });
}

const constitutionProfiles = {
  balanced: {
    label: "Balanced constitution",
    title: "平和质（平和体质）【健康型】",
    core: "阴阳气血均衡，身体机能协调。",
    summary: "面色红润、精力充沛、睡眠佳、二便正常，性格开朗，很少生病，适应能力强。",
    guidance: "均衡饮食，适度运动，维持现状即可。",
    products: ["饮食：均衡日常包", "泡脚：轻养护泡脚包", "体验：健康维持体验"],
  },
  qiDeficiency: {
    label: "Qi deficiency constitution",
    title: "气虚质（气虚体质）【容易累】",
    core: "元气不足，身体容易没电。",
    summary: "容易疲乏、气短懒言、稍微活动就出汗、易反复感冒，病后恢复慢。",
    guidance: "益气健脾，不宜大汗运动。",
    products: ["饮食：益气健脾早餐包", "泡脚：温养补气泡脚包", "体验：恢复节奏体验"],
  },
  yangDeficiency: {
    label: "Yang deficiency constitution",
    title: "阳虚质（阳虚体质）【怕冷】",
    core: "阳气不足，身体热量和推动力偏弱。",
    summary: "畏寒怕冷、手脚冰凉、喜喝热水，吃凉容易腹泻，耐夏不耐冬。",
    guidance: "温阳散寒，少吃生冷，注重保暖。",
    products: ["饮食：温阳汤饮组合", "泡脚：暖足驱寒泡脚包", "体验：冬日温养体验"],
  },
  yinDeficiency: {
    label: "Yin deficiency constitution",
    title: "阴虚质（阴虚体质）【怕热缺水】",
    core: "阴液亏虚，身体容易偏干、偏热、难以沉静。",
    summary: "手心脚心发热、口干咽燥、夜间盗汗、心烦失眠，大便偏干。",
    guidance: "滋阴润燥，忌熬夜，少食辛辣燥热。",
    products: ["饮食：滋阴润燥茶饮", "泡脚：睡前舒润泡脚包", "体验：夜间修复体验"],
  },
  phlegmDampness: {
    label: "Phlegm-damp constitution",
    title: "痰湿质（痰湿体质）【多痰肥胖】",
    core: "水湿痰湿积聚，身体代谢感偏慢。",
    summary: "腹部肥满松软、面部出油多、身体沉重困乏、口黏痰多，舌苔厚腻。",
    guidance: "健脾祛湿，少甜腻、少奶茶。",
    products: ["饮食：轻体祛湿餐包", "泡脚：健脾祛湿泡脚包", "体验：轻盈管理体验"],
  },
  dampHeat: {
    label: "Damp-heat constitution",
    title: "湿热质（湿热体质）【长痘出油】",
    core: "湿热内蕴，身体像闷热潮湿的环境。",
    summary: "面油长痘、口苦口臭、小便黄，大便黏滞不爽，身体有闷热感。",
    guidance: "清热利湿，饮食清淡，避开闷热潮湿环境。",
    products: ["饮食：清热利湿茶饮", "泡脚：清爽排浊泡脚包", "体验：湿热轻调体验"],
  },
  bloodStasis: {
    label: "Blood stasis constitution",
    title: "血瘀质（血瘀体质）【长斑瘀堵】",
    core: "血脉瘀滞不通，局部循环感偏弱。",
    summary: "面色晦暗、容易长色斑、皮肤易瘀斑、嘴唇颜色偏暗，局部可能刺痛。",
    guidance: "活血散瘀，适度舒展运动。",
    products: ["饮食：活络舒展餐包", "泡脚：温通舒络泡脚包", "体验：经络舒展体验"],
  },
  qiStagnation: {
    label: "Qi stagnation constitution",
    title: "气郁质（气郁体质）【情绪压抑】",
    core: "气机郁结，情绪和身体容易一起卡住。",
    summary: "多愁善感、情绪压抑焦虑、爱叹气、胸闷胁胀，睡眠较差。",
    guidance: "疏肝理气，多户外、多社交疏导情绪。",
    products: ["饮食：疏肝理气茶饮", "泡脚：舒郁放松泡脚包", "体验：呼吸与户外体验"],
  },
  inheritedSpecial: {
    label: "Inherited special constitution",
    title: "特禀质（特禀体质）【过敏先天】",
    core: "先天禀赋特异，对外界刺激更敏感。",
    summary: "过敏高发，花粉、食物、药物过敏；换季易打喷嚏、哮喘、荨麻疹等。",
    guidance: "避开花粉、致敏原，饮食均衡，增强防护。",
    products: ["饮食：温和低敏饮食包", "泡脚：舒缓防护泡脚包", "体验：季节防护体验"],
  },
};

const chatFlow = [
  {
    prompt: "先告诉我，最近身体最明显的感受是什么？",
  },
  {
    prompt: "我记下了。再说说这种状态通常在什么时候更明显，或者还伴随哪些表现？",
  },
  {
    prompt: "最后，你更想先从饮食、泡脚还是体验调养开始？",
  },
];

const constitutionKeywordRules = [
  { key: "balanced", keywords: ["稳定", "正常", "不错", "均衡", "精神好", "睡得好", "状态好"] },
  { key: "qiDeficiency", keywords: ["疲乏", "疲劳", "乏力", "没力气", "容易累", "气短", "懒言", "容易出汗", "恢复慢"] },
  { key: "yangDeficiency", keywords: ["怕冷", "冰凉", "手脚凉", "手脚冷", "喜热饮", "吃凉", "畏寒"] },
  { key: "yinDeficiency", keywords: ["口干", "咽干", "心烦", "盗汗", "手心热", "脚心热", "大便干", "燥热", "失眠"] },
  { key: "phlegmDampness", keywords: ["沉重", "口黏", "痰多", "肥胖", "困倦", "醒来也困", "舌苔厚", "腹部松软"] },
  { key: "dampHeat", keywords: ["出油", "长痘", "痘痘", "口苦", "口臭", "小便黄", "闷热"] },
  { key: "bloodStasis", keywords: ["脸色暗", "面色暗", "瘀斑", "刺痛", "色斑", "唇色暗", "血块"] },
  { key: "qiStagnation", keywords: ["压抑", "焦虑", "叹气", "胸闷", "胁胀", "梅核气", "情绪低落", "压力大"] },
  { key: "inheritedSpecial", keywords: ["过敏", "花粉", "鼻痒", "喷嚏", "哮喘", "荨麻疹", "换季敏感"] },
];

const preferenceKeywordRules = [
  { preference: "饮食", keywords: ["饮食", "茶饮", "餐包", "汤饮", "吃", "消化"] },
  { preference: "泡脚", keywords: ["泡脚", "足浴", "睡前", "睡眠"] },
  { preference: "体验", keywords: ["体验", "线下", "线上", "调理", "放松", "情绪", "压力"] },
];

const noPreferenceKeywords = ["都可以", "没有偏好", "没偏好", "不确定", "随意"];

const chatState = {
  stepIndex: 0,
  scores: {},
  preference: "",
};

function normalizePath(pathname) {
  const file = pathname.split("/").filter(Boolean).pop() || "index.html";
  return file === "/" ? "index.html" : file;
}

function setActiveNav() {
  const currentFile = normalizePath(window.location.pathname);
  document.querySelectorAll(".site-nav a[href]").forEach((link) => {
    const href = link.getAttribute("href") || "";
    const file = href.split("/").filter(Boolean).pop() || "index.html";
    const isCheckout = currentFile === "checkout.html" && file === "cart.html";
    if (file === currentFile || isCheckout) {
      link.classList.add("is-active");
      link.setAttribute("aria-current", "page");
    } else {
      link.classList.remove("is-active");
      link.removeAttribute("aria-current");
    }
  });
}

function setupAccountNav() {
  document.querySelectorAll(".site-nav").forEach((siteNav) => {
    if (siteNav.querySelector("a[href$='account.html']")) return;
    const link = document.createElement("a");
    link.href = "./account.html";
    link.textContent = "账户";
    link.className = "account-nav-link";
    const cart = siteNav.querySelector(".cart-button");
    siteNav.insertBefore(link, cart || null);
  });
}

function addScore(score = {}) {
  Object.entries(score).forEach(([key, value]) => {
    chatState.scores[key] = (chatState.scores[key] || 0) + value;
  });
}

function getTopProfileKey() {
  const entries = Object.entries(chatState.scores);
  if (!entries.length) {
    return "balanced";
  }

  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

function sortProducts(products) {
  if (!chatState.preference) {
    return products;
  }

  return [...products].sort((a, b) => {
    const aMatch = a.startsWith(chatState.preference) ? -1 : 0;
    const bMatch = b.startsWith(chatState.preference) ? -1 : 0;
    return aMatch - bMatch;
  });
}

function addMessage(type, content) {
  if (!chatTranscript) return;

  const message = document.createElement("div");
  message.className = `chat-message chat-message--${type}`;

  if (type === "assistant") {
    const label = document.createElement("span");
    label.textContent = "SinoHerb";
    message.appendChild(label);
  }

  const text = document.createElement("p");
  text.textContent = content;
  message.appendChild(text);
  chatTranscript.appendChild(message);
  chatTranscript.scrollTop = chatTranscript.scrollHeight;
}

function normalizeChatText(value) {
  return value.toLowerCase().replace(/[\s，。！？、,.!?；;：:]/g, "");
}

function findKeywordMatches(value, rules) {
  const normalizedValue = normalizeChatText(value);
  return rules
    .map((rule) => ({
      ...rule,
      matchCount: rule.keywords.filter((keyword) => normalizedValue.includes(normalizeChatText(keyword))).length,
    }))
    .filter((rule) => rule.matchCount > 0);
}

function analyzeChatInput(value, stepIndex) {
  if (stepIndex === chatFlow.length - 1) {
    const preferenceMatch = findKeywordMatches(value, preferenceKeywordRules).sort(
      (first, second) => second.matchCount - first.matchCount,
    )[0];
    const normalizedValue = normalizeChatText(value);
    const hasNoPreference = noPreferenceKeywords.some((keyword) =>
      normalizedValue.includes(normalizeChatText(keyword)),
    );

    if (!preferenceMatch && !hasNoPreference) {
      return { isValid: false };
    }

    return { isValid: true, preference: preferenceMatch?.preference || "" };
  }

  const weight = stepIndex === 0 ? 3 : 2;
  const constitutionMatches = findKeywordMatches(value, constitutionKeywordRules);
  if (!constitutionMatches.length) {
    return { isValid: false };
  }

  const score = {};
  constitutionMatches.forEach((match) => {
    score[match.key] = match.matchCount * weight;
  });
  return { isValid: true, score };
}

function setComposerDisabled(isDisabled) {
  if (chatInput) {
    chatInput.disabled = isDisabled;
    chatInput.placeholder = isDisabled ? "检测已完成" : "描述你的身体感受…";
  }
  if (chatSendButton) {
    chatSendButton.disabled = isDisabled;
  }
}

function renderResult(profile) {
  if (!chatResult) return;

  const products = sortProducts(profile.products);
  chatResult.classList.remove("is-waiting");
  chatResult.classList.add("is-ready");
  chatResult.innerHTML = `
    <span class="result-card__label">体质检测结果</span>
    <div class="result-card__panel">
      <p class="result-card__type">${profile.label}</p>
      <h3>${profile.title}</h3>
      <p class="result-card__summary"><strong>核心：</strong>${profile.core}</p>
      <p class="result-card__summary">${profile.summary}</p>
      <p class="result-card__summary"><strong>调养：</strong>${profile.guidance}</p>
      <div class="result-card__chips">
        ${products.map((item) => `<span>${item}</span>`).join("")}
      </div>
      <a class="button button--primary" href="./products.html">查看对应产品</a>
    </div>
  `;
}

function showStep() {
  const step = chatFlow[chatState.stepIndex];

  if (!step) {
    const profile = constitutionProfiles[getTopProfileKey()];
    addMessage("assistant", `根据你刚才说的，更接近「${profile.title}」。我已经把推荐方案放到右侧。`);
    renderResult(profile);
    if (chatStepLabel) {
      chatStepLabel.textContent = "Result ready";
    }
    setComposerDisabled(true);
    return;
  }

  addMessage("assistant", step.prompt);
  if (chatStepLabel) {
    chatStepLabel.textContent = `Step ${chatState.stepIndex + 1} / ${chatFlow.length}`;
  }
}

function resetChat() {
  chatState.stepIndex = 0;
  chatState.scores = {};
  chatState.preference = "";
  setComposerDisabled(false);

  if (chatTranscript) {
    chatTranscript.innerHTML = "";
  }

  if (chatInput) {
    chatInput.value = "";
  }

  if (chatResult) {
    chatResult.classList.remove("is-ready");
    chatResult.classList.add("is-waiting");
    chatResult.innerHTML = `
      <span class="result-card__label">体质检测结果</span>
      <div class="result-card__panel">
        <p class="result-card__type">等待你开始对话。</p>
        <h3>系统会先给你一个最接近的体质判断。</h3>
        <p class="result-card__summary">这里以后可以接大模型，输出体质类型、可理解解释、推荐方案和购买入口。</p>
        <div class="result-card__chips">
          <span>饮食产品</span>
          <span>泡脚产品</span>
          <span>体验类产品</span>
        </div>
      </div>
    `;
  }

  addMessage("assistant", "你好，我是 SinoHerb 体质顾问。我们不用表单，只像聊天一样找一个更接近你的体质方向。");
  showStep();
  chatInput?.focus();
}

setupCartDrawer();
setupAccountNav();
setActiveNav();
setupMegaMenu();
setupProductShowcase();
setupWisdomCarousel();
setupProductDetail();
setupFaqAccordion();

if (chatTranscript && chatComposer && chatInput && chatResult) {
  resetChat();

  chatComposer.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = chatInput.value.trim();
    if (!message || chatInput.disabled) return;

    const analysis = analyzeChatInput(message, chatState.stepIndex);
    addMessage("user", message);
    chatInput.value = "";

    if (!analysis.isValid) {
      const clarification =
        chatState.stepIndex === chatFlow.length - 1
          ? "你可以直接告诉我更想从饮食、泡脚或体验中的哪一种开始，也可以说没有偏好。"
          : "我还需要更具体一点的信息。可以描述疲劳、冷热、睡眠、消化、皮肤或情绪等身体感受。";
      addMessage("assistant", clarification);
      chatInput.focus();
      return;
    }

    addScore(analysis.score);
    chatState.preference = analysis.preference ?? chatState.preference;
    chatState.stepIndex += 1;
    showStep();
  });

  chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      chatComposer.requestSubmit();
    }
  });

  chatRestart?.addEventListener("click", resetChat);
}

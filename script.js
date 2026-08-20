const chatTranscript = document.getElementById("chatTranscript");
const chatReplies = document.getElementById("chatReplies");
const chatResult = document.getElementById("chatResult");
const chatRestart = document.getElementById("chatRestart");
const chatStepLabel = document.getElementById("chatStepLabel");

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
    prompt: "先告诉我，最近身体最像哪一句？",
    options: [
      { label: "整体状态稳定，睡眠和二便都不错", score: { balanced: 3 } },
      { label: "容易疲乏，稍微活动就没力气", score: { qiDeficiency: 3 } },
      { label: "怕冷，手脚经常冰凉", score: { yangDeficiency: 3 } },
      { label: "口干、心烦，晚上更难安静", score: { yinDeficiency: 3 } },
      { label: "身体沉重、口黏、痰多", score: { phlegmDampness: 3 } },
      { label: "容易出油长痘，口苦口臭", score: { dampHeat: 3 } },
      { label: "脸色暗，容易有瘀斑或局部刺痛", score: { bloodStasis: 3 } },
      { label: "情绪压抑焦虑，常常想叹气", score: { qiStagnation: 3 } },
      { label: "换季、花粉或食物很容易触发过敏", score: { inheritedSpecial: 3 } },
    ],
  },
  {
    prompt: "我记下了。再细一点，哪种日常表现更明显？",
    options: [
      { label: "精力、胃口、睡眠整体都比较均衡", score: { balanced: 2 } },
      { label: "气短懒言、容易出汗、恢复慢", score: { qiDeficiency: 2 } },
      { label: "喜热饮，吃凉的容易不舒服", score: { yangDeficiency: 2 } },
      { label: "手心脚心热、夜间盗汗、大便偏干", score: { yinDeficiency: 2 } },
      { label: "腹部松软、醒来也困、舌苔厚腻", score: { phlegmDampness: 2 } },
      { label: "小便黄、皮肤闷热、痘痘反复", score: { dampHeat: 2 } },
      { label: "唇色偏暗、色斑明显、女性经期血块多", score: { bloodStasis: 2 } },
      { label: "胸闷胁胀、睡眠差、容易梅核气", score: { qiStagnation: 2 } },
      { label: "鼻痒喷嚏、哮喘或荨麻疹容易反复", score: { inheritedSpecial: 2 } },
    ],
  },
  {
    prompt: "最后一步：你更想先从哪种日常支持开始？",
    options: [
      { label: "饮食产品：茶饮 / 餐包 / 汤饮", preference: "饮食" },
      { label: "泡脚产品：睡前热感仪式", preference: "泡脚" },
      { label: "体验产品：线上/线下养护体验", preference: "体验" },
    ],
  },
];

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

function renderReplies(step) {
  if (!chatReplies) return;

  chatReplies.innerHTML = step.options
    .map(
      (option, index) =>
        `<button class="chat-reply" type="button" data-option-index="${index}">${option.label}</button>`,
    )
    .join("");
}

function renderResult(profile) {
  if (!chatResult) return;

  const products = sortProducts(profile.products);
  chatResult.innerHTML = `
    <span class="result-card__label">体质结果</span>
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
    if (chatReplies) {
      chatReplies.innerHTML = `<p class="chat-complete">结果已生成。你可以查看右侧推荐，或点击下方按钮重新开始。</p>`;
    }
    return;
  }

  addMessage("assistant", step.prompt);
  renderReplies(step);
  if (chatStepLabel) {
    chatStepLabel.textContent = `Step ${chatState.stepIndex + 1} / ${chatFlow.length}`;
  }
}

function resetChat() {
  chatState.stepIndex = 0;
  chatState.scores = {};
  chatState.preference = "";

  if (chatTranscript) {
    chatTranscript.innerHTML = "";
  }

  if (chatResult) {
    chatResult.innerHTML = `
      <span class="result-card__label">体质结果</span>
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
}

setActiveNav();

if (chatTranscript && chatReplies && chatResult) {
  resetChat();

  chatReplies.addEventListener("click", (event) => {
    const target = event.target.closest("button[data-option-index], button[data-restart]");
    if (!target) return;

    if (target.dataset.restart) {
      resetChat();
      return;
    }

    const step = chatFlow[chatState.stepIndex];
    const option = step.options[Number(target.dataset.optionIndex)];
    if (!option) return;

    addMessage("user", option.label);
    addScore(option.score);
    if (option.preference) {
      chatState.preference = option.preference;
    }

    chatState.stepIndex += 1;
    showStep();
  });

  chatRestart?.addEventListener("click", resetChat);
}

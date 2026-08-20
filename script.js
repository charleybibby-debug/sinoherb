const body = document.body;
const quiz = document.getElementById("constitutionQuiz");
const result = document.getElementById("quizResult");
const cartDrawer = document.getElementById("cartDrawer");
const cartCount = document.querySelector("[data-cart-count]");
const openCartButtons = document.querySelectorAll("[data-open-cart]");
const closeCartButtons = document.querySelectorAll("[data-close-cart]");

const profiles = {
  liver: {
    label: "Liver Qi Stagnation",
    title: "肝郁焦虑体质",
    summary: "更容易紧绷、烦躁、胸口发闷，适合先从舒缓型饮食和放松型体验开始。",
    products: ["饮食：舒缓茶饮", "泡脚：放松包", "体验：呼吸练习"],
  },
  sleep: {
    label: "Sleep Disturbance",
    title: "失眠多梦体质",
    summary: "睡浅、多梦、醒得早，适合把夜间仪式和安神支持放在前面。",
    products: ["饮食：晚安茶", "泡脚：睡前包", "体验：夜间放松"],
  },
  damp: {
    label: "Damp-Heat / Heavy Body",
    title: "湿热厚重体质",
    summary: "身体重、口黏、容易困倦，更适合清爽、轻负担的支持方案。",
    products: ["饮食：轻盈饮食", "泡脚：排湿包", "体验：轻调理"],
  },
  qi: {
    label: "Qi Deficiency / Cold",
    title: "虚寒气虚体质",
    summary: "怕冷、没力气、恢复慢，适合温补型饮食和暖身支持。",
    products: ["饮食：温补饮食", "泡脚：暖身包", "体验：补气体验"],
  },
  stagnation: {
    label: "Qi Stagnation",
    title: "气机淤堵体质",
    summary: "总觉得堵、胀、卡住，适合顺气、疏通和轻运动式支持。",
    products: ["饮食：顺气饮食", "泡脚：活络包", "体验：疏通体验"],
  },
};

function openCart() {
  body.classList.add("cart-open");
  cartDrawer?.setAttribute("aria-hidden", "false");
}

function closeCart() {
  body.classList.remove("cart-open");
  cartDrawer?.setAttribute("aria-hidden", "true");
}

openCartButtons.forEach((button) => button.addEventListener("click", openCart));
closeCartButtons.forEach((button) => button.addEventListener("click", closeCart));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCart();
  }
});

function computeProfile(answers) {
  const scores = { liver: 0, sleep: 0, damp: 0, qi: 0, stagnation: 0 };

  for (const value of Object.values(answers)) {
    if (value in scores) {
      scores[value] += 1;
    }
  }

  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

if (quiz && result) {
  quiz.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(quiz);
    const answers = Object.fromEntries(formData.entries());
    const key = computeProfile(answers);
    const profile = profiles[key];

    result.innerHTML = `
      <p class="result-card__type">${profile.label}</p>
      <h3>${profile.title}</h3>
      <p class="result-card__summary">${profile.summary}</p>
      <div class="result-card__chips">
        ${profile.products.map((item) => `<span>${item}</span>`).join("")}
      </div>
    `;

    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
    cartCount.textContent = "1";
  });

  quiz.addEventListener("reset", () => {
    result.innerHTML = `
      <p class="result-card__type">等待你完成问卷。</p>
      <h3>系统会先给你一个最接近的体质判断。</h3>
      <p class="result-card__summary">这里以后可以直接接大模型，输出体质类型、解释、推荐方案和下一步购买入口。</p>
      <div class="result-card__chips">
        <span>饮食产品</span>
        <span>泡脚产品</span>
        <span>体验类产品</span>
      </div>
    `;
  });
}

const quiz = document.getElementById("constitutionQuiz");
const result = document.getElementById("quizResult");

const profiles = {
  liver: {
    title: "肝郁焦虑体质",
    label: "Liver Qi Stagnation",
    summary: "更容易紧张、胸口发紧、情绪波动明显，适合偏舒缓的饮食和放松型体验。",
    products: ["舒缓饮食", "情绪调理茶饮", "放松型体验"],
  },
  sleep: {
    title: "失眠多梦体质",
    label: "Sleep Disturbance",
    summary: "睡浅、多梦、醒得早，建议优先做睡前仪式和安神方向的支持。",
    products: ["睡前饮食建议", "泡脚安神包", "夜间放松体验"],
  },
  damp: {
    title: "湿热厚重体质",
    label: "Damp-Heat Pattern",
    summary: "身体重、口黏、容易困倦，更适合清爽型饮食和热感排湿护理。",
    products: ["轻负担饮食", "草本泡脚包", "排湿体验"],
  },
  qi: {
    title: "虚寒气虚体质",
    label: "Qi Deficiency / Cold",
    summary: "怕冷、乏力、恢复慢，适合温补型饮食和更有包裹感的支持。",
    products: ["温补饮食", "暖身泡脚包", "补气体验"],
  },
  stagnation: {
    title: "气机淤堵体质",
    label: "Qi Stagnation",
    summary: "胀气、卡住、走路都觉得不顺，适合顺气型饮食和轻运动式体验。",
    products: ["顺气饮食", "活络泡脚包", "疏通体验"],
  },
};

function computeProfile(data) {
  const scores = { liver: 0, sleep: 0, damp: 0, qi: 0, stagnation: 0 };
  Object.values(data).forEach((value) => {
    if (value && scores[value] !== undefined) {
      scores[value] += 1;
    }
  });

  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

quiz?.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(quiz);
  const answers = Object.fromEntries(formData.entries());
  const key = computeProfile(answers);
  const profile = profiles[key];

  result.innerHTML = `
    <p class="assessment__type">${profile.label}</p>
    <h3>${profile.title}</h3>
    <p class="assessment__summary">${profile.summary}</p>
    <div class="assessment__chips">
      ${profile.products.map((item) => `<span>${item}</span>`).join("")}
    </div>
  `;

  result.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

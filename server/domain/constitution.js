export const constitutionTypes = [
  "balanced",
  "qiDeficiency",
  "yangDeficiency",
  "yinDeficiency",
  "phlegmDampness",
  "dampHeat",
  "bloodStasis",
  "qiStagnation",
  "inheritedSpecial",
];

const productCategories = ["digestive", "sleep", "pressure", "emotion", "experience", "tools"];
const confidenceLevels = ["low", "medium", "high"];

export function validateConstitutionResult(result) {
  if (!result || typeof result !== "object") throw new Error("constitution result must be an object");
  if (!constitutionTypes.includes(result.primaryType)) throw new Error("invalid primary constitution");
  if (result.secondaryType !== null && result.secondaryType !== undefined && !constitutionTypes.includes(result.secondaryType)) {
    throw new Error("invalid secondary constitution");
  }
  if (!confidenceLevels.includes(result.confidenceLevel)) throw new Error("invalid confidence level");
  if (!Array.isArray(result.evidence) || result.evidence.length > 5 || result.evidence.some((item) => typeof item !== "string")) {
    throw new Error("evidence must be a short string array");
  }
  if (!Array.isArray(result.guidance) || result.guidance.length > 5 || result.guidance.some((item) => typeof item !== "string")) {
    throw new Error("guidance must be a short string array");
  }
  if (!Array.isArray(result.productCategories) || result.productCategories.some((item) => !productCategories.includes(item))) {
    throw new Error("invalid product category");
  }
  if (typeof result.safetyNotice !== "string" || result.safetyNotice.length < 1 || result.safetyNotice.length > 300) {
    throw new Error("safety notice is required");
  }
  return {
    primaryType: result.primaryType,
    secondaryType: result.secondaryType || null,
    confidenceLevel: result.confidenceLevel,
    evidence: result.evidence.slice(0, 5),
    guidance: result.guidance.slice(0, 5),
    productCategories: [...new Set(result.productCategories)],
    safetyNotice: result.safetyNotice,
  };
}

export function buildFallbackResult(messages = []) {
  const text = messages.map((message) => message.content || "").join(" ");
  const lower = text.toLowerCase();
  let primaryType = "balanced";
  if (/累|疲|气短|没力|容易感冒/.test(text)) primaryType = "qiDeficiency";
  else if (/怕冷|手脚冰|凉|热水/.test(text)) primaryType = "yangDeficiency";
  else if (/口干|盗汗|心烦|怕热|失眠/.test(text)) primaryType = "yinDeficiency";
  else if (/痰|沉重|困乏|出油|甜腻/.test(text)) primaryType = "phlegmDampness";
  else if (/长痘|口苦|闷热|油/.test(text)) primaryType = "dampHeat";
  else if (/斑|瘀|刺痛|晦暗/.test(text)) primaryType = "bloodStasis";
  else if (/压抑|焦虑|叹气|胸闷|情绪|压力/.test(text) || lower.includes("stress")) primaryType = "qiStagnation";

  const category = /睡|失眠|夜间/.test(text) ? "sleep" : /消化|腹|胃|大便/.test(text) ? "digestive" : /压力|焦虑|紧绷/.test(text) ? "pressure" : "experience";
  return validateConstitutionResult({
    primaryType,
    secondaryType: null,
    confidenceLevel: "low",
    evidence: ["根据本次对话中描述的近期身体感受生成初步方向。"],
    guidance: ["先从规律作息、清淡饮食和适度活动开始，持续观察身体变化。"],
    productCategories: [category],
    safetyNotice: "这只是健康生活参考，不是医疗诊断；如有严重或持续不适，请咨询专业医生。",
  });
}

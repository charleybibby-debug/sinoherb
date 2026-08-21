const api = async (path, options = {}) => {
  const response = await fetch(`/api/v1${path}`, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || "请求失败，请稍后再试。");
  return payload.data;
};

const card = document.querySelector("#accountCard");
const profile = document.querySelector("#accountProfile");
const form = document.querySelector("#accountForm");
const message = document.querySelector("#accountMessage");
const submitButton = document.querySelector("#accountSubmit");
let mode = "login";
const escapeText = (value) => String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]);

function setMessage(text = "", isError = false) {
  message.textContent = text;
  message.dataset.state = isError ? "error" : "success";
}

function setMode(nextMode) {
  mode = nextMode;
  document.querySelectorAll("[data-account-mode]").forEach((button) => button.classList.toggle("is-active", button.dataset.accountMode === mode));
  document.querySelectorAll("[data-register-only]").forEach((element) => { element.hidden = mode !== "register"; });
  form.elements.password.autocomplete = mode === "register" ? "new-password" : "current-password";
  submitButton.textContent = mode === "register" ? "创建账户" : "登录账户";
  setMessage("");
}

function showProfile(user) {
  card.hidden = true;
  profile.hidden = false;
  document.querySelector("#accountName").textContent = user.name || user.email || user.phone || "朋友";
  document.querySelector("#accountDetails").innerHTML = `<span>${escapeText(user.email || "未绑定邮箱")}</span><span>${escapeText(user.phone || "未绑定手机号")}</span>`;
}

document.querySelectorAll("[data-account-mode]").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.accountMode)));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  if (mode === "login" && !values.email && !values.phone) { setMessage("请输入邮箱或手机号。", true); return; }
  if (mode === "register" && !values.email && !values.phone) { setMessage("邮箱或手机号至少填写一个。", true); return; }
  submitButton.disabled = true;
  setMessage(mode === "register" ? "正在创建账户…" : "正在登录…");
  try {
    const data = mode === "register" ? await api("/auth/register", { method: "POST", body: JSON.stringify(values) }) : await api("/auth/login", { method: "POST", body: JSON.stringify({ identifier: values.email || values.phone, password: values.password }) });
    showProfile(data.user);
  } catch (error) { setMessage(error.message, true); } finally { submitButton.disabled = false; }
});

document.querySelector("#accountLogout").addEventListener("click", async () => {
  try { await api("/auth/logout", { method: "POST" }); } catch {}
  profile.hidden = true;
  card.hidden = false;
  form.reset();
  setMode("login");
});

api("/auth/session").then((data) => { if (data.user) showProfile(data.user); }).catch(() => {});

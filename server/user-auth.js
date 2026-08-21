import { randomUUID } from "node:crypto";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email) {
  if (email === undefined || email === null || email === "") return null;
  const normalized = String(email).trim().toLowerCase();
  if (!emailPattern.test(normalized) || normalized.length > 254) throw new Error("邮箱格式无效。");
  return normalized;
}

export function normalizePhone(phone) {
  if (phone === undefined || phone === null || phone === "") return null;
  const raw = String(phone).trim();
  const normalized = (raw.startsWith("+") ? "+" : "") + raw.replace(/\D/g, "");
  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 20 || (normalized.includes("+") && !normalized.startsWith("+"))) throw new Error("手机号格式无效。");
  return normalized;
}

export function normalizeIdentifier(identifier) {
  const value = String(identifier || "").trim();
  if (!value) throw new Error("请输入邮箱或手机号。");
  return value.includes("@") ? normalizeEmail(value) : normalizePhone(value);
}

export function validateRegistration(body = {}) {
  const email = normalizeEmail(body.email);
  const phone = normalizePhone(body.phone);
  if (!email && !phone) throw new Error("邮箱或手机号至少填写一个。");
  if (typeof body.password !== "string" || body.password.length < 12 || body.password.length > 200) throw new Error("密码长度需要在 12 到 200 位之间。");
  const name = body.name === undefined || body.name === null ? "" : String(body.name).trim();
  if (name.length > 120) throw new Error("昵称不能超过 120 个字符。");
  return { email, phone, name };
}

export function publicUser(user) {
  if (!user) return null;
  return { id: user.id, email: user.email || null, phone: user.phone || null, name: user.name || "", status: user.status || "active", createdAt: user.createdAt || null, lastLoginAt: user.lastLoginAt || null };
}

export function createUserSession(userId, token, retentionDays = 30) {
  return { id: randomUUID(), userId, token, expiresAt: Date.now() + retentionDays * 86400000, createdAt: Date.now() };
}

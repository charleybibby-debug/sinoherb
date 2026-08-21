import assert from "node:assert/strict";
import test from "node:test";
import { normalizeIdentifier, publicUser, validateRegistration } from "../server/user-auth.js";
import { MemoryRepository } from "../server/repositories/memory-repository.js";

test("user registration accepts a normalized email or phone and a strong password", () => {
  const registration = validateRegistration({ email: " User@Example.com ", password: "a-strong-password-12", name: "Test User" });
  assert.equal(registration.email, "user@example.com");
  assert.equal(registration.phone, null);
  assert.equal(normalizeIdentifier(" USER@Example.com "), "user@example.com");
});

test("user registration rejects missing contact details and short passwords", () => {
  assert.throws(() => validateRegistration({ password: "short" }), /邮箱或手机号/);
});

test("memory repository stores users without exposing password hashes", async () => {
  const repository = new MemoryRepository();
  const user = await repository.createUser({ email: "user@example.com", phone: null, name: "Test User", passwordHash: "secret-hash" });
  assert.equal(publicUser(user).email, "user@example.com");
  assert.equal(publicUser(user).passwordHash, undefined);
  assert.equal((await repository.listUsers()).length, 1);
});

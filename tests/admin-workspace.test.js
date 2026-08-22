import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("admin workspace exposes the desktop navigation and six views", async () => {
  const html = await readFile(new URL("../admin/index.html", import.meta.url), "utf8");
  for (const view of ["overview", "orders", "products", "media", "users", "model"]) {
    assert.match(html, new RegExp(`data-admin-view="${view}"`));
    assert.match(html, new RegExp(`data-view="${view}"`));
  }
  assert.match(html, /class="admin-workspace"/);
  assert.match(html, /class="admin-sidebar"/);
  assert.match(html, /class="admin-topbar"/);
  const script = await readFile(new URL("../admin/admin.js", import.meta.url), "utf8");
  assert.match(script, /adminModelConfigForm/);
  assert.match(script, /\/admin\/model-config/);
  assert.match(script, /\/admin\/model-config\/test/);
  assert.match(script, /测试模型联通性/);
  assert.match(script, /admin-model-form__label/);
  assert.match(script, /admin-model-form__hint/);
  assert.match(script, /paymentMethodLabel/);
  assert.match(script, /paymentStatusLabel/);
  assert.match(script, /\/admin\/users/);
});

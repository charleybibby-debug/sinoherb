# 后台上架与全站图片管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在运营后台增加完整的产品上下架筛选与全站固定图片位上传管理，并让前台安全读取自定义图片。

**Architecture:** 以 `media_assets` 保存固定图片位元数据，API 负责管理员鉴权、multipart 校验、文件版本保留和公开配置读取；API 与 Nginx 共享持久化上传卷。前台通过 `frontend-api.js` 将 slot key 映射到图片元素，接口失败时沿用现有静态资源。

**Tech Stack:** Fastify 5、PostgreSQL 16、`@fastify/multipart`、原生 HTML/CSS/JavaScript、Docker Compose。

---

### Task 1: Add media schema and seeded slots

**Files:**
- Create: `db/003_media_assets.sql`
- Create: `server/scripts/migrate-media.js`
- Modify: `Dockerfile`
- Modify: `tests/deployment.test.js`

- [ ] **Step 1: Add a migration with fixed slots and indexes**

  Create `media_assets` with unique `slot_key`, page grouping, default path, current path, alt text, MIME metadata, status, timestamps, and a slot index. Seed all current page/image references with stable keys and default paths; use `ON CONFLICT` so restarts are safe.

- [ ] **Step 2: Add a deployment regression assertion**

  Assert the migration creates `media_assets` and includes the unique `slot_key` constraint.

- [ ] **Step 3: Run the deployment test**

  Run `node --test tests/deployment.test.js` and expect the new assertion to pass.

- [ ] **Step 4: Run the media migration idempotently at container startup**

  Add `server/scripts/migrate-media.js` to execute `003_media_assets.sql` against `DATABASE_URL`; invoke it before `server/app.js` in the Docker command so existing volumes receive the schema without being deleted.

### Task 2: Implement repository and upload services

**Files:**
- Modify: `package.json`
- Modify: `server/config.js`
- Modify: `server/repositories/postgres-repository.js`
- Create: `server/media-storage.js`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add multipart dependency and upload settings**

  Add `@fastify/multipart`; add `MEDIA_UPLOAD_DIR`, `MEDIA_MAX_BYTES`, and `MEDIA_BACKUP_LIMIT` config values with safe defaults.

- [ ] **Step 2: Add safe media storage operations**

  Implement random filenames, allowed MIME checks, 5 MB limit, path traversal protection, atomic temporary-file rename, backup rotation, and cleanup of the temporary file on failure.

- [ ] **Step 3: Add repository methods**

  Implement `listMediaAssets`, `getMediaAssetBySlot`, `updateMediaAsset`, and `restoreMediaAsset` with parameterized SQL and current/default URL fields.

- [ ] **Step 4: Share a persistent upload volume**

  Mount `sinoherb-media:/app/uploads` in API and `/usr/share/nginx/html/uploads:ro` in Nginx; expose only the Nginx static path.

### Task 3: Add public and admin media APIs

**Files:**
- Modify: `server/routes/public.js`
- Modify: `server/routes/admin.js`
- Modify: `server/app.js`
- Modify: `tests/repository.test.js`
- Modify: `tests/deployment.test.js`

- [ ] **Step 1: Register multipart and public media route**

  Register `@fastify/multipart` with the configured limit and add `GET /api/v1/media` returning active slots only.

- [ ] **Step 2: Add authenticated admin routes**

  Add admin list, multipart replacement, metadata patch, and restore routes. Validate slot existence before writing; preserve current asset when validation or storage fails.

- [ ] **Step 3: Test the repository update cycle**

  Cover list, replacement metadata, restore, and inactive filtering with a fake pool/repository fixture.

- [ ] **Step 4: Run focused server tests**

  Run `node --test tests/repository.test.js tests/deployment.test.js` and expect zero failures.

### Task 4: Upgrade admin product and media UI

**Files:**
- Modify: `admin/index.html`
- Modify: `admin/admin.js`
- Modify: `admin/admin.css`

- [ ] **Step 1: Add product status filters and localized labels**

  Render `全部 / 已上架 / 已下架` filters, fetch all products once, filter client-side, and render the correct `上架` or `下架` action for every row.

- [ ] **Step 2: Add grouped media manager**

  Render page groups, previews, file metadata, alt-text inputs, replace file controls, restore buttons, and status/error feedback. Use `FormData` for uploads and preserve the selected group after refresh.

- [ ] **Step 3: Add responsive styling**

  Keep the current visual language while making media rows usable on narrow screens and keeping action buttons accessible.

- [ ] **Step 4: Run syntax checks**

  Run `node --check admin/admin.js` and inspect the rendered DOM in the browser after login.

### Task 5: Wire front-end image slots and verify deployment

**Files:**
- Modify: `frontend-api.js`
- Modify: `index.html`
- Modify: `products.html`
- Modify: `product-detail.html`
- Modify: `philosophy.html`
- Modify: `my-constitution.html`
- Modify: `about.html`
- Modify: `nginx.conf`
- Modify: `README.md`

- [ ] **Step 1: Add slot-key attributes and image hydration**

  Mark managed images with `data-media-slot`; fetch the public media map once; update `src` and `alt` only when a valid custom asset is returned.

- [ ] **Step 2: Preserve static fallbacks**

  Ensure no page depends on the API to render its initial image and keep all current default paths intact.

- [ ] **Step 3: Validate the complete flow**

  Run all tests, `git diff --check`, `docker compose config`, then verify the homepage, products, detail, philosophy, constitution, about, admin filters, upload preview, restore, and public image URLs in the browser.

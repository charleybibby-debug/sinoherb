# Model Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure, database-backed model configuration form that updates the running LLM provider without restarting Docker.

**Architecture:** Store one encrypted model configuration row in PostgreSQL, expose masked admin APIs, and keep a mutable runtime configuration object shared by the provider and admin route. Environment variables remain the initial fallback. The existing desktop admin model view receives the form and refreshes its status after saves.

**Tech Stack:** Fastify, PostgreSQL, Node Web Crypto, vanilla JavaScript, existing admin CSS, Node test runner.

---

### Task 1: Lock the repository contract with failing tests

**Files:**
- Modify: `tests/repository.test.js`
- Create: `tests/model-config.test.js`

- [ ] Add tests for MemoryRepository model configuration defaults, masked public data, and replacement without exposing the API key.
- [ ] Run `node --test tests/model-config.test.js`; in this shell it is expected to report that the new repository methods are missing because the Node CLI is unavailable.

### Task 2: Add encrypted model configuration primitives

**Files:**
- Create: `server/model-config.js`
- Modify: `server/config.js`
- Modify: `.env.example`
- Modify: `README.md`
- Create: `db/004_model_configs.sql`

- [ ] Implement AES-256-GCM encrypt/decrypt helpers using a 64-character hex `CONFIG_ENCRYPTION_KEY`.
- [ ] Implement runtime config loading, fallback precedence, input validation, masked public serialization, and in-memory updates.
- [ ] Add the singleton table and indexes, plus the required environment documentation.

### Task 3: Connect PostgreSQL and memory repositories

**Files:**
- Modify: `server/repositories/memory-repository.js`
- Modify: `server/repositories/postgres-repository.js`

- [ ] Add `getModelConfig`, `saveModelConfig`, and `ensureModelConfigSchema` methods to both repositories.
- [ ] Ensure PostgreSQL creates the table at application startup so existing Docker volumes receive the migration without data loss.

### Task 4: Make the provider reload configuration at runtime

**Files:**
- Modify: `server/llm/provider.js`
- Modify: `server/app.js`
- Modify: `server/routes/admin.js`

- [ ] Pass the runtime model configuration to the provider and read current values for every completion.
- [ ] Add masked model configuration to model health and a protected PATCH endpoint.
- [ ] Preserve local fallback behavior when no API Key is configured.

### Task 5: Add the desktop admin configuration form

**Files:**
- Modify: `admin/index.html`
- Modify: `admin/admin.js`
- Modify: `admin/admin.css`
- Modify: `tests/admin-workspace.test.js`

- [ ] Add URL, model, masked-key, and save controls to the model view.
- [ ] Load current public configuration, submit replacements, keep blank API Key unchanged, and show feedback.
- [ ] Keep the desktop-only layout and never place the real key in rendered HTML.

### Task 6: Verify the complete change

**Files:**
- Test: `tests/model-config.test.js`
- Test: `tests/repository.test.js`
- Test: `tests/admin-workspace.test.js`

- [ ] Parse changed JavaScript modules and run targeted tests where Node is available.
- [ ] Run `git diff --check` and `docker compose config --quiet`.
- [ ] Open `/admin/` in the local browser, verify the model form and status views, and inspect browser logs for errors.

# SinoHerb Cloud Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Upgrade the static SinoHerb site with a deployable Fastify/PostgreSQL backend, anonymous carts, AI-assisted constitution chat, contact orders, admin APIs, and Docker deployment.

**Architecture:** Add a self-contained server Node.js service exposing versioned APIs. Keep domain logic in small modules with an in-memory repository for tests and PostgreSQL for production. Use an environment-driven LLM provider and retain local constitution rules as fallback.

**Tech Stack:** Node.js LTS, Fastify, PostgreSQL, pg, Argon2id, Vitest, Docker Compose, Nginx, Server-Sent Events, Aliyun Bailian OpenAI-compatible API.

---

## File Structure

- Create package.json, server/, tests/, db/, docker-compose.yml, Dockerfile, nginx.conf, .env.example, .dockerignore, deploy/, and README.md.
- Keep current static HTML, CSS, and browser behavior working while adding same-origin API integration helpers.

### Task 1: Bootstrap backend workspace

**Files:** package.json, server/app.js, server/config.js, tests/config.test.js

- [ ] Write a failing configuration test for typed port, database URL, and session secret defaults.
- [ ] Run npm test -- --run tests/config.test.js and confirm it fails because modules and scripts are absent.
- [ ] Add package scripts test, dev, and start; add Fastify, cookie, formbody, pg, argon2, and Vitest dependencies.
- [ ] Implement loadConfig(env), parsing numeric limits and requiring SESSION_SECRET outside test mode.
- [ ] Run the focused test and confirm it passes.

### Task 2: Domain validation and constitution fallback

**Files:** server/domain/constitution.js, server/domain/orders.js, tests/constitution.test.js, tests/orders.test.js

- [ ] Write failing tests for valid nine-constitution results, rejected unknown values, server-side prices, order totals, and order status transitions.
- [ ] Run the focused tests and confirm expected missing-module failures.
- [ ] Implement constitutionTypes, validateConstitutionResult, buildFallbackResult, calculateOrderLines, and transitionOrderStatus.
- [ ] Keep output framed as lifestyle reference, not medical diagnosis, and constrain product categories to existing values.
- [ ] Run the focused tests and confirm they pass.

### Task 3: Repositories and PostgreSQL migrations

**Files:** server/repositories/memory-repository.js, server/repositories/postgres-repository.js, db/001_initial.sql, db/002_seed_products.sql, tests/repository.test.js

- [ ] Write failing tests for product listing, anonymous cart upsert, quantity changes, and transactional order creation using the memory repository.
- [ ] Run the repository tests and confirm missing-module failures.
- [ ] Implement repository methods for products, carts, chat sessions/messages, constitution results, orders, admin users/sessions, and model usage.
- [ ] Add schema tables and indexes from the approved design.
- [ ] Seed the existing 15 product slugs and categories without inventing products.
- [ ] Run repository tests and validate SQL through Docker Compose once configuration exists.

### Task 4: LLM provider and chat service

**Files:** server/llm/provider.js, server/llm/bailian-provider.js, server/services/chat-service.js, tests/chat-service.test.js

- [ ] Write failing tests for one repair attempt on invalid structured output and local fallback on provider timeout.
- [ ] Run the chat tests and confirm missing-module failures.
- [ ] Implement an OpenAI-compatible fetch adapter with AbortController timeout and environment-configured base URL, key, and model.
- [ ] Implement chat service persistence, schema validation, one repair attempt, usage metadata, and local fallback.
- [ ] Never log prompts, keys, or response content.
- [ ] Run chat tests and confirm they pass.

### Task 5: Fastify public and admin APIs

**Files:** server/routes/public.js, server/routes/admin.js, server/auth.js, server/http-errors.js, server/app.js, tests/api.test.js

- [ ] Write failing API tests for health, products, carts, server-priced orders, chat sessions, and unauthenticated admin rejection.
- [ ] Run API tests and confirm the expected failures.
- [ ] Implement cookies, request IDs, body limits, health check, product routes, cart routes, order transactions, and chat SSE.
- [ ] Implement Argon2id admin login, HttpOnly sessions, product CRUD, order management, and model health metadata.
- [ ] Add generic login failures, rate limits, CSRF and same-origin checks for management writes.
- [ ] Run API tests and confirm they pass.

### Task 6: Connect existing frontend flows

**Files:** script.js, products.html, product-detail.html, cart.html, checkout.html, my-constitution.html, admin/index.html, admin/admin.js, admin/admin.css, tests/frontend-helpers.test.js

- [ ] Add failing tests for product response normalization, cart totals, and structured constitution result rendering.
- [ ] Implement same-origin API helpers with an explicit API_ENABLED=false offline fallback.
- [ ] Wire products, details, cart drawer, cart page, checkout order submission, and streaming chat while preserving the approved visual layout.
- [ ] Add a dependency-free admin page for login, products, inventory, orders, status changes, and model health.
- [ ] Run frontend helper tests and verify all current pages still load shared CSS and script files.

### Task 7: Containerized deployment and operations

**Files:** Dockerfile, docker-compose.yml, nginx.conf, .env.example, .dockerignore, deploy/backup.sh, deploy/install-ubuntu-24.sh, deploy/README.md, README.md, tests/deployment.test.js

- [ ] Add failing deployment checks for documented environment variables, internal PostgreSQL, public Nginx port 80, persistent storage, and 14-day backup retention.
- [ ] Implement a multi-stage Node image, non-root API runtime, Nginx static serving and proxying, health checks, and no public API or PostgreSQL ports.
- [ ] Add Ubuntu setup, 2 GiB swap, UFW ports 22/80, migrations, seed, admin initialization, compressed pg_dump, cleanup, restore, and future HTTPS instructions.
- [ ] Run deployment tests and docker compose config.

### Task 8: Final verification

**Files:** all created and modified files

- [ ] Run npm test with zero failures.
- [ ] Run node --check script.js, docker compose config, and git diff --check.
- [ ] Verify keys are environment-only, PostgreSQL is internal-only, chat retention is 7 days, backups retain 14 days, seed count is 15, and orders never trust client prices.

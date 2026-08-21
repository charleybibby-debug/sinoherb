# Registered Users Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans (required for inline execution). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add password-based customer accounts with phone/email registration, login sessions, and an admin user list.

**Architecture:** Keep administrator authentication separate from customer accounts. Add customer tables and repository methods, reuse Argon2id and token hashing, attach the current customer to requests through a dedicated HttpOnly session cookie, and expose a small standalone account page.

**Tech Stack:** Fastify, PostgreSQL, Argon2, vanilla JavaScript/CSS, existing static frontend.

---

### Task 1: Define validation and repository behavior with tests

**Files:**
- Create: `tests/user-auth.test.js`
- Modify: `tests/repository.test.js`

- [x] Test contact normalization, minimum password length, public user serialization, and memory repository storage.
- [x] Run the targeted test; the current shell lacks the Node CLI, while the persistent runtime should show the missing module failure before implementation.

### Task 2: Add customer schema and user domain helpers

**Files:**
- Create: `db/005_customer_users.sql`
- Create: `server/user-auth.js`

- [x] Add `customer_users`, `customer_sessions`, and optional order association migration.
- [x] Implement email/phone normalization, registration validation, and password-free public serialization.

### Task 3: Add repository methods

**Files:**
- Modify: `server/repositories/memory-repository.js`
- Modify: `server/repositories/postgres-repository.js`

- [x] Add user creation, identifier lookup, last-login update, session persistence/lookup, and admin list methods.
- [x] Add idempotent PostgreSQL schema creation for existing Docker volumes.

### Task 4: Add customer auth routes and request context

**Files:**
- Modify: `server/auth.js`
- Modify: `server/routes/public.js`
- Modify: `server/app.js`

- [x] Register/login users with Argon2id and set the HttpOnly customer session cookie.
- [x] Add session and logout endpoints, and associate logged-in orders with the account.
- [x] Keep visitor cart and anonymous checkout behavior unchanged.

### Task 5: Add admin user list and account page

**Files:**
- Modify: `server/routes/admin.js`
- Modify: `admin/index.html`
- Modify: `admin/admin.js`
- Modify: `admin/admin.css`
- Create: `account.html`
- Create: `account.js`
- Create: `account.css`
- Modify: `script.js`

- [x] Add a users view to the desktop admin workspace with count, contact, status, registration time, and last login.
- [x] Add a nav account link and a login/register account page.

### Task 6: Verify account flows and deployment config

**Files:**
- Modify: `tests/admin-workspace.test.js`
- Modify: `README.md`
- Modify: `deploy/README.md`

- [x] Parse all changed modules, run direct repository/domain assertions, and run `git diff --check`.
- [x] Validate Compose configuration and document the rebuild required for the new migration and API routes.

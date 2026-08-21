# 体质页面 FAQ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在体质聊天区下方加入左侧分类、右侧单项展开手风琴的响应式 FAQ。

**Architecture:** HTML 使用三个锚点分类和九个原生 `details` 元素。CSS Grid 负责桌面双栏及移动端单列；JavaScript 监听 `toggle` 事件并关闭其他展开项。

**Tech Stack:** 静态 HTML、CSS Grid、原生 JavaScript。

---

### Task 1: 添加 FAQ 语义结构

**Files:**
- Modify: `/Users/goran/Documents/AI项目/SinoHerb/my-constitution.html`

- [ ] 在 `constitutionChat` 后添加 `constitutionFaq` 区块。
- [ ] 添加三个分类锚点与三组问答。
- [ ] 使用九个原生 `details`，仅第一项带 `open`。

### Task 2: 实现响应式视觉

**Files:**
- Modify: `/Users/goran/Documents/AI项目/SinoHerb/styles.css`

- [ ] 桌面端使用左窄右宽双栏，左侧导航粘性定位。
- [ ] 问题之间使用细线分隔，展开答案保持舒适行距。
- [ ] 移动端改为单列，分类导航支持横向滚动。

### Task 3: 限制单项展开

**Files:**
- Modify: `/Users/goran/Documents/AI项目/SinoHerb/script.js`

- [ ] 添加 `setupFaqAccordion()`。
- [ ] 展开一个 FAQ 时关闭其余项。
- [ ] 在公共初始化中调用该函数。

### Task 4: 验证结构与交互

**Files:**
- Test: `/Users/goran/Documents/AI项目/SinoHerb/my-constitution.html`
- Test: `/Users/goran/Documents/AI项目/SinoHerb/styles.css`
- Test: `/Users/goran/Documents/AI项目/SinoHerb/script.js`

- [ ] 验证三个分类、九个问题、一个默认展开项。
- [ ] 验证脚本语法与单项展开逻辑。
- [ ] 验证桌面双栏及移动端横向分类规则。
- [ ] 运行 `git diff --check`。

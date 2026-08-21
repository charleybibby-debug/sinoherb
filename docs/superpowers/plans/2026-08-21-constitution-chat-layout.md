# 体质对话双栏布局 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将体质检测容器实现为左侧聊天、右侧一次性输出检测结果的统一双栏布局。

**Architecture:** 保留现有 HTML 聊天和本地规则状态机，将 `chat-layout` 作为桌面双栏容器。结果渲染继续由 `renderResult` 负责，并通过结果容器状态类表达“待检测”和“已生成”。移动端沿用单列响应式规则。

**Tech Stack:** 静态 HTML、CSS Grid、原生 JavaScript。

---

### Task 1: 统一双栏容器

**Files:**
- Modify: `/Users/goran/Documents/AI项目/SinoHerb/my-constitution.html:46-76`
- Modify: `/Users/goran/Documents/AI项目/SinoHerb/styles.css:1853-1865`

- [ ] 保留一个 `chat-layout` 容器，确保左侧 `chat-card`、右侧 `result-card--chat` 是同级元素。
- [ ] 将网格设置为 `minmax(0, 1.08fr) minmax(360px, 0.92fr)`，间距 `18px`，并用 `align-items: stretch` 让两栏对齐。
- [ ] 保留移动端的单列布局和现有对话控件。

### Task 2: 明确结果状态

**Files:**
- Modify: `/Users/goran/Documents/AI项目/SinoHerb/script.js:650-705`
- Modify: `/Users/goran/Documents/AI项目/SinoHerb/styles.css:1780-1850`

- [ ] 初始结果容器带有等待状态类，显示“等待你开始对话”。
- [ ] `renderResult(profile)` 在三步完成后替换结果内容，并添加 `is-ready` 类。
- [ ] `resetChat()` 清除 `is-ready` 类并恢复等待内容。
- [ ] 不修改每步回答的分数计算，确保结果仅在 `showStep()` 发现没有下一步时生成。

### Task 3: 验证交互和响应式

**Files:**
- Test: `/Users/goran/Documents/AI项目/SinoHerb/my-constitution.html`
- Test: `/Users/goran/Documents/AI项目/SinoHerb/script.js`

- [ ] 检查 HTML 中左右两个面板为同级子元素。
- [ ] 检查脚本中结果只由完成态调用 `renderResult`。
- [ ] 运行 `git diff --check -- my-constitution.html styles.css script.js`。
- [ ] 检查桌面双栏规则和移动端单列规则同时存在。

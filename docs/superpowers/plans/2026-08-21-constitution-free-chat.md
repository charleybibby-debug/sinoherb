# 体质自由聊天输入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 用可输入、可发送的自由聊天框替代全部预设回答选项，并保持三轮体质检测结果生成。

**Architecture:** HTML 使用原生表单承载输入和发送；JavaScript 用本地关键词规则将自由文本映射为体质分数及产品偏好；现有结果渲染继续由 `renderResult` 负责。

**Tech Stack:** 静态 HTML、CSS、原生 JavaScript。

---

### Task 1: 替换回答控件

**Files:**
- Modify: `/Users/goran/Documents/AI项目/SinoHerb/my-constitution.html`
- Modify: `/Users/goran/Documents/AI项目/SinoHerb/styles.css`

- [ ] 删除 `chatReplies` 预设选项容器。
- [ ] 添加 `chatComposer` 表单、`chatInput` 多行输入框和发送按钮。
- [ ] 添加输入框聚焦、禁用和移动端样式。

### Task 2: 分析自由输入

**Files:**
- Modify: `/Users/goran/Documents/AI项目/SinoHerb/script.js`

- [ ] 添加九种体质关键词映射和产品偏好关键词映射。
- [ ] 添加文本标准化与当前轮回答分析函数。
- [ ] 无匹配时提示补充且不推进轮次。
- [ ] 第三轮完成后调用现有结果渲染。

### Task 3: 完成态与验证

**Files:**
- Modify: `/Users/goran/Documents/AI项目/SinoHerb/script.js`
- Test: `/Users/goran/Documents/AI项目/SinoHerb/my-constitution.html`

- [ ] 完成后禁用输入框，重新开始后恢复。
- [ ] 验证 `Enter` 发送与 `Shift + Enter` 换行逻辑。
- [ ] 验证预设选项及相关样式已完全移除。
- [ ] 运行脚本语法和差异检查。

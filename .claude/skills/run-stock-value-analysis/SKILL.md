---
name: run-stock-value-analysis
description: 按价值投资五步分析流程对个股做全流程价值分析并生成 Markdown 报告；校验报告结构、全库命名约定与断链。当用户说"分析一下XX股票""分析XX""看看XX""研究一下XX""帮我分析XX"时触发；说"检查报告/校验格式/断链检查"时触发。支持 A股、港股、美股。
---

# 个股价值分析（Claude Code 入口）

**本 skill 是调用入口，工作流的唯一权威定义在 `.trae/skills/stock-value-analysis/SKILL.md`——开始分析前先完整读取该文件并严格遵循。**

该文件包含：触发条件、五步分析流程（① 定性 → ② 定量 → ③ 估值 → ④ 排雷 → ⑤ 执行，go/no-go 决策点）、输出规范（12 章模板 + 港股代码加 H 命名）、数据获取工作流（MCP 主路径 + WebSearch 兜底）、TRR 参考公式、泡沫识别三确认、格林沃尔德 EPV 完整模块、校验与提交流程。

## 环境差异（相对 Trae）

- Claude Code 环境**通常没有** TDX/iFinD MCP server → 数据获取以 WebSearch/WebFetch 为主路径，按 `.trae/skills/stock-value-analysis/SKILL.md` 的"WebSearch 兜底"策略执行；年报 PDF 可用 `financial-report-extractor` skill
- 若当前环境恰好配置了行情财务类 MCP，优先 MCP（结构化数据优先原则不变）
- 其余流程、判定规则、报告结构与 Trae 版完全一致

## 快速执行

```bash
# 校验报告（0 错误才可提交）
node scripts/driver.mjs check 07_个股分析报告/{名称}-{代码}.md
node scripts/driver.mjs check --all   # 全部主报告
node scripts/driver.mjs lint          # 命名约定 + 断链
```

```bash
git add 07_个股分析报告/ && git commit -m "新增{名称}({代码})个股分析报告"
```

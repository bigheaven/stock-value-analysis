---
name: "stock-analysis"
description: "按五步分析流程+个股分析模板对单只股票进行全流程分析并生成Markdown报告。当用户说'分析一下XX股票'、'分析XX'、'看看XX'、'研究一下XX'时触发。支持A股、港股、美股。"
---

# 个股分析 Skill

按价值投资五步分析流程，对用户指定的股票进行全流程分析，严格按个股分析模板生成 Markdown 报告。

## 触发条件

当用户输入匹配以下模式时，立即激活本 Skill：
- "分析一下 {股票名称}"
- "分析 {股票名称}"
- "看看 {股票名称}"
- "研究一下 {股票名称}"
- "帮我分析 {股票名称}"

## 分析流程

严格遵循五步分析流程，顺序不可颠倒：

```
① 定性 → ② 定量 → ③ 估值 → ④ 排雷 → ⑤ 执行
```

每一步之间有明确的 go/no-go 决策点，详见 `/workspace/00_五步分析流程.md`。

## 输出规范

所有个股分析报告必须严格按 `/workspace/05_个股分析报告/个股分析模板.md` 统一格式输出。

报告保存路径：`/workspace/05_个股分析报告/{股票名称}-{代码}.md`

## 数据获取工作流

### Step 1: 股票代码查找

优先使用 TDX 查找股票代码：

**A股：**
```
run_mcp(
  server_name: "mcp_trae-remote-official_plugin_tdx_tdx",
  tool_name: "tdx_lookup_stock",
  args: {"query": "{股票名称}", "range": "AG"}
)
```

**港股：**
```
run_mcp(
  server_name: "mcp_trae-remote-official_plugin_tdx_tdx",
  tool_name: "tdx_lookup_stock",
  args: {"query": "{股票名称}", "range": "HK-GP"}
)
```

**美股：**
```
run_mcp(
  server_name: "mcp_trae-remote-official_plugin_tdx_tdx",
  tool_name: "tdx_lookup_stock",
  args: {"query": "{股票名称}", "range": "US"}
)
```

### Step 2: 并行获取数据（关键性能优化）

确定股票代码后，**必须并行发起以下查询**（一次调用中同时发出），最大化数据获取效率。根据股票市场类型选择对应工具：

#### 2.1 实时行情（TDX）

A股：
```
run_mcp(
  server_name: "mcp_trae-remote-official_plugin_tdx_tdx",
  tool_name: "tdx_quotes",
  args: {"code": "{代码}", "setcode": "0"}
)
```

港股：
```
run_mcp(
  server_name: "mcp_trae-remote-official_plugin_tdx_tdx",
  tool_name: "tdx_quotes",
  args: {"code": "{代码}", "setcode": "31"}
)
```

#### 2.2 财务数据（iFinD）

**A股财务数据：**
```
run_mcp(
  server_name: "mcp_trae-remote-official_plugin_ifind_hexin-ifind-ds-stock-mcp",
  tool_name: "get_stock_financials",
  args: {"query": "{股票名称} {代码} 2021年 2022年 2023年 2024年 2025年 ROE ROA 毛利率 净利率 资产负债率 营收 营收增速 净利润 净利润增速 经营现金流 每股收益 每股净资产 每股股利 分红 现金分红"}
)
```

**港股财务数据：**
```
run_mcp(
  server_name: "mcp_trae-remote-official_plugin_ifind_hexin-ifind-ds-globa",
  tool_name: "global_stock_financial",
  args: {"query": "{股票名称} {代码} 最新报告期 ROE ROA 毛利率 净利率 资产负债率 营收增速 净利润增速 经营现金流 自由现金流 每股收益 每股净资产 每股股利 分红数据"}
)
```

#### 2.3 公司信息（iFinD）

**A股：**
```
run_mcp(
  server_name: "mcp_trae-remote-official_plugin_ifind_hexin-ifind-ds-stock-mcp",
  tool_name: "get_stock_info",
  args: {"query": "{股票名称} {代码} 公司基本信息 所属行业 上市日期 主营业务 业务构成 收入结构 公司简介"}
)
```

**港股：**
```
run_mcp(
  server_name: "mcp_trae-remote-official_plugin_ifind_hexin-ifind-ds-globa",
  tool_name: "global_stock_profile",
  args: {"query": "{股票名称} {代码} 公司基本信息 所属行业 上市日期 主营业务 业务构成 收入结构"}
)
```

#### 2.4 股东结构 + 估值分位 + 财务摘要（TDX deep_info）

**A股：**
```
run_mcp(
  server_name: "mcp_trae-remote-official_plugin_tdx_tdx",
  tool_name: "tdx_security_deep_info",
  args: {"query": "查询 {代码} {股票名称} 主要股东 股本结构 实际控制人 控股股东持股比例", "entity_type": "A股代码"}
)
run_mcp(
  server_name: "mcp_trae-remote-official_plugin_tdx_tdx",
  tool_name: "tdx_security_deep_info",
  args: {"query": "查询 {代码} {股票名称} PE PB Band 历史估值分位 估值分析", "entity_type": "A股代码"}
)
run_mcp(
  server_name: "mcp_trae-remote-official_plugin_tdx_tdx",
  tool_name: "tdx_security_deep_info",
  args: {"query": "查询 {代码} {股票名称} 财务摘要 盈利能力 成长能力 分红记录 营收构成", "entity_type": "A股代码"}
)
```

**港股：**
```
run_mcp(
  server_name: "mcp_trae-remote-official_plugin_tdx_tdx",
  tool_name: "tdx_security_deep_info",
  args: {"query": "查询 {代码} {股票名称} 主要股东 股本结构 实际控制人 控股股东持股比例", "entity_type": "港股代码"}
)
run_mcp(
  server_name: "mcp_trae-remote-official_plugin_tdx_tdx",
  tool_name: "tdx_security_deep_info",
  args: {"query": "查询 {代码} {股票名称} PE PB Band 历史估值分位 估值分析", "entity_type": "港股代码"}
)
run_mcp(
  server_name: "mcp_trae-remote-official_plugin_tdx_tdx",
  tool_name: "tdx_security_deep_info",
  args: {"query": "查询 {代码} {股票名称} 财务摘要 盈利能力 成长能力 分红记录 营收构成", "entity_type": "港股代码"}
)
```

### Step 3: 数据不全时补充查询

如果 Step 2 返回的数据不足以填满模板全部字段，根据缺口精准补充：

- **估值分位不完整** → 补充 PE Band / PB Band 查询（分别查询 PE 和 PB）
- **财务历史数据缺失** → 补充 iFinD 年度数据查询
- **股东信息不完整** → 补充 iFinD `get_stock_shareholders` 查询
- **ESG/风险信息** → 补充 iFinD `get_esg_data` 或 `get_risk_indicators`

### Step 4: 生成报告

数据收集完毕后，严格按模板结构生成 Markdown 报告。每条数据必须有来源标注，所有分析结论必须基于实际获取的数据。

**报告结构（12 章）：**
1. 核心数据面板（行情 + 估值 + 财务 + 分红）
2. L0 避坑筛选（7 类陷阱）
3. ① 定性：生意本质（定位 + 收入结构 + 护城河 + 股权 + 管理层 + 股票分类）
4. ② 定量：财务验证（营收利润趋势 + 现金流 + 资产负债 + 分红历史 + 会计排雷）
5. ③ 估值：选锚 + 定价（估值锚 + 绝对值 + 分位 + DDM + 交叉验证 + 可比公司）
6. ④ 排雷：风险识别（风险矩阵 + 价值陷阱 + 反叙事）
7. ⑤ 执行：仓位 + 时机 + 纪律（仓位 + 建仓 + 买入信号 + 卖出纪律）
8. 情景分析（三情景 + 概率加权）
9. 行业专属模块（根据行业选填银行/消费/制造/科技等）
10. 综合评分卡（通用 + 收息 + 同类对比）
11. 五步决策汇总
12. 数据来源

### Step 5: Git 提交

报告生成后自动提交到 Git：
```
cd /workspace && git add 05_个股分析报告/{股票名称}-{代码}.md && git commit -m "新增{股票名称}({代码})个股分析报告"
```

## 数据源说明

| 数据源 | MCP Server | 主要用途 |
|--------|-----------|---------|
| 通达信 TDX | `mcp_trae-remote-official_plugin_tdx_tdx` | 实时行情、PE/PB Band、估值分位、股东结构、财务摘要 |
| 同花顺 iFinD (A股) | `mcp_trae-remote-official_plugin_ifind_hexin-ifind-ds-stock-mcp` | A股财务数据、公司信息、估值指标 |
| 同花顺 iFinD (港股/美股) | `mcp_trae-remote-official_plugin_ifind_hexin-ifind-ds-globa` | 港美股财务数据、公司信息 |
| 天眼查 | `mcp_trae-remote-official_plugin_tianyancha_tyc-mcp` | 企业工商信息、风险标签、实际控制人 |

## 注意事项

1. **必须使用 TodoWrite 跟踪进度**：将数据获取、报告生成分解为明确的 todo 项
2. **数据获取必须并行**：Step 2 的查询应在一次工具调用中全部发出，不要串行等待
3. **数据不足时如实标注**：模板中无法获取的字段标注"需确认"或"数据限制"，不可编造数据
4. **分析类型判定**：根据公司特征判定为"价值投资/攒股收息/成长股/周期股/困境反转"之一，影响后续估值锚和评分维度
5. **港股特殊处理**：注意港股通税率（20%红利税）、WVR 架构、港币计价等特殊因素
6. **模板路径**：报告模板位于 `/workspace/05_个股分析报告/个股分析模板.md`，流程文档位于 `/workspace/00_五步分析流程.md`
---
name: "stock-value-analysis"
description: "按价值投资五步分析流程+个股分析模板对单只股票进行全流程价值分析并生成Markdown报告。当用户说'分析一下XX股票'、'分析XX'、'看看XX'、'研究一下XX'时触发。支持A股、港股、美股。"
---

# 个股价值分析 Skill

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

每一步之间有明确的 go/no-go 决策点，详见 `/workspace/05_价值分析框架/00_五步分析流程.md`。

## 输出规范

所有个股分析报告必须严格按 `/workspace/05_价值分析框架/个股分析模板.md` 统一格式输出。

报告保存路径：`/workspace/06_个股分析报告/{股票名称}-{代码}.md`

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

**聂夫 TRR 参考公式（可选辅助，仅排序不作门槛）**：
> TRR = (盈利增长率 + 股息率) ÷ PE。TRR ≥ 2 标记为"聂夫合格"。此公式仅作为低市盈率候选池的快速排序参考，补充佐证，不以它为 go/no-go 硬门槛；完整分析仍以五步流程为准。

**格林沃尔德估值框架集成（可选模块）**：

对于盈利稳定、具有真实竞争优势（消费/OTC药/公用事业/品牌制造）的价值投资型标的，在模板"③ 估值"章节中额外集成格林沃尔德特许经营权估值框架。完整方法论见 `/workspace/01_经典理论框架/13_格林沃尔德-特许经营权估值法.md`。

**0️⃣ 前置判定：什么股票适合用 EPV 估值（必须先行，不满足则不套用）**

> EPV 不是"万能估值公式"，它有一个硬前提：**假定盈利永续不变、不给增长付费**。因此只对符合下面画像的标的才适用，乱套会严重低估成长股/高波动股。

| 维度 | 适合 EPV（用） | 不适合（不要套） | 判定数据 |
|------|---------------|-----------------|---------|
| 盈利稳定性 | 盈利中枢清晰、周期均值可靠 | 大起大落、亏损、无正常化盈利可言 | 5-10年净利/营业利润率标准差 |
| 增长依赖度 | 弱增长、成熟期、低增速 | 高成长需靠增长修复（赛道股） | 营收CAGR、再投资需求 |
| 资本密集度 | 轻资产、再投资需求极低 | 重资产强周期（煤炭钢铁峰值） | 维持性CAPEX/折旧 |
| 商业模式 | 消费/OTC药/公用事业/品牌制造/垄断媒体 | 银行保险等金融、高波动科技 | 行业属性 |
| 分红属性 | 攒股收息、稳定现金流 | 盈利不可持续 | 派息率、现金流覆盖 |

**判定三步法**：
1. **看 ROIC vs WACC**：ROIC 长期 > WACC 是"特许经营型企业"的前提（否则是资产型，应按 AV 估值）。
2. **看增长/资本需求**：ROIC>WACC 但需持续大额再投资消化高增长（成长型）→ 必须叠加成长价值，不能只用 EPV 截断。
3. **分类定锚**：特例——**银行/保险等金融**看似适合但 NOPAT 受资本充足率约束不可全分红，EPV 会高估可分配回报，应改用 DDM 或净资产锚；**强周期股**正常化盈利可行但需做周期中枢校准，且 WACC 应上调。

集成时按以下流程输出：

```
0️⃣ 适用性判定（先确认适合 EPV，不满足则退回常规估值）
① 定性分类（资产型/特许经营型/成长型）
② 正常化盈利校准 → 稳态 NOPAT
③ EPV/AV 估值 + 特许溢价倍数 EPV/AV
④ 三段式回报率 R_net = R_cash + R_organic + R_active − Fade
⑤ 对比 WACC，给出投资决策四档评级
```

**适用性判定输出模板（写入报告"③ 估值"章节开头）**：

```
### EPV 适用性判定
| 维度 | 结论 | 证据 |
|------|------|------|
| 企业类型 | 特许经营型/资产型/成长型 | ROIC,市场地位 |
| 盈利稳定性 | 高/中/低 | 5-10年净利标准差、营业利润率 |
| 增长依赖度 | 低/中/高 | 营收CAGR、再投资需求 |
| 资本密集度 | 轻/中/重 | 维护性CAPEX |
| WACC 区间 | X%-Y% | Beta、资产负债率、行业 |
| **判定** | ✅ 适用EPV / ⚠️ 需调整(DDM等) / ❌ 不套用 | 综合 */
```

**强制要求（防止框架误用）：**
1. **WACC 必须充分论证**：结合个股 Beta、资产负债率、行业属性给出合理区间（如消费股通常 6.5%-7.5%），不得随意取 8%。WACC 每变动 1% 结论可能翻转，需做敏感性提示。
2. **正常化盈利必须说明口径**：ROIC 算法（是否剔除商誉/具体EV口径）、CHC等主业增速的基期（是否剔除并表扰动）必须透明披露，参照报告存疑点：ROIC 不同算法可差 4-5pct，并表增速与有机增速可天壤之别。
3. **Fade 衰减系数避免双重悲观**：若已用有机增速（低于账面增速）测算内生回报，Fade 衰减应适度，避免把"增速放缓"重复扣减两次。
4. **EPV/AV 交叉验证**：必须计算特许溢价倍数 EPV/AV，确认企业特许价值是否真实存在；同时用 V/M（市值价值比）判断当前价格是否已充分定价特许价值。
5. **与常规估值交叉对照**：格林沃尔德 EPV 结论必须与模板中 PE/PB/股息率静态估值结论并列展示，说明两者分歧原因（回报视角 vs 静态估值视角），不单一依赖某一方法下结论。

**报告结构（12 章）：**
1. 核心数据面板（行情 + 估值 + 财务 + 分红）
2. L0 避坑筛选（7 类陷阱）
3. ① 定性：生意本质（定位 + 收入结构 + 护城河 + 股权 + 管理层 + 股票分类）
4. ② 定量：财务验证（营收利润趋势 + 现金流 + 资产负债 + 分红历史 + 会计排雷）
5. ③ 估值：选锚 + 定价（估值锚 + 绝对值 + 分位 + DDM + 交叉验证 + 可比公司）
6. ④ 排雷：风险识别（风险矩阵 + 价值陷阱 + 反叙事）
   - 估值分位、盈利质量、增长可持续性触发高风险时，**集成泡沫识别模块**，判断个股处于绿色/黄色/橙色/红色泡沫等级。完整方法论见 `/workspace/01_经典理论框架/14_泡沫识别与预警.md`。
   - 泡沫识别三确认（同时满足才定性"红色泡沫"）：① 静态估值分位>95 + ② 价值锚 V/M 显著>1.5 + ③ 盈利质量差（FCF/净利<1、ROE/ROIC剪刀差）或行为过热（换手/杠杆/减持）。
   - 仅满足①的属"贵的成长股"而非泡沫，不可回避错杀优质标的。
7. ⑤ 执行：仓位 + 时机 + 纪律（仓位 + 建仓 + 买入信号 + 卖出纪律）
8. 情景分析（三情景 + 概率加权）
9. 行业专属模块（根据行业选填银行/消费/制造/科技等）
10. 综合评分卡（通用 + 收息 + 同类对比）
11. 五步决策汇总
12. 数据来源

### Step 5: Git 提交

报告生成后自动提交到 Git：
```
cd /workspace && git add 06_个股分析报告/{股票名称}-{代码}.md && git commit -m "新增{股票名称}({代码})个股分析报告"
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
6. **模板路径**：报告模板位于 `/workspace/05_价值分析框架/个股分析模板.md`，流程文档位于 `/workspace/05_价值分析框架/00_五步分析流程.md`
# 股票分析标准流程

> **用途**：新增标的的标准分析 SOP。调用此 playbook 后，按固定流程执行三轮信息搜集 + 一轮撰写 + 一轮收尾。

---

## 触发方式

在 vault 中说"分析 XX 股票"、"/analyze XX"、或创建 OpenSpec change 时，按此流程执行。

---

## 阶段零：目录创建

```
stocks/<industry>-<中文行业名>/<ticker>-<name>-<中文名>/
```

- 如果行业目录已存在，复用；否则新建
- 行业分类参考 INDEX.md 现有结构

---

## 阶段一：并行信息搜集（3 个 Agent 同时跑）

### 1.1 IMA 知识库搜索

```bash
# 搜索研报标题（最全研报知识库优先）
node <skill路径>/ima_api.cjs "openapi/wiki/v1/search_knowledge" \
  '{"query":"<股票名或关键词>","knowledge_base_id":"<KB_ID>","cursor":""}'

# KB_ID 速查（2026-07-29 验证）：
# 最全研报: 6eLX-ExYw6cUO91F8RM3qoSQ5f9N1zE_qGbR0SUioy0=
# 浑水调研: MUb6MX2SCTN5Xi2EjCPBsHHuWODJ-fHkL7lSAXe_BdE=
# 千研股票池: -NJg9-1yFdUZRG02Xd9w7Om9jP2DGz2sprT4ZHEBXDo=
```

**重要**：搜索结果在 `data.info_list`，不是 `data.list`。
**关键词**：用简单词（华大、中芯、基因），不要短语。
如果返回 `code != 0`，先验证 KB ID 是否有效：`search_knowledge_base` + `limit` 参数。

### 1.2 Tavily 网络搜索

优先搜以下内容：

| 优先级 | 搜索内容 | 工具 |
|--------|---------|------|
| ★★★ | Goldman Sachs / Morgan Stanley 行业分析或评级 | `tavily_search`（advanced，10 条）|
| ★★★ | 公司最新财报/业绩/催化剂 | 同上 |
| ★★ | 竞争对手对比分析 | 同上 |
| ★★ | 行业趋势/政策/周期位置 | `tavily_research`（大主题）|
| ★ | 投资者讨论/社交情绪 | `tavily_search`（fast）|

**搜索词模板**：
- A 股：`<股票名> <代码> 估值 PE PB 目标价 2026 券商`
- 港股：`<股票名> <代码> 港股通 南向资金 目标价 2026`
- 美股：`<股票名> <ticker> Goldman Sachs Morgan Stanley 2026`
- 行业：`<行业关键词> industry analysis Goldman Sachs Morgan Stanley 2026`

### 1.3 Wind Alice 结构化数据

```bash
cd ~/.claude/skills/alice-financial-copilot && \
  node scripts/cli.mjs --prompt "<用户原话>" --no-wait --session-scope claude-code
```

**标准 Prompt 模板**：
> "帮我获取<股票名>（<代码>）的关键数据：最新股价、市值、PE/PB及其历史分位、近3年营收和净利润趋势、毛利率、研发费用率、ROE。另外搜一下最新券商研报的观点和目标价。用中文，尽量简洁。"

**注意**：Wind Alice 每个查询需 2-15 分钟。三个标的需串行或分别开终端。完成后核对 DONE 行 `promptHash`，交付 `agentResult.value` 原文。

---

## 阶段二：撰写 00-overview（整合三源数据）

### 报告标准模板

```markdown
> **免责声明**：本报告基于公开信息综合分析，不构成任何投资建议。
> **数据截止日期**：YYYY 年 M 月 D 日
> **信息来源**：<列出具体来源>

# <股票名> (<代码>) — <一句话定性>

> **定位**：（与同赛道其他标的的关系）

---

## 一、商业模式
## 二、护城河
## 三、成长驱动
## 四、财务健康度（含表格）
## 五、估值水位
## 六、催化剂与风险
## 七、情景分析（乐观/基准/悲观，含概率）
## 八、Wind Alice 数据交叉验证（文末）
## 引用源
## 相关报告双链
```

### 核心要求

- **所有断言必须有数据支撑**——引用 Tavily 搜索结果或 Alice 返回的财务数字
- **必须包含对标分析**——如果你分析的标的有一个明确的全球龙头对标（如中科飞测→KLA、华大智造→Illumina），必须做对比表
- **必须包含情景分析**——牛/基/熊三情景，带概率估计，概率加权估价
- **必须交叉引用 vault 框架**——至少关联 [[graham-value-investing-格雷厄姆价值投资]]、[[cycle-growth-spectrum-framework-周期光谱框架]]、[[bubble-anatomy-framework-泡沫解剖框架]] 中的 1-2 个
- **必须包含 Alice 交叉验证**——文末附录，对比 Tavily 数据和 Alice 数据的一致性

---

## 阶段三：收尾

1. 更新 `INDEX.md`：在对应行业板块下新增标的条目
2. 更新 `CLAUDE.md`：如果新建了行业目录，更新目录架构说明
3. 如果创建了 OpenSpec change，运行 `/opsx:archive` 归档

---

## 分析框架速查

每次分析新股务必过一遍：

| # | 框架 | 核心问题 | Playbook |
|---|------|---------|----------|
| 1 | 周期光谱 | 这是什么类型的公司？周期股还是成长股？ | [[cycle-growth-spectrum-framework-周期光谱框架]] |
| 2 | 假概念识别 | 这家公司到底赚什么钱？是真有价值还是蹭概念？ | [[fake-concept-detector-假概念识别]] |
| 3 | 泡沫解剖 | 市场处于哪个阶段？狂热/回归/恐慌？ | [[bubble-anatomy-framework-泡沫解剖框架]] |
| 4 | 格雷厄姆 | 这个价格安不安全？有没有安全边际？ | [[graham-value-investing-格雷厄姆价值投资]] |
| 5 | 巴菲特 | 这生意 10 年后还在不在？护城河是真实的吗？ | [[buffett-shareholder-letters-巴菲特致股东信原始框架]] |
| 6 | 索罗斯 | 市场叙事是什么？反身性在哪个方向？ | [[soros-reflexivity-索罗斯反身性]] |
| 7 | 快刀斩股 | 设硬门槛逐轮淘汰，哪些指标不达标？ | [[kuaidao-methodology-快刀斩股法]] |
| 8 | 但斌 | 能穿越 30 年吗？是皇冠上的明珠吗？ | [[danbin-time-rose-但斌时间的玫瑰]] |

---

## 实操检查清单

- [ ] IMA 搜了 2+ 个知识库
- [ ] Tavily 搜了高盛/Morgan Stanley
- [ ] Wind Alice 返回了结构化数据
- [ ] 报告有对标分析（如果有行业龙头参照）
- [ ] 报告有情景分析（含概率估计）
- [ ] 报告引用了至少 2 个 vault 框架
- [ ] Alice 数据交叉验证在文末
- [ ] 财务数据有具体数字，不是泛泛而谈
- [ ] 更新了 INDEX.md

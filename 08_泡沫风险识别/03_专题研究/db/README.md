# A股泡沫风险数据库 使用说明

对应文档：`../A股泡沫风险扫描_完整结果整合版_2026-08-26.md`（完整数据已从文档迁出，见下）

## 一、库文件与本目录结构

```
03_专题研究/
├── A股泡沫风险扫描_完整结果整合版_2026-08-26.md   ← 已精简，仅保留正文 + 数据索引
│   └── (A股泡沫风险扫描...md.bak)                  ← 原始含内嵌表格的备份
├── data/                                           ← 完整数据源（独立 CSV，由附录抽取）
│   ├── refined_review_candidates.csv            (121)
│   ├── high_priority_candidates.csv             (431)
│   ├── coarse_screen_all.csv                    (5,554)
│   └── industry_candidate_summary.csv           (113)
└── db/
    ├── bubble_risk.sqlite     ← 已生成的 SQLite 数据库（当前批次 2026-08-26）
    ├── schema.sql             ← 建表脚本（DDL，含索引）
    ├── import_to_sqlite.py    ← 可复用导入脚本（CSV → SQLite）
    └── README.md              ← 本说明文档
```

打开数据库（命令行）：

```bash
sqlite3 ../../03_专题研究/db/bubble_risk.sqlite
# 或 Python：
#   import sqlite3; c = sqlite3.connect('../../03_专题研究/db/bubble_risk.sqlite')
```

## 二、表结构与批次模型

四张业务表保存四类扫描结果，**通过 `batch_id` 关联 `scan_batch` 批次表**。每次扫描形成一个新的批次，因此同一只股票在不同批次快照下可并列查询，天然支持跨时间对比。

| 表 | 对应附录 | 行数 | 主键 | 主要用途 |
|---|---|---|---|---|
| `scan_batch` | 批次元数据 | 1 | `batch_id` | 记录每次扫描时点、作者、来源文件 |
| `refined_review_candidates` | 附录A | 121 | (code, batch_id) | 二层深度复核队列（A/B/N 分层） |
| `high_priority_candidates` | 附录B | 431 | (code, batch_id) | 第一层非ST高优先级候选 |
| `coarse_screen_all` | 附录C | 5,554 | (code, batch_id) | 全市场粗筛明细（数据量最大） |
| `industry_candidate_summary` | 附录D | 113 | (industry, batch_id) | 行业候选汇总 |

类型约定：价格为 REAL（元），百分比/YoY 为 REAL（%），日期为 TEXT（如 `2026-06-30`、`20160913`），布尔量（`is_st`、`trigger_*` 等）为 INTEGER 0/1，历史分位为 0~1 的 REAL。空值存 NULL。

## 三、常用查询示例

### 1. 看当前最新批次

```sql
SELECT * FROM scan_batch ORDER BY batch_id DESC LIMIT 1;
```

### 2. 提取当期 A 级结构共振名单（13只，最高优先级）

```sql
SELECT code, name, industry, trigger_count, pe_dynamic, pb,
       return_60d_pct, revenue_yoy_pct, net_profit_yoy_pct, ocf_to_eps
FROM refined_review_candidates
WHERE batch_id = (SELECT MAX(batch_id) FROM scan_batch)
  AND review_tier LIKE 'A:%'
ORDER BY trigger_count DESC;
```

### 3. 高优先级候选，按复核分值排序（前20）

```sql
SELECT code, name, industry, review_priority, trigger_count
FROM high_priority_candidates
WHERE batch_id = (SELECT MAX(batch_id) FROM scan_batch)
ORDER BY review_priority DESC
LIMIT 20;
```

### 4. 全市场筛出「估值+交易拥挤+高换手」三重触发（附录C）

```sql
SELECT code, name, industry, trigger_count, pe_dynamic, pb, return_60d_pct
FROM coarse_screen_all
WHERE batch_id = (SELECT MAX(batch_id) FROM scan_batch)
  AND trigger_valuation = 1 AND trigger_momentum = 1 AND trigger_turnover = 1
ORDER BY trigger_count DESC;
```

### 5. 某行业的高优先级候选占比（附录D）

```sql
SELECT industry, candidate_count, universe_count, candidate_rate_pct
FROM industry_candidate_summary
WHERE batch_id = (SELECT MAX(batch_id) FROM scan_batch)
  AND universe_count >= 20
ORDER BY candidate_rate_pct DESC;
```

### 6. 关键词/代码反查个股（附录C全字段）

```sql
-- 按代码查
SELECT * FROM coarse_screen_all
WHERE batch_id = (SELECT MAX(batch_id) FROM scan_batch) AND code = '300534';

-- 按名称模糊查
SELECT code, name, industry, trigger_reasons, candidate_status
FROM coarse_screen_all
WHERE batch_id = (SELECT MAX(batch_id) FROM scan_batch)
  AND name LIKE '%激光%';
```

### 7. 二/三层核验视角：经营恶化但估值仍居高位

```sql
SELECT code, name, industry, pe_percentile, pb_percentile,
       revenue_yoy_pct, net_profit_yoy_pct
FROM coarse_screen_all
WHERE batch_id = (SELECT MAX(batch_id) FROM scan_batch)
  AND trigger_valuation = 1 AND trigger_operating_deterioration = 1
  AND pe_percentile >= 0.9
ORDER BY pb_percentile DESC;
```

## 四、重新导入 / 追加新批次

完整数据源是 `../data/` 下的独立 CSV（已从 Markdown 抽出）。导入脚本 `import_to_sqlite.py` 直接读取这些 CSV，可**重复执行**，每次都新创建一个批次：

```bash
python3 ../../03_专题研究/db/import_to_sqlite.py \
  --csv-dir ../../03_专题研究/data \
  --db ../../03_专题研究/db/bubble_risk.sqlite \
  --schema ../../03_专题研究/db/schema.sql \
  --batch 2026-08-26 --author "Manus AI"
```

参数说明：

| 参数 | 必填 | 说明 |
|---|---|---|
| `--csv-dir` | 是 | CSV 数据目录（含 4 个 CSV，见首节结构） |
| `--db` | 是 | SQLite 库文件路径（不存在则新建） |
| `--schema` | 是 | DDL 脚本路径（`CREATE TABLE IF NOT EXISTS`，幂等） |
| `--batch` | 是 | 批次日期（新增批次每个应不同，如 `2026-09-02`） |
| `--label` | 否 | 批次可读标签，默认 `{batch}盘中快照` |
| `--author` | 否 | 作者名，默认 `Manus AI` |

新增批次后，此前所有 `batch_id = (SELECT MAX(batch_id) FROM scan_batch)` 的查询会自动改取新快照，历史批次保留可回溯。

## 五、维护与注意事项

1. **新增数据表**：若未来新增扫描表，需在 `schema.sql` 加 `CREATE TABLE`，并在 `import_to_sqlite.py` 的 `CSV_MAP` 里登记 CSV 文件名与目标表名，同时把 CSV 放入 `data/`。
2. **日期口径差异**：`listing_date`（如 `20160913` 纯数字）与 `financial_report_date`/`notice_date`（如 `2026-06-30 00:00:00`）格式不同，均为 TEXT，比较时注意格式。
3. **布尔触发列**（附录C 的 `trigger_*`、`is_st`）已归一为 0/1；历史分位列（`*_percentile`）为 0~1，需乘 100 得百分数。
4. **备份**：数据库为单文件，直接复制即备份；建议每次导入新批次错误前先备份旧库。
5. **性能**：附录C 达 5,554 行，已建 `candidate_status`、`industry`、`is_st`、`trigger_count`、`market_cap_cny`、`name` 索引；按这些列过滤时应走索引。
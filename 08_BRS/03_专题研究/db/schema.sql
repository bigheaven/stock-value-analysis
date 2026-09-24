-- ============================================================================
-- A股泡沫风险识别数据库 DDL
-- 来源：03_专题研究/A股泡沫风险扫描_完整结果整合版_2026-08-26.md 附录A/B/C/D
-- 设计要点：
--   1) 四张业务表按 (code, batch_id) 唯一，跨批次支持追加（多次扫描快照并存）
--   2) scan_batch 记录每次扫描的批次元数据，业务表通过 batch_id 关联
--   3) 日期/时间全部存为 TEXT，避免时区与格式歧义；布尔量存 INTEGER(0/1)
--   4) 为空保留 NULL，不强行填充默认值，便于后续按 NULL 判断数据缺口
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- 批次元数据：每次扫描快照一条记录
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scan_batch (
    batch_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date   TEXT NOT NULL,            -- 扫描时点日期，如 2026-08-26
    snapshot_label  TEXT,                     -- 可读标签，如 "2026-08-26盘中快照"
    market_universe INTEGER,                  -- 全市场截面股票数，如 5554
    author          TEXT,                     -- 报告作者，如 Manus AI
    source_file     TEXT,                     -- 来源文档文件名
    notes           TEXT,                     -- 补充说明
    created_at      TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_scan_batch_date ON scan_batch(snapshot_date);


-- ----------------------------------------------------------------------------
-- 附录A：121只二层深度复核队列（refined_review_candidates）
-- 二层分层后的A类结构共振、B类错配待核验与N类次新专用规则对象。
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refined_review_candidates (
    code                   TEXT NOT NULL,     -- 股票代码，主键成分
    name                   TEXT,              -- 证券简称
    industry               TEXT,              -- 所属行业（申万）
    review_tier            TEXT,              -- 复核层级：A:结构共振 / B:错配待核验 / N:次新
    refined_reasons        TEXT,              -- 细化的进入原因（可含分号分隔多项）
    trigger_count          INTEGER,           -- 触发项数量
    trigger_reasons        TEXT,              -- 触发项明细（分号分隔）
    last_price             REAL,              -- 最新价（元）
    market_cap_cny         REAL,              -- 总市值（元）
    float_market_cap_cny   REAL,              -- 流通市值（元）
    pe_dynamic             REAL,              -- 动态PE
    pe_ttm                 REAL,              -- TTM市盈率
    pb                     REAL,              -- 市净率
    return_60d_pct         REAL,              -- 60日涨跌幅（%）
    return_ytd_pct         REAL,              -- 年初至今涨跌幅（%）
    turnover_pct           REAL,              -- 换手率（%）
    revenue_yoy_pct        REAL,              -- 营业收入同比（%）
    net_profit_yoy_pct     REAL,              -- 归母净利润同比（%）
    roe_pct                REAL,              -- ROE（%）
    ocf_to_eps             REAL,              -- 每股经营现金流/每股收益
    financial_report_date  TEXT,              -- 财报期（如 2026-06-30）
    notice_date            TEXT,              -- 公告日期（如 2026-08-26）
    listing_date           TEXT,              -- 上市日期（YYYYMMDD）
    pe_percentile          REAL,              -- 行业PE分位（0~1）
    pb_percentile          REAL,              -- 行业PB分位（0~1）
    return60_percentile    REAL,              -- 行业60日涨幅分位（0~1）
    turnover_percentile    REAL,              -- 行业换手率分位（0~1）
    batch_id               INTEGER NOT NULL,
    PRIMARY KEY (code, batch_id),
    FOREIGN KEY (batch_id) REFERENCES scan_batch(batch_id)
);

CREATE INDEX IF NOT EXISTS idx_refined_review_tier ON refined_review_candidates(review_tier);
CREATE INDEX IF NOT EXISTS idx_refined_review_industry ON refined_review_candidates(industry);
CREATE INDEX IF NOT EXISTS idx_refined_review_trigger_count ON refined_review_candidates(trigger_count);


-- ----------------------------------------------------------------------------
-- 附录B：431只非ST高优先级候选（high_priority_candidates）
-- 第一层粗筛的非ST高优先级候选，按复核优先级排序。
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS high_priority_candidates (
    code                   TEXT NOT NULL,
    name                   TEXT,
    industry               TEXT,
    candidate_status       TEXT,              -- 候选状态，如 HIGH_PRIORITY_CANDIDATE
    trigger_count          INTEGER,
    trigger_reasons        TEXT,
    review_priority        REAL,              -- 复核优先级分值（越高越优先）
    last_price             REAL,
    market_cap_cny         REAL,
    float_market_cap_cny   REAL,
    pe_dynamic             REAL,
    pe_ttm                 REAL,
    pb                     REAL,
    return_60d_pct         REAL,
    return_ytd_pct         REAL,
    turnover_pct           REAL,
    revenue_yoy_pct        REAL,
    net_profit_yoy_pct     REAL,
    eps                    REAL,              -- 每股收益（元）
    roe_pct                REAL,
    ocf_to_eps             REAL,
    gross_margin_pct       REAL,              -- 毛利率（%）
    notice_date            TEXT,
    pe_percentile          REAL,
    pb_percentile          REAL,
    return60_percentile    REAL,
    turnover_percentile    REAL,
    batch_id               INTEGER NOT NULL,
    PRIMARY KEY (code, batch_id),
    FOREIGN KEY (batch_id) REFERENCES scan_batch(batch_id)
);

CREATE INDEX IF NOT EXISTS idx_hp_status ON high_priority_candidates(candidate_status);
CREATE INDEX IF NOT EXISTS idx_hp_priority ON high_priority_candidates(review_priority DESC);
CREATE INDEX IF NOT EXISTS idx_hp_industry ON high_priority_candidates(industry);


-- ----------------------------------------------------------------------------
-- 附录C：5,554只全市场粗筛明细（coarse_screen_all）
-- 全部市场截面与每只股票的粗筛字段、触发项和候选状态。数据量最大。
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coarse_screen_all (
    code                                   TEXT NOT NULL,
    name                                   TEXT,
    financial_name                         TEXT,   -- 财报主体名称
    trade_market                           TEXT,   -- 交易市场编码（如 69001001006.0）
    market_id                              INTEGER,-- 市场标识（0/1）
    industry                               TEXT,
    last_price                             REAL,
    pct_change_1d                          REAL,   -- 当日涨跌幅（%）
    volume_lots                            INTEGER,-- 成交量（手）
    amount_cny                             REAL,   -- 成交额（元）
    amplitude                              REAL,   -- 振幅（%）
    turnover_pct                           REAL,
    volume_ratio                           REAL,   -- 量比
    pe_dynamic                             REAL,
    pe_ttm                                 REAL,
    pb                                     REAL,
    market_cap_cny                         REAL,
    float_market_cap_cny                   REAL,
    return_60d_pct                         REAL,
    return_ytd_pct                         REAL,
    revenue                                REAL,   -- 营业收入（元）
    net_profit                             REAL,   -- 归母净利润（元）
    revenue_yoy_pct                        REAL,
    net_profit_yoy_pct                     REAL,
    eps                                    REAL,
    roe_pct                                REAL,
    operating_cashflow_per_share_alt       REAL,   -- 每股经营现金流（替代口径）
    gross_margin_pct                       REAL,
    ocf_to_eps                             REAL,
    listing_date                           TEXT,   -- 上市日期（YYYYMMDD）
    notice_date                            TEXT,
    update_date                            TEXT,
    financial_report_date                  TEXT,
    is_st                                  INTEGER,-- 是否ST
    is_positive_eps                        INTEGER,-- 是否正EPS
    pe_percentile                          REAL,
    pb_percentile                          REAL,
    return60_percentile                    REAL,
    turnover_percentile                    REAL,
    marketcap_percentile                   REAL,   -- 全市场市值分位
    trigger_valuation                      INTEGER,-- 估值压力
    trigger_momentum                       INTEGER,-- 交易拥挤（60日强势）
    trigger_turnover                       INTEGER,-- 高换手
    trigger_cash_quality                   INTEGER,-- 现金流质量
    trigger_operating_deterioration        INTEGER,-- 经营恶化
    trigger_small_float                    INTEGER,-- 小流通市值
    trigger_st                             INTEGER,-- ST警示
    trigger_count                          INTEGER,
    candidate_status                       TEXT,   -- NOT_TRIGGERED / WATCHLIST / HIGH_PRIORITY
    trigger_reasons                        TEXT,
    batch_id                               INTEGER NOT NULL,
    PRIMARY KEY (code, batch_id),
    FOREIGN KEY (batch_id) REFERENCES scan_batch(batch_id)
);

CREATE INDEX IF NOT EXISTS idx_coarse_status ON coarse_screen_all(candidate_status);
CREATE INDEX IF NOT EXISTS idx_coarse_industry ON coarse_screen_all(industry);
CREATE INDEX IF NOT EXISTS idx_coarse_is_st ON coarse_screen_all(is_st);
CREATE INDEX IF NOT EXISTS idx_coarse_trigger_count ON coarse_screen_all(trigger_count);
CREATE INDEX IF NOT EXISTS idx_coarse_marketcap ON coarse_screen_all(market_cap_cny);
CREATE INDEX IF NOT EXISTS idx_coarse_name ON coarse_screen_all(name);


-- ----------------------------------------------------------------------------
-- 附录D：行业候选汇总（industry_candidate_summary）
-- 按行业汇总的高优先级候选数、行业样本数和候选占比。
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS industry_candidate_summary (
    industry                 TEXT NOT NULL,   -- 行业
    candidate_count          INTEGER,         -- 高优先级候选数
    median_trigger_count     REAL,            -- 候选触发项数中位数
    avg_return60_pct         REAL,            -- 候选平均60日涨幅（%）
    avg_pe_percentile        REAL,            -- 候选平均行业PE分位
    avg_turnover_percentile  REAL,            -- 候选平均行业换手分位
    universe_count           INTEGER,         -- 行业样本总数
    candidate_rate_pct       REAL,            -- 候选占行业样本比例（%）
    batch_id                 INTEGER NOT NULL,
    PRIMARY KEY (industry, batch_id),
    FOREIGN KEY (batch_id) REFERENCES scan_batch(batch_id)
);

CREATE INDEX IF NOT EXISTS idx_industry_rate ON industry_candidate_summary(candidate_rate_pct DESC);
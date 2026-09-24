#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
A股泡沫风险 CSV → SQLite 导入脚本（可复用）

数据源：03_专题研究/data/ 目录下的独立 CSV 文件
（已从 Markdown 附录迁出，见 extract_and_trim.py 与 schema 表定义）

功能：
  1) 读取每张表的 CSV（表头 + 数据行）
  2) 写入 scan_batch 批次记录 + 对应业务表（跨批次可追加）

用法：
  python3 import_to_sqlite.py --csv-dir <CSV目录> --db <库路径> \
      --schema <schema.sql> --batch 2026-08-26
  # 示例：
  python3 /workspace/03_专题研究/db/import_to_sqlite.py \
      --csv-dir /workspace/03_专题研究/data \
      --db /workspace/03_专题研究/db/bubble_risk.sqlite \
      --schema /workspace/03_专题研究/db/schema.sql \
      --batch 2026-08-26 --author "Manus AI"
"""
import argparse
import csv
import os
import sqlite3
import sys

# CSV 文件名 → 目标表名
CSV_MAP = {
    "refined_review_candidates.csv": "refined_review_candidates",
    "high_priority_candidates.csv": "high_priority_candidates",
    "coarse_screen_all.csv": "coarse_screen_all",
    "industry_candidate_summary.csv": "industry_candidate_summary",
}

# 附录C（coarse_screen_all）中布尔列，归一化为 INTEGER 0/1
BOOL_COLS_C = {
    "is_st", "is_positive_eps",
    "trigger_valuation", "trigger_momentum", "trigger_turnover",
    "trigger_cash_quality", "trigger_operating_deterioration",
    "trigger_small_float", "trigger_st",
}


def parse_cell(v: str):
    """把 CSV 单元格文本转成合适类型；空串返回 None。"""
    if v is None:
        return None
    s = str(v).strip()
    if s == "":
        return None
    try:
        return int(s)
    except ValueError:
        pass
    try:
        return float(s)
    except ValueError:
        pass
    return s


def build_values(table, header, row):
    """解析单元格为原生类型，并对布尔列归一化 0/1。"""
    values = [parse_cell(c) for c in row]
    if table == "coarse_screen_all":
        for j, col in enumerate(header):
            if col in BOOL_COLS_C and j < len(values):
                v = values[j]
                values[j] = 1 if v in (1, 1.0, True, "1", "True", "TRUE", "true", "T", "t", "yes", "Yes") else 0
    return values


def main():
    ap = argparse.ArgumentParser(description="CSV → SQLite 导入")
    ap.add_argument("--csv-dir", required=True, help="CSV 数据目录")
    ap.add_argument("--db", required=True, help="SQLite 库文件路径")
    ap.add_argument("--schema", required=True, help="schema.sql 路径")
    ap.add_argument("--batch", required=True, help="批次日期，如 2026-08-26")
    ap.add_argument("--label", default=None, help="批次可读标签")
    ap.add_argument("--author", default="Manus AI")
    args = ap.parse_args()

    if not os.path.isdir(args.csv_dir):
        sys.exit(f"找不到数据目录: {args.csv_dir}")
    if not os.path.exists(args.schema):
        sys.exit(f"找不到 schema: {args.schema}")

    conn = sqlite3.connect(args.db)
    conn.execute("PRAGMA foreign_keys = ON")
    cur = conn.cursor()

    # 1) 建表
    with open(args.schema, encoding="utf-8") as f:
        cur.executescript(f.read())
    print("[OK] 已应用 schema.sql")

    # 2) 建批次
    label = args.label or f"{args.batch}盘中快照"
    cur.execute(
        "INSERT INTO scan_batch(snapshot_date, snapshot_label, author, source_file, notes) "
        "VALUES(?,?,?,?,?)",
        (args.batch, label, args.author, os.path.basename(args.csv_dir.rstrip('/')) + "/",
         "由 import_to_sqlite.py 从 CSV 导入"),
    )
    batch_id = cur.lastrowid
    print(f"[OK] 创建批次 batch_id={batch_id} label={label}")

    # 3) 逐 CSV 导入
    for fname, table in CSV_MAP.items():
        path = os.path.join(args.csv_dir, fname)
        if not os.path.exists(path):
            print(f"[WARN] 缺失 {fname}，跳过")
            continue
        with open(path, newline="", encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            header = next(reader)
            rows = list(reader)
        cols = header + ["batch_id"]
        placeholders = ",".join(["?"] * len(cols))
        sql = f"INSERT OR REPLACE INTO {table}({','.join(cols)}) VALUES({placeholders})"

        inserted = 0
        for r in rows:
            values = build_values(table, header, r)
            values += [batch_id]
            cur.execute(sql, values)
            inserted += 1
        print(f"[OK] {fname} → {table}: {inserted} 行, {len(header)} 列")

    conn.commit()
    conn.close()
    print(f"\n完成。库文件: {args.db}")


if __name__ == "__main__":
    main()
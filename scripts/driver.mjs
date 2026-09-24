#!/usr/bin/env node
// stock-value-analysis 驱动脚本：报告结构校验 + 全库一致性 lint
// 用法:
//   node driver.mjs check [报告文件.md ...]   校验单份/多份报告是否符合个股分析模板
//   node driver.mjs check --all               校验 07_个股分析报告/ 下全部主报告
//   node driver.mjs lint                      全库命名约定 + 断链检查
// 退出码: 0 = 全部通过; 1 = 有错误
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, basename, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SKILL_DIR, '..'); // 仓库根目录（scripts/ 的上一级）
const REPORT_DIR = join(ROOT, '07_个股分析报告');

let errors = 0, warnings = 0;
const err = (m) => { errors++; console.log(`  ✗ ${m}`); };
const warn = (m) => { warnings++; console.log(`  ⚠ ${m}`); };
const ok = (m) => console.log(`  ✓ ${m}`);

// ---------- 命名约定 ----------
// 主报告: {名称}-{6位A股代码}.md 或 {名称}-{5位港股代码}H.md
// 补充分析: {名称}-{代码}[H]-{主题}.md（_补充分析/ 下，允许 .html）
function checkName(file, inSupp) {
  const b = basename(file);
  const parts = b.replace(/\.(md|html)$/, '').split('-');
  const code = parts[1];
  const isHK = /^\d{5}H$/.test(code || '');
  const isA = /^\d{6}$/.test(code || '');
  if (inSupp) {
    if (parts.length < 3) { err(`${b}: 补充分析命名应为 {名称}-{代码}-{主题}`); return; }
    if (!isHK && !isA) err(`${b}: 代码段 "${code}" 不符合约定（A股6位 / 港股5位+H）`);
  } else {
    if (!isHK && !isA) err(`${b}: 命名应为 {名称}-{代码}.md（A股6位 / 港股5位+H）`);
    if (!b.endsWith('.md')) err(`${b}: 主报告必须是 .md`);
  }
  if (isHK) ok(`${b}: 港股命名合规`);
  else if (isA) ok(`${b}: A股命名合规`);
}

// ---------- 报告结构校验 ----------
function checkReport(file) {
  const rel = relative(ROOT, file);
  console.log(`\n== ${rel} ==`);
  if (!existsSync(file)) { err('文件不存在'); return; }
  const text = readFileSync(file, 'utf8');
  if (!text.trim()) { err('文件为空'); return; }

  if (/^#\s+/m.test(text)) ok('有标题'); else err('缺少一级标题');

  // 必需章节：按标题关键词匹配，允许插入额外专章（如"深度下钻"会把数据来源推到十三/十四）
  const REQUIRED = ['核心数据面板', 'L0 避坑', '定性', '财务验证', '估值', '风险识别', '执行', '情景分析', '综合评分卡', '五步决策汇总', '数据来源'];
  const heads = [...text.matchAll(/^##\s+(.+)$/gm)].map(m => m[1]);
  const missing = REQUIRED.filter(k => !heads.some(h => h.includes(k)));
  if (missing.length === 0) ok('11 个必需章节齐全');
  else err(`缺章节: ${missing.join(' / ')}`);

  // 顺序校验：必需章节须按模板相对顺序出现（允许中间插额外章节）
  let idx = -1, outOfOrder = [];
  for (const k of REQUIRED) {
    const i = heads.findIndex((h, j) => j > idx && h.includes(k));
    if (i === -1) break; // missing 已报
    if (i <= idx) outOfOrder.push(k);
    idx = i;
  }
  if (outOfOrder.length === 0) ok('章节顺序正确'); else err(`章节顺序异常: ${outOfOrder.join(' / ')}`);

  const dp = (text.match(/^###\s*决策点/gm) || []).length;
  if (dp >= 3) ok(`决策点 ${dp} 处`); else warn(`决策点 ${dp} 处（模板要求 4 处；15/42 份 2026-08 前老报告未用 ### 决策点 格式，新报告必须补齐）`);

  if (/不构成.{0,4}投资建议/.test(text)) ok('免责声明在'); else err('缺少免责声明（"不构成…投资建议"）');

  // 数据来源 = 匹配该关键词的最后一个二级标题之后的内容
  let dsLen = 0;
  for (let i = heads.length - 1; i >= 0; i--) {
    if (heads[i].includes('数据来源')) {
      const re = new RegExp(`^##\\s+${heads[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$([\\s\\S]*)`, 'm');
      dsLen = ((text.match(re) || [])[1] || '').trim().length;
      break;
    }
  }
  if (dsLen > 50) ok('数据来源章节非空'); else err('数据来源章节缺失或过短');

  const todo = (text.match(/需确认|数据限制/g) || []).length;
  if (todo > 0) warn(`有 ${todo} 处 "需确认/数据限制" 占位（数据不全，需补充）`);

  const inSupp = rel.includes('_补充分析');
  checkName(file, inSupp);
}

// ---------- 全库 lint ----------
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function lint() {
  console.log('== 命名约定检查（07_个股分析报告/） ==');
  for (const f of readdirSync(REPORT_DIR)) {
    const p = join(REPORT_DIR, f);
    if (statSync(p).isDirectory()) {
      if (f === '_补充分析') for (const s of readdirSync(p)) checkName(join(p, s), true);
      continue;
    }
    checkName(p, false);
  }

  console.log('\n== 断链检查（全库 markdown 相对链接） ==');
  const mds = walk(ROOT).filter(f => f.endsWith('.md') && !f.includes('karpathy'));
  let links = 0, broken = 0;
  for (const f of mds) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/\[([^\]]*)\]\(([^)#\s]+)(#[^)]*)?\)/g)) {
      const target = m[2];
      if (/^(https?:|mailto:)/.test(target)) continue;
      links++;
      const clean = decodeURIComponent(target.replace(/%20/g, ' '));
      if (!existsSync(resolve(dirname(f), clean))) {
        broken++;
        err(`${relative(ROOT, f)} → ${target}`);
      }
    }
  }
  if (broken === 0) ok(`${links} 条相对链接全部有效`);
  console.log(`\n${mds.length} 个 markdown 文件，${links} 条相对链接`);
}

// ---------- main ----------
const [, , mode, ...args] = process.argv;
if (mode === 'check') {
  let files;
  if (args[0] === '--all') {
    files = readdirSync(REPORT_DIR).filter(f => f.endsWith('.md')).map(f => join(REPORT_DIR, f));
  } else if (args.length) {
    files = args.map(a => resolve(a));
  } else {
    console.error('用法: node driver.mjs check <报告.md ... | --all>');
    process.exit(2);
  }
  for (const f of files) checkReport(f);
} else if (mode === 'lint') {
  lint();
} else {
  console.error('用法:\n  node driver.mjs check <报告.md ... | --all>\n  node driver.mjs lint');
  process.exit(2);
}
console.log(`\n结果: ${errors} 错误, ${warnings} 警告`);
process.exit(errors ? 1 : 0);

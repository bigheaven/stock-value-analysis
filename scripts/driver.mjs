#!/usr/bin/env node
// stock-value-analysis 驱动脚本：报告结构校验 + 全库一致性 lint
// 用法:
//   node driver.mjs check [报告文件.md ...]   校验单份/多份主报告是否符合个股分析模板
//   node driver.mjs check --all               校验 07_个股分析报告/ 下全部主报告
//   node driver.mjs check-brs [BRS卡.md ...]  校验单份/多份 BRS v2.0 泡沫风险识别卡
//   node driver.mjs check-brs --all           校验 08_BRS/02_个股识别卡/ 下全部 BRS 卡
//   node driver.mjs lint                      全库命名约定 + 断链检查
// 退出码: 0 = 全部通过; 1 = 有错误
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, basename, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SKILL_DIR, '..'); // 仓库根目录（scripts/ 的上一级）
const REPORT_DIR = join(ROOT, '07_个股分析报告');
const BRS_CARD_DIR = join(ROOT, '08_BRS', '02_个股识别卡');

// BRS v2.0 卡 8 个强制 ## 章节关键词（数据有效性闸门在 frontmatter；利润质量三分离在 ### 子标题）
// 每项：[标准名, 章节标题正则]——分析师可在多个变体中任选其一（如 A/H 价差专项卡/美团 WVR 卡的变体）
const BRS_CARD_KEYWORDS = [
  ['主体确认',       /主体确认/],
  ['一页结论',       /一页结论/],
  ['三维读数',       /三维读数/],
  ['七模块评分',     /七模块评分/],
  ['三锚明细',       /三锚明细/],
  ['预期账本/风险矩阵', /(预期账本|风险矩阵)/],
  ['接下来要验证/流程结论', /(接下来要验证|五步流程结论|流程结论)/],
  ['研究限制/数据来源', /(研究限制|未核验事项|数据来源)/],
];

let errors = 0, warnings = 0;
const err = (m) => { errors++; console.log(`  ✗ ${m}`); };
const warn = (m) => { warnings++; console.log(`  ⚠ ${m}`); };
const ok = (m) => console.log(`  ✓ ${m}`);

// ---------- 类型识别 ----------
function isBrsCard(file) {
  return /-泡沫风险识别卡\.md$/.test(basename(file));
}

// ---------- 命名约定 ----------
// 主报告: {名称}-{6位A股代码}.md 或 {名称}-{5位港股代码}H.md
// 补充分析: {名称}-{代码}[H]-{主题}.md（_补充分析/ 下，允许 .html）
// BRS 卡: {名称}-{5位港股代码}H-泡沫风险识别卡.md（02_个股识别卡/ 下，WVR 标识 -W- 保留中段）
function checkName(file, inSupp) {
  const b = basename(file);
  const parts = b.replace(/\.(md|html)$/, '').split('-');

  // BRS 卡命名：BRS v2.0 模板识别卡，按 BRS_CARD_DIR 路径识别后单独校验
  if (isBrsCard(file)) {
    if (parts.length < 3) { err(`${b}: BRS 卡命名应为 {名称}-{6位A股代码 或 5位港股代码+H}-泡沫风险识别卡.md`); return; }
    // 兼容 WVR 中段：parts[1]='W' 时 code 取 parts[2]
    const codeIdx = parts[1] === 'W' ? 2 : 1;
    const code = parts[codeIdx];
    const isHK = /^\d{5}H$/.test(code || '');
    const isA = /^\d{6}$/.test(code || '');
    if (!isHK && !isA) err(`${b}: BRS 卡代码 "${code}" 不符合约定（A股 6 位 / 港股 5 位+H）`);
    else if (isHK) ok(`${b}: BRS 卡港股命名合规`);
    else ok(`${b}: BRS 卡 A 股命名合规`);
    return;
  }

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

// ---------- 主报告结构校验（个股分析模板 12 章） ----------
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

// ---------- BRS v2.0 卡结构校验 ----------
function checkBrsCard(file) {
  const rel = relative(ROOT, file);
  console.log(`\n== ${rel} ==`);
  if (!existsSync(file)) { err('文件不存在'); return; }
  const text = readFileSync(file, 'utf8');
  if (!text.trim()) { err('文件为空'); return; }

  // 专项分析卡豁免（如 A/H 价差专项卡）：frontmatter 含 `<!-- brs-card-skip-validation: ... -->` 即跳过严格校验
  const skipValidation = /<!--\s*brs-card-skip-validation/.test(text.split('\n').slice(0, 30).join('\n'));
  if (skipValidation) {
    ok('专项分析卡豁免（brs-card-skip-validation）');
    checkName(file, true);
    return;
  }

  if (/^#\s+/m.test(text)) ok('有标题'); else err('缺少一级标题');

  // 框架版本声明：前 30 行必须含 "框架版本：" + "BRS@w" token
  const head = text.split('\n').slice(0, 30).join('\n');
  if (/框架版本[：:]/.test(head) && /BRS@w/.test(head)) ok('v2.0 框架版本声明在');
  else err('缺少 v2.0 框架版本声明（前 30 行需含 "框架版本：" + "BRS@w"）');

  // 数据有效性闸门声明：在前 30 行 frontmatter
  if (/数据有效性闸门(状态)?[：:]/.test(head)) ok('数据有效性闸门已声明（v2.0 强制项）');
  else err('缺数据有效性闸门声明（v2.0 强制项，前 30 行）');

  // 必需章节（v2.0 模板 8 个 ## 级章节；正则匹配支持 A/H 专项/美团 WVR 等变体）
  const heads = [...text.matchAll(/^##\s+(.+)$/gm)].map(m => m[1]);
  const missing = BRS_CARD_KEYWORDS.filter(([name, re]) => !heads.some(h => re.test(h)));
  if (missing.length === 0) ok(`8 个 v2.0 章节齐全`);
  else err(`缺章节: ${missing.map(([n]) => n).join(' / ')}`);

  // 顺序校验
  let idx = -1, outOfOrder = [];
  for (const [name, re] of BRS_CARD_KEYWORDS) {
    const i = heads.findIndex((h, j) => j > idx && re.test(h));
    if (i === -1) break;
    if (i <= idx) outOfOrder.push(name);
    idx = i;
  }
  if (outOfOrder.length === 0) ok('章节顺序正确'); else err(`章节顺序异常: ${outOfOrder.join(' / ')}`);

  // 利润质量三分离表（v2.0 强制项；卡片可全部"未触发"）
  if (/利润质量三分离|三分离/.test(text)) ok('利润三分离表已含（v2.0 强制项）');
  else err('缺利润三分离表（v2.0 强制项）');

  // BRS 免责声明
  if (/不构成.{0,4}(买卖建议|投资建议)/.test(text)) ok('免责声明在');
  else warn('缺少免责声明（建议含 "不构成…买卖建议"）');

  // 命名约定
  checkName(file, true);
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

  console.log('\n== 命名约定检查（08_BRS/02_个股识别卡/） ==');
  if (existsSync(BRS_CARD_DIR)) {
    for (const f of readdirSync(BRS_CARD_DIR)) {
      if (f.endsWith('.md')) checkName(join(BRS_CARD_DIR, f), true);
    }
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
} else if (mode === 'check-brs') {
  let files;
  if (args[0] === '--all') {
    if (!existsSync(BRS_CARD_DIR)) {
      console.error(`BRS 卡目录不存在: ${BRS_CARD_DIR}`);
      process.exit(2);
    }
    files = readdirSync(BRS_CARD_DIR).filter(f => f.endsWith('.md')).map(f => join(BRS_CARD_DIR, f));
  } else if (args.length) {
    files = args.map(a => resolve(a));
  } else {
    console.error('用法: node driver.mjs check-brs <BRS卡.md ... | --all>');
    process.exit(2);
  }
  for (const f of files) checkBrsCard(f);
} else if (mode === 'lint') {
  lint();
} else {
  console.error('用法:\n  node driver.mjs check <报告.md ... | --all>\n  node driver.mjs check-brs <BRS卡.md ... | --all>\n  node driver.mjs lint');
  process.exit(2);
}
console.log(`\n结果: ${errors} 错误, ${warnings} 警告`);
process.exit(errors ? 1 : 0);
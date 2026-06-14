const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

const VALID_DYNASTY_IDS = new Set([
  'yu', 'shanggu', 'shiqian',
  'xia', 'shang', 'xizhou', 'chunqiu', 'zhanguo',
  'qin', 'xihan', 'xin', 'gengshi', 'donghan',
  'sanguo', 'xijin', 'dongjin', 'nanbei', 'sui',
  'tang', 'wuzhou', 'wudai', 'liao', 'beisong',
  'jin', 'nansong', 'yuan', 'ming', 'qing',
  'japan', 'franks', 'frank', 'abbasid', 'byzantium'
]);

const EVENT_REQUIRED_FIELDS = ['t', 's', 'a', 'l', 'c', 'r', 'o'];

const nonBcFiles = [];
for (let i = 1; i <= 1901; i += 100) {
  const start = i;
  const end = i + 99;
  const filename = `${String(start).padStart(4, '0')}-${String(end).padStart(4, '0')}.json`;
  nonBcFiles.push(filename);
}

const bcFiles = [
  'bc-1000-0901.json', 'bc-0900-0801.json', 'bc-0800-0701.json',
  'bc-0700-0601.json', 'bc-0600-0501.json', 'bc-0500-0401.json',
  'bc-0400-0301.json', 'bc-0300-0201.json', 'bc-0200-0101.json',
  'bc-0100-0001.json',
  'bc-2000-1001.json',
  'bc-9600-2001.json'
];

const priorityFiles = new Set([
  '0701-0800.json', '0801-0900.json', '0901-1000.json',
  '1001-1100.json', '1101-1200.json', '1201-1300.json',
  '1301-1400.json', '1401-1500.json', '1501-1600.json',
  '1601-1700.json', '1701-1800.json', '1801-1900.json',
  '1901-2000.json',
  'bc-2000-1001.json', 'bc-9600-2001.json'
]);

const results = [];

for (const filename of [...nonBcFiles, ...bcFiles]) {
  const filePath = path.join(DATA_DIR, filename);
  const isPriority = priorityFiles.has(filename);

  if (!fs.existsSync(filePath)) {
    results.push({
      file: filename,
      status: 'NOT FOUND',
      entries: 0, events: 0, years: 0,
      issues: ['文件不存在'],
      priority: isPriority
    });
    continue;
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  let data;
  const issues = [];

  try {
    data = JSON.parse(raw);
  } catch (e) {
    const msg = e.message;
    let lineHint = '';
    const m = msg.match(/position\s+(\d+)/);
    if (m) {
      const pos = parseInt(m[1]);
      const before = raw.substring(0, pos);
      const lineNum = before.split('\n').length;
      lineHint = ` (行号约 ${lineNum})`;
    }
    results.push({
      file: filename,
      status: 'JSON解析失败',
      entries: 0, events: 0, years: 0,
      issues: [`JSON.parse 错误: ${msg}${lineHint}`],
      priority: isPriority,
      rawLength: raw.length
    });
    continue;
  }

  if (!Array.isArray(data)) {
    results.push({
      file: filename,
      status: '格式错误',
      entries: 0, events: 0, years: 0,
      issues: ['根元素不是数组'],
      priority: isPriority
    });
    continue;
  }

  const entries = data.length;
  let totalEvents = 0;
  const years = new Set();
  let invalidDynastyIds = [];
  let missingDynasty = false;
  let yearDuplicates = new Map();
  let entriesWithoutEvents = 0;
  let eventsMissingFields = [];
  let eventsWithInvalidFields = [];

  for (let i = 0; i < data.length; i++) {
    const entry = data[i];
    const idx = `entry[${i}]`;

    if (typeof entry.y !== 'number') {
      issues.push(`${idx}: year 不是数字类型`);
    } else {
      if (years.has(entry.y)) {
        if (!yearDuplicates.has(entry.y)) {
          yearDuplicates.set(entry.y, []);
        }
        yearDuplicates.get(entry.y).push(i);
      }
      years.add(entry.y);
    }

    if (!Array.isArray(entry.d)) {
      if (!missingDynasty) {
        issues.push(`${idx}: dynasties 不是数组`);
        missingDynasty = true;
      }
    } else {
      if (entry.d.length === 0) {
        issues.push(`${idx} (年份 ${entry.y}): dynasties 数组为空`);
      }
      for (const d of entry.d) {
        if (d.i && !VALID_DYNASTY_IDS.has(d.i)) {
          invalidDynastyIds.push(`${entry.y} -> ${d.i}`);
        }
      }
    }

    if (!Array.isArray(entry.v)) {
      issues.push(`${idx}: events 不是数组`);
    } else {
      if (entry.v.length === 0) {
        entriesWithoutEvents++;
      }
      totalEvents += entry.v.length;

      for (let j = 0; j < entry.v.length; j++) {
        const evt = entry.v[j];
        const eIdx = `${idx}.v[${j}] (年份 ${entry.y}, "${(evt.t || '').substring(0, 30)}")`;

        const missingFields = EVENT_REQUIRED_FIELDS.filter(f => !(f in evt));
        if (missingFields.length > 0) {
          eventsMissingFields.push(`${eIdx}: 缺少字段 ${missingFields.join(', ')}`);
        }

        for (const key of Object.keys(evt)) {
          if (key === 's') continue;
          if (!EVENT_REQUIRED_FIELDS.includes(key)) {
            eventsWithInvalidFields.push(`${eIdx}: 未预期字段 "${key}"`);
          }
        }
      }
    }
  }

  if (invalidDynastyIds.length > 0) {
    const unique = [...new Set(invalidDynastyIds)];
    issues.push(`无效 dynastyId: ${unique.slice(0, 10).join(', ')}${unique.length > 10 ? ` ... 共${unique.length}个` : ''}`);
  }

  if (yearDuplicates.size > 0) {
    const dupYears = [...yearDuplicates.keys()];
    issues.push(`年份重复: ${dupYears.slice(0, 5).join(', ')}${dupYears.length > 5 ? ` ... 共${dupYears.length}个` : ''}`);
  }

  if (entriesWithoutEvents > 0) {
    issues.push(`${entriesWithoutEvents} 个条目无事件`);
  }

  if (eventsMissingFields.length > 0) {
    issues.push(`${eventsMissingFields.length} 个事件缺少必填字段`);
    if (eventsMissingFields.length <= 5) {
      issues[issues.length - 1] += ': ' + eventsMissingFields.join('; ');
    }
  }

  if (eventsWithInvalidFields.length > 0) {
    issues.push(`${eventsWithInvalidFields.length} 个事件包含未预期字段`);
    if (eventsWithInvalidFields.length <= 5) {
      issues[issues.length - 1] += ': ' + eventsWithInvalidFields.join('; ');
    }
  }

  results.push({
    file: filename,
    status: issues.length === 0 ? '✅ 正常' : '⚠️ 有问题',
    entries,
    events: totalEvents,
    years: years.size,
    issues,
    priority: isPriority
  });
}

// ==================== Validate content-years.json ====================
const cyFile = 'content-years.json';
const cyPath = path.join(DATA_DIR, cyFile);
const cyIssues = [];
let cyEntries = 0, cyYearsCount = 0;

if (!fs.existsSync(cyPath)) {
  cyIssues.push('文件不存在');
} else {
  try {
    const raw = fs.readFileSync(cyPath, 'utf-8');
    const data = JSON.parse(raw);

    if (data.years_delta && Array.isArray(data.years_delta)) {
      cyEntries = 1;
      const deltas = data.years_delta;
      if (deltas.length < 2) {
        cyIssues.push('years_delta 数组过短');
      } else {
        const first = deltas[0];
        if (first !== -9600) cyIssues.push(`首年应为 -9600，实际为 ${first}`);

        const years = [first];
        for (let i = 1; i < deltas.length; i++) {
          const d = deltas[i];
          if (d < 1) cyIssues.push(`years_delta[${i}] = ${d}，应为正数`);
          years.push(years[years.length - 1] + d);
        }

        cyYearsCount = years.length;
        const lastYear = years[years.length - 1];
        if (lastYear < 1912) cyIssues.push(`最终年份 ${lastYear} 小于 1912，未覆盖到清朝结束`);

        // Check for year 0 (which doesn't exist)
        if (years.includes(0)) cyIssues.push('年份序列包含不存在的公元0年');

        // Verify all years within expected range
        const outOfRange = years.filter(y => y < -10000 || y > 1912);
        if (outOfRange.length > 0) cyIssues.push(`${outOfRange.length} 个年份超出范围 [-10000, 1912]`);
      }
    } else if (data.years && Array.isArray(data.years)) {
      cyEntries = 1;
      cyYearsCount = data.years.length;
      cyIssues.push('使用 years 而非 years_delta，建议改用 delta 编码');
    } else {
      cyIssues.push('缺少 years_delta 或 years 数组');
    }
  } catch (e) {
    cyIssues.push(`JSON 解析错误: ${e.message}`);
  }
}

results.push({
  file: cyFile,
  status: cyIssues.length === 0 ? '✅ 正常' : '⚠️ 有问题',
  entries: cyEntries,
  events: cyYearsCount,
  issues: cyIssues,
  priority: false
});

console.log('');
console.log('='.repeat(100));
console.log('  JSON 文件验证报告');
console.log('='.repeat(100));
console.log('');

const colW = [24, 14, 10, 10, 50];
console.log(
  '| ' + '文件'.padEnd(colW[0]) +
  ' | ' + '状态'.padEnd(colW[1]) +
  ' | ' + '条目数'.padEnd(colW[2]) +
  ' | ' + '事件数'.padEnd(colW[3]) +
  ' | ' + '问题摘要'
);
console.log('|-' + '-'.repeat(colW[0]) + '-|-' + '-'.repeat(colW[1]) + '-|-' + '-'.repeat(colW[2]) + '-|-' + '-'.repeat(colW[3]) + '-|-');

for (const r of results) {
  const marker = r.priority ? ' ★' : '';
  const statusStr = r.status + marker;
  const padStatus = statusStr.length > colW[1] ? colW[1] : colW[1];
  const issueSummary = r.issues.length > 0 ? r.issues[0] : '';
  const truncated = issueSummary.length > 48 ? issueSummary.substring(0, 48) + '..' : issueSummary;

  console.log(
    '| ' + r.file.padEnd(colW[0]) +
    ' | ' + statusStr.padEnd(colW[1]) +
    ' | ' + String(r.entries).padEnd(colW[2]) +
    ' | ' + String(r.events).padEnd(colW[3]) +
    ' | ' + truncated
  );
}

console.log('');
console.log('='.repeat(100));
console.log('  详细问题报告');
console.log('='.repeat(100));
console.log('');

const filesWithIssues = results.filter(r => r.issues.length > 0);
const failureFiles = results.filter(r => r.status.includes('失败') || r.status.includes('NOT FOUND'));

if (failureFiles.length > 0) {
  console.log('### 🔴 严重错误（无法解析）');
  console.log('');
  for (const r of failureFiles) {
    console.log(`  [${r.file}]`);
    for (const issue of r.issues) {
      console.log(`    ❌ ${issue}`);
    }
    console.log('');
  }
}

for (const r of filesWithIssues.filter(r => !failureFiles.includes(r))) {
  console.log(`### ${r.file}${r.priority ? ' ★重点文件' : ''}`);
  console.log(`  条目数: ${r.entries} | 事件数: ${r.events} | 年份数: ${r.years}`);
  for (const issue of r.issues) {
    console.log(`    ⚠️ ${issue}`);
  }
  console.log('');
}

if (filesWithIssues.length === 0) {
  console.log('🎉 所有文件验证通过，未发现问题！');
}

console.log('');
console.log('='.repeat(100));
console.log(`  总计: ${results.length} 个文件`);
console.log(`  ✅ 正常: ${results.filter(r => r.status === '✅ 正常').length} 个`);
console.log(`  ⚠️  有问题: ${filesWithIssues.length} 个`);
console.log(`  🔴 严重错误: ${failureFiles.length} 个`);
console.log('='.repeat(100));
console.log('');

const totalEntries = results.reduce((s, r) => s + r.entries, 0);
const totalEvents = results.reduce((s, r) => s + r.events, 0);
const dataEvents = results.filter(r => r.file !== 'content-years.json').reduce((s, r) => s + r.events, 0);
console.log(`  总条目数: ${totalEntries}`);
console.log(`  总事件数: ${dataEvents}（数据文件） + ${results.find(r => r.file === 'content-years.json')?.events || 0}（年份索引） = ${totalEvents}`);
console.log('');
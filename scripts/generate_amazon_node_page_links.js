const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'docs', '\u70ed\u9500\u699c', '\u539f\u59cb\u5b8c\u6574\u70ed\u9500\u699cbrs id\u94fe\u63a5');
const outputDir = path.join(root, 'docs', '\u70ed\u9500\u699c', '\u6309\u56fd\u5bb6\u8f93\u51fa\u7684BRS ID\u641c\u7d22\u7ed3\u679c\u9875链接');
const configs = [
  { country: '\u82f1\u56fd', file: '\u82f1\u56fd.md', host: 'www.amazon.co.uk' },
  { country: '\u7f8e\u56fd', file: '\u7f8e\u56fd.md', host: 'www.amazon.com' },
  { country: '\u5fb7\u56fd', file: '\u5fb7\u56fd.md', host: 'www.amazon.de' },
];

fs.mkdirSync(outputDir, { recursive: true });

for (const config of configs) {
  const input = fs.readFileSync(path.join(sourceDir, config.file), 'utf8');
  const byNode = new Map();
  for (const line of input.split(/\r?\n/)) {
    const match = line.match(/^(.+?)\s+(https?:\/\/\S+)\s*$/);
    if (!match) continue;
    const name = match[1].trim();
    const url = match[2];
    const nodeMatch = url.match(/\/(?:zgbs|bestsellers)\/[^/]+\/(\d+)(?:\/|$)/);
    if (!nodeMatch) continue;
    if (!byNode.has(nodeMatch[1])) byNode.set(nodeMatch[1], name);
  }

  const named = [];
  const links = [];
  for (const [node, name] of byNode) {
    for (let page = 1; page <= 10; page += 1) {
      const link = `https://${config.host}/s?rh=n:${node}&fs=true&page=${page}`;
      named.push(`${name}\t${node}\t${page}\t${link}`);
      links.push(link);
    }
  }
  const prefix = path.join(outputDir, config.country);
  fs.writeFileSync(`${prefix}-榜单名称版.tsv`, `榜单名称\tBRS ID\t页码\t搜索结果页链接\n${named.join('\n')}\n`, 'utf8');
  fs.writeFileSync(`${prefix}-纯链接版.txt`, `${links.join('\n')}\n`, 'utf8');
  console.log(`${config.country}: ${byNode.size} nodes, ${links.length} links`);
}

const fs = require('fs');
const content = fs.readFileSync('bsr-candidate3.vue', 'utf8');

// Find "return result;\n};" which is the end of computeGroupedPurchasers
const funcEnd = '\treturn result;\n};';
const funcIdx = content.indexOf(funcEnd);
if (funcIdx === -1) {
    console.log('ERROR: computeGroupedPurchasers end not found');
    // Try another pattern
    const altMarker = 'return result;';
    const altIdx = content.indexOf(altMarker, content.indexOf('computeGroupedPurchasers'));
    console.log('altIdx:', altIdx);
    if (altIdx !== -1) {
        const context = content.substring(altIdx, altIdx + 50);
        console.log('Context:', JSON.stringify(context));
    }
    process.exit(1);
}

console.log('Found end of computeGroupedPurchasers at', funcIdx);

const helperFunc = `

\t// 检查采购员是否对该国家启用了采购数量输入
\tconst getCountryEnabled = (row: any, countryCode: string): boolean => {
\t\tif (!row.country_enabled) return true; // 向后兼容：无数据则默认启用
\t\tconst ce = typeof row.country_enabled === 'string'
\t\t\t? JSON.parse(row.country_enabled)
\t\t\t: row.country_enabled;
\t\treturn !!ce[countryCode];
\t};`;

const insertPos = funcIdx + funcEnd.length;
const newContent = content.substring(0, insertPos) + helperFunc + content.substring(insertPos);

fs.writeFileSync('bsr-candidate3.vue', newContent, 'utf8');
console.log('Success! Inserted getCountryEnabled at position', insertPos);

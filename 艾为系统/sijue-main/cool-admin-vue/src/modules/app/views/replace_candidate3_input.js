const fs = require('fs');
const content = fs.readFileSync('bsr-candidate3.vue', 'utf8');

// Find and replace: add :disabled to the country el-input
const oldInput = `\t\t\t\t\t\t\t<template #default="{ row }">
\t\t\t\t\t\t\t\t<el-input
\t\t\t\t\t\t\t\t\tv-model.number="row.purchaserNum[country.code]"
\t\t\t\t\t\t\t\t\ttype="number"
\t\t\t\t\t\t\t\t\t:min="0"
\t\t\t\t\t\t\t\t\tplaceholder="数量"
\t\t\t\t\t\t\t\t\tcontrols-position="right"
\t\t\t\t\t\t\t\t\tstyle="width: 95px"
\t\t\t\t\t\t\t\t\t@input="handleInputChange(scope, row)"
\t\t\t\t\t\t\t\t/>
\t\t\t\t\t\t\t</template>`;

const newInput = `\t\t\t\t\t\t\t<template #default="{ row }">
\t\t\t\t\t\t\t\t<el-input
\t\t\t\t\t\t\t\t\tv-model.number="row.purchaserNum[country.code]"
\t\t\t\t\t\t\t\t\ttype="number"
\t\t\t\t\t\t\t\t\t:min="0"
\t\t\t\t\t\t\t\t\tplaceholder="数量"
\t\t\t\t\t\t\t\t\tcontrols-position="right"
\t\t\t\t\t\t\t\t\tstyle="width: 95px"
\t\t\t\t\t\t\t\t\t:disabled="!getCountryEnabled(row, country.code)"
\t\t\t\t\t\t\t\t\t@input="handleInputChange(scope, row)"
\t\t\t\t\t\t\t\t/>
\t\t\t\t\t\t\t</template>`;

const idx = content.indexOf(oldInput);
if (idx === -1) {
    console.log('ERROR: input template not found, searching for partial...');
    // Try to find a distinctive part
    const part = 'v-model.number="row.purchaserNum[country.code]"';
    const pIdx = content.indexOf(part);
    if (pIdx !== -1) {
        console.log('Found at', pIdx);
        console.log('Context:', JSON.stringify(content.substring(pIdx - 20, pIdx + 200)));
    }
    process.exit(1);
}

console.log('Found input template at', idx);
const newContent = content.substring(0, idx) + newInput + content.substring(idx + oldInput.length);
fs.writeFileSync('bsr-candidate3.vue', newContent, 'utf8');
console.log('Success! Added :disabled to country input');

const fs = require('fs');

const files = [
    'e:/yuanma/amz-listing-optimiser-source-delivery/woeau/cool-admin-vue/src/modules/app/views/bsr-candidate.vue',
    'e:/yuanma/amz-listing-optimiser-source-delivery/woeau/cool-admin-vue/src/modules/app/views/bsr-candidate2.vue',
    'e:/yuanma/amz-listing-optimiser-source-delivery/woeau/cool-admin-vue/src/modules/app/views/bsr-candidate3.vue',
    'e:/yuanma/amz-listing-optimiser-source-delivery/woeau/cool-admin-vue/src/modules/app/views/bsr-candidate4.vue',
    'e:/yuanma/amz-listing-optimiser-source-delivery/woeau/cool-admin-vue/src/modules/app/views/bsr-candidate-backlog.vue'
];

for (const file of files) {
    if (!fs.existsSync(file)) {
        console.log('File not found:', file);
        continue;
    }
    let content = fs.readFileSync(file, 'utf-8');

    // 1. Update columns configuration
    content = content.replace(
        /\{\s*label:\s*"ASIN",\s*prop:\s*"asin",\s*minWidth:\s*60,\s*fixed:\s*"left",\s*showOverflowTooltip:\s*true\s*\},[\s\S]*?\{\s*label:\s*"产品页",\s*prop:\s*"dp_url",\s*fixed:\s*"left",\s*minWidth:\s*100\s*\}/,
        `{ label: "ASIN", prop: "asin", minWidth: 100, fixed: "left", showOverflowTooltip: true },
		{
			label: "图片",
			prop: "image_url_display",
			component: {
				name: "cl-image",
				props: { size: 50, fit: "contain", referrerpolicy: "no-referrer" }
			},
			fixed: "left"
		}`
    );

    // 2. Replace column-asin and remove column-dp_url
    content = content.replace(
        /<template #column-asin="\{ scope \}">[\s\S]*?<\/template>[\s\S]*?<template #column-bsr_link="\{ scope \}">[\s\S]*?<\/template>[\s\S]*?<template #column-dp_url="\{ scope \}">[\s\S]*?<\/template>/,
        `<template #column-asin="{ scope }">
					<div class="date-cell">
						<div class="asin-value">
							<el-link type="primary" :underline="false" @click.prevent="openProductLinks2(scope.row)">
								{{ scope.row.asin }}
							</el-link>
						</div>
						<!-- 状态标签 -->
						<br />
						<div v-if="scope.row.source === 1" class="status-tag status-tag--close">
							数
						</div>
						<div
							v-else-if="scope.row.source === 2"
							class="status-tag status-tag--compete"
						>
							1688
						</div>
						<div
							v-else-if="scope.row.source === 3"
							class="status-tag status-tag--success"
						>
							变
						</div>
						<div
							v-else-if="scope.row.source === 4"
							class="status-tag status-tag--success"
						>
							季
						</div>
						<br />
						<el-link target="_blank" :underline="false" @click.prevent="openProductLinks(scope.row)">
							<el-button size="small">批量打开</el-button>
						</el-link>
					</div>
				</template>

				<template #column-bsr_link="{ scope }">
					<cl-table-column-bsr-link :bsr_link="scope.row.bsr_link" />
				</template>`
    );

    // 3. Update competitor ASIN to be clickable
    content = content.replace(
        /<el-table-column prop="asin_competitor" label="ASIN" width="130" \/>/,
        `<el-table-column label="ASIN" width="130">
							<template #default="{ row }">
								<el-link
									target="_blank"
									:underline="false"
									@click.prevent="openProductLinks3(row)"
								>
									{{ row.asin_competitor }}
								</el-link>
							</template>
						</el-table-column>`
    );

    // 4. Remove '打开详情' button in competitor table
    content = content.replace(
        /<el-button type="info" size="small" @click="openProductLinks3\(row\)">\s*打开详情\s*<\/el-button>/,
        ``
    );

    // 5. Update openProductLinks3 function
    content = content.replace(
        /function openProductLinks3\(row:\s*any\)\s*\{\s*const cleanAsin = row\.asin\.replace\(\/\[\^A-Z0-9\]\/g, ""\);\s*const dpUrl = appConfig\.get_amazon_url_dp\(cleanAsin, row\.marketplace\);\s*window\.open\(dpUrl\);\s*\}/,
        `function openProductLinks3(row: any) {
	const asin = row.asin_competitor || row.asin;
	const cleanAsin = asin.replace(/[^A-Z0-9]/g, "");
	const dpUrl = appConfig.get_amazon_url_dp(cleanAsin, row.marketplace);
	window.open(dpUrl);
}`
    );

    fs.writeFileSync(file, content);
    console.log('Updated', file);
}
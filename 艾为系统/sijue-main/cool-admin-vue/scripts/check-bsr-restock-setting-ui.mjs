import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const viewPath = resolve(root, "src/modules/app/views/bsr_product_Listing_Lingxing.vue");
const source = readFileSync(viewPath, "utf8");

assert.match(source, /handleRestockSetting/, "bsr listing page should expose restock setting action");
assert.match(source, /futureRestockDialogVisible/, "bsr listing page should keep the future restock dialog");
assert.match(source, /batchSetRestockSetting/, "bsr listing page should call the restock setting API");
assert.match(source, /settingType:\s*1/, "bsr listing page should support no-restock setting");
assert.match(source, /settingType:\s*2/, "bsr listing page should support future-restock setting");
assert.doesNotMatch(
	source,
	/<el-button type="warning" :disabled="selectedListingCount === 0">\s*补货设置/,
	"bulk restock setting button should not fail silently when no row is selected"
);
assert.match(
	source,
	/<el-dropdown-item @click="handleSelectedRestockSetting\('no_restock'\)">不再补货<\/el-dropdown-item>/,
	"bulk no-restock menu item should call the handler directly"
);
assert.match(
	source,
	/<el-dropdown-item @click="handleSelectedRestockSetting\('future_restock'\)">设置未来补货数<\/el-dropdown-item>/,
	"bulk future-restock menu item should call the handler directly"
);
assert.match(
	source,
	/<el-dropdown-item @click="handleRestockSetting\('no_restock', scope\.row\)">不再补货<\/el-dropdown-item>/,
	"row no-restock menu item should call the handler directly"
);
assert.match(
	source,
	/<el-dropdown-item @click="handleRestockSetting\('future_restock', scope\.row\)">设置未来补货数<\/el-dropdown-item>/,
	"row future-restock menu item should call the handler directly"
);

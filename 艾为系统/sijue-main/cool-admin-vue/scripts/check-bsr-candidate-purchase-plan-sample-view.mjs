import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repoRoot = resolve(root, "..");
const viewPath = resolve(root, "src/modules/app/views/bsr-candidate-purchase-plan.vue");
const entityPath = resolve(
	repoRoot,
	"cool-admin-midway/src/modules/app/entity/bsr_candidate_purchase_plan.ts"
);
const controllerPath = resolve(
	repoRoot,
	"cool-admin-midway/src/modules/app/controller/admin/bsr_candidate_purchase_plan.ts"
);
const migrationPath = resolve(
	repoRoot,
	"cool-admin-midway/src/migration/1780460200000-candidate-purchase-plan-sample-status.ts"
);
const source = readFileSync(viewPath, "utf8");
const entitySource = readFileSync(entityPath, "utf8");
const controllerSource = readFileSync(controllerPath, "utf8");
const migrationSource = readFileSync(migrationPath, "utf8");

assert.doesNotMatch(source, /viewMode/, "purchase plan page should not expose a data-view mode");
assert.doesNotMatch(
	source,
	/handleViewModeChange/,
	"purchase plan page should not switch between all/sample views"
);
assert.doesNotMatch(
	source,
	/>数据视图</,
	"purchase plan page toolbar should not show data-view filter label"
);
assert.doesNotMatch(
	source,
	/<el-option[^>]*value="all"[^>]*label="全部"/,
	"purchase plan page should not offer all view"
);
assert.doesNotMatch(
	source,
	/<el-option[^>]*value="sample"[^>]*label="样品"/,
	"purchase plan page should not offer sample view filter"
);
assert.match(source, /type:\s*2/, "purchase plan page should always request sample purchases");
assert.match(
	source,
	/import\s+\{\s*onMounted,\s*reactive,\s*ref\s*\}\s+from "vue";/,
	"purchase plan page should import onMounted"
);
assert.match(
	source,
	/onMounted\(\(\)\s*=>\s*\{\s*Crud\.value\?\.refresh\(\{\s*page:\s*1\s*\}\);\s*\}\);/,
	"purchase plan page should load sample data when entering the page"
);
assert.doesNotMatch(
	source,
	/bsr_candidate_purchase_plan as any\)\.page\(query\)/,
	"purchase plan page should not request unfiltered all purchase plans"
);
assert.match(
	source,
	/\/admin\/app\/bsr_purchase_order_logistics\/orderOverview/,
	"purchase plan page should use orderOverview for logistics traces"
);
assert.match(
	source,
	/fetchSavedLogisticsOverviews/,
	"purchase plan page should load saved logistics traces after purchase orders are loaded"
);
assert.match(
	source,
	/fetchOrderLogisticsOverview\(order,\s*false\)/,
	"purchase plan page should read saved logistics traces without querying the provider"
);
assert.match(
	source,
	/ensureOrderLogisticsOverview/,
	"purchase plan page should only ensure saved logistics data on popover hover"
);
assert.doesNotMatch(
	source,
	/function handleLogisticsPopoverShow\(order: any\)\s*\{\s*fetchOrderLogisticsOverview\(order,\s*true\);\s*\}/,
	"logistics popover hover should not force-refresh logistics from the provider every time"
);
assert.match(
	source,
	/function handleLogisticsPopoverShow\(order: any\)\s*\{\s*ensureOrderLogisticsOverview\(order\);\s*\}/,
	"logistics popover hover should ensure saved logistics data only"
);
assert.match(
	source,
	/function refreshOrderLogisticsOverview\(order: any\)\s*\{[\s\S]*?fetchOrderLogisticsOverview\(order,\s*true\)/,
	"purchase plan page should still expose an explicit manual logistics refresh action"
);
assert.match(
	source,
	/include_packages:\s*true/,
	"purchase plan page should request package-level logistics traces"
);
assert.match(
	source,
	/@show="handleLogisticsPopoverShow\(s\)"/,
	"purchase plan page should refresh logistics traces when the popover is shown"
);
assert.match(
	source,
	/<el-timeline/,
	"purchase plan page should render logistics traces as a timeline"
);
assert.match(
	source,
	/getTraceList/,
	"purchase plan page should normalize and display trace_info_json"
);
assert.match(
	source,
	/getOrderLogisticsDisplayText\(s\)/,
	"logistics column should display the latest logistics trace instead of generic status text"
);
assert.match(
	source,
	/getOrderLatestTrace\(order/,
	"purchase plan page should derive the latest trace across packages"
);
assert.match(
	source,
	/logistics-trace-trigger/,
	"logistics column should use a trace preview trigger that can hold latest trace text"
);
assert.doesNotMatch(
	source,
	/\{\{\s*getOrderLogisticsStatusText\(s\)\s*\}\}/,
	"logistics dynamic cell should not render generic status text such as in-transit or signed"
);
assert.match(
	source,
	/:height="tableHeight"/,
	"purchase plan table should use a fixed height so the header and horizontal scrollbar stay visible"
);
assert.match(
	source,
	/const tableHeight = "calc\(100vh - 190px\)";/,
	"purchase plan table height should fit within the viewport"
);
assert.match(
	source,
	/popper-class="candidate-logistics-popover"/,
	"logistics trace popover should use a dedicated global popper class"
);
assert.match(
	source,
	/:teleported="true"/,
	"logistics trace popover should render outside the table scroll container"
);
assert.doesNotMatch(
	source,
	/:teleported="false"/,
	"logistics trace popover should not be trapped inside the table DOM"
);

assert.match(
	source,
	/product_main_image_display_url/,
	"purchase plan page should render candidate product images through the shared image proxy"
);
assert.match(
	source,
	/candidateImageMap/,
	"purchase plan page should batch-load candidate images for plan rows"
);
assert.match(
	source,
	/candidateImages/,
	"purchase plan page should use the purchase-plan candidateImages endpoint"
);
assert.match(
	source,
	/getSamplePurchaseStatus/,
	"purchase plan page should use the local sample purchase status helper"
);
assert.match(source, /"已下单"/, "sample status should include local ordered status");
assert.match(source, /"已采购"/, "sample status should include local purchased status");
assert.match(source, /"已完成"/, "sample status should include local completed status");
assert.match(
	source,
	/markSampleCompleted/,
	"purchase plan page should expose a manual completed operation"
);
assert.match(
	source,
	/ElMessageBox\.confirm/,
	"manual completed operation should ask for confirmation"
);
assert.match(
	source,
	/sampleStatusFilter/,
	"purchase plan page should keep a purchase-status filter state"
);
assert.match(
	source,
	/v-model="sampleStatusFilter"/,
	"purchase plan toolbar should expose a purchase-status select"
);
assert.match(source, /label="已下单"/, "purchase status filter should include ordered option");
assert.match(source, /label="已采购"/, "purchase status filter should include purchased option");
assert.match(source, /label="已完成"/, "purchase status filter should include completed option");
assert.match(
	source,
	/handleSampleStatusFilterChange/,
	"changing the purchase-status filter should refresh the list"
);
assert.match(
	source,
	/sampleStatus:\s*sampleStatusFilter\.value/,
	"purchase plan page should send the selected sample status to the backend"
);
assert.match(
	source,
	/url:\s*"\/samplePage"/,
	"purchase plan page should use the backend samplePage endpoint for status-aware pagination"
);
assert.doesNotMatch(
	source,
	/s\.status_text\s*\|\|\s*s\.status/,
	"purchase status column should not display Lingxing order status text"
);

assert.match(entitySource, /sample_status/, "purchase plan entity should store sample status");
assert.match(
	entitySource,
	/sample_completed_time/,
	"purchase plan entity should store manual completed time"
);
assert.match(
	entitySource,
	/sample_completed_by_name/,
	"purchase plan entity should store manual completed operator"
);
assert.match(
	controllerSource,
	/markSampleCompleted/,
	"purchase plan controller should expose manual completed endpoint"
);
assert.match(
	controllerSource,
	/candidateImages/,
	"purchase plan controller should expose candidate image batch endpoint"
);
assert.match(
	controllerSource,
	/samplePage/,
	"purchase plan controller should expose a samplePage endpoint"
);
assert.match(
	controllerSource,
	/normalizeSampleStatusFilter/,
	"purchase plan controller should normalize the sample status filter"
);
assert.match(
	controllerSource,
	/EXISTS\s*\(\s*SELECT 1 FROM/,
	"samplePage should filter purchased/ordered status using purchase-order existence"
);
assert.match(
	migrationSource,
	/sample_status/,
	"sample status migration should add sample_status column"
);

export const meta = {
  name: 'product-line-toggle',
  description: '品线选品 郑总/选品模式切换',
  phases: [
    { title: 'Backend', detail: 'Java DTO + Mapper + Controller' },
    { title: 'Frontend', detail: 'API + Store + 切换按钮' },
  ],
}

phase('Backend')
const be = await agent(
  "Modify 3 Java files for the \"all-categories\" endpoint.\n\n" +
  "1. F:/项目/si-jue-zhi-mao-up/java-backend/sjzm-product/src/main/java/com/sjzm/product/dto/CompetitorQueryRequest.java\n" +
  "Add fields:\n" +
  "  private String bsrId;\n" +
  "  private Integer nodeId;\n\n" +
  "2. F:/项目/si-jue-zhi-mao-up/java-backend/sjzm-product/src/main/java/com/sjzm/product/mapper/CompetitorProductMapper.java\n" +
  "Add 2 new query methods:\n\n" +
  "  @Select(\"SELECT bsr_id AS bsrId, COUNT(*) AS productCount\" +\n" +
  "          \" FROM competitor_products\" +\n" +
  "          \" WHERE marketplace = #{marketplace} AND month = #{month}\" +\n" +
  "          \" GROUP BY bsr_id\" +\n" +
  "          \" ORDER BY productCount DESC\")\n" +
  "  List<Map<String, Object>> countByBsrId(@Param(\"marketplace\") String marketplace, @Param(\"month\") String month);\n\n" +
  "  @Select(\"SELECT bsr_id AS bsrId, node_id AS nodeId,\" +\n" +
  "          \" MAX(node_label_path) AS nodeFullPath,\" +\n" +
  "          \" SUBSTRING_INDEX(MAX(node_label_path), ':', -1) AS nodeName,\" +\n" +
  "          \" COUNT(*) AS productCount\" +\n" +
  "          \" FROM competitor_products\" +\n" +
  "          \" WHERE marketplace = #{marketplace} AND month = #{month}\" +\n" +
  "          \" GROUP BY bsr_id, node_id\" +\n" +
  "          \" ORDER BY bsr_id, productCount DESC\")\n" +
  "  List<Map<String, Object>> countByNodeId(@Param(\"marketplace\") String marketplace, @Param(\"month\") String month);\n\n" +
  "Add needed imports for Map, List, Param, Select.\n\n" +
  "3. F:/项目/si-jue-zhi-mao-up/java-backend/sjzm-product/src/main/java/com/sjzm/product/controller/ProductLineController.java\n" +
  "If the file does NOT exist yet, create it. If it exists, add to it.\n" +
  "Add a new endpoint:\n\n" +
  "@GetMapping(\"/all-categories\")\n" +
  "@Operation(summary = \"获取全部品类（选品模式用）\")\n" +
  "public Result<Map<String, Object>> getAllCategories(\n" +
  "    @RequestParam(defaultValue = \"UK\") String marketplace,\n" +
  "    @RequestParam String month) {\n" +
  "  // 1. Fetch L2 stats from competitor_products\n" +
  "  List<Map<String, Object>> l2Rows = competitorProductMapper.countByNodeId(marketplace, month);\n" +
  "  // 2. Fetch Zheng's bsrId set from deng_zong_shop\n" +
  "  Set<String> zhengBsrIds = competitorProductMapper.selectDistinctBsrIdByMarketplace(marketplace);\n" +
  "  // 3. Group by bsrId, sort: Zheng first, then by productCount desc\n" +
  "  // 4. Return productLines format\n" +
  "  return Result.success(buildProductLines(l2Rows, zhengBsrIds));\n" +
  "}\n\n" +
  "Also add a private helper method buildProductLines() that:\n" +
  "- Groups L2 rows by bsrId\n" +
  "- Computes productCount = sum of L2 counts\n" +
  "- Sorts: zhengBsrIds first, then productCount desc\n" +
  "- Sets bsrName = first segment of first child's nodeFullPath\n" +
  "- Returns Map with key \"productLines\" containing the list\n\n" +
  "Also add selectDistinctBsrIdByMarketplace to the mapper:\n" +
  "  @Select(\"SELECT DISTINCT bsr_id FROM competitor_products WHERE marketplace = #{marketplace}\")\n" +
  "  Set<String> selectDistinctBsrIdByMarketplace(@Param(\"marketplace\") String marketplace);\n\n" +
  "Inject CompetitorProductMapper via constructor.\n" +
  "Add needed imports: Map, HashMap, List, ArrayList, Set, HashSet.\n" +
  "The class-level @RequestMapping should be \"/api/v1/product-line\".\n" +
  "If the file already exists and has methods, just ADD the new ones.\n" +
  "Make minimal, precise edits. Do NOT change anything else.",
  { label: 'backend-java', phase: 'Backend' }
)

phase('Frontend')
const fe = await agent(
  "Modify 3 frontend files for the selection mode toggle.\n\n" +
  "1. F:/项目/si-jue-zhi-mao-up/frontend/src/api/product-line.ts\n" +
  "Add a new exported function:\n\n" +
  "export function getAllCategories(marketplace: string, month: string) {\n" +
  "  return request({\n" +
  "    url: '/api/v1/product-line/all-categories',\n" +
  "    method: 'get',\n" +
  "    params: { marketplace, month }\n" +
  "  })\n" +
  "}\n\n" +
  "Import request from @/utils/request if not already imported.\n\n" +
  "2. F:/项目/si-jue-zhi-mao-up/frontend/src/modules/product-line-selection/store.ts\n\n" +
  "(a) Import getAllCategories:\n" +
  "Add to the import from @/api/product-line: add getAllCategories to the destructured imports.\n\n" +
  "(b) After 'const sortBy = ref(\"\")' line, add:\n" +
  "  type DataSource = 'zheng' | 'selection'\n" +
  "  const dataSource = ref<DataSource>('zheng')\n\n" +
  "(c) After clearBasicFilters function, add setDataSource:\n" +
  "  function setDataSource(source: DataSource) {\n" +
  "    dataSource.value = source\n" +
  "    clearFilters()\n" +
  "    clearBasicFilters()\n" +
  "    selectedProducts.value = new Set()\n" +
  "    competitorPage.value = 1\n" +
  "    searchKeyword.value = ''\n" +
  "    selectedBsrId.value = ''\n" +
  "    selectedBsrName.value = ''\n" +
  "    selectedNodeId.value = ''\n" +
  "    selectedNodeName.value = ''\n" +
  "    competitorResults.value = []\n" +
  "    modelData.value = null\n" +
  "    initData()\n" +
  "  }\n\n" +
  "(d) In fetchTree(): change the API call to:\n" +
  "    const res = dataSource.value === 'zheng'\n" +
  "      ? await getAggregatedData(mkp, mo)\n" +
  "      : await getAllCategories(mkp, mo)\n\n" +
  "(e) In loadProducts() (~line 215): change the API call to:\n" +
  "    const res = dataSource.value === 'zheng'\n" +
  "      ? await competitorApi.getDengZongShopList(params)\n" +
  "      : await competitorApi.getList(params)\n\n" +
  "(f) In the return block at the bottom of the store, add:\n" +
  "    dataSource,\n" +
  "    setDataSource,\n\n" +
  "3. F:/项目/si-jue-zhi-mao-up/frontend/src/modules/product-line-selection/index.vue\n" +
  "Find the area around the batch selector / search toolbar (top of the page).\n" +
  "Add a toggle button group:\n\n" +
  "<el-radio-group\n" +
  "  :model-value=\"store.dataSource\"\n" +
  "  size=\"small\"\n" +
  "  style=\"margin-left: 8px\"\n" +
  "  @change=\"(val: any) => store.setDataSource(val)\"\n" +
  ">\n" +
  "  <el-radio-button value=\"zheng\">雷总</el-radio-button>\n" +
  "  <el-radio-button value=\"selection\">选品</el-radio-button>\n" +
  "</el-radio-group>\n\n" +
  "Place it near the existing toolbar controls. Dont change anything else.\n\n" +
  "Make minimal, precise edits. Preserve all existing code.",
  { label: 'frontend-vue', phase: 'Frontend' }
)

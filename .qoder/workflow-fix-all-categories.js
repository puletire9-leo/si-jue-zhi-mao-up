export const meta = {
  name: 'fix-all-categories-bugs',
  description: '修复 all-categories 的 4 个 bug',
  phases: [
    { title: 'Mapper', detail: 'DengZongShopMapper 新增复合键查询' },
    { title: 'Controller', detail: 'ProductLineController 全量修复' },
  ],
}

phase('Mapper')
const mapper = await agent(
  "Modify F:/项目/si-jue-zhi-mao-up/java-backend/sjzm-product/src/main/java/com/sjzm/product/mapper/DengZongShopMapper.java\n\n" +
  "Add a new query method:\n\n" +
  "@Select(\"SELECT DISTINCT CONCAT(bsr_id, '_', node_id) AS composite_key \" +\n" +
  "        \"FROM deng_zong_shop \" +\n" +
  "        \"WHERE marketplace = #{marketplace} AND month = #{month} \" +\n" +
  "        \"AND bsr_id IS NOT NULL AND node_id IS NOT NULL\")\n" +
  "Set<String> selectZhengCompositeKeys(@Param(\"marketplace\") String marketplace, @Param(\"month\") String month);\n\n" +
  "Add import: import java.util.Set; at the top if not already present.\n" +
  "Make minimal, precise edits. Do NOT change anything else.",
  { label: 'add-mapper-method', phase: 'Mapper' }
)

phase('Controller')
const ctrl = await agent(
  "Rewrite the getAllCategories and buildProductLines section of ProductLineController.java.\n\n" +
  "File: F:/项目/si-jue-zhi-mao-up/java-backend/sjzm-product/src/main/java/com/sjzm/product/controller/ProductLineController.java\n\n" +
  "Changes needed:\n\n" +
  "1. Inject DengZongShopMapper (add as a new final field + constructor param)\n" +
  "   - Add at top: private final DengZongShopMapper dengZongShopMapper;\n" +
  "   - Modify the @RequiredArgsConstructor constructor to include it\n\n" +
  "2. Rewrite getAllCategories():\n" +
  "  @GetMapping(\"/all-categories\")\n" +
  "  @Operation(summary = \"获取全部品类（选品模式用）\")\n" +
  "  public Result<Map<String, Object>> getAllCategories(\n" +
  "      @RequestParam(defaultValue = \"UK\") String marketplace,\n" +
  "      @RequestParam String month) {\n" +
  "    List<Map<String, Object>> l2Rows = competitorProductMapper.countByNodeId(marketplace, month);\n" +
  "    Set<String> zhengKeys = dengZongShopMapper.selectZhengCompositeKeys(marketplace, month);\n" +
  "    return Result.success(buildProductLines(l2Rows, zhengKeys));\n" +
  "  }\n\n" +
  "3. Rewrite buildProductLines(l2Rows, zhengKeys):\n" +
  "  - Filter null bsrId rows\n" +
  "  - Group by bsrId\n" +
  "  - For each group, sort L2 children by zheng priority then productCount desc\n" +
  "  - Use \"subCategories\" instead of \"children\" as the key\n" +
  "  - L1 lines also sorted by zheng priority then productCount desc\n" +
  "  - Handle null nodeFullPath safely (use COALESCE or extractBsrName helper)\n\n" +
  "4. Add extractBsrName helper:\n" +
  "  private String extractBsrName(List<Map<String, Object>> children) {\n" +
  "    for (Map<String, Object> c : children) {\n" +
  "      String path = (String) c.get(\"nodeFullPath\");\n" +
  "      if (path != null && !path.isEmpty()) {\n" +
  "        return path.split(\":\")[0];\n" +
  "      }\n" +
  "    }\n" +
  "    return \"\";\n" +
  "  }\n\n" +
  "5. Add imports:\n" +
  "  import com.sjzm.product.mapper.DengZongShopMapper;\n" +
  "  import java.util.LinkedHashMap;\n" +
  "  import java.util.stream.Collectors;\n\n" +
  "Read the existing file first to understand its current structure.\n" +
  "Minimal changes, preserve all existing code.",
  { label: 'fix-controller', phase: 'Controller' }
)

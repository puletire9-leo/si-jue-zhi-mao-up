export const meta = {
  name: 'add-iszheng-markers',
  description: '后端 isZheng + 前端 badge 显示',
  phases: [
    { title: 'Backend', detail: 'ProductLineController isZheng' },
    { title: 'Types', detail: 'productLine.ts 类型' },
    { title: 'Store', detail: 'store.ts 透传' },
    { title: 'UI', detail: 'index.vue + ProductLineTree badge' },
  ],
}

phase('Backend')
const be = await agent(
  "Modify ProductLineController.java buildProductLines() to add isZheng markers.\n\n" +
  "File: F:/项目/si-jue-zhi-mao-up/java-backend/sjzm-product/src/main/java/com/sjzm/product/controller/ProductLineController.java\n\n" +
  "In buildProductLines(), after the L2 children.sort(...) block (after sorting is done), add:\n" +
  "  children.forEach(child ->\n" +
  "    child.put(\"isZheng\", zhengKeys.contains(bsrId + \"_\" + child.get(\"nodeId\"))));\n\n" +
  "And when building the L1 line Map, add:\n" +
  "  boolean lineIsZheng = hasZhengChild(bsrId, children, zhengKeys);\n" +
  "  line.put(\"isZheng\", lineIsZheng);\n\n" +
  "The L2 forEach should be right after the children.sort() and before totalCount/totalProducts calculation, so both L1 and L2 have isZheng set.\n\n" +
  "Make minimal, precise edits. Read the file first.",
  { label: 'backend-iszheng', phase: 'Backend' }
)

phase('Types')
const types = await agent(
  "Modify type definitions to add isZheng field.\n\n" +
  "File: F:/项目/si-jue-zhi-mao-up/frontend/src/types/productLine.ts\n\n" +
  "1. Find the SubCategoryNode interface (or similar - look for an interface with nodeId, nodeName, nodeFullPath, productCount).\n" +
  "   Add: isZheng?: boolean\n\n" +
  "2. Find the ProductLineGroup interface (or similar - look for an interface with bsrId, bsrName, subCategories).\n" +
  "   Add: isZheng?: boolean\n\n" +
  "Read the file first to find exact interface names and positions. Make minimal edits.",
  { label: 'types-iszheng', phase: 'Types' }
)

phase('Store')
const store = await agent(
  "Modify store.ts to pass through isZheng in fetchTree().\n\n" +
  "File: F:/项目/si-jue-zhi-mao-up/frontend/src/modules/product-line-selection/store.ts\n\n" +
  "In the fetchTree() function, find the treeData.value = raw.map(...) block.\n" +
  "Add isZheng passthrough for both L1 and L2:\n" +
  "- In the L1 return object, add: isZheng: g.isZheng,\n" +
  "- In the L2 children mapping, add: isZheng: sc.isZheng,\n\n" +
  "Also check the TreeGroup/TreeNode type definition (might be in types/productLine.ts or local) to see if isZheng needs to be added there too.\n" +
  "If there's a local TreeNode type definition in store.ts or types, add isZheng there too.\n\n" +
  "Read the file first. Make minimal edits.",
  { label: 'store-iszheng', phase: 'Store' }
)

phase('UI')
const ui = await agent(
  "Make 3 changes to frontend Vue files:\n\n" +
  "### 1. Fix button text in index.vue\n" +
  "File: F:/项目/si-jue-zhi-mao-up/frontend/src/modules/product-line-selection/index.vue\n" +
  "Change: <el-radio-button value=\"zheng\">雷总</el-radio-button>\n" +
  "To:    <el-radio-button value=\"zheng\">郑总</el-radio-button>\n\n" +
  "### 2. Add L2 zheng badge in index.vue\n" +
  "Find the L2 subcategory list rendering (looking for v-for with SubCategoryItem or similar, around where cat.name / cat.productCount are displayed).\n" +
  "After the <span class=\"l2-item-name\">{{ cat.name }}</span> element, add:\n" +
  "  <span v-if=\"cat.isZheng && store.dataSource === 'selection'\" class=\"l2-zheng-tag\">郑总</span>\n\n" +
  "### 3. Add L1 zheng badge in ProductLineTree.vue\n" +
  "File: F:/项目/si-jue-zhi-mao-up/frontend/src/modules/product-line-selection/components/ProductLineTree.vue\n" +
  "Find the L1 name display (look for l1-name class or similar).\n" +
  "After the <span class=\"l1-name\">{{ group.name }}</span> element, add:\n" +
  "  <span v-if=\"group.isZheng && store.dataSource === 'selection'\" class=\"zheng-badge\">郑总店铺</span>\n\n" +
  "### 4. Add SCSS styles for the badges\n" +
  "In index.vue's scoped SCSS, add:\n" +
  ".l2-zheng-tag {\n" +
  "  font-size: 10px;\n" +
  "  background: #e6f7ff;\n" +
  "  color: #1890ff;\n" +
  "  border: 1px solid #91d5ff;\n" +
  "  border-radius: 3px;\n" +
  "  padding: 0 4px;\n" +
  "  margin-left: 4px;\n" +
  "  white-space: nowrap;\n" +
  "  flex-shrink: 0;\n" +
  "}\n\n" +
  "In ProductLineTree.vue's scoped SCSS, add:\n" +
  ".zheng-badge {\n" +
  "  font-size: 10px;\n" +
  "  background: #e6f7ff;\n" +
  "  color: #1890ff;\n" +
  "  border: 1px solid #91d5ff;\n" +
  "  border-radius: 3px;\n" +
  "  padding: 0 5px;\n" +
  "  margin-left: 4px;\n" +
  "  white-space: nowrap;\n" +
  "  flex-shrink: 0;\n" +
  "}\n\n" +
  "Make minimal, precise edits. Read each file first.",
  { label: 'ui-badges', phase: 'UI' }
)

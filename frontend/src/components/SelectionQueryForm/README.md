# SelectionQueryForm

`SelectionQueryForm` 是选品相关页面共用的查询表单组件。

当前真实实现已经支持两种接法：

1. 推荐：受控接法，由页面维护唯一查询状态源
2. 兼容：`ref` 调用暴露方法，供旧页面过渡使用

## 推荐接法

推荐把页面级查询参数放在父页面，由组件通过 `modelValue` 接收，通过 `update:modelValue` 回传。

```vue
<template>
  <SelectionQueryForm
    page-type="all"
    :model-value="queryParamsState"
    @update:model-value="onQueryFormChange"
    @search="handleSearch"
    @reset="handleReset"
  />
</template>

<script setup lang="ts">
import { ref } from "vue";
import SelectionQueryForm from "@/components/SelectionQueryForm/index.vue";
import type { SelectionQueryParams } from "@/components/SelectionQueryForm/types";

const queryParamsState = ref<Partial<SelectionQueryParams>>({});

const onQueryFormChange = (params: SelectionQueryParams) => {
  queryParamsState.value = { ...params };
};

const handleSearch = (params: SelectionQueryParams) => {
  queryParamsState.value = { ...params };
  // 进入页面统一查询链路：
  // buildSelectionFilterIntent -> buildSelectionQueryPlan -> resolveSelectionQueryPlan
};

const handleReset = () => {
  queryParamsState.value = {};
};
</script>
```

这种接法的意义：

- 页面拥有唯一查询状态源
- 表单不再偷偷变成接口参数事实来源
- 查询表单、统一筛选条、抽屉筛选可以在同一层收口

## 兼容接法

旧页面如果还没迁移完，可以继续通过 `ref` 调用暴露方法：

```vue
<script setup lang="ts">
import { ref } from "vue";
import SelectionQueryForm from "@/components/SelectionQueryForm/index.vue";

const queryFormRef = ref<InstanceType<typeof SelectionQueryForm>>();

const params = queryFormRef.value?.readQueryParams();

queryFormRef.value?.patchQueryParams({
  country: "UK",
  sellerSelect: "demo-seller",
});

queryFormRef.value?.handleSearch();
</script>
```

兼容别名仍然可用：

- `getQueryParams()` = `readQueryParams()`
- `setQueryParams()` = `patchQueryParams()`

但新接入不再推荐围绕这套 imperative API 组织状态。

## Props

核心 props：

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| `pageType` | `"all" \| "new" \| "reference" \| "recycle"` | 页面预设类型 |
| `modelValue` | `Partial<SelectionQueryParams>` | 受控查询参数 |
| `initialParams` | `Partial<SelectionQueryParams>` | 初始值，通常只用于非受控兼容场景 |
| `categories` | `CategoryItem[]` | 大类选项 |
| `total` | `number` | 总数展示 |
| `title` | `string` | 自定义标题 |

常用显示控制：

- `showCompactMode`
- `showAdvancedSearch`
- `showFilter`
- `hideInlineFilters`
- `showSort`
- `showDateRange`
- `showImageSearch`
- `showTitle`
- `showTotal`

完整类型定义见 [types.ts](</F:/项目/si-jue-zhi-mao-up/frontend/src/components/SelectionQueryForm/types.ts:1>)。

## Emits

| 事件 | 参数 | 说明 |
| --- | --- | --- |
| `update:modelValue` | `SelectionQueryParams` | 表单状态变化时回传规范化参数 |
| `change` | `SelectionQueryParams` | 与 `update:modelValue` 同步触发，便于旧逻辑兼容 |
| `search` | `SelectionQueryParams` | 用户显式触发搜索 |
| `reset` | 无 | 用户显式重置 |
| `imageSearch` | 无 | 用户点击以图搜图 |

说明：

- `search` / `reset` 是用户动作事件
- `update:modelValue` / `change` 是状态同步事件
- 当前组件内部已经统一对外发出规范化后的查询参数

## 暴露方法

| 方法 | 说明 |
| --- | --- |
| `readQueryParams()` | 读取当前规范化后的查询参数 |
| `patchQueryParams(params)` | 合并并同步外部查询参数 |
| `handleSearch()` | 手动触发搜索 |
| `handleReset()` | 手动触发重置 |
| `openAdvancedSearchDialog()` | 打开多项精确搜索弹窗 |

兼容别名：

- `getQueryParams()` -> `readQueryParams()`
- `setQueryParams(params)` -> `patchQueryParams(params)`

## 当前接入约定

在统一筛选链路下，推荐这样分层：

1. `SelectionQueryForm` 只负责采集和回传查询输入
2. 页面负责维护 `queryParamsState`
3. 页面把查询输入和其他筛选输入收口到统一 intent
4. query plan 决定走哪个来源、哪张方法卡链路
5. runtime 负责真正调用接口

## 注意事项

1. `modelValue` 是当前主接法，优先级高于组件内部状态
2. 组件会同步维护日期范围和紧凑搜索的派生展示状态
3. 外部同步 `country + sellerSelect` 时，组件不会再因为国家切换副作用把卖家清空
4. `category` 对外始终按规范化字符串返回

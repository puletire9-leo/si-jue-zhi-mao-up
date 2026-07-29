<template>
  <div
    class="universal-card"
    :class="{ selected: isSelected }"
    @click="handleCardClick"
  >
    <el-checkbox
      v-if="props.selectable"
      v-model="isSelected"
      class="card-checkbox"
      @click.stop
      @change="handleSelect"
    />

    <div class="card-image-wrapper">
      <el-image
        v-if="imageUrl"
        :src="imageUrl"
        :preview="false"
        fit="cover"
        class="card-image"
        lazy
        @click.stop="handleImageClick"
      >
        <template #error>
          <div class="image-slot">
            <el-icon><Picture /></el-icon>
          </div>
        </template>
      </el-image>
      <div v-else class="card-image card-image-empty">
        <el-icon><Picture /></el-icon>
        <span v-if="props.incompleteDataLabel" class="incomplete-data-label">
          {{ props.incompleteDataLabel }}
        </span>
      </div>

      <div
        v-if="showTypeBadge && productType"
        class="card-type-badge"
        :class="productType"
      >
        {{ typeBadgeText }}
      </div>

      <div v-if="showSalesVolume && salesVolume" class="card-sales-badge">
        <el-icon><TrendCharts /></el-icon>
        <span>{{ formatSalesVolume(salesVolume) }}</span>
      </div>

      <!-- 时效标签 -->
      <div v-if="timeTag" class="card-time-tag" :class="timeTagClass">
        {{ timeTag }}
      </div>

      <!-- 一键打开按钮 -->
      <div v-if="props.product.asin" class="card-link-buttons">
        <div
          class="card-link-button open-link"
          @click.stop="handleOpenProductLink"
          title="一键打开"
        >
          <el-icon><Promotion /></el-icon>
          <span class="link-text">一键打开</span>
        </div>
        <div
          v-if="props.showImageSearch"
          class="card-link-button image-search-link"
          @click.stop="handleImageSearch"
          title="以图识图"
        >
          <el-icon><Search /></el-icon>
          <span class="link-text">以图识图</span>
        </div>
      </div>

      <div v-if="showViewButton || props.showDelete" class="card-actions">
        <el-button
          v-if="showViewButton"
          type="primary"
          :icon="View"
          circle
          size="small"
          @click.stop="handleView"
        />
        <el-button
          v-if="props.showDelete"
          type="danger"
          :icon="Delete"
          circle
          size="small"
          @click.stop="handleDelete"
        />
      </div>
    </div>

    <div class="card-content">
      <div v-if="showId" class="card-id" :title="idText">
        {{ idText }}
      </div>
      <div class="card-title" :title="titleText">
        {{ titleText }}
      </div>
      <div v-if="product.variantCount > 1" class="card-variant-badge">
        {{ product.variantCount }} 变体
      </div>

      <div v-if="showMeta" class="card-meta">
        <div v-if="price !== null && price !== undefined" class="meta-item">
          <el-icon class="meta-icon"><Money /></el-icon>
          <span class="meta-value">{{ formattedPrice }}</span>
        </div>
        <div v-if="product.bsr != null" class="meta-item">
          <span class="meta-value meta-bsr">#{{ product.bsr.toLocaleString() }}</span>
        </div>
        <div v-if="storeName" class="meta-item">
          <el-icon class="meta-icon"><Shop /></el-icon>
          <span class="meta-value" :title="storeName">{{ storeName }}</span>
        </div>
        <div v-if="category" class="meta-item">
          <el-icon class="meta-icon"><Folder /></el-icon>
          <span class="meta-value">{{ category }}</span>
        </div>
      </div>

      <div v-if="showTags && tags && tags.length > 0" class="card-tags">
        <el-tag
          v-for="(tag, index) in visibleTags"
          :key="index"
          size="small"
          type="info"
          effect="plain"
        >
          {{ tag }}
        </el-tag>
        <el-tag
          v-if="extraTagsCount > 0"
          size="small"
          type="info"
          effect="plain"
        >
          +{{ extraTagsCount }}
        </el-tag>
      </div>

      <div v-if="showTypeTag && typeTagText" class="card-type-tag">
        <el-tag :type="typeTagType" size="small">
          {{ typeTagText }}
        </el-tag>
      </div>

      <!--
        卡片底部并排展示两条时间, 让数据错位直接摆在明面上:
        · 上架亚马逊(available_date) + 实时天数(今天 - available_date)
        · 入库时间(created_at)         — 这条数据行进本地 DB 的时间
        两者不同天时说明产品早于我们导入,数值差异一眼可见。
      -->
      <div
        v-if="props.mode === 'selection' && (listingInfo.text || createTime)"
        class="card-footer"
      >
        <span v-if="listingInfo.text" class="footer-line">
          上架 <strong>{{ listingInfo.text }}</strong>
          <em v-if="listingInfo.days !== null" class="footer-days">
            · {{ listingInfo.days }} 天
          </em>
        </span>
        <span v-if="createTime" class="footer-line footer-created">
          入库 <strong>{{ createTime }}</strong>
        </span>
      </div>
      <div v-else-if="showCreateTime && createTime" class="card-footer">
        <span class="footer-line">
          {{ formatCreateTime(createTime) }}
        </span>
      </div>
    </div>

    <div
      v-if="props.selectable"
      class="card-select-bar"
      :class="{ selected: props.isSelectedByMe }"
      @click.stop="handleSelectProduct"
    >
      <el-icon :size="18"><Select /></el-icon>
      <span>{{ props.isSelectedByMe ? "已选中" : "选中此产品" }}</span>
    </div>
    <div
      v-if="props.selectable && props.selectedByUsers && props.selectedByUsers.length > 0"
      class="card-select-users"
    >
      <el-icon :size="12"><Select /></el-icon>
      <span class="select-users-text">{{ selectedByUsersText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import {
  Picture,
  Money,
  Shop,
  Folder,
  View,
  Delete,
  TrendCharts,
  Select,
  Promotion,
  Search,
} from "@element-plus/icons-vue";
import { buildAmazonImageSearchUrl } from "@/utils/amazonImageSearch";
import { trackClick } from "@/api/clickLog";
import { getProductType } from "@/api/competitor";
import { formatDetailMoney } from "@/components/ProductDetailDialog/productDetail";

interface Props {
  product: Record<string, any>;
  selected?: boolean;
  mode?: "product" | "selection";
  isSelectedByMe?: boolean;
  selectedByUsers?: { userId: number; userName: string }[];
  /** 是否展示选择框与“选中此产品”操作栏。 */
  selectable?: boolean;
  /** 是否展示删除操作；只读商品来源必须关闭。 */
  showDelete?: boolean;
  /** 是否展示以图识图入口。 */
  showImageSearch?: boolean;
  /** 是否显示 S/A/B/C/D 品级徽章（老品级系统，默认关闭，不干扰视线） */
  showGrade?: boolean;
  /** 数据源只有原始空壳时显示的明确状态，避免把缺图误解为图片加载失败。 */
  incompleteDataLabel?: string;
}

interface Emits {
  (e: "click", product: Record<string, any>): void;
  (e: "select", id: string | number, selected: boolean): void;
  (e: "toggle-select", asin: string, selected: boolean): void;
  (e: "delete", product: Record<string, any>): void;
  (e: "view", product: Record<string, any>): void;
  (e: "image-search", product: Record<string, any>): void;
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
  mode: "product",
  isSelectedByMe: false,
  selectedByUsers: () => [],
  selectable: true,
  showDelete: true,
  showImageSearch: true,
  showGrade: false,
  incompleteDataLabel: "",
});

const emit = defineEmits<Emits>();

const isSelected = ref<boolean>(props.selected);

watch(
  () => props.selected,
  (newVal: boolean) => {
    isSelected.value = newVal;
  },
);

const modeConfig = computed(() => {
  if (props.mode === "selection") {
    return {
      showId: true,
      idField: "asin",
      showTitle: true,
      titleField: "productTitle",
      showMeta: true,
      showTags: true,
      showTypeBadge: true,
      typeField: "productType",
      showTypeTag: false,
      showCreateTime: true,
      showViewButton: true,
      showSalesVolume: true,
    };
  }
  return {
    showId: true,
    idField: "sku",
    showTitle: true,
    titleField: "name",
    showMeta: false,
    showTags: false,
    showTypeBadge: false,
    typeField: null,
    showTypeTag: true,
    showCreateTime: false,
    showViewButton: false,
    showSalesVolume: false,
  };
});

const showId = computed(() => modeConfig.value.showId);
const idText = computed(() => props.product[modeConfig.value.idField] || "");
const showTitle = computed(() => modeConfig.value.showTitle);
const titleText = computed(() => {
  const field = modeConfig.value.titleField;
  return (
    props.product[field] ||
    props.product["title"] ||
    props.product["productTitle"] ||
    ""
  );
});
const showMeta = computed(() => modeConfig.value.showMeta);
const price = computed(() => props.product.price);
const formattedPrice = computed(() =>
  formatDetailMoney(
    price.value,
    props.product.marketplace || props.product.country,
    props.product.symbol,
  ),
);
const storeName = computed(
  () => props.product.storeName || props.product.sellerName || "",
);
const category = computed(
  () => props.product.mainCategoryName || props.product.category,
);
const showTags = computed(() => modeConfig.value.showTags);
const tags = computed(() => props.product.tags);
const productType = computed(() => {
  const raw = props.product[modeConfig.value.typeField];
  if (raw) return raw;
  return getProductType(props.product.source || "");
});
const typeBadgeText = computed(() => {
  if (props.mode === "selection") {
    const pt = productType.value || props.product.productType;
    if (pt === "new") return "新品";
    if (pt === "zheng") return "非标";
    if (pt === "shop") return "店铺";
    return "竞品";
  }
  return "";
});
const showTypeBadge = computed(() => modeConfig.value.showTypeBadge);
const typeTagText = computed(() => props.product.type || "");
const showTypeTag = computed(() => modeConfig.value.showTypeTag);
const showCreateTime = computed(() => modeConfig.value.showCreateTime);
const createTime = computed(
  () => props.product.createdAt || props.product.created_at,
);
const showViewButton = computed(() => modeConfig.value.showViewButton);
const showSalesVolume = computed(() => modeConfig.value.showSalesVolume);
const salesVolume = computed(
  () => props.product.salesVolume ?? props.product.units ?? 0,
);
const productLink = computed(() => {
  const raw = props.product.productLink || props.product.productUrl || "";
  if (raw) return raw;
  // 从 ASIN + 站点生成 Amazon 链接
  const asin = props.product.asin;
  const mkp = String(
    props.product.marketplace || props.product.country || "",
  ).toUpperCase();
  if (asin && mkp) {
    const domains: Record<string, string> = {
      US: "www.amazon.com",
      UK: "www.amazon.co.uk",
      DE: "www.amazon.de",
      CA: "www.amazon.ca",
      JP: "www.amazon.co.jp",
      FR: "www.amazon.fr",
      IT: "www.amazon.it",
      ES: "www.amazon.es",
    };
    return `https://${domains[mkp] || "www.amazon.com"}/dp/${asin}`;
  }
  return "";
});

// 懒计算：仅在点击"一键打开"时构造 Amazon 以图搜索 URL。
// 原为 computed，会在每张卡挂载/更新时都跑一遍 buildAmazonImageSearchUrl，
// 卡片流一页数十张时累积成明显开销，改为按需调用。
const resolveSimilarProductsLink = (): string => {
  const sourceImage = props.product.imageUrl || props.product.image || "";
  const marketplace = props.product.marketplace || props.product.country || "UK";
  return (
    buildAmazonImageSearchUrl(sourceImage, marketplace) ||
    props.product.similarProducts ||
    props.product.similarUrl ||
    ""
  );
};

const visibleTags = computed(() => (props.product.tags || []).slice(0, 3));
const extraTagsCount = computed(() =>
  Math.max(0, (props.product.tags || []).length - 3),
);

const selectedByUsersText = computed(() =>
  (props.selectedByUsers || []).map((u: any) => u.userName).join("、"),
);

/**
 * 上架信息：把 available_date 解析成 {text, days}。
 * text 是 yyyy-M-d 显示串; days 是实时天数(今天-上架日), null 表示日期解析失败。
 * 卡片底部与 createTime(入库时间)并列展示, 让两个日期错位一眼可见。
 */
const listingInfo = computed<{ text: string; days: number | null }>(() => {
  const raw = props.product.listingDate || props.product.availableDate;
  if (raw === null || raw === undefined || raw === "") {
    return { text: "", days: null };
  }
  const val = typeof raw === "string" ? raw.trim() : raw;
  const isEpochMs =
    typeof val === "number" ||
    (typeof val === "string" && /^\d{10,}$/.test(val));
  const date = isEpochMs ? new Date(Number(val)) : new Date(raw);
  const text = formatListingDate(raw);
  if (!text || Number.isNaN(date.getTime())) {
    return { text, days: null };
  }
  const days = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 86400000),
  );
  return { text, days };
});

// 时效标签：根据 created_at/createdAt 判断
const timeTag = computed(() => {
  // 兼容后端返回的 created_at 和前端使用的 createdAt
  const createdAt = props.product.createdAt || props.product.created_at;
  if (!createdAt) return null;

  const now = new Date();
  const created = new Date(createdAt);

  // 调试信息（开发时使用）
  // FIXED: MED-9 — 删除遗留 console.log

  // 计算本周一（ISO 周，周一开始）
  const dayOfWeek = now.getDay() || 7; // 周日=7
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1);
  monday.setHours(0, 0, 0, 0);

  if (created >= monday) {
    return "本周入库";
  }

  // 计算天数差
  const diffDays = Math.floor(
    (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays > 30) {
    return "过时";
  } else if (diffDays > 7) {
    return `${diffDays}天前`;
  } else if (diffDays > 0) {
    return `${diffDays}天前`;
  } else {
    return "今天";
  }
});

const timeTagClass = computed(() => {
  const tag = timeTag.value;
  if (tag === "本周入库" || tag === "今天") return "time-current";
  if (tag === "过时") return "time-outdated";
  return "time-normal";
});

const imageUrl = computed((): string => {
  // 优先显示参考图
  const referenceImages =
    props.product.reference_images || props.product.referenceImages || [];
  if (Array.isArray(referenceImages) && referenceImages.length > 0) {
    return referenceImages[0];
  }

  // 检查单个参考图字段
  if (props.product.referenceImage) {
    return props.product.referenceImage;
  }

  // 原有的图片显示逻辑
  if (props.product.thumbPath) {
    return `/images/${props.product.thumbPath}`;
  }
  if (props.product.localPath) {
    return `/images/${props.product.localPath}`;
  }
  if (props.product.imageUrl) {
    return props.product.imageUrl;
  }
  if (props.product.image) {
    return props.product.image;
  }
  return "";
});

const formatCreateTime = (dateString: string): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes < 1 ? "刚刚" : `${minutes}分钟前`;
    }
    return `${hours}小时前`;
  } else if (days < 7) {
    return `${days}天前`;
  } else {
    return date.toLocaleDateString("zh-CN");
  }
};

const formatListingDate = (dateValue: string | number): string => {
  if (dateValue === null || dateValue === undefined || dateValue === "")
    return "";
  // available_date 是毫秒时间戳（bigint），JSON 里可能是数字或纯数字字符串。
  const raw = typeof dateValue === "string" ? dateValue.trim() : dateValue;
  const isEpochMs =
    typeof raw === "number" ||
    (typeof raw === "string" && /^\d{10,}$/.test(raw));
  const date = isEpochMs ? new Date(Number(raw)) : new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("zh-CN");
};

const formatSalesVolume = (volume: number | null | undefined): string => {
  if (!volume) return "0";
  if (volume >= 10000) {
    return `${(volume / 10000).toFixed(1)}万`;
  }
  return volume.toString();
};

const typeTagType = computed(
  (): "primary" | "success" | "warning" | "info" | "danger" => {
    const type = props.product.type;
    if (type === "普通产品") return "info";
    if (type === "组合产品") return "warning";
    if (type === "定制产品") return "success";
    return "info";
  },
);

const getTrackParams = (action: "click" | "select") => ({
  asin: props.product.asin || "",
  marketplace: props.product.marketplace || "",
  source:
    props.product.source ||
    (
      { new: "新品榜", reference: "竞品", zheng: "非标店铺" } as Record<
        string,
        string
      >
    )[productType.value] ||
    "未知来源",
  action,
  productTitle: titleText.value || props.product.title || "",
});

const handleClick = (): void => {
  emit("click", props.product);
};

const handleSelect = (value: any): void => {
  const id = props.product[modeConfig.value.idField];
  emit("select", id, !!value);
};

const handleCardClick = (): void => {
  trackClick(getTrackParams("click"));
  emit("click", props.product);
};

const handleImageClick = (): void => {
  trackClick(getTrackParams("click"));
  emit("click", props.product);
};

const handleSelectProduct = (): void => {
  const asin = props.product.asin || "";
  const newState = !props.isSelectedByMe;
  emit("toggle-select", asin, newState);
};

const handleView = (): void => {
  emit("view", props.product);
};

const handleDelete = (): void => {
  emit("delete", props.product);
};

const handleOpenProductLink = (): void => {
  // 打开商品链接
  if (productLink.value) {
    window.open(productLink.value, "_blank");
  }
  // 同时打开所有相似链接
  const raw = resolveSimilarProductsLink();
  if (raw) {
    raw
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((url) => {
        window.open(url, "_blank");
      });
  }
};

const handleImageSearch = (): void => {
  emit("image-search", props.product);
};
</script>

<style scoped lang="scss">
.universal-card {
  position: relative;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  display: flex;
  flex-direction: column;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 16px -4px rgba(0, 0, 0, 0.1);
    border-color: #3b82f6;
    will-change: transform;
  }

  &.selected {
    border: 2px solid #2563eb;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
  }
}

.card-checkbox {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
}

.card-image-wrapper {
  position: relative;
  width: 100%;
  padding-top: 100%;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  overflow: hidden;

  .card-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    transition: transform 0.3s ease;
  }

  .card-image-empty {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: #94a3b8;

    .el-icon {
      font-size: 42px;
    }

    .incomplete-data-label {
      max-width: 80%;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(245, 158, 11, 0.12);
      color: #b45309;
      font-size: 12px;
      font-weight: 600;
      text-align: center;
    }
  }

  &:hover .card-image {
    transform: scale(1.05);
  }

  .image-slot {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 48px;
    color: #cbd5e1;
  }

  .card-type-badge {
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    color: #fff;

    &.new {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    &.zheng {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }

    &.reference {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }

    &.shop {
      background: linear-gradient(135deg, #22c55e 0%, #0ea5e9 100%);
    }
  }

  .card-sales-badge {
    position: absolute;
    bottom: 10px;
    left: 10px;
    padding: 6px 12px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    display: flex;
    align-items: center;
    gap: 4px;
    box-shadow: 0 4px 12px rgba(240, 147, 251, 0.4);
    z-index: 5;

    .el-icon {
      font-size: 14px;
    }

    span {
      font-size: 14px;
    }
  }

  .card-time-tag {
    position: absolute;
    top: 10px;
    left: 75px;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
    color: #fff;
    z-index: 10;
    white-space: nowrap;

    &.time-current {
      background: linear-gradient(135deg, #67c23a, #85ce61);
      box-shadow: 0 2px 6px rgba(103, 194, 58, 0.4);
    }

    &.time-outdated {
      background: linear-gradient(135deg, #909399, #b1b3b8);
      box-shadow: 0 2px 6px rgba(144, 147, 153, 0.4);
    }

    &.time-normal {
      background: linear-gradient(135deg, #409eff, #66b1ff);
      box-shadow: 0 2px 6px rgba(64, 158, 255, 0.4);
    }
  }

  // 链接按钮组容器
  .card-link-buttons {
    position: absolute;
    bottom: 10px;
    right: 10px;
    display: flex;
    flex-direction: row;
    gap: 8px;
    z-index: 5;
  }

  .card-link-button {
    width: auto;
    height: 32px;
    padding: 0 12px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition:
      transform 0.3s ease,
      box-shadow 0.3s ease;
    gap: 4px;

    &:hover {
      transform: scale(1.05);
    }

    .el-icon {
      font-size: 14px;
      color: #fff;
    }

    .link-text {
      font-size: 12px;
      color: #fff;
      font-weight: 500;
      white-space: nowrap;
    }

    // 一键打开按钮样式
    &.open-link {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      box-shadow: 0 4px 12px rgba(240, 147, 251, 0.4);

      &:hover {
        box-shadow: 0 6px 16px rgba(240, 147, 251, 0.5);
      }
    }

    // 以图识图按钮样式
    &.image-search-link {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
      box-shadow: 0 4px 12px rgba(79, 172, 254, 0.4);

      &:hover {
        box-shadow: 0 6px 16px rgba(79, 172, 254, 0.5);
      }
    }
  }

  .card-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    opacity: 0;
    transition: opacity 0.2s ease;
    display: flex;
    gap: 4px;
    z-index: 10;
  }

  &:hover .card-actions {
    opacity: 1;
  }
}

.card-content {
  padding: 12px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-id {
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 40px;
}

.card-variant-badge {
  display: inline-block;
  font-size: 11px;
  color: #409eff;
  background: #ecf5ff;
  border-radius: 4px;
  padding: 2px 6px;
  margin-top: 4px;
}

.card-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;

  .meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #64748b;

    .meta-icon {
      font-size: 14px;
      color: #94a3b8;
    }

    .meta-value {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      &.meta-bsr {
        font-weight: 600;
        color: #409eff;
        font-variant-numeric: tabular-nums;
      }
    }
  }
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.card-type-tag {
  margin-top: auto;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
  margin-top: auto;

  .create-time {
    font-size: 12px;
    color: #94a3b8;
  }
}

.card-select-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 0;
  margin: 0 12px 12px;
  border-radius: 10px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease,
    border 0.2s ease;
  user-select: none;
}
.card-select-bar:hover {
  background: #dbeafe;
  color: #2563eb;
}
.card-select-bar.selected {
  background: #dcfce7;
  color: #16a34a;
  border: 2px solid #86efac;
}
.card-select-bar.selected:hover {
  background: #bbf7d0;
}

.card-select-users {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  margin: 0 12px;
  font-size: 12px;
  color: #16a34a;
  background: #f0fdf4;
  border-radius: 0 0 8px 8px;

  .select-users-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>

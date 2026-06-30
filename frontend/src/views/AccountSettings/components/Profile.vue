<script setup lang="ts">
import { computed } from "vue";
import { useUserStore } from "@/stores/user";

const userStore = useUserStore();

const username = computed(() => userStore.userInfo?.username || "-");
const roles = computed(() => {
  const role = userStore.userInfo?.role || "";
  return role
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
});

const getRoleType = (role: string) => {
  const map: Record<string, string> = {
    管理员: "danger",
    admin: "danger",
    开发: "primary",
    美术: "warning",
    仓库: "success",
    运营: "info",
    采购员: "",
  };
  return map[role] || "";
};
</script>

<template>
  <div class="profile-container">
    <h3 class="page-title">个人信息</h3>

    <el-card class="info-card" shadow="never">
      <el-descriptions :column="1" :colon="false" size="large">
        <el-descriptions-item label="账号">
          <span class="info-value">{{ username }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="角色">
          <template v-if="roles.length">
            <el-tag
              v-for="r in roles"
              :key="r"
              :type="getRoleType(r) as any"
              size="small"
              style="margin-right: 6px"
            >
              {{ r }}
            </el-tag>
          </template>
          <span v-else class="info-value">-</span>
        </el-descriptions-item>
      </el-descriptions>

      <div class="hint">账号和角色由管理员统一维护，如需变更请联系管理员。</div>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.profile-container {
  max-width: 600px;
}

.page-title {
  margin-bottom: 24px;
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
}

.info-card {
  border-radius: 16px;
  border: none;
  box-shadow: 0 2px 12px rgba(180, 83, 9, 0.08);

  :deep(.el-descriptions__label) {
    width: 80px;
    color: #6b7280;
    font-weight: 500;
  }

  :deep(.el-descriptions__content) {
    padding: 14px 0;
  }
}

.info-value {
  font-size: 15px;
  color: #1a1a1a;
  font-weight: 500;
}

.hint {
  margin-top: 16px;
  padding: 10px 14px;
  background: #faf8f5;
  border-radius: 10px;
  border-left: 3px solid #d97706;
  font-size: 13px;
  color: #6b7280;
}

:deep(html.dark) {
  .page-title {
    color: var(--el-text-color-primary);
  }
  .info-card {
    background: var(--el-bg-color-overlay);
  }
  .info-value {
    color: var(--el-text-color-primary);
  }
  .hint {
    background: var(--el-fill-color-lighter);
    color: var(--el-text-color-secondary);
  }
}
</style>

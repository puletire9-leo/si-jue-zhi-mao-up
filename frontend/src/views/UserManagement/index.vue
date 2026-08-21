<template>
  <div class="user-management">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>用户管理</span>
          <div class="header-tools">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索用户名"
              :prefix-icon="Search"
              clearable
              class="search-input"
            />
            <el-button
              v-if="userStore.isAdmin"
              type="primary"
              :icon="Plus"
              @click="handleAdd"
            >
              添加用户
            </el-button>
          </div>
        </div>
      </template>

      <SkeletonWrapper :loading="loading && !hasLoaded" variant="table">
        <el-tabs v-model="activeTab" class="role-tabs">
          <el-tab-pane v-for="tab in tabList" :key="tab.key" :name="tab.key">
            <template #label>
              <span class="tab-label">
                {{ tab.label }}
                <el-badge
                  v-if="tab.count > 0"
                  :value="tab.count"
                  :type="tab.key === activeTab ? 'primary' : 'info'"
                  class="tab-badge"
                />
              </span>
            </template>

            <el-table
              v-loading="refreshing"
              :data="tab.rows"
              style="width: 100%"
              empty-text="暂无匹配用户"
            >
              <el-table-column prop="id" label="ID" width="80" />
              <el-table-column prop="username" label="用户名" />
              <el-table-column prop="role" label="角色" width="180">
                <template #default="{ row }">
                  <el-tag
                    v-for="r in (row.role || '').split(',').filter(Boolean)"
                    :key="r"
                    :type="getRoleType(r.trim())"
                    size="small"
                    style="margin-right: 4px"
                  >
                    {{ normalizeRole(r) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="100">
                <template #default="{ row }">
                  <el-tag
                    :type="row.status === 1 ? 'success' : 'danger'"
                    size="small"
                  >
                    {{ row.status === 1 ? "正常" : "禁用" }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="createdAt" label="创建时间" width="180">
                <template #default="{ row }">
                  {{ formatDate(row.createdAt) }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="260" fixed="right">
                <template #default="{ row }">
                  <el-button
                    v-if="userStore.isAdmin"
                    type="primary"
                    link
                    :icon="Edit"
                    @click="handleEdit(row)"
                  >
                    编辑
                  </el-button>
                  <el-button
                    v-if="userStore.isAdmin"
                    type="warning"
                    link
                    :icon="Key"
                    @click="openResetDialog(row)"
                  >
                    重置密码
                  </el-button>
                  <el-button
                    v-if="userStore.isAdmin"
                    type="danger"
                    link
                    :icon="Delete"
                    @click="handleDelete(row)"
                  >
                    删除
                  </el-button>
                  <span v-else class="no-permission">无权限</span>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </SkeletonWrapper>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑用户' : '添加用户'"
      width="500px"
    >
      <el-form :model="formData" label-width="100px">
        <el-form-item label="用户名" required>
          <el-input v-model="formData.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码" :required="!isEdit">
          <el-input
            v-model="formData.password"
            type="password"
            :placeholder="isEdit ? '留空则不修改密码' : '请输入密码'"
          />
        </el-form-item>
        <el-form-item label="角色" required>
          <el-checkbox-group v-model="roleSelection">
            <el-checkbox
              label="管理员"
              :disabled="
                roleSelection.includes('开发') ||
                roleSelection.includes('美术') ||
                roleSelection.includes('仓库') ||
                roleSelection.includes('运营') ||
                roleSelection.includes('采购员')
              "
            />
            <el-checkbox
              label="开发"
              :disabled="roleSelection.includes('管理员')"
            />
            <el-checkbox
              label="美术"
              :disabled="roleSelection.includes('管理员')"
            />
            <el-checkbox
              label="仓库"
              :disabled="roleSelection.includes('管理员')"
            />
            <el-checkbox
              label="运营"
              :disabled="roleSelection.includes('管理员')"
            />
            <el-checkbox
              label="采购员"
              :disabled="roleSelection.includes('管理员')"
            />
          </el-checkbox-group>
        </el-form-item>
        <el-form-item
          label="是否可登录"
          v-if="!roleSelection.includes('管理员')"
        >
          <el-switch
            v-model="formData.status"
            :active-value="1"
            :inactive-value="0"
            active-text="可登录"
            inactive-text="禁用登录"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false"> 取消 </el-button>
        <el-button type="primary" @click="handleSave"> 保存 </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="resetDialogVisible"
      :title="`重置密码 - ${resetTarget?.username ?? ''}`"
      width="420px"
      :close-on-click-modal="false"
    >
      <el-form :model="resetForm" label-width="90px">
        <el-form-item label="新密码" required>
          <el-input
            v-model="resetForm.newPassword"
            type="password"
            show-password
            placeholder="6 位以上"
            autocomplete="new-password"
          />
        </el-form-item>
        <el-form-item label="确认密码" required>
          <el-input
            v-model="resetForm.confirmPassword"
            type="password"
            show-password
            placeholder="再次输入新密码"
            autocomplete="new-password"
          />
        </el-form-item>
      </el-form>
      <div class="reset-hint">
        重置后该用户将无法用旧密码登录，请提前告知新密码。
      </div>
      <template #footer>
        <el-button @click="resetDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="resetSubmitting"
          @click="submitReset"
        >
          确认重置
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: "Users" });
import { ref, reactive, computed, onMounted } from "vue";
import { Plus, Edit, Delete, Key, Search } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { userApi } from "@/api/user";
import { useUserStore } from "@/stores/user";
import SkeletonWrapper from "@/components/SkeletonWrapper/index.vue";

// 用户状态管理
const userStore = useUserStore();

const userList = ref([]);
const dialogVisible = ref(false);
const loading = ref(true);
const hasLoaded = ref(false);
const refreshing = computed(() => loading.value && hasLoaded.value);
const isEdit = ref(false);

// 搜索 + 分组
const searchKeyword = ref("");
const activeTab = ref("all");

type RoleLabel = "管理员" | "开发" | "美术" | "仓库" | "运营" | "采购员";

const ROLE_ALIASES: Record<string, RoleLabel> = {
  管理员: "管理员",
  ADMIN: "管理员",
  MANAGER: "管理员",
  开发: "开发",
  DEVELOPER: "开发",
  美术: "美术",
  ARTIST: "美术",
  ART_MANAGER: "美术",
  EDITOR: "美术",
  仓库: "仓库",
  WAREHOUSE: "仓库",
  运营: "运营",
  OPERATOR: "运营",
  USER: "运营",
  VIEWER: "运营",
  采购员: "采购员",
  PURCHASER: "采购员",
};

function normalizeRole(role: unknown): string {
  const value = String(role ?? "").trim();
  if (!value) return "";
  return ROLE_ALIASES[value] || ROLE_ALIASES[value.toUpperCase()] || value;
}

// 角色分组定义(顺序即 tab 显示顺序)
const ROLE_TABS: {
  key: string;
  label: string;
  matcher: (u: any) => boolean;
}[] = [
  { key: "all", label: "全部", matcher: () => true },
  {
    key: "管理员",
    label: "管理员",
    matcher: (u) => hasRole(u, "管理员"),
  },
  { key: "开发", label: "开发", matcher: (u) => hasRole(u, "开发") },
  { key: "美术", label: "美术", matcher: (u) => hasRole(u, "美术") },
  { key: "仓库", label: "仓库", matcher: (u) => hasRole(u, "仓库") },
  { key: "运营", label: "运营", matcher: (u) => hasRole(u, "运营") },
  { key: "采购员", label: "采购员", matcher: (u) => hasRole(u, "采购员") },
  { key: "disabled", label: "已禁用", matcher: (u) => u.status !== 1 },
];

// 判断用户是否属于某角色(逗号分隔多角色兼容)
function hasRole(user: any, role: RoleLabel): boolean {
  return (user.role || "")
    .split(",")
    .map((r: string) => normalizeRole(r))
    .includes(role);
}

// 搜索过滤后的用户列表
const filteredUsers = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase();
  if (!kw) return userList.value;
  return userList.value.filter((u: any) =>
    (u.username || "").toLowerCase().includes(kw),
  );
});

// 每个 tab 的用户列表(带 count)
const tabList = computed(() =>
  ROLE_TABS.map((tab) => {
    const rows = filteredUsers.value.filter(tab.matcher);
    return { ...tab, rows, count: rows.length };
  }),
);

const formData = reactive({
  id: null,
  username: "",
  password: "",
  role: "开发", // 提交时的逗号分隔字符串
  status: 1, // 1=启用(可登录), 0=禁用(不可登录)
});

// 多选角色（checkbox 组用数组，提交时转逗号串）
const roleSelection = ref<string[]>(["开发"]);

// 重置密码弹窗
const resetDialogVisible = ref(false);
const resetTarget = ref<{ id: number; username: string } | null>(null);
const resetForm = reactive({ newPassword: "", confirmPassword: "" });
const resetSubmitting = ref(false);

const loadUsers = async () => {
  loading.value = true;
  try {
    // 一次拉全量:分组视图需要看到所有用户,后端上限 1000 已足够
    const response = await userApi.getList({ page: 1, size: 1000 });
    // 添加字段映射，将后端返回的下划线命名转换为驼峰命名
    const users = response.data?.list || [];
    userList.value = users.map((user) => ({
      ...user,
      createdAt: user.createdAt || (user as any).created_at,
    }));
  } catch (error) {
    ElMessage.error("加载用户列表失败");
  } finally {
    hasLoaded.value = true;
    loading.value = false;
  }
};

const handleAdd = () => {
  if (!userStore.isAdmin) {
    ElMessage.warning("只有管理员可以添加用户");
    return;
  }

  isEdit.value = false;
  formData.id = null;
  formData.username = "";
  formData.password = "";
  formData.role = "开发";
  formData.status = 1;
  roleSelection.value = ["开发"];
  dialogVisible.value = true;
};

const handleEdit = (row) => {
  if (!userStore.isAdmin) {
    ElMessage.warning("只有管理员可以编辑用户");
    return;
  }

  isEdit.value = true;
  formData.id = row.id;
  formData.username = row.username;
  formData.password = "";
  formData.role = row.role;
  formData.status = row.status ?? 1;
  // 从逗号分隔还原为数组
  roleSelection.value = (row.role || "")
    .split(",")
    .filter(Boolean)
    .map((s: string) => normalizeRole(s));
  dialogVisible.value = true;
};

const handleSave = async () => {
  if (!userStore.isAdmin) {
    ElMessage.warning("只有管理员可以保存用户信息");
    return;
  }

  if (roleSelection.value.length === 0) {
    ElMessage.warning("请至少选择一个角色");
    return;
  }

  try {
    formData.role = roleSelection.value.join(",");
    // request.ts 拦截器对业务错误(code != 200)也 return res,不抛异常;
    // 必须显式检查 code,否则会误报"创建成功"但数据其实没进库
    const resp: any = isEdit.value
      ? await userApi.update(formData.id, formData)
      : await userApi.create(formData);

    if (resp && resp.code !== 200) {
      ElMessage.error(resp.message || (isEdit.value ? "更新失败" : "创建失败"));
      return;
    }

    ElMessage.success(isEdit.value ? "更新成功" : "创建成功");
    dialogVisible.value = false;
    loadUsers();
  } catch (error) {
    const errorMessage =
      error?.response?.data?.message || error?.message || "保存失败";
    ElMessage.error(errorMessage);
  }
};

const handleDelete = async (row) => {
  if (!userStore.isAdmin) {
    ElMessage.warning("只有管理员可以删除用户");
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除用户 "${row.username}" 吗？`,
      "确认删除",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      },
    );

    await userApi.delete(row.id);
    ElMessage.success("删除成功");
    loadUsers();
  } catch (error) {
    if (error !== "cancel") {
      ElMessage.error("删除失败");
    }
  }
};

const openResetDialog = (row) => {
  if (!userStore.isAdmin) {
    ElMessage.warning("只有管理员可以重置他人密码");
    return;
  }
  resetTarget.value = { id: row.id, username: row.username };
  resetForm.newPassword = "";
  resetForm.confirmPassword = "";
  resetDialogVisible.value = true;
};

const submitReset = async () => {
  if (!resetTarget.value) return;

  if (!resetForm.newPassword) {
    ElMessage.warning("请输入新密码");
    return;
  }
  if (resetForm.newPassword !== resetForm.confirmPassword) {
    ElMessage.warning("两次输入的密码不一致");
    return;
  }

  resetSubmitting.value = true;
  try {
    await userApi.resetPassword(
      String(resetTarget.value.id),
      resetForm.newPassword,
    );
    ElMessage.success(`已重置 ${resetTarget.value.username} 的密码`);
    resetDialogVisible.value = false;
  } catch (err: any) {
    const message = err?.response?.data?.message || err?.message || "重置失败";
    ElMessage.error(message);
  } finally {
    resetSubmitting.value = false;
  }
};

const getRoleType = (role) => {
  const roleTypes = {
    管理员: "danger",
    开发: "primary",
    美术: "warning",
    仓库: "success",
    运营: "info",
    采购员: "",
  };
  return roleTypes[normalizeRole(role)] || "";
};

const formatDate = (date) => {
  if (!date) return "-";
  return new Date(date).toLocaleString("zh-CN");
};

onMounted(() => {
  loadUsers();
});
</script>

<style scoped lang="scss">
.user-management {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-tools {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-input {
  width: 220px;
}

.role-tabs {
  :deep(.el-tabs__item) {
    font-size: 14px;
    padding: 0 20px;
  }
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tab-badge {
  :deep(.el-badge__content) {
    font-size: 11px;
    height: 16px;
    line-height: 16px;
    padding: 0 6px;
  }
}

.no-permission {
  color: #909399;
  font-size: 14px;
  margin-left: 10px;
}

.reset-hint {
  margin-top: 8px;
  padding: 8px 12px;
  background: #fef6e7;
  border-left: 3px solid #f59e0b;
  border-radius: 6px;
  font-size: 12px;
  color: #92400e;
  line-height: 1.5;
}

:deep(html.dark) {
  .user-management {
    background: var(--el-bg-color);
  }

  .card-header {
    color: var(--el-text-color-primary);
  }
}
</style>

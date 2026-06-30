<script setup lang="ts">
import { reactive, ref, onMounted } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { useUserStore } from "@/stores/user";
import { userApi } from "@/api/user";

const userStore = useUserStore();

const formRef = ref<FormInstance>();
const submitting = ref(false);

const form = reactive({
  username: "", // 只读展示
  realName: "",
  email: "",
});

const rules: FormRules = {
  realName: [{ max: 50, message: "真名长度不能超过 50", trigger: "blur" }],
  email: [{ type: "email", message: "邮箱格式不正确", trigger: "blur" }],
};

const loadFromStore = () => {
  const user = userStore.userInfo;
  if (!user) return;
  form.username = user.username || "";
  form.realName = user.realName || "";
  form.email = user.email || "";
};

const handleSubmit = async () => {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  submitting.value = true;
  try {
    const res = await userApi.updateSelf({
      realName: form.realName,
      email: form.email,
    });
    // 后端返回最新 UserInfo，同步到 store
    if (res?.data) {
      userStore.setUserInfo({ ...userStore.userInfo, ...res.data });
    }
    ElMessage.success("资料更新成功");
  } catch (err: any) {
    const message = err?.response?.data?.message || err?.message || "更新失败";
    ElMessage.error(message);
  } finally {
    submitting.value = false;
  }
};

onMounted(loadFromStore);
</script>

<template>
  <div class="profile-container">
    <h3 class="page-title">个人信息</h3>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="profile-form"
    >
      <el-form-item label="用户名">
        <el-input v-model="form.username" disabled />
        <div class="form-hint">登录账号由管理员设置，不可自行修改</div>
      </el-form-item>

      <el-form-item label="真名" prop="realName">
        <el-input v-model="form.realName" placeholder="请输入真名" />
      </el-form-item>

      <el-form-item label="邮箱" prop="email">
        <el-input v-model="form.email" placeholder="请输入邮箱" clearable />
      </el-form-item>

      <el-form-item>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          更新资料
        </el-button>
      </el-form-item>
    </el-form>
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

.profile-form {
  background: white;
  padding: 24px;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(180, 83, 9, 0.08);
}

.form-hint {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
}

:deep(html.dark) {
  .page-title {
    color: var(--el-text-color-primary);
  }
  .profile-form {
    background: var(--el-bg-color-overlay);
  }
  .form-hint {
    color: var(--el-text-color-secondary);
  }
}
</style>

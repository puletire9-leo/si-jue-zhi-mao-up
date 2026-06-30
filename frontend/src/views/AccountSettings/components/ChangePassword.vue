<script setup lang="ts">
import { reactive, ref } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { userApi } from "@/api/user";
import { useUserStore } from "@/stores/user";
import { useRouter } from "vue-router";

const userStore = useUserStore();
const router = useRouter();

const formRef = ref<FormInstance>();
const submitting = ref(false);

const form = reactive({
  oldPassword: "",
  newPassword: "",
  confirmPassword: "",
});

const validateConfirm = (_: any, value: string, callback: any) => {
  if (!value) {
    callback(new Error("请再次输入新密码"));
  } else if (value !== form.newPassword) {
    callback(new Error("两次输入的密码不一致"));
  } else {
    callback();
  }
};

const rules: FormRules = {
  oldPassword: [{ required: true, message: "请输入当前密码", trigger: "blur" }],
  newPassword: [
    { required: true, message: "请输入新密码", trigger: "blur" },
    { min: 6, message: "密码长度不能少于 6 位", trigger: "blur" },
  ],
  confirmPassword: [
    { required: true, validator: validateConfirm, trigger: "blur" },
  ],
};

const handleSubmit = async () => {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  if (form.oldPassword === form.newPassword) {
    ElMessage.warning("新密码不能与旧密码相同");
    return;
  }

  submitting.value = true;
  try {
    await userApi.updateSelfPassword(form.oldPassword, form.newPassword);
    ElMessage.success("密码修改成功，请重新登录");
    // 密码改了,token 还有效但建议重新登录,避免会话状态混乱
    setTimeout(() => {
      userStore.logout();
      router.push("/login");
    }, 1200);
  } catch (err: any) {
    const message = err?.response?.data?.message || err?.message || "修改失败";
    ElMessage.error(message);
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div class="change-password-container">
    <h3 class="page-title">修改密码</h3>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="password-form"
    >
      <el-form-item label="当前密码" prop="oldPassword">
        <el-input
          v-model="form.oldPassword"
          type="password"
          placeholder="请输入当前密码"
          show-password
          autocomplete="current-password"
        />
      </el-form-item>

      <el-form-item label="新密码" prop="newPassword">
        <el-input
          v-model="form.newPassword"
          type="password"
          placeholder="6 位以上"
          show-password
          autocomplete="new-password"
        />
      </el-form-item>

      <el-form-item label="确认新密码" prop="confirmPassword">
        <el-input
          v-model="form.confirmPassword"
          type="password"
          placeholder="再次输入新密码"
          show-password
          autocomplete="new-password"
        />
      </el-form-item>

      <el-form-item>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          确认修改
        </el-button>
      </el-form-item>
    </el-form>

    <div class="tips">
      <p>· 修改成功后需要重新登录</p>
      <p>· 忘记当前密码请联系管理员重置</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.change-password-container {
  max-width: 600px;
}

.page-title {
  margin-bottom: 24px;
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
}

.password-form {
  background: white;
  padding: 24px;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(180, 83, 9, 0.08);
}

.tips {
  margin-top: 16px;
  padding: 12px 16px;
  background: #faf8f5;
  border-radius: 10px;
  border-left: 3px solid #d97706;

  p {
    margin: 4px 0;
    font-size: 13px;
    color: #6b7280;
  }
}

:deep(html.dark) {
  .page-title {
    color: var(--el-text-color-primary);
  }
  .password-form {
    background: var(--el-bg-color-overlay);
  }
  .tips {
    background: var(--el-fill-color-lighter);
    p {
      color: var(--el-text-color-secondary);
    }
  }
}
</style>

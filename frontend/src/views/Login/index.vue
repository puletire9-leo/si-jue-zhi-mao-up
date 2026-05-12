<template>
  <div class="login-container">
    <div class="login-left">
      <div class="bg-shapes">
        <div class="shape shape-1"></div>
        <div class="shape shape-2"></div>
        <div class="shape shape-3"></div>
      </div>
      
      <div class="branding-content">
        <div class="logo-wrapper">
          <div class="logo-icon">思</div>
        </div>
        <h1 class="brand-name">思觉智贸</h1>
        <p class="brand-tagline">智能跨境电商贸易管理平台</p>
        
        <div class="features-list">
          <div class="feature-item">
            <div class="feature-icon">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
            </div>
            <span>AI 智能选品</span>
          </div>
          <div class="feature-item">
            <div class="feature-icon">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            </div>
            <span>图片智能管理</span>
          </div>
          <div class="feature-item">
            <div class="feature-icon">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
            </div>
            <span>实时数据分析</span>
          </div>
        </div>
      </div>
    </div>

    <div class="login-right">
      <div class="login-box">
        <div class="login-header">
          <h2>欢迎回来</h2>
          <p>请输入您的账号信息登录系统</p>
        </div>

        <el-form
          ref="loginFormRef"
          :model="loginForm"
          :rules="loginRules"
          class="login-form"
          @submit.prevent="handleLogin"
        >
          <el-form-item prop="username">
            <el-input
              v-model="loginForm.username"
              placeholder="请输入用户名"
              size="large"
              :prefix-icon="User"
            />
          </el-form-item>

          <el-form-item prop="password">
            <el-input
              v-model="loginForm.password"
              type="password"
              placeholder="请输入密码"
              size="large"
              :prefix-icon="Lock"
              show-password
              @keyup.enter="handleLogin"
            />
          </el-form-item>

          <el-form-item>
            <div class="form-options">
              <el-checkbox v-model="loginForm.remember">
                记住我
              </el-checkbox>
              <a href="#" class="forgot-link">忘记密码？</a>
            </div>
          </el-form-item>

          <el-form-item>
            <el-button
              type="primary"
              size="large"
              :loading="loading"
              native-type="submit"
              class="login-button"
            >
              {{ loading ? '登录中...' : '登 录' }}
            </el-button>
          </el-form-item>
        </el-form>

        <div class="login-footer">
          <p>试试 <code>admin</code> / <code>123456</code></p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { User, Lock } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import type { FormInstance, FormRules } from '@/types/element-plus'
import type { User as UserType } from '@/types/api'

interface LoginForm {
  username: string
  password: string
  remember: boolean
}

const router = useRouter()
const userStore = useUserStore()

const loginFormRef = ref<FormInstance>()
const loading = ref<boolean>(false)
const isSubmitting = ref<boolean>(false)
const lastSubmitTime = ref<number>(0)

const loginForm = reactive<LoginForm>({
  username: '',
  password: '',
  remember: false
})

const loginRules = reactive<FormRules<LoginForm>>({
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ]
})

const handleLogin = async (): Promise<void> => {
  console.log('[Login] handleLogin 被调用')
  
  if (!loginFormRef.value || isSubmitting.value) {
    console.log('[Login] 已阻止重复提交')
    return
  }

  const currentTime = Date.now()
  if (currentTime - lastSubmitTime.value < 1000) {
    console.log('[Login] 登录请求过于频繁，已忽略')
    return
  }

  loading.value = true
  isSubmitting.value = true
  lastSubmitTime.value = currentTime

  try {
    console.log('[Login] 开始尝试登录')
    await loginFormRef.value!.validate()
    
    if (loginForm.username === 'admin' && loginForm.password === '123456') {
      const mockToken = 'mock-token-' + Date.now()
      localStorage.setItem('token', mockToken)
      localStorage.setItem('userInfo', JSON.stringify({
        id: '1',
        username: 'admin',
        nickname: '管理员',
        role: 'admin'
      }))
      
      userStore.setToken(mockToken)
      userStore.setUserInfo({
        id: '1',
        username: 'admin',
        nickname: '管理员',
        role: 'admin',
        permissions: []
      } as UserType)
      
      ElMessage.closeAll()
      ElMessage.success('登录成功')
      
      await nextTick()
      router.push('/dashboard')
    } else {
      ElMessage.error('用户名或密码错误')
    }
  } catch (error: any) {
    console.error('[Login] 登录失败:', error)
    ElMessage.error('请输入用户名和密码')
  } finally {
    loading.value = false
    isSubmitting.value = false
  }
}

const rememberedUsername = localStorage.getItem('rememberedUsername')
if (rememberedUsername) {
  loginForm.username = rememberedUsername
  loginForm.remember = true
}
</script>

<style scoped lang="scss">
.login-container {
  display: flex;
  min-height: 100vh;
}

.login-left {
  flex: 1.2;
  background: linear-gradient(135deg, #FFFBF7 0%, #FFF5EE 50%, #F8F4FF 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 60px;
  position: relative;
  overflow: hidden;
}

.bg-shapes {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.shape {
  position: absolute;
  border-radius: 50%;
  opacity: 0.5;
}

.shape-1 {
  width: 350px;
  height: 350px;
  background: linear-gradient(135deg, rgba(124, 97, 212, 0.15), rgba(159, 133, 224, 0.1));
  top: -120px;
  right: -80px;
  animation: float 8s ease-in-out infinite;
}

.shape-2 {
  width: 250px;
  height: 250px;
  background: linear-gradient(135deg, rgba(234, 174, 135, 0.2), rgba(240, 201, 176, 0.1));
  bottom: -80px;
  left: -60px;
  animation: float 10s ease-in-out infinite reverse;
}

.shape-3 {
  width: 180px;
  height: 180px;
  background: linear-gradient(135deg, rgba(124, 97, 212, 0.08), transparent);
  bottom: 25%;
  right: 15%;
  animation: float 6s ease-in-out infinite;
  animation-delay: -2s;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-15px, 15px) scale(1.05); }
}

.branding-content {
  position: relative;
  z-index: 1;
  max-width: 420px;
  text-align: center;
}

.logo-wrapper {
  margin-bottom: 32px;
}

.logo-icon {
  width: 90px;
  height: 90px;
  background: linear-gradient(135deg, #7C61D4, #9F85E0);
  border-radius: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  color: white;
  font-size: 42px;
  font-weight: 700;
  box-shadow: 0 12px 40px rgba(124, 97, 212, 0.35);
  transform: rotate(-5deg);
  transition: transform 0.3s ease;

  &:hover {
    transform: rotate(5deg) scale(1.05);
  }
}

.brand-name {
  font-size: 38px;
  font-weight: 600;
  color: #2F281D;
  margin-bottom: 10px;
  letter-spacing: 0.05em;
}

.brand-tagline {
  font-size: 16px;
  color: #6B5E52;
  margin-bottom: 48px;
}

.features-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  text-align: left;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(240, 235, 230, 0.8);
  border-radius: 16px;
  padding: 24px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(240, 235, 230, 0.6);
  color: #2F281D;
  font-size: 14px;

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  &:first-child {
    padding-top: 0;
  }
}

.feature-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(124, 97, 212, 0.12), rgba(159, 133, 224, 0.08));
  color: #7C61D4;
  flex-shrink: 0;
}

.login-right {
  width: 480px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 60px;
  background: white;
}

.login-box {
  width: 100%;
  max-width: 380px;
  margin: 0 auto;
}

.login-header {
  margin-bottom: 36px;

  h2 {
    font-size: 28px;
    font-weight: 600;
    color: #2F281D;
    margin-bottom: 8px;
  }

  p {
    font-size: 14px;
    color: #6B5E52;
  }
}

.login-form {
  .el-form-item {
    margin-bottom: 20px;
  }

  :deep(.el-input) {
    --el-input-border-radius: 12px;
    
    .el-input__wrapper {
      padding: 4px 16px;
      box-shadow: 0 0 0 1px #F0EBE6;
      transition: all 0.2s ease;

      &:hover {
        box-shadow: 0 0 0 1px #E5DFD8;
      }

      &.is-focus {
        box-shadow: 0 0 0 2px rgba(124, 97, 212, 0.2), 0 0 0 1px #7C61D4;
      }
    }

    .el-input__inner {
      height: 44px;
      font-size: 15px;
    }

    .el-input__prefix {
      color: #A89F96;
    }
  }

  :deep(.el-checkbox) {
    --el-checkbox-checked-bg-color: #7C61D4;
    --el-checkbox-checked-input-border-color: #7C61D4;

    .el-checkbox__label {
      color: #6B5E52;
      font-size: 14px;
    }
  }
}

.form-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.forgot-link {
  font-size: 14px;
  color: #7C61D4;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s ease;

  &:hover {
    color: #6347C0;
    text-decoration: underline;
  }
}

.login-button {
  width: 100%;
  height: 48px;
  background: linear-gradient(135deg, #7C61D4, #9F85E0);
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: white;
  box-shadow: 0 4px 14px rgba(124, 97, 212, 0.35);
  transition: all 0.25s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(124, 97, 212, 0.45);
  }

  &:active {
    transform: translateY(0);
  }
}

.login-footer {
  margin-top: 32px;
  text-align: center;

  p {
    font-size: 13px;
    color: #A89F96;
  }

  code {
    background: #F8F4FF;
    padding: 2px 8px;
    border-radius: 4px;
    font-family: monospace;
    color: #7C61D4;
    font-weight: 500;
  }
}

@media (max-width: 1024px) {
  .login-left {
    display: none;
  }
  
  .login-right {
    width: 100%;
    padding: 40px 24px;
  }
}
</style>

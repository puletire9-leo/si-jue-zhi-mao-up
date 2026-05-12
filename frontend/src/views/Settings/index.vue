<template>
  <div class="settings">
    <el-card>
      <template #header>
        <span>系统设置</span>
      </template>

      <el-tabs v-model="activeTab">
        <el-tab-pane
          label="基本设置"
          name="basic"
        >
          <el-form
            :model="basicSettings"
            label-width="120px"
            style="max-width: 600px"
          >
            <el-form-item label="系统名称">
              <el-input v-model="basicSettings.systemName" />
            </el-form-item>
            <el-form-item label="系统描述">
              <el-input
                v-model="basicSettings.systemDescription"
                type="textarea"
                :rows="3"
              />
            </el-form-item>
            <el-form-item label="管理员邮箱">
              <el-input v-model="basicSettings.adminEmail" />
            </el-form-item>
            <el-form-item>
              <el-button
                v-if="isAdmin"
                type="primary"
                @click="saveBasicSettings"
              >
                保存
              </el-button>
              <span v-else class="no-permission">无权限</span>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane
          label="图片设置"
          name="image"
        >
          <el-form
            :model="imageSettings"
            label-width="120px"
            style="max-width: 600px"
          >
            <el-form-item label="最大图片大小">
              <el-input-number
                v-model="imageSettings.maxImageSize"
                :min="1"
                :max="200"
              />
              <span style="margin-left: 8px">MB</span>
              <div class="image-size-hint">
                <el-icon><InfoFilled /></el-icon>
                当前图片大小限制：{{ imageSettings.maxImageSize }}MB，允许上传不超过此大小的图片
              </div>
            </el-form-item>

            <el-form-item label="产品卡片大小">
              <div class="card-size-settings">
                <div class="card-size-control">
                  <el-radio-group v-model="cardSizePreset" class="card-size-presets">
                    <el-radio-button label="150x150">小 (150×150px)</el-radio-button>
                    <el-radio-button label="200x200">中 (200×200px)</el-radio-button>
                    <el-radio-button label="250x250">大 (250×250px)</el-radio-button>
                    <el-radio-button label="300x300">特大 (300×300px)</el-radio-button>
                    <el-radio-button label="custom">自定义</el-radio-button>
                  </el-radio-group>
                  <div class="page-selection">
                    <span>应用页面：</span>
                    <el-checkbox-group v-model="selectedPages">
                      <el-checkbox label="material-library">素材库</el-checkbox>
                      <el-checkbox label="carrier-library">载体库</el-checkbox>
                    </el-checkbox-group>
                  </div>
                </div>
                <div v-if="cardSizePreset === 'custom'" class="custom-size-input">
                  <div class="size-inputs">
                    <div class="size-input-item">
                      <span>宽度：</span>
                      <el-input-number
                        v-model="customCardWidth"
                        :min="100"
                        :max="500"
                        @change="updateCustomCardSize"
                        step="10"
                      />
                      <span style="margin-left: 8px">px</span>
                    </div>
                    <div class="size-input-item">
                      <span>高度：</span>
                      <el-input-number
                        v-model="customCardHeight"
                        :min="100"
                        :max="500"
                        @change="updateCustomCardSize"
                        step="10"
                      />
                      <span style="margin-left: 8px">px</span>
                    </div>
                  </div>
                </div>
                <div class="card-size-preview">
                  <div class="preview-label">预览效果：</div>
                  <div 
                    class="preview-card" 
                    :style="{ width: `${currentCardWidth}px`, height: `${currentCardHeight}px` }"
                  >
                    <div class="preview-content">产品卡片</div>
                    <div class="preview-size">{{ currentCardWidth }}px × {{ currentCardHeight }}px</div>
                  </div>
                </div>
                <div class="card-size-hint">
                  <el-icon><InfoFilled /></el-icon>
                  选择合适的卡片大小，影响素材库和定稿页面的产品卡片显示效果
                </div>
              </div>
            </el-form-item>

            <el-form-item>
              <el-button
                v-if="isAdmin"
                type="primary"
                @click="saveImageSettings"
              >
                保存
              </el-button>
              <span v-else class="no-permission">无权限</span>
            </el-form-item>
          </el-form>
        </el-tab-pane>



        <el-tab-pane
          label="安全设置"
          name="security"
        >
          <el-form
            :model="securitySettings"
            label-width="120px"
            style="max-width: 600px"
          >
            <el-form-item label="启用登录验证">
              <el-switch v-model="securitySettings.enableLogin" />
            </el-form-item>
            <el-form-item label="会话超时时间">
              <el-input-number
                v-model="securitySettings.sessionTimeout"
                :min="30"
                :max="1440"
              />
              <span style="margin-left: 8px">分钟</span>
            </el-form-item>
            <el-form-item label="启用IP白名单">
              <el-switch v-model="securitySettings.enableIpWhitelist" />
            </el-form-item>
            <el-form-item label="IP白名单">
              <el-input
                v-model="securitySettings.ipWhitelist"
                type="textarea"
                :rows="3"
                placeholder="每行一个IP地址"
              />
            </el-form-item>
            <el-form-item>
              <el-button
                v-if="isAdmin"
                type="primary"
                @click="saveSecuritySettings"
              >
                保存
              </el-button>
              <span v-else class="no-permission">无权限</span>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane
          label="通用配置"
          name="general"
        >
          <el-form
            label-width="120px"
            style="max-width: 1200px"
          >
            <div class="settings-row">
            <el-form-item label="开发人列表" class="settings-col">
              <div class="developer-list-container">
                <!-- 开发人列表 -->
                <div class="developer-tags">
                  <el-tag
                    v-for="(developer, index) in generalSettings.developers"
                    :key="index"
                    closable
                    @close="removeDeveloper(index)"
                    effect="light"
                    type="primary"
                  >
                    {{ developer }}
                  </el-tag>
                </div>
                <!-- 添加开发人输入框 -->
                <div class="add-developer">
                  <el-input
                    v-model="newDeveloper"
                    placeholder="输入开发人名称"
                    clearable
                    @keyup.enter="addDeveloper"
                  >
                    <template #append>
                      <el-button type="primary" @click="addDeveloper">
                        添加
                      </el-button>
                    </template>
                  </el-input>
                </div>
              </div>
              <div style="margin-top: 8px; color: #909399; font-size: 12px">
                说明：开发人名称将用于定稿页面的筛选和选择
              </div>
            </el-form-item>

            <el-form-item label="载体列表" class="settings-col">
              <div class="carrier-list-container">
                <!-- 载体列表 -->
                <div class="carrier-tags">
                  <el-tag
                    v-for="(carrier, index) in generalSettings.carriers"
                    :key="index"
                    closable
                    @close="removeCarrier(index)"
                    effect="light"
                    type="success"
                  >
                    {{ carrier }}
                  </el-tag>
                </div>
                <!-- 添加载体输入框 -->
                <div class="add-carrier">
                  <el-input
                    v-model="newCarrier"
                    placeholder="输入载体名称"
                    clearable
                    @keyup.enter="addCarrier"
                  >
                    <template #append>
                      <el-button type="success" @click="addCarrier">
                        添加
                      </el-button>
                    </template>
                  </el-input>
                </div>
              </div>
              <div style="margin-top: 8px; color: #909399; font-size: 12px">
                说明：载体名称将用于筛选条件和选择载体
              </div>
            </el-form-item>
            </div>
            <el-form-item>
              <el-button
                v-if="isAdmin"
                type="primary"
                @click="saveGeneralSettings"
              >
                保存
              </el-button>
              <span v-else class="no-permission">无权限</span>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane
          label="备份设置"
          name="backup"
        >
          <el-form
            label-width="120px"
            style="max-width: 800px"
          >
            <!-- 一键备份区域 -->
            <el-form-item>
              <div class="backup-section">
                <h3>一键备份</h3>
                
                <!-- 备份方式选择 -->
                <div class="backup-method-selection">
                  <el-radio-group v-model="selectedBackupMethod" size="large">
                    <el-radio-button label="local">本地备份</el-radio-button>
                    <el-radio-button label="cos">腾讯云备份</el-radio-button>
                  </el-radio-group>
                </div>
                
                <div class="backup-action">
                  <el-button
                    v-if="isAdmin"
                    type="primary"
                    size="large"
                    @click="startBackup"
                    :disabled="isBackupRunning"
                  >
                    <el-icon v-if="isBackupRunning"><Loading /></el-icon>
                    {{ isBackupRunning ? '备份中...' : '立即备份' }}
                  </el-button>
                  <span v-else class="no-permission">无权限</span>
                  <span class="backup-tip">点击按钮开始全量备份，备份过程可能需要几分钟</span>
                </div>
                
                <!-- 备份进度显示 -->
                <div class="backup-progress" v-if="isBackupRunning">
                  <el-progress
                    :percentage="backupProgress"
                    :status="backupStatus"
                    :stroke-width="20"
                    style="margin: 20px 0"
                  >
                    <template #default>
                      <span>{{ backupProgress }}%</span>
                    </template>
                  </el-progress>
                  <div class="backup-progress-text">{{ backupProgressText }}</div>
                </div>
                
                <!-- 备份结果显示 -->
                <el-alert
                  v-if="backupResult"
                  :title="backupResult.title"
                  :message="backupResult.message"
                  :type="backupResult.type"
                  show-icon
                  style="margin: 20px 0"
                />
              </div>
            </el-form-item>
            
            <!-- 备份配置区域 -->
            <el-form-item>
              <div class="backup-section">
                <h3>备份配置</h3>
                <div class="backup-config">
                  <el-descriptions :column="2" border>
                    <el-descriptions-item label="备份类型">全量备份</el-descriptions-item>
                    <el-descriptions-item label="备份数据库">{{ currentDatabase }}</el-descriptions-item>
                    <el-descriptions-item label="当前环境">{{ currentEnvironment === 'production' ? '生产环境' : '开发环境' }}</el-descriptions-item>
                    <el-descriptions-item label="备份保留">3天</el-descriptions-item>
                    <el-descriptions-item label="本地备份路径">{{ localBackupPath }}</el-descriptions-item>
                    <el-descriptions-item label="腾讯云备份路径">{{ cosBackupPath }}</el-descriptions-item>
                    <el-descriptions-item label="自动备份">每天凌晨2:30</el-descriptions-item>
                    <el-descriptions-item label="当前选择">
                      <el-tag :type="selectedBackupMethod === 'local' ? 'primary' : 'success'">
                        {{ selectedBackupMethod === 'local' ? '本地备份' : '腾讯云备份' }}
                      </el-tag>
                    </el-descriptions-item>
                  </el-descriptions>
                </div>
              </div>
            </el-form-item>
            
            <!-- 最近备份记录 -->
            <el-form-item>
              <div class="backup-section">
                <h3>最近备份记录</h3>
                <el-table :data="recentBackups" style="width: 100%" border>
                  <el-table-column prop="id" label="ID" width="80" />
                  <el-table-column prop="name" label="备份名称" width="200" />
                  <el-table-column prop="type" label="备份类型" width="100" />
                  <el-table-column prop="size" label="文件大小" width="100" />
                  <el-table-column prop="status" label="状态" width="100">
                    <template #default="scope">
                      <el-tag :type="scope.row.status === 'success' ? 'success' : 'danger'" size="small">
                        {{ scope.row.status }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="storageLocation" label="存储位置" width="120">
                    <template #default="scope">
                      <el-tag :type="scope.row.storageLocation === 'local' ? 'primary' : 'success'" size="small">
                        {{ scope.row.storageLocation === 'local' ? '本地' : '腾讯云COS' }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="createdAt" label="创建时间" width="180" />
                  <el-table-column label="操作" width="120">
                    <template #default="scope">
                      <el-button v-if="isAdmin" type="primary" size="small" text @click="handleDownload(scope.row)">
                        下载
                      </el-button>
                      <el-button v-if="isAdmin" type="danger" size="small" text @click="handleDelete(scope.row.id)">
                        删除
                      </el-button>
                      <span v-else class="no-permission">无权限</span>
                    </template>
                  </el-table-column>
                </el-table>
                
                <div v-if="recentBackups.length === 0" class="no-backups">
                  <el-empty description="暂无备份记录" />
                </div>
              </div>
            </el-form-item>
            
            <!-- 过期备份记录 -->
            <el-form-item>
              <div class="backup-section">
                <h3>过期备份</h3>
                <div class="expired-backup-header">
                  <span class="expired-backup-tip">显示超过3天的备份记录，可手动删除以释放存储空间</span>
                  <el-button v-if="isAdmin" type="primary" size="small" @click="fetchExpiredBackups">
                    <el-icon><Refresh /></el-icon>
                    刷新
                  </el-button>
                </div>
                <el-table v-loading="isLoadingExpiredBackups" :data="expiredBackups" style="width: 100%" border>
                  <el-table-column prop="id" label="ID" width="80" />
                  <el-table-column prop="name" label="备份名称" width="200" />
                  <el-table-column prop="type" label="备份类型" width="100" />
                  <el-table-column prop="size" label="文件大小" width="100" />
                  <el-table-column prop="status" label="状态" width="100">
                    <template #default="scope">
                      <el-tag :type="scope.row.status === 'success' ? 'success' : 'danger'" size="small">
                        {{ scope.row.status }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="storageLocation" label="存储位置" width="120">
                    <template #default="scope">
                      <el-tag :type="scope.row.storageLocation === 'local' ? 'primary' : 'success'" size="small">
                        {{ scope.row.storageLocation === 'local' ? '本地' : '腾讯云COS' }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="createdAt" label="创建时间" width="180" />
                  <el-table-column label="操作" width="80">
                    <template #default="scope">
                      <el-button v-if="isAdmin" type="danger" size="small" text @click="handleDelete(scope.row.id)">
                        删除
                      </el-button>
                      <span v-else class="no-permission">无权限</span>
                    </template>
                  </el-table-column>
                </el-table>
                
                <div v-if="!isLoadingExpiredBackups && expiredBackups.length === 0" class="no-backups">
                  <el-empty description="暂无过期备份记录" />
                </div>
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane
          v-if="isAdmin"
          label="角色管理"
          name="permission"
        >
          <el-form
            label-width="120px"
            style="max-width: 600px"
          >
            <!-- 角色管理 -->
            <el-form-item label="角色管理">
              <div class="permission-container">
                <!-- 角色列表 -->
                <div class="role-tags">
                  <el-tag
                    v-for="(role, index) in permissionSettings.roles"
                    :key="index"
                    closable
                    @close="removeRole(index)"
                    effect="light"
                    type="warning"
                  >
                    {{ role }}
                  </el-tag>
                </div>
                <!-- 添加角色输入框 -->
                <div class="add-role">
                  <el-input
                    v-model="newRole"
                    placeholder="输入角色名称"
                    clearable
                    @keyup.enter="addRole"
                  >
                    <template #append>
                      <el-button type="warning" @click="addRole">
                        添加
                      </el-button>
                    </template>
                  </el-input>
                </div>
              </div>
              <div style="margin-top: 8px; color: #909399; font-size: 12px">
                说明：添加系统角色，用于权限分配
              </div>
            </el-form-item>
            <el-form-item>
              <el-button
                type="primary"
                @click="savePermissionSettings"
              >
                保存
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane
          label="系统日志"
          name="system-log"
        >
          <el-card>
            <template #header>
              <span>系统日志管理</span>
            </template>
            
            <el-tabs v-model="activeSystemLogTab">
              <el-tab-pane label="系统文档" name="system-doc">
                <div class="system-doc-container">
                  <el-collapse v-model="activeDocs">
                    <el-collapse-item title="认证系统" name="auth">
                      <div class="doc-content">
                        <h4>功能描述</h4>
                        <p>提供用户登录、注册、权限管理等功能</p>
                        <h4>技术实现</h4>
                        <p>使用 JWT 进行身份验证，RBAC 模型进行权限管理</p>
                        <h4>API 接口</h4>
                        <ul>
                          <li>/api/v1/auth/login - 用户登录</li>
                          <li>/api/v1/auth/register - 用户注册</li>
                          <li>/api/v1/auth/refresh - 刷新 token</li>
                          <li>/api/v1/auth/logout - 用户登出</li>
                        </ul>
                      </div>
                    </el-collapse-item>
                    <el-collapse-item title="产品管理" name="product">
                      <div class="doc-content">
                        <h4>功能描述</h4>
                        <p>提供产品的增删改查、分类管理、批量导入导出等功能</p>
                        <h4>技术实现</h4>
                        <p>使用 RESTful API 进行产品管理，支持分页、搜索和批量操作</p>
                        <h4>API 接口</h4>
                        <ul>
                          <li>/api/v1/products/list - 获取产品列表</li>
                          <li>/api/v1/products/:id - 获取产品详情</li>
                          <li>/api/v1/products - 创建产品</li>
                          <li>/api/v1/products/:id - 更新产品</li>
                          <li>/api/v1/products/:id - 删除产品</li>
                          <li>/api/v1/products/import - 批量导入产品</li>
                          <li>/api/v1/products/export - 批量导出产品</li>
                        </ul>
                      </div>
                    </el-collapse-item>
                    <el-collapse-item title="选品管理" name="selection">
                      <div class="doc-content">
                        <h4>功能描述</h4>
                        <p>提供选品的创建、管理、回收站等功能</p>
                        <h4>技术实现</h4>
                        <p>使用 RESTful API 进行选品管理，支持选品的完整生命周期管理</p>
                        <h4>API 接口</h4>
                        <ul>
                          <li>/api/v1/selection/products - 获取选品列表</li>
                          <li>/api/v1/selection/products/:id - 获取选品详情</li>
                          <li>/api/v1/selection/products - 创建选品</li>
                          <li>/api/v1/selection/products/:id - 更新选品</li>
                          <li>/api/v1/selection/products/:id - 删除选品</li>
                          <li>/api/v1/selection_recycle - 获取选品回收站</li>
                        </ul>
                      </div>
                    </el-collapse-item>
                    <el-collapse-item title="定稿管理" name="final_draft">
                      <div class="doc-content">
                        <h4>功能描述</h4>
                        <p>提供定稿的创建、编辑、管理等功能</p>
                        <h4>技术实现</h4>
                        <p>使用 RESTful API 进行定稿管理，支持定稿的完整生命周期管理</p>
                        <h4>API 接口</h4>
                        <ul>
                          <li>/api/v1/final-drafts - 获取定稿列表</li>
                          <li>/api/v1/final-drafts/:id - 获取定稿详情</li>
                          <li>/api/v1/final-drafts - 创建定稿</li>
                          <li>/api/v1/final-drafts/:id - 更新定稿</li>
                          <li>/api/v1/final-drafts/:id - 删除定稿</li>
                        </ul>
                      </div>
                    </el-collapse-item>
                    <el-collapse-item title="图片处理" name="image">
                      <div class="doc-content">
                        <h4>功能描述</h4>
                        <p>提供图片上传、下载、处理、批量操作等功能</p>
                        <h4>技术实现</h4>
                        <p>使用腾讯云 COS 进行图片存储，支持图片压缩、格式转换和缩略图生成</p>
                        <h4>API 接口</h4>
                        <ul>
                          <li>/api/v1/images/upload - 上传图片</li>
                          <li>/api/v1/images/batch-upload - 批量上传图片</li>
                          <li>/api/v1/images/:id - 获取图片详情</li>
                          <li>/api/v1/images/search - 搜索图片</li>
                          <li>/api/v1/images/:id - 删除图片</li>
                        </ul>
                      </div>
                    </el-collapse-item>
                    <el-collapse-item title="用户管理" name="user">
                      <div class="doc-content">
                        <h4>功能描述</h4>
                        <p>提供用户的增删改查、权限管理等功能</p>
                        <h4>技术实现</h4>
                        <p>使用 RESTful API 进行用户管理，支持用户权限控制和角色管理</p>
                        <h4>API 接口</h4>
                        <ul>
                          <li>/api/v1/users - 获取用户列表</li>
                          <li>/api/v1/users/:id - 获取用户详情</li>
                          <li>/api/v1/users - 创建用户</li>
                          <li>/api/v1/users/:id - 更新用户</li>
                          <li>/api/v1/users/:id - 删除用户</li>
                        </ul>
                      </div>
                    </el-collapse-item>
                    <el-collapse-item title="分类管理" name="category">
                      <div class="doc-content">
                        <h4>功能描述</h4>
                        <p>提供产品分类的管理功能</p>
                        <h4>技术实现</h4>
                        <p>使用 RESTful API 进行分类管理，支持分类的增删改查</p>
                        <h4>API 接口</h4>
                        <ul>
                          <li>/api/v1/categories - 获取分类列表</li>
                          <li>/api/v1/categories/:id - 获取分类详情</li>
                          <li>/api/v1/categories - 创建分类</li>
                          <li>/api/v1/categories/:id - 更新分类</li>
                          <li>/api/v1/categories/:id - 删除分类</li>
                        </ul>
                      </div>
                    </el-collapse-item>
                    <el-collapse-item title="标签管理" name="tag">
                      <div class="doc-content">
                        <h4>功能描述</h4>
                        <p>提供产品和图片标签的管理功能</p>
                        <h4>技术实现</h4>
                        <p>使用 RESTful API 进行标签管理，支持标签的增删改查</p>
                        <h4>API 接口</h4>
                        <ul>
                          <li>/api/v1/tags - 获取标签列表</li>
                          <li>/api/v1/tags/:id - 获取标签详情</li>
                          <li>/api/v1/tags - 创建标签</li>
                          <li>/api/v1/tags/:id - 更新标签</li>
                          <li>/api/v1/tags/:id - 删除标签</li>
                        </ul>
                      </div>
                    </el-collapse-item>
                    <el-collapse-item title="统计功能" name="statistics">
                      <div class="doc-content">
                        <h4>功能描述</h4>
                        <p>提供系统数据的统计分析功能</p>
                        <h4>技术实现</h4>
                        <p>使用 RESTful API 进行数据统计，支持多种统计维度</p>
                        <h4>API 接口</h4>
                        <ul>
                          <li>/api/v1/statistics/system - 系统统计</li>
                          <li>/api/v1/statistics/products - 产品统计</li>
                          <li>/api/v1/statistics/images - 图片统计</li>
                        </ul>
                      </div>
                    </el-collapse-item>
                    <el-collapse-item title="日志管理" name="logs">
                      <div class="doc-content">
                        <h4>功能描述</h4>
                        <p>提供操作日志的记录和查询功能</p>
                        <h4>技术实现</h4>
                        <p>使用结构化日志记录，支持日志的筛选和查询</p>
                        <h4>API 接口</h4>
                        <ul>
                          <li>/api/v1/logs - 获取日志列表</li>
                          <li>/api/v1/logs/system-docs - 获取系统文档</li>
                          <li>/api/v1/logs/update-records - 获取更新记录</li>
                          <li>/api/v1/logs/requirements - 获取需求清单</li>
                        </ul>
                      </div>
                    </el-collapse-item>
                    <el-collapse-item title="回收站" name="recycle">
                      <div class="doc-content">
                        <h4>功能描述</h4>
                        <p>提供产品和选品的回收站管理功能</p>
                        <h4>技术实现</h4>
                        <p>使用 RESTful API 进行回收站管理，支持回收站项目的恢复和删除</p>
                        <h4>API 接口</h4>
                        <ul>
                          <li>/api/v1/recycle_bin - 获取回收站列表</li>
                          <li>/api/v1/product_recycle - 获取产品回收站</li>
                          <li>/api/v1/selection_recycle - 获取选品回收站</li>
                        </ul>
                      </div>
                    </el-collapse-item>
                    <el-collapse-item title="文件链接" name="file_link">
                      <div class="doc-content">
                        <h4>功能描述</h4>
                        <p>提供文件链接的生成和管理功能</p>
                        <h4>技术实现</h4>
                        <p>使用 RESTful API 进行文件链接管理，支持链接的生成、查询和删除</p>
                        <h4>API 接口</h4>
                        <ul>
                          <li>/api/v1/file_links - 获取文件链接列表</li>
                          <li>/api/v1/file_links/:id - 获取文件链接详情</li>
                          <li>/api/v1/file_links - 创建文件链接</li>
                          <li>/api/v1/file_links/:id - 删除文件链接</li>
                        </ul>
                      </div>
                    </el-collapse-item>
                    <el-collapse-item title="系统配置" name="system_config">
                      <div class="doc-content">
                        <h4>功能描述</h4>
                        <p>提供系统参数的配置管理功能</p>
                        <h4>技术实现</h4>
                        <p>使用 RESTful API 进行系统配置管理，支持多种配置项的设置</p>
                        <h4>API 接口</h4>
                        <ul>
                          <li>/api/v1/system-config - 获取系统配置</li>
                          <li>/api/v1/system-config - 更新系统配置</li>
                          <li>/api/v1/system-config/backup - 开始备份</li>
                          <li>/api/v1/system-config/backup/records - 获取备份记录</li>
                        </ul>
                      </div>
                    </el-collapse-item>
                    <el-collapse-item title="图片代理" name="image_proxy">
                      <div class="doc-content">
                        <h4>功能描述</h4>
                        <p>提供图片访问的代理服务功能</p>
                        <h4>技术实现</h4>
                        <p>使用 RESTful API 进行图片代理，支持图片的访问和处理</p>
                        <h4>API 接口</h4>
                        <ul>
                          <li>/api/v1/image-proxy/* - 图片代理服务</li>
                        </ul>
                      </div>
                    </el-collapse-item>
                    <el-collapse-item title="备份功能" name="backup">
                      <div class="doc-content">
                        <h4>功能描述</h4>
                        <p>提供数据库备份、恢复等功能</p>
                        <h4>技术实现</h4>
                        <p>支持本地备份和腾讯云 COS 备份，自动备份和手动备份</p>
                        <h4>API 接口</h4>
                        <ul>
                          <li>/api/v1/system-config/backup - 开始备份</li>
                          <li>/api/v1/system-config/backup/records - 获取备份记录</li>
                          <li>/api/v1/system-config/backup/:id/download - 下载备份文件</li>
                        </ul>
                      </div>
                    </el-collapse-item>
                    <el-collapse-item title="性能监控" name="performance">
                      <div class="doc-content">
                        <h4>功能描述</h4>
                        <p>提供请求性能的监控和优化功能</p>
                        <h4>技术实现</h4>
                        <p>使用中间件进行性能监控，支持请求超时控制和慢请求监控</p>
                        <h4>技术特性</h4>
                        <ul>
                          <li>请求超时控制</li>
                          <li>慢请求监控和告警</li>
                          <li>请求大小限制</li>
                          <li>静态文件服务优化</li>
                        </ul>
                      </div>
                    </el-collapse-item>
                    <el-collapse-item title="异常处理" name="error">
                      <div class="doc-content">
                        <h4>功能描述</h4>
                        <p>提供统一的错误处理机制</p>
                        <h4>技术实现</h4>
                        <p>使用全局异常处理器，支持统一的错误响应格式</p>
                        <h4>技术特性</h4>
                        <ul>
                          <li>统一的错误处理中间件</li>
                          <li>标准化的错误响应格式</li>
                          <li>详细的错误信息记录</li>
                        </ul>
                      </div>
                    </el-collapse-item>
                  </el-collapse>
                </div>
              </el-tab-pane>
              <el-tab-pane label="更新记录" name="update-record">
                <div class="update-record-container">
                  <el-timeline>
                    <el-timeline-item
                      v-for="(record, index) in updateRecords"
                      :key="index"
                      :timestamp="record.date"
                      :type="record.updateType"
                      :icon="record.icon"
                    >
                      <el-card>
                        <template #header>
                          <div class="timeline-header">
                            <span>{{ record.title }}</span>
                            <el-tag :type="record.updateType">{{ record.updateType }}</el-tag>
                          </div>
                        </template>
                        <div class="timeline-content">
                          <h4>更新内容</h4>
                          <p>{{ record.content }}</p>
                          <h4>技术实现方案</h4>
                          <p>{{ record.implementation }}</p>
                        </div>
                      </el-card>
                    </el-timeline-item>
                  </el-timeline>
                </div>
              </el-tab-pane>
              <el-tab-pane label="需求清单" name="requirement">
                <div class="requirement-container">
                  <div class="requirement-header">
                    <h3>未来待实现的功能需求</h3>
                    <el-button type="primary" @click="openAddRequirementDialog">
                      <el-icon><Plus /></el-icon>
                      添加需求
                    </el-button>
                  </div>
                  
                  <el-form :inline="true" :model="requirementSearchForm" class="requirement-search-form">
                    <el-form-item label="优先级">
                      <el-select v-model="requirementSearchForm.priority" placeholder="请选择" clearable>
                        <el-option label="高" value="high" />
                        <el-option label="中" value="medium" />
                        <el-option label="低" value="low" />
                      </el-select>
                    </el-form-item>
                    <el-form-item label="状态">
                      <el-select v-model="requirementSearchForm.status" placeholder="请选择" clearable>
                        <el-option label="待处理" value="pending" />
                        <el-option label="进行中" value="in_progress" />
                        <el-option label="已完成" value="completed" />
                      </el-select>
                    </el-form-item>
                    <el-form-item label="关键词">
                      <el-input v-model="requirementSearchForm.keyword" placeholder="请输入关键词" clearable />
                    </el-form-item>
                    <el-form-item>
                      <el-button type="primary" @click="handleRequirementSearch">
                        <el-icon><Search /></el-icon>
                        搜索
                      </el-button>
                      <el-button @click="handleRequirementReset">
                        <el-icon><Refresh /></el-icon>
                        重置
                      </el-button>
                    </el-form-item>
                  </el-form>
                  
                  <el-table :data="filteredRequirements" style="width: 100%">
                    <el-table-column prop="id" label="ID" width="80" />
                    <el-table-column prop="name" label="需求名称" />
                    <el-table-column prop="description" label="需求描述" show-overflow-tooltip />
                    <el-table-column prop="priority" label="优先级" width="100">
                      <template #default="{ row }">
                        <el-tag :type="getPriorityType(row.priority)">{{ row.priority }}</el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column prop="status" label="状态" width="120">
                      <template #default="{ row }">
                        <el-tag :type="getStatusType(row.status)">{{ row.status }}</el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column prop="createdAt" label="创建时间" width="180" />
                    <el-table-column label="操作" width="150">
                      <template #default="{ row }">
                        <el-button type="primary" size="small" text @click="openEditRequirementDialog(row)">
                          编辑
                        </el-button>
                        <el-button type="danger" size="small" text @click="handleDeleteRequirement(row.id)">
                          删除
                        </el-button>
                      </template>
                    </el-table-column>
                  </el-table>
                  
                  <!-- 添加/编辑需求对话框 -->
                  <el-dialog
                    v-model="requirementDialogVisible"
                    :title="isEditingRequirement ? '编辑需求' : '添加需求'"
                    width="500px"
                  >
                    <el-form :model="currentRequirement" label-width="100px">
                      <el-form-item label="需求名称">
                        <el-input v-model="currentRequirement.name" />
                      </el-form-item>
                      <el-form-item label="需求描述">
                        <el-input
                          v-model="currentRequirement.description"
                          type="textarea"
                          :rows="3"
                        />
                      </el-form-item>
                      <el-form-item label="优先级">
                        <el-select v-model="currentRequirement.priority">
                          <el-option label="高" value="high" />
                          <el-option label="中" value="medium" />
                          <el-option label="低" value="low" />
                        </el-select>
                      </el-form-item>
                      <el-form-item label="状态">
                        <el-select v-model="currentRequirement.status">
                          <el-option label="待处理" value="pending" />
                          <el-option label="进行中" value="in_progress" />
                          <el-option label="已完成" value="completed" />
                        </el-select>
                      </el-form-item>
                    </el-form>
                    <template #footer>
                      <span class="dialog-footer">
                        <el-button @click="requirementDialogVisible = false">取消</el-button>
                        <el-button type="primary" @click="saveRequirement">保存</el-button>
                      </span>
                    </template>
                  </el-dialog>
                </div>
              </el-tab-pane>
            </el-tabs>
          </el-card>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'Settings' })
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { InfoFilled, Refresh, Loading, Plus, Search } from '@element-plus/icons-vue'
import { systemConfigApi } from '@/api/systemConfig'
import { logsApi } from '@/api/logs'
import { useUserStore } from '@/stores/user'

interface BasicSettings {
  systemName: string
  systemDescription: string
  adminEmail: string
}

interface ImageSettings {
  maxImageSize: number
  productCardWidth: number | string
  productCardHeight: number | string
}



interface SecuritySettings {
  enableLogin: boolean
  sessionTimeout: number
  enableIpWhitelist: boolean
  ipWhitelist: string
}

interface GeneralSettings {
  developers: string[]
  carriers: string[]
}

interface PermissionSettings {
  roles: string[]
  permissions: Record<string, string[]>
}





interface BackupRecord {
  id: number
  name: string
  type: string
  size: number
  status: 'success' | 'failed' | 'running'
  createdAt: string
  storageLocation: 'local' | 'cos' // 区分本地和腾讯云备份
}

interface BackupResult {
  title: string
  message: string
  type: 'success' | 'warning' | 'error' | 'info'
}

const activeTab = ref<string>('basic')

// 用户状态管理
const userStore = useUserStore()

// 计算属性：检查用户是否为管理员
const isAdmin = computed(() => {
  return userStore.userInfo && (userStore.userInfo.role === '管理员' || userStore.userInfo.role === 'admin')
})

// 备份方式选择
const selectedBackupMethod = ref<'local' | 'cos'>('local')

// 备份路径
// 获取当前环境
const currentEnvironment = import.meta.env.VITE_ENVIRONMENT
// 确定当前备份的数据库
const currentDatabase = currentEnvironment === 'production' ? '生产数据库' : '开发数据库'
// 动态生成本地备份路径
const localBackupPath = computed(() => {
  return `${currentEnvironment}/database/database_backup/backup`
})
// 动态生成腾讯云备份路径
const cosBackupPath = computed(() => {
  const bucketName = currentEnvironment === 'production' ? 'sijuelishi' : 'sijuelishi_dev'
  return `cos://${bucketName}/database_backups/`
})

const basicSettings = reactive<BasicSettings>({
  systemName: '思觉智贸',
  systemDescription: '智能跨境电商贸易管理系统',
  adminEmail: 'admin@example.com'
})

const imageSettings = reactive<ImageSettings>({
  maxImageSize: 10,
  productCardWidth: 200,
  productCardHeight: 200
})



const securitySettings = reactive<SecuritySettings>({
  enableLogin: true,
  sessionTimeout: 120,
  enableIpWhitelist: false,
  ipWhitelist: ''
})

const generalSettings = reactive<GeneralSettings>({
  developers: [],
  carriers: []
})

const permissionSettings = reactive<PermissionSettings>({
  roles: [],
  permissions: {}
})

// 新角色输入框
const newRole = ref<string>('')

// 选择的角色
const selectedRole = ref<string>('')

// 选择的权限
const selectedPermissions = ref<string[]>([])

// 新开发人输入框
const newDeveloper = ref<string>('')

// 新载体输入框
const newCarrier = ref<string>('')

// 产品卡片大小设置相关变量
const cardSizePreset = ref<string>('200x200')
const customCardWidth = ref<number>(200)
const customCardHeight = ref<number>(200)

const currentCardWidth = computed(() => {
  if (cardSizePreset.value === 'custom') {
    return customCardWidth.value
  }
  const [width] = cardSizePreset.value.split('x').map(Number)
  return width
})

const currentCardHeight = computed(() => {
  if (cardSizePreset.value === 'custom') {
    return customCardHeight.value
  }
  const [, height] = cardSizePreset.value.split('x').map(Number)
  return height
})

// 页面选择
const selectedPages = ref<string[]>(['material-library'])

// 更新自定义卡片大小
const updateCustomCardSize = () => {
  // 当自定义大小改变时，确保保持在自定义模式
  if (cardSizePreset.value === 'custom') {
    // 可以在这里添加额外的逻辑
  }
}

// 监听预设值变化
watch(cardSizePreset, (newPreset) => {
  if (newPreset !== 'custom') {
    const [width, height] = newPreset.split('x').map(Number)
    imageSettings.productCardWidth = width
    imageSettings.productCardHeight = height
  }
}, { immediate: true })

// 备份相关状态
const isBackupRunning = ref<boolean>(false)
const backupProgress = ref<number>(0)
const backupStatus = ref<'success' | 'exception' | 'warning' | ''>('')
const backupProgressText = ref<string>('')
const backupResult = ref<BackupResult | null>(null)

// 最近备份记录
const recentBackups = ref<BackupRecord[]>([])

// 过期备份记录
const expiredBackups = ref<BackupRecord[]>([])
const isLoadingExpiredBackups = ref<boolean>(false)

// 系统日志相关变量
const activeSystemLogTab = ref<string>('system-doc')
const activeDocs = ref<string[]>([])
const isLoadingSystemLogs = ref<boolean>(false)

// 更新记录数据
const updateRecords = ref<any[]>([
  {
    date: '2026-01-30',
    title: '更新系统文档和更新记录',
    content: '按照系统实际的程序内容更新系统文档和更新记录，确保前端显示的内容与系统实际的技术实现和功能一致',
    implementation: '更新前端系统文档模块，添加新模块文档并更新现有模块文档；更新前端更新记录模块，添加实际的系统更新记录',
    updateType: 'success',
    icon: 'el-icon-success'
  },
  {
    date: '2026-01-29',
    title: '优化性能监控系统',
    content: '添加请求性能监控和优化功能，支持请求超时控制和慢请求监控',
    implementation: '使用中间件进行性能监控，添加请求超时控制、慢请求监控和请求大小限制',
    updateType: 'info',
    icon: 'el-icon-info'
  },
  {
    date: '2026-01-28',
    title: '实现选品管理功能',
    content: '添加选品的创建、管理、回收站功能',
    implementation: '使用 RESTful API 进行选品管理，支持选品的完整生命周期管理',
    updateType: 'success',
    icon: 'el-icon-success'
  },
  {
    date: '2026-01-27',
    title: '实现定稿管理功能',
    content: '添加定稿的创建、编辑、管理功能',
    implementation: '使用 RESTful API 进行定稿管理，支持定稿的完整生命周期管理',
    updateType: 'success',
    icon: 'el-icon-success'
  },
  {
    date: '2026-01-26',
    title: '优化备份功能',
    content: '优化备份功能，支持本地备份和腾讯云备份',
    implementation: '使用 Python 实现备份逻辑，集成腾讯云 COS SDK',
    updateType: 'info',
    icon: 'el-icon-info'
  },
  {
    date: '2026-01-25',
    title: '修复前端热启动失败问题',
    content: '修复前端热启动失败的问题',
    implementation: '优化前端启动脚本，确保前端服务能够正常启动',
    updateType: 'warning',
    icon: 'el-icon-warning'
  },
  {
    date: '2026-01-24',
    title: '修复后端热重载状态丢失问题',
    content: '修复后端热重载导致的状态丢失问题',
    implementation: '优化后端热重载逻辑，确保系统状态的一致性',
    updateType: 'warning',
    icon: 'el-icon-warning'
  },
  {
    date: '2026-01-23',
    title: '添加系统日志功能',
    content: '在系统设置中添加系统日志功能，包含系统文档、更新记录、需求清单三个模块',
    implementation: '使用 Vue 3 + Element Plus 实现前端界面，添加相关 API 接口',
    updateType: 'success',
    icon: 'el-icon-success'
  },
  {
    date: '2026-01-22',
    title: '修复图片上传问题',
    content: '修复图片上传失败的问题',
    implementation: '优化图片上传逻辑，添加错误处理',
    updateType: 'warning',
    icon: 'el-icon-warning'
  },
  {
    date: '2026-01-21',
    title: '实现产品管理功能',
    content: '添加产品的增删改查、分类管理、批量导入导出等功能',
    implementation: '使用 RESTful API 进行产品管理，支持分页、搜索和批量操作',
    updateType: 'success',
    icon: 'el-icon-success'
  }
])

// 需求清单数据
const requirements = ref<any[]>([
  {
    id: 1,
    name: '添加用户头像上传功能',
    description: '允许用户上传和修改个人头像',
    priority: 'high',
    status: 'pending',
    createdAt: '2024-01-30'
  },
  {
    id: 2,
    name: '实现数据导出功能',
    description: '支持将产品数据导出为 Excel 格式',
    priority: 'medium',
    status: 'in_progress',
    createdAt: '2024-01-29'
  },
  {
    id: 3,
    name: '优化搜索功能',
    description: '提高搜索速度和准确性',
    priority: 'low',
    status: 'pending',
    createdAt: '2024-01-28'
  }
])

// 需求搜索表单
const requirementSearchForm = reactive<any>({
  priority: '',
  status: '',
  keyword: ''
})

// 需求对话框
const requirementDialogVisible = ref<boolean>(false)
const isEditingRequirement = ref<boolean>(false)
const currentRequirement = reactive<any>({
  id: '',
  name: '',
  description: '',
  priority: 'medium',
  status: 'pending'
})

// 过滤后的需求列表
const filteredRequirements = computed(() => {
  return requirements.value.filter(requirement => {
    const matchesPriority = !requirementSearchForm.priority || requirement.priority === requirementSearchForm.priority
    const matchesStatus = !requirementSearchForm.status || requirement.status === requirementSearchForm.status
    const matchesKeyword = !requirementSearchForm.keyword || 
      requirement.name.includes(requirementSearchForm.keyword) || 
      requirement.description.includes(requirementSearchForm.keyword)
    return matchesPriority && matchesStatus && matchesKeyword
  })
})

// 从后端获取系统文档
const fetchSystemDocs = async (): Promise<void> => {
  try {
    console.log('开始获取系统文档...')
    isLoadingSystemLogs.value = true
    const response = await logsApi.getSystemDocs()
    console.log('获取系统文档响应:', response)
    
    // 检查响应数据
    if (response && typeof response === 'object') {
      if (response.code === 200 && response.data) {
        console.log('系统文档数据:', response.data)
        // 这里可以根据需要处理系统文档数据
      } else if (response.code !== 200) {
        console.log('系统文档业务错误:', response.message || '未知错误')
        // 对于业务错误，我们仍然认为请求成功，只是数据可能有问题
      }
    } else {
      console.log('系统文档非标准响应格式:', response)
    }
  } catch (error: any) {
    console.error('获取系统文档失败:', error)
    console.error('错误详情:', {
      message: error.message,
      stack: error.stack,
      response: error.response
    })
    
    // 提供更详细的错误信息
    let errorMessage = '获取系统文档失败'
    if (error.message?.includes('Network Error')) {
      errorMessage = '网络连接失败，请检查网络设置或后端服务是否正常运行'
    } else if (error.response?.status === 404) {
      errorMessage = '系统文档接口不存在'
    } else if (error.response?.status === 500) {
      errorMessage = '后端服务错误，请联系管理员'
    } else if (error.message?.includes('请求配置无效')) {
      errorMessage = '请求配置错误，请检查API配置'
    } else if (error.message?.includes('undefined')) {
      errorMessage = '请求配置不完整，存在undefined参数'
    }
    
    ElMessage.error(errorMessage)
  } finally {
    isLoadingSystemLogs.value = false
    console.log('获取系统文档完成')
  }
}

// 从后端获取更新记录
const fetchUpdateRecords = async (): Promise<void> => {
  try {
    console.log('开始获取更新记录...')
    isLoadingSystemLogs.value = true
    const response = await logsApi.getUpdateRecords()
    console.log('获取更新记录响应:', response)
    
    // 检查响应数据
    if (response && typeof response === 'object') {
      if (response.code === 200 && response.data) {
        console.log('更新记录数据:', response.data.list)
        updateRecords.value = response.data.list
      } else if (response.code !== 200) {
        console.log('更新记录业务错误:', response.message || '未知错误')
        // 对于业务错误，我们仍然认为请求成功，只是数据可能有问题
      }
    } else {
      console.log('更新记录非标准响应格式:', response)
    }
  } catch (error: any) {
    console.error('获取更新记录失败:', error)
    console.error('错误详情:', {
      message: error.message,
      stack: error.stack,
      response: error.response
    })
    
    // 提供更详细的错误信息
    let errorMessage = '获取更新记录失败'
    if (error.message?.includes('Network Error')) {
      errorMessage = '网络连接失败，请检查网络设置或后端服务是否正常运行'
    } else if (error.response?.status === 404) {
      errorMessage = '更新记录接口不存在'
    } else if (error.response?.status === 500) {
      errorMessage = '后端服务错误，请联系管理员'
    } else if (error.message?.includes('请求配置无效')) {
      errorMessage = '请求配置错误，请检查API配置'
    } else if (error.message?.includes('undefined')) {
      errorMessage = '请求配置不完整，存在undefined参数'
    }
    
    ElMessage.error(errorMessage)
  } finally {
    isLoadingSystemLogs.value = false
    console.log('获取更新记录完成')
  }
}

// 从后端获取需求清单
const fetchRequirements = async (): Promise<void> => {
  try {
    console.log('开始获取需求清单...')
    isLoadingSystemLogs.value = true
    const response = await logsApi.getRequirements()
    console.log('获取需求清单响应:', response)
    
    // 检查响应数据
    if (response && typeof response === 'object') {
      if (response.code === 200 && response.data) {
        console.log('需求清单数据:', response.data.list)
        requirements.value = response.data.list
      } else if (response.code !== 200) {
        console.log('需求清单业务错误:', response.message || '未知错误')
        // 对于业务错误，我们仍然认为请求成功，只是数据可能有问题
      }
    } else {
      console.log('需求清单非标准响应格式:', response)
    }
  } catch (error: any) {
    console.error('获取需求清单失败:', error)
    console.error('错误详情:', {
      message: error.message,
      stack: error.stack,
      response: error.response
    })
    
    // 提供更详细的错误信息
    let errorMessage = '获取需求清单失败'
    if (error.message?.includes('Network Error')) {
      errorMessage = '网络连接失败，请检查网络设置或后端服务是否正常运行'
    } else if (error.response?.status === 404) {
      errorMessage = '需求清单接口不存在'
    } else if (error.response?.status === 500) {
      errorMessage = '后端服务错误，请联系管理员'
    } else if (error.message?.includes('请求配置无效')) {
      errorMessage = '请求配置错误，请检查API配置'
    } else if (error.message?.includes('undefined')) {
      errorMessage = '请求配置不完整，存在undefined参数'
    }
    
    ElMessage.error(errorMessage)
  } finally {
    isLoadingSystemLogs.value = false
    console.log('获取需求清单完成')
  }
}

// 获取优先级对应的标签类型
const getPriorityType = (priority: string): 'success' | 'warning' | 'info' | 'primary' | 'danger' => {
  const priorityMap: Record<string, 'success' | 'warning' | 'info' | 'primary' | 'danger'> = {
    'high': 'danger',
    'medium': 'warning',
    'low': 'info'
  }
  return priorityMap[priority] || 'info'
}

// 获取状态对应的标签类型
const getStatusType = (status: string): 'success' | 'warning' | 'info' | 'primary' | 'danger' => {
  const statusMap: Record<string, 'success' | 'warning' | 'info' | 'primary' | 'danger'> = {
    'pending': 'info',
    'in_progress': 'warning',
    'completed': 'success'
  }
  return statusMap[status] || 'info'
}

// 打开添加需求对话框
const openAddRequirementDialog = (): void => {
  isEditingRequirement.value = false
  Object.assign(currentRequirement, {
    id: '',
    name: '',
    description: '',
    priority: 'medium',
    status: 'pending'
  })
  requirementDialogVisible.value = true
}

// 打开编辑需求对话框
const openEditRequirementDialog = (requirement: any): void => {
  isEditingRequirement.value = true
  Object.assign(currentRequirement, requirement)
  requirementDialogVisible.value = true
}

// 保存需求
const saveRequirement = async (): Promise<void> => {
  if (!currentRequirement.name.trim()) {
    ElMessage.warning('需求名称不能为空')
    return
  }
  
  try {
    isLoadingSystemLogs.value = true
    
    if (isEditingRequirement.value) {
      // 更新现有需求
      await logsApi.updateRequirement(currentRequirement.id, currentRequirement)
      ElMessage.success('需求更新成功')
    } else {
      // 添加新需求
      await logsApi.createRequirement(currentRequirement)
      ElMessage.success('需求添加成功')
    }
    
    // 重新获取需求列表
    await fetchRequirements()
    requirementDialogVisible.value = false
  } catch (error: any) {
    console.error('保存需求失败:', error)
    ElMessage.error('保存需求失败')
  } finally {
    isLoadingSystemLogs.value = false
  }
}

// 删除需求
const handleDeleteRequirement = async (id: any): Promise<void> => {
  ElMessageBox.confirm('确定要删除这条需求吗？', '删除确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      isLoadingSystemLogs.value = true
      await logsApi.deleteRequirement(id)
      ElMessage.success('需求删除成功')
      // 重新获取需求列表
      await fetchRequirements()
    } catch (error: any) {
      console.error('删除需求失败:', error)
      ElMessage.error('删除需求失败')
    } finally {
      isLoadingSystemLogs.value = false
    }
  }).catch(() => {
    // 取消删除
  })
}

// 搜索需求
const handleRequirementSearch = (): void => {
  // 过滤逻辑已在 computed 属性中实现
}

// 重置需求搜索
const handleRequirementReset = (): void => {
  requirementSearchForm.priority = ''
  requirementSearchForm.status = ''
  requirementSearchForm.keyword = ''
}

const saveBasicSettings = (): void => {
  if (!isAdmin.value) {
    ElMessage.warning('只有管理员可以修改系统设置')
    return
  }
  ElMessage.success('基本设置保存成功')
}

const saveImageSettings = async (): Promise<void> => {
  if (!isAdmin.value) {
    ElMessage.warning('只有管理员可以修改系统设置')
    return
  }
  try {
    // 准备要保存的设置
    const settingsToSave = {
      ...imageSettings
    }
    
    // 如果选择了自定义大小，使用customCardWidth和customCardHeight的值
    if (cardSizePreset.value === 'custom') {
      settingsToSave.productCardWidth = customCardWidth.value
      settingsToSave.productCardHeight = customCardHeight.value
    }
    
    await systemConfigApi.updateImageSettings(settingsToSave)
    ElMessage.success('图片设置保存成功')
  } catch (error) {
    console.error('保存图片设置失败:', error)
    ElMessage.error('保存图片设置失败')
  }
}



const saveSecuritySettings = (): void => {
  if (!isAdmin.value) {
    ElMessage.warning('只有管理员可以修改系统设置')
    return
  }
  ElMessage.success('安全设置保存成功')
}

// 添加开发人
const addDeveloper = (): void => {
  if (!isAdmin.value) {
    ElMessage.warning('只有管理员可以修改系统设置')
    return
  }
  if (newDeveloper.value.trim()) {
    const dev = newDeveloper.value.trim()
    // 检查是否已存在
    if (!generalSettings.developers.includes(dev)) {
      generalSettings.developers.push(dev)
    }
    newDeveloper.value = ''
  }
}

// 删除开发人
const removeDeveloper = (index: number): void => {
  if (!isAdmin.value) {
    ElMessage.warning('只有管理员可以修改系统设置')
    return
  }
  generalSettings.developers.splice(index, 1)
}

// 添加载体
const addCarrier = (): void => {
  if (!isAdmin.value) {
    ElMessage.warning('只有管理员可以修改系统设置')
    return
  }
  if (newCarrier.value.trim()) {
    const carrier = newCarrier.value.trim()
    // 检查是否已存在
    if (!generalSettings.carriers.includes(carrier)) {
      generalSettings.carriers.push(carrier)
    }
    newCarrier.value = ''
  }
}

// 删除载体
const removeCarrier = (index: number): void => {
  if (!isAdmin.value) {
    ElMessage.warning('只有管理员可以修改系统设置')
    return
  }
  generalSettings.carriers.splice(index, 1)
}

// 添加角色
const addRole = (): void => {
  if (newRole.value.trim()) {
    const role = newRole.value.trim()
    // 检查是否已存在
    if (!permissionSettings.roles.includes(role)) {
      permissionSettings.roles.push(role)
      // 为新角色初始化空权限列表
      permissionSettings.permissions[role] = []
    }
    newRole.value = ''
  }
}

// 删除角色
const removeRole = (index: number): void => {
  const role = permissionSettings.roles[index]
  permissionSettings.roles.splice(index, 1)
  // 删除该角色对应的权限
  delete permissionSettings.permissions[role]
  // 如果删除的是当前选中的角色，清空选择
  if (selectedRole.value === role) {
    selectedRole.value = ''
    selectedPermissions.value = []
  }
}

// 保存通用设置
const saveGeneralSettings = async (): Promise<void> => {
  if (!isAdmin.value) {
    ElMessage.warning('只有管理员可以修改系统设置')
    return
  }
  try {
    // 过滤空字符串
    const developers = generalSettings.developers.filter(dev => dev.trim())
    const carriers = generalSettings.carriers.filter(carrier => carrier.trim())
    
    // 并行保存开发人列表和载体列表
    await Promise.all([
      systemConfigApi.updateDeveloperList(developers),
      systemConfigApi.updateCarrierList(carriers)
    ])
    
    // 更新本地数据为过滤后的数据
    generalSettings.developers = developers
    generalSettings.carriers = carriers
    
    ElMessage.success('通用设置保存成功')
  } catch (error) {
    console.error('保存通用设置失败:', error)
    ElMessage.error('保存失败，请重试')
  }
}



// 保存角色设置
const savePermissionSettings = async (): Promise<void> => {
  if (!isAdmin.value) {
    ElMessage.warning('只有管理员可以修改系统设置')
    return
  }
  try {
    console.log('开始保存角色设置...')
    
    // 过滤空字符串角色
    const roles = permissionSettings.roles.filter(role => role.trim())
    console.log(`过滤后的角色列表: ${JSON.stringify(roles)}`)
    
    // 更新本地数据为过滤后的数据
    permissionSettings.roles = roles
    
    ElMessage.success('角色设置保存成功')
  } catch (error: any) {
    console.error('保存角色设置失败:', error)
    ElMessage.error('保存失败，请重试')
  }
}

// 开始备份
const startBackup = async (): Promise<void> => {
  if (!isAdmin.value) {
    ElMessage.warning('只有管理员可以执行备份操作')
    return
  }
  try {
    // 初始化备份状态
    isBackupRunning.value = true
    backupProgress.value = 0
    backupStatus.value = ''
    backupProgressText.value = '准备备份...'
    backupResult.value = null
    
    // 调用真实的备份API
    const response = await systemConfigApi.startBackup(selectedBackupMethod.value)
    
    // 备份成功
    backupProgress.value = 100
    backupStatus.value = 'success'
    backupProgressText.value = '备份完成！'
    
    // 显示备份成功结果
    const backupLocation = response.data.storageLocation === 'local' ? '本地' : '腾讯云COS'
    backupResult.value = {
      title: '备份成功',
      message: `数据库全量备份已完成，备份文件已保存到${backupLocation}`,
      type: 'success'
    }
    
    // 重新获取备份记录
    await fetchRecentBackups()
    
    ElMessage.success('备份成功')
  } catch (error: any) {
    console.error('备份失败:', error)
    backupProgress.value = 100
    backupStatus.value = 'exception'
    backupProgressText.value = '备份失败！'
    
    // 提取更详细的错误信息
    let errorMessage = '数据库备份过程中发生错误，请查看日志或重试'
    if (error.response) {
      // API返回了错误响应
      if (error.response.status === 403) {
        errorMessage = '您没有权限执行备份操作'
      } else {
        errorMessage = error.response.data?.message || errorMessage
      }
    } else if (error.message) {
      // 网络错误或其他错误
      errorMessage = error.message
    }
    
    backupResult.value = {
      title: '备份失败',
      message: errorMessage,
      type: 'error'
    }
    
    ElMessage.error(`备份失败: ${errorMessage}`)
  } finally {
    isBackupRunning.value = false
  }
}

// 删除模拟备份过程函数，使用真实API


// 删除添加备份记录函数，使用真实API获取记录


// 获取最近备份记录
const fetchRecentBackups = async (): Promise<void> => {
  try {
    // 调用真实API获取最近备份记录
    const response = await systemConfigApi.getBackupRecords()
    if (response.code === 200 && response.data) {
      recentBackups.value = response.data.records
    }
    
    console.log('获取最近备份记录成功')
  } catch (error: any) {
    console.error('获取最近备份记录失败:', error)
    
    // 处理不同类型的错误
    let errorMessage = '获取备份记录失败'
    if (error.response) {
      // API返回了错误响应
      if (error.response.status === 403) {
        errorMessage = '您没有权限访问备份记录'
      } else {
        errorMessage = error.response.data?.message || errorMessage
      }
    } else if (error.message) {
      // 网络错误或其他错误
      errorMessage = error.message
    }
    
    ElMessage.error(errorMessage)
  }
}

// 处理下载备份文件
const handleDownload = async (backup: BackupRecord): Promise<void> => {
  if (!isAdmin.value) {
    ElMessage.warning('只有管理员可以下载备份文件')
    return
  }
  try {
    console.log('开始下载备份文件:', backup.name)
    
    // 调用真实API获取下载URL
    const response = await systemConfigApi.downloadBackup(backup.id)
    
    if (response.code === 200 && response.data?.url) {
      // 使用获取到的URL进行下载
      window.open(response.data.url, '_blank')
      ElMessage.success(`正在下载备份文件 ${backup.name}`)
    } else {
      throw new Error('获取下载URL失败')
    }
    
  } catch (error: any) {
    console.error('下载备份文件失败:', error)
    
    // 处理不同类型的错误
    let errorMessage = '下载失败，请重试'
    if (error.response) {
      // API返回了错误响应
      if (error.response.status === 403) {
        errorMessage = '您没有权限下载备份文件'
      } else {
        errorMessage = error.response.data?.message || errorMessage
      }
    } else if (error.message) {
      // 网络错误或其他错误
      errorMessage = error.message
    }
    
    ElMessage.error(errorMessage)
  }
}

// 处理删除备份记录
const handleDelete = async (backupId: number): Promise<void> => {
  if (!isAdmin.value) {
    ElMessage.warning('只有管理员可以删除备份记录')
    return
  }
  try {
    // 确认删除
    ElMessageBox.confirm('确定要删除这条备份记录吗？', '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(async () => {
      try {
        // 调用真实API删除备份记录
        await systemConfigApi.deleteBackup(backupId)
        
        // 重新获取备份记录
        await Promise.all([
          fetchRecentBackups(),
          fetchExpiredBackups()
        ])
        
        ElMessage.success('备份记录删除成功')
      } catch (error: any) {
        console.error('删除备份记录失败:', error)
        
        // 处理不同类型的错误
        let errorMessage = '删除失败，请重试'
        if (error.response) {
          // API返回了错误响应
          if (error.response.status === 403) {
            errorMessage = '您没有权限删除备份记录'
          } else {
            errorMessage = error.response.data?.message || errorMessage
          }
        } else if (error.message) {
          // 网络错误或其他错误
          errorMessage = error.message
        }
        
        ElMessage.error(errorMessage)
      }
    }).catch(() => {
      // 取消删除
      console.log('取消删除备份记录')
    })
  } catch (error) {
    console.error('删除备份记录失败:', error)
    ElMessage.error('删除失败，请重试')
  }
}

// 获取过期备份记录
const fetchExpiredBackups = async (): Promise<void> => {
  if (!isAdmin.value) {
    return
  }
  try {
    isLoadingExpiredBackups.value = true
    
    // 调用真实API获取过期备份记录
    const response = await systemConfigApi.getExpiredBackups()
    
    if (response.code === 200 && response.data) {
      expiredBackups.value = response.data.records
    }
    
    console.log('获取过期备份记录成功')
  } catch (error: any) {
    console.error('获取过期备份记录失败:', error)
    
    // 处理不同类型的错误
    let errorMessage = '获取过期备份记录失败'
    if (error.response) {
      // API返回了错误响应
      if (error.response.status === 403) {
        errorMessage = '您没有权限访问过期备份记录'
      } else {
        errorMessage = error.response.data?.message || errorMessage
      }
    } else if (error.message) {
      // 网络错误或其他错误
      errorMessage = error.message
    }
    
    ElMessage.error(errorMessage)
  } finally {
    isLoadingExpiredBackups.value = false
  }
}

// 从后端加载开发人列表
const loadDeveloperList = async (): Promise<void> => {
  try {
    const response = await systemConfigApi.getDeveloperList()
    if (response.code === 200 && response.data) {
      generalSettings.developers = response.data.developerList
    }
  } catch (error) {
    console.error('加载开发人列表失败:', error)
    ElMessage.error('加载开发人列表失败')
  }
}

// 从后端加载载体列表
const loadCarrierList = async (): Promise<void> => {
  try {
    const response = await systemConfigApi.getCarrierList()
    if (response.code === 200 && response.data) {
      generalSettings.carriers = response.data.carrierList
    }
  } catch (error) {
    console.error('加载载体列表失败:', error)
    ElMessage.error('加载载体列表失败')
  }
}

// 从后端加载角色设置
const loadPermissionSettings = async (): Promise<void> => {
  try {
    // 简化处理，使用默认角色列表
    permissionSettings.roles = ['管理员', '开发', '美术', '仓库']
    permissionSettings.permissions = {}
  } catch (error) {
    console.error('加载角色设置失败:', error)
    ElMessage.error('加载角色设置失败')
  }
}

// 加载图片设置
const loadImageSettings = async (): Promise<void> => {
  try {
    const response = await systemConfigApi.getImageSettings()
    if (response.data) {
      imageSettings.maxImageSize = response.data.maxImageSize
      imageSettings.productCardWidth = response.data.productCardWidth || 200
      imageSettings.productCardHeight = response.data.productCardHeight || 200
      
      // 更新预设值或自定义值
      const width = imageSettings.productCardWidth as number
      const height = imageSettings.productCardHeight as number
      const presetValue = `${width}x${height}`
      
      // 检查是否为预设值
      const presets = ['150x150', '200x200', '250x250', '300x300']
      if (presets.includes(presetValue)) {
        cardSizePreset.value = presetValue
      } else {
        cardSizePreset.value = 'custom'
        customCardWidth.value = width
        customCardHeight.value = height
      }
    }
  } catch (error) {
    console.error('加载图片设置失败:', error)
  }
}

// 监听标签切换，当切换到系统日志标签时加载数据
watch(activeTab, async (newTab) => {
  if (newTab === 'system-log') {
    console.log('切换到系统日志标签，开始加载数据...')
    await Promise.all([
      fetchSystemDocs(),
      fetchUpdateRecords(),
      fetchRequirements()
    ])
  }
})

// 监听系统日志子标签切换
watch(activeSystemLogTab, async (newTab) => {
  console.log('切换到系统日志子标签:', newTab)
  // 根据子标签类型加载对应数据
  switch (newTab) {
    case 'system-doc':
      await fetchSystemDocs()
      break
    case 'update-record':
      await fetchUpdateRecords()
      break
    case 'requirement':
      await fetchRequirements()
      break
  }
})

onMounted(async () => {
  try {
    console.log('Settings组件挂载，开始初始化数据...')
    // 并行加载所有数据
    await Promise.all([
      // 加载系统日志数据
      fetchSystemDocs(),
      fetchUpdateRecords(),
      fetchRequirements(),
      // 加载其他设置数据
      loadDeveloperList(),
      loadCarrierList(),
      loadPermissionSettings(),
      loadImageSettings(),
      fetchRecentBackups(), // 加载备份记录
      fetchExpiredBackups() // 加载过期备份记录
    ])
    console.log('Settings组件初始化完成')
  } catch (error) {
    console.error('Settings组件初始化失败:', error)
  }
})
</script>

<style scoped>
.card-size-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-size-control {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.card-size-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.page-selection {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-selection span {
  font-size: 14px;
  color: #606266;
}

.custom-size-input {
  margin-top: 8px;
}

.size-inputs {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.size-input-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-size-preview {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.preview-label {
  font-size: 14px;
  color: #606266;
}

.preview-card {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background-color: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.preview-content {
  font-size: 12px;
  color: #909399;
  text-align: center;
}

.preview-size {
  font-size: 10px;
  color: #c0c4cc;
  margin-top: 4px;
}

.card-size-hint {
  margin-top: 8px;
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #909399;
  gap: 4px;
}
</style>

<style scoped lang="scss">
.settings {
  padding: 20px;
}

/* 图片大小提示样式 */
.image-size-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 12px;
  background-color: #ecf5ff;
  border: 1px solid #d9ecff;
  border-radius: 4px;
  font-size: 14px;
  color: #409eff;
  
  :deep(.el-icon) {
    font-size: 16px;
  }
}

/* 横向排列容器样式 */
.settings-row {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.settings-col {
  flex: 1;
  min-width: 400px;
}

.developer-list-container,
.carrier-list-container,
.permission-container {
  .developer-tags,
  .carrier-tags,
  .role-tags {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); /* 减小最小宽度 */
    gap: 8px; /* 减小间距 */
    margin-bottom: 15px;
    padding: 8px; /* 减小内边距 */
    background-color: #f5f7fa;
    border-radius: 8px;
    min-height: 40px;
    align-items: center;
  }

  .add-developer,
  .add-carrier,
  .add-role {
    display: flex;
    gap: 10px;

    :deep(.el-input) {
      flex: 1;
    }
  }
}

/* 权限配置样式 */
.no-role-selected {
  color: #909399;
  font-size: 14px;
  padding: 20px;
  background-color: #f5f7fa;
  border-radius: 8px;
}

/* 备份设置样式 */
.backup-section {
  margin-bottom: 30px;
  
  h3 {
    font-size: 16px;
    font-weight: bold;
    margin-bottom: 15px;
    color: #303133;
    border-bottom: 1px solid #ebeef5;
    padding-bottom: 8px;
  }
}

.backup-action {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
  
  .backup-tip {
    color: #909399;
    font-size: 14px;
  }
}

.backup-progress {
  margin: 20px 0;
  
  .backup-progress-text {
    text-align: center;
    color: #606266;
    font-size: 14px;
  }
}

.backup-config {
  margin: 15px 0;
}

.no-backups {
  margin: 20px 0;
  text-align: center;
}

/* 美化备份表格 */
:deep(.el-table) {
  margin-top: 15px;
  
  .el-table__header-wrapper {
    .el-table__header {
      th {
        background-color: #fafafa;
        font-weight: bold;
      }
    }
  }
  
  .el-table__body-wrapper {
    .el-table__row {
      &:hover {
        background-color: #f5f7fa;
      }
    }
  }
}

/* 美化进度条 */
:deep(.el-progress) {
  .el-progress-bar {
    .el-progress-bar__outer {
      background-color: #f0f2f5;
      border-radius: 10px;
    }
    
    .el-progress-bar__inner {
      border-radius: 10px;
      background-color: #409eff;
    }
  }
}

/* 美化备份按钮 */
:deep(.el-button--primary) {
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

/* 美化备份结果提示 */
:deep(.el-alert) {
  margin: 20px 0;
  border-radius: 8px;
}

/* 备份方式选择样式 */
.backup-method-selection {
  margin: 15px 0;
  
  :deep(.el-radio-group) {
    display: flex;
    gap: 10px;
    
    .el-radio-button {
      margin-right: 0;
      
      &.is-active {
        .el-radio-button__inner {
          background-color: #409eff;
          border-color: #409eff;
        }
      }
    }
  }
}

/* 过期备份样式 */
.expired-backup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.expired-backup-tip {
  color: #909399;
  font-size: 14px;
}

.expired-backup-header .el-button {
  margin-left: 10px;
}

/* 备份路径样式 */
.backup-paths {
  margin: 15px 0;
}

/* 备份记录存储位置样式 */
:deep(.el-table) {
  .storage-location {
    .local {
      color: #409eff;
    }
    .cos {
      color: #67c23a;
    }
  }
}

/* 无权限提示样式 */
.no-permission {
  color: #909399;
  font-size: 14px;
  margin-left: 10px;
}

/* 系统日志样式 */
.system-doc-container {
  margin: 20px 0;
}

.doc-content {
  padding: 10px;
  background-color: #f5f7fa;
  border-radius: 4px;
  margin-top: 10px;
}

.doc-content h4 {
  margin: 10px 0;
  color: #303133;
}

.doc-content p {
  margin: 5px 0;
  color: #606266;
  line-height: 1.5;
}

.doc-content ul {
  margin: 5px 0;
  padding-left: 20px;
}

.doc-content li {
  margin: 3px 0;
  color: #606266;
}

.update-record-container {
  margin: 20px 0;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.timeline-content {
  margin-top: 10px;
}

.timeline-content h4 {
  margin: 10px 0;
  color: #303133;
}

.timeline-content p {
  margin: 5px 0;
  color: #606266;
  line-height: 1.5;
}

.requirement-container {
  margin: 20px 0;
}

.requirement-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.requirement-header h3 {
  margin: 0;
  color: #303133;
}

.requirement-search-form {
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* 美化时间线 */
:deep(.el-timeline-item) {
  margin-bottom: 20px;
}

:deep(.el-timeline-item__content) {
  padding-top: 0;
}

/* 美化折叠面板 */
:deep(.el-collapse-item__content) {
  padding: 10px 20px;
}

/* 美化需求表格 */
:deep(.el-table) {
  margin-top: 10px;
}

:deep(.el-table th) {
  background-color: #fafafa;
  font-weight: bold;
}

:deep(.el-table tr:hover) {
  background-color: #f5f7fa;
}

/* 美化对话框 */
:deep(.el-dialog__header) {
  background-color: #f5f7fa;
  border-bottom: 1px solid #ebeef5;
}

:deep(.el-dialog__title) {
  font-weight: bold;
}

:deep(.el-dialog__body) {
  padding: 20px;
}

:deep(.el-dialog__footer) {
  padding: 10px 20px;
  border-top: 1px solid #ebeef5;
}

</style>

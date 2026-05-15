# 思觉智贸 — 团队协作工作流

## 分支策略

```
master（生产环境，受保护）
  └── feat/xxx（新功能）
  └── fix/xxx（bug 修复）
  └── refactor/xxx（重构）
```

### 基本原则
- **master 是生产代码**，永远处于可部署状态
- **禁止直接 push master**，所有修改必须走 PR
- **分支命名规范**：`feat/添加批量导出`、`fix/修登录bug`、`refactor/重构定稿页`
- **分支用完即删**（GitHub PR 合入后可以点击"Delete branch"）

## 日常开发流程

```bash
# 1. 拉最新的 master
git checkout master
git pull

# 2. 创建功能分支
git checkout -b feat/你的功能名

# 3. 写代码，小步提交
git add .
git commit -m "feat: 添加XXX功能"

# 4. 推送到 GitHub
git push origin feat/你的功能名

# 5. 在 GitHub 上创建 Pull Request
#    等待 CI 检查通过 + 同事 Review

# 6. 合入 master
#    GitHub PR 页面点击 "Squash and merge"

# 7. 本地同步
git checkout master
git pull
```

## Commit 消息规范

```
<type>: <简短描述>

类型:
  feat     新功能
  fix      bug 修复
  refactor 重构（不修 bug 不加功能）
  style    样式/UI 改动
  docs     文档
  chore    构建/CI/配置等杂项
```

示例：
```
feat: 添加批量导出功能
fix: 修复登录页面验证码不刷新
refactor: 拆分定稿管理页面为 composable
style: 调整侧边栏深色模式配色
```

## Pull Request 规范

1. **标题**：用中文概括改动，如 `feat: 添加销量下滑分析 API`
2. **描述**：写清楚改了什么、为什么改、怎么测试
3. **CI 检查**：必须全部通过（❌ → ✅）
4. **Review**：至少一人审核通过后合入
5. **合入方式**：用 **Squash and merge**（将分支多个提交压缩为一个，保持 master 历史干净）

## 本地开发模式

```bash
# 开发模式（hot-reload）
bash dev.sh

# 切换分支前先提交或 stash
git stash
git checkout master
git pull
git checkout -b feat/新功能
git stash pop
```

## 处理冲突

```bash
# 当 PR 提示有冲突时
git checkout feat/你的分支
git pull origin master
# 解决冲突 → git add → git commit
git push origin feat/你的分支
```

## 紧急修复（hotfix）

```bash
# 直接从 master 拉修复分支
git checkout master
git pull
git checkout -b fix/紧急bug

# 修复 → push → 创建 PR → 快速审核 → 合入

# 合入后同步其他分支
git checkout master
git pull
git checkout feat/正在开发的分支
git rebase master
```

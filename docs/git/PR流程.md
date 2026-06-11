# Git 上传与 PR 全流程

## 一次完整的功能开发提交流程

```bash
# ============================================================
# 1. 从 master 创建功能分支
# ============================================================
git checkout master
git pull origin master
git checkout -b feat/你的功能名

# ============================================================
# 2. 开发 → 提交（遵循 Conventional Commits）
# ============================================================
# 改代码...

git add <改动的文件>
git commit -m "feat: 功能描述"

# 可多次提交
git add <文件>
git commit -m "fix: 修复描述"

# ============================================================
# 3. 生成 CHANGELOG
# ============================================================
git-cliff --output CHANGELOG.md
git add CHANGELOG.md
git commit -m "docs: 更新 CHANGELOG"

# ============================================================
# 4. 推送到 GitHub
# ============================================================
# 注意：WSL2 下 git push 经常连不上 GitHub，去 Windows PowerShell 执行

# PowerShell 中先设代理（国内需要）
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890

git push -u origin feat/你的功能名

# ============================================================
# 5. 创建 PR
# ============================================================
# 方式一：浏览器打开 GitHub → Pull requests → New pull request
# 方式二：命令行
gh pr create \
  --title "feat: 功能简述" \
  --body "## Summary
<改动说明>

## Test Plan
- [ ] 测试项1
- [ ] 测试项2" \
  --base master

# ============================================================
# 6. 审查通过后合并 → 打 Tag 发版
# ============================================================
git checkout master
git pull origin master
git tag v0.4.0
git push --tags
```

## 提交规范（Conventional Commits）

| 前缀 | 用途 | 示例 |
|------|------|------|
| `feat:` | 新功能 | `feat: 通过卖家名批量导入` |
| `fix:` | Bug 修复 | `fix: is_current=0 导致页面不显示` |
| `docs:` | 文档变更 | `docs: 更新开发流程` |
| `refactor:` | 重构 | `refactor: 提取公共筛选逻辑` |
| `perf:` | 性能优化 | `perf: 优化产品查询SQL` |
| `chore:` | 杂项 | `chore: 更新 .gitignore` |

## 铁律

- **分支必须先本地开发 + 测试通过，才能 PR 合并 master**
- 禁止 `git push --force` 到 master
- 禁止提交 `temp_*.py`、`test_*.py` 等临时测试文件（已 `.gitignore`）
- push 前必须先 `git-cliff` 更新 CHANGELOG

## 代理配置（国内访问 GitHub）

```bash
# 设置代理（Clash 默认 7890，V2Ray 默认 10809）
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890

# 取消代理
git config --global --unset http.proxy
git config --global --unset https.proxy
```

## gh CLI 安装与登录

```bash
# 安装（Windows: winget, Mac: brew, Linux: apt）
winget install --id GitHub.cli
```

**方式一：交互登录**
```bash
gh auth login
# 选择 GitHub.com → HTTPS → 输入 token
```

**方式二：Token 直接登录（`gh auth login --with-token` 可能失败）**
```bash
# 直接用环境变量，绕过 gh auth login 的 scope 检查
GITHUB_TOKEN="ghp_xxx" gh pr create \
  --title "feat: 功能简述" \
  --body "..." \
  --base master
```

## 打 Tag + 生成 CHANGELOG

```bash
# 生成预览（不写文件）
git-cliff

# 生成完整 CHANGELOG
git-cliff --output CHANGELOG.md

# 只生成最新 tag 的变更（发版用）
git-cliff --latest --output CHANGELOG.md
```

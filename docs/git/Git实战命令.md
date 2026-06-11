# Git 实战命令笔记

基于本项目的实际使用场景，每一条都经过验证。

## 分支操作

```bash
# 查看所有分支（本地 + 远程）
git branch -a

# 查看当前分支
git branch --show-current

# 从远程 master 创建全新本地分支（强制覆盖）
git fetch origin master
git checkout -B feat/clean-master origin/master

# 放弃当前分支所有修改，直接切换到原分支的文件
git checkout -fB feat/clean-master origin/master

# 删除本地分支
git branch -D feat/docker-isolated-deploy

# 删除远程分支（谨慎）
git push origin --delete feat/old-branch
```

## 恢复与重置

```bash
# 放弃所有本地修改，回到远程最新版
git fetch origin master
git reset --hard origin/master
git clean -fd          # 同时删除未跟踪文件

# 回到本地 master
git checkout -B feat/clean-master master

# 从 master 恢复单个文件
git show master:frontend/src/api/selection.ts > frontend/src/api/selection.ts

# 查看某个文件在 master 上的内容（不覆盖）
git show master:java-backend/pom.xml

# 放弃工作区所有修改（未 add 的）
git checkout -- .

# 放弃暂存区（已 add 的）
git reset HEAD <file>
```

## 提交操作

```bash
# 查看修改状态（简洁版）
git status --short

# 查看具体改动
git diff                    # 未暂存的改动
git diff --cached           # 已暂存的改动
git diff origin/master..HEAD  # 与远程 master 的差异

# 选择性暂存
git add java-backend/sjzm-product/src/main/java/com/sjzm/product/service/AsinImportService.java

# 提交（Conventional Commits）
git commit -m "feat: 通过卖家名批量导入"

# 修改最后一次提交（不改 message）
git add <遗漏的文件>
git commit --amend --no-edit

# 从提交中移除某个文件（不删本地文件）
git rm -r --cached "docs/后备目录/"
git commit --amend --no-edit

# 查看最近提交
git log --oneline -10
git log --oneline master -5
```

## 远程与推送

```bash
# 查看远程仓库
git remote -v

# 拉取远程最新（不合并）
git fetch origin master

# 推新分支到远程
git push -u origin feat/clean-master

# 推送 tag
git push --tags

# 代理设置（国内必需）
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890

# 取消代理
git config --global --unset http.proxy
git config --global --unset https.proxy
```

## Tag 版本管理

```bash
# 给指定 commit 打 tag
git tag v0.1.0 c194579
git tag v0.2.0 cf40776
git tag v0.3.0 1b57e9a

# 查看所有 tag
git tag -l

# 删除本地 tag
git tag -d v0.1.0

# 删除远程 tag
git push origin --delete v0.1.0
```

## gh CLI

```bash
# 登录
gh auth login

# Token 登录（无交互）
echo "ghp_xxx" | gh auth login --with-token

# 环境变量方式
GITHUB_TOKEN="ghp_xxx" gh auth status

# 创建 PR
GITHUB_TOKEN="ghp_xxx" gh pr create \
  --title "feat: 功能简述" \
  --body "## Summary
<说明>" \
  --base master

# 查看 PR 列表
gh pr list
```

## git-cliff

```bash
# 初始化配置
git-cliff --init

# 预览（不写文件）
git-cliff

# 生成 CHANGELOG
git-cliff --output CHANGELOG.md

# 只生成最新 tag 的变更
git-cliff --latest --output CHANGELOG.md

# 调试（看哪些 commit 被跳过）
git-cliff -vv
```

## 实战教训

1. **`git add -A` 是毒药** — 会提交所有文件包括备份目录、未跟踪文件。用 `git add <具体文件>`。
2. **覆盖操作前先看内容** — `git show master:file > file` 前先 `head` 看一眼。
3. **远程 vs 本地 master 不一样** — `origin/master` 和 `master` 可能不同步，`git fetch` 后再操作。
4. **WSL2 的 git push 总是失败** — 网络问题，去 Windows PowerShell 里 push。
5. **多个分支同名** — `feat/docker-isolated-deploy` 同时存在于本地和远程，本地放弃后用 `origin/feat/docker-isolated-deploy` 还能取回。
6. **临时文件不提交** — `temp_*.py`、`test_*.py` 加 `.gitignore`，一劳永逸。

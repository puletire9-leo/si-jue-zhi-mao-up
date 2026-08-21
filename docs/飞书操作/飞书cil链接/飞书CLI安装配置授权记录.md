# 飞书 CLI 安装 · 配置 · 授权记录

> 2026-08-13 完成。目的：让 Agent 通过命令行操作飞书（多维表格建表/写记录、文档、消息等）。
> 官方指南：https://open.feishu.cn/document/no_class/mcp-archive/feishu-cli-installation-guide.md

## 一、成果

- CLI：`@larksuite/cli` v1.0.86，全局安装（`C:\Users\Admin\AppData\Roaming\npm\lark-cli.ps1`）
- SKILL：27 个 lark-* skill 安装并链接到 Claude Code（lark-base / lark-sheets / lark-doc 等）
- 登录账号：**刘淼**（open_id `ou_d4f5bfa88c93dfac0b879d47e82153cd`），Bot + User 身份均 ready
- 授权域：base（多维表格全套）、docs、sheets、drive、wiki
- 配置文件：`C:\Users\Admin\.lark-cli\hermes\config.json`（App Secret 存 Windows 凭据管理器，非明文）

## 二、凭证（另见 RDS system_config 表 category=feishu）

| 项 | 值 |
|----|-----|
| App ID | `cli_aaf7d3acf8ba9bdd` |
| App Secret | 见 `config/secrets` / RDS `system_config`，**不要写进仓库** |
| 品牌 | feishu（国内） |

## 三、安装步骤（全走本机代理 127.0.0.1:7890）

```powershell
$env:HTTPS_PROXY="http://127.0.0.1:7890"; $env:HTTP_PROXY="http://127.0.0.1:7890"
npm install -g @larksuite/cli
npx -y skills add https://open.feishu.cn --skill -y
```

## 四、踩过的坑（重要，下次直接照做）

### 坑 1：`config init` 在 Agent 环境被拒
报错 `config init is refused inside hermes context`。CLI 检测到 Agent 环境（OPENCLAW_HOME/HERMES_HOME），默认拒绝创建平行 app。
**解法**：用自己的 App 凭证时加 `--force-init`：
```powershell
# 见坑 2，secret 必须用文件喂 stdin
cmd /c "type secret.txt | lark-cli config init --app-id cli_aaf7d3acf8ba9bdd --app-secret-stdin --brand feishu --force-init"
```

### 坑 2（最隐蔽）：PowerShell 管道污染 stdin，导致 secret 校验失败 20002
`"secret" | lark-cli ... --app-secret-stdin` 会报 `20002 The client secret is invalid`，但**同样的凭证直接调飞书 API 能成功换 token**（已验证），说明凭证没错——是 PowerShell 的 `"..." |` 管道给 stdin 加了 UTF-16 编码/尾随换行，把 secret 弄脏了。
**解法**：把 secret 写成无 BOM、无换行的 UTF-8 文件，再用 `cmd /c type 文件 |` 喂 stdin：
```powershell
$tmp=[System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($tmp,"<FEISHU_APP_SECRET>",(New-Object System.Text.UTF8Encoding($false)))
# 文件应恰好 32 字节
cmd /c "type `"$tmp`" | lark-cli config init --app-id cli_aaf7d3acf8ba9bdd --app-secret-stdin --brand feishu --force-init"
Remove-Item $tmp -Force
```
**验证凭证是否有效**（绕开 CLI，直接调 API）：
```powershell
$body='{"app_id":"<FEISHU_APP_ID>","app_secret":"<FEISHU_APP_SECRET>"}'
Invoke-RestMethod -Uri "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal" -Method Post -Body $body -ContentType "application/json" -Proxy "http://127.0.0.1:7890"
# 返回 code:0 + tenant_access_token 即凭证正确
```

### 坑 3：`config bind --source hermes` 找不到 Hermes 配置
报 `failed to read Hermes config: open E:\项目\hermes\数据\hermes\.env`。本环境无 Hermes 配置文件。用自己的 App 凭证时**不要 bind**，直接 `config init --force-init`（坑 1）。

## 五、登录授权（device flow，Agent 标准流程）

CLI `auth login` 会阻塞等浏览器授权。Agent 用 `--no-wait --json` 拿链接发用户，用户确认后再 `--device-code` 续。

```powershell
# 1. 发起授权，拿 device_code + verification_url（domain 可重复传，不能逗号拼一个）
lark-cli auth login --no-wait --json --domain base --domain docs --domain sheets --domain drive --domain wiki

# 2. 生成二维码（--output 只接受当前目录相对路径）
lark-cli auth qrcode --output "./lark_auth_qr.png" "<verification_url>"

# 3. 用户在浏览器/飞书扫码确认后，用 device_code 完成
lark-cli auth login --device-code "<device_code>"

# 4. 验证
lark-cli auth status
```

- 身份选择：`user-default`（可访问个人资源）/ `bot-only`（更安全，无法访问个人日历邮件云盘）。本次选 user-default。
- 授权后 `search:docs:read`、`space:document:retrieve` 两个 scope 未授予（应用后台未开通/被禁用），不影响多维表格核心功能。
- Token 有效期：access 当日，refresh 到 8/20（7 天，自动续期）。
- 授权二维码含验证码，用完即删。

## 六、日常使用

后续操作飞书优先用 lark-* skill（`/lark-base`、`/lark-sheets` 等）或直接 `lark-cli` 命令。所有联网命令走代理 `127.0.0.1:7890`。

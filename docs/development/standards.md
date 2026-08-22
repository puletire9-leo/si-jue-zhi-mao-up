# 开发规范

> 本文同时描述“当前必须遵守的规则”和“迁移期附加规则”。
>
> 若文档与实现冲突，以代码事实为准：模块约束先看对应 `AGENTS.md`，生产路由先看 `frontend/nginx.conf`，再回写本文档。
>
> 生产部署例外：生产操作不从本文复制命令，唯一权威是 `docs/docker使用经验/部署流程.md`，统一入口是 `scripts/deploy/deploy_prod.ps1`。

## 规则分级

- 当前规则：今天改代码时就必须遵守。
- 迁移规则：系统处于 Java / Python / Selection Agent 并存阶段时必须遵守。
- 目标规则：仅能作为演进方向，不能当作已经落地的现状。

## 编码规范

### Java 后端

| 规则 | 说明 |
|------|------|
| 包名 | `com.sjzm.{layer}`，layer = common/config/controller/service/mapper/entity/security/util |
| 命名空间 | 全部使用 `jakarta.*`，禁止 `javax.*` |
| Controller | `@RestController` + `@RequestMapping(...)`；当前仓库 Java 接口以前缀 `/api/v1/...` 为主，新增接口必须与所属模块现有前缀保持一致 |
| Service | 接口 + Impl 实现类，Impl 加 `@Service` |
| Mapper | 继承 `BaseMapper<T>`，加 `@Mapper` |
| Entity | `@TableName` + `@TableId(type=ASSIGN_ID)` + `@TableLogic` |
| 响应格式 | 统一使用 `Result<T>`，禁止直接返回裸数据 |
| 异常 | 业务异常抛 `BusinessException`，禁止捕获后吞掉 |
| 配置 | 所有外部值走 `${ENV_VAR:defaultValue}` |
| 分层依赖 | 只能 `Controller -> Service -> Mapper`，禁止 Controller 直接注入 Mapper |

### Java 数据库结构对接

1. 新增 `@TableName` Entity 必须同步新增 `java-backend/sql/*.sql` 迁移文件。
2. Entity 新增字段必须同步补 `ALTER TABLE` 迁移；优先使用 `information_schema` 守卫，保证可重跑。
3. Java product 启动会运行 `SchemaGuard`，扫描实体并核对表/列。缺表/缺列时生产启动失败，这是设计约束，不要通过关闭检查绕过。
4. 生产部署前必须运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy/prod_preflight_check.ps1
```

预检包含 Docker Desktop 数据盘门禁，剩余空间低于 15 GB 时禁止构建或部署。

5. 新增 Java `/api/v1/{resource}` Controller 必须同步检查 `frontend/nginx.conf`，确保生产前端会转发到 Gateway，而不是落到 Python 兜底。

6. Agent/模型验证先跑受影响范围的静态检查和最小单测，优先复用 Maven/npm/pip/BuildKit 缓存；正式生产镜像同一组件一次任务只构建一次，禁止默认 `--no-cache` 或重复 build。

### Python 后端

| 规则 | 说明 |
|------|------|
| 路由 | `APIRouter` 挂载到 `/api/v1/{resource}` |
| 依赖注入 | FastAPI `Depends()` |
| 异步 | IO 操作必须用 `async/await` |
| 类型注解 | 所有函数参数和返回值必须有类型注解 |
| 配置 | 通过 `settings` (pydantic-settings) 读取，禁止硬编码 |

### 前端

| 规则 | 说明 |
|------|------|
| 组件 | PascalCase 命名，单文件组件 |
| API 文件 | `src/api/{module}.ts`，使用封装的 axios 实例；默认一个文件只面向一个后端拥有者 |
| 类型 | `src/types/` 定义共享类型 |
| 状态 | Pinia store，`src/stores/{name}.ts` |
| 样式 | SCSS，变量在 `src/styles/variables.scss` |

## 迁移期附加规则

### 路由与拥有者

1. 请求去向以 `frontend/nginx.conf` 为准，不以 README 口头说明为准。
2. 新增前端接口前，必须先确认它属于 `Java`、`Python` 还是 `Selection Agent`。
3. 只有当 `nginx.conf`、`src/api/*.ts`、后端真实路由三者一致时，接口才算接入完成。
4. 新增 Java `/api/v1/{resource}` 必须同步 Gateway 路由和 Nginx Java 白名单，禁止只改前端。

### 前端 API 设计

1. 一个 `src/api/*.ts` 文件尽量只服务一个后端拥有者。
2. 如果一个文件必须混合多个后端，文件头必须注明：
   - 默认拥有者
   - 例外路径
   - 迁移目标
3. 同一业务域不得长期保留两套主语义并行的 API 封装；兼容层要标注清楚并安排收口。

### 文档同步

1. 改代理规则时同步更新 `docs/api/README.md`。
2. 改分层规则或工具链约束时同步更新本文。
3. 代码事实与文档冲突时，先修代码或修文档，不能把冲突状态长期保留。

## Git 提交规范

```
<type>(<scope>): <subject>

type:
  feat:     新功能
  fix:      修复 bug
  refactor: 重构（不改变行为）
  docs:     文档变更
  style:    代码格式（不影响逻辑）
  perf:     性能优化
  test:     测试
  chore:    构建/工具/依赖

scope: java-backend / python-backend / frontend / docker / docs

示例:
  feat(java-backend): 添加产品批量导入接口
  fix(python-backend): 修复向量检索超时问题
  docs: 更新 API 路由分流文档
```

## 分支策略

```
main          ← 生产分支，受保护
  └── develop ← 开发主线
        ├── feat/xxx    ← 功能分支
        ├── fix/xxx     ← 修复分支
        └── refactor/xxx ← 重构分支
```

## 分层约束

```
Controller 层：接收请求、参数校验、调用 Service，禁止写业务逻辑
Service 层：  业务逻辑、事务管理、调用 Mapper/外部服务
Mapper 层：   数据访问，只做 SQL 操作，禁止业务判断
```

依赖方向严格单向：`Controller → Service → Mapper`

迁移期不得新增任何越层写法；历史遗留越层调用在重构时应优先回收。

## 工具链与检查

当前仓库已具备的检查入口：

- 前端：`lint`、`type-check`、`vitest`
- Java：Maven 构建与测试入口
- Python：README 提供 `pytest` 运行方式

当前仍需继续补齐的守门能力：

- 统一的 CI 检查入口
- Python 项目级 lint/type-check 配置
- Java 静态检查或更明确的最小测试门槛
- 更严格的 TypeScript 编译约束

## 安全规范

| 规则 | 说明 |
|------|------|
| 密钥 | 禁止提交到 Git，走 `.env` 文件 |
| SQL | 使用参数化查询，禁止字符串拼接 |
| 认证 | JWT Token，Bearer 方式 |
| CORS | 生产环境限制允许的 Origin |
| 文件上传 | 校验文件类型和大小 |

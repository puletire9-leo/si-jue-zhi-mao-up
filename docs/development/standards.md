# 开发规范

## 编码规范

### Java 后端

| 规则 | 说明 |
|------|------|
| 包名 | `com.sjzm.{layer}`，layer = common/config/controller/service/mapper/entity/security/util |
| 命名空间 | 全部使用 `jakarta.*`，禁止 `javax.*` |
| Controller | `@RestController` + `@RequestMapping("/api/{resource}")` |
| Service | 接口 + Impl 实现类，Impl 加 `@Service` |
| Mapper | 继承 `BaseMapper<T>`，加 `@Mapper` |
| Entity | `@TableName` + `@TableId(type=ASSIGN_ID)` + `@TableLogic` |
| 响应格式 | 统一使用 `Result<T>`，禁止直接返回裸数据 |
| 异常 | 业务异常抛 `BusinessException`，禁止捕获后吞掉 |
| 配置 | 所有外部值走 `${ENV_VAR:defaultValue}` |

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
| API 文件 | `src/api/{module}.ts`，使用封装的 axios 实例 |
| 类型 | `src/types/` 定义共享类型 |
| 状态 | Pinia store，`src/stores/{name}.ts` |
| 样式 | SCSS，变量在 `src/styles/variables.scss` |

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

## 安全规范

| 规则 | 说明 |
|------|------|
| 密钥 | 禁止提交到 Git，走 `.env` 文件 |
| SQL | 使用参数化查询，禁止字符串拼接 |
| 认证 | JWT Token，Bearer 方式 |
| CORS | 生产环境限制允许的 Origin |
| 文件上传 | 校验文件类型和大小 |

# ⚠️ [参考] Python后端 - 待废弃

> **状态**：此目录中的代码已迁移到Java后端，仅作为参考
>
> **迁移完成日期**：2026-05-08
>
> **最终删除日期**：项目稳定运行后删除

---

## 迁移状态

| 模块 | 状态 | Java对应 |
|------|------|----------|
| API接口 | ✅ 已迁移 | `java-backend/src/main/java/com/sjzm/controller/` |
| 业务服务 | ✅ 已迁移 | `java-backend/src/main/java/com/sjzm/service/` |
| 数据访问 | ✅ 已废弃 | Java直连MySQL |

---

## 保留到Python AI服务的模块

以下AI相关模块已迁移到 `python-ai/` 目录：

```
services/ai_vector_processing/     → python-ai/app/services/
services/image_service.py          → python-ai/app/services/
services/tencent_image_*          → python-ai/app/services/
services/baidu_image_*            → python-ai/app/services/
```

---

## 待删除清单

```
backend/
├── app/
│   ├── api/                      # [删除] 全部API接口
│   ├── services/                 # [删除] 业务服务（保留AI部分）
│   ├── repositories/             # [删除] 数据访问层
│   ├── middleware/               # [删除] 中间件
│   └── main.py                   # [删除] FastAPI入口
├── requirements.txt              # [删除] Python依赖
└── Dockerfile                    # [删除] Python容器配置
```

---

## 删除前的检查清单

- [ ] Java后端所有接口测试通过
- [ ] 前端对接Java后端正常
- [ ] Python AI服务独立运行正常
- [ ] 向量搜索功能正常
- [ ] 备份重要数据

---

## 如何删除Python后端

```bash
# 1. 备份
cp -r backend backend_bak_$(date +%Y%m%d)

# 2. 删除
rm -rf backend/

# 3. 更新docker-compose.yml，移除python-backend服务
```

---

*此文件应在删除Python后端后删除*

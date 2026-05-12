# Java后端高并发增强计划

> 项目：思觉智贸 - Java后端高并发优化
> 版本：v1.0
> 日期：2026-05-08
> 状态：规划中

---

## 一、现有技术栈 vs 高并发模板对比

### 1.1 已有的高并发特性 ✅

| 技术 | 现有状态 | 说明 |
|------|----------|------|
| **Undertow容器** | ✅ 已有 | 替代Tomcat，性能更优 |
| **Redis缓存** | ✅ 已有 | Spring Data Redis |
| **Caffeine本地缓存** | ✅ 已有 | L1缓存 |
| **Redisson分布式锁** | ✅ 已有 | 分布式锁实现 |
| **Resilience4j熔断** | ✅ 已有 | CircuitBreaker + RateLimiter |
| **异步处理** | ✅ 已有 | @EnableAsync |
| **Snowflake ID** | ✅ 已有 | 分布式ID生成 |
| **JWT认证** | ✅ 已有 | 无状态认证 |

### 1.2 需要增强的特性 ⚠️

| 技术 | 现有状态 | 优先级 | 复杂度 |
|------|----------|--------|--------|
| **多级缓存抽象层** | ❌ 无统一抽象 | 🔴 高 | 🟡 中 |
| **接口幂等性** | ❌ 无实现 | 🔴 高 | 🟢 低 |
| **消息队列** | ❌ 无 | 🟡 中 | 🟡 中 |
| **读写分离** | ❌ 无 | 🟡 中 | 🟡 中 |
| **虚拟线程** | ❌ 无(JDK17) | 🟢 低 | 🟢 低 |
| **BloomFilter防穿透** | ❌ 无 | 🟡 中 | 🟢 低 |
| **链路追踪** | ❌ 无 | 🟢 低 | 🟡 中 |
| **API网关** | ❌ 无 | 🟢 低 | 🟡 中 |
| **分库分表** | ❌ 无 | 🟢 低 | 🔴 高 |
| **分布式事务** | ❌ 无 | 🟢 低 | 🔴 高 |

---

## 二、推荐增强顺序（按优先级）

### 阶段一：稳定性保障（1-2天）⭐⭐⭐

#### 2.1.1 接口幂等性框架
**位置**：`config/IdempotentInterceptor.java`

```java
/**
 * 接口幂等性拦截器
 * - Token机制：下单/支付等关键操作
 * - 唯一键机制：数据库唯一索引
 * - 状态机机制：订单状态流转
 */
```

**文件**：`java-backend/src/main/java/com/sjzm/config/IdempotentInterceptor.java`

#### 2.1.2 缓存三大问题解决方案
**位置**：`service/MultiLevelCacheService.java`

```java
/**
 * 多级缓存服务
 * - BloomFilter防穿透
 * - 互斥锁防击穿
 * - 随机过期防雪崩
 */
```

**文件**：`java-backend/src/main/java/com/sjzm/service/MultiLevelCacheService.java`

#### 2.1.3 幂等注解 + 拦截器
```java
@Idempotent(key = "#orderId", expireTime = 60)
public Result<Order> createOrder(String orderId) { ... }
```

**文件**：`java-backend/src/main/java/com/sjzm/annotation/Idempotent.java`

---

### 阶段二：性能提升（2-3天）⭐⭐⭐

#### 2.2.1 线程池配置优化
**现有**：`AsyncConfig.java`（简单配置）

**增强**：分离核心业务/图片处理/导入导出三个线程池

```java
/**
 * 线程池配置
 * - core-pool-size: 10
 * - max-pool-size: 50
 * - queue-capacity: 200
 * - rejected: CallerRunsPolicy
 */
```

**文件**：`java-backend/src/main/java/com/sjzm/config/ThreadPoolConfig.java`

#### 2.2.2 数据库连接池优化
**位置**：`application.yml`

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 30
      minimum-idle: 10
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000
      pool-name: HikariCP-SJZM
      leak-detection-threshold: 60000
```

#### 2.2.3 Undertow参数调优
**位置**：`application.yml`

```yaml
server:
  undertow:
    io-threads: 8        # CPU核心数
    worker-threads: 256   # CPU*32
    buffer-size: 16384   # 16KB缓冲区
```

---

### 阶段三：异步解耦（3-5天）⭐⭐

#### 2.3.1 消息队列集成
**推荐**：RabbitMQ / Redis Stream（轻量级）

**场景**：
- 图片上传后异步处理
- 导入任务异步执行
- 消息通知推送

```java
/**
 * 消息队列服务
 * - OrderProducer: 发送消息
 * - OrderConsumer: 消费消息
 */
```

**文件**：`java-backend/src/main/java/com/sjzm/mq/`

#### 2.3.2 异步任务模板
```java
@Async("taskExecutor")
public CompletableFuture<Result<Order>> createOrderAsync(OrderRequest req) {
    // 并行查询
    CompletableFuture<Product> productFuture = productService.getProductAsync(req.productId());
    CompletableFuture<User> userFuture = userService.getUserAsync(req.userId());
    
    // 结果聚合
    return productFuture.thenCombineAsync(userFuture, (product, user) -> {
        return new OrderResult(product, user);
    });
}
```

---

### 阶段四：架构增强（5-7天）⭐

#### 2.4.1 读写分离
**方案**：ShardingSphere-JDBC（数据源路由）

**场景**：
- 产品查询（读多写少）
- 统计数据（只读）

```yaml
spring:
  shardingsphere:
    datasource:
      ds-master:
        url: jdbc:mysql://master:3306/sjzm
      ds-slave-0:
        url: jdbc:mysql://slave:3306/sjzm
    rules:
      readwrite-splitting:
        dataSources:
          prds:
            writeDataSourceName: ds-master
            readDataSourceNames: ds-slave-0
```

#### 2.4.2 链路追踪
**方案**：SkyWalking / Micrometer

```yaml
management:
  tracing:
    sampling:
      probability: 0.1  # 10%采样
  endpoints:
    web:
      exposure:
        include: health,prometheus,metrics
```

#### 2.4.3 API网关（可选）
**方案**：Spring Cloud Gateway

---

## 三、融合文件清单

### 3.1 需要新增的文件

| 文件路径 | 功能 | 优先级 | 复杂度 |
|----------|------|--------|--------|
| `config/IdempotentInterceptor.java` | 幂等性拦截器 | 🔴 | 🟢 |
| `annotation/Idempotent.java` | 幂等注解 | 🔴 | 🟢 |
| `config/ThreadPoolConfig.java` | 线程池配置 | 🔴 | 🟢 |
| `service/MultiLevelCacheService.java` | 多级缓存服务 | 🔴 | 🟡 |
| `filter/BloomFilterConfig.java` | BloomFilter配置 | 🟡 | 🟢 |
| `mq/MessageProducer.java` | 消息生产者 | 🟡 | 🟡 |
| `mq/MessageConsumer.java` | 消息消费者 | 🟡 | 🟡 |
| `config/JVMConfig.java` | JVM参数配置 | 🟡 | 🟢 |
| `config/DatabaseConfig.java` | 数据库连接池 | 🟡 | 🟢 |
| `controller/SeckillController.java` | 秒杀示例 | 🟢 | 🟡 |

### 3.2 需要修改的文件

| 文件路径 | 修改内容 | 优先级 |
|----------|----------|--------|
| `application.yml` | 添加HikariCP/Undertow优化配置 | 🔴 |
| `pom.xml` | 添加MQ/BloomFilter依赖 | 🔴 |
| `config/AsyncConfig.java` | 增强线程池配置 | 🔴 |
| `config/CaffeineConfig.java` | 添加统计和过期策略 | 🟡 |
| `config/RedisConfig.java` | 添加序列化配置 | 🟡 |

### 3.3 参考学习文件

| 文件 | 内容 |
|------|------|
| `spring-high-concurrency-template/阶段笔记/Phase16-消息队列RabbitMQ学习笔记.md` | MQ学习 |
| `spring-high-concurrency-template/阶段笔记/Phase17-虚拟线程JDK21学习笔记.md` | 虚拟线程 |
| `spring-high-concurrency-template/阶段笔记/Phase18-读写分离多数据源学习笔记.md` | 读写分离 |
| `spring-high-concurrency-template/阶段笔记/Phase19-容器优化Undertow学习笔记.md` | Undertow优化 |
| `spring-high-concurrency-template/阶段笔记/Phase20-链路追踪SkyWalking学习笔记.md` | 链路追踪 |
| `spring-high-concurrency-template/阶段笔记/Phase21-API网关学习笔记.md` | API网关 |
| `spring-high-concurrency-template/阶段笔记/Phase22-Nacos服务注册与发现学习笔记.md` | 服务发现 |

---

## 四、实施计划

### 第一步：幂等性框架（0.5天）

```
1. 添加依赖
   └── pom.xml: 添加Redisson幂等支持

2. 创建注解
   └── annotation/Idempotent.java

3. 创建拦截器
   └── config/IdempotentInterceptor.java

4. 注册拦截器
   └── config/WebMvcConfig.java
```

### 第二步：多级缓存服务（1天）

```
1. 创建缓存服务
   └── service/MultiLevelCacheService.java

2. 添加BloomFilter
   └── config/BloomFilterConfig.java

3. 增强现有Service
   └── service/ProductService.java
   └── service/SelectionService.java
```

### 第三步：线程池+连接池优化（0.5天）

```
1. 增强线程池配置
   └── config/ThreadPoolConfig.java

2. 优化数据库配置
   └── application.yml: HikariCP参数

3. 优化Undertow配置
   └── application.yml: Undertow参数
```

### 第四步：消息队列集成（2-3天）

```
1. 添加MQ依赖
   └── pom.xml: Redis Stream / RabbitMQ

2. 创建生产者
   └── mq/MessageProducer.java

3. 创建消费者
   └── mq/MessageConsumer.java

4. 改造现有接口
   └── ImageService: 图片处理异步化
   └── ImportService: 导入任务异步化
```

---

## 五、预期效果

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| **QPS** | ~1k | ~5k-10k | 5-10x |
| **接口响应时间** | 200ms | <50ms | 4x |
| **缓存命中率** | 无统计 | >80% | - |
| **超卖率** | <1% | 0% | ✓ |
| **系统可用性** | 99% | 99.9% | ✓ |

---

## 六、后续扩展

### 可选增强项

| 技术 | 适用场景 | 复杂度 |
|------|----------|--------|
| **分库分表** | 数据量>1000万 | 🔴 |
| **分布式事务** | 跨库操作 | 🔴 |
| **虚拟线程** | JDK21升级后 | 🟢 |
| **服务网格** | 微服务化 | 🔴 |

---

*文档创建时间：2026-05-08*
*参考：spring-high-concurrency-template 高并发模板*

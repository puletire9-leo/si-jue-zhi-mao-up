package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.entity.DengZongShop;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface DengZongShopMapper extends BaseMapper<DengZongShop> {

    @Select("<script>" +
        "SELECT t.* FROM (" +
        "  SELECT ds.*, " +
        "    ROW_NUMBER() OVER (PARTITION BY COALESCE(NULLIF(ds.parent_asin,''), ds.asin) " +
        "      ORDER BY CASE WHEN ds.bsr IS NULL OR ds.bsr &lt;= 0 THEN 999999999 ELSE ds.bsr END) as rn, " +
        "    COUNT(*) OVER (PARTITION BY COALESCE(NULLIF(ds.parent_asin,''), ds.asin)) as variantCount " +
        "  FROM deng_zong_shop ds WHERE ds.title IS NOT NULL" +
        "  <if test='marketplace != null'> AND ds.marketplace = #{marketplace}</if>" +
        "  <if test='month != null'> AND ds.month = #{month}</if>" +
        "  <if test='brand != null'> AND ds.brand LIKE CONCAT('%',#{brand},'%')</if>" +
        "  <if test='sellerName != null'> AND ds.seller_name LIKE CONCAT('%',#{sellerName},'%')</if>" +
        "  <if test='title != null'> AND ds.title LIKE CONCAT('%',#{title},'%')</if>" +
        "  <if test='category != null'> AND SUBSTRING_INDEX(ds.node_label_path, ':', 1) = #{category}</if>" +
        ") t WHERE t.rn = 1" +
        "<if test='sortBy != null and sortOrder != null'>" +
        "  ORDER BY " +
        "  <choose>" +
        "    <when test='sortBy == \"bsr\"'>t.bsr</when>" +
        "    <when test='sortBy == \"units\"'>t.units</when>" +
        "    <when test='sortBy == \"price\"'>t.price</when>" +
        "    <otherwise>t.bsr</otherwise>" +
        "  </choose>" +
        "  ${sortOrder}" +
        "</if>" +
        "<if test='sortBy == null'> ORDER BY t.bsr ASC</if>" +
        " LIMIT #{offset}, #{size}" +
        "</script>")
    List<DengZongShop> selectGroupedByParent(
            @Param("marketplace") String marketplace,
            @Param("month") String month,
            @Param("brand") String brand,
            @Param("sellerName") String sellerName,
            @Param("title") String title,
            @Param("category") String category,
            @Param("sortBy") String sortBy,
            @Param("sortOrder") String sortOrder,
            @Param("offset") int offset,
            @Param("size") int size);

    @Select("<script>" +
        "SELECT COUNT(*) FROM (" +
        "  SELECT COALESCE(NULLIF(ds.parent_asin,''), ds.asin) as grp" +
        "  FROM deng_zong_shop ds WHERE ds.title IS NOT NULL" +
        "  <if test='marketplace != null'> AND ds.marketplace = #{marketplace}</if>" +
        "  <if test='month != null'> AND ds.month = #{month}</if>" +
        "  <if test='brand != null'> AND ds.brand LIKE CONCAT('%',#{brand},'%')</if>" +
        "  <if test='sellerName != null'> AND ds.seller_name LIKE CONCAT('%',#{sellerName},'%')</if>" +
        "  <if test='title != null'> AND ds.title LIKE CONCAT('%',#{title},'%')</if>" +
        "  <if test='category != null'> AND SUBSTRING_INDEX(ds.node_label_path, ':', 1) = #{category}</if>" +
        "  GROUP BY COALESCE(NULLIF(ds.parent_asin,''), ds.asin)" +
        ") g" +
        "</script>")
    long countGroupedByParent(
            @Param("marketplace") String marketplace,
            @Param("month") String month,
            @Param("brand") String brand,
            @Param("sellerName") String sellerName,
            @Param("title") String title,
            @Param("category") String category);

    @Select("<script>" +
        "SELECT ds.seller_name as sellerName, ds.marketplace," +
        "  COUNT(DISTINCT COALESCE(NULLIF(ds.parent_asin,''), ds.asin)) as productCount," +
        "  COALESCE(SUM(ds.revenue), 0) as totalRevenue," +
        "  COALESCE(SUM(ds.units), 0) as totalUnits," +
        "  ROUND(AVG(ds.rating), 1) as avgRating," +
        "  MAX(ds.month) as latestMonth" +
        " FROM deng_zong_shop ds WHERE ds.title IS NOT NULL" +
        " <if test='marketplace != null'> AND ds.marketplace = #{marketplace}</if>" +
        " GROUP BY ds.seller_name, ds.marketplace" +
        " ORDER BY totalRevenue DESC" +
        "</script>")
    List<java.util.Map<String, Object>> selectSellerSummary(
            @Param("marketplace") String marketplace);
}
89

<system-reminder>
Contents of /mnt/f/项目/si-jue-zhi-mao-up/java-backend/CLAUDE.md:

# Java 后端 - Claude 自动加载上下文

> Spring Boot 4.0.4 + MyBatis-Plus 3.5.15 + Spring Cloud Gateway。详情见 [AGENTS.md](AGENTS.md)。

## 微服务模块

| 模块 | 端口 | 职责 |
|------|------|------|
| sjzm-gateway | 9000 | 网关（路由 + JWT 鉴权 + RBAC） |
| sjzm-user | 8001 | 用户认证 + 用户管理 |
| sjzm-product | 8002 | 竞品分析 + 评分引擎 + ASIN 导入 + 筛选预设 |
| sjzm-common | - | 公共组件（Result/JWT/注解/AOP/MQ/限流/缓存） |

## 当前状态

服务层全部实现，无 TODO 骨架。实际功能范围：

- ✅ 认证（登录/注册/刷新/登出 + JWT 黑名单）
- ✅ 竞品分析（卖家精灵 API + 多维过滤 + 分页）
- ✅ 评分引擎（多维加权 + S/A/B/C/D 等级 + 周标记）
- ✅ ASIN 导入（Excel 解析 + 批量导入 + 任务管理）
- ✅ 筛选预设（用户 5 槽位 CRUD）
- ✅ 网关（JWT + RBAC + 公开路径白名单）

**仍在 Python 后端：** 产品/选品/定稿/素材/运营商的 CRUD。

## 包结构约定

```
com.sjzm/
├── controller/   # @RestController，只做参数校验和路由
├── service/      # 接口 + impl/，业务逻辑全部在此
├── mapper/       # 继承 BaseMapper<T>
├── entity/       # @TableName + @TableId(ASSIGN_ID) + @TableLogic
├── config/       # 配置类
├── security/     # JWT 认证
├── annotation/   # 自定义注解（限流/缓存/追踪）
├── aspect/       # AOP 切面
└── mq/           # RocketMQ 生产者/消费者
```

## 铁律

1. **新增 Entity**: 必须 `@TableName` + `@TableId(type=IdType.ASSIGN_ID)` + `@TableLogic`
2. **新增 Controller**: `@RestController` + `@RequestMapping` + `@Tag`（Swagger）
3. **新增 Service**: 先写接口再写 Impl，Impl 加 `@Service`
4. **新增 Mapper**: 继承 `BaseMapper<T>`
5. **响应统一**: `Result.success(data)` / `Result.error(message)`
6. **配置**: `${ENV_VAR:default}` 占位，禁止硬编码
7. **禁止**: Controller 写业务 / Mapper 写判断 / Controller 直接注入 Mapper / 反向调用

## 版本兼容

已验证的 Spring Boot 4.0.4 生态：
- MyBatis-Plus: 3.5.15（`spring-boot4-starter`，非 `boot-starter`）
- Spring Cloud: 2025.1.1（Oakwood）
- Spring Cloud Alibaba: 2025.1.0.0
- Redisson: 4.0.0

</system-reminder>
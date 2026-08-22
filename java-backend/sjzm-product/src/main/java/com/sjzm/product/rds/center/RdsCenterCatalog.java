package com.sjzm.product.rds.center;

import java.util.List;
import java.util.Map;

/**
 * 系统数据库连接与 API 绑定的静态清单。
 * 连接参数本身只来自 {@code config/public/*.env} 与 {@code config/secrets/*.env}，
 * 这里只登记「谁连哪套库、哪些接口走哪套池」，方便 RDS 管理中心展示。
 */
public final class RdsCenterCatalog {

    private RdsCenterCatalog() {
    }

    public static List<Map<String, Object>> pools() {
        return List.of(
                pool("sjzm-user-ai-platform", "sjzm-user", "ai_platform",
                        "USER_MYSQL_*", "user-prod.env",
                        "登录与用户、系统配置凭证总账。本服务不持有该池，连通性见 Python USER_MYSQL 探测。",
                        false),
                pool("sjzm-product-primary", "sjzm-product", "sijuelishi",
                        "RDS_*（缺省回退 MYSQL_*）", "prod.env",
                        "竞品/评分/ASIN/自动化审计等主库 Mapper。生产有 RDS_HOST 时与领星池同实例。",
                        true),
                pool("sjzm-product-rds", "sjzm-product", "sijuelishi",
                        "RDS_*", "prod.env",
                        "领星事实、财务日报、运营物流、Listing。写入必须走 RdsBatchWriteService。",
                        true),
                pool("python-business", "python / celery", "sijuelishi",
                        "RDS_*（缺省回退 MYSQL_*）", "prod.env",
                        "产品/选品/定稿/素材/运营商/导入导出。生产有 RDS_HOST 时改连远程。",
                        false),
                pool("python-user-center", "python", "ai_platform",
                        "USER_MYSQL_*", "user-prod.env（user 容器）/ 环境注入",
                        "Python 侧用户中心只读/兼容池，与 sjzm-user 同一库。",
                        false),
                pool("docker-mysql", "prod-mysql 容器", "sijuelishi",
                        "MYSQL_*", "prod.env",
                        "只给 Docker MySQL 容器初始化与宿主机脚本直连。应用业务池不再以 MYSQL_HOST=mysql 为准。",
                        false)
        );
    }

    public static List<Map<String, Object>> apiBindings() {
        return List.of(
                binding("java-user", "sjzm-user-ai-platform", "ai_platform", List.of(
                        "/api/v1/auth/**",
                        "/api/v1/users/**",
                        "/api/v1/system-config/**")),
                binding("java-product-primary", "sjzm-product-primary", "sijuelishi", List.of(
                        "/api/v1/competitor/**",
                        "/api/v1/asin-import/**",
                        "/api/v1/scoring/**",
                        "/api/v1/filter-config/**",
                        "/api/v1/filter-presets/**",
                        "/api/v1/method-cards/**",
                        "/api/v1/shop-profile/**",
                        "/api/v1/analysis-baseline/**",
                        "/api/v1/product-performance/**",
                        "/api/v1/product-sales/**",
                        "/api/v1/category-baseline/**",
                        "/api/v1/category-dislocation/**",
                        "/api/v1/element-discovery/**",
                        "/api/v1/seller/**",
                        "/api/v1/sellersprite-config/**",
                        "/api/v1/click-logs/**",
                        "/api/v1/deng-zong-shop/**",
                        "/api/v1/blue-ocean/**",
                        "/api/v1/clean-layer/**",
                        "/api/v1/subcategory-alias/**",
                        "/api/v1/ai-selection-pool/**",
                        "/api/v1/nonstandard-carrier/**",
                        "/api/v1/brs-ranking/**",
                        "/api/v1/product-line/**",
                        "/api/v1/modules/automation/**",
                        "/api/v1/modules/lingxing/request-center/**",
                        "/api/v1/modules/roster/**",
                        "/api/v1/modules/shop-collection/**",
                        "/api/v1/modules/shop-candidates/**",
                        "/api/v1/modules/shop-premium/**",
                        "/api/v1/modules/shop-rating/**",
                        "/api/v1/modules/bazhuayu/**",
                        "/api/v1/modules/request-center/**",
                        "/api/v1/modules/developer-selection-library/**",
                        "/api/v1/modules/category-tree/**",
                        "/api/v1/modules/data-processing/**",
                        "/api/v1/modules/feishu/**",
                        "/api/v1/modules/rds-center/**")),
                binding("java-product-rds", "sjzm-product-rds", "sijuelishi", List.of(
                        "/api/v1/modules/lingxing/**（产品表现/Listing/财务事实，不含 request-center 审计表）",
                        "RdsBatchWriteService → rds.mapper / rds.finance.mapper")),
                binding("python-business", "python-business", "sijuelishi", List.of(
                        "/api/v1/products/**",
                        "/api/v1/selection/**",
                        "/api/v1/final-drafts/**",
                        "/api/v1/images/**",
                        "/api/v1/import/**",
                        "/api/v1/export/**",
                        "/api/v1/tags/**",
                        "/api/v1/file-links/**",
                        "/api/v1/material-library/**",
                        "/api/v1/carrier-library/**",
                        "/api/v1/product-recycle/**",
                        "/api/v1/selection-recycle/**",
                        "/api/v1/recycle-bin/**",
                        "/api/v1/reports/**",
                        "/api/v1/statistics/**",
                        "/api/v1/announcement/**",
                        "/api/v1/members/**",
                        "/api/v1/lingxing/**",
                        "/api/v1/product-data/**",
                        "/api/v1/download-tasks/**",
                        "/api/v1/health",
                        "Celery worker 同一业务库"))
        );
    }

    private static Map<String, Object> pool(String id, String owner, String database,
                                            String envKeys, String configFile, String purpose,
                                            boolean liveInProduct) {
        return Map.of(
                "id", id,
                "owner", owner,
                "database", database,
                "envKeys", envKeys,
                "configFile", configFile,
                "purpose", purpose,
                "liveInThisService", liveInProduct);
    }

    private static Map<String, Object> binding(String id, String poolId, String database,
                                               List<String> routes) {
        return Map.of(
                "id", id,
                "poolId", poolId,
                "database", database,
                "routes", routes);
    }
}

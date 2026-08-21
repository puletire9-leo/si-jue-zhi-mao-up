# 艾为系统（sijue-main）可复用 API 与参数整理

> 生成日期：2026-08-13
> 分析来源：`艾为系统/sijue-main/cool-admin-midway`（Midway.js + TypeORM）
> 目标：把项目中所有外部 API 对接的**代码与配置**集中整理，供后续复用/迁移参考。
> 事实依据：均标注源文件与行号，基于代码本身，非口头描述。

---

## 0. 总览

### 0.1 参数存储机制：`base_sys_param`（“参数列表”页）

菜单「系统设置 → 参数列表」(`/sys/param`) 与「数据管理」下的字典/回收站/文件管理是同一套 base 框架能力。真正承载 **API 凭证与配置** 的是 `base_sys_param` 表。

- 实体：`BaseSysParamEntity`（`src/modules/base/entity/sys/param.ts`）
  - 字段：`keyName`(唯一键) / `name` / `data`(text) / `dataType`(0-字符串 1-富文本 2-文件) / `remark`
- 服务：`BaseSysParamService`（`src/modules/base/service/sys/param.ts`）
  - `dataByKey(key)`：带缓存读取（`param:{key}`），dataType=0 时尝试 `JSON.parse`
  - `modifyAfter()`：修改后重建全部参数缓存
- 业务代码里读取有两种写法：
  - 注入 `baseSysParamService.dataByKey('xxx')`（走缓存）
  - 直接注入 `baseSysParamRepo.findOne({ where: { keyName: 'xxx' } })`（直连表）

程序会**自动回写**部分 keyName（各服务的 access_token / 过期时间等），见下文各服务。

### 0.2 外部服务清单

| 服务 | 类别 | 认证方式 | 配置源 | 主要代码 |
|------|------|----------|--------|----------|
| 领星 LingXing ERP | ERP 数据 | OpenAPI 签名+token / 爬虫登录 auth-token | `base_sys_param` | `utils/lingxing/*` |
| SIF | 关键词工具 | JWT Token（24h，Header 自动续期） | `base_sys_param` | `utils/sif/sifUtils.ts` + `service/sifKeyword.ts` |
| 卖家精灵 OpenAPI | 选品数据 | `secret-key` 请求头 | `base_sys_param` | `utils/sellerSpriteUtils.ts` |
| 卖家精灵 网页版 | 选品数据 | Cookie + Playwright 自动登录 | `base_sys_param` | `utils/maijiajingling/SellerspriteUtil.ts` |
| Oxylabs | 代理爬虫 | HTTP Basic Auth | `base_sys_param` | `service/OxylabsService.ts` |
| 阿里云 ImageSearch | 以图搜图 | AccessKey(AK/SK) | `base_sys_param` | `service/ImageSearchUtil.ts` |
| 八爪鱼 Bazhuayu | 采集平台 | OAuth2 password/refresh_token | `base_sys_param` | `utils/bazhuayu/bazhuayuUtils.ts` |
| 百度翻译 | 翻译 | APPID + MD5 签名 | `base_sys_param` | `service/baidu_translate.ts` + `service/sifKeyword.ts` |
| Qwen-MT / OpenAI | 翻译/AI 回退 | Bearer（apiKey） | 环境变量 / `designTaskAi` | `service/baidu_translate.ts` |
| 快递100 Kuaidi100 | 物流轨迹 | customer/key/secret + MD5/SHA256 签名 | `base_sys_param`(JSON) | `service/bsr_purchase_order_logistics.ts` |
| AI Listing(SEO 工具) | 文案生成 | Bearer Token | `base_sys_param` | `service/search_threads.ts` |
| 钉钉 DingTalk | 通知 | 企业内部应用 topapi（appKey/appSecret/agentId + access_token） | **环境变量** | `service/dingtalk_notify.ts` |

### 0.3 base_sys_param keyName 全清单

| keyName | 服务 | 含义 | 程序自动回写 |
|---------|------|------|:---:|
| `lxHost` | 领星 | OpenAPI host | |
| `appId` | 领星 | OpenAPI app_key（兼作 AES 签名密钥） | |
| `appSecret` | 领星 | OpenAPI 密钥 | |
| `access_token` | 领星 | 当前 token | ✅ |
| `token_expiration` | 领星 | token 过期时间戳(ms) | ✅ |
| `lingxing_account` | 领星 | 爬虫登录账号 | |
| `lingxing_password` | 领星 | 爬虫登录密码 | |
| `lingxing_data_fetch_mode` | 领星 | 取数模式 1=爬虫 / 2=OpenAPI（默认1） | |
| `sifHost` | SIF | API 主机 | |
| `sifSecretId` | SIF | 换 Token 的 SecretId | |
| `sifAccessToken` | SIF | 持久化 Access Token | ✅ |
| `sifTokenExpiration` | SIF | Token 过期时间戳(ms) | ✅ |
| `seller_sprite_api_host` | 卖家精灵 OpenAPI | API 主机 | |
| `seller_sprite_secret_key2` | 卖家精灵 OpenAPI | secret-key（请求头认证） | |
| `sellersprite_cookie` | 卖家精灵 网页版 | 登录 Cookie | ✅ |
| `oxy_api_name` | Oxylabs | API 用户名 | |
| `oxy_api_pwd` | Oxylabs | API 密码 | |
| `aliyun_imagesearch_accessKeyId` | 阿里云图搜 | AK ID | |
| `aliyun_imagesearch_accessKeySecret` | 阿里云图搜 | AK Secret | |
| `aliyun_imagesearch_instanceName` | 阿里云图搜 | 实例名 | |
| `bzyHost` | 八爪鱼 | API 主机 | |
| `bzyUsername` | 八爪鱼 | 平台账号 | |
| `bzyPassword` | 八爪鱼 | 平台密码 | |
| `bzyAccessToken` | 八爪鱼 | 访问令牌 | ✅ |
| `bzyRefreshToken` | 八爪鱼 | 刷新令牌 | ✅ |
| `bzyTokenExpiration` | 八爪鱼 | 过期时间戳(ms) | ✅ |
| `baiduTranslateAppId` | 百度翻译 | APPID | |
| `baiduTranslateKey` | 百度翻译 | 密钥（MD5 签名用） | |
| `kuaidi100_config` | 快递100 | 全量配置 JSON（含 customer/key/secret/userid） | |
| `ai_listing_bearer` | AI Listing | 外部 SEO 工具 Bearer Token | |

> 钉钉、Qwen-MT/OpenAI 翻译 **不用** `base_sys_param`，走环境变量 / `designTaskAi` 配置。

---

## 1. 领星 LingXing ERP

> 核心：`utils/lingxing/lingxingUtils.ts`（3317行）、`lingxingOpenApiMapper.ts`、`openapi-node-sdk/{openapi,request,utils}.ts`
> 两条通道：**OpenAPI**（`openapi.lingxing.com`，签名+token）与 **爬虫内部接口**（`gw.lingxingerp.com` / `erp.lingxing.com`，登录 auth-token）。由 `lingxing_data_fetch_mode`（1=爬虫，2=OpenAPI）切换。

### 1.1 认证

**OpenAPI 签名算法**（`utils.ts:14-35`, `openapi.ts:12-20`）
1. 过滤空值/null，key 按字典序排序
2. 对象/数组值 `JSON.stringify`，其余 `String()`，拼 `key=value&key=value`
3. `MD5(paramsUrl).toUpperCase()`
4. `AES-ECB/Pkcs7`，用 `appKey`(=appId) 加密 → base64
5. 结果 `encodeURIComponent`
- 基准参数：`access_token`、`app_key`、`timestamp`(秒) + 业务 params
- GET：全部拼 query；非 GET：baseParam(含 sign) 走 query、业务 params 走 JSON body

**Token 获取/刷新**
| 用途 | 方法 | 路径 | 位置 |
|------|------|------|------|
| 获取 access_token | POST | `/api/auth-server/oauth/access-token`（query: appId,appSecret） | `openapi.ts:43-57` |
| 刷新 token | POST | `/api/auth-server/oauth/refresh`（query: appId,refreshToken） | `openapi.ts:59-74` |
- 刷新触发：`forceRefresh` / 无 token / 距过期 <10 分钟（`lingxingUtils.ts:1091-1138`）
- 过期时间 = `Date.now()+expires_in*1000`，回写 `access_token`/`token_expiration`
- 失效重试：响应 `throwable` 含 `"access token not match"` → 强刷重发一次

**爬虫登录**（`login()`, `lingxingUtils.ts:343-429`）
1. `POST {crawler}/newadmin/api/passport/getLoginSecretKey` → `secretKey/secretId`
2. AES-128-ECB/PKCS7 加密密码（密钥补齐/截断 16 字节）
3. `POST {crawler}/newadmin/api/passport/login` → `token/uid/zid/companyId/envKey`
- 组装 `auth-token`、`x-ak-uid`、`x-ak-zid`、`x-ak-company-id`、`x-ak-env-key` header，缓存内存 2h
- 爬虫响应 `code===-2` → 强刷 header 重发一次；登录失败重试 3 次退避

**默认值**（`lingxingUtils.ts:150-162`，被 base_sys_param 覆盖）
| 变量 | 默认值 |
|------|--------|
| host | `https://openapi.lingxing.com` |
| appId | `ak_xn2kRvp3xNxz8` |
| appSecret | `3/4Pn5Cfm7E//BVCF/D86w==` |
| crawler_host | `https://gw.lingxingerp.com` |
| erp_host | `https://erp.lingxing.com` |

### 1.2 API 端点

**OpenAPI（带签名）**
| 方法 | 路径 | 用途 | 位置 |
|------|------|------|------|
| POST | `/api/auth-server/oauth/access-token` | 获取 token | `openapi.ts:44` |
| POST | `/api/auth-server/oauth/refresh` | 刷新 token | `openapi.ts:61` |
| POST | `/erp/sc/data/mws/listing` | Listing 列表（按 sid 分页，length=1000） | `lingxingUtils.ts:713+` |
| POST | `/erp/sc/routing/fbaSug/asin/getSourceList` | FBA 补货建议来源（按 ASIN） | `:1522` |
| POST | `/erp/sc/routing/fbaSug/msku/getSourceList` | FBA 补货建议来源（按 MSKU） | `:1521` |
| POST | `/bd/profit/statistics/open/msku/list` | MSKU 利润统计（毛利/成本/头程/汇率） | `:2239,2358` |
| POST | `/basicOpen/multiplatform/profit/report/msku` | 多平台利润报表(MSKU，200+字段) | `:3101` |
| POST | `/bd/productPerformance/openApi/asinList` | 产品表现(ASIN，160+字段) | `:3251` |
| POST | `/erp/sc/routing/storage/product/set` | 回写品名到领星 ERP | `:3021` |

**爬虫（带 auth-token）**
| 方法 | 路径 | 用途 | 位置 |
|------|------|------|------|
| POST | `{crawler}/newadmin/api/passport/getLoginSecretKey` | 取登录加密密钥 | `:348` |
| POST | `{crawler}/newadmin/api/passport/login` | 登录 | `:377` |
| POST | `{crawler}/listing-api/api/product/showOnline` | Listing 在线商品分页（length=200） | `:542` |
| POST | `{crawler}/sc/restocking-center/amazon/source/fbaValidList` | FBA 库存可用明细 | `:1198` |
| POST | `{crawler}/sc/restocking-center/amazon/source/fbaShippingList` | FBA 在途明细 | `:1221` |
| POST | `{crawler}/sc/restocking-center/amazon/source/localValidList` | 本地可用明细 | `:1246` |
| POST | `{crawler}/sc/restocking-center/amazon/source/purchaseShippingList` | 待交付明细 | `:1269` |
| POST | `{crawler}/sc/restocking-center/amazon/source/purchasePlanList` | 采购计划明细 | `:1293` |
| POST | `{crawler}/sc/restocking-center/amazon/source/fbaShippingPlanList` | 预计发货量明细 | `:1316` |
| POST | `{erp}/api/fba_shipment/showShipment_v2` | FBA 货件列表(v2) | `:1933` |
| POST | `{erp}/api/product/lists` | 本地产品列表（创建时间） | `:2138` |
| GET  | `{erp}/api/tool_pricing/products` | 定价工具（长宽高 back_size） | `:2278,2434` |

### 1.3 关键参数/返回（摘要）
- `/erp/sc/data/mws/listing`：请求 `sid/offset/length(1000)`，按 ASIN 加 `asin/search_field/search_value`；返回 list/rows/source_list 兼容抽取
- `showOnline`：请求 `offset/length(200)/search_field/search_value/exact_search/sids/status/is_delete...`；成功 `code===1`；`parseListingData` 映射约 90 字段
- `fbaSug/*/getSourceList`：`{sid, asin|msku, type, mode:1}`，type：1=FBA可用 2=FBA在途 3=本地可用 5=待交付 6=采购计划
- 利润报表/产品表现：`offset/length/startDate/endDate`，默认近 7/14 天；分别 200+/160+ 字段动态映射，存整条 `raw_data`

### 1.4 限流/重试/分页
- 常量：`CONCURRENT_LIMIT=20`、`PAGE_SIZE=200`、`OPEN_API_LISTING_PAGE_SIZE=1000`、`REQUEST_INTERVAL=500ms`、`HEADER_EXPIRE_TIME=2h`
- 显式 sleep：爬虫 Listing 批内 500ms；FBA 明细逐条 300ms；利润统计批间 3000ms；长宽高每页 1000ms；利润报表/产品表现 2000ms；FBA 货件 batchSize=10 批间 500ms
- 重试：OpenAPI token not match / 爬虫 code=-2 各强刷重发一次
- 分页：统一 offset/length 游标

### 1.5 数据落库
| 实体 | 来源接口 | 触发方法 |
|------|----------|----------|
| `AppAmzBsrProductListingLingxingEntity` | showOnline / OpenAPI listing | `parseListingData`→`syncListingData` |
| `AppAmzBsrProductListingLingxingProcessEntity` | 上表分组去重 | `syncLingXingListingToDB` |
| `AppAmzBsrRestockingCenterLingxingEntity` | 补货中心 + FBA 明细 | `restockingService.syncRestockingData` |
| `AppAmzLingxingFbaShipmentReportEntity` | showShipment_v2 | `syncFbaShipmentList`（record_id upsert） |
| `AppAmzLingxingProfitReportMskuEntity` | profit/report/msku | `syncProfitReportMsku`（复合键 upsert） |
| `AppAmzLingxingProductPerformanceAsinEntity` | productPerformance/asinList | `syncProductPerformanceAsin`（复合键 upsert） |

> `syncLingXingListingToDB`（`:1663-1871`）是主编排事务：Listing→补货→FBA→回填毛利/长宽高→利润报表→产品表现，全部在一个 QueryRunner 事务内，失败回滚。

---

## 2. SIF（关键词工具）

> `utils/sif/sifUtils.ts`（HTTP 客户端 + Token）、`service/sifKeyword.ts`（业务调用）。JWT Token 24h，官方 1000 次/分钟。

### 2.1 认证（`sifUtils.ts`）
- 配置：`sifHost`(默认 `https://www.sif.com`) / `sifSecretId` / `sifAccessToken` / `sifTokenExpiration`（`init()` L45-63）
- 换 Token（`getAccessToken` L72-110）：刷新条件 = 强制 / 无 token / 提前 1 小时；端点 `GET {host}/api/user/token?secretid={id}`(15s)；成功 `code===1 && data`；有效期 `Date.now()+24h`，回写 DB
- **响应 Header 自动续期**（L157-170）：检查 `authorization/token` header，若变化则更新并回写、过期时间顺延 24h
- 失效检测（L371-385）：`code===-1||401` 或 message 含 token/授权/登录 → 强刷重试一次；HTTP 401/403 同样重试一次

### 2.2 API 端点（业务调用在 `sifKeyword.ts`）
| 方法 | 路径 | 用途 | 位置 |
|------|------|------|------|
| GET | `/api/user/token?secretid={id}` | 换 Access Token | sifUtils L87 |
| POST | `/api/search/external/v2/asinKeywordsSimpleGroupByMonthly?country={c}` | 按竞品 ASIN 反查关键词（月分组） | sifKeyword L589 |
| POST | `/api/search/external/v2/estSearchesHistory?country={c}` | 关键词搜索量历史（月/周） | L1309,L1394 |
| POST | `/api/search/external/v2/getAsinPageListByKeyword?country={c}` | 关键词前三页 ASIN 榜单 | L1998 |

- `{country}`：US/UK/DE/JP/CA/FR/ES/IT（`mapMarketplaceToSifCountry` L268-284）
- `estSearchesHistory`：`{keywords[], granularity:'month'|'week'}`，**单次≤1000 关键词**；返回 `data.list[]`(keyword/estSearchesNumHistoryMap/searchesRankHistoryMap)；先 month 再用 week 补当月

### 2.3 限流/重试
- 调用侧串行 + 200ms 间隔（`sifKeyword.ts` L586-604）
- 超时：token 15s / 业务 30s
- 日志表：`AppSifApiLogEntity`(`app_amz_sif_api_log`)，`recordApiLog`（异步不阻塞），字段含 credit_count=max(kw,asin,1)

---

## 3. 卖家精灵（两条独立线路）

> ⚠️ 与项目铁律「卖家精灵必须单进程串行」一致。

### 3.1 OpenAPI（`utils/sellerSpriteUtils.ts`，`api.sellersprite.com`）
- 认证：`secret-key` 请求头（**无签名**）。`seller_sprite_api_host`(默认 `https://api.sellersprite.com`) / `seller_sprite_secret_key2`(默认硬编码 `f1da3c1671aa4c539e3c0d00e96f475c`)
- **唯一端点**：`POST /v1/product/competitor-lookup`（竞品查询）
  - payload：`{marketplace, month, page, size:100, variation:"N", asins}`，**每批 40 个 ASIN**
  - month：最新月传 `'nearly'`，历史月传 `YYYYMM`
  - 业务错误：`code` 字符串以 `'ERROR'` 开头
  - 返回 items 兼容 `data.items`/`data.data.items`/`items`；字段极多（asin/title/price/bsr/units/fulfillment/sellerName/revenue... 见 `updateCompetitorLookupData`）
- 限流：滑动窗口 **35 次/分钟**（`MAX_REQUESTS_PER_MINUTE=35`），每次请求前检查
- 降级：3 级历史月降级（当月→规则月→上月），历史批量 <3 则跳过
- 日志：`AppTaskManagementEntity`(`bzy_task_management`) via `logUsage`

### 3.2 网页版（`utils/maijiajingling/SellerspriteUtil.ts`，`www.sellersprite.com`）
- 认证：`sellersprite_cookie` + Playwright(stealth) 自动登录
  - `isCookieValid()`：`GET /v2/welcome`(maxRedirects:0) 检测 302/401/403/登录页
  - `autoLoginAndRefreshCookie()`：无头 Chrome 登录，抓白名单 Cookie(Sprite-X-Token/rank-login-user/JSESSIONID...) 回写；遇 geetest 滑块抛错
  - 默认账号 `awei999`/`asdf456789`（L411-412）
- 端点：
  | 方法 | URL | 用途 |
  |------|-----|------|
  | POST | `/v3/api/competing-lookup` | 网页版竞品查询（`callApi`） |
  | POST | `/v3/api/traffic/extend/asin` | 网页版 ASIN 反查关键词（`callAsinKeywordApi`） |
  | GET | `/v2/welcome` | Cookie 探测 |
- **强串行 + 拟人化风控**（单例 `lastCallTime` 全局共享）：
  - `MIN_INTERVAL_MS=30s`（每分钟最多 2 次，两类请求互斥）
  - `PAGE_INTERVAL_MS=10s`（翻页）
  - 工作 1h → 休息 10min（`checkHourlyRest`）
  - 每 5 批/3 组穿插 `mockNormalBrowsing`
  - 重试 `RETRY_COUNT=2`，间隔 5000ms，超时 15s
  - 竞品缓存 TTL 24h（`asin_marketplace_date`）
- 日志：`AppSellerspriteApiLogEntity`(`app_amz_sellersprite_api_log`)，两条线共用

---

## 4. Oxylabs（代理爬虫）

> `service/OxylabsService.ts`，单端点 `POST https://realtime.oxylabs.io/v1/queries`，靠 body `source` 区分。

- 认证：HTTP Basic Auth，`oxy_api_name`/`oxy_api_pwd`（任一为空即抛错），`auth:{username,password}` 随每次请求
- 公共 body：`source, domain, query, parse:true, geo_location`
  - 域名映射 `mapMarketplaceToDomain`：美国→com / 英国→co.uk / 德国→de...（默认 com）
  - 邮编映射 `getPostcodeByMarketplace`：美国→20500 / 德国→10115 / 英国→M2 5BQ

| 方法 | source | 用途 |
|------|--------|------|
| `searchAmazon` | `amazon_search` | 关键词搜索（默认 pages=2），解析 organic+paid 按 pos 排序 |
| `getProductInfo` | `amazon_product` | 产品详情（14 字段：title/stars/reviews/price/bullet_points/bsr_html...） |
| `getProductImages` | `amazon_product` | 图片 URL（仅 `m.media-amazon.com`），单次不重试 |
| `getProductAds` | `amazon_product` | 广告位（ProductAd 归一化） |

- 限流/重试：**无**。异常吞掉返回空默认值
- 日志：
  - `recordApiUsage`→ `app_task_management`（按 `{apiName}-{YYYYMMDD}` 聚合当天次数）
  - `recordOxylabsApiLog`→ `app_oxylabs_api_log`（credit_count 固定 1，含 request_type/query_content/duration_ms/is_success/call_location）

---

## 5. 阿里云 ImageSearch（以图搜图）

> `service/ImageSearchUtil.ts`，SDK `@alicloud/imagesearch20201214`，固定 `cn-shenzhen`。

- 认证：AccessKey — `aliyun_imagesearch_accessKeyId`(必填)/`accessKeySecret`(必填)/`instanceName`(可空)
- `lazyInit()`：自旋锁(最多 10s) 等 TypeORM 就绪后建客户端与限流器
- SDK 方法：
  | 本类方法 | SDK | 用途 |
  |----------|-----|------|
  | `getSimilarityScore` | `searchImageByPicAdvance` | 按图搜+`strAttr` 过滤，取候选 ASIN 相似度 |
  | `getSimilarityScore2` | `searchImageByPicAdvance` | 取 `strAttr==='2'`(归档) 匹配分 |
  | `addImageAdvance` | `addImageAdvance` | 入库单图 |
  | `addImageAdvance2` | `addImageAdvance` | 入库单图（双属性） |
  - 图片以流上传（`urlToStream`），`categoryId:88888888`，`num:100`
  - 返回 `body.code`(0=成功)、`body.auctions[]`(productId/strAttr/score)
- **限流/重试（三服务中最复杂）**：
  - 限流器（`async-sema`）：API 10 次/秒 + 下载 10 次/秒
  - 超时：限流等待 5s / 下载 8-10s / 单请求 10s / 相似度总 30s / 添加图片总 30s
  - 重试：`urlToStream` 3 次指数退避；`getSimilarityScore` 2 次；`getSimilarityScore2` 双层（错误 3 次 + 0 分 5 次）
  - 不可恢复错误：图片不存在/非图片/认证失败/code∈{400,403,404}；`UnsupportedPicPixels` 上抛供删数据
- 缓存/日志：无 DB 日志表，仅 console（带 reqId）；无结果缓存

---

## 6. 八爪鱼 Bazhuayu（采集平台）

> `utils/bazhuayu/bazhuayuUtils.ts`，`@Singleton()`，OAuth2 password/refresh_token。

- 认证配置：`bzyHost`(默认 `https://openapi.bazhuayu.com`)/`bzyUsername`/`bzyPassword`/`bzyAccessToken`/`bzyRefreshToken`/`bzyTokenExpiration`；token_type 固定 `Bearer`
- Token 生命周期（`getAccessToken` L130-162）：刷新条件 = 强制/无 token/距过期 <10 分钟；优先 refresh 失败再 fetchNew；`expiration=Date.now()+expires_in*1000` 回写三 keyName
- 失效自愈：`error.code ∈ {Invalid.Grant, Invalid.Token}` → 强刷递归重试一次

| 方法 | HTTP + 路径 | 用途 |
|------|-------------|------|
| — | `POST {host}/token` (grant_type=password) | 获取新 token |
| — | `POST {host}/token` (grant_type=refresh_token) | 刷新 token |
| `stopTask` | `POST /cloudextraction/stop` | 停止云采集 |
| `getTaskStatuses` | `POST /cloudextraction/statuses` | 批量查任务状态 |
| `updateLoopItems` | `POST /task/updateLoopItems` | 更新循环项(URL 列表) |
| `markDataAsExported` | `POST /data/markexported` | 标记已导出 |
| `getAmzStructuredData` | `GET /data/notexported` | 拉未导出数据 |

- `getAmzStructuredData`：`size∈[1,1000]`，fieldMap 默认 asinKey=ASIN/imgUrlKey=imgurl1/sourceUrlKey=任务源网址/priceKey=价格；返回 `{total,current,structuredData[],requestId}`，无 ASIN 行过滤
- `taskStatus` 枚举：Unexecuted/Waiting/Extracting/Stopped/Finished
- 限流/重试：无限流；仅 token 失效强刷一次

---

## 7. 百度翻译 + Qwen-MT/OpenAI 回退

> `service/baidu_translate.ts`（`BaiduTranslateService`），另 `sifKeyword.ts` 内也内嵌百度翻译。

### 7.1 百度（MD5 签名）
- 凭证：`baiduTranslateAppId`/`baiduTranslateKey`（未配置抛错）
- 签名：`salt=Date.now()+随机`；`sign=md5(appid+q+salt+appkey)` 小写 hex
- 端点：`POST https://fanyi-api.baidu.com/api/trans/vip/translate`（form 编码，from='auto'/to）
  - 目标语言映射：en/de/fr→fra/it/es→spa/zh
  - 返回 `trans_result[].dst`；错误 `error_code`+`error_msg`
  - 批量限长：单请求 q ≤ 5200 字节（`buildBaiduTextChunks`）；`sifKeyword.ts` 版 QPS=1，分批间隔 1100ms，超时 15s

### 7.2 Qwen-MT / OpenAI 回退
- 凭证：`designTaskAi.apiKey` 或 `OPENAI_API_KEY`；baseURL 默认 `https://api.openai.com/v1`
- 端点：`POST {baseURL}/chat/completions`（model 默认 `qwen-mt-flash`，`translation_options.{source_lang,target_lang}`），或 OpenAI SDK
- 回退链（`enableOpenAIFallback=true`）：qwen-mt 失败 → 回退百度 / OpenAI
- 日志：`AppBaiduTranslateApiLogEntity`(`baidu_translate_api_log`)（sifKeyword 版）

---

## 8. 快递100 Kuaidi100（物流轨迹）

> 配置模型 `utils/kuaidi100/kuaidi100Config.ts`；识别解析 `kuaidi100AutoNumber.ts`；配置读写 `service/bsr_logistics_config.ts`；**实际 HTTP 调用** `service/bsr_purchase_order_logistics.ts`。

- 配置：`base_sys_param.keyName = kuaidi100_config`（JSON），敏感字段 customer/key/secret/userid（编辑脱敏，保存含 `*` 保留旧值）
- 签名（`signKuaidi100` L1987-1997）：`raw = paramStr + key + customer`；MD5 或 SHA256，`.toUpperCase()`

| 方法 | 端点(默认) | 用途 |
|------|------|------|
| POST | `https://poll.kuaidi100.com/poll/query.do` | 实时轨迹查询 |
| GET | `http://www.kuaidi100.com/autonumber/auto` | 单号智能识别快递公司 |

- 轨迹查询：form `customer/sign/param(JSON)`；`param` 含 com(公司编码)/num/resultv2/show/order/lang，可选 phone/needCourierInfo；成功 `status==='200'`；**手机验证错误码 `408`** → 换手机号重试
- 智能识别：GET `num/key`；解析首个候选 comCode/name
- 冷却/限流：成功失败后 `next_query_after = now + minQueryIntervalMinutes`（默认 ≥45 分钟，钳制 45–1440）；408 不进冷却；手动批量上限 100；超时查询 15s/识别 10s
- 日志：`query_log`（provider=kuaidi100_poll / kuaidi100_autonumber）

配置字段全集（`DEFAULT_KUAIDI100_CONFIG`）：enabled/env(test|prod)/customer/key/secret/userid/queryUrl/autoNumberUrl/autoIdentifyEnabled/autoIdentifyTimeoutMs/signType(MD5|SHA256)/resultv2(1|4|8)/show(0-3)/order(desc|asc)/lang(zh|en)/needCourierInfo/minQueryIntervalMinutes/timeoutMs

---

## 9. AI Listing（外部 SEO 工具 LangGraph 服务）

> `service/search_threads.ts`，基址 `http://seotools.woeau.com:2024`（明文 HTTP，硬编码）。

- 认证：`ai_listing_bearer`（Bearer Token，每次请求前 `init()` 重读库，未配置抛错）
| 方法 | 端点 | 用途 |
|------|------|------|
| POST | `/threads` | 创建任务线程 |
| POST | `/threads/{id}/runs` | 运行（`assistant_id="amazon_listing_generator"` 生成 / `"amazon_listing_translator"` 翻译） |
| GET | `/threads/{id}/state` | 获取状态/结果 |
| POST | `/threads/search` | 搜索线程 |
- 生成入参：`{language, keywords, competitor_titles, competitor_bullet_points, product_description, product_summary, bullet_points_title, product_args, key_parameters, package_info, duplicate_num}`
- 返回 `values`：title/title_more_freq/title_less_freq、bullet_point_0..7、long_tail_phrases、bullet_titles、description、brand_names[]、irrelevant_words；翻译 translated_title/description/bullet_points[]
- 限流/重试：**无**；⚠️ axios 未设置 timeout（潜在风险点）

---

## 10. 钉钉 DingTalk（通知）

> `service/dingtalk_notify.ts`（核心）、`listing_dingtalk_notify.ts`（业务封装）；配置在 `config.default.ts`/`config.prod.ts`。
> ⚠️ **不是 webhook 机器人（无 token/secret 加签）**，而是**企业内部应用「工作通知」(topapi)**，用 appKey/appSecret/agentId 换 access_token。

- 配置（全部环境变量）：
  | 字段 | 环境变量 |
  |------|----------|
  | enabled | `DINGTALK_ENABLED`(≠'false' 启用) |
  | appKey | `DINGTALK_APP_KEY` |
  | appSecret | `DINGTALK_APP_SECRET` |
  | agentId | `DINGTALK_AGENT_ID` |
  | adminBaseUrl | `DINGTALK_ADMIN_BASE_URL` |
  | notifyOnStartup | `DINGTALK_NOTIFY_ON_STARTUP` |
  | reserveOperatorMobiles | `DINGTALK_RESERVE_OPERATOR_MOBILES` |
  - 接收人：`DINGTALK_TEST_USERID` 优先，否则 `DINGTALK_TEST_MOBILE` → getbymobile 解析

| 方法 | 端点 | 用途 |
|------|------|------|
| GET | `https://oapi.dingtalk.com/gettoken` | 获取 access_token（缓存至过期前 60s） |
| POST | `https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2` | 发送工作通知（form 编码，msgtype=markdown） |
| POST | `https://oapi.dingtalk.com/topapi/message/corpconversation/getsendresult` | 查询投递结果 |
| POST | `https://oapi.dingtalk.com/topapi/v2/user/getbymobile` | 手机号→userid |

- asyncsend_v2：body 必须 form 编码（JSON 会致 errcode=41），字段 `agent_id/userid_list/to_all_user='false'/msg`；返回 task_id，`errcode!==0` 抛错
- 缓存：access_token 过期前 60s 复用；手机号→userid 缓存 TTL 15 分钟
- 无自动重试，超时统一 15000ms；Listing 通知内部 catch 不外抛，`void` 触发不阻塞主流程

---

## 附录：复用建议

1. **凭证托管统一化**：所有第三方凭证（除钉钉/OpenAI）都在 `base_sys_param`，迁移时导出这 30 个 keyName 即可完整搬运对接配置。自动回写的 token 类字段（access_token/expiration/cookie）无需手工填，首次运行会自动获取。
2. **签名算法差异**：领星=AES-ECB(MD5预处理)、百度/快递100=MD5(或SHA256)、SIF/八爪鱼/卖家精灵 OpenAPI=Token/Header，无签名。
3. **串行铁律**：卖家精灵（尤其网页版 30s 间隔单例串行）、SIF（200ms 间隔）需保持单进程串行，勿并发。
4. **限流强度**：阿里云图搜 10/s，卖家精灵 OpenAPI 35/min，领星靠 sleep 间隔，Oxylabs/八爪鱼/AI Listing 无限流。
5. **日志表**：`app_amz_sif_api_log` / `app_amz_sellersprite_api_log` / `app_oxylabs_api_log` / `baidu_translate_api_log` / `app_task_management`(bzy) 可用于 API 用量看板与计费核算。

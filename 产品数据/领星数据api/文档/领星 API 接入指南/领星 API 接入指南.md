# 领星 API 接入指南

---

## 1. 准备工作

### 1.1 申请 AppId 和 AppSecret

接入领星 API 公共服务前须先申请 AppId 和 AppSecret。AppId 和 AppSecret 是生成调用领星功能接口凭证 token 的必须参数，客户需要妥善保管。

操作流程见：如何申请企业的 appid 和 appsecret？

### 1.2 配置 IP 白名单

除申请 AppId 和 AppSecret 外，还需添加允许访问的外网 IP 白名单，二者缺一不可。

操作流程见：如何配置 ip 白名单？

---

## 2. 业务接口的调用

### 2.1 API 请求域名

```
https://openapi.lingxing.com
```

### 2.2 公共请求参数

所有业务接口请求都需要携带以下公共参数（通过 Query Params 传参）：

| 参数名 | 类型 | 描述 | 数据来源 |
|--------|:----:|------|----------|
| `access_token` | string | 通过接口获取的 token 信息 | access_token 获取 |
| `app_key` | string | APP ID | API 信息的查询与配置 |
| `timestamp` | string | 时间戳 | 1720408272 |
| `sign` | string | 接口签名 | 签名 sign 的生成 |

> **注意**：`sign` 作为参数，在传输时需要进行 **URL 编码**（url encode）以确保能够正常传递并被正确处理。

### 2.3 接口请求

#### 2.3.1 GET 类型请求

业务请求参数 + 公共请求参数，都拼接在 URL 上。

示例：发送业务参数为 `offset=0, length=100` 的 GET 请求，则 URL 参数拼装为：

```
access_token=44fa2eed-xxxx-xxxx-xxxx-8c6abe5ea6a4&
app_key=ak_xxxxxxxxxS&
timestamp=1720429074&
sign=NaUK5YE68tgyVz%2FheN8WqPvL%2F4zTp1zK7%2BX0H8iogzRNvt1hHQkYGvkzsZ%2B0e8VP&
offset=0&length=100
```

curl 示例：

```bash
curl --location --max-time 30000 'https://openapi.lingxing.com/xxx/xxx/xxx?access_token=44fa2eed-xxxx-xxxx-xxxx-8c6abe5ea6a4&app_key=ak_xxxxxxxxxS&timestamp=1720429074&sign=NaUK5YE68tgyVz%2FheN8WqPvL%2F4zTp1zK7%2BX0H8iogzRNvt1hHQkYGvkzsZ%2B0e8VP&offset=0&length=100'
```

#### 2.3.2 POST 类型请求

业务请求参数（放入 body，JSON 格式传参）+ 公共请求参数。

> **注意**：
> 1. body 参数中若嵌套有集合，需要转成 string 参与签名，否则会出现生成签名不正确的问题
> 2. 接口文档无特殊说明的，body 内参数均以 JSON 格式传输，header 中需要设置 `Content-type: application/json`

示例：发送业务参数为 `{"name": "kobe", "content": { "city": "lake", "age": "133" }}` 请求。

---

## 3. Access Token 获取及续约

### 3.1 Access Token 获取

`access_token` 是领星 API 调用的凭证，调用各业务接口时都需使用。开发者需要进行妥善保存。

详见接口文档：获取接口令牌-access_token

### 3.2 Access Token 续约

如果不想生成新的 token，可以根据 appId 和 access_token 续约。在 access_token 到期前调用续约接口，每次调用都会生成新的 refresh_token。

详见接口文档：续约接口令牌

> **注意**：`refresh_token` 的有效期为 **2 个小时**，一个 `refresh_token` **只能被使用一次**给 access_token 续约。如果需要再次续约，需要使用上次续约返回的 refresh_token。

---

## 4. 签名 Sign 的生成

### 4.1 生成规则

**a)** 请求包含的所有参数使用 **ASCII 排序**（所有的业务请求入参 + 3 个固定参数：`access_token`、`app_key`、`timestamp`）

**b)** 以 `key1=value1&key2=value2&...&keyn=valuen` 的格式拼接起来，其中 key 为参数键，value 为参数值

> value 为空**不参与生成签名**；value 为 null 会参与生成签名

**c)** 拼接之后的字符串用 **MD5（32 位）** 加密后转大写

**d)** 用 **AES/ECB/PKCS5PADDING** 对生成的 MD5 值加密，其中 AES 加密的密钥为 **appId**

### 4.2 重要说明

1. `sign` 作为参数，在传输时需要进行 **URL 编码**（url encode），以确保能够正常接收处理
2. 当 timestamp 以固定值参与签名生成 sign 时，sign 的有效期为 **2 分钟**，2 分钟后签名过期。建议调用业务接口时使用**实时的时间戳**生成签名 sign，不要缓存 sign
3. 当有文件上传需要生成签名时，需要文件原始名作为 key，文件 md5 加密的值为 value。格式：`key=originFileName`，`value=DigestUtils.md5Hex(InputStream())`

### 4.3 最佳实践（Java 示例）

```java
public static void main(String[] args) throws Exception {
    String appId = "xxx";

    Map<String, Object> queryParam = new HashMap<>();
    queryParam.put("timestamp", 1639734344);
    queryParam.put("access_token", "59cf5437-669b-49f5-83c4-3cc1d1404680");
    queryParam.put("app_key", appId);

    String sign = ApiSign.sign(queryParam, appId);
    queryParam.put("sign", sign);
    log.info("sign:{}", sign);

    HttpRequest<Object> build = HttpRequest.builder(Object.class)
            .method(HttpMethod.GET)
            .endpoint("xxxx")
            .path("erp/sc/data/local_inventory/brand")
            .queryParams(queryParam)
            .build();
    HttpResponse execute = HttpExecutor.create().execute(build);
    log.info("execute:{}", execute.readEntity(Object.class));
}
```

---

## 5. 限流算法说明

采用**改进的令牌桶算法**：

- 为每一个请求提供一个令牌；当请求到达时，如果桶中有足够的令牌，则会消耗一个令牌并允许请求通过
- 如果没有令牌，则请求被限流（错误码：3001008）
- 令牌回收基于：请求完成、异常、超时（2 分钟）
- 令牌桶的维度：`appId + 接口 url`

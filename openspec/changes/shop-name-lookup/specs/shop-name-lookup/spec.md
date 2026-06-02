## ADDED Requirements

### Requirement: 按店铺名同步卖家精灵数据
系统 SHALL 提供 `POST /api/v1/deng-zong-shop/sync` 端点，接受 `sellerName` 和 `marketplace` 参数，调用卖家精灵 API 查询该店铺所有产品并存入 `deng_zong_shop` 表。

#### Scenario: 成功同步店铺数据
- **WHEN** 用户提交 `{ "sellerName": "CLX-UK", "marketplace": "UK" }`
- **THEN** 系统调用卖家精灵 API，分页遍历所有产品，存入 `deng_zong_shop` 表，返回 `{ "total": 150, "inserted": 150 }`

#### Scenario: 店铺无数据
- **WHEN** 用户提交的店铺名在卖家精灵 API 中无数据
- **THEN** 系统返回 `{ "total": 0, "inserted": 0 }`

#### Scenario: 参数校验失败
- **WHEN** 用户提交空的 `sellerName` 或 `marketplace`
- **THEN** 系统返回 400 错误

### Requirement: 前端同步按钮
前端卖家管理弹窗 SHALL 在每行卖家记录后提供"同步数据"按钮。

#### Scenario: 点击同步按钮
- **WHEN** 用户点击某卖家的"同步数据"按钮
- **THEN** 显示加载状态，调用同步接口，完成后显示结果（成功条数）

#### Scenario: 同步失败
- **WHEN** 同步接口返回错误
- **THEN** 显示错误提示

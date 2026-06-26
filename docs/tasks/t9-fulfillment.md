# T9: 后端 fulfillment 参数

## CompetitorQueryRequest.java
新增字段: private List<String> fulfillment;

## CompetitorProductMapper.java
两个方法加 @Param("fulfillment") List<String> fulfillment 参数
SQL 加: AND cp.fulfillment IN <foreach> 过滤

## CompetitorService.java queryFromDb
- queryGroupedByParent 透传 fulfillment
- LambdaQueryWrapper 分支加: wrapper.in(CompetitorProduct::getFulfillment, ...)

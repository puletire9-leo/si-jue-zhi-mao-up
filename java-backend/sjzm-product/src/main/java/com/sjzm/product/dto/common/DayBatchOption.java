package com.sjzm.product.dto.common;

import lombok.Data;

/**
 * 「按天分组」批次下拉的统一选项模型——全系统各批次下拉共用。
 *
 * <p>取代原先分散在新品榜/精品榜/店铺选品/候选池各处、按 ISO 周聚合的返回结构。
 * 统一以「单天导入日期」为批次粒度：{@code value} 为 {@code yyyy-MM-dd}（如 2026-07-22），
 * 前端下拉直接以此为选中值，并回传该值做查询过滤。</p>
 *
 * <p>{@code sellerCount}/{@code productCount} 仅店铺相关下拉使用，其余下拉留空。</p>
 */
@Data
public class DayBatchOption {

    /** 批次值 = 单天导入日期 yyyy-MM-dd，前端下拉的选中值与查询回传值。 */
    private String value;

    /** 该批次内条数（商品数）。 */
    private Long count;

    /** 起始日期（按天分组时与 value 相同），保留以兼容前端范围展示。 */
    private String startDate;

    /** 结束日期（按天分组时与 value 相同）。 */
    private String endDate;

    /** 店铺数——仅店铺相关下拉填充。 */
    private Long sellerCount;

    /** 商品数——仅店铺相关下拉填充（去重后）。 */
    private Long productCount;
}

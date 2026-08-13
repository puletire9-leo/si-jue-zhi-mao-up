package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * BRS 榜单原始实体。
 * 表结构镜像 competitor_products，追加 batch_date / batch_label / source_run_id。
 * 八爪鱼按 Browse Node 深分页采出 ASIN、价格初筛后，交卖家精灵请求中心补数，
 * 返回字段映射进本表；八爪鱼原始字段不入库。
 *
 * <p>必须显式覆盖 {@code @TableName}——否则会继承父类 {@code CompetitorProduct} 的
 * "competitor_products"，导致查询/写入落到竞品原表而非 brs_ranking_raw。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("brs_ranking_raw")
public class BrsRankingRaw extends CompetitorProduct {

    /**
     * brs_ranking_raw 表由 {@code CREATE TABLE ... LIKE competitor_products} 建成，
     * 主键保留 {@code AUTO_INCREMENT}。此处覆盖父类的 {@code ASSIGN_ID}，与 DDL 保持一致，
     * 让 INSERT 不写 id 列、由数据库自增。
     */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 采集/请求周批次，格式 YYYYMMDD */
    private String batchDate;

    /** 批次名称，如 UK-kitchen-30页 */
    private String batchLabel;

    /** 溯源：卖家精灵请求中心 REQ 任务 runId */
    private String sourceRunId;
}

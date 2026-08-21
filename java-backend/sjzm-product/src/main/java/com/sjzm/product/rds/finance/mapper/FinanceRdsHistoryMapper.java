package com.sjzm.product.rds.finance.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Select;

import com.sjzm.product.rds.finance.model.FinanceStatusSnapshotRow;

import java.time.LocalDate;
import java.util.List;

/** 财务日报历史状态查询，所有表均来自 RDS。 */
@Mapper
public interface FinanceRdsHistoryMapper {

    /**
     * 截止目标日前已经产生过正销量的 ASIN。
     * marketplace 为空时合并 UK/DE，供旧案例口径回归；生产传 UK，禁止 DE 销量污染英国状态。
     */
    @Select("""
            SELECT DISTINCT history.asin
            FROM (
                SELECT asin
                FROM lingxing_sku_weekly_performance
                WHERE week_end < #{date}
                  AND volume > 0
                  AND asin IS NOT NULL AND asin <> ''
                  AND (#{marketplace} IS NULL OR marketplace = #{marketplace})
                UNION
                SELECT asin
                FROM lingxing_product_performance_daily
                WHERE data_date < #{date}
                  AND volume > 0
                  AND asin IS NOT NULL AND asin <> ''
                  AND (#{marketplace} IS NULL OR marketplace = #{marketplace})
            ) history
            """)
    List<String> selectPriorPositiveAsins(
            @Param("date") LocalDate date,
            @Param("marketplace") String marketplace);

    @Select("""
            SELECT MAX(snapshot_date)
            FROM lingxing_finance_asin_status_snapshot
            WHERE snapshot_date < #{date}
              AND marketplace = #{marketplace}
            """)
    LocalDate selectLatestStatusSnapshotDateBefore(
            @Param("date") LocalDate date, @Param("marketplace") String marketplace);

    @Select("""
            SELECT snapshot_date, marketplace, asin, out_of_stock, tag_names, product_create_date,
                   principal_names, developer_names, source_type
            FROM lingxing_finance_asin_status_snapshot
            WHERE snapshot_date = #{snapshotDate}
              AND marketplace = #{marketplace}
            """)
    List<FinanceStatusSnapshotRow> selectStatusSnapshot(
            @Param("snapshotDate") LocalDate snapshotDate,
            @Param("marketplace") String marketplace);

    @Select("""
            SELECT COUNT(*) FROM lingxing_finance_asin_status_snapshot
            WHERE snapshot_date = #{date} AND marketplace = #{marketplace}
            """)
    int countStatusSnapshotByDate(
            @Param("date") LocalDate date, @Param("marketplace") String marketplace);

    @Insert("""
            INSERT INTO lingxing_finance_asin_status_snapshot
                (snapshot_date, marketplace, asin, out_of_stock, tag_names, product_create_date,
                 principal_names, developer_names, source_type)
            VALUES
                (#{snapshotDate}, #{marketplace}, #{asin}, #{outOfStock}, #{tagNames}, #{productCreateDate},
                 #{principalNames}, #{developerNames}, #{sourceType})
            """)
    int insertStatusSnapshot(FinanceStatusSnapshotRow row);

    /** 批量写入日报日期冻结的 ASIN 状态快照。 */
    @Insert("""
            <script>
            INSERT INTO lingxing_finance_asin_status_snapshot
                (snapshot_date, marketplace, asin, out_of_stock, tag_names, product_create_date,
                 principal_names, developer_names, source_type)
            VALUES
            <foreach collection="rows" item="row" separator=",">
                (#{row.snapshotDate}, #{row.marketplace}, #{row.asin}, #{row.outOfStock},
                 #{row.tagNames}, #{row.productCreateDate}, #{row.principalNames},
                 #{row.developerNames}, #{row.sourceType})
            </foreach>
            </script>
            """)
    int insertStatusSnapshotBatch(@Param("rows") List<FinanceStatusSnapshotRow> rows);

}

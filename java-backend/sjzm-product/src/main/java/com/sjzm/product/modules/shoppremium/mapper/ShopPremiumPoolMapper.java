package com.sjzm.product.modules.shoppremium.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.shoppremium.entity.ShopPremiumPool;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface ShopPremiumPoolMapper extends BaseMapper<ShopPremiumPool> {

    /** 软删除恢复：同店已有 REMOVED 记录时，重置为 ACTIVE 并更新来源/原因/标签（不创建重复行）。 */
    @Update({"<script>",
        "UPDATE shop_premium_pool SET status='ACTIVE',",
        "source_type=#{sourceType}, source_id=#{sourceId}, reason=#{reason},",
        "tags_json=#{tagsJson}, quality_level=#{qualityLevel}, refresh_frequency=#{refreshFrequency},",
        "last_error_message=NULL, updated_at=NOW()",
        "WHERE marketplace=#{marketplace} AND seller_name=#{sellerName} AND status='REMOVED'",
        "</script>"})
    int restoreRemoved(@Param("marketplace") String marketplace,
                       @Param("sellerName") String sellerName,
                       @Param("sourceType") String sourceType,
                       @Param("sourceId") Long sourceId,
                       @Param("reason") String reason,
                       @Param("tagsJson") String tagsJson,
                       @Param("qualityLevel") String qualityLevel,
                       @Param("refreshFrequency") String refreshFrequency);

    /** 复抓抢锁：只有 ACTIVE + IDLE/FAILED 可进入 RUNNING。 */
    @Update("UPDATE shop_premium_pool SET refresh_status='RUNNING', updated_at=NOW() WHERE id=#{id} AND status='ACTIVE' AND refresh_status IN ('IDLE','FAILED')")
    int lockForRefresh(@Param("id") Long id);

    /** 复抓成功后回写：refresh_status=IDLE + last_fetch_run_id + last_fetch_date + next_fetch_date(按频率算)。 */
    @Update("UPDATE shop_premium_pool SET refresh_status='IDLE', last_fetch_run_id=#{fetchRunId}, last_fetch_date=#{fetchDate}, next_fetch_date=#{nextFetchDate}, last_error_message=NULL, updated_at=NOW() WHERE id=#{id}")
    int markRefreshSuccess(@Param("id") Long id, @Param("fetchRunId") String fetchRunId,
                           @Param("fetchDate") String fetchDate, @Param("nextFetchDate") String nextFetchDate);

    /** 复抓失败后回写：refresh_status=FAILED + last_error_message。 */
    @Update("UPDATE shop_premium_pool SET refresh_status='FAILED', last_error_message=#{errorMessage}, updated_at=NOW() WHERE id=#{id}")
    int markRefreshFailed(@Param("id") Long id, @Param("errorMessage") String errorMessage);

    /** 复抓任务停止后释放未开始的精品店：refresh_status=IDLE，保留提示。 */
    @Update("UPDATE shop_premium_pool SET refresh_status='IDLE', last_error_message=#{message}, updated_at=NOW() WHERE id=#{id} AND refresh_status='RUNNING'")
    int markRefreshStopped(@Param("id") Long id, @Param("message") String message);
}

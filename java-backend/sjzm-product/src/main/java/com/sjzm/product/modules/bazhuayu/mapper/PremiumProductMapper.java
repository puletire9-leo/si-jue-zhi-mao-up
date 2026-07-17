package com.sjzm.product.modules.bazhuayu.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.sjzm.product.entity.CompetitorProduct;
import com.sjzm.product.modules.bazhuayu.entity.PremiumProduct;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Map;

@Mapper
public interface PremiumProductMapper extends BaseMapper<PremiumProduct> {

    int insertOnDuplicateKeyUpdate(PremiumProduct product);

    int upsertRawBatch(@Param("list") List<PremiumProduct> products);

    /** 精品统一选品分页：复用业务层构造的竞品字段条件，只替换物理表。 */
    long selectCountForSelection(@Param("ew") Wrapper<CompetitorProduct> wrapper);

    List<PremiumProduct> selectListForSelection(@Param("ew") Wrapper<CompetitorProduct> wrapper);

    List<Map<String, Object>> selectVariantCountsByDedupKeys(
            @Param("marketplace") String marketplace,
            @Param("keys") List<String> dedupKeys);

    List<Map<String, Object>> selectCreatedWeeksWithCount(@Param("marketplace") String marketplace);

    List<Map<String, Object>> selectCategoriesWithCount(@Param("marketplace") String marketplace);

    List<Map<String, Object>> selectSellers(@Param("marketplace") String marketplace);

    /** 同站点已收到卖家精灵响应的 ASIN，用于精品跨任务请求前去重。 */
    List<String> selectEnrichedAsins(@Param("marketplace") String marketplace,
                                     @Param("asins") List<String> asins);
}

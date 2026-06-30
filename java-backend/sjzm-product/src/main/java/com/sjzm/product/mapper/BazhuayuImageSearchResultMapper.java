package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.bazhuayu.entity.BazhuayuImageSearchResult;
import org.apache.ibatis.annotations.Mapper;

/**
 * 八爪鱼以图识图结果 Mapper。
 * 放 com.sjzm.product.mapper（@MapperScan 只扫这个包）。
 */
@Mapper
public interface BazhuayuImageSearchResultMapper extends BaseMapper<BazhuayuImageSearchResult> {
}

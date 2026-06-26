package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.dto.WinnerTypeSummary;
import com.sjzm.product.entity.CategoryDislocation;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface CategoryDislocationMapper extends BaseMapper<CategoryDislocation> {

    int deleteByBaselineMonth(@Param("baselineMonth") String baselineMonth,
                              @Param("marketplace") String marketplace);

    int insertComputedSlices(@Param("baselineMonth") String baselineMonth,
                             @Param("marketplace") String marketplace);

    @Select("<script>" +
            "SELECT MAX(baseline_month) FROM category_dislocation " +
            "WHERE 1 = 1 " +
            "<if test='marketplace != null and marketplace != \"\"'> AND marketplace = #{marketplace}</if>" +
            "</script>")
    String selectLatestBaselineMonth(@Param("marketplace") String marketplace);

    List<CategoryDislocation> selectActionableSlices(@Param("marketplace") String marketplace,
                                                     @Param("baselineMonth") String baselineMonth,
                                                     @Param("heatSignal") String heatSignal,
                                                     @Param("limit") int limit);

    List<WinnerTypeSummary> selectWinnerTypeSummaries(@Param("canonicalKeys") List<String> canonicalKeys);
}

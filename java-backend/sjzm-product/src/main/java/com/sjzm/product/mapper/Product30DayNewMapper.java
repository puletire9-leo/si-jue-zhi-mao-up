package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.entity.Product30DayNew;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface Product30DayNewMapper extends BaseMapper<Product30DayNew> {

    int insertBatchIgnoreDup(@Param("list") List<Product30DayNew> list);
}

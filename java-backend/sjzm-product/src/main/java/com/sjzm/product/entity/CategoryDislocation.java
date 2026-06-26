package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("category_dislocation")
public class CategoryDislocation {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String marketplace;
    private String bsrId;
    private String canonicalKey;
    private String subCategory;
    private String baselineMonth;

    private Integer dengzongCount;
    private Integer otherCnCount;
    private Integer nonCnCount;
    private Integer totalSellers;
    private Integer productCount;

    private BigDecimal avgUnits;
    private BigDecimal dzShare;
    private BigDecimal nonCnShare;
    private BigDecimal dislocationScore;

    private String heatSignal;
    private LocalDateTime computedAt;
}

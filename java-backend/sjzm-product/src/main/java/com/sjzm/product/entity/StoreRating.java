package com.sjzm.product.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("store_ratings")
public class StoreRating {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String sellerName;
    private String marketplace;
    private Double ratingScore;
    private String ratingGrade;
    private String bestMatchSeller;
    private Double bestMatchScore;
    private Integer productCount;
    private Double overallScore;
    private Double matchScore;
    private LocalDateTime ratedAt;
}

package com.sjzm.product.modules.developerselection.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("developer_selection_library")
public class DeveloperSelectionLibraryItem {

    @TableId(type = IdType.ASSIGN_ID)
    @JsonSerialize(using = ToStringSerializer.class)
    private Long id;
    @JsonSerialize(using = ToStringSerializer.class)
    private Long userId;
    private String developerName;
    private String marketplace;
    private String asin;
    private String bucket;
    @JsonSerialize(using = ToStringSerializer.class)
    private Long batchId;
    @TableField(exist = false)
    private String batchName;
    private String originScene;
    private String originSource;
    private String snapshotKey;
    private String title;
    private String brand;
    private String imageUrl;
    private BigDecimal price;
    private Integer units;
    private Integer bsr;
    private Integer ratings;
    private BigDecimal rating;
    private Integer listingDays;
    private BigDecimal weightG;
    private String sellerName;
    private String nodeLabelPath;
    private String productUrl;
    private String snapshotJson;
    @TableLogic
    private Integer deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

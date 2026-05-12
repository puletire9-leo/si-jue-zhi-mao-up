package com.sjzm.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 运营商库回收站实体（对齐 Python 的 carrier_library_recycle_bin 表）
 */
@Data
@TableName("carrier_library_recycle_bin")
public class CarrierLibraryRecycleBin implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 原运营商ID */
    private Long carrierId;

    /** 运营商SKU */
    private String sku;

    /** 运营商名称 */
    private String carrierName;

    /** 批次 */
    private String batch;

    /** 开发人 */
    private String developer;

    /** 图片列表（JSON） */
    private String images;

    /** 参考图列表（JSON） */
    private String referenceImages;

    /** 状态 */
    private String status;

    /** 删除操作人ID */
    private Long deletedBy;

    /** 删除操作人姓名 */
    private String deletedByName;

    /** 删除时间 */
    private LocalDateTime deleteTime;

    /** 过期时间（默认30天后过期） */
    private LocalDateTime expiresAt;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}

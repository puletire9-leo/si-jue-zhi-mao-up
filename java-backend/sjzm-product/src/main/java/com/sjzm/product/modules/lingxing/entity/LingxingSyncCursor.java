package com.sjzm.product.modules.lingxing.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("lingxing_sync_cursor")
public class LingxingSyncCursor {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String dataType;

    private LocalDateTime lastSuccessTime;

    private String lastRunId;

    private Long syncCount;

    private Integer lastRecordCount;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}

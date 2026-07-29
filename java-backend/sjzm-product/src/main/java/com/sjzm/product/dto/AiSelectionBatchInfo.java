package com.sjzm.product.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * AI 选品批次信息 DTO。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiSelectionBatchInfo {

    private String batchId;
    private String batchLabel;
    private String pushedBy;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime pushedAt;

    /** 该批次的商品数量 */
    private Integer productCount;
}

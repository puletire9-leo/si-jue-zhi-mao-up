package com.sjzm.product.modules.shopcollection.dto;

import lombok.Data;

/**
 * 二维矩阵单元格。rowKey/colKey 取值随矩阵不同：
 * 销量×时间：rowKey=A/B/C/D/UNKNOWN, colKey=NEW/GROWING/MATURE/OLD/UNKNOWN
 * 销量×注意：rowKey=销量层, colKey=GOOD_TENDENCY/NEUTRAL/ATTENTION_REVIEW/ATTENTION_STRONG/UNKNOWN
 * 时间×注意：rowKey=时间层, colKey=注意/倾向层
 */
@Data
public class ShopMatrixCell {
    private String rowKey;
    private String colKey;
    private Long productCount;
    private Long unitsSum;
    private Long m01HitCount;

    public ShopMatrixCell() {
    }

    public ShopMatrixCell(String rowKey, String colKey) {
        this.rowKey = rowKey;
        this.colKey = colKey;
        this.productCount = 0L;
        this.unitsSum = 0L;
        this.m01HitCount = 0L;
    }
}

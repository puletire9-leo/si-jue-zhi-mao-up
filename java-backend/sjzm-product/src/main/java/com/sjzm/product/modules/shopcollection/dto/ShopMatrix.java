package com.sjzm.product.modules.shopcollection.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 二维矩阵：固定行列顺序 + 稀疏单元格列表。前端按 rowKeys × colKeys 画网格，cells 缺失的格子按 0 处理。
 */
@Data
public class ShopMatrix {
    private String name;
    private String rowDim;
    private String colDim;
    private List<String> rowKeys = new ArrayList<>();
    private List<String> colKeys = new ArrayList<>();
    private List<ShopMatrixCell> cells = new ArrayList<>();
}

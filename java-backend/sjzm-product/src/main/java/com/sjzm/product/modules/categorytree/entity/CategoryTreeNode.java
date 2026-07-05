package com.sjzm.product.modules.categorytree.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 新品榜类目树节点（邻接表物化）。
 * 每行一个树节点，parent_label_path 指向父节点的 label_path，顶层为 null。
 * product_count = 该节点子树下去重 ASIN 数（父节点 = 子孙 ASIN 并集）。
 * 见 java-backend/sql/create_category_tree_node.sql
 */
@Data
@TableName("category_tree_node")
public class CategoryTreeNode {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 站点 UK/DE/US */
    private String marketplace;

    /** 层级，1=大类 */
    private Integer level;

    /** 本级类目名 */
    private String label;

    /** 从根到本节点的完整标签路径（:分隔） */
    private String labelPath;

    /** 父节点 label_path，顶层为 null */
    private String parentLabelPath;

    /** 亚马逊节点ID（对应该级） */
    private String nodeId;

    /** 榜单大类码，仅 level=1 有值 */
    private String bsrId;

    /** 去重 ASIN 数（含子孙） */
    private Integer productCount;

    /** 仅本级直接 ASIN 数 */
    private Integer directCount;

    /** 刷新批次（生成时间戳） */
    private String batchDate;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}

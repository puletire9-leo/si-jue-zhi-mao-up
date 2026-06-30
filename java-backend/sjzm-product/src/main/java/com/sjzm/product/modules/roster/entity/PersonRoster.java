package com.sjzm.product.modules.roster.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 人员名单（按职能收口）。替代散落各处的硬编码开发人/产品负责人/采购员名单。
 * role_type: developer(开发人)/operator(运营)/product_manager(产品负责人)/purchaser(采购员)。
 * 见 java-backend/sql/create_person_roster.sql
 */
@Data
@TableName("person_roster")
public class PersonRoster {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 姓名 */
    private String name;

    /** 职能：developer/operator/product_manager/purchaser */
    private String roleType;

    /** 排序权重，越小越前 */
    private Integer sortOrder;

    /** 是否启用 1启用 0停用 */
    private Integer enabled;

    /** 备注 */
    private String remark;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}

package com.sjzm.product.modules.bazhuayu.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("bazhuayu_task_mapping")
public class BazhuayuTaskMapping {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String taskName;
    private String functionKey;
    private String marketplace;
    private String taskId;
    /** 用户维护的任务分类，例如精铺、精品。 */
    private String taskCategory;
    /** 榜单任务是否执行现有初筛；关闭时全部 ASIN 直接进入精品数据链路。 */
    private Boolean initialFilter;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

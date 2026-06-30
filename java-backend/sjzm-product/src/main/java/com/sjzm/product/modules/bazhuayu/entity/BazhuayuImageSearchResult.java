package com.sjzm.product.modules.bazhuayu.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 八爪鱼以图识图结果。每行 = 某 source_asin 在某站点命中的一条相似品。
 * 按 source_asin 缓存：库里有则直接返回，强刷先删旧再写新。
 * 见 java-backend/sql/create_bazhuayu_image_search_result.sql
 */
@Data
@TableName("bazhuayu_image_search_result")
public class BazhuayuImageSearchResult {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 发起识图的源 ASIN */
    private String sourceAsin;

    /** 站点 UK/DE/US（本期固定 UK） */
    private String marketplace;

    /** 源图 URL */
    private String sourceImageUrl;

    /** 生成的视觉搜索 URL（UK=stylesnap） */
    private String searchUrl;

    /** 命中的相似品 ASIN */
    private String resultAsin;

    /** 命中品标题 */
    private String resultTitle;

    /** 命中品图片 URL */
    private String resultImage;

    /** 命中品价格原始文本 */
    private String resultPrice;

    /** 八爪鱼原始行 JSON（留痕，便于列映射核对） */
    private String rawJson;

    /** 八爪鱼云采集批次号 */
    private String lotNo;

    private LocalDateTime scrapedAt;

    private LocalDateTime createdAt;
}

package com.sjzm.product.modules.bazhuayu.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.sjzm.product.entity.CompetitorProduct;
import com.sjzm.product.mapper.BazhuayuImageSearchResultMapper;
import com.sjzm.product.mapper.CompetitorProductMapper;
import com.sjzm.product.modules.bazhuayu.entity.BazhuayuImageSearchResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 八爪鱼以图识图服务。
 *
 * 流程（英国单条）：取 ASIN 图 → 生成 stylesnap URL → updateLoopItems 写进英国任务 →
 *   startExtraction → 轮询等完成 → fetchAllData → 提取命中相似品 → 入库 → 返回。
 *
 * 缓存：按 source_asin。库里已有结果且非强刷则直接返回，不再跑八爪鱼（省时间+省配额）。
 *
 * 仅英国（marketplace=UK，stylesnap）。US/DE + 批量留后续。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BazhuayuImageSearchService {

    private static final String MARKETPLACE = "UK";

    private final BazhuayuClient client;
    private final BazhuayuConfigService configService;
    private final CompetitorProductMapper competitorMapper;
    private final BazhuayuImageSearchResultMapper resultMapper;

    // 八爪鱼以图识图结果原始字段候选名（须按真实采集核实，必要时在此补充）
    private static final String[] RESULT_ASIN_KEYS = {"ASIN", "asin", "Asin", "产品ASIN", "asin码", "结果ASIN"};
    private static final String[] RESULT_TITLE_KEYS = {"标题", "title", "Title", "产品标题", "商品标题", "名称"};
    private static final String[] RESULT_IMAGE_KEYS = {"图片", "图片链接", "image", "imageUrl", "img", "图片URL", "主图"};
    private static final String[] RESULT_PRICE_KEYS = {"价格", "price", "Price", "售价", "价格(£)"};

    /**
     * 对单个 ASIN 发起英国以图识图。
     * @param asin         源 ASIN
     * @param forceRefresh true=忽略缓存重新跑八爪鱼
     * @return 命中相似品结果列表
     */
    public List<BazhuayuImageSearchResult> searchByAsin(String asin, boolean forceRefresh) {
        if (!StringUtils.hasText(asin)) {
            throw new IllegalArgumentException("ASIN 不能为空");
        }
        String normAsin = asin.trim().toUpperCase();

        // 1. 缓存命中：库里已有该 asin 结果且非强刷 → 直接返回
        if (!forceRefresh) {
            List<BazhuayuImageSearchResult> cached = listResults(normAsin);
            if (!cached.isEmpty()) {
                log.info("以图识图缓存命中 asin={} 共 {} 条", normAsin, cached.size());
                return cached;
            }
        }

        // 2. 取源图 URL（UK 站优先，无则取任一站点该 asin 的图）
        String imageUrl = resolveImageUrl(normAsin);
        if (!StringUtils.hasText(imageUrl)) {
            throw new IllegalStateException("ASIN " + normAsin + " 在 competitor_products 中无图片 URL，无法识图");
        }

        // 3. 取英国以图识图任务 ID
        String taskId = configService.getTaskId(BazhuayuConfigService.FUNC_YITUSHITU, MARKETPLACE);
        if (!StringUtils.hasText(taskId)) {
            throw new IllegalStateException("英国以图识图任务未在映射中配置（yitushitu.UK）");
        }

        // 4. 构造 stylesnap URL，写进任务循环
        String searchUrl = ImageSearchUrlBuilder.build(MARKETPLACE, imageUrl);
        client.updateLoopItems(taskId, "UrlList", List.of(searchUrl));

        // 5. 启动云采集
        String lotNo = client.startExtraction(taskId);
        log.info("以图识图启动 asin={} taskId={} lotNo={}", normAsin, taskId, lotNo);

        // 6. 阻塞轮询等完成（复用现成超时/取消机制）
        boolean finished = client.waitForExtraction(taskId);
        if (!finished) {
            throw new IllegalStateException("以图识图采集未完成（超时或被停止），asin=" + normAsin);
        }

        // 7. 拉全部结果
        List<JsonNode> rows = client.fetchAllData(taskId);
        if (!rows.isEmpty()) {
            // 字段核实：首行原始 JSON 打日志，据实修正候选字段名
            log.info("以图识图结果首行原始 JSON（字段核实用）: {}", rows.get(0).toString());
        }

        // 8. 删旧结果 → 写新结果
        resultMapper.delete(new LambdaQueryWrapper<BazhuayuImageSearchResult>()
                .eq(BazhuayuImageSearchResult::getSourceAsin, normAsin)
                .eq(BazhuayuImageSearchResult::getMarketplace, MARKETPLACE));

        LocalDateTime now = LocalDateTime.now();
        List<BazhuayuImageSearchResult> saved = new ArrayList<>(rows.size());
        for (JsonNode row : rows) {
            BazhuayuImageSearchResult r = new BazhuayuImageSearchResult();
            r.setSourceAsin(normAsin);
            r.setMarketplace(MARKETPLACE);
            r.setSourceImageUrl(imageUrl);
            r.setSearchUrl(searchUrl);
            r.setResultAsin(BazhuayuRowMapper.pick(row, RESULT_ASIN_KEYS));
            r.setResultTitle(BazhuayuRowMapper.pick(row, RESULT_TITLE_KEYS));
            r.setResultImage(BazhuayuRowMapper.pick(row, RESULT_IMAGE_KEYS));
            r.setResultPrice(BazhuayuRowMapper.pick(row, RESULT_PRICE_KEYS));
            r.setRawJson(row.toString());
            r.setLotNo(lotNo);
            r.setScrapedAt(now);
            r.setCreatedAt(now);
            resultMapper.insert(r);
            saved.add(r);
        }
        log.info("以图识图完成 asin={} 命中 {} 条", normAsin, saved.size());
        return saved;
    }

    /** 查缓存结果（不触发采集）。 */
    public List<BazhuayuImageSearchResult> listResults(String asin) {
        if (!StringUtils.hasText(asin)) return List.of();
        return resultMapper.selectList(new LambdaQueryWrapper<BazhuayuImageSearchResult>()
                .eq(BazhuayuImageSearchResult::getSourceAsin, asin.trim().toUpperCase())
                .eq(BazhuayuImageSearchResult::getMarketplace, MARKETPLACE)
                .orderByAsc(BazhuayuImageSearchResult::getId));
    }

    /** 取 ASIN 的源图 URL：UK 站优先，回退任一站点。 */
    private String resolveImageUrl(String asin) {
        CompetitorProduct uk = competitorMapper.selectOne(new LambdaQueryWrapper<CompetitorProduct>()
                .eq(CompetitorProduct::getAsin, asin)
                .eq(CompetitorProduct::getMarketplace, MARKETPLACE)
                .isNotNull(CompetitorProduct::getImageUrl)
                .ne(CompetitorProduct::getImageUrl, "")
                .last("LIMIT 1"));
        if (uk != null && StringUtils.hasText(uk.getImageUrl())) return uk.getImageUrl();

        CompetitorProduct any = competitorMapper.selectOne(new LambdaQueryWrapper<CompetitorProduct>()
                .eq(CompetitorProduct::getAsin, asin)
                .isNotNull(CompetitorProduct::getImageUrl)
                .ne(CompetitorProduct::getImageUrl, "")
                .last("LIMIT 1"));
        return any != null ? any.getImageUrl() : null;
    }
}

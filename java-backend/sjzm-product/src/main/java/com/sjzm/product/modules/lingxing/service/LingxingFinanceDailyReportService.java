package com.sjzm.product.modules.lingxing.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sjzm.product.rds.finance.mapper.FinanceRdsDailyMapper;
import com.sjzm.product.rds.finance.mapper.FinanceRdsHistoryMapper;
import com.sjzm.product.rds.finance.mapper.FinanceRdsSellerMapper;
import com.sjzm.product.rds.finance.mapper.FinanceRdsUnifiedDailyMapper;
import com.sjzm.product.rds.finance.mapper.FinanceRdsUnifiedMapper;
import com.sjzm.product.rds.finance.model.FinanceMarketplaceAsinRow;
import com.sjzm.product.rds.finance.model.FinanceStatusSnapshotRow;
import com.sjzm.product.rds.finance.model.FinanceListingDateRow;
import com.sjzm.product.rds.service.RdsBatchWriteService;
import com.sjzm.product.modules.lingxing.dto.FinanceDailyReportResult;
import com.sjzm.product.modules.lingxing.dto.FinanceDailyReportRow;
import com.sjzm.product.modules.lingxing.entity.LingxingProductPerformanceDaily;
import com.sjzm.product.modules.lingxing.entity.LingxingProductUnified;
import com.sjzm.product.modules.lingxing.entity.LingxingSeller;
import com.sjzm.product.modules.roster.service.PersonRosterService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 领星财务日报加工服务（FINANCE_DAILY_REPORT 核心逻辑）。
 *
 * <p>流程：
 * <ol>
 *   <li>完整请求在售 UK/DE 店铺数据（status=1 且 mid IN(4,5)），由领星统一换算为 GBP 后落 RDS；</li>
 *   <li>按 sid 上限 200 分批拉 productPerformance/asinList（summary=asin，单日窗口，
 *       多店铺请求页间/批间间隔 10s，令牌桶=1），当天返回行整包落库（含 raw_json），拉取时不筛统一表；</li>
 *   <li>首次成功日事实只写一次；已存在日期默认拒绝覆盖，仅当显式 allowRepull 时按需删除该日旧行再写入；</li>
 *   <li>从 RDS 周历史与既往日事实读取“历史曾出单”状态，复刻工作簿累计销量公式；</li>
 *   <li>日事实落库后，按当天 RDS 日事实重算该日统一表快照（国家+ASIN）；
 *       SKU 总量等于该日快照行数。禁止用最新统一表覆盖历史日。</li>
 * </ol>
 *
 * <p>本服务只负责数据侧（拉取/清洗/落库/加工），飞书发布由 automation 层 Job 编排，
 * 保持 lingxing 模块不反向依赖 feishu/automation。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LingxingFinanceDailyReportService {

    /** 两套显式口径：旧案例先验公式回归，生产使用 UK+DE 统一 GBP。 */
    public enum CalculationProfile {
        LEGACY_CASE,
        PRODUCTION_GBP
    }

    private static final String PATH = "/bd/productPerformance/openApi/asinList";
    private static final int PAGE_SIZE = 1000;
    private static final int SID_BATCH = 200;
    private static final int RDS_FACT_BATCH_SIZE = 200;
    private static final int RDS_STATUS_BATCH_SIZE = 500;
    private static final long MULTI_STORE_INTERVAL_MS = 10_000L;
    private static final DateTimeFormatter DF = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    /** 数据采集保持完整：UK、DE 都请求并保留来源站点。 */
    private static final List<String> REQUEST_MARKETPLACES = List.of("UK", "DE");
    /** 财务业务层不分国家；金额由领星在请求阶段统一换算成 GBP。 */
    private static final String REPORT_SCOPE = "ALL";
    private static final String REPORT_CURRENCY = "GBP";

    /** 2026-08-01—11 案例中的历史开发人结构。 */
    static final List<String> LEGACY_CASE_DEVELOPERS = List.of(
            "蒋舒", "陈杨", "宋凤莉", "刘淼", "龙梦临", "周沁仪", "黄雨珊");

    /** 旧案例运营结构；仅用于案例回归，不参与生产名单。 */
    static final List<String> LEGACY_CASE_OPERATORS = List.of(
            "阳姣", "张奋奋", "尹心如", "余江燕", "李微微");

    /** 统一业务指标名（发布飞书时按目标表映射成业务名/内部名） */
    static final List<String> METRICS = List.of(
            "淘汰SKU", "季节性SKU", "SKU总数量", "动销＞90天的SKU", "未上架SKU", "断货SKU",
            "销量", "订单量", "销售额", "展示", "点击", "广告订单量", "广告销售额",
            "广告花费", "可用库存", "退款金额");

    /** 金额类指标（发布飞书/审计时按小数写，其余按整数写）。供 automation 层 Job 引用。 */
    public static final Set<String> MONEY_METRICS = Set.of("销售额", "广告销售额", "广告花费", "退款金额");

    private final LingxingClient client;
    private final FinanceRdsSellerMapper sellerMapper;
    private final FinanceRdsDailyMapper dailyMapper;
    private final FinanceRdsHistoryMapper queryMapper;
    private final FinanceRdsUnifiedMapper unifiedMapper;
    private final FinanceRdsUnifiedDailyMapper unifiedDailyMapper;
    private final RdsBatchWriteService rdsBatchWriteService;
    private final PersonRosterService personRosterService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 执行一次财务日报加工（不含飞书发布）。
     *
     * @param reportDate 目标日 yyyy-MM-dd
     * @return 加工结果（UK+DE 统一 GBP 的 5 维度动态行 + 各阶段耗时）
     */
    public FinanceDailyReportResult run(LocalDate reportDate) {
        return run(reportDate, true, true, true, false);
    }

    /**
     * 按阶段执行财务日报数据加工。
     *
     * @param reportDate 目标日期
     * @param pullFromLingxing true=从领星拉取；false=复用 RDS 已落库日事实
     * @param persistFacts 仅在拉取领星时生效，是否把事实幂等写入 RDS
     */
    public FinanceDailyReportResult run(LocalDate reportDate,
                                        boolean pullFromLingxing,
                                        boolean persistFacts) {
        return run(reportDate, pullFromLingxing, persistFacts, persistFacts, false);
    }

    /**
     * @param persistStatusSnapshot 是否保存本次派生状态快照；可与拉取、事实落库、飞书发布独立控制
     * @param allowRepull 仅允许“不落事实”的诊断性重拉；已存在日期永远不允许原地覆盖
     */
    public FinanceDailyReportResult run(LocalDate reportDate,
                                        boolean pullFromLingxing,
                                        boolean persistFacts,
                                        boolean persistStatusSnapshot,
                                        boolean allowRepull) {
        Map<String, Long> durations = new LinkedHashMap<>();
        FinanceDailyReportResult result = new FinanceDailyReportResult();
        result.setReportDate(reportDate);

        List<LingxingProductPerformanceDaily> facts = new ArrayList<>();
        if (pullFromLingxing) {
            int existingRows = dailyMapper.countByDate(reportDate, null);
            if (existingRows > 0) {
                if (persistFacts && allowRepull) {
                    timed("deleteStaleDailyFacts", durations,
                            () -> deleteDailyFacts(reportDate));
                } else if (persistFacts || !allowRepull) {
                    throw new IllegalStateException("RDS 已存在目标日期事实，拒绝重复拉取或覆盖: "
                            + reportDate + ", rows=" + existingRows);
                }
            }
            int fetchedRows = 0;
            for (String marketplace : REQUEST_MARKETPLACES) {
                List<Long> sids = timed("resolveSellers" + marketplace, durations,
                        () -> activeSids(marketplace));
                if (sids.isEmpty()) {
                    throw new IllegalStateException("无有效 " + marketplace + " 店铺 sid");
                }
                PullResult pulled = timed("pullAsinList" + marketplace, durations,
                        () -> pullDailyFacts(sids, reportDate, marketplace));
                facts.addAll(pulled.facts());
                fetchedRows += pulled.fetchedRows();
            }
            result.setFetchedRows(fetchedRows);
            result.setTeamRows(facts.size()); // 兼容旧审计字段；当前语义为统一表目标来源行数。

            // ③ 可选落库（首次写入；禁止删除覆盖）
            List<LingxingProductPerformanceDaily> pulledFacts = facts;
            int stored = persistFacts
                    ? timed("storeDailyFacts", durations, () -> storeDailyFacts(reportDate, pulledFacts))
                    : 0;
            result.setStoredRows(stored);
        } else {
            // 复用阶段：不调用领星，直接读取 RDS 日事实。
            facts = timed("loadStoredDailyFacts", durations,
                    () -> dailyMapper.selectFinanceFacts(reportDate, null));
            if (facts.isEmpty()) {
                throw new IllegalStateException("RDS 无目标日期日事实，无法复用: " + reportDate);
            }
            result.setFetchedRows(facts.size());
            result.setTeamRows(facts.size());
            result.setStoredRows(0);
        }
        timed("snapshotUnifiedDaily", durations, () -> rebuildUnifiedDailyFromFacts(reportDate));

        Map<String, Set<String>> reportAllowedAsins = timed("loadReportAsinWhitelist", durations,
                () -> loadUnifiedDailyWhitelist(reportDate));
        boolean hasDailyUnified = reportAllowedAsins.values().stream().anyMatch(set -> !set.isEmpty());
        List<LingxingProductPerformanceDaily> reportFacts = facts.stream()
                .filter(f -> f.getMarketplace() != null)
                .filter(f -> f.getAsin() != null)
                .filter(f -> {
                    if (!hasDailyUnified) return true;
                    return reportAllowedAsins.getOrDefault(normalizeMarketplace(f.getMarketplace()), Set.of())
                            .contains(f.getAsin());
                })
                .toList();
        if (reportFacts.isEmpty()) {
            throw new IllegalStateException("RDS 目标日期无 UK/DE 日事实，无法生成财务日报: "
                    + reportDate);
        }
        List<LingxingProductPerformanceDaily> universeFacts = hasDailyUnified
                ? timed("padMissingWhitelistFacts", durations,
                () -> padMissingWhitelistFacts(reportFacts, reportAllowedAsins, reportDate))
                : reportFacts;
        Set<String> unexpectedCurrencies = reportFacts.stream()
                .map(LingxingProductPerformanceDaily::getCurrencyCode)
                .filter(currency -> !REPORT_CURRENCY.equalsIgnoreCase(currency))
                .map(currency -> currency == null || currency.isBlank() ? "(空)" : currency)
                .collect(Collectors.toCollection(java.util.TreeSet::new));
        if (!unexpectedCurrencies.isEmpty()) {
            throw new IllegalStateException("目标日期存在未统一换算为 GBP 的日事实，拒绝混合币种计算: "
                    + unexpectedCurrencies);
        }
        List<String> configuredDevelopers = timed("loadEffectiveDevelopers", durations,
                () -> personRosterService.listNamesEffectiveOn("developer", reportDate));
        List<String> configuredOperators = timed("loadEffectiveOperators", durations,
                () -> personRosterService.listNamesEffectiveOn("operator", reportDate));
        if (configuredDevelopers.isEmpty()) {
            throw new IllegalStateException("人员配置中没有目标日期有效的开发人员: " + reportDate);
        }
        if (configuredOperators.isEmpty()) {
            throw new IllegalStateException("人员配置中没有目标日期有效的运营人员: " + reportDate);
        }
        List<LingxingProductPerformanceDaily> asinFacts = timed(
                "consolidateAsinsAll", durations, () -> consolidateFactsByAsin(universeFacts));
        Set<String> asins = asinFacts.stream()
                .map(LingxingProductPerformanceDaily::getAsin)
                .filter(a -> a != null && !a.isBlank())
                .collect(Collectors.toSet());
        LocalDate priorSnapshotDate = timed("resolvePriorStatusSnapshotAll", durations,
                () -> queryMapper.selectLatestStatusSnapshotDateBefore(reportDate, REPORT_SCOPE));
        Map<String, FinanceStatusSnapshotRow> priorSnapshot = timed(
                "loadPriorStatusSnapshotAll", durations,
                () -> loadStatusSnapshot(priorSnapshotDate, REPORT_SCOPE, asins));
        int priorOutOfStock = (int) priorSnapshot.values().stream()
                .filter(row -> Integer.valueOf(1).equals(row.getOutOfStock())).count();
        Set<String> priorPositiveAsins = timed("loadPriorPositiveAsinsAll", durations,
                () -> new HashSet<>(queryMapper.selectPriorPositiveAsins(reportDate, null)));
        priorPositiveAsins.retainAll(asins);
        Map<String, LingxingProductUnified> unified = timed("loadUnifiedAll", durations,
                () -> loadUnified(asins));
        Map<String, LocalDate> listingDates = timed("loadListingDatesAll", durations,
                () -> loadListingDates(asins));
        ComputedReport computed = timed("computeReportAllGbp", durations,
                () -> computeReport(asinFacts, priorSnapshot, unified, listingDates, priorPositiveAsins,
                        reportDate, CalculationProfile.PRODUCTION_GBP,
                        REPORT_SCOPE, REPORT_CURRENCY,
                        configuredDevelopers, configuredOperators));
        int storedStatusRows = persistStatusSnapshot
                ? timed("storeStatusSnapshotAll", durations,
                () -> storeStatusSnapshot(reportDate, REPORT_SCOPE, computed.statusRows()))
                : 0;

        result.setDistinctAsins(asins.size());
        result.setUnifiedMatchAsins(unified.size());
        result.setStatusSnapshotDate(priorSnapshotDate);
        result.setPriorOutOfStockAsins(priorOutOfStock);
        result.setPriorPositiveAsins(priorPositiveAsins.size());
        result.setRows(computed.rows());
        result.setStoredStatusRows(storedStatusRows);
        result.setStageDurationsMs(durations);
        return result;
    }

    // ============================================================
    // ① 店铺
    // ============================================================

    private List<Long> activeSids(String marketplace) {
        long mid = "UK".equals(marketplace) ? 4L : 5L;
        List<LingxingSeller> sellers = sellerMapper.selectList(
                new LambdaQueryWrapper<LingxingSeller>()
                        .eq(LingxingSeller::getStatus, 1)
                        .eq(LingxingSeller::getMid, mid));
        List<Long> sids = new ArrayList<>();
        for (LingxingSeller s : sellers) {
            if (s.getSid() != null) sids.add(s.getSid());
        }
        return sids;
    }

    // ============================================================
    // ② 按日期+国家（该国全部 sid）拉取 asinList，整页保留
    // ============================================================

    private record PullResult(List<LingxingProductPerformanceDaily> facts, int fetchedRows) {
    }

    private PullResult pullDailyFacts(List<Long> sids, LocalDate reportDate,
                                      String marketplace) {
        String dateStr = reportDate.format(DF);
        List<Long> sorted = sids.stream().sorted().collect(Collectors.toList());
        Map<String, LingxingProductPerformanceDaily> byKey = new LinkedHashMap<>();
        int fetched = 0;

        int batchCount = (sorted.size() + SID_BATCH - 1) / SID_BATCH;
        for (int i = 0; i < sorted.size(); i += SID_BATCH) {
            List<Long> batch = sorted.subList(i, Math.min(i + SID_BATCH, sorted.size()));
            int batchNo = i / SID_BATCH + 1;
            String rawScope = batch.stream().map(String::valueOf).collect(Collectors.joining(","));
            String sidScope = rawScope.length() <= 200 ? rawScope : "sha256:" + sha256(rawScope);
            int offset = 0;
            while (true) {
                ObjectNode body = objectMapper.createObjectNode();
                body.put("offset", offset);
                body.put("length", PAGE_SIZE);
                body.put("sort_field", "volume");
                body.put("sort_type", "desc");
                body.put("summary_field", "asin");
                ArrayNode sidArr = body.putArray("sid");
                batch.forEach(sidArr::add);
                body.put("start_date", dateStr);
                body.put("end_date", dateStr);
                body.put("currency_code", REPORT_CURRENCY);
                body.put("is_recently_enum", false);

                JsonNode resp = client.post(PATH, body);
                JsonNode list = resp.path("data").path("list");
                if (!list.isArray() || list.isEmpty()) break;

                fetched += list.size();
                for (JsonNode row : list) {
                    String asin = firstNested(row, "asins", "asin");
                    if (asin == null || asin.isBlank()) continue;
                    LingxingProductPerformanceDaily e = mapRow(row, sidScope, reportDate, marketplace);
                    if (e.getBizKey() != null) byKey.put(e.getBizKey(), e);
                }
                if (list.size() < PAGE_SIZE) break;
                offset += PAGE_SIZE;
                sleep(MULTI_STORE_INTERVAL_MS); // 正式全页请求已验证成功的页间节奏
            }
            log.info("领星财务日报：批次 {}/{} 完成（{} 店）", batchNo, batchCount, batch.size());
            if (i + SID_BATCH < sorted.size()) {
                sleep(MULTI_STORE_INTERVAL_MS);
            }
        }
        return new PullResult(new ArrayList<>(byKey.values()), fetched);
    }

    private LingxingProductPerformanceDaily mapRow(JsonNode row, String sidScope,
                                                   LocalDate reportDate, String marketplace) {
        LingxingProductPerformanceDaily e = new LingxingProductPerformanceDaily();
        String asin = firstNested(row, "asins", "asin");
        e.setSummaryField("asin");
        e.setSummaryValue(asin);
        e.setSidScope(sidScope);
        e.setAsin(asin);
        e.setParentAsin(firstNested(row, "parent_asins", "parent_asin"));
        e.setMsku(firstNested(row, "price_list", "seller_sku"));
        e.setSku(firstNested(row, "price_list", "local_sku"));
        e.setItemName(asText(row, "item_name"));
        e.setCurrencyCode(asText(row, "currency_code"));
        e.setMarketplace(marketplace);
        e.setDataDate(reportDate);
        e.setPrincipalNames(joinList(row.path("principal_names")));
        e.setDeveloperNames(joinList(row.path("developer_names")));
        e.setStoreNames(joinNames(row, "seller_store_countries", "seller_name"));
        e.setTagNames(joinNames(row, "tag_set", "tag_name"));
        e.setProductCreateTime(asText(row, "product_create_time"));
        e.setVolume(asInt(row, "volume"));
        e.setOrderItems(asInt(row, "order_items"));
        e.setAmount(asDecimal(row, "amount"));
        e.setGrossProfit(asDecimal(row, "gross_profit"));
        e.setGrossMargin(asDecimal(row, "gross_margin"));
        e.setSessionsTotal(asInt(row, "sessions_total"));
        e.setClicks(asInt(row, "clicks"));
        e.setImpressions(asInt(row, "impressions"));
        e.setAdOrderQuantity(asInt(row, "ad_order_quantity"));
        e.setAdSalesAmount(asDecimal(row, "ad_sales_amount"));
        e.setSpend(asDecimal(row, "spend"));
        e.setTacos(asDecimal(row, "tacos"));
        e.setAfnFulfillableQuantity(asInt(row, "afn_fulfillable_quantity"));
        e.setAvailableInventory(asInt(row.path("available_inventory"), "available_inventory"));
        e.setReturnAmount(asDecimal(row, "return_amount"));
        e.setAvgCustomPrice(asDecimal(row, "avg_custom_price"));
        e.setRawJson(row.toString());
        e.setSyncedAt(LocalDateTime.now());

        String currency = e.getCurrencyCode();
        String fullKey = marketplace + "|asin:" + safe(asin) + "|" + sidScope + "|"
                + reportDate.format(DF) + "|" + safe(currency);
        e.setBizKey(fullKey.length() <= 250 ? fullKey : "sha256:" + sha256(fullKey));
        return e;
    }

    // ============================================================
    // ③ 事实落库（不可变：已有日期拒绝覆盖）
    // ============================================================

    int deleteDailyFacts(LocalDate reportDate) {
        Integer deleted = rdsBatchWriteService.executeOne(
                FinanceRdsDailyMapper.class, mapper -> mapper.deleteByDate(reportDate));
        return deleted == null ? 0 : deleted;
    }

    int storeDailyFacts(LocalDate reportDate, List<LingxingProductPerformanceDaily> facts) {
        if (facts.isEmpty()) return 0;
        int existingRows = dailyMapper.countByDate(reportDate, null);
        if (existingRows > 0) {
            throw new IllegalStateException("RDS 已存在目标日期事实，拒绝原地删除覆盖: "
                    + reportDate + ", rows=" + existingRows);
        }
        // 财务事实按 200 行分批，所有提交统一经过 RDS 写入中心。
        // 单条 foreach INSERT 把数千次跨网络往返压缩为几十次批量写入。
        int inserted = 0;
        for (int i = 0; i < facts.size(); i += RDS_FACT_BATCH_SIZE) {
            List<LingxingProductPerformanceDaily> batch = facts.subList(
                    i, Math.min(i + RDS_FACT_BATCH_SIZE, facts.size()));
            inserted += rdsBatchWriteService.executeOne(
                    FinanceRdsDailyMapper.class, mapper -> mapper.insertBatch(batch));
        }
        if (inserted != facts.size()) {
            throw new IllegalStateException("RDS 日事实批量写入数量不一致: expected="
                    + facts.size() + ", actual=" + inserted);
        }
        return inserted;
    }

    // ============================================================
    // ④ 国家+ASIN 去重 + 上一期状态快照
    // ============================================================

    /** 与统一表 marketplace 主键一致：同一 ASIN 英美各保留一行。同站重复 SID 批次仍合并。 */
    List<LingxingProductPerformanceDaily> consolidateFactsByAsin(
            List<LingxingProductPerformanceDaily> facts) {
        Map<String, LingxingProductPerformanceDaily> consolidated = new LinkedHashMap<>();
        for (LingxingProductPerformanceDaily source : facts) {
            String asin = source.getAsin();
            if (asin == null || asin.isBlank()) continue;
            String key = marketplaceAsinKey(source.getMarketplace(), asin);
            LingxingProductPerformanceDaily target = consolidated.computeIfAbsent(key, ignored -> {
                LingxingProductPerformanceDaily row = new LingxingProductPerformanceDaily();
                row.setAsin(asin);
                row.setDataDate(source.getDataDate());
                row.setMarketplace(normalizeMarketplace(source.getMarketplace()));
                return row;
            });
            target.setPrincipalNames(mergeNames(target.getPrincipalNames(), source.getPrincipalNames()));
            target.setDeveloperNames(mergeNames(target.getDeveloperNames(), source.getDeveloperNames()));
            target.setStoreNames(mergeNames(target.getStoreNames(), source.getStoreNames()));
            target.setTagNames(mergeNames(target.getTagNames(), source.getTagNames()));
            target.setProductCreateTime(earlierDateText(
                    target.getProductCreateTime(), source.getProductCreateTime()));
            target.setVolume(sum(target.getVolume(), source.getVolume()));
            target.setOrderItems(sum(target.getOrderItems(), source.getOrderItems()));
            target.setAmount(sum(target.getAmount(), source.getAmount()));
            target.setClicks(sum(target.getClicks(), source.getClicks()));
            target.setImpressions(sum(target.getImpressions(), source.getImpressions()));
            target.setAdOrderQuantity(sum(target.getAdOrderQuantity(), source.getAdOrderQuantity()));
            target.setAdSalesAmount(sum(target.getAdSalesAmount(), source.getAdSalesAmount()));
            target.setSpend(sum(target.getSpend(), source.getSpend()));
            target.setAfnFulfillableQuantity(sum(
                    target.getAfnFulfillableQuantity(), source.getAfnFulfillableQuantity()));
            target.setAvailableInventory(sum(target.getAvailableInventory(), source.getAvailableInventory()));
            target.setReturnAmount(sum(target.getReturnAmount(), source.getReturnAmount()));
            if (target.getSyncedAt() == null || (source.getSyncedAt() != null
                    && source.getSyncedAt().isAfter(target.getSyncedAt()))) {
                target.setSyncedAt(source.getSyncedAt());
            }
        }
        return new ArrayList<>(consolidated.values());
    }

    int rebuildUnifiedDailyFromFacts(LocalDate reportDate) {
        Integer inserted = rdsBatchWriteService.executeOne(
                FinanceRdsUnifiedDailyMapper.class,
                mapper -> {
                    mapper.deleteByDate(reportDate);
                    return mapper.insertFromDailyFacts(reportDate);
                });
        return inserted == null ? 0 : inserted;
    }

    Map<String, Set<String>> loadUnifiedDailyWhitelist(LocalDate reportDate) {
        Map<String, Set<String>> allowed = new LinkedHashMap<>();
        for (String marketplace : REQUEST_MARKETPLACES) {
            allowed.put(marketplace, new HashSet<>());
        }
        for (FinanceMarketplaceAsinRow row : unifiedDailyMapper.selectMarketplaceAsins(reportDate)) {
            String marketplace = normalizeMarketplace(row.getMarketplace());
            if (allowed.containsKey(marketplace) && row.getAsin() != null && !row.getAsin().isBlank()) {
                allowed.get(marketplace).add(row.getAsin());
            }
        }
        return allowed;
    }

    /** 只按「该日统一表快照」补齐缺失的国家+ASIN，不用最新统一表套历史日。 */
    List<LingxingProductPerformanceDaily> padMissingWhitelistFacts(
            List<LingxingProductPerformanceDaily> facts,
            Map<String, Set<String>> allowed,
            LocalDate reportDate) {
        Set<String> present = new HashSet<>();
        List<LingxingProductPerformanceDaily> padded = new ArrayList<>(facts);
        for (LingxingProductPerformanceDaily fact : facts) {
            if (fact.getAsin() == null || fact.getAsin().isBlank()) continue;
            present.add(marketplaceAsinKey(fact.getMarketplace(), fact.getAsin()));
        }
        for (Map.Entry<String, Set<String>> entry : allowed.entrySet()) {
            String marketplace = normalizeMarketplace(entry.getKey());
            for (String asin : entry.getValue()) {
                if (asin == null || asin.isBlank()) continue;
                if (present.add(marketplaceAsinKey(marketplace, asin))) {
                    LingxingProductPerformanceDaily stub = new LingxingProductPerformanceDaily();
                    stub.setAsin(asin);
                    stub.setMarketplace(marketplace);
                    stub.setDataDate(reportDate);
                    stub.setCurrencyCode(REPORT_CURRENCY);
                    padded.add(stub);
                }
            }
        }
        return padded;
    }

    private String normalizeMarketplace(String marketplace) {
        return marketplace == null ? "" : marketplace.trim().toUpperCase();
    }

    private String marketplaceAsinKey(String marketplace, String asin) {
        return normalizeMarketplace(marketplace) + "|" + asin;
    }

    private Map<String, FinanceStatusSnapshotRow> loadStatusSnapshot(
            LocalDate snapshotDate, String marketplace, Set<String> asins) {
        Map<String, FinanceStatusSnapshotRow> result = new LinkedHashMap<>();
        if (snapshotDate == null) return result;
        for (FinanceStatusSnapshotRow row : queryMapper.selectStatusSnapshot(snapshotDate, marketplace)) {
            if (asins.contains(row.getAsin())) result.put(row.getAsin(), row);
        }
        return result;
    }

    int storeStatusSnapshot(LocalDate reportDate, String marketplace,
                            List<FinanceStatusSnapshotRow> rows) {
        if (rows.isEmpty()) return 0;
        int existingRows = queryMapper.countStatusSnapshotByDate(reportDate, marketplace);
        if (existingRows > 0) {
            throw new IllegalStateException("RDS 已存在财务状态快照，拒绝覆盖: "
                    + reportDate + ", rows=" + existingRows);
        }
        int inserted = 0;
        for (int i = 0; i < rows.size(); i += RDS_STATUS_BATCH_SIZE) {
            List<FinanceStatusSnapshotRow> batch = rows.subList(
                    i, Math.min(i + RDS_STATUS_BATCH_SIZE, rows.size()));
            inserted += rdsBatchWriteService.executeOne(
                    FinanceRdsHistoryMapper.class, mapper -> mapper.insertStatusSnapshotBatch(batch));
        }
        if (inserted != rows.size()) {
            throw new IllegalStateException("RDS 状态快照批量写入数量不一致: expected="
                    + rows.size() + ", actual=" + inserted);
        }
        return inserted;
    }

    // ============================================================
    // ⑤ 统一表兜底元数据
    // ============================================================

    private Map<String, LingxingProductUnified> loadUnified(Set<String> asins) {
        Map<String, LingxingProductUnified> map = new LinkedHashMap<>();
        List<String> sorted = asins.stream().sorted().toList();
        for (int i = 0; i < sorted.size(); i += 1000) {
            List<String> batch = sorted.subList(i, Math.min(i + 1000, sorted.size()));
            unifiedMapper.selectList(new LambdaQueryWrapper<LingxingProductUnified>()
                    .in(LingxingProductUnified::getAsin, batch)).forEach(u -> map.put(u.getAsin(), u));
        }
        return map;
    }

    /** 新 ASIN 的 Listing.open_date 补数；已在统一表的 ASIN 优先用 listingDate。 */
    private Map<String, LocalDate> loadListingDates(Set<String> asins) {
        Map<String, LocalDate> map = new LinkedHashMap<>();
        List<String> sorted = asins.stream().sorted().toList();
        for (int i = 0; i < sorted.size(); i += 1000) {
            List<String> batch = sorted.subList(i, Math.min(i + 1000, sorted.size()));
            for (FinanceListingDateRow row : unifiedMapper.selectListingDates(batch)) {
                if (row.getAsin() != null && row.getListingDate() != null) {
                    map.put(row.getAsin(), row.getListingDate());
                }
            }
        }
        return map;
    }

    // ============================================================
    // ⑥ 公式 + 5 维度
    // ============================================================

    record ComputedReport(List<FinanceDailyReportRow> rows,
                          List<FinanceStatusSnapshotRow> statusRows) {
    }

    ComputedReport computeReport(
            List<LingxingProductPerformanceDaily> facts,
            Map<String, FinanceStatusSnapshotRow> priorSnapshot,
            Map<String, LingxingProductUnified> unified,
            Map<String, LocalDate> listingDates,
            Set<String> priorPositiveAsins,
            LocalDate reportDate,
            CalculationProfile profile,
            String marketplace,
            String currencyCode,
            List<String> configuredDevelopers,
            List<String> configuredOperators) {

        Map<String, BigDecimal> total = newMetrics();
        Map<String, BigDecimal> nonstandard = newMetrics();
        Map<String, BigDecimal> shelfBefore = newMetrics();
        Map<String, BigDecimal> shelfAfter = newMetrics();
        Map<String, Map<String, BigDecimal>> developer = new LinkedHashMap<>();
        Map<String, Map<String, BigDecimal>> operator = new LinkedHashMap<>();
        List<FinanceStatusSnapshotRow> statusRows = new ArrayList<>();
        Set<String> allowedDevelopers = new HashSet<>(configuredDevelopers);
        Set<String> allowedOperators = new HashSet<>(configuredOperators);
        Set<String> unknownDevelopers = new java.util.TreeSet<>();
        Set<String> unknownOperators = new java.util.TreeSet<>();

        for (LingxingProductPerformanceDaily f : facts) {
            // 上架日期用统一表开发算法（4 信号取最早，已含 listing.open_date）。
            // 日事实里的新 ASIN 若尚未写入统一表，再用当天刷新的 Listing open_date，最后才用产品创建时间。
            LocalDate created = null;
            LingxingProductUnified unifiedRow = unified.get(f.getAsin());
            if (unifiedRow != null) created = unifiedRow.getListingDate();
            if (created == null) created = listingDates.get(f.getAsin());
            if (created == null) created = parseDate(f.getProductCreateTime());

            String tags = f.getTagNames();
            boolean everSoldBefore = priorPositiveAsins.contains(f.getAsin());

            Map<String, BigDecimal> m = rowMetrics(f, everSoldBefore, created, reportDate, tags);

            addTo(total, m);
            if (hasTag(tags, "非标品")) addTo(nonstandard, m);
            if (created != null) {
                if (created.isBefore(LocalDate.of(2026, 5, 1))) addTo(shelfBefore, m);
                else addTo(shelfAfter, m);
            }
            String factDevelopers = f.getDeveloperNames();
            String factPrincipals = f.getPrincipalNames();
            collectUnknownNames(factDevelopers, null, allowedDevelopers, unknownDevelopers);
            String dev = chooseOne(factDevelopers, null, allowedDevelopers);
            if (dev != null) addTo(developer.computeIfAbsent(dev, k -> newMetrics()), m);
            collectUnknownNames(factPrincipals, null, allowedOperators, unknownOperators);
            String owner = chooseOne(factPrincipals, null, allowedOperators);
            if (owner != null) addTo(operator.computeIfAbsent(owner, k -> newMetrics()), m);

            FinanceStatusSnapshotRow status = new FinanceStatusSnapshotRow();
            status.setSnapshotDate(reportDate);
            status.setMarketplace(marketplace);
            status.setAsin(f.getAsin());
            status.setOutOfStock(m.get("断货SKU").signum() > 0 ? 1 : 0);
            status.setTagNames(tags);
            status.setProductCreateDate(created);
            status.setPrincipalNames(factPrincipals);
            status.setDeveloperNames(factDevelopers);
            status.setSourceType("DAILY_FACT");
            statusRows.add(status);
        }

        List<FinanceDailyReportRow> rows = new ArrayList<>();
        rows.add(new FinanceDailyReportRow("总", "", marketplace, currencyCode, total));
        rows.add(new FinanceDailyReportRow("非标品", "", marketplace, currencyCode, nonstandard));
        rows.add(new FinanceDailyReportRow("上架时间", "5月以前上架", marketplace, currencyCode, shelfBefore));
        rows.add(new FinanceDailyReportRow("上架时间", "5月及以后上架", marketplace, currencyCode, shelfAfter));
        if (!unknownDevelopers.isEmpty() || !unknownOperators.isEmpty()) {
            log.warn("财务日报存在未登记或多重匹配人员: reportDate={}, marketplace={}, "
                            + "unknownDevelopers={}, unknownOperators={}; 总指标已保留，人员维度未随机归属",
                    reportDate, marketplace, unknownDevelopers, unknownOperators);
        }
        for (String op : configuredOperators) {
            if (operator.containsKey(op)) {
                rows.add(new FinanceDailyReportRow("运营", op, marketplace, currencyCode,
                        operator.get(op)));
            }
        }
        for (String dev : configuredDevelopers) {
            if (developer.containsKey(dev)) {
                rows.add(new FinanceDailyReportRow("开发", dev, marketplace, currencyCode,
                        developer.get(dev)));
            }
        }
        return new ComputedReport(rows, statusRows);
    }

    /**
     * 旧案例回归入口：UK+DE 输入先按 ASIN 合并，最终仍按案例显示 GBP。
     * 该入口只计算，不请求领星、不写 RDS、不投递飞书。
     */
    ComputedReport computeLegacyCaseReport(
            List<LingxingProductPerformanceDaily> ukAndDeFacts,
            Map<String, FinanceStatusSnapshotRow> priorSnapshot,
            Map<String, LingxingProductUnified> unified,
            Set<String> priorPositiveAsins,
            LocalDate reportDate) {
        List<LingxingProductPerformanceDaily> consolidated = consolidateFactsByAsin(ukAndDeFacts);
        return computeReport(consolidated, priorSnapshot, unified, Map.of(), priorPositiveAsins, reportDate,
                CalculationProfile.LEGACY_CASE, "ALL", "GBP",
                LEGACY_CASE_DEVELOPERS, LEGACY_CASE_OPERATORS);
    }

    /** 单 ASIN 行 → 16 个指标（6 SKU 状态 + 10 经营指标），严格按工作簿公式。 */
    Map<String, BigDecimal> rowMetrics(
            LingxingProductPerformanceDaily f,
            boolean everSoldBefore,
            LocalDate created,
            LocalDate reportDate,
            String tags) {

        int fba = nvl(f.getAfnFulfillableQuantity());
        int volume = nvl(f.getVolume());
        // 日事实本身已经证明该 ASIN 在目标日存在；API 未返回创建时间时仍计入 SKU 总量。
        // 创建时间只用于上架时间维度，不允许再从统一表或上一日报快照补值。
        boolean createdByTarget = created == null || !reportDate.isBefore(created);
        boolean outOfStockCandidate = fba == 0 && (everSoldBefore || volume > 0);
        boolean invalidForStockStatus = hasTag(tags, "淘汰") || hasTag(tags, "侵权下架");
        boolean outOfStock = outOfStockCandidate
                && !invalidForStockStatus
                && !hasTag(tags, "季节性");

        Map<String, BigDecimal> m = newMetrics();
        // 淘汰：标签含「淘汰」且不含「待淘汰」（二者独立，飞书只输出真正淘汰）
        m.put("淘汰SKU", hasEliminated(tags) ? BigDecimal.ONE : BigDecimal.ZERO);
        m.put("季节性SKU", hasTag(tags, "季节性") ? BigDecimal.ONE : BigDecimal.ZERO);
        m.put("SKU总数量", createdByTarget ? BigDecimal.ONE : BigDecimal.ZERO);
        // 动销＞90天：有 FBA，且无销量或按当日销量估算的库存天数严格大于 90 天。
        boolean overNinetyDays = fba > 0 && (volume == 0 || (long) fba > 90L * volume);
        m.put("动销＞90天的SKU", overNinetyDays ? BigDecimal.ONE : BigDecimal.ZERO);
        m.put("未上架SKU", (fba == 0 && !outOfStockCandidate && createdByTarget
                && !invalidForStockStatus) ? BigDecimal.ONE : BigDecimal.ZERO);
        m.put("断货SKU", outOfStock ? BigDecimal.ONE : BigDecimal.ZERO);

        m.put("销量", bd(f.getVolume()));
        m.put("订单量", bd(f.getOrderItems()));
        m.put("销售额", bd(f.getAmount()));
        m.put("展示", bd(f.getImpressions()));
        m.put("点击", bd(f.getClicks()));
        m.put("广告订单量", bd(f.getAdOrderQuantity()));
        m.put("广告销售额", bd(f.getAdSalesAmount()));
        m.put("广告花费", bd(f.getSpend()));
        m.put("可用库存", bd(f.getAvailableInventory()));
        // 领星退款为负向流水，日报展示沿用历史飞书口径：退款金额取正数绝对值。
        m.put("退款金额", f.getReturnAmount() == null
                ? BigDecimal.ZERO
                : f.getReturnAmount().abs());
        return m;
    }

    // ============================================================
    // 工具
    // ============================================================

    private Map<String, BigDecimal> newMetrics() {
        Map<String, BigDecimal> m = new LinkedHashMap<>();
        for (String k : METRICS) m.put(k, BigDecimal.ZERO);
        return m;
    }

    private void addTo(Map<String, BigDecimal> target, Map<String, BigDecimal> source) {
        source.forEach((k, v) -> target.merge(k, v, BigDecimal::add));
    }

    private BigDecimal bd(Integer v) {
        return v == null ? BigDecimal.ZERO : BigDecimal.valueOf(v);
    }

    private BigDecimal bd(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private Integer sum(Integer a, Integer b) {
        return nvl(a) + nvl(b);
    }

    private BigDecimal sum(BigDecimal a, BigDecimal b) {
        return (a == null ? BigDecimal.ZERO : a).add(b == null ? BigDecimal.ZERO : b);
    }

    private String mergeNames(String a, String b) {
        Set<String> merged = new java.util.TreeSet<>(splitNames(a));
        merged.addAll(splitNames(b));
        return merged.isEmpty() ? null : String.join(",", merged);
    }

    private String earlierDateText(String a, String b) {
        LocalDate da = parseDate(a);
        LocalDate db = parseDate(b);
        if (da == null) return b;
        if (db == null) return a;
        return da.isAfter(db) ? b : a;
    }

    private int nvl(Integer v) {
        return v == null ? 0 : v;
    }

    /** 是否「真正淘汰」：某标签含「淘汰」且不含「待淘汰」。 */
    private boolean hasEliminated(String tags) {
        if (tags == null || tags.isBlank()) return false;
        for (String tag : splitNames(tags)) {
            if (tag.contains("淘汰") && !tag.contains("待淘汰")) return true;
        }
        return false;
    }

    private boolean hasTag(String tags, String keyword) {
        if (tags == null || tags.isBlank()) return false;
        for (String tag : splitNames(tags)) {
            if (tag.contains(keyword)) return true;
        }
        return false;
    }

    private String joinTags(String dailyTags, String unifiedTags) {
        String a = dailyTags == null ? "" : dailyTags;
        String b = unifiedTags == null ? "" : unifiedTags;
        return a.isBlank() ? b : (b.isBlank() ? a : a + "," + b);
    }

    private String chooseOne(String joined, String unifiedValue, Set<String> allowed) {
        Set<String> found = new HashSet<>();
        if (joined != null) {
            for (String part : splitNames(joined)) if (allowed.contains(part)) found.add(part);
        }
        if (found.size() == 1) return found.iterator().next();
        if (found.isEmpty() && unifiedValue != null) {
            for (String part : splitNames(unifiedValue)) if (allowed.contains(part)) found.add(part);
            if (found.size() == 1) return found.iterator().next();
        }
        return null;
    }

    private void collectUnknownNames(String joined, String unifiedValue,
                                     Set<String> allowed, Set<String> unknown) {
        Set<String> candidates = new HashSet<>(splitNames(joined));
        if (candidates.isEmpty()) candidates.addAll(splitNames(unifiedValue));
        for (String candidate : candidates) {
            if (!allowed.contains(candidate)) unknown.add(candidate);
        }
        long matched = candidates.stream().filter(allowed::contains).count();
        if (matched > 1) {
            unknown.add("[多重匹配]" + String.join("/", candidates));
        }
    }

    private Set<String> splitNames(String value) {
        Set<String> out = new HashSet<>();
        if (value == null) return out;
        for (String part : value.replace("，", ",").split(",")) {
            String p = part.trim();
            if (!p.isEmpty()) out.add(p);
        }
        return out;
    }

    private LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        String t = s.trim();
        if (t.length() >= 10) t = t.substring(0, 10);
        try {
            return LocalDate.parse(t);
        } catch (Exception e) {
            return null;
        }
    }

    private String firstNested(JsonNode row, String arrKey, String field) {
        JsonNode arr = row.path(arrKey);
        if (arr.isArray() && !arr.isEmpty()) {
            String v = arr.get(0).path(field).asText("");
            return v.isEmpty() ? null : v;
        }
        return null;
    }

    private String joinList(JsonNode arr) {
        if (!arr.isArray() || arr.isEmpty()) return null;
        List<String> items = new ArrayList<>();
        for (JsonNode v : arr) {
            String s = v.asText("").trim();
            if (!s.isEmpty()) items.add(s);
        }
        return items.isEmpty() ? null : String.join(",", items);
    }

    private String joinNames(JsonNode row, String arrKey, String field) {
        JsonNode arr = row.path(arrKey);
        if (!arr.isArray() || arr.isEmpty()) return null;
        List<String> items = new ArrayList<>();
        for (JsonNode v : arr) {
            String s = v.path(field).asText("").trim();
            if (!s.isEmpty()) items.add(s);
        }
        return items.isEmpty() ? null : String.join(",", items);
    }

    private String asText(JsonNode row, String key) {
        JsonNode n = row.path(key);
        if (n.isMissingNode() || n.isNull()) return null;
        String v = n.asText("");
        return v.isEmpty() ? null : v;
    }

    private Integer asInt(JsonNode row, String key) {
        JsonNode n = row.path(key);
        if (n.isMissingNode() || n.isNull()) return null;
        String v = n.asText("").trim();
        if (v.isEmpty()) return null;
        try {
            return (int) Double.parseDouble(v);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private BigDecimal asDecimal(JsonNode row, String key) {
        JsonNode n = row.path(key);
        if (n.isMissingNode() || n.isNull()) return null;
        String v = n.asText("").trim();
        if (v.isEmpty()) return null;
        try {
            return new BigDecimal(v);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String safe(String s) {
        return s == null ? "" : s;
    }

    private String sha256(String s) {
        try {
            byte[] d = java.security.MessageDigest.getInstance("SHA-256")
                    .digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(d.length * 2);
            for (byte b : d) {
                String h = Integer.toHexString(0xff & b);
                if (h.length() == 1) hex.append('0');
                hex.append(h);
            }
            return hex.toString();
        } catch (Exception e) {
            return "len" + s.length() + "_" + Integer.toHexString(s.hashCode());
        }
    }

    private void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private interface TimedSupplier<T> {
        T get();
    }

    private <T> T timed(String stage, Map<String, Long> durations, TimedSupplier<T> supplier) {
        long start = System.nanoTime();
        try {
            return supplier.get();
        } finally {
            durations.put(stage, (System.nanoTime() - start) / 1_000_000L);
        }
    }

}

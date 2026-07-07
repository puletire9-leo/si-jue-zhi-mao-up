package com.sjzm.product.service;

import com.baomidou.mybatisplus.extension.toolkit.Db;
import com.sjzm.product.entity.*;
import com.sjzm.product.mapper.*;
import com.sjzm.product.methodrule.M01Rule;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class CompetitorFilterService {

    private final CompetitorProductMapper productMapper;
    private final SkipAsinMapper skipAsinMapper;
    private final ShopMapper shopMapper;
    private final Product30DayNewMapper product30DayNewMapper;
    private final FilterConfigService filterConfig;
    private final ProductFeatureProcessor productFeatureProcessor;

    /**
     * 对一批竞品数据执行双层筛选（批量写入模式）
     */
    public FilterResult filter(List<CompetitorProduct> products, String marketplace, String source, String month) {
        log.info("开始筛选: {} 条产品, 市场={}, 来源={}", products.size(), marketplace, source);

        FilterResult result = new FilterResult();
        List<SkipAsin> skipAsins = new ArrayList<>();
        List<Product30DayNew> newProducts = new ArrayList<>();
        List<Shop> shops = new ArrayList<>();
        Set<String> shopIdSet = new HashSet<>();

        // M01 合格标准（方法卡分档口径），用于给 m01_active 打标。整批同站点，取一次。
        M01Rule m01Rule = m01RuleQuietly(marketplace);

        for (CompetitorProduct p : products) {
            // 1. 基础特征处理层：只产出可复用事实，不判定方法卡命中。
            productFeatureProcessor.applyBaseFeatures(p, marketplace, source);
            int listingDays = p.getListingDays();
            BigDecimal weightG = p.getWeightG();

            // 2. M01 合格标记（方法卡消费层口径）
            // listingDays 已含 available_date 缺失的 89 兜底，matches 内部据此判定；
            // 上架时效不再排斥无 available_date 的品（新品榜数据缺字段≠老品）。
            boolean m01Hit = m01Rule != null
                    && m01Rule.matches(listingDays, p.getPrice(), weightG, p.getUnits(), p.getBsr());
            p.setM01Active(m01Hit ? 1 : 0);

            // 3. 执行模式一筛选
            List<String> mode1Reasons = checkMode1(p, listingDays, weightG, marketplace);
            boolean passedMode1 = mode1Reasons.isEmpty();

            // 4. 执行模式二筛选
            boolean passedMode2 = checkMode2(p, marketplace);

            // 5. 设置筛选结果
            if (passedMode1) {
                p.setFilterMode("MODE1");
                result.mode1Count++;
            } else if (passedMode2) {
                p.setFilterMode("MODE2");
                result.mode2Count++;
            } else {
                p.setFilterMode("FAIL");
                p.setFilterReasons(String.join("; ", mode1Reasons) + "; 模式二: 未通过");
                result.failCount++;
            }

            // 6. 30天新品追踪（收集）
            if (listingDays <= 30) {
                collect30DayProduct(p, marketplace, month, newProducts);
                if (passedMode1 || passedMode2) {
                    result.newProductPassed++;
                } else {
                    result.newProductFailed++;
                }
            }

            // 7. 收集失败到 skip_asins
            if (!passedMode1 && !passedMode2) {
                collectSkipAsin(p, marketplace, skipAsins);
            }

            // 8. 收集店铺
            if (p.getSellerId() != null && !p.getSellerId().isEmpty() && shopIdSet.add(p.getSellerId())) {
                collectShop(p, marketplace, shops);
            }
        }

        result.totalCount = products.size();

        // 批量更新产品筛选结果
        Db.updateBatchById(products);

        // 批量写入 skip_asins（INSERT IGNORE）
        if (!skipAsins.isEmpty()) {
            skipAsinMapper.insertBatchIgnoreDup(skipAsins);
        }

        // 批量写入 30天新品（INSERT IGNORE）
        if (!newProducts.isEmpty()) {
            product30DayNewMapper.insertBatchIgnoreDup(newProducts);
        }

        // 批量写入店铺（INSERT IGNORE）
        if (!shops.isEmpty()) {
            shopMapper.insertBatchIgnoreDup(shops);
        }

        log.info("筛选完成: 总计={}, 模式一={}, 模式二={}, 未通过={}, 30天新品通过={}",
                result.totalCount, result.mode1Count, result.mode2Count,
                result.failCount, result.newProductPassed);
        return result;
    }

    /** 取 M01 规则；站点不支持（非 UK/DE/US）时返回 null，不打标、不中断导入。 */
    private M01Rule m01RuleQuietly(String marketplace) {
        try {
            return M01Rule.forMarketplace(marketplace);
        } catch (Exception e) {
            log.warn("站点 {} 无 M01 规则，跳过 m01_active 打标", marketplace);
            return null;
        }
    }

    private List<String> checkMode1(CompetitorProduct p, int listingDays, BigDecimal weightG, String marketplace) {
        List<String> reasons = new ArrayList<>();

        double cfgPriceMin = filterConfig.getPriceMin(marketplace).doubleValue();
        double cfgPriceMax = filterConfig.getPriceMax(marketplace).doubleValue();
        int cfgListingMax = filterConfig.getListingDaysMax(marketplace);
        int cfgBsrMax = filterConfig.getBsrMax(marketplace);
        int cfgSalesMin = filterConfig.getSalesMin(marketplace);
        int cfgSalesMax = filterConfig.getSalesMax(marketplace);
        int cfgWeightMax = filterConfig.getWeightMax(marketplace);
        int cfgDeadDays = filterConfig.getDeadDays(marketplace);

        // 价格
        if (p.getPrice() != null && p.getPrice().doubleValue() > 0) {
            double price = p.getPrice().doubleValue();
            if (price <= cfgPriceMin) reasons.add("价格" + price + "≤" + cfgPriceMin);
            else if (price >= cfgPriceMax) reasons.add("价格" + price + "≥" + cfgPriceMax);
        }

        // 上架时间
        if (listingDays >= cfgListingMax)
            reasons.add("上架" + listingDays + "天≥" + cfgListingMax + "天");

        // BSR或销量（满足其一即可）
        Integer bsr = p.getBsr();
        boolean hasBsr = bsr != null && bsr < cfgBsrMax;
        Integer units = p.getUnits();
        boolean hasSales = units != null && units > cfgSalesMin;
        if (!hasBsr && !hasSales) {
            String bsrStr = bsr != null ? String.valueOf(bsr) : "无数据";
            reasons.add("BSR" + bsrStr + "≥" + cfgBsrMax + "且销量" + units + "≤" + cfgSalesMin);
        }

        // 销量上限
        if (units != null && units > cfgSalesMax) {
            reasons.add("销量" + units + ">" + cfgSalesMax);
        }

        // 超过 N 天仍然无销量无排名 → 死产品
        if (listingDays > cfgDeadDays && (units == null || units <= 0) && (bsr == null || bsr <= 0)) {
            reasons.add("上架" + listingDays + "天无销量无排名");
        }

        // 重量
        if (weightG != null && weightG.doubleValue() >= cfgWeightMax)
            reasons.add("重量" + weightG + "g≥" + cfgWeightMax + "g");

        // 配送方式：排除AMZ
        String fulfillment = p.getFulfillment();
        if (fulfillment != null) {
            String f = fulfillment.trim().toUpperCase();
            if ("AMZ".equals(f)) reasons.add("配送方式为AMZ");
            else if (!f.equals("FBM") && !f.equals("FBA")) reasons.add("配送方式" + fulfillment + "不符合要求");
        }

        return reasons;
    }

    private boolean checkMode2(CompetitorProduct p, String marketplace) {
        Integer bsr = p.getBsr();
        if (bsr != null && bsr < filterConfig.getMode2BsrMax(marketplace)) return true;
        Integer units = p.getUnits();
        return units != null && units > filterConfig.getMode2SalesMin(marketplace);
    }

    private void collectSkipAsin(CompetitorProduct p, String marketplace, List<SkipAsin> collector) {
        SkipAsin skip = new SkipAsin();
        skip.setAsin(p.getAsin());
        skip.setTitle(p.getTitle());
        skip.setImageUrl(p.getImageUrl());
        skip.setPrice(p.getPrice());
        skip.setBsr(p.getBsr());
        skip.setMonthlySales(p.getUnits());
        skip.setListingDays(p.getListingDays());
        skip.setWeightG(p.getWeightG());
        skip.setFulfillment(p.getFulfillment());
        skip.setSellerNation(p.getSellerNation());
        skip.setFilterReasons(p.getFilterReasons());
        skip.setMarketplace(marketplace);
        collector.add(skip);
    }

    private void collectShop(CompetitorProduct p, String marketplace, List<Shop> collector) {
        Shop shop = new Shop();
        shop.setShopId(p.getSellerId());
        shop.setShopName(p.getSellerName());
        shop.setShopLink(buildShopLink(p.getSellerId(), marketplace));
        shop.setMarketplace(marketplace);
        collector.add(shop);
    }

    private void collect30DayProduct(CompetitorProduct p, String marketplace, String month, List<Product30DayNew> collector) {
        Product30DayNew item = new Product30DayNew();
        item.setAsin(p.getAsin());
        item.setTitle(p.getTitle());
        item.setImageUrl(p.getImageUrl());
        item.setProductUrl(p.getProductUrl());
        item.setPrice(p.getPrice());
        item.setBsr(p.getBsr());
        item.setMonthlySales(p.getUnits());
        item.setListingDays(p.getListingDays());
        item.setShopName(p.getSellerName());
        item.setFilterStatus("MODE1".equals(p.getFilterMode()) ? "通过-模式一" :
                "MODE2".equals(p.getFilterMode()) ? "通过-模式二" : "未通过");
        item.setFilterReasons(p.getFilterReasons());
        item.setMarketplace(marketplace);
        item.setDataMonth(month);
        collector.add(item);
    }

    private String buildShopLink(String sellerId, String marketplace) {
        if (sellerId == null) return null;
        String domain = switch (marketplace) {
            case "DE" -> "https://www.amazon.de";
            case "US" -> "https://www.amazon.com";
            default -> "https://www.amazon.co.uk";
        };
        String marketplaceId = switch (marketplace) {
            case "DE" -> "A1PA6795UKMFR9";
            case "US" -> "ATVPDKIKX0DER";
            default -> "A1F83G8C2ARO7P";
        };
        return domain + "/s?i=merchant-items&me=" + sellerId + "&marketplaceID=" + marketplaceId;
    }

    /**
     * 重新对所有已入库商品执行筛选（改配置后调用）
     */
    public FilterResult reapplyFilter(String marketplace, String month) {
        // 先清除旧的失败记录和30天新品记录
        try {
            skipAsinMapper.delete(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<SkipAsin>()
                    .eq(SkipAsin::getMarketplace, marketplace));
            product30DayNewMapper.delete(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Product30DayNew>()
                    .eq(Product30DayNew::getMarketplace, marketplace)
                    .eq(Product30DayNew::getDataMonth, month));
        } catch (Exception e) {
            log.warn("清除旧筛选记录失败: {}", e.getMessage());
        }

        List<CompetitorProduct> products = productMapper.selectList(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<CompetitorProduct>()
                        .eq(CompetitorProduct::getMarketplace, marketplace)
                        .eq(CompetitorProduct::getMonth, month));
        log.info("重新筛选: marketplace={}, month={}, 共{}条商品", marketplace, month, products.size());
        return filter(products, marketplace, "新品榜", month);
    }

    @lombok.Data
    public static class FilterResult {
        int totalCount;
        int mode1Count;
        int mode2Count;
        int failCount;
        int newProductPassed;
        int newProductFailed;
    }
}

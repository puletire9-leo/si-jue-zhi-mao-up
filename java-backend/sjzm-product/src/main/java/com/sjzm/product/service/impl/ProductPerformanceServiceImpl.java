package com.sjzm.product.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import com.sjzm.product.dto.ProductTitleParseResult;
import com.sjzm.product.entity.ProductPerformanceActual;
import com.sjzm.product.mapper.ProductPerformanceActualMapper;
import com.sjzm.product.service.ProductPerformanceService;
import com.sjzm.product.service.ProductTitleParsingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductPerformanceServiceImpl implements ProductPerformanceService {

    private static final int EXPECTED_COLUMNS = 18;
    private static final java.util.regex.Pattern NUMBER_PATTERN = java.util.regex.Pattern.compile("-?\\d+(?:\\.\\d+)?");
    private static final DateTimeFormatter BATCH_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private static final Map<String, String> MARKETPLACE_MAP = Map.ofEntries(
            Map.entry("英国", "UK"),
            Map.entry("德国", "DE"),
            Map.entry("意大利", "IT"),
            Map.entry("美国", "US")
    );

    private static final Map<String, String> CATEGORY_SLUG_MAP = Map.ofEntries(
            Map.entry("Toys & Games", "toys"),
            Map.entry("Home & Kitchen", "kitchen"),
            Map.entry("Garden", "garden/outdoors"),
            Map.entry("Sports & Outdoors", "sports/outdoors"),
            Map.entry("Fashion", "fashion"),
            Map.entry("Automotive", "automotive"),
            Map.entry("Pet Supplies", "pet-supplies"),
            Map.entry("Beauty", "beauty"),
            Map.entry("DIY & Tools", "tools-improvement"),
            Map.entry("Stationery & Office Supplies", "office"),
            Map.entry("Health & Personal Care", "hpc"),
            Map.entry("Business, Industry & Science", "business-industry-science"),
            Map.entry("Baby Products", "baby"),
            Map.entry("Computers & Accessories", "computers"),
            Map.entry("Electronics & Photo", "electronics"),
            Map.entry("Grocery", "grocery"),
            Map.entry("Spielzeug", "toys"),
            Map.entry("Haustier", "pet-supplies"),
            Map.entry("Küche, Haushalt & Wohnen", "kitchen"),
            Map.entry("Auto & Motorrad", "automotive"),
            Map.entry("Kosmetik", "beauty"),
            Map.entry("Gewerbe, Industrie & Wissenschaft", "business-industry-science")
    );

    private final ProductPerformanceActualMapper productPerformanceActualMapper;
    private final ProductTitleParsingService productTitleParsingService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int importFromMarkdown(String filePath) {
        Path resolvedPath = resolvePath(filePath);
        String sourceBatch = "md-import-" + LocalDateTime.now().format(BATCH_FORMATTER);
        List<String> lines;
        try {
            lines = Files.readAllLines(resolvedPath, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("读取 Markdown 失败: " + resolvedPath, e);
        }

        int imported = 0;
        int skipped = 0;
        for (String rawLine : lines) {
            if (!isDataLine(rawLine)) {
                continue;
            }
            List<String> columns = splitColumns(rawLine);
            if (columns == null) {
                skipped++;
                log.warn("跳过无法解析的行: {}", rawLine);
                continue;
            }
            ProductPerformanceActual entity = buildEntity(columns, sourceBatch);
            if (entity == null) {
                skipped++;
                continue;
            }
            entity.setId(IdWorker.getId());
            entity.setImportedAt(LocalDateTime.now());
            productPerformanceActualMapper.upsert(entity);
            imported++;
        }

        log.info("product_performance_actual 导入完成: imported={}, skipped={}, file={}",
                imported, skipped, resolvedPath);
        return imported;
    }

    @Override
    public List<ProductPerformanceActual> listWinners(String marketplace) {
        LambdaQueryWrapper<ProductPerformanceActual> wrapper = new LambdaQueryWrapper<>();
        if (marketplace != null && !marketplace.isBlank()) {
            wrapper.eq(ProductPerformanceActual::getMarketplace, marketplace.trim().toUpperCase(Locale.ROOT));
        }
        wrapper.orderByDesc(ProductPerformanceActual::getSalesVolume)
                .orderByDesc(ProductPerformanceActual::getImportedAt);
        return productPerformanceActualMapper.selectList(wrapper);
    }

    @Override
    public List<ProductPerformanceActual> listByArchetype(String archetype) {
        LambdaQueryWrapper<ProductPerformanceActual> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ProductPerformanceActual::getArchetype, archetype == null ? "" : archetype.trim().toUpperCase(Locale.ROOT))
                .orderByDesc(ProductPerformanceActual::getSalesVolume)
                .orderByDesc(ProductPerformanceActual::getImportedAt);
        return productPerformanceActualMapper.selectList(wrapper);
    }

    @Override
    public long count() {
        return productPerformanceActualMapper.selectCount(null);
    }

    private ProductPerformanceActual buildEntity(List<String> columns, String sourceBatch) {
        String asin = columns.get(0);
        if (asin == null || asin.isBlank() || "ASIN".equalsIgnoreCase(asin.trim())) {
            return null;
        }

        String categoryRankMain = columns.get(5);
        String categoryRankSub = columns.get(12);
        RankParts mainRank = splitRank(categoryRankMain);
        RankParts subRank = splitRank(categoryRankSub);

        ProductPerformanceActual entity = new ProductPerformanceActual();
        entity.setAsin(trimToNull(columns.get(0)));
        entity.setParentAsin(trimToNull(columns.get(1)));
        entity.setPrice(parseMoney(columns.get(2)));
        entity.setSku(trimToNull(columns.get(3)));
        entity.setSalesVolume(parseInteger(columns.get(4)));
        entity.setCategoryRankMain(trimToNull(categoryRankMain));
        entity.setCategoryMain(mainRank.label());
        entity.setAcoas(parseDecimal(columns.get(6)));
        entity.setNaturalClicks(parseInteger(columns.get(7)));
        entity.setCtr(parsePercent(columns.get(8)));
        entity.setAdCvr(parsePercent(columns.get(9)));
        entity.setNaturalOrders(parseInteger(columns.get(10)));
        entity.setFbaAvailable(parseInteger(columns.get(11)));
        entity.setCategoryRankSub(trimToNull(categoryRankSub));
        entity.setCategorySub(subRank.label());
        entity.setRefundRate(parsePercent(columns.get(13)));
        entity.setMarketplace(mapMarketplace(columns.get(14)));
        entity.setListingTags(trimToNull(columns.get(15)));
        entity.setProductName(trimToNull(columns.get(16)));
        entity.setTitle(trimToNull(columns.get(17)));
        entity.setIsEliminated(containsTag(entity.getListingTags(), "淘汰") ? 1 : 0);
        entity.setIsGreen(containsTag(entity.getListingTags(), "绿标") ? 1 : 0);
        ProductTitleParseResult titleParseResult = productTitleParsingService.parse(entity.getTitle());
        entity.setArchetype(detectArchetype(entity.getListingTags(), titleParseResult));
        entity.setBsrId(resolveCategorySlug(entity.getCategoryMain()));
        entity.setSourceBatch(sourceBatch);

        if ("CUSTOM".equals(entity.getArchetype()) && titleParseResult.hasCarrier()) {
            entity.setCarrier(titleParseResult.carrier());
            entity.setElement(titleParseResult.element());
        }
        return entity;
    }

    private String detectArchetype(String listingTags, ProductTitleParseResult titleParseResult) {
        if (containsTag(listingTags, "非标品")) {
            return "CUSTOM";
        }
        if (titleParseResult != null && titleParseResult.hasCarrier()) {
            return "CUSTOM";
        }
        return "STD";
    }

    private boolean isDataLine(String line) {
        if (line == null) {
            return false;
        }
        String trimmed = line.trim();
        if (!trimmed.startsWith("|")) {
            return false;
        }
        if (trimmed.startsWith("| ---")) {
            return false;
        }
        return !trimmed.contains("| ASIN |");
    }

    private List<String> splitColumns(String line) {
        String body = line.trim();
        if (body.startsWith("|")) {
            body = body.substring(1);
        }
        if (body.endsWith("|")) {
            body = body.substring(0, body.length() - 1);
        }
        String[] parts = body.split("\\|", -1);
        List<String> columns = new ArrayList<>();
        for (String part : parts) {
            columns.add(part.trim());
        }
        if (columns.size() == EXPECTED_COLUMNS) {
            return columns;
        }
        if (columns.size() > EXPECTED_COLUMNS) {
            List<String> normalized = new ArrayList<>(columns.subList(0, EXPECTED_COLUMNS - 1));
            normalized.add(String.join(" | ", columns.subList(EXPECTED_COLUMNS - 1, columns.size())).trim());
            return normalized;
        }
        return null;
    }

    private Path resolvePath(String filePath) {
        Path path = Path.of(filePath);
        if (path.isAbsolute()) {
            if (Files.exists(path)) {
                return path;
            }
            throw new IllegalArgumentException("文件不存在: " + filePath);
        }

        Path current = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
        while (current != null) {
            Path candidate = current.resolve(filePath).normalize();
            if (Files.exists(candidate)) {
                return candidate;
            }
            current = current.getParent();
        }

        String normalizedFilePath = filePath.replace('\\', '/');
        if (normalizedFilePath.startsWith("docs/")) {
            String docsRoot = System.getProperty(
                    "product.performance.docs.root",
                    System.getenv().getOrDefault("PRODUCT_PERFORMANCE_DOCS_ROOT", "/docs")
            );
            Path mountedDocsPath = Path.of(docsRoot)
                    .resolve(normalizedFilePath.substring("docs/".length()))
                    .normalize();
            if (Files.exists(mountedDocsPath)) {
                return mountedDocsPath;
            }
        }

        throw new IllegalArgumentException("文件不存在: " + filePath);
    }

    private String mapMarketplace(String rawCountry) {
        String country = trimToNull(rawCountry);
        if (country == null) {
            return null;
        }
        return MARKETPLACE_MAP.getOrDefault(country, country.toUpperCase(Locale.ROOT));
    }

    private boolean containsTag(String tags, String keyword) {
        return tags != null && tags.contains(keyword);
    }

    private String resolveCategorySlug(String categoryMain) {
        String normalized = trimToNull(categoryMain);
        return normalized == null ? null : CATEGORY_SLUG_MAP.get(normalized);
    }

    private RankParts splitRank(String raw) {
        String value = trimToNull(raw);
        if (value == null) {
            return new RankParts(null);
        }
        int fullWidth = value.indexOf('：');
        if (fullWidth >= 0) {
            return new RankParts(trimToNull(value.substring(0, fullWidth)));
        }
        int halfWidth = value.indexOf(':');
        if (halfWidth >= 0) {
            return new RankParts(trimToNull(value.substring(0, halfWidth)));
        }
        return new RankParts(value);
    }

    private BigDecimal parseMoney(String raw) {
        return parseByRegex(raw, 2);
    }

    private BigDecimal parseDecimal(String raw) {
        return parseByRegex(raw, 4);
    }

    private BigDecimal parsePercent(String raw) {
        BigDecimal value = parseByRegex(raw, 4);
        if (value == null) {
            return null;
        }
        return value.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
    }

    private BigDecimal parseByRegex(String raw, int scale) {
        String text = trimToNull(raw);
        if (text == null) {
            return null;
        }
        Matcher matcher = NUMBER_PATTERN.matcher(text.replace(",", ""));
        if (!matcher.find()) {
            return null;
        }
        return new BigDecimal(matcher.group()).setScale(scale, RoundingMode.HALF_UP);
    }

    private Integer parseInteger(String raw) {
        String text = trimToNull(raw);
        if (text == null) {
            return null;
        }
        try {
            return Integer.valueOf(text);
        } catch (NumberFormatException ignore) {
            Matcher matcher = NUMBER_PATTERN.matcher(text.replace(",", ""));
            if (!matcher.find()) {
                return null;
            }
            return Integer.valueOf(matcher.group().contains(".")
                    ? matcher.group().substring(0, matcher.group().indexOf('.'))
                    : matcher.group());
        }
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private record RankParts(String label) {
    }
}

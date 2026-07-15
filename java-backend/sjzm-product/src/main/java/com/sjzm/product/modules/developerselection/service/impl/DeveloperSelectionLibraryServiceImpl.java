package com.sjzm.product.modules.developerselection.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.product.modules.developerselection.dto.DeveloperSelectionBatchAddRequest;
import com.sjzm.product.modules.developerselection.dto.DeveloperSelectionBatchCreateRequest;
import com.sjzm.product.modules.developerselection.dto.DeveloperSelectionLibraryQuery;
import com.sjzm.product.modules.developerselection.entity.DeveloperSelectionBatch;
import com.sjzm.product.modules.developerselection.entity.DeveloperSelectionLibraryItem;
import com.sjzm.product.modules.developerselection.mapper.DeveloperSelectionBatchMapper;
import com.sjzm.product.modules.developerselection.mapper.DeveloperSelectionLibraryMapper;
import com.sjzm.product.modules.developerselection.service.DeveloperSelectionLibraryService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.time.temporal.WeekFields;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class DeveloperSelectionLibraryServiceImpl implements DeveloperSelectionLibraryService {

    private static final String DEFAULT_ADMIN_DEVELOPER_NAME = "刘淼";

    private final DeveloperSelectionLibraryMapper mapper;
    private final DeveloperSelectionBatchMapper batchMapper;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Override
    @Transactional
    public Map<String, Object> addItems(Long userId, String username, String role,
                                        DeveloperSelectionBatchAddRequest request) {
        String bucket = normalizeBucket(request.getBucket());
        DeveloperOwner owner = resolveOwner(userId, username, role, request.getTargetUserId(),
                request.getDeveloperName());
        Long ownerUserId = owner.userId();
        String developerName = owner.developerName();
        int inserted = 0;
        int updated = 0;
        Set<String> seen = new LinkedHashSet<>();

        for (DeveloperSelectionBatchAddRequest.Item source : request.getItems()) {
            String asin = normalizeAsin(source.getAsin());
            String marketplace = normalizeMarketplace(source.getMarketplace());
            String key = marketplace + ":" + asin;
            if (!seen.add(key)) continue;

            boolean restored = mapper.restoreIfDeleted(ownerUserId, marketplace, asin) > 0;
            DeveloperSelectionLibraryItem entity = mapper.selectOne(new LambdaQueryWrapper<DeveloperSelectionLibraryItem>()
                    .eq(DeveloperSelectionLibraryItem::getUserId, ownerUserId)
                    .eq(DeveloperSelectionLibraryItem::getMarketplace, marketplace)
                    .eq(DeveloperSelectionLibraryItem::getAsin, asin)
                    .last("LIMIT 1"));
            boolean exists = entity != null;
            if (!exists) {
                entity = new DeveloperSelectionLibraryItem();
                entity.setUserId(ownerUserId);
                entity.setMarketplace(marketplace);
                entity.setAsin(asin);
                entity.setCreatedAt(LocalDateTime.now());
            }
            boolean bucketChanged = exists && !bucket.equals(entity.getBucket());
            entity.setDeveloperName(developerName);
            entity.setBucket(bucket);
            if (restored || bucketChanged) entity.setBatchId(null);
            entity.setOriginScene(trimToNull(source.getOriginScene()));
            entity.setOriginSource(trimToNull(source.getOriginSource()));
            entity.setSnapshotKey(trimToNull(source.getSnapshotKey()));
            entity.setTitle(trimToNull(source.getTitle()));
            entity.setBrand(trimToNull(source.getBrand()));
            entity.setImageUrl(trimToNull(source.getImageUrl()));
            entity.setPrice(source.getPrice());
            entity.setUnits(source.getUnits());
            entity.setBsr(source.getBsr());
            entity.setRatings(source.getRatings());
            entity.setRating(source.getRating());
            entity.setListingDays(source.getListingDays());
            entity.setWeightG(source.getWeightG());
            entity.setSellerName(trimToNull(source.getSellerName()));
            entity.setNodeLabelPath(trimToNull(source.getNodeLabelPath()));
            entity.setProductUrl(trimToNull(source.getProductUrl()));
            entity.setSnapshotJson(writeSnapshot(source.getSnapshot()));
            entity.setDeleted(0);
            entity.setUpdatedAt(LocalDateTime.now());
            if (exists) {
                mapper.updateById(entity);
                updated++;
            } else {
                mapper.insert(entity);
                inserted++;
            }
        }
        return Map.of(
                "inserted", inserted,
                "updated", updated,
                "total", inserted + updated,
                "bucket", bucket,
                "userId", String.valueOf(ownerUserId),
                "developerName", developerName);
    }

    @Override
    public Map<String, Object> list(Long currentUserId, String role, DeveloperSelectionLibraryQuery query) {
        boolean admin = isAdmin(role);
        LambdaQueryWrapper<DeveloperSelectionLibraryItem> wrapper = buildQueryWrapper(currentUserId, role, query);
        wrapper.orderByDesc(DeveloperSelectionLibraryItem::getUpdatedAt)
                .orderByDesc(DeveloperSelectionLibraryItem::getId);
        int page = query.getPage() == null ? 1 : query.getPage();
        int size = query.getSize() == null ? 60 : query.getSize();
        Page<DeveloperSelectionLibraryItem> result = mapper.selectPage(
                new Page<>(Math.max(1, page), Math.max(1, Math.min(size, 200))), wrapper);
        attachBatchNames(result.getRecords());
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("list", result.getRecords().stream().map(this::toItemResponse).toList());
        response.put("total", result.getTotal());
        response.put("page", result.getCurrent());
        response.put("size", result.getSize());
        response.put("adminView", admin);
        return response;
    }

    @Override
    public List<Map<String, Object>> weekOptions(Long currentUserId, String role,
                                                 DeveloperSelectionLibraryQuery query) {
        Long scopedUserId = isAdmin(role) ? query.getDeveloperId() : currentUserId;
        String bucket = StringUtils.hasText(query.getBucket()) ? normalizeBucket(query.getBucket()) : null;
        String marketplace = StringUtils.hasText(query.getMarketplace())
                ? normalizeMarketplace(query.getMarketplace()) : null;
        return mapper.selectLibraryWeeks(scopedUserId, bucket, marketplace);
    }

    @Override
    public List<Map<String, Object>> developerOptions(Long currentUserId, String username, String role) {
        if (isAdmin(role)) return mapper.selectDeveloperOptions();
        Map<String, Object> userOption = mapper.selectActiveDeveloperById(currentUserId);
        Map<String, Object> own = new LinkedHashMap<>();
        own.put("userId", String.valueOf(currentUserId));
        own.put("developerName", userOption != null && userOption.get("developerName") != null
                ? String.valueOf(userOption.get("developerName"))
                : (StringUtils.hasText(username) ? username : "用户" + currentUserId));
        own.put("itemCount", mapper.selectCount(new LambdaQueryWrapper<DeveloperSelectionLibraryItem>()
                .eq(DeveloperSelectionLibraryItem::getUserId, currentUserId)));
        return List.of(own);
    }

    @Override
    public List<Map<String, Object>> listBatches(Long currentUserId, String role,
                                                String bucket, Long developerId) {
        LambdaQueryWrapper<DeveloperSelectionBatch> wrapper = new LambdaQueryWrapper<>();
        if (isAdmin(role)) {
            if (developerId != null) wrapper.eq(DeveloperSelectionBatch::getUserId, developerId);
        } else {
            wrapper.eq(DeveloperSelectionBatch::getUserId, currentUserId);
        }
        if (StringUtils.hasText(bucket)) {
            wrapper.eq(DeveloperSelectionBatch::getBucket, normalizeBucket(bucket));
        }
        wrapper.orderByDesc(DeveloperSelectionBatch::getBatchDate)
                .orderByDesc(DeveloperSelectionBatch::getCreatedAt)
                .orderByDesc(DeveloperSelectionBatch::getId);
        return batchMapper.selectList(wrapper).stream().map(this::toBatchResponse).toList();
    }

    @Override
    @Transactional
    public Map<String, Object> createBatch(Long currentUserId, String username, String role,
                                          DeveloperSelectionBatchCreateRequest request) {
        String bucket = normalizeBucket(request.getBucket());
        String batchName = normalizeBatchName(request.getBatchName());
        DeveloperOwner owner = resolveOwner(currentUserId, username, role, request.getTargetUserId(),
                request.getDeveloperName());
        Long targetUserId = owner.userId();
        DeveloperSelectionBatch existing = batchMapper.selectOne(new LambdaQueryWrapper<DeveloperSelectionBatch>()
                .eq(DeveloperSelectionBatch::getUserId, targetUserId)
                .eq(DeveloperSelectionBatch::getBucket, bucket)
                .eq(DeveloperSelectionBatch::getBatchName, batchName)
                .last("LIMIT 1"));
        if (existing != null) {
            throw new IllegalArgumentException("当前开发人员的该商品库已存在同名批次");
        }

        DeveloperSelectionBatch batch = new DeveloperSelectionBatch();
        batch.setUserId(targetUserId);
        batch.setDeveloperName(owner.developerName());
        batch.setBucket(bucket);
        batch.setBatchName(batchName);
        batch.setBatchDate(LocalDate.now());
        batch.setDeleted(0);
        batch.setCreatedAt(LocalDateTime.now());
        batch.setUpdatedAt(LocalDateTime.now());
        batchMapper.insert(batch);
        return toBatchResponse(batch);
    }

    @Override
    @Transactional
    public int assignBatch(Long currentUserId, String role, List<Long> ids, Long batchId) {
        List<Long> normalizedIds = normalizeIds(ids);
        if (normalizedIds.isEmpty()) return 0;
        DeveloperSelectionBatch batch = batchMapper.selectById(batchId);
        if (batch == null) throw new IllegalArgumentException("批次不存在");
        if (!isAdmin(role) && !currentUserId.equals(batch.getUserId())) {
            throw new IllegalArgumentException("无权操作其他开发人员的批次");
        }

        LambdaQueryWrapper<DeveloperSelectionLibraryItem> itemWrapper = new LambdaQueryWrapper<>();
        itemWrapper.in(DeveloperSelectionLibraryItem::getId, normalizedIds);
        if (!isAdmin(role)) itemWrapper.eq(DeveloperSelectionLibraryItem::getUserId, currentUserId);
        List<DeveloperSelectionLibraryItem> selectedItems = mapper.selectList(itemWrapper);
        if (selectedItems.size() != normalizedIds.size()) {
            throw new IllegalArgumentException("部分商品不存在或无权操作");
        }
        for (DeveloperSelectionLibraryItem item : selectedItems) {
            if (!batch.getUserId().equals(item.getUserId())) {
                throw new IllegalArgumentException("商品与批次不属于同一开发人员");
            }
            if (!batch.getBucket().equals(item.getBucket())) {
                throw new IllegalArgumentException("商品与批次不属于同一好品/差品库");
            }
        }

        LambdaUpdateWrapper<DeveloperSelectionLibraryItem> update = new LambdaUpdateWrapper<>();
        update.in(DeveloperSelectionLibraryItem::getId, normalizedIds)
                .eq(DeveloperSelectionLibraryItem::getUserId, batch.getUserId())
                .eq(DeveloperSelectionLibraryItem::getBucket, batch.getBucket())
                .set(DeveloperSelectionLibraryItem::getBatchId, batch.getId())
                .set(DeveloperSelectionLibraryItem::getUpdatedAt, LocalDateTime.now());
        return mapper.update(null, update);
    }

    @Override
    @Transactional
    public int unassignBatch(Long currentUserId, String role, List<Long> ids) {
        List<Long> normalizedIds = normalizeIds(ids);
        if (normalizedIds.isEmpty()) return 0;
        LambdaUpdateWrapper<DeveloperSelectionLibraryItem> wrapper = new LambdaUpdateWrapper<>();
        wrapper.in(DeveloperSelectionLibraryItem::getId, normalizedIds);
        if (!isAdmin(role)) wrapper.eq(DeveloperSelectionLibraryItem::getUserId, currentUserId);
        wrapper.set(DeveloperSelectionLibraryItem::getBatchId, null)
                .set(DeveloperSelectionLibraryItem::getUpdatedAt, LocalDateTime.now());
        return mapper.update(null, wrapper);
    }

    @Override
    @Transactional
    public int convert(Long currentUserId, String role, List<Long> ids, String targetBucket) {
        if (ids == null || ids.isEmpty()) return 0;
        LambdaUpdateWrapper<DeveloperSelectionLibraryItem> wrapper = new LambdaUpdateWrapper<>();
        wrapper.in(DeveloperSelectionLibraryItem::getId, ids);
        if (!isAdmin(role)) wrapper.eq(DeveloperSelectionLibraryItem::getUserId, currentUserId);
        wrapper.set(DeveloperSelectionLibraryItem::getBucket, normalizeBucket(targetBucket))
                .set(DeveloperSelectionLibraryItem::getBatchId, null)
                .set(DeveloperSelectionLibraryItem::getUpdatedAt, LocalDateTime.now());
        return mapper.update(null, wrapper);
    }

    @Override
    @Transactional
    public int delete(Long currentUserId, String role, List<Long> ids) {
        if (ids == null || ids.isEmpty()) return 0;
        LambdaQueryWrapper<DeveloperSelectionLibraryItem> wrapper = new LambdaQueryWrapper<>();
        wrapper.in(DeveloperSelectionLibraryItem::getId, ids);
        if (!isAdmin(role)) wrapper.eq(DeveloperSelectionLibraryItem::getUserId, currentUserId);
        return mapper.delete(wrapper);
    }

    private String normalizeBucket(String value) {
        String bucket = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("GOOD", "BAD").contains(bucket)) {
            throw new IllegalArgumentException("bucket 仅支持 GOOD/BAD");
        }
        return bucket;
    }

    private String normalizeAsin(String value) {
        String asin = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if (!asin.matches("[A-Z0-9]{10}")) throw new IllegalArgumentException("非法 ASIN: " + value);
        return asin;
    }

    private String normalizeMarketplace(String value) {
        String marketplace = StringUtils.hasText(value) ? value.trim().toUpperCase(Locale.ROOT) : "UK";
        if (!Set.of("UK", "US", "DE").contains(marketplace)) {
            throw new IllegalArgumentException("marketplace 仅支持 UK/US/DE");
        }
        return marketplace;
    }

    private boolean isAdmin(String role) {
        if (!StringUtils.hasText(role)) return false;
        String normalized = role.toLowerCase(Locale.ROOT);
        return normalized.contains("admin") || role.contains("管理员");
    }

    private String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String writeSnapshot(Map<String, Object> snapshot) {
        if (snapshot == null || snapshot.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("商品快照序列化失败", e);
        }
    }

    private LambdaQueryWrapper<DeveloperSelectionLibraryItem> buildQueryWrapper(
            Long currentUserId,
            String role,
            DeveloperSelectionLibraryQuery query
    ) {
        LambdaQueryWrapper<DeveloperSelectionLibraryItem> wrapper = new LambdaQueryWrapper<>();
        if (isAdmin(role)) {
            if (query.getDeveloperId() != null) {
                wrapper.eq(DeveloperSelectionLibraryItem::getUserId, query.getDeveloperId());
            }
        } else {
            wrapper.eq(DeveloperSelectionLibraryItem::getUserId, currentUserId);
        }
        if (StringUtils.hasText(query.getBucket())) {
            wrapper.eq(DeveloperSelectionLibraryItem::getBucket, normalizeBucket(query.getBucket()));
        }
        if (query.getBatchId() != null) {
            wrapper.eq(DeveloperSelectionLibraryItem::getBatchId, query.getBatchId());
        } else if (Boolean.TRUE.equals(query.getUnassigned())) {
            wrapper.isNull(DeveloperSelectionLibraryItem::getBatchId);
        }
        if (StringUtils.hasText(query.getMarketplace())) {
            wrapper.eq(DeveloperSelectionLibraryItem::getMarketplace,
                    normalizeMarketplace(query.getMarketplace()));
        }
        if (StringUtils.hasText(query.getKeyword())) {
            String keyword = query.getKeyword().trim();
            wrapper.and(group -> group.like(DeveloperSelectionLibraryItem::getAsin, keyword)
                    .or().like(DeveloperSelectionLibraryItem::getTitle, keyword)
                    .or().like(DeveloperSelectionLibraryItem::getSellerName, keyword)
                    .or().like(DeveloperSelectionLibraryItem::getDeveloperName, keyword));
        }

        if (query.getPriceMin() != null) {
            wrapper.ge(DeveloperSelectionLibraryItem::getPrice, query.getPriceMin());
        }
        if (query.getPriceMax() != null) {
            wrapper.le(DeveloperSelectionLibraryItem::getPrice, query.getPriceMax());
        }
        if (query.getUnitsMin() != null) {
            wrapper.ge(DeveloperSelectionLibraryItem::getUnits, query.getUnitsMin());
        }
        if (query.getUnitsMax() != null) {
            wrapper.le(DeveloperSelectionLibraryItem::getUnits, query.getUnitsMax());
        }
        if (query.getListingDaysMin() != null) {
            wrapper.ge(DeveloperSelectionLibraryItem::getListingDays, query.getListingDaysMin());
        }
        if (query.getListingDaysMax() != null) {
            wrapper.le(DeveloperSelectionLibraryItem::getListingDays, query.getListingDaysMax());
        }
        if (query.getBsrMax() != null) {
            wrapper.le(DeveloperSelectionLibraryItem::getBsr, query.getBsrMax());
        }
        if (query.getWeightMax() != null) {
            wrapper.le(DeveloperSelectionLibraryItem::getWeightG, query.getWeightMax());
        }
        if (query.getVariantCountMax() != null) {
            wrapper.apply("""
                    CAST(COALESCE(
                        JSON_UNQUOTE(JSON_EXTRACT(snapshot_json, '$.variantCount')),
                        JSON_UNQUOTE(JSON_EXTRACT(snapshot_json, '$.variant_count')),
                        '1'
                    ) AS UNSIGNED) <= {0}
                    """, query.getVariantCountMax());
        }
        applyFulfillmentFilter(wrapper, query.getFulfillment());
        applyCreatedWeekFilter(wrapper, query.getCreatedWeeks());
        return wrapper;
    }

    private void attachBatchNames(List<DeveloperSelectionLibraryItem> records) {
        if (records == null || records.isEmpty()) return;
        List<Long> batchIds = records.stream()
                .map(DeveloperSelectionLibraryItem::getBatchId)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        if (batchIds.isEmpty()) return;
        Map<Long, String> names = new LinkedHashMap<>();
        for (DeveloperSelectionBatch batch : batchMapper.selectByIds(batchIds)) {
            names.put(batch.getId(), batch.getBatchName());
        }
        records.forEach(item -> item.setBatchName(names.get(item.getBatchId())));
    }

    private Map<String, Object> toItemResponse(DeveloperSelectionLibraryItem item) {
        Map<String, Object> response = objectMapper.convertValue(
                item, new TypeReference<LinkedHashMap<String, Object>>() { });
        response.put("id", String.valueOf(item.getId()));
        response.put("userId", String.valueOf(item.getUserId()));
        response.put("batchId", item.getBatchId() == null ? null : String.valueOf(item.getBatchId()));
        response.put("createdAt", item.getCreatedAt() == null ? null : item.getCreatedAt().toString());
        response.put("updatedAt", item.getUpdatedAt() == null ? null : item.getUpdatedAt().toString());
        return response;
    }

    private Map<String, Object> toBatchResponse(DeveloperSelectionBatch batch) {
        Map<String, Object> response = objectMapper.convertValue(
                batch, new TypeReference<LinkedHashMap<String, Object>>() { });
        response.put("id", String.valueOf(batch.getId()));
        response.put("userId", String.valueOf(batch.getUserId()));
        response.put("batchDate", batch.getBatchDate() == null ? null : batch.getBatchDate().toString());
        response.put("createdAt", batch.getCreatedAt() == null ? null : batch.getCreatedAt().toString());
        response.put("updatedAt", batch.getUpdatedAt() == null ? null : batch.getUpdatedAt().toString());
        return response;
    }

    private List<Long> normalizeIds(List<Long> ids) {
        if (ids == null) return List.of();
        return ids.stream()
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
    }

    private String normalizeBatchName(String value) {
        String name = value == null ? "" : value.trim();
        if (name.isEmpty()) throw new IllegalArgumentException("批次名称不能为空");
        if (name.length() > 50) throw new IllegalArgumentException("批次名称不能超过50个字符");
        return name;
    }

    private DeveloperOwner resolveOwner(Long currentUserId, String username, String role,
                                        Long requestedUserId, String requestedName) {
        Map<String, Object> option;
        if (isAdmin(role)) {
            option = requestedUserId == null
                    ? mapper.selectActiveDeveloperByName(DEFAULT_ADMIN_DEVELOPER_NAME)
                    : mapper.selectActiveDeveloperById(requestedUserId);
            if (option == null) {
                String target = requestedUserId == null
                        ? DEFAULT_ADMIN_DEVELOPER_NAME
                        : String.valueOf(requestedUserId);
                throw new IllegalArgumentException("未找到有效的默认开发人: " + target);
            }
            return toDeveloperOwner(option);
        }

        option = mapper.selectActiveDeveloperById(currentUserId);
        if (option != null) return toDeveloperOwner(option);
        String fallbackName = StringUtils.hasText(requestedName)
                ? requestedName.trim()
                : (StringUtils.hasText(username) ? username.trim() : "用户" + currentUserId);
        return new DeveloperOwner(currentUserId, fallbackName);
    }

    private DeveloperOwner toDeveloperOwner(Map<String, Object> option) {
        Long userId = Long.valueOf(String.valueOf(option.get("userId")));
        String developerName = String.valueOf(option.get("developerName"));
        return new DeveloperOwner(userId, developerName);
    }

    private void applyFulfillmentFilter(LambdaQueryWrapper<DeveloperSelectionLibraryItem> wrapper,
                                        List<String> fulfillmentValues) {
        if (fulfillmentValues == null || fulfillmentValues.isEmpty()) return;
        List<String> values = fulfillmentValues.stream()
                .filter(StringUtils::hasText)
                .map(value -> value.trim().toUpperCase(Locale.ROOT))
                .filter(Set.of("AMZ", "FBA", "FBM")::contains)
                .distinct()
                .toList();
        if (values.isEmpty()) return;
        wrapper.and(group -> {
            boolean first = true;
            for (String value : values) {
                if (!first) group.or();
                group.like(DeveloperSelectionLibraryItem::getSnapshotJson,
                                "\"fulfillment\":\"" + value + "\"")
                        .or().like(DeveloperSelectionLibraryItem::getSnapshotJson,
                                "\"deliveryMethod\":\"" + value + "\"")
                        .or().like(DeveloperSelectionLibraryItem::getSnapshotJson,
                                "\"delivery_method\":\"" + value + "\"");
                first = false;
            }
        });
    }

    private void applyCreatedWeekFilter(LambdaQueryWrapper<DeveloperSelectionLibraryItem> wrapper,
                                        List<String> createdWeeks) {
        if (createdWeeks == null || createdWeeks.isEmpty()) return;
        List<WeekRange> ranges = createdWeeks.stream()
                .map(this::parseIsoWeek)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        if (ranges.isEmpty()) return;
        wrapper.and(group -> {
            boolean first = true;
            for (WeekRange range : ranges) {
                if (!first) group.or();
                group.ge(DeveloperSelectionLibraryItem::getCreatedAt, range.start())
                        .lt(DeveloperSelectionLibraryItem::getCreatedAt, range.endExclusive());
                first = false;
            }
        });
    }

    private WeekRange parseIsoWeek(String value) {
        if (!StringUtils.hasText(value) || !value.matches("\\d{4}-W\\d{2}")) return null;
        int year = Integer.parseInt(value.substring(0, 4));
        int week = Integer.parseInt(value.substring(6, 8));
        if (week < 1 || week > 53) return null;
        WeekFields iso = WeekFields.ISO;
        LocalDate monday = LocalDate.of(year, 1, 4)
                .with(iso.weekOfWeekBasedYear(), week)
                .with(iso.dayOfWeek(), 1);
        return new WeekRange(monday.atStartOfDay(), monday.plusWeeks(1).atStartOfDay());
    }

    private record WeekRange(LocalDateTime start, LocalDateTime endExclusive) {
    }

    private record DeveloperOwner(Long userId, String developerName) {
    }
}

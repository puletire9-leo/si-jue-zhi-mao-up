package com.sjzm.product.service.impl;

import com.sjzm.product.mapper.CategoryAgeTierBaselineMapper;
import com.sjzm.product.service.CategoryAgeTierBaselineService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class CategoryAgeTierBaselineServiceImpl implements CategoryAgeTierBaselineService {

    private final CategoryAgeTierBaselineMapper mapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> computeAndTagByMonth(String month, String marketplace) {
        String baselineMonth = normalizeMonth(month);
        String mp = normalizeMarketplace(marketplace);

        int deleted = mapper.deleteByBaselineMonth(baselineMonth, mp);
        int basesInserted = mapper.insertComputedSlices(baselineMonth, mp);
        int asinsTagged = mapper.tagAsinsByMonth(baselineMonth, mp);

        log.info("M04 月度刷新完成: month={}, marketplace={}, basesDeleted={}, basesInserted={}, asinsTagged={}",
                baselineMonth, mp, deleted, basesInserted, asinsTagged);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("baselineMonth", baselineMonth);
        result.put("marketplace", mp == null ? "ALL" : mp);
        result.put("basesDeleted", deleted);
        result.put("basesInserted", basesInserted);
        result.put("asinsTagged", asinsTagged);
        return result;
    }

    @Override
    public Map<String, Object> tagAsinsByWeek(String weekTag, String month, String marketplace) {
        String wt = requireText(weekTag, "weekTag 不能为空");
        String baselineMonth = normalizeMonth(month);
        String mp = normalizeMarketplace(marketplace);

        int asinsTagged = mapper.tagAsinsByWeek(wt, baselineMonth, mp);

        log.info("M04 周度打标完成: weekTag={}, baselineMonth={}, marketplace={}, asinsTagged={}",
                wt, baselineMonth, mp, asinsTagged);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("weekTag", wt);
        result.put("baselineMonth", baselineMonth);
        result.put("marketplace", mp == null ? "ALL" : mp);
        result.put("asinsTagged", asinsTagged);
        return result;
    }

    private String normalizeMonth(String month) {
        String value = trimToNull(month);
        if (value == null) {
            throw new IllegalArgumentException("month 不能为空，需 yyyyMM 或 yyyy-MM");
        }
        String normalized = value.replace("-", "").replace("/", "");
        if (!normalized.matches("\\d{6}")) {
            throw new IllegalArgumentException("month 只支持 yyyyMM 或 yyyy-MM");
        }
        return normalized;
    }

    private String normalizeMarketplace(String marketplace) {
        String value = trimToNull(marketplace);
        return value == null ? null : value.toUpperCase(Locale.ROOT);
    }

    private String requireText(String value, String message) {
        String v = trimToNull(value);
        if (v == null) {
            throw new IllegalArgumentException(message);
        }
        return v;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String t = value.trim();
        return t.isEmpty() ? null : t;
    }
}

package com.sjzm.product.service.impl;

import com.sjzm.product.mapper.CompetitorProductsCleanMapper;
import com.sjzm.product.service.CleanLayerService;
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
public class CleanLayerServiceImpl implements CleanLayerService {

    private final CompetitorProductsCleanMapper cleanMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> cleanWeekBatch(String marketplace, String weekTag) {
        String mp = requireText(marketplace, "marketplace 不能为空").toUpperCase(Locale.ROOT);
        String wt = requireText(weekTag, "weekTag 不能为空");

        long startMs = System.currentTimeMillis();
        int affected = cleanMapper.refreshByWeekTag(mp, wt);
        long elapsedMs = System.currentTimeMillis() - startMs;

        log.info("清洗层增量刷新完成: marketplace={}, weekTag={}, affectedRows={}, elapsedMs={}",
                mp, wt, affected, elapsedMs);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("marketplace", mp);
        result.put("weekTag", wt);
        result.put("affectedRows", affected);
        result.put("elapsedMs", elapsedMs);
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> cleanByEffectiveWeekTag(String marketplace, String effectiveWeekTag) {
        String mp = requireText(marketplace, "marketplace 不能为空").toUpperCase(Locale.ROOT);
        String etk = requireText(effectiveWeekTag, "effectiveWeekTag 不能为空");

        long startMs = System.currentTimeMillis();
        int affected = cleanMapper.refreshBatch(mp, etk);
        long elapsedMs = System.currentTimeMillis() - startMs;

        log.info("清洗层批次刷新完成: marketplace={}, effectiveWeekTag={}, affectedRows={}, elapsedMs={}",
                mp, etk, affected, elapsedMs);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("marketplace", mp);
        result.put("effectiveWeekTag", etk);
        result.put("affectedRows", affected);
        result.put("elapsedMs", elapsedMs);
        return result;
    }

    private String requireText(String value, String message) {
        if (value == null) {
            throw new IllegalArgumentException(message);
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException(message);
        }
        return trimmed;
    }
}

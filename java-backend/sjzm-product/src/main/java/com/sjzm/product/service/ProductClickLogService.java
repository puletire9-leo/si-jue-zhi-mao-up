package com.sjzm.product.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.product.entity.ProductClickLog;
import com.sjzm.product.mapper.ProductClickLogMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class ProductClickLogService {

    private final ProductClickLogMapper mapper;

    public void log(Long userId, String asin, String marketplace, String source,
                    String action, String productTitle, String userName) {
        try {
            ProductClickLog log = new ProductClickLog();
            log.setUserId(userId);
            log.setUserName(userName);
            log.setAsin(asin);
            log.setMarketplace(marketplace);
            log.setSource(source);
            log.setAction(action);
            log.setProductTitle(productTitle);
            log.setClickedAt(LocalDateTime.now());
            mapper.insert(log);
        } catch (Exception e) {
            log.warn("点击记录写入失败: userId={} asin={} action={}", userId, asin, action, e);
        }
    }

    /**
     * 获取用户在指定站点当前选中的 ASIN 列表
     * 逻辑：每个 user+asin 的最新 action 如果是 select 则算选中
     */
    public Set<String> getUserSelections(Long userId, String marketplace) {
        LambdaQueryWrapper<ProductClickLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ProductClickLog::getUserId, userId)
               .eq(ProductClickLog::getMarketplace, marketplace)
               .in(ProductClickLog::getAction, "select", "unselect")
               .orderByDesc(ProductClickLog::getClickedAt);
        List<ProductClickLog> logs = mapper.selectList(wrapper);

        Set<String> selected = new HashSet<>();
        Set<String> seen = new HashSet<>();
        for (ProductClickLog log : logs) {
            String key = log.getAsin();
            if (!seen.contains(key)) {
                seen.add(key);
                if ("select".equals(log.getAction())) {
                    selected.add(key);
                }
            }
        }
        return selected;
    }

    /**
     * 获取多个 ASIN 的选中用户列表（按 marketplace 隔离）
     * 返回 Map<asin, List<{userId, userName}>>
     */
    public Map<String, List<Map<String, Object>>> getSelectionUsers(List<String> asins, String marketplace) {
        // 子查询：每个 user+asin 的最新 action，按 marketplace 隔离
        LambdaQueryWrapper<ProductClickLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.in(ProductClickLog::getAsin, asins)
               .eq(ProductClickLog::getMarketplace, marketplace)
               .in(ProductClickLog::getAction, "select", "unselect")
               .orderByDesc(ProductClickLog::getClickedAt);
        List<ProductClickLog> logs = mapper.selectList(wrapper);

        Map<String, String> latestAction = new HashMap<>();
        for (ProductClickLog log : logs) {
            String key = log.getAsin() + "_" + log.getUserId();
            latestAction.putIfAbsent(key, log.getAction());
        }

        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
        Set<String> seenUserAsin = new HashSet<>();

        for (ProductClickLog log : logs) {
            String key = log.getAsin() + "_" + log.getUserId();
            if (seenUserAsin.contains(key)) continue;
            seenUserAsin.add(key);

            String action = latestAction.get(key);
            if (!"select".equals(action)) continue;

            result.computeIfAbsent(log.getAsin(), k -> new ArrayList<>())
                  .add(Map.of("userId", log.getUserId(), "userName", log.getUserName() != null ? log.getUserName() : ""));
        }

        // 去重每个 ASIN 下的 userId
        for (Map.Entry<String, List<Map<String, Object>>> entry : result.entrySet()) {
            Set<Long> seen = new HashSet<>();
            List<Map<String, Object>> deduped = new ArrayList<>();
            for (Map<String, Object> u : entry.getValue()) {
                Long uid = ((Number) u.get("userId")).longValue();
                if (seen.add(uid)) {
                    deduped.add(u);
                }
            }
            entry.setValue(deduped);
        }
        return result;
    }
}

package com.sjzm.product.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sjzm.product.entity.UserFilterPreset;
import com.sjzm.product.mapper.UserFilterPresetMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserFilterPresetService {

    private final UserFilterPresetMapper mapper;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final int MAX_PRESETS = 9;

    public List<UserFilterPreset> getPresets(Long userId) {
        return mapper.selectList(new LambdaQueryWrapper<UserFilterPreset>()
                .eq(UserFilterPreset::getUserId, userId)
                .orderByAsc(UserFilterPreset::getPresetIndex));
    }

    public Map<String, Object> getDefaultConfig(Long userId) {
        UserFilterPreset preset = mapper.selectOne(new LambdaQueryWrapper<UserFilterPreset>()
                .eq(UserFilterPreset::getUserId, userId)
                .eq(UserFilterPreset::getIsDefault, 1));
        if (preset == null) return null;
        return parseConfig(preset.getFilterConfig());
    }

    @Transactional
    public UserFilterPreset savePreset(Long userId, String name, int index, Map<String, Object> config) {
        if (index < 1 || index > MAX_PRESETS) throw new IllegalArgumentException("Slot 1-" + MAX_PRESETS);

        UserFilterPreset existing = mapper.selectOne(new LambdaQueryWrapper<UserFilterPreset>()
                .eq(UserFilterPreset::getUserId, userId)
                .eq(UserFilterPreset::getPresetIndex, index));

        if (existing != null) {
            existing.setPresetName(name);
            existing.setFilterConfig(toJson(config));
            existing.setUpdatedAt(LocalDateTime.now());
            mapper.updateById(existing);
            return existing;
        }

        Long count = mapper.selectCount(new LambdaQueryWrapper<UserFilterPreset>()
                .eq(UserFilterPreset::getUserId, userId));
        if (count >= MAX_PRESETS) throw new IllegalStateException("Max " + MAX_PRESETS + " presets");

        UserFilterPreset preset = new UserFilterPreset();
        preset.setUserId(userId);
        preset.setPresetName(name);
        preset.setPresetIndex(index);
        preset.setIsDefault(count == 0 ? 1 : 0);
        preset.setFilterConfig(toJson(config));
        preset.setCreatedAt(LocalDateTime.now());
        preset.setUpdatedAt(LocalDateTime.now());
        mapper.insert(preset);
        return preset;
    }

    @Transactional
    public UserFilterPreset updatePreset(Long id, Long userId, String name, Map<String, Object> config) {
        UserFilterPreset preset = mapper.selectById(id);
        if (preset == null || !preset.getUserId().equals(userId)) throw new IllegalArgumentException("Not found");
        if (name != null) preset.setPresetName(name);
        if (config != null) preset.setFilterConfig(toJson(config));
        preset.setUpdatedAt(LocalDateTime.now());
        mapper.updateById(preset);
        return preset;
    }

    @Transactional
    public void deletePreset(Long id, Long userId) {
        UserFilterPreset preset = mapper.selectById(id);
        if (preset == null || !preset.getUserId().equals(userId)) throw new IllegalArgumentException("Not found");
        mapper.deleteById(id);
    }

    @Transactional
    public void setDefault(Long id, Long userId) {
        // 批量重置所有预设为非默认
        mapper.update(null, new LambdaUpdateWrapper<UserFilterPreset>()
                .eq(UserFilterPreset::getUserId, userId)
                .set(UserFilterPreset::getIsDefault, 0));
        // 设置目标为默认
        UserFilterPreset target = mapper.selectById(id);
        if (target == null || !target.getUserId().equals(userId)) throw new IllegalArgumentException("Not found");
        target.setIsDefault(1);
        mapper.updateById(target);
    }

    private String toJson(Map<String, Object> config) {
        try { return objectMapper.writeValueAsString(config); } catch (Exception e) { return "{}"; }
    }

    private Map<String, Object> parseConfig(String json) {
        try { return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {}); }
        catch (Exception e) { return new LinkedHashMap<>(); }
    }
}

package com.sjzm.product.modules.roster.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.product.mapper.PersonRosterMapper;
import com.sjzm.product.modules.roster.entity.PersonRoster;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 人员名单服务。按职能（role_type）增删改查，供各处下拉/导入统一取名单。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PersonRosterService {

    private static final Set<String> ALLOWED_ROLE_TYPES = Set.of(
            "developer", "operator", "product_manager", "purchaser");

    private final PersonRosterMapper mapper;

    /** 按职能取完整记录（含 id，管理界面用），仅启用，按 sort_order 升序。 */
    public List<PersonRoster> listByRole(String roleType) {
        return listByRole(roleType, false);
    }

    /** 按职能取管理记录；includeDisabled=true 时包含停用人员。 */
    public List<PersonRoster> listByRole(String roleType, boolean includeDisabled) {
        LambdaQueryWrapper<PersonRoster> qw = new LambdaQueryWrapper<PersonRoster>()
                .orderByAsc(PersonRoster::getSortOrder)
                .orderByAsc(PersonRoster::getId);
        if (!includeDisabled) {
            qw.eq(PersonRoster::getEnabled, 1);
        }
        if (roleType != null && !roleType.isBlank()) {
            qw.eq(PersonRoster::getRoleType, normalizeRoleType(roleType));
        }
        return mapper.selectList(qw);
    }

    /** 按职能取姓名数组（下拉用）。 */
    public List<String> listNames(String roleType) {
        List<String> names = new ArrayList<>();
        for (PersonRoster p : listByRole(roleType)) {
            names.add(p.getName());
        }
        return names;
    }

    /** 读取报表日期当天有效的人员名单，供历史日报冻结口径使用。 */
    public List<String> listNamesEffectiveOn(String roleType, LocalDate reportDate) {
        if (reportDate == null) {
            throw new IllegalArgumentException("reportDate 不能为空");
        }
        LambdaQueryWrapper<PersonRoster> qw = new LambdaQueryWrapper<PersonRoster>()
                .eq(PersonRoster::getRoleType, normalizeRoleType(roleType))
                .eq(PersonRoster::getEnabled, 1)
                .and(w -> w.isNull(PersonRoster::getEffectiveFrom)
                        .or().le(PersonRoster::getEffectiveFrom, reportDate))
                .and(w -> w.isNull(PersonRoster::getEffectiveTo)
                        .or().ge(PersonRoster::getEffectiveTo, reportDate))
                .orderByAsc(PersonRoster::getSortOrder)
                .orderByAsc(PersonRoster::getId);
        return mapper.selectList(qw).stream()
                .map(PersonRoster::getName)
                .toList();
    }

    /** 新增/保存一条。id 为空则新增，否则按 id 更新。 */
    public void save(PersonRoster p) {
        if (p == null) throw new IllegalArgumentException("人员信息不能为空");
        if (p.getName() == null || p.getName().isBlank()) {
            throw new IllegalArgumentException("姓名不能为空");
        }
        p.setName(p.getName().trim());
        p.setRoleType(normalizeRoleType(p.getRoleType()));
        if (p.getEffectiveFrom() != null && p.getEffectiveTo() != null
                && p.getEffectiveTo().isBefore(p.getEffectiveFrom())) {
            throw new IllegalArgumentException("失效日期不能早于生效日期");
        }
        if (p.getEnabled() == null) p.setEnabled(1);
        if (p.getSortOrder() == null) p.setSortOrder(0);
        if (p.getId() == null) {
            mapper.insert(p);
        } else {
            mapper.updateById(p);
        }
    }

    public void deleteById(Long id) {
        PersonRoster existing = mapper.selectById(id);
        if (existing == null) return;
        existing.setEnabled(0);
        mapper.updateById(existing);
    }

    /**
     * 整组覆盖某职能的名单（兼容"编辑整个列表"交互）。
     * 为保留历史引用，不物理删除：旧记录先停用，同名记录复用并重新启用。
     */
    @Transactional(rollbackFor = Exception.class)
    public void batchSet(String roleType, List<String> names) {
        roleType = normalizeRoleType(roleType);
        List<PersonRoster> existingRows = listByRole(roleType, true);
        Map<String, PersonRoster> existingByName = new LinkedHashMap<>();
        for (PersonRoster existing : existingRows) {
            existing.setEnabled(0);
            mapper.updateById(existing);
            existingByName.put(existing.getName(), existing);
        }
        int order = 1;
        for (String name : names) {
            if (name == null || name.isBlank()) continue;
            String normalizedName = name.trim();
            PersonRoster p = existingByName.getOrDefault(normalizedName, new PersonRoster());
            p.setName(normalizedName);
            p.setRoleType(roleType);
            p.setSortOrder(order++);
            p.setEnabled(1);
            if (p.getId() == null) mapper.insert(p);
            else mapper.updateById(p);
        }
        log.info("人员名单整组覆盖: roleType={}, 共 {} 人", roleType, order - 1);
    }

    private String normalizeRoleType(String roleType) {
        if (roleType == null || roleType.isBlank()) {
            throw new IllegalArgumentException("职能不能为空");
        }
        String normalized = roleType.trim().toLowerCase();
        if (!ALLOWED_ROLE_TYPES.contains(normalized)) {
            throw new IllegalArgumentException("不支持的职能: " + roleType);
        }
        return normalized;
    }
}

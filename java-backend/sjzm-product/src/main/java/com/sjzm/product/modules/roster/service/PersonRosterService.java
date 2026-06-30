package com.sjzm.product.modules.roster.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.product.mapper.PersonRosterMapper;
import com.sjzm.product.modules.roster.entity.PersonRoster;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * 人员名单服务。按职能（role_type）增删改查，供各处下拉/导入统一取名单。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PersonRosterService {

    private final PersonRosterMapper mapper;

    /** 按职能取完整记录（含 id，管理界面用），仅启用，按 sort_order 升序。 */
    public List<PersonRoster> listByRole(String roleType) {
        LambdaQueryWrapper<PersonRoster> qw = new LambdaQueryWrapper<PersonRoster>()
                .eq(PersonRoster::getEnabled, 1)
                .orderByAsc(PersonRoster::getSortOrder)
                .orderByAsc(PersonRoster::getId);
        if (roleType != null && !roleType.isBlank()) {
            qw.eq(PersonRoster::getRoleType, roleType);
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

    /** 新增/保存一条。id 为空则新增，否则按 id 更新。 */
    public void save(PersonRoster p) {
        if (p.getEnabled() == null) p.setEnabled(1);
        if (p.getSortOrder() == null) p.setSortOrder(0);
        if (p.getId() == null) {
            mapper.insert(p);
        } else {
            mapper.updateById(p);
        }
    }

    public void deleteById(Long id) {
        mapper.deleteById(id);
    }

    /**
     * 整组覆盖某职能的名单（兼容"编辑整个列表"交互）。
     * 删掉该职能现有全部，再按传入顺序重建。
     */
    @Transactional(rollbackFor = Exception.class)
    public void batchSet(String roleType, List<String> names) {
        if (roleType == null || roleType.isBlank()) {
            throw new IllegalArgumentException("roleType 不能为空");
        }
        mapper.delete(new LambdaQueryWrapper<PersonRoster>()
                .eq(PersonRoster::getRoleType, roleType));
        int order = 1;
        for (String name : names) {
            if (name == null || name.isBlank()) continue;
            PersonRoster p = new PersonRoster();
            p.setName(name.trim());
            p.setRoleType(roleType);
            p.setSortOrder(order++);
            p.setEnabled(1);
            mapper.insert(p);
        }
        log.info("人员名单整组覆盖: roleType={}, 共 {} 人", roleType, order - 1);
    }
}

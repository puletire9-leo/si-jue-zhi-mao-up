package com.sjzm.product.modules.roster.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.sjzm.product.mapper.PersonRosterMapper;
import com.sjzm.product.modules.roster.entity.PersonRoster;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PersonRosterServiceTest {

    private final PersonRosterMapper mapper = mock(PersonRosterMapper.class);
    private final PersonRosterService service = new PersonRosterService(mapper);

    @Test
    void effectiveListUsesInclusiveDateWindowAndStableOrder() {
        PersonRoster first = person(1L, "刘淼");
        PersonRoster second = person(2L, "夏浩宇");
        when(mapper.selectList(any())).thenReturn(List.of(first, second));

        List<String> names = service.listNamesEffectiveOn(
                "developer", LocalDate.of(2026, 8, 12));

        assertThat(names).containsExactly("刘淼", "夏浩宇");
        ArgumentCaptor<Wrapper<PersonRoster>> captor = ArgumentCaptor.forClass(Wrapper.class);
        verify(mapper).selectList(captor.capture());
        assertThat(captor.getValue().getCustomSqlSegment())
                .contains("role_type", "enabled", "effective_from", "effective_to", "sort_order");
    }

    @Test
    void rejectsInvalidDateWindow() {
        PersonRoster person = person(null, "测试人员");
        person.setRoleType("operator");
        person.setEffectiveFrom(LocalDate.of(2026, 8, 12));
        person.setEffectiveTo(LocalDate.of(2026, 8, 11));

        assertThatThrownBy(() -> service.save(person))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("失效日期");
    }

    @Test
    void deleteDisablesInsteadOfRemovingHistory() {
        PersonRoster person = person(10L, "阳姣");
        person.setRoleType("operator");
        person.setEnabled(1);
        when(mapper.selectById(10L)).thenReturn(person);

        service.deleteById(10L);

        assertThat(person.getEnabled()).isZero();
        verify(mapper).updateById(person);
    }

    private PersonRoster person(Long id, String name) {
        PersonRoster person = new PersonRoster();
        person.setId(id);
        person.setName(name);
        person.setRoleType("developer");
        person.setSortOrder(1);
        person.setEnabled(1);
        return person;
    }
}

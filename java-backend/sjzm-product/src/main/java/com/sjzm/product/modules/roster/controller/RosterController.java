package com.sjzm.product.modules.roster.controller;

import com.sjzm.common.Result;
import com.sjzm.product.modules.roster.entity.PersonRoster;
import com.sjzm.product.modules.roster.service.PersonRosterService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 人员名单管理模块。
 * 前缀 /api/v1/modules/roster（网关 + nginx 已覆盖 /modules/**）。
 * 收口散落各处的开发人/产品负责人/采购员/运营名单，供前端统一增删改查。
 */
@RestController
@RequestMapping("/api/v1/modules/roster")
@RequiredArgsConstructor
@Tag(name = "人员名单", description = "按职能管理人员名单（开发人/运营/产品负责人/采购员）")
public class RosterController {

    private final PersonRosterService service;

    @GetMapping("/list")
    @Operation(summary = "按职能取名单（含 id，管理用）")
    public Result<List<PersonRoster>> list(@RequestParam(required = false) String roleType,
                                           @RequestParam(defaultValue = "false") boolean includeDisabled) {
        return Result.success(service.listByRole(roleType, includeDisabled));
    }

    @GetMapping("/names")
    @Operation(summary = "按职能取姓名数组（下拉用）")
    public Result<List<String>> names(@RequestParam String roleType) {
        return Result.success(service.listNames(roleType));
    }

    @PostMapping({"", "/"})
    @Operation(summary = "新增/更新一条人员（无 id 新增，有 id 更新）")
    public Result<String> save(@RequestBody PersonRoster person) {
        if (person.getName() == null || person.getName().isBlank()) {
            return Result.error(400, "姓名不能为空");
        }
        if (person.getRoleType() == null || person.getRoleType().isBlank()) {
            return Result.error(400, "职能不能为空");
        }
        service.save(person);
        return Result.success("保存成功");
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新一条人员")
    public Result<String> update(@PathVariable Long id, @RequestBody PersonRoster person) {
        person.setId(id);
        service.save(person);
        return Result.success("更新成功");
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除一条人员")
    public Result<String> delete(@PathVariable Long id) {
        service.deleteById(id);
        return Result.success("删除成功");
    }

    @PutMapping("/batch")
    @Operation(summary = "整组覆盖某职能名单（body: 姓名数组）")
    public Result<String> batch(@RequestParam String roleType, @RequestBody List<String> names) {
        service.batchSet(roleType, names);
        return Result.success("保存成功");
    }
}

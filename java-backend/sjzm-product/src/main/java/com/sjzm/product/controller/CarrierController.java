package com.sjzm.product.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.common.Result;
import com.sjzm.product.entity.NonstandardCarrier;
import com.sjzm.product.mapper.NonstandardCarrierMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 非标载体配置控制器。
 * 提供载体的查询 / 新增更新 / 删除。载体承载「一类非标品用哪套市场检索词」，
 * 供 AI 选品页的全量捞取（/ai-selection-pool/harvest）使用。
 *
 * <p>受 {@code features.ai-selection.enabled} 开关控制，默认关闭。</p>
 */
@RestController
@RequestMapping("/api/v1/nonstandard-carrier")
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "features.ai-selection", name = "enabled", havingValue = "true")
@Tag(name = "非标载体", description = "非标载体检索词配置")
public class CarrierController {

    private final NonstandardCarrierMapper carrierMapper;

    @GetMapping("/list")
    @Operation(summary = "载体列表", description = "返回所有非标载体，按 id 升序")
    public Result<List<NonstandardCarrier>> list() {
        LambdaQueryWrapper<NonstandardCarrier> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByAsc(NonstandardCarrier::getId);
        return Result.success(carrierMapper.selectList(wrapper));
    }

    @PostMapping
    @Operation(summary = "新增/更新载体", description = "带 id 则更新，否则新增")
    public Result<NonstandardCarrier> save(@RequestBody NonstandardCarrier carrier) {
        if (carrier.getId() != null) {
            carrierMapper.updateById(carrier);
        } else {
            carrierMapper.insert(carrier);
        }
        return Result.success(carrier);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除载体")
    public Result<Void> delete(@PathVariable Long id) {
        carrierMapper.deleteById(id);
        return Result.success();
    }
}

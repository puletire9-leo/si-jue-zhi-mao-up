package com.sjzm.product.rds.center;

import com.sjzm.common.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/modules/rds-center")
@RequiredArgsConstructor
@Tag(name = "RDS 管理中心", description = "集中查看业务库连接与接口绑定（不含密码）")
public class RdsCenterController {

    private final RdsCenterService rdsCenterService;

    @GetMapping("/overview")
    @Operation(summary = "连接池实况 + API 绑定清单")
    public Result<Map<String, Object>> overview() {
        return Result.success(rdsCenterService.overview());
    }
}

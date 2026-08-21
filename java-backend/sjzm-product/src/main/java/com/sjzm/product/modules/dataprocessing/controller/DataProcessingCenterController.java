package com.sjzm.product.modules.dataprocessing.controller;

import com.sjzm.common.Result;
import com.sjzm.product.modules.dataprocessing.dto.DataProcessingRunRequest;
import com.sjzm.product.modules.dataprocessing.pipeline.DataProcessingContext;
import com.sjzm.product.modules.dataprocessing.pipeline.DataProcessingPipelineDescriptor;
import com.sjzm.product.modules.dataprocessing.pipeline.DataProcessingResult;
import com.sjzm.product.modules.dataprocessing.service.DataProcessingCenterService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/modules/data-processing")
@RequiredArgsConstructor
@Tag(name = "Data Processing Center", description = "Typed data processing pipeline registry and execution")
public class DataProcessingCenterController {

    private final DataProcessingCenterService service;

    @GetMapping("/pipelines")
    @Operation(summary = "List registered data processing pipelines")
    public Result<List<DataProcessingPipelineDescriptor>> listPipelines() {
        return Result.success(service.listPipelines());
    }

    @PostMapping("/pipelines/{pipelineCode}/run")
    @Operation(summary = "Run a registered data processing pipeline once")
    public Result<DataProcessingResult> run(
            @PathVariable String pipelineCode,
            @RequestHeader(value = "X-Username", required = false) String username,
            @RequestBody(required = false) DataProcessingRunRequest request) {
        DataProcessingRunRequest body = request == null ? new DataProcessingRunRequest() : request;
        return Result.success(service.execute(pipelineCode, new DataProcessingContext(
                body.getTriggerType(), username, body.getCorrelationId(), body.getParameters())));
    }
}

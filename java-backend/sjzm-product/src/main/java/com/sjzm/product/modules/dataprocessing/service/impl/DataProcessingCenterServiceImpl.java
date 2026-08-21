package com.sjzm.product.modules.dataprocessing.service.impl;

import com.sjzm.common.BusinessException;
import com.sjzm.product.modules.dataprocessing.pipeline.DataProcessingContext;
import com.sjzm.product.modules.dataprocessing.pipeline.DataProcessingPipeline;
import com.sjzm.product.modules.dataprocessing.pipeline.DataProcessingPipelineDescriptor;
import com.sjzm.product.modules.dataprocessing.pipeline.DataProcessingPipelineRegistry;
import com.sjzm.product.modules.dataprocessing.pipeline.DataProcessingResult;
import com.sjzm.product.modules.dataprocessing.service.DataProcessingCenterService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DataProcessingCenterServiceImpl implements DataProcessingCenterService {

    private final DataProcessingPipelineRegistry registry;

    @Override
    public List<DataProcessingPipelineDescriptor> listPipelines() {
        return registry.list();
    }

    @Override
    public DataProcessingResult execute(String pipelineCode, DataProcessingContext context) {
        DataProcessingPipeline pipeline = registry.find(pipelineCode)
                .orElseThrow(() -> new BusinessException(404,
                        "Data processing pipeline not found: " + pipelineCode));
        DataProcessingResult result = pipeline.execute(context);
        return result == null ? DataProcessingResult.empty() : result;
    }
}

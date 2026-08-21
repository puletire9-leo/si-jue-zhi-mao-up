package com.sjzm.product.modules.dataprocessing.service;

import com.sjzm.product.modules.dataprocessing.pipeline.DataProcessingContext;
import com.sjzm.product.modules.dataprocessing.pipeline.DataProcessingPipelineDescriptor;
import com.sjzm.product.modules.dataprocessing.pipeline.DataProcessingResult;

import java.util.List;

public interface DataProcessingCenterService {

    List<DataProcessingPipelineDescriptor> listPipelines();

    DataProcessingResult execute(String pipelineCode, DataProcessingContext context);
}

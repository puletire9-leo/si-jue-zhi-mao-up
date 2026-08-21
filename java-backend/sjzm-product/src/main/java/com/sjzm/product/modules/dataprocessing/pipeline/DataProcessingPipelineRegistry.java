package com.sjzm.product.modules.dataprocessing.pipeline;

import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Component
public class DataProcessingPipelineRegistry {

    private final Map<String, DataProcessingPipeline> pipelines;

    public DataProcessingPipelineRegistry(List<DataProcessingPipeline> registeredPipelines) {
        Map<String, DataProcessingPipeline> indexed = new LinkedHashMap<>();
        for (DataProcessingPipeline pipeline : registeredPipelines) {
            String code = normalizeCode(pipeline.code());
            DataProcessingPipeline previous = indexed.putIfAbsent(code, pipeline);
            if (previous != null) {
                throw new IllegalStateException("Duplicate data processing pipeline code: " + code);
            }
        }
        this.pipelines = Map.copyOf(indexed);
    }

    public Optional<DataProcessingPipeline> find(String code) {
        return Optional.ofNullable(pipelines.get(normalizeCode(code)));
    }

    public List<DataProcessingPipelineDescriptor> list() {
        return pipelines.values().stream()
                .map(pipeline -> new DataProcessingPipelineDescriptor(
                        normalizeCode(pipeline.code()), pipeline.name(), pipeline.description()))
                .sorted(Comparator.comparing(DataProcessingPipelineDescriptor::code))
                .toList();
    }

    private String normalizeCode(String code) {
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("Pipeline code must not be blank");
        }
        return code.trim().toUpperCase(Locale.ROOT);
    }
}

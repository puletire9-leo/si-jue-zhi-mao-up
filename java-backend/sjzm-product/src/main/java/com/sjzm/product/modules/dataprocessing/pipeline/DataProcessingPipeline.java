package com.sjzm.product.modules.dataprocessing.pipeline;

/**
 * A typed data-processing pipeline registered in the data processing center.
 *
 * <p>Connectors fetch source data. Pipelines normalize, validate, deduplicate,
 * enrich, and materialize business data. Pipelines must not own scheduling or
 * destination delivery.</p>
 */
public interface DataProcessingPipeline {

    String code();

    String name();

    default String description() {
        return "";
    }

    DataProcessingResult execute(DataProcessingContext context);
}

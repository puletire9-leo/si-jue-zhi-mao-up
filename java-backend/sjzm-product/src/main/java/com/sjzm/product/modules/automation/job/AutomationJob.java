package com.sjzm.product.modules.automation.job;

/** A strongly typed automation unit registered in the automation center. */
public interface AutomationJob {

    String code();

    String name();

    default String description() {
        return "";
    }

    AutomationJobResult execute(AutomationExecutionContext context);
}

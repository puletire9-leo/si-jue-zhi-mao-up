package com.sjzm.product.modules.automation.service;

import com.sjzm.product.modules.automation.entity.AutomationRecordBinding;

public interface AutomationBindingService {

    AutomationRecordBinding find(String jobCode, String businessKey,
                                 String targetType, String targetResource);

    AutomationRecordBinding bind(AutomationRecordBinding binding);

    void markTerminal(Long bindingId, String businessStatus);
}

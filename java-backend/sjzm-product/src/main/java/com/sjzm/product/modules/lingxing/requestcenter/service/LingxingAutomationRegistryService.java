package com.sjzm.product.modules.lingxing.requestcenter.service;

import com.sjzm.product.modules.lingxing.requestcenter.entity.LingxingAutomationRequestRegistry;
import com.sjzm.product.modules.lingxing.requestcenter.entity.LingxingRequestTask;

import java.time.LocalDateTime;
import java.util.List;

/** 领星自动化请求注册、排期和到期入队服务。 */
public interface LingxingAutomationRegistryService {

    List<LingxingAutomationRequestRegistry> listRegistrations(Boolean enabled);

    LingxingAutomationRequestRegistry saveRegistration(LingxingAutomationRequestRegistry input);

    LingxingAutomationRequestRegistry setEnabled(String registrationCode, boolean enabled);

    List<LingxingAutomationRequestRegistry> listDue(LocalDateTime now, int limit);

    LingxingRequestTask dispatch(String registrationCode, boolean dueOnly, String operator);
}

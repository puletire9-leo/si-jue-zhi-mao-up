package com.sjzm.product.modules.automation.service;

import com.sjzm.product.modules.automation.dto.AutomationRunRequest;
import com.sjzm.product.modules.automation.entity.AutomationRun;

import java.util.List;
import java.util.Map;

public interface AutomationCenterService {

    List<Map<String, Object>> listJobs();

    AutomationRun trigger(String jobCode, String requestedBy, AutomationRunRequest request);

    List<AutomationRun> listRuns(String jobCode, int limit);

    /**
     * 启动恢复：把领星队列关联的遗留 RUNNING 审计收口为失败，并写入“进程重启中断”。
     * 不停止仍在本进程执行中的任务；应在重置遗留 {@code lingxing_request_task} 之前调用。
     */
    int interruptStaleLingxingRequestRuns();
}

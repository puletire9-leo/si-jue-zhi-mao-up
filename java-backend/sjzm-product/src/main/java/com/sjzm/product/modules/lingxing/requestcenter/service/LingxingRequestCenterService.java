package com.sjzm.product.modules.lingxing.requestcenter.service;

import com.sjzm.common.PageResult;
import com.sjzm.product.modules.lingxing.requestcenter.entity.LingxingRequestTask;

import java.util.Map;
import java.util.Set;

/**
 * 领星请求中心服务：任务的入队、恢复、查询与驱动。
 */
public interface LingxingRequestCenterService {

    /**
     * 入队一个任务（PENDING）并在事务提交后触发单线程消费。
     *
     * @param taskType    任务类型，对应已注册处理器
     * @param payloadJson 任务载荷 JSON（可空）
     * @param operator    操作人（可空）
     */
    LingxingRequestTask enqueue(String taskType, String payloadJson, String operator);

    /** 由自动化注册表入队，并保留注册来源和队列优先级。 */
    LingxingRequestTask enqueueRegistered(Long registryId, String registrationCode,
                                          String taskType, String payloadJson,
                                          Integer priority, String operator);

    /** 按任务号查询任务（含状态）。 */
    LingxingRequestTask getTask(String taskId);

    /** 任务分页查询。 */
    PageResult<LingxingRequestTask> listTasks(String taskType, String status, Integer page, Integer size);

    /** 唤醒单线程 worker 消费 PENDING 任务（幂等；任务创建/恢复后自动调用）。 */
    Map<String, Object> startAutoConsume(String taskId);

    /** 停止任务：PENDING/RUNNING → STOPPED。 */
    int stop(String taskId);

    /**
     * 启动恢复：先收口领星关联的遗留 RUNNING 自动化审计，再把上次进程遗留的 RUNNING
     * 队列任务重置为 PENDING，并唤醒 worker 消费。
     * 应用就绪后由 {@code @EventListener(ApplicationReadyEvent)} 自动触发。
     */
    int recoverQueuedTasks();

    /** 列出已注册的任务处理器类型（调试/前端展示用）。 */
    Set<String> knownHandlerTypes();
}

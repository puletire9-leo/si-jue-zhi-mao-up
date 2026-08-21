package com.sjzm.product.modules.lingxing.requestcenter.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 领星请求中心任务：一次按任务类型分发的持久化执行任务。
 *
 * <p>与卖家精灵请求中心的 run/item 两级结构不同，领星请求中心是单表任务模型——
 * 一个任务对应一次“领星开放平台调用”，由按 {@code taskType} 注册的
 * {@link com.sjzm.product.modules.lingxing.requestcenter.handler.LingxingTaskHandler}
 * 消费执行。业务逻辑（财务/产品表现等）不在本基础设施内实现。</p>
 *
 * <p>状态机：PENDING → RUNNING → SUCCESS / FAILED；任意活跃态可 STOPPED。</p>
 */
@Data
@TableName("lingxing_request_task")
public class LingxingRequestTask {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 业务任务号，形如 LX_xxxxxxxxxxxx（唯一键）。 */
    private String taskId;

    /** 任务类型，对应 {@code LingxingTaskHandler#taskType()}。 */
    private String taskType;

    /** 来源注册项 ID；人工临时任务为空。 */
    private Long registryId;

    /** 来源注册编码；用于从单次请求追溯到自动化排期。 */
    private String registrationCode;

    /** 队列优先级，数值越大越先执行；同优先级仍按 ID FIFO。 */
    private Integer priority;

    /** 账号维度（领星 AppId），用于记录任务归属账号；客户端按此串行化。 */
    private String accountKey;

    /** PENDING / RUNNING / SUCCESS / FAILED / STOPPED */
    private String status;

    /** 任务载荷 JSON（处理器自行解析）。 */
    private String payloadJson;

    /** 任务结果摘要 JSON（成功时由处理器写入）。 */
    private String resultJson;

    /** 任务级错误信息。 */
    private String errorMessage;

    /** 已执行尝试次数。 */
    private Integer attemptCount;

    /** 允许自动重试的最早时间（当前版不自动重试，保留字段）。 */
    private LocalDateTime nextRetryAt;

    private String operator;

    private LocalDateTime startedAt;

    private LocalDateTime finishedAt;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}

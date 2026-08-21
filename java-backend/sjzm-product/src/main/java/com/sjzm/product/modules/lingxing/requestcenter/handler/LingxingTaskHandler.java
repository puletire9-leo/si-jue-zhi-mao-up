package com.sjzm.product.modules.lingxing.requestcenter.handler;

/**
 * 领星请求中心任务处理器（可插拔，按 {@link #taskType()} 注册）。
 *
 * <p>一个任务类型对应一个处理器；实现类只需声明为 Spring bean，
 * {@link LingxingTaskHandlerRegistry} 会自动收集并按 taskType 建立索引。
 * 业务逻辑（如财务日报、产品表现日同步）应实现本接口挂到请求中心，
 * 但请求中心基础设施本身不包含任何业务实现。</p>
 */
public interface LingxingTaskHandler {

    /** 返回本处理器负责的任务类型（非空、大小写归一后唯一）。 */
    String taskType();

    /** 执行任务；抛出异常或返回 failure 结果都会使任务进入 FAILED。 */
    LingxingTaskResult execute(LingxingTaskExecutionContext context);
}

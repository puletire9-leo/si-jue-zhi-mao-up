package com.sjzm.product.modules.bazhuayu.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;

/**
 * 八爪鱼导入（drain + 初筛）阶段的协作式暂停信号中心。
 *
 * <p>进程内存态，key = asin_import_tasks.id。导入 worker 每处理完一页检查该信号，
 * 命中 PAUSE 即处理完当前页后跳出、落盘 offset 检查点、任务置 PAUSED。</p>
 *
 * <p>与 {@link BazhuayuRunStateService}（一条龙 6 槽位云端采集态）互补：那个管云端采集，
 * 这个管本地导入线程的暂停。服务重启信号丢失无妨——PAUSED 已落库，靠 resume 重投 worker。</p>
 */
@Slf4j
@Service
public class BazhuayuImportControlService {

    /** 只有 PAUSE 一种信号：暂停但保留断点，可续。 */
    private final Map<Long, Boolean> pauseSignals = new ConcurrentHashMap<>();

    /** 请求暂停某导入任务：worker 处理完当前页后自行跳出。 */
    public void requestPause(Long taskId) {
        if (taskId == null) return;
        pauseSignals.put(taskId, Boolean.TRUE);
        log.info("[导入控制] 任务 {} 收到暂停信号", taskId);
    }

    /** worker 每页检查：是否被要求暂停。 */
    public boolean isPauseRequested(Long taskId) {
        return taskId != null && Boolean.TRUE.equals(pauseSignals.get(taskId));
    }

    /** 清除信号（resume 重投 worker 前 / worker 收口后调用），避免陈旧信号误伤新一轮。 */
    public void clear(Long taskId) {
        if (taskId == null) return;
        pauseSignals.remove(taskId);
    }
}

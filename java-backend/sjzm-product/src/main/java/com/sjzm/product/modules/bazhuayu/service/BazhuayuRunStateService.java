package com.sjzm.product.modules.bazhuayu.service;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 八爪鱼 6 任务（榜单×3 + 以图识图×3）一条龙运行态。
 *
 * 进程内存态，不落库——服务重启后丢失，正在跑的云端采集仍在八爪鱼侧继续，
 * 重启后用「读取已采数据」(drain) 把已采好的拉回即可。
 *
 * taskKey = function + ":" + marketplace，如 "bangdan:US"，每任务一个独立槽。
 * tryBegin 用 CAS 语义保证「同任务空闲才能启动」，cancelRequested 实现协作式取消。
 */
@Slf4j
@Service
public class BazhuayuRunStateService {

    /** 一条龙阶段。终态：DONE/ERROR/TIMEOUT/STOPPED（可再次 tryBegin）。 */
    public enum Phase {
        IDLE,           // 从未跑过（仅占位，不会真正写入）
        STARTING,       // 正在调 startExtraction
        WAITING_CLOUD,  // 已启动，轮询等云端采完
        DRAINING,       // 云端采完，正在 drain 入库初筛（仅榜单）
        DONE,           // 成功完成
        ERROR,          // 异常
        TIMEOUT,        // 等待云端超时
        STOPPED         // 用户主动停止
    }

    @Data
    public static class RunState {
        private String taskKey;
        private String function;
        private String marketplace;
        private String taskId;
        private Phase phase;
        private String lotNo;                       // startExtraction 返回的批次号，仅记录/排错
        private int cloudExtractCount;              // 云端实时已采条数（wait 轮询回填）
        private int drainedRows;                    // drain 入库行数（仅榜单）
        private String error;                       // 异常/超时/停止原因
        private volatile boolean cancelRequested;   // 协作式取消标志
        private long startedAt;
        private long updatedAt;
    }

    private static boolean isTerminal(Phase p) {
        return p == Phase.DONE || p == Phase.ERROR || p == Phase.TIMEOUT || p == Phase.STOPPED;
    }

    public static String key(String function, String marketplace) {
        return function + ":" + marketplace;
    }

    private final Map<String, RunState> states = new ConcurrentHashMap<>();

    /**
     * CAS 占位：仅当该任务无记录或处于终态时，置 STARTING 并返回 true（可启动）；
     * 若正在跑（STARTING/WAITING_CLOUD/DRAINING）返回 false（拒绝重复启动）。
     * 用 compute 保证原子性——这是防重复提交、防 markexported 竞争的唯一闸门。
     */
    public boolean tryBegin(String function, String marketplace, String taskId) {
        String k = key(function, marketplace);
        long now = System.currentTimeMillis();
        RunState[] holder = new RunState[1];
        states.compute(k, (kk, cur) -> {
            if (cur != null && !isTerminal(cur.getPhase())) {
                holder[0] = null;   // 正在跑，拒绝
                return cur;
            }
            RunState s = new RunState();
            s.setTaskKey(k);
            s.setFunction(function);
            s.setMarketplace(marketplace);
            s.setTaskId(taskId);
            s.setPhase(Phase.STARTING);
            s.setCloudExtractCount(0);
            s.setDrainedRows(0);
            s.setError(null);
            s.setLotNo(null);
            s.setCancelRequested(false);
            s.setStartedAt(now);
            s.setUpdatedAt(now);
            holder[0] = s;          // 占位成功
            return s;
        });
        return holder[0] != null;
    }

    public void setPhase(String function, String marketplace, Phase phase) {
        update(function, marketplace, s -> s.setPhase(phase));
    }

    public void setLotNo(String function, String marketplace, String lotNo) {
        update(function, marketplace, s -> s.setLotNo(lotNo));
    }

    public void setCloudCount(String function, String marketplace, int count) {
        update(function, marketplace, s -> s.setCloudExtractCount(count));
    }

    public void finishDrain(String function, String marketplace, int drainedRows) {
        update(function, marketplace, s -> {
            s.setDrainedRows(drainedRows);
            s.setPhase(Phase.DONE);
        });
    }

    /** 标记成功完成（以图识图不 drain，直接 DONE）。 */
    public void done(String function, String marketplace) {
        update(function, marketplace, s -> s.setPhase(Phase.DONE));
    }

    /** 终态置 ERROR/TIMEOUT/STOPPED + 原因。 */
    public void fail(String function, String marketplace, Phase terminal, String error) {
        update(function, marketplace, s -> {
            s.setPhase(terminal);
            s.setError(error);
        });
    }

    /** 请求取消：置标志，供 wait 轮询 / drain 循环检查。phase 不变（线程见到标志后自行置 STOPPED）。 */
    public void requestCancel(String function, String marketplace) {
        update(function, marketplace, s -> s.setCancelRequested(true));
    }

    public boolean isCancelled(String function, String marketplace) {
        RunState s = states.get(key(function, marketplace));
        return s != null && s.isCancelRequested();
    }

    /** 当前是否有正在运行（非终态）的记录。 */
    public boolean isRunning(String function, String marketplace) {
        RunState s = states.get(key(function, marketplace));
        return s != null && !isTerminal(s.getPhase());
    }

    public RunState get(String function, String marketplace) {
        return states.get(key(function, marketplace));
    }

    /** 全部任务态快照（前端轮询用）。 */
    public Collection<RunState> all() {
        return new ArrayList<>(states.values());
    }

    private void update(String function, String marketplace, java.util.function.Consumer<RunState> mut) {
        String k = key(function, marketplace);
        states.computeIfPresent(k, (kk, s) -> {
            mut.accept(s);
            s.setUpdatedAt(System.currentTimeMillis());
            return s;
        });
    }
}

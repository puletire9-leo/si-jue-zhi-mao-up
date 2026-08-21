package com.sjzm.product.modules.lingxing.requestcenter.handler;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 领星任务处理器注册表：收集所有 {@link LingxingTaskHandler} bean，按归一化的 taskType 建立索引。
 */
@Slf4j
@Component
public class LingxingTaskHandlerRegistry {

    private final Map<String, LingxingTaskHandler> handlers;

    public LingxingTaskHandlerRegistry(List<LingxingTaskHandler> handlerList) {
        Map<String, LingxingTaskHandler> index = new HashMap<>();
        for (LingxingTaskHandler handler : handlerList) {
            String type = normalize(handler.taskType());
            if (!StringUtils.hasText(type)) {
                throw new IllegalStateException("领星任务处理器 taskType 不能为空: " + handler.getClass().getName());
            }
            LingxingTaskHandler previous = index.put(type, handler);
            if (previous != null) {
                throw new IllegalStateException("领星任务处理器 taskType 重复: " + type
                        + " (" + previous.getClass().getName() + " vs " + handler.getClass().getName() + ")");
            }
        }
        this.handlers = Map.copyOf(index);
        log.info("领星请求中心处理器注册完成: types={}", handlers.keySet());
    }

    public LingxingTaskHandler handlerFor(String taskType) {
        return handlers.get(normalize(taskType));
    }

    public boolean knows(String taskType) {
        return handlers.containsKey(normalize(taskType));
    }

    public Set<String> knownTypes() {
        return handlers.keySet();
    }

    private String normalize(String taskType) {
        return taskType == null ? "" : taskType.trim().toUpperCase(Locale.ROOT);
    }
}

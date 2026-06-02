package com.sjzm.mq;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class MessageConsumer {

    @PostConstruct
    public void init() {
        log.info("[MQ-Consumer] 消息消费者已初始化（消费功能已禁用）");
    }
}

package com.sjzm.mq.rocketmq;

import lombok.extern.slf4j.Slf4j;
import org.apache.rocketmq.spring.annotation.ConsumeMode;
import org.apache.rocketmq.spring.annotation.RocketMQMessageListener;
import org.apache.rocketmq.spring.core.RocketMQListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RocketMQMessageListener(
        topic = "sjzm-image-topic",
        consumerGroup = "sjzm-image-consumer-group",
        consumeMode = ConsumeMode.CONCURRENTLY
)
public class ImageProcessConsumer implements RocketMQListener<String> {

    @Override
    public void onMessage(String message) {
        try {
            log.info("[RocketMQ-Consumer] 收到图片处理消息: {}", message);
        } catch (Exception e) {
            log.error("[RocketMQ-Consumer] 图片处理失败: {}", e.getMessage());
            throw e;
        }
    }
}

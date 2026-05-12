package com.sjzm.mq.rocketmq;

import lombok.extern.slf4j.Slf4j;
import org.apache.rocketmq.spring.annotation.ConsumeMode;
import org.apache.rocketmq.spring.annotation.RocketMQMessageListener;
import org.apache.rocketmq.spring.core.RocketMQListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RocketMQMessageListener(
        topic = "sjzm-order-topic",
        consumerGroup = "sjzm-order-consumer-group",
        consumeMode = ConsumeMode.ORDERLY
)
public class OrderConsumer implements RocketMQListener<String> {

    @Override
    public void onMessage(String message) {
        try {
            log.info("[RocketMQ-Consumer] 收到订单消息: {}", message);
        } catch (Exception e) {
            log.error("[RocketMQ-Consumer] 订单处理失败: {}", e.getMessage());
            throw e;
        }
    }
}

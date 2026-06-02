package com.sjzm.mq.rocketmq;

import lombok.extern.slf4j.Slf4j;
import org.apache.rocketmq.client.producer.SendCallback;
import org.apache.rocketmq.client.producer.SendResult;
import org.apache.rocketmq.spring.core.RocketMQTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class RocketMQProducer {

    @Autowired(required = false)
    private RocketMQTemplate rocketMQTemplate;

    @Value("${rocketmq.producer.topic: sjzm-topic}")
    private String producerTopic;

    public void sendMessage(String topic, String tag, String body) {
        if (rocketMQTemplate == null) {
            log.warn("[RocketMQ-Producer] RocketMQTemplate 未初始化，跳过发送: topic={}, tag={}", topic, tag);
            return;
        }
        try {
            rocketMQTemplate.asyncSend(topic + ":" + tag, MessageBuilder.withPayload(body).build(),
                new SendCallback() {
                    @Override
                    public void onSuccess(SendResult sendResult) {
                        log.info("[RocketMQ-Producer] 发送成功: topic={}, tag={}, msgId={}",
                                topic, tag, sendResult.getMsgId());
                    }

                    @Override
                    public void onException(Throwable e) {
                        log.error("[RocketMQ-Producer] 发送失败: topic={}, tag={}, error={}",
                                topic, tag, e.getMessage());
                    }
                });
        } catch (Exception e) {
            log.error("[RocketMQ-Producer] 发送异常: {}", e.getMessage());
        }
    }

    public void sendImageProcessMessage(String imageId, String operation) {
        String body = String.format("{\"imageId\":\"%s\",\"operation\":\"%s\",\"timestamp\":%d}",
                imageId, operation, System.currentTimeMillis());
        sendMessage("sjzm-image-topic", operation, body);
    }

    public void sendNotificationMessage(String userId, String title, String content) {
        String body = String.format("{\"userId\":\"%s\",\"title\":\"%s\",\"content\":\"%s\",\"timestamp\":%d}",
                userId, title, content, System.currentTimeMillis());
        sendMessage("sjzm-notification-topic", "notification", body);
    }

    public void sendImportTaskMessage(String taskId, String filePath, String operator) {
        String body = String.format("{\"taskId\":\"%s\",\"filePath\":\"%s\",\"operator\":\"%s\",\"timestamp\":%d}",
                taskId, filePath, operator, System.currentTimeMillis());
        sendMessage("sjzm-import-topic", "import", body);
    }

    public void sendOrderMessage(String orderId, String userId, String action) {
        String body = String.format("{\"orderId\":\"%s\",\"userId\":\"%s\",\"action\":\"%s\",\"timestamp\":%d}",
                orderId, userId, action, System.currentTimeMillis());
        sendMessage("sjzm-order-topic", action, body);
    }

    public void sendDelayMessage(String topic, String tag, String body, long delayLevel) {
        if (rocketMQTemplate == null) {
            log.warn("[RocketMQ-Producer] RocketMQTemplate 未初始化，跳过延迟消息发送: topic={}", topic);
            return;
        }
        try {
            org.apache.rocketmq.common.message.Message message = new org.apache.rocketmq.common.message.Message();
            message.setTopic(topic);
            message.setTags(tag);
            message.setBody(body.getBytes());
            message.setDelayTimeLevel((int) delayLevel);
            rocketMQTemplate.asyncSend(topic + ":" + tag, message, new SendCallback() {
                @Override
                public void onSuccess(SendResult sendResult) {
                    log.info("[RocketMQ-Producer] 延迟消息发送成功: topic={}, delayLevel={}", topic, delayLevel);
                }

                @Override
                public void onException(Throwable e) {
                    log.error("[RocketMQ-Producer] 延迟消息发送失败: {}", e.getMessage());
                }
            });
        } catch (Exception e) {
            log.error("[RocketMQ-Producer] 延迟消息发送异常: {}", e.getMessage());
        }
    }
}

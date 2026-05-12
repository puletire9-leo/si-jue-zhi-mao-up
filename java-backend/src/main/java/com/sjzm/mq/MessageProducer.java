package com.sjzm.mq;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class MessageProducer {

    private final StringRedisTemplate redisTemplate;

    private static final String STREAM_KEY_PREFIX = "sjzm:stream:";

    public void sendMessage(String streamName, String type, Object payload) {
        String streamKey = STREAM_KEY_PREFIX + streamName;
        Map<String, String> message = new HashMap<>();
        message.put("type", type);
        message.put("payload", payload.toString());
        message.put("timestamp", String.valueOf(System.currentTimeMillis()));

        redisTemplate.opsForHash().putAll(streamKey, message);
        log.info("[MQ-Producer] 发送消息: stream={}, type={}", streamName, type);
    }

    public void sendImageProcessMessage(String imageId, String operation) {
        String streamKey = STREAM_KEY_PREFIX + "image-process";
        Map<String, String> message = new HashMap<>();
        message.put("imageId", imageId);
        message.put("operation", operation);
        message.put("timestamp", String.valueOf(System.currentTimeMillis()));

        redisTemplate.opsForHash().putAll(streamKey, message);
        log.info("[MQ-Producer] 发送图片处理消息: imageId={}", imageId);
    }

    public void sendNotificationMessage(String userId, String title, String content) {
        String streamKey = STREAM_KEY_PREFIX + "notification";
        Map<String, String> message = new HashMap<>();
        message.put("userId", userId);
        message.put("title", title);
        message.put("content", content);
        message.put("timestamp", String.valueOf(System.currentTimeMillis()));

        redisTemplate.opsForHash().putAll(streamKey, message);
        log.info("[MQ-Producer] 发送通知消息: userId={}", userId);
    }

    public void sendImportTaskMessage(String taskId, String filePath, String operator) {
        String streamKey = STREAM_KEY_PREFIX + "import-task";
        Map<String, String> message = new HashMap<>();
        message.put("taskId", taskId);
        message.put("filePath", filePath);
        message.put("operator", operator);
        message.put("timestamp", String.valueOf(System.currentTimeMillis()));

        redisTemplate.opsForHash().putAll(streamKey, message);
        log.info("[MQ-Producer] 发送导入任务消息: taskId={}", taskId);
    }

    public void createConsumerGroup(String streamName) {
        log.info("[MQ-Producer] 消费者组功能已禁用");
    }

    public Long getStreamLength(String streamName) {
        String streamKey = STREAM_KEY_PREFIX + streamName;
        Long size = redisTemplate.opsForHash().size(streamKey);
        return size != null ? size : 0L;
    }
}

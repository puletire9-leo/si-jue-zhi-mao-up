package com.sjzm.service;

import com.sjzm.mq.MessageProducer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class MessageQueueService {

    private final MessageProducer messageProducer;

    public void asyncProcessImage(String imageId, String operation) {
        log.info("[MQ-Service] 异步处理图片: imageId={}, operation={}", imageId, operation);
        messageProducer.sendImageProcessMessage(imageId, operation);
    }

    public void sendNotification(String userId, String title, String content) {
        log.info("[MQ-Service] 发送通知: userId={}, title={}", userId, title);
        messageProducer.sendNotificationMessage(userId, title, content);
    }

    public void submitImportTask(String taskId, String filePath, String operator) {
        log.info("[MQ-Service] 提交导入任务: taskId={}, operator={}", taskId, operator);
        messageProducer.sendImportTaskMessage(taskId, filePath, operator);
    }

    public Long getImageQueueSize() {
        return messageProducer.getStreamLength("image-process");
    }

    public Long getNotificationQueueSize() {
        return messageProducer.getStreamLength("notification");
    }

    public Long getImportQueueSize() {
        return messageProducer.getStreamLength("import-task");
    }
}

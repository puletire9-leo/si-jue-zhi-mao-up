package com.sjzm.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
@RequiredArgsConstructor
public class AsyncService {

    @Async("taskExecutor")
    public void asyncTask(String taskName) {
        log.info("[Async] 开始执行任务: {}, 线程: {}", taskName, Thread.currentThread().getName());
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("[Async] 任务被中断: {}", taskName);
            return;
        }
        log.info("[Async] 任务完成: {}", taskName);
    }

    @Async("mailExecutor")
    public void sendMailAsync(String to, String subject, String content) {
        log.info("[Async-Mail] 发送邮件到: {}", to);
        try {
            Thread.sleep(2000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("[Async-Mail] 邮件发送被中断: {}", to);
            return;
        }
        log.info("[Async-Mail] 邮件发送完成: {}", to);
    }

    @Async("syncExecutor")
    public void syncDataAsync(String dataType) {
        log.info("[Async-Sync] 开始同步数据: {}", dataType);
        try {
            Thread.sleep(3000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("[Async-Sync] 数据同步被中断: {}", dataType);
            return;
        }
        log.info("[Async-Sync] 数据同步完成: {}", dataType);
    }

    @Async("imageExecutor")
    public void processImageAsync(String imageId, String operation) {
        log.info("[Async-Image] 开始处理图片: {}, 操作: {}", imageId, operation);
        try {
            Thread.sleep(2000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("[Async-Image] 图片处理被中断: {}", imageId);
            return;
        }
        log.info("[Async-Image] 图片处理完成: {}", imageId);
    }

    @Async("taskExecutor")
    public CompletableFuture<String> asyncTaskWithResult(String taskName) {
        log.info("[Async] 执行有返回值任务: {}", taskName);
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return CompletableFuture.completedFuture("任务被中断: " + taskName);
        }
        return CompletableFuture.completedFuture("任务完成: " + taskName);
    }
}

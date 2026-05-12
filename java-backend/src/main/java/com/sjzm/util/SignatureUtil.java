package com.sjzm.util;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * 接口签名工具
 * 用于 API 请求签名验证，防止参数篡改和重放攻击
 */
@Slf4j
@Component
public class SignatureUtil {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 生成签名
     *
     * @param params    请求参数
     * @param timestamp 时间戳
     * @param nonce     随机数
     * @param secretKey 密钥
     * @return 签名字符串
     */
    public static String generateSignature(Map<String, String> params, long timestamp, String nonce, String secretKey) {
        // 1. 参数按 key 字典序排序
        TreeMap<String, String> sortedParams = new TreeMap<>(params);
        // 2. 拼接参数字符串
        String paramString = sortedParams.entrySet().stream()
                .filter(entry -> entry.getValue() != null && !entry.getValue().isEmpty())
                .map(entry -> entry.getKey() + "=" + entry.getValue())
                .collect(Collectors.joining("&"));
        // 3. 拼接时间戳和随机数
        String signStr = paramString + "&timestamp=" + timestamp + "&nonce=" + nonce + "&key=" + secretKey;
        // 4. MD5 签名
        return md5(signStr);
    }

    /**
     * 验证签名
     *
     * @param params        请求参数
     * @param timestamp     时间戳
     * @param nonce         随机数
     * @param secretKey     密钥
     * @param signature     待验证签名
     * @param expireSeconds 签名有效时间（秒）
     * @return 验证结果
     */
    public static boolean verifySignature(Map<String, String> params, long timestamp, String nonce,
                                          String secretKey, String signature, long expireSeconds) {
        // 1. 检查时间戳是否过期
        long currentTime = System.currentTimeMillis() / 1000;
        if (Math.abs(currentTime - timestamp) > expireSeconds) {
            log.warn("签名已过期: timestamp={}, currentTime={}, diff={}s", timestamp, currentTime, Math.abs(currentTime - timestamp));
            return false;
        }

        // 2. 生成签名
        String expectedSignature = generateSignature(params, timestamp, nonce, secretKey);

        // 3. 比较签名
        return expectedSignature.equals(signature);
    }

    /**
     * MD5 加密
     */
    public static String md5(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("MD5 算法不可用", e);
        }
    }

    /**
     * 生成随机 nonce
     */
    public static String generateNonce() {
        return Long.toHexString(System.currentTimeMillis()) + Long.toHexString((long) (Math.random() * 100000000));
    }
}

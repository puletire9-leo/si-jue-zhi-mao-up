package com.sjzm.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import javax.annotation.PostConstruct;
import java.io.IOException;
import java.util.*;

@Slf4j
@Component
public class PythonAIServiceClient {

    @Value("${python.ai.service.url:http://localhost:8000}")
    private String pythonServiceUrl;

    @Value("${python.ai.service.enabled:false}")
    private boolean enabled;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    private static final int DEFAULT_TIMEOUT = 30000;

    public PythonAIServiceClient() {
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    @PostConstruct
    public void init() {
        if (enabled) {
            log.info("Python AI服务客户端已启用: {}", pythonServiceUrl);
        } else {
            log.warn("Python AI服务客户端未启用，将使用本地模拟模式");
        }
    }

    public boolean isEnabled() {
        return enabled;
    }

    public String getServiceUrl() {
        return pythonServiceUrl;
    }

    public boolean healthCheck() {
        if (!enabled) {
            return false;
        }
        try {
            String url = pythonServiceUrl + "/health";
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            log.warn("Python AI服务健康检查失败: {}", e.getMessage());
            return false;
        }
    }

    public List<Map<String, Object>> vectorSearch(String imageUrl, int limit, String category) {
        if (!enabled) {
            log.warn("Python AI服务未启用，返回空结果");
            return Collections.emptyList();
        }

        try {
            String url = pythonServiceUrl + "/api/v1/ai/vector/search";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            ObjectNode requestBody = objectMapper.createObjectNode();
            requestBody.put("image_url", imageUrl);
            requestBody.put("limit", limit);
            if (category != null) {
                requestBody.put("category", category);
            }

            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(requestBody), headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    String.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode responseJson = objectMapper.readTree(response.getBody());
                JsonNode results = responseJson.get("results");

                List<Map<String, Object>> resultList = new ArrayList<>();
                if (results != null && results.isArray()) {
                    for (JsonNode item : results) {
                        Map<String, Object> map = objectMapper.convertValue(item, Map.class);
                        resultList.add(map);
                    }
                }
                return resultList;
            }

            log.warn("向量搜索请求失败: {}", response.getStatusCode());
            return Collections.emptyList();

        } catch (Exception e) {
            log.error("调用Python AI服务向量搜索失败: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    public Map<String, Object> vectorSearchByBase64(String imageBase64, int limit, String category) {
        if (!enabled) {
            log.warn("Python AI服务未启用，返回空结果");
            Map<String, Object> result = new HashMap<>();
            result.put("results", Collections.emptyList());
            result.put("total", 0);
            result.put("query_time_ms", 0);
            return result;
        }

        try {
            String url = pythonServiceUrl + "/api/v1/ai/vector/search";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            ObjectNode requestBody = objectMapper.createObjectNode();
            requestBody.put("image_data", imageBase64);
            requestBody.put("limit", limit);
            if (category != null) {
                requestBody.put("category", category);
            }

            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(requestBody), headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    String.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode responseJson = objectMapper.readTree(response.getBody());
                return objectMapper.convertValue(responseJson, Map.class);
            }

            log.warn("向量搜索请求失败: {}", response.getStatusCode());
            Map<String, Object> result = new HashMap<>();
            result.put("results", Collections.emptyList());
            result.put("total", 0);
            return result;

        } catch (Exception e) {
            log.error("调用Python AI服务向量搜索失败: {}", e.getMessage());
            Map<String, Object> result = new HashMap<>();
            result.put("results", Collections.emptyList());
            result.put("total", 0);
            return result;
        }
    }

    public Map<String, Object> indexImage(Long imageId, String imageUrl, Map<String, Object> metadata) {
        if (!enabled) {
            log.warn("Python AI服务未启用");
            Map<String, Object> result = new HashMap<>();
            result.put("point_id", UUID.randomUUID().toString());
            result.put("image_id", imageId);
            result.put("status", "mock");
            return result;
        }

        try {
            String url = pythonServiceUrl + "/api/v1/ai/vector/index";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            ObjectNode requestBody = objectMapper.createObjectNode();
            requestBody.put("image_id", imageId);
            requestBody.put("image_url", imageUrl);

            if (metadata != null) {
                ObjectNode metadataNode = objectMapper.valueToTree(metadata);
                requestBody.set("metadata", metadataNode);
            }

            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(requestBody), headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    String.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return objectMapper.readValue(response.getBody(), Map.class);
            }

            log.warn("图片索引请求失败: {}", response.getStatusCode());
            Map<String, Object> result = new HashMap<>();
            result.put("point_id", UUID.randomUUID().toString());
            result.put("image_id", imageId);
            result.put("status", "error");
            return result;

        } catch (Exception e) {
            log.error("调用Python AI服务图片索引失败: {}", e.getMessage());
            Map<String, Object> result = new HashMap<>();
            result.put("point_id", UUID.randomUUID().toString());
            result.put("image_id", imageId);
            result.put("status", "error");
            result.put("error", e.getMessage());
            return result;
        }
    }

    public Map<String, Object> getVectorHealth() {
        if (!enabled) {
            Map<String, Object> status = new HashMap<>();
            status.put("status", "disabled");
            status.put("qdrant_connected", false);
            status.put("vector_count", 0);
            status.put("model_loaded", false);
            return status;
        }

        try {
            String url = pythonServiceUrl + "/api/v1/ai/vector/health";
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return objectMapper.readValue(response.getBody(), Map.class);
            }

        } catch (Exception e) {
            log.warn("获取向量服务健康状态失败: {}", e.getMessage());
        }

        Map<String, Object> status = new HashMap<>();
        status.put("status", "error");
        status.put("qdrant_connected", false);
        status.put("vector_count", 0);
        status.put("model_loaded", false);
        return status;
    }
}

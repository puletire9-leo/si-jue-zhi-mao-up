package com.sjzm.service.impl;

import com.sjzm.client.PythonAIServiceClient;
import com.sjzm.common.BusinessException;
import com.sjzm.entity.Image;
import com.sjzm.entity.ImageVector;
import com.sjzm.mapper.ImageMapper;
import com.sjzm.mapper.ImageVectorMapper;
import com.sjzm.service.VectorSearchService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.annotation.PostConstruct;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class VectorSearchServiceImpl implements VectorSearchService {

    @Value("${app.vector.local.enabled:false}")
    private boolean localVectorEnabled;

    @Value("${app.clip.model:clip-vit-base-patch32}")
    private String clipModel;

    private static final int VECTOR_DIMENSIONS = 512;

    private final ImageMapper imageMapper;
    private final ImageVectorMapper imageVectorMapper;
    private final PythonAIServiceClient pythonAIServiceClient;

    public VectorSearchServiceImpl(
            ImageMapper imageMapper,
            ImageVectorMapper imageVectorMapper,
            @Autowired(required = false) PythonAIServiceClient pythonAIServiceClient) {
        this.imageMapper = imageMapper;
        this.imageVectorMapper = imageVectorMapper;
        this.pythonAIServiceClient = pythonAIServiceClient;
    }

    @PostConstruct
    public void init() {
        if (pythonAIServiceClient != null && pythonAIServiceClient.isEnabled()) {
            log.info("使用Python AI服务进行向量搜索");
            log.info("Python AI服务地址: {}", pythonAIServiceClient.getServiceUrl());
        } else {
            log.warn("Python AI服务未启用，将使用本地模拟模式");
        }
    }

    @Override
    public List<Map<String, Object>> searchSimilarImages(Long imageId, int limit) {
        log.info("搜索相似图片: imageId={}, limit={}", imageId, limit);

        Image image = imageMapper.selectById(imageId);
        if (image == null) {
            throw new BusinessException(404, "图片不存在");
        }

        ImageVector imageVector = imageVectorMapper.selectByImageId(imageId);
        if (imageVector == null || !"indexed".equals(imageVector.getStatus())) {
            log.warn("图片未索引或向量不存在: imageId={}", imageId);
            return Collections.emptyList();
        }

        if (pythonAIServiceClient != null && pythonAIServiceClient.isEnabled()) {
            String imageUrl = image.getUrl();
            if (imageUrl == null || imageUrl.isEmpty()) {
                imageUrl = image.getFilepath();
            }
            return pythonAIServiceClient.vectorSearch(imageUrl, limit, image.getCategory());
        } else {
            return Collections.emptyList();
        }
    }

    @Override
    public List<Map<String, Object>> searchByImage(MultipartFile file, int limit, String category) {
        log.info("以图搜图: fileName={}, limit={}, category={}", file.getOriginalFilename(), limit, category);

        try {
            byte[] imageBytes = file.getBytes();
            String base64Image = Base64.getEncoder().encodeToString(imageBytes);

            if (pythonAIServiceClient != null && pythonAIServiceClient.isEnabled()) {
                Map<String, Object> result = pythonAIServiceClient.vectorSearchByBase64(base64Image, limit, category);
                List<?> resultsList = (List<?>) result.get("results");
                if (resultsList != null) {
                    return resultsList.stream()
                            .map(item -> (Map<String, Object>) item)
                            .collect(Collectors.toList());
                }
            }

            return Collections.emptyList();

        } catch (Exception e) {
            log.error("以图搜图失败", e);
            throw new BusinessException("以图搜图失败: " + e.getMessage());
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> batchIndexImages(List<Long> imageIds) {
        log.info("批量索引图片: count={}", imageIds.size());

        Map<String, Object> result = new LinkedHashMap<>();
        int success = 0;
        int failed = 0;
        List<Map<String, Object>> errors = new ArrayList<>();

        for (Long imageId : imageIds) {
            try {
                indexImage(imageId);
                success++;
            } catch (Exception e) {
                failed++;
                Map<String, Object> error = new LinkedHashMap<>();
                error.put("image_id", imageId);
                error.put("error", e.getMessage());
                errors.add(error);
                log.warn("索引图片失败: imageId={}, error={}", imageId, e.getMessage());
            }
        }

        result.put("total", imageIds.size());
        result.put("success", success);
        result.put("failed", failed);
        result.put("errors", errors);

        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> indexImage(Long imageId) {
        log.info("索引图片向量: imageId={}", imageId);

        Image image = imageMapper.selectById(imageId);
        if (image == null) {
            throw new BusinessException(404, "图片不存在");
        }

        try {
            Map<String, Object> metadata = new HashMap<>();
            metadata.put("sku", image.getSku());
            metadata.put("category", image.getCategory());
            metadata.put("tags", image.getTags());
            metadata.put("url", image.getUrl());

            String imageUrl = image.getUrl();
            if (imageUrl == null || imageUrl.isEmpty()) {
                imageUrl = image.getFilepath();
            }

            Map<String, Object> indexResult;

            if (pythonAIServiceClient != null && pythonAIServiceClient.isEnabled()) {
                indexResult = pythonAIServiceClient.indexImage(imageId, imageUrl, metadata);
            } else {
                indexResult = new HashMap<>();
                indexResult.put("point_id", UUID.randomUUID().toString());
                indexResult.put("status", "mock");
            }

            String pointId = (String) indexResult.get("point_id");
            String status = (String) indexResult.get("status");

            ImageVector imageVector = imageVectorMapper.selectByImageId(imageId);
            if (imageVector == null) {
                imageVector = new ImageVector();
                imageVector.setImageId(imageId);
                imageVector.setSku(image.getSku());
                imageVector.setCategory(image.getCategory());
                imageVector.setTags(image.getTags());
                imageVector.setDeveloper(image.getDeveloper());
                imageVector.setDimensions(VECTOR_DIMENSIONS);
                imageVector.setModel(clipModel);
                imageVector.setPointId(pointId);
                imageVector.setStatus(status != null ? status : "indexed");
                imageVector.setCreatedAt(LocalDateTime.now());
                imageVectorMapper.insert(imageVector);
            } else {
                imageVector.setPointId(pointId);
                imageVector.setStatus(status != null ? status : "indexed");
                imageVector.setUpdatedAt(LocalDateTime.now());
                imageVectorMapper.updateById(imageVector);
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("image_id", imageId);
            result.put("point_id", pointId);
            result.put("status", status != null ? status : "indexed");

            return result;

        } catch (Exception e) {
            log.error("索引图片失败: imageId={}", imageId, e);

            ImageVector imageVector = imageVectorMapper.selectByImageId(imageId);
            if (imageVector != null) {
                imageVector.setStatus("error");
                imageVector.setErrorMessage(e.getMessage());
                imageVector.setUpdatedAt(LocalDateTime.now());
                imageVectorMapper.updateById(imageVector);
            }

            throw new BusinessException("索引图片失败: " + e.getMessage());
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean deleteImageIndex(Long imageId) {
        log.info("删除图片向量索引: imageId={}", imageId);

        ImageVector imageVector = imageVectorMapper.selectByImageId(imageId);
        if (imageVector == null) {
            return false;
        }

        imageVectorMapper.deleteById(imageVector.getId());
        return true;
    }

    @Override
    public Map<String, Object> getServiceStatus() {
        Map<String, Object> status = new LinkedHashMap<>();

        boolean pythonEnabled = pythonAIServiceClient != null && pythonAIServiceClient.isEnabled();
        status.put("python_ai_enabled", pythonEnabled);

        if (pythonEnabled) {
            try {
                Map<String, Object> pythonStatus = pythonAIServiceClient.getVectorHealth();
                status.put("python_service_status", pythonStatus.get("status"));
                status.put("qdrant_connected", pythonStatus.get("qdrant_connected"));
                status.put("vector_count", pythonStatus.get("vector_count"));
                status.put("model_loaded", pythonStatus.get("model_loaded"));
                status.put("service_mode", "python");
            } catch (Exception e) {
                status.put("python_service_status", "error");
                status.put("error", e.getMessage());
            }
        } else {
            status.put("service_mode", "mock");
            status.put("qdrant_connected", false);
            status.put("model_loaded", false);
        }

        Long pendingCount = 0L;
        try {
            pendingCount = imageVectorMapper.selectPendingVectors(1).stream().count();
        } catch (Exception e) {
            log.warn("获取待索引向量数量失败", e);
        }
        status.put("pending_vectors", pendingCount);

        return status;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> rebuildIndex() {
        log.info("重建向量索引");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "started");
        result.put("message", "重建任务已启动");

        List<Image> allImages = imageMapper.selectAllForProduct(10000, 0);
        List<Long> imageIds = allImages.stream()
                .map(Image::getId)
                .collect(Collectors.toList());

        result.put("total_images", imageIds.size());

        return result;
    }
}

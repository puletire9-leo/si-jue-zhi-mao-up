package com.sjzm.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.entity.Image;
import com.sjzm.mapper.ImageMapper;
import com.sjzm.service.ImageService;
import com.sjzm.service.VectorSearchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 图片服务实现（对齐 Python 的 ImageService）
 * 使用数据库 + 本地文件存储 + COS云存储 + Qdrant向量搜索
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ImageServiceImpl implements ImageService {

    private final ImageMapper imageMapper;
    private final VectorSearchService vectorSearchService;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    @Value("${app.thumbnail.dir:uploads/thumbnails}")
    private String thumbnailDir;

    @Value("${app.upload.max-batch:50}")
    private int maxBatchSize;

    private static final Set<String> ALLOWED_EXTENSIONS = new HashSet<>(Arrays.asList(
            ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"
    ));

    private static final int THUMBNAIL_SIZE = 256;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> uploadImage(MultipartFile file, String category, String tags,
                                           String description, String sku) {
        log.info("上传图片: fileName={}, category={}", file.getOriginalFilename(), category);

        validateFile(file);

        if (!StringUtils.hasText(category)) {
            throw new BusinessException(400, "图片分类不能为空");
        }

        String originalFilename = file.getOriginalFilename();
        String extension = getExtension(originalFilename).toLowerCase();
        String uniqueFilename = UUID.randomUUID().toString() + extension;

        try {
            Path uploadPath = Paths.get(uploadDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            Path filePath = uploadPath.resolve(uniqueFilename);
            file.transferTo(filePath.toFile());

            Image image = new Image();
            image.setFilename(uniqueFilename);
            image.setFilepath(filePath.toString());
            image.setCategory(category);
            image.setTags(tags);
            image.setDescription(description);
            image.setSku(sku);
            image.setOriginalFilename(originalFilename);
            image.setFormat(extension.substring(1));
            image.setFileSize(file.getSize());
            image.setImageType(mapCategoryToImageType(category));

            int[] dimensions = getImageDimensions(filePath.toFile());
            image.setWidth(dimensions[0]);
            image.setHeight(dimensions[1]);

            String thumbnailPath = generateThumbnail(filePath.toFile(), uniqueFilename);
            image.setThumbnailPath(thumbnailPath);

            String url = "/api/v1/images/" + image.getId() + "/file";
            image.setUrl(url);
            image.setThumbnailUrl("/api/v1/images/" + image.getId() + "/thumbnail");

            imageMapper.insert(image);

            return convertToMap(image);

        } catch (IOException e) {
            log.error("保存图片文件失败", e);
            throw new BusinessException(500, "保存图片文件失败: " + e.getMessage());
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> batchUploadImages(List<MultipartFile> files, String category,
                                                  String tags, String description, String sku) {
        log.info("批量上传图片: count={}, category={}", files.size(), category);

        if (files == null || files.isEmpty()) {
            throw new BusinessException(400, "上传文件列表不能为空");
        }

        if (files.size() > maxBatchSize) {
            throw new BusinessException(400, "批量上传最多支持" + maxBatchSize + "个文件");
        }

        Map<String, Object> result = new HashMap<>();
        List<Map<String, Object>> uploadedImages = new ArrayList<>();
        List<Map<String, Object>> errors = new ArrayList<>();
        int successCount = 0;
        int failedCount = 0;

        for (MultipartFile file : files) {
            try {
                Map<String, Object> uploaded = uploadImage(file, category, tags, description, sku);
                uploadedImages.add(uploaded);
                successCount++;
            } catch (Exception e) {
                failedCount++;
                Map<String, Object> error = new HashMap<>();
                error.put("filename", file.getOriginalFilename());
                error.put("error", e.getMessage());
                errors.add(error);
                log.warn("批量上传失败: {}, error: {}", file.getOriginalFilename(), e.getMessage());
            }
        }

        result.put("success_count", successCount);
        result.put("failed_count", failedCount);
        result.put("images", uploadedImages);
        result.put("errors", errors);

        return result;
    }

    @Override
    public Map<String, Object> getImageById(Long id) {
        log.info("获取图片详情: id={}", id);

        Image image = imageMapper.selectById(id);
        if (image == null) {
            throw new BusinessException(404, "图片不存在");
        }

        return convertToMap(image);
    }

    @Override
    public PageResult<Map<String, Object>> listImages(int page, int size, String keyword, String category) {
        log.info("查询图片列表: page={}, size={}, keyword={}, category={}", page, size, keyword, category);

        if (page < 1) page = 1;
        if (size < 1) size = 12;
        if (size > 100) size = 100;

        Page<Image> pageParam = new Page<>(page, size);
        LambdaQueryWrapper<Image> wrapper = new LambdaQueryWrapper<>();

        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(Image::getFilename, keyword)
                    .or()
                    .like(Image::getDescription, keyword)
                    .or()
                    .like(Image::getTags, keyword));
        }

        if (StringUtils.hasText(category)) {
            wrapper.eq(Image::getCategory, category);
        }

        wrapper.orderByDesc(Image::getCreatedAt);
        Page<Image> imagePage = imageMapper.selectPage(pageParam, wrapper);

        List<Map<String, Object>> records = imagePage.getRecords().stream()
                .map(this::convertToMap)
                .collect(Collectors.toList());

        return PageResult.of(records, imagePage.getTotal(), (long) page, (long) size);
    }

    @Override
    public List<Map<String, Object>> searchImages(String keyword, String category, int limit, int offset) {
        log.info("搜索图片: keyword={}, category={}, limit={}, offset={}", keyword, category, limit, offset);

        LambdaQueryWrapper<Image> wrapper = new LambdaQueryWrapper<>();

        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(Image::getFilename, keyword)
                    .or()
                    .like(Image::getDescription, keyword)
                    .or()
                    .like(Image::getTags, keyword));
        }

        if (StringUtils.hasText(category)) {
            wrapper.eq(Image::getCategory, category);
        }

        wrapper.orderByDesc(Image::getCreatedAt);
        wrapper.last("LIMIT " + limit + " OFFSET " + offset);

        return imageMapper.selectList(wrapper).stream()
                .map(this::convertToMap)
                .collect(Collectors.toList());
    }

    @Override
    public List<Map<String, Object>> getAllProductImages(int limit, int offset) {
        log.info("获取所有产品图片: limit={}, offset={}", limit, offset);

        List<Image> images = imageMapper.selectAllForProduct(limit, offset);
        return images.stream()
                .map(this::convertToMap)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean updateImage(Long id, String category, String tags, String description) {
        log.info("更新图片: id={}, category={}, tags={}, description={}", id, category, tags, description);

        Image image = imageMapper.selectById(id);
        if (image == null) {
            return false;
        }

        if (StringUtils.hasText(category)) {
            image.setCategory(category);
            image.setImageType(mapCategoryToImageType(category));
        }

        if (tags != null) {
            image.setTags(tags);
        }

        if (description != null) {
            image.setDescription(description);
        }

        imageMapper.updateById(image);
        return true;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean deleteImage(Long id) {
        log.info("删除图片: id={}", id);

        Image image = imageMapper.selectById(id);
        if (image == null) {
            return false;
        }

        deletePhysicalFile(image.getFilepath());
        if (StringUtils.hasText(image.getThumbnailPath())) {
            deletePhysicalFile(image.getThumbnailPath());
        }

        imageMapper.deleteById(id);
        return true;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> batchDeleteImages(List<Long> ids) {
        log.info("批量删除图片: ids={}", ids);

        Map<String, Object> result = new HashMap<>();
        int successCount = 0;
        int failedCount = 0;
        List<String> errors = new ArrayList<>();

        for (Long id : ids) {
            try {
                if (deleteImage(id)) {
                    successCount++;
                } else {
                    failedCount++;
                    errors.add("ID " + id + ": 图片不存在");
                }
            } catch (Exception e) {
                failedCount++;
                errors.add("ID " + id + ": " + e.getMessage());
            }
        }

        result.put("success_count", successCount);
        result.put("failed_count", failedCount);
        result.put("errors", errors);

        return result;
    }

    @Override
    public Map<String, Object> getImageStats(String category) {
        log.info("获取图片统计: category={}", category);

        Map<String, Object> result = new HashMap<>();

        if (StringUtils.hasText(category)) {
            result.put("count", imageMapper.countByCategory(category));
            result.put("category", category);
        } else {
            result.put("count", imageMapper.countAll());
        }

        return result;
    }

    @Override
    public Map<String, Object> batchGetImages(List<Long> imageIds) {
        log.info("批量获取图片: ids={}", imageIds);

        Map<String, Object> result = new HashMap<>();

        for (Long id : imageIds) {
            try {
                Image image = imageMapper.selectById(id);
                if (image != null) {
                    result.put(String.valueOf(id), convertToMap(image));
                }
            } catch (Exception e) {
                log.warn("获取图片失败: id={}, error={}", id, e.getMessage());
            }
        }

        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> refreshImageUrls(List<Long> imageIds, String category, int limit, int offset) {
        log.info("刷新图片URL: imageIds={}, category={}, limit={}, offset={}",
                imageIds != null ? imageIds.size() : 0, category, limit, offset);

        Map<String, Object> result = new HashMap<>();
        int total = 0;
        int processed = 0;
        int fixed = 0;
        int failed = 0;
        List<Map<String, Object>> details = new ArrayList<>();

        List<Image> images;
        if (imageIds != null && !imageIds.isEmpty()) {
            images = new ArrayList<>();
            for (Long id : imageIds) {
                Image img = imageMapper.selectById(id);
                if (img != null) {
                    images.add(img);
                }
            }
            total = images.size();
        } else {
            total = imageMapper.countAll().intValue();
            images = imageMapper.selectAllForProduct(limit, offset);
        }

        for (Image image : images) {
            Map<String, Object> detail = new HashMap<>();
            detail.put("imageId", image.getId());

            try {
                processed++;
                String url = image.getUrl();
                String originalUrl = url;
                boolean urlFixed = false;

                if (StringUtils.hasText(url)) {
                    if (url.startsWith("//")) {
                        url = "https:" + url;
                        urlFixed = true;
                    } else if (!url.startsWith("http://") && !url.startsWith("https://")) {
                        url = "https://" + url;
                        urlFixed = true;
                    }

                    if (urlFixed) {
                        image.setUrl(url);
                        imageMapper.updateById(image);
                        fixed++;
                        detail.put("status", "fixed");
                        detail.put("message", "URL已修复: " + originalUrl + " -> " + url);
                    } else {
                        detail.put("status", "ok");
                        detail.put("message", "URL格式正确，无需修复");
                    }
                } else {
                    detail.put("status", "warning");
                    detail.put("message", "URL为空");
                }

            } catch (Exception e) {
                failed++;
                detail.put("status", "error");
                detail.put("message", e.getMessage());
            }

            details.add(detail);
        }

        result.put("total", total);
        result.put("processed", processed);
        result.put("fixed", fixed);
        result.put("failed", failed);
        result.put("details", details.size() > 20 ? details.subList(0, 20) : details);

        return result;
    }

    @Override
    public List<Map<String, Object>> searchSimilarImages(Long imageId, int limit) {
        log.info("搜索相似图片（AI向量搜索）: imageId={}, limit={}", imageId, limit);
        try {
            return vectorSearchService.searchSimilarImages(imageId, limit);
        } catch (Exception e) {
            log.error("搜索相似图片失败: imageId={}", imageId, e);
            return Collections.emptyList();
        }
    }

    @Override
    public List<Map<String, Object>> searchSimilarByFile(MultipartFile file, int limit, String category) {
        log.info("以图搜图（AI向量搜索）: fileName={}, limit={}, category={}",
                file.getOriginalFilename(), limit, category);
        try {
            return vectorSearchService.searchByImage(file, limit, category);
        } catch (Exception e) {
            log.error("以图搜图失败", e);
            return Collections.emptyList();
        }
    }

    @Override
    public Map<String, Object> indexImageVector(Long imageId) {
        log.info("索引图片向量: imageId={}", imageId);
        try {
            return vectorSearchService.indexImage(imageId);
        } catch (Exception e) {
            log.error("索引图片向量失败: imageId={}", imageId, e);
            throw new BusinessException("索引图片向量失败: " + e.getMessage());
        }
    }

    @Override
    public Map<String, Object> batchIndexImageVectors(List<Long> imageIds) {
        log.info("批量索引图片向量: count={}", imageIds.size());
        try {
            return vectorSearchService.batchIndexImages(imageIds);
        } catch (Exception e) {
            log.error("批量索引图片向量失败", e);
            throw new BusinessException("批量索引图片向量失败: " + e.getMessage());
        }
    }

    @Override
    public String getImageFilepath(Long id) {
        Image image = imageMapper.selectById(id);
        if (image == null) {
            throw new BusinessException(404, "图片不存在");
        }
        return image.getFilepath();
    }

    @Override
    public String getThumbnailPath(Long id) {
        Image image = imageMapper.selectById(id);
        if (image == null) {
            throw new BusinessException(404, "图片不存在");
        }
        return image.getThumbnailPath();
    }

    @Override
    public Map<String, Object> getVectorServiceStatus() {
        return vectorSearchService.getServiceStatus();
    }

    private Map<String, Object> convertToMap(Image image) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", image.getId());
        map.put("filename", image.getFilename());
        map.put("filepath", image.getFilepath());
        map.put("category", image.getCategory());
        map.put("tags", image.getTags());
        map.put("description", image.getDescription());
        map.put("sku", image.getSku());
        map.put("width", image.getWidth());
        map.put("height", image.getHeight());
        map.put("format", image.getFormat());
        map.put("file_size", image.getFileSize());
        map.put("thumbnail_path", image.getThumbnailPath());
        map.put("original_filename", image.getOriginalFilename());
        map.put("original_format", image.getOriginalFormat());
        map.put("original_zip_filepath", image.getOriginalZipFilepath());
        map.put("image_type", image.getImageType());
        map.put("thumbnail_url", image.getThumbnailUrl());
        map.put("url", image.getUrl());
        map.put("created_at", image.getCreatedAt() != null ?
                image.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")) : null);
        map.put("updated_at", image.getUpdatedAt() != null ?
                image.getUpdatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")) : null);
        return map;
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(400, "上传文件不能为空");
        }

        String originalFilename = file.getOriginalFilename();
        if (!StringUtils.hasText(originalFilename)) {
            throw new BusinessException(400, "文件名不能为空");
        }

        String extension = getExtension(originalFilename).toLowerCase();
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new BusinessException(400, "不支持的文件类型: " + extension);
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new BusinessException(400, "仅支持上传图片文件");
        }
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "";
        }
        return filename.substring(filename.lastIndexOf("."));
    }

    private String mapCategoryToImageType(String category) {
        switch (category) {
            case "final": return "final";
            case "material": return "material";
            case "carrier": return "carrier";
            default: return "product";
        }
    }

    private int[] getImageDimensions(File file) {
        try {
            BufferedImage image = ImageIO.read(file);
            if (image != null) {
                return new int[]{image.getWidth(), image.getHeight()};
            }
        } catch (IOException e) {
            log.warn("获取图片尺寸失败: {}", e.getMessage());
        }
        return new int[]{0, 0};
    }

    private String generateThumbnail(File sourceFile, String filename) {
        try {
            Path thumbnailPath = Paths.get(thumbnailDir);
            if (!Files.exists(thumbnailPath)) {
                Files.createDirectories(thumbnailPath);
            }

            String thumbnailFilename = filename.substring(0, filename.lastIndexOf('.')) + ".jpg";
            File thumbnailFile = thumbnailPath.resolve(thumbnailFilename).toFile();

            BufferedImage sourceImage = ImageIO.read(sourceFile);
            if (sourceImage == null) {
                return null;
            }

            int width = sourceImage.getWidth();
            int height = sourceImage.getHeight();

            double ratio = Math.min((double) THUMBNAIL_SIZE / width, (double) THUMBNAIL_SIZE / height);
            int newWidth = (int) (width * ratio);
            int newHeight = (int) (height * ratio);

            BufferedImage thumbnail = new BufferedImage(newWidth, newHeight, BufferedImage.TYPE_INT_RGB);
            Graphics2D g2d = thumbnail.createGraphics();
            g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g2d.drawImage(sourceImage, 0, 0, newWidth, newHeight, null);
            g2d.dispose();

            ImageIO.write(thumbnail, "jpg", thumbnailFile);

            return thumbnailFile.getAbsolutePath();

        } catch (IOException e) {
            log.warn("生成缩略图失败: {}", e.getMessage());
            return null;
        }
    }

    private void deletePhysicalFile(String filepath) {
        if (StringUtils.hasText(filepath)) {
            try {
                Files.deleteIfExists(Paths.get(filepath));
            } catch (IOException e) {
                log.warn("删除物理文件失败: {}, error: {}", filepath, e.getMessage());
            }
        }
    }
}

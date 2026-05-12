package com.sjzm.controller;

import com.sjzm.common.BusinessException;
import com.sjzm.common.PageResult;
import com.sjzm.common.Result;
import com.sjzm.service.ImageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 图片管理控制器（对齐 Python 的 /api/v1/images）
 */
@Slf4j
@Tag(name = "图片管理", description = "图片上传、查询、删除、以图搜图")
@RestController
@RequestMapping("/api/v1/images")
@RequiredArgsConstructor
public class ImageController {

    private final ImageService imageService;

    @Operation(summary = "上传图片", description = "上传单张图片")
    @PostMapping("/upload")
    public Result<Map<String, Object>> uploadImage(
            @Parameter(description = "图片文件") @RequestParam("file") MultipartFile file,
            @Parameter(description = "图片分类") @RequestParam("category") String category,
            @Parameter(description = "图片标签（逗号分隔）") @RequestParam(required = false) String tags,
            @Parameter(description = "图片描述") @RequestParam(required = false) String description,
            @Parameter(description = "产品SKU") @RequestParam(required = false) String sku) {
        try {
            log.info("上传图片: fileName={}, category={}, tags={}, description={}, sku={}",
                    file.getOriginalFilename(), category, tags, description, sku);
            Map<String, Object> result = imageService.uploadImage(file, category, tags, description, sku);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("上传图片失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量上传图片", description = "批量上传多张图片")
    @PostMapping("/batch-upload")
    public Result<Map<String, Object>> batchUploadImages(
            @Parameter(description = "图片文件列表") @RequestParam("files") List<MultipartFile> files,
            @Parameter(description = "图片分类") @RequestParam("category") String category,
            @Parameter(description = "图片标签（逗号分隔）") @RequestParam(required = false) String tags,
            @Parameter(description = "图片描述") @RequestParam(required = false) String description,
            @Parameter(description = "产品SKU") @RequestParam(required = false) String sku) {
        try {
            log.info("批量上传图片: count={}, category={}", files.size(), category);
            Map<String, Object> result = imageService.batchUploadImages(files, category, tags, description, sku);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("批量上传图片失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取图片列表", description = "分页查询图片列表，支持关键词和分类筛选")
    @GetMapping
    public Result<PageResult<Map<String, Object>>> getImages(
            @Parameter(description = "页码") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "每页数量") @RequestParam(defaultValue = "12") int size,
            @Parameter(description = "搜索关键词") @RequestParam(required = false) String keyword,
            @Parameter(description = "图片分类") @RequestParam(required = false) String category) {
        try {
            PageResult<Map<String, Object>> result = imageService.listImages(page, size, keyword, category);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取图片列表失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取图片详情", description = "根据ID获取图片详细信息")
    @GetMapping("/{id}")
    public Result<Map<String, Object>> getImage(@PathVariable Long id) {
        try {
            Map<String, Object> result = imageService.getImageById(id);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取图片详情失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取图片文件", description = "获取图片文件内容，支持转换为PNG")
    @GetMapping("/{id}/file")
    public ResponseEntity<Resource> getImageFile(
            @PathVariable Long id,
            @Parameter(description = "是否获取原图") @RequestParam(defaultValue = "false") boolean original) {
        try {
            String filepath = imageService.getImageFilepath(id);
            File file = new File(filepath);

            if (!file.exists()) {
                throw new BusinessException(404, "图片文件不存在");
            }

            Resource resource = new FileSystemResource(file);
            return ResponseEntity.ok()
                    .contentType(MediaType.IMAGE_PNG)
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"" + file.getName() + ".png\"")
                    .header("Cache-Control", "public, max-age=31536000, immutable")
                    .body(resource);

        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取图片文件失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取图片缩略图", description = "获取256x256的缩略图")
    @GetMapping("/{id}/thumbnail")
    public ResponseEntity<Resource> getImageThumbnail(@PathVariable Long id) {
        try {
            String filepath = imageService.getThumbnailPath(id);
            File file = new File(filepath);

            if (!file.exists()) {
                throw new BusinessException(404, "缩略图不存在");
            }

            Resource resource = new FileSystemResource(file);
            return ResponseEntity.ok()
                    .contentType(MediaType.IMAGE_JPEG)
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"" + id + "_thumbnail.jpg\"")
                    .header("Cache-Control", "public, max-age=31536000, immutable")
                    .body(resource);

        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取缩略图失败: " + e.getMessage());
        }
    }

    @Operation(summary = "更新图片信息", description = "更新图片的分类、标签、描述等信息")
    @PutMapping("/{id}")
    public Result<Void> updateImage(
            @PathVariable Long id,
            @Parameter(description = "图片分类") @RequestParam(required = false) String category,
            @Parameter(description = "图片标签（逗号分隔）") @RequestParam(required = false) String tags,
            @Parameter(description = "图片描述") @RequestParam(required = false) String description) {
        try {
            boolean success = imageService.updateImage(id, category, tags, description);
            if (!success) {
                return Result.notFound("图片不存在");
            }
            return Result.success();
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("更新图片失败: " + e.getMessage());
        }
    }

    @Operation(summary = "删除图片", description = "删除图片及其相关数据（包括文件、元数据）")
    @DeleteMapping("/{id}")
    public Result<Void> deleteImage(@PathVariable Long id) {
        try {
            boolean success = imageService.deleteImage(id);
            if (!success) {
                return Result.notFound("图片不存在");
            }
            return Result.success();
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("删除图片失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量删除图片", description = "批量删除图片及其相关数据")
    @DeleteMapping("/batch")
    public Result<Map<String, Object>> batchDeleteImages(@RequestBody Map<String, Object> request) {
        try {
            @SuppressWarnings("unchecked")
            List<Long> ids = (List<Long>) request.get("ids");
            if (ids == null || ids.isEmpty()) {
                return Result.error("请提供要删除的图片ID列表");
            }
            Map<String, Object> result = imageService.batchDeleteImages(ids);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("批量删除图片失败: " + e.getMessage());
        }
    }

    @Operation(summary = "搜索相似图片", description = "基于 Qdrant 向量数据库搜索相似图片（AI功能）")
    @GetMapping("/{imageId}/similar")
    public Result<List<Map<String, Object>>> searchSimilarImages(
            @PathVariable Long imageId,
            @Parameter(description = "返回数量限制") @RequestParam(defaultValue = "10") int limit) {
        try {
            List<Map<String, Object>> result = imageService.searchSimilarImages(imageId, limit);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("搜索相似图片失败: " + e.getMessage());
        }
    }

    @Operation(summary = "以图搜图", description = "上传图片搜索相似图片，基于 Qdrant 向量数据库（AI功能）")
    @PostMapping("/search-by-image")
    public Result<List<Map<String, Object>>> searchByImage(
            @Parameter(description = "参考图片文件") @RequestParam("file") MultipartFile file,
            @Parameter(description = "图片分类过滤") @RequestParam(required = false) String category,
            @Parameter(description = "返回数量限制") @RequestParam(defaultValue = "10") int limit) {
        try {
            List<Map<String, Object>> result = imageService.searchSimilarByFile(file, limit, category);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("以图搜图失败: " + e.getMessage());
        }
    }

    @Operation(summary = "以图搜图", description = "与 search-by-image 相同，支持前端 search-similar 路径")
    @PostMapping("/search-similar")
    public Result<List<Map<String, Object>>> searchSimilar(
            @Parameter(description = "参考图片文件") @RequestParam("file") MultipartFile file,
            @Parameter(description = "返回数量限制") @RequestParam(defaultValue = "10") int limit) {
        try {
            List<Map<String, Object>> result = imageService.searchSimilarByFile(file, limit, null);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("以图搜图失败: " + e.getMessage());
        }
    }

    @Operation(summary = "索引图片向量", description = "将图片索引到 Qdrant 向量数据库")
    @PostMapping("/{id}/index")
    public Result<Map<String, Object>> indexImageVector(@PathVariable Long id) {
        try {
            Map<String, Object> result = imageService.indexImageVector(id);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("索引图片向量失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量索引图片向量", description = "批量将图片索引到 Qdrant 向量数据库")
    @PostMapping("/batch-index")
    public Result<Map<String, Object>> batchIndexImageVectors(@RequestBody List<Long> imageIds) {
        try {
            Map<String, Object> result = imageService.batchIndexImageVectors(imageIds);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("批量索引图片向量失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取向量服务状态", description = "获取 Qdrant 向量数据库服务状态")
    @GetMapping("/vector-status")
    public Result<Map<String, Object>> getVectorServiceStatus() {
        try {
            Map<String, Object> result = imageService.getVectorServiceStatus();
            return Result.success(result);
        } catch (Exception e) {
            throw new BusinessException("获取向量服务状态失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取图片统计", description = "获取图片数量统计")
    @GetMapping("/stats/count")
    public Result<Map<String, Object>> getImageStats(
            @Parameter(description = "图片分类") @RequestParam(required = false) String category) {
        try {
            Map<String, Object> result = imageService.getImageStats(category);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("获取图片统计失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量获取图片信息", description = "根据ID列表批量获取图片信息")
    @PostMapping("/batch-get")
    public Result<Map<String, Object>> batchGetImages(@RequestBody List<Long> imageIds) {
        try {
            Map<String, Object> result = imageService.batchGetImages(imageIds);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("批量获取图片信息失败: " + e.getMessage());
        }
    }

    @Operation(summary = "批量刷新图片URL", description = "批量刷新图片URL格式（修复//开头的URL等）")
    @PostMapping("/refresh-urls")
    public Result<Map<String, Object>> refreshImageUrls(
            @Parameter(description = "图片ID列表（可选）") @RequestParam(required = false) List<Long> imageIds,
            @Parameter(description = "图片分类（可选）") @RequestParam(required = false) String category,
            @Parameter(description = "限制数量") @RequestParam(defaultValue = "1000") int limit,
            @Parameter(description = "偏移量") @RequestParam(defaultValue = "0") int offset) {
        try {
            Map<String, Object> result = imageService.refreshImageUrls(imageIds, category, limit, offset);
            return Result.success(result);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("批量刷新图片URL失败: " + e.getMessage());
        }
    }
}

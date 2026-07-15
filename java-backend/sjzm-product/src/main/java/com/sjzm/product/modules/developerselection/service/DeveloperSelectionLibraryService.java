package com.sjzm.product.modules.developerselection.service;

import com.sjzm.product.modules.developerselection.dto.DeveloperSelectionBatchAddRequest;
import com.sjzm.product.modules.developerselection.dto.DeveloperSelectionBatchCreateRequest;
import com.sjzm.product.modules.developerselection.dto.DeveloperSelectionLibraryQuery;

import java.util.List;
import java.util.Map;

public interface DeveloperSelectionLibraryService {

    Map<String, Object> addItems(Long userId, String username, String role,
                                 DeveloperSelectionBatchAddRequest request);

    Map<String, Object> list(Long currentUserId, String role, DeveloperSelectionLibraryQuery query);

    List<Map<String, Object>> weekOptions(Long currentUserId, String role, DeveloperSelectionLibraryQuery query);

    List<Map<String, Object>> developerOptions(Long currentUserId, String username, String role);

    List<Map<String, Object>> listBatches(Long currentUserId, String role, String bucket, Long developerId);

    Map<String, Object> createBatch(Long currentUserId, String username, String role,
                                    DeveloperSelectionBatchCreateRequest request);

    int assignBatch(Long currentUserId, String role, List<Long> ids, Long batchId);

    int unassignBatch(Long currentUserId, String role, List<Long> ids);

    int convert(Long currentUserId, String role, List<Long> ids, String targetBucket);

    int delete(Long currentUserId, String role, List<Long> ids);
}

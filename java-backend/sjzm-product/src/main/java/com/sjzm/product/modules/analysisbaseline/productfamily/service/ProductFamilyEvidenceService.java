package com.sjzm.product.modules.analysisbaseline.productfamily.service;

import com.sjzm.product.modules.analysisbaseline.productfamily.entity.ProductFamilyGroup;
import com.sjzm.product.modules.analysisbaseline.productfamily.entity.ProductFamilyMember;

import java.util.List;

public interface ProductFamilyEvidenceService {
    List<ProductFamilyGroup> listGroups(String marketplace, String categoryKey, String status);

    ProductFamilyGroup saveGroup(ProductFamilyGroup group);

    List<ProductFamilyMember> listMembers(String familyCode, String marketplace);

    ProductFamilyMember addMember(String familyCode, ProductFamilyMember member);
}

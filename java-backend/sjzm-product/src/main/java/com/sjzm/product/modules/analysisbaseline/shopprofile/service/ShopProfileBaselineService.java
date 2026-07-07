package com.sjzm.product.modules.analysisbaseline.shopprofile.service;

import com.sjzm.product.modules.analysisbaseline.shopprofile.entity.ShopProfileBaseline;
import com.sjzm.product.modules.analysisbaseline.shopprofile.entity.ShopProfileBaselineMember;

import java.util.List;

public interface ShopProfileBaselineService {
    List<ShopProfileBaseline> listBaselines(String baselineType, String status);

    ShopProfileBaseline saveBaseline(ShopProfileBaseline baseline);

    ShopProfileBaseline updateBaseline(Long id, ShopProfileBaseline baseline);

    List<ShopProfileBaselineMember> listMembers(String baselineCode, String marketplace);

    ShopProfileBaselineMember addMember(String baselineCode, ShopProfileBaselineMember member);

    void deleteMember(Long id);
}

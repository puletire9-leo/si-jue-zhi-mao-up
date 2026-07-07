package com.sjzm.product.modules.analysisbaseline.productfamily.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.product.modules.analysisbaseline.common.MarketplaceSupport;
import com.sjzm.product.modules.analysisbaseline.productfamily.entity.ProductFamilyGroup;
import com.sjzm.product.modules.analysisbaseline.productfamily.entity.ProductFamilyMember;
import com.sjzm.product.modules.analysisbaseline.productfamily.mapper.ProductFamilyGroupMapper;
import com.sjzm.product.modules.analysisbaseline.productfamily.mapper.ProductFamilyMemberMapper;
import com.sjzm.product.modules.analysisbaseline.productfamily.service.ProductFamilyEvidenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class ProductFamilyEvidenceServiceImpl implements ProductFamilyEvidenceService {

    private final ProductFamilyGroupMapper groupMapper;
    private final ProductFamilyMemberMapper memberMapper;

    @Override
    public List<ProductFamilyGroup> listGroups(String marketplace, String categoryKey, String status) {
        LambdaQueryWrapper<ProductFamilyGroup> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(marketplace)) {
            wrapper.eq(ProductFamilyGroup::getMarketplace, MarketplaceSupport.require(marketplace));
        }
        if (StringUtils.hasText(categoryKey)) {
            wrapper.eq(ProductFamilyGroup::getCategoryKey, categoryKey.trim());
        }
        if (StringUtils.hasText(status)) {
            wrapper.eq(ProductFamilyGroup::getStatus, status.trim().toUpperCase(Locale.ROOT));
        }
        wrapper.orderByDesc(ProductFamilyGroup::getComputedAt)
                .orderByDesc(ProductFamilyGroup::getUpdatedAt);
        return groupMapper.selectList(wrapper);
    }

    @Override
    public ProductFamilyGroup saveGroup(ProductFamilyGroup group) {
        if (!StringUtils.hasText(group.getFamilyCode())) {
            throw new IllegalArgumentException("familyCode 不能为空");
        }
        group.setFamilyCode(group.getFamilyCode().trim().toUpperCase(Locale.ROOT));
        if (StringUtils.hasText(group.getMarketplace())) {
            group.setMarketplace(MarketplaceSupport.require(group.getMarketplace()));
        }
        if (!StringUtils.hasText(group.getStatus())) {
            group.setStatus("ACTIVE");
        }
        groupMapper.insert(group);
        return group;
    }

    @Override
    public List<ProductFamilyMember> listMembers(String familyCode, String marketplace) {
        String code = requireFamilyCode(familyCode);
        LambdaQueryWrapper<ProductFamilyMember> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ProductFamilyMember::getFamilyCode, code);
        if (StringUtils.hasText(marketplace)) {
            wrapper.eq(ProductFamilyMember::getMarketplace, MarketplaceSupport.require(marketplace));
        }
        wrapper.orderByAsc(ProductFamilyMember::getMarketplace, ProductFamilyMember::getAsin);
        return memberMapper.selectList(wrapper);
    }

    @Override
    public ProductFamilyMember addMember(String familyCode, ProductFamilyMember member) {
        member.setFamilyCode(requireFamilyCode(familyCode));
        if (!StringUtils.hasText(member.getAsin())) {
            throw new IllegalArgumentException("asin 不能为空");
        }
        if (!StringUtils.hasText(member.getSourceTable())) {
            throw new IllegalArgumentException("sourceTable 不能为空");
        }
        if (!StringUtils.hasText(member.getMatchType())) {
            throw new IllegalArgumentException("matchType 不能为空");
        }
        member.setMarketplace(MarketplaceSupport.require(member.getMarketplace()));
        member.setAsin(member.getAsin().trim().toUpperCase(Locale.ROOT));
        member.setSourceTable(member.getSourceTable().trim());
        if (member.getSourceBatch() == null) {
            member.setSourceBatch("");
        }
        memberMapper.insert(member);
        return member;
    }

    private String requireFamilyCode(String familyCode) {
        if (!StringUtils.hasText(familyCode)) {
            throw new IllegalArgumentException("familyCode 不能为空");
        }
        return familyCode.trim().toUpperCase(Locale.ROOT);
    }
}

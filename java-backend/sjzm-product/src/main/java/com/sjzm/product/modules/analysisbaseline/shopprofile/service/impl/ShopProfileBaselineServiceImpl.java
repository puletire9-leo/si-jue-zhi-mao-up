package com.sjzm.product.modules.analysisbaseline.shopprofile.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.product.modules.analysisbaseline.common.MarketplaceSupport;
import com.sjzm.product.modules.analysisbaseline.shopprofile.entity.ShopProfileBaseline;
import com.sjzm.product.modules.analysisbaseline.shopprofile.entity.ShopProfileBaselineMember;
import com.sjzm.product.modules.analysisbaseline.shopprofile.mapper.ShopProfileBaselineMapper;
import com.sjzm.product.modules.analysisbaseline.shopprofile.mapper.ShopProfileBaselineMemberMapper;
import com.sjzm.product.modules.analysisbaseline.shopprofile.service.ShopProfileBaselineService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class ShopProfileBaselineServiceImpl implements ShopProfileBaselineService {

    private final ShopProfileBaselineMapper baselineMapper;
    private final ShopProfileBaselineMemberMapper memberMapper;

    @Override
    public List<ShopProfileBaseline> listBaselines(String baselineType, String status) {
        LambdaQueryWrapper<ShopProfileBaseline> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(baselineType)) {
            wrapper.eq(ShopProfileBaseline::getBaselineType, baselineType.trim().toUpperCase(Locale.ROOT));
        }
        if (StringUtils.hasText(status)) {
            wrapper.eq(ShopProfileBaseline::getStatus, status.trim().toUpperCase(Locale.ROOT));
        }
        wrapper.orderByAsc(ShopProfileBaseline::getBaselineType, ShopProfileBaseline::getBaselineCode);
        return baselineMapper.selectList(wrapper);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ShopProfileBaseline saveBaseline(ShopProfileBaseline baseline) {
        normalizeBaseline(baseline);
        baselineMapper.insert(baseline);
        return baseline;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ShopProfileBaseline updateBaseline(Long id, ShopProfileBaseline baseline) {
        baseline.setId(id);
        normalizeBaseline(baseline);
        baselineMapper.updateById(baseline);
        return baselineMapper.selectById(id);
    }

    @Override
    public List<ShopProfileBaselineMember> listMembers(String baselineCode, String marketplace) {
        String code = requireCode(baselineCode);
        LambdaQueryWrapper<ShopProfileBaselineMember> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ShopProfileBaselineMember::getBaselineCode, code);
        if (StringUtils.hasText(marketplace)) {
            wrapper.eq(ShopProfileBaselineMember::getMarketplace, MarketplaceSupport.require(marketplace));
        }
        wrapper.orderByAsc(ShopProfileBaselineMember::getMarketplace, ShopProfileBaselineMember::getSellerName);
        return memberMapper.selectList(wrapper);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ShopProfileBaselineMember addMember(String baselineCode, ShopProfileBaselineMember member) {
        String code = requireCode(baselineCode);
        member.setBaselineCode(code);
        if (!StringUtils.hasText(member.getSellerName())) {
            throw new IllegalArgumentException("sellerName 不能为空");
        }
        member.setMarketplace(MarketplaceSupport.require(member.getMarketplace()));
        member.setSellerName(member.getSellerName().trim());
        if (member.getWeight() == null) {
            member.setWeight(BigDecimal.ONE);
        }
        if (!StringUtils.hasText(member.getStatus())) {
            member.setStatus("ACTIVE");
        }
        memberMapper.insert(member);
        refreshShopCount(code);
        return member;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteMember(Long id) {
        ShopProfileBaselineMember old = memberMapper.selectById(id);
        memberMapper.deleteById(id);
        if (old != null) {
            refreshShopCount(old.getBaselineCode());
        }
    }

    private void normalizeBaseline(ShopProfileBaseline baseline) {
        if (!StringUtils.hasText(baseline.getBaselineCode())) {
            throw new IllegalArgumentException("baselineCode 不能为空");
        }
        if (!StringUtils.hasText(baseline.getBaselineName())) {
            throw new IllegalArgumentException("baselineName 不能为空");
        }
        if (!StringUtils.hasText(baseline.getBaselineType())) {
            throw new IllegalArgumentException("baselineType 不能为空");
        }
        baseline.setBaselineCode(baseline.getBaselineCode().trim().toUpperCase(Locale.ROOT));
        baseline.setBaselineType(baseline.getBaselineType().trim().toUpperCase(Locale.ROOT));
        if (!StringUtils.hasText(baseline.getStatus())) {
            baseline.setStatus("ACTIVE");
        } else {
            baseline.setStatus(baseline.getStatus().trim().toUpperCase(Locale.ROOT));
        }
        if (baseline.getShopCount() == null) {
            baseline.setShopCount(0);
        }
    }

    private String requireCode(String baselineCode) {
        if (!StringUtils.hasText(baselineCode)) {
            throw new IllegalArgumentException("baselineCode 不能为空");
        }
        return baselineCode.trim().toUpperCase(Locale.ROOT);
    }

    private void refreshShopCount(String baselineCode) {
        LambdaQueryWrapper<ShopProfileBaselineMember> countWrapper = new LambdaQueryWrapper<>();
        countWrapper.eq(ShopProfileBaselineMember::getBaselineCode, baselineCode)
                .eq(ShopProfileBaselineMember::getStatus, "ACTIVE");
        Long count = memberMapper.selectCount(countWrapper);

        LambdaQueryWrapper<ShopProfileBaseline> baselineWrapper = new LambdaQueryWrapper<>();
        baselineWrapper.eq(ShopProfileBaseline::getBaselineCode, baselineCode);
        ShopProfileBaseline baseline = baselineMapper.selectOne(baselineWrapper);
        if (baseline != null) {
            baseline.setShopCount(count == null ? 0 : count.intValue());
            baselineMapper.updateById(baseline);
        }
    }
}

package com.sjzm.product.modules.shopcollection.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sjzm.product.modules.analysisbaseline.shopprofile.dto.ShopProfileSummary;
import com.sjzm.product.modules.shopcollection.entity.ShopSellerSummary;
import com.sjzm.product.modules.shopcollection.mapper.ShopSellerSummaryMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Atomically replaces one marketplace's materialized seller-summary snapshot. */
@Service
@RequiredArgsConstructor
public class ShopSellerSummarySnapshotWriter {

    private final ShopSellerSummaryMapper mapper;

    @Transactional
    public void replace(String marketplace, List<ShopProfileSummary> summaries) {
        mapper.delete(new LambdaQueryWrapper<ShopSellerSummary>()
                .eq(ShopSellerSummary::getMarketplace, marketplace));
        for (ShopProfileSummary summary : summaries) {
            ShopSellerSummary row = new ShopSellerSummary();
            BeanUtils.copyProperties(summary, row);
            row.setId(null);
            mapper.insert(row);
        }
    }
}

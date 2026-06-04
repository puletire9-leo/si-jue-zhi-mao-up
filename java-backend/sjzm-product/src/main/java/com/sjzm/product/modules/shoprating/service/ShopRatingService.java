package com.sjzm.product.modules.shoprating.service;

import com.sjzm.product.modules.shoprating.dto.ShopRatingResult;

import java.util.List;

public interface ShopRatingService {

    /** 获取候选店铺（新品榜 >minCount 新品的店铺） */
    List<ShopRatingResult.CandidateShop> getCandidates(String marketplace, int minCount);

    /** 触发异步评级任务，返回 taskId */
    String evaluate(String marketplace, int minCount);

    /** 异步执行评级（内部调用，勿直接调用） */
    void evaluateAsync(String taskId, String marketplace, int minCount);

    /** 查询任务状态 */
    ShopRatingResult.TaskStatus getTaskStatus(String taskId);
}

package com.sjzm.product.modules.requestcenter.gateway;

import com.sjzm.product.modules.requestcenter.gateway.model.SellerspriteExecutionRequest;
import com.sjzm.product.modules.requestcenter.gateway.model.SellerspriteExecutionResult;

/**
 * 唯一的卖家精灵外部执行边界。
 *
 * <p>所有 {@code /product/competitor-lookup} 请求最终都必须通过此接口发出；
 * 具体实现负责密钥、超时、限流、熔断、调用审计和错误分类。</p>
 */
public interface SellerspriteExecutionGateway {

    SellerspriteExecutionResult execute(SellerspriteExecutionRequest request);
}

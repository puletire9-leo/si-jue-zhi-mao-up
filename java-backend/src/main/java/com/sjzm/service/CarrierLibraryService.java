package com.sjzm.service;

import com.sjzm.common.PageResult;
import com.sjzm.entity.CarrierLibrary;
import com.sjzm.entity.CarrierLibraryRecycleBin;

import java.util.List;
import java.util.Map;

/**
 * 运营商库服务接口
 */
public interface CarrierLibraryService {

    /**
     * 分页查询运营商
     */
    PageResult<CarrierLibrary> listCarriers(int page, int size, String searchType, String searchContent,
                                             List<String> developers, List<String> carriers);

    /**
     * 根据ID获取运营商
     */
    CarrierLibrary getCarrierById(Long id);

    /**
     * 根据SKU获取运营商
     */
    CarrierLibrary getCarrierBySku(String sku);

    /**
     * 获取批次数量
     */
    Long getBatchCount(String batch);

    /**
     * 创建运营商
     */
    CarrierLibrary createCarrier(CarrierLibrary carrier);

    /**
     * 更新运营商
     */
    CarrierLibrary updateCarrier(Long id, CarrierLibrary carrier);

    /**
     * 删除运营商（移动到回收站）
     */
    void deleteCarrier(Long id);

    /**
     * 批量删除运营商（移动到回收站）
     */
    Map<String, Object> batchDeleteCarriers(List<Long> ids);

    /**
     * 批量导入运营商
     */
    Map<String, Object> batchImportCarriers(List<CarrierLibrary> carriers);

    /**
     * 分页查询回收站运营商
     */
    PageResult<CarrierLibraryRecycleBin> listRecycleBin(int page, int size);

    /**
     * 恢复运营商
     */
    void restoreMaterial(String sku);

    /**
     * 批量恢复运营商
     */
    Map<String, Object> batchRestoreMaterials(List<String> skus);

    /**
     * 永久删除运营商
     */
    void permanentDeleteMaterial(String sku);

    /**
     * 批量永久删除运营商
     */
    Map<String, Object> batchPermanentDeleteMaterials(List<String> skus);

    /**
     * 清空回收站
     */
    Map<String, Object> clearRecycleBin();
}

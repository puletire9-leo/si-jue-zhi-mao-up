package com.sjzm.product.modules.lingxing.requestcenter.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.lingxing.requestcenter.entity.LingxingAutomationRequestRegistry;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/** 领星自动化请求注册表 Mapper。 */
@Mapper
public interface LingxingAutomationRequestRegistryMapper
        extends BaseMapper<LingxingAutomationRequestRegistry> {

    @Select("SELECT * FROM lingxing_automation_request_registry " +
            "WHERE registration_code=#{code} AND deleted=0 LIMIT 1 FOR UPDATE")
    LingxingAutomationRequestRegistry selectByCodeForUpdate(@Param("code") String code);

    @Update("UPDATE lingxing_automation_request_registry SET next_run_at=NULL, updated_at=NOW() " +
            "WHERE id=#{id}")
    int clearNextRun(@Param("id") Long id);

    @Update("UPDATE lingxing_automation_request_registry " +
            "SET last_status=#{status}, last_error=#{error}, updated_at=NOW() WHERE id=#{id}")
    int updateLastExecutionStatus(@Param("id") Long id,
                                  @Param("status") String status,
                                  @Param("error") String error);
}

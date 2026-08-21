package com.sjzm.product.modules.automation.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.automation.entity.AutomationRun;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface AutomationRunMapper extends BaseMapper<AutomationRun> {

    /**
     * 进程重启后，收口领星队列关联的遗留 RUNNING 审计。
     * 这些记录没有对应的存活 JVM 线程，继续显示运行中会变成假并发。
     */
    @Update("""
            UPDATE automation_run
            SET status='FAILED',
                error_message='进程重启中断',
                finished_at=NOW(),
                updated_at=NOW()
            WHERE status='RUNNING'
              AND deleted=0
              AND correlation_id LIKE 'lingxing-request:%'
            """)
    int interruptStaleLingxingRequestRuns();
}

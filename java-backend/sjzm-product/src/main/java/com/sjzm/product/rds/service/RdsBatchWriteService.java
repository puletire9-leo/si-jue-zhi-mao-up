package com.sjzm.product.rds.service;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.executor.BatchResult;
import org.apache.ibatis.session.ExecutorType;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import lombok.extern.slf4j.Slf4j;

import java.sql.Statement;
import java.util.List;
import java.util.function.BiConsumer;
import java.util.function.Function;
import java.util.function.Predicate;

/**
 * 远程 RDS 写入中心（唯一写入入口）。
 *
 * <p>复用 RDS 专用 SqlSessionFactory，以 MyBatis BATCH executor 在同一连接、同一事务内
 * 累积现有 Mapper 的 insert/upsert/update 语句。适用于不同表结构，避免各业务 Service
 * 在公网 RDS 上逐行提交。JDBC URL 已启用 rewriteBatchedStatements。</p>
 *
 * <p><b>架构约束：</b>所有写入 RDS 的业务代码都必须调用本中心；
 * 业务 Service 禁止直接调用 RDS Mapper 的 insert/update/delete/upsert，
 * 也禁止对 RDS 实体使用 Db.saveBatch/Db.saveOrUpdateBatch。读取可以直接使用 RDS Mapper。</p>
 */
@Service
@Slf4j
public class RdsBatchWriteService {

    private static final int DEFAULT_FLUSH_SIZE = 200;

    private final SqlSessionFactory rdsSqlSessionFactory;

    public RdsBatchWriteService(
            @Qualifier("rdsSqlSessionFactory") SqlSessionFactory rdsSqlSessionFactory) {
        this.rdsSqlSessionFactory = rdsSqlSessionFactory;
    }

    public <M, T> int execute(Class<M> mapperType, List<T> rows, BiConsumer<M, T> operation) {
        return execute(mapperType, rows, DEFAULT_FLUSH_SIZE, operation);
    }

    public <M extends BaseMapper<T>, T> int saveOrUpdate(
            Class<M> mapperType, List<T> rows, int flushSize, Predicate<T> hasId) {
        return execute(mapperType, rows, flushSize,
                (mapper, row) -> {
                    if (hasId.test(row)) mapper.updateById(row);
                    else mapper.insert(row);
                });
    }

    public <M extends BaseMapper<T>, T> int insert(
            Class<M> mapperType, List<T> rows, int flushSize) {
        return execute(mapperType, rows, flushSize, BaseMapper::insert);
    }

    public <M, T> int execute(Class<M> mapperType, List<T> rows, int flushSize,
                              BiConsumer<M, T> operation) {
        if (rows == null || rows.isEmpty()) return 0;
        if (flushSize <= 0) throw new IllegalArgumentException("RDS flushSize 必须大于0");
        long started = System.nanoTime();
        try (SqlSession session = rdsSqlSessionFactory.openSession(ExecutorType.BATCH, false)) {
            M mapper = session.getMapper(mapperType);
            int queued = 0;
            try {
                for (T row : rows) {
                    operation.accept(mapper, row);
                    queued++;
                    if (queued % flushSize == 0) validateBatchResults(session.flushStatements());
                }
                validateBatchResults(session.flushStatements());
                session.commit();
                log.info("[RDS写入中心] mapper={}, rows={}, flushSize={}, durationMs={}",
                        mapperType.getSimpleName(), queued, flushSize,
                        (System.nanoTime() - started) / 1_000_000L);
                return queued;
            } catch (RuntimeException ex) {
                session.rollback();
                throw ex;
            }
        }
    }

    /**
     * 执行一次 RDS 写操作（如集合 SQL、截断、状态更新），仍由中心统一提交/回滚。
     */
    public <M, R> R executeOne(Class<M> mapperType, Function<M, R> operation) {
        long started = System.nanoTime();
        try (SqlSession session = rdsSqlSessionFactory.openSession(ExecutorType.SIMPLE, false)) {
            M mapper = session.getMapper(mapperType);
            try {
                R result = operation.apply(mapper);
                session.commit();
                log.info("[RDS写入中心] mapper={}, mode=single, durationMs={}",
                        mapperType.getSimpleName(), (System.nanoTime() - started) / 1_000_000L);
                return result;
            } catch (RuntimeException ex) {
                session.rollback();
                throw ex;
            }
        }
    }

    private void validateBatchResults(List<BatchResult> results) {
        for (BatchResult result : results) {
            for (int count : result.getUpdateCounts()) {
                if (count == Statement.EXECUTE_FAILED) {
                    throw new IllegalStateException("RDS 批量写入中存在失败语句: "
                            + result.getMappedStatement().getId());
                }
            }
        }
    }
}

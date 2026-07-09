package com.sjzm.product.config;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;

/**
 * 数据库结构守卫。
 *
 * <p>凡是新增 MyBatis-Plus {@link TableName} 实体，都必须同步提交并执行
 * {@code java-backend/sql/*.sql} 迁移。这里在应用启动时扫描实体并核对
 * information_schema，缺表/缺列时直接暴露问题，避免生产页面运行时才出现 500。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SchemaGuard implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Value("${schema-guard.enabled:true}")
    private boolean enabled;

    @Value("${schema-guard.fail-fast:true}")
    private boolean failFast;

    @Value("${schema-guard.check-columns:true}")
    private boolean checkColumns;

    @Value("${schema-guard.scan-packages:com.sjzm.product}")
    private String scanPackages;

    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            log.warn("[SchemaGuard] 已关闭。仅在一次性排障时允许关闭，正常部署必须开启。");
            return;
        }

        String schema = currentSchema();
        Map<String, Set<String>> requiredTables = requiredTables();
        Set<String> existingTables = existingTables(schema);

        List<String> problems = new ArrayList<>();
        for (Map.Entry<String, Set<String>> entry : requiredTables.entrySet()) {
            String table = entry.getKey();
            if (!existingTables.contains(table.toLowerCase(Locale.ROOT))) {
                problems.add("缺表: " + table);
                continue;
            }
            if (checkColumns) {
                Set<String> existingColumns = existingColumns(schema, table);
                for (String column : entry.getValue()) {
                    if (!existingColumns.contains(column.toLowerCase(Locale.ROOT))) {
                        problems.add("缺列: " + table + "." + column);
                    }
                }
            }
        }

        if (problems.isEmpty()) {
            log.info("[SchemaGuard] 数据库结构检查通过: schema={}, tables={}", schema, requiredTables.size());
            return;
        }

        String message = "[SchemaGuard] 数据库结构检查失败，请先执行对应 SQL 迁移：\n - "
                + String.join("\n - ", problems);
        if (failFast) {
            throw new IllegalStateException(message);
        }
        log.error(message);
    }

    private String currentSchema() {
        String schema = jdbcTemplate.queryForObject("SELECT DATABASE()", String.class);
        if (!StringUtils.hasText(schema)) {
            throw new IllegalStateException("[SchemaGuard] 无法识别当前数据库 schema");
        }
        return schema;
    }

    private Map<String, Set<String>> requiredTables() {
        Map<String, Set<String>> tables = new TreeMap<>();
        ClassPathScanningCandidateComponentProvider scanner =
                new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(TableName.class));

        for (String basePackage : scanPackages.split(",")) {
            String pkg = basePackage.trim();
            if (!StringUtils.hasText(pkg)) {
                continue;
            }
            scanner.findCandidateComponents(pkg).forEach(beanDefinition -> {
                try {
                    Class<?> entityClass = Class.forName(beanDefinition.getBeanClassName());
                    TableName tableName = entityClass.getAnnotation(TableName.class);
                    if (tableName == null || !StringUtils.hasText(tableName.value())) {
                        return;
                    }
                    tables.computeIfAbsent(tableName.value(), ignored -> new TreeSet<>())
                            .addAll(requiredColumns(entityClass));
                } catch (ClassNotFoundException e) {
                    throw new IllegalStateException("[SchemaGuard] 实体类加载失败: "
                            + beanDefinition.getBeanClassName(), e);
                }
            });
        }
        return tables;
    }

    private Set<String> requiredColumns(Class<?> entityClass) {
        Set<String> columns = new TreeSet<>();
        Class<?> current = entityClass;
        while (current != null && current != Object.class) {
            for (Field field : current.getDeclaredFields()) {
                if (Modifier.isStatic(field.getModifiers()) || Modifier.isTransient(field.getModifiers())) {
                    continue;
                }
                TableField tableField = field.getAnnotation(TableField.class);
                if (tableField != null && !tableField.exist()) {
                    continue;
                }
                String column = explicitColumn(field);
                columns.add(column);
            }
            current = current.getSuperclass();
        }
        return columns;
    }

    private String explicitColumn(Field field) {
        TableId tableId = field.getAnnotation(TableId.class);
        if (tableId != null && StringUtils.hasText(tableId.value())) {
            return cleanColumnName(tableId.value());
        }

        TableField tableField = field.getAnnotation(TableField.class);
        if (tableField != null && StringUtils.hasText(tableField.value())) {
            return cleanColumnName(tableField.value());
        }

        return camelToSnake(field.getName());
    }

    private String cleanColumnName(String column) {
        return column.replace("`", "").trim();
    }

    private String camelToSnake(String value) {
        StringBuilder sb = new StringBuilder(value.length() + 8);
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (Character.isUpperCase(c)) {
                if (i > 0) {
                    sb.append('_');
                }
                sb.append(Character.toLowerCase(c));
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    private Set<String> existingTables(String schema) {
        List<String> rows = jdbcTemplate.queryForList("""
                SELECT TABLE_NAME
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = ?
                """, String.class, schema);
        return lowerSet(rows);
    }

    private Set<String> existingColumns(String schema, String table) {
        List<String> rows = jdbcTemplate.queryForList("""
                SELECT COLUMN_NAME
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                """, String.class, schema, table);
        return lowerSet(rows);
    }

    private Set<String> lowerSet(List<String> values) {
        Set<String> result = new HashSet<>();
        for (String value : values) {
            result.add(value.toLowerCase(Locale.ROOT));
        }
        return result;
    }
}

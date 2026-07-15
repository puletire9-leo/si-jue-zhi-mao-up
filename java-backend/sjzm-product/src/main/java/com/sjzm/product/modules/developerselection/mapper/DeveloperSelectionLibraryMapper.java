package com.sjzm.product.modules.developerselection.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.developerselection.entity.DeveloperSelectionLibraryItem;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;
import java.util.Map;

@Mapper
public interface DeveloperSelectionLibraryMapper extends BaseMapper<DeveloperSelectionLibraryItem> {

    @Select("""
            SELECT CAST(u.id AS CHAR) AS userId,
                   COALESCE(NULLIF(u.developer, ''), NULLIF(u.full_name, ''), u.username) AS developerName,
                   COUNT(l.id) AS itemCount
            FROM users u
            LEFT JOIN developer_selection_library l
              ON l.user_id = u.id AND l.deleted = 0
            WHERE u.status = 1
              AND (
                NULLIF(u.developer, '') IS NOT NULL
                OR u.role LIKE '%开发%'
                OR LOWER(u.role) LIKE '%developer%'
                OR u.role LIKE '%管理员%'
                OR LOWER(u.role) LIKE '%admin%'
              )
            GROUP BY u.id, u.developer, u.full_name, u.username
            ORDER BY developerName
            """)
    List<Map<String, Object>> selectDeveloperOptions();

    @Select("""
            SELECT CAST(id AS CHAR) AS userId,
                   COALESCE(NULLIF(developer, ''), NULLIF(full_name, ''), username) AS developerName
            FROM users
            WHERE id = #{userId} AND status = 1
              AND (
                NULLIF(developer, '') IS NOT NULL
                OR role LIKE '%开发%'
                OR LOWER(role) LIKE '%developer%'
                OR role LIKE '%管理员%'
                OR LOWER(role) LIKE '%admin%'
              )
            LIMIT 1
            """)
    Map<String, Object> selectActiveDeveloperById(@Param("userId") Long userId);

    @Select("""
            SELECT CAST(id AS CHAR) AS userId,
                   COALESCE(NULLIF(developer, ''), NULLIF(full_name, ''), username) AS developerName
            FROM users
            WHERE status = 1
              AND (developer = #{developerName} OR full_name = #{developerName} OR username = #{developerName})
            ORDER BY CASE WHEN developer = #{developerName} THEN 0 ELSE 1 END, id
            LIMIT 1
            """)
    Map<String, Object> selectActiveDeveloperByName(@Param("developerName") String developerName);

    @Select("""
            <script>
            SELECT DATE_FORMAT(created_at, '%x-W%v') AS week,
                   MIN(DATE(DATE_SUB(created_at, INTERVAL WEEKDAY(created_at) DAY))) AS startDate,
                   MAX(DATE(DATE_ADD(DATE_SUB(created_at, INTERVAL WEEKDAY(created_at) DAY), INTERVAL 6 DAY))) AS endDate,
                   COUNT(*) AS count
            FROM developer_selection_library
            WHERE deleted = 0
              <if test="scopedUserId != null">AND user_id = #{scopedUserId}</if>
              <if test="bucket != null and bucket != ''">AND bucket = #{bucket}</if>
              <if test="marketplace != null and marketplace != ''">AND marketplace = #{marketplace}</if>
            GROUP BY DATE_FORMAT(created_at, '%x-W%v')
            ORDER BY week DESC
            </script>
            """)
    List<Map<String, Object>> selectLibraryWeeks(@Param("scopedUserId") Long scopedUserId,
                                                  @Param("bucket") String bucket,
                                                  @Param("marketplace") String marketplace);

    @Update("""
            UPDATE developer_selection_library
            SET deleted = 0, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = #{userId}
              AND marketplace = #{marketplace}
              AND asin = #{asin}
              AND deleted = 1
            """)
    int restoreIfDeleted(@Param("userId") Long userId,
                         @Param("marketplace") String marketplace,
                         @Param("asin") String asin);
}

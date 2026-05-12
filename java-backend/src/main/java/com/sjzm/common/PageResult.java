package com.sjzm.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 分页响应封装
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PageResult<T> implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 数据列表 */
    private List<T> list;

    /** 总记录数 */
    private Long total;

    /** 当前页码 */
    private Long page;

    /** 每页数量 */
    private Long size;

    /** 总页数 */
    private Long totalPages;

    public PageResult() {
    }

    public PageResult(List<T> list, Long total, Long page, Long size) {
        this.list = list;
        this.total = total;
        this.page = page;
        this.size = size;
        this.totalPages = (total + size - 1) / size;
    }

    /**
     * 构建分页结果
     */
    public static <T> PageResult<T> of(List<T> list, Long total, Long page, Long size) {
        return new PageResult<>(list, total, page, size);
    }

    /**
     * 空分页结果
     */
    public static <T> PageResult<T> empty(Long page, Long size) {
        return new PageResult<>(List.of(), 0L, page, size);
    }
}

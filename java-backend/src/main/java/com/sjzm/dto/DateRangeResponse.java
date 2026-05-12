package com.sjzm.dto;

import lombok.Data;
import java.io.Serializable;

@Data
public class DateRangeResponse implements Serializable {
    private String minDate;
    private String maxDate;
    private Integer totalWeeks;

    public DateRangeResponse() {
    }

    public DateRangeResponse(String minDate, String maxDate, Integer totalWeeks) {
        this.minDate = minDate;
        this.maxDate = maxDate;
        this.totalWeeks = totalWeeks;
    }
}

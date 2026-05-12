package com.sjzm.dto;

import lombok.Data;
import java.io.Serializable;

@Data
public class ShopInfo implements Serializable {
    private String name;
    private Integer productCount;

    public ShopInfo() {
    }

    public ShopInfo(String name, Integer productCount) {
        this.name = name;
        this.productCount = productCount;
    }
}

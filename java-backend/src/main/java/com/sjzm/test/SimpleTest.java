package com.sjzm.test;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Data
public class SimpleTest {
    private String name;
    private Integer value;

    public static void main(String[] args) {
        SimpleTest test = new SimpleTest();
        test.setName("test");
        test.setValue(123);
        log.info("Name: {}, Value: {}", test.getName(), test.getValue());
    }
}

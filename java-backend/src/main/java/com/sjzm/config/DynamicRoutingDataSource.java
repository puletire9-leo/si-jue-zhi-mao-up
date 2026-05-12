package com.sjzm.config;

import org.springframework.jdbc.datasource.lookup.AbstractRoutingDataSource;

public class DynamicRoutingDataSource extends AbstractRoutingDataSource {

    private static final ThreadLocal<String> DATA_SOURCE_KEY = new ThreadLocal<>();

    public static void setDataSourceKey(String key) {
        DATA_SOURCE_KEY.set(key);
    }

    public static String getDataSourceKey() {
        return DATA_SOURCE_KEY.get();
    }

    public static void clearDataSourceKey() {
        DATA_SOURCE_KEY.remove();
    }

    @Override
    protected Object determineCurrentLookupKey() {
        String key = DATA_SOURCE_KEY.get();
        if (key == null) {
            return "master";
        }
        return key;
    }
}

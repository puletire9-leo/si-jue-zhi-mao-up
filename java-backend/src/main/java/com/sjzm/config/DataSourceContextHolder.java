package com.sjzm.config;

public class DataSourceContextHolder {
    
    private static final ThreadLocal<String> CONTEXT = new ThreadLocal<>();
    
    public static void setDataSourceType(String dataSourceType) {
        CONTEXT.set(dataSourceType);
    }
    
    public static String getDataSourceType() {
        return CONTEXT.get();
    }
    
    public static void clear() {
        CONTEXT.remove();
    }
}

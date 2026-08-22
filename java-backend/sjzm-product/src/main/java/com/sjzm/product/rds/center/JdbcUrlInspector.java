package com.sjzm.product.rds.center;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 解析 JDBC URL，供 RDS 管理中心展示。不返回密码。
 */
public final class JdbcUrlInspector {

    private static final Pattern MYSQL_URL = Pattern.compile(
            "^jdbc:mysql://([^:/]+)(?::(\\d+))?/([^?;]+)",
            Pattern.CASE_INSENSITIVE);

    private JdbcUrlInspector() {
    }

    public record Endpoint(String host, int port, String database, boolean remote) {
    }

    public static Endpoint parse(String jdbcUrl) {
        if (jdbcUrl == null || jdbcUrl.isBlank()) {
            return new Endpoint("", 0, "", false);
        }
        Matcher matcher = MYSQL_URL.matcher(jdbcUrl.trim());
        if (!matcher.find()) {
            return new Endpoint("", 0, "", false);
        }
        String host = matcher.group(1);
        int port = matcher.group(2) == null ? 3306 : Integer.parseInt(matcher.group(2));
        String database = matcher.group(3);
        return new Endpoint(host, port, database, looksRemote(host));
    }

    public static boolean looksRemote(String host) {
        if (host == null || host.isBlank()) {
            return false;
        }
        String normalized = host.toLowerCase(Locale.ROOT);
        if (normalized.contains("rds.aliyuncs.com")) {
            return true;
        }
        return !normalized.equals("mysql")
                && !normalized.equals("localhost")
                && !normalized.equals("127.0.0.1")
                && !normalized.equals("::1")
                && !normalized.endsWith(".local");
    }
}

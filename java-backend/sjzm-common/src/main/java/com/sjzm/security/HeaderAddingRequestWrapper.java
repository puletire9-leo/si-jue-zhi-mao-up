package com.sjzm.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;

import java.util.*;

public class HeaderAddingRequestWrapper extends HttpServletRequestWrapper {

    private final Map<String, String> extraHeaders = new HashMap<>();

    public HeaderAddingRequestWrapper(HttpServletRequest request, Long userId, String username, String role) {
        super(request);
        extraHeaders.put("X-User-Id", userId.toString());
        extraHeaders.put("X-Username", username != null ? username : "");
        extraHeaders.put("X-User-Role", role != null ? role : "");
    }

    @Override
    public String getHeader(String name) {
        String header = extraHeaders.get(name);
        if (header != null) {
            return header;
        }
        return super.getHeader(name);
    }

    @Override
    public Enumeration<String> getHeaders(String name) {
        String header = extraHeaders.get(name);
        if (header != null) {
            return Collections.enumeration(List.of(header));
        }
        return super.getHeaders(name);
    }

    @Override
    public Enumeration<String> getHeaderNames() {
        Set<String> names = new HashSet<>();
        Enumeration<String> originalNames = super.getHeaderNames();
        while (originalNames.hasMoreElements()) {
            names.add(originalNames.nextElement());
        }
        names.addAll(extraHeaders.keySet());
        return Collections.enumeration(names);
    }
}

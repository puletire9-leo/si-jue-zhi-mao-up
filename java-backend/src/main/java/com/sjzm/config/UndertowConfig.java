package com.sjzm.config;

import org.springframework.boot.web.embedded.undertow.UndertowServletWebServerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class UndertowConfig {

    @Bean
    public UndertowServletWebServerFactory undertowServletWebServerFactory() {
        UndertowServletWebServerFactory factory = new UndertowServletWebServerFactory();
        factory.addBuilderCustomizers(builder -> {
            builder.setServerOption(io.undertow.UndertowOptions.MAX_HEADERS, 1000);
            builder.setServerOption(io.undertow.UndertowOptions.MAX_PARAMETERS, 2000);
        });
        return factory;
    }
}

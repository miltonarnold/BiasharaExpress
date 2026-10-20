package com.biasharaexpress.backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class Jackson2Configuration {

    @Bean
    public ObjectMapper jackson2ObjectMapper() {
        return new ObjectMapper();
    }
}

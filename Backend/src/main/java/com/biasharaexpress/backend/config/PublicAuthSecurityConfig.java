package com.biasharaexpress.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class PublicAuthSecurityConfig {

    @Bean
    @Order(1)
    public SecurityFilterChain publicAuthSecurityFilterChain(
        HttpSecurity http
    ) throws Exception {
        http
            .securityMatcher(
                "/api/auth/login",
                "/api/auth/register"
            )
            .csrf(csrf -> csrf.disable())
            .cors(Customizer.withDefaults())
            .sessionManagement(session ->
                session.sessionCreationPolicy(
                    SessionCreationPolicy.STATELESS
                )
            )
            .formLogin(form -> form.disable())
            .httpBasic(basic -> basic.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    HttpMethod.POST,
                    "/api/auth/login",
                    "/api/auth/register"
                ).permitAll()
                .anyRequest().denyAll()
            );

        return http.build();
    }
}
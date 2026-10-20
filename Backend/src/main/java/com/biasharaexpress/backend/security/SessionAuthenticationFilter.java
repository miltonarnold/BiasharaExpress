package com.biasharaexpress.backend.security;

import com.biasharaexpress.backend.service.AuthService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Component
public class SessionAuthenticationFilter extends OncePerRequestFilter {
    private final AuthService authService;

    public SessionAuthenticationFilter(AuthService authService) {
        this.authService = authService;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);

        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7).trim();

            try {
                UUID accountId = authService.authenticateToken(token);

                var authentication =
                    new UsernamePasswordAuthenticationToken(
                        accountId.toString(),
                        null,
                        List.of()
                    );

                SecurityContextHolder.getContext()
                    .setAuthentication(authentication);
            } catch (ResponseStatusException exception) {
                SecurityContextHolder.clearContext();
                response.sendError(
                    HttpServletResponse.SC_UNAUTHORIZED,
                    "Session is invalid or expired."
                );
                return;
            }
        }

        try {
            filterChain.doFilter(request, response);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}

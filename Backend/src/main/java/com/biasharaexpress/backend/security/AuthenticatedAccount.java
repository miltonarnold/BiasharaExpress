package com.biasharaexpress.backend.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.util.UUID;

public final class AuthenticatedAccount {
    private AuthenticatedAccount() {}

    public static UUID requireId() {
        Authentication authentication =
            SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null
                || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof String principal)) {
            throw new ResponseStatusException(
                HttpStatus.UNAUTHORIZED, "Authentication required."
            );
        }

        try {
            return UUID.fromString(principal);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(
                HttpStatus.UNAUTHORIZED, "Invalid authenticated account."
            );
        }
    }
}

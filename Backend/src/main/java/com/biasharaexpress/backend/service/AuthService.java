package com.biasharaexpress.backend.service;

import com.biasharaexpress.backend.dto.AuthResponse;
import com.biasharaexpress.backend.dto.LoginRequest;
import com.biasharaexpress.backend.dto.RegisterRequest;
import com.biasharaexpress.backend.entity.AccountSession;
import com.biasharaexpress.backend.entity.BusinessAccount;
import com.biasharaexpress.backend.repository.AccountSessionRepository;
import com.biasharaexpress.backend.repository.BusinessAccountRepository;
import com.biasharaexpress.backend.security.SessionTokenService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.UUID;

@Service
public class AuthService {
    private static final int SESSION_DAYS = 30;

    private final BusinessAccountRepository accounts;
    private final AccountSessionRepository sessions;
    private final PasswordEncoder passwordEncoder;
    private final SessionTokenService tokenService;

    public AuthService(
        BusinessAccountRepository accounts,
        AccountSessionRepository sessions,
        PasswordEncoder passwordEncoder,
        SessionTokenService tokenService
    ) {
        this.accounts = accounts;
        this.sessions = sessions;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());

        if (accounts.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "An account with this email already exists."
            );
        }

        String preference = request.displayPreference().trim();
        if (!preference.equalsIgnoreCase("owner")
                && !preference.equalsIgnoreCase("business")) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Display preference must be owner or business."
            );
        }

        BusinessAccount account = new BusinessAccount(
            request.businessName().trim(),
            request.ownerName().trim(),
            email,
            preference.toLowerCase(Locale.ROOT),
            passwordEncoder.encode(request.password())
        );

        accounts.saveAndFlush(account);
        return createSession(account);
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String email = normalizeEmail(request.email());

        BusinessAccount account = accounts.findByEmailIgnoreCase(email)
            .orElseThrow(this::invalidCredentials);

        if (!passwordEncoder.matches(
                request.password(), account.getPasswordHash())) {
            throw invalidCredentials();
        }

        return createSession(account);
    }

    @Transactional(readOnly = true)
    public UUID authenticateToken(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new ResponseStatusException(
                HttpStatus.UNAUTHORIZED, "Authentication required."
            );
        }

        String tokenHash = tokenService.hashToken(rawToken);

        AccountSession session = sessions
            .findByTokenHashAndRevokedAtIsNull(tokenHash)
            .filter(item -> item.getExpiresAt().isAfter(Instant.now()))
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.UNAUTHORIZED,
                "Session is invalid or expired."
            ));

        return session.getAccountId();
    }

    @Transactional
    public void logout(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }

        sessions.findByTokenHashAndRevokedAtIsNull(
            tokenService.hashToken(rawToken)
        ).ifPresent(session -> {
            session.revoke();
            sessions.save(session);
        });
    }

    private AuthResponse createSession(BusinessAccount account) {
        String token = tokenService.generateToken();
        Instant expiresAt = Instant.now().plus(SESSION_DAYS, ChronoUnit.DAYS);

        sessions.save(new AccountSession(
            account.getId(),
            tokenService.hashToken(token),
            expiresAt
        ));

        return new AuthResponse(
            token,
            expiresAt,
            new AuthResponse.AccountResponse(
                account.getId(),
                account.getBusinessName(),
                account.getOwnerName(),
                account.getEmail(),
                account.getDisplayPreference()
            )
        );
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private ResponseStatusException invalidCredentials() {
        return new ResponseStatusException(
            HttpStatus.UNAUTHORIZED,
            "Email or password is incorrect."
        );
    }
}

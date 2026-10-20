package com.biasharaexpress.backend.dto;

import java.time.Instant;
import java.util.UUID;

public record AuthResponse(
    String token,
    Instant expiresAt,
    AccountResponse account
) {
    public record AccountResponse(
        UUID id,
        String businessName,
        String ownerName,
        String email,
        String displayPreference
    ) {}
}

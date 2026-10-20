package com.biasharaexpress.backend.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
    name = "account_sessions",
    indexes = @Index(
        name = "idx_account_session_account",
        columnList = "accountId"
    ),
    uniqueConstraints = @UniqueConstraint(
        name = "uk_account_session_token_hash",
        columnNames = "tokenHash"
    )
)
public class AccountSession {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID accountId;

    @Column(nullable = false, length = 64)
    private String tokenHash;

    @Column(nullable = false)
    private Instant expiresAt;

    private Instant revokedAt;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected AccountSession() {}

    public AccountSession(
        UUID accountId,
        String tokenHash,
        Instant expiresAt
    ) {
        this.accountId = accountId;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getAccountId() { return accountId; }
    public String getTokenHash() { return tokenHash; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getRevokedAt() { return revokedAt; }

    public void revoke() {
        revokedAt = Instant.now();
    }
}

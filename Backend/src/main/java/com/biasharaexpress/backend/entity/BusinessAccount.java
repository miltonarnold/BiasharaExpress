package com.biasharaexpress.backend.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
    name = "business_accounts",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_business_account_email",
        columnNames = "email"
    )
)
public class BusinessAccount {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 80)
    private String businessName;

    @Column(nullable = false, length = 60)
    private String ownerName;

    @Column(nullable = false, length = 254)
    private String email;

    @Column(nullable = false, length = 20)
    private String displayPreference;

    @Column(nullable = false, length = 100)
    private String passwordHash;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected BusinessAccount() {}

    public BusinessAccount(
        String businessName,
        String ownerName,
        String email,
        String displayPreference,
        String passwordHash
    ) {
        this.businessName = businessName;
        this.ownerName = ownerName;
        this.email = email;
        this.displayPreference = displayPreference;
        this.passwordHash = passwordHash;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public String getBusinessName() { return businessName; }
    public String getOwnerName() { return ownerName; }
    public String getEmail() { return email; }
    public String getDisplayPreference() { return displayPreference; }
    public String getPasswordHash() { return passwordHash; }
    public Instant getCreatedAt() { return createdAt; }
}

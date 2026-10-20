package com.biasharaexpress.backend.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
    name = "sync_records",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_sync_account_entity_record",
        columnNames = {"account_id", "entity_type", "record_id"}
    ),
    indexes = @Index(
        name = "idx_sync_account_entity_updated",
        columnList = "account_id,entity_type,updated_at"
    )
)
public class SyncRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "account_id", nullable = false, updatable = false)
    private UUID accountId;

    @Column(name = "entity_type", nullable = false, length = 60)
    private String entityType;

    @Column(name = "record_id", nullable = false, length = 200)
    private String recordId;

    @Column(nullable = false, columnDefinition = "text")
    private String payload;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected SyncRecord() {}

    public SyncRecord(
        UUID accountId,
        String entityType,
        String recordId,
        String payload
    ) {
        this.accountId = accountId;
        this.entityType = entityType;
        this.recordId = recordId;
        this.payload = payload;
    }

    @PrePersist
    @PreUpdate
    void updateTimestamp() {
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getAccountId() { return accountId; }
    public String getEntityType() { return entityType; }
    public String getRecordId() { return recordId; }
    public String getPayload() { return payload; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void setPayload(String payload) {
        this.payload = payload;
    }
}

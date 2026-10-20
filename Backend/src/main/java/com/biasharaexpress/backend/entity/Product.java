package com.biasharaexpress.backend.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "products", indexes = {
    @Index(name = "idx_products_account_name", columnList = "account_id,name")
})
public class Product {
    @Id
    @Column(nullable = false, length = 200)
    private String id;

    @Column(name = "account_id", nullable = false, updatable = false)
    private UUID accountId;

    @NotBlank
    @Size(max = 150)
    @Column(nullable = false, length = 150)
    private String name;

    @Size(max = 80)
    @Column(length = 80)
    private String category;

    @NotBlank
    @Size(max = 30)
    @Column(nullable = false, length = 30)
    private String unit = "piece";

    @NotNull
    @DecimalMin("0.0")
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal cost = BigDecimal.ZERO;

    @NotNull
    @DecimalMin("0.0")
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal price = BigDecimal.ZERO;

    @NotNull
    @DecimalMin("0.0")
    @Column(nullable = false, precision = 14, scale = 3)
    private BigDecimal stock = BigDecimal.ZERO;

    @NotNull
    @DecimalMin("0.0")
    @Column(nullable = false, precision = 14, scale = 3)
    private BigDecimal lowStock = BigDecimal.ZERO;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @Version
    private long version;

    protected Product() {}

    @PrePersist
    void onCreate() {
        if (id == null || id.isBlank()) {
            id = UUID.randomUUID().toString();
        }
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getAccountId() { return accountId; }
    public void setAccountId(UUID accountId) { this.accountId = accountId; }
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public BigDecimal getCost() { return cost; }
    public void setCost(BigDecimal cost) { this.cost = cost; }
    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }
    public BigDecimal getStock() { return stock; }
    public void setStock(BigDecimal stock) { this.stock = stock; }
    public BigDecimal getLowStock() { return lowStock; }
    public void setLowStock(BigDecimal lowStock) { this.lowStock = lowStock; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public long getVersion() { return version; }
}

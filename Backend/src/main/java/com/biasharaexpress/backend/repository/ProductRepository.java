package com.biasharaexpress.backend.repository;

import com.biasharaexpress.backend.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProductRepository extends JpaRepository<Product, String> {
    List<Product> findByAccountIdAndActiveTrueOrderByNameAsc(UUID accountId);

    List<Product> findByAccountIdAndNameContainingIgnoreCaseAndActiveTrueOrderByNameAsc(
        UUID accountId, String name
    );

    Optional<Product> findByIdAndAccountId(String id, UUID accountId);

    boolean existsByIdAndAccountId(String id, UUID accountId);
}

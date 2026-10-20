package com.biasharaexpress.backend.repository;

import com.biasharaexpress.backend.entity.BusinessAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface BusinessAccountRepository
        extends JpaRepository<BusinessAccount, UUID> {
    Optional<BusinessAccount> findByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCase(String email);
}

package com.biasharaexpress.backend.repository;

import com.biasharaexpress.backend.entity.AccountSession;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface AccountSessionRepository
        extends JpaRepository<AccountSession, UUID> {
    Optional<AccountSession> findByTokenHashAndRevokedAtIsNull(
        String tokenHash
    );
}

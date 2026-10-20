package com.biasharaexpress.backend.repository;

import com.biasharaexpress.backend.entity.SyncRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SyncRecordRepository
        extends JpaRepository<SyncRecord, UUID> {

    Optional<SyncRecord> findByAccountIdAndEntityTypeAndRecordId(
        UUID accountId, String entityType, String recordId
    );

    List<SyncRecord> findByAccountIdAndEntityTypeOrderByUpdatedAtAsc(
        UUID accountId, String entityType
    );

    void deleteByAccountIdAndEntityTypeAndRecordId(
        UUID accountId, String entityType, String recordId
    );
}

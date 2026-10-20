package com.biasharaexpress.backend.service;

import com.biasharaexpress.backend.dto.SyncRecordResponse;
import com.biasharaexpress.backend.entity.SyncRecord;
import com.biasharaexpress.backend.repository.SyncRecordRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;

@Service
public class SyncRecordService {
    private final SyncRecordRepository repository;
    private final ObjectMapper objectMapper;

    public SyncRecordService(
        SyncRecordRepository repository,
        ObjectMapper objectMapper
    ) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<SyncRecordResponse> findAll(
        UUID accountId, String entityType
    ) {
        return repository
            .findByAccountIdAndEntityTypeOrderByUpdatedAtAsc(
                accountId, entityType
            )
            .stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional
    public SyncRecordResponse save(
        UUID accountId,
        String entityType,
        String recordId,
        JsonNode payload
    ) {
        if (payload == null || payload.isNull()) {
            throw new IllegalArgumentException(
                "A JSON payload is required."
            );
        }

        String json;
        try {
            json = objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException(
                "The payload could not be encoded as JSON.", exception
            );
        }

        SyncRecord record = repository
            .findByAccountIdAndEntityTypeAndRecordId(
                accountId, entityType, recordId
            )
            .orElseGet(() -> new SyncRecord(
                accountId, entityType, recordId, json
            ));

        record.setPayload(json);
        return toResponse(repository.save(record));
    }

    @Transactional
    public void delete(
        UUID accountId, String entityType, String recordId
    ) {
        repository.deleteByAccountIdAndEntityTypeAndRecordId(
            accountId, entityType, recordId
        );
    }

    private SyncRecordResponse toResponse(SyncRecord record) {
        try {
            return new SyncRecordResponse(
                record.getEntityType(),
                record.getRecordId(),
                objectMapper.readTree(record.getPayload()),
                record.getUpdatedAt()
            );
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException(
                "Stored synchronization data is not valid JSON.", exception
            );
        }
    }
}

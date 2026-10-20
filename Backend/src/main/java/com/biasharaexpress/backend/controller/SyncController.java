package com.biasharaexpress.backend.controller;

import com.biasharaexpress.backend.dto.SyncRecordResponse;
import com.biasharaexpress.backend.security.AuthenticatedAccount;
import com.biasharaexpress.backend.service.SyncRecordService;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/sync")
public class SyncController {
    private static final Set<String> ALLOWED_TYPES = Set.of(
        "products", "customers", "suppliers", "sales",
        "purchases", "debts", "repayments", "finance"
    );

    private final SyncRecordService service;

    public SyncController(SyncRecordService service) {
        this.service = service;
    }

    @GetMapping("/{entityType}")
    public List<SyncRecordResponse> getRecords(
        @PathVariable String entityType
    ) {
        validateEntityType(entityType);
        return service.findAll(
            AuthenticatedAccount.requireId(), entityType
        );
    }

    @PutMapping("/{entityType}/{recordId}")
    public SyncRecordResponse saveRecord(
        @PathVariable String entityType,
        @PathVariable String recordId,
        @RequestBody JsonNode payload
    ) {
        validateEntityType(entityType);
        validateRecordId(recordId);
        return service.save(
            AuthenticatedAccount.requireId(),
            entityType, recordId, payload
        );
    }

    @DeleteMapping("/{entityType}/{recordId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRecord(
        @PathVariable String entityType,
        @PathVariable String recordId
    ) {
        validateEntityType(entityType);
        validateRecordId(recordId);
        service.delete(
            AuthenticatedAccount.requireId(), entityType, recordId
        );
    }

    private void validateEntityType(String entityType) {
        if (!ALLOWED_TYPES.contains(entityType)) {
            throw new IllegalArgumentException(
                "Unsupported synchronization type."
            );
        }
    }

    private void validateRecordId(String recordId) {
        if (recordId == null || recordId.isBlank()
                || recordId.length() > 200) {
            throw new IllegalArgumentException(
                "A valid record ID is required."
            );
        }
    }
}

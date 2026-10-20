package com.biasharaexpress.backend.controller;

import com.biasharaexpress.backend.dto.SyncBatchResponse;
import com.biasharaexpress.backend.dto.SyncQueueItemRequest;
import com.biasharaexpress.backend.security.AuthenticatedAccount;
import com.biasharaexpress.backend.service.SyncRecordService;
import org.springframework.web.bind.annotation.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/sync")
public class SyncBatchController {
    private static final Set<String> ALLOWED_TYPES = Set.of(
        "products", "customers", "suppliers", "sales",
        "purchases", "debts", "repayments", "finance"
    );

    private final SyncRecordService service;

    public SyncBatchController(SyncRecordService service) {
        this.service = service;
    }

    @PostMapping("/batch")
    public SyncBatchResponse synchronize(
        @RequestBody List<SyncQueueItemRequest> items
    ) {
        if (items == null || items.isEmpty() || items.size() > 500) {
            throw new IllegalArgumentException(
                "Submit between 1 and 500 synchronization items."
            );
        }

        UUID accountId = AuthenticatedAccount.requireId();
        List<String> syncedIds = new ArrayList<>();
        List<SyncBatchResponse.SyncFailure> failures = new ArrayList<>();

        for (SyncQueueItemRequest item : items) {
            String itemId = item == null ? null : item.id();

            try {
                validate(item);

                if ("delete".equals(item.operation())) {
                    service.delete(
                        accountId, item.entity(), item.recordId()
                    );
                } else {
                    service.save(
                        accountId, item.entity(),
                        item.recordId(), item.payload()
                    );
                }

                syncedIds.add(itemId);
            } catch (Exception exception) {
                failures.add(new SyncBatchResponse.SyncFailure(
                    itemId, "Synchronization failed. Check the item and retry."
                ));
            }
        }

        return new SyncBatchResponse(syncedIds, failures);
    }

    private void validate(SyncQueueItemRequest item) {
        if (item == null) {
            throw new IllegalArgumentException("Queue item is required.");
        }

        if (item.id() == null || item.id().isBlank()) {
            throw new IllegalArgumentException("Queue item ID is required.");
        }

        if (item.entity() == null || !ALLOWED_TYPES.contains(item.entity())) {
            throw new IllegalArgumentException("Unsupported entity type.");
        }

        if (item.recordId() == null || item.recordId().isBlank()
                || item.recordId().length() > 200) {
            throw new IllegalArgumentException("Invalid record ID.");
        }

        if (!"upsert".equals(item.operation())
                && !"delete".equals(item.operation())) {
            throw new IllegalArgumentException("Unsupported operation.");
        }

        if ("upsert".equals(item.operation())
                && (item.payload() == null || item.payload().isNull())) {
            throw new IllegalArgumentException(
                "Payload is required for upsert."
            );
        }
    }
}

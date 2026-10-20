package com.biasharaexpress.backend.dto;

import java.util.List;

public record SyncBatchResponse(
    List<String> syncedIds,
    List<SyncFailure> failures
) {
    public record SyncFailure(String id, String error) {}
}

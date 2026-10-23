package com.biasharaexpress.backend.dto;

public record SyncQueueItemRequest(
    String id,
    String entity,
    String recordId,
    String operation,
    Object payload
) {}

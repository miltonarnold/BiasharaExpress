package com.biasharaexpress.backend.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record SyncQueueItemRequest(
    String id,
    String entity,
    String recordId,
    String operation,
    JsonNode payload
) {}

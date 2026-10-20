package com.biasharaexpress.backend.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;

public record SyncRecordResponse(
    String entityType,
    String recordId,
    JsonNode payload,
    Instant updatedAt
) {}

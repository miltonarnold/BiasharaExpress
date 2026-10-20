package com.biasharaexpress.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
    @NotBlank @Size(max = 80) String businessName,
    @NotBlank @Size(max = 60) String ownerName,
    @NotBlank @Email @Size(max = 254) String email,
    @NotBlank @Size(min = 8, max = 72) String password,
    @NotBlank @Size(max = 20) String displayPreference
) {}

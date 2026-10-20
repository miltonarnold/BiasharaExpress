package com.biasharaexpress.backend.exception;

import com.biasharaexpress.backend.dto.ApiErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.time.Instant;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiErrorResponse> handleBadRequest(
        IllegalArgumentException exception,
        HttpServletRequest request
    ) {
        return build(
            HttpStatus.BAD_REQUEST,
            exception.getMessage(),
            request
        );
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(
        MethodArgumentNotValidException exception,
        HttpServletRequest request
    ) {
        String message = exception.getBindingResult()
            .getFieldErrors()
            .stream()
            .map(error -> error.getField() + ": " + error.getDefaultMessage())
            .distinct()
            .collect(Collectors.joining("; "));

        return build(HttpStatus.BAD_REQUEST, message, request);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> handleUnreadableBody(
        HttpMessageNotReadableException exception,
        HttpServletRequest request
    ) {
        return build(
            HttpStatus.BAD_REQUEST,
            "The request body is missing or contains invalid JSON.",
            request
        );
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleConflict(
        DataIntegrityViolationException exception,
        HttpServletRequest request
    ) {
        return build(
            HttpStatus.CONFLICT,
            "The request conflicts with existing database data.",
            request
        );
    }

    private ResponseEntity<ApiErrorResponse> build(
        HttpStatus status,
        String message,
        HttpServletRequest request
    ) {
        ApiErrorResponse body = new ApiErrorResponse(
            Instant.now(),
            status.value(),
            status.getReasonPhrase(),
            message == null || message.isBlank()
                ? status.getReasonPhrase()
                : message,
            request.getRequestURI()
        );

        return ResponseEntity.status(status).body(body);
    }
}

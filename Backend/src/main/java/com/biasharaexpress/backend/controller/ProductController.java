package com.biasharaexpress.backend.controller;

import com.biasharaexpress.backend.entity.Product;
import com.biasharaexpress.backend.security.AuthenticatedAccount;
import com.biasharaexpress.backend.service.ProductService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/products")
public class ProductController {
    private final ProductService service;

    public ProductController(ProductService service) {
        this.service = service;
    }

    @GetMapping
    public List<Product> getProducts(
        @RequestParam(required = false) String search
    ) {
        return service.findAll(AuthenticatedAccount.requireId(), search);
    }

    @GetMapping("/{id}")
    public Product getProduct(@PathVariable String id) {
        return service.findById(AuthenticatedAccount.requireId(), id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Product createProduct(@Valid @RequestBody Product product) {
        return service.create(AuthenticatedAccount.requireId(), product);
    }

    @PutMapping("/{id}")
    public Product updateProduct(
        @PathVariable String id,
        @Valid @RequestBody Product product
    ) {
        return service.update(AuthenticatedAccount.requireId(), id, product);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivateProduct(@PathVariable String id) {
        service.deactivate(AuthenticatedAccount.requireId(), id);
    }
}

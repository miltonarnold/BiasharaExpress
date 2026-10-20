package com.biasharaexpress.backend.service;

import com.biasharaexpress.backend.entity.Product;
import com.biasharaexpress.backend.repository.ProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class ProductService {
    private final ProductRepository repository;

    public ProductService(ProductRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<Product> findAll(UUID accountId, String search) {
        if (search == null || search.isBlank()) {
            return repository.findByAccountIdAndActiveTrueOrderByNameAsc(accountId);
        }

        return repository
            .findByAccountIdAndNameContainingIgnoreCaseAndActiveTrueOrderByNameAsc(
                accountId, search.trim()
            );
    }

    @Transactional(readOnly = true)
    public Product findById(UUID accountId, String id) {
        Product product = repository.findByIdAndAccountId(id, accountId)
            .orElseThrow(() ->
                new IllegalArgumentException("Product not found.")
            );

        if (!product.isActive()) {
            throw new IllegalArgumentException("Product not found.");
        }

        return product;
    }

    public Product create(UUID accountId, Product product) {
        if (product.getId() == null || product.getId().isBlank()) {
            product.setId(UUID.randomUUID().toString());
        }

        if (repository.existsByIdAndAccountId(product.getId(), accountId)) {
            throw new IllegalArgumentException(
                "A product with this ID already exists in this account."
            );
        }

        // Product IDs are globally unique in the database.
        // Generate a new ID if the supplied ID belongs to another account.
        if (repository.existsById(product.getId())) {
            product.setId(UUID.randomUUID().toString());
        }

        product.setAccountId(accountId);
        return repository.save(product);
    }

    public Product update(UUID accountId, String id, Product input) {
        Product product = findById(accountId, id);

        product.setName(input.getName());
        product.setCategory(input.getCategory());
        product.setUnit(input.getUnit());
        product.setCost(input.getCost());
        product.setPrice(input.getPrice());
        product.setStock(input.getStock());
        product.setLowStock(input.getLowStock());

        return repository.save(product);
    }

    public void deactivate(UUID accountId, String id) {
        Product product = findById(accountId, id);
        product.setActive(false);
        repository.save(product);
    }
}

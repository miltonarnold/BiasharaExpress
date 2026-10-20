(() => {
    "use strict";

    const KEY = "biasharaExpressProducts";
    const $ = id => document.getElementById(id);
    let products = [];

    function loadProducts() {
        try {
            const value = JSON.parse(localStorage.getItem(KEY) || "[]");
            return Array.isArray(value) ? value : [];
        } catch {
            return [];
        }
    }

    async function initializeInventory() {
        try {
            const db = window.BiasharaSQLite;
            if (!db) throw new Error("SQLite adapter is unavailable.");

            await db.init();

            // Keep compatibility with sales and purchases until their
            // storage operations are integrated with SQLite.
            products = loadProducts();

            await db.put(KEY, products, {
                sync: false,
                entity: "products",
                recordId: KEY
            });
        } catch (error) {
            console.error("Inventory SQLite initialization failed:", error);
            products = loadProducts();
            notify("SQLite could not load. Check the database before saving changes.", "error");
        }

        render();
    }

    const money = value => "KSh " + Number(value || 0).toLocaleString("en-KE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    async function saveProducts() {
        const db = window.BiasharaSQLite;
        if (!db) throw new Error("SQLite adapter is unavailable.");

        await db.put(KEY, products, {
            sync: true,
            entity: "products",
            recordId: KEY
        });

        localStorage.setItem(KEY, JSON.stringify(products));
    }

    function notify(message, type = "success") {
        $("inventoryNotice").textContent = message;
        $("inventoryNotice").className = "inventory-notice " + type;
    }

    function render() {
        const search = $("inventorySearch").value.trim().toLowerCase();
        const filtered = products.filter(product =>
            product.name.toLowerCase().includes(search) ||
            product.category.toLowerCase().includes(search)
        );

        $("inventoryProductCount").textContent = products.length;
        $("inventoryUnitCount").textContent = products.reduce(
            (sum, product) => sum + product.stock, 0
        ).toLocaleString("en-KE");

        $("inventoryLowCount").textContent = products.filter(
            product => product.stock <= product.lowStock
        ).length;

        const tbody = $("inventoryRows");
        tbody.replaceChildren();

        if (!filtered.length) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 7;
            cell.className = "inventory-empty";
            cell.textContent = search
                ? "No matching products found."
                : "No products added yet.";
            return;
        }

        filtered.forEach(product => {
            const row = tbody.insertRow();

            [
                product.name,
                product.category || "—",
                `${product.stock} ${product.unit}`,
                money(product.cost),
                money(product.price)
            ].forEach(value => {
                row.insertCell().textContent = value;
            });

            const statusCell = row.insertCell();
            const status = document.createElement("span");
            const isLow = product.stock <= product.lowStock;
            status.className = "inventory-status" + (isLow ? " inventory-low" : "");
            status.textContent = isLow ? "Low stock" : "In stock";
            statusCell.appendChild(status);

            const actions = row.insertCell();

            const edit = document.createElement("button");
            edit.type = "button";
            edit.className = "inventory-action";
            edit.textContent = "Edit";
            edit.addEventListener("click", () => editProduct(product.id));

            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "inventory-action inventory-delete";
            remove.textContent = "Delete";
            remove.addEventListener("click", () => deleteProduct(product.id));

            actions.append(edit, remove);
        });
    }

    function resetForm() {
        $("inventoryForm").reset();
        $("inventoryEditId").value = "";
        $("inventoryFormTitle").textContent = "Add a product";
        $("inventorySaveButton").textContent = "Save product";
        $("inventoryCancelButton").hidden = true;
        $("inventoryUnit").value = "pcs";
        $("inventoryLowStock").value = "5";
    }

    function editProduct(id) {
        const product = products.find(item => item.id === id);
        if (!product) return;

        $("inventoryEditId").value = product.id;
        $("inventoryName").value = product.name;
        $("inventoryCategory").value = product.category;
        $("inventoryUnit").value = product.unit;
        $("inventoryCost").value = product.cost;
        $("inventoryPrice").value = product.price;
        $("inventoryStock").value = product.stock;
        $("inventoryLowStock").value = product.lowStock;

        $("inventoryFormTitle").textContent = "Edit product";
        $("inventorySaveButton").textContent = "Update product";
        $("inventoryCancelButton").hidden = false;
        $("inventoryForm").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    async function deleteProduct(id) {
        const product = products.find(item => item.id === id);
        if (!product) return;

        if (!confirm(`Delete "${product.name}" from your product list?`)) return;

        const previous = products;
        products = products.filter(item => item.id !== id);

        try {
            await saveProducts();
            if ($("inventoryEditId").value === id) resetForm();
            render();
            notify("Product deleted.");
        } catch {
            products = previous;
            notify("Could not save the change. Browser storage may be full.", "error");
        }
    }

    $("inventoryForm").addEventListener("submit", async event => {
        event.preventDefault();

        const name = $("inventoryName").value.trim();
        const category = $("inventoryCategory").value.trim();
        const unit = $("inventoryUnit").value;
        const cost = Number($("inventoryCost").value);
        const price = Number($("inventoryPrice").value);
        const stock = Number($("inventoryStock").value);
        const lowStock = Number($("inventoryLowStock").value);
        const editId = $("inventoryEditId").value;

        if (!name || !Number.isFinite(cost) || cost < 0 ||
            !Number.isFinite(price) || price <= 0 ||
            !Number.isFinite(stock) || stock < 0 ||
            !Number.isFinite(lowStock) || lowStock < 0) {
            notify("Check the product details and enter valid amounts.", "error");
            return;
        }

        if (products.some(item =>
            item.name.toLowerCase() === name.toLowerCase() && item.id !== editId
        )) {
            notify("A product with this name already exists.", "error");
            return;
        }

        const previous = products;

        if (editId) {
            products = products.map(item => item.id === editId
                ? { ...item, name, category, unit, cost, price, stock, lowStock }
                : item
            );
        } else {
            products.push({
                id: "PROD-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
                name, category, unit, cost, price, stock, lowStock
            });
        }

        try {
            await saveProducts();
            resetForm();
            render();
            notify(editId ? "Product updated successfully." : "Product added successfully.");
        } catch {
            products = previous;
            notify("Could not save the product. Check available browser storage.", "error");
        }
    });

    $("inventoryCancelButton").addEventListener("click", resetForm);
    $("inventorySearch").addEventListener("input", render);

    $("inventoryExportButton").addEventListener("click", () => {
        const headings = [
            "Product", "Category", "Unit", "Cost", "Selling Price",
            "Stock", "Low Stock Level"
        ];

        const escapeCsv = value =>
            '"' + String(value ?? "").replace(/"/g, '""') + '"';

        const rows = products.map(product => [
            product.name, product.category, product.unit, product.cost,
            product.price, product.stock, product.lowStock
        ]);

        const csv = [headings, ...rows]
            .map(row => row.map(escapeCsv).join(","))
            .join("\r\n");

        const blob = new Blob(["\uFEFF" + csv], {
            type: "text/csv;charset=utf-8;"
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "biasharaexpress-products.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        notify("Product list exported.");
    });

    initializeInventory();
})();



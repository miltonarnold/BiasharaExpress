(() => {
    "use strict";

    const SALES_KEY = "biasharaExpressSales";
    const PRODUCTS_KEY = "biasharaExpressProducts";
    const DEBTS_KEY = "biasharaExpressDebts";
    const $ = id => document.getElementById(id);

    let cart = [];
    let products = [];
    let databaseReady = false;

    const money = value =>
        "KSh " + Number(value || 0).toLocaleString("en-KE", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

    function readArray(key) {
        const raw = localStorage.getItem(key);
        if (raw === null) return [];

        const value = JSON.parse(raw);
        if (!Array.isArray(value)) {
            throw new Error("Invalid stored data: " + key);
        }
        return value;
    }

    function makeId(prefix) {
        return prefix + "-" + Date.now() + "-" +
            Math.random().toString(36).slice(2, 9);
    }

    function today() {
        const date = new Date();
        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0")
        ].join("-");
    }

    function notify(message, type = "success") {
        const notice = $("salesNotice");
        notice.textContent = message;
        notice.className = "sales-notice " + type;
    }

    function getProduct(id) {
        return products.find(product => product.id === id);
    }

    function quantityInCart(productId) {
        return cart
            .filter(item => item.productId === productId)
            .reduce((sum, item) => sum + item.quantity, 0);
    }

    function total() {
        return cart.reduce(
            (sum, item) => sum + item.price * item.quantity, 0
        );
    }

    function renderProductOptions() {
        const select = $("productName");
        const previous = select.value;

        select.replaceChildren();
        select.add(new Option("Choose an inventory product", ""));

        products.forEach(product => {
            const option = new Option(
                `${product.name} — Stock: ${Number(product.stock)} ${product.unit || ""}`,
                product.id
            );
            select.add(option);
        });

        if (products.some(product => product.id === previous)) {
            select.value = previous;
        }

        updateSelectedProduct();
    }

    function updateSelectedProduct() {
        const product = getProduct($("productName").value);
        $("productPrice").value = product ? Number(product.price) : "";
        $("productCost").value = product ? Number(product.cost) : "";
    }

    function updateChange() {
        const credit = $("paymentMethod").value === "Credit";
        const amountInput = $("amountPaid");
        amountInput.disabled = credit;
        amountInput.required = !credit;

        const received = Number(amountInput.value) || 0;
        $("saleChange").textContent = money(
            credit ? 0 : Math.max(0, received - total())
        );
    }

    function render() {
        const tbody = $("cartItems");
        tbody.replaceChildren();

        if (!cart.length) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 5;
            cell.className = "sales-empty";
            cell.textContent = "Your cart is empty. Add a product to begin.";
        } else {
            cart.forEach((item, index) => {
                const row = tbody.insertRow();

                [
                    item.name,
                    item.quantity,
                    money(item.price),
                    money(item.price * item.quantity)
                ].forEach(value => {
                    row.insertCell().textContent = value;
                });

                const action = row.insertCell();
                const button = document.createElement("button");
                button.type = "button";
                button.className = "sales-remove";
                button.textContent = "×";
                button.setAttribute("aria-label", "Remove " + item.name);
                button.addEventListener("click", () => {
                    cart.splice(index, 1);
                    render();
                });
                action.appendChild(button);
            });
        }

        $("saleSubtotal").textContent = money(total());
        $("saleTotal").textContent = money(total());
        $("saleItemCount").textContent =
            cart.reduce((sum, item) => sum + item.quantity, 0);

        updateChange();
    }

    function renderHistory() {
        const container = $("salesHistory");
        container.replaceChildren();

        const sales = readArray(SALES_KEY).slice().reverse().slice(0, 10);

        if (!sales.length) {
            const empty = document.createElement("p");
            empty.className = "sales-empty";
            empty.textContent = "No sales recorded yet.";
            container.appendChild(empty);
            return;
        }

        sales.reverse().forEach(sale => {
            const item = document.createElement("div");
            item.className = "sales-history-item";

            const details = document.createElement("div");
            const name = document.createElement("strong");
            name.textContent = sale.customer || "Walk-in customer";

            const description = document.createElement("small");
            description.textContent =
                `${sale.date || "—"} · ${sale.paymentMethod || "—"} · ${sale.id}`;

            details.append(name, description);

            const amount = document.createElement("strong");
            amount.textContent = money(sale.total);

            item.append(details, amount);
            container.appendChild(item);
        });
    }

    function addToCart(event) {
        event.preventDefault();

        const product = getProduct($("productName").value);
        const quantity = Number($("productQuantity").value);
        const price = Number($("productPrice").value);

        if (!product) {
            notify("Select a product from inventory first.", "error");
            return;
        }

        const stock = Number(product.stock);
        const cost = Number(product.cost);

        if (!Number.isFinite(stock) || stock < 0 ||
            !Number.isFinite(cost) || cost < 0 ||
            !Number.isFinite(Number(product.price)) ||
            Number(product.price) <= 0) {
            notify(
                "This product has invalid stock, cost or selling-price data. Correct it in Products & Inventory.",
                "error"
            );
            return;
        }

        if (!Number.isFinite(quantity) || quantity <= 0 ||
            !Number.isFinite(price) || price <= 0) {
            notify("Enter a valid quantity and selling price.", "error");
            return;
        }

        if (quantity + quantityInCart(product.id) > stock + 0.000001) {
            notify(
                `Insufficient stock. Available: ${Math.max(0, stock - quantityInCart(product.id))} ${product.unit || "units"}.`,
                "error"
            );
            return;
        }

        cart.push({
            productId: product.id,
            name: product.name,
            unit: product.unit || "",
            quantity,
            price,
            cost
        });

        render();
        $("productQuantity").value = "1";
        notify("Product added to cart.");
    }

    async function completeSale() {
        if (!databaseReady) {
            notify("SQLite is not ready. No sale was saved. Please wait and try again.", "error");
            return;
        }

        if (!cart.length) {
            notify("Add a product before completing the sale.", "error");
            return;
        }

        let currentProducts;
        let sales;
        let debts;

        try {
            currentProducts = readArray(PRODUCTS_KEY);
            sales = readArray(SALES_KEY);
            debts = readArray(DEBTS_KEY);
        } catch (error) {
            notify(
                "Stored records could not be read safely. No sale was saved. Check browser data before continuing.",
                "error"
            );
            return;
        }

        const saleTotal = total();
        const paymentMethod = $("paymentMethod").value;
        const customer = $("customerName").value.trim();
        const date = $("saleDate").value;
        const received = Number($("amountPaid").value);

        if (!date) {
            notify("Enter the sale date.", "error");
            return;
        }

        if (paymentMethod === "Credit" && !customer) {
            notify("Enter the customer's name for a credit sale.", "error");
            $("customerName").focus();
            return;
        }

        if (paymentMethod !== "Credit" &&
            (!Number.isFinite(received) || received < saleTotal)) {
            notify("Amount received must cover the total sale.", "error");
            $("amountPaid").focus();
            return;
        }

        const updatedProducts = currentProducts.map(product => ({ ...product }));

        for (const item of cart) {
            const product = updatedProducts.find(
                entry => entry.id === item.productId
            );

            if (!product) {
                notify(
                    `Product "${item.name}" is no longer in inventory. Refresh and check the cart.`,
                    "error"
                );
                return;
            }

            const stock = Number(product.stock);
            const cost = Number(product.cost);
            const sellingPrice = Number(product.price);

            if (!Number.isFinite(stock) || stock < 0 ||
                !Number.isFinite(cost) || cost < 0 ||
                !Number.isFinite(sellingPrice) || sellingPrice <= 0) {
                notify(
                    `Product "${item.name}" has invalid inventory data. Correct it before selling.`,
                    "error"
                );
                return;
            }

            if (item.quantity > stock + 0.000001) {
                notify(
                    `Insufficient stock for "${item.name}". Available stock is ${stock}.`,
                    "error"
                );
                return;
            }

            if (Math.abs(cost - item.cost) > 0.000001) {
                notify(
                    `The recorded cost of "${item.name}" changed after it was added. Clear and add that product again.`,
                    "error"
                );
                return;
            }

            product.stock = stock - item.quantity;
        }

        const saleId = makeId("SALE");
        const amountReceived = paymentMethod === "Credit" ? 0 : received;
        const change = paymentMethod === "Credit"
            ? 0
            : Math.max(0, amountReceived - saleTotal);

        const sale = {
            id: saleId,
            date,
            customer,
            paymentMethod,
            amountPaid: paymentMethod === "Credit" ? 0 : saleTotal,
            amountReceived,
            change,
            total: saleTotal,
            items: cart.map(item => ({
                ...item,
                lineTotal: item.price * item.quantity,
                costTotal: item.cost * item.quantity
            }))
        };

        let newDebt = null;

        if (paymentMethod === "Credit") {
            newDebt = {
                id: makeId("DEBT"),
                saleId,
                type: "customer",
                party: customer,
                phone: "",
                date,
                amount: saleTotal,
                dueDate: "",
                description: "Credit sale " + saleId
            };
        }

        const updatedSales = [...sales, sale];
        const updatedDebts = newDebt ? [...debts, newDebt] : debts;

        const previous = {
            [PRODUCTS_KEY]: localStorage.getItem(PRODUCTS_KEY),
            [SALES_KEY]: localStorage.getItem(SALES_KEY),
            [DEBTS_KEY]: localStorage.getItem(DEBTS_KEY)
        };

        try {
            localStorage.setItem(PRODUCTS_KEY, JSON.stringify(updatedProducts));
            localStorage.setItem(SALES_KEY, JSON.stringify(updatedSales));

            if (newDebt) {
                localStorage.setItem(DEBTS_KEY, JSON.stringify(updatedDebts));
            }
        } catch {
            let rollbackSucceeded = true;

            for (const [key, value] of Object.entries(previous)) {
                try {
                    if (value === null) localStorage.removeItem(key);
                    else localStorage.setItem(key, value);
                } catch {
                    rollbackSucceeded = false;
                }
            }

            notify(
                rollbackSucceeded
                    ? "Sale could not be saved. Previous stored values were restored; check storage before retrying."
                    : "Storage failed and automatic restoration was incomplete. Stop making transactions and check your records before continuing.",
                "error"
            );
            return;
        }

        try {
            const db = window.BiasharaSQLite;
            const recordsToSave = [
                {
                    key: PRODUCTS_KEY,
                    value: updatedProducts,
                    sync: true,
                    entity: "products",
                    recordId: PRODUCTS_KEY
                },
                {
                    key: SALES_KEY,
                    value: updatedSales,
                    sync: true,
                    entity: "sales",
                    recordId: SALES_KEY
                }
            ];

            if (newDebt) {
                recordsToSave.push({
                    key: DEBTS_KEY,
                    value: updatedDebts,
                    sync: true,
                    entity: "debts",
                    recordId: DEBTS_KEY
                });
            }

            await db.putMany(recordsToSave);
        } catch (error) {
            let rollbackSucceeded = true;

            for (const [key, value] of Object.entries(previous)) {
                try {
                    if (value === null) localStorage.removeItem(key);
                    else localStorage.setItem(key, value);
                } catch {
                    rollbackSucceeded = false;
                }
            }

            console.error("SQLite sale save failed:", error);
            notify(
                rollbackSucceeded
                    ? "SQLite could not save the sale. Previous local records were restored; no sale was completed."
                    : "SQLite save failed and local restoration was incomplete. Stop transactions and check your records.",
                "error"
            );
            return;
        }

        products = updatedProducts;
        cart = [];

        $("customerName").value = "";
        $("amountPaid").value = "0";
        $("paymentMethod").value = "Cash";
        $("productName").value = "";
        $("productPrice").value = "";
        $("productCost").value = "";
        $("productQuantity").value = "1";

        renderProductOptions();
        render();
        renderHistory();

        notify(
            `Sale saved: ${saleId}. Stock updated.` +
            (newDebt ? " Customer debt recorded." : "")
        );
    }

    $("addToCartForm").addEventListener("submit", addToCart);
    $("productName").addEventListener("change", updateSelectedProduct);
    $("paymentMethod").addEventListener("change", updateChange);
    $("amountPaid").addEventListener("input", updateChange);
    $("clearCartButton").addEventListener("click", () => {
        cart = [];
        render();
        notify("Cart cleared.");
    });
    $("completeSaleButton").addEventListener("click", completeSale);

    $("saleDate").value = today();

    async function initializeSales() {
        try {
            const db = window.BiasharaSQLite;
            if (!db) throw new Error("SQLite adapter is unavailable.");

            await db.init();

            const initialProducts = readArray(PRODUCTS_KEY);
            const initialSales = readArray(SALES_KEY);
            const initialDebts = readArray(DEBTS_KEY);

            // Local storage remains the temporary source of truth
            // until all pages have been integrated with SQLite.
            await db.putMany([
                { key: PRODUCTS_KEY, value: initialProducts, sync: false },
                { key: SALES_KEY, value: initialSales, sync: false },
                { key: DEBTS_KEY, value: initialDebts, sync: false }
            ]);

            products = initialProducts;
            databaseReady = true;

            renderProductOptions();
            renderHistory();
            render();
        } catch (error) {
            console.error("Sales SQLite initialization failed:", error);
            notify(
                "SQLite could not initialize or load sales data. No sale can be completed safely.",
                "error"
            );
        }
    }

    initializeSales();
})();


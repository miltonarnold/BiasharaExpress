(() => {
    "use strict";

    const PRODUCTS_KEY = "biasharaExpressProducts";
    const PURCHASES_KEY = "biasharaExpressPurchases";
    const DEBTS_KEY = "biasharaExpressDebts";

    const $ = id => document.getElementById(id);

    let products = [];
    let purchases = [];
    let itemRows = [];
    let saving = false;
    let databaseReady = false;

    function readArray(key) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "[]");
            return Array.isArray(value) ? value : [];
        } catch {
            return [];
        }
    }

    function money(value) {
        return "KSh " + Number(value || 0).toLocaleString("en-KE", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function notify(message, type = "success") {
        $("purchaseNotice").textContent = message;
        $("purchaseNotice").className = "purchase-notice " + type;
    }

    function today() {
        const date = new Date();
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        return date.toISOString().slice(0, 10);
    }

    function makeId(prefix) {
        return prefix + "-" + Date.now() + "-" +
            Math.random().toString(36).slice(2, 9);
    }

    function escapeText(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    function selectedProduct(row) {
        return products.find(product => product.id === row.productId);
    }

    function lineTotal(row) {
        return Number(row.quantity || 0) * Number(row.unitCost || 0);
    }

    function total() {
        return itemRows.reduce((sum, row) => sum + lineTotal(row), 0);
    }

    function paid() {
        return Number($("purchaseAmountPaid").value || 0);
    }

    function outstanding() {
        return Math.max(0, total() - paid());
    }

    function currentOutstanding(purchase) {
        if (!purchase.supplierDebtId) {
            return Number(purchase.outstanding || 0);
        }

        const debts = readArray(DEBTS_KEY);
        const repayments = readArray("biasharaExpressRepayments");
        const debt = debts.find(item => item.id === purchase.supplierDebtId);

        if (!debt) return Number(purchase.outstanding || 0);

        const repaid = repayments
            .filter(item => item.recordId === debt.id)
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);

        return Math.max(0, Number(debt.amount || 0) - repaid);
    }
    function updateTotals() {
        const grandTotal = total();
        $("purchaseGrandTotal").textContent = money(grandTotal);
        $("purchaseOutstanding").value = money(outstanding());

        $("purchaseAmountPaid").max = grandTotal.toFixed(2);
        $("purchaseRecordCount").textContent = purchases.length.toLocaleString("en-KE");

        $("purchaseValueTotal").textContent = money(
            purchases.reduce((sum, purchase) => sum + Number(purchase.total || 0), 0)
        );

        $("purchaseOutstandingTotal").textContent = money(
            purchases.reduce((sum, purchase) =>
                sum + currentOutstanding(purchase), 0)
        );
    }

    function renderItems() {
        const tbody = $("purchaseItems");
        tbody.replaceChildren();

        if (!itemRows.length) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 5;
            cell.className = "purchase-empty";
            cell.textContent = products.length
                ? "Add a product to begin."
                : "Add products in Products & Inventory before recording purchases.";
            updateTotals();
            return;
        }

        itemRows.forEach((item, index) => {
            const row = tbody.insertRow();

            const productCell = row.insertCell();
            const select = document.createElement("select");
            select.className = "purchase-product";
            select.setAttribute("aria-label", "Product for item " + (index + 1));
            select.required = true;

            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = products.length
                ? "Select product"
                : "No products available";
            select.appendChild(placeholder);

            products.forEach(product => {
                const option = document.createElement("option");
                option.value = product.id;
                option.textContent = product.name + " (" + product.unit + ")";
                option.selected = product.id === item.productId;
                select.appendChild(option);
            });

            select.value = item.productId || "";
            select.addEventListener("change", () => {
                item.productId = select.value;
                const product = selectedProduct(item);
                if (product) item.unitCost = Number(product.cost || 0);
                renderItems();
            });
            productCell.appendChild(select);

            const quantityCell = row.insertCell();
            const quantityInput = document.createElement("input");
            quantityInput.type = "number";
            quantityInput.min = "0.01";
            quantityInput.step = "0.01";
            quantityInput.required = true;
            quantityInput.value = item.quantity;
            quantityInput.setAttribute("aria-label", "Quantity received");
            quantityInput.addEventListener("input", () => {
                item.quantity = Number(quantityInput.value);
                updateLine(row, item);
                updateTotals();
            });
            quantityCell.appendChild(quantityInput);

            const costCell = row.insertCell();
            const costInput = document.createElement("input");
            costInput.type = "number";
            costInput.min = "0";
            costInput.step = "0.01";
            costInput.required = true;
            costInput.value = item.unitCost;
            costInput.setAttribute("aria-label", "Purchase unit cost");
            costInput.addEventListener("input", () => {
                item.unitCost = Number(costInput.value);
                updateLine(row, item);
                updateTotals();
            });
            costCell.appendChild(costInput);

            const lineCell = row.insertCell();
            lineCell.textContent = money(lineTotal(item));

            const actionCell = row.insertCell();
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "purchase-remove";
            remove.textContent = "Remove";
            remove.addEventListener("click", () => {
                itemRows.splice(index, 1);
                renderItems();
            });
            actionCell.appendChild(remove);
        });

        updateTotals();
    }

    function updateLine(row, item) {
        row.cells[3].textContent = money(lineTotal(item));
    }

    function renderHistory() {
        const tbody = $("purchaseHistoryRows");
        tbody.replaceChildren();

        if (!purchases.length) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 7;
            cell.className = "purchase-empty";
            cell.textContent = "No purchases recorded yet.";
            updateTotals();
            return;
        }

        [...purchases].reverse().forEach(purchase => {
            const row = tbody.insertRow();
            const values = [
                purchase.date || "—",
                purchase.reference || purchase.id,
                purchase.supplier || "—",
                money(purchase.total),
                money(purchase.amountPaid),
                money(currentOutstanding(purchase)),
                (purchase.items || []).length
            ];

            values.forEach((value, index) => {
                const cell = row.insertCell();
                cell.textContent = value;
                if (index === 5 && currentOutstanding(purchase) > 0) {
                    cell.className = "purchase-outstanding";
                }
            });
        });

        updateTotals();
    }

    function addItem() {
        if (!products.length) {
            notify("Add products in Products & Inventory before recording a purchase.", "error");
            return;
        }

        itemRows.push({
            productId: "",
            quantity: 1,
            unitCost: 0
        });
        renderItems();
    }

    function resetForm() {
        $("purchaseForm").reset();
        $("purchaseDate").value = today();
        $("purchaseAmountPaid").value = "0";
        $("purchasePaymentMethod").value = "Cash";
        itemRows = [];
        renderItems();
        updateTotals();
    }

    async function savePurchase(event) {
        event.preventDefault();
        if (saving) return;

        if (!databaseReady) {
            notify("SQLite is not ready. No purchase was saved. Please wait and try again.", "error");
            return;
        }

        products = readArray(PRODUCTS_KEY);
        purchases = readArray(PURCHASES_KEY);

        const supplier = $("purchaseSupplier").value.trim();
        const phone = $("purchasePhone").value.trim();
        const date = $("purchaseDate").value;
        const dueDate = $("purchaseDueDate").value;
        const reference = $("purchaseReference").value.trim();
        const notes = $("purchaseNotes").value.trim();
        const paymentMethod = $("purchasePaymentMethod").value;
        const purchaseTotal = total();
        const amountPaid = paid();
        const balance = purchaseTotal - amountPaid;

        if (!supplier || !date || !itemRows.length) {
            notify("Enter the supplier, purchase date and at least one item.", "error");
            return;
        }

        if (dueDate && dueDate < date) {
            notify("The due date cannot be earlier than the purchase date.", "error");
            return;
        }

        if (itemRows.some(item =>
            !selectedProduct(item) ||
            !Number.isFinite(Number(item.quantity)) ||
            Number(item.quantity) <= 0 ||
            !Number.isFinite(Number(item.unitCost)) ||
            Number(item.unitCost) < 0
        )) {
            notify("Choose a valid product and enter a positive quantity and valid unit cost for every item.", "error");
            return;
        }

        if (!Number.isFinite(amountPaid) || amountPaid < 0 ||
            amountPaid > purchaseTotal + 0.000001) {
            notify("The amount paid must be between zero and the purchase total.", "error");
            return;
        }

        if (purchaseTotal <= 0) {
            notify("The purchase total must be greater than zero.", "error");
            return;
        }

        if (balance > 0 && !dueDate) {
            notify("Enter a payment due date for the unpaid balance.", "error");
            return;
        }

        const purchaseId = makeId("PUR");
        const supplierDebtId = balance > 0 ? makeId("DEBT") : null;
        const newPurchase = {
            supplierDebtId,
            id: purchaseId,
            date,
            supplier,
            phone,
            reference,
            dueDate,
            notes,
            paymentMethod,
            total: purchaseTotal,
            amountPaid,
            outstanding: Math.max(0, balance),
            items: itemRows.map(item => {
                const product = selectedProduct(item);
                return {
                    productId: product.id,
                    name: product.name,
                    unit: product.unit,
                    quantity: Number(item.quantity),
                    unitCost: Number(item.unitCost),
                    lineTotal: lineTotal(item)
                };
            })
        };

        const updatedProducts = products.map(product => ({ ...product }));

        for (const item of newPurchase.items) {
            const product = updatedProducts.find(entry => entry.id === item.productId);
            if (!product) {
                notify("A selected product is no longer available. Refresh the page and try again.", "error");
                return;
            }

            const oldStock = Number(product.stock);
            const oldCost = Number(product.cost);
            const newStock = oldStock + item.quantity;

            if (!Number.isFinite(oldStock) || oldStock < 0 ||
                !Number.isFinite(newStock) || !Number.isFinite(oldCost)) {
                notify("An existing product has invalid stock or cost data. Correct it in Products & Inventory first.", "error");
                return;
            }

            // Use weighted-average cost for future stock valuation.
            product.cost = newStock > 0
                ? ((oldStock * oldCost) + (item.quantity * item.unitCost)) / newStock
                : item.unitCost;
            product.stock = newStock;
        }

        const updatedPurchases = [...purchases, newPurchase];
        const updatedDebts = readArray(DEBTS_KEY);

        // Record only the unpaid balance so the supplier creditor is not duplicated.
        if (balance > 0) {
            updatedDebts.push({
                id: supplierDebtId,
                purchaseId,
                type: "supplier",
                party: supplier,
                phone,
                date,
                amount: balance,
                dueDate,
                description: "Unpaid purchase " + purchaseId +
                    (reference ? " | Invoice: " + reference : "")
            });
        }

        // Keep original values in memory to restore if a storage write fails.
        const previousValues = {
            products: localStorage.getItem(PRODUCTS_KEY),
            purchases: localStorage.getItem(PURCHASES_KEY),
            debts: localStorage.getItem(DEBTS_KEY)
        };

        saving = true;
        $("purchaseSaveButton").disabled = true;

        try {
            localStorage.setItem(PRODUCTS_KEY, JSON.stringify(updatedProducts));
            localStorage.setItem(PURCHASES_KEY, JSON.stringify(updatedPurchases));
            if (balance > 0) {
                localStorage.setItem(DEBTS_KEY, JSON.stringify(updatedDebts));
            }

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
                    key: PURCHASES_KEY,
                    value: updatedPurchases,
                    sync: true,
                    entity: "purchases",
                    recordId: PURCHASES_KEY
                }
            ];

            if (balance > 0) {
                recordsToSave.push({
                    key: DEBTS_KEY,
                    value: updatedDebts,
                    sync: true,
                    entity: "debts",
                    recordId: DEBTS_KEY
                });
            }

            await db.putMany(recordsToSave);

            products = updatedProducts;
            purchases = updatedPurchases;

            renderHistory();
            resetForm();
            notify("Purchase saved. Stock updated successfully." +
                (balance > 0 ? " The unpaid balance was added to supplier creditors." : " No supplier balance remains."));
        } catch {
            try {
                for (const [key, value] of Object.entries({
                    [PRODUCTS_KEY]: previousValues.products,
                    [PURCHASES_KEY]: previousValues.purchases,
                    [DEBTS_KEY]: previousValues.debts
                })) {
                    if (value === null) localStorage.removeItem(key);
                    else localStorage.setItem(key, value);
                }
            } catch {
                // Report the storage failure below.
            }

            notify("Could not save the purchase. Browser storage may be full. Check your records before trying again.", "error");
        } finally {
            saving = false;
            $("purchaseSaveButton").disabled = false;
        }
    }

    function renderSupplierOptions() {
        const select = $("supplierStatementSelect");
        const previous = select.value;
        const names = new Set();

        purchases.forEach(purchase => {
            if (purchase.supplier) names.add(purchase.supplier.trim());
        });

        readArray(DEBTS_KEY).forEach(debt => {
            if (debt.type === "supplier" && debt.party) {
                names.add(debt.party.trim());
            }
        });

        select.replaceChildren(new Option("Choose a supplier", ""));

        [...names].filter(Boolean).sort((a, b) => a.localeCompare(b))
            .forEach(name => select.add(new Option(name, name)));

        if ([...select.options].some(option => option.value === previous)) {
            select.value = previous;
        }
    }

    function renderSupplierStatement() {
        const supplier = $("supplierStatementSelect").value;
        const tbody = $("supplierStatementRows");
        tbody.replaceChildren();

        const debts = readArray(DEBTS_KEY);
        const repayments = readArray("biasharaExpressRepayments");
        const sameSupplier = value =>
            String(value || "").trim().toLowerCase() === supplier.toLowerCase();

        const supplierPurchases = purchases.filter(item => sameSupplier(item.supplier));
        const linkedDebtIds = new Set();

        function debtForPurchase(purchase) {
            const debt = debts.find(item =>
                item.type === "supplier" &&
                (item.id === purchase.supplierDebtId ||
                 item.purchaseId === purchase.id ||
                 String(item.description || "").includes(purchase.id))
            );

            if (debt) linkedDebtIds.add(debt.id);
            return debt;
        }

        const entries = [];
        let purchaseTotal = 0;
        let paidTotal = 0;
        let outstandingTotal = 0;

        supplierPurchases.forEach(purchase => {
            const debt = debtForPurchase(purchase);
            const payments = debt
                ? repayments.filter(item => item.recordId === debt.id)
                : [];
            const repaid = payments.reduce(
                (sum, item) => sum + Number(item.amount || 0), 0
            );
            const initialOutstanding = Number(purchase.outstanding || 0);
            const remaining = debt
                ? Math.max(0, Number(debt.amount || 0) - repaid)
                : initialOutstanding;

            purchaseTotal += Number(purchase.total || 0);
            paidTotal += Number(purchase.amountPaid || 0) + repaid;
            outstandingTotal += remaining;

            entries.push({
                date: purchase.date || "",
                reference: purchase.reference || purchase.id,
                description: "Stock purchase",
                amount: Number(purchase.total || 0),
                outstanding: remaining
            });

            payments.forEach(payment => entries.push({
                date: payment.date || "",
                reference: purchase.reference || purchase.id,
                description: "Supplier repayment (" + (payment.method || "Other") + ")",
                amount: -Number(payment.amount || 0),
                outstanding: null
            }));
        });

        debts.filter(debt =>
            debt.type === "supplier" &&
            sameSupplier(debt.party) &&
            !linkedDebtIds.has(debt.id)
        ).forEach(debt => {
            const payments = repayments.filter(item => item.recordId === debt.id);
            const repaid = payments.reduce(
                (sum, item) => sum + Number(item.amount || 0), 0
            );
            const remaining = Math.max(0, Number(debt.amount || 0) - repaid);

            paidTotal += repaid;
            outstandingTotal += remaining;

            entries.push({
                date: debt.date || "",
                reference: debt.id,
                description: debt.description || "Supplier creditor",
                amount: Number(debt.amount || 0),
                outstanding: remaining
            });

            payments.forEach(payment => entries.push({
                date: payment.date || "",
                reference: debt.id,
                description: "Supplier repayment (" + (payment.method || "Other") + ")",
                amount: -Number(payment.amount || 0),
                outstanding: null
            }));
        });

        $("supplierStatementPurchases").textContent = money(purchaseTotal);
        $("supplierStatementPaid").textContent = money(paidTotal);
        $("supplierStatementOutstanding").textContent = money(outstandingTotal);

        if (!supplier) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 5;
            cell.className = "purchase-empty";
            cell.textContent = "Select a supplier to view the statement.";
            return;
        }

        entries.sort((a, b) => a.date.localeCompare(b.date));

        if (!entries.length) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 5;
            cell.className = "purchase-empty";
            cell.textContent = "No transactions found for this supplier.";
            return;
        }

        entries.forEach(entry => {
            const row = tbody.insertRow();
            [
                entry.date || "—",
                entry.reference,
                entry.description,
                money(entry.amount),
                entry.outstanding === null ? "—" : money(entry.outstanding)
            ].forEach(value => {
                row.insertCell().textContent = value;
            });
        });
    }

    async function initializePurchases() {
        try {
            const db = window.BiasharaSQLite;
            if (!db) throw new Error("SQLite adapter is unavailable.");

            await db.init();

            // Keep localStorage authoritative until all pages are integrated.
            products = readArray(PRODUCTS_KEY);
            purchases = readArray(PURCHASES_KEY);
            const debts = readArray(DEBTS_KEY);

            await db.putMany([
                { key: PRODUCTS_KEY, value: products, sync: false },
                { key: PURCHASES_KEY, value: purchases, sync: false },
                { key: DEBTS_KEY, value: debts, sync: false }
            ]);

            databaseReady = true;
            renderItems();
            renderHistory();
            renderSupplierOptions();
            renderSupplierStatement();
        } catch (error) {
            console.error("Purchases SQLite initialization failed:", error);
            notify("SQLite could not initialize. No purchase can be saved safely.", "error");
        }
    }

    $("supplierStatementSelect").addEventListener("change", renderSupplierStatement);
    $("purchaseDate").value = today();
    $("purchaseAddItem").addEventListener("click", addItem);
    $("purchaseAmountPaid").addEventListener("input", updateTotals);
    $("purchasePaymentMethod").addEventListener("change", () => {
        if ($("purchasePaymentMethod").value === "Credit") {
            $("purchaseAmountPaid").value = "0";
        }
        updateTotals();
    });
    $("purchaseForm").addEventListener("submit", savePurchase);

    initializePurchases();
})();

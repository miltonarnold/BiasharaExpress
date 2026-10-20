(() => {
    "use strict";

    const KEY = "biasharaExpressDebts";
    const REPAYMENT_KEY = "biasharaExpressRepayments";
    const $ = id => document.getElementById(id);
    const requestedType = new URLSearchParams(window.location.search).get("type");
    let type = requestedType === "supplier" ? "supplier" : "customer";
    let records = load(KEY);
    let repayments = load(REPAYMENT_KEY);
    let databaseReady = false;

    function load(key) {
        try {
            const data = JSON.parse(localStorage.getItem(key) || "[]");
            return Array.isArray(data) ? data : [];
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

    function today() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    function paidAmount(record) {
        return repayments
            .filter(item => item.recordId === record.id)
            .reduce((sum, item) => sum + item.amount, 0);
    }

    function balance(record) {
        return Math.max(0, record.amount - paidAmount(record));
    }

    async function persist() {
        const oldDebts = localStorage.getItem(KEY);
        const oldRepayments = localStorage.getItem(REPAYMENT_KEY);

        try {
            localStorage.setItem(KEY, JSON.stringify(records));
            localStorage.setItem(REPAYMENT_KEY, JSON.stringify(repayments));

            const db = window.BiasharaSQLite;
            if (!databaseReady || !db) {
                throw new Error("SQLite is not ready.");
            }

            await db.putMany([
                {
                    key: KEY,
                    value: records,
                    sync: true,
                    entity: "debts",
                    recordId: KEY
                },
                {
                    key: REPAYMENT_KEY,
                    value: repayments,
                    sync: true,
                    entity: "repayments",
                    recordId: REPAYMENT_KEY
                }
            ]);
        } catch (error) {
            if (oldDebts === null) localStorage.removeItem(KEY);
            else localStorage.setItem(KEY, oldDebts);

            if (oldRepayments === null) localStorage.removeItem(REPAYMENT_KEY);
            else localStorage.setItem(REPAYMENT_KEY, oldRepayments);

            throw error;
        }
    }

    function notify(message, kind = "success") {
        $("debtNotice").textContent = message;
        $("debtNotice").className = "debt-notice " + kind;
    }

    function setType(nextType) {
        type = nextType;
        const customer = type === "customer";

        $("customerTab").className = "debt-button " +
            (customer ? "debt-primary active" : "debt-secondary");
        $("supplierTab").className = "debt-button " +
            (!customer ? "debt-primary active" : "debt-secondary");

        $("debtFormTitle").textContent = customer
            ? "Record a customer debt"
            : "Record a supplier creditor";
        $("debtListTitle").textContent = customer
            ? "Customer debts"
            : "Supplier creditors";

        $("debtParty").placeholder = customer
            ? "Customer full name"
            : "Supplier or business name";

        $("debtSearch").value = "";
        render();
    }

    function resetForm() {
        $("debtForm").reset();
        $("debtEditId").value = "";
        $("debtFormTitle").textContent = type === "customer"
            ? "Record a customer debt"
            : "Record a supplier creditor";
        $("debtSaveButton").textContent = "Save debt";
        $("debtCancelButton").hidden = true;
        $("debtDate").value = today();
    }

    function renderStats() {
        const customerTotal = records
            .filter(item => item.type === "customer")
            .reduce((sum, item) => sum + balance(item), 0);

        const supplierTotal = records
            .filter(item => item.type === "supplier")
            .reduce((sum, item) => sum + balance(item), 0);

        $("customerDebtTotal").textContent = money(customerTotal);
        $("supplierDebtTotal").textContent = money(supplierTotal);
        $("debtRecordCount").textContent = records.filter(
            item => balance(item) > 0
        ).length;
    }

    function renderRows() {
        const query = $("debtSearch").value.trim().toLowerCase();

        const filtered = records.filter(item =>
            item.type === type &&
            [item.party, item.phone, item.description]
                .some(value => String(value || "").toLowerCase().includes(query))
        );

        const tbody = $("debtRows");
        tbody.replaceChildren();

        if (!filtered.length) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 7;
            cell.className = "debt-empty";
            cell.textContent = query ? "No matching records found." : "No records yet.";
            return;
        }

        filtered.forEach(record => {
            const row = tbody.insertRow();
            const paid = paidAmount(record);
            const remaining = balance(record);

            [
                record.party,
                record.date,
                money(record.amount),
                money(paid),
                money(remaining)
            ].forEach(value => row.insertCell().textContent = value);

            const statusCell = row.insertCell();
            const status = document.createElement("span");
            status.className = "debt-status" +
                (remaining > 0 ? " debt-outstanding" : "");
            status.textContent = remaining <= 0 ? "Paid" : "Outstanding";
            statusCell.appendChild(status);

            const actions = row.insertCell();

            const edit = document.createElement("button");
            edit.type = "button";
            edit.className = "debt-action";
            edit.textContent = "Edit";
            edit.addEventListener("click", () => editRecord(record.id));

            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "debt-action debt-delete";
            remove.textContent = "Delete";
            remove.addEventListener("click", () => deleteRecord(record.id));

            actions.append(edit, remove);
        });
    }

    function renderRepayments() {
        const container = $("repaymentHistory");
        container.replaceChildren();

        const recent = repayments
            .filter(payment => {
                const record = records.find(item => item.id === payment.recordId);
                return record && record.type === type;
            })
            .slice()
            .reverse()
            .slice(0, 10);

        if (!recent.length) {
            const empty = document.createElement("p");
            empty.className = "debt-empty";
            empty.textContent = "No repayments recorded yet.";
            container.appendChild(empty);
            return;
        }

        recent.forEach(payment => {
            const record = records.find(item => item.id === payment.recordId);
            const line = document.createElement("div");
            line.className = "debt-history-item";

            const details = document.createElement("div");
            const name = document.createElement("strong");
            name.textContent = record.party;

            const description = document.createElement("div");
            description.className = "debt-muted";
            description.textContent =
                `${payment.date} · ${payment.method}` +
                (payment.note ? ` · ${payment.note}` : "");

            details.append(name, description);

            const amount = document.createElement("strong");
            amount.textContent = money(payment.amount);

            line.append(details, amount);
            container.appendChild(line);
        });
    }

    function renderRepaymentOptions() {
        const select = $("repaymentRecord");
        const previous = select.value;
        select.replaceChildren();

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Select an outstanding record";
        select.appendChild(placeholder);

        records.filter(item => balance(item) > 0).forEach(record => {
            const option = document.createElement("option");
            option.value = record.id;
            option.textContent =
                `${record.type === "customer" ? "Customer" : "Supplier"}: ` +
                `${record.party} — ${money(balance(record))} outstanding`;
            select.appendChild(option);
        });

        if ([...select.options].some(option => option.value === previous)) {
            select.value = previous;
        }
    }

    function render() {
        renderStats();
        renderRows();
        renderRepayments();
        renderRepaymentOptions();
    }

    function editRecord(id) {
        const record = records.find(item => item.id === id);
        if (!record) return;

        if (paidAmount(record) > 0) {
            notify("This record has repayments. Its original amount cannot be edited safely. Record further changes separately.", "error");
            return;
        }

        $("debtEditId").value = record.id;
        $("debtParty").value = record.party;
        $("debtPhone").value = record.phone;
        $("debtDate").value = record.date;
        $("debtAmount").value = record.amount;
        $("debtDueDate").value = record.dueDate || "";
        $("debtDescription").value = record.description || "";

        $("debtFormTitle").textContent = "Edit debt record";
        $("debtSaveButton").textContent = "Update record";
        $("debtCancelButton").hidden = false;
        $("debtForm").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    async function deleteRecord(id) {
        const record = records.find(item => item.id === id);
        if (!record) return;

        if (!confirm(`Delete the record for "${record.party}" and its repayment history?`)) {
            return;
        }

        const oldRecords = records;
        const oldRepayments = repayments;

        records = records.filter(item => item.id !== id);
        repayments = repayments.filter(item => item.recordId !== id);

        try {
            await persist();
            if ($("debtEditId").value === id) resetForm();
            render();
            notify("Record and its repayment history deleted.");
        } catch {
            records = oldRecords;
            repayments = oldRepayments;
            notify("Could not save the change. Check browser storage.", "error");
        }
    }

    $("customerTab").addEventListener("click", () => setType("customer"));
    $("supplierTab").addEventListener("click", () => setType("supplier"));
    $("debtSearch").addEventListener("input", renderRows);
    $("debtCancelButton").addEventListener("click", resetForm);

    $("debtForm").addEventListener("submit", async event => {
        event.preventDefault();

        const editId = $("debtEditId").value;
        const party = $("debtParty").value.trim();
        const phone = $("debtPhone").value.trim();
        const date = $("debtDate").value;
        const amount = Number($("debtAmount").value);
        const dueDate = $("debtDueDate").value;
        const description = $("debtDescription").value.trim();

        if (!party || !date || !Number.isFinite(amount) || amount <= 0) {
            notify("Enter a name, date and valid amount.", "error");
            return;
        }

        const oldRecords = records;

        const newRecord = {
            id: editId || "DEBT-" + Date.now() + "-" +
                Math.random().toString(36).slice(2, 7),
            type, party, phone, date, amount, dueDate, description
        };

        records = editId
            ? records.map(item => item.id === editId ? newRecord : item)
            : [...records, newRecord];

        try {
            await persist();
            resetForm();
            render();
            notify(editId ? "Debt record updated." : "Debt record saved successfully.");
        } catch {
            records = oldRecords;
            notify("Could not save the record. Check browser storage.", "error");
        }
    });

    $("repaymentForm").addEventListener("submit", async event => {
        event.preventDefault();

        const recordId = $("repaymentRecord").value;
        const amount = Number($("repaymentAmount").value);
        const date = $("repaymentDate").value;
        const method = $("repaymentMethod").value;
        const note = $("repaymentNote").value.trim();
        const record = records.find(item => item.id === recordId);

        if (!record || !date || !Number.isFinite(amount) || amount <= 0) {
            notify("Select a record and enter a valid repayment amount.", "error");
            return;
        }

        if (amount > balance(record) + 0.000001) {
            notify("Repayment exceeds the outstanding balance of " +
                money(balance(record)) + ".", "error");
            return;
        }

        const payment = {
            id: "PAY-" + Date.now() + "-" +
                Math.random().toString(36).slice(2, 7),
            recordId, amount, date, method, note
        };

        repayments.push(payment);

        try {
            await persist();
            $("repaymentForm").reset();
            $("repaymentDate").value = today();
            render();
            notify("Repayment saved. Remaining balance: " + money(balance(record)));
        } catch {
            repayments = repayments.filter(item => item.id !== payment.id);
            notify("Could not save the repayment. Check browser storage.", "error");
        }
    });

    $("debtExportButton").addEventListener("click", () => {
        const heading = [
            "Type", "Name", "Phone", "Transaction Date", "Due Date",
            "Description", "Original Amount", "Paid", "Balance", "Status"
        ];

        const escapeCsv = value =>
            '"' + String(value ?? "").replace(/"/g, '""') + '"';

        const rows = records.filter(item => item.type === type).map(item => [
            item.type, item.party, item.phone, item.date, item.dueDate,
            item.description, item.amount, paidAmount(item), balance(item),
            balance(item) <= 0 ? "Paid" : "Outstanding"
        ]);

        const csv = [heading, ...rows]
            .map(row => row.map(escapeCsv).join(","))
            .join("\r\n");

        const blob = new Blob(["\uFEFF" + csv], {
            type: "text/csv;charset=utf-8;"
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = type === "customer"
            ? "biasharaexpress-customer-debts.csv"
            : "biasharaexpress-supplier-creditors.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        notify("Records exported successfully.");
    });

    async function initializeDebts() {
        try {
            const db = window.BiasharaSQLite;
            if (!db) throw new Error("SQLite adapter is unavailable.");

            await db.init();

            // Preserve existing data while the other pages are still being integrated.
            records = load(KEY);
            repayments = load(REPAYMENT_KEY);

            await db.putMany([
                { key: KEY, value: records, sync: false },
                { key: REPAYMENT_KEY, value: repayments, sync: false }
            ]);

            databaseReady = true;
            setType(type);
            render();
        } catch (error) {
            console.error("Debts SQLite initialization failed:", error);
            notify("SQLite could not initialize. Changes cannot be saved safely.", "error");
        }
    }

    $("debtDate").value = today();
    $("repaymentDate").value = today();

    initializeDebts();
})();



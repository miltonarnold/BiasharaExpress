(() => {
    "use strict";

    const KEYS = {
        sales: "biasharaExpressSales",
        purchases: "biasharaExpressPurchases",
        finance: "biasharaExpressFinance",
        debts: "biasharaExpressDebts",
        repayments: "biasharaExpressRepayments"
    };

    const $ = id => document.getElementById(id);

    function read(key) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "[]");
            return Array.isArray(value) ? value : [];
        } catch {
            return [];
        }
    }

    function amount(value) {
        return Number(value) || 0;
    }

    function money(value) {
        return "KSh " + Math.abs(amount(value)).toLocaleString("en-KE", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, c => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;",
            '"': "&quot;", "'": "&#39;"
        })[c]);
    }

    function dateKey(value) {
        return String(value || "").slice(0, 10);
    }

    function getTransactions() {
        const sales = read(KEYS.sales);
        const purchases = read(KEYS.purchases);
        const finance = read(KEYS.finance);
        const debts = read(KEYS.debts);
        const repayments = read(KEYS.repayments);
        const result = [];

        sales.forEach(item => result.push({
            date: dateKey(item.date),
            type: "Sale",
            description: "Sale " + (item.id || ""),
            method: item.paymentMethod || "Not specified",
            amount: amount(item.total),
            status: item.paymentMethod === "Credit" ? "Credit sale" : "Recorded"
        }));

        purchases.forEach(item => result.push({
            date: dateKey(item.date),
            type: "Purchase",
            description: "Purchase " + (item.id || ""),
            method: item.paymentMethod || "Not specified",
            amount: -amount(item.total),
            status: amount(item.amountPaid) > 0 ? "Payment recorded" : "Recorded"
        }));

        finance.forEach(item => {
            const isInflow = item.type === "capital";
            const type = item.type === "capital" ? "Capital" :
                item.type === "withdrawal" ? "Withdrawal" : "Expense";

            result.push({
                date: dateKey(item.date),
                type,
                description: item.description || item.category || "Finance transaction",
                method: item.paymentMethod || "Not specified",
                amount: isInflow ? amount(item.amount) : -amount(item.amount),
                status: "Recorded"
            });
        });

        debts.forEach(item => {
            const type = item.type === "supplier" ? "Supplier creditor" : "Customer debt";
            result.push({
                date: dateKey(item.date),
                type,
                description: (item.party || "Unnamed party") +
                    (item.description ? " — " + item.description : ""),
                method: "Credit record",
                amount: 0,
                status: "Debt record: " + money(item.amount)
            });
        });

        repayments.forEach(payment => {
            const debt = debts.find(item => String(item.id) === String(payment.recordId));
            const supplier = debt?.type === "supplier";

            result.push({
                date: dateKey(payment.date),
                type: supplier ? "Supplier repayment" : "Customer repayment",
                description: (supplier ? "Payment to supplier" : "Payment received") +
                    (debt?.party ? " — " + debt.party : ""),
                method: payment.method || "Not specified",
                amount: supplier ? -amount(payment.amount) : amount(payment.amount),
                status: "Recorded"
            });
        });

        return result.sort((a, b) =>
            b.date.localeCompare(a.date)
        );
    }

    function filteredTransactions() {
        const query = $("search").value.trim().toLowerCase();
        const type = $("typeFilter").value;
        const from = $("fromDate").value;
        const to = $("toDate").value;

        return getTransactions().filter(item => {
            const searchable = [
                item.date, item.type, item.description, item.method, item.status
            ].join(" ").toLowerCase();

            return (!query || searchable.includes(query)) &&
                (type === "all" || item.type === type) &&
                (!from || item.date >= from) &&
                (!to || item.date <= to);
        });
    }

    function render() {
        const items = filteredTransactions();
        const body = $("rows");

        $("count").textContent = items.length.toLocaleString("en-KE");

        const income = items.reduce((sum, item) =>
            sum + Math.max(0, item.amount), 0);
        const outflow = items.reduce((sum, item) =>
            sum + Math.max(0, -item.amount), 0);

        $("income").textContent = money(income);
        $("outflow").textContent = money(outflow);
        $("lastUpdated").textContent = "Updated " +
            new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });

        if (!items.length) {
            body.innerHTML = '<tr><td colspan="6" class="empty">No matching transactions found.</td></tr>';
            $("message").textContent = "Try changing the search or date filters.";
            return;
        }

        body.innerHTML = items.map(item => {
            const sign = item.amount > 0 ? "+" : item.amount < 0 ? "−" : "";
            const amountClass = item.amount > 0 ? "positive" :
                item.amount < 0 ? "negative" : "";
            const shownAmount = item.amount === 0 ? "—" :
                sign + money(item.amount);

            return `<tr>
                <td>${escapeHtml(item.date || "—")}</td>
                <td>${escapeHtml(item.type)}</td>
                <td>${escapeHtml(item.description)}</td>
                <td>${escapeHtml(item.method)}</td>
                <td class="amount ${amountClass}">${escapeHtml(shownAmount)}</td>
                <td><span class="status">${escapeHtml(item.status)}</span></td>
            </tr>`;
        }).join("");

        $("message").textContent = "Showing " + items.length +
            " transaction record(s). Debt records show their debt amount in the status column and are not counted as cash received.";
    }

    async function exportCsv() {
        const items = filteredTransactions();

        if (!items.length) {
            $("message").textContent = "There are no matching records to export.";
            return;
        }

        const columns = ["date", "type", "description", "method", "amount", "status"];
        const cell = value =>
            '"' + String(value ?? "").replace(/"/g, '""') + '"';

        const csv = [
            columns.join(","),
            ...items.map(item =>
                columns.map(key => cell(item[key])).join(",")
            )
        ].join("\r\n");

        const csvContent = "\uFEFF" + csv;
        const fileName = "biasharaexpress-transactions.csv";

        try {
            const capacitor = window.Capacitor;
            const plugins = capacitor && capacitor.Plugins;

            if (capacitor && capacitor.isNativePlatform() && plugins) {
                const Filesystem = plugins.Filesystem;
                const Share = plugins.Share;

                if (!Filesystem || !Share) {
                    throw new Error("Filesystem or Share plugin is unavailable.");
                }

                const file = await Filesystem.writeFile({
                    path: fileName,
                    data: csvContent,
                    directory: "CACHE",
                    encoding: "utf8"
                });

                await Share.share({
                    title: "BiasharaExpress Transactions",
                    text: "Exported transaction records as a CSV file.",
                    url: file.uri,
                    dialogTitle: "Save or share transaction CSV"
                });

                $("message").textContent =
                    "CSV file created. Choose an available app to save or share it.";
                return;
            }

            // Browser fallback for desktop and web use.
            const blob = new Blob([csvContent], {
                type: "text/csv;charset=utf-8;"
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();

            window.setTimeout(() => URL.revokeObjectURL(url), 2000);

            $("message").textContent = "CSV export requested. Check your downloads.";
        } catch (error) {
            console.error("CSV export failed:", error);
            $("message").textContent =
                "CSV export failed: " + (error.message || "Unknown error");
        }
    }

    let transactionsDatabaseReady = false;

    async function initializeTransactionsDatabase() {
        try {
            const db = window.BiasharaSQLite;
            if (!db) throw new Error("SQLite adapter is unavailable.");

            await db.init();

            const records = Object.values(KEYS).map(key => ({
                key,
                value: read(key),
                sync: false
            }));

            await db.putMany(records);

            transactionsDatabaseReady = true;
            render();
            $("message").textContent =
                "Transaction history loaded from saved business records.";
        } catch (error) {
            transactionsDatabaseReady = false;
            console.error("Transactions SQLite initialization failed:", error);
            $("message").textContent =
                "SQLite initialization failed. Please check the database.";
        }
    }
    ["search", "typeFilter", "fromDate", "toDate"].forEach(id => {
        $(id).addEventListener(id === "search" ? "input" : "change", render);
    });

    $("resetFilters").addEventListener("click", () => {
        $("search").value = "";
        $("typeFilter").value = "all";
        $("fromDate").value = "";
        $("toDate").value = "";
        render();
    });

    $("exportCsv").addEventListener("click", exportCsv);

    window.addEventListener("pageshow", () => {
        if (transactionsDatabaseReady) render();
    });
    window.addEventListener("storage", render);

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && transactionsDatabaseReady) render();
    });

    initializeTransactionsDatabase();
})();




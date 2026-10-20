(() => {
    "use strict";

    const KEYS = {
        sales: "biasharaExpressSales",
        products: "biasharaExpressProducts",
        purchases: "biasharaExpressPurchases",
        debts: "biasharaExpressDebts",
        repayments: "biasharaExpressRepayments",
        finance: "biasharaExpressFinance"
    };

    function readArray(key) {
        const raw = localStorage.getItem(key);
        if (raw === null) return [];

        const value = JSON.parse(raw);
        if (!Array.isArray(value)) {
            throw new Error("Invalid stored data for " + key);
        }
        return value;
    }

    function number(value) {
        const result = Number(value);
        return Number.isFinite(result) ? result : 0;
    }

    function dateKey(value) {
        return String(value || "").slice(0, 10);
    }

    function today() {
        const date = new Date();
        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0")
        ].join("-");
    }

    function calculate() {
        const app = window.BiasharaExpress;
        if (!app) return;

        let data;
        try {
            data = {
                sales: readArray(KEYS.sales),
                products: readArray(KEYS.products),
                purchases: readArray(KEYS.purchases),
                debts: readArray(KEYS.debts),
                repayments: readArray(KEYS.repayments),
                finance: readArray(KEYS.finance)
            };
        } catch (error) {
            console.error(
                "Dashboard refresh stopped because a stored record could not be read safely.",
                error
            );
            return;
        }

        const selectedDate = app.getSelectedDate() || today();

        const selectedSales = data.sales.filter(
            sale => dateKey(sale.date) === selectedDate
        );

        let revenue = 0;
        let costOfGoodsSold = 0;

        selectedSales.forEach(sale => {
            revenue += number(sale.total);

            if (Array.isArray(sale.items)) {
                sale.items.forEach(item => {
                    costOfGoodsSold +=
                        number(item.cost) * number(item.quantity);
                });
            }
        });

        const selectedExpenses = data.finance
            .filter(item =>
                item.type === "expense" &&
                dateKey(item.date) === selectedDate
            )
            .reduce((sum, item) => sum + number(item.amount), 0);

        const repaymentTotals = new Map();

        data.repayments.forEach(payment => {
            const id = payment.recordId;
            repaymentTotals.set(
                id,
                (repaymentTotals.get(id) || 0) + number(payment.amount)
            );
        });

        let customerDebts = 0;
        let supplierCreditors = 0;

        data.debts.forEach(debt => {
            const outstanding = Math.max(
                0,
                number(debt.amount) -
                (repaymentTotals.get(debt.id) || 0)
            );

            if (debt.type === "customer") {
                customerDebts += outstanding;
            } else if (debt.type === "supplier") {
                supplierCreditors += outstanding;
            }
        });

        let cashBalance = 0;

        data.sales.forEach(sale => {
            if (sale.paymentMethod === "Cash") {
                cashBalance += number(sale.total);
            }
        });

        data.purchases.forEach(purchase => {
            if (purchase.paymentMethod === "Cash") {
                cashBalance -= number(purchase.amountPaid);
            }
        });

        data.finance.forEach(item => {
            if (item.paymentMethod !== "Cash") return;

            const amount = number(item.amount);

            if (item.type === "capital") {
                cashBalance += amount;
            } else if (
                item.type === "expense" ||
                item.type === "withdrawal"
            ) {
                cashBalance -= amount;
            }
        });

        data.repayments.forEach(payment => {
            if (payment.method !== "Cash") return;

            const debt = data.debts.find(
                item => item.id === payment.recordId
            );

            if (!debt) return;

            if (debt.type === "customer") {
                cashBalance += number(payment.amount);
            } else if (debt.type === "supplier") {
                cashBalance -= number(payment.amount);
            }
        });

        app.updateDashboard({
            todaySales: revenue,
            todayProfit: revenue - costOfGoodsSold,
            todayLosses: selectedExpenses,
            cashBalance,
            customerDebts,
            supplierCreditors
        });

        app.updateStock(
            data.products.map(product => ({
                name: product.name,
                category: product.category,
                quantity: product.stock,
                reorderLevel: product.lowStock
            }))
        );

        const transactions = [];

        data.sales.forEach(sale => {
            transactions.push({
                date: sale.date,
                description: "Sale " + (sale.id || ""),
                paymentMethod: sale.paymentMethod || "Not specified",
                amount: number(sale.total),
                status: sale.paymentMethod === "Credit"
                    ? "Credit sale"
                    : "Recorded"
            });
        });

        data.purchases.forEach(purchase => {
            transactions.push({
                date: purchase.date,
                description: "Purchase " + (purchase.id || ""),
                paymentMethod: purchase.paymentMethod || "Not specified",
                amount: -number(purchase.total),
                status: number(purchase.outstanding) > 0
                    ? "Partly unpaid"
                    : "Recorded"
            });
        });

        data.finance.forEach(item => {
            transactions.push({
                date: item.date,
                description: item.description || "Finance transaction",
                paymentMethod: item.paymentMethod || "Not specified",
                amount: item.type === "capital"
                    ? number(item.amount)
                    : -number(item.amount),
                status: item.type === "expense"
                    ? "Expense"
                    : item.type === "withdrawal"
                        ? "Withdrawal"
                        : "Capital"
            });
        });

        data.repayments.forEach(payment => {
            const debt = data.debts.find(
                item => item.id === payment.recordId
            );

            transactions.push({
                date: payment.date,
                description: (debt?.type === "supplier"
                    ? "Supplier repayment"
                    : "Customer repayment"),
                paymentMethod: payment.method || "Not specified",
                amount: debt?.type === "supplier"
                    ? -number(payment.amount)
                    : number(payment.amount),
                status: "Recorded"
            });
        });

        transactions.sort((a, b) =>
            dateKey(b.date).localeCompare(dateKey(a.date))
        );

        app.updateTransactions(transactions.slice(0, 10));
    }

    document.addEventListener("DOMContentLoaded", calculate);

    document.addEventListener(
        "biashara:refresh-requested",
        calculate
    );

    document.addEventListener(
        "biashara:report-date-changed",
        calculate
    );

    window.addEventListener("pageshow", calculate);

    window.addEventListener("storage", event => {
        if (Object.values(KEYS).includes(event.key) || event.key === null) {
            calculate();
        }
    });
})();

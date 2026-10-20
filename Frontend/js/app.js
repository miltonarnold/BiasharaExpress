"use strict";

/* =========================================================
   BiasharaExpress
   Main Application JavaScript
   ========================================================= */

const BiasharaExpress = (() => {
    const CONFIG = {
        currency: "KSh",
        locale: "en-KE",
        dateFormat: {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    };

    const state = {
        dashboard: {
            todaySales: 0,
            todayProfit: 0,
            todayLosses: 0,
            cashBalance: 0,
            customerDebts: 0,
            supplierCreditors: 0
        },
        stock: [],
        transactions: [],
        isLoading: false
    };

    const elements = {};

    function getElement(id) {
        return document.getElementById(id);
    }

    function cacheElements() {
        elements.sidebar = getElement("sidebar");
        elements.menuToggle = getElement("menuToggle");
        elements.reportDate = getElement("reportDate");
        elements.refreshDashboard = getElement("refreshDashboard");

        elements.todaySales = getElement("todaySales");
        elements.todayProfit = getElement("todayProfit");
        elements.todayLosses = getElement("todayLosses");
        elements.cashBalance = getElement("cashBalance");
        elements.customerDebts = getElement("customerDebts");
        elements.supplierCreditors = getElement("supplierCreditors");

        elements.stockTableBody = getElement("stockTableBody");
        elements.transactionsTableBody = getElement("transactionsTableBody");
    }

    function formatMoney(amount) {
        const value = Number(amount);

        if (!Number.isFinite(value)) {
            return `${CONFIG.currency} 0.00`;
        }

        return `${CONFIG.currency} ${value.toLocaleString(CONFIG.locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    function formatDate(date) {
        return new Intl.DateTimeFormat(
            CONFIG.locale,
            CONFIG.dateFormat
        ).format(date);
    }

    function getLocalDateInputValue(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function setText(element, value) {
        if (element) {
            element.textContent = value;
        }
    }

    function renderDashboard() {
        const dashboard = state.dashboard;

        setText(elements.todaySales, formatMoney(dashboard.todaySales));
        setText(elements.todayProfit, formatMoney(dashboard.todayProfit));
        setText(elements.todayLosses, formatMoney(dashboard.todayLosses));
        setText(elements.cashBalance, formatMoney(dashboard.cashBalance));
        setText(elements.customerDebts, formatMoney(dashboard.customerDebts));
        setText(elements.supplierCreditors, formatMoney(dashboard.supplierCreditors));

        if (elements.todayProfit) {
            elements.todayProfit.classList.toggle(
                "loss-value",
                dashboard.todayProfit < 0
            );

            elements.todayProfit.classList.toggle(
                "profit-value",
                dashboard.todayProfit >= 0
            );
        }

        if (elements.cashBalance) {
            elements.cashBalance.classList.toggle(
                "loss-value",
                dashboard.cashBalance < 0
            );
        }
    }

    function createTableCell(value, className = "") {
        const cell = document.createElement("td");
        cell.textContent = value == null ? "" : String(value);

        if (className) {
            cell.className = className;
        }

        return cell;
    }

    function renderEmptyTableRow(tableBody, columnCount, message) {
        if (!tableBody) {
            return;
        }

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = columnCount;
        cell.className = "empty-state";
        cell.textContent = message;

        row.appendChild(cell);
        tableBody.replaceChildren(row);
    }

    function renderStock() {
        const tableBody = elements.stockTableBody;

        if (!tableBody) {
            return;
        }

        if (state.stock.length === 0) {
            renderEmptyTableRow(
                tableBody,
                4,
                "No stock records available. Add your first product to begin."
            );
            return;
        }

        const fragment = document.createDocumentFragment();

        state.stock.forEach((item) => {
            const row = document.createElement("tr");

            row.appendChild(createTableCell(item.name));
            row.appendChild(createTableCell(item.category || "Uncategorised"));
            row.appendChild(createTableCell(item.quantity));

            const statusCell = document.createElement("td");
            const badge = document.createElement("span");

            badge.className = "status-badge";

            const quantity = Number(item.quantity);
            const reorderLevel = Number(item.reorderLevel ?? 5);

            if (!Number.isFinite(quantity) || quantity <= 0) {
                badge.classList.add("danger");
                badge.textContent = "Out of stock";
            } else if (quantity <= reorderLevel) {
                badge.classList.add("warning");
                badge.textContent = "Low stock";
            } else {
                badge.classList.add("success");
                badge.textContent = "In stock";
            }

            statusCell.appendChild(badge);
            row.appendChild(statusCell);
            fragment.appendChild(row);
        });

        tableBody.replaceChildren(fragment);
    }

    function renderTransactions() {
        const tableBody = elements.transactionsTableBody;

        if (!tableBody) {
            return;
        }

        if (state.transactions.length === 0) {
            renderEmptyTableRow(
                tableBody,
                5,
                "No transactions recorded yet."
            );
            return;
        }

        const fragment = document.createDocumentFragment();

        state.transactions.forEach((transaction) => {
            const row = document.createElement("tr");
            const date = transaction.date
                ? new Date(transaction.date)
                : null;

            row.appendChild(
                createTableCell(
                    date && !Number.isNaN(date.getTime())
                        ? formatDate(date)
                        : "Not specified"
                )
            );

            row.appendChild(
                createTableCell(transaction.description || "Transaction")
            );

            row.appendChild(
                createTableCell(transaction.paymentMethod || "Not specified")
            );

            const amount = Number(transaction.amount);
            const amountCell = createTableCell(
                formatMoney(amount)
            );

            if (Number.isFinite(amount) && amount < 0) {
                amountCell.classList.add("loss-value");
            }

            row.appendChild(amountCell);
            row.appendChild(createTableCell(transaction.status || "Recorded"));

            fragment.appendChild(row);
        });

        tableBody.replaceChildren(fragment);
    }

    function closeMobileMenu() {
        if (!elements.sidebar || !elements.menuToggle) {
            return;
        }

        elements.sidebar.classList.remove("open");
        elements.menuToggle.setAttribute("aria-expanded", "false");
    }

    function toggleMobileMenu() {
        if (!elements.sidebar || !elements.menuToggle) {
            return;
        }

        const isOpen = elements.sidebar.classList.toggle("open");

        elements.menuToggle.setAttribute(
            "aria-expanded",
            String(isOpen)
        );
    }

    function setupNavigation() {
        if (elements.menuToggle) {
            elements.menuToggle.addEventListener(
                "click",
                toggleMobileMenu
            );
        }

        document.querySelectorAll(".nav-link").forEach((link) => {
            link.addEventListener("click", () => {
                document.querySelectorAll(".nav-link").forEach((item) => {
                    item.classList.remove("active");
                    item.removeAttribute("aria-current");
                });

                link.classList.add("active");
                link.setAttribute("aria-current", "page");

                closeMobileMenu();
            });
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                closeMobileMenu();
            }
        });

        document.addEventListener("click", (event) => {
            if (
                !elements.sidebar ||
                !elements.menuToggle ||
                !elements.sidebar.classList.contains("open")
            ) {
                return;
            }

            const clickedInsideSidebar = elements.sidebar.contains(event.target);
            const clickedToggle = elements.menuToggle.contains(event.target);

            if (!clickedInsideSidebar && !clickedToggle) {
                closeMobileMenu();
            }
        });

        window.addEventListener("resize", () => {
            if (window.innerWidth > 760) {
                closeMobileMenu();
            }
        });
    }

    function setupDate() {
        if (!elements.reportDate) {
            return;
        }

        elements.reportDate.value = getLocalDateInputValue();

        elements.reportDate.addEventListener("change", () => {
            const selectedDate = elements.reportDate.value;

            if (!selectedDate) {
                return;
            }

            document.dispatchEvent(
                new CustomEvent("biashara:report-date-changed", {
                    detail: {
                        date: selectedDate
                    }
                })
            );
        });
    }

    function setupRefresh() {
        if (!elements.refreshDashboard) {
            return;
        }

        elements.refreshDashboard.addEventListener("click", async () => {
            if (state.isLoading) {
                return;
            }

            state.isLoading = true;
            elements.refreshDashboard.disabled = true;
            elements.refreshDashboard.textContent = "Refreshing...";

            try {
                document.dispatchEvent(
                    new CustomEvent("biashara:refresh-requested")
                );

                renderDashboard();
                renderStock();
                renderTransactions();
            } finally {
                state.isLoading = false;
                elements.refreshDashboard.disabled = false;
                elements.refreshDashboard.textContent = "Refresh";
            }
        });
    }

    function initialize() {
        cacheElements();
        setupNavigation();
        setupDate();
        setupRefresh();

        renderDashboard();
        renderStock();
        renderTransactions();
    }

    function updateDashboard(data) {
        if (!data || typeof data !== "object") {
            return;
        }

        const keys = [
            "todaySales",
            "todayProfit",
            "todayLosses",
            "cashBalance",
            "customerDebts",
            "supplierCreditors"
        ];

        keys.forEach((key) => {
            if (data[key] !== undefined) {
                const value = Number(data[key]);

                if (Number.isFinite(value)) {
                    state.dashboard[key] = value;
                }
            }
        });

        renderDashboard();
    }

    function updateStock(items) {
        if (!Array.isArray(items)) {
            return;
        }

        state.stock = items.map((item) => ({
            name: String(item.name || "Unnamed product"),
            category: String(item.category || "Uncategorised"),
            quantity: Number(item.quantity) || 0,
            reorderLevel: Number(item.reorderLevel ?? 5)
        }));

        renderStock();
    }

    function updateTransactions(items) {
        if (!Array.isArray(items)) {
            return;
        }

        state.transactions = items.map((item) => ({
            date: item.date || null,
            description: String(item.description || "Transaction"),
            paymentMethod: String(item.paymentMethod || "Not specified"),
            amount: Number(item.amount) || 0,
            status: String(item.status || "Recorded")
        }));

        renderTransactions();
    }

    function getSelectedDate() {
        return elements.reportDate?.value || getLocalDateInputValue();
    }

    function getStateSnapshot() {
        return {
            dashboard: { ...state.dashboard },
            stock: state.stock.map((item) => ({ ...item })),
            transactions: state.transactions.map((item) => ({ ...item })),
            selectedDate: getSelectedDate()
        };
    }

    document.addEventListener("DOMContentLoaded", initialize);

    return {
        formatMoney,
        formatDate,
        updateDashboard,
        updateStock,
        updateTransactions,
        getSelectedDate,
        getStateSnapshot
    };
})();

/* Public interface for future frontend modules. */
window.BiasharaExpress = BiasharaExpress;

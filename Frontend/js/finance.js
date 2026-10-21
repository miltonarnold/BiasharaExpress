'use strict';

const FINANCE_KEY = 'biasharaExpressFinance';
const SALES_KEY = 'biasharaExpressSales';

let activeFinanceType = 'capital';
let databaseReady = false;

const financeCategories = {
    capital: [
        'Owner Capital',
        'Additional Investment',
        'Loan Received',
        'Other Capital'
    ],
    expense: [
        'Stock Transport',
        'Rent',
        'Electricity',
        'Water',
        'Wages',
        'Packaging',
        'Market Fees',
        'Repairs',
        'Other Expense'
    ],
    withdrawal: [
        'Owner Withdrawal',
        'Personal Use',
        'Other Withdrawal'
    ]
};

function readFinanceData(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

function writeFinanceData(data) {
    localStorage.setItem(FINANCE_KEY, JSON.stringify(data));
}

function financeMoney(value) {
    return 'KSh ' + (Number(value) || 0).toLocaleString('en-KE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function financeEscape(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

function financeToday() {
    const now = new Date();
    return [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0')
    ].join('-');
}

function financeNotice(message, isError = false) {
    const notice = document.getElementById('financeNotice');
    if (!notice) {
        alert(message);
        return;
    }

    notice.textContent = message;
    notice.style.color = isError ? '#b42318' : '';
}

function setFinanceText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function getSalesTotals(from = '', to = '') {
    const sales = readFinanceData(SALES_KEY).filter(sale => {
        const date = String(sale.date || '').slice(0, 10);
        return (!from || date >= from) && (!to || date <= to);
    });

    let revenue = 0;
    let cogs = 0;

    sales.forEach(sale => {
        revenue += Number(sale.total) || 0;

        const items = Array.isArray(sale.items) ? sale.items : [];
        items.forEach(item => {
            cogs += (Number(item.cost) || 0) *
                    (Number(item.quantity) || 0);
        });
    });

    return { revenue, cogs };
}

function getFinanceTotals(from = '', to = '') {
    const transactions = readFinanceData(FINANCE_KEY).filter(item => {
        const date = String(item.date || '').slice(0, 10);
        return (!from || date >= from) && (!to || date <= to);
    });

    const capital = transactions
        .filter(item => item.type === 'capital')
        .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    const withdrawals = transactions
        .filter(item => item.type === 'withdrawal')
        .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    const expenses = transactions
        .filter(item => item.type === 'expense')
        .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    const sales = getSalesTotals(from, to);
    const gross = sales.revenue - sales.cogs;

    return {
        capital,
        withdrawals,
        revenue: sales.revenue,
        cogs: sales.cogs,
        gross,
        expenses,
        net: gross - expenses
    };
}

function renderFinanceSummary() {
    const totals = getFinanceTotals();

    setFinanceText('financeCapital', financeMoney(totals.capital));
    setFinanceText('financeWithdrawals', financeMoney(totals.withdrawals));
    setFinanceText('financeRevenue', financeMoney(totals.revenue));
    setFinanceText('financeExpenses', financeMoney(totals.expenses));
    setFinanceText('financeNetProfit', financeMoney(totals.net));

    renderFinanceReport();
}

function renderFinanceReport() {
    const from = document.getElementById('reportFrom')?.value || '';
    const to = document.getElementById('reportTo')?.value || '';

    if (from && to && from > to) {
        financeNotice('The report start date must not be after the end date.', true);
        return;
    }

    const totals = getFinanceTotals(from, to);

    setFinanceText('reportCapital', financeMoney(totals.capital));
    setFinanceText('reportRevenue', financeMoney(totals.revenue));
    setFinanceText('reportCogs', financeMoney(totals.cogs));
    setFinanceText('reportGross', financeMoney(totals.gross));
    setFinanceText('reportExpenses', financeMoney(totals.expenses));
    setFinanceText('reportNet', financeMoney(totals.net));
}

function populateFinanceCategories(selected = '') {
    const select = document.getElementById('financeCategory');
    if (!select) return;

    const categories = financeCategories[activeFinanceType] || [];
    select.innerHTML = '<option value="">Select category</option>' +
        categories.map(category =>
            `<option value="${financeEscape(category)}">${financeEscape(category)}</option>`
        ).join('');

    if (selected && !categories.includes(selected)) {
        select.insertAdjacentHTML(
            'beforeend',
            `<option value="${financeEscape(selected)}">${financeEscape(selected)}</option>`
        );
    }

    select.value = selected || '';
}

function setFinanceTab(type) {
    activeFinanceType = ['capital', 'expense', 'withdrawal'].includes(type)
        ? type
        : 'capital';

    const tabIds = {
        capital: 'capitalTab',
        expense: 'expenseTab',
        withdrawal: 'withdrawalTab'
    };

    Object.entries(tabIds).forEach(([tabType, id]) => {
        const tab = document.getElementById(id);
        if (!tab) return;
        const active = activeFinanceType === tabType;
        tab.classList.toggle('active', active);
        tab.classList.toggle('finance-primary', active);
        tab.classList.toggle('finance-secondary', !active);
    });

    populateFinanceCategories();

    const description = document.getElementById('financeDescription');
    if (description) {
        description.placeholder =
            activeFinanceType === 'capital' ? 'e.g. Initial business capital' :
            activeFinanceType === 'expense' ? 'e.g. Transport for stock' :
            'e.g. Money taken for personal use';
    }

    financeNotice(
        activeFinanceType === 'capital' ? 'Recording capital or investment.' :
        activeFinanceType === 'expense' ? 'Recording a business expense.' :
        'Recording an owner withdrawal.'
    );
}

function resetFinanceForm() {
    const form = document.getElementById('financeForm');
    if (form) form.reset();

    const editId = document.getElementById('financeEditId');
    if (editId) editId.value = '';

    const date = document.getElementById('financeDate');
    if (date) date.value = financeToday();

    const saveButton = document.getElementById('financeSaveButton');
    if (saveButton) saveButton.textContent = 'Save transaction';

    const cancelButton = document.getElementById('financeCancelButton');
    if (cancelButton) cancelButton.hidden = true;

    populateFinanceCategories();
}

async function saveFinanceTransaction(event) {
    event.preventDefault();

    if (!databaseReady) {
        financeNotice('Database is not ready. Please wait and try again.', true);
        return;
    }

    const description = document.getElementById('financeDescription').value.trim();
    const amount = Number(document.getElementById('financeAmount').value);
    const date = document.getElementById('financeDate').value;
    const category = document.getElementById('financeCategory').value;
    const paymentMethod = document.getElementById('financeMethod').value;
    const reference = document.getElementById('financeReference').value.trim();
    const editId = document.getElementById('financeEditId').value;

    if (!description || !date || !category) {
        financeNotice('Please complete the description, date, and category.', true);
        return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        financeNotice('Enter an amount greater than zero.', true);
        return;
    }

    const transactions = readFinanceData(FINANCE_KEY);
    const transaction = {
        id: editId || (
            typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : String(Date.now()) + '-' + Math.random().toString(36).slice(2)
        ),
        type: activeFinanceType,
        description,
        amount,
        date,
        category,
        paymentMethod,
        reference
    };

    const existingIndex = transactions.findIndex(
        item => String(item.id) === String(editId)
    );

    if (editId && existingIndex !== -1) {
        transactions[existingIndex] = transaction;
    } else {
        transactions.push(transaction);
    }

    try {
        await persistFinanceData(transactions);
    } catch (error) {
        console.error('Finance transaction save failed:', error);
        financeNotice('Could not save the transaction. Your previous data has been preserved.', true);
        return;
    }

    resetFinanceForm();
    renderFinanceAll();
    financeNotice(editId ? 'Transaction updated successfully.' : 'Transaction saved successfully.');
}
function editFinanceTransaction(id) {
    const transaction = readFinanceData(FINANCE_KEY).find(
        item => String(item.id) === String(id)
    );

    if (!transaction) {
        financeNotice('Transaction not found.', true);
        return;
    }

    activeFinanceType = ['capital', 'expense', 'withdrawal'].includes(transaction.type) ? transaction.type : 'capital';
    setFinanceTab(activeFinanceType);

    document.getElementById('financeEditId').value = transaction.id;
    document.getElementById('financeDescription').value = transaction.description || '';
    document.getElementById('financeAmount').value = transaction.amount || '';
    document.getElementById('financeDate').value = transaction.date || financeToday();
    document.getElementById('financeMethod').value = transaction.paymentMethod || '';
    document.getElementById('financeReference').value = transaction.reference || '';

    populateFinanceCategories(transaction.category || '');

    const saveButton = document.getElementById('financeSaveButton');
    if (saveButton) saveButton.textContent = 'Update transaction';

    const cancelButton = document.getElementById('financeCancelButton');
    if (cancelButton) cancelButton.hidden = false;

    document.getElementById('financeForm').scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

async function deleteFinanceTransaction(id) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    if (!databaseReady) {
        financeNotice('Database is not ready. Please wait and try again.', true);
        return;
    }

    const transactions = readFinanceData(FINANCE_KEY);
    const updatedTransactions = transactions.filter(
        item => String(item.id) !== String(id)
    );

    try {
        await persistFinanceData(updatedTransactions);
    } catch (error) {
        console.error('Finance transaction deletion failed:', error);
        financeNotice('Could not delete the transaction. Your previous data has been preserved.', true);
        return;
    }

    resetFinanceForm();
    renderFinanceAll();
    financeNotice('Transaction deleted.');
}
function renderFinanceRows() {
    const body = document.getElementById('financeRows');
    if (!body) return;

    const query = (document.getElementById('financeSearch').value || '')
        .trim().toLowerCase();
    const filter = document.getElementById('financeTypeFilter').value;

    const transactions = readFinanceData(FINANCE_KEY)
        .filter(item => !filter || filter === 'all' || item.type === filter)
        .filter(item => [
            item.description, item.category, item.reference,
            item.paymentMethod, item.date, item.type
        ].some(value => String(value || '').toLowerCase().includes(query)))
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    if (!transactions.length) {
        body.innerHTML = '<tr><td colspan="8">No transactions found.</td></tr>';
        return;
    }

    body.innerHTML = transactions.map(item => `
        <tr>
            <td>${financeEscape(item.date)}</td>
            <td>${item.type === 'capital' ? 'Capital' : item.type === 'withdrawal' ? 'Owner Withdrawal' : 'Expense'}</td>
            <td>${financeEscape(item.description)}</td>
            <td>${financeEscape(item.category || '-')}</td>
            <td>${financeEscape(item.paymentMethod || '-')}</td>
            <td>${financeMoney(item.amount)}</td>
            <td>${financeEscape(item.reference || '-')}</td>
            <td>
                <button type="button" class="finance-button finance-secondary"
                    data-finance-edit="${financeEscape(item.id)}">Edit</button>
                <button type="button" class="finance-button finance-secondary"
                    data-finance-delete="${financeEscape(item.id)}">Delete</button>
            </td>
        </tr>
    `).join('');
}

function exportFinanceCSV() {
    const transactions = readFinanceData(FINANCE_KEY);

    if (!transactions.length) {
        financeNotice('There are no transactions to export.', true);
        return;
    }

    const columns = [
        'date', 'type', 'description', 'category',
        'amount', 'paymentMethod', 'reference'
    ];

    const csvCell = value =>
        '"' + String(value ?? '').replace(/"/g, '""') + '"';

    const csv = [
        columns.join(','),
        ...transactions.map(item =>
            columns.map(column => csvCell(item[column])).join(',')
        )
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], {
        type: 'text/csv;charset=utf-8;'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'biashara-express-finance.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    financeNotice('CSV export started.');
}

async function persistFinanceData(data) {
    const previousValue = localStorage.getItem(FINANCE_KEY);
    const db = window.BiasharaSQLite;

    if (!databaseReady || !db) {
        throw new Error('SQLite is not ready.');
    }

    try {
        writeFinanceData(data);

        await db.put(FINANCE_KEY, data, {
            sync: true,
            entity: 'finance',
            recordId: FINANCE_KEY
        });
    } catch (error) {
        try {
            if (previousValue === null) {
                localStorage.removeItem(FINANCE_KEY);
            } else {
                localStorage.setItem(FINANCE_KEY, previousValue);
            }
        } catch (restoreError) {
            console.error('Finance local data restoration failed:', restoreError);
        }

        throw error;
    }
}

async function initializeFinance() {
    try {
        const db = window.BiasharaSQLite;

        if (!db) {
            throw new Error('SQLite adapter is unavailable.');
        }

        await db.init();

        // Read existing database records before writing anything.
        const storedFinance = await db.get(FINANCE_KEY);
        const storedSales = await db.get(SALES_KEY);

        let transactions;
        if (Array.isArray(storedFinance)) {
            transactions = storedFinance;
        } else {
            transactions = readFinanceData(FINANCE_KEY);
            await db.put(FINANCE_KEY, transactions, {
                sync: false,
                entity: 'finance',
                recordId: FINANCE_KEY
            });
        }

        // Keep existing Finance calculations compatible with localStorage.
        localStorage.setItem(FINANCE_KEY, JSON.stringify(transactions));

        if (Array.isArray(storedSales)) {
            localStorage.setItem(SALES_KEY, JSON.stringify(storedSales));
        } else {
            const existingSales = readFinanceData(SALES_KEY);
            if (existingSales.length > 0) {
                await db.put(SALES_KEY, existingSales, {
                    sync: false
                });
            }
            localStorage.setItem(SALES_KEY, JSON.stringify(existingSales));
        }

        databaseReady = true;
        setFinanceTab('capital');
        renderFinanceAll();
    } catch (error) {
        databaseReady = false;
        console.error('Finance SQLite initialization failed:', error);
        financeNotice('SQLite could not initialize. Finance changes cannot be saved safely.', true);
    }
}
function renderFinanceAll() {
    renderFinanceSummary();
    renderFinanceRows();
}

function initializeFinancePage() {
    document.getElementById('capitalTab')
        ?.addEventListener('click', () => setFinanceTab('capital'));

    document.getElementById('expenseTab')
        ?.addEventListener('click', () => setFinanceTab('expense'));

    document.getElementById('withdrawalTab')
        ?.addEventListener('click', () => setFinanceTab('withdrawal'));

    document.getElementById('financeForm')
        ?.addEventListener('submit', saveFinanceTransaction);

    document.getElementById('financeCancelButton')
        ?.addEventListener('click', resetFinanceForm);

    document.getElementById('financeSearch')
        ?.addEventListener('input', renderFinanceRows);

    document.getElementById('financeTypeFilter')
        ?.addEventListener('change', renderFinanceRows);

    document.getElementById('financeExportButton')
        ?.addEventListener('click', exportFinanceCSV);

    document.getElementById('financeReportButton')
        ?.addEventListener('click', renderFinanceReport);

    document.getElementById('financeResetReport')
        ?.addEventListener('click', () => {
            document.getElementById('reportFrom').value = '';
            document.getElementById('reportTo').value = '';
            renderFinanceReport();
            financeNotice('Showing all dates.');
        });

    document.addEventListener('click', event => {
        const editButton = event.target.closest('[data-finance-edit]');
        const deleteButton = event.target.closest('[data-finance-delete]');

        if (editButton) editFinanceTransaction(editButton.dataset.financeEdit);
        if (deleteButton) deleteFinanceTransaction(deleteButton.dataset.financeDelete);
    });

    const date = document.getElementById('financeDate');
    if (date && !date.value) date.value = financeToday();

    initializeFinance();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeFinancePage, { once: true });
} else {
    initializeFinancePage();
}

// FINANCE_DELEGATED_TAB_FIX
document.addEventListener('click', function (event) {
    const tab = event.target.closest(
        '#capitalTab, #expenseTab, #withdrawalTab'
    );

    if (!tab) return;

    const tabTypes = {
        capitalTab: 'capital',
        expenseTab: 'expense',
        withdrawalTab: 'withdrawal'
    };

    const type = tabTypes[tab.id];
    if (type) setFinanceTab(type);
});
window.renderFinance = renderFinanceAll;





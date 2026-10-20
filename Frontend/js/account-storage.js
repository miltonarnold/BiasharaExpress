(function () {
    "use strict";

    const SESSION_KEY = "biasharaExpressAuthSession";
    const PREFIX = "biasharaExpressAccount:";
    const BUSINESS_KEYS = new Set([
        "biasharaExpressProducts",
        "biasharaExpressSales",
        "biasharaExpressPurchases",
        "biasharaExpressCustomers",
        "biasharaExpressSuppliers",
        "biasharaExpressDebts",
        "biasharaExpressRepayments",
        "biasharaExpressFinance",
        "biasharaExpressIdentity",
        "biasharaExpressSettings",
        "biasharaExpressSecurityPreferences"
    ]);

    function getAccountId() {
        try {
            const session = JSON.parse(
                Storage.prototype.getItem.call(localStorage, SESSION_KEY) || "null"
            );

            return typeof session?.account?.id === "string"
                ? session.account.id
                : null;
        } catch {
            return null;
        }
    }

    function scopedKey(key) {
        const name = String(key);

        if (!BUSINESS_KEYS.has(name)) {
            return name;
        }

        const accountId = getAccountId();

        // Leave legacy data unmodified when no account is authenticated.
        if (!accountId) {
            return name;
        }

        return PREFIX + accountId + ":" + name;
    }

    const original = {
        getItem: Storage.prototype.getItem,
        setItem: Storage.prototype.setItem,
        removeItem: Storage.prototype.removeItem
    };

    Storage.prototype.getItem = function (key) {
        if (this !== localStorage) {
            return original.getItem.call(this, key);
        }

        return original.getItem.call(this, scopedKey(key));
    };

    Storage.prototype.setItem = function (key, value) {
        if (this !== localStorage) {
            return original.setItem.call(this, key, value);
        }

        return original.setItem.call(this, scopedKey(key), value);
    };

    Storage.prototype.removeItem = function (key) {
        if (this !== localStorage) {
            return original.removeItem.call(this, key);
        }

        return original.removeItem.call(this, scopedKey(key));
    };

    window.BiasharaAccountStorage = Object.freeze({
        getAccountId,
        getScopedKey: scopedKey,
        isAuthenticated: () => Boolean(getAccountId())
    });
})();

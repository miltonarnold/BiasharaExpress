(function () {
    "use strict";

    const QUEUE_LIMIT = 100;
    const SYNC_INTERVAL_MS = 15000;
    const API_SETTING_KEY = "biasharaExpressApiBaseUrl";

    const CATEGORIES = [
        { entity: "products", key: "biasharaExpressProducts" },
        { entity: "customers", key: "biasharaExpressCustomers" },
        { entity: "suppliers", key: "biasharaExpressSuppliers" },
        { entity: "sales", key: "biasharaExpressSales" },
        { entity: "purchases", key: "biasharaExpressPurchases" },
        { entity: "debts", key: "biasharaExpressDebts" },
        { entity: "repayments", key: "biasharaExpressRepayments" },
        { entity: "finance", key: "biasharaExpressFinance" }
    ];

    let syncing = false;

    function getApiBaseUrl() {
        const configured = localStorage.getItem(API_SETTING_KEY);

        return configured && configured.trim()
            ? configured.trim().replace(/\/+$/, "")
            : "https://biasharaexpress-backend.onrender.com";
    }

    async function downloadInitialData(auth, db, session, accountId) {
        const pending = await db.getPending(500, accountId);
        const pendingEntities = new Set(pending.map(item => item.entity));
        let downloaded = 0;

        for (const category of CATEGORIES) {
            if (pendingEntities.has(category.entity)) {
                continue;
            }

            const localValue = await db.get(category.key);

            // Only populate missing or empty categories. Never replace
            // existing non-empty local data during initial download.
            if (
                localValue !== null &&
                localValue !== undefined &&
                !(Array.isArray(localValue) && localValue.length === 0)
            ) {
                continue;
            }

            try {
                const response = await fetch(
                    getApiBaseUrl() + "/api/sync/" + category.entity,
                    {
                        method: "GET",
                        headers: {
                            "Accept": "application/json",
                            "Authorization": "Bearer " + session.token
                        }
                    }
                );

                if (response.status === 401) {
                    auth.clearSession();
                    return;
                }

                if (!response.ok) {
                    throw new Error("HTTP " + response.status);
                }

                const records = await response.json();

                if (!Array.isArray(records)) {
                    throw new Error("Unexpected server response.");
                }

                const matchingRecord = records.find(
                    record => record.recordId === category.key
                );

                if (!matchingRecord || matchingRecord.payload == null) {
                    continue;
                }

                // Recheck the queue immediately before saving.
                const latestPending = await db.getPending(500, accountId);

                if (
                    latestPending.some(
                        item => item.entity === category.entity
                    )
                ) {
                    continue;
                }

                const latestLocalValue = await db.get(category.key);

                if (
                    latestLocalValue !== null &&
                    latestLocalValue !== undefined &&
                    !(Array.isArray(latestLocalValue) &&
                      latestLocalValue.length === 0)
                ) {
                    continue;
                }

                await db.put(
                    category.key,
                    matchingRecord.payload,
                    { sync: false }
                );

                downloaded++;
            } catch (error) {
                console.warn(
                    "BiasharaExpress download failed for " +
                    category.entity + ":",
                    error.message
                );
            }
        }

        if (downloaded > 0) {
            console.info(
                "BiasharaExpress initial download:",
                downloaded,
                "categories populated."
            );
        }
    }

    async function synchronize() {
        if (syncing || !navigator.onLine) {
            return;
        }

        const auth = window.BiasharaAuth;
        const db = window.BiasharaSQLite;

        if (!auth || !db) {
            return;
        }

        const session = auth.getSession();

        if (!session || !session.token || !session.account?.id) {
            return;
        }

        syncing = true;

        try {
            if (!(await auth.validateSession())) {
                return;
            }

            const accountId = session.account.id;

            await db.init();

            const pending = await db.getPending(
                QUEUE_LIMIT,
                accountId
            );

            if (pending.length > 0) {
                const response = await fetch(
                    getApiBaseUrl() + "/api/sync/batch",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Accept": "application/json",
                            "Authorization": "Bearer " + session.token
                        },
                        body: JSON.stringify(pending)
                    }
                );

                if (response.status === 401) {
                    auth.clearSession();
                    return;
                }

                if (!response.ok) {
                    throw new Error(
                        "Sync server returned HTTP " + response.status
                    );
                }

                const result = await response.json();
                const syncedIds = new Set(result.syncedIds || []);
                const failures = new Map(
                    (result.failures || []).map(item => [
                        item.id,
                        item.error || "Synchronization failed."
                    ])
                );

                for (const item of pending) {
                    if (syncedIds.has(item.id)) {
                        await db.markSynced(item.id, accountId);
                    } else {
                        await db.recordSyncFailure(
                            item.id,
                            accountId,
                            failures.get(item.id) ||
                            "The server did not confirm this item."
                        );
                    }
                }

                console.info(
                    "BiasharaExpress upload:",
                    syncedIds.size,
                    "confirmed;",
                    pending.length - syncedIds.size,
                    "pending or failed."
                );
            }

            // Pull initial data even when there was nothing to upload.
            await downloadInitialData(auth, db, session, accountId);
        } catch (error) {
            console.warn(
                "BiasharaExpress synchronization unavailable:",
                error.message
            );
        } finally {
            syncing = false;
        }
    }

    window.BiasharaSync = Object.freeze({
        synchronize,
        getApiBaseUrl
    });

    window.addEventListener("online", synchronize);
    window.addEventListener("biashara:session-changed", synchronize);

    synchronize();
    window.setInterval(synchronize, SYNC_INTERVAL_MS);
})();

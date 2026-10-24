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
        function hasData(value) {
            return value !== null &&
                value !== undefined &&
                !(Array.isArray(value) && value.length === 0);
        }

        function readBrowserValue(key) {
            const raw = localStorage.getItem(key);

            if (raw === null) {
                return { valid: true, value: null };
            }

            try {
                return { valid: true, value: JSON.parse(raw) };
            } catch {
                return { valid: false, value: null };
            }
        }

        const pending = await db.getPending(500, accountId);
        const pendingEntities = new Set(
            pending.map(item => item.entity)
        );
        let downloaded = 0;
        let restored = 0;

        for (const category of CATEGORIES) {
            try {
                const localValue = await db.get(category.key);
                const browser = readBrowserValue(category.key);

                if (!browser.valid) {
                    console.warn(
                        "BiasharaExpress: local browser data could not be parsed for " +
                        category.entity + "; leaving it unchanged."
                    );
                    continue;
                }

                // Restore the screen-readable store from valid SQLite data.
                if (hasData(localValue)) {
                    if (!hasData(browser.value)) {
                        localStorage.setItem(
                            category.key,
                            JSON.stringify(localValue)
                        );
                        restored++;
                    }
                    continue;
                }

                // Preserve an existing non-empty browser collection.
                if (hasData(browser.value)) {
                    continue;
                }

                // Do not pull server data while this category has queued changes.
                if (pendingEntities.has(category.entity)) {
                    continue;
                }

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
                    console.warn(
                        "Synchronization returned HTTP 401. " +
                        "Local data and queued changes have been preserved."
                    );
                    return;
                }

                console.info("SYNC DIAGNOSTIC: Batch response HTTP status:", response.status);

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

                if (
                    !matchingRecord ||
                    !Array.isArray(matchingRecord.payload)
                ) {
                    continue;
                }

                // Recheck both stores and the queue immediately before restoring.
                const latestPending = await db.getPending(500, accountId);
                if (
                    latestPending.some(
                        item => item.entity === category.entity
                    )
                ) {
                    continue;
                }

                const latestLocalValue = await db.get(category.key);
                const latestBrowser = readBrowserValue(category.key);

                if (
                    !latestBrowser.valid ||
                    hasData(latestLocalValue) ||
                    hasData(latestBrowser.value)
                ) {
                    continue;
                }

                await db.put(
                    category.key,
                    matchingRecord.payload,
                    { sync: false }
                );

                // account-storage.js scopes this write to the active account.
                localStorage.setItem(
                    category.key,
                    JSON.stringify(matchingRecord.payload)
                );

                downloaded++;
            } catch (error) {
                console.warn(
                    "BiasharaExpress download/restore failed for " +
                    category.entity + ":",
                    error.message
                );
            }
        }

        if (restored > 0) {
            console.info(
                "BiasharaExpress: restored " + restored +
                " categories from SQLite to the screen-readable store."
            );
        }

        if (downloaded > 0) {
            console.info(
                "BiasharaExpress: downloaded " + downloaded +
                " categories from the server."
            );
        }
    }
        async function canReachBiasharaBackend(token) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 8000);

        try {
            const response = await fetch(
                getApiBaseUrl() + "/api/sync/products",
                {
                    method: "GET",
                    cache: "no-store",
                    headers: {
                        "Accept": "application/json",
                        "Authorization": "Bearer " + token
                    },
                    signal: controller.signal
                }
            );

            console.info(
                "BiasharaExpress connectivity: backend responded with HTTP",
                response.status
            );
            return true;
        } catch (error) {
            console.warn(
                "BiasharaExpress connectivity: backend unreachable:",
                error.message
            );
            return false;
        } finally {
            window.clearTimeout(timeoutId);
        }
    }
async function synchronize() {
        if (syncing) { return; }

        const auth = window.BiasharaAuth;
        const db = window.BiasharaSQLite;

        if (!auth || !db) {
            console.warn("SYNC DIAGNOSTIC: Auth or SQLite adapter is unavailable.", {
                authAvailable: !!auth,
                sqliteAvailable: !!db
            });
            return;
        }

        const session = auth.getSession();

        if (!session || !session.token || !session.account?.id) {
            console.warn("SYNC DIAGNOSTIC: No complete authenticated session.", {
                sessionAvailable: !!session,
                tokenAvailable: !!session?.token,
                accountIdAvailable: !!session?.account?.id
            });
            return;
        }

        console.info("SYNC DIAGNOSTIC: Session found for account.", session.account.id);

        syncing = true;

        try {
            if (!(await canReachBiasharaBackend(session.token))) { return; }
            const sessionIsValid = await auth.validateSession();
            console.info("SYNC DIAGNOSTIC: Session validation result:", sessionIsValid);
            if (!sessionIsValid) { return; }

            const accountId = session.account.id;

            await db.init();
            // Recover existing non-empty datasets for the active account once.
            const recoveryMarker = "biasharaExpressLegacySyncQueuedV3:" + accountId;

            const recoveryMarkerValue = localStorage.getItem(recoveryMarker);
            console.info("SYNC DIAGNOSTIC: Recovery marker value:", recoveryMarkerValue);

            if (recoveryMarkerValue !== "1") {
                const queuedBeforeRecovery = await db.getPending(500, accountId);
                const queuedKeys = new Set(
                    queuedBeforeRecovery.map(item =>
                        String(item.entity) + "|" +
                        String(item.recordId ?? item.record_id ?? "")
                    )
                );

                for (const category of CATEGORIES) {
                    const queueKey = category.entity + "|" + category.key;

                    if (queuedKeys.has(queueKey)) {
                        continue;
                    }

                    const value = await db.get(category.key);

                    console.info("SYNC DIAGNOSTIC: Local category read:", category.entity, {
                        isArray: Array.isArray(value),
                        valueType: typeof value,
                        recordCount: Array.isArray(value) ? value.length : null
                    });

                    if (!Array.isArray(value) || value.length === 0) {
                        continue;
                    }

                    await db.enqueue({
                        entity: category.entity,
                        recordId: category.key,
                        operation: "upsert",
                        payload: value
                    });

                    queuedKeys.add(queueKey);
                    console.info(
                        "Legacy recovery queued:",
                        category.entity,
                        value.length,
                        "records."
                    );
                }

                localStorage.setItem(recoveryMarker, "1");
                console.info(
                    "Legacy sync recovery queueing completed for the active account."
                );
            }

            const pending = await db.getPending(
                QUEUE_LIMIT,
                accountId
            );

            console.info("SYNC DIAGNOSTIC: Pending queue count:", pending.length);

            if (pending.length > 0) {
                console.info("SYNC DIAGNOSTIC: Sending batch upload.", {
                    endpoint: getApiBaseUrl() + "/api/sync/batch",
                    itemCount: pending.length
                });
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
                    console.warn(
                        "Synchronization returned HTTP 401. Keeping the local session and queued data for diagnosis."
                    );
                    return;
                }

                console.info("SYNC DIAGNOSTIC: Batch response HTTP status:", response.status);

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

// Retry synchronization when the app returns to the foreground.
    document.addEventListener("visibilitychange", function biasharaConnectivityVisibility() {
        if (document.visibilityState === "visible") {
            synchronize();
        }
    });
})();







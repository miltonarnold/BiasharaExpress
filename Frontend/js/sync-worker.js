(function () {
    "use strict";

    const QUEUE_LIMIT = 100;
    const SYNC_INTERVAL_MS = 15000;
    const API_SETTING_KEY = "biasharaExpressApiBaseUrl";

    let syncing = false;

    function getApiBaseUrl() {
        const configured = localStorage.getItem(API_SETTING_KEY);

        if (configured && configured.trim()) {
            return configured.trim().replace(/\/+$/, "");
        }

        const platform = window.Capacitor?.getPlatform?.();

        if (platform === "android") {
            return "http://10.0.2.2:8080";
        }

        return "http://127.0.0.1:8080";
    }

    async function synchronize() {
        if (syncing || !navigator.onLine) return;

        const auth = window.BiasharaAuth;
        const db = window.BiasharaSQLite;

        if (!auth || !db) return;

        const session = auth.getSession();
        if (!session || !session.token || !session.account?.id) return;

        if (!(await auth.validateSession())) return;

        const accountId = session.account.id;
        syncing = true;

        try {
            await db.init();

            const pending = await db.getPending(QUEUE_LIMIT, accountId);
            if (!pending.length) return;

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
                "BiasharaExpress sync:",
                syncedIds.size,
                "confirmed;",
                pending.length - syncedIds.size,
                "pending or failed."
            );
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
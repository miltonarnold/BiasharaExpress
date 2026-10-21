(function () {
    "use strict";

    const DB_NAME = "biashara_express_browser";
    const DB_VERSION = 1;
    const SESSION_KEY = "biasharaExpressAuthSession";
    const PREFIX = "biasharaExpressAccountRecord:";
    const RECORDS = "records";
    const QUEUE = "syncQueue";
    let dbPromise = null;

    function accountId(expected) {
        const raw = Storage.prototype.getItem.call(localStorage, SESSION_KEY);
        if (!raw) throw new Error("An authenticated account is required.");

        let session;
        try {
            session = JSON.parse(raw);
        } catch {
            throw new Error("The saved account session is invalid.");
        }

        if (!session.token || !session.account || session.account.id == null) {
            throw new Error("An authenticated account is required.");
        }

        const id = String(session.account.id);
        if (expected != null && String(expected) !== id) {
            throw new Error("Account mismatch. Operation rejected.");
        }
        return id;
    }

    function openDb() {
        if (dbPromise) return dbPromise;

        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(RECORDS)) {
                    db.createObjectStore(RECORDS, { keyPath: "key" });
                }
                if (!db.objectStoreNames.contains(QUEUE)) {
                    const store = db.createObjectStore(QUEUE, {
                        keyPath: "id",
                        autoIncrement: true
                    });
                    store.createIndex("accountId", "accountId", { unique: false });
                }
            };

            request.onsuccess = () => {
                request.result.onversionchange = () => {
                    request.result.close();
                    dbPromise = null;
                };
                resolve(request.result);
            };

            request.onerror = () => {
                dbPromise = null;
                reject(request.error || new Error("Could not open IndexedDB."));
            };

            request.onblocked = () => {
                reject(new Error("IndexedDB upgrade is blocked by another tab."));
            };
        });

        return dbPromise;
    }

    function req(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function makeId() {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
            return window.crypto.randomUUID();
        }

        return "queue-" + Date.now().toString(36) + "-" +
            Math.random().toString(36).slice(2) + "-" +
            Math.random().toString(36).slice(2);
    }
    function recordKey(key, id) {
        return PREFIX + id + ":" + String(key);
    }

    async function init() {
        await openDb();
        return true;
    }

    async function get(key) {
        const id = accountId();
        const db = await openDb();
        const tx = db.transaction(RECORDS, "readonly");
        const item = await req(tx.objectStore(RECORDS).get(recordKey(key, id)));
        return !item || item.deleted ? null : item.value;
    }

    async function getAll() {
        const id = accountId();
        const db = await openDb();
        const tx = db.transaction(RECORDS, "readonly");
        const items = await req(tx.objectStore(RECORDS).getAll());
        const prefix = PREFIX + id + ":";

        return items
            .filter(item => item.key.startsWith(prefix) && !item.deleted)
            .map(item => ({
                key: item.key.slice(prefix.length),
                value: item.value
            }));
    }

    async function enqueue(item) {
        const id = accountId();
        if (!item || !item.entity || item.recordId == null ||
            !["upsert", "delete"].includes(item.operation)) {
            throw new Error("Invalid synchronization queue item.");
        }

        const db = await openDb();
        const tx = db.transaction(QUEUE, "readwrite");
        const result = await req(tx.objectStore(QUEUE).add({
            id: makeId(),
            accountId: id,
            entity: String(item.entity),
            recordId: String(item.recordId),
            operation: item.operation,
            payload: item.payload === undefined ? null : item.payload,
            createdAt: item.createdAt || new Date().toISOString(),
            attempts: 0
        }));

        return result;
    }

    async function put(key, value, options = {}) {
        const id = accountId();
        const db = await openDb();
        const tx = db.transaction(RECORDS, "readwrite");
        tx.objectStore(RECORDS).put({
            key: recordKey(key, id),
            value,
            deleted: false,
            updatedAt: new Date().toISOString()
        });

        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error("Write aborted."));
        });

        if (options.sync === true) {
            await enqueue({
                entity: options.entity || "record",
                recordId: options.recordId == null ? key : options.recordId,
                operation: "upsert",
                payload: value
            });
        }
        return value;
    }

    async function putMany(items) {
        if (!Array.isArray(items)) throw new Error("putMany expects an array.");
        for (const item of items) {
            if (!item || item.key == null) {
                throw new Error("Each record must have a key.");
            }
            await put(item.key, item.value, {
                sync: item.sync === true,
                entity: item.entity,
                recordId: item.recordId
            });
        }
        return true;
    }

    async function remove(key, options = {}) {
        const id = accountId();
        const db = await openDb();
        const tx = db.transaction(RECORDS, "readwrite");
        tx.objectStore(RECORDS).put({
            key: recordKey(key, id),
            value: null,
            deleted: true,
            updatedAt: new Date().toISOString()
        });

        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error("Delete aborted."));
        });

        if (options.sync === true) {
            await enqueue({
                entity: options.entity || "record",
                recordId: options.recordId == null ? key : options.recordId,
                operation: "delete",
                payload: null
            });
        }
        return true;
    }

    async function getPending(limit = 100, expectedAccountId) {
        const id = accountId(expectedAccountId);
        const db = await openDb();
        const tx = db.transaction(QUEUE, "readonly");
        const items = await req(
            tx.objectStore(QUEUE).index("accountId").getAll(id)
        );

        return items
            .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
            .slice(0, Math.max(0, Number(limit) || 0))
            .map(item => ({
                id: String(item.id),
                entity: item.entity,
                recordId: item.recordId,
                operation: item.operation,
                payload: item.payload,
                createdAt: item.createdAt,
                attempts: item.attempts
            }));
    }

    async function markSynced(queueId, expectedAccountId) {
        const id = accountId(expectedAccountId);
        const db = await openDb();
        const tx = db.transaction(QUEUE, "readwrite");
        const store = tx.objectStore(QUEUE);
        const item = await req(store.get(String(queueId)));

        if (item && item.accountId === id) store.delete(item.id);

        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error("Queue update aborted."));
        });
        return true;
    }

    async function recordSyncFailure(queueId, expectedAccountId, error) {
        const id = accountId(expectedAccountId);
        const db = await openDb();
        const tx = db.transaction(QUEUE, "readwrite");
        const store = tx.objectStore(QUEUE);
        const item = await req(store.get(String(queueId)));

        if (item && item.accountId === id) {
            item.attempts = (Number(item.attempts) || 0) + 1;
            item.lastError = String(error || "Synchronization failed");
            item.lastAttemptAt = new Date().toISOString();
            store.put(item);
        }

        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error("Queue update aborted."));
        });
        return true;
    }

    async function healthCheck() {
        try {
            await openDb();
            return { ready: true, database: DB_NAME };
        } catch (error) {
            return {
                ready: false,
                database: DB_NAME,
                error: String(error && error.message || error)
            };
        }
    }

    window.BiasharaSQLite = Object.freeze({
        init, get, getAll, put, putMany, remove, enqueue,
        getPending, markSynced, recordSyncFailure, healthCheck
    });
})();


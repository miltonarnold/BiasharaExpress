import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

const DATABASE_NAME = 'biashara_express';
const DATABASE_VERSION = 1;
const SESSION_KEY = 'biasharaExpressAuthSession';
const ACCOUNT_RECORD_PREFIX = 'biasharaExpressAccountRecord:';

let connection;
let initializationPromise;

function getActiveSession() {
    try {
        const session = JSON.parse(
            localStorage.getItem(SESSION_KEY) || 'null'
        );

        if (
            !session ||
            typeof session.token !== 'string' ||
            !session.token ||
            typeof session.account?.id !== 'string' ||
            !session.account.id
        ) {
            return null;
        }

        if (session.expiresAt) {
            const expiresAt = Date.parse(session.expiresAt);
            if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
                return null;
            }
        }

        return session;
    } catch {
        return null;
    }
}

function requireAccountId(expectedAccountId) {
    const session = getActiveSession();

    if (!session) {
        throw new Error('Log in with a valid account before accessing business data.');
    }

    const accountId = session.account.id;

    if (expectedAccountId && expectedAccountId !== accountId) {
        throw new Error('The active account changed. Retry the operation.');
    }

    return accountId;
}

function accountRecordPrefix(accountId) {
    return ACCOUNT_RECORD_PREFIX + accountId + ':';
}

function scopedRecordKey(key) {
    const accountId = requireAccountId();
    return accountRecordPrefix(accountId) + String(key);
}

function requireConnection() {
    if (!connection) {
        throw new Error('SQLite is not initialized. Call BiasharaSQLite.init() first.');
    }

    return connection;
}

async function initialize() {
    if (!Capacitor.isNativePlatform()) {
        throw new Error(
            'Native SQLite is intended for the Android app. Browser database support must be configured separately.'
        );
    }

    const sqlite = new SQLiteConnection(CapacitorSQLite);
    const consistency = await sqlite.checkConnectionsConsistency();
    const exists = await sqlite.isConnection(DATABASE_NAME, false);

    if (consistency.result && exists.result) {
        connection = await sqlite.retrieveConnection(DATABASE_NAME, false);
    } else {
        connection = await sqlite.createConnection(
            DATABASE_NAME,
            false,
            'no-encryption',
            DATABASE_VERSION,
            false
        );
    }

    const openState = await connection.isDBOpen();

    if (!openState.result) {
        await connection.open();
    }

    await connection.execute(`
        CREATE TABLE IF NOT EXISTS app_records (
            record_key TEXT PRIMARY KEY NOT NULL,
            record_value TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS sync_queue (
            id TEXT PRIMARY KEY NOT NULL,
            account_id TEXT,
            entity TEXT NOT NULL,
            record_id TEXT NOT NULL,
            operation TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending',
            last_error TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_sync_queue_status_created
        ON sync_queue(status, created_at);

        CREATE TABLE IF NOT EXISTS app_metadata (
            metadata_key TEXT PRIMARY KEY NOT NULL,
            metadata_value TEXT NOT NULL
        );
    `);

    const queueColumns = await connection.query('PRAGMA table_info(sync_queue)');
    const hasAccountId = (queueColumns.values || []).some(
        column => column.name === 'account_id'
    );

    if (!hasAccountId) {
        await connection.execute(
            'ALTER TABLE sync_queue ADD COLUMN account_id TEXT'
        );
    }

    await connection.execute(`
        CREATE INDEX IF NOT EXISTS idx_sync_queue_account_status_created
        ON sync_queue(account_id, status, created_at);
    `);

    return {
        database: DATABASE_NAME,
        version: DATABASE_VERSION,
        ready: true
    };
}

async function init() {
    if (!initializationPromise) {
        initializationPromise = initialize().catch(error => {
            connection = undefined;
            initializationPromise = undefined;
            throw error;
        });
    }

    return initializationPromise;
}

async function get(key) {
    const db = requireConnection();
    const recordKey = scopedRecordKey(key);

    const result = await db.query(
        `SELECT record_value, deleted_at
         FROM app_records
         WHERE record_key = ?`,
        [recordKey]
    );

    const row = result.values?.[0];

    if (!row || row.deleted_at) {
        return null;
    }

    return JSON.parse(row.record_value);
}

async function getAll() {
    const db = requireConnection();
    const accountId = requireAccountId();
    const prefix = accountRecordPrefix(accountId);

    const result = await db.query(
        `SELECT record_key, record_value
         FROM app_records
         WHERE deleted_at IS NULL
           AND substr(record_key, 1, ?) = ?
         ORDER BY record_key`,
        [prefix.length, prefix]
    );

    return (result.values || []).map(row => ({
        key: row.record_key.slice(prefix.length),
        value: JSON.parse(row.record_value)
    }));
}

async function put(key, value, options = {}) {
    const db = requireConnection();
    const recordKey = scopedRecordKey(key);
    const now = new Date().toISOString();
    const serialized = JSON.stringify(value);

    if (serialized === undefined) {
        throw new Error('The stored value must be JSON serializable.');
    }

    await db.beginTransaction();

    try {
        await db.run(
            `INSERT INTO app_records
                (record_key, record_value, updated_at, deleted_at)
             VALUES (?, ?, ?, NULL)
             ON CONFLICT(record_key) DO UPDATE SET
                record_value = excluded.record_value,
                updated_at = excluded.updated_at,
                deleted_at = NULL`,
            [recordKey, serialized, now], false
        );

        if (options.sync === true) {
            await enqueueWithinTransaction(db, {
                entity: options.entity || 'app',
                recordId: options.recordId || String(key),
                operation: 'upsert',
                payload: value
            });
        }

        await db.commitTransaction();

        return { key: recordKey, saved: true };
    } catch (error) {
        await db.rollbackTransaction();
        throw error;
    }
}

async function enqueueWithinTransaction(db, item) {
    const now = new Date().toISOString();
    const id = makeId();
    const accountId = requireAccountId();

    await db.run(
        `INSERT INTO sync_queue
            (id, account_id, entity, record_id, operation, payload, created_at, attempts, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'pending')`,
        [
            id,
            accountId,
            String(item.entity),
            String(item.recordId),
            String(item.operation),
            JSON.stringify(item.payload ?? null),
            now
        ],
        false
    );

    return id;
}

async function putMany(records) {
    const db = requireConnection();

    if (!Array.isArray(records) || records.length === 0) {
        throw new Error('At least one record is required.');
    }

    const now = new Date().toISOString();

    for (const record of records) {
        if (!record || record.key === undefined ||
            JSON.stringify(record.value) === undefined) {
            throw new Error('Each record requires a key and a JSON-serializable value.');
        }
    }

    await db.beginTransaction();

    try {
        for (const record of records) {
            const recordKey = scopedRecordKey(record.key);

            await db.run(
                `INSERT INTO app_records
                    (record_key, record_value, updated_at, deleted_at)
                 VALUES (?, ?, ?, NULL)
                 ON CONFLICT(record_key) DO UPDATE SET
                    record_value = excluded.record_value,
                    updated_at = excluded.updated_at,
                    deleted_at = NULL`,
                [recordKey, JSON.stringify(record.value), now],
                false
            );

            if (record.sync === true) {
                await enqueueWithinTransaction(db, {
                    entity: record.entity || 'app',
                    recordId: record.recordId || String(record.key),
                    operation: 'upsert',
                    payload: record.value
                });
            }
        }

        await db.commitTransaction();
        return { saved: records.length };
    } catch (error) {
        await db.rollbackTransaction();
        throw error;
    }
}
async function enqueue(item) {
    const db = requireConnection();

    if (!item || !item.entity || !item.recordId || !item.operation) {
        throw new Error('A sync item requires entity, recordId, and operation.');
    }

    const allowedOperations = ['upsert', 'delete'];

    if (!allowedOperations.includes(item.operation)) {
        throw new Error('Unsupported sync operation.');
    }

    await db.beginTransaction();

    try {
        const id = await enqueueWithinTransaction(db, item);
        await db.commitTransaction();
        return id;
    } catch (error) {
        await db.rollbackTransaction();
        throw error;
    }
}

async function remove(key, options = {}) {
    const db = requireConnection();
    const recordKey = scopedRecordKey(key);
    const now = new Date().toISOString();

    await db.beginTransaction();

    try {
        if (options.sync === true) {
            const existing = await db.query(
                `SELECT record_value
                 FROM app_records
                 WHERE record_key = ?`,
                [recordKey]
            );

            const oldValue = existing.values?.[0]
                ? JSON.parse(existing.values[0].record_value)
                : null;

            await db.run(
                `INSERT INTO app_records
                    (record_key, record_value, updated_at, deleted_at)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(record_key) DO UPDATE SET
                    updated_at = excluded.updated_at,
                    deleted_at = excluded.deleted_at`,
                [recordKey, JSON.stringify(oldValue), now, now], false
            );

            await enqueueWithinTransaction(db, {
                entity: options.entity || 'app',
                recordId: options.recordId || String(key),
                operation: 'delete',
                payload: { key: String(key) }
            });
        } else {
            await db.run(
                'DELETE FROM app_records WHERE record_key = ?',
                [recordKey],
                false
            );
        }

        await db.commitTransaction();
        return { key: recordKey, removed: true };
    } catch (error) {
        await db.rollbackTransaction();
        throw error;
    }
}

async function getPending(limit = 100, expectedAccountId) {
    const db = requireConnection();
    const accountId = requireAccountId(expectedAccountId);
    const safeLimit = Math.max(1, Math.min(500, Math.floor(Number(limit) || 100)));

    const result = await db.query(
        `SELECT id, entity, record_id, operation, payload, created_at, attempts
         FROM sync_queue
         WHERE account_id = ? AND status = 'pending'
         ORDER BY created_at, id
         LIMIT ?`,
        [accountId, safeLimit]
    );

    return (result.values || []).map(row => ({
        id: row.id,
        entity: row.entity,
        recordId: row.record_id,
        operation: row.operation,
        payload: JSON.parse(row.payload),
        createdAt: row.created_at,
        attempts: row.attempts
    }));
}

async function markSynced(id, expectedAccountId) {
    const db = requireConnection();
    const accountId = requireAccountId(expectedAccountId);

    await db.run(
        `UPDATE sync_queue
         SET status = 'synced', last_error = NULL
         WHERE id = ? AND account_id = ?`,
        [String(id), accountId]
    );

    return { id, synced: true };
}

async function recordSyncFailure(id, expectedAccountId, error) {
    const db = requireConnection();
    const accountId = requireAccountId(expectedAccountId);

    await db.run(
        `UPDATE sync_queue
         SET attempts = attempts + 1,
             last_error = ?,
             status = 'pending'
         WHERE id = ? AND account_id = ?`,
        [
            String(error?.message || error || 'Unknown sync error'),
            String(id),
            accountId
        ]
    );
}

async function healthCheck() {
    const db = requireConnection();
    const result = await db.query('SELECT 1 AS healthy');

    return {
        ready: result.values?.[0]?.healthy === 1,
        database: DATABASE_NAME
    };
}

function makeId() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    return `SYNC-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

window.BiasharaSQLite = Object.freeze({
    init,
    get,
    getAll,
    put,
    putMany,
    remove,
    enqueue,
    getPending,
    markSynced,
    recordSyncFailure,
    healthCheck
});




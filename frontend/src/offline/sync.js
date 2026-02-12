// Minimal IndexedDB-backed queue for offline requests
import { logger } from '../utils/logger';

const DB_NAME = 'chorilocal-offline';
const STORE = 'queue';
const DB_VERSION = 1;

// Singleton DB connection to prevent connection leaks
let dbInstance = null;

function openDb() {
    if (dbInstance) return Promise.resolve(dbInstance);
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
            dbInstance = req.result;
            // Reset singleton if the connection closes unexpectedly
            dbInstance.onclose = () => { dbInstance = null; };
            dbInstance.onversionchange = () => { dbInstance.close(); dbInstance = null; };
            resolve(dbInstance);
        };
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        };
    });
}

async function addToQueue(item) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const req = store.add({ ...item, ts: Date.now() });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function getAll() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const store = tx.objectStore(STORE);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

async function remove(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// --- Dead-letter queue (localStorage-backed, for failed 4xx items) ---
function addToDeadLetter(item, statusCode) {
    try {
        const deadLetters = JSON.parse(localStorage.getItem('offline-dead-letters') || '[]');
        deadLetters.push({
            method: item.method,
            url: item.url,
            body: item.body,
            failedAt: Date.now(),
            statusCode,
            queuedAt: item.ts,
        });
        localStorage.setItem('offline-dead-letters', JSON.stringify(deadLetters));
    } catch (e) { logger.warn('Failed to store dead letter', e); }
}

export function getDeadLetters() {
    try { return JSON.parse(localStorage.getItem('offline-dead-letters') || '[]'); } catch { return []; }
}

export function clearDeadLetters() {
    localStorage.removeItem('offline-dead-letters');
}

import { obtenerToken } from '../auth';

export async function queueRequest({ method = 'POST', url, headers = {}, body = null }) {
    // Duplicate detection: skip if identical request was queued within last 5 seconds
    try {
        const items = await getAll();
        const now = Date.now();
        const bodyStr = JSON.stringify(body);
        const isDuplicate = items.some(item =>
            item.method === method &&
            item.url === url &&
            JSON.stringify(item.body) === bodyStr &&
            now - item.ts < 5000
        );
        if (isDuplicate) {
            logger.info('Duplicate offline request detected, skipping queue');
            return;
        }
    } catch (e) {
        logger.warn('Dedup check failed, queuing anyway', e);
    }
    return addToQueue({ method, url, headers, body });
}

export async function processQueue() {
    if (!navigator.onLine) return;
    const items = await getAll();
    for (const item of items) {
        try {
            const token = obtenerToken();
            const hdrs = { ...(item.headers || {}) };
            if (token) hdrs['Authorization'] = `Bearer ${token}`;

            const res = await fetch(item.url, {
                method: item.method,
                headers: hdrs,
                body: item.body ? JSON.stringify(item.body) : null
            });

            if (res.ok || res.status === 202) {
                await remove(item.id);
                // small delay to avoid hammering
                await new Promise(r => setTimeout(r, 200));
            } else {
                // If server rejects (4xx), move to dead-letter queue instead of silently dropping
                if (res.status >= 400 && res.status < 500) {
                    addToDeadLetter(item, res.status);
                    await remove(item.id);
                    // Notify UI about the failure
                    try {
                        window.dispatchEvent(new CustomEvent('offline-request-failed', {
                            detail: { item, statusCode: res.status }
                        }));
                    } catch (e) { }
                }
                // 5xx: keep for retry later
            }
        } catch (e) {
            // network error: stop processing and try later
            logger.warn('processQueue network error, will retry later', e);
            return;
        }
    }
}

export async function clearQueue() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export default { queueRequest, processQueue, clearQueue, getAll, remove, getDeadLetters, clearDeadLetters };

// Minimal IndexedDB-backed queue for offline requests
const DB_NAME = 'chorilocal-offline';
const STORE = 'queue';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
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

import { obtenerToken } from '../auth';

export async function queueRequest({ method = 'POST', url, headers = {}, body = null }) {
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
        // If server rejects (4xx), remove to avoid infinite loop
        if (res.status >= 400 && res.status < 500) await remove(item.id);
        // otherwise keep for retry later
      }
    } catch (e) {
      // network error: stop processing and try later
      console.warn('processQueue network error, will retry later', e);
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

export default { queueRequest, processQueue, clearQueue };

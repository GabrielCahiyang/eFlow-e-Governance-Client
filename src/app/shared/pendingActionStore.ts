const storeName = 'actions';
const transient = new Map<string, unknown>();

export function pendingActionKey(actor: string, ...scope: string[]) {
  return JSON.stringify([actor, ...scope]);
}

export const isCommandId = (value: unknown): value is string =>
  typeof value === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value);

function accessStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    const open = indexedDB.open('eflow-pending-actions', 1);
    open.onupgradeneeded = () => open.result.createObjectStore(storeName);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      try {
        const tx = db.transaction(storeName, mode);
        const request = operation(tx.objectStore(storeName));
        tx.oncomplete = () => { db.close(); resolve(request.result); };
        tx.onabort = () => { db.close(); reject(tx.error ?? request.error); };
      } catch (error) { db.close(); reject(error); }
    };
  });
}

export async function readPendingAction<T>(key: string): Promise<T | undefined> {
  if (typeof indexedDB === 'undefined') return transient.get(key) as T | undefined;
  return accessStore('readonly', store => store.get(key));
}

export async function writePendingAction<T>(key: string, value: T, create = false): Promise<void> {
  if (typeof indexedDB === 'undefined') {
    if (create && transient.has(key)) throw new Error('Check the original saved action before continuing.');
    transient.set(key, value);
    return;
  }
  await accessStore('readwrite', store => create ? store.add(value, key) : store.put(value, key));
}

export async function removePendingAction(key: string): Promise<void> {
  if (typeof indexedDB === 'undefined') { transient.delete(key); return; }
  await accessStore('readwrite', store => store.delete(key));
}

export function withPendingActionLock<T>(key: string, action: () => Promise<T>): Promise<T> {
  return typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request(key, { ifAvailable: true }, lock => {
      if (!lock) throw new Error('This action is already being checked. Try again when it finishes.');
      return action();
    })
    : action();
}

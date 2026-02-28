const DB_NAME = 'BellaProV1';
const DB_VERSION = 1;

class DB {
    constructor() { this.db = null; }
    init() {
        return new Promise((res, rej) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                ['turnos', 'clientes', 'productos', 'pago'].forEach(s => {
                    if (!db.objectStoreNames.contains(s)) {
                        db.createObjectStore(s, { keyPath: 'id', autoIncrement: true });
                    }
                });
            };
            req.onsuccess = (e) => { this.db = e.target.result; res(); };
            req.onerror = (e) => rej(e);
        });
    }
    getAll(s) {
        return new Promise((res) => {
            const tx = this.db.transaction(s, 'readonly');
            tx.objectStore(s).getAll().onsuccess = (e) => res(e.target.result);
        });
    }
    add(s, item) {
        return new Promise((res) => {
            const tx = this.db.transaction(s, 'readwrite');
            tx.objectStore(s).add(item).onsuccess = (e) => res(e.target.result);
        });
    }
    del(s, id) {
        return new Promise((res) => {
            const tx = this.db.transaction(s, 'readwrite');
            tx.objectStore(s).delete(id).onsuccess = () => res();
        });
    }
    put(s, item) {
        return new Promise((res) => {
            const tx = this.db.transaction(s, 'readwrite');
            tx.objectStore(s).put(item).onsuccess = (e) => res(e.target.result);
        });
    }
    async dump() {
        const data = {};
        const stores = ['turnos', 'clientes', 'productos', 'pago'];
        for (const s of stores) {
            data[s] = await this.getAll(s);
        }
        return data;
    }
}

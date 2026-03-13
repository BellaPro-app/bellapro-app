const DB_NAME = 'BellaProV1';
const DB_VERSION = 2;

class DB {
    constructor() { this.db = null; }
    init() {
        return new Promise((res, rej) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                ['turnos', 'clientes', 'productos', 'pago', 'servicios'].forEach(s => {
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
            tx.objectStore(s).getAll().onsuccess = (e) => {
                const results = e.target.result || [];
                const filtered = results.filter(item => item.appType === window.SPECIALTY || !item.appType);
                res(filtered);
            };
        });
    }
    add(s, item) {
        return new Promise((res) => {
            const tx = this.db.transaction(s, 'readwrite');
            const itemWithApp = { ...item, appType: window.SPECIALTY || 'hair' };
            tx.objectStore(s).add(itemWithApp).onsuccess = (e) => res(e.target.result);
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
            const itemWithApp = { ...item, appType: window.SPECIALTY || 'hair' };
            tx.objectStore(s).put(itemWithApp).onsuccess = (e) => res(e.target.result);
        });
    }
    async dump() {
        const data = {};
        const stores = ['turnos', 'clientes', 'productos', 'pago', 'servicios'];
        for (const s of stores) {
            data[s] = await this.getAll(s);
        }
        return data;
    }
    async clearAppData(specialty) {
        const stores = ['turnos', 'clientes', 'productos', 'pago', 'servicios'];
        const tx = this.db.transaction(stores, 'readwrite');
        for (const s of stores) {
            const store = tx.objectStore(s);
            store.getAll().onsuccess = (e) => {
                const items = e.target.result;
                items.forEach(item => {
                    if (item.appType === specialty) store.delete(item.id);
                });
            };
        }
        return new Promise(res => tx.oncomplete = () => res());
    }
}

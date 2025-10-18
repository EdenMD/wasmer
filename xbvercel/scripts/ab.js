 // Common JavaScript for theme persistence
        const DB_NAME = 'XBUILDER_DB'; // Updated DB name for clarity
        const STORE_NAME = 'settings';

        function openIndexedDB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, 1);

                request.onupgradeneeded = function(event) {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    }
                };

                request.onsuccess = function(event) {
                    resolve(event.target.result);
                };

                request.onerror = function(event) {
                    console.error('IndexedDB error:', event.target.errorCode);
                    reject('IndexedDB error');
                };
            });
        }

        async function getSetting(key) {
            const db = await openIndexedDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(key);

                request.onsuccess = function(event) {
                    resolve(event.target.result ? event.target.result.value : null);
                };

                request.onerror = function(event) {
                    console.error('Error getting setting:', event.target.errorCode);
                    reject('Error getting setting');
                };
            });
        }

        async function putSetting(key, value) {
            const db = await openIndexedDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.put({ id: key, value: value });

                request.onsuccess = function() {
                    resolve();
                };

                request.onerror = function(event) {
                    console.error('Error putting setting:', event.target.errorCode);
                    reject('Error putting setting');
                };
            });
        }
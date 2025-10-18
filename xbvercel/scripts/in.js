// Common JavaScript for theme persistence
        const DB_NAME = 'ADAM_DB';
        const STORE_NAME = 'settings';

        function openIndexedDB() {
            return new Promise((resolve, reject) =>

{
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


function loadTheme() {
            const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
            if (savedTheme === 'dark') {
                body.classList.add('dark-theme');
                themeText.textContent = 'Dark Mode';
                lightIcon.style.display = 'none';
                moonIcon.style.display = 'inline-block';
            } else {
                body.classList.remove('dark-theme');
                localStorage.setItem(THEME_STORAGE_KEY, 'light'); // Ensure default is saved if not set
                themeText.textContent = 'Light Mode';
                lightIcon.style.display = 'inline-block';
                moonIcon.style.display = 'none';
            }
        }

        async function applyTheme() {
            const savedTheme = await getSetting('theme');
            
            document.body.classList.remove('dark-theme', 'light-theme', 'high-contrast-theme'); // Clear existing
            // Add 'dark-theme' specifically if it's the default and not explicitly saved
            // Or ensure the CSS defines the default without a class, and only adds classes for alternatives.
            // For simplicity, let's always add the class.
            

            // Set default if not found
            if (!savedTheme) {
                await putSetting('theme', 'dark-theme');
            }
        }

        // Index.html specific JavaScript for animation

document.addEventListener('DOMContentLoaded', async () => {
            await applyTheme(); // Apply theme first

            const adamTitleDisplay = document.getElementById('adamTitleDisplay');
            const acronymDefinition = document.getElementById('acronymDefinition');
            const acronymLines = acronymDefinition.querySelectorAll('span');
            const adamText = "Xbuilder V2";
            const acronym = [
                "Welcome Developer To the ",
                "feature of programing, Build  ",
                "full applications in Seconds",
                "with XbuilderV2 by edenTech"
            ];
            const typingSpeed = 200; // milliseconds per character
            const lineRevealSpeed = 100; // milliseconds per character for acronym
            const delayBeforeAcronym = 1000; // milliseconds

            async function typeText(element, text) {
                element.innerHTML = ''; // Clear content
                element.style.animation = 'blink-caret 0.75s step-end infinite'; // Start blinking cursor
                for (let i = 0; i < text.length; i++) {
                    element.innerHTML += text.charAt(i);
                    await new Promise(resolve => setTimeout(resolve, typingSpeed));
                }
                element.style.animation = 'none'; // Stop blinking cursor after typing
                element.style.borderRight = 'none'; // Remove cursor
            }

            async function revealAcronym() {
                acronymDefinition.classList.add('visible'); // Make container visible
                for (let i = 0; i < acronym.length; i++) {
                    const lineElement = acronymLines[i];
                    const lineText = acronym[i];
                    lineElement.innerHTML = ''; // Clear content
                    lineElement.style.borderRight = '2px solid var(--clr-border-glow)'; // Add line-specific cursor
                    lineElement.style.animation = 'blink-caret 0.75s step-end infinite'; // Blinking cursor for each line

                    for (let j = 0; j < lineText.length; j++) {
                        lineElement.innerHTML += lineText.charAt(j);
                        await new Promise(resolve => setTimeout(resolve, lineRevealSpeed));
                    }
                    lineElement.style.animation = 'none'; // Stop blinking
                    lineElement.style.borderRight = 'none'; // Remove cursor
                    await new Promise(resolve => setTimeout(resolve, 300)); // Small pause between lines
                }
            }

            // Start animation sequence
            await typeText(adamTitleDisplay, adamText);
            await new Promise(resolve => setTimeout(resolve, delayBeforeAcronym));
            await revealAcronym();
        });
const DB_NAME = 'Gen1DB';
        const DB_VERSION = 1;
        const PROJECTS_STORE_NAME = 'projects';
        const FILES_STORE_NAME = 'projectFiles';
        const CURRENT_PROJECT_ID_LS_KEY = 'gen1_current_project_id';
        const THEME_STORAGE_KEY = 'gen1_theme';
        const PROJECT_SORT_KEY = 'gen1_project_sort_order';

        const body = document.body;
        const themeSwitch = document.getElementById('themeSwitch');
        const lightIcon = document.getElementById('lightIcon');
        const moonIcon = document.getElementById('moonIcon');
        const themeText = document.getElementById('themeText');
        const projectsGrid = document.getElementById('projectsGrid');
        const statusMessage = document.getElementById('statusMessage');
        const settingsBtn = document.getElementById('settingsBtn');

        // Navigation Drawer elements
        const menuIcon = document.getElementById('menuIcon');
        const navDrawer = document.getElementById('navDrawer');
        const drawerOverlay = document.getElementById('drawerOverlay');
        const floatingActionButton = document.getElementById('floatingActionButton');

        // Drawer options buttons
        const drawerHomeBtn = document.getElementById('drawerHomeBtn');
        const drawerNewProjectBtn = document.getElementById('drawerNewProjectBtn');
        const drawerManageProjectsBtn = document.getElementById('drawerManageProjectsBtn');
        const drawerTemplatesBtn = document.getElementById('drawerTemplatesBtn');
        const drawerSettingsBtn = document.getElementById('drawerSettingsBtn');
        const drawerAboutBtn = document.getElementById('drawerAboutBtn');

        let db;
        let snackbarTimeout; // To manage the snackbar auto-hide

        // --- IndexedDB Functions ---
        function openGen1DB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = (event) => {
                    db = event.target.result;
                    if (!db.objectStoreNames.contains(PROJECTS_STORE_NAME)) {
                        db.createObjectStore(PROJECTS_STORE_NAME, { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains(FILES_STORE_NAME)) {
                        db.createObjectStore(FILES_STORE_NAME, { keyPath: 'projectId' });
                    }
                };

                request.onsuccess = (event) => {
                    db = event.target.result;
                    resolve(db);
                };

                request.onerror = (event) => {
                    console.error('IndexedDB error:', event.target.error);
                    showStatus(`IndexedDB error: ${event.target.error.message}`, 'error');
                    reject(event.target.error);
                };
            });
        }

        function getAllItemsFromStore(storeName) {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.getAll();

                request.onsuccess = (event) => {
                    resolve(event.target.result);
                };

                request.onerror = (event) => {
                    reject(event.target.error);
                };
            });
        }

        // --- Theme Toggling ---
        function loadTheme() {
            const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
            if (savedTheme === 'dark') {
                body.classList.add('dark-theme');
                themeText.textContent = 'Dark Mode';
                lightIcon.style.display = 'none';
                moonIcon.style.display = 'inline-block';
            } else {
                body.classList.remove('dark-theme');
                themeText.textContent = 'Light Mode';
                lightIcon.style.display = 'inline-block';
                moonIcon.style.display = 'none';
            }
        }

        function toggleTheme() {
            if (body.classList.contains('dark-theme')) {
                body.classList.remove('dark-theme');
                localStorage.setItem(THEME_STORAGE_KEY, 'light');
                themeText.textContent = 'Light Mode';
                lightIcon.style.display = 'inline-block';
                moonIcon.style.display = 'none';
            } else {
                body.classList.add('dark-theme');
                localStorage.setItem(THEME_STORAGE_KEY, 'dark');
                themeText.textContent = 'Dark Mode';
                lightIcon.style.display = 'none';
                moonIcon.style.display = 'inline-block';
            }
        }
        themeSwitch.addEventListener('click', toggleTheme);

        // --- Snackbar (Status Message) Display ---
        function showStatus(message, type = 'info', duration = 3000) {
            clearTimeout(snackbarTimeout); // Clear any existing timeout
            statusMessage.classList.remove('success', 'error'); // Reset classes
            statusMessage.className = 'snackbar'; // Ensure base class is present
            
            let iconClass = 'fas fa-info-circle';
            if (type === 'error') iconClass = 'fas fa-times-circle';
            if (type === 'success') iconClass = 'fas fa-check-circle';

            statusMessage.classList.add(type);
            statusMessage.innerHTML = `<i class="${iconClass}"></i> <p>${message}</p>`;
            statusMessage.classList.add('show'); // Trigger show animation

            snackbarTimeout = setTimeout(() => {
                hideStatus();
            }, duration);
        }

        function hideStatus() {
            statusMessage.classList.remove('show'); // Trigger hide animation
        }

        // --- Project Icon Generation (Keeping your creative approach) ---
        function getProjectIcon(projectName) {
            const firstChar = projectName.trim().charAt(0).toUpperCase();
            switch (firstChar) {
                case 'A': return 'fas fa-box'; case 'B': return 'fas fa-building'; case 'C': return 'fas fa-code';
                case 'D': return 'fas fa-database'; case 'E': return 'fas fa-chart-line'; case 'F': return 'fas fa-file-alt';
                case 'G': return 'fas fa-globe'; case 'H': return 'fas fa-home'; case 'I': return 'fas fa-lightbulb';
                case 'J': return 'fas fa-seedling'; case 'K': return 'fas fa-key'; case 'L': return 'fas fa-layer-group';
                case 'M': return 'fas fa-laptop-code'; case 'N': return 'fas fa-network-wired'; case 'O': return 'fas fa-sitemap';
                case 'P': return 'fas fa-project-diagram'; case 'Q': return 'fas fa-question-circle'; case 'R': return 'fas fa-rocket';
                case 'S': return 'fas fa-server'; case 'T': return 'fas fa-terminal'; case 'U': return 'fas fa-upload';
                case 'V': return 'fas fa-video'; case 'W': return 'fas fa-wrench'; case 'X': return 'fas fa-flask';
                case 'Y': return 'fas fa-yin-yang'; case 'Z': return 'fas fa-zap';
                case '0': case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': case '9': return 'fas fa-hashtag';
                default: return 'fas fa-folder';
            }
        }

        // --- Project Rendering & Management ---
        async function renderProjects() {
            projectsGrid.innerHTML = `
                <p style="text-align: center; color: var(--text-secondary); padding: 30px; font-weight: 400;">
                    <i class="fas fa-sync fa-spin"></i> Loading projects from database...
                </p>
            `;

            try {
                if (!db) {
                    await openGen1DB();
                }

                let projects = await getAllItemsFromStore(PROJECTS_STORE_NAME);
                const sortOrder = localStorage.getItem(PROJECT_SORT_KEY) || 'newest';

                let maxOpenCount = 0;
                projects = projects.map(project => {
                    const openCountKey = `gen1_project_open_count_${project.id}`;
                    const openCount = parseInt(localStorage.getItem(openCountKey) || '0', 10);
                    if (openCount > maxOpenCount) {
                        maxOpenCount = openCount;
                    }
                    return { ...project, openCount };
                });

                // Apply sorting
                switch (sortOrder) {
                    case 'newest': projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
                    case 'oldest': projects.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
                    case 'mostOpened': projects.sort((a, b) => b.openCount - a.openCount); break;
                    case 'leastOpened': projects.sort((a, b) => a.openCount - b.openCount); break;
                    case 'az': projects.sort((a, b) => a.name.localeCompare(b.name)); break;
                    case 'za': projects.sort((a, b) => b.name.localeCompare(a.name)); break;
                    default: projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
                }

                projectsGrid.innerHTML = ''; // Clear loading message

                if (projects.length === 0) {
                    projectsGrid.innerHTML = `
                        <p style="text-align: center; color: var(--text-secondary); padding: 30px; font-weight: 400;">
                            No projects found. Tap the <i class="fas fa-plus fa-lg" style="color: var(--main-accent);"></i> button to create your first project.
                        </p>
                    `;
                } else {
                    projects.forEach((project) => {
                        const openCount = project.openCount;
                        const barWidth = maxOpenCount > 0 ? (openCount / maxOpenCount) * 100 : 0;
                        const projectIconClass = getProjectIcon(project.name);

                        const projectCard = document.createElement('div');
                        projectCard.classList.add('project-card');
                        projectCard.dataset.projectId = project.id;
                        projectCard.innerHTML = `
                            <h3><i class="${projectIconClass} project-icon-large"></i> ${project.name}</h3>
                            <p>Created: ${new Date(project.createdAt).toLocaleDateString()}</p>
                            <div class="project-stats">
                                <span class="stat-label">Opens: <span class="open-count">${openCount}</span></span>
                                <div class="open-count-bar-container">
                                    <div class="open-count-bar" style="width: ${barWidth}%;"></div>
                                </div>
                            </div>
                            <div class="card-actions">
                                <button class="open-btn"><i class="fas fa-edit"></i> Open</button>
                                <button class="export-btn"><i class="fas fa-download"></i> Export</button>
                                <button class="delete-btn"><i class="fas fa-trash-alt"></i> Delete</button>
                            </div>
                        `;

                        projectCard.querySelector('.export-btn').addEventListener('click', (event) => {
                            event.stopPropagation();
                            exportProjectAsZip(project.id);
                        });
                        projectCard.querySelector('.open-btn').addEventListener('click', (event) => {
                            event.stopPropagation();
                            openProject(project.id);
                        });
                        projectCard.querySelector('.delete-btn').addEventListener('click', (event) => {
                            event.stopPropagation();
                            deleteProject(project.id);
                        });
                        projectCard.addEventListener('click', () => openProject(project.id));

                        projectsGrid.appendChild(projectCard);
                    });
                }
            } catch (error) {
                console.error('Error rendering projects:', error);
                projectsGrid.innerHTML = `
                    <p style="text-align: center; color: var(--error-color); padding: 30px; font-weight: 400;">
                        <i class="fas fa-exclamation-triangle"></i> Failed to load projects. Please refresh or check console.
                    </p>
                `;
                showStatus(`Failed to load projects: ${error.message}`, 'error');
            }
        }

        function openProject(projectId) {
            const key = `gen1_project_open_count_${projectId}`;
            let count = parseInt(localStorage.getItem(key) || '0', 10);
            count++;
            localStorage.setItem(key, count.toString());
            localStorage.setItem(CURRENT_PROJECT_ID_LS_KEY, projectId);
            window.location.href = 'Pe.html';
        }

        async function deleteProject(projectIdToDelete) {
            if (confirm(`Are you sure you want to delete this project permanently? This action cannot be undone.`)) {
                showStatus('Deleting project...', 'info');
                try {
                    const transaction = db.transaction([PROJECTS_STORE_NAME, FILES_STORE_NAME], 'readwrite');
                    const projectsStore = transaction.objectStore(PROJECTS_STORE_NAME);
                    const filesStore = transaction.objectStore(FILES_STORE_NAME);

                    await Promise.all([
                        new Promise((resolve, reject) => {
                            const req1 = projectsStore.delete(projectIdToDelete);
                            req1.onsuccess = () => resolve();
                            req1.onerror = (e) => reject(e.target.error);
                        }),
                        new Promise((resolve, reject) => {
                            const req2 = filesStore.delete(projectIdToDelete);
                            req2.onsuccess = () => resolve();
                            req2.onerror = (e) => reject(e.target.error);
                        })
                    ]);
                    localStorage.removeItem(`gen1_project_open_count_${projectIdToDelete}`);

                    showStatus('Project deleted successfully!', 'success');
                    renderProjects();
                } catch (error) {
                    console.error('Error deleting project:', error);
                    showStatus(`Failed to delete project: ${error.message}`, 'error');
                }
            }
        }

        // --- Project Export (ZIP) ---
        async function exportProjectAsZip(projectId) {
            async function getItemFromStoreById(storeName, key) {
                return new Promise((resolve, reject) => {
                    const transaction = db.transaction([storeName], 'readonly');
                    const store = transaction.objectStore(storeName);
                    const request = store.get(key);
                    request.onsuccess = (event) => {
                        resolve(event.target.result);
                    };
                    request.onerror = (event) => {
                        reject(event.target.error);
                    };
                });
            }

            try {
                const project = await getItemFromStoreById(PROJECTS_STORE_NAME, projectId);
                if (!project) {
                    throw new Error('Project not found');
                }

                const files = await getItemFromStoreById(FILES_STORE_NAME, projectId);
                const projectFiles = files && files.files ? files.files : {};

                const zip = new JSZip();
                zip.file('project.json', JSON.stringify(project, null, 2));

                Object.keys(projectFiles).forEach((filePath) => {
                    const content = projectFiles[filePath];
                    zip.file(filePath, content);
                });

                const zipBlob = await zip.generateAsync({ type: 'blob' });
                saveAs(zipBlob, `${project.name}.zip`);
                showStatus('Project exported successfully!', 'success');
            } catch (error) {
                console.error('Error exporting project:', error);
                showStatus(`Failed to export project: ${error.message}`, 'error');
            }
        }

        // --- Navigation Drawer Logic ---
        function openNavDrawer() {
            navDrawer.classList.add('open');
            drawerOverlay.classList.add('visible');
            document.body.style.overflow = 'hidden';
        }

        function closeNavDrawer() {
            navDrawer.classList.remove('open');
            drawerOverlay.classList.remove('visible');
            document.body.style.overflow = '';
        }

        menuIcon.addEventListener('click', openNavDrawer);
        floatingActionButton.addEventListener('click', openNavDrawer);
        drawerOverlay.addEventListener('click', closeNavDrawer);

        // Function to set active state for drawer buttons
        function setActiveDrawerButton(buttonToActivate) {
            document.querySelectorAll('.drawer-options button').forEach(btn => btn.classList.remove('active'));
            if (buttonToActivate) {
                buttonToActivate.classList.add('active');
            }
        }

        // Drawer option click handlers
        drawerHomeBtn.addEventListener('click', () => {
            closeNavDrawer();
            setActiveDrawerButton(drawerHomeBtn);
        });

        drawerNewProjectBtn.addEventListener('click', () => {
            closeNavDrawer();
            setActiveDrawerButton(drawerNewProjectBtn);
            window.location.href = 'Np.html';
        });

        drawerManageProjectsBtn.addEventListener('click', () => {
            closeNavDrawer();
            setActiveDrawerButton(drawerManageProjectsBtn);
            showStatus("You are on the 'Manage Projects' view.", 'info');
        });

        drawerTemplatesBtn.addEventListener('click', () => {
            closeNavDrawer();
            setActiveDrawerButton(drawerTemplatesBtn);
            showStatus("Templates feature coming soon!", 'info');
        });

        drawerSettingsBtn.addEventListener('click', () => {
            closeNavDrawer();
            setActiveDrawerButton(drawerSettingsBtn);
            window.location.href = 'settings.html';
        });

        drawerAboutBtn.addEventListener('click', () => {
            closeNavDrawer();
            setActiveDrawerButton(drawerAboutBtn);
            showStatus("Gen1: Xbuilder - Version 1.0", 'info');
        });


        // App Bar Settings Button
        settingsBtn.addEventListener('click', () => {
            window.location.href = 'settings.html';
        });

        // --- Initialization ---
        document.addEventListener('DOMContentLoaded', async () => {
            loadTheme();
            openGen1DB().then(() => {
                renderProjects();
            }).catch(error => {
                console.error("Failed to initialize database:", error);
                showStatus("Failed to initialize application database.", "error");
            });

            setActiveDrawerButton(drawerHomeBtn);
        });
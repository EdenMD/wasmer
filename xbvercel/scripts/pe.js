//----start of constants----
const DB_NAME = 'Gen1DB';
const DB_VERSION = 1;
const PROJECTS_STORE_NAME = 'projects';
const FILES_STORE_NAME = 'projectFiles';

const CURRENT_PROJECT_ID_LS_KEY = 'gen1_current_project_id';
const THEME_STORAGE_KEY = 'gen1_theme';

// Declare DOM element variables here, but initialize them in DOMContentLoaded
let body;
let backButton;
let drawerButton;
let runButton;
let projectTitleElement;
let editorContainer;
let fileDrawer;
let fileListDrawer;
let drawerOverlay;
let aiButton;
let formatterButton;
let obfuscateButton;
let saveButton;
let copyCodeButton;
let howToUseButton;
let statusMessageElement;
let themeToggleButton;

let newFileButton;
let newFolderButton;
let uploadFileButton;
let createDocumentButton;
let fileInput;

let genericModal;
let modalTitle;
let modalMessage;
let modalInput;
let modalConfirm;
let modalCancel;

let createDocumentModal;
let docTypeSelect;
let docNameInput;
let docCreateConfirm;
let docCreateCancel;

let documentPreview;
let docToolbar;
let generateDownloadButton;
let closePreviewButton;

let db;
let editor;
let currentProjectId = null;
let projectFilesData = {};
let currentOpenFile = null;
let currentMonacoModel = null;
let expandedFolders = new Set();
//----end of constants----

//----start of indexeddb_functions----
function openGen1DB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = event => {
            db = event.target.result;
            if (!db.objectStoreNames.contains(PROJECTS_STORE_NAME)) {
                db.createObjectStore(PROJECTS_STORE_NAME, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(FILES_STORE_NAME)) {
                db.createObjectStore(FILES_STORE_NAME, { keyPath: 'projectId' });
            }
        };

        request.onsuccess = event => {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = event => {
            showStatus('IndexedDB error: ' + event.target.error.message, 'error');
            reject(event.target.error);
        };
    });
}

function getItemFromStore(storeName, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = event => resolve(event.target.result);
        request.onerror = event => reject(event.target.error);
    });
}

function putItemInStore(storeName, item) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(item);

        request.onsuccess = event => resolve(event.target.result);
        request.onerror = event => reject(event.target.error);
    });
}

function deleteItemFromStore(storeName, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = event => resolve(event.target.result);
        request.onerror = event => reject(event.target.error);
    });
}
//----end of indexeddb_functions----

//----start of theme_management----
function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'dark') {
        body.classList.add('dark-theme');
        themeToggleButton.querySelector('i').className = 'fas fa-sun';
        setMonacoTheme('vs-dark');
    } else {
        body.classList.remove('dark-theme');
        themeToggleButton.querySelector('i').className = 'fas fa-moon';
        setMonacoTheme('vs-light');
    }
}

function toggleTheme() {
    if (body.classList.contains('dark-theme')) {
        body.classList.remove('dark-theme');
        localStorage.setItem(THEME_STORAGE_KEY, 'light');
        themeToggleButton.querySelector('i').className = 'fas fa-moon';
        setMonacoTheme('vs-light');
    } else {
        body.classList.add('dark-theme');
        localStorage.setItem(THEME_STORAGE_KEY, 'dark');
        themeToggleButton.querySelector('i').className = 'fas fa-sun';
        setMonacoTheme('vs-dark');
    }
}

function setMonacoTheme(theme) {
    if (editor) {
        monaco.editor.setTheme(theme);
    }
}
//----end of theme_management----

//----start of status_message_utility----
let statusMessageTimeout;
function showStatus(message, type = 'info', duration = 3000) {
    clearTimeout(statusMessageTimeout);
    statusMessageElement.style.display = 'flex';
    statusMessageElement.className = 'status-message show';
    statusMessageElement.classList.add(type);

    let iconClass = 'fas fa-info-circle';
    if (type === 'error') {
        iconClass = 'fas fa-times-circle';
    } else if (type === 'success') {
        iconClass = 'fas fa-check-circle';
    } else if (type === 'warning') {
        iconClass = 'fas fa-exclamation-triangle';
    }

    statusMessageElement.innerHTML = `<i class="${iconClass}"></i> <p>${message}</p>`;
    statusMessageTimeout = setTimeout(() => hideStatus(), duration);
}

function hideStatus() {
    statusMessageElement.classList.remove('show');
}
//----end of status_message_utility----

//----start of file_type_utilities----
function getLanguageFromFilename(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    switch (ext) {
        case 'js':
        case 'jsx':
            return 'javascript';
        case 'ts':
        case 'tsx':
            return 'typescript';
        case 'html':
        case 'htm':
            return 'html';
        case 'css':
            return 'css';
        case 'json':
        case 'pdfdoc': // For PDF content JSON
        case 'docxdoc': // For DOCX content JSON
        case 'xlsxdoc': // For XLSX content JSON
        case 'pptxdoc': // For PPTX content JSON
            return 'json';
        case 'md':
        case 'markdown':
            return 'markdown';
        case 'py':
            return 'python';
        case 'java':
            return 'java';
        case 'c':
            return 'c';
        case 'cpp':
            return 'cpp';
        case 'go':
            return 'go';
        case 'xml':
            return 'xml';
        case 'yaml':
        case 'yml':
            return 'yaml';
        default:
            return 'plaintext';
    }
}

function getPrettierParserFromFilename(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    switch (ext) {
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
            return 'babel';
        case 'html':
        case 'htm':
            return 'html';
        case 'css':
        case 'scss':
        case 'less':
            return 'css';
        case 'json':
        case 'pdfdoc':
        case 'docxdoc':
        case 'xlsxdoc':
        case 'pptxdoc':
            return 'json';
        case 'md':
        case 'markdown':
            return 'markdown';
        case 'yml':
        case 'yaml':
            return 'yaml';
        case 'graphql':
            return 'graphql';
        default:
            return null;
    }
}

function getFileIconClass(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    switch (ext) {
        case 'js':
        case 'jsx':
            return 'fab fa-js';
        case 'ts':
        case 'tsx':
            return 'fas fa-file-code';
        case 'html':
        case 'htm':
            return 'fab fa-html5';
        case 'css':
            return 'fab fa-css3-alt';
        case 'json':
            return 'fas fa-file-alt';
        case 'md':
        case 'markdown':
            return 'fab fa-markdown';
        case 'py':
            return 'fab fa-python';
        case 'java':
            return 'fab fa-java';
        case 'c':
        case 'cpp':
            return 'fas fa-file-code';
        case 'go':
            return 'fab fa-go';
        case 'xml':
            return 'fas fa-code';
        case 'yaml':
        case 'yml':
            return 'fas fa-file-alt';
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'svg':
            return 'fas fa-image';
        case 'txt':
            return 'fas fa-file-alt';
        case 'pdf':
            return 'fas fa-file-pdf';
        case 'docx':
            return 'fas fa-file-word';
        case 'xlsx':
            return 'fas fa-file-excel';
        case 'pptx':
            return 'fas fa-file-powerpoint';
        case 'pdfdoc': // JSON for PDF structure
        case 'docxdoc': // JSON for DOCX structure
        case 'xlsxdoc': // JSON for XLSX structure
        case 'pptxdoc': // JSON for PPTX structure
            return 'fas fa-code'; // Represent as code/JSON file
        default:
            return 'fas fa-file';
    }
}

function isImageFile(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'svg', 'ico', 'webp'].includes(ext);
}

function isPdfFile(filename) {
    return filename.toLowerCase().endsWith('.pdf');
}

function isDocumentJsonFile(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return ['pdfdoc', 'docxdoc', 'xlsxdoc', 'pptxdoc'].includes(ext);
}
//----end of file_type_utilities----

//----start of monaco_editor_setup----
function initializeMonacoEditor() {
    return new Promise(resolve => {
        require(['vs/editor/editor.main'], () => {
            editor = monaco.editor.create(editorContainer, {
                value: '',
                language: 'plaintext',
                theme: localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'vs-dark' : 'vs-light',
                automaticLayout: true,
                fontSize: 14,
                minimap: { enabled: false },
                tabSize: 4,
                insertSpaces: true
            });

            editor.onDidChangeModelContent(() => {
                // Optional: Could trigger an auto-save or dirty state indicator here
            });
            resolve();
        });
    });
}
//----end of monaco_editor_setup----

//----start of file_tree_logic----
function buildFileTree(filesMap) {
    const root = { name: '', type: 'folder', children: [], path: '' };

    Object.keys(filesMap).forEach(fullPath => {
        const parts = fullPath.split('/');
        let currentNode = root;
        let currentPathAccumulator = '';

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            currentPathAccumulator += (i > 0 ? '/' : '') + part;

            if (i === parts.length - 1) {
                if (fullPath.endsWith('/')) {
                    let folderNode = currentNode.children.find(
                        child => child.name === part && child.type === 'folder'
                    );
                    if (!folderNode) {
                        folderNode = { name: part, type: 'folder', children: [], path: currentPathAccumulator };
                        currentNode.children.push(folderNode);
                    }
                    currentNode = folderNode;
                } else {
                     currentNode.children.push({
                        name: part,
                        type: 'file',
                        path: fullPath
                    });
                }
            } else {
                let folderNode = currentNode.children.find(
                    child => child.name === part && child.type === 'folder'
                );

                if (!folderNode) {
                    folderNode = { name: part, type: 'folder', children: [], path: currentPathAccumulator };
                    currentNode.children.push(folderNode);
                }
                currentNode = folderNode;
            }
        }
    });

    function cleanupAndAddEmptyFolders(node) {
        if (!node.children) return;

        const newChildren = [];
        const pathsPresentInTree = new Set();

        node.children.forEach(child => {
            if (child.type === 'folder') {
                cleanupAndAddEmptyFolders(child);
            }
            newChildren.push(child);
            pathsPresentInTree.add(child.path + (child.type === 'folder' ? '/' : ''));
        });

        Object.keys(projectFilesData).forEach(storedPath => {
            if (storedPath.endsWith('/') && projectFilesData[storedPath] === null) {
                const normalizedStoredPath = normalizePath(storedPath.slice(0, -1));
                if (normalizedStoredPath === node.path ||
                   (node.path === '' && normalizedStoredPath.indexOf('/') === -1 && storedPath.length === normalizedStoredPath.length + 1)) {
                    const folderName = normalizedStoredPath.split('/').pop();
                    if (!pathsPresentInTree.has(storedPath)) {
                        newChildren.push({ name: folderName, type: 'folder', children: [], path: normalizedStoredPath });
                        pathsPresentInTree.add(storedPath);
                    }
                } else if (storedPath.startsWith(node.path + '/') && storedPath.length > (node.path + '/').length) {
                     const relativePath = storedPath.substring((node.path ? node.path + '/' : '').length);
                     const firstSegment = relativePath.split('/')[0];
                     const fullSegmentPath = (node.path ? node.path + '/' : '') + firstSegment;
                     if (!pathsPresentInTree.has(fullSegmentPath + '/')) {
                        if (relativePath.indexOf('/') === relativePath.length - 1) {
                             newChildren.push({ name: firstSegment, type: 'folder', children: [], path: fullSegmentPath });
                             pathsPresentInTree.add(fullSegmentPath + '/');
                        }
                    }
                }
            }
        });

        node.children = newChildren;
    }

    cleanupAndAddEmptyFolders(root);

    function sortChildren(node) {
        if (!node.children) {
            return;
        }
        node.children.forEach(sortChildren);
        node.children.sort((a, b) => {
            if (a.type === 'folder' && b.type === 'file') {
                return -1;
            }
            if (a.type === 'file' && b.type === 'folder') {
                return 1;
            }
            return a.name.localeCompare(b.name);
        });
    }

    sortChildren(root);
    return root.children;
}

function renderTreeNodes(nodes, parentUl, depth = 0) {
    if (nodes.length === 0 && depth === 0) {
        fileListDrawer.innerHTML = '<li style="color: var(--text-secondary); padding: 10px 15px;"><div class="content-wrapper"><span>No files in project. Create one!</span></div></li>';
        return;
    }

    nodes.forEach(node => {
        const li = document.createElement('li');

        const contentWrapper = document.createElement('div');
        contentWrapper.classList.add('content-wrapper');
        contentWrapper.style.paddingLeft = `${15 + depth * 15}px`;

        const nameSpan = document.createElement('span');
        nameSpan.textContent = node.name;

        const itemActions = document.createElement('div');
        itemActions.classList.add('item-actions');

        if (node.type === 'folder') {
            li.classList.add('folder-item');

            const toggleIcon = document.createElement('i');
            toggleIcon.classList.add('fas', 'toggle-icon');

            const folderIcon = document.createElement('i');
            folderIcon.classList.add('fas', 'fa-folder', 'folder-icon');

            contentWrapper.appendChild(toggleIcon);
            contentWrapper.appendChild(folderIcon);
            nameSpan.classList.add('folder-name');
            contentWrapper.appendChild(nameSpan);

            const renameFolderButton = document.createElement('button');
            renameFolderButton.classList.add('icon-button');
            renameFolderButton.innerHTML = '<i class="fas fa-edit"></i>';
            renameFolderButton.title = 'Rename folder';
            renameFolderButton.onclick = (e) => { e.stopPropagation(); renameFileEntry(node.path + '/', 'folder'); };
            itemActions.appendChild(renameFolderButton);

            const deleteFolderButton = document.createElement('button');
            deleteFolderButton.classList.add('icon-button');
            deleteFolderButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
            deleteFolderButton.title = 'Delete folder';
            deleteFolderButton.onclick = (e) => { e.stopPropagation(); deleteFileEntry(node.path + '/', 'folder'); };
            itemActions.appendChild(deleteFolderButton);

            contentWrapper.appendChild(itemActions);

            const nestedUl = document.createElement('ul');
            nestedUl.classList.add('nested-file-list');

            const folderFullPath = node.path;
            if (expandedFolders.has(folderFullPath) || (currentOpenFile && currentOpenFile.startsWith(folderFullPath + '/'))) {
                li.classList.add('open');
                toggleIcon.classList.add('fa-caret-down');
                toggleIcon.classList.remove('fa-caret-right');
                nestedUl.style.display = 'block';
                expandedFolders.add(folderFullPath);
            } else {
                toggleIcon.classList.add('fa-caret-right');
                toggleIcon.classList.remove('fa-caret-down');
                nestedUl.style.display = 'none';
            }

            li.addEventListener('click', e => {
                e.stopPropagation();
                li.classList.toggle('open');
                if (li.classList.contains('open')) {
                    toggleIcon.classList.remove('fa-caret-right');
                    toggleIcon.classList.add('fa-caret-down');
                    nestedUl.style.display = 'block';
                    expandedFolders.add(folderFullPath);
                } else {
                    toggleIcon.classList.remove('fa-caret-down');
                    toggleIcon.classList.add('fa-caret-right');
                    nestedUl.style.display = 'none';
                    expandedFolders.delete(folderFullPath);
                }
            });

            li.appendChild(contentWrapper);

            if (node.children && node.children.length > 0) {
                renderTreeNodes(node.children, nestedUl, depth + 1);
            } else {
                const emptyMsg = document.createElement('li');
                const emptyMsgContent = document.createElement('div');
                emptyMsgContent.classList.add('content-wrapper');
                emptyMsgContent.style.paddingLeft = `${15 + (depth + 1) * 15}px`;
                const emptyText = document.createElement('span');
                emptyText.textContent = 'Empty';
                emptyMsgContent.appendChild(emptyText);
                emptyMsg.appendChild(emptyMsgContent);

                emptyMsg.style.color = 'var(--text-secondary)';
                emptyMsg.style.fontStyle = 'italic';
                emptyMsg.style.cursor = 'default';
                emptyMsg.style.borderBottom = 'none';
                emptyMsg.style.padding = '0';
                emptyMsg.onmouseover = emptyMsg.onmouseout = null;
                emptyMsg.onclick = null;
                nestedUl.appendChild(emptyMsg);
            }
            li.appendChild(nestedUl);

        } else {
            li.classList.add('file-item');

            const fileTypeIcon = document.createElement('i');
            fileTypeIcon.classList.add('file-type-icon');
            fileTypeIcon.className += ' ' + getFileIconClass(node.name);

            const iconPlaceholder = document.createElement('span'); // Invisible placeholder for alignment
            iconPlaceholder.classList.add('toggle-icon');

            contentWrapper.appendChild(iconPlaceholder);
            contentWrapper.appendChild(fileTypeIcon);
            nameSpan.classList.add('file-name');
            contentWrapper.appendChild(nameSpan);

            const renameFileButton = document.createElement('button');
            renameFileButton.classList.add('icon-button');
            renameFileButton.innerHTML = '<i class="fas fa-edit"></i>';
            renameFileButton.title = 'Rename file';
            renameFileButton.onclick = (e) => { e.stopPropagation(); renameFileEntry(node.path, 'file'); };
            itemActions.appendChild(renameFileButton);

            const deleteFileButton = document.createElement('button');
            deleteFileButton.classList.add('icon-button');
            deleteFileButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
            deleteFileButton.title = 'Delete file';
            deleteFileButton.onclick = (e) => { e.stopPropagation(); deleteFileEntry(node.path, 'file'); };
            itemActions.appendChild(deleteFileButton);

            // Download button for individual files
            const downloadFileButton = document.createElement('button');
            downloadFileButton.classList.add('icon-button');
            downloadFileButton.innerHTML = '<i class="fas fa-download"></i>';
            downloadFileButton.title = 'Download file';
            downloadFileButton.onclick = (e) => { e.stopPropagation(); downloadFile(node.path); };
            itemActions.appendChild(downloadFileButton);

            contentWrapper.appendChild(itemActions);

            li.dataset.filename = node.path;
            li.classList.toggle('active', node.path === currentOpenFile);

            li.addEventListener('click', e => {
                e.stopPropagation();
                openFileInEditor(node.path);
            });
            li.appendChild(contentWrapper);
        }
        parentUl.appendChild(li);
    });
}

async function loadProjectData(projectId) {
    try {
        const projectFiles = await getItemFromStore(FILES_STORE_NAME, projectId);
        if (projectFiles && projectFiles.files) {
            projectFilesData = projectFiles.files;
            renderFileListDrawer();
            const firstFile = Object.keys(projectFilesData).filter(path => !path.endsWith('/'))[0];
            if (firstFile) {
                openFileInEditor(firstFile);
            } else {
                editor.setValue('');
                projectTitleElement.textContent = 'No File Open - Gen1 Editor';
                runButton.style.display = 'none';
                hideDocumentPreviewAndToolbar();
                showStatus('No files found in this project. Create a new one!', 'info');
            }
        } else {
            showStatus('Project files not found or empty for this project ID. Starting fresh.', 'info');
            projectFilesData = {};
            renderFileListDrawer();
            editor.setValue('');
            projectTitleElement.textContent = 'No File Open - Gen1 Editor';
            runButton.style.display = 'none';
            hideDocumentPreviewAndToolbar();
        }
    } catch (error) {
        showStatus('Failed to load project files: ' + error.message, 'error');
    }
}

function renderFileListDrawer() {
    fileListDrawer.innerHTML = '';
    const fileTree = buildFileTree(projectFilesData);
    renderTreeNodes(fileTree, fileListDrawer);
}

function showMonacoEditor() {
    editorContainer.style.display = 'block';
    documentPreview.style.display = 'none';
    docToolbar.style.display = 'none'; // Hide docToolbar when showing editor by default
    editor.layout(); // Ensure Monaco re-layouts itself
}

function showDocumentPreviewAndToolbar() {
    editorContainer.style.display = 'none';
    documentPreview.style.display = 'flex';
    docToolbar.style.display = 'flex'; // Show docToolbar
}

function hideDocumentPreviewAndToolbar() {
    editorContainer.style.display = 'block'; // Show editor by default
    documentPreview.style.display = 'none';
    docToolbar.style.display = 'none'; // Hide docToolbar
    documentPreview.innerHTML = ''; // Clear preview content
    editor.layout();
}

function openFileInEditor(filename) {
    if (filename.endsWith('/')) {
        showStatus('Cannot open folders in editor.', 'warning');
        return;
    }
    // Save content of previously open file
    if (currentOpenFile && editorContainer.style.display === 'block') { // Only save if editor was visible
        projectFilesData[currentOpenFile] = editor.getValue();
    }

    currentOpenFile = filename;
    const content = projectFilesData[filename] || '';
    const fileNameOnly = filename.split('/').pop();
    projectTitleElement.textContent = fileNameOnly + ' - Gen1 Editor';

    runButton.style.display = 'none'; // Hide run button by default
    docToolbar.style.display = 'none'; // Hide docToolbar by default
    generateDownloadButton.style.display = 'none'; // Hide generate button by default

    if (isImageFile(filename)) {
        showDocumentPreviewAndToolbar();
        documentPreview.innerHTML = `<img src="${content}" alt="${fileNameOnly}" class="document-image-preview">`;
        closePreviewButton.style.display = 'flex'; // Ensure close preview button is visible when previewing
        showStatus('Previewing image: ' + fileNameOnly, 'info', 1500);
        return;
    }

    if (isPdfFile(filename)) {
        showDocumentPreviewAndToolbar();
        // For PDFs, use an iframe. 'content' should be a Data URL or Blob URL.
        documentPreview.innerHTML = `<iframe src="${content}" class="document-pdf-preview" allowfullscreen></iframe>`;
        closePreviewButton.style.display = 'flex'; // Ensure close preview button is visible when previewing
        showStatus('Previewing PDF: ' + fileNameOnly, 'info', 1500);
        return;
    }

    if (isDocumentJsonFile(filename)) {
        showMonacoEditor(); // Show Monaco for JSON editing
        const language = getLanguageFromFilename(filename);
        if (currentMonacoModel) {
            currentMonacoModel.dispose();
        }
        currentMonacoModel = monaco.editor.createModel(content, language);
        editor.setModel(currentMonacoModel);
        
        docToolbar.style.display = 'flex'; // Show docToolbar for document JSONs
        generateDownloadButton.style.display = 'flex'; // Show generate button
        closePreviewButton.style.display = 'flex'; // Show close preview button (it always is with this toolbar)
        showStatus('Editing document structure: ' + fileNameOnly, 'info', 1500);
        return;
    }

    // Default to Monaco editor for all other files
    showMonacoEditor();
    const language = getLanguageFromFilename(filename);
    if (editor) {
        if (currentMonacoModel) {
            currentMonacoModel.dispose();
        }
        currentMonacoModel = monaco.editor.createModel(content, language);
        editor.setModel(currentMonacoModel);
    } else {
        showStatus('Editor not ready. Please refresh.', 'error');
        return;
    }

    const fileExtension = fileNameOnly.split('.').pop().toLowerCase();
    if (fileExtension === 'html' || fileExtension === 'htm') {
        runButton.style.display = 'flex';
    }

    const pathParts = filename.split('/');
    let currentAccumulatedPath = '';
    for (let i = 0; i < pathParts.length - 1; i++) {
        currentAccumulatedPath += (i > 0 ? '/' : '') + pathParts[i];
        if (currentAccumulatedPath) {
            expandedFolders.add(currentAccumulatedPath);
        }
    }

    renderFileListDrawer();
    closeDrawer();
    showStatus('Opened: ' + fileNameOnly, 'info', 1500);
}

async function saveCurrentFile() {
    if (!currentOpenFile || (!editor && documentPreview.style.display !== 'flex')) {
        showStatus('No file open to save.', 'error');
        return;
    }

    showStatus('Saving file...', 'info');
    // Only save editor content if editor is visible
    if (editorContainer.style.display === 'block') {
        projectFilesData[currentOpenFile] = editor.getValue();
    }
    // If it's a previewed file (image/pdf), its content is already a Data URL or Blob URL
    // and doesn't change unless re-uploaded. So no need to update projectFilesData here.

    try {
        await putItemInStore(FILES_STORE_NAME, {
            projectId: currentProjectId,
            files: projectFilesData
        });
        showStatus('File saved successfully!', 'success');
    } catch (error) {
        showStatus('Failed to save file: ' + error.message, 'error');
    }
}
//----end of file_tree_logic----

//----start of formatter_obfuscator----
async function formatCurrentFile() {
    if (!currentOpenFile || !editor || !window.prettier) {
        showStatus('Formatter not ready or no file open.', 'error');
        return;
    }
    if (editorContainer.style.display !== 'block') {
        showStatus('Cannot format a non-code file (image/PDF preview active).', 'warning');
        return;
    }

    const parser = getPrettierParserFromFilename(currentOpenFile);
    if (!parser) {
        showStatus('No formatter available for this file type.', 'info');
        return;
    }

    showStatus('Formatting code...', 'info');
    const code = editor.getValue();

    try {
        const formattedCode = await prettier.format(code, {
            parser: parser,
            tabWidth: 4,
            useTabs: false,
            semi: true,
            singleQuote: true,
            printWidth: 80,
            trailingComma: 'es5',
            arrowParens: 'always'
        });
        editor.setValue(formattedCode);
        showStatus('Code formatted successfully!', 'success');
        saveCurrentFile();
    } catch (error) {
        showStatus('Failed to format: ' + error.message, 'error');
    }
}

async function obfuscateCurrentJsFile() {
    if (!currentOpenFile || !editor) {
        showStatus('No file open to obfuscate.', 'error');
        return;
    }
    if (editorContainer.style.display !== 'block') {
        showStatus('Cannot obfuscate a non-code file (image/PDF preview active).', 'warning');
        return;
    }

    const filename = currentOpenFile;
    const ext = filename.split('.').pop().toLowerCase();
    if (ext !== 'js' && ext !== 'jsx' && ext !== 'ts' && ext !== 'tsx') {
        showStatus('Obfuscation is only for JavaScript/TypeScript files.', 'warning');
        return;
    }

    if (!window.JavaScriptObfuscator) {
        showStatus('JavaScript Obfuscator library not loaded.', 'error');
        return;
    }

    confirmModal('Obfuscate Code?', `Are you sure you want to obfuscate the current file "${filename.split('/').pop()}"? This operation is generally irreversible and makes code difficult to read.`, async (confirmed) => {
        if (!confirmed) {
            showStatus('Obfuscation cancelled.', 'info');
            return;
        }

        showStatus('Obfuscating code...', 'info');
        const code = editor.getValue();

        try {
            const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
                compact: true,
                controlFlowFlattening: true,
                controlFlowFlatteningThreshold: 1,
                deadCodeInjection: true,
                deadCodeInjectionThreshold: 1,
                debugProtection: false,
                debugProtectionInterval: 0,
                disableConsoleOutput: true,
                identifierNamesGenerator: 'hexadecimal',
                log: false,
                numbersToExpressions: true,
                renameGlobals: false,
                selfDefending: true,
                simplifyFactorialExpressions: true,
                splitStrings: true,
                splitStringsChunkLength: 10,
                stringArray: true,
                stringArrayEncoding: ['base64'],
                stringArrayIndexShift: true,
                stringArrayRotate: true,
                stringArrayShuffle: true,
                stringArrayWrappersCount: 5,
                stringArrayWrappersType: 'variable',
                stringArrayThreshold: 1,
                transformObjectKeys: true,
                unicodeEscapeSequence: false
            });
            const obfuscatedCode = obfuscationResult.getObfuscatedCode();
            editor.setValue(obfuscatedCode);
            await saveCurrentFile();
            showStatus('Code obfuscated and saved successfully!', 'success');
        } catch (error) {
            showStatus('Failed to obfuscate: ' + error.message, 'error');
        }
    });
}
//----end of formatter_obfuscator----

//----start of file_drawer_utilities----
function toggleDrawer() {
    fileDrawer.classList.toggle('open');
    drawerOverlay.classList.toggle('visible');
}

function closeDrawer() {
    fileDrawer.classList.remove('open');
    drawerOverlay.classList.remove('visible');
}

function normalizePath(path) {
    let normalized = path.replace(/\\/g, '/').replace(/^\//, '');
    const parts = normalized.split('/').filter(p => p !== '');
    return parts.join('/');
}

function findUniqueName(basePath, isFolder) {
    const folderPath = basePath.includes('/') ? basePath.substring(0, basePath.lastIndexOf('/')) : '';
    const baseName = isFolder ? basePath.split('/').pop() : basePath.substring(basePath.lastIndexOf('/') + 1, basePath.lastIndexOf('.'));
    const extension = isFolder ? '' : basePath.substring(basePath.lastIndexOf('.'));

    let counter = 1;
    let newName = baseName;
    let fullPath = (folderPath ? folderPath + '/' : '') + newName + (isFolder ? '/' : extension);

    while (projectFilesData.hasOwnProperty(fullPath)) {
        newName = `${baseName} (${counter})`;
        fullPath = (folderPath ? folderPath + '/' : '') + newName + (isFolder ? '/' : extension);
        counter++;
    }
    return newName + (isFolder ? '' : extension);
}

async function createFileEntry(type) {
    let parentDir = '';
    if (currentOpenFile) {
        if (currentOpenFile.endsWith('/')) {
            parentDir = currentOpenFile;
        } else {
            parentDir = currentOpenFile.substring(0, currentOpenFile.lastIndexOf('/') + 1);
        }
    }

    const title = type === 'file' ? 'Create New File' : 'Create New Folder';
    const message = type === 'file' ? 'Enter file name (e.g., index.html):' : 'Enter folder name:';
    const placeholder = type === 'file' ? 'new-file.txt' : 'new-folder';

    promptModal(title, message, placeholder, async (name) => {
        if (!name) {
            showStatus('Name cannot be empty.', 'error');
            return;
        }

        let fullPath = '';
        if (type === 'file') {
            fullPath = normalizePath(parentDir + name);
            if (fullPath.endsWith('/')) {
                 showStatus('File name cannot end with a slash.', 'error');
                 return;
            }
        } else { // type === 'folder'
            fullPath = normalizePath(parentDir + name);
            if (!fullPath.endsWith('/')) {
                fullPath += '/';
            }
        }

        if (projectFilesData.hasOwnProperty(fullPath)) {
            showStatus(`A ${type} with that name already exists.`, 'error');
            return;
        }

        if (type === 'file') {
            projectFilesData[fullPath] = '';
            openFileInEditor(fullPath);
        } else { // type === 'folder'
            projectFilesData[fullPath] = null;
            expandedFolders.add(normalizePath(fullPath.slice(0, -1)));
            renderFileListDrawer();
        }
        await saveProjectFiles();
        showStatus(`${type === 'file' ? 'File' : 'Folder'} created: ${name}`, 'success');
    });
}

async function uploadFiles(files) {
    if (!files || files.length === 0) {
        return;
    }

    showStatus('Uploading files...', 'info');
    let firstUploadedFile = null;

    for (const file of files) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const content = e.target.result; // For text files, this is text. For binary, this is Data URL.
            let fullPath = normalizePath(file.name);

            if (projectFilesData.hasOwnProperty(fullPath)) {
                const newName = findUniqueName(file.name, false);
                showStatus(`File "${file.name}" already exists. Uploaded as "${newName}" instead.`, 'warning', 3000);
                fullPath = normalizePath(newName);
            }
            projectFilesData[fullPath] = content;

            if (!firstUploadedFile) {
                firstUploadedFile = fullPath;
            }

            await saveProjectFiles();
            renderFileListDrawer();
            showStatus(`Uploaded: ${file.name}`, 'success', 1500);
        };
        reader.onerror = () => {
            showStatus(`Failed to read file: ${file.name}`, 'error');
        };

        // Read based on file type. Use Data URL for images/PDFs, text for others.
        if (isImageFile(file.name) || isPdfFile(file.name)) {
            reader.readAsDataURL(file);
        } else {
            reader.readAsText(file);
        }
    }

    setTimeout(() => {
        if (firstUploadedFile) {
            openFileInEditor(firstUploadedFile);
        }
    }, 500);
}

async function downloadFile(path) {
    const filename = path.split('/').pop();
    const content = projectFilesData[path];

    if (content === undefined || content === null) {
        showStatus(`No content found for "${filename}".`, 'error');
        return;
    }

    let blob;
    let mimeType = 'application/octet-stream'; // Default generic binary type

    const ext = filename.split('.').pop().toLowerCase();

    // Determine MIME type based on extension
    if (isImageFile(filename)) {
        mimeType = 'image/' + ext;
        blob = await (await fetch(content)).blob(); // Fetch Data URL to create a blob
    } else if (isPdfFile(filename)) {
        mimeType = 'application/pdf';
        blob = await (await fetch(content)).blob(); // Fetch Data URL to create a blob
    } else if (isDocumentJsonFile(filename)) { // These are JSON files that *describe* documents
        // User wants to download the generated document, not the JSON itself
        showStatus('Please use "Generate & Download" for document files to get the binary output.', 'warning');
        return;
    } else {
        // Assume text file
        mimeType = 'text/plain'; // Fallback
        if (ext === 'html') mimeType = 'text/html';
        else if (ext === 'css') mimeType = 'text/css';
        else if (ext === 'js') mimeType = 'application/javascript';
        else if (ext === 'json') mimeType = 'application/json';
        blob = new Blob([content], { type: mimeType });
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showStatus(`Downloaded "${filename}".`, 'success', 2000);
}

async function deleteFileEntry(path, type) {
    const name = path.split('/').filter(Boolean).pop();
    const message = type === 'file'
        ? `Are you sure you want to delete the file "${name}"? This action cannot be undone.`
        : `Are you sure you want to delete the folder "${name}" and all its contents? This action cannot be undone.`;

    confirmModal('Delete Confirmation', message, async (confirmed) => {
        if (confirmed) {
            if (type === 'file') {
                if (projectFilesData.hasOwnProperty(path)) {
                    delete projectFilesData[path];
                    if (currentOpenFile === path) {
                        currentOpenFile = null;
                        editor.setValue('');
                        projectTitleElement.textContent = 'No File Open - Gen1 Editor';
                        runButton.style.display = 'none';
                        hideDocumentPreviewAndToolbar();
                    }
                }
            } else { // type === 'folder'
                const folderPathPrefix = path.endsWith('/') ? path : path + '/';
                for (const key in projectFilesData) {
                    if (key.startsWith(folderPathPrefix)) {
                        delete projectFilesData[key];
                        if (currentOpenFile === key) {
                            currentOpenFile = null;
                            editor.setValue('');
                            projectTitleElement.textContent = 'No File Open - Gen1 Editor';
                            runButton.style.display = 'none';
                            hideDocumentPreviewAndToolbar();
                        }
                    }
                }
                if (projectFilesData.hasOwnProperty(folderPathPrefix)) {
                    delete projectFilesData[folderPathPrefix];
                }
                expandedFolders.delete(normalizePath(path.slice(0, -1)));
            }
            await saveProjectFiles();
            renderFileListDrawer();
            showStatus(`${type === 'file' ? 'File' : 'Folder'} deleted: ${name}`, 'success');
        }
    });
}

async function renameFileEntry(oldPath, type) {
    const oldName = oldPath.split('/').filter(Boolean).pop();
    const title = type === 'file' ? 'Rename File' : 'Rename Folder';
    const message = type === 'file' ? `Enter new name for "${oldName}":` : `Enter new name for folder "${oldName}":`;
    const defaultName = oldName;

    promptModal(title, message, defaultName, async (newName) => {
        if (!newName || newName === oldName) {
            showStatus('Rename cancelled or new name is the same.', 'info');
            return;
        }

        let newPath = '';
        const parentPathEndIndex = oldPath.lastIndexOf(oldName) > 0 ? oldPath.lastIndexOf(oldName) : 0;
        const parentPath = oldPath.substring(0, parentPathEndIndex);

        if (type === 'file') {
            newPath = normalizePath(parentPath + newName);
            if (newPath.endsWith('/')) {
                 showStatus('File name cannot end with a slash.', 'error');
                 return;
            }
        } else { // type === 'folder'
            newPath = normalizePath(parentPath + newName);
            if (!newPath.endsWith('/')) {
                newPath += '/';
            }
        }

        if (projectFilesData.hasOwnProperty(newPath) && newPath !== oldPath) {
            showStatus(`A ${type} with name "${newName}" already exists.`, 'error');
            return;
        }

        if (type === 'file') {
            const content = projectFilesData[oldPath];
            delete projectFilesData[oldPath];
            projectFilesData[newPath] = content;
            if (currentOpenFile === oldPath) {
                currentOpenFile = newPath;
            }
        } else { // type === 'folder'
            const oldFolderPathPrefix = oldPath.endsWith('/') ? oldPath : oldPath + '/';
            const newFolderPathPrefix = newPath.endsWith('/') ? newPath : newPath + '/';

            const keysToMove = Object.keys(projectFilesData).filter(key => key.startsWith(oldFolderPathPrefix));

            for (const key of keysToMove) {
                const newKey = newFolderPathPrefix + key.substring(oldFolderPathPrefix.length);
                projectFilesData[newKey] = projectFilesData[key];
                delete projectFilesData[key];
                if (currentOpenFile === key) {
                    currentOpenFile = newKey;
                }
            }
            if (projectFilesData.hasOwnProperty(oldFolderPathPrefix)) {
                projectFilesData[newFolderPathPrefix] = projectFilesData[oldFolderPathPrefix];
                delete projectFilesData[oldFolderPathPrefix];
            }

            const oldNormalizedFolder = normalizePath(oldPath.slice(0, -1));
            const newNormalizedFolder = normalizePath(newPath.slice(0, -1));
            if (expandedFolders.has(oldNormalizedFolder)) {
                expandedFolders.delete(oldNormalizedFolder);
                expandedFolders.add(newNormalizedFolder);
            }
        }

        await saveProjectFiles();
        renderFileListDrawer();
        if (currentOpenFile) {
            openFileInEditor(currentOpenFile);
        } else {
            projectTitleElement.textContent = 'No File Open - Gen1 Editor';
        }
        showStatus(`${type === 'file' ? 'File' : 'Folder'} renamed to ${newName}`, 'success');
    });
}

async function saveProjectFiles() {
    return putItemInStore(FILES_STORE_NAME, {
        projectId: currentProjectId,
        files: projectFilesData
    });
}
//----end of file_drawer_utilities----

//----start of modal_utilities----
function showModal(title, message, inputVisible, defaultValue, confirmCallback) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalInput.style.display = inputVisible ? 'block' : 'none';
    modalInput.value = defaultValue || '';

    modalConfirm.onclick = null;
    modalCancel.onclick = null;

    modalConfirm.onclick = () => {
        genericModal.classList.remove('visible');
        confirmCallback(inputVisible ? modalInput.value.trim() : true);
    };
    modalCancel.onclick = () => {
        genericModal.classList.remove('visible');
        confirmCallback(false);
    };

    genericModal.classList.add('visible');
    if (inputVisible) {
        modalInput.focus();
        modalInput.select();
    }
}

function promptModal(title, message, defaultValue, callback) {
    showModal(title, message, true, defaultValue, callback);
}

function confirmModal(title, message, callback) {
    showModal(title, message, false, null, callback);
}
//----end of modal_utilities----

//----start of document_creation_logic----
function showCreateDocumentModal() {
    createDocumentModal.classList.add('visible');
    docNameInput.value = '';
    docNameInput.focus();
}

function hideCreateDocumentModal() {
    createDocumentModal.classList.remove('visible');
}

async function createDocumentEntry() {
    const docType = docTypeSelect.value;
    const docName = docNameInput.value.trim();

    if (!docName) {
        showStatus('Document name cannot be empty.', 'error');
        return;
    }
    // Updated regex to allow more characters common in filenames but prevent /
    if (!/^[a-zA-Z0-9_\-.\s()\[\]]+$/.test(docName)) {
        showStatus('Document name contains invalid characters. Use letters, numbers, hyphens, underscores, spaces, dots, parentheses, or square brackets.', 'error');
        return;
    }

    let parentDir = '';
    if (currentOpenFile) {
        if (currentOpenFile.endsWith('/')) {
            parentDir = currentOpenFile;
        } else {
            parentDir = currentOpenFile.substring(0, currentOpenFile.lastIndexOf('/') + 1);
        }
    }

    const filenameWithExt = `${docName}.${docType}doc`; // e.g., my_report.pdfdoc
    const fullPath = normalizePath(parentDir + filenameWithExt);

    if (projectFilesData.hasOwnProperty(fullPath)) {
        showStatus(`A document with that name already exists.`, 'error');
        return;
    }

    let initialContent = {};
    // let language = 'json'; // Removed, getLanguageFromFilename handles it

    switch (docType) {
        case 'pdf':
            initialContent = {
                pages: [
                    {
                        content: [
                            { type: 'text', text: 'New PDF Document', x: 20, y: 20, options: { fontSize: 24, textColor: '#333333' } },
                            { type: 'text', text: 'Edit this JSON to define your PDF content.', x: 20, y: 30, options: { fontSize: 12, textColor: '#666666' } }
                        ]
                    }
                ]
            };
            break;
        case 'docx':
            initialContent = {
                sections: [
                    {
                        properties: {
                            page: { size: { width: 12240, height: 15840, orientation: "portrait" }, margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }
                        },
                        children: [
                            // Corrected to use docx enums for properties
                            { type: 'paragraph', text: 'New DOCX Document', options: { heading: window.docx.HeadingLevel.HEADING_1, alignment: window.docx.AlignmentType.CENTER } },
                            { type: 'paragraph', text: 'Edit this JSON to define your DOCX content.', options: {} }
                        ]
                    }
                ]
            };
            break;
        case 'xlsx':
            initialContent = {
                sheets: [
                    {
                        name: 'Sheet1',
                        data: [['Header 1', 'Header 2'], ['Data A1', 'Data B1'], ['Data A2', 'Data B2']],
                        cell_styles: { "A1": { "font": { "bold": true } }, "B1": { "font": { "bold": true } } }
                    }
                ]
            };
            break;
        case 'pptx':
            initialContent = {
                slides: [
                    {
                        master: 'TITLE_AND_CONTENT',
                        elements: [
                            { type: 'text', text: 'New PPTX Presentation', options: { x: 0.5, y: 0.5, w: 9, h: 1, fontSize: 36, color: '007bff' } },
                            { type: 'text', text: 'Edit this JSON to define your slides.', options: { x: 0.5, y: 1.5, w: 9, h: 1, fontSize: 18 } }
                        ]
                    }
                ],
                // Placeholder for masters - user can define here if needed
                masters: []
            };
            break;
        default:
            showStatus('Unknown document type selected.', 'error');
            return;
    }

    projectFilesData[fullPath] = JSON.stringify(initialContent, null, 2);
    await saveProjectFiles();
    hideCreateDocumentModal();
    openFileInEditor(fullPath);
    showStatus(`New ${docType.toUpperCase()} document definition created: ${docName}`, 'success');
}

async function generateAndDownloadDocument() {
    if (!currentOpenFile || !isDocumentJsonFile(currentOpenFile)) {
        showStatus('Please open a document definition file (.pdfdoc, .docxdoc, etc.) to generate and download.', 'warning');
        return;
    }

    showStatus('Generating document...', 'info');
    const filename = currentOpenFile;
    const docType = filename.split('.').slice(-2, -1)[0]; // e.g., 'pdf' from 'my_report.pdfdoc'
    const originalFilename = filename.replace(/\.([a-zA-Z0-9]+)doc$/, '.$1'); // my_report.pdf

    let docContent;
    try {
        docContent = JSON.parse(editor.getValue());
    } catch (e) {
        showStatus('Invalid JSON in document definition. Please fix errors.', 'error');
        console.error('JSON Parse Error:', e);
        return;
    }

    try {
        let blob;
        let mimeType;

        switch (docType) {
            case 'pdf':
                if (!window.jspdf || !window.jspdf.AutoTable) {
                    showStatus('jspdf or jspdf-autotable library not loaded.', 'error');
                    return;
                }
                blob = await generatePdfBlob(docContent);
                mimeType = 'application/pdf';
                break;
            case 'docx':
                if (!window.docx) {
                    showStatus('docx library not loaded.', 'error');
                    return;
                }
                blob = await generateDocxBlob(docContent);
                mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                break;
            case 'xlsx':
                if (!window.XLSX) {
                    showStatus('xlsx library not loaded.', 'error');
                    return;
                }
                blob = await generateXlsxBlob(docContent);
                mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                break;
            case 'pptx':
                if (!window.PptxGenJS) {
                    showStatus('pptxgenjs library not loaded.', 'error');
                    return;
                }
                blob = await generatePptxBlob(docContent);
                mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
                break;
            default:
                showStatus('Unsupported document type for generation.', 'error');
                return;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = originalFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showStatus(`${docType.toUpperCase()} document "${originalFilename}" generated and downloaded!`, 'success', 5000);

        // Optional: Preview the generated document directly in the IDE
        if (docType === 'pdf') {
            showDocumentPreviewAndToolbar();
            documentPreview.innerHTML = `<iframe src="${url}" class="document-pdf-preview" allowfullscreen></iframe>`;
            // Note: The URL is a Blob URL for the *generated* content, not the stored one.
            // This URL will be revoked, so only for immediate preview.
        } else {
            // For other types, direct preview isn't as straightforward as PDF in an iframe.
            // A simple message can be displayed.
            showStatus('Document generated and downloaded. Direct preview for DOCX, XLSX, PPTX not supported. Please open the downloaded file.', 'info', 5000);
            showMonacoEditor(); // Go back to editor
        }

    } catch (error) {
        showStatus(`Failed to generate ${docType.toUpperCase()} document: ${error.message}`, 'error');
        console.error(`Document generation error for ${docType}:`, error);
    }
}

// Helper functions to generate blobs from JSON content
async function generatePdfBlob(content) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF(content.options || {}); // Pass options like orientation, unit, format

    content.pages.forEach((page, pageIndex) => {
        if (pageIndex > 0) doc.addPage();
        page.content.forEach(element => {
            switch (element.type) {
                case 'text':
                    doc.setFontSize(element.options.fontSize || 12);
                    doc.setTextColor(element.options.textColor || '#000000');
                    doc.text(element.text, element.x, element.y, element.options.textOptions || {});
                    break;
                case 'image':
                    doc.addImage(element.src, element.x, element.y, element.width, element.height);
                    break;
                case 'rectangle':
                    doc.setDrawColor(element.options.borderColor || 0);
                    doc.setFillColor(element.options.fillColor || 255);
                    doc.rect(element.x, element.y, element.width, element.height, element.options.style || 'F');
                    break;
                case 'line':
                    doc.setDrawColor(element.options.color || 0);
                    doc.setLineWidth(element.options.lineWidth || 0.1);
                    doc.line(element.x1, element.y1, element.x2, element.y2);
                    break;
                case 'table':
                    if (window.jspdf.AutoTable) {
                        window.jspdf.AutoTable(doc, {
                            head: element.head,
                            body: element.body,
                            startY: element.startY, // If not provided, it will auto-position
                            ...element.options
                        });
                    }
                    break;
                // Add more PDF element types as needed
            }
        });
    });
    return doc.output('blob');
}

async function generateDocxBlob(content) {
    const doc = new window.docx.Document({ // Corrected to use window.docx
        sections: content.sections.map(section => ({
            properties: section.properties || {},
            children: section.children.map(child => {
                switch (child.type) {
                    case 'paragraph':
                        return new window.docx.Paragraph({ // Corrected
                            text: child.text,
                            ...child.options
                        });
                    case 'image':
                        // Assuming src is base64. docx needs it wrapped in Media.
                        return new window.docx.Paragraph({ // Corrected
                            children: [
                                new window.docx.ImageRun({ // Corrected
                                    data: child.src.split(',')[1], // Remove "data:image/png;base64," part
                                    transformation: {
                                        width: child.width,
                                        height: child.height,
                                    },
                                    ...child.options
                                }),
                            ],
                        });
                    case 'table':
                        return new window.docx.Table({ // Corrected
                            rows: child.rows.map(row => new window.docx.TableRow({ // Corrected
                                children: row.map(cellDef => new window.docx.TableCell({ // Corrected
                                    children: cellDef.children.map(p => new window.docx.Paragraph({ text: p.text, ...p.options })), // Corrected
                                    ...cellDef.options
                                }))
                            })),
                            ...child.options
                        });
                    default:
                        console.warn('Unknown DOCX child type:', child.type);
                        return new window.docx.Paragraph({ text: `[Unsupported Element: ${child.type}]` }); // Corrected
                }
            })
        }))
    });
    return window.docx.Packer.toBlob(doc); // Corrected
}

async function generateXlsxBlob(content) {
    const workbook = window.XLSX.utils.book_new(); // Corrected

    content.sheets.forEach(sheetDef => {
        const worksheet = window.XLSX.utils.aoa_to_sheet(sheetDef.data); // Corrected

        // Apply cell styles
        if (sheetDef.cell_styles) {
            for (const cellRef in sheetDef.cell_styles) {
                if (worksheet[cellRef]) {
                    worksheet[cellRef].s = sheetDef.cell_styles[cellRef];
                } else if (cellRef.includes(':')) { // Handle ranges or column/row styles
                    // This part can be complex depending on how SheetJS handles range styles
                    // For simplicity, we'll only apply to existing cells in the worksheet.
                    // For full range/column/row styling, you might need to iterate or use more advanced SheetJS features.
                }
            }
        }

        // Apply merges
        if (sheetDef.merges && sheetDef.merges.length > 0) {
            if (!worksheet['!merges']) worksheet['!merges'] = [];
            sheetDef.merges.forEach(merge => {
                worksheet['!merges'].push(window.XLSX.utils.decode_range(merge)); // Corrected
            });
        }

        window.XLSX.utils.book_append_sheet(workbook, worksheet, sheetDef.name); // Corrected
    });

    return new Blob([window.XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })], { // Corrected
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
}

async function generatePptxBlob(content) {
    const pptx = new window.PptxGenJS(); // Corrected

    // Add master slides if defined
    if (content.masters) {
        content.masters.forEach(masterDef => {
            const master = pptx.defineSlideMaster(masterDef);
            // Objects array for master slides: https://gitbrent.github.io/PptxGenJS/docs/api-masters.html
            // Example for objects parsing (similar to slide elements but inside masterDef.objects)
            if (masterDef.objects) {
                masterDef.objects.forEach(obj => {
                    // Corrected to use master.add* and check obj.type
                    if (obj.type === 'text') master.addText(obj.text, obj.options);
                    else if (obj.type === 'image') master.addImage({ data: obj.src, ...obj.options }); // PptxGenJS addImage expects an object
                    else if (obj.type === 'rect') master.addShape(pptx.ShapeType.RECTANGLE, obj.options); // Example
                    // Add more object types for masters if needed (shapes, charts etc.)
                });
            }
        });
    }

    content.slides.forEach(slideDef => {
        const slide = pptx.addSlide(slideDef.master); // Use master name if provided

        slideDef.elements.forEach(element => {
            switch (element.type) {
                case 'text':
                    slide.addText(element.text, element.options);
                    break;
                case 'image':
                    slide.addImage({ data: element.src, ...element.options });
                    break;
                case 'table':
                    slide.addTable(element.data, element.options);
                    break;
                case 'shape':
                    slide.addShape(pptx.ShapeType[element.shapeType.toUpperCase()], element.options);
                    break;
                case 'chart':
                    slide.addChart(pptx.ChartType[element.chartType.toUpperCase()], element.data, element.options);
                    break;
                default:
                    console.warn('Unknown PPTX element type:', element.type);
            }
        });
        if (slideDef.notes) {
            slide.addNotes(slideDef.notes);
        }
    });

    return pptx.write('blob');
}
//----end of document_creation_logic----

//----start of event_listeners----
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize DOM elements here
    body = document.body;
    backButton = document.getElementById('backButton');
    drawerButton = document.getElementById('drawerButton');
    runButton = document.getElementById('runButton');
    projectTitleElement = document.getElementById('projectTitle');
    editorContainer = document.getElementById('editor-container');
    fileDrawer = document.getElementById('fileDrawer');
    fileListDrawer = document.getElementById('fileListDrawer');
    drawerOverlay = document.getElementById('drawerOverlay');
    aiButton = document.getElementById('aiButton');
    formatterButton = document.getElementById('formatterButton');
    obfuscateButton = document.getElementById('obfuscateButton');
    saveButton = document.getElementById('saveButton');
    copyCodeButton = document.getElementById('copyCodeButton');
    howToUseButton = document.getElementById('howToUseButton');
    statusMessageElement = document.getElementById('statusMessage');
    themeToggleButton = document.getElementById('themeToggleButton');

    newFileButton = document.getElementById('newFileButton');
    newFolderButton = document.getElementById('newFolderButton');
    uploadFileButton = document.getElementById('uploadFileButton');
    createDocumentButton = document.getElementById('createDocumentButton');
    fileInput = document.getElementById('fileInput');

    genericModal = document.getElementById('genericModal');
    modalTitle = document.getElementById('modalTitle');
    modalMessage = document.getElementById('modalMessage');
    modalInput = document.getElementById('modalInput');
    modalConfirm = document.getElementById('modalConfirm');
    modalCancel = document.getElementById('modalCancel');

    createDocumentModal = document.getElementById('createDocumentModal');
    docTypeSelect = document.getElementById('docTypeSelect');
    docNameInput = document.getElementById('docNameInput');
    docCreateConfirm = document.getElementById('docCreateConfirm');
    docCreateCancel = document.getElementById('docCreateCancel');

    documentPreview = document.getElementById('document-preview');
    docToolbar = document.getElementById('docToolbar');
    generateDownloadButton = document.getElementById('generateDownloadButton');
    closePreviewButton = document.getElementById('closePreviewButton');

    // Attach event listeners here
    backButton.addEventListener('click', () => {
        window.location.href = 'Welcome.html';
    });
    drawerButton.addEventListener('click', toggleDrawer);
    drawerOverlay.addEventListener('click', closeDrawer);
    themeToggleButton.addEventListener('click', toggleTheme);

    runButton.addEventListener('click', () => {
        if (currentOpenFile && (currentOpenFile.endsWith('.html') || currentOpenFile.endsWith('.htm'))) {
            const htmlContent = editor.getValue();
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const blobUrl = URL.createObjectURL(blob);
            const previewWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer');
            if (!previewWindow) {
                showStatus('Pop-up blocked! Please allow pop-ups for live preview.', 'error', 5000);
            }
        } else {
            showStatus('Cannot run non-HTML files directly as a live preview.', 'error');
        }
    });

    aiButton.addEventListener('click', () => {
        window.location.href = 'Ai.html';
    });
    formatterButton.addEventListener('click', formatCurrentFile);
    obfuscateButton.addEventListener('click', obfuscateCurrentJsFile);
    saveButton.addEventListener('click', saveCurrentFile);
    copyCodeButton.addEventListener('click', async () => {
        if (!currentOpenFile || (!editor && documentPreview.style.display !== 'flex')) {
            showStatus('No file open to copy.', 'error');
            return;
        }
        if (editorContainer.style.display !== 'block') {
            showStatus('Cannot copy content from document preview.', 'warning');
            return;
        }

        const codeToCopy = editor.getValue();
        try {
            await navigator.clipboard.writeText(codeToCopy);
            showStatus('Code copied to clipboard!', 'success');
        } catch (err) {
            console.error('Failed to copy text: ', err);
            showStatus('Failed to copy code. Please try again or copy manually.', 'error');
        }
    });
    howToUseButton.addEventListener('click', () => {
        window.location.href = 'Htu.html';
    });

    newFileButton.addEventListener('click', () => createFileEntry('file'));
    newFolderButton.addEventListener('click', () => createFileEntry('folder'));
    uploadFileButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (event) => uploadFiles(event.target.files));

    createDocumentButton.addEventListener('click', showCreateDocumentModal);
    docCreateConfirm.addEventListener('click', () => {
        createDocumentEntry();
    });
    docCreateCancel.addEventListener('click', hideCreateDocumentModal);

    generateDownloadButton.addEventListener('click', generateAndDownloadDocument);
    closePreviewButton.addEventListener('click', () => {
        hideDocumentPreviewAndToolbar();
        showMonacoEditor();
    });

    // Initial setup after DOM is loaded
    loadTheme();
    await openGen1DB();
    await initializeMonacoEditor();

    currentProjectId = localStorage.getItem(CURRENT_PROJECT_ID_LS_KEY);

    if (!currentProjectId) {
        showStatus('No project selected. Returning to projects...', 'error', 4000);
        setTimeout(() => {
            window.location.href = 'Welcome.html';
        }, 4000);
        return;
    }

    try {
        const projectMetadata = await getItemFromStore(PROJECTS_STORE_NAME, currentProjectId);
        if (projectMetadata && projectMetadata.name) {
            projectTitleElement.textContent = projectMetadata.name + ' - Gen1 Editor';
        } else {
            projectTitleElement.textContent = 'Untitled Project - Gen1 Editor';
            showStatus('Project metadata not found.', 'error');
        }
    } catch (error) {
        projectTitleElement.textContent = 'Error Loading Project';
        showStatus('Failed to load project metadata: ' + error.message, 'error');
    }

    await loadProjectData(currentProjectId);
});
//----end of event_listeners----
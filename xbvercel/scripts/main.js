const DB_NAME = 'Gen1DB';
const DB_VERSION = 1;
const PROJECTS_STORE_NAME = 'projects';
const FILES_STORE_NAME = 'projectFiles';
const CURRENT_PROJECT_ID_LS_KEY = 'gen1_current_project_id';
const THEME_STORAGE_KEY = 'gen1_theme';

const body = document.body;
const themeSwitch = document.getElementById('themeSwitch');
const lightIcon = document.getElementById('lightIcon');
const moonIcon = document.getElementById('moonIcon');
const themeText = document.getElementById('themeText');
const backButton = document.getElementById('backButton');
const projectNameInput = document.getElementById('projectName');
const githubRepoInput = document.getElementById('githubRepoUrl');
const importGithubBtn = document.getElementById('importGithubBtn');
const fileUploadArea = document.getElementById('fileUploadArea');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const createProjectBtn = document.getElementById('createProjectBtn');
const statusMessage = document.getElementById('statusMessage');

let db;
let uploadedFilesMap = new Map();
let statusTimeoutId;

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
      showStatus('Database setup complete!', 'info');
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      showStatus('Database opened successfully.', 'info');
      resolve(db);
    };

    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      showStatus(`IndexedDB error: ${event.target.error.message}`, 'error');
      reject(event.target.error);
    };
  });
}

function getItemFromStore(storeName, key) {
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

function loadTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === 'dark') {
    body.classList.add('dark-theme');
    themeText.textContent = 'Dark Mode';
    lightIcon.style.display = 'none';
    moonIcon.style.display = 'inline-block';
  } else {
    body.classList.remove('dark-theme');
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
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

function showStatus(message, type = 'info') {
  clearTimeout(statusTimeoutId);
  statusMessage.style.display = 'flex';
  statusMessage.className = 'message-area'; // Reset classes
  statusMessage.classList.add(type);

  let iconClass = 'fas fa-info-circle';
  if (type === 'error') iconClass = 'fas fa-times-circle';
  if (type === 'success') iconClass = 'fas fa-check-circle';

  statusMessage.innerHTML = `<i class="${iconClass}"></i> <p>${message}</p>`;
  statusTimeoutId = setTimeout(() => { hideStatus(); }, 3000);
}

function hideStatus() {
  clearTimeout(statusTimeoutId);
  statusMessage.style.display = 'none';
}

backButton.addEventListener('click', () => {
  window.history.back();
});

fileUploadArea.addEventListener('click', () => {
  fileInput.click();
});

fileUploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  fileUploadArea.style.borderColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-main');
});

fileUploadArea.addEventListener('dragleave', () => {
  fileUploadArea.style.borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border');
});

fileUploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  fileUploadArea.style.borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border');
  processFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => {
  processFiles(e.target.files);
});

function getMimeType(filename) {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html';
    case '.css': return 'text/css';
    case '.js': return 'application/javascript';
    case '.json': return 'application/json';
    case '.txt': return 'text/plain';
    case '.md': return 'text/markdown';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.jpg': case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    case '.mp3': return 'audio/mpeg';
    case '.wav': return 'audio/wav';
    case '.mp4': return 'video/mp4';
    case '.webm': return 'video/webm';
    case '.zip': return 'application/zip';
    default: return 'application/octet-stream';
  }
}

function isTextFileByExtension(filename) {
  const textExtensions = ['.html', '.css', '.js', '.json', '.txt', '.md', '.svg', '.xml', '.jsx', '.tsx', '.ts', '.py', '.jsonc', '.glsl'];
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return textExtensions.includes(ext) || (!filename.includes('.') && filename.length > 0);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function readFileAsAppropriateContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = (e) => reject(e);
    if (file.type.startsWith('text/') || file.type.includes('json') || file.type.includes('javascript') || file.type.includes('xml') || file.type.includes('svg') || isTextFileByExtension(file.name)) {
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsText(file);
    } else {
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    }
  });
}

async function processFiles(files) {
  if (files.length === 0) return;
  hideStatus();
  const fileArray = Array.from(files);
  const zipFile = fileArray.find(file => file.name.endsWith('.zip'));

  if (zipFile) {
    if (fileArray.length > 1) {
      showStatus('Warning: A .zip file was detected. Only the zip file will be processed. Other files will be ignored.', 'error');
    }
    await processZipFile(zipFile);
  } else {
    processIndividualFiles(fileArray);
  }
  fileInput.value = '';
}

async function processZipFile(zipFile) {
  showStatus('Processing zip file...', 'info');
  uploadedFilesMap.clear();
  fileList.innerHTML = '';
  createProjectBtn.disabled = true;
  try {
    const zip = await JSZip.loadAsync(zipFile);
    let filesInZipCount = 0;
    for (const relativePath in zip.files) {
      const zipEntry = zip.files[relativePath];
      if (!zipEntry.dir) {
        const filename = zipEntry.name;
        let content;
        if (isTextFileByExtension(filename)) {
          content = await zipEntry.async('text');
        } else {
          const arrayBuffer = await zipEntry.async('arraybuffer');
          const blob = new Blob([arrayBuffer], { type: getMimeType(filename) });
          content = await blobToBase64(blob);
        }
        uploadedFilesMap.set(filename, content);
        filesInZipCount++;
      }
    }

    if (filesInZipCount === 0) {
      showStatus('The selected zip file contains no readable files or supported formats.', 'error');
      fileList.classList.add('hidden');
      return;
    }
    showStatus(`Zip file "${zipFile.name}" processed. Found ${filesInZipCount} files.`, 'success');
    renderFileList();
  } catch (error) {
    console.error('Error processing zip file:', error);
    showStatus(`Failed to process zip file: ${error.message}. Please ensure it's a valid zip.`, 'error');
    uploadedFilesMap.clear();
    fileList.classList.add('hidden');
  } finally {
    createProjectBtn.disabled = false;
  }
}

async function processIndividualFiles(files) {
  let filesAddedCount = 0;
  for (const file of files) {
    if (file.name.endsWith('.zip')) {
      continue;
    }
    try {
      const content = await readFileAsAppropriateContent(file);
      uploadedFilesMap.set(file.name, content);
      filesAddedCount++;
    } catch (error) {
      console.error(`Failed to read file ${file.name}:`, error);
      showStatus(`Failed to read "${file.name}". It might be too large or an unsupported format.`, 'error');
    }
  }
  if (filesAddedCount > 0) {
    showStatus(`Added ${filesAddedCount} individual file(s).`, 'success');
  }
  renderFileList();
}

function renderFileList() {
  fileList.innerHTML = '';
  if (uploadedFilesMap.size === 0) {
    fileList.classList.add('hidden');
    return;
  }

  uploadedFilesMap.forEach((content, filename) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${filename}</span><button class="remove-file" data-filename="${filename}"><i class="fas fa-times"></i></button>`;
    fileList.appendChild(li);
  });

  fileList.classList.remove('hidden');

  fileList.querySelectorAll('.remove-file').forEach(button => {
    button.addEventListener('click', (e) => {
      const filenameToRemove = e.currentTarget.dataset.filename;
      uploadedFilesMap.delete(filenameToRemove);
      renderFileList();
      showStatus(`Removed "${filenameToRemove}".`, 'info');
    });
  });
}

importGithubBtn.addEventListener('click', async () => {
  hideStatus();
  const repoUrl = githubRepoInput.value.trim();
  if (!repoUrl) {
    showStatus('Please enter a GitHub repository URL.', 'error');
    return;
  }

  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)(?:\.git)?/);
  if (!match) {
    showStatus('Invalid GitHub repository URL format. Expected: github.com/user/repo-name', 'error');
    return;
  }

  const owner = match[1];
  const repoName = match[2];

  showStatus(`Attempting to import ${owner}/${repoName} from GitHub...`, 'info');
  createProjectBtn.disabled = true;
  importGithubBtn.disabled = true;
  uploadedFilesMap.clear();
  fileList.innerHTML = '';

  try {
    const repoApiUrl = `https://api.github.com/repos/${owner}/${repoName}`;
    const repoResponse = await fetch(repoApiUrl);
    if (!repoResponse.ok) {
      if (repoResponse.status === 404) {
        throw new Error('Repository not found. Please check the URL and ensure it\'s public.');
      }
      throw new Error(`Failed to get repository info: ${repoResponse.status} ${repoResponse.statusText}`);
    }
    const repoData = await repoResponse.json();
    const defaultBranch = repoData.default_branch || 'main';

    const treeApiUrl = `https://api.github.com/repos/${owner}/${repoName}/git/trees/${defaultBranch}?recursive=1`;
    const treeResponse = await fetch(treeApiUrl);
    if (!treeResponse.ok) {
      if (treeResponse.status === 404) {
        throw new Error(`Default branch '${defaultBranch}' not found or repository is empty.`);
      }
      throw new Error(`Failed to get repository tree for branch '${defaultBranch}': ${treeResponse.status} ${treeResponse.statusText}`);
    }
    const treeData = await treeResponse.json();

    if (!treeData.tree || treeData.tree.length === 0) {
      showStatus('No files found in the GitHub repository.', 'error');
      fileList.classList.add('hidden');
      return;
    }

    let filesImportedCount = 0;
    for (const item of treeData.tree) {
      if (item.type === 'blob') {
        const filePath = item.path;
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${defaultBranch}/${filePath}`;
        try {
          const fileResponse = await fetch(rawUrl);
          if (!fileResponse.ok) {
            console.warn(`Could not fetch ${filePath}: ${fileResponse.status} ${fileResponse.statusText}`);
            showStatus(`Warning: Could not fetch ${filePath}`, 'info');
            continue;
          }

          let content;
          const contentType = fileResponse.headers.get('Content-Type');
          if (contentType && (contentType.startsWith('text/') || contentType.includes('json') || contentType.includes('javascript') || contentType.includes('xml') || contentType.includes('svg'))) {
            content = await fileResponse.text();
          } else if (isTextFileByExtension(filePath)) {
            content = await fileResponse.text();
          } else {
            const blob = await fileResponse.blob();
            content = await blobToBase64(blob);
          }
          uploadedFilesMap.set(filePath, content);
          filesImportedCount++;
        } catch (fileFetchError) {
          console.error(`Error fetching raw file ${filePath}:`, fileFetchError);
          showStatus(`Error fetching: ${filePath}. ${fileFetchError.message}`, 'error');
        }
      }
    }

    if (filesImportedCount === 0) {
      showStatus('No readable files found in the GitHub repository after processing.', 'error');
      fileList.classList.add('hidden');
      return;
    }
    showStatus(`Successfully imported ${filesImportedCount} files from GitHub repository.`, 'success');
    renderFileList();
  } catch (error) {
    console.error('GitHub import error:', error);
    showStatus(`Error importing GitHub repository: ${error.message}. Please try again.`, 'error');
    uploadedFilesMap.clear();
    fileList.classList.add('hidden');
  } finally {
    createProjectBtn.disabled = false;
    importGithubBtn.disabled = false;
  }
});

createProjectBtn.addEventListener('click', async () => {
  hideStatus();
  const projectName = projectNameInput.value.trim();
  if (!projectName) {
    showStatus('Project name cannot be empty.', 'error');
    return;
  }

  if (!db) {
    await openGen1DB();
  }

  try {
    const allProjects = await getAllItemsFromStore(PROJECTS_STORE_NAME);
    if (allProjects.some(p => p.name.toLowerCase() === projectName.toLowerCase())) {
      showStatus('A project with this name already exists. Please choose a different name.', 'error');
      return;
    }

    showStatus('Creating project in database...', 'info');
    const newProjectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newProjectMetadata = {
      id: newProjectId,
      name: projectName,
      createdAt: new Date().toISOString()
    };

    const projectFilesContent = {};
    uploadedFilesMap.forEach((content, filename) => {
      projectFilesContent[filename] = content;
    });

    const newProjectFiles = {
      projectId: newProjectId,
      files: projectFilesContent
    };

    const transaction = db.transaction([PROJECTS_STORE_NAME, FILES_STORE_NAME], 'readwrite');
    const projectsStore = transaction.objectStore(PROJECTS_STORE_NAME);
    const filesStore = transaction.objectStore(FILES_STORE_NAME);

    await Promise.all([
      new Promise((resolve, reject) => {
        const req1 = projectsStore.add(newProjectMetadata);
        req1.onsuccess = () => resolve();
        req1.onerror = (e) => reject(e.target.error);
      }),
      new Promise((resolve, reject) => {
        const req2 = filesStore.add(newProjectFiles);
        req2.onsuccess = () => resolve();
        req2.onerror = (e) => reject(e.target.error);
      })
    ]);

    await new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = (e) => reject(e.target.error);
    });

    localStorage.setItem(CURRENT_PROJECT_ID_LS_KEY, newProjectId);
    const successMessage = uploadedFilesMap.size > 0 ? 'Project created successfully! Redirecting...' : 'Blank project created successfully! Redirecting...';
    showStatus(successMessage, 'success');
    setTimeout(() => { window.location.href = 'Pe.html'; }, 1500);

  } catch (error) {
    console.error('Error creating project:', error);
    showStatus(`Failed to create project: ${error.message}. Please try again.`, 'error');
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  loadTheme();
  await openGen1DB();
});

document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());
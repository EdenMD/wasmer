// To enable GitHub secret encryption, you MUST include the libsodium-wrappers library in your HTML <head> or before this JS file:
// <script src="https://cdn.jsdelivr.net/npm/libsodium-wrappers@0.7.11/dist/libsodium-wrappers.min.js"></script>
// Without this script, the 'github_set_secret' action will fail.

let libsodium_ready_promise = null;

// Ensure libsodium is globally available (e.g., via a script tag or import)
// For example:
// import libsodium from 'libsodium-wrappers'; // If using modules
// or if loaded via script tag, it might be window.libsodium

// encryption.js (or whatever file holds this function)

// IMPORTANT: This file (or the file that imports it) MUST ensure libsodium-wrappers
// is imported or loaded. For example:
// import libsodium from 'libsodium-wrappers'; // If using ES Modules
// // or if loaded via script tag, 'libsodium' should be a global (window.libsodium)

async function encryptSecretWithPublicKey(secretValue, publicKeyBase64) {
    // --- THIS IS THE CRITICAL LINE ---
    // Ensure libsodium is fully loaded and initialized.
    // This replaces any external 'ensureLibsodiumReady()' call for this function.
    if (typeof libsodium === 'undefined' || !libsodium.ready) {
        console.error("Cryptography library (libsodium-wrappers) is not loaded or not ready.");
        throw new Error("Cryptography library (libsodium-wrappers) is not loaded or ready. Please ensure 'libsodium-wrappers' is correctly included and initialized.");
    }
    await libsodium.ready; // Wait for the library to be fully ready
    // --- END CRITICAL LINE ---

    // Additional check for base64_variants.ORIGINAL just in case of unusual libsodium states
    if (!libsodium.base64_variants || !libsodium.base64_variants.ORIGINAL) {
        console.error("libsodium.base64_variants.ORIGINAL is not available. Check libsodium-wrappers version/initialization.");
        throw new Error("libsodium base64 variant 'ORIGINAL' not found. Ensure correct libsodium-wrappers setup.");
    }

    // Decode GitHub's base64 public key to a Uint8Array
    const publicKeyBytes = libsodium.base64_variants.ORIGINAL.decode(publicKeyBase64, libsodium.OUTPUT_FORMAT.UINT8ARRAY);

    // Encode the secret_value to a Uint8Array
    const messageBytes = libsodium.from_string(secretValue);

    // Encrypt the message using crypto_box_seal
    const encryptedBytes = libsodium.crypto_box_seal(messageBytes, publicKeyBytes);

    // Base64 encode the result for transmission
    return libsodium.base64_variants.ORIGINAL.encode(encryptedBytes, libsodium.OUTPUT_FORMAT.STRING);
}


// Remove this line if you had it in your HTML:
// <script src="https://cdn.jsdelivr.net/npm/@octokit/rest@18.12.0/dist/octokit-rest.min.js"></script>
// This file no longer uses the Octokit.js library.

const DB_NAME = 'Gen1DB';
const DB_VERSION = 1;
const PROJECTS_STORE_NAME = 'projects';
const FILES_STORE_NAME = 'projectFiles';

const CURRENT_PROJECT_ID_LS_KEY = 'gen1_current_project_id';
const THEME_STORAGE_KEY = 'gen1_theme';
const CONVERSATION_FILENAME = 'conversations.json';
const FILE_OPS_ENABLED_KEY = 'gen1_file_ops_enabled';
const CUSTOM_MARKDOWN_INSTRUCTION_KEY = 'gen1_custom_markdown_instruction';
const DIRECTORY_MARKER = '__GEN1_DIRECTORY__'; // New: Marker for explicit empty directories

// AI Model Keys
const AI_MODEL_STORAGE_KEY = 'gen1_ai_model';
const GEMINI_API_KEY_STORAGE = 'gen1_gemini_api_key';
const GEMINI_API_ENDPOINT_KEY = 'gen1_gemini_api_endpoint';
const GROK_API_KEY_STORAGE = 'gen1_grok_api_key';
const GROK_API_ENDPOINT_KEY = 'gen1_grok_api_endpoint';
const DEEPSEEK_API_KEY_STORAGE = 'gen1_deepseek_api_key';
const DEEPSEEK_API_ENDPOINT_KEY = 'gen1_deepseek_api_endpoint';
const CLAUDE_API_KEY_STORAGE = 'gen1_claude_api_key';
const CLAUDE_API_ENDPOINT_KEY = 'gen1_claude_api_endpoint';
const CLAUDE_MODEL_NAME_KEY = 'gen1_claude_model_name';
const LLAMA_API_KEY_STORAGE = 'gen1_llama_api_key';
const LLAMA_API_ENDPOINT_KEY = 'gen1_llama_api_endpoint';
const LLAMA_MODEL_NAME_KEY = 'gen1_llama_model_name';
const MISTRAL_API_KEY_STORAGE = 'gen1_mistral_api_key';
const MISTRAL_API_ENDPOINT_KEY = 'gen1_mistral_api_endpoint';
const MISTRAL_MODEL_NAME_KEY = 'gen1_mistral_model_name';

// GitHub Integration Keys
const GITHUB_REPO_URL_KEY = 'gen1_github_repo_url';
const GITHUB_BRANCH_KEY = 'gen1_github_branch';
const GITHUB_PAT_KEY = 'gen1_github_pat'; // Security Warning: Storing PATs client-side

let defaultGeminiApiKey = "AIzaSyA1OUlNY-9DX-FOtqfkGK3F_e2W10We_I4"; // User provided this hardcoded key
let defaultGeminiEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"; // User provided this hardcoded endpoint
let defaultGrokEndpoint = "https://api.grok.com/v1/chat/completions";
let defaultDeepseekEndpoint = "https://api.deepseek.com/chat/completions";
let defaultClaudeEndpoint = "https://api.anthropic.com/v1/messages";
let defaultClaudeModel = "claude-3-opus-20240229"; // Or claude-3-sonnet-20240229, claude-3-haiku-20240229
let defaultLlamaEndpoint = "https://api.perplexity.ai/chat/completions"; // Example: Perplexity AI's API for LLaMA
let defaultLlamaModel = "llama-3-8b-instruct"; // Example LLaMA model
let defaultMistralEndpoint = "https://api.mistral.ai/v1/chat/completions";
let defaultMistralModel = "mistral-large-latest"; // Or open-mixtral-8x7b-v0.1, mistral-small-latest, codestral-latest

let currentAIModel = 'gemini';
let currentApiKey = defaultGeminiApiKey;
let currentApiEndpoint = defaultGeminiEndpoint;
let currentApiModelName = ''; // For models that require explicit model name in API body

// Updated AI Markdown Instruction for new file operations AND GitHub operations
const body = document.body;
const backButton = document.getElementById('backButton');
const fileMenuButton = document.getElementById('fileMenuButton');
const newChatButton = document.getElementById('newChatButton');
const toggleFileOpsButton = document.getElementById('toggleFileOpsButton');
const settingsButton = document.getElementById('settingsButton');
const messageDisplayArea = document.getElementById('messageDisplayArea');
const messageInput = document.getElementById('messageInput');
const sendMessageButton = document.getElementById('sendMessageButton');
const fileReferenceDrawer = document.getElementById('fileReferenceDrawer');
const fileListReference = document.getElementById('fileListReference');
const settingsDrawer = document.getElementById('settingsDrawer');
const settingsOverlay = document.getElementById('drawerOverlay');

const aiModelSelect = document.getElementById('aiModelSelect');
const geminiSettings = document.getElementById('geminiSettings');
const geminiApiKeyInput = document.getElementById('geminiApiKeyInput');
const geminiEndpointInput = document = document.getElementById('geminiEndpointInput');
const grokSettings = document.getElementById('grokSettings');
const grokApiKeyInput = document.getElementById('grokApiKeyInput');
const grokEndpointInput = document.getElementById('grokEndpointInput');
const deepseekSettings = document.getElementById('deepseekSettings');
const deepseekApiKeyInput = document.getElementById('deepseekApiKeyInput');
const deepseekEndpointInput = document.getElementById('deepseekEndpointInput');
const claudeSettings = document.getElementById('claudeSettings');
const claudeApiKeyInput = document.getElementById('claudeApiKeyInput');
const claudeEndpointInput = document.getElementById('claudeEndpointInput');
const claudeModelNameInput = document.getElementById('claudeModelNameInput');
const llamaSettings = document.getElementById('llamaSettings');
const llamaApiKeyInput = document.getElementById('llamaApiKeyInput');
const llamaEndpointInput = document.getElementById('llamaEndpointInput');
const llamaModelNameInput = document.getElementById('llamaModelNameInput');
const mistralSettings = document.getElementById('mistralSettings');
const mistralApiKeyInput = document.getElementById('mistralApiKeyInput');
const mistralEndpointInput = document.getElementById('mistralEndpointInput');
const mistralModelNameInput = document.getElementById('mistralModelNameInput');

const githubRepoUrlInput = document.getElementById('githubRepoUrlInput');
const githubBranchInput = document.getElementById('githubBranchInput');
const githubPatInput = document.getElementById('githubPatInput');
const pushToGithubButton = document.getElementById('pushToGithubButton');
const pullFromGithubButton = document.getElementById('pullFromGithubButton');

const markdownInstructionInput = document.getElementById('markdownInstructionInput');
const saveSettingsButton = document.getElementById('saveSettingsButton');
const closeSettingsButton = document.getElementById('closeSettingsButton');
const statusMessageElement = document.getElementById('statusMessage');

// Elements for image attachment
const imageUploadInput = document.getElementById('imageUploadInput');
const attachImageButton = document.getElementById('attachImageButton');
const attachedImagePreview = document.getElementById('attachedImagePreview');
const imagePreview = document.getElementById('imagePreview');
const previewFileName = document.getElementById('previewFileName');
const previewFileSize = document.getElementById('previewFileSize');
const clearAttachedFileButton = document.getElementById('clearAttachedFile');

// Elements for Audio Chat Mode
const toggleSpeechButton = document.getElementById('toggleSpeechButton');
const audioModeOverlay = document.getElementById('audioModeOverlay');
const exitAudioModeButton = document.getElementById('exitAudioModeButton');
const audioStatusText = document.getElementById('audioStatusText');
const audioVisualizer = document.getElementById('audioVisualizer');


let db;
let currentProjectId = null;
let projectFilesData = {};
let expandedFolders = new Set();
let currentChatHistory = [];
let fileOperationsEnabled = true; // Default to ON as requested
let attachedImageData = null; // { base64: string, mimeType: string, filename: string, size: string }

// Speech Recognition and Synthesis instances
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;
let currentUtterance = null; // The current speechSynthesisUtterance being spoken
let audioChatModeActive = false;
let lastSpokenTranscript = ''; // Stores the full transcript from STT before sending

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

function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'dark') {
        body.classList.add('dark-theme');
    } else {
        body.classList.remove('dark-theme');
    }
}

let statusMessageTimeout;
function showStatus(message, type, duration = 3000) {
    clearTimeout(statusMessageTimeout);
    statusMessageElement.style.display = 'flex';
    statusMessageElement.className = 'status-message show';
    statusMessageElement.classList.add(type);

    let iconClass = 'fas fa-info-circle';
    if (type === 'error') {
        iconClass = 'fas fa-times-circle';
    }
    if (type === 'success') {
        iconClass = 'fas fa-check-circle';
    }
    if (type === 'warning') {
        iconClass = 'fas fa-exclamation-triangle';
    }


    statusMessageElement.innerHTML = `<i class="${iconClass}"></i> <p>${message}</p>`;
    if (duration > 0) {
        statusMessageTimeout = setTimeout(() => hideStatus(), duration);
    }
}

function hideStatus() {
    statusMessageElement.classList.remove('show');
}

const escapeHtml = (text) => {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": `&#39;`
    };
    return text.replace(/[&<>"']/g, function(m) {
        return map[m];
    });
};

const processInlineMarkdown = (rawText) => {
    let processedText = rawText;

    // Handle inline code: `code` -> <code>escaped_code</code>
    processedText = processedText.replace(/`([^`]+)`/g, (match, p1) => `<code>${escapeHtml(p1)}</code>`);

    // Handle bold (must not touch content within already generated `<code>` tags or other HTML)
    processedText = processedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    processedText = processedText.replace(/__(.*?)__/g, '<strong>$1</strong>');

    // Handle italic
    processedText = processedText.replace(/_([^_]+)_/g, '<em>$1</em>');
    processedText = processedText.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    return processedText;
};

function renderMarkdown(text) {
    let lines = text.split('\n');
    let html = [];
    let i = 0;

    while (i < lines.length) {
        let currentLine = lines[i].trim();

        // Fenced Code Blocks
        if (currentLine.startsWith('```')) {
            const startLine = i;
            const lang = currentLine.substring(3).trim();
            i++;
            let codeContent = [];
            while (i < lines.length && !lines[i].trim().startsWith('```')) {
                codeContent.push(lines[i]);
                i++;
            }
            if (i < lines.length && lines[i].trim().startsWith('```')) {
                html.push(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${escapeHtml(codeContent.join('\n'))}</code><div class="code-action-buttons"><button class="copy-button" onclick="copyCode(this)"><i class="fa fa-copy"></i></button><button class="create-file-button" onclick="createFileFromCode(this)"><i class="fa fa-file-code"></i></button></div></pre>`);
                i++;
                continue;
            } else {
                i = startLine;
            }
        }

        // Horizontal Rule
        if (currentLine.match(/^[ \t]*([*_-])\1{2,}[ \t]*$/)) {
            html.push('<hr>');
            i++;
            continue;
        }

        // Headings
        let headingMatch = currentLine.match(/^(#){1,6}\s+(.*)$/);
        if (headingMatch) {
            let level = headingMatch[1].length;
            let content = headingMatch[2].trim();
            html.push(`<h${level}>${processInlineMarkdown(content)}</h${level}>`);
            i++;
            continue;
        }

        // Blockquotes
        if (currentLine.startsWith('>')) {
            let blockquoteContent = [];
            while (i < lines.length && lines[i].trim().startsWith('>')) {
                blockquoteContent.push(lines[i].trim().substring(1).trim());
                i++;
            }
            html.push(`<blockquote><p>${processInlineMarkdown(blockquoteContent.join('\n'))}</p></blockquote>`);
            continue;
        }

        // Lists (Unordered and Ordered)
        let listItemMatch = currentLine.match(/^[ \t]*([-*+]|\d+\.)\s+(.*)$/);
        if (listItemMatch) {
            let listType = listItemMatch[1].match(/^\d+\./) ? 'ol' : 'ul';
            html.push(`<${listType}>`);
            while (i < lines.length) {
                let currentListItem = lines[i].trim();
                let itemMatch = currentListItem.match(/^[ \t]*([-*+]|\d+\.)\s+(.*)$/);
                if (itemMatch && (itemMatch[1].match(/^\d+\./) ? listType === 'ol' : listType === 'ul')) {
                    html.push(`<li>${processInlineMarkdown(itemMatch[2].trim())}</li>`);
                    i++;
                } else if (currentListItem === '' && i + 1 < lines.length && lines[i+1].trim().match(/^[ \t]*([-*+]|\d+\.)\s+(.*)$/)) {
                    i++;
                }
                else {
                    break;
                }
            }
            html.push(`</${listType}>`);
            continue;
        }

        // Tables
        let headerLine = lines[i];
        if (headerLine.trim().startsWith('|') && headerLine.trim().endsWith('|')) {
            let separatorLine = lines[i + 1];
            if (separatorLine && separatorLine.trim().match(/^\|[-: ]+\|[-: |]+$/)) {
                let headers = headerLine.split('|').map(s => s.trim()).filter(s => s !== '');
                html.push('<table><thead><tr>');
                headers.forEach(header => html.push(`<th>${processInlineMarkdown(header)}</th>`));
                html.push('</tr></thead><tbody>');
                i += 2;
                while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
                    let dataCells = lines[i].split('|').map(s => s.trim()).filter(s => s !== '');
                    html.push('<tr>');
                    dataCells.forEach(cell => html.push(`<td>${processInlineMarkdown(cell)}</td>`));
                    html.push('</tr>');
                    i++;
                }
                html.push('</tbody></table>');
                continue;
            }
        }

        // Default: Paragraph
        let paragraphContent = [];
        while (i < lines.length && !lines[i].trim().startsWith('```') && !lines[i].trim().startsWith('#') && !lines[i].trim().startsWith('>') && !lines[i].trim().match(/^[-*+]\s+/) && !lines[i].trim().match(/^\d+\.\s+/) && !lines[i].trim().match(/^[*-]{3,}$/) && !lines[i].trim().startsWith('|')) {
            paragraphContent.push(lines[i]);
            i++;
        }
        if (paragraphContent.length > 0) {
            html.push(`<p>${processInlineMarkdown(paragraphContent.join(' '))}</p>`);
        } else {
            i++;
        }
    }
    return html.join('');
}

function copyCode(button) {
    const code = button.closest('.code-action-buttons').previousElementSibling.textContent;
    navigator.clipboard.writeText(code).then(() => {
        button.innerHTML = '<i class="fa fa-check" style="color: var(--info-color);"></i>';
        setTimeout(() => {
            button.innerHTML = '<i class="fa fa-copy" style="color: #ADD8E6;"></i>';
        }, 2000);
    }, err => {
        console.error('Could not copy text: ', err);
        showStatus('Failed to copy code.', 'error');
    });
}

async function createFileFromCode(button) {
    const codeContent = button.closest('.code-action-buttons').previousElementSibling.textContent;

    const fullPath = prompt('Enter file name/path (e.g., index.html, src/components/MyComponent.js):');
    if (!fullPath) {
        showStatus('File creation cancelled.', 'info');
        return;
    }

    if (!fileOperationsEnabled) {
        showStatus('AI file operations are currently disabled. Enable them in settings.', 'error');
        return;
    }

    showStatus(`Creating file: ${fullPath}...`, 'info', 0);

    const op = {
        action: 'create',
        path: fullPath,
        content: codeContent
    };

    const success = await performFileOperation(op, true); // User initiated

    if (success) {
        const fileActionMsgObj = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            sender: 'user', // This is user-initiated action
            displayContent: '', // Display handled by extraData
            contentForAI: `User created file "${fullPath}".`,
            type: 'ai-file-op', // Re-use this type for display consistency
            extraData: {
                action: 'created', // For display text
                filename: fullPath,
                size: getSizeString(codeContent),
                success: true
            },
            isHtml: false,
            timestamp: new Date().toISOString(),
        };
        currentChatHistory.push(fileActionMsgObj);
        displayMessage(fileActionMsgObj);
        await saveChatHistory(); // Ensure this action is saved immediately
    }
}

function getFileIconClass(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    // Special handling for directory marker
    if (filename.endsWith('/') && filename.includes(DIRECTORY_MARKER)) return 'fas fa-folder';

    switch (ext) {
        case 'js':
        case 'jsx': return 'fab fa-js';
        case 'ts':
        case 'tsx': return 'fas fa-file-code';
        case 'html':
        case 'htm': return 'fab fa-html5';
        case 'css': return 'fab fa-css3-alt';
        case 'json': return 'fas fa-file-alt';
        case 'md':
        case 'markdown': return 'fab fa-markdown';
        case 'py': return 'fab fa-python';
        case 'java': return 'fab fa-java';
        case 'c':
        case 'cpp': return 'fas fa-file-code';
        case 'go': return 'fab fa-go';
        case 'xml': return 'fas fa-code';
        case 'yaml':
        case 'yml': return 'fas fa-file-alt';
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'svg':
        case 'ico': return 'fas fa-image';
        case 'txt': return 'fas fa-file-alt';
        case 'zip': return 'fas fa-file-archive';
        default: return 'fas fa-file';
    }
}

function getSizeString(content) {
    if (!content) return '0 B';
    if (content.startsWith('data:')) {
        const base64Part = content.split(',')[1];
        const bytes = Math.ceil(base64Part.length * 0.75);
        if (bytes < 1024) return bytes + ' B';
        const kbs = bytes / 1024;
        if (kbs < 1024) return kbs.toFixed(1) + ' KB';
        const mbs = kbs / 1024;
        return mbs.toFixed(1) + ' MB';
    }
    const bytes = new TextEncoder().encode(content).length;
    if (bytes < 1024) return bytes + ' B';
    const kbs = bytes / 1024;
    if (kbs < 1024) return kbs.toFixed(1) + ' KB';
    const mbs = kbs / 1024;
    return mbs.toFixed(1) + ' MB';
}

async function saveChatHistory() {
    if (currentProjectId) {
        try {
            projectFilesData[CONVERSATION_FILENAME] = JSON.stringify(currentChatHistory);
            await putItemInStore(FILES_STORE_NAME, {
                projectId: currentProjectId,
                files: projectFilesData
            });
        } catch (error) {
            console.error('Error saving chat history:', error);
            showStatus('Failed to save chat history.', 'error', 2000);
        }
    }
}

async function loadProjectFilesDataOnly() {
    try {
        if (!db) {
            await openGen1DB();
        }
        const projectFiles = await getItemFromStore(FILES_STORE_NAME, currentProjectId);
        if (projectFiles && projectFiles.files) {
            projectFilesData = projectFiles.files;
        } else {
            projectFilesData = {};
        }
    } catch (error) {
        console.error('Error loading project files data:', error);
        showStatus('Failed to load project files data.', 'error', 2000);
        projectFilesData = {};
    }
}

async function loadChatHistory() {
    if (currentProjectId && projectFilesData[CONVERSATION_FILENAME]) {
        try {
            const chatHistoryJson = projectFilesData[CONVERSATION_FILENAME];
            currentChatHistory = JSON.parse(chatHistoryJson);
            messageDisplayArea.innerHTML = '';
            currentChatHistory.forEach(msg => displayMessage(msg));
        } catch (error) {
            console.error('Error loading chat history from file:', error);
            showStatus('Failed to load chat history from conversations.json. Starting fresh.', 'error', 3000);
            currentChatHistory = [];
        }
    } else {
        currentChatHistory = [];
    }
}

async function startNewConversation() {
    if (confirm('Are you sure you want to start a new conversation? This will clear the current chat history.')) {
        messageDisplayArea.innerHTML = '';
        currentChatHistory = [];
        const initialMessage = {
            id: 'initial-ai-message',
            sender: 'ai',
            displayContent: renderMarkdown('Hello! How can I help you with your project today? You can ask me to generate code, refactor, or even create new files. I can respond using markdown (e.g., **bold**, *italic*, `inline code`), and I can perform file operations in your project using a special markdown format. Use `x@filename` in your input to reference a file\'s content. For a spoken response, I will include  in my message. For detailed instructions on available file operations and GitHub interactions, refer to the system prompt in your memory.'),
            contentForAI: 'Hello! How can I help you with your project today? You can ask me to generate code, refactor, or even create new files. I can respond using markdown (e.g., **bold**, *italic*, `inline code`), and I can perform file operations in your project using a special markdown format. Use `x@filename` in your input to reference a file\'s content. For a spoken response, I will include  in my message. For detailed instructions on available file operations and GitHub interactions, refer to the system prompt in your memory.',
            type: 'text',
            extraData: null,
            isHtml: true,
            timestamp: new Date().toISOString()
        };
        currentChatHistory.push(initialMessage);
        displayMessage(initialMessage);
        await saveChatHistory();
        showStatus('New conversation started.', 'info', 2000);
    }
}
async function deleteMessage(messageId) {
    if (messageId === 'initial-ai-message' && currentChatHistory.length > 1) {
        showStatus('Cannot delete initial AI message unless it is the only message.', 'error', 3000);
        return;
    }
    if (!confirm('Are you sure you want to delete this message?')) {
        return;
    }
    currentChatHistory = currentChatHistory.filter(msg => msg.id !== messageId);
    await saveChatHistory();

    messageDisplayArea.innerHTML = '';
    if (currentChatHistory.length === 0) {
        const initialMessage = {
            id: 'initial-ai-message',
            sender: 'ai',
            displayContent: renderMarkdown('Hello! How can I help you with your project today? You can ask me to generate code, refactor, or even create new files. I can respond using markdown (e.g., **bold**, *italic*, `inline code`), and I can perform file operations in your project using a special markdown format. Use `x@filename` in your input to reference a file\'s content. For a spoken response, I will include  in my message.'),
            contentForAI: 'Hello! How can I help you with your project today? You can ask me to generate code, refactor, or even create new files. I can respond using markdown (e.g., **bold**, *italic*, `inline code`), and I can perform file operations in your project using a special markdown format. Use `x@filename` in your input to reference a file\'s content. For a spoken response, I will include  in my message.',
            type: 'text',
            extraData: null,
            isHtml: true,
            timestamp: new Date().toISOString()
        };
        currentChatHistory.push(initialMessage);
        displayMessage(initialMessage);
    } else {
        currentChatHistory.forEach(msg => displayMessage(msg));
    }
    showStatus('Message deleted.', 'info', 1500);
}

async function sendMessage(fromAudioMode = false, audioTranscript = '') {
    let userMessageRaw = fromAudioMode ? audioTranscript : messageInput.value.trim();

    // If in audio mode and no transcript was captured, don't send message
    if (fromAudioMode && audioTranscript === '') {
        return;
    }

    messageInput.value = ''; // Clear input immediately
    sendMessageButton.disabled = true;
    if (toggleSpeechButton) toggleSpeechButton.disabled = true;

    let displayContentForUser = userMessageRaw;
    let messageType = 'text';
    let extraMessageData = null;
    let messagePartsForAI = [];
    let contentForAiPromptText = userMessageRaw; // Default to raw message

    // --- MULTIPLE FILE REFERENCE LOGIC ---
    const fileRefRegex = /x@([^\s]+)/g;
    const referencedFiles = []; // To store details for display
    let combinedFileContentForAI = []; // For AI prompt
    let originalUserMessageForDisplay = userMessageRaw; // Keep original for user's text part

    // Extract all file references and their content
    let match;
    let tempUserMessage = userMessageRaw; // Use a temporary variable to process and remove file refs for display
    while ((match = fileRefRegex.exec(userMessageRaw)) !== null) {
        const referencedFilename = match[1];
        const fileContent = projectFilesData[referencedFilename];

        if (fileContent !== undefined && fileContent !== DIRECTORY_MARKER) {
            referencedFiles.push({
                filename: referencedFilename,
                size: getSizeString(fileContent)
            });
            combinedFileContentForAI.push(
                `User's request referencing file: \`${referencedFilename}\`\nFile Content:\n\`\`\`\n${fileContent}\n\`\`\`\n`
            );
            // Remove the 'x@filename' part from the user's message that will be displayed
            tempUserMessage = tempUserMessage.replace(match[0], '').trim();
        } else {
            showStatus('File not found or is a directory: ' + referencedFilename + '. Skipping reference.', 'error');
            // If reference is invalid, don't remove it from the display content, let user see it was there.
        }
    }

    if (referencedFiles.length > 0) {
        // If any files were successfully referenced
        messageType = 'file-ref-display';
        extraMessageData = { referencedFiles: referencedFiles };
        displayContentForUser = tempUserMessage; // Display only the non-file-ref part (or original if no valid ones were found)

        // Prepend combined file content to the AI prompt text
        contentForAiPromptText = combinedFileContentForAI.join('\n\n') + `\n\nAdditional Message: ${tempUserMessage.trim() !== '' ? tempUserMessage : 'No additional text provided.'}`;
    } else {
        // No files referenced, or only invalid ones, so revert to original user message for display and AI
        displayContentForUser = userMessageRaw;
        contentForAiPromptText = userMessageRaw;
    }

    // Ensure displayContentForUser is never empty if it's not purely an image, and has a placeholder for pure file references
    if (displayContentForUser.trim() === '' && messageType === 'file-ref-display') {
        displayContentForUser = 'Referenced files.';
    } else if (displayContentForUser.trim() === '' && messageType === 'text-and-image') {
        displayContentForUser = 'Sent an image.';
    } else if (displayContentForUser.trim() === '' && messageType === 'file-ref-and-image-display') {
        displayContentForUser = 'Referenced files and sent an image.';
    }

    // --- END MULTIPLE FILE REFERENCE LOGIC ---


    // Construct message parts for AI (Gemini specific, or plain text for others)
    // This part is crucial for multimodal models (like Gemini with images)
    // And also for ensuring text is passed correctly.
    if (contentForAiPromptText) {
        messagePartsForAI.push({ text: contentForAiPromptText });
    }
    if (attachedImageData) {
        if (currentAIModel !== 'gemini') {
            showStatus('Image attachments are currently only supported for the Google Gemini model. Please switch AI Model in settings.', 'error', 5000);
            sendMessageButton.disabled = false;
            if (toggleSpeechButton) toggleSpeechButton.disabled = false;
            await saveChatHistory();
            clearAttachedImage();
            return;
        }
        messagePartsForAI.push({
            inlineData: {
                mimeType: attachedImageData.mimeType,
                data: attachedImageData.base64
            }
        });
        // Ensure messageType reflects image if it wasn't already file-ref-display with content
        if (messageType === 'text') { // Only change to text-and-image if it's purely text so far
            messageType = 'text-and-image';
        } else if (messageType === 'file-ref-display') {
            messageType = 'file-ref-and-image-display'; // New type to indicate both
        }
        // Add image data to extraMessageData for display purposes
        extraMessageData = {
            ...extraMessageData,
            image: {
                src: imagePreview.src,
                filename: attachedImageData.filename,
                size: attachedImageData.size
            }
        };
    }

    // CRITICAL FIX: Add instruction for AI audio response when in audio mode
    if (fromAudioMode) {
        const audioRequestInstruction = "\n\n(User sent this via voice. Please ensure your response includes a short spoken summary of your main point using the __{audio: \"SUMMARY TEXT\"}__ markdown tag. Example: `__{audio: \"Your summary here.\"}`)";

        // If the last part is text, append to it. Otherwise, add a new text part.
        if (messagePartsForAI.length > 0 && typeof messagePartsForAI[messagePartsForAI.length - 1].text === 'string') {
            messagePartsForAI[messagePartsForAI.length - 1].text += audioRequestInstruction;
        } else {
            messagePartsForAI.push({ text: audioRequestInstruction });
        }
    }


    // Create the user message object for chat history
    const userMessageObj = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
        sender: 'user',
        displayContent: displayContentForUser,
        // For Gemini, contentForAI will be an array of parts (text + image).
        // For other models (non-multimodal), it's just plain text.
        contentForAI: (currentAIModel === 'gemini' && messagePartsForAI.length > 0) ? messagePartsForAI : contentForAiPromptText,
        type: messageType, // Can now be 'text', 'file-ref-display', 'text-and-image', 'file-ref-and-image-display'
        extraData: extraMessageData,
        isHtml: true,
        timestamp: new Date().toISOString()
    };
    currentChatHistory.push(userMessageObj);
    displayMessage(userMessageObj);

    clearAttachedImage();

    // --- Audio Mode Logic: After user message is displayed and before AI call ---
    if (audioChatModeActive) {
        stopSpeech();
        stopListening();

        audioStatusText.textContent = "Anesha is thinking...";
        audioVisualizer.classList.add('processing');
        audioVisualizer.classList.remove('listening', 'speaking');
        audioVisualizer.style.display = 'flex';

        speakText("Please wait. I am processing.", 'internal');
    } else {
        showStatus('Anesha is typing...', 'info', 0);
    }
    // --- End Audio Mode Logic ---

    try {
        let api_url = currentApiEndpoint;
        let api_key = currentApiKey;
        let model_name = currentApiModelName;
        let requestBody = {};
        let headers = { 'Content-Type': 'application/json' };

        const customInstruction = localStorage.getItem(CUSTOM_MARKDOWN_INSTRUCTION_KEY);
        const systemInstruction = customInstruction || defaultAIMarkdownInstruction;

        const messagesForApi = [];

        // Initialize system/assistant context based on model type
        if (currentAIModel === 'gemini') {
            messagesForApi.push({
                role: "user",
                parts: [{ text: systemInstruction }]
            });
            messagesForApi.push({
                role: "model",
                parts: [{ text: "Understood. I am ready to assist you. What can I do for you?" }]
            });
        } else if (currentAIModel === 'claude') {
            messagesForApi.push({
                role: "user",
                content: "Hello! How can I help you with your project today?"
            });
            messagesForApi.push({
                role: "assistant",
                content: "Understood. I am ready to assist you. What can I help you with?"
            });
            headers['x-api-key'] = api_key;
            headers['anthropic-version'] = '2023-06-01';
        }
         else { // Grok, DeepSeek, LLaMA, Mistral (OpenAI compatible)
            messagesForApi.push({
                role: "system",
                content: systemInstruction
            });
            messagesForApi.push({
                role: "assistant",
                content: "Understood. I am ready to assist you. What can I help you with?"
            });
            headers['Authorization'] = `Bearer ${api_key}`;
        }

        // Append past chat history messages to messagesForApi
                // Append past chat history messages to messagesForApi
        const startHistoryIndex = (currentChatHistory.length > 0 && currentChatHistory[0].id === 'initial-ai-message') ? 1 : 0;
        for (let i = startHistoryIndex; i < currentChatHistory.length; i++) {
            const msg = currentChatHistory[i];
            let contentForHistory;

            if (msg.sender === 'user') {
                if (currentAIModel === 'gemini' && Array.isArray(msg.contentForAI)) {
                    // If it's a Gemini multimodal message (text + image), send parts
                    // Ensure each part is properly formatted { text: "...", inlineData: {...} }
                    const geminiParts = msg.contentForAI.map(part => {
                        if (part.text) {
                            return { text: typeof part.text === 'string' ? part.text : String(part.text) };
                        } else if (part.inlineData) {
                            return { inlineData: part.inlineData };
                        }
                        return null;
                    }).filter(Boolean); // Remove nulls if any
                    messagesForApi.push({ role: 'user', parts: geminiParts });
                    continue; // Skip the rest of this loop iteration for Gemini parts
                } else {
                    // For other models or simple text for Gemini, use the text content
                    // Ensure contentForAI is a string or fallback to displayContent
                    // The contentForAI for file-ref types already includes the file content and original message
                    contentForHistory = typeof msg.contentForAI === 'string' ? msg.contentForAI : msg.displayContent;
                }
            } else { // AI message or System Feedback
                if (msg.type === 'ai-file-op' && msg.extraData) {
                    // Reconstruct the AI's file operation for its own memory
                    let opDetails = `AI previously performed action "${msg.extraData.action}" on file "${msg.extraData.filename}".`;
                    if (msg.extraData.old_path && msg.extraData.new_path) {
                        opDetails = `AI previously performed action "${msg.extraData.action}" from "${msg.extraData.old_path}" to "${msg.extraData.new_path}".`;
                    }
                    if (msg.extraData.action === 'updated block' && msg.extraData.logicName) {
                        opDetails = `AI previously updated code block "${msg.extraData.logicName}" in file "${msg.extraData.filename}".`;
                    } else if (msg.extraData.action === 'inserted markers' && msg.extraData.logicName) {
                        opDetails = `AI previously inserted code block markers for "${msg.extraData.logicName}" in file "${msg.extraData.filename}".`;
                    }
                    contentForHistory = opDetails;
                } else if (msg.type === 'ai-file-op-error') {
                    contentForHistory = `AI previously encountered an error with file operation: ${msg.displayContent}.`;
                }
                // NEW: Reconstruct GitHub operation for AI's memory
                else if (msg.type === 'github-op-display' && msg.extraData) {
                     let ghOpDetails = `AI previously performed GitHub action "${msg.extraData.action}" on repo "${msg.extraData.repo}" branch "${msg.extraData.branch}".`;
                     if (msg.extraData.message) {
                         ghOpDetails += ` with commit message "${msg.extraData.message}".`;
                     } else if (msg.extraData.title) { // For PRs
                         ghOpDetails += ` for PR titled "${msg.extraData.title}" from "${msg.extraData.head}" to "${msg.extraData.base}".`;
                     } else if (msg.extraData.new_branch_name) { // For branch creation
                         ghOpDetails += ` creating branch "${msg.extraData.new_branch_name}" from "${msg.extraData.base_branch}".`;
                     } else if (msg.extraData.branch_name) { // For branch deletion
                         ghOpDetails += ` deleting branch "${msg.extraData.branch_name}".`;
                     } else if (msg.extraData.path) { // For file ops
                          ghOpDetails += ` targeting file "${msg.extraData.path}".`;
                     } else if (msg.extraData.workflow_id) { // For workflow ops
                         ghOpDetails += ` targeting workflow "${msg.extraData.workflow_id}".`;
                         if (msg.extraData.run_id) ghOpDetails += ` run ID ${msg.extraData.run_id}.`;
                     } else if (msg.extraData.repo_name) { // For repo ops
                          ghOpDetails += ` targeting repository "${msg.extraData.repo_name}".`;
                     } else if (msg.extraData.secret_name) { // For secret ops
                          ghOpDetails += ` targeting secret "${msg.extraData.secret_name}".`;
                     }
                     contentForHistory = ghOpDetails;
                } else if (msg.type === 'github-op-error') {
                    contentForHistory = `AI previously encountered an error with GitHub operation: ${msg.displayContent}.`;
                } else if (msg.type === 'github-workflow-log' || msg.type === 'github-repos-list' || msg.type === 'github-artifact-links' || msg.type === 'github-workflow-runs-list') {
                    contentForHistory = msg.contentForAI; // These types store structured contentForAI
                } else if (msg.type === 'ide-jmil-feedback') { // NEW: Handle JMIL feedback
                    contentForHistory = msg.contentForAI;
                }
                else {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = msg.displayContent;
                    contentForHistory = tempDiv.textContent || tempDiv.innerText || '';
                }
            }

            if (currentAIModel === 'gemini') {
                messagesForApi.push({
                    role: msg.sender === 'user' ? 'user' : 'model',
                    parts: [{ text: contentForHistory }]
                });
            } else if (currentAIModel === 'claude') {
                 messagesForApi.push({
                    role: msg.sender === 'user' ? 'user' : 'assistant',
                    content: contentForHistory
                });
            }
            else { // Grok, DeepSeek, LLaMA, Mistral
                messagesForApi.push({
                    role: msg.sender === 'user' ? 'user' : 'assistant',
                    content: contentForHistory
                });
            }
        }
// ... (rest of sendMessage function)

        if (currentAIModel === 'gemini') {
            headers['x-goog-api-key'] = api_key;
            requestBody = { contents: messagesForApi };
        } else if (currentAIModel === 'claude') {
            requestBody = {
                model: model_name,
                messages: messagesForApi,
                system: systemInstruction, // Claude specific system prompt location
                max_tokens: 2048
            };
        }
        else { // Grok, DeepSeek, LLaMA, Mistral (OpenAI compatible)
            requestBody = {
                messages: messagesForApi,
                model: model_name || "default",
                temperature: 0.7,
                max_tokens: 2048
            };
        }

        const response = await fetch(api_url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        const responseData = await response.json();

        let aiResponseText = '';
        if (response.ok) {
            if (currentAIModel === 'gemini') {
                aiResponseText = responseData.candidates?.[0]?.content?.parts?.[0]?.text || '';
            } else if (currentAIModel === 'claude') {
                aiResponseText = responseData.content?.[0]?.text || '';
            } else { // Grok, DeepSeek, LLaMA, Mistral
                aiResponseText = responseData.choices?.[0]?.message?.content || '';
            }
        }
 // --- Audio Mode Logic: After AI response is received, stop "Please wait" ---
        if (audioChatModeActive) {
            stopSpeech(); // Stop the "Please wait" utterance if it's still playing
            audioVisualizer.classList.remove('processing'); // Stop processing animation
            audioStatusText.textContent = "Generating response..."; // Intermediate status before speaking
        } else {
            hideStatus(); // Hide general status message if not in audio mode
        }
        // --- End Audio Mode Logic ---

        if (aiResponseText) {
            // parseAndDisplayAiResponse will handle displaying messages and triggering speech if __{audio: }__ is found
            await parseAndDisplayAiResponse(aiResponseText);

            // --- Audio Mode Logic: Fallback for starting listening if no AI speech ---
            // Check if the AI's response explicitly contained an audio tag.
            // If not, and we are in audio chat mode, immediately re-enable listening for user.
            // If an audio tag was found, startListening() will be triggered by speakText's onend for 'user_response' type.
            const audioTagFound = aiResponseText.includes('__{audio:');
            if (audioChatModeActive && !audioTagFound) {
                audioStatusText.textContent = "Ready to speak...";
                startListening(); // Re-enable microphone for user's turn
            }
            // --- End Audio Mode Logic ---

        } else {
            console.error('AI response error:', responseData);
            const errorMessage = 'Error: Could not get a response from AI. ' + (responseData.error ? responseData.error.message : JSON.stringify(responseData));
            const aiErrorMsgObj = {
                id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
                sender: 'ai',
                displayContent: errorMessage,
                contentForAI: errorMessage,
                type: 'error',
                extraData: null,
                isHtml: false,
                timestamp: new Date().toISOString()
            };
            currentChatHistory.push(aiErrorMsgObj);
            displayMessage(aiErrorMsgObj);

            // --- Audio Mode Logic: Handle error during AI response ---
            if (audioChatModeActive) {
                stopSpeech(); // Ensure any internal speech is stopped
                audioStatusText.textContent = "Error. Please try again.";
                audioVisualizer.classList.remove('speaking', 'listening', 'processing'); // Clear visualizer
                startListening(); // Allow user to try again
            }
            // --- End Audio Mode Logic ---
        }
    } catch (error) {
        console.error('Fetch error:', error);
        const networkErrorMsg = 'Network error or problem connecting to AI: ' + error.message;
        const aiNetworkErrorObj = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
            sender: 'ai',
            displayContent: networkErrorMsg,
            contentForAI: networkErrorMsg,
            type: 'error',
            extraData: null,
            isHtml: false,
            timestamp: new Date().toISOString()
        };
        currentChatHistory.push(aiNetworkErrorObj);
        displayMessage(aiNetworkErrorObj);

        // --- Audio Mode Logic: Handle network error ---
        if (audioChatModeActive) {
            stopSpeech();
            audioStatusText.textContent = "Network error. Try again.";
            audioVisualizer.classList.remove('speaking', 'listening', 'processing');
            startListening();
        } else {
            hideStatus();
        }
        // --- End Audio Mode Logic ---
    } finally {
        sendMessageButton.disabled = false;
        if (toggleSpeechButton) toggleSpeechButton.disabled = false;
        await saveChatHistory(); // Ensure user message and any immediate AI responses are saved.
    }
}

function displayMessage(messageObj) {
if (messageObj.type === 'ide-jmil-feedback') {
        return;
    }
    
    const messageBubble = document.createElement('div');
    messageBubble.classList.add('message-bubble', messageObj.sender);
    if (messageObj.type === 'error' || (messageObj.type === 'ai-file-op' && messageObj.extraData && messageObj.extraData.success === false) || messageObj.type === 'github-op-error') {
        messageBubble.classList.add('error');
    }
    messageBubble.dataset.messageId = messageObj.id;
    messageBubble.dataset.timestamp = messageObj.timestamp;

    const deleteBtn = document.createElement('button');
    deleteBtn.classList.add('delete-message-btn');
    deleteBtn.innerHTML = '<i class="fas fa-times-circle"></i>';
    deleteBtn.title = 'Delete message';
    deleteBtn.addEventListener('click', () => deleteMessage(messageObj.id));
    messageBubble.appendChild(deleteBtn);

    // Handle file reference/operation header
    if (['file-ref-display', 'ai-file-op', 'ai-file-op-error', 'github-op-display', 'github-op-error', 'github-workflow-log', 'github-repos-list', 'github-artifact-links', 'github-workflow-runs-list'].includes(messageObj.type)) {
        const fileHeader = document.createElement('div');
        fileHeader.classList.add('file-attachment-header');
        if (messageObj.type === 'ai-file-op-error' || (messageObj.type === 'ai-file-op' && messageObj.extraData && messageObj.extraData.success === false) || messageObj.type === 'github-op-error') {
            fileHeader.classList.add('error');
        }

        const icon = document.createElement('i');
        const actionTextSpan = document.createElement('span');
        actionTextSpan.classList.add('file-action-text');

        // Specific logic for file-ref-display (user message)
        if (messageObj.type === 'file-ref-display' || messageObj.type === 'file-ref-and-image-display') {
            if (messageObj.extraData && messageObj.extraData.referencedFiles && messageObj.extraData.referencedFiles.length > 0) {
                // Multiple files referenced
                icon.className = 'fas fa-file-invoice'; // Generic multiple files icon
                actionTextSpan.textContent = 'Referenced Multiple Files:';
                fileHeader.appendChild(icon);
                fileHeader.appendChild(actionTextSpan);

                const fileListUl = document.createElement('ul');
                fileListUl.classList.add('referenced-file-list');
                messageObj.extraData.referencedFiles.forEach(file => {
                    const li = document.createElement('li');
                    li.innerHTML = `<i class="${getFileIconClass(file.filename)}"></i> ${file.filename} (${file.size})`;
                    fileListUl.appendChild(li);
                });
                fileHeader.appendChild(fileListUl);
            }
        }
        // Specific logic for AI file operation messages
        else if (messageObj.type === 'ai-file-op') {
            const action = messageObj.extraData.action;
            let iconClass;
            // Determine icon based on action
            if (action.includes('created directory')) iconClass = 'fas fa-folder-plus';
            else if (action.includes('deleted directory')) iconClass = 'fas fa-folder-minus';
            else if (action.includes('renamed/moved')) iconClass = 'fas fa-exchange-alt';
            else if (action === 'created' || action === 'updated') iconClass = getFileIconClass(messageObj.extraData.filename);
            else if (action === 'deleted') iconClass = 'fas fa-trash-alt';
            else if (action === 'updated block') iconClass = 'fas fa-code-branch'; // Icon for code block update
            else if (action === 'inserted markers') iconClass = 'fas fa-map-pin'; // Icon for marker insertion
            else iconClass = 'fas fa-file-code'; // Default for other ops

            icon.className = iconClass;
            actionTextSpan.textContent = action.charAt(0).toUpperCase() + action.slice(1);

            const fileNameSpan = document.createElement('span');
            fileNameSpan.classList.add('file-name-text');
            fileNameSpan.textContent = messageObj.extraData.filename || 'Unknown';
            const fileSizeSpan = document.createElement('span');
            fileSizeSpan.classList.add('file-size-text');
            if (messageObj.extraData && messageObj.extraData.size) {
                fileSizeSpan.textContent = '(' + messageObj.extraData.size + ')';
            }
            
            // Add logic_name for block ops
            if (messageObj.extraData.logicName) {
                const logicNameSpan = document.createElement('span');
                logicNameSpan.classList.add('logic-name-text');
                logicNameSpan.textContent = ` (Block: ${messageObj.extraData.logicName})`;
                fileNameSpan.appendChild(logicNameSpan); // Append to filename for compact display
            }

            fileHeader.appendChild(icon);
            fileHeader.appendChild(actionTextSpan);
            fileHeader.appendChild(fileNameSpan);
            if (messageObj.extraData && messageObj.extraData.size) {
                fileHeader.appendChild(fileSizeSpan);
            }

        } else if (messageObj.type === 'ai-file-op-error') {
            icon.className = 'fas fa-exclamation-triangle';
            actionTextSpan.textContent = 'File Op Error';
            const fileNameSpan = document.createElement('span');
            fileNameSpan.classList.add('file-name-text');
            fileNameSpan.textContent = messageObj.extraData.filename || 'Unknown';
            fileHeader.appendChild(icon);
            fileHeader.appendChild(actionTextSpan);
            fileHeader.appendChild(fileNameSpan);
        } else if (messageObj.type === 'github-op-display') {
            icon.className = 'fab fa-github';
            actionTextSpan.textContent = messageObj.extraData.action;

            const targetDetailsSpan = document.createElement('span');
            targetDetailsSpan.classList.add('file-name-text');
            let detailsText = '';

            switch (messageObj.extraData.action) {
                case 'Pushed':
                case 'Pulled':
                    detailsText = ` ${messageObj.extraData.repo}/${messageObj.extraData.branch}`;
                    if (messageObj.extraData.message) detailsText += ` ("${messageObj.extraData.message}")`;
                    if (messageObj.extraData.changesCount !== undefined && messageObj.extraData.changesCount !== null) {
                         detailsText += ` (${messageObj.extraData.changesCount} change(s))`;
                    }
                    break;
                case 'Created File':
                case 'Updated File':
                case 'Deleted File':
                    detailsText = ` ${messageObj.extraData.repo}/${messageObj.extraData.branch}/${messageObj.extraData.path}`;
                    if (messageObj.extraData.message) detailsText += ` ("${messageObj.extraData.message}")`;
                    break;
                case 'Created Branch':
                    detailsText = ` ${messageObj.extraData.repo}/${messageObj.extraData.new_branch_name} from ${messageObj.extraData.base_branch}`;
                    break;
                case 'Deleted Branch':
                    detailsText = ` ${messageObj.extraData.repo}/${messageObj.extraData.branch_name}`;
                    break;
                case 'Created Pull Request':
                    detailsText = ` PR in ${messageObj.extraData.repo}: ${messageObj.extraData.title} (${messageObj.extraData.head} -> ${messageObj.extraData.base})`;
                    break;
                case 'Triggered Workflow':
                    detailsText = ` Workflow ${messageObj.extraData.workflow_id} in ${messageObj.extraData.repo}/${messageObj.extraData.branch}`;
                    break;
                case 'Created Repository':
                    detailsText = ` ${messageObj.extraData.repo_name} (${messageObj.extraData.private ? 'private' : 'public'})`;
                    if (messageObj.extraData.org_name) detailsText += ` in ${messageObj.extraData.org_name}`;
                    break;
                case 'Deleted Repository':
                    detailsText = ` ${messageObj.extraData.repo_name}`;
                    break;
                case 'Set Secret':
                    detailsText = ` Secret '${messageObj.extraData.secret_name}' in ${messageObj.extraData.repo_owner}/${messageObj.extraData.repo_name}`;
                    break;
            }
            targetDetailsSpan.textContent = detailsText;

            fileHeader.appendChild(icon);
            fileHeader.appendChild(actionTextSpan);
            fileHeader.appendChild(targetDetailsSpan);
        } else if (messageObj.type === 'github-op-error') {
            icon.className = 'fas fa-exclamation-triangle';
            actionTextSpan.textContent = `GitHub Error (${messageObj.extraData.action})`;
            const repoBranchSpan = document.createElement('span');
            repoBranchSpan.classList.add('file-name-text');
            repoBranchSpan.textContent = ` ${messageObj.extraData.repo || messageObj.extraData.repo_name || 'Unknown'}/${messageObj.extraData.branch || ''}`; // repo_name for repo-level errors
            fileHeader.appendChild(icon);
            fileHeader.appendChild(actionTextSpan);
            fileHeader.appendChild(repoBranchSpan);
        } else if (messageObj.type === 'github-workflow-log') {
            icon.className = 'fas fa-file-code'; // Or a specific log icon
            actionTextSpan.textContent = `Workflow Log for ${messageObj.extraData.workflow_id}`;
            const detailsSpan = document.createElement('span');
            detailsSpan.classList.add('file-name-text');
            detailsSpan.textContent = ` Run ID: ${messageObj.extraData.run_id}`;
            if (messageObj.extraData.job_id) detailsSpan.textContent += `, Job ID: ${messageObj.extraData.job_id}`;
            fileHeader.appendChild(icon);
            fileHeader.appendChild(actionTextSpan);
            fileHeader.appendChild(detailsSpan);
        } else if (messageObj.type === 'github-repos-list') {
             icon.className = 'fab fa-github-square';
             actionTextSpan.textContent = messageObj.extraData.org_name ? `Repositories in ${messageObj.extraData.org_name}` : 'My Repositories';
             fileHeader.appendChild(icon);
             fileHeader.appendChild(actionTextSpan);
        } else if (messageObj.type === 'github-artifact-links') {
            icon.className = 'fas fa-download';
            actionTextSpan.textContent = `Artifacts for Workflow '${messageObj.extraData.workflow_id}' (Run ${messageObj.extraData.run_id})`;
            fileHeader.appendChild(icon);
            fileHeader.appendChild(actionTextSpan);
        } else if (messageObj.type === 'github-workflow-runs-list') { // NEW TYPE
            icon.className = 'fas fa-list-alt'; // Icon for a list of runs
            actionTextSpan.textContent = `Workflow Runs for '${messageObj.extraData.workflow_id}'`;
            const detailsSpan = document.createElement('span');
            detailsSpan.classList.add('file-name-text');
            detailsSpan.textContent = ` (Total: ${messageObj.extraData.total_count})`;
            fileHeader.appendChild(icon);
            fileHeader.appendChild(actionTextSpan);
            fileHeader.appendChild(detailsSpan);
        }


        messageBubble.appendChild(fileHeader);
        messageBubble.classList.add('has-file-header');
    }

    const messageContentDiv = document.createElement('div');
    messageContentDiv.classList.add('message-content');

    if (messageObj.sender === 'user' && messageObj.extraData && messageObj.extraData.image) {
        const imgContainer = document.createElement('div');
        imgContainer.style.marginBottom = '10px';
        imgContainer.style.maxWidth = '100%';
        imgContainer.style.textAlign = 'center';
        const imgElement = document.createElement('img');
        imgElement.src = messageObj.extraData.image.src;
        imgElement.alt = messageObj.extraData.image.filename;
        imgElement.style.maxWidth = '200px';
        imgElement.style.maxHeight = '200px';
        imgElement.style.borderRadius = '8px';
        imgElement.style.objectFit = 'contain';
        imgElement.style.display = 'block';
        imgElement.style.margin = '0 auto';

        imgContainer.appendChild(imgElement);

        const imgInfo = document.createElement('div');
        imgInfo.style.fontSize = '0.8em';
        imgInfo.style.color = 'var(--text-secondary)';
        imgInfo.style.marginTop = '5px';
        imgInfo.textContent = `${messageObj.extraData.image.filename} (${messageObj.extraData.image.size})`;
        imgContainer.appendChild(imgInfo);

        messageContentDiv.appendChild(imgContainer);
    }

    if (messageObj.isHtml) {
        // Ensure text content is always displayed for user messages, regardless of attachments
        if (messageObj.displayContent.trim() !== '' || !messageObj.extraData) { // Added !messageObj.extraData to ensure plain text user message without file ref is displayed
            const textP = document.createElement('p');
            textP.innerHTML = messageObj.displayContent; // This already has markdown processed
            messageContentDiv.appendChild(textP);
        }
    } else { // Fallback for non-HTML (e.g., error messages direct text)
        const p = document.createElement('p');
        p.textContent = messageObj.displayContent;
        messageContentDiv.appendChild(p);
    }

    messageBubble.appendChild(messageContentDiv);
    messageDisplayArea.appendChild(messageBubble);

    messageDisplayArea.scrollTop = messageDisplayArea.scrollHeight;
}

// Helper function to normalize paths
function normalizePath(path) {
    if (!path) return '';
    let normalized = path.trim().replace(/\/+/g, '/'); // Remove duplicate slashes
    if (normalized.startsWith('/')) normalized = normalized.substring(1); // Remove leading slash
    return normalized;
}


// --- NEW: Comment-Driven Modularization Utilities ---

// Helper function to escape a string for use in a regular expression
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the matched substring
}

/**
 * Returns the appropriate comment start and end markers for a given filename.
 * @param {string} filename The name of the file (e.g., 'index.js', 'style.css').
 * @returns {{start: string, end: string}} An object with 'start' and 'end' comment markers.
 */
function getCommentMarkers(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    switch (ext) {
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
        case 'go': // Go also uses //
        case 'c':
        case 'cpp': // C/C++ can use // for single line comments
        case 'java': // Java can use // for single line comments
            return { start: '//', end: '' };
        case 'html':
        case 'htm':
        case 'xml':
        case 'md': // HTML comments often used in Markdown for meta-info
            return { start: '<!--', end: '-->' };
        case 'css':
        case 'less':
        case 'scss': // CSS-style block comments
            return { start: '/*', end: '*/' };
        case 'py': // Python-style line comment
            return { start: '#', end: '' };
        case 'ruby':
        case 'rb': // Ruby-style line comment
            return { start: '#', end: '' };
        case 'php': // PHP-style line comment
            return { start: '//', end: '' }; // or # or /* */
        case 'json':
        case 'yaml':
        case 'yml': // These typically don't have comments, use JS-style as a fallback if absolutely necessary
            return { start: '//', end: '' };
        default:
            return { start: '//', end: '' }; // Default to JS-style for unknown types
    }
}

/**
 * Replaces the content within a specified code block in a file content string.
 * @param {string} fileContent The entire content of the file as a string.
 * @param {string} logicName The unique identifier for the code block (e.g., 'user_authentication').
 * @param {string} newBlockContent The new code to replace the existing content of the block.
 * @param {string} filename The name of the file to determine comment style.
 * @returns {string} The updated file content string.
 * @throws {Error} If the start or end markers for the logicName are not found.
 */
function _updateCodeBlockInContent(fileContent, logicName, newBlockContent, filename) {
    const { start, end } = getCommentMarkers(filename);
    const startMarkerContent = `----start of ${logicName}----`;
    const endMarkerContent = `----end of ${logicName}----`;

    const fullStartMarker = `${start}${startMarkerContent}${end && end !== '' ? end : ''}`;
    const fullEndMarker = `${start}${endMarkerContent}${end && end !== '' ? end : ''}`;

    // Use string searching for robust marker identification
    const startIndex = fileContent.indexOf(fullStartMarker);
    if (startIndex === -1) {
        throw new Error(`Start marker for code block '${logicName}' not found.`);
    }

    const endIndex = fileContent.indexOf(fullEndMarker, startIndex + fullStartMarker.length);
    if (endIndex === -1) {
        throw new Error(`End marker for code block '${logicName}' not found.`);
    }

    // Calculate the actual content start and end points
    const contentStart = startIndex + fullStartMarker.length;

    // Preserve leading/trailing newlines around the new content
    const updatedContent = [
        fileContent.substring(0, contentStart),
        `\n${newBlockContent.trim()}\n`, // Ensure content is wrapped in newlines
        fileContent.substring(endIndex)
    ].join('');

    return updatedContent;
}

/**
 * Inserts start and end comment markers around specified lines in a file content string.
 * @param {string} fileContent The entire content of the file as a string.
 * @param {string} logicName The unique identifier for the code block.
 * @param {number} startLineNumber The 0-indexed line number where the start marker should be inserted.
 * @param {number} endLineNumber The 0-indexed line number AFTER which the end marker should be inserted.
 * @param {string} filename The name of the file to determine comment style.
 * @returns {string} The updated file content string.
 * @throws {Error} If startLineNumber or endLineNumber are invalid.
 */
function _insertCodeBlockMarkersInContent(fileContent, logicName, startLineNumber, endLineNumber, filename) {
    if (startLineNumber < 0 || endLineNumber < 0) {
        throw new Error('Line numbers must be non-negative.');
    }
    if (startLineNumber > endLineNumber + 1) { // endLineNumber is AFTER the content, so start can be at most end+1 (empty block)
        throw new Error('Start line number cannot be greater than end line number + 1.');
    }

    const { start, end } = getCommentMarkers(filename);
    const startMarkerContent = `----start of ${logicName}----`;
    const endMarkerContent = `----end of ${logicName}----`;

    const fullStartMarker = `${start}${startMarkerContent}${end && end !== '' ? end : ''}`;
    const fullEndMarker = `${start}${endMarkerContent}${end && end !== '' ? end : ''}`;

    // Check if markers already exist for this logicName
    if (fileContent.includes(fullStartMarker) && fileContent.includes(fullEndMarker)) {
        throw new Error(`Code block markers for '${logicName}' already exist.`);
    }

    const lines = fileContent.split('\n');

    // Ensure line numbers are within bounds for insertion
    if (startLineNumber > lines.length || endLineNumber > lines.length) {
        throw new Error(`Line number out of bounds. File has ${lines.length} lines.`);
    }

    // Insert start marker
    lines.splice(startLineNumber, 0, fullStartMarker);

    // Insert end marker. Adjust its position for the already inserted start marker.
    // The end marker goes *after* the content that was originally at `endLineNumber`.
    // Since we added one line (start marker) at `startLineNumber`,
    // the `endLineNumber` now refers to one line further down.
    lines.splice(endLineNumber + 2, 0, fullEndMarker); // +1 for inserted start marker, +1 to go *after* the original end line

    return lines.join('\n');
}

// --- END NEW: Comment-Driven Modularization Utilities ---


// New Centralized File Operation Function
// New Centralized File Operation Function
async function performFileOperation(op, isUserInitiated = false) {
    // File operations toggle does not apply to GitHub operations
    if (!fileOperationsEnabled && !isUserInitiated && !op.action.startsWith('github_') && !op.action.startsWith('create_')) { // Updated: Allow document creation even if file ops are generally off
        showStatus('AI file operations are currently disabled. Enable them using the toggle button.', 'error');
        // NEW: JMIL Feedback on failure due to disabled ops
        if (!isUserInitiated) {
            await addJmilFeedbackToHistory(op, false, "AI file operations are currently disabled by the user.");
        }
        return false;
    }

    let success = false;
    let actionText = op.action.charAt(0).toUpperCase() + op.action.slice(1);
    let displayPath = op.path || op.new_path || op.old_path; // For local file operations
    let githubRepoDetails = null; // For GitHub operations

    // Extract GitHub specific details for status messages
    if (op.action.startsWith('github_')) {
        const repoUrl = localStorage.getItem(GITHUB_REPO_URL_KEY);
        const configuredBranch = localStorage.getItem(GITHUB_BRANCH_KEY);
        const { owner, repo } = parseGithubRepoUrl(repoUrl);

        // repo_name for create/delete repo, otherwise current repo from URL
        const targetRepoName = op.repo_name || repo;

        githubRepoDetails = {
            owner: owner,
            repo: targetRepoName,
            branch: op.branch || configuredBranch, // Use op.branch if provided, else configured
            repo_name: op.repo_name, // For create/delete repo ops
            org_name: op.org_name
        };

        if ((!owner || !repo) && !op.repo_name && op.action !== 'github_list_repos' && op.action !== 'github_create_repo' && op.action !== 'github_set_secret' && op.action !== 'github_create_repo_with_readme') { // If it's not a create_repo op and URL is bad, or list_repos/create_repo doesn't strictly need a configured repo URL, and set_secret can use org_name
             showStatus('Invalid GitHub Repository URL or missing for this operation. Please configure in settings.', 'error', 5000);
             // NEW: JMIL Feedback
             if (!isUserInitiated) {
                await addJmilFeedbackToHistory(op, false, "Invalid GitHub Repository URL or missing for this operation.");
             }
             return false;
        }
        if (!localStorage.getItem(GITHUB_PAT_KEY)) {
            showStatus('GitHub Personal Access Token is missing. Please configure it in settings.', 'error', 5000);
            // NEW: JMIL Feedback
            if (!isUserInitiated) {
                await addJmilFeedbackToHistory(op, false, "GitHub Personal Access Token is missing.");
            }
            return false;
        }

        // Specific status messages for GitHub operations
        if (op.action === 'github_create_repo') {
             showStatus(`Creating GitHub repository '${op.repo_name}'...`, 'info', 0);
        } else if (op.action === 'github_delete_repo') {
            showStatus(`Deleting GitHub repository '${op.repo_name}'... This is irreversible!`, 'warning', 0);
        } else {
             showStatus(`Processing GitHub ${actionText} for ${owner}/${repo}...`, 'info', 0);
        }
    } else if (op.action.startsWith('create_')) { // Status for new document creation
        showStatus(`Creating ${op.filename || 'document'}...`, 'info', 0);
    }
    else {
        // For local file operations, you might want a default status.
        showStatus(`${actionText} ${displayPath}...`, 'info', 0);
    }

    try {
        switch (op.action) {
            // Local File Operations
            case 'create':
            case 'update':
                success = await handleCreateUpdateFile(op.path, op.content, op.action);
                break;
            case 'delete':
                success = await handleDeleteFile(op.path);
                break;
            // NEW: Delete Multiple Files
            case 'delete_multiple_files':
                success = await handleDeleteMultipleFiles(op.paths);
                break;
            case 'mkdir':
                success = await handleCreateDirectory(op.path);
                break;
            case 'rmdir':
                success = await handleDeleteDirectory(op.path);
                break;
            // NEW: Create Multiple Directories
            case 'create_multiple_directories':
                success = await handleCreateMultipleDirectories(op.paths);
                break;
            case 'mvfile':
                success = await handleRenameFile(op.old_path, op.new_path);
                break;
            case 'mvdir':
                success = await handleRenameDirectory(op.old_path, op.new_path);
                break;

            // NEW: Comment-Driven Modularization Actions
            case 'update_code_block':
                if (!op.path || !op.logic_name || op.content === undefined) {
                    throw new Error("Missing 'path', 'logic_name', or 'content' for update_code_block action.");
                }
                const currentContentBlockUpdate = projectFilesData[op.path];
                if (currentContentBlockUpdate === undefined) {
                    throw new Error(`File '${op.path}' not found for updating code block.`);
                }
                const updatedContentBlock = _updateCodeBlockInContent(currentContentBlockUpdate, op.logic_name, op.content, op.path);
                projectFilesData[op.path] = updatedContentBlock;
                await putItemInStore(FILES_STORE_NAME, { projectId: currentProjectId, files: projectFilesData });
                success = true;
                break;
            case 'insert_code_markers':
                if (!op.path || !op.logic_name || op.start_line === undefined || op.end_line === undefined) {
                    throw new Error("Missing 'path', 'logic_name', 'start_line', or 'end_line' for insert_code_markers action.");
                }
                const currentContentInsertMarkers = projectFilesData[op.path];
                if (currentContentInsertMarkers === undefined) {
                    throw new Error(`File '${op.path}' not found for inserting code block markers.`);
                }
                const contentWithMarkers = _insertCodeBlockMarkersInContent(currentContentInsertMarkers, op.logic_name, op.start_line, op.end_line, op.path);
                projectFilesData[op.path] = contentWithMarkers;
                await putItemInStore(FILES_STORE_NAME, { projectId: currentProjectId, files: projectFilesData });
                success = true;
                break;

            // NEW DOCUMENT CREATION ACTIONS
            case 'create_pdf':
                success = await handleCreatePdf(op);
                break;
            case 'create_docx':
                success = await handleCreateDocx(op);
                break;
            case 'create_xlsx':
                success = await handleCreateXlsx(op);
                break;
            case 'create_pptx':
                success = await handleCreatePptx(op);
                break;


            // GitHub Operations
            case 'github_push':
                success = await pushChangesToGitHub(op.message || `Gen1 AI Assist: AI-initiated push on ${new Date().toLocaleString()}`);
                break;
            case 'github_pull':
                success = await pullChangesFromGitHub();
                break;
            case 'github_create_file':
            case 'github_update_file':
                success = await handleGitHubPutFile(op.path, op.content, op.message, op.branch);
                break;
            case 'github_delete_file':
                success = await handleGitHubDeleteFile(op.path, op.message, op.branch);
                break;
            case 'github_create_branch':
                success = await handleGitHubCreateBranch(op.new_branch_name, op.base_branch);
                break;
            case 'github_delete_branch':
                success = await handleGitHubDeleteBranch(op.branch_name);
                break;
            case 'github_create_pull_request':
                success = await handleGitHubCreatePullRequest(op.title, op.head, op.base, op.body);
                break;
            case 'github_get_workflow_logs':
                success = await handleGitHubGetWorkflowLogs(op.workflow_id, op.run_id, op.job_id, op.branch);
                break;
            case 'github_get_latest_workflow_logs':
                success = await handleGitHubGetLatestWorkflowLogs(op.workflow_id, op.branch);
                break;
            case 'github_get_workflow_runs': // NEW ACTION
                success = await handleGitHubGetWorkflowRuns(op.workflow_id, op.branch);
                break;
            case 'github_trigger_workflow':
                success = await handleGitHubTriggerWorkflow(op.workflow_id, op.inputs, op.branch);
                break;
            case 'github_create_repo':
                success = await handleGitHubCreateRepository(op.repo_name, op.body, op.private, op.org_name);
                break;
            case 'github_delete_repo':
                success = await handleGitHubDeleteRepository(op.repo_name);
                break;
            case 'github_set_secret':
                success = await handleGitHubSetSecret(op.secret_name, op.secret_value, op.repo_name, op.org_name);
                break;
            case 'github_get_artifact_download_links':
                success = await handleGitHubGetArtifactDownloadLinks(op.workflow_id, op.branch);
                break;
            case 'github_list_repos':
                success = await handleGitHubListRepositories(op.org_name);
                break;
            default:
                throw new Error(`Unknown operation action: ${op.action}`);
        }

        if (success) {
            if (['github_get_workflow_logs', 'github_get_latest_workflow_logs', 'github_get_workflow_runs', 'github_get_artifact_download_links', 'github_list_repos'].includes(op.action)) {
                // These operations handle their own specific display and saving within their functions
                // We return true here, and the messages were already added and saved.
                // NEW: JMIL Feedback for these, which return true but have complex output.
                if (!isUserInitiated) {
                    await addJmilFeedbackToHistory(op, true, "Successfully retrieved data.", op.action);
                }
            } else if (op.action.startsWith('create_')) {
                // Document creation handlers will have set op._downloadUrl
                showStatus(`${actionText.replace('create_', '').toUpperCase()} document '${op.filename}' created successfully.`, 'success');
                // JMIL feedback is handled within parseAndDisplayAiResponse for these document types
            }
            else {
                if (isUserInitiated) {
                    showStatus(`${actionText} ${displayPath} successful.`, 'success');
                    const userOpMsgObj = {
                        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                        sender: 'system',
                        displayContent: `User initiated: ${actionText} ${displayPath} successful.`,
                        contentForAI: `User initiated: ${actionText} ${displayPath} successful.`,
                        type: 'system-info',
                        extraData: null,
                        isHtml: false,
                        timestamp: new Date().toISOString(),
                    };
                    currentChatHistory.push(userOpMsgObj);
                    displayMessage(userOpMsgObj);
                    await saveChatHistory();
                }
                // NEW: JMIL Feedback for all other successful AI-initiated ops
                if (!isUserInitiated) {
                    await addJmilFeedbackToHistory(op, true, "Operation completed successfully.", op.action);
                }
            }
        } else {
            // Specific handlers will set their own error messages if they return false
            if (!op.action.startsWith('github_') && !op.action.startsWith('create_')) { // If it's a local op, show generic failure if not already handled
                showStatus(`${actionText} ${displayPath} failed.`, 'error');
            }
            // NEW: JMIL Feedback on known operation failure
            if (!isUserInitiated) {
                 // The error details might already be in the displayed error message,
                 // but for JMIL feedback, we need a concise summary.
                 // This part needs adjustment if individual handlers also return specific error messages.
                await addJmilFeedbackToHistory(op, false, "Operation failed with an unspecified error. Please review the chat for details.", op.action);
            }
        }

        // Refresh file list if drawer is open, but only for local file ops
        if (success && !op.action.startsWith('github_') && !op.action.startsWith('create_')) {
            if (fileReferenceDrawer.classList.contains('open')) {
                loadProjectFilesForReference();
            }
        }
        return success;

    } catch (error) {
        console.error('Error performing operation:', error);
        let errorMsg = error.message;

        if (op.action.startsWith('github_')) {
            showStatus(`GitHub ${actionText} for ${githubRepoDetails.repo || op.repo_name} Failed: ${errorMsg}`, 'error');
            const errorMsgObj = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                sender: 'ai', // It's an error from an AI-requested GitHub action
                displayContent: `Failed GitHub ${actionText} for ${githubRepoDetails.repo || op.repo_name}: ${escapeHtml(errorMsg)}`,
                contentForAI: `Failed GitHub ${actionText} for ${githubRepoDetails.repo || op.repo_name}: ${errorMsg}`,
                type: 'github-op-error',
                extraData: {
                    action: actionText,
                    repo: githubRepoDetails.repo || op.repo_name,
                    branch: githubRepoDetails.branch,
                    success: false
                },
                isHtml: false,
                timestamp: new Date().toISOString(),
            };
            currentChatHistory.push(errorMsgObj);
            displayMessage(errorMsgObj);
            await saveChatHistory(); // Save immediately
            // NEW: JMIL Feedback on GitHub operation error
            if (!isUserInitiated) {
                await addJmilFeedbackToHistory(op, false, `GitHub operation failed: ${errorMsg}`, op.action);
            }
        } else if (op.action.startsWith('create_')) { // Error for document creation
            showStatus(`${actionText.replace('create_', '').toUpperCase()} document '${op.filename}' creation failed: ${errorMsg}`, 'error');
            const errorMsgObj = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                sender: 'ai',
                displayContent: `Failed to create ${op.action.replace('create_', '').toUpperCase()} document '${op.filename}': ${escapeHtml(errorMsg)}`,
                contentForAI: `Failed to create ${op.action.replace('create_', '').toUpperCase()} document '${op.filename}': ${errorMsg}`,
                type: 'document-creation-error',
                extraData: {
                    action: actionText,
                    filename: op.filename,
                    success: false
                },
                isHtml: false,
                timestamp: new Date().toISOString(),
            };
            currentChatHistory.push(errorMsgObj);
            displayMessage(errorMsgObj);
            await saveChatHistory();
            // JMIL Feedback on document creation error
            if (!isUserInitiated) {
                await addJmilFeedbackToHistory(op, false, `Document creation failed: ${errorMsg}`, op.action);
            }
        }
        else {
            showStatus(`Failed to ${op.action} ${displayPath}: ${errorMsg}`, 'error');
            const errorMsgObj = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                sender: 'ai', // It's an error from an AI-requested local action
                displayContent: `Failed to ${op.action} ${displayPath}: ${escapeHtml(errorMsg)}`,
                contentForAI: `Failed to ${op.action} ${displayPath}: ${errorMsg}`,
                type: 'ai-file-op-error',
                extraData: {
                    action: actionText,
                    filename: displayPath,
                    success: false
                },
                isHtml: false,
                timestamp: new Date().toISOString(),
            };
            currentChatHistory.push(errorMsgObj);
            displayMessage(errorMsgObj);
            await saveChatHistory(); // Save immediately
            // NEW: JMIL Feedback on local operation error
            if (!isUserInitiated) {
                await addJmilFeedbackToHistory(op, false, `Local file operation failed: ${errorMsg}`, op.action);
            }
        }
        return false;
    }
}
/**
 * Adds a hidden IDE feedback message to the chat history for AI learning.
 * This message is not displayed to the user but is included in the AI's context.
 * @param {object} operation The original operation object requested by the AI.
 * @param {boolean} success Whether the operation was successful.
 * @param {string} feedbackMessage A concise message about the outcome.
 * @param {string} operationType The type of operation, e.g., 'create', 'github_push'.
 */
async function addJmilFeedbackToHistory(operation, success, feedbackMessage, operationType) {
    // Generate a simplified view of the file tree for the AI's context
    const simplifiedFileTree = generateSimplifiedFileTreeForAI();

    let aiFeedbackContent = `IDE Feedback: Your previous operation (Action: "${operation.action}", Target: "${operation.path || operation.new_path || operation.repo_name || 'N/A'}") was ${success ? 'SUCCESSFUL' : 'FAILED'}.
Detailed Outcome: ${feedbackMessage}
Consider this feedback for future operations.

Current Project File Structure (simplified for context, max 2 levels deep, no content):
\`\`\`
${simplifiedFileTree}
\`\`\`
`;

    const jmilFeedback = {
        id: `feedback_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        sender: 'system', // Or a more specific 'ide-feedback' role if your AI model supports it
        displayContent: '', // IMPORTANT: This message is NOT displayed to the user
        contentForAI: aiFeedbackContent,
        type: 'ide-jmil-feedback', // A new internal type to identify this message
        extraData: {
            originalOperation: operation,
            success: success,
            feedbackMessage: feedbackMessage,
            operationType: operationType,
        },
        isHtml: false, // It's plain text for AI consumption
        timestamp: new Date().toISOString(),
    };
    currentChatHistory.push(jmilFeedback);
    await saveChatHistory();
}

// Helper functions for specific file operations
async function handleCreateUpdateFile(path, content, action) {
    path = normalizePath(path);
    if (!path) {
        showStatus('File path cannot be empty.', 'error');
        return false;
    }

    // If path implies a directory that was explicitly created empty, remove that marker
    // Example: path = 'folder/file.txt', and 'folder/' exists as DIRECTORY_MARKER
    const pathParts = path.split('/');
    if (pathParts.length > 1) {
        let currentDirPath = '';
        for (let i = 0; i < pathParts.length - 1; i++) {
            currentDirPath += pathParts[i] + '/';
            if (projectFilesData[currentDirPath] === DIRECTORY_MARKER) {
                delete projectFilesData[currentDirPath]; // Directory is now implicitly defined by the file
            }
        }
    }

    projectFilesData[path] = content;
    await putItemInStore(FILES_STORE_NAME, {
        projectId: currentProjectId,
        files: projectFilesData
    });

    return true; // Indicate success for the operation
}

async function handleDeleteFile(path) {
    path = normalizePath(path);
    if (!path) {
        showStatus('File path cannot be empty.', 'error');
        return false;
    }

    if (projectFilesData[path] === undefined) {
        showStatus(`Cannot delete file '${path}': Not found.`, 'error');
        return false;
    }
    if (projectFilesData[path] === DIRECTORY_MARKER || path.endsWith('/')) { // Explicitly check if it's a directory marker or ends with '/'
        showStatus(`Cannot delete file '${path}': It is a directory, not a file. Use 'rmdir' instead.`, 'error');
        return false;
    }

    delete projectFilesData[path];

    // Clean up old implied directory if it becomes empty
    const oldDirPath = path.substring(0, path.lastIndexOf('/') + 1);
    if (oldDirPath) { // Only if it was in a sub-directory
        // Check if any actual files or directory markers remain in the old parent directory
        const hasRemainingContent = Object.keys(projectFilesData).some(p => p.startsWith(oldDirPath) && p !== oldDirPath);
        if (!hasRemainingContent) { // If the directory is now completely empty
             if (projectFilesData[oldDirPath] === DIRECTORY_MARKER) {
                 delete projectFilesData[oldDirPath]; // Remove explicit marker
             }
             // No need to add new DIRECTORY_MARKER, as it's truly empty and now implicitly removed.
        }
    }

    await putItemInStore(FILES_STORE_NAME, {
        projectId: currentProjectId,
        files: projectFilesData
    });
    return true;
}

async function handleCreateDirectory(path) {
    let dirPath = normalizePath(path);
    if (!dirPath.endsWith('/')) dirPath += '/';
    if (!dirPath) {
        showStatus('Directory path cannot be empty.', 'error');
        return false;
    }

    if (projectFilesData[dirPath] === DIRECTORY_MARKER) {
        // Directory explicitly exists as an empty marker
        showStatus(`Directory '${dirPath}' already exists.`, 'info');
        return true;
    }

    // Check if there are already files/directories nested under this path
    // that imply the directory exists, or if it exists as a file (conflict)
    const existingKeysUnderPath = Object.keys(projectFilesData).filter(p => p.startsWith(dirPath));
    if (existingKeysUnderPath.length > 0) {
        const hasActualFiles = existingKeysUnderPath.some(p => projectFilesData[p] !== DIRECTORY_MARKER);
        if (hasActualFiles) {
            showStatus(`Directory '${dirPath}' already implicitly exists due to nested files.`, 'info');
            return true;
        }
    }

    // Check for conflict: if a file exists with the exact name as the directory
    if (projectFilesData[dirPath.slice(0, -1)] !== undefined && projectFilesData[dirPath.slice(0, -1)] !== DIRECTORY_MARKER) {
        showStatus(`Cannot create directory '${dirPath}': A file with the same name already exists.`, 'error');
        return false;
    }

    // Create intermediate directories if they don't exist
    const parts = dirPath.split('/').filter(p => p);
    let currentPath = '';
    for (let i = 0; i < parts.length; i++) {
        currentPath += parts[i] + '/';
        // Only add DIRECTORY_MARKER if it doesn't implicitly exist by nested files or another explicit marker
        const isImplied = Object.keys(projectFilesData).some(p => p.startsWith(currentPath) && p !== currentPath && projectFilesData[p] !== DIRECTORY_MARKER);
        if (projectFilesData[currentPath] === undefined && !isImplied) {
            projectFilesData[currentPath] = DIRECTORY_MARKER;
        }
    }

    await putItemInStore(FILES_STORE_NAME, {
        projectId: currentProjectId,
        files: projectFilesData
    });
    return true;
}

async function handleDeleteDirectory(path) {
    let dirPath = normalizePath(path);
    if (!dirPath.endsWith('/')) dirPath += '/';
    if (!dirPath) {
        showStatus('Directory path cannot be empty.', 'error');
        return false;
    }

    let foundAnything = false;
    const filesToDelete = Object.keys(projectFilesData).filter(p => p.startsWith(dirPath));

    if (filesToDelete.length === 0 && projectFilesData[dirPath] !== DIRECTORY_MARKER) {
         showStatus(`Directory '${dirPath}' not found or is already empty.`, 'info');
         return false; // Nothing to delete
    }

    for (const p of filesToDelete) {
        delete projectFilesData[p];
        foundAnything = true;
    }
    // Also delete the explicit directory marker if it exists
    if (projectFilesData[dirPath] === DIRECTORY_MARKER) {
        delete projectFilesData[dirPath];
        foundAnything = true;
    }

    if (foundAnything) {
        await putItemInStore(FILES_STORE_NAME, {
            projectId: currentProjectId,
            files: projectFilesData
        });
    }
    return foundAnything;
}

async function handleRenameFile(old_path, new_path) {
    old_path = normalizePath(old_path);
    new_path = normalizePath(new_path);

    if (!old_path || !new_path) {
        showStatus('Old path and new path cannot be empty.', 'error');
        return false;
    }

    if (projectFilesData[old_path] === undefined) {
        showStatus(`Cannot rename file '${old_path}': Source file not found.`, 'error');
        return false;
    }
    if (projectFilesData[old_path] === DIRECTORY_MARKER || old_path.endsWith('/')) {
        showStatus(`Cannot rename file '${old_path}': Source is a directory, not a file. Use 'mvdir' instead.`, 'error');
        return false;
    }
    if (projectFilesData[new_path] !== undefined) { // Check for existing file OR explicit directory marker
        showStatus(`Cannot rename to '${new_path}': A file or directory with this name already exists.`, 'error');
        return false;
    }
    if (new_path.endsWith('/')) {
        showStatus(`Cannot rename to '${new_path}': Target name must be a file path, not a directory.`, 'error');
        return false;
    }

    projectFilesData[new_path] = projectFilesData[old_path];
    delete projectFilesData[old_path];

    // Clean up old implied directory if it becomes empty
    const oldDirPath = old_path.substring(0, old_path.lastIndexOf('/') + 1);
    if (oldDirPath) { // Only if it was in a sub-directory
        // Check if any actual files or directory markers remain in the old parent directory
        const hasRemainingContent = Object.keys(projectFilesData).some(p => p.startsWith(oldDirPath) && p !== oldDirPath);
        if (!hasRemainingContent) { // If the directory is now completely empty
             if (projectFilesData[oldDirPath] === DIRECTORY_MARKER) {
                 delete projectFilesData[oldDirPath]; // Remove explicit marker
             }
             // No need to add new DIRECTORY_MARKER, as it's truly empty and now implicitly removed.
        }
    }

    // Ensure new parent directory is implicitly created if it doesn't exist explicitly
    const newDirPath = new_path.substring(0, new_path.lastIndexOf('/') + 1);
    if (newDirPath && projectFilesData[newDirPath] === DIRECTORY_MARKER) {
        delete projectFilesData[newDirPath]; // Remove marker as it's now implicitly defined by the new file
    }

    await putItemInStore(FILES_STORE_NAME, {
        projectId: currentProjectId,
        files: projectFilesData
    });
    return true;
}

async function handleRenameDirectory(old_path, new_path) {
    let oldDirPath = normalizePath(old_path);
    if (!oldDirPath.endsWith('/')) oldDirPath += '/';
    let newDirPath = normalizePath(new_path);
    if (!newDirPath.endsWith('/')) newDirPath += '/';

    if (!oldDirPath || !newDirPath) {
        showStatus('Old directory path and new directory path cannot be empty.', 'error');
        return false;
    }

    if (oldDirPath === newDirPath) {
        showStatus(`Old path and new path are the same for directory rename: ${old_path}`, 'info');
        return true;
    }

    let foundAnything = false;
    const pathsToUpdate = Object.keys(projectFilesData).filter(p => p.startsWith(oldDirPath));

    // If the old path was an explicit empty directory, include it if no other files exist within it
    if (projectFilesData[oldDirPath] === DIRECTORY_MARKER && pathsToUpdate.length === 0) {
        pathsToUpdate.push(oldDirPath);
    }

    if (pathsToUpdate.length === 0) {
        showStatus(`Directory '${old_path}' not found.`, 'error');
        return false;
    }

    // Check for conflicts with existing files/directories at new path
    // A conflict occurs if any item in the new path already exists, unless it's the target itself (if mvdir is used to just rename)
    const conflict = Object.keys(projectFilesData).some(p => p.startsWith(newDirPath) && !p.startsWith(oldDirPath));
    if (conflict) {
         showStatus(`Cannot rename to '${new_path}': Conflicts with existing files or directories.`, 'error');
         return false;
    }
    // Also check if moving 'a/b/' to 'a/b/c/' (moving directory into itself)
    if (newDirPath.startsWith(oldDirPath) && newDirPath.length > oldDirPath.length) {
        showStatus(`Cannot move directory '${old_path}' into a subdirectory of itself: '${new_path}'., 'error`);
        return false;
    }

    const changes = {};
    for (const p of pathsToUpdate) {
        const newP = p.replace(oldDirPath, newDirPath);
        changes[newP] = projectFilesData[p];
        foundAnything = true;
    }

    // Apply changes (delete old paths, add new paths)
    for (const p of pathsToUpdate) {
        delete projectFilesData[p];
    }
    Object.assign(projectFilesData, changes);

    // Clean up empty parent directories after move, if any of the old paths became empty parent directories
    const oldDirParts = oldDirPath.split('/').filter(p => p);
    let currentOldPath = '';
    for (let i = 0; i < oldDirParts.length; i++) {
        currentOldPath += oldDirParts[i] + '/';
        const hasRemainingContent = Object.keys(projectFilesData).some(p => p.startsWith(currentOldPath));
        if (!hasRemainingContent && projectFilesData[currentOldPath] === DIRECTORY_MARKER) {
            delete projectFilesData[currentOldPath];
        }
    }
    // Ensure new parent directory is implicitly created if it doesn't exist explicitly
    const newDirParentPath = newDirPath.substring(0, newDirPath.lastIndexOf('/', newDirPath.length - 2) + 1); // Get parent of newDirPath
    if (newDirParentPath && projectFilesData[newDirParentPath] === DIRECTORY_MARKER) {
        delete projectFilesData[newDirParentPath]; // Remove marker as it's now implicitly defined
    }

    if (foundAnything) {
        await putItemInStore(FILES_STORE_NAME, {
            projectId: currentProjectId,
            files: projectFilesData
        });
    }
    return foundAnything;
}

// ... (existing handleRenameDirectory function)

// NEW: Handle deleting multiple files
async function handleDeleteMultipleFiles(paths) {
    if (!Array.isArray(paths) || paths.length === 0) {
        showStatus('An array of file paths is required for deleting multiple files.', 'error');
        return false;
    }

    let allSuccessful = true;
    for (const path of paths) {
        const success = await handleDeleteFile(path); // Re-use existing single file delete logic
        if (!success) {
            allSuccessful = false;
            // handleDeleteFile already shows a status, no need for another here.
            // But we can log for AI feedback specifically for this batch operation.
            console.warn(`Failed to delete file in batch: ${path}`);
        }
    }

    if (allSuccessful) {
        showStatus(`Successfully deleted ${paths.length} file(s).`, 'success', 3000);
    } else {
        showStatus('Some files failed to delete. Check console for details.', 'warning', 5000);
    }
    return allSuccessful;
}
// Helper function to create a download link for generated Blobs
function createDownloadLink(blob, filename) {
    const url = URL.createObjectURL(blob);
    // Important: Keep track of these URLs if you plan to revoke them later
    // For simplicity in this example, we don't revoke.
    return url; // Return the URL, the display layer will create the anchor tag
}

// Function to convert base64 image data to ArrayBuffer for docx
function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}
// ---- NEW DOCUMENT CREATION HANDLERS ----

/**
 * Handles PDF document creation using jsPDF.
 * @param {object} op - The operation object from AI.
 * @param {string} op.filename - The name of the PDF file.
 * @param {Array<object>} op.pages - Array of page definitions.
 *   Each page can have 'content' (array of text, image, rect, line, table definitions).
 *   Text: { type: 'text', text: string, x: number, y: number, options: object }
 *   Image: { type: 'image', src: string (base64), x: number, y: number, width: number, height: number }
 *   Rectangle: { type: 'rectangle', x: number, y: number, width: number, height: number, options: object }
 *   Line: { type: 'line', x1: number, y1: number, x2: number, y2: number, options: object }
 *   Table: { type: 'table', head: Array<Array<string>>, body: Array<Array<string>>, options: object (for jspdf-autotable) }
 */
async function handleCreatePdf(op) {
    if (typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined') {
        throw new Error("jsPDF library is not loaded. Ensure the CDN script is included.");
    }
    // Check for autoTable plugin availability
    const autoTableEnabled = typeof jspdf.jsPDF.API.autoTable === 'function';
    if (!autoTableEnabled) {
        console.warn("jspdf-autotable plugin is not loaded. Table generation might not work as expected in PDF.");
    }

    const doc = new jspdf.jsPDF();

    for (let pageIndex = 0; pageIndex < op.pages.length; pageIndex++) {
        if (pageIndex > 0) {
            doc.addPage();
        }
        const page = op.pages[pageIndex];

        // jsPDF operates on absolute coordinates. Margins are handled by adjusting content placement.
        // The AI should provide (x, y) coordinates relative to the desired page area.

        if (page.content) {
            for (const item of page.content) {
                switch (item.type) {
                    case 'text':
                        // Set font styles
                        doc.setFont(item.options?.font || 'Helvetica', item.options?.fontStyle || 'normal');
                        doc.setFontSize(item.options?.fontSize || 12);
                        doc.setTextColor(item.options?.color || '#000000');

                        // Handle text alignment
                        let finalX = item.x;
                        let finalAlign = item.options?.align || 'left';
                        if (finalAlign === 'center') {
                            finalX = doc.internal.pageSize.width / 2; // Default center
                        } else if (finalAlign === 'right') {
                            finalX = doc.internal.pageSize.width - (item.options?.rightMargin || 20); // Default right margin
                        }

                        doc.text(item.text, finalX, item.y, { align: finalAlign, ...item.options });

                        // Basic underline/strikethrough (more complex for multi-line or specific fonts)
                        if (item.options?.decoration?.includes('underline')) {
                            const textWidth = doc.getStringUnitWidth(item.text) * doc.internal.getFontSize() / doc.internal.scaleFactor;
                            const textOffset = (finalAlign === 'center' ? textWidth / 2 : (finalAlign === 'right' ? textWidth : 0));
                            doc.line(finalX - textOffset, item.y + 1, finalX - textOffset + textWidth, item.y + 1);
                        }
                        // Strikethrough can be implemented similarly
                        if (item.options?.decoration?.includes('line-through')) {
                            const textWidth = doc.getStringUnitWidth(item.text) * doc.internal.getFontSize() / doc.internal.scaleFactor;
                            const textOffset = (finalAlign === 'center' ? textWidth / 2 : (finalAlign === 'right' ? textWidth : 0));
                            doc.line(finalX - textOffset, item.y - (doc.internal.getFontSize() / 2), finalX - textOffset + textWidth, item.y - (doc.internal.getFontSize() / 2));
                        }
                        break;
                    case 'image':
                        const imgData = item.src.split(',')[1];
                        const imgMime = item.src.split(';')[0].split(':')[1];
                        doc.addImage(imgData, imgMime.split('/')[1].toUpperCase(), item.x, item.y, item.width, item.height);
                        break;
                    case 'rectangle':
                        doc.setFillColor(item.options?.fillColor || '#FFFFFF');
                        doc.setDrawColor(item.options?.strokeColor || '#000000');
                        doc.setLineWidth(item.options?.lineWidth || 0.1);
                        doc.rect(item.x, item.y, item.width, item.height, item.options?.style || 'FD'); // Fill and Stroke by default
                        break;
                    case 'line':
                        doc.setDrawColor(item.options?.lineColor || '#000000');
                        doc.setLineWidth(item.options?.lineWidth || 0.1);
                        doc.line(item.x1, item.y1, item.x2, item.y2);
                        break;
                    case 'table':
                        if (!autoTableEnabled) {
                            console.error("jspdf-autotable plugin is required for table generation but not loaded or initialized.");
                            continue; // Skip table if plugin not available
                        }
                        doc.autoTable({
                            startY: item.y,
                            // startX: item.x, // autoTable handles x positioning usually with margins/padding
                            head: item.head,
                            body: item.body,
                            ...item.options
                        });
                        break;
                    default:
                        console.warn(`Unknown PDF content type: ${item.type}`);
                }
            }
        }
    }

    const pdfBlob = doc.output('blob');
    op._downloadUrl = createDownloadLink(pdfBlob, op.filename);
    return true;
}

/**
 * Handles DOCX document creation using docx library.
 * @param {object} op - The operation object from AI.
 * @param {string} op.filename - The name of the DOCX file.
 * @param {Array<object>} op.sections - Array of section definitions.
 *   Each section can have 'properties' and 'children' (array of paragraph, image, table definitions).
 *   Paragraph: { type: 'paragraph', text: string, options: object }
 *   Image: { type: 'image', src: string (base64), width: number, height: number, options: object }
 *   Table: { type: 'table', rows: Array<Array<object>>, options: object }
 */
async function handleCreateDocx(op) {
    if (typeof docx === 'undefined' || typeof docx.Document === 'undefined') {
        throw new Error("docx library is not loaded. Ensure the CDN script is included.");
    }
    // Assume Document, Packer, Paragraph etc. are globally available or destructured at the top

    const sections = [];
    for (const sectionDef of op.sections) {
        const children = [];
        if (sectionDef.children) {
            for (const item of sectionDef.children) {
                switch (item.type) {
                    case 'paragraph':
                        const runs = [];
                        if (item.text) {
                            const textRunOptions = {
                                text: item.text,
                                bold: item.options?.bold || false,
                                italics: item.options?.italics || false,
                                // DOCX underline is an object, size is in half-points (e.g., 24 for 12pt)
                                underline: item.options?.underline ? { type: "single" } : undefined,
                                strikethrough: item.options?.strikethrough || false,
                                size: item.options?.fontSize,
                                font: item.options?.font,
                                color: item.options?.color, // Hex color string, e.g., "FF0000"
                                break: item.options?.break === 'line' ? 1 : undefined, // simple line break
                                pageBreak: item.options?.pageBreak === true ? 'before' : undefined, // page break
                            };
                            if (item.options?.tab === true) runs.push(new Tab());
                            runs.push(new TextRun(textRunOptions));
                        }
                        children.push(new Paragraph({
                            children: runs,
                            heading: item.options?.heading ? HeadingLevel[item.options.heading.toUpperCase()] : undefined,
                            alignment: item.options?.alignment ? AlignmentType[item.options.alignment.toUpperCase()] : undefined,
                            indent: item.options?.indent, // e.g., { left: 720 } for 0.5 inch (DXA units)
                            spacing: item.options?.spacing, // { before: 100, after: 100 } in TWIPs (1/1440 of an inch)
                            thematicBreak: item.options?.thematicBreak || false, // Horizontal Rule
                            border: item.options?.border, // e.g. { bottom: { color: "auto", space: 1, value: "single", size: 6 } }
                            style: item.options?.style // Custom style ID
                        }));
                        break;
                    case 'image':
                        const imageData = base64ToArrayBuffer(item.src.split(',')[1]);
                        children.push(new Paragraph({
                            children: [
                                new ImageRun({
                                    data: imageData,
                                    transformation: {
                                        width: item.width,
                                        height: item.height,
                                    },
                                    floating: item.options?.floating, // e.g. { horizontalPosition: { relativeFrom: RelativeHorizontalPosition.COLUMN, align: HorizontalPositionAlign.CENTER }, verticalPosition: { relativeFrom: RelativeVerticalPosition.LINE, align: VerticalPositionAlign.CENTER } }
                                }),
                            ],
                            alignment: item.options?.alignment ? AlignmentType[item.options.alignment.toUpperCase()] : undefined,
                        }));
                        break;
                    case 'table':
                        const rows = item.rows.map(rowDef => new TableRow({
                            children: rowDef.map(cellDef => new TableCell({
                                children: [new Paragraph({
                                    children: [new TextRun({
                                        text: cellDef.text || '',
                                        bold: cellDef.bold || false,
                                        italics: cellDef.italics || false,
                                        underline: cellDef.underline ? { type: "single" } : undefined,
                                        size: cellDef.fontSize,
                                        font: cellDef.font,
                                        color: cellDef.color,
                                    })],
                                    alignment: cellDef.alignment ? AlignmentType[cellDef.alignment.toUpperCase()] : undefined,
                                })],
                                shading: cellDef.shading ? { fill: cellDef.shading.fill, type: ShadingType[cellDef.shading.type.toUpperCase()] } : undefined,
                                borders: cellDef.borders, // e.g. { top: { style: BorderStyle.SINGLE, size: 6, color: "auto" } }
                                verticalAlign: cellDef.verticalAlign, // VerticalAlign.CENTER
                                width: cellDef.width ? { size: cellDef.width, type: WidthType.DXA } : undefined,
                                // Add more cell options as needed
                            })),
                            // Add more row options as needed
                        }));
                        children.push(new Table({
                            rows: rows,
                            width: item.options?.width, // { size: 9000, type: WidthType.DXA }
                            columnWidths: item.options?.columnWidths, // Array of DXA widths e.g. [3000, 3000, 3000]
                            alignment: item.options?.alignment ? AlignmentType[item.options.alignment.toUpperCase()] : undefined,
                            borders: item.options?.borders,
                            float: item.options?.float, // { rightFromText: 1440 }
                            margins: item.options?.margins, // { top: 100, right: 100, bottom: 100, left: 100 }
                            // Add more table options as needed
                        }));
                        break;
                    default:
                        console.warn(`Unknown DOCX content type: ${item.type}`);
                }
            }
        }
        sections.push({
            properties: sectionDef.properties, // Page size, orientation, margins { page: { size: { width: 12240, height: 15840, orientation: "portrait" }, margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }
            children: children,
        });
    }

    const doc = new Document({ sections: sections });
    const buffer = await Packer.toBuffer(doc);
    const docxBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    op._downloadUrl = createDownloadLink(docxBlob, op.filename);
    return true;
}

/**
 * Handles XLSX document creation using SheetJS (XLSX).
 * @param {object} op - The operation object from AI.
 * @param {string} op.filename - The name of the XLSX file.
 * @param {Array<object>} op.sheets - Array of sheet definitions.
 *   Each sheet can have 'name', 'data' (array of arrays for rows/columns), 'cell_styles', 'merges'.
 *   'cell_styles' format: { "A1": { "font": { "bold": true } }, "B:B": { "width": 15 } }
 */
async function handleCreateXlsx(op) {
    if (typeof XLSX === 'undefined') {
        throw new Error("SheetJS (XLSX) library is not loaded. Ensure the CDN script is included.");
    }

    const workbook = XLSX.utils.book_new();

    for (const sheetDef of op.sheets) {
        const worksheet = XLSX.utils.aoa_to_sheet(sheetDef.data || []);

        // Apply cell styles
        if (sheetDef.cell_styles) {
            for (const cellRef in sheetDef.cell_styles) {
                const style = sheetDef.cell_styles[cellRef];
                if (cellRef.includes(':')) { // Range style (e.g., 'A:A', '1:1', 'A1:B2')
                    // Handle column widths and row heights which are properties of the worksheet
                    if (cellRef.match(/^[A-Z]+:[A-Z]+$/i) && style.width !== undefined) { // Column width
                        if (!worksheet['!cols']) worksheet['!cols'] = [];
                        const startCol = XLSX.utils.decode_col(cellRef.split(':')[0]);
                        const endCol = XLSX.utils.decode_col(cellRef.split(':')[1]);
                        for (let c = startCol; c <= endCol; c++) {
                            if (!worksheet['!cols'][c]) worksheet['!cols'][c] = {};
                            worksheet['!cols'][c].wch = style.width;
                        }
                        delete style.width; // Remove width from cell style
                    } else if (cellRef.match(/^[0-9]+:[0-9]+$/) && style.height !== undefined) { // Row height
                         if (!worksheet['!rows']) worksheet['!rows'] = [];
                         const startRow = parseInt(cellRef.split(':')[0]) - 1;
                         const endRow = parseInt(cellRef.split(':')[1]) - 1;
                         for (let r = startRow; r <= endRow; r++) {
                            if (!worksheet['!rows'][r]) worksheet['!rows'][r] = {};
                            worksheet['!rows'][r].hpt = style.height; // Height in points
                         }
                         delete style.height; // Remove height from cell style
                    }

                    // Apply other styles to individual cells within the range
                    const range = XLSX.utils.decode_range(cellRef);
                    for (let R = range.s.r; R <= range.e.r; ++R) {
                        for (let C = range.s.c; C <= range.e.c; ++C) {
                            const address = XLSX.utils.encode_cell({ r: R, c: C });
                            if (!worksheet[address]) {
                                // SheetJS requires a cell object to apply style, even if empty
                                worksheet[address] = { t: 's', v: '' };
                            }
                            worksheet[address].s = { ...(worksheet[address].s || {}), ...style };
                        }
                    }
                } else { // Single cell style
                    if (!worksheet[cellRef]) {
                        worksheet[cellRef] = { t: 's', v: '' }; // Add empty cell if not exists
                    }
                    worksheet[cellRef].s = { ...(worksheet[cellRef].s || {}), ...style };
                }
            }
        }

        // Apply merges
        if (sheetDef.merges && sheetDef.merges.length > 0) {
            if (!worksheet['!merges']) worksheet['!merges'] = [];
            worksheet['!merges'] = worksheet['!merges'].concat(sheetDef.merges.map(s => XLSX.utils.decode_range(s)));
        }

        XLSX.utils.book_append_sheet(workbook, worksheet, sheetDef.name || 'Sheet1');
    }

    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const xlsxBlob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.document' });
    op._downloadUrl = createDownloadLink(xlsxBlob, op.filename);
    return true;
}

/**
 * Handles PPTX document creation using pptxgenjs.
 * @param {object} op - The operation object from AI.
 * @param {string} op.filename - The name of the PPTX file.
 * @param {Array<object>} op.slides - Array of slide definitions.
 *   Each slide can have 'master', 'elements' (array of text, image, table definitions), and 'notes'.
 *   Text: { type: 'text', text: string, options: object }
 *   Image: { type: 'image', src: string (base64), x: number, y: number, w: number, h: number }
 *   Table: { type: 'table', data: Array<Array<string>>, options: object }
 *   Shape: { type: 'shape', shapeType: string, x: number, y: number, w: number, h: number, options: object }
 */
async function handleCreatePptx(op) {
    if (typeof pptxgenjs === 'undefined' || typeof pptxgenjs.default === 'undefined') {
        throw new Error("pptxgenjs library is not loaded. Ensure the CDN script is included.");
    }
    const pptx = new pptxgenjs.default();

    // Define custom master slide if needed from op.masters
    if (op.masters) {
        for (const master of op.masters) {
            pptx.defineSlideMaster(master);
        }
    }


    for (const slideDef of op.slides) {
        const slide = pptx.addSlide(slideDef.master || 'BLANK'); // Use BLANK master if not specified

        if (slideDef.elements) {
            for (const item of slideDef.elements) {
                switch (item.type) {
                    case 'text':
                        slide.addText(item.text, {
                            ...item.options,
                            color: item.options?.color ? item.options.color.replace('#', '') : undefined, // pptxgenjs expects hex without #
                        });
                        break;
                    case 'image':
                        const imgBase64 = item.src.split(',')[1];
                        slide.addImage({
                            data: imgBase64,
                            x: item.x,
                            y: item.y,
                            w: item.w,
                            h: item.h,
                            ...item.options
                        });
                        break;
                    case 'table':
                        slide.addTable(item.data, {
                            ...item.options,
                            // Ensure color is hex without # if applicable
                            border: item.options?.border ? {
                                ...item.options.border,
                                color: item.options.border.color ? item.options.border.color.replace('#', '') : undefined
                            } : undefined
                        });
                        break;
                    case 'shape': // Add basic shape support
                        if (!item.shapeType) {
                            console.warn("Shape element requires 'shapeType' option.");
                            continue;
                        }
                        // pptxgenjs.shapes requires direct access to its properties
                        // e.g., pptxgenjs.shapes.RECTANGLE. So we map the string to the constant.
                        const shapeConstant = pptx.shapes[item.shapeType.toUpperCase()];
                        if (!shapeConstant) {
                            console.warn(`Unknown PPTX shapeType: ${item.shapeType}`);
                            continue;
                        }
                        slide.addShape(shapeConstant, {
                            x: item.x, y: item.y, w: item.w, h: item.h,
                            fill: item.options?.fillColor ? item.options.fillColor.replace('#', '') : undefined,
                            line: item.options?.lineColor ? { color: item.options.lineColor.replace('#', ''), pt: item.options.lineWidth } : undefined,
                            ...item.options
                        });
                        break;
                    case 'chart': // Add basic chart support
                        if (!item.chartType || !item.data) {
                            console.warn("Chart element requires 'chartType' and 'data' options.");
                            continue;
                        }
                        slide.addChart(pptx.charts[item.chartType.toUpperCase()], item.data, {
                            x: item.x, y: item.y, w: item.w, h: item.h,
                            ...item.options
                        });
                        break;
                    default:
                        console.warn(`Unknown PPTX element type: ${item.type}`);
                }
            }
        }
        if (slideDef.notes) {
            slide.addNotes(slideDef.notes);
        }
    }

    const pptxBlob = await pptx.write({ outputType: 'blob' });
    op._downloadUrl = createDownloadLink(pptxBlob, op.filename);
    return true;
}
// NEW: Handle creating multiple directories
async function parseAndDisplayAiResponse(response) {
    // Regex now expects JSON block followed by an optional raw content block, both within °°°° delimiters.
    // °°°° JSONBLOCK °°°° RAWCONTENTBLOCK °°°°
    const fileActionRegex = /°°°°\s*```json\s*({[\s\S]*?})\s*```\s*°°°°(?:\s*([\s\S]*?)\s*°°°°)?/g;
    const audioSpeechRegex = /__{audio:\s*"(.*?)"}__/g;
    const segments = [];
    let lastIndex = 0;
    let match;

    // First, extract audio speech segments to remove them from the main text
    let speechContentToPlay = '';
    let cleanedResponse = response.replace(audioSpeechRegex, (match, p1) => {
        speechContentToPlay = p1; // Capture the last audio segment for playback
        return ''; // Remove from the main text that gets displayed/parsed for file ops
    });

    // Now, parse file actions from the cleaned response
    while ((match = fileActionRegex.exec(cleanedResponse)) !== null) {
        if (match.index > lastIndex) {
            segments.push({
                type: 'text',
                content: cleanedResponse.substring(lastIndex, match.index),
            });
        }

        try {
            let jsonString = match[1];
            let parsedJson;
            try {
                parsedJson = JSON.parse(jsonString);
            } catch (e) {
                // More robust attempt to clean JSON if it starts/ends incorrectly or has common AI errors
                jsonString = jsonString.trim();
                // Attempt to strip common markdown code block markers if present
                if (jsonString.startsWith('```json')) jsonString = jsonString.substring('```json'.length).trim();
                if (jsonString.endsWith('```')) jsonString = jsonString.substring(0, jsonString.length - '```'.length).trim();
                // Attempt to strip the custom delimiters if the AI incorrectly included them inside the JSON block
                if (jsonString.startsWith('°°°°')) jsonString = jsonString.substring('°°°°'.length).trim();
                if (jsonString.endsWith('°°°°')) jsonString = jsonString.substring(0, jsonString.length - '°°°°'.length).trim();

                // Remove BOM if present (rare but can happen with some text encodings)
                if (jsonString.charCodeAt(0) === 0xFEFF) {
                    jsonString = jsonString.substring(1);
                }

                try {
                    parsedJson = JSON.parse(jsonString);
                } catch (retryError) {
                    console.error("Second attempt at JSON parsing failed:", retryError, "Raw string:", jsonString);
                    throw new Error(`Invalid JSON format after retry: ${retryError.message}\nRaw: ${match[1]}`);
                }
            }

            // Extract raw content if has_content_block is true and the content block is present
            const rawContentBlock = match[2]; // This is the content between the second and third °°°° blocks

            if (parsedJson.has_content_block === true) {
                if (rawContentBlock === undefined || rawContentBlock.trim() === '') {
                    throw new Error(`"has_content_block" is true but no raw content block was provided after the JSON.`);
                }
                // If has_content_block is true, the rawContentBlock is the intended file content
                parsedJson.content = rawContentBlock.trim();
                // We can set has_content_block to false after extracting, for internal consistency
                parsedJson.has_content_block = false;
            } else if (rawContentBlock !== undefined && rawContentBlock.trim() !== '') {
                // If has_content_block is false or absent, but rawContentBlock is present, this is an error
                throw new Error(`Raw content block provided unexpectedly. Set "has_content_block": true in JSON for raw content.`);
            }


            // Validate required fields based on action type
            const action = parsedJson.action;
            let isValidAction = false;
            switch(action) {
                case 'create':
                case 'update':
                case 'github_create_file':
                case 'github_update_file':
                    isValidAction = parsedJson.path && parsedJson.content !== undefined;
                    // Additional check for content type - ensure it's a string
                    if (parsedJson.content !== undefined && typeof parsedJson.content !== 'string') {
                         throw new Error(`'content' field for '${action}' action must be a string.`);
                    }
                    if (parsedJson.message !== undefined && typeof parsedJson.message !== 'string') {
                         throw new Error(`'message' field for '${action}' action must be a string if provided.`);
                    }
                    if (parsedJson.branch !== undefined && typeof parsedJson.branch !== 'string') {
                         throw new Error(`'branch' field for '${action}' action must be a string if provided.`);
                    }
                    break;
                case 'delete':
                case 'mkdir':
                case 'rmdir':
                case 'github_delete_file':
                    isValidAction = parsedJson.path !== undefined;
                    // Additional check for path type - ensure it's a string
                    if (parsedJson.path !== undefined && typeof parsedJson.path !== 'string') {
                        throw new Error(`'path' field for '${action}' action must be a string.`);
                    }
                    if (parsedJson.message !== undefined && typeof parsedJson.message !== 'string') {
                         throw new Error(`'message' field for '${action}' action must be a string if provided.`);
                    }
                    if (parsedJson.branch !== undefined && typeof parsedJson.branch !== 'string') {
                         throw new Error(`'branch' field for '${action}' action must be a string if provided.`);
                    }
                    break;
                // NEW: Validate delete_multiple_files
                case 'delete_multiple_files':
                    isValidAction = Array.isArray(parsedJson.paths) && parsedJson.paths.every(p => typeof p === 'string');
                    if (!isValidAction) {
                        throw new Error(`'paths' field for '${action}' action must be an array of strings.`);
                    }
                    break;
                // NEW: Validate create_multiple_directories
                case 'create_multiple_directories':
                    isValidAction = Array.isArray(parsedJson.paths) && parsedJson.paths.every(p => typeof p === 'string' && p.endsWith('/'));
                    if (!isValidAction) {
                        throw new Error(`'paths' field for '${action}' action must be an array of strings, each ending with '/'.`);
                    }
                    break;
                case 'mvfile':
                case 'mvdir':
                    isValidAction = parsedJson.old_path !== undefined && parsedJson.new_path !== undefined;
                    // Additional check for path types - ensure they are strings
                    if (parsedJson.old_path !== undefined && typeof parsedJson.old_path !== 'string') {
                        throw new Error(`'old_path' field for '${action}' action must be a string.`);
                    }
                    if (parsedJson.new_path !== undefined && typeof parsedJson.new_path !== 'string') {
                        throw new Error(`'new_path' field for '${action}' action must be a string.`);
                    }
                    break;
                case 'update_code_block': // NEW ACTION VALIDATION
                    isValidAction = parsedJson.path !== undefined && parsedJson.logic_name !== undefined && parsedJson.content !== undefined;
                    if (parsedJson.path !== undefined && typeof parsedJson.path !== 'string') {
                        throw new Error(`'path' field for '${action}' action must be a string.`);
                    }
                    if (parsedJson.logic_name !== undefined && typeof parsedJson.logic_name !== 'string') {
                        throw new Error(`'logic_name' field for '${action}' action must be a string.`);
                    }
                    if (parsedJson.content !== undefined && typeof parsedJson.content !== 'string') {
                        throw new Error(`'content' field for '${action}' action must be a string.`);
                    }
                    break;
                case 'insert_code_markers': // NEW ACTION VALIDATION
                    isValidAction = parsedJson.path !== undefined && parsedJson.logic_name !== undefined && parsedJson.start_line !== undefined && parsedJson.end_line !== undefined;
                    if (parsedJson.path !== undefined && typeof parsedJson.path !== 'string') {
                        throw new Error(`'path' field for '${action}' action must be a string.`);
                    }
                    if (parsedJson.logic_name !== undefined && typeof parsedJson.logic_name !== 'string') {
                        throw new Error(`'logic_name' field for '${action}' action must be a string.`);
                    }
                    if (parsedJson.start_line !== undefined && typeof parsedJson.start_line !== 'number') {
                        throw new Error(`'start_line' field for '${action}' action must be a number.`);
                    }
                    if (parsedJson.end_line !== undefined && typeof parsedJson.end_line !== 'number') {
                        throw new Error(`'end_line' field for '${action}' action must be a number.`);
                    }
                    break;

                // NEW DOCUMENT CREATION VALIDATION
                case 'create_pdf':
                    isValidAction = parsedJson.filename && typeof parsedJson.filename === 'string' &&
                                    Array.isArray(parsedJson.pages) && parsedJson.pages.length > 0;
                    if (!isValidAction) throw new Error(`'filename' (string) and 'pages' (array) are required for '${action}' action.`);
                    break;
                case 'create_docx':
                    isValidAction = parsedJson.filename && typeof parsedJson.filename === 'string' &&
                                    Array.isArray(parsedJson.sections) && parsedJson.sections.length > 0;
                    if (!isValidAction) throw new Error(`'filename' (string) and 'sections' (array) are required for '${action}' action.`);
                    break;
                case 'create_xlsx':
                    isValidAction = parsedJson.filename && typeof parsedJson.filename === 'string' &&
                                    Array.isArray(parsedJson.sheets) && parsedJson.sheets.length > 0;
                    if (!isValidAction) throw new Error(`'filename' (string) and 'sheets' (array) are required for '${action}' action.`);
                    break;
                case 'create_pptx':
                    isValidAction = parsedJson.filename && typeof parsedJson.filename === 'string' &&
                                    Array.isArray(parsedJson.slides) && parsedJson.slides.length > 0;
                    if (!isValidAction) throw new Error(`'filename' (string) and 'slides' (array) are required for '${action}' action.`);
                    break;

                // GitHub Operations
                case 'github_push':
                case 'github_pull':
                    isValidAction = true; // No required fields for these
                    if (parsedJson.message !== undefined && typeof parsedJson.message !== 'string') {
                        throw new Error(`'message' field for 'github_push' action must be a string if provided.`);
                    }
                    break;
                case 'github_create_branch':
                    isValidAction = parsedJson.new_branch_name !== undefined;
                     if (parsedJson.new_branch_name !== undefined && typeof parsedJson.new_branch_name !== 'string') {
                         throw new Error(`'new_branch_name' field for '${action}' action must be a string.`);
                    }
                     if (parsedJson.base_branch !== undefined && typeof parsedJson.base_branch !== 'string') {
                         throw new Error(`'base_branch' field for '${action}' action must be a string if provided.`);
                    }
                    break;
                case 'github_delete_branch':
                    isValidAction = parsedJson.branch_name !== undefined;
                    if (parsedJson.branch_name !== undefined && typeof parsedJson.branch_name !== 'string') {
                         throw new Error(`'branch_name' field for '${action}' action must be a string.`);
                    }
                    break;
                case 'github_create_pull_request':
                    isValidAction = parsedJson.title !== undefined && parsedJson.head !== undefined && parsedJson.base !== undefined;
                     if (parsedJson.title !== undefined && typeof parsedJson.title !== 'string') {
                         throw new Error(`'title' field for '${action}' action must be a string.`);
                    }
                     if (parsedJson.head !== undefined && typeof parsedJson.head !== 'string') {
                         throw new Error(`'head' field for '${action}' action must be a string.`);
                    }
                     if (parsedJson.base !== undefined && typeof parsedJson.base !== 'string') {
                         throw new Error(`'base' field for '${action}' action must be a string.`);
                    }
                     if (parsedJson.body !== undefined && typeof parsedJson.body !== 'string') {
                         throw new Error(`'body' field for '${action}' action must be a string if provided.`);
                    }
                    break;
                case 'github_get_workflow_logs':
                    isValidAction = parsedJson.workflow_id !== undefined && parsedJson.run_id !== undefined; // workflow_id and run_id are required
                    if (parsedJson.workflow_id !== undefined && typeof parsedJson.workflow_id !== 'string' && typeof parsedJson.workflow_id !== 'number') {
                        throw new Error(`'workflow_id' field for '${action}' must be a string (filename) or number (ID).`);
                    }
                    if (parsedJson.run_id !== undefined && typeof parsedJson.run_id !== 'number') {
                        throw new Error(`'run_id' field for '${action}' must be a number.`);
                    }
                    if (parsedJson.job_id !== undefined && typeof parsedJson.job_id !== 'number') {
                         throw new Error(`'job_id' field for '${action}' must be a number if provided.`);
                    }
                    if (parsedJson.branch !== undefined && typeof parsedJson.branch !== 'string') {
                         throw new Error(`'branch' field for '${action}' action must be a string if provided.`);
                    }
                    break;
                case 'github_get_latest_workflow_logs': // New action
                    isValidAction = parsedJson.workflow_id !== undefined;
                    if (parsedJson.workflow_id !== undefined && typeof parsedJson.workflow_id !== 'string' && typeof parsedJson.workflow_id !== 'number') {
                        throw new Error(`'workflow_id' field for '${action}' must be a string (filename) or number (ID).`);
                    }
                    if (parsedJson.branch !== undefined && typeof parsedJson.branch !== 'string') {
                         throw new Error(`'branch' field for '${action}' action must be a string if provided.`);
                    }
                    break;
                case 'github_get_workflow_runs': // NEW ACTION VALIDATION
                    isValidAction = parsedJson.workflow_id !== undefined;
                    if (parsedJson.workflow_id !== undefined && typeof parsedJson.workflow_id !== 'string' && typeof parsedJson.workflow_id !== 'number') {
                        throw new Error(`'workflow_id' field for '${action}' must be a string (filename) or number (ID).`);
                    }
                    if (parsedJson.branch !== undefined && typeof parsedJson.branch !== 'string') {
                         throw new Error(`'branch' field for '${action}' action must be a string if provided.`);
                    }
                    break;
                case 'github_trigger_workflow':
                    isValidAction = parsedJson.workflow_id !== undefined; // workflow_id is required
                     if (parsedJson.workflow_id !== undefined && typeof parsedJson.workflow_id !== 'string' && typeof parsedJson.workflow_id !== 'number') {
                        throw new Error(`'workflow_id' field for '${action}' must be a string (filename) or number (ID).`);
                    }
                    if (parsedJson.inputs !== undefined && typeof parsedJson.inputs !== 'object') {
                        throw new Error(`'inputs' field for '${action}' must be a JSON object if provided.`);
                    }
                    if (parsedJson.branch !== undefined && typeof parsedJson.branch !== 'string') {
                         throw new Error(`'branch' field for '${action}' action must be a string if provided.`);
                    }
                    break;
                case 'github_create_repo':
                    isValidAction = parsedJson.repo_name !== undefined;
                    if (parsedJson.repo_name !== undefined && typeof parsedJson.repo_name !== 'string') {
                        throw new Error(`'repo_name' field for '${action}' action must be a string.`);
                    }
                    if (parsedJson.private !== undefined && typeof parsedJson.private !== 'boolean') {
                        throw new Error(`'private' field for '${action}' action must be a boolean.`);
                    }
                    if (parsedJson.org_name !== undefined && typeof parsedJson.org_name !== 'string') {
                        throw new Error(`'org_name' field for '${action}' action must be a string.`);
                    }
                     if (parsedJson.body !== undefined && typeof parsedJson.body !== 'string') {
                         throw new Error(`'body' field for '${action}' action must be a string if provided.`);
                    }
                    break;
                case 'github_delete_repo':
                    isValidAction = parsedJson.repo_name !== undefined;
                    if (parsedJson.repo_name !== undefined && typeof parsedJson.repo_name !== 'string') {
                        throw new Error(`'repo_name' field for '${action}' action must be a string.`);
                    }
                    break;
                case 'github_set_secret': // New action
                    isValidAction = parsedJson.secret_name !== undefined && parsedJson.secret_value !== undefined;
                    if (parsedJson.secret_name !== undefined && typeof parsedJson.secret_name !== 'string') {
                        throw new Error(`'secret_name' field for '${action}' action must be a string.`);
                    }
                    if (parsedJson.secret_value !== undefined && typeof parsedJson.secret_value !== 'string') {
                        throw new Error(`'secret_value' field for '${action}' action must be a string.`);
                    }
                    if (parsedJson.repo_name !== undefined && typeof parsedJson.repo_name !== 'string') {
                        throw new Error(`'repo_name' field for '${action}' action must be a string if provided.`);
                    }
                    if (parsedJson.org_name !== undefined && typeof parsedJson.org_name !== 'string') {
                        throw new Error(`'org_name' field for '${action}' action must be a string if provided.`);
                    }
                    break;
                case 'github_get_artifact_download_links': // New action
                    isValidAction = parsedJson.workflow_id !== undefined;
                    if (parsedJson.workflow_id !== undefined && typeof parsedJson.workflow_id !== 'string' && typeof parsedJson.workflow_id !== 'number') {
                        throw new Error(`'workflow_id' field for '${action}' must be a string (filename) or number (ID).`);
                    }
                    if (parsedJson.branch !== undefined && typeof parsedJson.branch !== 'string') {
                         throw new Error(`'branch' field for '${action}' action must be a string if provided.`);
                    }
                    break;
                case 'github_list_repos': // New action
                    isValidAction = true; // No required fields, can list user's repos by default
                    if (parsedJson.org_name !== undefined && typeof parsedJson.org_name !== 'string') {
                        throw new Error(`'org_name' field for '${action}' action must be a string if provided.`);
                    }
                    break;
            }

            if (isValidAction) {
                segments.push({
                    type: (action.startsWith('github_') ? 'github-action' : (action.startsWith('create_') ? 'document-creation' : 'file-action')),
                    parsedOp: parsedJson // Pass the whole parsed object
                });
            } else {
                throw new Error(`Missing or invalid required fields for action '${action}'.\nRaw: ${match[1]}`);
            }
        } catch (jsonError) {
            segments.push({
                type: 'file-action-error', // General error for any operation JSON parsing
                errorMessage: `Error parsing AI operation: ${jsonError.message}`,
                rawContent: match[0], // Store the entire malformed block including raw content if it was there
            });
        }
        lastIndex = fileActionRegex.lastIndex;
    }

    if (lastIndex < cleanedResponse.length) {
        segments.push({
            type: 'text',
            content: cleanedResponse.substring(lastIndex),
        });
    }

    for (const segment of segments) {
        if (segment.type === 'text') {
            // Only create a text message if there is actual content
            if (segment.content.trim() !== '') {
                const textMsgObj = {
                    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                    sender: 'ai',
                    displayContent: renderMarkdown(segment.content),
                    contentForAI: segment.content, // Store original for AI context
                    type: 'text',
                    extraData: null,
                    isHtml: true, // Indicates displayContent contains HTML generated by renderMarkdown
                    timestamp: new Date().toISOString(),
                };
                currentChatHistory.push(textMsgObj);
                displayMessage(textMsgObj);
                await saveChatHistory(); // Save immediately after displaying AI text response
            }
        } else if (segment.type === 'file-action') {
            const parsedOp = segment.parsedOp;
            const success = await performFileOperation(parsedOp, false); // AI initiated

            let displayPath = parsedOp.path || parsedOp.new_path || parsedOp.old_path;
            let displayAction = parsedOp.action;
            let logicNameForDisplay = parsedOp.logic_name || null;

            // Determine the display action text more precisely
            if (parsedOp.action === 'create' || parsedOp.action === 'update') {
                const fileExistsBeforeOp = projectFilesData[parsedOp.path] !== undefined && projectFilesData[parsedOp.path] !== DIRECTORY_MARKER;
                displayAction = fileExistsBeforeOp ? 'updated' : 'created';
            } else if (parsedOp.action === 'delete') {
                displayAction = 'deleted';
            } else if (parsedOp.action === 'delete_multiple_files') { // NEW
                displayAction = 'deleted multiple files';
                displayPath = parsedOp.paths.join(', '); // For display purposes
            } else if (parsedOp.action === 'mkdir') {
                displayAction = 'created directory';
            } else if (parsedOp.action === 'rmdir') {
                displayAction = 'deleted directory';
            } else if (parsedOp.action === 'create_multiple_directories') { // NEW
                displayAction = 'created multiple directories';
                displayPath = parsedOp.paths.join(', '); // For display purposes
            } else if (parsedOp.action === 'mvfile') {
                displayAction = `renamed/moved file from ${parsedOp.old_path} to`;
                displayPath = parsedOp.new_path;
            } else if (parsedOp.action === 'mvdir') {
                displayAction = `renamed/moved directory from ${parsedOp.old_path} to`;
                displayPath = parsedOp.new_path;
            } else if (parsedOp.action === 'update_code_block') { // NEW
                displayAction = 'updated block';
            } else if (parsedOp.action === 'insert_code_markers') { // NEW
                displayAction = 'inserted markers';
            }

            const fileActionMsgObj = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                sender: 'ai',
                displayContent: '', // No direct text content for display for file ops
                contentForAI: `AI performed action "${parsedOp.action}" on "${displayPath}".`,
                type: 'ai-file-op',
                extraData: {
                    action: displayAction, // Use calculated display action
                    filename: displayPath, // Use calculated display path
                    size: parsedOp.content ? getSizeString(parsedOp.content) : null, // Only for file content
                    success: success, // Indicate if operation was successful
                    old_path: parsedOp.old_path, // For mvfile/mvdir display
                    new_path: parsedOp.new_path, // For mvfile/mvdir display
                    logicName: logicNameForDisplay, // NEW: For block ops display
                    paths: parsedOp.paths, // For multiple file ops
                },
                isHtml: false,
                timestamp: new Date().toISOString(),
            };
            currentChatHistory.push(fileActionMsgObj);
            displayMessage(fileActionMsgObj);
            await saveChatHistory(); // Save immediately after displaying AI file op message
        } else if (segment.type === 'github-action') {
            const parsedOp = segment.parsedOp;
            // Workflow logs, runs, artifact links, and list repos are handled specially for display
            if (['github_get_workflow_logs', 'github_get_latest_workflow_logs', 'github_get_workflow_runs', 'github_get_artifact_download_links', 'github_list_repos'].includes(parsedOp.action)) {
                // These actions have their display handled directly within their respective functions
                // and add separate chat bubbles, and save.
                await performFileOperation(parsedOp, false);
                // No further save needed here as it's handled internally by those functions.
                return;
            }

            const success = await performFileOperation(parsedOp, false); // AI initiated, but this is a GitHub op
            const repoUrl = localStorage.getItem(GITHUB_REPO_URL_KEY);
            const { owner, repo } = parseGithubRepoUrl(repoUrl);
            const configuredBranch = localStorage.getItem(GITHUB_BRANCH_KEY);
            const targetBranch = parsedOp.branch || configuredBranch;

            let displayActionText;
            let extraOpDetails = {};

            switch (parsedOp.action) {
                case 'github_push':
                    displayActionText = 'Pushed';
                    extraOpDetails = { message: parsedOp.message || null, changesCount: window._lastPushChangesCount || null };
                    window._lastPushChangesCount = 0; // Reset
                    break;
                case 'github_pull':
                    displayActionText = 'Pulled';
                    extraOpDetails = { changesCount: window._lastPullChangesCount || null };
                    window._lastPullChangesCount = 0; // Reset
                    break;
                case 'github_create_file':
                    displayActionText = 'Created File';
                    extraOpDetails = { path: parsedOp.path, message: parsedOp.message || null };
                    break;
                case 'github_update_file':
                    displayActionText = 'Updated File';
                    extraOpDetails = { path: parsedOp.path, message: parsedOp.message || null };
                    break;
                case 'github_delete_file':
                    displayActionText = 'Deleted File';
                    extraOpDetails = { path: parsedOp.path, message: parsedOp.message || null };
                    break;
                case 'github_create_branch':
                    displayActionText = 'Created Branch';
                    extraOpDetails = { new_branch_name: parsedOp.new_branch_name, base_branch: parsedOp.base_branch || configuredBranch };
                    break;
                case 'github_delete_branch':
                    displayActionText = 'Deleted Branch';
                    extraOpDetails = { branch_name: parsedOp.branch_name };
                    break;
                case 'github_create_pull_request':
                    displayActionText = 'Created Pull Request';
                    extraOpDetails = { title: parsedOp.title, head: parsedOp.head, base: parsedOp.base, body: parsedOp.body || null };
                    break;
                case 'github_trigger_workflow':
                    displayActionText = 'Triggered Workflow';
                    extraOpDetails = { workflow_id: parsedOp.workflow_id, inputs: parsedOp.inputs || null };
                    break;
                case 'github_create_repo':
                    displayActionText = 'Created Repository';
                    extraOpDetails = { repo_name: parsedOp.repo_name, private: parsedOp.private || false, org_name: parsedOp.org_name || null };
                    break;
                case 'github_delete_repo':
                    displayActionText = 'Deleted Repository';
                    extraOpDetails = { repo_name: parsedOp.repo_name };
                    break;
                case 'github_set_secret':
                    displayActionText = 'Set Secret';
                    // We don't store the secret_value in extraData for display
                    extraOpDetails = { secret_name: parsedOp.secret_name, repo_owner: owner, repo_name: parsedOp.repo_name || repo };
                    break;
                default:
                    displayActionText = `Performed GitHub action: ${parsedOp.action}`;
            }

            const githubOpMsgObj = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                sender: 'ai',
                displayContent: '',
                contentForAI: `AI requested GitHub ${parsedOp.action}.`,
                type: 'github-op-display',
                extraData: {
                    action: displayActionText,
                    repo: parsedOp.repo_name || repo, // Use specified repo_name if present, otherwise current
                    branch: targetBranch, // The target branch for file ops, or configured for push/pull
                    success: success,
                    ...extraOpDetails
                },
                isHtml: false,
                timestamp: new Date().toISOString(),
            };
            currentChatHistory.push(githubOpMsgObj);
            displayMessage(githubOpMsgObj);
            await saveChatHistory(); // Save immediately after displaying AI GitHub op message
        }
        // NEW DOCUMENT CREATION ACTION HANDLING
        else if (segment.type === 'document-creation') {
            const parsedOp = segment.parsedOp;
            const success = await performFileOperation(parsedOp, false); // AI initiated

            // Handle display and download link
            if (success && parsedOp._downloadUrl) { // _downloadUrl will be added by the handler functions
                const downloadLink = `<a href="${parsedOp._downloadUrl}" download="${parsedOp.filename}" target="_blank" class="document-download-link"><i class="fas fa-download"></i> Download ${parsedOp.filename}</a>`;
                const docCreationMsgObj = {
                    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                    sender: 'ai',
                    displayContent: renderMarkdown(`**${parsedOp.action.replace('create_', '').toUpperCase()} Document Created:** ${parsedOp.filename}\n\n${downloadLink}`),
                    contentForAI: `AI successfully created ${parsedOp.filename} (Action: ${parsedOp.action}).`,
                    type: 'document-creation-success',
                    extraData: {
                        action: parsedOp.action,
                        filename: parsedOp.filename,
                        downloadUrl: parsedOp._downloadUrl,
                        success: true,
                    },
                    isHtml: true,
                    timestamp: new Date().toISOString(),
                };
                currentChatHistory.push(docCreationMsgObj);
                displayMessage(docCreationMsgObj);
                await saveChatHistory();
            } else {
                // If performFileOperation returns false, an error message would have already been generated and displayed
                // within performFileOperation itself. We just log here for good measure.
                console.error(`Failed to create document (performFileOperation returned false): ${parsedOp.filename} (Action: ${parsedOp.action})`);
            }
        }
        else if (segment.type === 'file-action-error') { // This type now handles general AI operation JSON errors
            const errorMsgObj = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                sender: 'ai',
                displayContent: `AI attempted an operation but the JSON was invalid or corrupted:\n\n**Error:** ${escapeHtml(segment.errorMessage)}\n\n**Raw Output:**\n\`\`\`\n${escapeHtml(segment.rawContent)}\n\`\`\``,
                contentForAI: `AI generated invalid operation JSON: ${segment.errorMessage}. Raw: ${segment.rawContent}`,
                type: 'ai-file-op-error', // Reusing this type, implies a JSON parsing error
                extraData: {
                    filename: 'JSON Error',
                    action: 'Failed',
                },
                isHtml: true,
                timestamp: new Date().toISOString(),
            };
            currentChatHistory.push(errorMsgObj);
            displayMessage(errorMsgObj);
            showStatus('AI generated invalid operation JSON.', 'error', 5000);
            await saveChatHistory(); // Save immediately after displaying AI JSON error message
            // NEW: JMIL Feedback on JSON parsing error
            await addJmilFeedbackToHistory(segment.parsedOp || {action: 'JSON_Parse_Error'}, false, `Invalid or malformed JSON operation from AI: ${segment.errorMessage}`, 'JMIL_Parsing');
        }
    }
    // Trigger speech for the AI's response if an audio segment was found
    if (speechContentToPlay) {
        speakText(speechContentToPlay, 'user_response'); // Mark as user_response type
    }
}


function buildFileTree(filesData) {
    const root = { name: '', type: 'folder', children: [], path: '' };
    const folders = new Set(); // To keep track of all implied and explicit folders

    // First, process all files and implied directories
    Object.keys(filesData).sort().forEach(fullPath => {
        if (fullPath === CONVERSATION_FILENAME || filesData[fullPath] === DIRECTORY_MARKER) {
            return;
        }
        const parts = fullPath.split('/');
        let currentNode = root;
        let currentPathAccumulator = '';

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            currentPathAccumulator += (i > 0 ? '/' : '') + part;

            if (i === parts.length - 1) { // It's a file
                currentNode.children.push({
                    name: part,
                    type: 'file',
                    path: fullPath
                });
            } else { // It's a directory part
                let folderPath = currentPathAccumulator + '/'; // Ensure folder path ends with slash
                folders.add(folderPath); // Mark this path as an existing folder

                let folderNode = currentNode.children.find(
                    child => child.name === part && child.type === 'folder'
                );

                if (!folderNode) {
                    folderNode = { name: part, type: 'folder', children: [], path: folderPath };
                    currentNode.children.push(folderNode);
                }
                currentNode = folderNode;
            }
        }
    });

    // Now, add explicitly created empty directories (DIRECTORY_MARKER)
    Object.keys(filesData).forEach(fullPath => {
        if (filesData[fullPath] === DIRECTORY_MARKER) {
            const dirPath = fullPath; // This path already ends with '/'
            if (!folders.has(dirPath)) { // Add only if not already implied by existing files
                const parts = dirPath.split('/').filter(p => p); // Remove trailing empty string from split
                if (parts.length === 0) return; // Root directory case, ignore

                let currentNode = root;
                let currentPathAccumulator = '';

                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i];
                    currentPathAccumulator += (i > 0 ? '/' : '') + part;
                    let folderPath = currentPathAccumulator + '/';

                    let folderNode = currentNode.children.find(
                        child => child.name === part && child.type === 'folder'
                    );

                    if (!folderNode) {
                        folderNode = { name: part, type: 'folder', children: [], path: folderPath };
                        currentNode.children.push(folderNode);
                    }
                    currentNode = folderNode;
                }
            }
        }
    });

    // Recursive sort function
    function sortChildren(node) {
        if (!node.children) {
            return;
        }
        node.children.forEach(sortChildren);
        node.children.sort((a, b) => {
            // Folders first, then files
            if (a.type === 'folder' && b.type === 'file') {
                return -1;
            }
            if (a.type === 'file' && b.type === 'folder') {
                return 1;
            }
            // Then alphabetical by name
            return a.name.localeCompare(b.name);
        });
    }

    sortChildren(root);
    return root.children;
}

function renderTreeNodes(nodes, parentUl) {
    nodes.forEach(node => {
        const li = document.createElement('li');

        const contentWrapper = document.createElement('div');
        contentWrapper.classList.add('content-wrapper');

        const nameSpan = document.createElement('span');
        nameSpan.textContent = node.name;

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

            const nestedUl = document.createElement('ul');
            nestedUl.classList.add('nested-file-list');

            if (expandedFolders.has(node.path)) {
                li.classList.add('open');
                toggleIcon.classList.add('fa-caret-down');
                toggleIcon.classList.remove('fa-caret-right');
                nestedUl.style.display = 'block';
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
                    expandedFolders.add(node.path);
                } else {
                    toggleIcon.classList.remove('fa-caret-down');
                    toggleIcon.classList.add('fa-caret-right');
                    nestedUl.style.display = 'none';
                    expandedFolders.delete(node.path);
                }
            });

            li.appendChild(contentWrapper);

            if (node.children && node.children.length > 0) {
                renderTreeNodes(node.children, nestedUl);
            } else {
                const emptyMsg = document.createElement('li');
                const emptyMsgContent = document.createElement('div');
                emptyMsgContent.classList.add('content-wrapper');
                const emptyText = document.createElement('span');
                emptyText.textContent = 'Empty folder';
                emptyMsgContent.appendChild(emptyText);
                emptyMsg.appendChild(emptyMsgContent);

                emptyMsg.style.color = 'var(--text-secondary)';
                emptyMsg.style.fontStyle = 'italic';
                nestedUl.appendChild(emptyMsg);
            }
            li.appendChild(nestedUl);

        } else {
            li.classList.add('file-item');

            const fileTypeIcon = document.createElement('i');
            fileTypeIcon.classList.add('file-type-icon');
            fileTypeIcon.className += ' ' + getFileIconClass(node.name);

            const iconPlaceholder = document.createElement('span');
            iconPlaceholder.classList.add('toggle-icon');

            contentWrapper.appendChild(iconPlaceholder);
            contentWrapper.appendChild(fileTypeIcon);
            nameSpan.classList.add('file-name');
            contentWrapper.appendChild(nameSpan);

            li.dataset.filename = node.path;

            li.addEventListener('click', e => {
                e.stopPropagation();
                handleFileReferenceClick(node.path);
            });
            li.appendChild(contentWrapper);
        }
        parentUl.appendChild(li);
    });
}

async function loadProjectFilesForReference() {
    fileListReference.innerHTML = '<li><div class="content-wrapper"><span><i class="fas fa-sync fa-spin"></i> Loading files...</span></div></li>';
    try {
        renderFileReferenceList();
    } catch (error) {
        console.error('Error loading project files for reference:', error);
        fileListReference.innerHTML = '<li><div class="content-wrapper"><span style="color: var(--error-color);">Failed to load files.</span></div></li>';
        showStatus('Failed to load project files: ' + error.message, 'error');
    }
}

function renderFileReferenceList() {
    fileListReference.innerHTML = '';
    const fileTree = buildFileTree(projectFilesData);

    if (fileTree.length === 0) {
        fileListReference.innerHTML = '<li><div class="content-wrapper"><span style="color: var(--text-secondary); font-style: italic;">No files in project.</span></div></li>';
        return;
    }
    renderTreeNodes(fileTree, fileListReference);
}

function handleFileReferenceClick(filename) {
    const fileContent = projectFilesData[filename];
    if (fileContent !== undefined && fileContent !== DIRECTORY_MARKER) {
        const currentMessage = messageInput.value.trim();
        let newPrompt = currentMessage;
        // Add x@filename if it's not already there, or ensure it's added properly
        if (!newPrompt.includes(`x@${filename}`)) {
            newPrompt = `x@${filename} ` + newPrompt;
        }
        messageInput.value = newPrompt.trim();
        messageInput.focus();
        showStatus(`File "${filename}" referenced in input.`, 'info', 2000);
    } else {
        showStatus('Could not find content for file or it is a directory: ' + filename, 'error');
    }
    closeDrawer('file');
}

function toggleDrawer(drawerType) {
    if (drawerType === 'file') {
        fileReferenceDrawer.classList.toggle('open');
        settingsDrawer.classList.remove('open');
    } else if (drawerType === 'settings') {
        settingsDrawer.classList.toggle('open');
        fileReferenceDrawer.classList.remove('open');
        if (settingsDrawer.classList.contains('open')) {
            loadSettings();
        }
    }
    settingsOverlay.classList.toggle('visible', fileReferenceDrawer.classList.contains('open') || settingsDrawer.classList.contains('open'));

    if (fileReferenceDrawer.classList.contains('open')) {
        loadProjectFilesForReference();
    }
}

function closeDrawer(drawerType) {
    if (drawerType === 'file' || drawerType === 'all') {
        fileReferenceDrawer.classList.remove('open');
    }
    if (drawerType === 'settings' || drawerType === 'all') {
        settingsDrawer.classList.remove('open');
    }
    settingsOverlay.classList.remove('visible');
}

function toggleFileOperations() {
    fileOperationsEnabled = !fileOperationsEnabled;
    localStorage.setItem(FILE_OPS_ENABLED_KEY, fileOperationsEnabled);
    updateFileOpsButton();
    showStatus(`AI file operations ${fileOperationsEnabled ? 'enabled' : 'disabled'}.`, 'info', 2000);
}

function updateFileOpsButton() {
    if (fileOperationsEnabled) {
        toggleFileOpsButton.innerHTML = '<i class="fas fa-toggle-on"></i>';
        toggleFileOpsButton.style.color = 'var(--info-color)';
    } else {
        toggleFileOpsButton.innerHTML = '<i class="fas fa-toggle-off"></i>';
        toggleFileOpsButton.style.color = 'var(--text-secondary)';
    }
}

function loadSettings() {
    currentAIModel = localStorage.getItem(AI_MODEL_STORAGE_KEY) || 'gemini';
    aiModelSelect.value = currentAIModel;
    updateApiSettingsVisibility();

    geminiApiKeyInput.value = localStorage.getItem(GEMINI_API_KEY_STORAGE) || defaultGeminiApiKey;
    geminiEndpointInput.value = localStorage.getItem(GEMINI_API_ENDPOINT_KEY) || defaultGeminiEndpoint;
    grokApiKeyInput.value = localStorage.getItem(GROK_API_KEY_STORAGE) || '';
    grokEndpointInput.value = localStorage.getItem(GROK_API_ENDPOINT_KEY) || defaultGrokEndpoint;
    deepseekApiKeyInput.value = localStorage.getItem(DEEPSEEK_API_KEY_STORAGE) || '';
    deepseekEndpointInput.value = localStorage.getItem(DEEPSEEK_API_ENDPOINT_KEY) || defaultDeepseekEndpoint;
    claudeApiKeyInput.value = localStorage.getItem(CLAUDE_API_KEY_STORAGE) || '';
    claudeEndpointInput.value = localStorage.getItem(CLAUDE_API_ENDPOINT_KEY) || defaultClaudeEndpoint;
    claudeModelNameInput.value = localStorage.getItem(CLAUDE_MODEL_NAME_KEY) || defaultClaudeModel;
    llamaApiKeyInput.value = localStorage.getItem(LLAMA_API_KEY_STORAGE) || '';
    llamaEndpointInput.value = localStorage.getItem(LLAMA_API_ENDPOINT_KEY) || defaultLlamaEndpoint;
    llamaModelNameInput.value = localStorage.getItem(LLAMA_MODEL_NAME_KEY) || defaultLlamaModel;
    mistralApiKeyInput.value = localStorage.getItem(MISTRAL_API_KEY_STORAGE) || '';
    mistralEndpointInput.value = localStorage.getItem(MISTRAL_API_ENDPOINT_KEY) || defaultMistralEndpoint;
    mistralModelNameInput.value = localStorage.getItem(MISTRAL_MODEL_NAME_KEY) || defaultMistralModel;

    githubRepoUrlInput.value = localStorage.getItem(GITHUB_REPO_URL_KEY) || '';
    githubBranchInput.value = localStorage.getItem(GITHUB_BRANCH_KEY) || 'main';
    githubPatInput.value = localStorage.getItem(GITHUB_PAT_KEY) || '';

    markdownInstructionInput.value = localStorage.getItem(CUSTOM_MARKDOWN_INSTRUCTION_KEY) || '';
}

function updateApiSettingsVisibility() {
    geminiSettings.style.display = 'none';
    grokSettings.style.display = 'none';
    deepseekSettings.style.display = 'none';
    claudeSettings.style.display = 'none';
    llamaSettings.style.display = 'none';
    mistralSettings.style.display = 'none';

    if (aiModelSelect.value === 'gemini') {
        geminiSettings.style.display = 'block';
    } else if (aiModelSelect.value === 'grok') {
        grokSettings.style.display = 'block';
    } else if (aiModelSelect.value === 'deepseek') {
        deepseekSettings.style.display = 'block';
    } else if (aiModelSelect.value === 'claude') {
        claudeSettings.style.display = 'block';
    } else if (aiModelSelect.value === 'llama') {
        llamaSettings.style.display = 'block';
    } else if (aiModelSelect.value === 'mistral') {
        mistralSettings.style.display = 'block';
    }
}

function saveSettings() {
    currentAIModel = aiModelSelect.value;
    localStorage.setItem(AI_MODEL_STORAGE_KEY, currentAIModel);

    localStorage.setItem(GEMINI_API_KEY_STORAGE, geminiApiKeyInput.value.trim());
    localStorage.setItem(GEMINI_API_ENDPOINT_KEY, geminiEndpointInput.value.trim());
    localStorage.setItem(GROK_API_KEY_STORAGE, grokApiKeyInput.value.trim());
    localStorage.setItem(GROK_API_ENDPOINT_KEY, grokEndpointInput.value.trim());
    localStorage.setItem(DEEPSEEK_API_KEY_STORAGE, deepseekApiKeyInput.value.trim());
    localStorage.setItem(DEEPSEEK_API_ENDPOINT_KEY, deepseekEndpointInput.value.trim());
    localStorage.setItem(CLAUDE_API_KEY_STORAGE, claudeApiKeyInput.value.trim());
    localStorage.setItem(CLAUDE_API_ENDPOINT_KEY, claudeEndpointInput.value.trim());
    localStorage.setItem(CLAUDE_MODEL_NAME_KEY, claudeModelNameInput.value.trim());
    localStorage.setItem(LLAMA_API_KEY_STORAGE, llamaApiKeyInput.value.trim());
    localStorage.setItem(LLAMA_API_ENDPOINT_KEY, llamaEndpointInput.value.trim());
    localStorage.setItem(LLAMA_MODEL_NAME_KEY, llamaModelNameInput.value.trim());
    localStorage.setItem(MISTRAL_API_KEY_STORAGE, mistralApiKeyInput.value.trim());
    localStorage.setItem(MISTRAL_API_ENDPOINT_KEY, mistralEndpointInput.value.trim());
    localStorage.setItem(MISTRAL_MODEL_NAME_KEY, mistralModelNameInput.value.trim());

    localStorage.setItem(GITHUB_REPO_URL_KEY, githubRepoUrlInput.value.trim());
    localStorage.setItem(GITHUB_BRANCH_KEY, githubBranchInput.value.trim());
    localStorage.setItem(GITHUB_PAT_KEY, githubPatInput.value.trim());

    localStorage.setItem(CUSTOM_MARKDOWN_INSTRUCTION_KEY, markdownInstructionInput.value.trim());

    updateActiveApiConfig();

    showStatus('Settings saved successfully.', 'success', 2000);
    closeDrawer('settings');
}

function updateActiveApiConfig() {
    currentAIModel = localStorage.getItem(AI_MODEL_STORAGE_KEY) || 'gemini';
    switch (currentAIModel) {
        case 'gemini':
            currentApiKey = localStorage.getItem(GEMINI_API_KEY_STORAGE) || defaultGeminiApiKey;
            currentApiEndpoint = localStorage.getItem(GEMINI_API_ENDPOINT_KEY) || defaultGeminiEndpoint;
            currentApiModelName = ''; // Not typically used for Gemini direct API calls this way
            break;
        case 'grok':
            currentApiKey = localStorage.getItem(GROK_API_KEY_STORAGE) || '';
            currentApiEndpoint = localStorage.getItem(GROK_API_ENDPOINT_KEY) || defaultGrokEndpoint;
            currentApiModelName = 'grok-1'; // Example model name
            break;
        case 'deepseek':
            currentApiKey = localStorage.getItem(DEEPSEEK_API_KEY_STORAGE) || '';
            currentApiEndpoint = localStorage.getItem(DEEPSEEK_API_ENDPOINT_KEY) || defaultDeepseekEndpoint;
            currentApiModelName = 'deepseek-coder'; // Example model name
            break;
        case 'claude':
            currentApiKey = localStorage.getItem(CLAUDE_API_KEY_STORAGE) || '';
            currentApiEndpoint = localStorage.getItem(CLAUDE_API_ENDPOINT_KEY) || defaultClaudeEndpoint;
            currentApiModelName = localStorage.getItem(CLAUDE_MODEL_NAME_KEY) || defaultClaudeModel;
            break;
        case 'llama':
            currentApiKey = localStorage.getItem(LLAMA_API_KEY_STORAGE) || '';
            currentApiEndpoint = localStorage.getItem(LLAMA_API_ENDPOINT_KEY) || defaultLlamaEndpoint;
            currentApiModelName = localStorage.getItem(LLAMA_MODEL_NAME_KEY) || defaultLlamaModel;
            break;
        case 'mistral':
            currentApiKey = localStorage.getItem(MISTRAL_API_KEY_STORAGE) || '';
            currentApiEndpoint = localStorage.getItem(MISTRAL_API_ENDPOINT_KEY) || defaultMistralEndpoint;
            currentApiModelName = localStorage.getItem(MISTRAL_MODEL_NAME_KEY) || defaultMistralModel;
            break;
        default:
            currentApiKey = defaultGeminiApiKey;
            currentApiEndpoint = defaultGeminiEndpoint;
            currentAIModel = 'gemini';
            currentApiModelName = '';
    }
}

// --- GitHub Integration Functions (using Fetch API) ---

// Helper function to get standardized GitHub API headers
function getGitHubAuthHeaders() {
    const pat = localStorage.getItem(GITHUB_PAT_KEY);
    if (!pat) {
        throw new Error("GitHub Personal Access Token is missing. Please configure it in settings. Ensure your PAT has 'repo' scope for most operations and 'workflow' scope for GitHub Actions interactions.");
    }
    return {
        'Accept': 'application/vnd.github.v3+json', // Recommended GitHub API header
        'Authorization': `Bearer ${pat}`,
        'Content-Type': 'application/json'
    };
}

function parseGithubRepoUrl(url) {
    try {
        const urlObj = new URL(url);
        const parts = urlObj.pathname.split('/').filter(p => p);
        if (urlObj.hostname === 'github.com' && parts.length >= 2) {
            return { owner: parts[0], repo: parts[1] };
        }
    } catch (e) { /* Invalid URL */ }
    return { owner: null, repo: null };
}

// Helper to convert UTF-8 string to Base64 (safe for btoa)
function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

// Helper to convert Base64 to UTF-8 string
function base64ToUtf8(str) {
    return decodeURIComponent(escape(atob(str)));
}

// Helper to get file SHA from GitHub (needed for updates/deletes)
async function getFileSha(owner, repo, path, branch) {
    const headers = getGitHubAuthHeaders();
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
        // If file not found, it's not necessarily an error, just means it doesn't exist.
        if (response.status === 404) return null;
        const errorBody = await response.text(); // Logs can be plain text, so try text first
        let errorData = errorBody;
        try { errorData = JSON.parse(errorBody); } catch (e) {} // Attempt to parse as JSON if possible
        throw new Error(`Failed to get file SHA for ${path} on branch ${branch} (${response.status} ${response.statusText}): ${errorData.message || errorData}`);
    }
    const data = await response.json();
    return data.sha;
}

/**
 * Resolves a workflow ID from a filename or returns the ID if already numeric.
 * @param {string|number} workflow_id_or_filename The workflow ID or filename.
 * @param {string} owner GitHub repository owner.
 * @param {string} repo GitHub repository name.
 * @returns {Promise<number>} The numeric workflow ID.
 * @throws {Error} If the workflow cannot be found or API fails.
 */
async function resolveWorkflowId(workflow_id_or_filename, owner, repo) {
    if (typeof workflow_id_or_filename === 'number') {
        return workflow_id_or_filename; // Already an ID
    }

    // Assume it's a filename, try to resolve it to an ID
    const headers = getGitHubAuthHeaders();
    const workflowsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows`;
    
    const workflowsResponse = await fetch(workflowsUrl, { headers });
    if (!workflowsResponse.ok) {
        const errorBody = await workflowsResponse.text();
        let errorData = errorBody;
        try { errorData = JSON.parse(errorBody); } catch (e) {}
        throw new Error(`Failed to fetch workflows to resolve ID for '${workflow_id_or_filename}' (${workflowsResponse.status} ${workflowsResponse.statusText}): ${errorData.message || errorData}`);
    }
    const workflowsData = await workflowsResponse.json();

    const workflow = workflowsData.workflows.find(w => w.path === `.github/workflows/${workflow_id_or_filename}`);
    if (!workflow) {
        throw new Error(`Workflow file '${workflow_id_or_filename}' not found.`);
    }
    return workflow.id;
}


let _lastPushChangesCount = 0; // Global to pass changes count to display message

async function pushChangesToGitHub(commitMessage = `Gen1 AI Assist: Manual push on ${new Date().toLocaleString()}`) {
    const repoUrl = localStorage.getItem(GITHUB_REPO_URL_KEY);
    const branch = localStorage.getItem(GITHUB_BRANCH_KEY);

    if (!repoUrl || !branch) {
        showStatus('GitHub settings are incomplete. Please configure repository URL and branch.', 'error', 5000);
        return false;
    }

    const { owner, repo } = parseGithubRepoUrl(repoUrl);
    if (!owner || !repo) {
        showStatus('Invalid GitHub Repository URL. Please use format like https://github.com/username/repo', 'error', 5000);
        return false;
    }

    showStatus('Pushing changes to GitHub...', 'info', 0);
    _lastPushChangesCount = 0; // Reset counter

    try {
        const headers = getGitHubAuthHeaders();

        // 1. Get the latest commit SHA on the target branch
        const refResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, { headers });
        if (!refResponse.ok) {
            const errorBody = await refResponse.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            throw new Error(`Failed to get ref (${refResponse.status} ${refResponse.statusText}): ${errorData.message || errorData}`);
        }
        const refData = await refResponse.json();
        const latestCommitSha = refData.object.sha;

        // 2. Get the tree SHA associated with the latest commit
        const commitResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${latestCommitSha}`, { headers });
        if (!commitResponse.ok) {
            const errorBody = await commitResponse.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            throw new Error(`Failed to get commit (${commitResponse.status} ${commitResponse.statusText}): ${errorData.message || errorData}`);
        }
        const commitData = await commitResponse.json();
        const baseTreeSha = commitData.tree.sha;

        // 3. Get the *current* full remote tree to compare with local state
        const remoteTreeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${baseTreeSha}?recursive=1`, { headers });
        if (!remoteTreeResponse.ok) {
            const errorBody = await remoteTreeResponse.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            throw new Error(`Failed to get remote tree (${remoteTreeResponse.status} ${remoteTreeResponse.statusText}): ${errorData.message || errorData}`);
        }
        const remoteTreeData = await remoteTreeResponse.json();
        const remoteFiles = new Map(); // path -> { sha, type }
        if (remoteTreeData.tree) {
            remoteTreeData.tree.forEach(item => {
                // Only consider blobs (files) for content comparison.
                // Directories are implicit or represented by DIRECTORY_MARKER locally.
                if (item.type === 'blob') {
                    remoteFiles.set(item.path, { sha: item.sha });
                }
            });
        }

        const treeEntries = [];
        const filesToFetchContentForComparison = [];

        // Identify local changes vs. remote
        for (const filePath in projectFilesData) {
            if (filePath === CONVERSATION_FILENAME) continue;
            if (projectFilesData[filePath] === DIRECTORY_MARKER) continue; // Skip explicit directory markers

            const localContent = projectFilesData[filePath];
            const remoteFile = remoteFiles.get(filePath);

            if (remoteFile) {
                // File exists remotely, check if content has changed.
                // We need to fetch remote content by SHA to compare.
                filesToFetchContentForComparison.push({ filePath, localContent, remoteSha: remoteFile.sha });
            } else {
                // New file locally, doesn't exist remotely.
                // Create a blob and add to tree.
                const contentBase64 = utf8ToBase64(localContent);
                const blobResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        content: contentBase64,
                        encoding: 'base64'
                    })
                });
                if (!blobResponse.ok) {
                    const errorBody = await blobResponse.text();
                    let errorData = errorBody;
                    try { errorData = JSON.parse(errorBody); } catch (e) {}
                    throw new Error(`Failed to create blob for new file ${filePath} (${blobResponse.status} ${blobResponse.statusText}): ${errorData.message || errorData}`);
                }
                const blobData = await blobResponse.json();
                treeEntries.push({
                    path: filePath,
                    mode: '100644', // File mode for normal file
                    type: 'blob',
                    sha: blobData.sha
                });
                _lastPushChangesCount++;
            }
        }

        // Fetch remote content for comparison for existing files
        for (const { filePath, localContent, remoteSha } of filesToFetchContentForComparison) {
            const remoteBlobResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs/${remoteSha}`, { headers });
            if (!remoteBlobResponse.ok) {
                const errorBody = await remoteBlobResponse.text();
                let errorData = errorBody;
                try { errorData = JSON.parse(errorBody); } catch (e) {}
                throw new Error(`Failed to get remote blob content for ${filePath} (${remoteBlobResponse.status} ${remoteBlobResponse.statusText}): ${errorData.message || errorData}`);
            }
            const remoteBlobData = await remoteBlobResponse.json();
            const remoteContent = remoteBlobData.encoding === 'base64' ? base64ToUtf8(remoteBlobData.content) : remoteBlobData.content;

            if (localContent !== remoteContent) {
                // Content has changed locally, create a new blob and update tree entry.
                const contentBase64 = utf8ToBase64(localContent);
                const blobResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        content: contentBase64,
                        encoding: 'base64'
                    })
                });
                if (!blobResponse.ok) {
                    const errorBody = await blobResponse.text();
                    let errorData = errorBody;
                    try { errorData = JSON.parse(errorBody); } catch (e) {}
                    throw new Error(`Failed to create blob for updated file ${filePath} (${blobResponse.status} ${blobResponse.statusText}): ${errorData.message || errorData}`);
                }
                const blobData = await blobResponse.json();
                treeEntries.push({
                    path: filePath,
                    mode: '100644', // File mode for normal file
                    type: 'blob',
                    sha: blobData.sha
                });
                _lastPushChangesCount++;
            } else {
                // Content is identical, re-add existing blob SHA to new tree to preserve it.
                treeEntries.push({
                    path: filePath,
                    mode: '100644',
                    type: 'blob',
                    sha: remoteSha
                });
            }
        }

        // Identify files deleted locally but present remotely
        for (const [remotePath, remoteFile] of remoteFiles.entries()) {
            if (projectFilesData[remotePath] === undefined || projectFilesData[remotePath] === DIRECTORY_MARKER) {
                // File exists remotely but not locally (or is an empty directory marker now). Mark for deletion by setting SHA to null.
                treeEntries.push({
                    path: remotePath,
                    mode: '100644', // Must keep mode
                    type: 'blob',
                    sha: null // This indicates deletion
                });
                _lastPushChangesCount++;
            }
        }


        // If no changes, no need to push
        if (_lastPushChangesCount === 0) {
            showStatus('No local changes to push.', 'info', 3000);
            return true;
        }

        // 4. Create a new tree
        const newTreeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                base_tree: baseTreeSha,
                tree: treeEntries
            })
        });
        if (!newTreeResponse.ok) {
            const errorBody = await newTreeResponse.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            throw new Error(`Failed to create new tree (${newTreeResponse.status} ${newTreeResponse.statusText}): ${errorData.message || errorData}`);
        }
        const newTreeData = await newTreeResponse.json();
        const newTreeSha = newTreeData.sha;

        // 5. Create a new commit
        const newCommitResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                message: commitMessage,
                tree: newTreeSha,
                parents: [latestCommitSha]
            })
        });
        if (!newCommitResponse.ok) {
            const errorBody = await newCommitResponse.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            throw new Error(`Failed to create new commit (${newCommitResponse.status} ${newCommitResponse.statusText}): ${errorData.message || errorData}`);
        }
        const newCommitData = await newCommitResponse.json();
        const newCommitSha = newCommitData.sha;

        // 6. Update the branch reference
        const updateRefResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
                sha: newCommitSha,
                force: false // Set to true to force push, but use with extreme caution!
            })
        });
        if (!updateRefResponse.ok) {
            const errorBody = await updateRefResponse.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            throw new Error(`Failed to update branch reference (${updateRefResponse.status} ${updateRefResponse.statusText}): ${errorData.message || errorData}`);
        }

        showStatus(`Changes pushed to GitHub successfully! (${_lastPushChangesCount} changes)`, 'success', 3000);
        return true;

    } catch (error) {
        console.error('GitHub Push Error:', error);
        let errorMessage = error.message;
        if (errorMessage.includes('401') || errorMessage.includes('403')) {
            errorMessage = 'Authentication failed. Check your Personal Access Token and permissions.';
        } else if (errorMessage.includes("non-fast-forward")) { // Specific error for Git conflicts
             errorMessage = 'Push rejected: Remote branch has new commits. Please pull changes first to avoid overwriting.';
        }
        showStatus(`GitHub Push Failed: ${errorMessage}`, 'error', 8000);
        return false;
    }
}

let _lastPullChangesCount = 0; // Global to pass changes count to display message

async function pullChangesFromGitHub() {
    const repoUrl = localStorage.getItem(GITHUB_REPO_URL_KEY);
    const branch = localStorage.getItem(GITHUB_BRANCH_KEY);

    if (!repoUrl || !branch) {
        showStatus('GitHub settings are incomplete. Please configure repository URL and branch.', 'error', 5000);
        return false;
    }

    const { owner, repo } = parseGithubRepoUrl(repoUrl);
    if (!owner || !repo) {
        showStatus('Invalid GitHub Repository URL. Please use format like https://github.com/username/repo', 'error', 5000);
        return false;
    }

    showStatus('Pulling changes from GitHub...', 'info', 0);
    _lastPullChangesCount = 0; // Reset counter for this pull operation

    try {
        const headers = getGitHubAuthHeaders();

        // 1. Get the latest commit SHA from the branch
        const refResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, { headers });
        if (!refResponse.ok) {
            const errorBody = await refResponse.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            throw new Error(`Failed to get ref (${refResponse.status} ${refResponse.statusText}): ${errorData.message || errorData}`);
        }
        const refData = await refResponse.json();
        const latestCommitSha = refData.object.sha;

        const commitResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${latestCommitSha}`, { headers });
        if (!commitResponse.ok) {
            const errorBody = await commitResponse.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            throw new Error(`Failed to get commit (${commitResponse.status} ${commitResponse.statusText}): ${errorData.message || errorData}`);
        }
        const commitData = await commitResponse.json();
        const latestTreeSha = commitData.tree.sha;

        // 2. Get the full tree (recursive)
        const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${latestTreeSha}?recursive=1`, { headers });
        if (!treeResponse.ok) {
            const errorBody = await treeResponse.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            throw new Error(`Failed to get tree (${treeResponse.status} ${treeResponse.statusText}): ${errorData.message || errorData}`);
        }
        const treeData = await treeResponse.json();

        // Preserve local conversation history and prepare new project files data
        const newProjectFilesData = { [CONVERSATION_FILENAME]: projectFilesData[CONVERSATION_FILENAME] };
        const remotePaths = new Set(); // To track all paths (files and explicit directories) that exist remotely

        // Process files and explicit directories from GitHub tree
        for (const item of treeData.tree) {
            // Add file path (e.g., 'src/index.js')
            remotePaths.add(item.path);
            if (item.type === 'tree') {
                // Also add directory path with trailing slash (e.g., 'src/') for later comparison
                // GitHub tree API typically provides directory paths without trailing slashes, so add it here.
                remotePaths.add(item.path + '/');
            }

            if (item.path === CONVERSATION_FILENAME) continue;

            if (item.type === 'blob') { // It's a file
                // Fetch blob content
                const blobResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs/${item.sha}`, { headers });
                if (!blobResponse.ok) {
                    const errorBody = await blobResponse.text();
                    let errorData = errorBody;
                    try { errorData = JSON.parse(errorBody); } catch (e) {}
                    throw new Error(`Failed to get blob content for ${item.path} (${blobResponse.status} ${blobResponse.statusText}): ${errorData.message || errorData}`);
                }
                const blobData = await blobResponse.json();
                const content = blobData.encoding === 'base64' ? base64ToUtf8(blobData.content) : blobData.content;

                if (projectFilesData[item.path] !== content) {
                    newProjectFilesData[item.path] = content;
                    _lastPullChangesCount++;
                } else {
                    newProjectFilesData[item.path] = projectFilesData[item.path]; // Keep existing reference if content identical
                }

            } else if (item.type === 'tree') { // It's a directory
                const dirPath = item.path.endsWith('/') ? item.path : item.path + '/';
                // Add explicit directory marker only if it's truly an empty directory
                // (i.e., no files exist under this exact path in the *remote* tree)
                // We're checking if any 'blob' items start with this dirPath.
                const isDirEmptyInRemote = !treeData.tree.some(p => p.path.startsWith(dirPath) && p.path !== item.path && p.type === 'blob');

                if (isDirEmptyInRemote && newProjectFilesData[dirPath] === undefined) {
                    newProjectFilesData[dirPath] = DIRECTORY_MARKER;
                    // Count as a change if we're adding this marker and it wasn't there before
                    if (projectFilesData[dirPath] !== DIRECTORY_MARKER) {
                        _lastPullChangesCount++;
                    }
                } else if (newProjectFilesData[dirPath] === undefined && !isDirEmptyInRemote) {
                    // If directory is not empty in remote but no marker exists locally, it's implicitly defined.
                    // Do nothing here, as files inside it will define it.
                }
            }
        }

        // Identify files/directories that exist locally but not on GitHub (for deletion)
        for (const localPath in projectFilesData) {
            if (localPath === CONVERSATION_FILENAME) continue; // Always preserve local conversation history

            // Check if the local path is present in the set of remote paths (both files and explicit dirs).
            // This covers files and explicitly marked empty directories.
            if (!remotePaths.has(localPath)) {
                // If the localPath doesn't exist remotely (or is an implied folder that's now empty remotely)
                // and it's not explicitly marked as a directory in newProjectFilesData
                if (newProjectFilesData[localPath] !== undefined) { // Only delete if it was in the new (pre-filter) projectFilesData
                     delete newProjectFilesData[localPath];
                     _lastPullChangesCount++;
                }
            }
        }

        // Final cleanup for DIRECTORY_MARKERs: remove if a file now exists in that directory after pull
        // (This handles cases where a remote directory implicitly got files, making the local marker redundant)
        Object.keys(newProjectFilesData).forEach(p => {
            if (newProjectFilesData[p] === DIRECTORY_MARKER) {
                const dirPath = p; // This path ends with '/'
                // Check if any actual files now exist under this directory path
                const hasActualFiles = Object.keys(newProjectFilesData).some(file =>
                    file.startsWith(dirPath) && file !== dirPath && newProjectFilesData[file] !== DIRECTORY_MARKER
                );
                if (hasActualFiles) {
                    // Only count as a change if the marker was actually there and we are removing it.
                    if (projectFilesData[dirPath] === DIRECTORY_MARKER) {
                        _lastPullChangesCount++;
                    }
                    delete newProjectFilesData[dirPath];
                }
            }
        });


        projectFilesData = newProjectFilesData;
        await putItemInStore(FILES_STORE_NAME, {
            projectId: currentProjectId,
            files: projectFilesData
        });

        showStatus(`Pull complete! ${_lastPullChangesCount} file(s)/directory(s) updated/deleted.`, 'success', 3000);
        if (fileReferenceDrawer.classList.contains('open')) {
            loadProjectFilesForReference();
        }
        await loadChatHistory();
        return true;

    } catch (error) {
        console.error('GitHub Pull Error:', error);
        let errorMessage = error.message;
        if (errorMessage.includes('401') || errorMessage.includes('403')) {
            errorMessage = 'Authentication failed. Check your Personal Access Token and permissions.';
        }
        showStatus(`GitHub Pull Failed: ${errorMessage}`, 'error', 8000);
        return false;
    }
}

// --- NEW GITHUB FILE OPERATIONS ---
async function handleGitHubPutFile(path, content, message, branch_name) {
    const repoUrl = localStorage.getItem(GITHUB_REPO_URL_KEY);
    const configuredBranch = localStorage.getItem(GITHUB_BRANCH_KEY);
    const targetBranch = branch_name || configuredBranch;

    if (!repoUrl || !targetBranch) {
        showStatus('GitHub settings are incomplete. Please configure repository URL and branch.', 'error', 5000);
        return false;
    }
    const { owner, repo } = parseGithubRepoUrl(repoUrl);
    if (!owner || !repo) {
        showStatus('Invalid GitHub Repository URL. Please use format like https://github.com/username/repo', 'error', 5000);
        return false;
    }
    if (!path || content === undefined) {
        showStatus('File path and content are required for GitHub create/update file.', 'error', 5000);
        return false;
    }

    const headers = getGitHubAuthHeaders();
    const contentBase64 = utf8ToBase64(content);
    const commitMessage = message || `Gen1 AI Assist: ${content ? 'Update' : 'Create'} file ${path} on branch ${targetBranch}`;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    try {
        const fileSha = await getFileSha(owner, repo, path, targetBranch);
        const method = fileSha ? 'PUT' : 'PUT'; // PUT is used for both create and update

        const body = {
            message: commitMessage,
            content: contentBase64,
            branch: targetBranch,
        };
        if (fileSha) {
            body.sha = fileSha; // Required for updating an existing file
        }

        const response = await fetch(url, {
            method: method,
            headers: headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            throw new Error(errorData.message || `Failed to ${fileSha ? 'update' : 'create'} file (${response.status} ${response.statusText}): ${errorData}`);
        }

        const actionText = fileSha ? 'updated' : 'created';
        showStatus(`GitHub: File '${path}' successfully ${actionText} on branch '${targetBranch}'.`, 'success', 3000);

        // Optional: Update local projectFilesData to reflect remote change
        projectFilesData[path] = content;
        await putItemInStore(FILES_STORE_NAME, { projectId: currentProjectId, files: projectFilesData });

        return true;
    } catch (error) {
        console.error(`GitHub Create/Update File Error for ${path}:`, error);
        showStatus(`GitHub: Failed to ${path ? 'update' : 'create'} file '${path}': ${error.message}`, 'error', 8000);
        return false;
    }
}

async function handleGitHubDeleteFile(path, message, branch_name) {
    const repoUrl = localStorage.getItem(GITHUB_REPO_URL_KEY);
    const configuredBranch = localStorage.getItem(GITHUB_BRANCH_KEY);
    const targetBranch = branch_name || configuredBranch;

    if (!repoUrl || !targetBranch) {
        showStatus('GitHub settings are incomplete. Please configure repository URL and branch.', 'error', 5000);
        return false;
    }
    const { owner, repo } = parseGithubRepoUrl(repoUrl);
    if (!owner || !repo) {
        showStatus('Invalid GitHub Repository URL. Please use format like https://github.com/username/repo', 'error', 5000);
        return false;
    }
    if (!path) {
        showStatus('File path is required for GitHub delete file.', 'error', 5000);
        return false;
    }

    const headers = getGitHubAuthHeaders();
    const commitMessage = message || `Gen1 AI Assist: Delete file ${path} on branch ${targetBranch}`;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    try {
        const fileSha = await getFileSha(owner, repo, path, targetBranch);
        if (!fileSha) {
            showStatus(`GitHub: File '${path}' not found on branch '${targetBranch}'.`, 'info', 3000);
            return true; // Consider it successful if it doesn't exist
        }

        const body = {
            message: commitMessage,
            sha: fileSha,
            branch: targetBranch,
        };

        const response = await fetch(url, {
            method: 'DELETE',
            headers: headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            throw new Error(errorData.message || `Failed to delete file (${response.status} ${response.statusText}): ${errorData}`);
        }

        showStatus(`GitHub: File '${path}' successfully deleted from branch '${targetBranch}'.`, 'success', 3000);

        // Optional: Update local projectFilesData to reflect remote change
        delete projectFilesData[path];
        await putItemInStore(FILES_STORE_NAME, { projectId: currentProjectId, files: projectFilesData });

        return true;
    } catch (error) {
        console.error(`GitHub Delete File Error for ${path}:`, error);
        showStatus(`GitHub: Failed to delete file '${path}': ${error.message}`, 'error', 8000);
        return false;
    }
}

async function handleGitHubCreateBranch(newBranchName, baseBranchName) {
    const repoUrl = localStorage.getItem(GITHUB_REPO_URL_KEY);
    const configuredBranch = localStorage.getItem(GITHUB_BRANCH_KEY);
    const sourceBranch = baseBranchName || configuredBranch; // Branch to fork from

    if (!repoUrl || !newBranchName || !sourceBranch) {
        showStatus('GitHub settings are incomplete, or new branch name/base branch missing.', 'error', 5000);
        return false;
    }
    const { owner, repo } = parseGithubRepoUrl(repoUrl);
    if (!owner || !repo) {
        showStatus('Invalid GitHub Repository URL. Please use format like https://github.com/username/repo', 'error', 5000);
        return false;
    }

    const headers = getGitHubAuthHeaders();
    const url = `https://api.github.com/repos/${owner}/${repo}/git/refs`;

    try {
        // First, get the SHA of the base branch
        const baseRefResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${sourceBranch}`, { headers });
        if (!baseRefResponse.ok) {
            const errorBody = await baseRefResponse.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            if (baseRefResponse.status === 404) throw new Error(`Base branch '${sourceBranch}' not found.`);
            throw new Error(errorData.message || `Failed to get SHA for base branch (${baseRefResponse.status} ${baseRefResponse.statusText}): ${errorData}`);
        }
        const baseRefData = await baseRefResponse.json();
        const baseBranchSha = baseRefData.object.sha;

        const body = {
            ref: `refs/heads/${newBranchName}`,
            sha: baseBranchSha,
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            throw new Error(errorData.message || `Failed to create branch (${response.status} ${response.statusText}): ${errorData}`);
        }

        showStatus(`GitHub: Branch '${newBranchName}' successfully created from '${sourceBranch}'.`, 'success', 3000);
        return true;
    } catch (error) {
        console.error(`GitHub Create Branch Error for ${newBranchName}:`, error);
        showStatus(`GitHub: Failed to create branch '${newBranchName}': ${error.message}`, 'error', 8000);
        return false;
    }
}

async function handleGitHubDeleteBranch(branchToDelete) {
    const repoUrl = localStorage.getItem(GITHUB_REPO_URL_KEY);
    const configuredBranch = localStorage.getItem(GITHUB_BRANCH_KEY);

    if (!repoUrl || !branchToDelete) {
        showStatus('GitHub settings are incomplete, or branch name to delete is missing.', 'error', 5000);
        return false;
    }
    const { owner, repo } = parseGithubRepoUrl(repoUrl);
    if (!owner || !repo) {
        showStatus('Invalid GitHub Repository URL. Please use format like https://github.com/username/repo', 'error', 5000);
        return false;
    }

    if (branchToDelete === configuredBranch) {
        showStatus(`GitHub: Cannot delete the configured default branch ('${configuredBranch}').`, 'error', 5000);
        return false;
    }
    if (branchToDelete === 'main' || branchToDelete === 'master') { // Prevent accidental deletion of main/master
        showStatus(`GitHub: Deleting 'main' or 'master' branch directly is not allowed for safety.`, 'error', 5000);
        return false;
    }

    const headers = getGitHubAuthHeaders();
    const url = `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branchToDelete}`;

    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: headers,
        });

        if (!response.ok) {
            const errorBody = await response.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            if (response.status === 422 && errorData.message && errorData.message.includes('branch is not fully merged')) {
                throw new Error(`Branch '${branchToDelete}' cannot be deleted because it is not fully merged.`);
            }
            throw new Error(errorData.message || `Failed to delete branch (${response.status} ${response.statusText}): ${errorData}`);
        }

        showStatus(`GitHub: Branch '${branchToDelete}' successfully deleted.`, 'success', 3000);
        return true;
    } catch (error) {
        console.error(`GitHub Delete Branch Error for ${branchToDelete}:`, error);
        showStatus(`GitHub: Failed to delete branch '${branchToDelete}': ${error.message}`, 'error', 8000);
        return false;
    }
}

async function handleGitHubCreatePullRequest(title, head, base, body_content) {
    const repoUrl = localStorage.getItem(GITHUB_REPO_URL_KEY);

    if (!repoUrl || !title || !head || !base) {
        showStatus('GitHub settings are incomplete, or title, head, or base branch for PR are missing.', 'error', 5000);
        return false;
    }
    const { owner, repo } = parseGithubRepoUrl(repoUrl);
    if (!owner || !repo) {
        showStatus('Invalid GitHub Repository URL. Please use format like https://github.com/username/repo', 'error', 5000);
        return false;
    }

    const headers = getGitHubAuthHeaders();
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls`;

    try {
        const body = {
            title: title,
            head: head, // Source branch
            base: base, // Target branch
            body: body_content || '',
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            throw new Error(errorData.message || `Failed to create pull request (${response.status} ${response.statusText}): ${errorData}`);
        }

        const prData = await response.json();
        showStatus(`GitHub: Pull Request '${prData.title}' (#${prData.number}) successfully created. URL: ${prData.html_url}`, 'success', 5000);
        return true;
    } catch (error) {
        console.error(`GitHub Create Pull Request Error:`, error);
        showStatus(`GitHub: Failed to create pull request: ${error.message}`, 'error', 8000);
        return false;
    }
}

async function handleGitHubGetWorkflowLogs(workflow_id, run_id, job_id, branch_name) {
    const repoUrl = localStorage.getItem(GITHUB_REPO_URL_KEY);
    const configuredBranch = localStorage.getItem(GITHUB_BRANCH_KEY);
    const targetBranch = branch_name || configuredBranch;

    if (!repoUrl || !workflow_id || !run_id) {
        showStatus('GitHub settings are incomplete, or workflow_id/run_id are missing for getting logs.', 'error', 5000);
        return false;
    }
    const { owner, repo } = parseGithubRepoUrl(repoUrl);
    if (!owner || !repo) {
        showStatus('Invalid GitHub Repository URL. Please use format like https://github.com/username/repo', 'error', 5000);
        return false;
    }

    const headers = getGitHubAuthHeaders();
    let logsUrl;
    let logType;

    if (job_id) {
        logsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/jobs/${job_id}/logs`;
        logType = 'job';
    } else {
        logsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${run_id}/logs`;
        logType = 'run';
    }

    showStatus(`Fetching GitHub workflow logs for ${workflow_id} (Run ${run_id}, Job ${job_id || 'all'}) on branch ${targetBranch}...`, 'info', 0);

    try {
        // GitHub API for logs sometimes redirects, so follow redirects
        const response = await fetch(logsUrl, { headers });

        if (!response.ok) {
            const errorBody = await response.text(); // Logs can be plain text, so try text first
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {} // Attempt to parse as JSON if possible
            throw new Error(errorData.message || `Failed to get workflow logs (${response.status} ${response.statusText}): ${errorData}`);
        }

        const logContent = await response.text(); // Logs are usually plain text

        const logMsgObj = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            sender: 'ai',
            displayContent: renderMarkdown(`\`\`\`text\n${logContent}\n\`\`\``), // Display as a code block
            contentForAI: logContent, // Keep raw for AI context if needed
            type: 'github-workflow-log',
            extraData: {
                workflow_id: workflow_id,
                run_id: run_id,
                job_id: job_id || null,
                log_type: logType,
                repo: repo,
                branch: targetBranch,
                success: true
            },
            isHtml: true, // Contains markdown generated HTML
            timestamp: new Date().toISOString(),
        };
        currentChatHistory.push(logMsgObj);
        displayMessage(logMsgObj);
        await saveChatHistory(); // Save immediately after displaying logs

        showStatus(`GitHub: Successfully fetched workflow logs for ${workflow_id} (Run ${run_id}).`, 'success', 3000);
        return true;
    } catch (error) {
        console.error(`GitHub Get Workflow Logs Error:`, error);
        const errorMsgObj = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            sender: 'ai',
            displayContent: `Failed to fetch workflow logs for ${workflow_id} (Run ${run_id}): ${error.message}`,
            contentForAI: `Failed to fetch workflow logs for ${workflow_id} (Run ${run_id}): ${error.message}`,
            type: 'github-op-error',
            extraData: {
                action: 'Get Workflow Logs',
                workflow_id: workflow_id,
                run_id: run_id,
                job_id: job_id,
                repo: repo,
                branch: targetBranch,
                success: false
            },
            isHtml: false,
            timestamp: new Date().toISOString(),
        };
        currentChatHistory.push(errorMsgObj);
        displayMessage(errorMsgObj);
        await saveChatHistory(); // Save immediately after displaying error
        showStatus(`GitHub Get Workflow Logs Failed: ${error.message}`, 'error', 8000);
        return false;
    }
}

// New function: handle GitHub get latest workflow logs
async function handleGitHubGetLatestWorkflowLogs(workflow_id, branch_name) {
    const repoUrl = localStorage.getItem(GITHUB_REPO_URL_KEY);
    const configuredBranch = localStorage.getItem(GITHUB_BRANCH_KEY);
    const targetBranch = branch_name || configuredBranch;

    if (!repoUrl || !workflow_id) {
        showStatus('GitHub settings are incomplete, or workflow_id is missing for getting latest logs.', 'error', 5000);
        return false;
    }
    const { owner, repo } = parseGithubRepoUrl(repoUrl);
    if (!owner || !repo) {
        showStatus('Invalid GitHub Repository URL. Please use format like https://github.com/username/repo', 'error', 5000);
        return false;
    }

    const headers = getGitHubAuthHeaders();
    let workflowNumericId;
    try {
        workflowNumericId = await resolveWorkflowId(workflow_id, owner, repo);
    } catch (error) {
        console.error(`GitHub Get Latest Workflow Run Error:`, error);
        const errorMsgObj = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            sender: 'ai',
            displayContent: `Failed to resolve workflow ID for '${workflow_id}': ${error.message}`,
            contentForAI: `Failed to resolve workflow ID for '${workflow_id}': ${error.message}`,
            type: 'github-op-error',
            extraData: {
                action: 'Get Latest Workflow Logs',
                workflow_id: workflow_id,
                repo: repo,
                branch: targetBranch,
                success: false
            },
            isHtml: false,
            timestamp: new Date().toISOString(),
        };
        currentChatHistory.push(errorMsgObj);
        displayMessage(errorMsgObj);
        await saveChatHistory();
        showStatus(`GitHub Get Latest Workflow Logs Failed: ${error.message}`, 'error', 8000);
        return false;
    }


    const runsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowNumericId}/runs?branch=${targetBranch}&status=completed&per_page=1`;
    
    showStatus(`Fetching latest completed workflow run for '${workflow_id}' on branch '${targetBranch}'...`, 'info', 0);

    try {
        const response = await fetch(runsUrl, { headers });
        if (!response.ok) {
            const errorBody = await response.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            throw new Error(errorData.message || `Failed to get workflow runs (${response.status} ${response.statusText}): ${errorData}`);
        }
        const data = await response.json();

        if (data.workflow_runs && data.workflow_runs.length > 0) {
            const latestRunId = data.workflow_runs[0].id;
            showStatus(`Latest run ID for workflow '${workflow_id}' is ${latestRunId}. Now fetching logs...`, 'info', 0);
            return handleGitHubGetWorkflowLogs(workflow_id, latestRunId, null, targetBranch); // Pass to the existing log fetching function
        } else {
            showStatus(`No completed runs found for workflow '${workflow_id}' on branch '${targetBranch}'.`, 'info', 3000);
            return false;
        }
    } catch (error) {
        console.error(`GitHub Get Latest Workflow Run Error:`, error);
        const errorMsgObj = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            sender: 'ai',
            displayContent: `Failed to find latest run for workflow ${workflow_id}: ${error.message}`,
            contentForAI: `Failed to find latest run for workflow ${workflow_id}: ${error.message}`,
            type: 'github-op-error',
            extraData: {
                action: 'Get Latest Workflow Logs',
                workflow_id: workflow_id,
                repo: repo,
                branch: targetBranch,
                success: false
            },
            isHtml: false,
            timestamp: new Date().toISOString(),
        };
        currentChatHistory.push(errorMsgObj);
        displayMessage(errorMsgObj);
        await saveChatHistory(); // Save immediately after displaying error
        showStatus(`GitHub Get Latest Workflow Logs Failed: ${error.message}`, 'error', 8000);
        return false;
    }
}


// Function to fetch workflow ID by .yml file name
// This function replaces the functionality of your old 'resolveWorkflowId'
async function fetchWorkflowIdByName(owner, repo, workflowFileName, token) {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFileName}`;
    try {
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/vnd.github+json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            return data.id; // Returns the numeric workflow ID
        } else {
            const errorText = await response.text();
            throw new Error(`Failed to get workflow ID for '${workflowFileName}'. Status: ${response.status} ${response.statusText}\nDetails: ${errorText}`);
        }
    } catch (error) {
        throw new Error(`An error occurred while fetching workflow ID: ${error.message}`);
    }
}

// The main function to handle GitHub Get Workflow Runs, now using fetchWorkflowIdByName
async function handleGitHubGetWorkflowRuns(workflow_id, branch_name) {
    const repoUrl = localStorage.getItem(GITHUB_REPO_URL_KEY);
    const configuredBranch = localStorage.getItem(GITHUB_BRANCH_KEY);
    const targetBranch = branch_name || configuredBranch;

    if (!repoUrl || !workflow_id) {
        showStatus('GitHub settings are incomplete, or workflow_id is missing for getting workflow runs.', 'error', 5000);
        return false;
    }
    const { owner, repo } = parseGithubRepoUrl(repoUrl);
    if (!owner || !repo) {
        showStatus('Invalid GitHub Repository URL. Please use format like https://github.com/username/repo', 'error', 5000);
        return false;
    }

    const headers = getGitHubAuthHeaders();
    // Extract the raw token from headers for use with fetchWorkflowIdByName
    const token = headers['Authorization'] ? headers['Authorization'].replace('Bearer ', '') : null;
    if (!token) {
        showStatus('GitHub Personal Access Token is missing or invalid. Please ensure it is set.', 'error', 5000);
        return false;
    }

    let workflowNumericId;

    try {
        // --- MODIFICATION: Call the new fetchWorkflowIdByName function ---
        // 'workflow_id' here is expected to be the .yml filename (e.g., "bot.yml")
        workflowNumericId = await fetchWorkflowIdByName(owner, repo, workflow_id, token);
        // --- END MODIFICATION ---
    } catch (error) {
        console.error(`GitHub Get Workflow Runs Error:`, error);
        const errorMsgObj = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            sender: 'ai',
            displayContent: `Failed to resolve workflow ID for '${workflow_id}': ${error.message}`,
            contentForAI: `Failed to resolve workflow ID for '${workflow_id}': ${error.message}`,
            type: 'github-op-error',
            extraData: {
                action: 'Get Workflow Runs',
                workflow_id: workflow_id,
                repo: repo,
                branch: targetBranch,
                success: false
            },
            isHtml: false,
            timestamp: new Date().toISOString(),
        };
        currentChatHistory.push(errorMsgObj);
        displayMessage(errorMsgObj);
        await saveChatHistory();
        showStatus(`GitHub Get Workflow Runs Failed: ${error.message}`, 'error', 8000);
        return false;
    }

    let allRuns = [];
    let page = 1;
    const perPage = 30; // Max per_page for GitHub API is 100, 30 is a good default to avoid very large responses for single call
    let totalCount = 0;
    let hasMore = true;

    showStatus(`Fetching workflow runs for '${workflow_id}' on branch '${targetBranch}'... (Page ${page})`, 'info', 0);

    try {
        while (hasMore) {
            // This API call uses the resolved workflowNumericId and the 'headers' object
            // which already contains the Authorization token from getGitHubAuthHeaders().
            const runsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowNumericId}/runs?branch=${targetBranch}&per_page=${perPage}&page=${page}`;
            const response = await fetch(runsUrl, { headers });

            if (!response.ok) {
                const errorBody = await response.text();
                let errorData = errorBody;
                try { errorData = JSON.parse(errorBody); } catch (e) {}

                // --- MODIFICATION TO DISPLAY RAW JSON ERROR STARTS HERE ---
                const displayContent = `Failed to get workflow runs (${response.status} ${response.statusText}). Raw response:\n\n\`\`\`json\n${JSON.stringify(errorData, null, 2)}\n\`\`\``;
                const contentForAI = `Failed to get workflow runs (${response.status} ${response.statusText}). Raw response:\n${JSON.stringify(errorData, null, 2)}`;

                const errorMsgObj = {
                    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                    sender: 'ai',
                    displayContent: renderMarkdown(displayContent),
                    contentForAI: contentForAI,
                    type: 'github-op-error',
                    extraData: {
                        action: 'Get Workflow Runs - Raw Error',
                        workflow_id: workflow_id,
                        repo: repo,
                        branch: targetBranch,
                        raw_error_data: errorData,
                        success: false
                    },
                    isHtml: true,
                    timestamp: new Date().toISOString(),
                };
                currentChatHistory.push(errorMsgObj);
                displayMessage(errorMsgObj);
                await saveChatHistory();
                showStatus(`GitHub Get Workflow Runs Failed: Check raw response for details.`, 'error', 8000);
                return false; // Exit the function after displaying the raw error
                // --- MODIFICATION ENDS HERE ---
            }

            const data = await response.json();
            totalCount = data.total_count;
            allRuns = allRuns.concat(data.workflow_runs);

            if (allRuns.length >= totalCount || data.workflow_runs.length < perPage) {
                hasMore = false;
            } else {
                page++;
                showStatus(`Fetching workflow runs for '${workflow_id}' on branch '${targetBranch}'... (Page ${page}/${Math.ceil(totalCount / perPage)})`, 'info', 0);
            }
        }

        if (allRuns.length === 0) {
            showStatus(`No runs found for workflow '${workflow_id}' on branch '${targetBranch}'.`, 'info', 3000);
            return false;
        }

        let runsListHtml = `<p>Total workflow runs for <strong>${workflow_id}</strong> on branch <strong>${targetBranch}</strong>: ${totalCount}</p>
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Workflow</th>
                                        <th>Status</th>
                                        <th>Conclusion</th>
                                        <th>Created At</th>
                                        <th>URL</th>
                                    </tr>
                                </thead>
                                <tbody>`;
        const runsListForAI = [];

        allRuns.forEach(run => {
            const createdAt = new Date(run.created_at).toLocaleString();
            runsListHtml += `<tr>
                                <td>${run.id}</td>
                                <td>${escapeHtml(run.workflow_name)}</td>
                                <td>${run.status}</td>
                                <td>${run.conclusion}</td>
                                <td>${createdAt}</td>
                                <td><a href="${run.html_url}" target="_blank">View Run</a></td>
                            </tr>`;
            runsListForAI.push({
                id: run.id,
                workflow_name: run.workflow_name,
                head_branch: run.head_branch,
                status: run.status,
                conclusion: run.conclusion,
                created_at: run.created_at,
                html_url: run.html_url
            });
        });
        runsListHtml += `</tbody></table>`;

        const runsListMsgObj = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            sender: 'ai',
            displayContent: renderMarkdown(runsListHtml),
            contentForAI: `Workflow runs for '${workflow_id}' on branch '${targetBranch}' (Total: ${totalCount}):\n${JSON.stringify(runsListForAI, null, 2)}`,
            type: 'github-workflow-runs-list',
            extraData: {
                action: 'Get Workflow Runs',
                workflow_id: workflow_id,
                repo: repo,
                branch: targetBranch,
                total_count: totalCount,
                runs: runsListForAI, // Store structured data for AI's memory
                success: true
            },
            isHtml: true,
            timestamp: new Date().toISOString(),
        };
        currentChatHistory.push(runsListMsgObj);
        displayMessage(runsListMsgObj);
        await saveChatHistory(); // Save immediately after displaying runs

        showStatus(`GitHub: Successfully fetched ${totalCount} workflow runs for '${workflow_id}'.`, 'success', 3000);
        return true;

    } catch (error) {
        console.error(`GitHub Get Workflow Runs Error:`, error);
        const errorMsgObj = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            sender: 'ai',
            displayContent: `Failed to get workflow runs for workflow ${workflow_id}: ${error.message}`,
            contentForAI: `Failed to get workflow runs for workflow ${workflow_id}: ${error.message}`,
            type: 'github-op-error',
            extraData: {
                action: 'Get Workflow Runs',
                workflow_id: workflow_id,
                repo: repo,
                branch: targetBranch,
                success: false
            },
            isHtml: false,
            timestamp: new Date().toISOString(),
        };
        currentChatHistory.push(errorMsgObj);
        displayMessage(errorMsgObj);
        await saveChatHistory(); // Save immediately after displaying error
        showStatus(`GitHub Get Workflow Runs Failed: ${error.message}`, 'error', 8000);
        return false;
    }
}

// NOTE: The 'fetchWorkflowRuns' and 'displayWorkflowRuns' functions you provided
// in your message were designed for a different UI structure and a fixed
// 'per_page=10' limit without pagination.
// I have not integrated them directly into 'handleGitHubGetWorkflowRuns' to preserve
// its existing robust pagination and display logic.
// If you wish to use those specific display components, you would need to
// adapt your UI to include the 'workflowRunsListDiv' and 'results' elements,
// and potentially change how 'handleGitHubGetWorkflowRuns' outputs its data.
async function handleGitHubTriggerWorkflow(workflow_id, inputs, branch_name) {
    const repoUrl = localStorage.getItem(GITHUB_REPO_URL_KEY);
    const configuredBranch = localStorage.getItem(GITHUB_BRANCH_KEY);
    const targetBranch = branch_name || configuredBranch;

    if (!repoUrl || !workflow_id) {
        showStatus('GitHub settings are incomplete, or workflow_id is missing for triggering a workflow.', 'error', 5000);
        return false;
    }
    const { owner, repo } = parseGithubRepoUrl(repoUrl);
    if (!owner || !repo) {
        showStatus('Invalid GitHub Repository URL. Please use format like https://github.com/username/repo', 'error', 5000);
        return false;
    }

    const headers = {
        ...getGitHubAuthHeaders(),
        'Accept': 'application/vnd.github.v3+json' // Ensure proper accept header for workflow_dispatch
    };
    let workflowNumericId;
    try {
        workflowNumericId = await resolveWorkflowId(workflow_id, owner, repo);
    } catch (error) {
        console.error(`GitHub Trigger Workflow Error:`, error);
        showStatus(`Failed to resolve workflow ID for '${workflow_id}': ${error.message}`, 'error', 8000);
        return false;
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowNumericId}/dispatches`;

    const body = {
        ref: targetBranch,
        inputs: inputs || {}
    };

    showStatus(`Triggering GitHub workflow '${workflow_id}' on branch '${targetBranch}'...`, 'info', 0);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            throw new Error(errorData.message || `Failed to dispatch workflow (${response.status} ${response.statusText}): ${errorData}`);
        }

        // workflow_dispatch returns a 204 No Content on success
        showStatus(`GitHub: Workflow '${workflow_id}' successfully triggered on branch '${targetBranch}'.`, 'success', 3000);
        return true;
    } catch (error) {
        console.error(`GitHub Trigger Workflow Error for ${workflow_id}:`, error);
        showStatus(`GitHub Trigger Workflow Failed for '${workflow_id}': ${error.message}`, 'error', 8000);
        return false;
    }
}

async function handleGitHubCreateRepository(repo_name, description = '', isPrivate = false, org_name = null) {
    if (!repo_name) {
        showStatus('Repository name is required for creating a new GitHub repository.', 'error', 5000);
        return false;
    }

    const headers = getGitHubAuthHeaders();
    let url;
    if (org_name) {
        url = `https://api.github.com/orgs/${org_name}/repos`;
    } else {
        url = `https://api.github.com/user/repos`;
    }

    const body = {
        name: repo_name,
        description: description,
        private: isPrivate,
        auto_init: true // Automatically create an initial commit with a README.md
    };

    showStatus(`Creating GitHub repository '${repo_name}' ${isPrivate ? '(private)' : '(public)'} ${org_name ? `in organization '${org_name}'` : ''}...`, 'info', 0);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            throw new Error(errorData.message || `Failed to create repository (${response.status} ${response.statusText}): ${errorData}`);
        }

        const repoData = await response.json();
        showStatus(`GitHub: Repository '${repoData.full_name}' successfully created. URL: ${repoData.html_url}`, 'success', 5000);

        // Defect Fix: Automatically set new repo as current in settings
        localStorage.setItem(GITHUB_REPO_URL_KEY, repoData.html_url);
        localStorage.setItem(GITHUB_BRANCH_KEY, 'main'); // Assuming auto_init creates a 'main' branch
        updateActiveApiConfig(); // Refresh internal state
        showStatus(`New repository '${repoData.full_name}' is now set as the current GitHub project in settings.`, 'info', 5000);

        return true;
    } catch (error) {
        console.error(`GitHub Create Repository Error for ${repo_name}:`, error);
        showStatus(`GitHub: Failed to create repository '${repo_name}': ${error.message}`, 'error', 8000);
        return false;
    }
}

async function handleGitHubDeleteRepository(repo_name) {
    if (!repo_name) {
        showStatus('Repository name is required for deleting a GitHub repository.', 'error', 5000);
        return false;
    }

    const headers = getGitHubAuthHeaders();
    // For deleting, we need the owner and repo name from the specified repo_name
    // If the configured repo is being deleted, we can use its owner/repo.
    // Otherwise, the user needs to provide a fully qualified 'owner/repo_name'.
    let owner, repo;
    if (repo_name.includes('/')) {
        [owner, repo] = repo_name.split('/');
    } else {
        const configuredRepoUrl = localStorage.getItem(GITHUB_REPO_URL_KEY);
        const parsedConfiguredRepo = parseGithubRepoUrl(configuredRepoUrl);
        if (parsedConfiguredRepo.repo === repo_name) {
            owner = parsedConfiguredRepo.owner;
            repo = parsedConfiguredRepo.repo;
        } else {
            // If it's not a configured repo, and only a name is given, assume it's under the authenticated user
            // This is a weak assumption, but common for user-owned repos.
            showStatus('For deleting a repository not currently configured, please provide the full "owner/repo-name" format (e.g., "myuser/my-old-repo").', 'error', 8000);
            return false;
        }
    }


    if (!owner || !repo) {
        showStatus('Could not determine repository owner/name for deletion. Please specify in "owner/repo-name" format or configure default repo.', 'error', 8000);
        return false;
    }

    // Defect Fix: Explicitly ask user to type the repo name for confirmation
    const confirmationInput = prompt(`WARNING: Are you absolutely sure you want to delete the repository '${owner}/${repo}'? This action is irreversible and will delete all its contents, issues, wikis, and collaborators. Please type '${owner}/${repo}' to confirm deletion.`);
    if (confirmationInput !== `${owner}/${repo}`) {
        showStatus('Repository deletion cancelled.', 'info', 3000);
        return false;
    }


    const url = `https://api.github.com/repos/${owner}/${repo}`;

    showStatus(`Deleting GitHub repository '${owner}/${repo}'... This is irreversible!`, 'warning', 0);

    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: headers,
        });

        if (!response.ok) {
            const errorBody = await response.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            throw new Error(errorData.message || `Failed to delete repository (${response.status} ${response.statusText}): ${errorData}`);
        }

        // 204 No Content is expected for successful DELETE
        showStatus(`GitHub: Repository '${owner}/${repo}' successfully deleted.`, 'success', 3000);
        return true;
    } catch (error) {
        console.error(`GitHub Delete Repository Error for ${owner}/${repo}:`, error);
        showStatus(`GitHub: Failed to delete repository '${owner}/${repo}': ${error.message}`, 'error', 8000);
        return false;
    }
}

async function handleGitHubSetSecret(secret_name, secret_value, repo_name_override = null, org_name = null) {
    if (!secret_name || secret_value === undefined) {
        showStatus('Secret name and value are required for setting a GitHub secret.', 'error', 5000);
        return false;
    }

    const headers = getGitHubAuthHeaders();
    let url, owner, repo, targetIdentifier;

    // Determine if it's an organization secret or repository secret
    if (org_name) {
        url = `https://api.github.com/orgs/${org_name}/actions/secrets/public-key`;
        targetIdentifier = `organization '${org_name}'`;
    } else {
        const repoUrl = localStorage.getItem(GITHUB_REPO_URL_KEY);
        const parsedRepo = parseGithubRepoUrl(repoUrl);
        owner = parsedRepo.owner;
        repo = repo_name_override || parsedRepo.repo; // Use override if provided, otherwise default configured repo

        if (!owner || !repo) {
            showStatus('Invalid GitHub Repository URL or missing for setting secret. Please configure in settings or provide repo_name in "owner/repo-name" format for this action.', 'error', 5000);
            return false;
        }
        url = `https://api.github.com/repos/${owner}/${repo}/actions/secrets/public-key`;
        targetIdentifier = `repository '${owner}/${repo}'`;
    }

    showStatus(`Fetching public key for ${targetIdentifier}...`, 'info', 0);

    try {
        // 1. Get Public Key
        const publicKeyResponse = await fetch(url, { headers });
        if (!publicKeyResponse.ok) {
            const errorBody = await publicKeyResponse.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            throw new Error(errorData.message || `Failed to get public key for ${targetIdentifier} (${publicKeyResponse.status} ${publicKeyResponse.statusText}): ${errorData}`);
        }
        const publicKeyData = await publicKeyResponse.json();
        const publicKey = publicKeyData.key;
        const keyId = publicKeyData.key_id;

        // 2. Encrypt Secret Value
        showStatus(`Encrypting secret '${secret_name}'...`, 'info', 0);
        const encryptedValue = await encryptSecretWithPublicKey(secret_value, publicKey);

        // 3. Set Secret
        let setSecretUrl;
        if (org_name) {
            setSecretUrl = `https://api.github.com/orgs/${org_name}/actions/secrets/${secret_name}`;
        } else {
            setSecretUrl = `https://api.github.com/repos/${owner}/${repo}/actions/secrets/${secret_name}`;
        }

        const body = {
            encrypted_value: encryptedValue,
            key_id: keyId,
        };

        showStatus(`Setting GitHub secret '${secret_name}' for ${targetIdentifier}...`, 'info', 0);
        const setSecretResponse = await fetch(setSecretUrl, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(body),
        });

        if (!setSecretResponse.ok) {
            const errorBody = await setSecretResponse.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            throw new Error(errorData.message || `Failed to set secret '${secret_name}' (${setSecretResponse.status} ${setSecretResponse.statusText}): ${errorData}`);
        }

        showStatus(`GitHub: Secret '${secret_name}' successfully set for ${targetIdentifier}.`, 'success', 3000);
        return true;
    } catch (error) {
        console.error(`GitHub Set Secret Error for ${secret_name}:`, error);
        showStatus(`GitHub: Failed to set secret '${secret_name}': ${error.message}`, 'error', 8000);
        return false;
    }
}

// New Function: Get Artifact Download Links
async function handleGitHubGetArtifactDownloadLinks(workflow_id, branch_name) {
    const repoUrl = localStorage.getItem(GITHUB_REPO_URL_KEY);
    const configuredBranch = localStorage.getItem(GITHUB_BRANCH_KEY);
    const targetBranch = branch_name || configuredBranch;

    if (!repoUrl || !workflow_id) {
        showStatus('GitHub settings are incomplete, or workflow_id is missing for getting artifact links.', 'error', 5000);
        return false;
    }
    const { owner, repo } = parseGithubRepoUrl(repoUrl);
    if (!owner || !repo) {
        showStatus('Invalid GitHub Repository URL. Please use format like https://github.com/username/repo', 'error', 5000);
        return false;
    }

    const headers = getGitHubAuthHeaders();
    let workflowNumericId;

    try {
        workflowNumericId = await resolveWorkflowId(workflow_id, owner, repo);
    } catch (error) {
        console.error(`GitHub Get Artifact Download Links Error:`, error);
        const errorMsgObj = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            sender: 'ai',
            displayContent: `Failed to resolve workflow ID for '${workflow_id}': ${error.message}`,
            contentForAI: `Failed to resolve workflow ID for '${workflow_id}': ${error.message}`,
            type: 'github-op-error',
            extraData: {
                action: 'Get Artifact Download Links',
                workflow_id: workflow_id,
                repo: repo,
                branch: targetBranch,
                success: false
            },
            isHtml: false,
            timestamp: new Date().toISOString(),
        };
        currentChatHistory.push(errorMsgObj);
        displayMessage(errorMsgObj);
        await saveChatHistory();
        showStatus(`GitHub Get Artifact Download Links Failed: ${error.message}`, 'error', 8000);
        return false;
    }


    try {
        showStatus(`Fetching latest successful run for workflow '${workflow_id}' on branch '${targetBranch}'...`, 'info', 0);

        // Get the latest successful workflow run
        const runsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowNumericId}/runs?branch=${targetBranch}&status=success&per_page=1`;
        const runsResponse = await fetch(runsUrl, { headers });
        if (!runsResponse.ok) {
            const errorBody = await runsResponse.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            throw new Error(errorData.message || `Failed to get workflow runs (${runsResponse.status} ${runsResponse.statusText}): ${errorData}`);
        }
        const runsData = await runsResponse.json();

        if (!runsData.workflow_runs || runsData.workflow_runs.length === 0) {
            showStatus(`No successful runs found for workflow '${workflow_id}' on branch '${targetBranch}'.`, 'info', 3000);
            return false;
        }

        const latestRunId = runsData.workflow_runs[0].id;
        showStatus(`Found latest successful run (ID: ${latestRunId}). Fetching artifacts...`, 'info', 0);

        // Get artifacts for the latest run
        const artifactsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${latestRunId}/artifacts`;
        const artifactsResponse = await fetch(artifactsUrl, { headers });
        if (!artifactsResponse.ok) {
            const errorBody = await artifactsResponse.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            throw new Error(errorData.message || `Failed to get artifacts for run ${latestRunId} (${artifactsResponse.status} ${artifactsResponse.statusText}): ${errorData}`);
        }
        const artifactsData = await artifactsResponse.json();

        if (!artifactsData.artifacts || artifactsData.artifacts.length === 0) {
            showStatus(`No artifacts found for workflow run ${latestRunId}.`, 'info', 3000);
            return false;
        }

        let artifactLinksHtml = `<p>Download links for artifacts from run <a href="${runsData.workflow_runs[0].html_url}" target="_blank">${latestRunId}</a>:</p><ul>`;
        const artifactLinksForAI = []; // For AI content
        artifactsData.artifacts.forEach(artifact => {
            artifactLinksHtml += `<li><a href="${artifact.archive_download_url}" target="_blank" download><i class="fas fa-download"></i> ${artifact.name} (${getSizeString(artifact.size_in_bytes)})</a></li>`;
            artifactLinksForAI.push({ name: artifact.name, url: artifact.archive_download_url, size: getSizeString(artifact.size_in_bytes) });
        });
        artifactLinksHtml += '</ul>';

        const artifactLinksMsgObj = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            sender: 'ai',
            displayContent: renderMarkdown(artifactLinksHtml),
            contentForAI: `Artifacts for workflow ${workflow_id} (run ${latestRunId}):\n${artifactLinksForAI.map(a => `- ${a.name} (${a.size}): ${a.url}`).join('\n')}`,
            type: 'github-artifact-links',
            extraData: {
                action: 'Get Artifact Download Links',
                workflow_id: workflow_id,
                run_id: latestRunId,
                repo: repo,
                branch: targetBranch,
                artifacts: artifactLinksForAI,
                success: true
            },
            isHtml: true,
            timestamp: new Date().toISOString(),
        };
        currentChatHistory.push(artifactLinksMsgObj);
        displayMessage(artifactLinksMsgObj);
        await saveChatHistory(); // Save immediately after displaying artifact links

        showStatus(`GitHub: Successfully retrieved artifact download links.`, 'success', 3000);
        return true;

    } catch (error) {
        console.error(`GitHub Get Artifact Download Links Error:`, error);
        const errorMsgObj = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            sender: 'ai',
            displayContent: `Failed to get artifact download links for workflow ${workflow_id}: ${error.message}`,
            contentForAI: `Failed to get artifact download links for workflow ${workflow_id}: ${error.message}`,
            type: 'github-op-error',
            extraData: {
                action: 'Get Artifact Download Links',
                workflow_id: workflow_id,
                repo: repo,
                branch: targetBranch,
                success: false
            },
            isHtml: false,
            timestamp: new Date().toISOString(),
        };
        currentChatHistory.push(errorMsgObj);
        displayMessage(errorMsgObj);
        await saveChatHistory(); // Save immediately after displaying error
        showStatus(`GitHub Get Artifact Download Links Failed: ${error.message}`, 'error', 8000);
        return false;
    }
}


// New Function: handle GitHub List Repositories
async function handleGitHubListRepositories(org_name = null) {
    const headers = getGitHubAuthHeaders();
    let url;
    let actionText;

    if (org_name) {
        url = `https://api.github.com/orgs/${org_name}/repos`;
        actionText = `Listing repositories for organization '${org_name}'...`;
    } else {
        url = `https://api.github.com/user/repos`;
        actionText = `Listing repositories for the authenticated user...`;
    }

    showStatus(actionText, 'info', 0);

    try {
        const response = await fetch(url, { headers });

        if (!response.ok) {
            const errorBody = await response.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            throw new Error(errorData.message || `Failed to list repositories (${response.status} ${response.statusText}): ${errorData}`);
        }

        const repos = await response.json();

        if (repos.length === 0) {
            showStatus(`No repositories found ${org_name ? `in organization '${org_name}'` : 'for your user'}.`, 'info', 3000);
            return true;
        }

        let reposListHtml = `<h3>${org_name ? `Repositories in ${org_name}` : 'My Repositories'}:</h3><ul>`;
        const reposListForAI = [];
        repos.forEach(repoItem => {
            const visibility = repoItem.private ? ' (Private)' : ' (Public)';
            reposListHtml += `<li><a href="${repoItem.html_url}" target="_blank">${repoItem.name}</a>${visibility}</li>`;
            reposListForAI.push({ name: repoItem.name, full_name: repoItem.full_name, url: repoItem.html_url, private: repoItem.private });
        });
        reposListHtml += '</ul>';

        const reposListMsgObj = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            sender: 'ai',
            displayContent: renderMarkdown(reposListHtml),
            contentForAI: `Listed repositories:\n${reposListForAI.map(r => `- ${r.full_name} (${r.private ? 'Private' : 'Public'}): ${r.url}`).join('\n')}`,
            type: 'github-repos-list',
            extraData: {
                action: org_name ? `List Org Repos` : `List User Repos`,
                org_name: org_name,
                repos: reposListForAI,
                success: true
            },
            isHtml: true,
            timestamp: new Date().toISOString(),
        };
        currentChatHistory.push(reposListMsgObj);
        displayMessage(reposListMsgObj);
        await saveChatHistory(); // Save immediately after displaying repo list

        showStatus(`GitHub: Successfully listed repositories.`, 'success', 3000);
        return true;
    } catch (error) {
        console.error(`GitHub List Repositories Error:`, error);
        const errorMsgObj = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            sender: 'ai',
            displayContent: `Failed to list repositories ${org_name ? `for organization '${org_name}'` : ''}: ${error.message}`,
            contentForAI: `Failed to list repositories ${org_name ? `for organization '${org_name}'` : ''}: ${error.message}`,
            type: 'github-op-error',
            extraData: {
                action: org_name ? `List Org Repos` : `List User Repos`,
                org_name: org_name,
                success: false
            },
            isHtml: false,
            timestamp: new Date().toISOString(),
        };
        currentChatHistory.push(errorMsgObj);
        displayMessage(errorMsgObj);
        await saveChatHistory(); // Save immediately after displaying error
        showStatus(`GitHub List Repositories Failed: ${error.message}`, 'error', 8000);
        return false;
    }
}


// --- End GitHub Integration Functions ---


// --- Image Attachment Logic ---
attachImageButton.addEventListener('click', () => {
    imageUploadInput.click();
});

imageUploadInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        if (!file.type.startsWith('image/')) {
            showStatus('Please select an image file.', 'error', 3000);
            clearAttachedImage();
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            attachedImageData = {
                base64: reader.result.split(',')[1],
                mimeType: file.type,
                filename: file.name,
                size: getSizeString(reader.result)
            };
            imagePreview.src = reader.result;
            previewFileName.textContent = file.name;
            previewFileSize.textContent = attachedImageData.size;
            attachedImagePreview.style.display = 'flex';
        };
        reader.readAsDataURL(file);
    } else {
        clearAttachedImage();
    }
});

clearAttachedFileButton.addEventListener('click', clearAttachedImage);

function clearAttachedImage() {
    attachedImageData = null;
    imageUploadInput.value = '';
    attachedImagePreview.style.display = 'none';
    imagePreview.src = '#';
    previewFileName.textContent = '';
    previewFileSize.textContent = '';
}
// --- End Image Attachment Logic ---


// --- Speech-to-Text (STT) and Text-to-Speech (TTS) Logic ---
function initializeSpeechRecognition() {
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false; // Set to false to capture one utterance at a time
        recognition.interimResults = false; // Only get final results for better control
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            console.log('Speech recognition started.');
            isListening = true;
            if (audioChatModeActive) {
                audioStatusText.textContent = "Listening...";
                audioVisualizer.classList.add('listening');
                audioVisualizer.classList.remove('speaking', 'processing');
                // Clear input visually at the start of a new listening phase in audio mode
                messageInput.value = '';
            }
            messageInput.focus(); // Keep focus on input for visual feedback of typing cursor
        };

        recognition.onresult = (event) => {
            // When continuous is false, onresult usually fires once for the final result
            // For interim results, one would use continuous: true and handle partial results
            // but for this flow, we want the full utterance.
            const finalTranscript = event.results[0][0].transcript;
            lastSpokenTranscript = finalTranscript; // Store the transcript internally
            console.log('Final transcript captured:', finalTranscript);

            // Do NOT update messageInput directly here, it will be used in onend to call sendMessage
        };

        recognition.onend = () => {
            console.log('Speech recognition ended.');
            isListening = false;

            if (audioChatModeActive) {
                audioVisualizer.classList.remove('listening', 'speaking'); // Clear visualizer state
                audioStatusText.textContent = "Processing your message..."; // Interim state visually
                audioVisualizer.classList.add('processing'); // Show processing animation

                // Automatically send the message using the captured transcript
                // Only send if there was actual speech captured.
                if (lastSpokenTranscript.trim() !== '') {
                    sendMessage(true, lastSpokenTranscript);
                    lastSpokenTranscript = ''; // Reset after sending
                } else {
                    // If onend fired but no speech was recognized (e.g., silence), stay in audio mode
                    // and allow user to try speaking again.
                    audioStatusText.textContent = "No speech detected. Try again.";
                    startListening(); // Re-enable listening immediately
                }
            } else {
                // If not in audio chat mode, this is a one-off STT, just update input and hide status
                hideStatus();
            }
        };

        recognition.onerror = (event) => {
            isListening = false;
            audioVisualizer.classList.remove('listening', 'speaking', 'processing');
            console.error('Speech recognition error:', event.error);
            let errorMessage = 'Speech recognition error.';
            if (event.error === 'not-allowed') {
                errorMessage = 'Microphone access denied. Please allow microphone in browser settings.';
                showStatus(errorMessage, 'error', 5000);
                if (audioChatModeActive) {
                    audioStatusText.textContent = "Microphone access denied. Exiting audio mode.";
                    setTimeout(exitAudioMode, 1500); // Exit audio mode after error
                }
            } else if (event.error === 'no-speech') {
                // This case is handled in onend if lastSpokenTranscript is empty
                // It generally means too quiet or no clear speech for a duration.
                // We avoid showing a disruptive status message for this specific error here,
                // as onend will manage it or we re-listen automatically.
                if (audioChatModeActive) {
                     audioStatusText.textContent = "No speech detected. Try again.";
                     startListening(); // Try listening again if in audio mode
                } else {
                    showStatus('No speech detected.', 'info', 1500);
                }
                return; // Don't fall through to generic error handling
            } else if (event.error === 'network') {
                errorMessage = 'Network error during speech recognition.';
                showStatus(errorMessage, 'error', 5000);
                if (audioChatModeActive) {
                    audioStatusText.textContent = "Network error. Exiting audio mode.";
                    setTimeout(exitAudioMode, 1500); // Exit audio mode after error
                }
            } else {
                 showStatus(errorMessage + ': ' + event.error, 'error', 5000);
                 if (audioChatModeActive) {
                    audioStatusText.textContent = "Microphone error. Try again.";
                    startListening(); // Try listening again after other errors
                 }
            }
        };
    } else {
        console.warn('Web Speech API (SpeechRecognition) not supported in this browser.');
        showStatus('Speech-to-Text not supported in your browser.', 'error', 3000);
        if (toggleSpeechButton) {
            toggleSpeechButton.disabled = true;
            toggleSpeechButton.style.opacity = '0.5';
            toggleSpeechButton.style.cursor = 'not-allowed';
        }
    }
}

function speakText(textToSpeak, type = 'user_response') { // 'user_response' for AI's regular speech, 'internal' for "Please wait"
    if (!('speechSynthesis' in window)) {
        console.warn('Text-to-Speech not supported in your browser.');
        if (type === 'user_response') { // Only show status for user-facing speech
            showStatus('Text-to-Speech not supported in your browser.', 'error', 3000);
        }
        return;
    }

    stopSpeech(); // Stop any currently speaking utterance to allow new one

    currentUtterance = new SpeechSynthesisUtterance(textToSpeak);
    currentUtterance.pitch = 1;
    currentUtterance.rate = 1.1;

    currentUtterance.onstart = () => {
        if (audioChatModeActive) {
            audioVisualizer.classList.add('speaking');
            audioVisualizer.classList.remove('listening', 'processing');
            if (type === 'internal') {
                audioStatusText.textContent = "Anesha is thinking..."; // Keep processing text if 'Please wait'
            } else { // user_response
                audioStatusText.textContent = "Anesha is speaking...";
            }
        }
    };

    currentUtterance.onend = () => {
        console.log('AI finished speaking (type: ' + type + ').');
        currentUtterance = null;
        if (audioChatModeActive) {
            audioVisualizer.classList.remove('speaking', 'processing'); // Clear speaking/processing animation

            if (type === 'user_response') { // This is the AI's actual response, so user's turn starts
                audioStatusText.textContent = "Ready to speak...";
                startListening(); // Re-enable microphone for user's turn
            } else { // This was an 'internal' message like "Please wait"
                // Do NOT start listening here. The AI's response is still pending.
                // The status ("Anesha is thinking...") should remain until AI response is received and parsed.
            }
        }
    };

    currentUtterance.onerror = (event) => {
        console.error('SpeechSynthesisUtterance.onerror (type: ' + type + ')', event);
        if (type === 'user_response') {
            showStatus('Text-to-Speech error.', 'error');
        }
        currentUtterance = null;
        if (audioChatModeActive) {
            audioVisualizer.classList.remove('speaking', 'processing');
            audioStatusText.textContent = "Error speaking."; // Generic error, might need refinement
            if (type === 'user_response') {
                 startListening(); // Fallback: allow user to speak if AI couldn't
            }
        }
    };

    window.speechSynthesis.speak(currentUtterance);
}

function stopSpeech() {
    if ('speechSynthesis' in window && window.speechSynthesis.speaking) { // Added check for window.speechSynthesis
        window.speechSynthesis.cancel();
    }
    currentUtterance = null;
}

function startListening() {
    if (recognition && !isListening) {
        try {
            recognition.start();
        } catch (e) {
            console.error("Error starting speech recognition:", e);
            // AbortError means it was already listening, so ignore it unless actively trying to stop
            if (e.name === 'AbortError' && isListening) {
                // Already listening, ignore, but set state correctly
                audioStatusText.textContent = "Listening...";
                audioVisualizer.classList.add('listening');
                audioVisualizer.classList.remove('speaking', 'processing');
            } else {
                showStatus('Failed to start microphone. Please check permissions.', 'error', 3000);
                audioStatusText.textContent = "Microphone error. Exiting audio mode.";
                audioVisualizer.classList.remove('listening', 'speaking', 'processing');
                setTimeout(exitAudioMode, 1500); // Exit audio mode after a short delay
            }
        }
    } else if (!recognition) {
        showStatus('Speech-to-Text not supported or initialized.', 'error', 3000);
        exitAudioMode();
    }
}

function stopListening() {
     if (recognition && isListening) {
        recognition.stop();
    }
    isListening = false;
}

function toggleAudioChatMode() {
    audioChatModeActive = !audioChatModeActive;
    if (audioChatModeActive) {
        audioModeOverlay.classList.add('active');
        audioStatusText.textContent = "Initializing microphone...";
        messageInput.value = ''; // Clear input field when entering audio mode
        startListening();
    } else {
        exitAudioMode();
    }
}

function exitAudioMode() {
    audioChatModeActive = false;
    stopSpeech();
    stopListening(); // Ensure microphone is stopped explicitly
    audioModeOverlay.classList.remove('active');
    audioStatusText.textContent = "";
    audioVisualizer.classList.remove('listening', 'speaking', 'processing');
    messageInput.focus();
    hideStatus(); // Clear any ongoing status messages from the main app
}
// --- End STT/TTS Logic ---


backButton.addEventListener('click', () => {
    window.location.href = 'Pe.html';
});
fileMenuButton.addEventListener('click', () => toggleDrawer('file'));
newChatButton.addEventListener('click', startNewConversation);
toggleFileOpsButton.addEventListener('click', toggleFileOperations);
settingsButton.addEventListener('click', () => toggleDrawer('settings'));
settingsOverlay.addEventListener('click', () => closeDrawer('all'));
// Listener for the Send Message Button
sendMessageButton.addEventListener('click', () => {
    sendMessage(); // Call the sendMessage function
});

// Listener for the Message Input field (handles Enter key)
messageInput.addEventListener('keypress', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
aiModelSelect.addEventListener('change', updateApiSettingsVisibility);
saveSettingsButton.addEventListener('click', saveSettings);
closeSettingsButton.addEventListener('click', () => closeDrawer('settings'));

// New GitHub buttons (now call centralized performFileOperation for consistency)
pushToGithubButton.addEventListener('click', () => performFileOperation({ action: 'github_push' }, true)); // User initiated
pullFromGithubButton.addEventListener('click', () => performFileOperation({ action: 'github_pull' }, true)); // User initiated

// New Audio Chat buttons
toggleSpeechButton.addEventListener('click', toggleAudioChatMode);
exitAudioModeButton.addEventListener('click', exitAudioMode);

document.addEventListener('DOMContentLoaded', async () => {
    loadTheme();

    fileOperationsEnabled = localStorage.getItem(FILE_OPS_ENABLED_KEY) !== 'false'; // Default to true if not set
    updateFileOpsButton();

    updateActiveApiConfig();
    initializeSpeechRecognition(); // Initialize STT on page load

    await openGen1DB();

    currentProjectId = localStorage.getItem(CURRENT_PROJECT_ID_LS_KEY);

    if (!currentProjectId) {
        showStatus('No project selected. Returning to editor...', 'error', 4000);
        setTimeout(() => {
            window.location.href = 'Pe.html';
        }, 4000);
        return;
    }

    try {
        const projectMetadata = await getItemFromStore(PROJECTS_STORE_NAME, currentProjectId);
        if (projectMetadata && projectMetadata.name) {
            document.querySelector('.page-title').textContent = 'AI Assist - ' + projectMetadata.name;
        } else {
            document.querySelector('.page-title').textContent = 'AI Assist';
            showStatus('Project metadata not found.', 'error');
        }
    } catch (error) {
        console.error('Error loading project metadata:', error);
        showStatus('Failed to load project metadata: ' + error.message, 'error');
    }

    await loadProjectFilesDataOnly();
    await loadChatHistory();

    if (currentChatHistory.length === 0) {
        const initialMessage = {
            id: 'initial-ai-message',
            sender: 'ai',
            displayContent: renderMarkdown('Hello! How can I help you with your project today? You can ask me to generate code, refactor, or even create new files. I can respond using markdown (e.g., **bold**, *italic*, `inline code`), and I can perform file operations in your project using a special markdown format. Use `x@filename` in your input to reference a file\'s content. For a spoken response, I will include  in my message.'),
            contentForAI: 'Hello! How can I help you with your project today? You can ask me to generate code, refactor, or even create new files. I can respond using markdown (e.g., **bold**, *italic*, `inline code`), and I can perform file operations in your project using a special markdown format. Use `x@filename` in your input to reference a file\'s content. For a spoken response, I will include  in my message.',
            type: 'text',
            extraData: null,
            isHtml: true,
            timestamp: new Date().toISOString()
        };
        currentChatHistory.push(initialMessage);
        displayMessage(initialMessage);
        await saveChatHistory();
    }
});

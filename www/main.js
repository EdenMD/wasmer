// Ensure Capacitor is initialized
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

const statusDisplay = document.getElementById('status');
const ttsInput = document.getElementById('ttsInput');
const speakBtn = document.getElementById('speakBtn');
const downloadUrlInput = document.getElementById('downloadUrl');
const downloadFilenameInput = document.getElementById('downloadFilename');
const downloadBtn = document.getElementById('downloadBtn');
const startRecordBtn = document.getElementById('startRecordBtn');
const stopRecordBtn = document.getElementById('stopRecordBtn');
const audioPlayback = document.getElementById('audioPlayback');
const fileInput = document.getElementById('fileInput');
const selectFileBtn = document.getElementById('selectFileBtn');
const fileContentPre = document.getElementById('fileContent');

let mediaRecorder;
let audioChunks = [];

function updateStatus(message) {
  statusDisplay.textContent = `Status: ${message}`;
  console.log(message);
}

// --- 1. Text-to-Speech (Web Speech API) ---
speakBtn.addEventListener('click', () => {
  const text = ttsInput.value;
  if ('speechSynthesis' in window) {
    updateStatus('Speaking...');
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => updateStatus('Finished speaking.');
    utterance.onerror = (event) => updateStatus(`Error speaking: ${event.error}`);
    window.speechSynthesis.speak(utterance);
  } else {
    updateStatus('Web Speech API not supported.');
    alert('Web Speech API not supported in this browser/device.');
  }
});

// --- 2. File Download (Capacitor Filesystem Plugin for saving) ---
downloadBtn.addEventListener('click', async () => {
  const url = downloadUrlInput.value;
  const fileName = downloadFilenameInput.value;
  if (!url || !fileName) {
    updateStatus('Please provide both URL and filename.');
    return;
  }

  updateStatus(`Downloading ${fileName} from ${url}...`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const blob = await response.blob();

    // Convert Blob to Base64 to save with Filesystem API
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      const base64data = reader.result.split(',')[1]; // Get base64 content
      
      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64data,
        directory: Directory.Documents, // Or Directory.Downloads for publicly accessible files
        recursive: true
      });

      updateStatus(`File saved to: ${result.uri}`);
      alert(`File "${fileName}" downloaded and saved to Documents.`);
    };
    reader.onerror = (error) => {
        updateStatus(`Failed to read blob: ${error.message}`);
    };

  } catch (err) {
    updateStatus(`Download failed: ${err.message}`);
  }
});

// --- 3. Microphone (Web MediaDevices API) ---
startRecordBtn.addEventListener('click', async () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    updateStatus('MediaDevices API not supported.');
    alert('Microphone recording not supported in this browser/device.');
    return;
  }

  updateStatus('Requesting microphone access...');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    updateStatus('Recording started...');
    startRecordBtn.disabled = true;
    stopRecordBtn.disabled = false;
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const audioUrl = URL.createObjectURL(audioBlob);
      audioPlayback.src = audioUrl;
      updateStatus('Recording stopped. Playback available.');
      stream.getTracks().forEach(track => track.stop()); // Stop microphone stream
    };

    mediaRecorder.start();

  } catch (err) {
    updateStatus(`Microphone access denied or error: ${err.message}`);
    alert(`Error accessing microphone: ${err.message}. Please check permissions.`);
    startRecordBtn.disabled = false;
    stopRecordBtn.disabled = true;
  }
});

stopRecordBtn.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    startRecordBtn.disabled = false;
    stopRecordBtn.disabled = true;
  }
});


// --- 4. File Import (Standard HTML Input) ---
selectFileBtn.addEventListener('click', () => {
  fileInput.click(); // Trigger the hidden file input
});

fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    updateStatus(`Selected file: ${file.name}`);
    const reader = new FileReader();
    reader.onload = (e) => {
      fileContentPre.textContent = e.target.result;
    };
    reader.onerror = (e) => {
      fileContentPre.textContent = `Error reading file: ${e.message}`;
    };
    reader.readAsText(file); // Or readAsDataURL, readAsArrayBuffer
  } else {
    updateStatus('No file selected.');
    fileContentPre.textContent = '';
  }
});
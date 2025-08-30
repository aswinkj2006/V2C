document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const recordBtn = document.getElementById('record-btn');
    const promptInput = document.getElementById('prompt-input');
    const generateBtn = document.getElementById('generate-btn');
    const languageSelect = document.getElementById('language-select');
    const codeOutput = document.getElementById('code-output');
    const copyBtn = document.getElementById('copy-btn');
    const apiKeyInput = document.getElementById('api-key');
    const refineBtn = document.getElementById('refine-btn');
    const refineLines = document.getElementById('refine-lines');
    const refineRequest = document.getElementById('refine-request');
    const loader = document.getElementById('loader');
    const transcriptionStatus = document.getElementById('transcription-status');
    const translationInfo = document.getElementById('translation-info');
    const globalStatus = document.getElementById('global-status');

    // State
    let isRecording = false;
    let mediaRecorder;
    let audioChunks = [];

    // --- Helper Functions ---
    const showLoader = (show) => {
        loader.style.display = show ? 'flex' : 'none';
    };

    const showStatus = (element, message, type = 'info', duration = 0) => {
        element.textContent = message;
        element.className = `status-message ${type}`;
        element.style.display = message ? 'block' : 'none';
        if (duration > 0) {
            setTimeout(() => {
                element.textContent = '';
                element.style.display = 'none';
            }, duration);
        }
    };

    // --- Voice Recording ---
    recordBtn.addEventListener('click', async () => {
        if (isRecording) {
            mediaRecorder.stop();
            isRecording = false;
            recordBtn.classList.remove('recording');
            recordBtn.title = 'Record Voice';
            showStatus(transcriptionStatus, 'Processing audio...');
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];

                mediaRecorder.ondataavailable = event => {
                    audioChunks.push(event.data);
                };

                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                    const formData = new FormData();
                    formData.append('audio_data', audioBlob);

                    try {
                        const response = await fetch('/api/transcribe', {
                            method: 'POST',
                            body: formData,
                        });
                        const data = await response.json();
                        if (response.ok) {
                            promptInput.value = data.text;
                            showStatus(transcriptionStatus, '');
                        } else {
                            throw new Error(data.error || 'Transcription failed');
                        }
                    } catch (error) {
                        showStatus(transcriptionStatus, `Error: ${error.message}`, 'error', 5000);
                    } finally {
                        stream.getTracks().forEach(track => track.stop()); // Release microphone
                    }
                };

                mediaRecorder.start();
                isRecording = true;
                recordBtn.classList.add('recording');
                recordBtn.title = 'Stop Recording';
                showStatus(transcriptionStatus, 'Recording... Click again to stop.');
            } catch (error) {
                showStatus(globalStatus, 'Error: Could not access microphone. Please grant permission.', 'error', 5000);
            }
        }
    });

    // --- Code Generation ---
    generateBtn.addEventListener('click', async () => {
        const text = promptInput.value.trim();
        const language = languageSelect.value;
        const apiKey = apiKeyInput.value.trim();

        if (!text || !apiKey) {
            showStatus(globalStatus, 'Please provide a command and your API key.', 'error', 5000);
            return;
        }

        showLoader(true);
        showStatus(globalStatus, '');
        showStatus(translationInfo, '');
        
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, language, apiKey }),
            });
            const data = await response.json();
            if (response.ok) {
                codeOutput.textContent = data.code;
                if (data.translation.is_translated) {
                    const info = `Original language detected as ${data.translation.original_lang}. Translated to English for the AI.`;
                    showStatus(translationInfo, info);
                }
            } else {
                throw new Error(data.error || 'Failed to generate code.');
            }
        } catch (error) {
            codeOutput.textContent = `# Error: ${error.message}`;
            showStatus(globalStatus, `Error: ${error.message}`, 'error', 5000);
        } finally {
            showLoader(false);
        }
    });

    // --- Code Refinement ---
    refineBtn.addEventListener('click', async () => {
        const code = codeOutput.textContent;
        const language = languageSelect.value;
        const lines = refineLines.value.trim();
        const request = refineRequest.value.trim();
        const apiKey = apiKeyInput.value.trim();

        if (!code || !request || !apiKey) {
            showStatus(globalStatus, 'Please ensure there is code to refine, a refinement request, and an API key.', 'error', 5000);
            return;
        }

        showLoader(true);
        showStatus(globalStatus, '');

        try {
            const response = await fetch('/api/refine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, language, lines, request, apiKey }),
            });
            const data = await response.json();
            if (response.ok) {
                codeOutput.textContent = data.code;
                refineLines.value = '';
                refineRequest.value = '';
            } else {
                throw new Error(data.error || 'Failed to refine code.');
            }
        } catch (error) {
            showStatus(globalStatus, `Refinement Error: ${error.message}`, 'error', 5000);
        } finally {
            showLoader(false);
        }
    });

    // --- Copy to Clipboard ---
    copyBtn.addEventListener('click', () => {
        const codeToCopy = codeOutput.textContent;
        navigator.clipboard.writeText(codeToCopy).then(() => {
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Copied!</span>`;
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
            }, 2000);
        }).catch(err => {
            showStatus(globalStatus, 'Failed to copy code to clipboard.', 'error', 3000);
        });
    });
});
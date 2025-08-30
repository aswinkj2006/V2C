let isRecording = false;
let recognition;
let currentCode = '';
let highlightedLines = [];
let voiceEditState = 'idle'; // idle, listening_for_lines, listening_for_modification
let currentProject = null;
let currentFile = 'main.py';
let fileContents = {};
let codeHistory = [];
let isBlindMode = false;
let blindModeRecognition;
let blindMicActive = false;
let blindModeStep = 'input'; // 'input', 'confirm', 'code', 'edit'
let currentBlindPrompt = '';
let blindEditCommand = '';
let descriptionReadOnce = false;
let currentTTSUtterance = null;

// Voice command keywords
const voiceKeywords = {
    'edit line': 'Edit specific line numbers (e.g., "edit line 5" or "edit line 3 to 7")',
    'read code': 'Read code line by line',
    'read description': 'Read code description',
    'new prompt': 'Start a new code generation',
    'copy': 'Copy current code to clipboard',
    'download': 'Download current code',
    'proceed': 'Confirm and proceed with prompt',
    'keywords': 'Speak all available voice commands and their descriptions'
};

// Initialize speech recognition
if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    
    recognition.onstart = function() {
        updateStatus('Listening...');
    };
    
    recognition.onresult = function(event) {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }
        
        document.getElementById('transcript').value = finalTranscript + interimTranscript;
    };
    
    recognition.onerror = function(event) {
        updateStatus('Speech recognition error: ' + event.error);
        stopRecording();
    };
    
    recognition.onend = function() {
        stopRecording();
    };
}

function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    if (!recognition) {
        updateStatus('Speech recognition not supported');
        return;
    }
    
    const voiceLang = document.getElementById('voiceLanguage').value;
    if (voiceLang !== 'auto') {
        recognition.lang = voiceLang;
    }
    
    recognition.start();
    isRecording = true;
    
    const btn = document.getElementById('recordBtn');
    btn.textContent = '🛑 Stop Recording';
    btn.classList.add('recording');
}

function stopRecording() {
    if (recognition) {
        recognition.stop();
    }
    isRecording = false;
    
    const btn = document.getElementById('recordBtn');
    btn.textContent = '🎤 Start Recording';
    btn.classList.remove('recording');
    
    updateStatus('Recording stopped');
}

async function generateCode() {
    const transcript = document.getElementById('transcript').value.trim();
    let programmingLang = document.getElementById('programmingLanguage').value;
    
    if (!transcript) {
        updateStatus('Please provide voice input or text description');
        return;
    }
    
    // Auto-detect language from prompt and update filename
    if (programmingLang === 'auto') {
        programmingLang = detectLanguageFromPrompt(transcript);
        document.getElementById('programmingLanguage').value = programmingLang;
    }
    
    // Update filename based on detected language
    updateFilenameFromLanguage(programmingLang);
    
    updateStatus('Generating code...');
    document.getElementById('generateBtn').disabled = true;
    
    try {
        // Check if this should be a multi-file project
        const projectResponse = await fetch('/create_multi_file_project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                description: transcript,
                language: programmingLang
            })
        });
        
        const projectData = await projectResponse.json();
        
        if (projectData.success && projectData.project_data.is_multi_file) {
            // Create multiple file tabs
            fileContents = {};
            document.getElementById('editorTabs').innerHTML = '<button class="add-tab-btn" onclick="addNewTab()"><i class="fas fa-plus"></i></button>';
            
            for (const file of projectData.project_data.files) {
                fileContents[file.filename] = file.content;
                createTab(file.filename);
            }
            
            // Switch to first file
            const firstFile = projectData.project_data.files[0].filename;
            switchToTab(firstFile);
            
            updateStatus('Multi-file project created successfully');
        } else {
            // Single file generation
            const response = await fetch('/generate_code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: transcript,
                    language: programmingLang
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                currentCode = data.code;
                document.getElementById('codeArea').value = currentCode;
                fileContents[currentFile] = currentCode;
                updateCodeDisplay();
                updateLineNumbers();
                updateStatus('Code generated successfully');
            } else {
                updateStatus('Error: ' + data.error);
            }
        }
        
        // Save to history
        saveToHistory();
        
        // Generate and display code description
        await generateCodeDescription();
        
        // Show edit panel
        document.getElementById('editPanel').classList.add('show');
        
    } catch (error) {
        updateStatus('Network error: ' + error.message);
    } finally {
        document.getElementById('generateBtn').disabled = false;
    }
}

async function generateCodeDescription() {
    try {
        const response = await fetch('/generate_description', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: currentCode,
                language: document.getElementById('programmingLanguage').value
            })
        });
        
        const data = await response.json();
        if (data.success) {
            const descriptionDiv = document.getElementById('codeDescription');
            descriptionDiv.innerHTML = `<strong>Code Description:</strong><br>${data.description}`;
            
            // Speak description in blind mode or if TTS is enabled
            if (isBlindMode || ttsEnabled) {
                speakText(`Code generated. Description: ${data.description}`);
            }
        }
    } catch (error) {
        console.error('Error generating description:', error);
    }
}

function updateCodeDisplay() {
    const codeDisplay = document.getElementById('codeDisplay');
    const programmingLang = document.getElementById('programmingLanguage').value;
    
    codeDisplay.textContent = currentCode;
    codeDisplay.className = `language-${programmingLang}`;
    
    // Re-highlight with Prism
    if (typeof Prism !== 'undefined') {
        Prism.highlightElement(codeDisplay);
    }
}

function updateLineNumbers() {
    const lines = currentCode.split('\n').length;
    const lineNumbers = document.getElementById('lineNumbers');
    
    let numbersHTML = '';
    for (let i = 1; i <= lines; i++) {
        numbersHTML += i + '\n';
    }
    lineNumbers.textContent = numbersHTML;
}

function highlightLines() {
    const range = document.getElementById('lineRange').value.trim();
    clearHighlight();
    
    if (!range) return;
    
    const codeArea = document.getElementById('codeArea');
    const lines = codeArea.value.split('\n');
    
    try {
        let startLine, endLine;
        
        if (range.includes('-')) {
            const parts = range.split('-');
            startLine = parseInt(parts[0]) - 1;
            endLine = parseInt(parts[1]) - 1;
        } else {
            startLine = endLine = parseInt(range) - 1;
        }
        
        if (startLine < 0 || endLine >= lines.length || startLine > endLine) {
            updateStatus('Invalid line range');
            return;
        }
        
        highlightedLines = [startLine, endLine];
        updateStatus(`Lines ${startLine + 1}-${endLine + 1} highlighted`);
        
    } catch (error) {
        updateStatus('Invalid line range format');
    }
}

function clearHighlight() {
    highlightedLines = [];
    updateStatus('Highlight cleared');
}

async function modifyCode() {
    const modification = document.getElementById('modificationText').value.trim();
    
    if (!modification) {
        updateStatus('Please describe the modification');
        return;
    }
    
    if (highlightedLines.length === 0) {
        updateStatus('Please highlight lines to modify');
        return;
    }
    
    updateStatus('Modifying code...');
    
    try {
        const lines = currentCode.split('\n');
        const selectedLines = lines.slice(highlightedLines[0], highlightedLines[1] + 1).join('\n');
        
        const response = await fetch('/modify_code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                original_code: currentCode,
                selected_lines: selectedLines,
                line_start: highlightedLines[0] + 1,
                line_end: highlightedLines[1] + 1,
                modification: modification,
                language: document.getElementById('programmingLanguage').value
            }),
        });

        const data = await response.json();

        if (data.success) {
            currentCode = data.modified_code;
            document.getElementById('codeArea').value = currentCode;
            fileContents[currentFile] = currentCode;
            saveToHistory();
            updateCodeDisplay();
            updateLineNumbers();
            clearHighlight();
            document.getElementById('modificationText').value = '';
            
            // Update filename after code generation based on actual content
            const detectedLanguage = document.getElementById('programmingLanguage').value;
            const newFilename = getLanguageFileName(detectedLanguage, '', currentCode);
            
            if (newFilename !== currentFile) {
                // Update file mapping
                delete fileContents[currentFile];
                currentFile = newFilename;
                fileContents[currentFile] = currentCode;
                
                // Update tab name
                updateTabName(currentFile);
            }
            updateStatus('Code modified successfully');
        } else {
            updateStatus('Error: ' + data.error);
        }
    } catch (error) {
        updateStatus('Network error: ' + error.message);
    }
}

function clearAll() {
    document.getElementById('transcript').value = '';
    document.getElementById('codeArea').value = '';
    document.getElementById('codeDisplay').textContent = '';
    document.getElementById('modificationText').value = '';
    document.getElementById('lineRange').value = '';
    currentCode = '';
    clearHighlight();
    document.getElementById('editPanel').classList.remove('show');
    updateStatus('All cleared');
}

function updateStatus(message) {
    document.getElementById('statusBar').textContent = message;
}

// Enhanced Button Functions
async function explainCode() {
    if (!currentCode) {
        updateStatus('No code to explain');
        return;
    }

    try {
        const response = await fetch('/explain_code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: currentCode,
                language: document.getElementById('programmingLanguage').value,
                audio_output: ttsEnabled || isBlindMode
            })
        });

        const data = await response.json();
        if (data.success) {
            showModal('Code Explanation', data.explanation);
            if (isBlindMode || ttsEnabled) {
                speakText(data.explanation);
            }
        }
    } catch (error) {
        updateStatus('Error explaining code: ' + error.message);
    }
}

async function detectBugs() {
    if (!currentCode) {
        updateStatus('No code to analyze');
        return;
    }

    updateStatus('Analyzing code for bugs...');

    try {
        const response = await fetch('/debug_code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: currentCode,
                language: document.getElementById('programmingLanguage').value
            })
        });

        const data = await response.json();
        if (data.success) {
            // Console output removed - just show debug info in status
            updateStatus('Debug analysis complete');

            if (isBlindMode) {
                speakText('Debug analysis complete.');
            }
            updateStatus('Debug analysis complete');
        }
    } catch (error) {
        updateStatus('Error analyzing code: ' + error.message);
    }
}

async function formatCode() {
    if (!currentCode) {
        updateStatus('No code to format');
        return;
    }

    try {
        const response = await fetch('/format_code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: currentCode,
                language: document.getElementById('programmingLanguage').value
            })
        });

        const data = await response.json();
        if (data.success) {
            currentCode = data.formatted_code;
            document.getElementById('codeArea').value = currentCode;
            fileContents[currentFile] = currentCode;
            updateCodeDisplay();
            updateLineNumbers();
            updateStatus('Code formatted successfully');

            if (isBlindMode) {
                speakText('Code formatted successfully');
            }
        }
    } catch (error) {
        updateStatus('Error formatting code: ' + error.message);
    }
}

async function runCode() {
    if (!currentCode) {
        updateStatus('No code to run');
        return;
    }

    const language = document.getElementById('programmingLanguage').value;
    // Console output removed
    updateStatus('Code execution removed - use preview for HTML/JS');

    try {
        if (language === 'javascript') {
            // JavaScript execution removed
            updateStatus('JavaScript execution removed - use browser preview');
        } else if (language === 'html') {
            // Create HTML preview
            const previewWindow = window.open('', '_blank');
            previewWindow.document.write(currentCode);
            previewWindow.document.close();
            updateStatus('HTML opened in new window');
        } else {
            // Server-side execution
            const response = await fetch('/run_code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: currentCode,
                    language: language
                })
            });

            const data = await response.json();
            if (data.success) {
                // Console output removed - just show status
                updateStatus('Code execution removed');
            } else {
                updateStatus(`Error: ${data.error}`);
            }
        }

        updateStatus('Code execution complete');

        if (isBlindMode) {
            speakText('Code execution complete. Check console for output.');
        }

    } catch (error) {
        updateStatus('Error executing code: ' + error.message);
    }
}

// Enhanced Blind Mode Functions
function toggleBlindMode() {
    isBlindMode = !isBlindMode;
    const blindInterface = document.getElementById('blindModeInterface');
    const mainContainer = document.querySelector('.main-container');
    
    if (isBlindMode) {
        blindInterface.classList.remove('hidden');
        mainContainer.style.display = 'none';
        initializeBlindMode();
        resetBlindModeState();
        displayVoiceKeywords();
        speakText('Blind mode activated. Available commands: ' + Object.keys(voiceKeywords).join(', ') + '. Press space or M to start recording your prompt.');
    } else {
        // Stop TTS when exiting blind mode
        stopTTS();
        blindInterface.classList.add('hidden');
        mainContainer.style.display = 'flex';
    }
}

function resetBlindModeState() {
    blindModeStep = 'input';
    currentBlindPrompt = '';
    blindEditCommand = '';
    descriptionReadOnce = false;
    
    // Hide all sections except prompt input
    document.getElementById('blindConfirmSection').classList.add('hidden');
    document.getElementById('blindCodeSection').classList.add('hidden');
    document.getElementById('blindEditSection').classList.add('hidden');
    
    // Reset displays
    document.getElementById('blindPromptText').textContent = 'Waiting for voice input...';
    document.getElementById('blindVoiceStatus').textContent = 'Ready - Press SPACE or M to start';
    document.getElementById('blindCurrentAction').textContent = 'Waiting for voice input';
}

function toggleBlindMic() {
    // Stop TTS immediately when mic is activated
    stopTTS();
    
    blindMicActive = !blindMicActive;
    const micButton = document.getElementById('blindMicToggle');
    const status = document.getElementById('blindVoiceStatus');

    if (blindMicActive) {
        micButton.innerHTML = '<i class="fas fa-microphone"></i> Mic ON';
        micButton.classList.add('active');
        
        if (blindModeStep === 'input') {
            status.textContent = 'Recording your prompt - Speak now';
            document.getElementById('blindCurrentAction').textContent = 'Listening for your prompt...';
        } else if (blindModeStep === 'edit') {
            status.textContent = 'Recording edit command - Speak now';
            document.getElementById('blindCurrentAction').textContent = 'Listening for edit command...';
        } else if (blindModeStep === 'confirm') {
            status.textContent = 'Say "proceed" or "edit prompt"';
            document.getElementById('blindCurrentAction').textContent = 'Waiting for confirmation...';
        }

        // Start recognition immediately since TTS is stopped
        if (blindModeRecognition && blindMicActive) {
            blindModeRecognition.start();
        }
    } else {
        micButton.innerHTML = '<i class="fas fa-microphone"></i> Mic OFF';
        micButton.classList.remove('active');
        status.textContent = 'Press SPACE or M to activate microphone';

        if (blindModeRecognition) {
            blindModeRecognition.stop();
        }
    }
}

function initializeBlindMode() {
    // Initialize blind mode speech recognition
    if ('webkitSpeechRecognition' in window) {
        blindModeRecognition = new webkitSpeechRecognition();
        blindModeRecognition.continuous = false;
        blindModeRecognition.interimResults = false;
        
        blindModeRecognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            handleBlindModeInput(transcript);
        };
        
        blindModeRecognition.onend = function() {
            blindMicActive = false;
            const micButton = document.getElementById('blindMicToggle');
            micButton.innerHTML = '<i class="fas fa-microphone"></i> Mic OFF';
            micButton.classList.remove('active');
        };
    }
}

async function handleBlindModeInput(transcript) {
    if (blindModeStep === 'input') {
        // Auto-detect language if needed
        const currentLanguage = document.getElementById('programmingLanguage').value;
        let detectedLanguage = currentLanguage;
        if (currentLanguage === 'auto') {
            detectedLanguage = detectLanguageFromPrompt(transcript);
            document.getElementById('programmingLanguage').value = detectedLanguage;
        }
        
        // Update filename based on detected language
        updateFilenameFromLanguage(detectedLanguage);
        
        currentBlindPrompt = transcript;
        document.getElementById('blindPromptText').textContent = transcript;
        document.getElementById('blindCurrentAction').textContent = 'Prompt recorded. Confirming...';
        
        // Show confirmation section
        document.getElementById('confirmPromptText').textContent = transcript;
        document.getElementById('blindConfirmSection').classList.remove('hidden');
        
        // Read back the prompt and auto-enable mic for confirmation
        const confirmUtterance = new SpeechSynthesisUtterance(`I heard: ${transcript}. Say proceed to generate code or edit prompt to record again.`);
        confirmUtterance.rate = 0.8;
        confirmUtterance.onend = function() {
            // Auto-enable mic after TTS finishes completely
            setTimeout(() => {
                if (blindModeStep === 'confirm') {
                    blindMicActive = true;
                    toggleBlindMic();
                }
            }, 1000);
        };
        speechSynthesis.speak(confirmUtterance);
        
        blindModeStep = 'confirm';
        
    } else if (blindModeStep === 'confirm') {
        const command = transcript.toLowerCase();
        
        if (command.includes('proceed') || command.includes('generate') || command.includes('continue') || command.includes('yes')) {
            proceedWithPrompt();
        } else if (command.includes('edit') || command.includes('change') || command.includes('modify') || command.includes('no')) {
            editPrompt();
        } else {
            speakText('Please say proceed to generate code or edit prompt to record again.');
            // Keep mic active for another attempt
            setTimeout(() => {
                if (blindModeStep === 'confirm') {
                    blindMicActive = true;
                    toggleBlindMic();
                }
            }, 2000);
        }
        
    } else if (blindModeStep === 'code') {
        // Handle voice commands during code step
        handleVoiceCommands(transcript);
        
    } else if (blindModeStep === 'editInput') {
        // Handle edit description input - use AI to process the edit
        speakText(`Processing edit request for line ${blindEditStartLine}${blindEditEndLine !== blindEditStartLine ? ` to ${blindEditEndLine}` : ''}`);
        
        // Apply the AI-powered edit
        await applyAILineEdit(blindEditStartLine, blindEditEndLine, transcript);
        
        blindModeStep = 'code';
        
    } else if (blindModeStep === 'edit') {
        blindEditCommand = transcript;
        document.getElementById('editCommandText').textContent = transcript;
        document.getElementById('blindEditConfirm').classList.remove('hidden');
        
        // Read back the edit command
        speakText(`Edit command: ${transcript}. Do you want to apply this edit?`);
    }
}

function parseVoiceEditCommand(command) {
    const numberWords = {
        'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
        'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
        // Spanish
        'cero': 0, 'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5, 'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10
    };

    // Replace number words with digits
    let processedCommand = command.toLowerCase();
    for (const word in numberWords) {
        const regex = new RegExp(`\\b${word}\\b`, 'g');
        processedCommand = processedCommand.replace(regex, numberWords[word]);
    }

    // Enhanced regex to capture line range and modification in one command
    // Matches patterns like: "in line 5 change variable to count" or "line 3 to 7 add error handling"
    const fullCommandMatch = processedCommand.match(/(?:in\s+)?(?:line|línea)s?\s*(\d+)(?:\s*(?:to|-|a)\s*(\d+))?\s*(.+)/i);
    
    if (fullCommandMatch) {
        const start = parseInt(fullCommandMatch[1]);
        const end = fullCommandMatch[2] ? parseInt(fullCommandMatch[2]) : start;
        const modification = fullCommandMatch[3].trim();
        
        return { 
            start, 
            end, 
            modification,
            hasModification: modification.length > 0
        };
    }
    
    // Fallback: just line numbers
    const lineMatch = processedCommand.match(/(?:line|línea)\s*(\d+)(?:\s*(?:to|-|a)\s*(\d+))?/i);
    if (lineMatch) {
        const start = parseInt(lineMatch[1]);
        const end = lineMatch[2] ? parseInt(lineMatch[2]) : start;
        return { start, end, modification: '', hasModification: false };
    }
    
    return null;
}

// Enhanced Voice Edit Function
function startVoiceEdit() {
    if (isRecording) {
        stopRecording();
    }

    const btn = document.getElementById('voiceEditBtn');
    btn.innerHTML = '<i class="fas fa-stop"></i> Stop Voice Edit';
    btn.classList.add('recording');
    btn.onclick = stopVoiceEdit;

    updateStatus('Voice edit active: Say "in line X change..." or "line X to Y modify..."');

    recognition.onresult = async function(event) {
        const command = event.results[event.results.length - 1][0].transcript.trim();
        
        const parsedCommand = parseVoiceEditCommand(command);
        
        if (parsedCommand) {
            const { start, end, modification, hasModification } = parsedCommand;
            
            // Set line range and highlight
            document.getElementById('lineRange').value = `${start}-${end}`;
            highlightLines();
            
            if (highlightedLines.length > 0) {
                if (hasModification) {
                    // Complete command with modification - apply immediately
                    document.getElementById('modificationText').value = modification;
                    updateStatus(`Applying changes to lines ${start}-${end}...`);
                    await modifyCode();
                    updateStatus('Voice edit complete. Say another command or stop voice edit.');
                } else {
                    // Only line numbers specified - wait for modification
                    updateStatus(`Lines ${start}-${end} highlighted. Now state your modification.`);
                    voiceEditState = 'listening_for_modification';
                    // Restart recognition to continue listening
                    setTimeout(() => {
                        if (voiceEditState === 'listening_for_modification') {
                            recognition.start();
                        }
                    }, 500);
                }
            } else {
                updateStatus('Invalid line range. Please specify valid line numbers.');
            }
        } else {
            // Check if we're waiting for modification after line selection
            if (voiceEditState === 'listening_for_modification' && highlightedLines.length > 0) {
                document.getElementById('modificationText').value = command;
                await modifyCode();
                voiceEditState = 'idle';
                updateStatus('Modification complete. Say another command or stop voice edit.');
            } else {
                updateStatus('Command not recognized. Say "in line X change..." or "line X to Y modify..."');
            }
        }
    };
    
    recognition.onend = function() {
        // Auto-restart if we're still in voice edit mode
        if (voiceEditState !== 'idle') {
            setTimeout(() => {
                if (voiceEditState !== 'idle') {
                    recognition.start();
                }
            }, 100);
        }
    };
    
    recognition.continuous = true;
    recognition.start();
}

function stopVoiceEdit() {
    if (recognition) {
        recognition.stop();
    }
    voiceEditState = 'idle';
    recognition.continuous = true; // Reset to default

    const btn = document.getElementById('voiceEditBtn');
    btn.innerHTML = '<i class="fas fa-microphone-alt"></i> Voice Edit';
    btn.classList.remove('recording');
    btn.onclick = startVoiceEdit;

    // Restore default recognition behavior
    recognition.onresult = function(event) {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }
        document.getElementById('transcript').value = finalTranscript + interimTranscript;
    };

    updateStatus('Voice edit mode stopped.');
}

async function processVoiceEditCommand(command) {
    try {
        const response = await fetch('/voice_command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                command: command,
                code: currentCode,
                language: document.getElementById('programmingLanguage').value
            })
        });

        const data = await response.json();
        if (data.success && data.action === 'modify_lines') {
            document.getElementById('lineRange').value = `${data.start_line}-${data.end_line}`;
            document.getElementById('modificationText').value = data.modification;
            highlightLines();
        }
    } catch (error) {
        console.error('Error processing voice command:', error);
    }
}

// History Management Functions
function saveToHistory() {
    const historyEntry = {
        code: currentCode,
        file: currentFile,
        timestamp: new Date().toISOString(),
        description: `Modified ${currentFile}`
    };
    
    codeHistory.push(historyEntry);
    currentHistoryIndex = codeHistory.length - 1;
    
    // Keep only last 50 versions
    if (codeHistory.length > 50) {
        codeHistory.shift();
        currentHistoryIndex--;
    }
}

function showHistory() {
    if (codeHistory.length === 0) {
        alert('No history available');
        return;
    }
    
    let historyHTML = '<div class="history-list">';
    codeHistory.forEach((entry, index) => {
        const date = new Date(entry.timestamp).toLocaleString();
        historyHTML += `
            <div class="history-item ${index === currentHistoryIndex ? 'current' : ''}" onclick="restoreFromHistory(${index})">
                <div class="history-info">
                    <strong>${entry.description}</strong>
                    <span class="history-date">${date}</span>
                </div>
                <div class="history-preview">${entry.code.substring(0, 100)}...</div>
            </div>
        `;
    });
    historyHTML += '</div>';
    
    showModal('Version History', historyHTML);
}

function restoreFromHistory(index) {
    if (index >= 0 && index < codeHistory.length) {
        const entry = codeHistory[index];
        currentCode = entry.code;
        currentFile = entry.file;
        currentHistoryIndex = index;
        
        document.getElementById('codeArea').value = currentCode;
        fileContents[currentFile] = currentCode;
        updateCodeDisplay();
        updateLineNumbers();
        updateStatus(`Restored to version from ${new Date(entry.timestamp).toLocaleString()}`);
        
        closeModal('dynamicModal');
        
        if (isBlindMode) {
            speakText('Code restored successfully');
        }
}
}

// Console functions removed

// GitHub Integration Functions
let githubToken = localStorage.getItem('github_token');
let githubRepo = localStorage.getItem('github_repo');
let githubUser = localStorage.getItem('github_user');

async function showGitHub() {
    if (!githubToken) {
        // Show login modal
        document.getElementById('githubModal').classList.remove('hidden');
    } else {
        // Show commit dialog for existing setup
        showCommitDialog();
    }
}

async function authenticateGitHub() {
    const token = document.getElementById('githubToken').value.trim();
    
    if (!token) {
        updateStatus('Please enter your GitHub token');
        return;
    }
    
    updateStatus('Authenticating with GitHub...');
    
    try {
        // Verify token by getting user info
        const response = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (response.ok) {
            const userData = await response.json();
            githubToken = token;
            githubUser = userData.login;
            
            // Save credentials
            localStorage.setItem('github_token', token);
            localStorage.setItem('github_user', userData.login);
            
            updateStatus(`Authenticated as ${userData.login}`);
            
            // Show repository options
            document.getElementById('githubAuth').style.display = 'none';
            document.getElementById('githubRepoOptions').style.display = 'block';
            
        } else {
            throw new Error('Invalid token or authentication failed');
        }
    } catch (error) {
        updateStatus('GitHub authentication failed: ' + error.message);
    }
}

async function createNewRepo() {
    const repoName = document.getElementById('repoName').value.trim();
    const description = document.getElementById('repoDescription').value.trim();
    const isPrivate = document.getElementById('isPrivate').checked;
    
    if (!repoName) {
        updateStatus('Please enter a repository name');
        return;
    }
    
    updateStatus('Creating GitHub repository...');
    
    try {
        const response = await fetch('https://api.github.com/user/repos', {
            method: 'POST',
            headers: {
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: repoName,
                description: description || 'Project created with V2C Voice-to-Code',
                private: isPrivate,
                auto_init: true
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            githubRepo = repoName;
            localStorage.setItem('github_repo', repoName);
            
            updateStatus(`Repository ${repoName} created successfully`);
            closeModal('githubModal');
            
            // Automatically commit current files
            setTimeout(() => commitToGitHub(), 1000);
            
        } else {
            throw new Error(data.message || 'Failed to create repository');
        }
    } catch (error) {
        updateStatus('Repository creation failed: ' + error.message);
    }
}

function showCommitDialog() {
    const commitMessage = prompt('Enter commit message:', 'Updated code via V2C');
    if (commitMessage) {
        commitToGitHub(commitMessage);
    }
}

async function commitToGitHub(commitMessage = 'Updated code via V2C') {
    if (!githubToken || !githubRepo || !githubUser) {
        showGitHub();
        return;
    }
    
    if (!currentCode && Object.keys(fileContents).length === 0) {
        updateStatus('No code to commit');
        return;
    }
    
    updateStatus('Committing to GitHub...');
    
    try {
        // Get current files or use current code
        const filesToCommit = Object.keys(fileContents).length > 0 ? fileContents : { [currentFile]: currentCode };
        
        // Commit each file
        for (const [filename, content] of Object.entries(filesToCommit)) {
            await commitSingleFile(filename, content, commitMessage);
        }
        
        updateStatus(`Successfully committed to ${githubUser}/${githubRepo}`);
        
        if (isBlindMode) {
            speakText('Code committed to GitHub successfully');
        }
        
    } catch (error) {
        updateStatus('GitHub commit failed: ' + error.message);
    }
}

async function commitSingleFile(filename, content, commitMessage) {
    // Get current file SHA if it exists
    let sha = null;
    try {
        const getResponse = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/contents/${filename}`, {
            headers: {
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (getResponse.ok) {
            const fileData = await getResponse.json();
            sha = fileData.sha;
        }
    } catch (error) {
        // File doesn't exist, which is fine for new files
    }
    
    // Commit the file
    const commitData = {
        message: commitMessage,
        content: btoa(unescape(encodeURIComponent(content))), // Base64 encode
        branch: 'main'
    };
    
    if (sha) {
        commitData.sha = sha; // Required for updating existing files
    }
    
    const response = await fetch(`https://api.github.com/repos/${githubUser}/${githubRepo}/contents/${filename}`, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(commitData)
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to commit ${filename}`);
    }
}

function resetGitHubAuth() {
    githubToken = null;
    githubRepo = null;
    githubUser = null;
    localStorage.removeItem('github_token');
    localStorage.removeItem('github_repo');
    localStorage.removeItem('github_user');
    
    document.getElementById('githubAuth').style.display = 'block';
    document.getElementById('githubRepoOptions').style.display = 'none';
    document.getElementById('githubToken').value = '';
    document.getElementById('repoName').value = '';
    document.getElementById('repoDescription').value = '';
    
    updateStatus('GitHub authentication reset');
}


// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    updateStatus('Ready - V2C Voice to Code Assistant');

    // Load saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        document.getElementById('themeToggle').innerHTML = '<i class="fas fa-moon"></i>';
    } else {
        // Default to dark mode
        document.body.classList.remove('light-theme');
        document.getElementById('themeToggle').innerHTML = '<i class="fas fa-sun"></i>';
    }

    // Initialize file contents
    fileContents[currentFile] = '';

    // Check if speech recognition is supported
    if (!('webkitSpeechRecognition' in window)) {
        updateStatus('Speech recognition not supported in this browser');
        document.getElementById('recordBtn').disabled = true;
    }

    // Keyboard shortcuts - Ctrl+B for blind mode, M for microphone
    document.addEventListener('keydown', function(e) {
        if (e.key === 'b' || e.key === 'B') {
            if (e.ctrlKey) {
                e.preventDefault();
                toggleBlindMode();
            }
        }
        
        if (e.key === 'm' || e.key === 'M') {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                if (isBlindMode) {
                    toggleBlindMic();
                } else {
                    // Use the same function as the record button
                    const recordBtn = document.getElementById('recordBtn');
                    recordBtn.click();
                }
            }
        }
    });

    // Update line info on cursor movement
    document.getElementById('codeArea').addEventListener('click', updateCursorInfo);
    document.getElementById('codeArea').addEventListener('keyup', updateCursorInfo);
});

function updateCursorInfo() {
    const codeArea = document.getElementById('codeArea');
    const cursorPos = codeArea.selectionStart;
    const textBeforeCursor = codeArea.value.substring(0, cursorPos);
    const line = textBeforeCursor.split('\n').length;
    const column = textBeforeCursor.split('\n').pop().length + 1;

    document.getElementById('lineInfo').textContent = `Line ${line}, Column ${column}`;
}

// Handle file upload
document.getElementById('audioFile').addEventListener('change', async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    
    updateStatus('Processing audio file...');
    
    const formData = new FormData();
    formData.append('audio', file);
    
    try {
        const response = await fetch('/process_audio', {
            method: 'POST',
            body: formData,
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('transcript').value = data.text;
            updateStatus('Audio processed successfully');
        } else {
            updateStatus('Error processing audio: ' + data.error);
        }
    } catch (error) {
        updateStatus('Error uploading audio: ' + error.message);
    }
});

// Enhanced text-to-speech function with control
function speakText(text) {
    if ('speechSynthesis' in window) {
        // Stop any current speech
        stopTTS();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.7; // Slower rate for better clarity
        utterance.pitch = 1;
        utterance.volume = 1;
        
        // Add event listeners to handle interruptions
        utterance.onstart = function() {
            currentTTSUtterance = utterance;
        };
        
        utterance.onend = function() {
            currentTTSUtterance = null;
        };
        
        utterance.onerror = function(event) {
            console.log('TTS Error:', event);
            currentTTSUtterance = null;
        };
        
        // Ensure speech synthesis is ready
        if (speechSynthesis.paused) {
            speechSynthesis.resume();
        }
        
        speechSynthesis.speak(utterance);
    }
}

function stopTTS() {
    if (speechSynthesis.speaking || speechSynthesis.pending) {
        speechSynthesis.cancel();
    }
    currentTTSUtterance = null;
}

function showModal(title, content) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('dynamicModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'dynamicModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="modalTitle">${title}</h3>
                    <button class="close-btn" onclick="closeModal('dynamicModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="modalContent">${content}</div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalContent').innerHTML = content;
    }
    modal.classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function stopVoiceEdit() {
    if (recognition) {
        recognition.stop();
    }
    const btn = document.getElementById('voiceEditBtn');
    btn.innerHTML = '<i class="fas fa-microphone"></i> Voice Edit';
    btn.onclick = startVoiceEdit;
    updateStatus('Voice edit stopped');
}

// Blind Mode Workflow Functions
async function proceedWithPrompt() {
    document.getElementById('blindConfirmSection').classList.add('hidden');
    document.getElementById('blindCurrentAction').textContent = 'Generating code...';
    
    speakText('Proceeding with code generation');
    
    try {
        // Set the prompt in the main transcript area and generate code
        document.getElementById('transcript').value = currentBlindPrompt;
        await generateCode();
        
        // Show code section and populate it
        document.getElementById('blindCodeSection').classList.remove('hidden');
        document.getElementById('blindCodeArea').textContent = currentCode;
        
        // Generate and show description
        try {
            await generateCodeDescription();
            const descriptionDiv = document.getElementById('codeDescription');
            if (descriptionDiv && descriptionDiv.textContent && descriptionDiv.textContent.trim()) {
                // Extract just the description text, removing the "Code Description:" prefix
                const fullText = descriptionDiv.textContent;
                const description = fullText.replace(/^Code Description:\s*/i, '').trim();
                document.getElementById('blindDescriptionText').textContent = description;
            } else {
                // Fallback description if generation fails
                document.getElementById('blindDescriptionText').textContent = `Generated ${currentFile} with the requested functionality based on your prompt: "${currentBlindPrompt}"`;
            }
        } catch (descError) {
            // Fallback description if generation fails
            console.log('Description generation failed:', descError);
            document.getElementById('blindDescriptionText').textContent = `Generated ${currentFile} with the requested functionality based on your prompt: "${currentBlindPrompt}"`;
        }
        
        blindModeStep = 'code';
        document.getElementById('blindCurrentAction').textContent = 'Code generated successfully';
        
        // Simple message after code generation
        setTimeout(() => {
            speakText('Code generated successfully.');
        }, 1000);
        
    } catch (error) {
        speakText('Error generating code: ' + error.message);
        document.getElementById('blindCurrentAction').textContent = 'Error generating code';
    }
}

function editPrompt() {
    document.getElementById('blindConfirmSection').classList.add('hidden');
    document.getElementById('blindPromptText').textContent = 'Waiting for voice input...';
    document.getElementById('blindCurrentAction').textContent = 'Ready for new prompt';
    
    blindModeStep = 'input';
    currentBlindPrompt = '';
    
    speakText('Recording new prompt now. Speak your updated prompt.');
    
    // Auto-enable mic for new prompt
    setTimeout(() => {
        blindMicActive = true;
        toggleBlindMic();
    }, 2000);
}

async function readCodeLineByLine() {
    if (!currentCode) {
        speakText('No code to read');
        return;
    }
    
    const lines = currentCode.split('\n');
    let codeText = '';
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
            codeText += `Line ${i + 1}: ${line}. `;
        }
    }
    
    speakText(`Reading code: ${codeText}`);
}

function readDescription() {
    const description = document.getElementById('blindDescriptionText').textContent;
    if (description) {
        speakText(`Code description: ${description}`);
    } else {
        speakText('No code description available');
    }
}

async function runCodeBlind() {
    if (!currentCode) {
        speakText('No code to run');
        return;
    }
    
    speakText('Running code');
    document.getElementById('blindCurrentAction').textContent = 'Executing code...';
    
    try {
        // Use the existing runCode logic but update blind mode console
        const language = document.getElementById('programmingLanguage').value;
        
        if (language === 'javascript') {
            speakText('JavaScript execution removed');
        } else {
            // Server-side execution
            const response = await fetch('/run_code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: currentCode,
                    language: language
                })
            });
            
            const data = await response.json();
            if (data.success) {
                // Console output removed
                speakText('Code execution removed');
            } else {
                speakText(`Error: ${data.error}`);
            }
        }
        
        document.getElementById('blindCurrentAction').textContent = 'Code execution complete';
        
    } catch (error) {
        speakText(`Error: ${error.message}`);
        document.getElementById('blindCurrentAction').textContent = 'Execution failed';
    }
}

// Console output function removed

// Console clear function removed

function showBlindEditSection() {
    document.getElementById('blindEditSection').classList.remove('hidden');
    blindModeStep = 'edit';
    speakText('Edit mode activated. Press the voice edit button and speak your edit command.');
}

function startBlindEdit() {
    blindModeStep = 'edit';
    toggleBlindMic();
}

async function executeBlindEdit() {
    if (!blindEditCommand) {
        speakText('No edit command to execute');
        return;
    }
    
    document.getElementById('blindEditConfirm').classList.add('hidden');
    document.getElementById('blindCurrentAction').textContent = 'Applying edit...';
    
    try {
        // Process the edit command
        await processVoiceEditCommand(blindEditCommand);
        
        // Update the blind mode code display
        document.getElementById('blindCodeArea').textContent = currentCode;
        
        speakText('Edit applied successfully');
        document.getElementById('blindCurrentAction').textContent = 'Edit completed';
        
        // Hide edit section
        document.getElementById('blindEditSection').classList.add('hidden');
        
    } catch (error) {
        speakText('Error applying edit: ' + error.message);
        document.getElementById('blindCurrentAction').textContent = 'Edit failed';
    }
}

function cancelBlindEdit() {
    document.getElementById('blindEditConfirm').classList.add('hidden');
    blindEditCommand = '';
    speakText('Edit cancelled');
}

function downloadBlindCode() {
    if (!currentCode) {
        speakText('No code to download');
        return;
    }
    
    const blob = new Blob([currentCode], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFile;
    a.click();
    
    speakText('Code downloaded successfully');
}

function startNewBlindPrompt() {
    resetBlindModeState();
    speakText('Ready for new prompt. Press space or M to start recording.');
}

// Auto-detect programming language from prompt
function detectProgrammingLanguage(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('html') || lowerPrompt.includes('webpage') || lowerPrompt.includes('website')) {
        return 'html';
    } else if (lowerPrompt.includes('css') || lowerPrompt.includes('style')) {
        return 'css';
    } else if (lowerPrompt.includes('javascript') || lowerPrompt.includes('js') || lowerPrompt.includes('react') || lowerPrompt.includes('node')) {
        return 'javascript';
    } else if (lowerPrompt.includes('java') && !lowerPrompt.includes('javascript')) {
        return 'java';
    } else if (lowerPrompt.includes('c++') || lowerPrompt.includes('cpp')) {
        return 'cpp';
    } else if (lowerPrompt.includes(' c ') || lowerPrompt.includes('c program') || lowerPrompt.includes('c code')) {
        return 'c';
    } else if (lowerPrompt.includes('python') || lowerPrompt.includes('py')) {
        return 'python';
    } else {
        return 'python'; // Default fallback
    }
}

// Update file extension based on language
function updateFileExtension() {
    const language = document.getElementById('programmingLanguage').value;
    const extensions = {
        'python': '.py',
        'javascript': '.js',
        'java': '.java',
        'cpp': '.cpp',
        'c': '.c',
        'html': '.html',
        'css': '.css'
    };
    
    const extension = extensions[language] || '.py';
    const baseName = language === 'java' ? 'Main' : 'main';
    currentFile = baseName + extension;
    
    // Update tab name helper function
    function updateTabName(filename) {
        const activeTab = document.querySelector('.tab.active');
        if (activeTab) {
            const span = activeTab.querySelector('span');
            if (span) {
                span.textContent = filename;
            } else {
                activeTab.querySelector('span, .tab-close').previousSibling.textContent = filename;
            }
            activeTab.setAttribute('data-file', filename);
        }
    }
    updateTabName(currentFile);
}

// Handle voice commands during code step
function handleVoiceCommands(transcript) {
    const command = transcript.toLowerCase();
    
    // Stop TTS when processing commands
    stopTTS();
    
    if (command.includes('keywords')) {
        speakAllKeywords();
    } else if (command.includes('edit line')) {
        handleEditLineCommand(command, transcript);
    } else if (command.includes('read code')) {
        readCodeLineByLine();
    } else if (command.includes('read description')) {
        readDescription();
    } else if (command.includes('new prompt')) {
        startNewBlindPrompt();
    } else if (command.includes('copy')) {
        copyCodeToClipboard();
    } else if (command.includes('download')) {
        downloadBlindCode();
    } else {
        speakText('Command not recognized. Say keywords to hear all available commands.');
    }
}

// Handle edit line commands with better range parsing
function handleEditLineCommand(command, originalTranscript) {
    // Improved regex to handle "2 to 7", "2 through 7", "2-7" but not "207"
    const lineMatch = command.match(/edit line[s]?\s*(\d+)(?:\s+(?:to|through)\s+(\d+)|\s*-\s*(\d+))?/);
    
    if (lineMatch) {
        const startLine = parseInt(lineMatch[1]);
        const endLine = lineMatch[2] ? parseInt(lineMatch[2]) : (lineMatch[3] ? parseInt(lineMatch[3]) : startLine);
        
        // Get the current lines to provide context
        const lines = currentCode.split('\n');
        const contextLines = [];
        
        for (let i = startLine - 1; i <= endLine - 1; i++) {
            if (i >= 0 && i < lines.length) {
                contextLines.push(`Line ${i + 1}: ${lines[i]}`);
            }
        }
        
        const contextText = contextLines.join('. ');
        const editUtterance = new SpeechSynthesisUtterance(`Editing line ${startLine}${endLine !== startLine ? ` to ${endLine}` : ''}. Current content: ${contextText}. Tell me what changes you want to make.`);
        editUtterance.rate = 0.7;
        editUtterance.onend = function() {
            // Auto-enable mic after TTS finishes completely
            setTimeout(() => {
                if (blindModeStep === 'editInput') {
                    blindMicActive = true;
                    toggleBlindMic();
                }
            }, 500);
        };
        
        // Set up for edit input
        blindModeStep = 'editInput';
        blindEditStartLine = startLine;
        blindEditEndLine = endLine;
        
        speechSynthesis.speak(editUtterance);
    } else {
        speakText('Please specify line numbers. Say "edit line 5" or "edit line 3 to 7"');
    }
}

// Copy code to clipboard function
function copyCodeToClipboard() {
    if (!currentCode) {
        speakText('No code to copy');
        return;
    }
    
    navigator.clipboard.writeText(currentCode).then(() => {
        speakText('Code copied to clipboard');
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = currentCode;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        speakText('Code copied to clipboard');
    });
}

// AI-powered line edit function (like normal mode)
async function applyAILineEdit(startLine, endLine, editDescription) {
    const lines = currentCode.split('\n');
    
    // Convert to 0-based indexing
    const start = startLine - 1;
    const end = endLine - 1;
    
    if (start >= 0 && start < lines.length) {
        // Get current lines for context
        const currentLines = [];
        for (let i = start; i <= Math.min(end, lines.length - 1); i++) {
            currentLines.push(lines[i]);
        }
        
        const currentContent = currentLines.join('\n');
        const language = document.getElementById('programmingLanguage').value;
        
        // Get surrounding context (5 lines before and after)
        const contextStart = Math.max(0, start - 5);
        const contextEnd = Math.min(lines.length - 1, end + 5);
        const surroundingContext = [];
        
        for (let i = contextStart; i <= contextEnd; i++) {
            surroundingContext.push(`${i + 1}: ${lines[i]}`);
        }
        
        try {
            // Use AI to process the edit request with full context
            const response = await fetch('/modify_code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: currentCode, // Send FULL original code
                    modification: `${editDescription}. Target lines ${startLine}-${endLine}: ${currentContent}`,
                    line_range: `${startLine}-${endLine}`,
                    language: language,
                    original_code: currentCode, // Explicitly provide original code
                    target_lines: currentContent,
                    surrounding_context: surroundingContext.join('\n'),
                    instruction: `Modify the ${language} code. Original code is provided. Target lines ${startLine} to ${endLine} contain: "${currentContent}". User wants to: ${editDescription}. Please modify ONLY the specified lines while maintaining code structure and syntax.`
                })
            });
            
            const data = await response.json();
            if (data.success && data.modified_code) {
                currentCode = data.modified_code;
                document.getElementById('codeArea').value = currentCode;
                document.getElementById('blindCodeArea').textContent = currentCode;
                
                // Update file contents
                fileContents[currentFile] = currentCode;
                
                // Add to history
                codeHistory.push({
                    timestamp: new Date().toLocaleString(),
                    code: currentCode,
                    description: `Voice edit: ${editDescription}`
                });
                
                speakText('Edit applied successfully');
            } else {
                speakText('Error processing edit: ' + (data.error || 'No modified code returned'));
                console.log('Edit response:', data);
            }
        } catch (error) {
            speakText('Error applying edit: ' + error.message);
            console.error('Edit error:', error);
        }
    } else {
        speakText('Invalid line number');
    }
}

// Speak all keywords and their descriptions
function speakAllKeywords() {
    let keywordsList = 'Available voice commands: ';
    for (const [command, description] of Object.entries(voiceKeywords)) {
        keywordsList += `${command}: ${description}. `;
    }
    speakText(keywordsList);
}

// Display voice keywords in UI
function displayVoiceKeywords() {
    const keywordsContainer = document.getElementById('blindVoiceKeywords');
    if (keywordsContainer) {
        let keywordsHTML = '<h4>Available Voice Commands:</h4><ul>';
        for (const [command, description] of Object.entries(voiceKeywords)) {
            keywordsHTML += `<li><strong>${command}</strong>: ${description}</li>`;
        }
        keywordsHTML += '</ul>';
        keywordsContainer.innerHTML = keywordsHTML;
    }
}

// Add global event listeners to stop TTS on any button click
document.addEventListener('DOMContentLoaded', function() {
    // Stop TTS on any button click
    document.addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
            stopTTS();
        }
    });
    
    // Auto-detect language on normal mode too
    const transcriptArea = document.getElementById('transcript');
    if (transcriptArea) {
        transcriptArea.addEventListener('input', function() {
            const text = this.value;
            if (text.length > 10) { // Only detect after some text is entered
                const detectedLanguage = detectProgrammingLanguage(text);
                document.getElementById('programmingLanguage').value = detectedLanguage;
                updateFileExtension();
            }
        });
    }
});

// Tab Management Functions
function createTab(filename) {
    const tabsContainer = document.getElementById('editorTabs');
    const addBtn = tabsContainer.querySelector('.add-tab-btn');
    
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.dataset.filename = filename;
    tab.innerHTML = `
        <span>${filename}</span>
        <button class="close-tab" onclick="closeTab('${filename}')">&times;</button>
    `;
    tab.onclick = () => switchToTab(filename);
    
    tabsContainer.insertBefore(tab, addBtn);
}

function switchToTab(filename) {
    // Save current file content
    if (currentFile && fileContents[currentFile] !== undefined) {
        fileContents[currentFile] = document.getElementById('codeArea').value;
    }
    
    // Switch to new file
    currentFile = filename;
    currentCode = fileContents[filename] || '';
    document.getElementById('codeArea').value = currentCode;
    
    // Update tab appearance
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.filename === filename) {
            tab.classList.add('active');
        }
    });
    
    updateCodeDisplay();
    updateLineNumbers();
}

function closeTab(filename) {
    if (Object.keys(fileContents).length <= 1) {
        alert('Cannot close the last tab');
        return;
    }
    
    delete fileContents[filename];
    document.querySelector(`[data-filename="${filename}"]`).remove();
    
    if (currentFile === filename) {
        const remainingFiles = Object.keys(fileContents);
        switchToTab(remainingFiles[0]);
    }
}

function addNewTab() {
    const language = document.getElementById('programmingLanguage').value;
    let filename = getDefaultFileName(language);
    let counter = 1;
    
    while (fileContents[filename]) {
        filename = getDefaultFileName(language, counter);
        counter++;
    }
    
    fileContents[filename] = '';
    createTab(filename);
    switchToTab(filename);
}

// Dynamic file naming based on language and code content
function getLanguageFileName(language, suffix = '', codeContent = '') {
    // For Java, try to extract class name
    if (language === 'java' && codeContent) {
        const classMatch = codeContent.match(/public\s+class\s+(\w+)/);
        if (classMatch) {
            return `${classMatch[1]}${suffix}.java`;
        }
    }
    
    // For other languages, detect from code content if auto-detect
    if (language === 'auto' && codeContent) {
        language = detectLanguageFromCode(codeContent);
    }
    
    switch (language) {
        case 'python':
            return `main${suffix}.py`;
        case 'javascript':
            return `main${suffix}.js`;
        case 'java':
            return `Main${suffix}.java`;
        case 'cpp':
        case 'c++':
            return `main${suffix}.cpp`;
        case 'c':
            return `main${suffix}.c`;
        case 'html':
            return `index${suffix}.html`;
        case 'css':
            return `style${suffix}.css`;
        case 'sql':
            return `query${suffix}.sql`;
        case 'bash':
            return `script${suffix}.sh`;
        case 'swift':
            return `main${suffix}.swift`;
        default:
            return `file${suffix}.txt`;
    }
}

// Auto-detect programming language from code content
function detectLanguageFromCode(code) {
    if (!code) return 'python';
    
    const codeStr = code.toLowerCase();
    
    // Java detection
    if (codeStr.includes('public class') || codeStr.includes('public static void main')) {
        return 'java';
    }
    
    // JavaScript detection
    if (codeStr.includes('function') || codeStr.includes('const ') || codeStr.includes('let ') || codeStr.includes('var ')) {
        return 'javascript';
    }
    
    // C++ detection
    if (codeStr.includes('#include <iostream>') || codeStr.includes('std::')) {
        return 'cpp';
    }
    
    // C detection
    if (codeStr.includes('#include <stdio.h>') || codeStr.includes('printf(')) {
        return 'c';
    }
    
    // HTML detection
    if (codeStr.includes('<html>') || codeStr.includes('<!doctype')) {
        return 'html';
    }
    
    // SQL detection
    if (codeStr.includes('select ') || codeStr.includes('insert ') || codeStr.includes('update ') || 
        codeStr.includes('delete ') || codeStr.includes('create table') || codeStr.includes('alter table')) {
        return 'sql';
    }
    
    // Python detection (default fallback)
    return 'python';
}

// Auto-detect programming language from prompt text
function detectLanguageFromPrompt(prompt) {
    if (!prompt) return 'python';
    
    const promptStr = prompt.toLowerCase();
    
    // SQL detection from prompt keywords
    if (promptStr.includes('sql') || promptStr.includes('database') || promptStr.includes('query') ||
        promptStr.includes('select') || promptStr.includes('insert') || promptStr.includes('update') ||
        promptStr.includes('delete') || promptStr.includes('table') || promptStr.includes('mysql') ||
        promptStr.includes('postgresql') || promptStr.includes('sqlite')) {
        return 'sql';
    }
    
    // Java detection
    if (promptStr.includes('java') || promptStr.includes('spring') || promptStr.includes('maven')) {
        return 'java';
    }
    
    // JavaScript detection
    if (promptStr.includes('javascript') || promptStr.includes('js') || promptStr.includes('node') ||
        promptStr.includes('react') || promptStr.includes('vue') || promptStr.includes('angular')) {
        return 'javascript';
    }
    
    // C++ detection
    if (promptStr.includes('c++') || promptStr.includes('cpp')) {
        return 'cpp';
    }
    
    // C detection
    if (promptStr.includes(' c ') || promptStr.includes('c programming')) {
        return 'c';
    }
    
    // HTML detection
    if (promptStr.includes('html') || promptStr.includes('web page') || promptStr.includes('website')) {
        return 'html';
    }
    
    // Python detection (default fallback)
    return 'python';
}

// Update filename based on programming language
function updateFilenameFromLanguage(language) {
    const languageExtensions = {
        'python': '.py',
        'javascript': '.js',
        'java': '.java',
        'cpp': '.cpp',
        'c': '.c',
        'html': '.html',
        'css': '.css',
        'sql': '.sql',
        'php': '.php',
        'ruby': '.rb',
        'go': '.go',
        'rust': '.rs',
        'swift': '.swift',
        'kotlin': '.kt',
        'typescript': '.ts'
    };
    
    const extension = languageExtensions[language] || '.py';
    const baseName = language === 'javascript' ? 'script' : 
                    language === 'html' ? 'index' :
                    language === 'css' ? 'style' :
                    language === 'sql' ? 'query' :
                    'main';
    
    const newFilename = baseName + extension;
    
    // Update current file name
    currentFile = newFilename;
    
    // Update the active tab
    const activeTab = document.querySelector('.tab.active');
    if (activeTab) {
        const tabSpan = activeTab.querySelector('span');
        if (tabSpan) {
            tabSpan.textContent = newFilename;
        }
        activeTab.setAttribute('data-file', newFilename);
    }
    
    // Update file contents mapping
    if (fileContents['main.py'] && !fileContents[newFilename]) {
        fileContents[newFilename] = fileContents['main.py'];
        delete fileContents['main.py'];
    }
}

// Export Functions
function exportProject() {
    if (!currentCode && Object.keys(fileContents).length === 0) {
        updateStatus('No code to export');
        return;
    }

    const hasMultipleFiles = Object.keys(fileContents).length > 1;
    
    if (hasMultipleFiles) {
        // Export multiple files as ZIP
        exportAsZip();
    } else {
        // Export single file
        exportSingleFile();
    }
}

function exportSingleFile() {
    const content = currentCode || fileContents[currentFile] || '';
    const filename = currentFile || 'code.txt';
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    updateStatus(`File ${filename} downloaded successfully`);
    
    if (isBlindMode) {
        speakText('File exported successfully');
    }
}

async function exportAsZip() {
    try {
        const response = await fetch('/export_project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                files: fileContents,
                project_name: 'v2c_project'
            })
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'v2c_project.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            updateStatus('Project exported as ZIP successfully');
        } else {
            throw new Error('Export failed');
        }
    } catch (error) {
        updateStatus('Export failed: ' + error.message);
        // Fallback to individual file downloads
        exportAllFilesIndividually();
    }
    
    if (isBlindMode) {
        speakText('Project exported successfully');
    }
}

function exportAllFilesIndividually() {
    Object.entries(fileContents).forEach(([filename, content]) => {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    });
    updateStatus('All files downloaded individually');
}

// Theme Management
function toggleTheme() {
    const body = document.body;
    const themeToggle = document.getElementById('themeToggle');
    
    if (body.classList.contains('light-theme')) {
        body.classList.remove('light-theme');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        localStorage.setItem('theme', 'dark');
    } else {
        body.classList.add('light-theme');
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        localStorage.setItem('theme', 'light');
    }
}
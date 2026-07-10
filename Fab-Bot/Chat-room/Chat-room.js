document.addEventListener('DOMContentLoaded', () => {
    const inputElement = document.getElementById('input');
    const promptButton = document.querySelector('.search-btn');
    const chatContainer = document.querySelector('.container');
    const clearChatsBtn = document.getElementById('clear-btn');
    const modeButtons = document.querySelectorAll('.mode-btn'); // buttons with data-mode="cybersec" | "generaltech" | "general"
    const installBtn = document.getElementById('install-app-btn');

    // --- Configuration ---
    // If you're running the frontend with Live Server (port 5500), it can't
    // serve /api serverless functions — those only work via `vercel dev` or
    // real Vercel production. So: if we detect Live Server's default port,
    // fall back to a standalone backend on localhost:3000 (run with
    // `node api/chat.js` directly). Otherwise use the relative path, which
    // is correct for both `vercel dev` and production.
    const isLiveServer = window.location.port === '5500';
    const API_ENDPOINT = isLiveServer ? 'http://localhost:3000/api/chat' : '/api/chat';
    const STORAGE_KEY = 'fabBotChatHistory';
    const MODE_STORAGE_KEY = 'fabBotMode';
    const VALID_MODES = ['cybersec', 'generaltech', 'general'];
    const DEFAULT_MODE = 'general';

    if (!inputElement || !promptButton || !chatContainer) {
        console.error('chat-room.js: required DOM elements not found. Check your markup selectors.');
        return;
    }

    // Configure markdown parser once, if available
    if (typeof marked !== 'undefined') {
        marked.setOptions({ breaks: true, gfm: true });
    }

    let isStreaming = false;
    let currentMode = loadMode();

    applyActiveModeStyling();
    loadChatHistory();
    setupInstallPrompt();

    /**
     * Reads the saved mode from localStorage, falling back to the default
     * if nothing is saved or the saved value isn't one of the known modes.
     */
    function loadMode() {
        const saved = localStorage.getItem(MODE_STORAGE_KEY);
        return VALID_MODES.includes(saved) ? saved : DEFAULT_MODE;
    }

    /**
     * Highlights whichever mode button matches currentMode.
     */
    function applyActiveModeStyling() {
        modeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === currentMode);
        });
    }

    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const newMode = btn.dataset.mode;
            if (!VALID_MODES.includes(newMode) || newMode === currentMode) return;
            currentMode = newMode;
            localStorage.setItem(MODE_STORAGE_KEY, currentMode);
            applyActiveModeStyling();
        });
    });


    /**
     * Converts raw markdown text into sanitized HTML.
     * Falls back to safely-escaped plain text if the libraries aren't loaded.
     */
    function renderMarkdown(rawText) {
        if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
            console.warn('marked/DOMPurify not loaded — falling back to plain text.');
            const escapeDiv = document.createElement('div');
            escapeDiv.textContent = rawText;
            return escapeDiv.innerHTML;
        }
        const dirtyHtml = marked.parse(rawText);
        return DOMPurify.sanitize(dirtyHtml);
    }

    /**
     * Creates and appends a message bubble to the UI.
     * AI messages are rendered as sanitized markdown->HTML.
     * User messages stay as plain text (safe, and doesn't need formatting).
     */
    function addMessage(sender, text, isLoader = false) {
        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add(`${sender}-bubble`);

        const idSpan = document.createElement('span');
        idSpan.className = 'id';
        idSpan.textContent = sender === 'user' ? 'User' : 'Ai';

        messageWrapper.appendChild(idSpan);
        messageWrapper.appendChild(document.createElement('br'));
        messageWrapper.appendChild(document.createElement('br'));

        const contentEl = document.createElement('div');
        contentEl.className = 'msg-content';

        if (isLoader) {
            contentEl.innerHTML = '<div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
        } else if (sender === 'ai') {
            contentEl.innerHTML = renderMarkdown(text);
        } else {
            contentEl.textContent = text; // user input: plain text, never HTML
        }

        messageWrapper.appendChild(contentEl);
        chatContainer.appendChild(messageWrapper);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        return messageWrapper;
    }

    /**
     * Adds a "Copy" button to an AI bubble. Copies the raw markdown text
     * (not the rendered HTML) so pasting elsewhere keeps it editable.
     */
    function addCopyButton(messageWrapper, text) {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.textContent = 'Copy';
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(text).then(() => {
                copyBtn.textContent = 'Copied!';
                setTimeout(() => (copyBtn.textContent = 'Copy'), 2000);
            }).catch(err => console.error('Copy failed:', err));
        };
        messageWrapper.appendChild(copyBtn);
    }

    function setBusy(busy) {
        isStreaming = busy;
        inputElement.disabled = busy;
        promptButton.disabled = busy;
    }

    /**
     * Main handler for streaming the AI response
     */
    async function handlePrompt() {
        if (isStreaming) return;
        const userPrompt = inputElement.value.trim();
        if (!userPrompt) return;

        setBusy(true);
        addMessage('user', userPrompt);
        inputElement.value = '';

        const aiBubble = addMessage('ai', '', true);
        const aiContent = aiBubble.querySelector('.msg-content');

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: userPrompt }],
                    mode: currentMode
                })
            });

            if (!response.ok) {
                throw new Error(`Server responded with status ${response.status}`);
            }
            if (!response.body) {
                throw new Error('No response body received from server.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiResponseText = '';
            aiContent.textContent = ''; // remove loader dots

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const json = JSON.parse(line.substring(6));
                            const content = json?.choices?.[0]?.delta?.content;
                            if (content) {
                                aiResponseText += content;
                                // Plain text while streaming: fast, and avoids
                                // rendering half-finished markdown syntax mid-token.
                                aiContent.textContent = aiResponseText;
                                chatContainer.scrollTop = chatContainer.scrollHeight;
                            }
                        } catch (e) {
                            /* ignore parse errors for incomplete chunks */
                        }
                    }
                }
            }

            // Once the full response has arrived, render it as formatted markdown
            aiContent.innerHTML = renderMarkdown(aiResponseText);
            chatContainer.scrollTop = chatContainer.scrollHeight;

            addCopyButton(aiBubble, aiResponseText);
            saveChatHistory(userPrompt, aiResponseText);
        } catch (error) {
            aiContent.textContent = 'Error: Could not connect to the AI service.';
            console.error(error);
        } finally {
            setBusy(false);
        }
    }

    function saveChatHistory(user, ai) {
        let history = [];
        try {
            history = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch (e) {
            console.warn('Corrupted chat history in localStorage, resetting.', e);
        }
        history.push({ user, ai });
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        } catch (e) {
            console.error('Failed to save chat history:', e);
        }
    }

    function loadChatHistory() {
        let history = [];
        try {
            history = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch (e) {
            console.warn('Corrupted chat history in localStorage, ignoring.', e);
        }
        history.forEach(entry => {
            addMessage('user', entry.user);
            const bubble = addMessage('ai', entry.ai);
            addCopyButton(bubble, entry.ai);
        });
    }

    promptButton.addEventListener('click', handlePrompt);
    inputElement.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handlePrompt();
        }
    });

    clearChatsBtn?.addEventListener('click', () => {
        localStorage.removeItem(STORAGE_KEY);
        chatContainer.innerHTML = '';
    });

    /**
     * Registers the service worker (required for installability in most
     * browsers) and wires up the "Install App" button using the native
     * beforeinstallprompt flow. Chromium browsers only (Chrome, Edge,
     * Brave) — Firefox and Safari don't support this API, so the button
     * simply never appears there, which is expected.
     */
    function setupInstallPrompt() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js')
                    .catch(err => console.error('Service worker registration failed:', err));
            });
        }

        if (!installBtn) return; // button not present in this page's markup

        let deferredInstallPrompt = null;
        installBtn.hidden = true; // hidden until the browser confirms install is available

        window.addEventListener('beforeinstallprompt', (event) => {
            event.preventDefault();
            deferredInstallPrompt = event;
            installBtn.hidden = false;
        });

        installBtn.addEventListener('click', async () => {
            if (!deferredInstallPrompt) return;
            deferredInstallPrompt.prompt();
            const { outcome } = await deferredInstallPrompt.userChoice;
            console.log(`Install prompt outcome: ${outcome}`);
            deferredInstallPrompt = null;
            installBtn.hidden = true;
        });

        window.addEventListener('appinstalled', () => {
            installBtn.hidden = true;
            deferredInstallPrompt = null;
        });
    }
});
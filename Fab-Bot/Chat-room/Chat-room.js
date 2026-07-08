document.addEventListener('DOMContentLoaded', () => {
    const inputElement = document.getElementById('input');
    const promptButton = document.querySelector('.search-btn');
    const chatContainer = document.querySelector('.container');
    const clearChatsBtn = document.getElementById('clear-btn');

    // --- Configuration ---
    // Point this at your actual backend (not the Live Server port, e.g. 5500).
    // 3000 matches the commented-out version you had earlier — adjust as needed.
    const API_ENDPOINT = 'http://localhost:3000/api/chat';
    const STORAGE_KEY = 'fabBotChatHistory';

    // Bail out early with a console warning instead of throwing if markup changed
    if (!inputElement || !promptButton || !chatContainer) {
        console.error('chat-room.js: required DOM elements not found. Check your markup selectors.');
        return;
    }

    let isStreaming = false;

    loadChatHistory();

    /**
     * Creates and appends a message bubble to the UI.
     * Uses textContent for user-supplied text to avoid XSS via innerHTML.
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

        const p = document.createElement('p');
        if (isLoader) {
            p.innerHTML = '<div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
        } else {
            p.textContent = text; // safe: never interpreted as HTML
        }
        messageWrapper.appendChild(p);

        chatContainer.appendChild(messageWrapper);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        return messageWrapper;
    }

    /**
     * Adds a "Copy" button to an AI bubble
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
        if (isStreaming) return; // prevent overlapping requests
        const userPrompt = inputElement.value.trim();
        if (!userPrompt) return;

        setBusy(true);
        addMessage('user', userPrompt);
        inputElement.value = '';

        const aiBubble = addMessage('ai', '', true);
        const aiP = aiBubble.querySelector('p');

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: userPrompt }]
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
            aiP.textContent = ''; // remove loader dots

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
                                aiP.textContent = aiResponseText;
                                chatContainer.scrollTop = chatContainer.scrollHeight;
                            }
                        } catch (e) {
                            /* ignore parse errors for incomplete chunks */
                        }
                    }
                }
            }

            // Once finished, add the Copy button
            addCopyButton(aiBubble, aiResponseText);
            saveChatHistory(userPrompt, aiResponseText);
        } catch (error) {
            aiP.textContent = 'Error: Could not connect to the AI service.';
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
});
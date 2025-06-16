const API_KEY="AIzaSyDxtJ0fiCc41Bcxn2vBHMutrC2jSZcur7Q";
   
    
document.addEventListener('DOMContentLoaded', () => {
    const inputElement = document.getElementById('input');
    const promptButton = document.querySelector('.search-btn');
    const chatContainer = document.querySelector('.container'); // This is the main container for all messages

    // API Configuration
    const API_KEY = "AIzaSyDxtJ0fiCc41Bcxn2vBHMutrC2jSZcur7Q";
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

    // Storage Configuration
    const STORAGE_KEY = 'fabBotChatHistory';
    const useLocalStorage = true; // Set to true for localStorage, false for sessionStorage
    const storage = useLocalStorage ? localStorage : sessionStorage;

    // Load chat history on page load
    loadChatHistory();

    /**
     * Creates and appends a new chat message bubble to the chat container.
     * It mimics the structure of your original user/ai bubble HTML,
     * but uses classes instead of IDs for dynamic creation.
     *
     * @param {string} sender - 'user' or 'ai'
     * @param {string} text - The message content
     * @param {boolean} [isThinking=false] - Whether it's an AI 'thinking' state
     * @returns {HTMLElement} The created message bubble element.
     */
    function addMessage(sender, text, isThinking = false) {
        const messageWrapper = document.createElement('div');
        // We cannot use id="user-bubble" or id="ai-bubble" for dynamic elements
        // because IDs must be unique. Instead, we use classes to match your CSS.
        messageWrapper.classList.add(`${sender}-bubble`); // Will be "user-bubble" or "ai-bubble"

        // Build the inner HTML using template literals, matching your structure
        messageWrapper.innerHTML = `
            <span class="id">
                ${sender === 'user' ? 'User' : 'Ai'}
            </span><br />
            <br />
            <p class="${sender}">
                ${text}
            </p>
        `;

        if (isThinking) {
            messageWrapper.classList.add('thinking'); // For styling the 'Thinking...' state
        }
        
        chatContainer.appendChild(messageWrapper);

        // Scroll to the bottom of the chat container
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        // Return the created messageWrapper so its content can be updated later (e.g., AI response)
        return messageWrapper; 
    }

    function loadChatHistory() {
        const storedHistory = storage.getItem(STORAGE_KEY);
        if (storedHistory) {
            const history = JSON.parse(storedHistory);
            history.forEach(entry => {
                addMessage('user', entry.user);
                addMessage('ai', entry.ai);
            });
        }
    }

    function saveChatHistory(userPrompt, aiResponse) {
        let history = JSON.parse(storage.getItem(STORAGE_KEY)) || [];
        history.push({ user: userPrompt, ai: aiResponse });
        storage.setItem(STORAGE_KEY, JSON.stringify(history));
    }

    promptButton.addEventListener('click', async () => {
        const userPrompt = inputElement.value.trim();

        if (userPrompt) {
            // Add user's prompt bubble
            addMessage('user', userPrompt);

            // Clear the input field
            inputElement.value = '';

            // Add a "Thinking..." bubble for AI response
            // This bubble will be returned and its content updated later
            const aiThinkingBubble = addMessage('ai', 'Thinking...', true); 

            // --- START OF API CALL ---
            const payload = {
                contents: [
                    {
                        parts: [
                            {
                                text: userPrompt
                            }
                        ]
                    }
                ]
            };

            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`HTTP error! status: ${response.status}, details: ${JSON.stringify(errorData)}`);
                }

                const data = await response.json();
                console.log('Gemini API Response:', data);

                let aiResponseText = '';
                if (data && data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
                    aiResponseText = data.candidates[0].content.parts[0].text;
                } else {
                    aiResponseText = 'Error: Could not extract response from AI.';
                }

                // Update the <p> element within the AI thinking bubble
                aiThinkingBubble.querySelector(`p.${aiThinkingBubble.classList.contains('ai-bubble') ? 'ai' : ''}`).textContent = aiResponseText;
                aiThinkingBubble.classList.remove('thinking'); // Remove 'thinking' class

                // Save chat history
                saveChatHistory(userPrompt, aiResponseText);

            } catch (error) {
                console.error('Error fetching AI response:', error);
                const errorMessage = `Error: ${error.message}`;
                // Update the <p> element within the AI thinking bubble with error
                aiThinkingBubble.querySelector(`p.${aiThinkingBubble.classList.contains('ai-bubble') ? 'ai' : ''}`).textContent = errorMessage;
                aiThinkingBubble.classList.remove('thinking'); // Remove 'thinking' class

                // Save the error message as AI response in history
                saveChatHistory(userPrompt, errorMessage);
            }
            // --- END OF API CALL ---
        }
    });
});

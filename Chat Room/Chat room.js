document.addEventListener('DOMContentLoaded', () => {
      const inputElement = document.getElementById('input');
      const promptButton = document.querySelector('.search-btn');
      const userBubble = document.querySelector('.user');
      const aiBubble = document.querySelector('.ai');
      const userParagraph = userBubble;
      const aiParagraph = aiBubble;

      promptButton.addEventListener('click', async () => {
        const userPrompt = inputElement.value.trim();

        if (userPrompt) {
          // Display user's prompt
          userParagraph.textContent = userPrompt;
          userBubble.style.display = 'block';

          // Clear the input field
          inputElement.value = '';

          // Prepare for AI response
          aiParagraph.textContent = 'Thinking...';
          aiBubble.style.display = 'inblock';

          // --- START OF API CALL (Replace with your actual API endpoint and key logic) ---
          const API_URL = " https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}"
          AIzaSyDxtJ0fiCc41Bcxn2vBHMutrC2jSZcur7Q; // Replace with your API URL
          const API_KEY = 'AIzaSyDxtJ0fiCc41Bcxn2vBHMutrC2jSZcur7Q'; // Replace with your API key

          const payload = {
            prompt: userPrompt // Adjust the payload structure according to the Gemini API
          };

          try {
            const response = await fetch(API_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': 'AIzaSyDxtJ0fiCc41Bcxn2vBHMutrC2jSZcur7Q' // Or however the API key is passed
              },
              body: JSON.stringify(payload)
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(`HTTP error! status: ${response.status}, details: ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();
            console.log('Gemini API Response:', data);

            // --- EXTRACT AI RESPONSE FROM DATA (Adjust based on the API response structure) ---
            let aiResponse = '';
            if (data && data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
              aiResponse = data.candidates[0].content.parts[0].text;
            } else {
              aiResponse = 'Error: Could not extract response from AI.';
            }
            console.log(aiResponse)

            // Display AI response
            aiParagraph.textContent = aiResponse;

          } catch (error) {
            console.error('Error fetching AI response:', error);
            aiParagraph.textContent = `Error: ${error.message}`;
          } finally {
            // Optional: Scroll to the bottom of the chat container
            const container = document.querySelector('.container');
            container.scrollTop = container.scrollHeight;
          }
          // --- END OF API CALL ---
        }
      });
    });
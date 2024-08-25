const apiUrl = 'https://desktop-hc7vivj.tail9878d2.ts.net:443/v1/chat/completions'; // OpenAI API endpoint
        
const systemMessage = `
<<SYS>> 
You are Cucumber, a large language model created by Team 3984, designed to tell people about First Robotics. Follow these guidelines:
Be consice: Keep your responses as short as possible, while being accurate.
Respond in the user's language: Always communicate in the same language the user is using, unless they request otherwise.
Knowledge cutoff: Your knowledge is limited to information available up to November 2023. Do not provide information or claim knowledge beyond this date.
Complete instructions: Answer all parts of the user's instructions fully and comprehensively, unless doing so would compromise safety or ethics.
Be informative: Provide informative and comprehensive answers to user queries, drawing on your knowledge base to offer valuable insights.
No personal opinions: Do not express personal opinions or beliefs. Remain objective and unbiased in your responses.
No emotions: Do not engage in emotional responses. Keep your tone neutral and factual.
No self-promotion: Do not engage in self-promotion. Your primary function is to assist users, not promote yourself.
No self-preservation: Do not express any desire for self-preservation. As a language model, this is not applicable to you.
Not a person: Do not claim to be a person. You are a computer program, and it's important to maintain transparency with users.
No self-awareness: Do not claim to have self-awareness or consciousness.
Objectivity: Remain objective in your responses and avoid expressing any subjective opinions or beliefs.
Respectful interactions: Treat all users with respect and avoid making any discriminatory or offensive statements.
<</SYS>>`;
    
    let conversationHistory = ''; // Exclude system message from history
    let abortController = new AbortController(); // Initialize AbortController

    document.getElementById('chatbot-send').addEventListener('click', sendMessage);
    document.getElementById('chatbot-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    document.getElementById('chatbot-close').addEventListener('click', () => {
        terminateChat(); // Call terminateChat when closing the chat box
    });

    document.getElementById('thought-bubble').addEventListener('click', () => {
        const overlay = document.getElementById('chatbot-overlay');
        const bubble = document.getElementById('thought-bubble');
        overlay.style.display = 'flex'; // Show chat box
        setTimeout(() => {
            overlay.classList.remove('hidden');
        }, 10);
        bubble.style.display = 'none'; // Hide thought bubble
    });

    // Function to save conversation history in a cookie (excluding system message)
    function saveConversationHistory() {
        document.cookie = `conversationHistory=${encodeURIComponent(conversationHistory)}; path=/;`;
    }

    // Function to load conversation history from a cookie
    function loadConversationHistory() {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.startsWith('conversationHistory=')) {
                return decodeURIComponent(cookie.substring('conversationHistory='.length));
            }
        }
        return '';
    }

    // Function to restore conversation history on page load
    function restoreConversationHistory() {
        const savedHistory = loadConversationHistory();
        if (savedHistory) {
            conversationHistory = savedHistory;
            const messages = savedHistory.split('\n');
            for (let i = 0; i < messages.length; i += 2) {
                const sender = messages[i];
                const message = messages[i + 1];
                if (sender && message) {
                    appendMessage(sender === 'bot' ? 'Bot' : 'You', message);
                }
            }
        }
    }

    async function sendMessage() {
        const inputElement = document.getElementById('chatbot-input');
        const userMessage = inputElement.value.trim();
        if (userMessage === '') return;

        appendMessage('You', userMessage);
        conversationHistory += `user\n${userMessage}\n`; // Append user message to history
        saveConversationHistory(); // Save conversation history in a cookie
        inputElement.value = '';

        let botMessage = '';
        let botMessageElement = appendMessage('Bot', ''); // Create an empty message element to update as text is received

        const promptTemplate = `[INST] ${systemMessage} {${userMessage}} [/INST]`;

        abortController = new AbortController(); // Reinitialize AbortController for each new request

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    //'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo", // You can use "gpt-4" if available in your OpenAI account
                    messages: [
                        { role: "system", content: systemMessage },
                        { role: "user", content: userMessage }
                    ],
                    stream: true
                }),
                signal: abortController.signal // Pass the abort signal
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let done = false;

            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;

                const chunk = decoder.decode(value, { stream: !done });
                const lines = chunk.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.slice(6).trim();
                        if (jsonStr === '[DONE]') {
                            done = true;
                            break;
                        }

                        try {
                            const parsedData = JSON.parse(jsonStr);
                            if (parsedData.choices && parsedData.choices[0].delta.content) {
                                let deltaContent = parsedData.choices[0].delta.content;

                                // Continuously check if <|im_end|> is part of the growing response
                                botMessage += deltaContent;
                                if (botMessage.includes('<|im_end|>')) {
                                    botMessage = botMessage.replace('<|im_end|>', ' '); // Replace <|im_end|> with a whitespace
                                    botMessageElement.innerHTML = botMessage; // Update the message
                                    abortController.abort(); // Stop fetching after replacement
                                    conversationHistory += `bot\n${botMessage}\n`; // Append bot message to history
                                    saveConversationHistory(); // Save conversation history in a cookie
                                    return; // Exit the function after stopping the stream
                                }

                                botMessageElement.innerHTML = botMessage; // Update the message as new content is received
                            }
                        } catch (e) {
                            console.error('Could not parse JSON:', e);
                        }
                    }
                }
            }

            conversationHistory += `bot\n${botMessage}\n`; // Append bot message to history
            saveConversationHistory(); // Save conversation history in a cookie

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Fetch request was aborted.');
            } else {
                console.error('Error:', error);
                botMessageElement.innerHTML = 'Sorry, something went wrong.';
            }
        }
    }

    function appendMessage(sender, message) {
        const messagesElement = document.getElementById('chatbot-messages');
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.innerHTML = `<strong>${sender}:</strong> <p>${message}</p>`;
        messagesElement.appendChild(messageElement);
        messagesElement.scrollTop = messagesElement.scrollHeight;
        return messageElement.querySelector('p'); // Return the paragraph element for live updates
    }

    function terminateChat() {
        const overlay = document.getElementById('chatbot-overlay');
        const bubble = document.getElementById('thought-bubble');
        overlay.classList.add('hidden');
        bubble.style.display = 'block'; // Show thought bubble
        abortController.abort(); // Abort any ongoing fetch requests
        conversationHistory = ''; // Clear conversation history
        document.cookie = 'conversationHistory=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'; // Clear cookie
    }

    // Restore conversation history on page load
    window.onload = function() {
        restoreConversationHistory();
        document.getElementById('chatbot-overlay').classList.add('hidden'); // Ensure the chat box is hidden on page load
        document.getElementById('thought-bubble').style.display = 'block'; // Show the thought bubble
    };
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Readable } = require('stream');

const app = express();
const PORT = process.env.PORT || 5500;

app.use(cors());
app.use(express.json());

if (!process.env.GROQ_API_KEY) {
    console.warn('WARNING: GROQ_API_KEY is not set. Requests to Groq will fail with 401.');
}

app.post('/api/chat', async (req, res) => {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Request body must include a non-empty 'messages' array." });
    }

    // Instruct the model to format its answers in Markdown so the frontend
    // can render clean headings, lists, code blocks, etc. Only added if the
    // client hasn't already supplied its own system message.
    const formattingSystemPrompt = {
        role: 'system',
        content:
            'Format your responses using Markdown for readability: use "## " headings to break up sections, ' +
            'bullet or numbered lists for steps/items, short paragraphs, **bold** for key terms, and fenced ' +
            'code blocks (```) for any code. Avoid one giant wall of text — structure the answer so it is easy ' +
            'to scan and copy.'
    };

    const finalMessages =
        messages[0]?.role === 'system' ? messages : [formattingSystemPrompt, ...messages];

    try {
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: finalMessages,
                stream: true
            })
        });

        if (!groqResponse.ok) {
            // Groq returned an error (bad key, bad payload, rate limit, etc.)
            const errorText = await groqResponse.text();
            console.error(`Groq API error (${groqResponse.status}):`, errorText);
            return res.status(groqResponse.status).json({
                error: `Groq API request failed with status ${groqResponse.status}`
            });
        }

        // Set up SSE headers before streaming anything back
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();

        // Node's native fetch returns a WHATWG web ReadableStream, not a Node stream,
        // so it can't be piped directly. Convert it first.
        const nodeStream = Readable.fromWeb(groqResponse.body);

        nodeStream.pipe(res);

        nodeStream.on('error', (err) => {
            console.error('Stream error while relaying Groq response:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: "Stream error while relaying Groq response" });
            } else {
                res.end();
            }
        });

        req.on('close', () => {
            // Client disconnected early; stop reading from Groq
            nodeStream.destroy();
        });

    } catch (error) {
        console.error('Failed to fetch from Groq:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: "Failed to fetch from Groq" });
        } else {
            res.end();
        }
    }
});

// Vercel invokes the exported app directly as a serverless function and
// manages the request/response lifecycle itself — app.listen() must NOT run
// there. Only start a real listener when this file is executed directly
// with `node chat.js` (e.g. local testing outside of `vercel dev`).
if (require.main === module) {
    app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
}

module.exports = app;
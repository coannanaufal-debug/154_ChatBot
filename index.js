const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.redirect('/index.html');
});

app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({
                error: 'Messages harus berupa array'
            });
        }
        const geminiMessages = messages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: 'POST',

                headers: {
                    'Content-Type': 'application/json'
                },

                body: JSON.stringify({
                    contents: geminiMessages,
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1000
                    }
                })
            }
        );
               if (!response.ok) {
            const errorData = await response.text();

            console.error('Gemini Error:', errorData);

            return res.status(response.status).json({
                error: errorData
            });
        }
        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        res.json({ content });

    } catch (error) {

        console.error('Server Error:', error);

        if (!res.headersSent) {
            res.status(500).json({
                error: 'Terjadi kesalahan pada server'
            });
            } else {
            res.write(
                `data: ${JSON.stringify({
                    error: 'Terjadi kesalahan pada server'
                })}\n\n`
            );

            res.end();
        }
    }
});
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
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
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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

            let errorMessage = errorData;
            try {
                const parsed = JSON.parse(errorData);
                errorMessage = parsed.error?.message || errorData;
            } catch {
                /* biarkan teks asli */
            }

            return res.status(response.status).json({
                error: errorMessage
            });
        }
        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        res.json({ content });

    } catch (error) {

        console.error('Server Error:', error);

        res.status(500).json({
            error: 'Terjadi kesalahan pada server'
        });
    }
});
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
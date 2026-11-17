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
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            buffer += decoder.decode(value, {
                stream: true
            });
              const lines = buffer.split('\n');

            // Simpan bagian terakhir yang belum lengkap
            buffer = lines.pop();

            for (const line of lines) {

                const trimmedLine = line.trim();

                if (!trimmedLine) {
                    continue;
                }

                if (!trimmedLine.startsWith('data: ')) {
                    continue;
                }
                const data = trimmedLine.slice(5).trim();

                if (data === '[DONE]') {
                    continue;
                }

                try {
                    const json = JSON.parse(data);

                    const content = json.choices[0].delta?.content;
                    if (content) {
                        res.write(
                            `data: ${JSON.stringify(content)}\n\n`
                        );
                    }

                } catch (error) {
                    console.error(
                        'Gagal parsing streaming data:',
                        error
                    );
                }
            }
        }
        res.write('data: [DONE]\n\n');
        res.end();

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
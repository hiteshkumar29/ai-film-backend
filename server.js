const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── CORS ─────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Rate Limit ───────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
});
app.use('/generate', limiter);

// ─── Health Check ─────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'DeepSeek API Working 🚀' });
});

// ─── Generate Endpoint ────────────────────────
app.post('/generate', async (req, res) => {
  try {
    const { idea, language = 'english', scenes = 5 } = req.body;

    // ❗ Validation
    if (!idea || idea.length < 10) {
      return res.status(400).json({
        error: 'Idea too short',
      });
    }

    // ❗ API Key Check
    if (!process.env.DEEPSEEK_API_KEY) {
      return res.status(500).json({
        error: 'API key missing',
      });
    }

    // ─── Prompt ───────────────────────────────
    const prompt = `
Create a cinematic short film story.

Idea: ${idea}

Language: ${language}

Scenes: ${scenes}

Return ONLY JSON in this format:
{
"title": "",
"scenes": [
  {
    "scene": 1,
    "description": "",
    "dialogue": ""
  }
]
}
`;

    // ─── DeepSeek API Call ───────────────────
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const text = response.data.choices[0].message.content;

    // ─── JSON Parse ───────────────────────────
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      return res.status(500).json({
        error: 'JSON parse error',
        raw: text,
      });
    }

    return res.json({ success: true, data: result });

  } catch (err) {
    console.error(err.response?.data || err.message);

    return res.status(500).json({
      error: err.response?.data || 'Server error',
    });
  }
});

// ─── Start Server ────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

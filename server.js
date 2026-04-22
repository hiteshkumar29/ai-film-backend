/**
 * AI Film Studio — Secure Backend
 */

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Anthropic Client ─────────────────────────────────────────
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── CORS ─────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'null',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`)); // ✅ FIXED
    }
  },
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Rate Limiting ────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/generate', limiter);

// ─── Utils ───────────────────────────────────────────────────
function sanitizeString(str, maxLen = 500) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function validateScenes(n) {
  const parsed = parseInt(n, 10);
  return [3, 5, 7].includes(parsed) ? parsed : 5;
}

function validateLanguage(lang) {
  const allowed = ['hindi', 'english', 'urdu'];
  return allowed.includes(lang) ? lang : 'hindi';
}

// ─── Prompt Builder ──────────────────────────────────────────
function buildPrompt(idea, language, scenes) {
  return `Create a short animated film story.

Idea: "${idea}"
Language: ${language}
Scenes: ${scenes}

Return ONLY JSON format.`;
}

// ─── Health Check ────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'AI Film Studio API' });
});

// ─── Generate Endpoint ───────────────────────────────────────
app.post('/generate', async (req, res) => {
  try {
    const idea = sanitizeString(req.body.idea, 800);
    const language = validateLanguage(req.body.language);
    const scenes = validateScenes(req.body.scenes);

    if (!idea || idea.length < 5) {
      return res.status(400).json({
        error: 'Idea too short or missing.',
        code: 'INVALID_INPUT',
      });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({
        error: 'API key missing',
        code: 'SERVER_ERROR',
      });
    }

    const prompt = buildPrompt(idea, language, scenes);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    const clean = raw.replace(/```/g, '').trim();

    let film;
    try {
      film = JSON.parse(clean);
    } catch (e) {
      console.error("JSON parse failed:", clean); // ✅ FIXED
      return res.status(500).json({
        error: 'Invalid AI response format',
        code: 'PARSE_ERROR',
      });
    }

    return res.json({ success: true, film });

  } catch (err) {
    console.error('FULL ERROR:', err);

    if (err?.status === 429) {
      return res.status(429).json({
        error: 'Rate limit reached',
        code: 'RATE_LIMIT',
      });
    }

    if (err?.status === 401) {
      return res.status(500).json({
        error: 'API key issue',
        code: 'AUTH_ERROR',
      });
    }

    return res.status(500).json({
      error: err.message || "Internal error",
      code: "UNKNOWN_ERROR",
    });
  }
});

// ─── Start Server ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`); // ✅ FIXED
});

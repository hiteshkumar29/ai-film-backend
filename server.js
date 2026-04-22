/**
 * AI Film Studio — Secure Backend
 * Deployment: Render (render.com) — free tier works fine
 *
 * Setup:
 *   1. Set ANTHROPIC_API_KEY in Render environment variables
 *   2. Set FRONTEND_URL to your Netlify URL (e.g. https://ai-film-studio.netlify.app)
 *   3. npm install && node server.js
 */

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Anthropic Client ─────────────────────────────────────────────────────────
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY, // Never hardcode — set in Render env vars
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
// In production, restrict to your actual frontend URL
const allowedOrigins = [
  process.env.FRONTEND_URL,       // e.g. https://ai-film-studio.netlify.app
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'null', // Allow local file:// for Android WebView / APK
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '10kb' })); // Limit request body size

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // Max 20 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Bahut zyada requests ho gayi. 15 minute baad dobara try karein.',
    code: 'RATE_LIMIT',
  },
});
app.use('/generate', limiter);

// ─── Input Sanitizer ─────────────────────────────────────────────────────────
function sanitizeString(str, maxLen = 500) {
  if (typeof str !== 'string') return '';
  // Strip HTML tags and control characters
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function validateScenes(n) {
  const parsed = parseInt(n, 10);
  if (![3, 5, 7].includes(parsed)) return 5; // Default to 5 if invalid
  return parsed;
}

function validateLanguage(lang) {
  const allowed = ['hindi', 'english', 'urdu'];
  return allowed.includes(lang) ? lang : 'hindi';
}

// ─── Build Prompt ─────────────────────────────────────────────────────────────
function buildPrompt(idea, language, scenes) {
  const langInstructions = {
    hindi: 'Respond ENTIRELY in Hindi (Devanagari script). All text including title, scenes, dialogues must be in Hindi.',
    english: 'Respond entirely in English.',
    urdu: 'Respond ENTIRELY in Urdu (Nastaliq script). All text including title, scenes, dialogues must be in Urdu.',
  };

  return `You are a master Fantasy/Adventure film director and storyteller. Create a complete short animated film based on this idea: "${idea}"

${langInstructions[language]}

Create exactly ${scenes} scenes. Return ONLY valid JSON, no markdown, no explanation:

{
  "title": "Epic film title",
  "tagline": "One powerful tagline sentence",
  "genre": "Fantasy Adventure",
  "duration": "estimated runtime like '12 minutes'",
  "characters": [
    {"name": "Name", "role": "Brief description", "emoji": "single emoji avatar"}
  ],
  "scenes": [
    {
      "number": 1,
      "title": "Scene Title",
      "setting": "one-line setting description (forest/sky/cave/fire/ocean/mountain/village/battle)",
      "description": "2-3 sentence vivid scene description with action and atmosphere",
      "dialogue": [
        {"character": "Character Name", "line": "What they say"}
      ],
      "mood": "one word or short phrase: epic/mysterious/hopeful/tense/triumphant/sorrowful/magical/dangerous"
    }
  ],
  "theme": "One profound sentence about the film's deeper meaning or moral",
  "ending": "Brief description of how the story concludes"
}

Make it EPIC. Give characters depth. Dialogues should be powerful and memorable. Scenes should flow naturally with rising tension toward a climax.`;
}

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'AI Film Studio API', version: '1.0.0' });
});

// ─── Generate Endpoint ────────────────────────────────────────────────────────
app.post('/generate', async (req, res) => {
  try {
    // 1. Extract + sanitize inputs
    const idea     = sanitizeString(req.body.idea, 800);
    const language = validateLanguage(req.body.language);
    const scenes   = validateScenes(req.body.scenes);

    // 2. Validate required fields
    if (!idea || idea.length < 5) {
      return res.status(400).json({
        error: 'Idea too short or missing.',
        code: 'INVALID_INPUT',
      });
    }

    // 3. Confirm API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY environment variable not set!');
      return res.status(500).json({
        error: 'Server configuration error.',
        code: 'SERVER_ERROR',
      });
    }

    // 4. Call Anthropic
    const prompt = buildPrompt(idea, language, scenes);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });

    // 5. Extract + parse JSON from response
    const raw = message.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    const clean = raw
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    let film;
    try {
      film = JSON.parse(clean);
    } catch {
      console.error('JSON parse failed. Raw output:', raw.slice(0, 300));
      return res.status(500).json({
        error: 'AI ne galat format mein response diya. Dobara try karein.',
        code: 'PARSE_ERROR',
      });
    }

    // 6. Return structured response
    return res.json({ success: true, film });

  } catch (err) {
    console.error('Generate error:', err?.message || err);

    // Anthropic-specific errors
    if (err?.status === 429) {
      return res.status(429).json({
        error: 'AI service rate limit. Thodi der baad try karein.',
        code: 'RATE_LIMIT',
      });
    }
    if (err?.status === 401) {
      return res.status(500).json({
        error: 'Server API key issue. Admin se contact karein.',
        code: 'AUTH_ERROR',
      });
    }
    if (err?.status === 529 || err?.message?.includes('overloaded')) {
      return res.status(503).json({
        error: 'AI service temporarily overloaded. Please retry in a moment.',
        code: 'OVERLOADED',
      });
    }

    return res.status(500).json({
      error: 'Kuch galat hua. Dobara try karein.',
      code: 'UNKNOWN_ERROR',
    });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ AI Film Studio backend running on port ${PORT}`);
  console.log(`   API key set: ${!!process.env.ANTHROPIC_API_KEY}`);
  console.log(`   Frontend URL: ${process.env.FRONTEND_URL || '(not set — CORS open for local dev)'}`);
});

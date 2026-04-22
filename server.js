const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Free AI backend running 🚀' });
});

// Generate endpoint (FREE logic)
app.post('/generate', (req, res) => {
  const { idea, language = "english", scenes = 5 } = req.body;

  if (!idea || idea.length < 10) {
    return res.status(400).json({
      error: "Idea too short"
    });
  }

  // Simple story generator
  const generatedScenes = [];

  for (let i = 1; i <= scenes; i++) {
    generatedScenes.push({
      scene: i,
      description: `Scene ${i}: ${idea} continues with more action and emotion.`,
      dialogue: `Character says something impactful in scene ${i}.`
    });
  }

  const result = {
    title: "The Magical Journey",
    scenes: generatedScenes
  };

  res.json({
    success: true,
    data: result
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

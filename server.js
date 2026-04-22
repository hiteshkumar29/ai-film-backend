app.post('/generate', (req, res) => {
  const { idea, language = "english", scenes = 5 } = req.body;

  if (!idea || idea.length < 10) {
    return res.status(400).json({
      error: "Idea too short"
    });
  }

  const sceneTemplates = [
    "A mysterious beginning where everything feels calm but something is off.",
    "The hero discovers a hidden truth that changes everything.",
    "A sudden danger appears, creating tension and fear.",
    "The hero struggles and faces emotional conflict.",
    "A powerful climax where everything is at stake.",
    "A turning point where hope begins to rise.",
    "A final battle between good and evil.",
    "A peaceful ending with a strong emotional message."
  ];

  const dialogues = [
    "I feel something is not right...",
    "This power... it's inside me!",
    "We don't have much time!",
    "I won't give up, no matter what!",
    "This ends today!",
    "We can still win this!",
    "It's now or never!",
    "Everything is finally over..."
  ];

  const generatedScenes = [];

  for (let i = 0; i < scenes; i++) {
    generatedScenes.push({
      scene: i + 1,
      title: `Scene ${i + 1}`,
      description: `${sceneTemplates[i % sceneTemplates.length]} Based on: ${idea}`,
      dialogue: dialogues[i % dialogues.length],
      mood: ["mysterious", "tense", "emotional", "epic"][i % 4]
    });
  }

  const result = {
    title: "The Rise of Destiny",
    tagline: "One journey can change everything.",
    scenes: generatedScenes,
    ending: "The hero saves the world but learns that true power comes from within."
  };

  res.json({
    success: true,
    data: result
  });
});

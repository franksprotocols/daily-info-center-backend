import express from 'express';
import { getAllDates, getArticlesByDate, getArticleById, updateArticleAudioUrl } from '../database-selector.js';
import { generateSpeech } from '../services/ttsService.js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Get all dates with articles
router.get('/dates', async (req, res) => {
  try {
    const dates = await getAllDates();
    res.json(dates);
  } catch (error) {
    console.error('Error fetching dates:', error);
    res.status(500).json({ error: 'Failed to fetch dates' });
  }
});

// Get articles for a specific date
router.get('/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const articles = await getArticlesByDate(date);
    res.json(articles);
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// Get article details by ID
router.get('/detail/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const article = await getArticleById(parseInt(id));
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    res.json(article);
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// Generate TTS for article
router.post('/tts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const article = await getArticleById(parseInt(id));

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Check if audio already exists
    if (article.voice_file_path) {
      console.log(`Audio already exists for article ${id}: ${article.voice_file_path}`);
      return res.json({
        audioUrl: article.voice_file_path,
        cached: true
      });
    }

    // Generate new audio
    console.log(`Generating new audio for article ${id}...`);
    const filename = `article_${id}_${Date.now()}.mp3`;
    await generateSpeech(article.content, filename);

    const audioUrl = `/articles/audio/${filename}`;

    // Save audio URL to database
    await updateArticleAudioUrl(parseInt(id), audioUrl);
    console.log(`Audio URL saved to database for article ${id}`);

    res.json({
      audioUrl,
      cached: false
    });
  } catch (error) {
    console.error('Error generating TTS:', error.message);
    res.status(500).json({ error: 'Failed to generate audio', details: error.message });
  }
});

// Serve audio files
router.get('/audio/:filename', (req, res) => {
  const { filename } = req.params;
  const audioPath = join(__dirname, '..', 'audio', filename);
  res.sendFile(audioPath);
});

export default router;

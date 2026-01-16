import express from 'express';
import { getActiveTopics, saveArticle, checkArticleExists } from '../database-selector.js';
import { generateArticle } from '../services/geminiService.js';

const router = express.Router();

// Generate articles for all active topics
router.post('/', async (req, res) => {
  try {
    const topics = await getActiveTopics();

    if (topics.length === 0) {
      return res.status(400).json({ error: 'No active topics found' });
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const results = [];

    console.log(`Starting article generation for ${topics.length} topics...`);

    for (const topic of topics) {
      // Generate both English and Chinese versions
      const languages = ['en', 'zh'];

      for (const language of languages) {
        try {
          console.log(`Processing topic: ${topic.name} (${language})`);

          // Check if article already exists
          const exists = await checkArticleExists(today, topic.id, language);
          if (exists) {
            console.log(`  - Article already exists for ${topic.name} (${language}), skipping...`);
            continue;
          }

          // Generate article with Gemini (includes built-in search) with timeout
          console.log(`  - Generating ${language === 'en' ? 'English' : 'Chinese'} article with Gemini AI...`);
          const { headline, content, sources } = await Promise.race([
            generateArticle(topic.name, language),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Article generation timeout after 120 seconds')), 120000)
            )
          ]);

          // Save to database (TTS will be handled in browser)
          console.log(`  - Saving ${language} article to database...`);
          const article = await saveArticle(
            today,
            topic.id,
            language,
            headline,
            content,
            sources,
            null  // No audio file - TTS handled in browser
          );

          results.push({
            topic: topic.name,
            language,
            headline,
            articleId: article.id
          });

          console.log(`  ✓ Completed: ${topic.name} (${language})`);
        } catch (error) {
          console.error(`  ✗ Error generating ${language} article for ${topic.name}:`, error.message);
          console.error(`  Full error:`, error);
          results.push({
            topic: topic.name,
            language,
            error: error.message
          });
        }
      }
    }

    console.log(`Article generation complete. Generated ${results.filter(r => !r.error).length} articles.`);

    res.json({
      success: true,
      date: today,
      generated: results.filter(r => !r.error).length,
      failed: results.filter(r => r.error).length,
      results
    });
  } catch (error) {
    console.error('Error generating articles:', error);
    res.status(500).json({ error: 'Failed to generate articles', details: error.message });
  }
});

export default router;

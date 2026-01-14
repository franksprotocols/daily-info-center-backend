import express from 'express';
import { getActiveTopics, saveArticle, checkArticleExists } from '../database-selector.js';
import { searchTopic } from '../services/searchService.js';
import { generateArticle } from '../services/claudeService.js';

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
      try {
        console.log(`Processing topic: ${topic.name}`);

        // Step 1: Search for topic
        console.log(`  - Searching Google for: ${topic.name}`);
        const searchResults = await searchTopic(topic.name);

        if (searchResults.length === 0) {
          console.log(`  - No search results found for: ${topic.name}`);
          continue;
        }

        // Generate both English and Chinese versions
        const languages = ['en', 'zh'];

        for (const language of languages) {
          try {
            // Check if article already exists
            const exists = await checkArticleExists(today, topic.id, language);
            if (exists) {
              console.log(`  - Article already exists for ${topic.name} (${language}), skipping...`);
              continue;
            }

            // Step 2: Generate article with Claude
            console.log(`  - Generating ${language === 'en' ? 'English' : 'Chinese'} article with Claude AI...`);
            const { headline, content, sources } = await generateArticle(topic.name, searchResults, language);

            // Step 3: Save to database (TTS will be handled in browser)
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
          } catch (langError) {
            console.error(`  ✗ Error generating ${language} article for ${topic.name}:`, langError.message);
            console.error(`  Full error:`, langError);
            results.push({
              topic: topic.name,
              language,
              error: langError.message
            });
          }
        }

        console.log(`  ✓ Completed: ${topic.name}`);
      } catch (error) {
        console.error(`  ✗ Error processing topic ${topic.name}:`, error.message);
        console.error(`  Full error:`, error);
        results.push({
          topic: topic.name,
          error: error.message
        });
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

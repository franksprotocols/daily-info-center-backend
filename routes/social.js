import express from 'express';
import {
  getAllSocialInterests,
  addSocialInterest,
  updateSocialInterest,
  deleteSocialInterest,
  saveSocialArticle,
  checkSocialArticleExists,
  getSocialArticleDates,
  getSocialArticlesByDate,
  getSocialArticleById,
  updateSocialArticleSummary,
  deleteSocialArticle
} from '../database-selector.js';
import { scrapeWebpage } from '../services/webScraperService.js';
import { generateSocialSummary } from '../services/geminiService.js';

const router = express.Router();

// Interest Categories Management
router.get('/interests', async (req, res) => {
  try {
    const interests = await getAllSocialInterests();
    res.json(interests);
  } catch (error) {
    console.error('Error fetching social interests:', error);
    res.status(500).json({ error: 'Failed to fetch interests' });
  }
});

router.post('/interests', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Interest name is required' });
    }

    const interest = await addSocialInterest(name.trim());
    res.status(201).json(interest);
  } catch (error) {
    console.error('Error creating interest:', error);
    if (error.message && error.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'Interest already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create interest' });
    }
  }
});

router.put('/interests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_active } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Interest name is required' });
    }

    const interest = await updateSocialInterest(parseInt(id), name.trim(), is_active);
    res.json(interest);
  } catch (error) {
    console.error('Error updating interest:', error);
    res.status(500).json({ error: 'Failed to update interest' });
  }
});

router.delete('/interests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteSocialInterest(parseInt(id));
    res.json(result);
  } catch (error) {
    console.error('Error deleting interest:', error);
    res.status(500).json({ error: 'Failed to delete interest' });
  }
});

// Social Content Articles
router.post('/submit', async (req, res) => {
  try {
    const { url, interestId } = req.body;

    // Validation
    if (!url || !url.trim()) {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!interestId) {
      return res.status(400).json({ error: 'Interest category is required' });
    }

    // URL format validation
    const urlPattern = /^https?:\/\/.+\..+/;
    if (!urlPattern.test(url.trim())) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Check if URL already exists
    const exists = await checkSocialArticleExists(url.trim());
    if (exists) {
      return res.status(409).json({ error: 'This URL has already been added' });
    }

    // Scrape webpage content
    console.log(`Scraping URL: ${url}`);
    const scrapedData = await scrapeWebpage(url.trim());

    // Save to database
    const today = new Date().toISOString().split('T')[0];
    const articleData = {
      interestId: parseInt(interestId),
      sourceUrl: url.trim(),
      title: scrapedData.title,
      content: scrapedData.content,
      author: scrapedData.author,
      publishDate: scrapedData.publishDate,
      scrapedAt: today
    };

    const result = await saveSocialArticle(articleData);

    res.status(201).json({
      id: result.id,
      title: scrapedData.title,
      message: 'Article added successfully'
    });
  } catch (error) {
    console.error('Error submitting URL:', error);
    res.status(500).json({
      error: 'Failed to process URL',
      details: error.message
    });
  }
});

router.get('/dates', async (req, res) => {
  try {
    const dates = await getSocialArticleDates();
    res.json(dates);
  } catch (error) {
    console.error('Error fetching dates:', error);
    res.status(500).json({ error: 'Failed to fetch dates' });
  }
});

router.get('/articles/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const articles = await getSocialArticlesByDate(date);
    res.json(articles);
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

router.get('/article/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const article = await getSocialArticleById(parseInt(id));

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json(article);
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

router.post('/article/:id/summary', async (req, res) => {
  try {
    const { id } = req.params;
    const article = await getSocialArticleById(parseInt(id));

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Check if summary already exists
    if (article.summary) {
      console.log(`Summary already exists for article ${id}`);
      return res.json({
        summary: article.summary,
        cached: true
      });
    }

    // Generate summary with Gemini
    console.log(`Generating summary for article ${id}...`);

    // Limit content length to save tokens
    const contentToSummarize = article.content.substring(0, 5000);
    const summary = await generateSocialSummary(contentToSummarize);

    // Save summary to database
    await updateSocialArticleSummary(parseInt(id), summary);
    console.log(`Summary saved for article ${id}`);

    res.json({
      summary,
      cached: false
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({
      error: 'Failed to generate summary',
      details: error.message
    });
  }
});

router.delete('/article/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteSocialArticle(parseInt(id));
    res.json(result);
  } catch (error) {
    console.error('Error deleting article:', error);
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

export default router;

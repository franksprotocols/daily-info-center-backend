import axios from 'axios';
import * as cheerio from 'cheerio';
import { scrapeUrlWithGemini } from './geminiService.js';

export async function scrapeWebpage(url) {
  // Try Gemini first (most reliable, bypasses anti-bot protections)
  try {
    console.log('Attempting to scrape with Gemini AI...');
    const result = await scrapeUrlWithGemini(url);
    console.log('Successfully scraped with Gemini AI');
    return result;
  } catch (geminiError) {
    console.log('Gemini scraping failed, trying direct scraping...', geminiError.message);
  }

  // Fallback to direct scraping
  try {
    // Fetch the webpage with timeout
    const response = await axios.get(url, {
      timeout: 10000,
      maxContentLength: 5 * 1024 * 1024, // 5MB limit to prevent memory issues
      maxBodyLength: 5 * 1024 * 1024,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1'
      },
      validateStatus: (status) => status < 500 // Don't throw on 4xx errors
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Extract title - try multiple sources
    let title = $('meta[property="og:title"]').attr('content') ||
                $('meta[name="twitter:title"]').attr('content') ||
                $('title').text() ||
                $('h1').first().text() ||
                'Untitled';

    title = title.trim();

    // Extract author
    let author = $('meta[name="author"]').attr('content') ||
                 $('meta[property="article:author"]').attr('content') ||
                 $('.author').first().text() ||
                 $('[rel="author"]').first().text() ||
                 null;

    if (author) {
      author = author.trim();
    }

    // Extract publish date
    let publishDate = $('meta[property="article:published_time"]').attr('content') ||
                      $('meta[name="publish_date"]').attr('content') ||
                      $('time[datetime]').first().attr('datetime') ||
                      null;

    if (publishDate) {
      publishDate = publishDate.split('T')[0]; // Get just the date part
    }

    // Extract main content
    // Try common article containers
    let content = '';

    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, .ad, .advertisement, .social-share').remove();

    // Try to find the main article content
    const articleSelectors = [
      'article',
      '[role="main"]',
      'main',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.content',
      '.post-body',
      '.article-body'
    ];

    for (const selector of articleSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        content = element.text();
        break;
      }
    }

    // Fallback: extract all paragraph text
    if (!content || content.length < 100) {
      const paragraphs = $('p').map((i, el) => $(el).text()).get();
      content = paragraphs.join('\n\n');
    }

    // Clean up content
    content = content
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n\n')  // Replace multiple newlines with double newline
      .trim();

    // Validate content length
    if (content.length < 50) {
      throw new Error('Could not extract sufficient content from the webpage');
    }

    return {
      title,
      content,
      author,
      publishDate
    };

  } catch (error) {
    console.error('Web scraping error:', error.message);

    // Provide user-friendly error messages
    if (error.code === 'ENOTFOUND') {
      throw new Error('Unable to reach the URL. Please check if the URL is correct.');
    } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      throw new Error('Request timed out. The website may be slow or unavailable.');
    } else if (error.response) {
      if (error.response.status === 404) {
        throw new Error('Page not found (404). Please check the URL.');
      } else if (error.response.status === 403) {
        // Try using Jina AI Reader as fallback for blocked sites
        try {
          console.log('Direct scraping blocked, trying Jina AI Reader...');
          return await scrapeWithJinaAI(url);
        } catch (jinaError) {
          console.error('Jina AI fallback failed:', jinaError.message);
          throw new Error('Access denied - the website is blocking automated access. This site cannot be scraped at this time.');
        }
      } else if (error.response.status >= 500) {
        throw new Error('The website is currently experiencing issues. Please try again later.');
      }
    }

    throw new Error(error.message || 'Failed to scrape webpage');
  }
}

// Fallback scraper using Jina AI Reader (free API, no key needed)
async function scrapeWithJinaAI(url) {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const response = await axios.get(jinaUrl, {
      timeout: 15000,
      headers: {
        'Accept': 'application/json',
        'X-Return-Format': 'markdown'
      }
    });

    const markdown = response.data;

    // Extract title from markdown (first # heading)
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

    // Remove the title line and clean up
    const content = markdown
      .replace(/^#\s+.+$/m, '')
      .trim()
      .replace(/\n{3,}/g, '\n\n'); // Replace 3+ newlines with 2

    if (content.length < 50) {
      throw new Error('Could not extract sufficient content');
    }

    return {
      title,
      content,
      author: null,
      publishDate: null
    };
  } catch (error) {
    console.error('Jina AI scraping error:', error.message);
    throw new Error('Failed to scrape webpage using fallback method');
  }
}

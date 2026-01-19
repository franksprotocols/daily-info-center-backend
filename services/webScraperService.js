import axios from 'axios';
import * as cheerio from 'cheerio';
import { scrapeUrlWithGemini } from './geminiService.js';

export async function scrapeWebpage(url) {
  // For WeChat articles, use Jina AI Reader first (more reliable for Chinese content)
  if (url.includes('mp.weixin.qq.com')) {
    try {
      console.log('WeChat article detected, using Jina AI Reader...');
      const result = await scrapeWithJinaAI(url);
      console.log('Successfully scraped WeChat article with Jina AI');
      return result;
    } catch (jinaError) {
      console.log('Jina AI failed for WeChat article, trying direct scraping...', jinaError.message);
    }
  }

  // Try direct scraping first for better accuracy
  try {
    console.log('Attempting direct HTML scraping...');
    const result = await directScrape(url);
    console.log('Successfully scraped with direct method');
    return result;
  } catch (directError) {
    console.log('Direct scraping failed, trying Gemini AI...', directError.message);
  }

  // Fallback to Gemini (less reliable but works when others fail)
  try {
    console.log('Attempting to scrape with Gemini AI...');
    const result = await scrapeUrlWithGemini(url);
    console.log('Successfully scraped with Gemini AI');
    return result;
  } catch (geminiError) {
    console.log('Gemini scraping failed:', geminiError.message);
    throw new Error('All scraping methods failed. This URL cannot be accessed.');
  }
}

// Direct scraping implementation
async function directScrape(url) {
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

    // Extract title - try multiple sources (WeChat-specific first)
    let title = $('meta[property="og:title"]').attr('content') ||
                $('#activity-name').text() || // WeChat specific
                $('.rich_media_title').text() || // WeChat specific
                $('meta[name="twitter:title"]').attr('content') ||
                $('title').text() ||
                $('h1').first().text() ||
                'Untitled';

    title = title.trim();

    // Extract author (WeChat-specific selectors added)
    let author = $('#js_name').text() || // WeChat author
                 $('.rich_media_meta_nickname').text() || // WeChat author
                 $('meta[name="author"]').attr('content') ||
                 $('meta[property="article:author"]').attr('content') ||
                 $('.author').first().text() ||
                 $('[rel="author"]').first().text() ||
                 null;

    if (author) {
      author = author.trim();
    }

    // Extract publish date (WeChat-specific added)
    let publishDate = $('#publish_time').text() || // WeChat date
                      $('meta[property="article:published_time"]').attr('content') ||
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

    // Try to find the main article content (WeChat-specific selectors first)
    const articleSelectors = [
      '#js_content', // WeChat article content (MOST IMPORTANT)
      '.rich_media_content', // WeChat content
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

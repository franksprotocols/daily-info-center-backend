import axios from 'axios';
import * as cheerio from 'cheerio';

export async function scrapeWebpage(url) {
  try {
    // Fetch the webpage with timeout
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
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
        throw new Error('Access denied (403). The website may be blocking automated access.');
      } else if (error.response.status >= 500) {
        throw new Error('The website is currently experiencing issues. Please try again later.');
      }
    }

    throw new Error(error.message || 'Failed to scrape webpage');
  }
}

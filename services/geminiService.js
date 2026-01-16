import { GoogleGenerativeAI } from '@google/generative-ai';

export async function generateArticle(topic, language = 'en') {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    }
  });

  const languageInstruction = language === 'zh'
    ? 'Please write the article in Chinese (简体中文).'
    : 'Please write the article in English.';

  const prompt = `You are a skilled journalist and analyst. Research and write a comprehensive article about "${topic}" based on the latest information.

${languageInstruction}

Please:
1. Search for the latest developments and news about ${topic}
2. Summarize key information and recent developments
3. Identify important trends and patterns
4. Provide meaningful analysis and insights
5. Maintain an objective, informative tone

Format the article with:
- Start with "Headline: [compelling headline]"
- Then write a 300-500 word article suitable for voice narration
- Be informative and engaging

Write the article now:`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;

    // Check if response is valid before processing
    if (!response || typeof response.text !== 'function') {
      throw new Error('Invalid response from Gemini API');
    }

    const fullText = response.text();

    // Extract headline and content
    const headlineMatch = fullText.match(/Headline:\s*(.+?)(?:\n|$)/i);
    const headline = headlineMatch ? headlineMatch[1].trim() : `${topic} - Daily Update`;

    // Remove the headline line from content
    const content = fullText.replace(/Headline:\s*.+?(?:\n|$)/i, '').trim();

    return {
      headline,
      content,
      sources: [] // Gemini uses its built-in knowledge, no explicit sources
    };
  } catch (error) {
    console.error('Gemini API error:', error.message);
    throw new Error(`Failed to generate article for topic: ${topic}`);
  }
}

export async function generateSocialSummary(articleContent) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 500,
    }
  });

  const prompt = `Summarize the following article in 150-250 words. Focus on the key points, main ideas, and most important information. Write in a clear, concise style suitable for quick reading.

Article content:
${articleContent}

Summary:`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;

    // Check if response is valid before processing
    if (!response || typeof response.text !== 'function') {
      throw new Error('Invalid response from Gemini API');
    }

    const summary = response.text().trim();

    return summary;
  } catch (error) {
    console.error('Gemini summary generation error:', error.message);
    throw new Error('Failed to generate summary');
  }
}

export async function scrapeUrlWithGemini(url) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.1, // Low temperature for factual extraction
      maxOutputTokens: 4096,
    }
  });

  const prompt = `Fetch and analyze the webpage at this URL: ${url}

Please extract the following information in JSON format:
{
  "title": "The article title or headline",
  "content": "The full main article text content (at least 200 words, preserve paragraph structure with \\n\\n between paragraphs)",
  "author": "The author name if available, otherwise null",
  "publishDate": "The publish date in YYYY-MM-DD format if available, otherwise null"
}

Important:
- Extract the complete article text, not just a summary
- Preserve the natural paragraph structure
- If author or date are not found, use null
- Return ONLY the JSON object, no other text

JSON:`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;

    // Check if response is valid before processing
    if (!response || typeof response.text !== 'function') {
      throw new Error('Invalid response from Gemini API');
    }

    let text = response.text().trim();

    // Clean up response - remove markdown code blocks if present
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Parse JSON response
    const data = JSON.parse(text);

    // Validate required fields
    if (!data.title || !data.content) {
      throw new Error('Failed to extract title and content from webpage');
    }

    if (data.content.length < 50) {
      throw new Error('Extracted content is too short - the page may not be accessible');
    }

    return {
      title: data.title,
      content: data.content,
      author: data.author,
      publishDate: data.publishDate
    };

  } catch (error) {
    console.error('Gemini web scraping error:', error.message);

    if (error instanceof SyntaxError) {
      throw new Error('Failed to parse webpage content - the URL may be invalid or inaccessible');
    }

    throw new Error(error.message || 'Failed to scrape webpage with Gemini');
  }
}

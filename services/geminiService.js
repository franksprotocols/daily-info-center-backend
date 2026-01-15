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

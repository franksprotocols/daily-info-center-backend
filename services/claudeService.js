import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

export async function generateArticle(topic, searchResults, language = 'en') {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured');
  }

  const languageInstruction = language === 'zh'
    ? 'Please write the article in Chinese (简体中文).'
    : 'Please write the article in English.';

  const prompt = `You are a skilled journalist and analyst. I have gathered the latest search results about "${topic}". Please write a comprehensive, well-structured article that:

1. Summarizes the key information and developments
2. Identifies important trends and patterns
3. Provides meaningful analysis and insights
4. Maintains an objective, informative tone

${languageInstruction}

Search Results:
${searchResults.map((result, index) => `
${index + 1}. ${result.title}
   ${result.snippet}
   Source: ${result.link}
`).join('\n')}

Please write the article in a clear, engaging format suitable for voice narration. Include a compelling headline at the start in the format "Headline: [your headline here]". The article should be approximately 300-500 words.`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const fullText = message.content[0].text;

    // Extract headline and content
    const headlineMatch = fullText.match(/Headline:\s*(.+?)(?:\n|$)/i);
    const headline = headlineMatch ? headlineMatch[1].trim() : `${topic} - Daily Update`;

    // Remove the headline line from content
    const content = fullText.replace(/Headline:\s*.+?(?:\n|$)/i, '').trim();

    return {
      headline,
      content,
      sources: searchResults.map(r => r.link)
    };
  } catch (error) {
    console.error('Claude API error:', error.message);
    throw new Error(`Failed to generate article for topic: ${topic}`);
  }
}

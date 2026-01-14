import axios from 'axios';

export async function searchTopic(topic) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !searchEngineId) {
    throw new Error('Google Search API credentials not configured');
  }

  try {
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: apiKey,
        cx: searchEngineId,
        q: topic,
        num: 10,
        dateRestrict: 'd7',  // Restrict to past 7 days
        sort: 'date'          // Sort by date to get most recent first
      }
    });

    if (!response.data.items) {
      return [];
    }

    return response.data.items.map(item => ({
      title: item.title,
      snippet: item.snippet,
      link: item.link
    }));
  } catch (error) {
    console.error('Search error:', error.response?.data || error.message);
    throw new Error(`Failed to search for topic: ${topic}`);
  }
}

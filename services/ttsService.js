import elevenLabs from 'elevenlabs-js';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function generateSpeech(text, filename) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured');
  }

  // Set API key
  elevenLabs.setApiKey(apiKey);

  // Using Rachel voice
  const voiceId = '21m00Tcm4TlvDq8ikWAM';

  try {
    const audioDir = join(__dirname, '..', 'audio');
    // Create audio directory if it doesn't exist
    if (!existsSync(audioDir)) {
      await mkdir(audioDir, { recursive: true });
    }

    const audioPath = join(audioDir, filename);

    // Generate TTS and save to file
    const audioResult = await elevenLabs.textToSpeech(voiceId, text, 'eleven_multilingual_v2', {
      stability: 0.5,
      similarity_boost: 0.75
    });

    // Use the saveFile method to save the audio
    await audioResult.saveFile(audioPath);

    return filename;
  } catch (error) {
    console.error('TTS error details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      stack: error.stack
    });

    // More specific error messages
    if (error.response?.status === 401) {
      throw new Error('ElevenLabs API key is invalid or expired. Please check your ELEVENLABS_API_KEY.');
    } else if (error.response?.status === 429) {
      throw new Error('ElevenLabs rate limit exceeded. Please try again later.');
    } else {
      throw new Error(`Failed to generate speech: ${error.response?.status || error.message}`);
    }
  }
}

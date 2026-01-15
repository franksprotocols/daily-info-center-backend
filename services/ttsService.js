import elevenLabs from 'elevenlabs-js';
import { mkdir } from 'fs/promises';
import { createWriteStream } from 'fs';
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

    // Generate TTS and pipe to file
    return new Promise((resolve, reject) => {
      const audioStream = elevenLabs.textToSpeech(voiceId, text, 'eleven_multilingual_v2', {
        stability: 0.5,
        similarity_boost: 0.75
      });

      const writeStream = createWriteStream(audioPath);

      audioStream.pipe(writeStream);

      writeStream.on('finish', () => {
        resolve(filename);
      });

      writeStream.on('error', (error) => {
        reject(new Error(`Failed to write audio file: ${error.message}`));
      });

      audioStream.on('error', (error) => {
        reject(new Error(`Failed to generate speech: ${error.message}`));
      });
    });
  } catch (error) {
    console.error('TTS error details:', {
      message: error.message,
      status: error.statusCode,
      body: error.body
    });
    throw new Error(`Failed to generate speech: ${error.statusCode || error.message}`);
  }
}

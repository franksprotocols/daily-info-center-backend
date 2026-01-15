import { FishAudioClient } from 'fish-audio';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function generateSpeech(text, filename) {
  const apiKey = process.env.FISH_API_KEY;

  if (!apiKey) {
    throw new Error('Fish Audio API key not configured');
  }

  console.log('TTS Debug:', {
    hasKey: !!apiKey,
    keyLength: apiKey?.length,
    keyPrefix: apiKey?.substring(0, 10),
    textLength: text?.length
  });

  const fishAudio = new FishAudioClient({
    apiKey: apiKey
  });

  // Optional: specify a reference_id for a custom voice
  // Leave empty to use default voice
  // const referenceId = 'your_voice_model_id';

  try {
    const audioDir = join(__dirname, '..', 'audio');
    // Create audio directory if it doesn't exist
    if (!existsSync(audioDir)) {
      await mkdir(audioDir, { recursive: true });
    }

    const audioPath = join(audioDir, filename);

    // Generate TTS using official Fish Audio SDK
    const audio = await fishAudio.textToSpeech.convert({
      text: text,
      format: 'mp3',
      // reference_id: referenceId, // Uncomment and set if using custom voice
      latency: 'balanced',
      normalize: true
    });

    // Convert audio stream to buffer and save
    const chunks = [];
    for await (const chunk of audio) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    await writeFile(audioPath, buffer);

    return filename;
  } catch (error) {
    console.error('TTS error details:', {
      message: error.message,
      status: error.status || error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      stack: error.stack
    });

    // More specific error messages
    const status = error.status || error.response?.status;
    if (status === 401) {
      throw new Error('Fish Audio API key is invalid or expired. Please check your FISH_API_KEY.');
    } else if (status === 429) {
      throw new Error('Fish Audio rate limit exceeded. Please try again later.');
    } else {
      throw new Error(`Failed to generate speech: ${status || error.message}`);
    }
  }
}

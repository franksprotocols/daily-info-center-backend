import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { writeFile, mkdir } from 'fs/promises';
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

  console.log('TTS Debug:', {
    hasKey: !!apiKey,
    keyLength: apiKey?.length,
    keyPrefix: apiKey?.substring(0, 10),
    textLength: text?.length
  });

  const elevenlabs = new ElevenLabsClient({
    apiKey: apiKey
  });

  // Using Rachel voice
  const voiceId = '21m00Tcm4TlvDq8ikWAM';

  try {
    const audioDir = join(__dirname, '..', 'audio');
    // Create audio directory if it doesn't exist
    if (!existsSync(audioDir)) {
      await mkdir(audioDir, { recursive: true });
    }

    const audioPath = join(audioDir, filename);

    // Generate TTS using official SDK
    const audio = await elevenlabs.textToSpeech.convert(voiceId, {
      text: text,
      model_id: 'eleven_multilingual_v2',
      output_format: 'mp3_44100_128'
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

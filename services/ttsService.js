import { ElevenLabsClient } from 'elevenlabs-js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync } from 'fs';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function generateSpeech(text, filename) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured');
  }

  const elevenlabs = new ElevenLabsClient({
    apiKey: apiKey
  });

  // Using Rachel voice
  const voiceId = '21m00Tcm4TlvDq8ikWAM';

  try {
    const audio = await elevenlabs.textToSpeech.convert(voiceId, {
      text: text,
      model_id: 'eleven_multilingual_v2',
      output_format: 'mp3_44100_128'
    });

    const audioDir = join(__dirname, '..', 'audio');
    // Create audio directory if it doesn't exist
    if (!existsSync(audioDir)) {
      await mkdir(audioDir, { recursive: true });
    }

    const audioPath = join(audioDir, filename);

    // Convert ReadableStream to Buffer and save
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
      status: error.statusCode,
      body: error.body
    });
    throw new Error(`Failed to generate speech: ${error.statusCode || error.message}`);
  }
}

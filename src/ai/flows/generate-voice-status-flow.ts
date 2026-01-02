'use server';
/**
 * @fileOverview A flow to convert text into a voice status audio file.
 *
 * - generateVoiceStatus - Converts text to a WAV audio data URL.
 * - GenerateVoiceStatusInput - The input type for the generateVoiceStatus function.
 * - GenerateVoiceStatusOutput - The return type for the generateVoiceStatus function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import wav from 'wav';


const GenerateVoiceStatusInputSchema = z.object({
  text: z.string().min(1).max(280).describe('The text to be converted to speech.'),
});
export type GenerateVoiceStatusInput = z.infer<typeof GenerateVoiceStatusInputSchema>;

const GenerateVoiceStatusOutputSchema = z.object({
    voiceStatusUrl: z.string().describe("The generated voice status as a WAV audio data URI."),
});
export type GenerateVoiceStatusOutput = z.infer<typeof GenerateVoiceStatusOutputSchema>;


export async function generateVoiceStatus(input: GenerateVoiceStatusInput): Promise<GenerateVoiceStatusOutput> {
  return generateVoiceStatusFlow(input);
}

const generateVoiceStatusFlow = ai.defineFlow(
  {
    name: 'generateVoiceStatusFlow',
    inputSchema: GenerateVoiceStatusInputSchema,
    outputSchema: GenerateVoiceStatusOutputSchema,
  },
  async ({text}) => {
    const { media } = await ai.generate({
      model: 'googleai/gemini-2.5-flash-preview-tts',
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Alloy' },
          },
        },
      },
      prompt: text,
    });

    if (!media) {
      throw new Error('Audio generation failed: no media returned.');
    }
    
    const audioBuffer = Buffer.from(
      media.url.substring(media.url.indexOf(',') + 1),
      'base64'
    );

    const wavBase64 = await toWav(audioBuffer);
    
    return {
        voiceStatusUrl: `data:audio/wav;base64,${wavBase64}`
    };
  }
);


async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const chunks: Buffer[] = [];
    writer.on('data', (chunk) => chunks.push(chunk));
    writer.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
    writer.on('error', reject);

    writer.write(pcmData);
    writer.end();
  });
}

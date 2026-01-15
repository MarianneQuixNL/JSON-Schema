import { GoogleGenAI } from "@google/genai";
import { logger } from "./logger.service";

export class VeoService {
  
  private getClient(): GoogleGenAI {
    // @ts-ignore
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("API Key not set. Please select a key in Settings.");
    }
    return new GoogleGenAI({ apiKey });
  }

  async generateVideo(prompt: string): Promise<string> {
     logger.log('API_REQUEST', 'Veo Generate Video', { prompt });

     try {
        const client = this.getClient();
        let operation = await client.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9'
            }
        });

        // Polling logic simulation or basic loop
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await client.operations.getVideosOperation({ operation });
        }

        const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!uri) throw new Error("No video URI returned");

        // Append key for download/playback as per guidelines
        // @ts-ignore
        const finalUri = `${uri}&key=${process.env.API_KEY}`;

        logger.log('API_RESPONSE', 'Veo Video Ready', { uri: finalUri });
        return finalUri;
     } catch (error: any) {
         logger.log('ERROR', 'Veo API Error', error);
         throw error;
     }
  }
}

export const veoService = new VeoService();

import { GoogleGenAI } from "@google/genai";
import { logger } from "./logger.service";

export class VisionService {
  
  private getClient(): GoogleGenAI {
    // @ts-ignore
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      const error = "API Key not set. Please select a key in Settings.";
      logger.log('ERROR', 'Vision Service', { error });
      throw new Error(error);
    }
    return new GoogleGenAI({ apiKey });
  }

  async generateSchemaFromImage(base64Image: string, mimeType: string): Promise<any> {
    logger.log('API_REQUEST', 'Vision Schema Generation', { mimeType });

    try {
      const client = this.getClient();
      const response = await client.models.generateContent({
        model: 'gemini-3-pro-preview', // High quality reasoning on images
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Image
              }
            },
            {
              text: `Analyze this image. It likely contains a form, receipt, invoice, or data table. 
              Generate a professional JSON Schema (Draft 2020-12) that accurately models the data structure visible in the image.
              
              Rules:
              1. Return ONLY the JSON Schema. No markdown.
              2. Include descriptions for fields based on their visual context.
              3. Guess the types (number, string, date) appropriately.`
            }
          ]
        }
      });

      const text = response.text || "";
      return this.cleanJson(text);
    } catch (error: any) {
      logger.log('ERROR', 'Vision API Error', error);
      throw error;
    }
  }

  private cleanJson(text: string): any {
    try {
      let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(clean);
    } catch (e) {
      logger.log('ERROR', 'Failed to parse Vision JSON response', { text });
      throw new Error("AI returned invalid JSON from Vision request");
    }
  }
}
export const visionService = new VisionService();

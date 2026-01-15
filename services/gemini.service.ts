

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { logger } from "./logger.service";
import { 
  SCHEMA_VALIDATION_PROMPT, 
  CSHARP_GEN_PROMPT, 
  TYPESCRIPT_GEN_PROMPT, 
  SQL_GEN_PROMPT,
  IMPROVEMENT_ANALYSIS_PROMPT,
  IMPROVEMENT_APPLY_PROMPT 
} from "../constants/prompts";
import { SchemaImprovement, Job } from "../types";

export class GeminiService {
  
  private getClient(): GoogleGenAI {
    // @ts-ignore
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      const error = "API Key not set. Please select a key in Settings.";
      logger.log('ERROR', 'Gemini Service', { error });
      throw new Error(error);
    }
    return new GoogleGenAI({ apiKey });
  }

  async generateContent(model: string, prompt: string, systemInstruction?: string, job?: Job): Promise<string> {
    logger.log('API_REQUEST', 'Gemini Generate Content', { model, prompt: prompt.substring(0, 100) + "...", systemInstruction });

    if (job) {
        job.requests.push({
            timestamp: Date.now(),
            service: 'Gemini',
            type: 'generateContent',
            model,
            prompt,
            systemInstruction
        });
    }

    try {
      const client = this.getClient();
      const response: GenerateContentResponse = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
        }
      });

      const text = response.text || "";
      logger.log('API_RESPONSE', 'Gemini Response', { text: text.substring(0, 100) + "..." });
      
      if (job) {
          job.responses.push({
              timestamp: Date.now(),
              service: 'Gemini',
              raw: response
          });
      }
      
      return text;
    } catch (error: any) {
      logger.log('ERROR', 'Gemini API Error', error);
      if (job) {
          job.responses.push({
              timestamp: Date.now(),
              service: 'Gemini',
              error: error.message || error
          });
      }
      throw error;
    }
  }

  async analyzeAndCreateSchema(sourceJson: any, currentSchema: any, job?: Job): Promise<any> {
    const isArray = Array.isArray(sourceJson);
    const contextDescription = isArray 
        ? "Source JSON Data (Array of samples from file group)" 
        : "Source JSON Data";

    const prompt = `
    You are a Data Architect.
    Analyze the following SOURCE JSON data.
    Update the TARGET JSON SCHEMA (Draft 2020-12) to include fields from the source data.
    
    Rules:
    1. The output must be a valid JSON Schema object.
    2. **MANDATORY**: Every property in the schema MUST have a 'type' and a 'description' field explaining its purpose.
    3. **MANDATORY**: Determine a professional and descriptive 'title' for the root schema based on the context of the Source JSON (e.g. "CustomerProfile", "InvoiceData"). Set this in the root 'title' property.
    4. MERGE STRATEGY:
       - Keep all existing fields in the Current Target Schema. Do NOT delete anything.
       - If a field in the Source JSON exists in the Schema with the same name, keep the Schema version.
       - Only add NEW fields that are missing from the Schema.
       - If Source Data is an array of samples, assume the schema represents a single object of that type (unless the root itself is an array). Ensure the schema covers all variations found in samples.
    5. Return ONLY the JSON Schema object. No markdown.
    
    Current Target Schema:
    ${JSON.stringify(currentSchema)}

    ${contextDescription}:
    ${JSON.stringify(sourceJson).substring(0, 15000)} ... (truncated if too long)
    `;

    // Complex Task: Use gemini-3-pro-preview
    const res = await this.generateContent('gemini-3-pro-preview', prompt, undefined, job);
    return this.cleanJson(res);
  }

  async modifySchema(currentSchema: any, userPrompt: string, sourceJson?: any, systemInstruction?: string, job?: Job): Promise<any> {
    const prompt = `
    You are a Data Architect.
    Modify the following JSON SCHEMA based on the user's instructions.

    User Instructions: ${userPrompt}
    
    Rules:
    1. **MANDATORY**: Every property/field in the schema MUST have a 'type' and a 'description'.
    2. Ensure valid JSON Schema structure (properties, types).
    3. Return ONLY the modified JSON Schema as a valid JSON object. No markdown.

    Current Schema:
    ${JSON.stringify(currentSchema)}

    ${sourceJson ? `Context - Source JSON Data Sample:\n${JSON.stringify(sourceJson).substring(0, 5000)}` : ''}
    `;
    // Complex Task: Use gemini-3-pro-preview
    const res = await this.generateContent('gemini-3-pro-preview', prompt, systemInstruction, job);
    return this.cleanJson(res);
  }

  async mapJson(sourceJson: any, targetSchema: any, job?: Job): Promise<any> {
    const prompt = `
    Transform the SOURCE JSON data into a new JSON object that validates against the TARGET JSON SCHEMA.
    
    Rules:
    1. Map fields from Source to Target based on semantic meaning.
    2. The output must be a valid JSON instance of the Schema.
    3. Return ONLY the new JSON object. No markdown.

    Target JSON Schema:
    ${JSON.stringify(targetSchema)}

    Source JSON:
    ${JSON.stringify(sourceJson).substring(0, 10000)}
    `;

    // Complex Task: Use gemini-3-pro-preview
    const res = await this.generateContent('gemini-3-pro-preview', prompt, undefined, job);
    return this.cleanJson(res);
  }

  async validateSchema(schema: any, job?: Job): Promise<string> {
    const prompt = `${SCHEMA_VALIDATION_PROMPT}\n\nSchema to Validate:\n${JSON.stringify(schema, null, 2)}`;
    // Complex Task: Use gemini-3-pro-preview
    return await this.generateContent('gemini-3-pro-preview', prompt, undefined, job);
  }

  async getImprovements(schema: any, job?: Job): Promise<SchemaImprovement[]> {
    let prompt = `${IMPROVEMENT_ANALYSIS_PROMPT}\n\nSchema:\n${JSON.stringify(schema, null, 2)}`;
    
    const res = await this.generateContent('gemini-3-pro-preview', prompt, undefined, job);
    const json = this.cleanJson(res);
    if (Array.isArray(json)) return json;
    // Fallback if AI wraps it in an object
    // @ts-ignore
    if (json.improvements) return json.improvements;
    throw new Error("Invalid improvement response format");
  }

  async applyImprovements(schema: any, improvements: SchemaImprovement[], job?: Job): Promise<any> {
    const improvementList = improvements.map(i => `- [${i.category}] ${i.title}: ${i.description}`).join('\n');
    const prompt = `${IMPROVEMENT_APPLY_PROMPT}\n\nImprovements to Apply:\n${improvementList}\n\nCurrent Schema:\n${JSON.stringify(schema, null, 2)}`;
    
    const res = await this.generateContent('gemini-3-pro-preview', prompt, undefined, job);
    return this.cleanJson(res);
  }

  async generateCSharp(schema: any, rootClassName: string, job?: Job): Promise<string> {
    const prompt = `${CSHARP_GEN_PROMPT} ${rootClassName}\n\nSchema:\n${JSON.stringify(schema, null, 2)}`;
    // Complex Task: Use gemini-3-pro-preview
    let code = await this.generateContent('gemini-3-pro-preview', prompt, undefined, job);
    // Strip markdown code blocks if present (Gemini sometimes adds them despite instructions)
    code = code.replace(/^```csharp\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '');
    return code;
  }

  async generateTypeScript(schema: any, job?: Job): Promise<string> {
    const prompt = `${TYPESCRIPT_GEN_PROMPT}\n\nSchema:\n${JSON.stringify(schema, null, 2)}`;
    let code = await this.generateContent('gemini-3-pro-preview', prompt, undefined, job);
    return code.replace(/^```typescript\s*/i, '').replace(/^```ts\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '');
  }

  async generateSQL(schema: any, job?: Job): Promise<string> {
    const prompt = `${SQL_GEN_PROMPT}\n\nSchema:\n${JSON.stringify(schema, null, 2)}`;
    let code = await this.generateContent('gemini-3-pro-preview', prompt, undefined, job);
    return code.replace(/^```sql\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '');
  }

  async generateSyntheticData(schema: any, instruction: string, job?: Job): Promise<any> {
    const prompt = `
    You are a Data Generator.
    Generate a COMPLETE, LOGICAL, and REALISTIC JSON file that strictly follows the provided JSON Schema.
    
    Instructions: ${instruction}
    
    Rules:
    1. Fill ALL defined fields in the schema.
    2. Use realistic data (names, dates, addresses, etc.). 
    3. If arrays are defined, populate them with at least 3-5 items.
    4. Ensure the data looks "proper" and professional.
    5. Return ONLY the JSON object. No markdown.
    
    JSON Schema:
    ${JSON.stringify(schema)}
    `;
    
    // Complex Task: Use gemini-3-pro-preview
    const res = await this.generateContent('gemini-3-pro-preview', prompt, undefined, job);
    return this.cleanJson(res);
  }

  private cleanJson(text: string): any {
    try {
      // Remove code blocks if present
      let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(clean);
    } catch (e) {
      logger.log('ERROR', 'Failed to parse AI JSON response', { text });
      throw new Error("AI returned invalid JSON");
    }
  }
}

export const geminiService = new GeminiService();

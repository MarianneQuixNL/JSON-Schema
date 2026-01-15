export class TranslationService {
  async translate(text: string, target: string): Promise<string> {
    return `Translated[${target}]: ${text}`;
  }
}
export const translationService = new TranslationService();
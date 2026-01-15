export class LanguageService {
  async analyzeSentiment(text: string): Promise<any> {
    return { score: 0.9, magnitude: 0.8 };
  }
}
export const languageService = new LanguageService();
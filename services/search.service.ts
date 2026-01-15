export class SearchService {
  async search(query: string): Promise<any[]> {
    return [{ title: "Result 1", link: "http://example.com" }];
  }
}
export const searchService = new SearchService();
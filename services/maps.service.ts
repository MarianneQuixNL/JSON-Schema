export class MapsService {
  async getPlace(query: string): Promise<any> {
    return { name: "Katje HQ", location: "Virtual" };
  }
}
export const mapsService = new MapsService();
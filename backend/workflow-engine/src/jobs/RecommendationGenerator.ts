import { RecommendationEngine } from '../recommendations/RecommendationEngine';

export class RecommendationGenerator {
  private engine = new RecommendationEngine();

  async run(): Promise<void> {
    console.log(`[RecommendationGenerator] Starting at ${new Date().toISOString()}`);
    await this.engine.generateForAllCustomers();
    console.log(`[RecommendationGenerator] Completed at ${new Date().toISOString()}`);
  }
}

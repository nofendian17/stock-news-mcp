import { z } from "zod";
import { NewsArticle, ScrapeNewsParams } from "../types/index.js";
import { EmitenNewsScraper } from "../scrapers/emitennews.js";
import { CNBCIndonesiaScraper } from "../scrapers/cnbc-indonesia.js";
import { KontanScraper } from "../scrapers/kontan.js";
import { BisnisIndonesiaScraper } from "../scrapers/bisnis-indonesia.js";

export const ScrapeNewsParamsSchema = z.object({
  source: z.enum(["cnbc", "kontan", "bisnis", "emitennews", "all"]),
  limit: z.number().min(1).max(50).optional().default(10),
  keywords: z.array(z.string()).optional(),
  includeContent: z.boolean().optional().default(false),
});

export async function scrapeStockNews(
  params: ScrapeNewsParams,
): Promise<NewsArticle[]> {
  const validated = ScrapeNewsParamsSchema.parse(params);
  const { source, limit, keywords, includeContent } = validated;

  let allArticles: NewsArticle[] = [];

  const scraperConfig = {
    maxArticles: limit,
    includeContent: includeContent,
    keywords: keywords,
  };

  const scrapers = {
    cnbc: new CNBCIndonesiaScraper(scraperConfig),
    kontan: new KontanScraper(scraperConfig),
    bisnis: new BisnisIndonesiaScraper(scraperConfig),
    emitennews: new EmitenNewsScraper(scraperConfig),
  };

  if (source === "all") {
    // Scrape from all sources in parallel
    const results = await Promise.allSettled([
      scrapers.emitennews.scrapeWithCleanup(),
      scrapers.cnbc.scrapeWithCleanup(),
      scrapers.kontan.scrapeWithCleanup(),
      scrapers.bisnis.scrapeWithCleanup(),
    ]);

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        allArticles.push(...result.value);
      }
    });
  } else {
    // Scrape from specific source
    const scraper = scrapers[source];
    allArticles = await scraper.scrapeWithCleanup();
  }

  // Sort by date (newest first) and limit
  allArticles.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  return allArticles.slice(0, limit);
}

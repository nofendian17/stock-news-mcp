export interface NewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: Date;
  summary?: string;
  content?: string; // Full article body/content
  imageUrl?: string;
  tags?: string[];
  relativeDateText?: string;
}

export interface ScraperConfig {
  timeout?: number;
  headless?: boolean;
  maxArticles?: number;
  userAgent?: string;
  includeContent?: boolean; // Whether to scrape full article content
  keywords?: string[]; // Keywords for searching
}

export interface ScrapeNewsParams {
  source: "cnbc" | "kontan" | "bisnis" | "emitennews" | "all";
  limit?: number;
  keywords?: string[];
  includeContent?: boolean; // Whether to fetch full article body
}

export interface BaseScraper {
  name: string;
  baseUrl: string;
  scrape(config?: ScraperConfig): Promise<NewsArticle[]>;
}

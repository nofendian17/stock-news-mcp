import { AbstractScraper } from "./base.js";
import { NewsArticle, ScraperConfig } from "../types/index.js";

export class CNBCIndonesiaScraper extends AbstractScraper {
  name = "cnbc";
  baseUrl = "https://www.cnbcindonesia.com";

  async scrape(config?: ScraperConfig): Promise<NewsArticle[]> {
    const mergedConfig = { ...this.config, ...config };
    await this.initBrowser();

    if (!this.page) throw new Error("Page not initialized");

    const articles: NewsArticle[] = [];

    try {
      // Build search URL with keywords
      let searchUrl: string;
      if (mergedConfig.keywords && mergedConfig.keywords.length > 0) {
        const keyword = mergedConfig.keywords[0]; // Use first keyword
        searchUrl = `${this.baseUrl}/search?query=${encodeURIComponent(keyword)}`;
      } else {
        searchUrl = `${this.baseUrl}/market`;
      }

      await this.navigateWithRetry(searchUrl, "a.group");

      // Extract article data
      const articlesData = await this.page.evaluate(() => {
        const items: Array<{
          title: string;
          url: string;
          imageUrl?: string;
          dateText?: string;
        }> = [];

        const articleCards = document.querySelectorAll(
          "a.group.flex.gap-4.items-center",
        );

        articleCards.forEach((card) => {
          const href = card.getAttribute("href");
          if (!href) return;

          const titleEl = card.querySelector("h2");
          const title = titleEl?.textContent?.trim() || "";

          const img = card.querySelector("img");
          const imageUrl =
            img?.getAttribute("src") ||
            img?.getAttribute("data-src") ||
            undefined;

          const spans = card.querySelectorAll("span");
          const dateText = spans[spans.length - 1]?.textContent?.trim() || "";

          if (title && href) {
            items.push({ title, url: href, imageUrl, dateText });
          }
        });

        return items;
      });

      const articleDataSlice = articlesData.slice(0, mergedConfig.maxArticles);

      for (const data of articleDataSlice) {
        const article: NewsArticle = {
          title: data.title,
          url: data.url.startsWith("http")
            ? data.url
            : `${this.baseUrl}${data.url}`,
          source: "CNBC Indonesia",
          publishedAt: this.parseDate(data.dateText),
          imageUrl: data.imageUrl,
          relativeDateText: data.dateText,
        };
        articles.push(article);
      }

      if (mergedConfig.includeContent && articles.length > 0) {
        this.logger.info(
          { count: articles.length },
          "Fetching article content in parallel",
        );
        const contentMap = await this.fetchMultipleContents(
          articles.map((a) => ({ url: a.url })),
          ".detail-text",
        );
        articles.forEach((article) => {
          article.content = contentMap.get(article.url) || "";
        });
      }

      this.logger.info(
        { count: articles.length, withContent: mergedConfig.includeContent },
        "CNBC articles scraped",
      );
    } catch (error) {
      this.logger.error({ error: (error as Error).message }, "Scraping failed");
      throw error;
    }

    return articles;
  }

  private parseDate(dateText?: string): Date {
    const now = new Date();
    if (!dateText) return now;

    const match = dateText.match(
      /(\d+)\s+(menit|jam|hari|minggu)\s+yang\s+lalu/,
    );
    if (match) {
      const amount = parseInt(match[1]);
      const unit = match[2];

      const offset =
        {
          menit: amount * 60 * 1000,
          jam: amount * 60 * 60 * 1000,
          hari: amount * 24 * 60 * 60 * 1000,
          minggu: amount * 7 * 24 * 60 * 60 * 1000,
        }[unit] || 0;

      return new Date(now.getTime() - offset);
    }

    return now;
  }
}

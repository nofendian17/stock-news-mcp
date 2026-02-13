import { sub } from "date-fns";
import { AbstractScraper } from "./base.js";
import { NewsArticle, ScraperConfig } from "../types/index.js";

export class EmitenNewsScraper extends AbstractScraper {
  name = "emitennews";
  baseUrl = "https://emitennews.com";

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
        searchUrl = `${this.baseUrl}/search/${encodeURIComponent(keyword)}`;
      } else {
        searchUrl = `${this.baseUrl}/search/`;
      }

      await this.navigateWithRetry(searchUrl, "a.news-card-2");

      const articlesData = await this.page.evaluate(() => {
        const items: Array<{
          title: string;
          url: string;
          relativeDateText: string;
          imageUrl?: string;
        }> = [];

        const articleCards = document.querySelectorAll(
          "a.news-card-2.search-result-item",
        );

        articleCards.forEach((card) => {
          const href = card.getAttribute("href");
          if (!href) return;

          const titleEl = card.querySelector("p");
          const title = titleEl?.textContent?.trim() || "";

          const img = card.querySelector("img");
          const imageUrl = img?.getAttribute("src") || undefined;

          const dateEl = card.querySelector("span");
          const relativeDateText = dateEl?.textContent?.trim() || "";

          if (title && href) {
            items.push({
              title,
              url: href,
              relativeDateText,
              imageUrl,
            });
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
          source: "EmitenNews.com",
          publishedAt: this.parseDate(data.relativeDateText),
          relativeDateText: data.relativeDateText,
          imageUrl: data.imageUrl,
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
          ".article-body",
        );
        articles.forEach((article) => {
          article.content = contentMap.get(article.url) || "";
        });
      }

      this.logger.info(
        { count: articles.length, withContent: mergedConfig.includeContent },
        "Articles scraped successfully",
      );
    } catch (error) {
      this.logger.error({ error: (error as Error).message }, "Scraping failed");
      throw error;
    }

    return articles;
  }

  private parseDate(dateText: string): Date {
    const now = new Date();

    if (!dateText) return now;

    const absoluteMatch = dateText.match(
      /(\d{2})\/(\d{2})\/(\d{4}),\s+(\d{2}):(\d{2})\s+WIB/,
    );
    if (absoluteMatch) {
      const [, day, month, year, hour, minute] = absoluteMatch;
      return new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
      );
    }

    const relativeMatch = dateText.match(
      /(\d+)\s+(menit|jam|hari)\s+yang\s+lalu/,
    );
    if (relativeMatch) {
      const amount = parseInt(relativeMatch[1]);
      const unit = relativeMatch[2];

      switch (unit) {
        case "menit":
          return sub(now, { minutes: amount });
        case "jam":
          return sub(now, { hours: amount });
        case "hari":
          return sub(now, { days: amount });
        default:
          return now;
      }
    }

    return now;
  }
}

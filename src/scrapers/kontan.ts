import { AbstractScraper } from "./base.js";
import { NewsArticle, ScraperConfig } from "../types/index.js";

export class KontanScraper extends AbstractScraper {
  name = "kontan";
  baseUrl = "https://investasi.kontan.co.id";

  async scrape(config?: ScraperConfig): Promise<NewsArticle[]> {
    const mergedConfig = { ...this.config, ...config };
    await this.initBrowser();

    if (!this.page) throw new Error("Page not initialized");

    const articles: NewsArticle[] = [];

    try {
      // Build search URL with keywords
      let searchUrl: string;
      if (mergedConfig.keywords && mergedConfig.keywords.length > 0) {
        const keyword = mergedConfig.keywords.join(" "); // Join multiple keywords
        searchUrl = `${this.baseUrl}/search/?search=${encodeURIComponent(keyword)}`;
      } else {
        searchUrl = this.baseUrl;
      }

      await this.navigateWithRetry(searchUrl, "ul#list-news");

      // Extract article data
      const articlesData = await this.page.evaluate(() => {
        const items: Array<{
          title: string;
          url: string;
          imageUrl?: string;
          dateText?: string;
        }> = [];

        const listItems = document.querySelectorAll("ul#list-news li");

        listItems.forEach((item) => {
          const link = item.querySelector("a");
          if (!link) return;

          const href = link.getAttribute("href");
          if (!href) return;

          const titleEl = item.querySelector("h1");
          const title = titleEl?.textContent?.trim() || "";

          const img = item.querySelector("img");
          const imageUrl =
            img?.getAttribute("data-src") ||
            img?.getAttribute("src") ||
            undefined;

          const ketEl = item.querySelector(".ket");
          const ketText = ketEl?.textContent?.trim() || "";

          const dateMatch = ketText.match(
            /(\w+)\s*\|\s*(\w+,\s*\d{1,2}\s+\w+\s+\d{4}\s*\/\s*\d{1,2}:\d{2}\s*\w+)/,
          );
          const dateText = dateMatch ? dateMatch[2] : "";

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
          source: "Kontan",
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
          ".tmpt-desk-kon",
        );
        articles.forEach((article) => {
          article.content = contentMap.get(article.url) || "";
        });
      }

      this.logger.info(
        { count: articles.length, withContent: mergedConfig.includeContent },
        "Kontan articles scraped",
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
      /(\d{1,2})\s+(\w+)\s+(\d{4})\s*\/\s*(\d{1,2}):(\d{2})/,
    );
    if (match) {
      const [, day, monthName, year, hour, minute] = match;

      const months: { [key: string]: number } = {
        Januari: 0,
        Februari: 1,
        Maret: 2,
        April: 3,
        Mei: 4,
        Juni: 5,
        Juli: 6,
        Agustus: 7,
        September: 8,
        Oktober: 9,
        November: 10,
        Desember: 11,
      };

      const month = months[monthName] ?? 0;
      return new Date(
        parseInt(year),
        month,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
      );
    }

    return now;
  }
}

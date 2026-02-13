import { AbstractScraper } from "./base.js";
import { NewsArticle, ScraperConfig } from "../types/index.js";

export class BisnisIndonesiaScraper extends AbstractScraper {
  name = "bisnis";
  baseUrl = "https://search.bisnis.com";

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
        searchUrl = `${this.baseUrl}/?q=${encodeURIComponent(keyword)}`;
      } else {
        searchUrl = `${this.baseUrl}/?q=saham`;
      }

      await this.navigateWithRetry(searchUrl, "a.artLink");

      const articlesData = await this.page.evaluate(() => {
        const items: Array<{
          title: string;
          url: string;
          imageUrl?: string;
          dateText?: string;
        }> = [];

        const artLinks = document.querySelectorAll("a.artLink");

        artLinks.forEach((link) => {
          const redirectUrl = link.getAttribute("href");
          if (!redirectUrl) return;

          let actualUrl = "";
          try {
            const urlObj = new URL(redirectUrl, window.location.origin);
            actualUrl = urlObj.searchParams.get("url") || redirectUrl;
          } catch {
            actualUrl = redirectUrl;
          }

          const titleEl = link.querySelector("h4");
          const title = titleEl?.textContent?.trim() || "";

          const dateDiv = link.querySelector("div");
          const dateText = dateDiv?.textContent?.trim() || "";

          const prevLink =
            link.parentElement?.previousElementSibling?.querySelector(
              "a.artLinkImg",
            );
          const img = prevLink?.querySelector("img");
          const imageUrl = img?.getAttribute("src") || undefined;

          if (title && actualUrl) {
            items.push({ title, url: actualUrl, imageUrl, dateText });
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
            : `https://market.bisnis.com${data.url}`,
          source: "Bisnis Indonesia",
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
          ".article__content, .box_article, article, .content-body",
        );
        articles.forEach((article) => {
          article.content = contentMap.get(article.url) || "";
        });
      }

      this.logger.info(
        { count: articles.length, withContent: mergedConfig.includeContent },
        "Bisnis Indonesia articles scraped",
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

    const relativeMatch = dateText.match(
      /(\d+)\s+(menit|jam|hari|minggu)\s+yang\s+lalu/,
    );
    if (relativeMatch) {
      const amount = parseInt(relativeMatch[1]);
      const unit = relativeMatch[2];

      const offset =
        {
          menit: amount * 60 * 1000,
          jam: amount * 60 * 60 * 1000,
          hari: amount * 24 * 60 * 60 * 1000,
          minggu: amount * 7 * 24 * 60 * 60 * 1000,
        }[unit] || 0;

      return new Date(now.getTime() - offset);
    }

    const absoluteMatch = dateText.match(
      /(\d{1,2})\s+(\w+)\s+(\d{4})\s+(\d{1,2}):(\d{2})/,
    );
    if (absoluteMatch) {
      const [, day, monthName, year, hour, minute] = absoluteMatch;
      const months: { [key: string]: number } = {
        January: 0,
        February: 1,
        March: 2,
        April: 3,
        May: 4,
        June: 5,
        July: 6,
        August: 7,
        September: 8,
        October: 9,
        November: 10,
        December: 11,
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

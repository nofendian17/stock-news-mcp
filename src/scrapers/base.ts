import { Page } from "puppeteer";
import pino from "pino";
import { NewsArticle, ScraperConfig, BaseScraper } from "../types/index.js";
import { browserManager } from "../browser-manager.js";

const logger = pino(
  { level: "info" },
  pino.destination(2), // stderr
);

export abstract class AbstractScraper implements BaseScraper {
  abstract name: string;
  abstract baseUrl: string;

  protected page: Page | null = null;
  private _logger?: pino.Logger;

  protected get logger(): pino.Logger {
    if (!this._logger) {
      this._logger = logger.child({ scraper: this.name });
    }
    return this._logger;
  }

  constructor(protected config: ScraperConfig = {}) {
    this.config = {
      timeout: 20000,
      headless: true,
      maxArticles: 20,
      ...config,
    };
  }

  protected async initBrowser(): Promise<void> {
    if (!this.page) {
      this.logger.debug("Initializing browser...");
      this.page = await browserManager.createPage();
    }
  }

  protected async navigate(
    url: string,
    waitForSelector?: string,
    timeout = 10000,
  ): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    this.logger.debug({ url }, "Navigating to URL");

    try {
      await this.page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: timeout,
      });

      if (waitForSelector) {
        await this.page.waitForSelector(waitForSelector, {
          timeout: 3000,
        });
      }
    } catch (error) {
      this.logger.warn(
        { error: (error as Error).message, url },
        "Navigation failed",
      );
      throw error;
    }
  }

  protected async navigateWithRetry(
    url: string,
    waitForSelector?: string,
    maxRetries = 2,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.navigate(url, waitForSelector, 15000);
        return;
      } catch (error) {
        if (attempt === maxRetries) {
          this.logger.error(
            { url, attempts: maxRetries },
            "Navigation failed after retries",
          );
          throw error;
        }
        this.logger.warn({ url, attempt }, "Navigation failed, retrying...");
        await this.delay(500 * attempt);
      }
    }
  }

  protected async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected async closeBrowser(): Promise<void> {
    if (this.page) {
      await browserManager.closePage(this.page);
      this.page = null;
    }
    this.logger.debug("Browser released");
  }

  protected async scrapeArticleContent(
    url: string,
    contentSelector: string = "article, .article-content, .content, .post-content",
  ): Promise<string> {
    if (!this.page) throw new Error("Page not initialized");

    try {
      await this.navigate(url);

      const content = await this.page.evaluate((selector: string) => {
        const contentEl = document.querySelector(selector);
        if (!contentEl) return "";

        const scripts = contentEl.querySelectorAll("script, style");
        scripts.forEach((el) => el.remove());

        return contentEl.textContent?.trim() || "";
      }, contentSelector);

      return content;
    } catch (error) {
      this.logger.warn(
        { error: (error as Error).message, url },
        "Failed to scrape content",
      );
      return "";
    }
  }

  protected async fetchMultipleContents(
    articles: Array<{ url: string }>,
    contentSelector: string,
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const concurrency = 3;

    for (let i = 0; i < articles.length; i += concurrency) {
      const batch = articles.slice(i, i + concurrency);

      const promises = batch.map(async ({ url }) => {
        const page = await browserManager.createPage();
        try {
          await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 12000,
          });

          const content = await page.evaluate((selector: string) => {
            const contentEl = document.querySelector(selector);
            if (!contentEl) return "";
            const scripts = contentEl.querySelectorAll("script, style");
            scripts.forEach((el) => el.remove());
            return contentEl.textContent?.trim() || "";
          }, contentSelector);

          return { url, content };
        } catch (error) {
          this.logger.warn(
            { error: (error as Error).message, url },
            "Failed to fetch content",
          );
          return { url, content: "" };
        } finally {
          await browserManager.closePage(page);
        }
      });

      const batchResults = await Promise.all(promises);
      batchResults.forEach(({ url, content }) => results.set(url, content));
    }

    return results;
  }

  abstract scrape(config?: ScraperConfig): Promise<NewsArticle[]>;

  async scrapeWithCleanup(config?: ScraperConfig): Promise<NewsArticle[]> {
    try {
      return await this.scrape(config);
    } finally {
      await this.closeBrowser();
    }
  }
}

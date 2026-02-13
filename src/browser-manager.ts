import puppeteer, { Browser, Page } from "puppeteer";
import pino from "pino";

const logger = pino(
  { level: "info" },
  pino.destination(2), // stderr
);

class BrowserManager {
  private static instance: BrowserManager;
  private browser: Browser | null = null;
  private isInitializing = false;

  static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  async getBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;

    if (this.isInitializing) {
      return new Promise((resolve) => {
        const check = () => {
          if (this.browser) {
            resolve(this.browser);
          } else {
            setTimeout(check, 10);
          }
        };
        check();
      });
    }

    this.isInitializing = true;
    logger.info("Launching shared browser...");

    try {
      // Try multiple possible Chrome paths
      const possiblePaths = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
      ].filter(Boolean);

      let executablePath: string | undefined;
      let errorMsg = "";

      for (const path of possiblePaths) {
        try {
          this.browser = await puppeteer.launch({
            headless: true,
            args: [
              "--no-sandbox",
              "--disable-setuid-sandbox",
              "--disable-dev-shm-usage",
              "--disable-gpu",
              "--disable-software-rasterizer",
            ],
            executablePath: path,
          });
          executablePath = path;
          logger.info({ path }, "Browser launched successfully");
          break;
        } catch (e) {
          errorMsg = (e as Error).message;
          if (this.browser) {
            await this.browser.close().catch(() => {});
            this.browser = null;
          }
        }
      }

      if (!this.browser) {
        throw new Error(`No Chrome browser found. Tried: ${possiblePaths.join(", ")}. Last error: ${errorMsg}`);
      }
    } finally {
      this.isInitializing = false;
    }

    return this.browser;
  }

  async createPage(): Promise<Page> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    await this.configurePage(page);
    return page;
  }

  private async configurePage(page: Page): Promise<void> {
    await page.setRequestInterception(true);

    page.on("request", (req) => {
      const blockedTypes = ["image", "stylesheet", "font", "media"];
      const blockedDomains = [
        "google-analytics.com",
        "googletagmanager.com",
        "googlesyndication.com",
        "doubleclick.net",
        "facebook.com/tr",
        "ads.",
        "analytics.",
      ];

      const url = req.url();
      const isBlockedDomain = blockedDomains.some((d) => url.includes(d));

      if (blockedTypes.includes(req.resourceType()) || isBlockedDomain) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );
    await page.setViewport({ width: 1366, height: 768 });
  }

  async closePage(page: Page): Promise<void> {
    try {
      await page.close();
    } catch {
      // Ignore close errors
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      const pages = await this.browser.pages();
      await Promise.all(pages.map((p) => p.close().catch(() => {})));
      await this.browser.close();
      this.browser = null;
      logger.info("Shared browser closed");
    }
  }
}

export const browserManager = BrowserManager.getInstance();

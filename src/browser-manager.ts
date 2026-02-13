import puppeteer, { Browser, Page } from "puppeteer";
import pino from "pino";
import { existsSync } from "fs";

const logger = pino(
  { level: "info" },
  pino.destination(2), // stderr
);

class BrowserManager {
  private static instance: BrowserManager;
  private browser: Browser | null = null;
  private isInitializing = false;
  private initPromise: Promise<Browser> | null = null;

  static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  private findChromePath(): string | undefined {
    const possiblePaths = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/chrome",
      "/usr/lib/chromium/chromium",
      "/snap/bin/chromium",
    ].filter(Boolean) as string[];

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        logger.info({ path }, "Found Chrome/Chromium");
        return path;
      }
    }

    logger.warn("No Chrome/Chromium found in standard locations");
    return undefined;
  }

  async getBrowser(): Promise<Browser> {
    // Return existing browser
    if (this.browser) {
      // Check if browser is still connected
      try {
        await this.browser.version();
        return this.browser;
      } catch {
        logger.warn("Browser disconnected, relaunching...");
        this.browser = null;
      }
    }

    // Return existing initialization promise
    if (this.initPromise) {
      return this.initPromise;
    }

    // Start new initialization
    this.initPromise = this.launchBrowser();

    try {
      this.browser = await this.initPromise;
      return this.browser;
    } finally {
      this.initPromise = null;
    }
  }

  private async launchBrowser(): Promise<Browser> {
    this.isInitializing = true;
    logger.info("Launching browser...");

    const startTime = Date.now();

    try {
      const executablePath = this.findChromePath();

      if (!executablePath) {
        throw new Error(
          "Chrome/Chromium not found. Please install Chrome or set PUPPETEER_EXECUTABLE_PATH",
        );
      }

      const browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-software-rasterizer",
          "--disable-extensions",
          "--disable-default-apps",
          "--no-first-run",
          "--memory-pressure-off",
        ],
        executablePath,
        timeout: 30000, // 30 seconds timeout for launch
      });

      const duration = Date.now() - startTime;
      logger.info(
        { duration, executablePath },
        "Browser launched successfully",
      );

      this.isInitializing = false;
      return browser;
    } catch (error) {
      this.isInitializing = false;
      logger.error({ error }, "Failed to launch browser");
      throw error;
    }
  }

  async createPage(): Promise<Page> {
    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      await this.configurePage(page);
      return page;
    } catch (error) {
      logger.error({ error }, "Failed to create page");
      throw error;
    }
  }

  private async configurePage(page: Page): Promise<void> {
    try {
      await page.setRequestInterception(true);

      page.on("request", (req) => {
        try {
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
        } catch {
          // Ignore request interception errors
          req.continue();
        }
      });

      await page.setUserAgent(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      );
      await page.setViewport({ width: 1366, height: 768 });
    } catch (error) {
      logger.error({ error }, "Failed to configure page");
      throw error;
    }
  }

  async closePage(page: Page): Promise<void> {
    try {
      if (!page.isClosed()) {
        await page.close();
      }
    } catch {
      // Ignore close errors
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      try {
        const pages = await this.browser.pages();
        await Promise.all(pages.map((p) => this.closePage(p)));
        await this.browser.close();
        logger.info("Browser closed");
      } catch (error) {
        logger.error({ error }, "Error during browser cleanup");
      } finally {
        this.browser = null;
        this.initPromise = null;
      }
    }
  }
}

export const browserManager = BrowserManager.getInstance();

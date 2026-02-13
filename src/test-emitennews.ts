#!/usr/bin/env node
// Quick test script for EmitenNews scraper
import { EmitenNewsScraper } from "./scrapers/emitennews.js";

const scraper = new EmitenNewsScraper({ maxArticles: 5 });

scraper
  .scrapeWithCleanup()
  .then((articles) => {
    console.log(
      `\n✅ Successfully scraped ${articles.length} articles from EmitenNews.com:\n`,
    );
    articles.forEach((article, index) => {
      console.log(`${index + 1}. ${article.title}`);
      console.log(`   URL: ${article.url}`);
      console.log(`   Date: ${article.publishedAt.toISOString()}`);
      console.log(`   Relative: ${article.relativeDateText || "N/A"}\n`);
    });
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error.message);
    process.exit(1);
  });

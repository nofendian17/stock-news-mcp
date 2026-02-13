#!/usr/bin/env node
// Test script for EmitenNews scraper with content
import { EmitenNewsScraper } from "./scrapers/emitennews.js";

console.log("Testing EmitenNews scraper WITH article content...\n");

const scraper = new EmitenNewsScraper({
  maxArticles: 2, // Only 2 articles to keep test fast
  includeContent: true,
});

scraper
  .scrapeWithCleanup()
  .then((articles) => {
    console.log(
      `\n✅ Successfully scraped ${articles.length} articles with content:\n`,
    );
    articles.forEach((article, index) => {
      console.log(`${"=".repeat(80)}`);
      console.log(`${index + 1}. ${article.title}`);
      console.log(`   URL: ${article.url}`);
      console.log(`   Date: ${article.publishedAt.toISOString()}`);
      console.log(`   Relative: ${article.relativeDateText || "N/A"}`);
      if (article.content) {
        console.log(
          `   Content Preview: ${article.content.substring(0, 200)}...`,
        );
        console.log(`   Content Length: ${article.content.length} characters`);
      } else {
        console.log(`   Content: NOT AVAILABLE`);
      }
      console.log("");
    });
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error.message);
    process.exit(1);
  });

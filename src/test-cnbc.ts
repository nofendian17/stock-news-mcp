#!/usr/bin/env node
// Test script for CNBC Indonesia scraper
import { CNBCIndonesiaScraper } from "./scrapers/cnbc-indonesia.js";

console.log("Testing CNBC Indonesia scraper...\n");

const scraper = new CNBCIndonesiaScraper({
  maxArticles: 3,
  includeContent: true, // Test with content
});

scraper
  .scrapeWithCleanup()
  .then((articles) => {
    console.log(
      `\n✅ Successfully scraped ${articles.length} articles from CNBC Indonesia:\n`,
    );
    articles.forEach((article, index) => {
      console.log(`${"=".repeat(80)}`);
      console.log(`${index + 1}. ${article.title}`);
      console.log(`   URL: ${article.url}`);
      console.log(`   Date: ${article.publishedAt.toISOString()}`);
      console.log(`   Relative: ${article.relativeDateText || "N/A"}`);
      if (article.content) {
        console.log(
          `   Content Preview: ${article.content.substring(0, 150)}...`,
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

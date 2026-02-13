#!/usr/bin/env node
// Test all scrapers
import { scrapeStockNews } from "./tools/scrape-news.js";

console.log('Testing all scrapers with source="all"...\n');

scrapeStockNews({ source: "all", limit: 5, includeContent: true })
  .then((articles) => {
    console.log(
      `\n✅ Successfully scraped ${articles.length} total articles:\n`,
    );

    // Group by source
    const bySource: { [key: string]: number } = {};
    articles.forEach((article) => {
      bySource[article.source] = (bySource[article.source] || 0) + 1;
    });

    console.log("📊 Articles by source:");
    Object.entries(bySource).forEach(([source, count]) => {
      console.log(`   ${source}: ${count} articles`);
    });

    console.log("\n📰 Latest articles:");
    articles.slice(0, 5).forEach((article, index) => {
      console.log(`   ${index + 1}. [${article.source}] ${article.title}`);
    });
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error.message);
    process.exit(1);
  });

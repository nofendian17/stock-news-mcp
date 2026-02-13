#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import pino from "pino";
import {
  scrapeStockNews,
  ScrapeNewsParamsSchema,
} from "./tools/scrape-news.js";
import { browserManager } from "./browser-manager.js";

const logger = pino(
  { level: process.env.LOG_LEVEL || "info" },
  pino.destination(2), // stderr
);

// Create MCP server
const server = new Server(
  {
    name: "mcp-saham-news",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "scrape_stock_news",
        description:
          "Scrape latest Indonesian stock market news from various sources including CNBC Indonesia, Kontan, Bisnis Indonesia, and EmitenNews.com",
        inputSchema: {
          type: "object",
          properties: {
            source: {
              type: "string",
              enum: ["cnbc", "kontan", "bisnis", "emitennews", "all"],
              description:
                'News source to scrape from, or "all" for all sources',
            },
            limit: {
              type: "number",
              description: "Maximum number of articles to return (1-50)",
              minimum: 1,
              maximum: 50,
              default: 10,
            },
            keywords: {
              type: "array",
              items: { type: "string" },
              description: "Optional keywords to filter articles",
            },
            includeContent: {
              type: "boolean",
              description:
                "Whether to fetch full article body/content (slower but more complete)",
              default: false,
            },
          },
          required: ["source"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "scrape_stock_news") {
    try {
      logger.info({ args }, "Scraping stock news");

      const params = ScrapeNewsParamsSchema.parse(args);
      const articles = await scrapeStockNews(params);

      logger.info({ count: articles.length }, "Successfully scraped articles");

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(articles, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error({ error }, "Failed to scrape news");

      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("MCP Saham News Server started");

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    logger.info("Shutting down...");
    await browserManager.cleanup();
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    logger.info("Shutting down...");
    await browserManager.cleanup();
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error({ error }, "Fatal error");
  process.exit(1);
});

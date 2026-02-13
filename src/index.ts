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

// Track server state
let isShuttingDown = false;

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
  if (isShuttingDown) {
    return {
      content: [{ type: "text", text: "Server is shutting down" }],
      isError: true,
    };
  }

  const { name, arguments: args } = request.params;

  if (name === "scrape_stock_news") {
    try {
      logger.info({ args }, "Scraping stock news");

      const params = ScrapeNewsParamsSchema.parse(args);

      // Add timeout to prevent hanging
      const timeoutMs = 60000; // 60 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("Request timeout after 60s")),
          timeoutMs,
        );
      });

      const articles = (await Promise.race([
        scrapeStockNews(params),
        timeoutPromise,
      ])) as any;

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

// Graceful shutdown handler
async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, "Received shutdown signal");

  try {
    await browserManager.cleanup();
    await server.close();
    logger.info("Server closed gracefully");
  } catch (error) {
    logger.error({ error }, "Error during shutdown");
  }

  process.exit(0);
}

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("MCP Saham News Server started successfully");

  // Handle graceful shutdown
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Prevent uncaught errors from crashing the server
  process.on("uncaughtException", (error) => {
    logger.error({ error }, "Uncaught exception");
    // Don't exit - let the server continue running
  });

  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "Unhandled rejection");
    // Don't exit - let the server continue running
  });
}

main().catch((error) => {
  logger.error({ error }, "Fatal error in main");
  // Don't exit immediately - give time for cleanup
  setTimeout(() => process.exit(1), 1000);
});

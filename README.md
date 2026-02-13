# MCP Server - Indonesian Stock News Scraper

MCP (Model Context Protocol) server for scraping Indonesian stock market news from multiple sources.

## Features

- **Multiple Sources**: Scrapes from 4 major Indonesian financial news websites:
  - EmitenNews.com
  - CNBC Indonesia
  - Kontan
  - Bisnis Indonesia

- **MCP Compatible**: Built with the official MCP SDK
- **Headless Chrome**: Uses Puppeteer for reliable scraping
- **Type-Safe**: Written in TypeScript with Zod validation
- **Keyword Filtering**: Filter articles by keywords
- **Structured Logging**: Pino logger for debugging

## Installation

```bash
npm install -g mcp-saham-news
```

## Configuration

The server requires Chrome/Chromium and uses environment variables:

```bash
# Required: Path to Chrome executable
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

# Optional: Log level (debug, info, warn, error)
export LOG_LEVEL=info
```

### Install Chrome (if not already installed)

```bash
# Ubuntu/Debian
sudo apt-get install chromium-browser

# macOS
brew install chromium
```

## MCP Client Setup

### KiloCode / Cline (VS Code)

Add to your MCP settings (global or workspace):

```json
{
  "mcpServers": {
    "saham-news": {
      "command": "npx",
      "args": ["mcp-saham-news"],
      "env": {
        "PUPPETEER_EXECUTABLE_PATH": "/usr/bin/google-chrome",
        "LOG_LEVEL": "info"
      },
      "disabled": false,
      "alwaysAllow": ["scrape_stock_news"]
    }
  }
}
```

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%/Claude/claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "saham-news": {
      "command": "npx",
      "args": ["mcp-saham-news"],
      "env": {
        "PUPPETEER_EXECUTABLE_PATH": "/usr/bin/google-chrome"
      }
    }
  }
}
```

**Alternatively**, use the globally installed command:

```json
{
  "mcpServers": {
    "saham-news": {
      "command": "mcp-saham-news",
      "env": {
        "PUPPETEER_EXECUTABLE_PATH": "/usr/bin/google-chrome"
      }
    }
  }
}
```

### Restart Client

Restart Claude Desktop or VS Code to load the MCP server.

## MCP Tool

### `scrape_stock_news`

Scrape latest Indonesian stock market news.

**Parameters:**

- `source` (required): News source - `cnbc`, `kontan`, `bisnis`, `emitennews`, or `all`
- `limit` (optional): Number of articles to return (1-50, default: 10)
- `keywords` (optional): Array of keywords to filter articles
- `includeContent` (optional): Fetch full article body (default: false)

**Example:**

```json
{
  "source": "emitennews",
  "limit": 5,
  "keywords": ["BBRI", "BBCA"]
}
```

**Response:**

```json
[
  {
    "title": "Article title",
    "url": "https://...",
    "source": "EmitenNews.com",
    "publishedAt": "2026-02-14T02:00:00.000Z",
    "summary": "Optional summary",
    "imageUrl": "https://...",
    "relativeDateText": "4 jam yang lalu"
  }
]
```

## Development

### Build the Project

```bash
npm run build
```

### Run in Development Mode

```bash
npm run dev
```

### Test Individual Scrapers

```bash
# Test EmitenNews scraper
npx tsx src/scrapers/emitennews.ts

# Test CNBC scraper
npx tsx src/scrapers/cnbc-indonesia.ts
```

## Project Structure

```
src/
├── index.ts              # MCP server entry point
├── types/index.ts        # TypeScript type definitions
├── browser-manager.ts    # Puppeteer browser manager
├── scrapers/
│   ├── base.ts           # Abstract base scraper
│   ├── emiteanews.ts
│   ├── cnbc-indonesia.ts
│   ├── kontan.ts
│   └── bisnis-indonesia.ts
└── tools/
    └── scrape-news.ts    # MCP tool implementation
```

## License

ISC

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
npm install
```

## Configuration

The server uses Puppeteer with system Chrome. Make sure you have Chrome/Chromium installed:

```bash
# Ubuntu/Debian
sudo apt-get install chromium-browser

# Or set custom path
export PUPPETEER_EXECUTABLE_PATH=/path/to/chrome
```

## Usage

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Production

```bash
npm start
```

## MCP Client Setup

To use this server with MCP-compatible clients (Claude Desktop, Cline, etc.):

### 1. Build the Project

```bash
npm install
npm run build
```

### 2. Install Chrome

```bash
# Ubuntu/Debian
sudo apt-get install chromium-browser

# macOS
brew install chromium
```

### 3. Configure Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%/Claude/claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "saham-news": {
      "command": "node",
      "args": ["/full/path/to/mcp/dist/index.js"],
      "env": {
        "PUPPETEER_EXECUTABLE_PATH": "/usr/bin/chromium"
      }
    }
  }
}
```

**Linux example:**

```json
{
  "mcpServers": {
    "saham-news": {
      "command": "node",
      "args": ["/home/username/projects/mcp/dist/index.js"],
      "env": {
        "PUPPETEER_EXECUTABLE_PATH": "/usr/bin/chromium"
      }
    }
  }
}
```

### 4. Configure Cline (VS Code)

Add to your VS Code settings or `cline_mcp_settings.json`:

```json
{
  "mcpServers": [
    {
      "name": "saham-news",
      "transport": "stdio",
      "command": "node",
      "args": ["/full/path/to/mcp/dist/index.js"]
    }
  ]
}
```

### 5. Restart Client

Restart Claude Desktop or VS Code to load the MCP server.

## MCP Tool

### `scrape_stock_news`

Scrape latest Indonesian stock market news.

**Parameters:**

- `source` (required): News source - `cnbc`, `kontan`, `bisnis`, `investing`, `emitennews`, or `all`
- `limit` (optional): Number of articles to return (1-50, default: 10)
- `keywords` (optional): Array of keywords to filter articles

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

## Testing Individual Scrapers

You can test each scraper independently:

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
├── scrapers/
│   ├── base.ts           # Abstract base scraper
│   ├── emitennews.ts
│   ├── cnbc-indonesia.ts
│   ├── kontan.ts
│   ├── bisnis-indonesia.ts
└── tools/
    └── scrape-news.ts    # MCP tool implementation
```

## License

ISC

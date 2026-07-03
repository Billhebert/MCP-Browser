# BVP Browser MCP Server

MCP server for browser automation via Playwright. Provides a comprehensive set of tools for web navigation, testing, auditing, and analysis.

## Features

- **Browser Automation**: navigate, click, fill forms, extract data, screenshots
- **QA Audits**: SEO, accessibility (axe-core), security, performance, HTML validation, link checking
- **Analysis**: CSS analysis, bundle analysis, dependency detection, network waterfall
- **Testing**: form testing, API testing, load testing, visual diffs, smoke tests
- **Privacy/Compliance**: LGPD/GDPR cookie consent audit, privacy form detection, SSL check
- **Corporate**: audit trail, rate limiting, webhooks, collaboration notes, scheduled audits

## Quick Start

```bash
npm install
npm run dev
```

This starts the MCP server via stdio transport with a visible Chromium browser.

## Environment Variables

| Variable | Description |
|---|---|
| `BROWSER_HEADLESS` | `true` to force headless mode |
| `BVP_API_KEY` | Enable API key authentication |
| `BVP_RATE_LIMIT` | Max requests per minute per tool (default: 60) |
| `BVP_WEBHOOKS` | JSON array of webhook URLs with event filters |
| `BVP_AUDIT_DIR` | Custom directory for audit trail logs |

## Tools

The server exposes 102 tools covering:

- **Navigation**: navigate, go_back, refresh, wait, new_tab, switch_tab, close
- **Interaction**: click, fill, select, hover, press_key, scroll_to, drag_and_drop, upload_file
- **Extraction**: get_text, get_html, get_attributes, find, get_form_fields, extract_table, get_cookies
- **Screenshots**: screenshot (with PII masking), element_screenshot
- **Network**: get_network, network_waterfall, export_har, block_requests, mock_api, set_network
- **Device**: set_viewport, set_geo, set_color_scheme, set_locale, emulate_device
- **Audit**: check_a11y, check_seo, check_security, check_links, check_contrast, check_images, check_cache, check_typography, check_third_parties, check_ssl, check_redirects, validate_html, validate_json_ld, check_broken_anchors, check_spelling
- **Performance**: get_performance, lighthouse_audit, perf_budget, add_performance_mark, analyze_bundle, analyze_deps, analyze_css
- **Testing**: test_api, test_form, test_flow, smoke_test, fuzz_form, load_test, visual_diff
- **Data**: set_cookies, set_local_storage, export_page_data, export_pdf, save_snapshot, restore_snapshot
- **Extensions**: install_extension, list_extensions, test_extension
- **Full Site Audit**: full_site_audit (crawl + audit all pages, estilo Unlighthouse)
- **Corporate**: health_check, run_suite, ci_check, take_notes, schedule_audit, compare_audits, generate_report, generate_pdf_report, send_webhook, notify_slack, create_jira_issue

## Architecture

```
src/
  index.ts          - MCP server entry point, tool registration
  browser.ts        - Playwright browser lifecycle management
  tools/            - Individual tool implementations
  corporate/        - Infrastructure (auth, audit, rate-limit, etc.)
tests/              - Test files
```

## 🔒 Security

- **SSRF Protection**: All outgoing HTTP requests (webhooks, sitemap fetching) are validated against localhost, RFC1918 addresses, and non-HTTP protocols
- **Sandboxed JS Execution**: User-provided JavaScript runs in an isolated context with no access to Node.js APIs
- **API Key Authentication**: Optional `BVP_API_KEY` environment variable for request authentication
- **Rate Limiting**: Per-user, per-tool rate limits prevent abuse (configurable via `BVP_RATE_LIMIT`)

## 📊 Monitoring

- **Health Endpoint**: Built-in HTTP health server provides liveness and readiness probes
- **Metrics**: Request counts, error counts, and tool execution durations are tracked in-memory
- **Structured Logging**: JSON-based logging via `createLogger()` with support for child loggers, context bindings, and log levels
- **Audit Trail**: All tool executions are logged to a rotating JSONL file with filtering and statistics

## ⚙️ Corporate Infrastructure

- **Circuit Breaker**: Protects external dependencies from cascading failures — opens after configurable consecutive failures
- **Retry**: Transient fault handling with exponential backoff and configurable max retries
- **Audit Trail Rotation**: Automatic log rotation prevents disk exhaustion while retaining full execution history
```

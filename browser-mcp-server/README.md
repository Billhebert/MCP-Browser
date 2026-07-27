# BVP Browser MCP Server

MCP server for browser automation via Playwright. Provides **102 tools** for web navigation, QA auditing, testing, and monitoring.

## Quick Start

```bash
cd browser-mcp-server
npm install
npm start
```

## Claude Desktop Integration

Copy `claude_desktop_config.example.json` (project root) to your Claude Desktop config:

- **npx mode** — runs via npx install
- **dev mode** — runs from local source via `tsx`
- **Docker mode** — runs via docker compose

## Transports

| Transport | Port | Description |
|-----------|------|-------------|
| **STDIO** | - | Default MCP transport (stdin/stdout) |
| **HTTP** | 3100 | Streamable HTTP transport (`POST /mcp`) |
| **Health** | 9090 | Health check (`GET /health`) + Prometheus metrics (`GET /metrics`) |

Configure HTTP port via `BVP_MCP_PORT` (default `3100`).

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BROWSER_HEADLESS` | auto | Force headless mode |
| `BVP_API_KEY` | - | API key for auth |
| `BVP_RATE_LIMIT` | 60 | Max req/min per user+tool |
| `BVP_AUDIT_DIR` | ~/.bvp-audit | Audit trail directory |
| `BVP_HEALTH_PORT` | 9090 | Health/metrics port |
| `BVP_MCP_PORT` | 3100 | MCP HTTP transport port |
| `BVP_WEBHOOKS` | - | JSON webhook config |
| `BVP_EXTENSIONS` | - | Chrome extension paths |
| `BVP_BROWSER_IDLE_TIMEOUT` | 300000 | Browser idle timeout (ms) |
| `JIRA_HOST` / `JIRA_EMAIL` / `JIRA_TOKEN` | - | Jira integration |

## MCP Features

### Tools (102)

**Navigation:** navigate, go_back, refresh, wait, new_tab, switch_tab, close, list_tabs  
**Interaction:** click, fill, select, hover, press_key, scroll_to, drag_and_drop, upload_file, highlight  
**Extraction:** get_text, get_html, get_attributes, find, get_form_fields, extract_table, get_cookies, export_page_data  
**Screenshots:** screenshot, element_screenshot  
**Network:** get_network, network_waterfall, export_har, block_requests, mock_api, set_network  
**Device:** set_viewport, set_geo, set_color_scheme, set_locale, emulate_device, set_local_storage  
**Performance:** get_performance, lighthouse_audit, perf_budget, add_performance_mark, analyze_bundle, analyze_deps  
**Audit:** check_a11y, analyze_seo, check_security, check_links, check_contrast, check_images, check_cache, check_typography, check_third_parties, check_ssl, check_redirects, validate_html, validate_json_ld, check_broken_anchors, check_spelling, check_readability, analyze_css, check_accessibility_tree, check_console_errors, analyze_state  
**Privacy:** check_cookies_consent, check_privacy_forms  
**Testing:** test_api, test_form, test_flow, fuzz_form, load_test, smoke_test, visual_diff, analyze_responsive, crawl_pages  
**Full Site:** full_site_audit  
**Corporate:** health_check, run_suite, ci_check, take_notes, schedule_audit, compare_audits, generate_report, generate_pdf_report, send_webhook, notify_slack, create_jira_issue, save_snapshot, record_session  
**Extensions:** install_extension, list_extensions, test_extension  
**Utility:** execute_js, ask, explain_issue, suggest_fixes

### Resources

| URI | Description |
|-----|-------------|
| `browser://page/url` | Current page URL |
| `browser://page/title` | Current page title |
| `browser://page/html` | Full page HTML |
| `browser://console/logs` | Browser console logs |
| `browser://network/logs` | Network request logs |
| `browser://status` | Browser status + metrics |

### Prompts

- `audit-page` — Full page quality audit template
- `check-a11y` — WCAG accessibility audit template

## Scripts

```bash
npm run dev         # Watch mode (tsx watch)
npm start           # Production start
npm run build       # Compile TypeScript
npm test            # Run tests (121+ tests)
npm run lint        # ESLint check
npm run format      # Prettier format
npm run typecheck   # tsc --noEmit
```

## Docker

```bash
docker compose up -d
```

## Architecture

- **Serialized execution:** All Playwright ops queue via promise chain
- **Auto-recovery:** Browser restarts on crash
- **PII masking:** Screenshots auto-blur sensitive fields
- **SSRF protection:** Blocks localhost/private IPs
- **Rate limiting:** Per-user per-tool limits
- **Audit trail:** JSONL logging with rotation
- **Idle timeout:** Auto-closes browser after inactivity (configurable)
- **Circuit breaker:** Prevents cascade failures
- **Auto-discovery:** Tools auto-register from filesystem
- **Dual transport:** STDIO + HTTP (Streamable HTTP)
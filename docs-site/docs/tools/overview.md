# Tools Overview

MCP-Browser exposes **130+ tools** categorized by domain. Each tool is a self-contained `.ts` file in `src/tools/` — auto-discovered by the registry — no manual registration needed.

## Categories

- [Navigation & Interaction](./navigation.md) — navigate, click, fill, select, hover, scroll
- [Data Extraction](./extraction.md) — get_text, get_html, extract_table, export_csv, screenshot
- [Audit & Quality](./audit.md) — check_a11y, check_contrast, analyze_seo, check_security (30+ tools)
- [Performance](./performance.md) — get_performance, lighthouse_audit, perf_budget, network_waterfall
- [Security](./security.md) — check_security, scan_owasp_top10, scan_deps, scan_endpoints
- [SQL & Database](./sql.md) — sql_connect, sql_query, sql_execute, sql_schema
- [Storybook](./storybook.md) — storybook_scan, storybook_audit_a11y, storybook_perf, storybook_visual_diff
- [Frontend & Components](./frontend.md) — front_components, ui_design_system, analyze_state
- [Sessions & Snapshots](./sessions.md) — save_snapshot, visual_diff, record_session
- [Webhooks & Notifications](./webhooks.md) — send_webhook, notify_slack, notify_discord
- [Advanced Testing](./advanced-testing.md) — test_contract, test_flow, test_cross_browser, load_test

## Adding a New Tool

```bash
# Create 1 file — that's it
touch src/tools/minha_tool.ts
```

See [Adding a New Tool](../development/new-tool.md) for details.

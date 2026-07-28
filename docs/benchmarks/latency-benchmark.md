# Benchmarks — MCP-Browser Tool Latency

## Metodologia

- **Hardware**: Intel Xeon 3.5GHz, 8GB RAM, SSD NVMe
- **Browser**: Chromium headless
- **Target**: https://example.com (página estática ~1KB)
- **Cliente**: MCP SDK via stdio, 10 execuções por tool
- **Data**: 2026-07-28

## Tool Latency (p50 / p95 / p99)

| Tool | p50 | p95 | p99 | Notas |
|------|-----|-----|-----|-------|
| `listen` (health) | 2ms | 5ms | 10ms | Sem interação com browser |
| `list_tools` | 3ms | 8ms | 15ms | Apenas lookup em Map |
| `list_resources` | 1ms | 3ms | 8ms | Array fixo de 6 itens |
| `list_prompts` | 1ms | 3ms | 8ms | Array fixo de 2 itens |
| `execute_js` | 45ms | 120ms | 250ms | Depende da complexidade do JS |
| `get_text` | 50ms | 100ms | 200ms | Seleção simples de DOM |
| `get_performance` | 60ms | 110ms | 180ms | Performance API |
| `get_html` | 80ms | 150ms | 300ms | Serialização de DOM |
| `screenshot` | 650ms | 900ms | 1200ms | PNG encode + masking |
| `element_screenshot` | 400ms | 600ms | 900ms | PNG de elemento específico |
| `navigate` | 1800ms | 3500ms | 5000ms | Dependente de rede |
| `click` | 300ms | 600ms | 1000ms | Inclui fallback strategies |
| `fill` | 400ms | 700ms | 1200ms | Inclui fallback strategies |
| `check_a11y` | 1200ms | 2000ms | 3500ms | axe-core percorre DOM inteiro |
| `analyze_seo` | 300ms | 500ms | 800ms | Verificações de meta tags |
| `check_security` | 250ms | 450ms | 700ms | Headers + cookies |
| `check_links` | 2000ms | 5000ms | 10000ms | HEAD requests externos |
| `check_contrast` | 400ms | 700ms | 1200ms | Cálculo de luminance |
| `full_site_audit` | 8000ms | 15000ms | 30000ms | Crawl + múltiplas tools |
| `health_check` | 10ms | 25ms | 50ms | Sem interação com browser |
| `visual_diff` | 700ms | 1000ms | 1500ms | pixelmatch entre imagens |
| `export_pdf` | 500ms | 800ms | 1400ms | Geração de PDF |
| `network_waterfall` | 100ms | 200ms | 400ms | Análise de logs capturados |

## Throughput

| Cenário | Tools/s |
|---------|---------|
| Tools sem browser (list_tools, health) | ~500 req/s |
| Tools leves (get_text, get_html) | ~15 req/s |
| Tools pesadas (screenshot, check_a11y) | ~1 req/s |
| Mix (80% leve, 20% pesado) | ~8 req/s |

## Memória

| Estado | RSS |
|--------|-----|
| Servidor iniciado (sem browser) | ~45 MB |
| Após navigate | ~85 MB |
| Após 10 auditorias | ~120 MB |
| Após 50 tools | ~140 MB |
| Após screenshot (PNG em memória) | ~200 MB (pico) |
| Após GC | ~100 MB |

## Startup Time

| Operação | Tempo |
|----------|-------|
| Importação de módulos | ~800ms |
| Inicialização do banco SQLite | ~50ms |
| Lançamento do Chromium | ~2000ms |
| Conexão MCP stdio | ~10ms |
| Total (até primeiro tool/list) | ~3000ms |

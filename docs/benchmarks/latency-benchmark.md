# Benchmarks — MCP-Browser Tool Latency

## Metodologia

- **Hardware**: Intel Xeon 3.5GHz, 8GB RAM, SSD NVMe
- **Browser**: Chromium headless
- **Target**: https://example.com (página estática ~1KB)
- **Cliente**: MCP SDK via stdio, 10 execuções por tool
- **Data**: 2026-07-28

## Tool Latency (p50 / p95 / p99)

> Medições coletadas em 2026-07-28. Hardware: Intel Xeon 3.5GHz, 8GB RAM. Browser: Chromium headless. Target: https://example.com. 5 execuções por tool.

| Tool | p50 | p95 | p99 | avg | Notas |
|------|-----|-----|-----|-----|-------|
| `list_tools` | 12ms | 12ms | 12ms | 11ms | Lookup em Map + conversão MCP |
| `list_resources` | 1ms | 4ms | 4ms | 2ms | Array fixo de 6 itens |
| `health_check` | 15ms | 329ms | 329ms | 78ms | Primeira chamada inclui warmup |
| `get_text` | 24ms | 104ms | 104ms | 39ms | Seleção simples de DOM |
| `get_html` | 9ms | 10ms | 10ms | 9ms | Serialização de outerHTML |
| `get_performance` | 14ms | 16ms | 16ms | 14ms | Performance API |
| `get_console` | 2ms | 3ms | 3ms | 2ms | Apenas leitura de buffer |
| `execute_js` | 8ms | 9ms | 9ms | 8ms | JS simples (`document.title`) |
| `hover` | 350ms | 369ms | 369ms | 352ms | Playwright hover API |
| `highlight` | 12ms | 17ms | 17ms | 14ms | JS injection de estilo |
| `screenshot` | 69ms | 87ms | 87ms | 71ms | PNG encode + masking |
| `element_screenshot` | 97ms | 102ms | 102ms | 96ms | PNG de elemento |
| `export_pdf` | 20ms | 24ms | 24ms | 21ms | Geração de PDF |
| `check_a11y` | 193ms | 344ms | 344ms | 220ms | axe-core na página example.com |
| `analyze_seo` | 10ms | 15ms | 15ms | 11ms | Meta tag checks |
| `check_security` | 12ms | 14ms | 14ms | 12ms | Headers + cookies |
| `check_contrast` | 8ms | 11ms | 11ms | 9ms | Cálculo de luminance |
| `check_images` | 8ms | 11ms | 11ms | 8ms | Auditoria de imagens |
| `check_spelling` | 9ms | 10ms | 10ms | 9ms | Dicionário em memória |
| `validate_json_ld` | 8ms | 15ms | 15ms | 10ms | Extração de JSON-LD |
| `analyze_bundle` | 14ms | 14ms | 14ms | 13ms | Scan de scripts |
| `analyze_responsive` | 1086ms | 1097ms | 1097ms | 1084ms | 3 viewports + screenshots |

## Throughput

| Cenário | Tools/s | Baseline |
|---------|---------|----------|
| Tools sem browser (list_tools, list_resources) | ~83 req/s | Latência média 7ms |
| Tools leves (get_text, get_html, execute_js) | ~25 req/s | Latência média 20ms |
| Tools de auditoria (check_a11y, analyze_seo) | ~5 req/s | Latência média 60ms |
| Tools pesadas (analyze_responsive, hover) | ~1 req/s | Latência média 700ms |
| Mix (80% leve, 20% pesado) | ~12 req/s | Serialized queue |

> Nota: O throughput é limitado pela `serialized()` queue — operações no navegador são estritamente sequenciais. Múltiplas sessões podem escalar horizontalmente.

## Memória

> Medido com `ps aux` e `process.memoryUsage()` durante a execução dos benchmarks.

| Estado | RSS | Heap Used |
|--------|-----|-----------|
| Servidor iniciado (sem browser) | ~52 MB | ~6 MB |
| Após navigate + 5 tools leves | ~95 MB | ~12 MB |
| Após 20 tools (mix) | ~118 MB | ~18 MB |
| Após screenshot (PNG em memória) | ~145 MB | ~22 MB |
| Após analyze_responsive (3 screenshots) | ~165 MB | ~28 MB |
| Após GC (forçado) | ~105 MB | ~10 MB |

## Startup Time

| Operação | Tempo |
|----------|-------|
| Importação de módulos (~129 tools) | ~650ms |
| Inicialização do banco SQLite | ~40ms |
| Lançamento do Chromium (headless) | ~1800ms |
| Criação da sessão default | ~200ms |
| Conexão MCP stdio | ~8ms |
| **Total (até primeiro `list_tools`)** | **~2700ms** |

> O startup mais lento ocorre na primeira execução. Após o cache de módulos do Node.js, imports subsequentes são ~100ms.

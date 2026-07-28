# SLOs, SLIs, and Burn Rate

## Service Level Objectives

| SLO | Target | Window | Measure |
|-----|--------|--------|---------|
| Tool execution latency (p50) | < 500ms | 30 days | SLI 1 |
| Tool execution latency (p95) | < 3s | 30 days | SLI 2 |
| Tool success rate | > 99% | 30 days | SLI 3 |
| Server uptime | > 99.9% | 30 days | SLI 4 |
| Startup time | < 10s | 30 days | SLI 5 |

## Service Level Indicators

### SLI 1: Tool Latency p50

```
SLI = p50(duration_ms) across all tool calls in the window

Source: bvp_tool_duration_ms_avg (Prometheus)
```

### SLI 2: Tool Latency p95

```
SLI = p95(duration_ms) across all tool calls in the window

Source: bvp_tool_duration_bucket (Prometheus histogram)
Implementation: histogram_quantile(0.95, rate(bvp_tool_duration_bucket[5m]))
```

### SLI 3: Tool Success Rate

```
SLI = successful_calls / total_calls
successful_calls = total_calls - errored_calls

Source:
  total:   bvp_requests_total
  errors:  bvp_errors_total

Implementation: 1 - (rate(bvp_errors_total[5m]) / rate(bvp_requests_total[5m]))
```

### SLI 4: Server Uptime

```
SLI = time_server_has_been_responding / total_time_in_window

Source: bvp_uptime_seconds (resets on restart)
```

### SLI 5: Startup Time

```
SLI = time_from_process_start_to_first_successful_health_check

Measured manually or via synthetic monitoring.
```

## Burn Rate

Burn rate measures how fast the error budget is being consumed.

```
Error Budget = 1 - SLO
    Example: for SLO 99.5%, error budget = 0.5% = 0.005

Burn Rate = (1 - SLI) / (1 - SLO)
    Example: SLI 98% with SLO 99.5% → burn rate = (0.02) / (0.005) = 4x
```

### Burn Rate Alert Thresholds

| Burn Rate | Duration | Severity | Action |
|-----------|----------|----------|--------|
| > 2x | 1 hour | Warning | Investigate degradation |
| > 4x | 2 hours | Critical | Page on-call engineer |
| > 10x | 30 minutes | Critical | Emergency response |

### Prometheus Burn Rate Alerts

```yaml
# 2x burn rate over 1 hour (consumes 8.3% of monthly budget)
- alert: HighErrorBurnRate2x
  expr: (1 - rate(bvp_errors_total[1h]) / rate(bvp_requests_total[1h])) / 0.005 > 2
  labels: { severity: warning }
  annotations:
    summary: "Error budget burn rate 2x over 1 hour"

# 4x burn rate over 2 hours (consumes 33% of monthly budget)
- alert: HighErrorBurnRate4x
  expr: (1 - rate(bvp_errors_total[2h]) / rate(bvp_requests_total[2h])) / 0.005 > 4
  labels: { severity: critical }
  annotations:
    summary: "Error budget burn rate 4x over 2 hours"
```

## Error Budget Policy

| Budget Remaining | Action |
|-----------------|--------|
| > 50% | Business as usual |
| 20-50% | Prioritize bug fixes over features |
| 5-20% | Freeze deploys, focus on reliability |
| < 5% | Incident review, rollback if needed |

## Monthly SLO Report Template

```markdown
# SLO Report — MCP-Browser — July 2026

| SLO | Target | Actual | Met? |
|-----|--------|--------|------|
| Latency p50 < 500ms | 99.0% | 98.5% | ❌ |
| Latency p95 < 3s | 98.0% | 99.1% | ✅ |
| Success rate > 99% | 99.0% | 99.3% | ✅ |
| Uptime > 99.9% | 99.9% | 100% | ✅ |

Error Budget Consumed: 42% (remaining: 58%)
Top contributors to error budget consumption:
- check_links (timeout on external domains): 35%
- lighthouse_audit (DOM measurement failures): 12%

Action Items:
- [ ] Add timeout configuration to check_links
- [ ] Improve lighthouse error handling
```

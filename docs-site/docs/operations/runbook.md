# Production Runbook

## 1. Como Diagnosticar Lentidão

### Sintoma: tools demoram mais que o esperado

```bash
# 1. Verificar health do servidor
curl -s http://localhost:9090/health | jq

# 2. Verificar métricas de latência
curl -s http://localhost:9090/metrics | grep bvp_tool_duration

# 3. Verificar logs de erros recentes
tail -100 /home/bvp-user/.bvp-audit/audit.jsonl | grep -v '"status":"pass"'

# 4. Verificar memória do processo
ps aux | grep "node dist/index" | awk '{print $6/1024 " MB"}'

# 5. Verificar uso de CPU do Chromium
ps aux | grep chromium | awk '{print $3, $4, $11}'
```

### Causas comuns
- **Navegador acumulando sessions**: muitas abas abertas sem cleanup
- **Console/network logs grandes**: >200 console + >500 network logs
- **SQLite cresceu demais**: auditorias acumuladas sem rotação
- **Rate limiting**: muitas requisições em curto período

```bash
# Limpar logs do navegador
curl -X POST http://localhost:3100/api/tools/check_console_errors/execute \
  -H "Content-Type: application/json" \
  -d '{"args":{"clear":"true"}}'

# Fechar sessions não utilizadas
curl -s http://localhost:3100/api/sessions | jq '.sessions[].id' | head -5
```

## 2. O Que Fazer Quando o Navegador Crashar

### Sintoma: tools retornam `isError: true` com menção a "crash" ou "closed"

```bash
# 1. Verificar status do navegador
curl -s http://localhost:3100/api/tools/health_check/execute \
  -X POST -H "Content-Type: application/json" -d '{}' | jq

# 2. Se browser.status não for "connected", reiniciar a session default
curl -s http://localhost:3100/api/sessions/default/close \
  -X POST | jq

# 3. Uma nova session default será criada automaticamente na próxima tool call
```

### Prevenção
- O crash recovery é automático: `ensureDefaultSession()` cria nova session
- Se o crash for frequente, verificar limite de memória do contêiner
- Logs de crash estão em `page.on("crash")` → console logs

## 3. Como Rotacionar Logs

### Auditoria JSONL

```bash
# Rotação manual
mv ~/.bvp-audit/audit.jsonl ~/.bvp-audit/audit-$(date +%Y%m%d).jsonl
kill -USR1 <PID>  # Recarregar arquivo de log (se suportado)

# O sistema faz rotação automática a 10MB (mantém 5 arquivos)
```

### SQLite Database

```bash
# Backup
cp ~/.bvp-browser/data.db ~/.bvp-browser/data-$(date +%Y%m%d).db

# Limpar auditorias antigas (via REST)
curl -s http://localhost:3100/api/audits | jq '.audits | length'
```

## 4. Como Atualizar o Playwright

```bash
# Verificar versão atual
npx playwright --version

# Atualizar
npm install @playwright/test@latest
npx playwright install chromium

# Verificar se o Chromium foi atualizado
ls -la ~/.cache/ms-playwright/
```

## 5. Como Reiniciar o Servidor

### Docker

```bash
docker-compose down
docker-compose up -d
docker-compose logs -f
```

### Systemd

```bash
sudo systemctl restart bvp-browser
sudo journalctl -u bvp-browser -f
```

### Manual

```bash
ps aux | grep "node dist/index"
kill <PID>
node dist/index.js &
```

## 6. Como Atualizar para Nova Versão

```bash
git pull origin main
cd browser-mcp-server
npm ci                          # Instalar dependências
npm run build                   # Compilar TypeScript
npm test                        # Rodar testes
cd web && npm ci && npm run build && cd ..  # Web UI
docker build -t bvp/browser-mcp:latest .   # Docker image
docker-compose up -d            # Deploy
```

## 7. Métricas de Saúde

| Métrica | OK | Warning | Critical |
|---------|----|---------|----------|
| Uptime | > 1h | > 10min | < 5min |
| Error rate | < 1% | 1-5% | > 5% |
| Tool latency p50 | < 500ms | 500ms-2s | > 2s |
| Memória RSS | < 512MB | 512MB-1GB | > 1GB |
| Sessões ativas | < 10 | 10-50 | > 50 |
| Disco (audit) | < 100MB | 100MB-500MB | > 500MB |

## 8. Env para Produção

```bash
NODE_ENV=production
BROWSER_HEADLESS=true
BVP_RATE_LIMIT=120
BVP_HEALTH_PORT=9090
BVP_HTTP_PORT=3100
BVP_AUDIT_DIR=/data/audit
BVP_BROWSER_IDLE_TIMEOUT=300000
BVP_API_KEY=<vault://secrets/bvp-api-key>
```

## Descrição

<!-- Descreva o que este PR faz -->

## Tipo de mudança

- [ ] Correção de bug
- [ ] Nova ferramenta
- [ ] Melhoria em ferramenta existente
- [ ] Documentação
- [ ] Infraestrutura / CI / Deploy
- [ ] Refatoração

## Ferramenta afetada

<!-- Se aplicável, qual o nome da ferramenta modificada/criada -->

## Como testar

```bash
cd browser-mcp-server
npm run typecheck
npm test
```

## Checklist

- [ ] Typecheck passa (`npm run typecheck`)
- [ ] Testes passam (`npm test`)
- [ ] Lint passa (`npm run lint`)
- [ ] Adicionei/atualizei a documentação no README.md
- [ ] Adicionei testes para a nova funcionalidade
- [ ] O nome da ferramenta segue o padrão `snake_case`
- [ ] A ferramenta usa `zod` para validar argumentos

## Breaking changes

<!-- Este PR introduz mudanças que quebram compatibilidade? Se sim, descreva -->

## Issue relacionada

<!-- Se aplicável, link para a issue: Fixes #123 -->

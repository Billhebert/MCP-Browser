# Intelligence & Automation Tools

| Tool | Description | Arguments |
|------|-------------|-----------|
| `suggest_tools` | Analyzes page and suggests tools | `history?` |
| `auto_audit` | Automatic page audit (quick/full) | `depth?` |
| `run_batch` | Run tools in parallel | `tools`, `concurrency?` |
| `cache_stats` | Cache efficiency statistics | `action?` |
| `plan_create` | Create execution plan | `name`, `steps`, `onStepFail?` |
| `plan_execute` | Execute plan steps | `planId`, `mode?`, `stepId?` |
| `plan_status` | Plan status details | `planId?` |
| `plan_list` | List session plans | `action?`, `planId?` |
| `plan_replan` | Modify existing plan | `planId`, `action`, `steps?` |

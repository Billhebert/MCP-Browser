# Architecture Overview

MCP-Browser follows a **modular, layered architecture** with clear separation of concerns:

- **Transport layer**: MCP stdio (JSON-RPC) + HTTP REST (Express) + WebSocket
- **Tool layer**: 130+ individual tools discovered dynamically via filesystem scan
- **Service layer**: ToolExecutorService orchestrates execution through middleware pipeline
- **Corporate layer**: Cross-cutting infrastructure (auth, audit, rate-limit, webhook, database, etc.)
- **Storage layer**: SQLite (structured data) + JSONL (append logs) + in-memory (sessions)

## Diagrams

- [Component Diagram (C4)](./c4-component.md)
- [Sequence Diagram — CallTool](./calltool-sequence.md)
- [State Diagram — Browser Session](./session-state.md)
- [Activity Diagram — Pipeline](./pipeline-activity.md)
- [Deployment Diagram](./deployment.md)
- [Package Diagram](./packages.md)
- [Class Diagram (C4 Level 3)](./class-diagram.md)
- [Data Flow Diagram](./data-flow.md)

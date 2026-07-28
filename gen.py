#!/usr/bin/env python3
"""Gera o repositório MCP-Browser com commits granulares."""
import subprocess, os, json, sys

REPO = os.path.dirname(os.path.abspath(__file__))
os.chdir(REPO)

def sh(cmd, check=True):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if check and r.returncode != 0:
        print(f"  ERRO: {r.stderr[:200]}", file=sys.stderr)
        sys.exit(1)
    return r.stdout.strip()

def commit(msg, *files):
    import tempfile, pathlib
    with open("/tmp/gitmsg.txt", "w") as f: f.write(msg)
    sh(f"git add {' '.join(files)} && git commit --no-verify -F /tmp/gitmsg.txt")

# ===== FASE 1: MVP (6 ferramentas) =====
def fase1():
    # pkg + tsconfig
    with open("package.json", "w") as f: json.dump({"name":"mcp-browser","version":"0.1.0","type":"module","scripts":{"start":"tsx src/index.ts","build":"tsc","typecheck":"tsc --noEmit"},"dependencies":{"@modelcontextprotocol/sdk":"^1.0.0","playwright":"^1.50.0","zod":"^3.24.2"},"devDependencies":{"@types/node":"^22.13.5","tsx":"^4.19.2","typescript":"^5.7.3"}}, f, indent=2)
    with open("tsconfig.json","w") as f: f.write('{"compilerOptions":{"target":"ES2022","module":"ES2022","moduleResolution":"bundler","lib":["ES2022","dom"],"outDir":"dist","rootDir":"src","strict":true,"esModuleInterop":true,"skipLibCheck":true,"forceConsistentCasingInFileNames":true,"declaration":true,"sourceMap":true},"include":["src/**/*"],"exclude":["node_modules","dist"]}')
    with open(".gitignore","w") as f: f.write("node_modules/\ndist/\n*.db\n*.log\n")
    commit("chore: adiciona package.json, tsconfig.json e .gitignore", "package.json", "tsconfig.json", ".gitignore")
    sh("npm install 2>&1 | tail -1")

    # core modules
    sh("mkdir -p src/tools src/corporate")
    open("src/browser.ts","w").write('import { chromium } from "playwright";\nlet b:any=null,p:any=null,lo:Promise<any>=Promise.resolve();\nexport async function getPage(){if(!p||p.isClosed()){const bx=b||await(async()=>{b=await chromium.launch({headless:true,args:["--no-sandbox"]});return b})();p=await(await bx.newContext()).newPage()}return p}\nexport async function serialized<T>(fn:()=>Promise<T>):Promise<T>{const r=lo.then(fn,fn);lo=r.catch(()=>{});return r}\nexport async function closeBrowser(){try{if(p&&!p.isClosed())await p.close();if(b&&b.isConnected())await b.close()}catch{}}')
    commit("feat: adiciona browser.ts — Playwright headless com fila serializada", "src/browser.ts")

    open("src/types.ts","w").write('import{z}from"zod";\nexport interface ToolDefinition{name:string;description:string;args:Record<string,z.ZodType>;execute:(args:any)=>Promise<{content:Array<{type:string;text?:string;data?:string;mimeType?:string}>;isError?:boolean}>}')
    commit("feat: adiciona types.ts — interfaces ToolDefinition e ToolResult", "src/types.ts")

    open("src/corporate/logger.ts","w").write('type L="error"|"warn"|"info";\nfunction log(l:L,b:Record<string,unknown>,m:string,e?:Record<string,unknown>){(l==="error"?process.stderr:process.stdout).write(JSON.stringify({level:l,time:new Date().toISOString(),msg:m,...b,...e})+"\\n")}\nexport function createLogger(b:Record<string,unknown>={}){return{info:(m:string,e?:Record<string,unknown>)=>log("info",b,m,e),warn:(m:string,e?:Record<string,unknown>)=>log("warn",b,m,e),error:(m:string,e?:Record<string,unknown>)=>log("error",b,m,e),child:(x:Record<string,unknown>)=>createLogger({...b,...x})}}')
    commit("feat: adiciona logger.ts — logger estruturado JSON", "src/corporate/logger.ts")

    # 6 tools individuais
    tool_defs = [
        ("navigate","Navega para uma URL"),
        ("click","Clica em elemento"),
        ("fill","Preenche campo"),
        ("getText","Extrai texto visível"),
        ("screenshot","Captura screenshot"),
        ("healthCheck","Verifica saúde do servidor"),
    ]
    # Write each tool from template file
    for name,desc in tool_defs:
        n = name.replace('_','-')
        open(f"src/tools/{name}.ts","w").write(f"""import{{z}}from"zod";import type{{ToolDefinition}}from"../types.js";import{{getPage,serialized}}from"../browser.js";
export const {name}Tool:ToolDefinition={{"name":"{n}","description":"{desc}",}};
""")
        # Now rewrite with proper content
        import shutil
        shutil.copy(f"/home/billc/Downloads/Pessoal/MCP-Browser/browser-mcp-server/src/tools/{name}.ts", f"src/tools/{name}.ts")
        commit(f"feat: adiciona {n} — {desc}", f"src/tools/{name}.ts")
        n = name.replace('_','-')
        content = f'import{{z}}from"zod";import type{{ToolDefinition}}from"../types.js";import{{getPage,serialized}}from"../browser.js";\n'
        content += f'export const {name}Tool:ToolDefinition={{\n  name:"{n}",description:"{desc}",\n  args:{{ {args_str} }},\n  async execute(args:any){{\n    {body}\n  }},\n}};\n'
        open(f"src/tools/{name}.ts","w").write(content)
        commit(f"feat: adiciona {n} — {desc}", f"src/tools/{name}.ts")

    # index.ts
    idx = '''import{Server}from"@modelcontextprotocol/sdk/server/index.js";import{StdioServerTransport}from"@modelcontextprotocol/sdk/server/stdio.js";import{CallToolRequestSchema,ListToolsRequestSchema}from"@modelcontextprotocol/sdk/types.js";import{serialized}from"./browser.js";import{createLogger}from"./corporate/logger.js";'''
    for n,_,_,_ in tools: idx += f'import{{{n}Tool}}from"./tools/{n}.js";'
    idx += f'const l=createLogger({{service:"mcp-browser"}});const tools=[{",".join(n+"Tool" for n,_,_,_ in tools)}];const m=new Map(tools.map(t=>[t.name,t]));const s=new Server({{name:"mcp-browser",version:"0.1.0"}},{{capabilities:{{tools:{{}}}}}});s.setRequestHandler(ListToolsRequestSchema,async()=>({{tools:tools.map(t=>({{name:t.name,description:t.description,inputSchema:{{type:"object",properties:Object.fromEntries(Object.entries(t.args).map(([k,zt])=>[k,{{type:"string",description:(zt as any).description||k}}])),required:Object.entries(t.args).filter(([_,zt])=>!(zt as any).isOptional()).map(([k])=>k)}})}}))}}));s.setRequestHandler(CallToolRequestSchema,async req=>{{const t=m.get(req.params.name);if(!t)return{{content:[{{type:"text",text:"Ferramenta desconhecida: "+req.params.name}}],isError:true}};try{{l.info("Executando",{{tool:req.params.name}});return await serialized(()=>t.execute(req.params.arguments||{{}}))}}catch(e:any){{l.error("Falha",{{error:e.message}});return{{content:[{{type:"text",text:"Erro: "+e.message}}],isError:true}}}}}});await s.connect(new StdioServerTransport());l.info("MCP-Browser v0.1.0 iniciado");'
    open("src/index.ts","w").write(idx)
    commit("feat: adiciona index.ts — servidor MCP com ListTools e CallTool", "src/index.ts")

    # README
    open("README.md","w").write("# MCP-Browser — Fase 1: MVP\n\n**Versão:** 0.1.0 | **Ferramentas:** 6\n\n| Ferramenta | Descrição |\n|------------|-----------|\n| navigate | Navega para URL |\n| click | Clica em elemento |\n| fill | Preenche campo |\n| get_text | Extrai texto |\n| screenshot | Captura screenshot |\n| health_check | Verifica saúde |\n")
    commit("docs: adiciona README.md — Fase 1 MVP com 6 ferramentas", "README.md")
    sh("git tag -f v0.1.0")
    print("✅ Fase 1: 6 ferramentas, ~10 commits")

if __name__ == "__main__":
    fase1()

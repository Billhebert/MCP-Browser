import { useEffect, useRef } from "react";

interface SchemaDiagramProps {
  mermaidCode: string;
  title?: string;
}

export default function SchemaDiagram({ mermaidCode, title }: SchemaDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !mermaidCode) return;
    let mounted = true;

    import("mermaid").then((mermaid) => {
      if (!mounted) return;
      mermaid.default.initialize({ theme: "dark", startOnLoad: false, fontFamily: "monospace" });

      const id = "mermaid-" + Math.random().toString(36).slice(2, 8);
      containerRef.current!.innerHTML = `<div class="mermaid" id="${id}">${mermaidCode}</div>`;

      mermaid.default.run({ nodes: [document.getElementById(id)!] }).catch((err) => {
        console.error("Mermaid render error:", err);
        containerRef.current!.innerHTML = `<div class="text-red-400 text-xs p-4">Failed to render diagram: ${err.message}</div>`;
      });
    });

    return () => { mounted = false; };
  }, [mermaidCode]);

  if (!mermaidCode) {
    return <div className="text-gray-600 text-sm p-4 text-center">No schema loaded. Connect to a database first.</div>;
  }

  return (
    <div className="bg-gray-950 rounded-xl border border-gray-800/50 p-4">
      {title && <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{title}</h3>}
      <div ref={containerRef} className="overflow-x-auto overflow-y-auto max-h-[500px] scrollbar-thin" />
    </div>
  );
}

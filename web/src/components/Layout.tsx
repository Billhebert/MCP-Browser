import { type ReactNode, useEffect, useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api/client.ts";

const navItems = [
  { label: "Dashboard", path: "/", icon: "📊" },
  { label: "Playground", path: "/playground", icon: "🔧" },
  { label: "Audits", path: "/audits", icon: "🌐" },
  { label: "Storybook", path: "/storybook", icon: "📚" },
  { label: "SQL", path: "/sql", icon: "🗄️" },
  { label: "Settings", path: "/settings", icon: "⚙️" },
];

function NavLink({ to, icon, label, isActive }: { to: string; icon: string; label: string; isActive: boolean }) {
  return (
    <Link
      to={to}
      onClick={() => window.innerWidth < 768 && document.getElementById("sidebar-overlay")?.click()}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
        isActive
          ? "bg-blue-600/20 text-blue-400 font-medium border-l-2 border-blue-500 ml-0 pl-[10px]"
          : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 border-l-2 border-transparent ml-0 pl-[10px]"
      }`}
    >
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [connected, setConnected] = useState(false);
  const [toolsCount, setToolsCount] = useState<number | null>(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme") !== "light");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    document.documentElement.classList.toggle("light", !darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    api.connect().then(() => setConnected(true)).catch(() => {});
    api.listTools().then((t) => setToolsCount(t.length)).catch(() => {});
    const handleResize = () => { if (window.innerWidth >= 768) setSidebarOpen(true); };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => { if (window.innerWidth < 768) setSidebarOpen(false); }, [location.pathname]);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {sidebarOpen && window.innerWidth < 768 && (
        <div id="sidebar-overlay" className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 fixed md:relative z-40 w-56 bg-gray-900/95 border-r border-gray-800/50 flex flex-col backdrop-blur-sm shrink-0 transition-transform duration-200 ease-in-out h-full`}>
        <div className="p-4 border-b border-gray-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">B</div>
              <div>
                <h1 className="text-sm font-bold leading-tight">BVP Browser</h1>
                <p className="text-[10px] text-gray-600">v1.0.0 · {toolsCount || "..."} tools</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-500 hover:text-white text-lg">&times;</button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5 scrollbar-thin">
          {navItems.map((item) => (
            <NavLink key={item.path} to={item.path} icon={item.icon} label={item.label} isActive={isActive(item.path)} />
          ))}
        </nav>

        <div className="p-3 border-t border-gray-800/50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" : "bg-red-500"}`} />
              <span className={`text-[11px] ${connected ? "text-green-400" : "text-red-400"}`}>{connected ? "Connected" : "Disconnected"}</span>
            </div>
            <button onClick={() => setDarkMode(!darkMode)} className="text-xs text-gray-600 hover:text-gray-400 transition-colors px-2 py-1 rounded hover:bg-gray-800" title={darkMode ? "Switch to light mode" : "Switch to dark mode"}>
              {darkMode ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-gray-950 min-w-0">
        <div className="sticky top-0 z-20 bg-gray-950/90 backdrop-blur-sm border-b border-gray-800/30 px-4 py-2 md:hidden flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white text-xl">&equiv;</button>
          <span className="text-sm font-medium text-gray-300">BVP Browser</span>
        </div>
        <div className="min-h-full">{children}</div>
      </main>
    </div>
  );
}

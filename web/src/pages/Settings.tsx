import { useEffect, useState, useCallback } from "react";

interface SettingItem {
  key: string;
  label: string;
  description: string;
  type: "text" | "number" | "boolean";
  placeholder?: string;
}

const KNOWN_SETTINGS: SettingItem[] = [
  { key: "discord_webhook", label: "Discord Webhook URL", description: "URL do webhook para notificações no Discord", type: "text", placeholder: "https://discord.com/api/webhooks/..." },
  { key: "slack_webhook", label: "Slack Webhook URL", description: "URL do webhook para notificações no Slack", type: "text", placeholder: "https://hooks.slack.com/services/..." },
  { key: "api_rate_limit", label: "Rate Limit (req/min)", description: "Máximo de requisições por minuto por tool", type: "number", placeholder: "60" },
  { key: "audit_max_pages", label: "Max Pages per Audit", description: "Máximo de páginas em auditoria completa", type: "number", placeholder: "10" },
];

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setSettings(data.settings || {});
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveSetting = useCallback(async (key: string, value: string) => {
    setSaving(key);
    try {
      const res = await fetch(`/api/settings/${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (res.ok) {
        setSettings((s) => ({ ...s, [key]: value }));
      }
    } catch {}
    setSaving(null);
  }, []);

  const addCustom = useCallback(async () => {
    if (!newKey.trim()) return;
    await saveSetting(newKey.trim(), newValue);
    setNewKey("");
    setNewValue("");
  }, [newKey, newValue, saveSetting]);

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Settings</h1>
        <p className="text-sm text-gray-600 mt-0.5">Configuration and environment variables</p>
      </div>

      {loading ? (
        <div className="text-center text-gray-600 py-8 animate-pulse">Loading settings...</div>
      ) : (
        <>
          <div className="bg-gray-900 rounded-xl border border-gray-800/50 overflow-hidden">
            <div className="divide-y divide-gray-800/50">
              {KNOWN_SETTINGS.map((item) => (
                <div key={item.key} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-200">{item.label}</div>
                    <div className="text-xs text-gray-600 mt-0.5">{item.description}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.type === "boolean" ? (
                      <button
                        onClick={() => saveSetting(item.key, settings[item.key] !== "true" ? "true" : "false")}
                        className={`w-10 h-5 rounded-full transition-colors ${settings[item.key] === "true" ? "bg-blue-600" : "bg-gray-700"}`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${settings[item.key] === "true" ? "translate-x-5" : "translate-x-1"}`} />
                      </button>
                    ) : (
                      <input
                        type={item.type}
                        className="w-40 bg-gray-800 border border-gray-700/50 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500/50"
                        placeholder={item.placeholder}
                        value={settings[item.key] || ""}
                        onChange={(e) => setSettings((s) => ({ ...s, [item.key]: e.target.value }))}
                        onBlur={() => saveSetting(item.key, settings[item.key] || "")}
                        onKeyDown={(e) => e.key === "Enter" && saveSetting(item.key, settings[item.key] || "")}
                      />
                    )}
                    {saving === item.key && <span className="text-xs text-gray-600">...</span>}
                  </div>
                </div>
              ))}
              {Object.keys(settings)
                .filter((k) => !KNOWN_SETTINGS.some((s) => s.key === k))
                .map((key) => (
                  <div key={key} className="p-4 flex items-center justify-between gap-4 bg-gray-800/20">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-400 font-mono">{key}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input type="text" className="w-40 bg-gray-800 border border-gray-700/50 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500/50" value={settings[key] || ""} onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))} onBlur={() => saveSetting(key, settings[key] || "")} />
                      <button onClick={() => { fetch(`/api/settings/${key}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: "" }) }).then(() => { const s = { ...settings }; delete s[key]; setSettings(s); }); }} className="text-xs text-red-400 hover:text-red-300">✕</button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800/50 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Add Custom Setting</h3>
            <div className="flex gap-2">
              <input type="text" placeholder="Key" className="flex-1 bg-gray-800 border border-gray-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
              <input type="text" placeholder="Value" className="flex-1 bg-gray-800 border border-gray-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
              <button onClick={addCustom} disabled={!newKey.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors">Add</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

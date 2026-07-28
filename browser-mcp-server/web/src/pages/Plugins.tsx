import { useEffect, useState } from "react";

interface PluginInfo {
  name: string;
  version: string;
  description: string;
  tools: number;
}

interface DbPlugin {
  name: string;
  version: string;
  description: string;
  enabled: number;
  installed_at: string;
}

export default function Plugins() {
  const [loaded, setLoaded] = useState<PluginInfo[]>([]);
  const [dbPlugins, setDbPlugins] = useState<DbPlugin[]>([]);

  useEffect(() => {
    fetch("/api/plugins")
      .then((r) => r.json())
      .then((data) => {
        setLoaded(data.loaded || []);
        setDbPlugins(data.plugins || []);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Plugins</h1>
        <p className="text-sm text-gray-600 mt-0.5">Manage external plugin modules</p>
      </div>

      {loaded.length === 0 && dbPlugins.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500">
          <div className="text-3xl mb-2">🔌</div>
          <p>No plugins installed.</p>
          <p className="text-xs mt-1">
            Create a plugin by adding a directory to <code className="bg-gray-800 px-1 rounded">plugins/</code> with a <code className="bg-gray-800 px-1 rounded">plugin.json</code> manifest.
          </p>
        </div>
      ) : (
        <>
          {loaded.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Loaded Plugins ({loaded.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {loaded.map((p) => (
                  <div key={p.name} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-gray-500">v{p.version}</div>
                      </div>
                      <span className="bg-green-900/50 text-green-400 text-xs px-2 py-0.5 rounded">loaded</span>
                    </div>
                    <p className="text-sm text-gray-400 mb-2">{p.description}</p>
                    <div className="text-xs text-gray-500">{p.tools} tool(s)</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dbPlugins.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Plugin Registry</h2>
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Name</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Version</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Installed</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbPlugins.map((p) => (
                      <tr key={p.name} className="border-b border-gray-800 hover:bg-gray-800/50">
                        <td className="px-4 py-3 font-medium">{p.name}</td>
                        <td className="px-4 py-3 text-gray-400">{p.version}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{new Date(p.installed_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            p.enabled ? "bg-green-900/50 text-green-400" : "bg-gray-800 text-gray-500"
                          }`}>
                            {p.enabled ? "enabled" : "disabled"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-2">Creating a Plugin</h2>
        <pre className="text-xs bg-gray-950 rounded-lg p-3 overflow-x-auto text-gray-400">
{`plugins/
  my-plugin/
    plugin.json    # { "name": "...", "version": "...", "description": "...", "main": "index.js" }
    index.js       # Export tool(s) as default array
    `}
        </pre>
      </div>
    </div>
  );
}

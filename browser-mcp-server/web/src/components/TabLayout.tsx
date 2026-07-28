import { useSearchParams } from "react-router-dom";
import type { ReactNode } from "react";

interface Tab {
  id: string;
  label: string;
  icon: string;
}

export default function TabLayout({ tabs, children }: { tabs: Tab[]; children: (activeTab: string) => ReactNode }) {
  const [params, setParams] = useSearchParams();
  const activeTab = params.get("tab") || tabs[0]?.id || "";

  const setTab = (tabId: string) => {
    setParams({ tab: tabId });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="bg-gray-900/50 border-b border-gray-800/50 px-6 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-150 whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600"
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto relative">
        <div key={activeTab} className="animate-fade-in">
          {children(activeTab)}
        </div>
      </div>
    </div>
  );
}

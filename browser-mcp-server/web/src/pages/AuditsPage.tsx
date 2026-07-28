import TabLayout from "../components/TabLayout.tsx";
import AuditViewer from "./AuditViewer.tsx";
import Analyze from "./Analyze.tsx";
import AuditHistory from "./AuditHistory.tsx";
import AuditComparison from "./AuditComparison.tsx";

const tabs = [
  { id: "full", label: "Full Site", icon: "🌐" },
  { id: "single", label: "Single Page", icon: "🔬" },
  { id: "history", label: "History", icon: "📜" },
  { id: "compare", label: "Compare", icon: "⚖️" },
];

export default function AuditsPage() {
  return (
    <TabLayout tabs={tabs}>
      {(activeTab) => {
        switch (activeTab) {
          case "single": return <Analyze />;
          case "history": return <AuditHistory />;
          case "compare": return <AuditComparison />;
          default: return <AuditViewer />;
        }
      }}
    </TabLayout>
  );
}

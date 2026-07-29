import TabLayout from "../components/TabLayout.tsx";
import Settings from "./Settings.tsx";
import Sessions from "./Sessions.tsx";
import Plugins from "./Plugins.tsx";

const tabs = [
  { id: "general", label: "General", icon: "⚙️" },
  { id: "sessions", label: "Sessions", icon: "🖥️" },
  { id: "plugins", label: "Plugins", icon: "🔌" },
];

export default function SettingsPage() {
  return (
    <TabLayout tabs={tabs}>
      {(activeTab) => {
        switch (activeTab) {
          case "sessions": return <Sessions />;
          case "plugins": return <Plugins />;
          default: return <Settings />;
        }
      }}
    </TabLayout>
  );
}

import TabLayout from "../components/TabLayout.tsx";
import Playground from "./Playground.tsx";
import Contracts from "./Contracts.tsx";

const tabs = [
  { id: "tools", label: "Tools", icon: "🔧" },
  { id: "contracts", label: "Contracts", icon: "📋" },
];

export default function PlaygroundPage() {
  return (
    <TabLayout tabs={tabs}>
      {(activeTab) => (
        activeTab === "contracts" ? <Contracts /> : <Playground />
      )}
    </TabLayout>
  );
}

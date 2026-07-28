import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import { ToastProvider } from "./components/Toast.tsx";
import Dashboard from "./pages/Dashboard.tsx";

const PlaygroundPage = lazy(() => import("./pages/PlaygroundPage.tsx"));
const AuditsPage = lazy(() => import("./pages/AuditsPage.tsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.tsx"));
const StorybookPage = lazy(() => import("./pages/Storybook.tsx"));
const SqlConsolePage = lazy(() => import("./pages/SqlConsole.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

function Loading() {
  return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>;
}

export default function App() {
  return (
    <ToastProvider>
    <Layout>
      <ErrorBoundary>
      <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/playground" element={<PlaygroundPage />} />
        <Route path="/audits" element={<AuditsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/storybook" element={<StorybookPage />} />
        <Route path="/sql" element={<SqlConsolePage />} />

        <Route path="/contracts" element={<Navigate to="/playground?tab=contracts" replace />} />
        <Route path="/analyze" element={<Navigate to="/audits?tab=single" replace />} />
        <Route path="/audits/history" element={<Navigate to="/audits?tab=history" replace />} />
        <Route path="/audits/compare" element={<Navigate to="/audits?tab=compare" replace />} />
        <Route path="/history" element={<Navigate to="/audits?tab=history" replace />} />
        <Route path="/sessions" element={<Navigate to="/settings?tab=sessions" replace />} />
        <Route path="/plugins" element={<Navigate to="/settings?tab=plugins" replace />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      </ErrorBoundary>
    </Layout>
    </ToastProvider>
  );
}

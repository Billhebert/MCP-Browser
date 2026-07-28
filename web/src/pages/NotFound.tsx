import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="text-center max-w-md">
        <div className="text-8xl font-bold bg-gradient-to-br from-blue-500 to-purple-600 bg-clip-text text-transparent mb-4">
          404
        </div>
        <div className="text-4xl mb-2">🔍</div>
        <h2 className="text-xl font-bold text-gray-300 mb-2">Page not found</h2>
        <p className="text-sm text-gray-600 mb-8 leading-relaxed">
          The page you're looking for doesn't exist or has been moved.<br />
          Check the URL or navigate back to a familiar page.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-all hover:shadow-lg hover:shadow-blue-600/20 active:scale-[0.98]">
            ← Back to Dashboard
          </Link>
          <Link to="/playground" className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-all active:scale-[0.98]">
            🔧 Open Playground
          </Link>
        </div>
      </div>
    </div>
  );
}

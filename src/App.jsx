import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import { ThemeProvider } from "./lib/theme";
import ExecutionViewPage from "./pages/ExecutionViewPage";
import HomePage from "./pages/HomePage";
import WorkflowEditorPage from "./pages/WorkflowEditorPage";

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
          <Navbar />
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/workflow/:id" element={<WorkflowEditorPage />} />
            <Route
              path="/execution/:executionId"
              element={<ExecutionViewPage />}
            />
          </Routes>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;

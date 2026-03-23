import { useEffect, useState } from "react";

function RunWorkflowModal({ workflow, isOpen, isSubmitting, onClose, onRun }) {
  const [input, setInput] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setInput("");
    }
  }, [isOpen]);

  if (!isOpen || !workflow) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    onRun(input);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-300 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-lg font-bold text-cyan-700 dark:text-cyan-200">
          Run Workflow
        </h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {workflow.name || workflow.id}
        </p>

        <form className="mt-4" onSubmit={handleSubmit}>
          <label
            className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300"
            htmlFor="run-input"
          >
            Input
          </label>
          <textarea
            id="run-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            required
            rows={5}
            placeholder="Describe what this workflow should do..."
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-cyan-400 placeholder:text-slate-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-cyan-500 px-3 py-1.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Starting..." : "Run"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RunWorkflowModal;

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ErrorState from "../components/ErrorState";
import LoadingSpinner from "../components/LoadingSpinner";
import RunWorkflowModal from "../components/RunWorkflowModal";
import { api } from "../lib/api";
import {
  extractCreatedAt,
  extractWorkflowId,
  extractWorkflowName,
} from "../lib/workflowGraph";

function HomePage() {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingWorkflowId, setDeletingWorkflowId] = useState("");

  const loadWorkflows = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await api.get("/workflow");
      const payload = response.data;
      const list = Array.isArray(payload)
        ? payload
        : (payload?.workflows ?? payload?.data ?? []);
      setWorkflows(Array.isArray(list) ? list : []);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError.message ||
          "Failed to load workflows.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  const handleCreateWorkflow = async (event) => {
    event.preventDefault();

    const name = newWorkflowName.trim();
    if (!name) return;

    setIsCreating(true);
    setError("");

    try {
      const response = await api.post("/workflow", {
        name,
        agents: [],
        dependencies: [],
      });

      const createdWorkflow =
        response.data?.workflow ??
        response.data?.data?.workflow ??
        response.data?.data ??
        response.data;

      const workflowId = extractWorkflowId(createdWorkflow);

      setIsCreateOpen(false);
      setNewWorkflowName("");

      if (workflowId) {
        navigate(`/workflow/${workflowId}`);
        return;
      }

      await loadWorkflows();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError.message ||
          "Failed to create workflow.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleRun = async (input) => {
    if (!selectedWorkflow) return;

    setIsRunning(true);
    setError("");

    try {
      const workflowId = extractWorkflowId(selectedWorkflow);
      const response = await api.post("/execution/execute", {
        workflowId,
        input,
      });

      const payload = response.data;
      const executionId =
        payload?.executionId ??
        payload?.id ??
        payload?.data?.executionId ??
        payload?.data?.execution_id ??
        payload?.data?.id ??
        payload?.execution?.id ??
        payload?.execution?.executionId ??
        payload?.execution?._id ??
        "";

      if (!executionId) {
        throw new Error(
          "Execution was created but no executionId was returned.",
        );
      }

      setSelectedWorkflow(null);
      navigate(`/execution/${executionId}`);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError.message ||
          "Failed to start execution.",
      );
    } finally {
      setIsRunning(false);
    }
  };

  const handleDeleteWorkflow = async (workflow) => {
    const workflowId = extractWorkflowId(workflow);
    if (!workflowId) return;

    const confirmed = window.confirm(
      `Delete workflow "${extractWorkflowName(workflow)}"? This cannot be undone.`,
    );

    if (!confirmed) return;

    setDeletingWorkflowId(String(workflowId));
    setError("");

    try {
      await api.delete(`/workflow/${workflowId}`);

      setWorkflows((current) =>
        current.filter((item) => extractWorkflowId(item) !== workflowId),
      );
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError.message ||
          "Failed to delete workflow.",
      );
    } finally {
      setDeletingWorkflowId("");
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">
            Workflows
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Launch, edit, and monitor your multi-agent DAGs.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
        >
          New Workflow
        </button>
      </div>

      {error ? <ErrorState message={error} onRetry={loadWorkflows} /> : null}

      {isLoading ? (
        <div className="mt-8">
          <LoadingSpinner label="Loading workflows..." />
        </div>
      ) : null}

      {!isLoading && !workflows.length ? (
        <div className="mt-8 rounded-xl border border-slate-300 bg-white/80 p-6 text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
          No workflows found.
        </div>
      ) : null}

      {!isLoading && workflows.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {workflows.map((workflow) => {
            const workflowId = extractWorkflowId(workflow);
            const workflowName = extractWorkflowName(workflow);

            return (
              <article
                key={workflowId}
                className="group rounded-xl border border-slate-300 bg-white/90 p-5 shadow-lg shadow-cyan-900/10 transition hover:-translate-y-0.5 hover:border-cyan-500/50 dark:border-slate-700/80 dark:bg-slate-900/80 dark:shadow-cyan-950/20"
              >
                <h2 className="text-xl font-bold text-cyan-700 dark:text-cyan-200">
                  {workflowName}
                </h2>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Created: {extractCreatedAt(workflow)}
                </p>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/workflow/${workflowId}`)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-200 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    Open Editor
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedWorkflow(workflow)}
                    className="rounded-md bg-cyan-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
                  >
                    Run
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteWorkflow(workflow)}
                    disabled={deletingWorkflowId === String(workflowId)}
                    className="rounded-md border border-rose-500/70 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-300"
                  >
                    {deletingWorkflowId === String(workflowId)
                      ? "Deleting..."
                      : "Delete"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      <RunWorkflowModal
        workflow={selectedWorkflow}
        isOpen={Boolean(selectedWorkflow)}
        isSubmitting={isRunning}
        onClose={() => setSelectedWorkflow(null)}
        onRun={handleRun}
      />

      {isCreateOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-300 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-lg font-bold text-cyan-700 dark:text-cyan-200">
              Create Workflow
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Start with an empty workflow and edit it in the graph builder.
            </p>

            <form onSubmit={handleCreateWorkflow} className="mt-4">
              <label className="block" htmlFor="workflow-name">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Workflow Name
                </span>
                <input
                  id="workflow-name"
                  required
                  value={newWorkflowName}
                  onChange={(event) => setNewWorkflowName(event.target.value)}
                  placeholder="Research + Draft Pipeline"
                  className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-cyan-400 placeholder:text-slate-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setNewWorkflowName("");
                  }}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isCreating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default HomePage;

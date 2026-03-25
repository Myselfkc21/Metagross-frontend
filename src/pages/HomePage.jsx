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

const EXECUTION_STATUS_STYLES = {
  queue: "bg-slate-500/20 text-slate-400",
  running: "bg-yellow-500/20 text-yellow-400",
  completed: "bg-emerald-500/20 text-emerald-400",
  failed: "bg-rose-500/20 text-rose-400",
};

function extractExecutionId(execution) {
  return execution?.id ?? execution?._id ?? execution?.executionId ?? "";
}

function extractExecutionStatus(execution) {
  return execution?.status ?? "queue";
}

function extractExecutionWorkflowName(execution) {
  return (
    execution?.workflow?.name ??
    execution?.workflowId ??
    execution?.workflow_id ??
    "—"
  );
}

function extractExecutionWorkflowId(execution) {
  return (
    execution?.workflow?.id ??
    execution?.workflowId ??
    execution?.workflow_id ??
    null
  );
}

function extractExecutionCreatedAt(execution) {
  const value =
    execution?.createdAt ?? execution?.created_at ?? execution?.timestamp;
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

// Reusable pagination controls
function Pagination({ pagination, onPageChange, isLoading }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, total } = pagination;

  return (
    <div className="mt-3 flex items-center justify-between gap-2 text-sm text-slate-500 dark:text-slate-400">
      <span>
        Page {page} of {totalPages}{" "}
        <span className="hidden sm:inline">({total} total)</span>
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={page <= 1 || isLoading}
          onClick={() => onPageChange(page - 1)}
          className="rounded border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          ‹ Prev
        </button>
        <button
          type="button"
          disabled={page >= totalPages || isLoading}
          onClick={() => onPageChange(page + 1)}
          className="rounded border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}

// Executions table used in both global section and workflow history modal
function ExecutionsTable({ executions, navigate }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-white/90 dark:border-slate-700/80 dark:bg-slate-900/80">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left dark:border-slate-700">
            <th className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400">
              ID
            </th>
            <th className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400">
              Workflow
            </th>
            <th className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400">
              Status
            </th>
            <th className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400">
              Started
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {executions.map((execution, index) => {
            const execId = extractExecutionId(execution);
            const status = extractExecutionStatus(execution);
            const statusStyle =
              EXECUTION_STATUS_STYLES[status] ?? EXECUTION_STATUS_STYLES.queue;

            return (
              <tr
                key={execId || index}
                className="border-b border-slate-100 last:border-0 dark:border-slate-800"
              >
                <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                  {execId || "—"}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {extractExecutionWorkflowName(execution)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusStyle}`}
                  >
                    {status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                  {extractExecutionCreatedAt(execution)}
                </td>
                <td className="px-4 py-3 text-right">
                  {execId ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/execution/${execId}`)}
                      className="rounded-md bg-cyan-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
                    >
                      View
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Modal showing past executions for a specific workflow
function WorkflowHistoryModal({ workflow, onClose, navigate }) {
  const workflowId = extractWorkflowId(workflow);
  const workflowName = extractWorkflowName(workflow);

  const [allExecutions, setAllExecutions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const limit = 5;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError("");
      try {
        // Fetch a generous batch; filter client-side since there's no workflowId filter endpoint
        const response = await api.get("/execution", {
          params: { page: 1, limit: 100 },
        });
        if (cancelled) return;
        const payload = response.data;
        let list;
        if (payload?.data?.items) {
          list = payload.data.items;
        } else if (Array.isArray(payload)) {
          list = payload;
        } else {
          list = payload?.data ?? payload?.executions ?? [];
        }
        const filtered = (Array.isArray(list) ? list : []).filter((exec) => {
          const execWfId = extractExecutionWorkflowId(exec);
          return execWfId !== null && String(execWfId) === String(workflowId);
        });
        setAllExecutions(filtered);
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.response?.data?.message ||
              err.message ||
              "Failed to load executions.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [workflowId]);

  const totalPages = Math.ceil(allExecutions.length / limit);
  const paginatedExecutions = allExecutions.slice(
    (page - 1) * limit,
    page * limit,
  );
  const pagination =
    allExecutions.length > 0
      ? { page, totalPages, total: allExecutions.length }
      : null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4">
      <div className="flex w-full max-w-3xl flex-col rounded-xl border border-slate-300 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div>
            <h3 className="text-lg font-bold text-cyan-700 dark:text-cyan-200">
              Past Executions
            </h3>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {workflowName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {error ? <ErrorState message={error} /> : null}

          {isLoading ? (
            <LoadingSpinner label="Loading executions..." />
          ) : !allExecutions.length ? (
            <div className="rounded-xl border border-slate-300 bg-white/80 p-6 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
              No executions found for this workflow.
            </div>
          ) : (
            <>
              <ExecutionsTable
                executions={paginatedExecutions}
                navigate={navigate}
              />
              <Pagination
                pagination={pagination}
                onPageChange={setPage}
                isLoading={false}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function HomePage() {
  const navigate = useNavigate();

  // Workflows state
  const [workflows, setWorkflows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [workflowsPagination, setWorkflowsPagination] = useState(null);
  const [workflowsPage, setWorkflowsPage] = useState(1);
  const workflowsLimit = 9;

  // Workflow actions state
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingWorkflowId, setDeletingWorkflowId] = useState("");
  const [workflowHistoryTarget, setWorkflowHistoryTarget] = useState(null);

  // Executions state
  const [executions, setExecutions] = useState([]);
  const [isLoadingExecutions, setIsLoadingExecutions] = useState(true);
  const [executionsError, setExecutionsError] = useState("");
  const [executionsPagination, setExecutionsPagination] = useState(null);
  const [executionsPage, setExecutionsPage] = useState(1);
  const executionsLimit = 10;

  const loadExecutions = useCallback(
    async (page = 1) => {
      setIsLoadingExecutions(true);
      setExecutionsError("");
      try {
        const response = await api.get("/execution", {
          params: { page, limit: executionsLimit },
        });
        const payload = response.data;
        let list, paginationMeta;
        if (payload?.data?.items) {
          list = payload.data.items;
          paginationMeta = payload.data.pagination ?? null;
        } else if (Array.isArray(payload)) {
          list = payload;
        } else {
          list = payload?.data ?? payload?.executions ?? [];
        }
        setExecutions(Array.isArray(list) ? list : []);
        setExecutionsPagination(paginationMeta ?? null);
        setExecutionsPage(page);
      } catch (requestError) {
        setExecutionsError(
          requestError?.response?.data?.message ||
            requestError.message ||
            "Failed to load executions.",
        );
      } finally {
        setIsLoadingExecutions(false);
      }
    },
    [executionsLimit],
  );

  const loadWorkflows = useCallback(
    async (page = 1) => {
      setIsLoading(true);
      setError("");
      try {
        const response = await api.get("/workflow", {
          params: { page, limit: workflowsLimit },
        });
        const payload = response.data;
        let list, paginationMeta;
        if (payload?.data?.items) {
          list = payload.data.items;
          paginationMeta = payload.data.pagination ?? null;
        } else if (Array.isArray(payload)) {
          list = payload;
        } else {
          list = payload?.workflows ?? payload?.data ?? [];
        }
        setWorkflows(Array.isArray(list) ? list : []);
        setWorkflowsPagination(paginationMeta ?? null);
        setWorkflowsPage(page);
      } catch (requestError) {
        setError(
          requestError?.response?.data?.message ||
            requestError.message ||
            "Failed to load workflows.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [workflowsLimit],
  );

  useEffect(() => {
    loadWorkflows();
    loadExecutions();
  }, [loadWorkflows, loadExecutions]);

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

      await loadWorkflows(workflowsPage);
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
      {/* Workflows header */}
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

      {error ? <ErrorState message={error} onRetry={() => loadWorkflows(workflowsPage)} /> : null}

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
        <>
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

                  <div className="mt-4 flex flex-wrap gap-2">
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
                      onClick={() => setWorkflowHistoryTarget(workflow)}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Past Executions
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

          <Pagination
            pagination={workflowsPagination}
            onPageChange={(p) => loadWorkflows(p)}
            isLoading={isLoading}
          />
        </>
      ) : null}

      {/* Executions section */}
      <div className="mt-12">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              Recent Executions
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              All past and in-progress workflow runs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadExecutions(executionsPage)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>

        {executionsError ? (
          <ErrorState message={executionsError} onRetry={() => loadExecutions(executionsPage)} />
        ) : null}

        {isLoadingExecutions ? (
          <div className="mt-4">
            <LoadingSpinner label="Loading executions..." />
          </div>
        ) : !executions.length ? (
          <div className="rounded-xl border border-slate-300 bg-white/80 p-6 text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
            No executions yet.
          </div>
        ) : (
          <>
            <ExecutionsTable executions={executions} navigate={navigate} />
            <Pagination
              pagination={executionsPagination}
              onPageChange={(p) => loadExecutions(p)}
              isLoading={isLoadingExecutions}
            />
          </>
        )}
      </div>

      {/* Workflow past executions modal */}
      {workflowHistoryTarget ? (
        <WorkflowHistoryModal
          workflow={workflowHistoryTarget}
          onClose={() => setWorkflowHistoryTarget(null)}
          navigate={navigate}
        />
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

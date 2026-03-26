import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
} from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useParams } from "react-router-dom";
import AgentNode from "../components/AgentNode";
import ErrorState from "../components/ErrorState";
import LoadingSpinner from "../components/LoadingSpinner";
import { API_BASE_URL, api } from "../lib/api";
import { workflowToFlow } from "../lib/workflowGraph";

const nodeTypes = {
  agent: AgentNode,
};

const STATUS_LABEL = {
  queue: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  waiting: "Waiting for Input",
};

const STATUS_COLORS = {
  queue: "text-slate-400",
  running: "text-yellow-400",
  completed: "text-emerald-400",
  failed: "text-rose-400",
  waiting: "text-amber-400",
};

const HITL_TERMINAL_STATUSES = new Set(["completed", "failed"]);

function isHITLNode(node) {
  return node?.id?.toLowerCase() === "hitl";
}

function OutputPanel({ node, onClose, onHITLDecision, isSubmittingHITL }) {
  const status = node?.data?.status ?? "queue";
  const output = node?.data?.output;
  const agentId = node?.data?.id;
  const agentType = node?.data?.type;
  const hitlWaiting = isHITLNode(node) && !HITL_TERMINAL_STATUSES.has(status);

  return (
    <div className="absolute bottom-0 right-0 top-0 z-30 flex w-[360px] flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between border-b border-slate-200 p-4 dark:border-slate-700">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            {agentType}
          </p>
          <h3 className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
            {agentId}
          </h3>
          <span
            className={`text-xs font-semibold ${STATUS_COLORS[status] ?? STATUS_COLORS.queue}`}
          >
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>
        <button
          onClick={onClose}
          className="ml-4 mt-0.5 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Close panel"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {hitlWaiting ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              This step requires your approval before the workflow can continue.
            </p>
            {output ? (
              <article className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-200">
                <ReactMarkdown>{output}</ReactMarkdown>
              </article>
            ) : null}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isSubmittingHITL}
                onClick={() => onHITLDecision("accept")}
                className="flex-1 rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Accept
              </button>
              <button
                type="button"
                disabled={isSubmittingHITL}
                onClick={() => onHITLDecision("reject")}
                className="flex-1 rounded-md border border-rose-500/70 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-400"
              >
                Reject
              </button>
            </div>
          </div>
        ) : (
          <>
            {status === "queue" && (
              <p className="text-sm text-slate-400">
                This agent hasn&apos;t started yet.
              </p>
            )}
            {status === "running" && (
              <div className="flex items-center gap-2 text-sm text-yellow-500">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
                Running…
              </div>
            )}
            {status === "failed" && (
              <p className="text-sm text-rose-400">
                {output ?? "This agent failed without an output."}
              </p>
            )}
            {status === "completed" && output ? (
              <article className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-200">
                <ReactMarkdown>{output}</ReactMarkdown>
              </article>
            ) : status === "completed" && !output ? (
              <p className="text-sm text-slate-400">No output available.</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function ExecutionViewPage() {
  const { executionId } = useParams();
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showCompleteToast, setShowCompleteToast] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [isSubmittingHITL, setIsSubmittingHITL] = useState(false);
  const [hitlError, setHitlError] = useState("");
  const [hitlDismissed, setHitlDismissed] = useState(false);

  useEffect(() => {
    const loadExecution = async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await api.get(`/execution/${executionId}`);
        // Response shape: { success, message, data: { id, workflow_id, workflow, agents, ... } }
        const execution = response.data?.data ?? response.data ?? {};

        // Build a lookup from agent_id → agent record (status + output)
        const agentMap = {};
        for (const agent of execution.agents ?? []) {
          const key = agent.agent_id ?? agent.agentId ?? agent.id;
          if (key) agentMap[String(key)] = agent;
        }

        // Workflow graph lives at execution.workflow.graph
        const workflowPayload = execution.workflow ?? {};

        const graph = workflowToFlow(workflowPayload);
        setNodes(
          graph.nodes.map((node) => {
            const agentRecord = agentMap[node.id] ?? {};
            return {
              ...node,
              data: {
                ...node.data,
                readonly: true,
                status: agentRecord.status ?? "queue",
                output: agentRecord.output ?? null,
              },
            };
          }),
        );
        setEdges(graph.edges);
      } catch (requestError) {
        setError(
          requestError?.response?.data?.message ||
            requestError.message ||
            "Failed to load execution data.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadExecution();
  }, [executionId]);

  useEffect(() => {
    const source = new EventSource(`${API_BASE_URL}/stream/${executionId}`);

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const status = payload.status ?? "queue";
        const agentKey = String(
          payload.agentId ?? payload.agent_id ?? payload.id ?? "",
        );

        if (!agentKey) return;

        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            if (String(node.id) !== agentKey) return node;
            return {
              ...node,
              data: {
                ...node.data,
                status,
                output: payload.output,
                readonly: true,
              },
            };
          }),
        );
      } catch {
        // ignore parse errors
      }
    };

    source.onerror = () => {
      // Keep the connection open so EventSource can retry automatically.
    };

    return () => {
      source.close();
    };
  }, [executionId]);

  const hitlPendingNode = useMemo(() => {
    const hitlNode = nodes.find((n) => isHITLNode(n));
    if (!hitlNode) return null;

    // Already resolved
    if (HITL_TERMINAL_STATUSES.has(hitlNode.data?.status)) return null;

    // Execution paused at HITL: no node is actively running but at least one completed
    const hasRunning = nodes.some((n) => n.data?.status === "running");
    const hasCompleted = nodes.some((n) => n.data?.status === "completed");
    if (!hasRunning && hasCompleted) return hitlNode;

    return null;
  }, [nodes]);

  // Reset dismissed flag whenever a fresh HITL node appears
  useEffect(() => {
    if (hitlPendingNode) setHitlDismissed(false);
  }, [hitlPendingNode?.id]);

  const handleHITLDecision = async (decision) => {
    setIsSubmittingHITL(true);
    setHitlError("");
    try {
      await api.patch(`/execution/${executionId}/${decision}`);
      setHitlDismissed(true);
    } catch (err) {
      setHitlError(
        err?.response?.data?.message ||
          err.message ||
          "Failed to submit decision.",
      );
    } finally {
      setIsSubmittingHITL(false);
    }
  };

  const isComplete = useMemo(() => {
    if (!nodes.length) return false;
    return nodes.every((node) => node.data.status === "completed");
  }, [nodes]);

  const isRunning = useMemo(
    () => nodes.some((node) => node.data.status === "running"),
    [nodes],
  );

  const renderedEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        animated: isRunning,
        className: isRunning ? "workflow-edge-running" : "workflow-edge-idle",
      })),
    [edges, isRunning],
  );

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const nodesWithSelection = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: { ...n.data, isSelected: n.id === selectedNodeId },
      })),
    [nodes, selectedNodeId],
  );

  useEffect(() => {
    if (!isComplete) {
      setShowCompleteToast(false);
      return;
    }

    setShowCompleteToast(true);

    const timeoutId = window.setTimeout(() => {
      setShowCompleteToast(false);
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [isComplete]);

  return (
    <section className="relative h-[calc(100vh-4rem)] overflow-hidden">
      {showCompleteToast && (
        <div className="workflow-toast absolute right-4 top-4 z-30 rounded-xl border border-emerald-500/40 bg-slate-950/85 px-4 py-2 text-sm font-semibold text-emerald-200 shadow-2xl backdrop-blur">
          Workflow Complete
        </div>
      )}

      {hitlPendingNode && !hitlDismissed && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-start justify-center pt-6">
          <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-amber-400/40 bg-white/80 shadow-2xl backdrop-blur-md dark:bg-slate-900/80">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-amber-400/30 px-5 py-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-base">
                ✋
              </span>
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  Human approval required
                </p>
                <p className="text-xs text-amber-700/80 dark:text-amber-400">
                  Workflow paused — waiting for your decision
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              {hitlError ? (
                <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                  {hitlError}
                </p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isSubmittingHITL}
                  onClick={() => handleHITLDecision("accept")}
                  className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingHITL ? "Submitting…" : "✓ Accept"}
                </button>
                <button
                  type="button"
                  disabled={isSubmittingHITL}
                  onClick={() => handleHITLDecision("reject")}
                  className="flex-1 rounded-lg border border-rose-400/60 px-4 py-2 text-sm font-semibold text-rose-600 shadow-sm hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-400 dark:hover:bg-rose-950/30"
                >
                  {isSubmittingHITL ? "Submitting…" : "✕ Reject"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute left-4 right-4 top-4 z-20">
          <ErrorState message={error} />
        </div>
      )}

      {!isLoading && !error && (
        <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full border border-slate-300/50 bg-white/80 px-3 py-1 text-xs text-slate-500 shadow backdrop-blur dark:border-slate-700/50 dark:bg-slate-900/80 dark:text-slate-400">
          Tap a node to see its output
        </div>
      )}

      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <LoadingSpinner label="Connecting to execution..." />
        </div>
      ) : (
        <ReactFlow
          nodes={nodesWithSelection}
          edges={renderedEdges}
          nodeTypes={nodeTypes}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          zoomOnDoubleClick={false}
          onNodeClick={(_, node) =>
            setSelectedNodeId((prev) => (prev === node.id ? null : node.id))
          }
          onPaneClick={() => setSelectedNodeId(null)}
          className="execution-flow bg-slate-100 dark:bg-slate-950"
        >
          <Background
            variant={BackgroundVariant.Dots}
            color="#334155"
            gap={18}
            size={1.1}
          />
          <MiniMap
            pannable
            zoomable
            className="!bg-slate-200 dark:!bg-slate-900"
          />
          <Controls className="!rounded-lg !border !border-slate-300 !bg-white dark:!border-slate-700 dark:!bg-slate-900" />
        </ReactFlow>
      )}

      {selectedNode && (
        <OutputPanel
          node={selectedNode}
          onClose={() => setSelectedNodeId(null)}
          onHITLDecision={handleHITLDecision}
          isSubmittingHITL={isSubmittingHITL}
        />
      )}
    </section>
  );
}

export default ExecutionViewPage;

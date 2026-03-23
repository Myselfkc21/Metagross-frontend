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

function statusBadgeClass(status = "queue") {
  if (status === "completed") {
    return "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200";
  }

  if (status === "running") {
    return "border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-200";
  }

  if (status === "failed") {
    return "border-rose-500/50 bg-rose-500/15 text-rose-700 dark:text-rose-200";
  }

  return "border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-200";
}

function normalizeAgentType(type = "") {
  if (["researcher", "writer", "editor"].includes(type)) {
    return type;
  }

  return "default";
}

function ExecutionViewPage() {
  const { executionId } = useParams();
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showCompleteToast, setShowCompleteToast] = useState(false);

  useEffect(() => {
    const loadExecution = async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await api.get(`/execution/${executionId}`);
        const execution =
          response.data?.execution ??
          response.data?.data ??
          response.data ??
          {};

        let workflowPayload =
          execution.workflow ?? execution.workflowData ?? execution.graph;

        const workflowId = execution.workflowId ?? execution.workflow_id;

        if (!workflowPayload && workflowId) {
          const workflowResponse = await api.get(`/workflow/${workflowId}`);
          workflowPayload =
            workflowResponse.data?.workflow ??
            workflowResponse.data?.data ??
            workflowResponse.data;
        }

        if (!workflowPayload) {
          workflowPayload = {
            agents: execution.agents ?? execution.nodes ?? [],
            dependencies: execution.dependencies ?? execution.edges ?? [],
          };
        }

        const graph = workflowToFlow(workflowPayload);
        setNodes(
          graph.nodes.map((node) => ({
            ...node,
            data: {
              ...node.data,
              readonly: true,
              status: node.data.status ?? "queue",
            },
          })),
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
        const timestamp = new Date().toLocaleTimeString();

        setLogs((current) => [
          {
            agentId: payload.agentId,
            agentName: payload.agentName ?? payload.agentId,
            agentType: payload.agentType ?? payload.type,
            status,
            output: payload.output,
            timestamp,
          },
          ...current,
        ]);

        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            if (node.id !== payload.agentId) {
              return node;
            }

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
        setLogs((current) => [
          {
            agentId: "unknown",
            agentName: "unknown",
            agentType: "default",
            status: "queue",
            output: event.data,
            timestamp: new Date().toLocaleTimeString(),
          },
          ...current,
        ]);
      }
    };

    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  }, [executionId]);

  const isComplete = useMemo(() => {
    if (!nodes.length) return false;
    return nodes.every((node) => node.data.status === "completed");
  }, [nodes]);

  const isRunning = useMemo(
    () => nodes.some((node) => node.data.status === "running"),
    [nodes],
  );

  const typeByAgentId = useMemo(() => {
    return nodes.reduce((accumulator, node) => {
      accumulator[node.id] = node.data.type;
      return accumulator;
    }, {});
  }, [nodes]);

  const renderedEdges = useMemo(() => {
    return edges.map((edge) => ({
      ...edge,
      animated: isRunning,
      className: isRunning ? "workflow-edge-running" : "workflow-edge-idle",
    }));
  }, [edges, isRunning]);

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
    <section className="grid h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[1fr_340px]">
      <div className="relative border-b border-slate-300 lg:border-b-0 lg:border-r dark:border-slate-800">
        {showCompleteToast ? (
          <div className="workflow-toast absolute right-4 top-4 z-30 rounded-xl border border-emerald-500/40 bg-slate-950/85 px-4 py-2 text-sm font-semibold text-emerald-200 shadow-2xl backdrop-blur">
            Workflow Complete
          </div>
        ) : null}

        {error ? (
          <div className="absolute left-4 right-4 top-4 z-20">
            <ErrorState message={error} />
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <LoadingSpinner label="Connecting to execution..." />
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={renderedEdges}
            nodeTypes={nodeTypes}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            zoomOnDoubleClick={false}
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
      </div>

      <aside className="h-full overflow-y-auto bg-white/80 p-4 dark:bg-slate-900/80">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Live Logs
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Streaming events from execution {executionId}
        </p>

        <div className="mt-4 space-y-3">
          {logs.length ? (
            logs.map((log, index) => {
              const agentType = normalizeAgentType(
                log.agentType ?? typeByAgentId[log.agentId] ?? "default",
              );

              return (
                <article
                  key={`${log.agentId}-${log.timestamp}-${index}`}
                  className="rounded-xl border border-slate-300 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-cyan-700 dark:text-cyan-300">
                        {log.agentName ?? log.agentId}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={`agent-type-badge inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide agent-type-${agentType}`}
                        >
                          {agentType === "default" ? "agent" : agentType}
                        </span>
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(
                            log.status,
                          )}`}
                        >
                          {log.status}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0">{log.timestamp}</span>
                  </div>

                  {log.output ? (
                    <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-2 dark:border-slate-700 dark:bg-slate-900/60">
                      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                        Output
                      </summary>
                      <div className="markdown-log mt-2 text-sm text-slate-700 dark:text-slate-200">
                        <ReactMarkdown>{String(log.output)}</ReactMarkdown>
                      </div>
                    </details>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      No output yet.
                    </p>
                  )}
                </article>
              );
            })
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Waiting for events...
            </p>
          )}
        </div>
      </aside>
    </section>
  );
}

export default ExecutionViewPage;

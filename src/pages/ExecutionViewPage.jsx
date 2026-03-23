import { Background, Controls, MiniMap, ReactFlow } from "@xyflow/react";
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
};

const STATUS_COLORS = {
  queue: "text-slate-400",
  running: "text-yellow-400",
  completed: "text-emerald-400",
  failed: "text-rose-400",
};

function OutputPanel({ node, onClose }) {
  const status = node?.data?.status ?? "queue";
  const output = node?.data?.output;
  const agentId = node?.data?.id;
  const agentType = node?.data?.type;

  return (
    <div className="absolute bottom-0 right-0 top-0 z-30 flex w-[360px] flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      {/* Header */}
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

      {/* Output */}
      <div className="flex-1 overflow-y-auto p-4">
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
  const [selectedNodeId, setSelectedNodeId] = useState(null);

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

        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            if (node.id !== payload.agentId) return node;
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

  return (
    <section className="relative h-[calc(100vh-4rem)] overflow-hidden">
      {/* Status banner */}
      {isComplete && (
        <div className="absolute left-4 right-4 top-4 z-20 rounded-lg border border-emerald-500/60 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200">
          Workflow Complete
        </div>
      )}

      {error && (
        <div className="absolute left-4 right-4 top-4 z-20">
          <ErrorState message={error} />
        </div>
      )}

      {/* Hint */}
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
          edges={edges}
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
          className="bg-slate-100 dark:bg-slate-950"
        >
          <Background color="#334155" gap={24} />
          <MiniMap
            pannable
            zoomable
            className="!bg-slate-200 dark:!bg-slate-900"
          />
          <Controls className="!rounded-lg !border !border-slate-300 !bg-white dark:!border-slate-700 dark:!bg-slate-900" />
        </ReactFlow>
      )}

      {/* Node output panel */}
      {selectedNode && (
        <OutputPanel
          node={selectedNode}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </section>
  );
}

export default ExecutionViewPage;

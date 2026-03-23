import { Background, Controls, MiniMap, ReactFlow } from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import AgentNode from "../components/AgentNode";
import ErrorState from "../components/ErrorState";
import LoadingSpinner from "../components/LoadingSpinner";
import { API_BASE_URL, api } from "../lib/api";
import { workflowToFlow } from "../lib/workflowGraph";

const nodeTypes = {
  agent: AgentNode,
};

function ExecutionViewPage() {
  const { executionId } = useParams();
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <section className="grid h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[1fr_340px]">
      <div className="relative border-b border-slate-300 lg:border-b-0 lg:border-r dark:border-slate-800">
        {isComplete ? (
          <div className="absolute left-4 right-4 top-4 z-20 rounded-lg border border-emerald-500/60 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200">
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
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            zoomOnDoubleClick={false}
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
            logs.map((log, index) => (
              <article
                key={`${log.agentId}-${log.timestamp}-${index}`}
                className="rounded-lg border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-950"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-cyan-700 dark:text-cyan-300">
                    {log.agentId}
                  </span>
                  <span>{log.timestamp}</span>
                </div>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                  Status: {log.status}
                </p>
                {log.status === "completed" && log.output ? (
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-slate-100 p-2 text-xs text-emerald-700 dark:bg-slate-900 dark:text-emerald-200">
                    {log.output}
                  </pre>
                ) : null}
              </article>
            ))
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

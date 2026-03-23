import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import AgentNode from "../components/AgentNode";
import ErrorState from "../components/ErrorState";
import LoadingSpinner from "../components/LoadingSpinner";
import { api } from "../lib/api";
import { flowToWorkflowPayload, workflowToFlow } from "../lib/workflowGraph";

const nodeTypes = {
  agent: AgentNode,
};

function normalizeWorkflowPayload(data) {
  return data?.workflow ?? data?.data?.workflow ?? data?.data ?? data;
}

function WorkflowEditorPage() {
  const { id } = useParams();
  const [workflow, setWorkflow] = useState(null);
  const [workflowName, setWorkflowName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [draftNode, setDraftNode] = useState({
    id: "",
    type: "researcher",
    prompt: "",
  });

  const loadWorkflow = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await api.get(`/workflow/${id}`);
      const payload = normalizeWorkflowPayload(response.data);
      setWorkflow(payload);
      setWorkflowName(payload?.name ?? payload?.title ?? "");

      const graph = workflowToFlow(payload);
      setNodes(graph.nodes);
      setEdges(graph.edges);
      setSelectedNodeId("");
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError.message ||
          "Failed to load workflow.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [id, setEdges, setNodes]);

  useEffect(() => {
    loadWorkflow();
  }, [loadWorkflow]);

  const onConnect = useCallback(
    (connection) => {
      setEdges((currentEdges) =>
        addEdge({ ...connection, animated: true }, currentEdges),
      );
    },
    [setEdges],
  );

  const handleDraftChange = (key, value) => {
    setDraftNode((current) => ({ ...current, [key]: value }));
  };

  const addNode = (event) => {
    event.preventDefault();
    const trimmedId = draftNode.id.trim();

    if (!trimmedId || nodes.some((node) => node.id === trimmedId)) {
      return;
    }

    setNodes((currentNodes) => [
      ...currentNodes,
      {
        id: trimmedId,
        type: "agent",
        position: {
          x: 100 + (currentNodes.length % 4) * 230,
          y: 100 + Math.floor(currentNodes.length / 4) * 140,
        },
        data: {
          id: trimmedId,
          type: draftNode.type.trim() || "agent",
          prompt: draftNode.prompt,
          tools: [],
        },
      },
    ]);

    setDraftNode({ id: "", type: draftNode.type, prompt: "" });
  };

  const handleSave = async () => {
    if (!workflow) return;

    setIsSaving(true);
    setSaveMessage("");
    setError("");

    const payload = flowToWorkflowPayload(nodes, edges, {
      ...workflow,
      name: workflowName.trim() || workflow?.name || workflow?.title,
    });

    try {
      let response;

      try {
        response = await api.patch(`/workflow/${id}`, payload);
      } catch {
        response = await api.put(`/workflow/${id}`, payload);
      }

      const savedWorkflow = response
        ? normalizeWorkflowPayload(response.data)
        : null;

      setSaveMessage("Workflow saved successfully.");
      setWorkflow(savedWorkflow ?? payload);
      setWorkflowName(
        savedWorkflow?.name ??
          savedWorkflow?.title ??
          payload?.name ??
          payload?.title ??
          workflowName,
      );
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError.message ||
          "Failed to save workflow.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const title = useMemo(() => {
    return (
      workflowName.trim() ||
      workflow?.name ||
      workflow?.title ||
      `Workflow ${id}`
    );
  }, [workflowName, workflow, id]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find((node) => node.id === selectedNodeId) ?? null;
  }, [nodes, selectedNodeId]);

  const handleSelectedNodeChange = (key, value) => {
    if (!selectedNodeId) return;

    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== selectedNodeId) return node;

        return {
          ...node,
          data: {
            ...node.data,
            [key]: value,
          },
        };
      }),
    );
  };

  const deleteSelectedNode = () => {
    if (!selectedNodeId) return;

    setNodes((currentNodes) =>
      currentNodes.filter((node) => node.id !== selectedNodeId),
    );
    setEdges((currentEdges) =>
      currentEdges.filter(
        (edge) =>
          edge.source !== selectedNodeId && edge.target !== selectedNodeId,
      ),
    );
    setSelectedNodeId("");
  };

  return (
    <section className="grid h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[1fr_320px]">
      <div className="relative border-b border-slate-300 lg:border-b-0 lg:border-r dark:border-slate-800">
        <div className="absolute left-4 top-4 z-10 rounded-lg bg-white/90 px-3 py-2 text-sm text-slate-700 shadow-lg backdrop-blur dark:bg-slate-950/90 dark:text-slate-200">
          <p className="font-semibold text-cyan-700 dark:text-cyan-300">
            {title}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Drag to rearrange and connect dependencies
          </p>
        </div>

        {error ? (
          <div className="absolute left-4 right-4 top-20 z-20">
            <ErrorState message={error} onRetry={loadWorkflow} />
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <LoadingSpinner label="Loading workflow graph..." />
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            fitView
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

      <aside className="h-full overflow-y-auto border-slate-300 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mb-5 rounded-lg border border-slate-300 p-3 dark:border-slate-700">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Workflow Name
          </h2>
          <input
            value={workflowName}
            onChange={(event) => setWorkflowName(event.target.value)}
            className="mt-2 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-cyan-400 placeholder:text-slate-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            placeholder="Workflow name"
          />
        </div>

        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Add Agent
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Create nodes and connect them on the canvas.
        </p>

        <form onSubmit={addNode} className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Id
            </span>
            <input
              required
              value={draftNode.id}
              onChange={(event) => handleDraftChange("id", event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-cyan-400 placeholder:text-slate-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="agent-4"
            />
          </label>

          <label className="block">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Type
            </span>
            <input
              value={draftNode.type}
              onChange={(event) =>
                handleDraftChange("type", event.target.value)
              }
              className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-cyan-400 placeholder:text-slate-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="researcher"
            />
          </label>

          <label className="block">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Prompt
            </span>
            <textarea
              value={draftNode.prompt}
              onChange={(event) =>
                handleDraftChange("prompt", event.target.value)
              }
              rows={5}
              className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-cyan-400 placeholder:text-slate-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="Summarize recent AI news with references."
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-md bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
          >
            Add Node
          </button>
        </form>

        <div className="mt-6 rounded-lg border border-slate-300 p-3 dark:border-slate-700">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Edit Selected Agent
          </h3>
          {!selectedNode ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Click an agent node in the canvas to edit its details.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                {selectedNode.id}
              </p>

              <label className="block">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Type
                </span>
                <input
                  value={selectedNode.data?.type ?? ""}
                  onChange={(event) =>
                    handleSelectedNodeChange("type", event.target.value)
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-cyan-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              <label className="block">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Prompt
                </span>
                <textarea
                  value={selectedNode.data?.prompt ?? ""}
                  onChange={(event) =>
                    handleSelectedNodeChange("prompt", event.target.value)
                  }
                  rows={5}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-cyan-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              <button
                type="button"
                onClick={deleteSelectedNode}
                className="w-full rounded-md border border-rose-500/70 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
              >
                Delete Agent
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 border-t border-slate-300 pt-4 dark:border-slate-700">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="w-full rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save Workflow"}
          </button>
          {saveMessage ? (
            <p className="mt-2 text-xs text-emerald-300">{saveMessage}</p>
          ) : null}
        </div>
      </aside>
    </section>
  );
}

export default WorkflowEditorPage;

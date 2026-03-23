const DEFAULT_NODE_POSITION_STEP_X = 230;
const DEFAULT_NODE_POSITION_STEP_Y = 130;

const TYPE_COLORS = {
  researcher: "border-blue-500/80 bg-blue-500/15",
  writer: "border-emerald-500/80 bg-emerald-500/15",
  default: "border-slate-500/80 bg-slate-500/20",
};

export function getAgentTypeClass(type = "") {
  return TYPE_COLORS[type] ?? TYPE_COLORS.default;
}

export function getStatusClass(status = "queue") {
  if (status === "running")
    return "border-yellow-400 bg-yellow-500/20 animate-pulse";
  if (status === "completed") return "border-emerald-500 bg-emerald-500/20";
  return "border-slate-500 bg-slate-500/20";
}

function coerceAgents(workflow) {
  const asArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return Object.values(value);
    return [];
  };

  const agents = asArray(workflow?.agents);
  if (agents.length) return agents;

  const nodes = asArray(workflow?.nodes);
  if (nodes.length) return nodes;

  const graphNodes = asArray(workflow?.graph?.nodes);
  if (graphNodes.length) return graphNodes;

  const graphAgents = asArray(workflow?.graph?.agents);
  if (graphAgents.length) return graphAgents;

  return [];
}

function coerceDependencies(workflow) {
  const asArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return Object.values(value);
    return [];
  };

  const dependencies = asArray(workflow?.dependencies);
  if (dependencies.length) return dependencies;

  const edges = asArray(workflow?.edges);
  if (edges.length) return edges;

  const graphEdges = asArray(workflow?.graph?.edges);
  if (graphEdges.length) return graphEdges;

  const graphDependencies = asArray(workflow?.graph?.dependencies);
  if (graphDependencies.length) return graphDependencies;

  return [];
}

function pickPrompt(agent) {
  return agent.prompt ?? agent.description ?? "";
}

function pickType(agent) {
  return agent.type ?? agent.agentType ?? "agent";
}

function pickId(agent, index) {
  return String(agent.id ?? agent.agentId ?? `agent-${index + 1}`);
}

export function workflowToFlow(workflow) {
  const agents = coerceAgents(workflow);
  const dependencies = coerceDependencies(workflow);

  const nodes = agents.map((agent, index) => {
    const id = pickId(agent, index);
    const row = Math.floor(index / 4);
    const column = index % 4;

    return {
      id,
      type: "agent",
      position: {
        x: agent.position?.x ?? column * DEFAULT_NODE_POSITION_STEP_X,
        y: agent.position?.y ?? row * DEFAULT_NODE_POSITION_STEP_Y,
      },
      data: {
        id,
        type: pickType(agent),
        prompt: pickPrompt(agent),
        tools: Array.isArray(agent.tools) ? agent.tools : [],
        status: agent.status ?? "queue",
        output: agent.output,
      },
    };
  });

  const normalizedEdges = dependencies
    .map((dependency, index) => {
      if (dependency.source && dependency.target) {
        return {
          id:
            dependency.id ??
            `edge-${dependency.source}-${dependency.target}-${index}`,
          source: String(dependency.source),
          target: String(dependency.target),
        };
      }

      if (dependency.from && dependency.to) {
        return {
          id:
            dependency.id ??
            `edge-${dependency.from}-${dependency.to}-${index}`,
          source: String(dependency.from),
          target: String(dependency.to),
        };
      }

      return null;
    })
    .filter(Boolean);

  return { nodes, edges: normalizedEdges };
}

export function flowToWorkflowPayload(nodes, edges, baseWorkflow = {}) {
  const agents = nodes.map((node) => {
    const id = String(node.id);

    return {
      id,
      type: node.data?.type ?? "agent",
      prompt: node.data?.prompt ?? "",
      tools: node.data?.tools ?? [],
      position: node.position,
    };
  });

  const dependencies = edges.map((edge, index) => ({
    id: edge.id ?? `edge-${edge.source}-${edge.target}-${index}`,
    source: String(edge.source),
    target: String(edge.target),
  }));

  const graph = {
    nodes: agents.map((agent) => ({
      id: agent.id,
      type: agent.type,
      prompt: agent.prompt,
      tools: agent.tools,
      position: agent.position,
    })),
    edges: dependencies.map((dependency) => ({
      id: dependency.id,
      source: dependency.source,
      target: dependency.target,
    })),
  };

  return {
    ...baseWorkflow,
    agents,
    dependencies,
    graph,
  };
}

export function extractWorkflowId(workflow) {
  return workflow?.id ?? workflow?._id ?? workflow?.workflowId ?? "";
}

export function extractWorkflowName(workflow) {
  return (
    workflow?.name ??
    workflow?.title ??
    `Workflow ${extractWorkflowId(workflow)}`
  );
}

export function extractCreatedAt(workflow) {
  const value =
    workflow?.createdAt ?? workflow?.created_at ?? workflow?.timestamp;
  if (!value) return "Unknown date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString();
}

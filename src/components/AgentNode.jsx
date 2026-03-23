import { Handle, Position } from "@xyflow/react";
import { getAgentTypeClass, getStatusClass } from "../lib/workflowGraph";

const STATUS_DOT = {
  queue: "bg-slate-400",
  running: "bg-yellow-400 animate-pulse",
  completed: "bg-emerald-400",
  failed: "bg-rose-400",
};

function AgentNode({ data }) {
  const typeClass = getAgentTypeClass(data.type);
  const statusClass = data.readonly ? getStatusClass(data.status) : "";
  const selectedRing = data.isSelected
    ? "ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-950"
    : "";

  return (
    <div
      className={`min-w-52 cursor-pointer rounded-lg border px-3 py-2 text-left shadow-lg backdrop-blur transition-shadow ${typeClass} ${statusClass} ${selectedRing}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-none !bg-slate-500 dark:!bg-slate-200"
      />
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-slate-700 dark:text-slate-200/90">
          {data.type}
        </p>
        {data.readonly && (
          <span
            className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[data.status] ?? STATUS_DOT.queue}`}
          />
        )}
      </div>
      <p className="mt-1 font-semibold text-slate-900 dark:text-white">
        {data.id}
      </p>
      <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
        {(data.prompt || "").slice(0, 60) || "No prompt yet"}
      </p>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-none !bg-slate-500 dark:!bg-slate-200"
      />
    </div>
  );
}

export default AgentNode;

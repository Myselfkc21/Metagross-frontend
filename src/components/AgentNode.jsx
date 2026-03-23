import { Handle, Position } from "@xyflow/react";
import { getAgentTypeClass, getStatusClass } from "../lib/workflowGraph";

function AgentNode({ data }) {
  const typeClass = getAgentTypeClass(data.type);
  const statusClass = data.readonly ? getStatusClass(data.status) : "";

  return (
    <div
      className={`min-w-52 rounded-lg border px-3 py-2 text-left shadow-lg backdrop-blur ${typeClass} ${statusClass}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-none !bg-slate-500 dark:!bg-slate-200"
      />
      <p className="text-xs uppercase tracking-wide text-slate-700 dark:text-slate-200/90">
        {data.type}
      </p>
      <p className="mt-1 font-semibold text-slate-900 dark:text-white">
        {data.id}
      </p>
      <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
        {(data.prompt || "").slice(0, 60) || "No prompt yet"}
      </p>
      {data.readonly ? (
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-100">
          Status: {data.status}
        </p>
      ) : null}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-none !bg-slate-500 dark:!bg-slate-200"
      />
    </div>
  );
}

export default AgentNode;

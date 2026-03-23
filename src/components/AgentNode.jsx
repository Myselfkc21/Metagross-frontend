import { Handle, Position } from "@xyflow/react";

const typeBorderClasses = {
  researcher: "agent-node-type-researcher",
  writer: "agent-node-type-writer",
  editor: "agent-node-type-editor",
  default: "agent-node-type-default",
};

const statusPillClasses = {
  completed:
    "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200",
  running:
    "border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-200",
  failed: "border-rose-500/50 bg-rose-500/15 text-rose-700 dark:text-rose-200",
  queue:
    "border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-200",
};

function AgentNode({ data }) {
  const typeClass = typeBorderClasses[data.type] ?? typeBorderClasses.default;
  const statusClass = statusPillClasses[data.status] ?? statusPillClasses.queue;
  const runningClass = data.status === "running" ? "agent-node-running" : "";
  const selectedRing = data.isSelected
    ? "ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-950"
    : "";

  return (
    <div
      className={`agent-node min-w-52 cursor-pointer rounded-xl border px-3 py-2 text-left shadow-lg backdrop-blur transition-shadow ${typeClass} ${runningClass} ${selectedRing}`}
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
        <span
          className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClass}`}
        >
          {data.status}
        </span>
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

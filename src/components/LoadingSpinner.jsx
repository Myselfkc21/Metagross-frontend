function LoadingSpinner({ label = "Loading..." }) {
  return (
    <div
      className="flex items-center gap-3 text-slate-600 dark:text-slate-300"
      role="status"
      aria-live="polite"
    >
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      <span>{label}</span>
    </div>
  );
}

export default LoadingSpinner;

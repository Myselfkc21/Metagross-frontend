function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded-lg border border-red-500/40 bg-red-100 p-4 text-red-900 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-200">
      <p className="font-semibold">Something went wrong</p>
      <p className="mt-1 text-sm opacity-90">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md bg-red-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-400"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export default ErrorState;

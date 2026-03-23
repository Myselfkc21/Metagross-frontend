import { NavLink } from "react-router-dom";
import { useTheme } from "../lib/theme";

const navLinkClass = ({ isActive }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition ${
    isActive
      ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300"
      : "text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
  }`;

function Navbar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-300/80 bg-slate-100/95 backdrop-blur dark:border-slate-700/70 dark:bg-slate-950/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <NavLink
          to="/home"
          className="text-2xl font-black tracking-tight text-cyan-700 dark:text-cyan-300"
        >
          Metagross
        </NavLink>

        <nav className="flex items-center gap-2">
          <NavLink to="/home" className={navLinkClass}>
            Home
          </NavLink>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
        </nav>
      </div>
    </header>
  );
}

export default Navbar;

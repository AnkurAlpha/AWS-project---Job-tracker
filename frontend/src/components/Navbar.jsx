import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { BriefcaseBusiness, FolderKanban, House, LogIn, LogOut, Moon, PlusCircle, ShieldCheck, ShieldOff, Sun, UserRoundSearch, Wrench } from "lucide-react";
import { useTheme } from "../theme/useTheme.js";

const Navbar = () => {
  const { isAdmin, isAuthenticated, logout, user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const linkClass = ({ isActive }) =>
    [
      "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
      isActive
        ? "bg-teal-900 text-white shadow-sm"
        : "text-slate-700 hover:bg-white/80 hover:text-slate-900",
    ].join(" ");

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="brand-font text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
              Job Application Tracker
            </p>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Recruitment workspace</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge">Live Board</span>
            <span className="badge">
              {isAdmin ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
              {isAdmin ? `Admin Logged In${user?.username ? ` (${user.username})` : ""}` : "Admin Logged Out"}
            </span>
          </div>
        </div>

        <nav className="glass-card flex flex-wrap items-center gap-1 rounded-2xl p-1.5">
          <NavLink to="/" className={linkClass}>
            <House size={16} />
            Home
          </NavLink>
          <NavLink to="/jobs" className={linkClass}>
            <BriefcaseBusiness size={16} />
            Jobs
          </NavLink>
          <NavLink to="/dashboard" className={linkClass}>
            <FolderKanban size={16} />
            Dashboard
          </NavLink>
          {isAdmin ? (
            <NavLink to="/admin/create-job" className={linkClass}>
              <PlusCircle size={16} />
              Create Job
            </NavLink>
          ) : null}
          {isAdmin ? (
            <NavLink to="/admin/applicants" className={linkClass}>
              <UserRoundSearch size={16} />
              Applicants
            </NavLink>
          ) : null}
          {isAdmin ? (
            <NavLink to="/jobs" className={linkClass}>
              <Wrench size={16} />
              Manage Jobs
            </NavLink>
          ) : null}
          {!isAuthenticated ? (
            <NavLink to="/login" className={linkClass}>
              <LogIn size={16} />
              Login
            </NavLink>
          ) : null}
          <button
            type="button"
            onClick={toggleTheme}
            className="ml-auto inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            aria-label="Toggle color theme"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
            {isDark ? "Light" : "Dark"}
          </button>
          {isAuthenticated ? (
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              <LogOut size={16} />
              Logout
            </button>
          ) : null}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;

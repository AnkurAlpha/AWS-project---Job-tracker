import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createJob, deleteJob, getAuthMe, getJobs, loginAdmin, signupAdmin } from "../api/api";
import { useAuth } from "../auth/AuthContext";
import { LogIn, PlusCircle, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || "/admin/create-job";

  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", password: "", confirmPassword: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
  const [canManageJobs, setCanManageJobs] = useState(false);
  const [quickForm, setQuickForm] = useState({ title: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!token) {
      setCanManageJobs(false);
      return;
    }

    setCheckingAdmin(true);
    getAuthMe(token)
      .then((data) => setCanManageJobs(data?.user?.role === "admin"))
      .catch(() => setCanManageJobs(false))
      .finally(() => setCheckingAdmin(false));
  }, [token]);

  useEffect(() => {
    if (!canManageJobs || !token) return;
    setJobsLoading(true);
    getJobs()
      .then(setJobs)
      .catch((err) => toast.error(err.message || "Failed to load jobs"))
      .finally(() => setJobsLoading(false));
  }, [canManageJobs, token]);

  const onChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (mode === "signup" && form.password !== form.confirmPassword) {
        throw new Error("Passwords do not match");
      }
      const payload = { username: form.username, password: form.password };
      const request = mode === "signup" ? signupAdmin(payload) : loginAdmin(payload);
      toast.promise(request, {
        loading: mode === "signup" ? "Creating account..." : "Signing in...",
        success: mode === "signup" ? "Account created" : "Logged in",
        error: (err) => err?.message || `${mode === "signup" ? "Signup" : "Login"} failed`,
      });
      const data = await request;
      login(data);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || `${mode === "signup" ? "Signup" : "Login"} failed`);
    } finally {
      setSubmitting(false);
    }
  };

  const addJobQuickly = async (e) => {
    e.preventDefault();
    if (!token || !canManageJobs) return;
    setSaving(true);
    try {
      const request = createJob({ ...quickForm, token });
      const created = await toast.promise(request, {
        loading: "Adding job...",
        success: "Job added",
        error: (err) => err?.message || "Failed to add job",
      });
      setJobs((prev) => [created, ...prev]);
      setQuickForm({ title: "", description: "" });
    } finally {
      setSaving(false);
    }
  };

  const removeJobQuickly = async (id) => {
    if (!token || !canManageJobs) return;
    setDeletingId(id);
    try {
      const request = deleteJob({ id, token });
      await toast.promise(request, {
        loading: "Removing job...",
        success: "Job removed",
        error: (err) => err?.message || "Failed to remove job",
      });
      setJobs((prev) => prev.filter((job) => job.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="mx-auto max-w-md glass-card rounded-3xl p-8">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Admin Access</h1>
      <p className="mt-2 text-sm text-slate-600">Sign in or create an admin account to manage jobs.</p>

      <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-1">
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setError("");
          }}
          className={[
            "rounded-lg px-3 py-2 text-sm font-medium transition",
            mode === "login" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
          ].join(" ")}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setError("");
          }}
          className={[
            "rounded-lg px-3 py-2 text-sm font-medium transition",
            mode === "signup" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
          ].join(" ")}
        >
          Signup
        </button>
      </div>

      {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Username</label>
          <input
            name="username"
            value={form.username}
            onChange={onChange}
            autoComplete="username"
            className="field"
            placeholder="admin-user"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Password</label>
          <input
            name="password"
            value={form.password}
            onChange={onChange}
            type="password"
            autoComplete="current-password"
            className="field"
            placeholder="••••••••"
          />
        </div>

        {mode === "signup" ? (
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Confirm Password</label>
            <input
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={onChange}
              type="password"
              autoComplete="new-password"
              className="field"
              placeholder="••••••••"
            />
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!form.username || !form.password || (mode === "signup" && !form.confirmPassword) || submitting}
          className="btn btn-primary login-submit-btn w-full disabled:cursor-not-allowed"
        >
          {mode === "signup" ? <UserPlus size={16} /> : <LogIn size={16} />}
          {submitting ? (mode === "signup" ? "Creating account..." : "Signing in...") : mode === "signup" ? "Create Account" : "Login"}
        </button>
      </form>

      {checkingAdmin ? <p className="mt-6 text-xs text-slate-600">Verifying admin session...</p> : null}

      {canManageJobs ? (
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white/80 p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">Admin Quick Jobs Panel</p>
              <p className="text-xs text-slate-600">Add and remove jobs directly from Login tab.</p>
            </div>
            <span className="badge">{jobs.length} jobs</span>
          </div>

          <form onSubmit={addJobQuickly} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              className="field"
              placeholder="Job title"
              value={quickForm.title}
              onChange={(e) => setQuickForm((prev) => ({ ...prev, title: e.target.value }))}
            />
            <input
              className="field"
              placeholder="Short description"
              value={quickForm.description}
              onChange={(e) => setQuickForm((prev) => ({ ...prev, description: e.target.value }))}
            />
            <button
              type="submit"
              disabled={!quickForm.title.trim() || !quickForm.description.trim() || saving}
              className="btn btn-primary sm:col-span-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PlusCircle size={16} />
              {saving ? "Adding..." : "Quick Add Job"}
            </button>
          </form>

          <div className="mt-4 space-y-2">
            {jobsLoading ? <p className="text-xs text-slate-600">Loading jobs...</p> : null}
            {!jobsLoading && jobs.length === 0 ? <p className="text-xs text-slate-600">No jobs available.</p> : null}
            {jobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/90 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{job.title}</p>
                  <p className="truncate text-xs text-slate-600">{job.description || "No description provided."}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeJobQuickly(job.id)}
                  disabled={deletingId === job.id}
                  className="btn !rounded-full !px-3 !py-1.5 !text-xs border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60"
                >
                  <Trash2 size={14} />
                  {deletingId === job.id ? "Removing..." : "Remove"}
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}

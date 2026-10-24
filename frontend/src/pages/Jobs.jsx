import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createJob, deleteJob, getJobs } from "../api/api.js";
import { toast } from "sonner";
import Skeleton from "react-loading-skeleton";
import { Eye, PlusCircle, Trash2 } from "lucide-react";
import { useAuth } from "../auth/AuthContext.jsx";

const Jobs = () => {
  const { isAdmin, token } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quickForm, setQuickForm] = useState({ title: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState(null);

  const fetchJobs = () => {
    getJobs()
      .then(setJobs)
      .catch((err) => {
        const message = err.message || "Failed to fetch jobs";
        setError(message);
        toast.error(message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const addJobQuickly = async (e) => {
    e.preventDefault();
    if (!isAdmin || !token) return;
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
    if (!isAdmin || !token) return;
    setDeletingJobId(id);
    try {
      const request = deleteJob({ id, token });
      await toast.promise(request, {
        loading: "Removing job...",
        success: "Job removed",
        error: (err) => err?.message || "Failed to remove job",
      });
      setJobs((prev) => prev.filter((job) => job.id !== id));
    } finally {
      setDeletingJobId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="glass-card rounded-2xl p-6">
          <Skeleton width={180} height={28} />
          <div className="mt-2">
            <Skeleton width={320} height={16} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <article key={`jobs-skeleton-${index}`} className="soft-panel rounded-2xl p-5">
              <Skeleton width="70%" height={22} />
              <div className="mt-3 space-y-2">
                <Skeleton count={3} height={14} />
              </div>
              <div className="mt-5 flex justify-end">
                <Skeleton width={92} height={30} borderRadius={9999} />
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <p className="text-sm font-semibold text-red-800">Error</p>
        <p className="mt-1 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="glass-card flex flex-wrap items-end justify-between gap-3 rounded-2xl p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Open Jobs</h1>
          <p className="mt-1 text-sm text-slate-600">Browse available roles and open the detail view to apply.</p>
        </div>
        <div className="badge">{jobs.length} total</div>
      </div>

      {isAdmin ? (
        <section className="soft-panel rounded-2xl p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">Admin Quick Actions</p>
              <p className="mt-1 text-xs text-slate-600">Add or remove jobs instantly without leaving this page.</p>
            </div>
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
        </section>
      ) : null}

      {jobs.length === 0 ? (
        <div className="soft-panel rounded-2xl p-6">
          <p className="text-sm font-semibold text-slate-900">No jobs yet</p>
          <p className="mt-1 text-sm text-slate-600">Add jobs from the backend seed or admin panel.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job) => (
            <article key={job.id} className="soft-panel rounded-2xl p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                <p className="text-base font-bold text-slate-900">{job.title}</p>
                <p className="mt-2 text-sm text-slate-600">{job.description || "No description provided."}</p>
                <div className="mt-4 flex justify-end gap-2">
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => removeJobQuickly(job.id)}
                      disabled={deletingJobId === job.id}
                      className="btn !rounded-full !px-3 !py-1.5 !text-xs border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60"
                    >
                      <Trash2 size={14} />
                      {deletingJobId === job.id ? "Removing..." : "Remove"}
                    </button>
                  ) : null}
                  <Link to={`/jobs/${job.id}`} className="btn btn-secondary !rounded-full !px-4 !py-1.5 !text-xs">
                    <Eye size={14} />
                    View Role
                  </Link>
                </div>
              </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default Jobs;

import { useEffect, useMemo, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { toast } from "sonner";
import { CheckCircle2, ListTodo, Trash2, UserCheck } from "lucide-react";
import { deleteApplication, getApplications, updateApplicationStatus } from "../api/api";
import { useAuth } from "../auth/AuthContext";

const STATUS_BADGE_CLASS = {
  applied: "border-sky-200 bg-sky-50 text-sky-700",
  interview: "border-amber-200 bg-amber-50 text-amber-700",
  passed: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export default function Applicants() {
  const { token } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    getApplications(token)
      .then((data) => setApplications(data))
      .catch((err) => {
        const message = err.message || "Failed to load applicants";
        setError(message);
        toast.error(message);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const counts = useMemo(() => {
    const summary = { total: applications.length, applied: 0, interview: 0, passed: 0 };
    applications.forEach((item) => {
      const status = item.status || "applied";
      if (status in summary) summary[status] += 1;
    });
    return summary;
  }, [applications]);

  const onStatusChange = async (id, status) => {
    if (!token) return;
    const targetId = Number(id);
    let previousStatus = "applied";
    setUpdatingId(targetId);

    setApplications((prev) =>
      prev.map((item) => {
        if (Number(item.id) !== targetId) return item;
        previousStatus = item.status || "applied";
        return { ...item, status };
      })
    );

    try {
      const request = updateApplicationStatus({ id: targetId, status, token });
      toast.promise(request, {
        loading: "Updating status...",
        success: `Moved to ${status}`,
        error: (err) => err?.message || "Failed to update status",
      });
      const result = await request;
      setApplications((prev) =>
        prev.map((item) =>
          Number(item.id) === targetId
            ? { ...item, ...result.application, status: result.application?.status || status }
            : item
        )
      );
    } catch {
      setApplications((prev) =>
        prev.map((item) => (Number(item.id) === targetId ? { ...item, status: previousStatus } : item))
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const onRemove = async (id) => {
    if (!token) return;
    setDeletingId(id);
    try {
      const request = deleteApplication({ id, token });
      await toast.promise(request, {
        loading: "Removing applicant...",
        success: "Applicant removed",
        error: (err) => err?.message || "Failed to remove applicant",
      });
      setApplications((prev) => prev.filter((item) => item.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <section className="glass-card rounded-2xl p-6">
          <Skeleton width={260} height={30} />
          <div className="mt-2">
            <Skeleton width={360} height={14} />
          </div>
        </section>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <article key={`applicant-skeleton-${index}`} className="soft-panel rounded-2xl p-5">
              <Skeleton width="55%" height={18} />
              <div className="mt-2 space-y-2">
                <Skeleton count={3} height={12} />
              </div>
              <div className="mt-4 flex gap-2">
                <Skeleton width={96} height={30} borderRadius={9999} />
                <Skeleton width={96} height={30} borderRadius={9999} />
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
        <p className="text-sm font-semibold text-red-800">Applicants Error</p>
        <p className="mt-1 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="glass-card rounded-2xl p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Applicants</h1>
            <p className="mt-1 text-sm text-slate-600">Review submissions and move candidates through the hiring pipeline.</p>
          </div>
          <span className="badge">{counts.total} total</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="badge">Applied: {counts.applied}</span>
          <span className="badge">Interview: {counts.interview}</span>
          <span className="badge">Passed: {counts.passed}</span>
        </div>
      </section>

      {applications.length === 0 ? (
        <section className="soft-panel rounded-2xl p-6">
          <p className="text-sm font-semibold text-slate-900">No applicants yet</p>
          <p className="mt-1 text-sm text-slate-600">Candidate applications will appear here once someone applies.</p>
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {applications.map((application) => {
            const status = application.status || "applied";
            return (
              <article key={application.id} className="soft-panel rounded-2xl p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-base font-bold text-slate-900">{application.name}</p>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_BADGE_CLASS[status] || STATUS_BADGE_CLASS.applied}`}>
                    {status}
                  </span>
                </div>

                <p className="mt-2 text-sm text-slate-700">{application.email}</p>
                <p className="mt-2 text-xs text-slate-600">Role: {application.jobTitle || `Job #${application.jobId}`}</p>
                <p className="mt-2 line-clamp-3 text-sm text-slate-600">Resume: {application.resume}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onStatusChange(application.id, "interview")}
                    disabled={updatingId === application.id || deletingId === application.id || status === "interview"}
                    className="btn btn-secondary !rounded-full !px-3 !py-1.5 !text-xs disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ListTodo size={14} />
                    Interview
                  </button>

                  <button
                    type="button"
                    onClick={() => onStatusChange(application.id, "passed")}
                    disabled={updatingId === application.id || deletingId === application.id || status === "passed"}
                    className="btn btn-secondary !rounded-full !px-3 !py-1.5 !text-xs disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <UserCheck size={14} />
                    Passed
                  </button>

                  <button
                    type="button"
                    onClick={() => onStatusChange(application.id, "applied")}
                    disabled={updatingId === application.id || deletingId === application.id || status === "applied"}
                    className="btn btn-secondary !rounded-full !px-3 !py-1.5 !text-xs disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CheckCircle2 size={14} />
                    Applied
                  </button>

                  <button
                    type="button"
                    onClick={() => onRemove(application.id)}
                    disabled={deletingId === application.id || updatingId === application.id}
                    className="btn !rounded-full !px-3 !py-1.5 !text-xs border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60"
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

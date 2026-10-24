import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getJobById } from "../api/api";
import { toast } from "sonner";
import Skeleton from "react-loading-skeleton";
import { ArrowLeft, BriefcaseBusiness, Send } from "lucide-react";

export default function JobDetails() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getJobById(id)
      .then(setJob)
      .catch((e) => {
        const message = e.message || "Failed to load job";
        setError(message);
        toast.error(message);
      });
  }, [id]);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <p className="text-sm font-semibold text-red-800">Error</p>
        <p className="mt-1 text-sm text-red-700">{error}</p>
        <Link to="/jobs" className="mt-4 inline-block text-sm font-semibold text-slate-900 underline">
          Back to Jobs
        </Link>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-4">
        <div>
          <Skeleton width={120} height={16} />
        </div>
        <section className="glass-card rounded-3xl p-7 sm:p-8">
          <Skeleton width={88} height={24} borderRadius={9999} />
          <div className="mt-4">
            <Skeleton width="65%" height={40} />
          </div>
          <div className="mt-3 space-y-2">
            <Skeleton count={4} height={16} />
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Skeleton width={132} height={40} borderRadius={9999} />
            <Skeleton width={128} height={40} borderRadius={9999} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link to="/jobs" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900">
        <ArrowLeft size={16} />
        Back to Jobs
      </Link>

      <section className="glass-card rounded-3xl p-7 sm:p-8">
        <span className="badge">Open Role</span>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{job.title}</h2>
        <p className="mt-3 text-slate-700">{job.description || "No description provided."}</p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link to={`/apply/${job.id}`} className="btn btn-primary">
            <Send size={16} />
            Apply Now
          </Link>
          <Link to="/jobs" className="btn btn-secondary">
            <BriefcaseBusiness size={16} />
            Browse Jobs
          </Link>
        </div>
      </section>
    </div>
  );
}

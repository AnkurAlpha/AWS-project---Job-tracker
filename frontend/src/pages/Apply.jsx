import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { applyForJob } from "../api/api";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";

const Apply = () => {
  const { id } = useParams();
  const [form, setForm] = useState({ name: "", email: "", resume: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const canSubmit = form.name.trim() && form.email.trim() && form.resume.trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const request = applyForJob({ ...form, jobId: id });
      await toast.promise(request, {
        loading: "Submitting application...",
        success: "Applied successfully",
        error: (err) => err?.message || "Failed to submit application",
      });
      setDone(true);
    } catch (e) {
      const message = e.message || "Failed to submit application";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to={`/jobs/${id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900">
        <ArrowLeft size={16} />
        Back to Job
      </Link>

      <section className="glass-card rounded-3xl p-7 sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Apply for this role</h1>
        <p className="mt-2 text-sm text-slate-600">Share your details to submit an application.</p>

        {done ? (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-800">Application submitted.</p>
            <p className="mt-1 text-sm text-emerald-700">You can return to jobs and apply for another role.</p>
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-800">Error</p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Name</label>
            <input className="field" name="name" placeholder="Your name" onChange={handleChange} value={form.name} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Email</label>
            <input className="field" name="email" placeholder="you@email.com" onChange={handleChange} value={form.email} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Resume or notes</label>
            <textarea
              className="field"
              name="resume"
              placeholder="Write a short note or paste your resume text"
              rows={6}
              onChange={handleChange}
              value={form.resume}
            />
          </div>

          <button type="submit" disabled={!canSubmit || submitting} className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">
            <Send size={16} />
            {submitting ? "Submitting..." : "Submit Application"}
          </button>
        </form>
      </section>
    </div>
  );
};

export default Apply;

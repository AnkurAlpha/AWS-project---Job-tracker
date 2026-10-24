import { useState } from "react";
import { createJob } from "../api/api";
import { useAuth } from "../auth/AuthContext";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";

export default function AdminCreateJob() {
  const { token } = useAuth();
  const [form, setForm] = useState({ title: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");

  const onChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setSubmitting(true);

    try {
      const request = createJob({ ...form, token });
      const created = await toast.promise(request, {
        loading: "Creating job...",
        success: "Job created",
        error: (err) => err?.message || "Failed to create job",
      });
      setSuccessMessage(`Job created: ${created.title}`);
      setForm({ title: "", description: "" });
    } catch (err) {
      setError(err.message || "Failed to create job");
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitDisabled = !form.title.trim() || !form.description.trim() || submitting;

  return (
    <>
      <section className="mx-auto max-w-2xl glass-card rounded-3xl p-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Create Job</h1>
        <p className="mt-2 text-sm text-slate-600">Admin form to publish a new role.</p>

        {successMessage ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{successMessage}</div> : null}

        {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        <form id="create-job-form" onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Job Title</label>
            <input name="title" value={form.title} onChange={onChange} placeholder="Frontend Intern" className="field" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={onChange}
              rows={5}
              placeholder="React, APIs, UI ownership..."
              className="field"
            />
          </div>
        </form>
      </section>

      <div className="mx-auto mt-4 max-w-2xl">
        <button type="submit" form="create-job-form" disabled={isSubmitDisabled} className="btn btn-primary admin-create-submit-btn w-full">
          <PlusCircle size={16} />
          {submitting ? "Creating..." : "Create Job"}
        </button>
      </div>
    </>
  );
}

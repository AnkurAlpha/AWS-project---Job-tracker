import { Link } from "react-router-dom";
import { BriefcaseBusiness, LayoutDashboard } from "lucide-react";

export default function Home() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="relative z-20 glass-card rounded-3xl p-8 sm:p-10">
        <span className="badge">Hiring Workflow</span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Keep every application visible, tidy, and actionable.
        </h1>
        <p className="mt-4 max-w-2xl text-slate-700">
          Manage open roles, track candidate submissions, and move faster with a single dashboard for your hiring pipeline.
        </p>

        <div className="hero-actions relative z-30 mt-8 flex flex-wrap gap-3">
          <Link to="/dashboard" className="btn btn-primary hero-cta hero-cta-primary relative z-40">
            <LayoutDashboard size={16} />
            Open Dashboard
          </Link>
          <Link to="/jobs" className="btn btn-secondary hero-cta hero-cta-secondary relative z-40">
            <BriefcaseBusiness size={16} />
            Explore Jobs
          </Link>
        </div>
      </section>

      <section className="soft-panel rounded-3xl p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Highlights</p>
        <div className="mt-5 space-y-4">
          <article className="rounded-2xl bg-white/85 p-4">
            <p className="text-sm font-semibold text-slate-900">Clear role tracking</p>
            <p className="mt-1 text-sm text-slate-600">Monitor all open listings from one place.</p>
          </article>
          <article className="rounded-2xl bg-white/85 p-4">
            <p className="text-sm font-semibold text-slate-900">Fast applicant capture</p>
            <p className="mt-1 text-sm text-slate-600">Submit applications with structured candidate data.</p>
          </article>
          <article className="rounded-2xl bg-white/85 p-4">
            <p className="text-sm font-semibold text-slate-900">Admin controls</p>
            <p className="mt-1 text-sm text-slate-600">Create and publish new opportunities in seconds.</p>
          </article>
        </div>
      </section>
    </div>
  );
}

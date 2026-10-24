import { Link } from "react-router-dom";
import { BriefcaseBusiness, House } from "lucide-react";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-2xl glass-card rounded-3xl p-10 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">404</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">Page not found</h1>
      <p className="mt-2 text-sm text-slate-600">The page you requested does not exist or may have moved.</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn btn-primary">
          <House size={16} />
          Go Home
        </Link>
        <Link to="/jobs" className="btn btn-secondary">
          <BriefcaseBusiness size={16} />
          Browse Jobs
        </Link>
      </div>
    </section>
  );
}

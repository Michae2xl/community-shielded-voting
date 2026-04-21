import Link from "next/link";
import { AppNav } from "@/components/app-nav";

export function AdminNav() {
  return (
    <div className="admin-nav-stack">
      <AppNav />
      <nav className="admin-nav hero-card">
        <div className="admin-nav-copy">
          <p className="eyebrow">Admin workspace</p>
          <strong className="admin-nav-title">Operate polls in clear sequence</strong>
        </div>
        <div className="admin-nav-links">
          <Link href="/admin/polls" className="meta-chip">
            Poll directory
          </Link>
        </div>
      </nav>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Overview", match: (pathname: string) => pathname === "/" },
  {
    href: "/admin/polls",
    label: "Admin",
    match: (pathname: string) => pathname.startsWith("/admin")
  },
  {
    href: "/polls",
    label: "Polls",
    match: (pathname: string) => pathname.startsWith("/polls")
  }
];

type AppNavProps = {
  showOverview?: boolean;
  showAdmin?: boolean;
  showPolls?: boolean;
};

export function AppNav({
  showOverview = true,
  showAdmin = true,
  showPolls = true
}: AppNavProps) {
  const pathname = usePathname() ?? "";
  const navItems = NAV_ITEMS.filter((item) => {
    if (item.href === "/" && !showOverview) {
      return false;
    }

    if (item.href === "/admin/polls" && !showAdmin) {
      return false;
    }

    if (item.href === "/polls" && !showPolls) {
      return false;
    }

    return true;
  });

  return (
    <nav className="app-nav hero-card">
      <Link href="/" className="app-nav-brand">
        <span className="eyebrow">Shielded voting</span>
        <strong>Community shielded voting</strong>
      </Link>
      <div className="app-nav-links" aria-label="Primary">
        {navItems.map((item) => {
          const isActive = item.match(pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? "app-nav-link app-nav-link--active" : "app-nav-link"}
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

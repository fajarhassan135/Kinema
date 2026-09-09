"use client";
import Link from "next/link";
import { Home, LayoutGrid, Bookmark, Star, User, Film } from "lucide-react";

type Page = "home" | "genres" | "watchlist" | "reviews" | "profile" | "landing";

const NAV_ITEMS: { page: Page; href: string; icon: React.ElementType; label: string }[] = [
  { page: "landing", href: "/", icon: Film, label: "Homepage" },
  { page: "home", href: "/dashboard", icon: Home, label: "Home" },
  { page: "genres", href: "/genres/action", icon: LayoutGrid, label: "Genres" },
  { page: "watchlist", href: "/watchlist", icon: Bookmark, label: "Watchlist" },
  { page: "reviews", href: "/reviews", icon: Star, label: "Reviews" },
  { page: "profile", href: "/profile", icon: User, label: "Profile" },
];

/**
 * Icon-only navigation was unlabelled apart from a `title` tooltip, which
 * phones never show — so on touch the icons were unidentifiable. The label now
 * renders under each icon on small screens and the current page is marked with
 * aria-current instead of colour alone.
 */
export default function NavBar({ current }: { current: Page }) {
  return (
    <nav className="nav-rail" aria-label="Main">
      {NAV_ITEMS.map(({ page, href, icon: Icon, label }) => {
        const isActive = current === page;
        return (
          <Link
            key={page}
            href={href}
            className={`nav-item${isActive ? " is-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon size={20} fill={isActive ? "currentColor" : "none"} aria-hidden="true" />
            <span className="nav-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

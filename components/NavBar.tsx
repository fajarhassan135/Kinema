"use client";
import { useState } from "react";
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

export default function NavBar({ current }: { current: Page }) {
  const [hovered, setHovered] = useState<Page | null>(null);

  return (
    <nav style={{ display: "flex", gap: 28, alignItems: "center" }}>
      {NAV_ITEMS.map(({ page, href, icon: Icon, label }) => {
        const isActive = current === page || hovered === page;
        const isHovered = hovered === page;
        return (
          <Link
            key={page}
            href={href}
            title={label}
            onMouseEnter={() => setHovered(page)}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: "flex",
              alignItems: "center",
              color: current === page ? "#ffffff" : "#ccc",
              textDecoration: "none",
              transform: isHovered ? "scale(1.25)" : "scale(1)",
              transition: "transform 0.15s ease, color 0.15s ease",
            }}
          >
            <Icon
              size={20}
              fill={isActive ? "currentColor" : "none"}
              style={{ transition: "fill 0.15s ease" }}
            />
          </Link>
        );
      })}
    </nav>
  );
}
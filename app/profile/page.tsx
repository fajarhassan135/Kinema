"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import MovieModal from "../../components/MovieModal";
import NavBar from "../../components/NavBar";

type FavoriteRow = { movie_id: number; movie_title: string; poster_path: string | null };
type Movie = { id: number; title: string; poster_path: string | null; overview?: string; release_date?: string };

export default function ProfilePage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingName, setSavingName] = useState(false);

  const [watchlistCount, setWatchlistCount] = useState(0);
  const [reviewsCount, setReviewsCount] = useState(0);
  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session) {
        router.push("/login");
        return;
      }
      setUserId(session.user.id);
      setEmail(session.user.email ?? "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profile) {
        setDisplayName(profile.display_name || "");
        setNameInput(profile.display_name || "");
        setAvatarUrl(profile.avatar_url ? `${profile.avatar_url}?t=${Date.now()}` : null);
      }

      const [wl, rv, favs] = await Promise.all([
        supabase.from("watchlist").select("id", { count: "exact", head: true }).eq("user_id", session.user.id),
        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", session.user.id),
        supabase.from("favorites").select("movie_id, movie_title, poster_path").eq("user_id", session.user.id),
      ]);

      setWatchlistCount(wl.count || 0);
      setReviewsCount(rv.count || 0);
      setFavorites(favs.data || []);
      setCheckingAuth(false);
    });
  }, [router]);

  async function handleSaveName() {
    if (!userId || !nameInput.trim()) return;
    setSavingName(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: nameInput.trim() })
      .eq("id", userId);
    setSavingName(false);
    if (!error) setDisplayName(nameInput.trim());
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setUploading(true);
    const filePath = `${userId}/avatar.${file.name.split(".").pop()}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      setUploading(false);
      alert("Upload failed: " + uploadError.message);
      e.target.value = "";
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const freshUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("id", userId);
    setAvatarUrl(freshUrl);
    setUploading(false);
    e.target.value = "";
  }

  async function handleChangePassword() {
    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg("Password must be at least 6 characters.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordMsg(error.message);
    } else {
      setPasswordMsg("Password updated.");
      setNewPassword("");
    }
  }

  async function handleDeleteAccount() {
    if (!userId) return;
    setDeleting(true);
    const res = await fetch("/api/delete-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setDeleting(false);
    if (res.ok) {
      await supabase.auth.signOut();
      router.push("/login");
    } else {
      const data = await res.json();
      alert("Failed to delete account: " + data.error);
    }
  }

  async function handleRemoveFavorite(movieId: number) {
    if (!userId) return;
    await supabase.from("favorites").delete().eq("user_id", userId).eq("movie_id", movieId);
    setFavorites((prev) => prev.filter((f) => f.movie_id !== movieId));
  }

  async function handleOpenMovie(movieId: number, fallbackTitle: string, fallbackPoster: string | null) {
    const res = await fetch(`/api/movies?type=by_id&id=${movieId}`);
    const data = await res.json();
    setSelectedMovie(data.movie || { id: movieId, title: fallbackTitle, poster_path: fallbackPoster });
  }

  if (checkingAuth) {
    return (
      <div style={{ minHeight: "100vh", background: "#000", color: "#888", display: "flex", alignItems: "center", justifyContent: "center" }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "'Montserrat', Arial, sans-serif" }}>

      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 40px", borderBottom: "1px solid #1c1c1c", flexWrap: "wrap", gap: 16 }}>
      <img src="/logo.png" alt="Kinema logo" style={{ width: 130, height: 130, borderRadius: "50%" }} />

        <NavBar current="profile" />
      </header>

      <main style={{ padding: "40px", maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.8rem", marginBottom: 32 }}>Profile</h1>

        <div style={{ display: "flex", gap: 24, alignItems: "center", marginBottom: 40 }}>
          <div
            onClick={() => avatarUrl && setShowAvatarPreview(true)}
            style={{
              width: 100, height: 100, borderRadius: "50%", overflow: "hidden",
              background: "#181818", flexShrink: 0,
              cursor: avatarUrl ? "pointer" : "default",
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontSize: "0.75rem" }}>
                No photo
              </div>
            )}
          </div>
          <div>
            <label style={{ display: "inline-block", padding: "8px 16px", background: "#181818", border: "1px solid #333", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" }}>
              {uploading ? "Uploading…" : "Change Photo"}
              <input type="file" accept="image/*" onChange={handleAvatarChange} disabled={uploading} style={{ display: "none" }} />
            </label>
          </div>
        </div>

        <div style={{ marginBottom: 32 }}>
          <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: 6 }}>Email</p>
          <p style={{ marginBottom: 20 }}>{email}</p>

          <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: 6 }}>Display Name</p>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              style={{ flex: 1, padding: "10px 14px", borderRadius: 6, border: "1px solid #333", background: "#111", color: "#fff" }}
            />
            <button onClick={handleSaveName} disabled={savingName} style={{ padding: "10px 20px", borderRadius: 6, border: "none", background: "#6b0016", color: "#fff", cursor: "pointer" }}>
              {savingName ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 40, marginBottom: 40, padding: "16px 0", borderTop: "1px solid #1c1c1c", borderBottom: "1px solid #1c1c1c" }}>
          <div>
            <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>{watchlistCount}</p>
            <p style={{ color: "#888", fontSize: "0.8rem" }}>Watchlist</p>
          </div>
          <div>
            <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>{reviewsCount}</p>
            <p style={{ color: "#888", fontSize: "0.8rem" }}>Reviews</p>
          </div>
        </div>

        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: "1.2rem", marginBottom: 16 }}>Favorites ({favorites.length}/5)</h2>
          {favorites.length === 0 ? (
            <p style={{ color: "#666" }}>No favorites yet.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 18 }}>
              {favorites.map((fav) => (
                <div key={fav.movie_id}>
                  <div onClick={() => handleOpenMovie(fav.movie_id, fav.movie_title, fav.poster_path)} style={{ cursor: "pointer" }}>
                    {fav.poster_path ? (
                      <img src={`https://image.tmdb.org/t/p/w500${fav.poster_path}`} alt={fav.movie_title}
                        style={{ width: "100%", height: 200, objectFit: "cover", borderRadius: 6 }} />
                    ) : (
                      <div style={{ width: "100%", height: 200, background: "#181818", borderRadius: 6 }} />
                    )}
                    <p style={{ marginTop: 6, fontSize: "0.8rem", color: "#ccc" }}>{fav.movie_title}</p>
                  </div>
                  <button onClick={() => handleRemoveFavorite(fav.movie_id)}
                    style={{ marginTop: 4, width: "100%", padding: "4px 0", fontSize: "0.7rem", background: "none", border: "1px solid #333", color: "#999", borderRadius: 4, cursor: "pointer" }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 32, paddingTop: 20, borderTop: "1px solid #1c1c1c" }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>Change Password</h2>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ flex: 1, padding: "10px 14px", borderRadius: 6, border: "1px solid #333", background: "#111", color: "#fff" }}
            />
            <button onClick={handleChangePassword} style={{ padding: "10px 20px", borderRadius: 6, border: "none", background: "#6b0016", color: "#fff", cursor: "pointer" }}>
              Update
            </button>
          </div>
          {passwordMsg && <p style={{ color: "#e0bfc7", fontSize: "0.85rem", marginTop: 8 }}>{passwordMsg}</p>}
        </div>

        <div style={{ paddingTop: 20, borderTop: "1px solid #1c1c1c" }}>
          {!showDeleteConfirm ? (
            <button onClick={() => setShowDeleteConfirm(true)}
              style={{ padding: "10px 20px", borderRadius: 6, border: "1px solid #6b0016", background: "none", color: "#e07b7b", cursor: "pointer", fontSize: "0.85rem" }}>
              Delete Account
            </button>
          ) : (
            <div style={{ background: "#181818", border: "1px solid #6b0016", borderRadius: 8, padding: 16 }}>
              <p style={{ marginBottom: 12, fontSize: "0.9rem" }}>This is permanent and cannot be undone. Are you sure?</p>
              <button onClick={handleDeleteAccount} disabled={deleting}
                style={{ marginRight: 10, padding: "8px 16px", borderRadius: 6, border: "none", background: "#6b0016", color: "#fff", cursor: "pointer" }}>
                {deleting ? "Deleting…" : "Yes, delete my account"}
              </button>
              <button onClick={() => setShowDeleteConfirm(false)}
                style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #333", background: "none", color: "#ccc", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </main>

      {showAvatarPreview && avatarUrl && (
        <div
          onClick={() => setShowAvatarPreview(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 60, padding: 24,
          }}
        >
          <img
            src={avatarUrl}
            alt="Profile preview"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 320, height: 320, objectFit: "cover",
              borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            }}
          />
        </div>
      )}

      {selectedMovie && <MovieModal movie={selectedMovie} onClose={() => setSelectedMovie(null)} />}
    </div>
  );
}
"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  CircleDollarSign,
  CircleHelp,
  Command,
  FileText,
  FlaskConical,
  Gauge,
  Globe2,
  ImageIcon,
  Layers3,
  Lightbulb,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Wallet,
  Workflow,
  X,
} from "lucide-react";
import { api, post, setCsrf } from "@/lib/api";
import { Integrations } from "@/lib/types";
import { Field, Notice } from "./ui";
import {
  Overview,
  Articles,
  Planner,
  Generator,
  Calendar,
  Automation,
  Connections,
  Finance,
  Traffic,
  Jobs,
  MediaLibrary,
  Help,
  Preferences,
} from "./views";
import Editor from "./editor";
const navigation = [
  {
    label: "Workspace",
    items: [
      { path: "/", name: "Overview", icon: Gauge },
      { path: "/articles", name: "Articles", icon: FileText },
      { path: "/planner", name: "Topic planner", icon: Lightbulb },
      { path: "/generator", name: "AI generator", icon: Sparkles },
      { path: "/media", name: "Media library", icon: ImageIcon },
    ],
  },
  {
    label: "Publishing",
    items: [
      { path: "/calendar", name: "Publishing calendar", icon: CalendarDays },
      { path: "/automation", name: "Automation", icon: Workflow },
      { path: "/connections", name: "Blog connections", icon: Globe2 },
    ],
  },
  {
    label: "Insights",
    items: [
      { path: "/monetization", name: "Monetization", icon: CircleDollarSign },
      { path: "/analytics", name: "Traffic & SEO", icon: Activity },
      { path: "/expenses", name: "Expenses & profit", icon: Wallet },
      { path: "/jobs", name: "Job history", icon: Layers3 },
    ],
  },
];
const titles: Record<string, string> = {
  "/": "Overview",
  "/articles": "Articles",
  "/planner": "Topic planner",
  "/generator": "AI generator",
  "/media": "Media library",
  "/calendar": "Publishing calendar",
  "/automation": "Automation",
  "/connections": "Blog connections",
  "/monetization": "Monetization",
  "/analytics": "Traffic & SEO",
  "/expenses": "Expenses & profitability",
  "/jobs": "Job history",
  "/settings": "Settings",
  "/help": "Help & documentation",
  "/integrations": "Integration setup",
};
export type Notify = (message: string, error?: boolean) => void;
export default function Studio() {
  const path = usePathname();
  const [auth, setAuth] = useState<{ email: string } | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [email, setEmail] = useState("kashmitha@localhost"),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState<{ text: string; error: boolean } | null>(null),
    [dark, setDark] = useState(false),
    [mobile, setMobile] = useState(false),
    [integrations, setIntegrations] = useState<Integrations | null>(null);
  const notify: Notify = useCallback((text, error = false) => {
    setToast({ text, error });
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const theme = localStorage.getItem("autoblog-theme") === "dark";
    setDark(theme);
    document.documentElement.dataset.theme = theme ? "dark" : "light";
    api<{ email: string; csrfToken: string }>("/auth/session")
      .then((s) => {
        setCsrf(s.csrfToken);
        setAuth(s);
      })
      .catch(() => setAuth(null))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (auth)
      api<Integrations>("/integrations")
        .then(setIntegrations)
        .catch((e) => notify(e.message, true));
  }, [auth, notify, path]);
  useEffect(() => {
    if (!auth) return;
    const refresh = () => {
      void api<Integrations>("/integrations")
        .then(setIntegrations)
        .catch((e) => notify(e.message, true));
    };
    window.addEventListener("reporting-config-changed", refresh);
    return () =>
      window.removeEventListener("reporting-config-changed", refresh);
  }, [auth, notify]);
  useEffect(() => {
    if (!auth) return;
    void post<{ results: { error?: string }[] }>("/blogger/sync")
      .then((result) => {
        if (result.results.some((r) => r.error))
          notify(
            "Some Blogger statuses could not be refreshed. Open the article for details.",
            true,
          );
      })
      .catch(() =>
        notify(
          "Blogger status could not be refreshed. Last saved statuses are shown.",
          true,
        ),
      )
      .finally(() => window.dispatchEvent(new Event("blogger-status-synced")));
  }, [auth, notify]);
  useEffect(() => {
    if (!auth) return;
    let checking = false,
      cancelled = false;
    const refresh = () => {
      if (document.visibilityState !== "visible" || checking || cancelled)
        return;
      checking = true;
      const indexing = post<{ results: { error?: string }[] }>(
        "/seo/indexing/refresh-due",
      )
        .then((result) => {
          if (cancelled) return;
          window.dispatchEvent(new Event("indexing-status-synced"));
          if (result.results.some((r) => r.error))
            notify(
              "Some daily indexing checks could not complete. Saved results remain available in Traffic & SEO.",
              true,
            );
        })
        .catch(() => {
          if (!cancelled)
            notify(
              "Daily indexing checks could not complete. Saved results remain available in Traffic & SEO.",
              true,
            );
        });
      const traffic = post<{
        sync: { state: string } | null;
        skipped: boolean;
      }>("/reports/search-console/refresh-due")
        .then((result) => {
          if (cancelled) return;
          window.dispatchEvent(new Event("traffic-records-changed"));
          if (result.sync?.state === "FAILED" && !result.skipped)
            notify(
              "The daily search traffic import failed. Saved reports remain available; see Traffic & SEO for details.",
              true,
            );
        })
        .catch(() => {
          if (!cancelled)
            notify(
              "The daily search traffic import could not complete. See Traffic & SEO for details.",
              true,
            );
        });
      void Promise.allSettled([indexing, traffic]).finally(() => {
        checking = false;
      });
    };
    // Run after Blogger status sync so a newly LIVE post becomes eligible.
    window.addEventListener("blogger-status-synced", refresh);
    window.addEventListener("reporting-config-changed", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 30 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("blogger-status-synced", refresh);
      window.removeEventListener("reporting-config-changed", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [auth, notify]);
  useEffect(() => {
    setMobile(false);
  }, [path]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const s = await post<{ email: string; csrfToken: string }>(
        "/auth/login",
        { email, password },
      );
      setCsrf(s.csrfToken);
      setAuth(s);
      setPassword("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    localStorage.setItem("autoblog-theme", next ? "dark" : "light");
  }
  if (loading)
    return (
      <div className="loading-screen">
        <div className="brand-symbol">
          <Command size={25} />
        </div>
        <p>Opening AutoBlog Studio…</p>
      </div>
    );
  if (!auth)
    return (
      <main className="login-page">
        <section className="login-story">
          <div className="brand">
            <div className="brand-symbol">
              <Command size={25} />
            </div>
            AutoBlog<span>Studio</span>
          </div>
          <span className="eyebrow">YOUR IDEAS. A CONSISTENT VOICE.</span>
          <h1>
            Good articles.
            <br />
            Thoughtfully
            <br />
            <em>published.</em>
          </h1>
          <p>
            A calm workspace for your entire blogging workflow, from the first
            idea to the next reader.
          </p>
          <div className="login-principles">
            <span>
              <ShieldCheck size={18} /> Human approval first
            </span>
            <span>
              <BookOpen size={18} /> Research over filler
            </span>
          </div>
        </section>
        <section className="login-form">
          <div className="login-card">
            <div className="brand-symbol small-brand">
              <Command size={22} />
            </div>
            <h2>Welcome to your studio</h2>
            <p className="subtle">Sign in to plan, create, and publish.</p>
            <form onSubmit={login}>
              <Field label="Email address">
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Password">
                <input
                  type="password"
                  autoComplete="current-password"
                  minLength={12}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              {error && <Notice tone="warning">{error}</Notice>}
              <button className="primary wide" disabled={busy}>
                {busy ? "Signing in…" : "Open workspace"}
                <ArrowRight size={17} />
              </button>
            </form>
            <p className="login-help">
              First time here? Your local <code>.env</code> contains OWNER_EMAIL
              and OWNER_PASSWORD. Keep them private.
            </p>
          </div>
          <p className="muted small">LOCAL WORKSPACE · ASIA / COLOMBO</p>
        </section>
      </main>
    );
  const title = path.startsWith("/articles/")
    ? "Article editor"
    : titles[path] || "Workspace";
  const isEditor = path.startsWith("/articles/");
  const props = { notify, integrations };
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {mobile && (
        <div className="sidebar-overlay" onClick={() => setMobile(false)} />
      )}
      <aside className={"sidebar " + (mobile ? "mobile-open" : "")}>
        <Link href="/" className="brand">
          <div className="brand-symbol">
            <Command size={23} />
          </div>
          <div>
            AutoBlog<span>Studio</span>
          </div>
        </Link>
        <div className="workspace-select">
          <div className="workspace-avatar">K</div>
          <div>
            <strong>Kashmitha’s workspace</strong>
            <span>Personal workspace</span>
          </div>
          <ChevronDown size={14} />
        </div>
        <nav aria-label="Main navigation">
          {navigation.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-caption">{group.label}</div>
              {group.items.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  className={
                    "nav-item " +
                    ((
                      item.path === "/"
                        ? path === "/"
                        : path.startsWith(item.path)
                    )
                      ? "active"
                      : "")
                  }
                >
                  <item.icon size={18} />
                  {item.name}
                  {item.path === "/generator" && (
                    <span className="nav-ai">AI</span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="editorial-note">
            <ShieldCheck size={18} />
            <strong>Publishing controls</strong>
            <p>Review sources, approve changes and choose when to publish.</p>
          </div>
          <Link
            href="/settings"
            className={"nav-item " + (path === "/settings" ? "active" : "")}
          >
            <Settings2 size={18} />
            Settings
          </Link>
          <Link href="/help" className="nav-item">
            <CircleHelp size={18} />
            Help & documentation
          </Link>
          <div className="owner">
            <div className="owner-avatar">KM</div>
            <div>
              <strong>Kashmitha Madushan</strong>
              <span>Workspace owner</span>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={async () => {
                try {
                  await post("/auth/logout");
                  setAuth(null);
                  setCsrf("");
                } catch (e) {
                  notify((e as Error).message, true);
                }
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <span className="breadcrumb-separator">/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <span
              className={
                "environment-pill " +
                (integrations?.bloggerMode === "live" ? "live" : "")
              }
            >
              <span />
              {integrations?.bloggerMode === "live"
                ? "Live integration"
                : "Local · Mock publishing"}
            </span>
            <button
              className="icon-button"
              aria-label={
                dark ? "Switch to light theme" : "Switch to dark theme"
              }
              onClick={toggleTheme}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link
              className="icon-button help-top"
              aria-label="Setup help"
              href="/integrations"
            >
              <CircleHelp size={19} />
            </Link>
            <div className="topbar-avatar">KM</div>
          </div>
        </header>
        <main
          id="main"
          className={"content " + (isEditor ? "editor-content" : "")}
        >
          {path === "/" ? (
            <Overview {...props} />
          ) : path === "/articles" ? (
            <Articles {...props} />
          ) : isEditor ? (
            <Editor id={path.split("/")[2]} {...props} />
          ) : path === "/planner" ? (
            <Planner {...props} />
          ) : path === "/generator" ? (
            <Generator {...props} />
          ) : path === "/media" ? (
            <MediaLibrary {...props} />
          ) : path === "/calendar" ? (
            <Calendar {...props} />
          ) : path === "/automation" ? (
            <Automation {...props} />
          ) : path === "/connections" || path === "/integrations" ? (
            <Connections {...props} />
          ) : path === "/monetization" ? (
            <Finance {...props} expenses={false} />
          ) : path === "/expenses" ? (
            <Finance {...props} expenses />
          ) : path === "/analytics" ? (
            <Traffic {...props} />
          ) : path === "/jobs" ? (
            <Jobs {...props} />
          ) : path === "/settings" ? (
            <Preferences {...props} />
          ) : (
            <Help />
          )}
          <footer className="page-footer">
            <span>
              AutoBlog Studio <span className="footer-dot">·</span> Built for
              useful content.
            </span>
            <span>
              Asia/Colombo <span className="footer-dot">·</span> All financial
              amounts in USD
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div role="status" className={"toast " + (toast.error ? "error" : "")}>
          <CheckCheck size={19} />
          {toast.text}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

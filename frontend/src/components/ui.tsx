"use client";
import { X, CheckCircle2, AlertCircle, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Status } from "@/lib/types";
import { useEffect, useRef } from "react";
export function Badge({ value }: { value: string }) {
  return (
    <span className={"badge badge-" + value.toLowerCase()}>
      <span />
      {value.replaceAll("_", " ").toLowerCase()}
    </span>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-glyph">↗</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Notice({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "warning" | "success";
}) {
  return (
    <div className={"notice " + tone}>
      {tone === "success" ? (
        <CheckCircle2 size={17} />
      ) : (
        <AlertCircle size={17} />
      )}
      <div>{children}</div>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    const selector =
      'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]';
    (element?.querySelector(selector) as HTMLElement | null)?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !element) return;
      const focusable = [
        ...element.querySelectorAll<HTMLElement>(selector),
      ].filter((e) => e.offsetParent !== null);
      const first = focusable[0],
        last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      before?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <div className="panel-heading">
          <h2>{title}</h2>
          <button
            autoFocus
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function ArticleRows({
  articles,
}: {
  articles: {
    id: string;
    title: string;
    niche: string;
    status: Status;
    updatedAt: string;
  }[];
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Article</th>
            <th>Status</th>
            <th>Updated</th>
            <th>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {articles.map((a) => (
            <tr key={a.id}>
              <td>
                <Link href={"/articles/" + a.id} className="article-title">
                  {a.title}
                </Link>
                <div className="subtle small">{a.niche}</div>
              </td>
              <td>
                <Badge value={a.status} />
              </td>
              <td className="subtle nowrap">
                {new Date(a.updatedAt).toLocaleDateString("en-GB", {
                  timeZone: "Asia/Colombo",
                  day: "numeric",
                  month: "short",
                })}
              </td>
              <td>
                <Link aria-label={"Open " + a.title} href={"/articles/" + a.id}>
                  <ArrowUpRight size={17} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

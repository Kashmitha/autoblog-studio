"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Code2,
  ExternalLink,
  Eye,
  Link2,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { api, post, formatDate } from "@/lib/api";
import { Article, Media, Report } from "@/lib/types";
import { useAction, useResource } from "./hooks";
import { Badge, Empty, Field, Modal, Notice } from "./ui";
import { ResourceState, niches, ViewProps } from "./views";
import { ArticleIndexing } from "./indexing";
import { InternalLinks } from "./internal-links";
export default function Editor({
  id,
  notify,
  integrations,
}: ViewProps & { id: string }) {
  const r = useResource<Article>("/articles/" + id),
    library = useResource<Media[]>("/media"),
    a = useAction(notify);
  const [draft, setDraft] = useState<Partial<Article>>({}),
    [preview, setPreview] = useState(false),
    [reason, setReason] = useState(""),
    [approve, setApprove] = useState(false),
    [schedule, setSchedule] = useState(false),
    [at, setAt] = useState(""),
    [firstTest, setFirstTest] = useState(false),
    [scheduleWhere, setScheduleWhere] = useState("blogger"),
    [linkOpen, setLinkOpen] = useState(false),
    [matchingPosts, setMatchingPosts] = useState<
      { id: string; title: string; status: string; published?: string }[]
    >([]),
    [remoteId, setRemoteId] = useState(""),
    [reconcileConfirm, setReconcileConfirm] = useState(""),
    [reminder, setReminder] = useState(""),
    [source, setSource] = useState({ title: "", url: "", note: "" });
  const article = r.data,
    doc = article ? { ...article, ...draft } : null;
  const locked =
    !!article &&
    (article.publishingTarget === "blogger" ||
      ["SCHEDULED", "PUBLISHING", "PUBLISHED"].includes(article.status));
  const dirty = Object.keys(draft).length > 0;
  const report = article?.reports?.[0];
  const canCloud =
    integrations?.bloggerMode === "live" &&
    !!integrations.google?.liveTestSucceededAt;
  const cloudSchedule = canCloud && scheduleWhere === "blogger";
  const update = (patch: Partial<Article>) => setDraft({ ...draft, ...patch });
  const refresh = async () => {
    setDraft({});
    await r.reload();
  };
  async function save() {
    if (!doc || !article) return;
    await api("/articles/" + id, {
      method: "PATCH",
      body: JSON.stringify({
        title: doc.title,
        niche: doc.niche,
        intent: doc.intent,
        excerpt: doc.excerpt,
        html: doc.html,
        labels: doc.labels,
        aiAssisted: doc.aiAssisted,
        disclosure: doc.disclosure,
        version: article.version,
        ...(doc.canonicalUrl ? { canonicalUrl: doc.canonicalUrl } : {}),
      }),
    });
    await refresh();
  }
  return (
    <>
      <Link href="/articles" className="back-link">
        <ArrowLeft size={15} />
        All articles
      </Link>
      <ResourceState {...r} />
      {doc && article && (
        <>
          {article.approvedAt &&
            article.generation?.editorialApproval?.kind ===
              "AUTOMATIC_POLICY" &&
            article.generation.editorialApproval.version ===
              article.version && (
              <Notice tone="warning">
                This article was approved under your standing automatic policy,
                not by an individual human editorial review. AI-detector
                outcomes and factual correctness are not certified by automated
                checks.
              </Notice>
            )}
          <div className="page-heading editor-heading">
            <div>
              <div className="inline">
                <Badge value={article.status} />
                <span className="subtle small">
                  Version {article.version} ·{" "}
                  {dirty
                    ? "Unsaved changes"
                    : "Saved " + formatDate(article.updatedAt, true)}
                </span>
              </div>
              <h1>{article.title}</h1>
            </div>
            <div className="page-actions">
              <button
                className="secondary"
                disabled={a.busy || locked || !dirty}
                onClick={() =>
                  a.run(save, "Draft saved. Approval reset for review.")
                }
              >
                <Save size={16} />
                Save draft
              </button>
              <button
                className="primary"
                disabled={
                  a.busy || dirty || locked || article.status === "APPROVED"
                }
                onClick={() => setApprove(true)}
              >
                <ShieldCheck size={16} />
                Review & approve
              </button>
              {article.status === "APPROVED" &&
                article.publishingTarget !== "blogger" && (
                  <button className="primary" onClick={() => setSchedule(true)}>
                    <CalendarDays size={16} />
                    Publish / schedule
                  </button>
                )}
              {article.status === "SCHEDULED" &&
                article.publishingTarget !== "blogger" && (
                  <button
                    className="secondary"
                    disabled={a.busy}
                    onClick={() =>
                      a.run(async () => {
                        await post("/articles/" + id + "/unschedule");
                        await refresh();
                      }, "Schedule canceled.")
                    }
                  >
                    Unschedule
                  </button>
                )}
            </div>
          </div>
          {article.publishingTarget === "blogger" && (
            <section className="panel padded spaced">
              <h2>Managed by Blogger</h2>
              <p>
                {article.remoteStatus === "SCHEDULED"
                  ? `Google has this post scheduled for ${formatDate(article.scheduledAt!, true)} · Asia/Colombo. Your computer can be off.`
                  : article.remoteStatus === "LIVE"
                    ? "Blogger confirmed this post is published."
                    : "The remote schedule needs confirmation. Sync before taking further action."}
              </p>
              <p className="subtle small">
                {article.remoteSyncedAt
                  ? `Last confirmed ${formatDate(article.remoteSyncedAt, true)}. `
                  : ""}
                Pausing Studio or using its emergency stop cannot cancel a
                schedule Google already accepted. Change or cancel it on
                Blogger, then sync. Blogger's copy is authoritative; syncing
                does not overwrite either article body.
              </p>
              {article.remoteSyncError && (
                <Notice tone="warning">{article.remoteSyncError}</Notice>
              )}
              <div className="inline wrap">
                <button
                  className="secondary"
                  disabled={a.busy}
                  onClick={() =>
                    a.run(async () => {
                      const result = await post<{
                        results: { error?: string }[];
                      }>("/blogger/articles/" + id + "/sync");
                      await refresh();
                      if (result.results.some((r) => r.error))
                        throw new Error(
                          "Could not confirm Blogger status. The last confirmed status is retained.",
                        );
                    }, "Blogger status refreshed.")
                  }
                >
                  Sync Blogger status
                </button>
                {article.remoteBlogId && article.remotePostId && (
                  <a
                    className="secondary"
                    href={`https://www.blogger.com/blog/post/edit/${article.remoteBlogId}/${article.remotePostId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Manage on Blogger <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </section>
          )}
          {integrations?.bloggerMode === "live" &&
            integrations.google?.liveTestSucceededAt &&
            ((article.status === "APPROVED" &&
              article.publishingTarget !== "blogger") ||
              (article.publishingTarget === "blogger" &&
                !article.remotePostId)) && (
              <div className="spaced">
                <button
                  className="secondary"
                  disabled={a.busy || dirty}
                  onClick={() =>
                    a.run(async () => {
                      const posts = await api<
                        {
                          id: string;
                          title: string;
                          status: string;
                          published?: string;
                        }[]
                      >("/integrations/google/posts");
                      setMatchingPosts(
                        posts.filter(
                          (p) =>
                            p.title.trim() === article.title.trim() &&
                            ["SCHEDULED", "LIVE"].includes(p.status),
                        ),
                      );
                      setRemoteId("");
                      setReconcileConfirm("");
                      setLinkOpen(true);
                    })
                  }
                >
                  Link a post already scheduled on Blogger
                </button>
              </div>
            )}
          {dirty && (
            <Notice>
              Save your changes before quality checks or approval. Saving
              invalidates previous approval.
            </Notice>
          )}
          {locked && article.publishingTarget !== "blogger" && (
            <Notice>
              {article.status === "PUBLISHED" ? (
                <>
                  Published article.{" "}
                  <a
                    href={article.publishedUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open on Blogger <ExternalLink size={14} />
                  </a>
                </>
              ) : (
                "This article is locked while scheduled or publishing. Unschedule to edit."
              )}
            </Notice>
          )}
          <div className="editor-grid">
            <div>
              <section className="panel padded">
                <Field label="Article title">
                  <input
                    disabled={locked}
                    value={doc.title}
                    maxLength={180}
                    onChange={(e) => update({ title: e.target.value })}
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Topic area">
                    <select
                      disabled={locked}
                      value={doc.niche}
                      onChange={(e) => update({ niche: e.target.value })}
                    >
                      {niches.map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label="Labels (comma-separated)"
                    hint="Sent to Blogger as post labels when published."
                  >
                    <input
                      disabled={locked}
                      value={doc.labels.join(", ")}
                      onChange={(e) =>
                        update({
                          labels: e.target.value
                            .split(",")
                            .map((v) => v.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </Field>
                </div>
                <Field label="Reader intent">
                  <input
                    disabled={locked}
                    value={doc.intent}
                    onChange={(e) => update({ intent: e.target.value })}
                    placeholder="What useful problem does this solve?"
                  />
                </Field>
                <Field
                  label="Descriptive excerpt"
                  hint={`${doc.excerpt.length}/500 characters · Studio summary; not synced to Blogger's search description.`}
                >
                  <textarea
                    disabled={locked}
                    maxLength={500}
                    value={doc.excerpt}
                    onChange={(e) => update({ excerpt: e.target.value })}
                    rows={2}
                  />
                </Field>
                <Field
                  label="Canonical URL reference (optional)"
                  hint="Workspace reference only. This does not set the Blogger permalink or canonical tag."
                >
                  <input
                    disabled={locked}
                    type="url"
                    value={doc.canonicalUrl || ""}
                    placeholder="https://your-blog.blogspot.com/..."
                    onChange={(e) => update({ canonicalUrl: e.target.value })}
                  />
                </Field>
                <Notice>
                  Blogger creates the public permalink. Studio does not
                  currently set custom permalinks, search descriptions or
                  per-post robots settings. Configure custom values in Blogger
                  in Blogger. Blogger-hosted schedules can be managed there
                  after Studio sends the approved article.
                </Notice>
              </section>
              <section className="panel spaced">
                <div className="panel-heading">
                  <h2>Article body</h2>
                  <div className="segmented">
                    <button
                      className={!preview ? "selected" : ""}
                      onClick={() => setPreview(false)}
                    >
                      <Code2 size={15} />
                      HTML
                    </button>
                    <button
                      className={preview ? "selected" : ""}
                      onClick={() => setPreview(true)}
                    >
                      <Eye size={15} />
                      Preview
                    </button>
                  </div>
                </div>
                {preview ? (
                  <iframe
                    title="Article preview"
                    sandbox=""
                    className="article-preview"
                    srcDoc={`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https:; style-src 'unsafe-inline';"><style>body{font:16px/1.8 system-ui;color:#26342e;max-width:720px;margin:32px auto;padding:0 24px}img{max-width:100%;height:auto}pre{background:#f1f4f2;padding:18px;overflow:auto}a{color:#267553}h2{line-height:1.3;margin-top:32px}figcaption{font-size:12px;color:#67766f}</style></head><body><h1>${doc.title.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</h1>${doc.html}${doc.media?.map(({ media: m }) => `<figure><img src="${m.url.replaceAll('"', "&quot;")}" alt="${m.alt.replaceAll('"', "&quot;")}"/><figcaption>${m.attribution.replaceAll("<", "&lt;")}</figcaption></figure>`).join("") || ""}${doc.aiAssisted && doc.disclosure ? "<p><em>Prepared with AI assistance.</em></p>" : ""}</body></html>`}
                  />
                ) : (
                  <textarea
                    className="html-editor"
                    aria-label="Article HTML"
                    spellCheck={false}
                    disabled={locked}
                    value={doc.html}
                    onChange={(e) => update({ html: e.target.value })}
                    placeholder={
                      "<h2>Start with the problem</h2>\n<p>Explain what the reader will learn…</p>\n\n<h2>A practical example</h2>\n<p>Use primary documentation and cite your sources.</p>"
                    }
                  />
                )}
                <div className="editor-body-footer">
                  <span>
                    {
                      doc.html
                        .replace(/<[^>]*>/g, " ")
                        .split(/\s+/)
                        .filter(Boolean).length
                    }{" "}
                    words
                  </span>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      disabled={locked || article.aiAssisted}
                      checked={doc.aiAssisted}
                      onChange={(e) =>
                        update({
                          aiAssisted: e.target.checked,
                        })
                      }
                    />
                    AI assistance (workspace record)
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      disabled={locked}
                      checked={doc.disclosure}
                      onChange={(e) => update({ disclosure: e.target.checked })}
                    />
                    Show AI-assistance footer (public)
                  </label>
                </div>
              </section>
              {article.generation?.outline?.length ? (
                <section className="panel padded spaced">
                  <h2>AI research & outline</h2>
                  <ol className="help-list">
                    {article.generation.outline.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ol>
                  {article.generation.uncertainties?.map((v, i) => (
                    <Notice key={i} tone="warning">
                      {v}
                    </Notice>
                  ))}
                  <p className="subtle small">
                    Image terms:{" "}
                    {article.generation.imageSearchTerms?.join(", ")}
                  </p>
                </section>
              ) : null}
              <section className="panel spaced">
                <div className="panel-heading">
                  <h2>Workflow history</h2>
                </div>
                {article.events?.length ? (
                  <div className="stack-list">
                    {article.events.map((e) => (
                      <div className="event-row" key={e.id}>
                        <span className="status-dot" />
                        <div>
                          <strong>
                            {e.from.replaceAll("_", " ")} →{" "}
                            {e.to.replaceAll("_", " ")}
                          </strong>
                          <p>{e.reason}</p>
                          <small>{formatDate(e.createdAt, true)}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="padded subtle">
                    This article is just getting started.
                  </p>
                )}
              </section>
            </div>
            <aside className="editor-aside">
              <InternalLinks
                id={id}
                version={article.version}
                html={doc.html}
                locked={locked}
                onInsert={(html) => update({ html })}
                notify={notify}
              />
              <ArticleIndexing article={article} notify={notify} />
              <section className="panel padded">
                <h2>Content update reminder</h2>
                <Field label="Review this article again on">
                  <input
                    type="date"
                    value={
                      reminder || article.updateReminderAt?.slice(0, 10) || ""
                    }
                    onChange={(e) => setReminder(e.target.value)}
                  />
                </Field>
                <button
                  className="secondary wide"
                  disabled={!reminder || a.busy}
                  onClick={() =>
                    a.run(async () => {
                      await post("/articles/" + id + "/reminder", {
                        at: reminder + "T09:00:00+05:30",
                      });
                      await r.reload();
                    }, "Update reminder saved.")
                  }
                >
                  Save reminder
                </button>
              </section>
              {article.status === "FAILED" &&
                article.publishingTarget !== "blogger" &&
                article.draftAttemptedAt &&
                !article.remotePostId && (
                  <section className="panel padded spaced">
                    <h2>Reconcile uncertain remote draft</h2>
                    <Notice tone="warning">
                      Inspect existing Blogger posts on the original blog. Link
                      the matching draft ID before retrying; the worker will
                      never blindly insert another copy.
                    </Notice>
                    <Field label="Verified existing Blogger post ID">
                      <input
                        value={remoteId}
                        onChange={(e) => setRemoteId(e.target.value)}
                      />
                    </Field>
                    <Field label="Type LINK EXISTING BLOGGER POST">
                      <input
                        value={reconcileConfirm}
                        onChange={(e) => setReconcileConfirm(e.target.value)}
                      />
                    </Field>
                    <button
                      className="secondary"
                      disabled={
                        a.busy ||
                        !remoteId ||
                        reconcileConfirm !== "LINK EXISTING BLOGGER POST"
                      }
                      onClick={() =>
                        a.run(async () => {
                          await post("/articles/" + id + "/reconcile", {
                            postId: remoteId,
                            confirmation: reconcileConfirm,
                          });
                          await r.reload();
                        }, "Existing remote post linked. Review the failed job before retrying.")
                      }
                    >
                      Link existing post
                    </button>
                  </section>
                )}
              <section className="panel padded">
                <div className="panel-heading">
                  <h2>
                    <ShieldCheck size={18} />
                    Quality report
                  </h2>
                  {report && (
                    <strong
                      className={report.passed ? "positive" : "warning-text"}
                    >
                      {report.score}/100
                    </strong>
                  )}
                </div>
                <p className="subtle small">
                  Concrete checks, with evidence. Your judgment makes the final
                  call.
                </p>
                <button
                  className="secondary wide"
                  disabled={a.busy || dirty}
                  onClick={() =>
                    a.run(async () => {
                      await post<Report>("/articles/" + id + "/quality");
                      await r.reload();
                    }, "Quality report updated.")
                  }
                >
                  Run quality checks
                </button>
                {report ? (
                  <>
                    <div className="report-status">
                      <Badge
                        value={report.passed ? "PASSED" : "NEEDS_REVIEW"}
                      />
                      <span className="subtle small">
                        Version {report.version}
                      </span>
                    </div>
                    <div className="quality-issues">
                      {report.issues.map((issue, i) => (
                        <div
                          className={"quality-issue " + issue.severity}
                          key={i}
                        >
                          <strong>{issue.code.replaceAll("_", " ")}</strong>
                          <p>{issue.message}</p>
                          <small>{issue.evidence}</small>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="subtle small spaced">
                    No report yet. Add your content and sources, then run the
                    checks.
                  </p>
                )}
              </section>
              <section className="panel padded spaced">
                <div className="panel-heading">
                  <h2>
                    <Link2 size={17} />
                    Research sources
                  </h2>
                  <span className="small subtle">
                    {article.sources?.length || 0}
                  </span>
                </div>
                {article.sources?.map((s) => (
                  <div className="source-card" key={s.id}>
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.title || new URL(s.url).hostname}
                      <ExternalLink size={13} />
                    </a>
                    <p>{s.note}</p>
                    <div className="inline">
                      <span
                        className={
                          s.httpStatus &&
                          s.httpStatus >= 200 &&
                          s.httpStatus < 400
                            ? "positive"
                            : "subtle"
                        }
                      >
                        {s.httpStatus ? `HTTP ${s.httpStatus}` : "Unchecked"}
                      </span>
                      {!locked && (
                        <button
                          aria-label={"Remove " + s.title}
                          className="icon-button danger-text"
                          disabled={a.busy}
                          onClick={() =>
                            a.run(async () => {
                              await api(
                                "/articles/" + id + "/sources/" + s.id,
                                { method: "DELETE" },
                              );
                              await r.reload();
                            })
                          }
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {!locked && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void a.run(async () => {
                        await post("/articles/" + id + "/sources", source);
                        setSource({ title: "", url: "", note: "" });
                        await r.reload();
                      }, "Source added; article needs fresh review.");
                    }}
                  >
                    <Field label="Source title">
                      <input
                        required
                        maxLength={300}
                        value={source.title}
                        onChange={(e) =>
                          setSource({ ...source, title: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Primary source URL">
                      <input
                        type="url"
                        required
                        placeholder="https://docs.example.com/..."
                        value={source.url}
                        onChange={(e) =>
                          setSource({ ...source, url: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="What does this source support?">
                      <textarea
                        required
                        placeholder="After reading, note the supported claims and technical uncertainties."
                        value={source.note}
                        onChange={(e) =>
                          setSource({ ...source, note: e.target.value })
                        }
                      />
                    </Field>
                    <button
                      className="secondary wide"
                      disabled={a.busy || dirty}
                    >
                      <Plus size={15} />
                      Add source
                    </button>
                  </form>
                )}
                <button
                  className="text-button spaced"
                  disabled={a.busy || dirty || locked}
                  onClick={() =>
                    a.run(async () => {
                      await post("/articles/" + id + "/verify-sources");
                      await r.reload();
                    }, "Source URLs checked. Review accuracy yourself.")
                  }
                >
                  <CheckCircle2 size={15} />
                  Check all source links
                </button>
              </section>
              <section className="panel padded spaced">
                <h2>Article images</h2>
                {article.media?.map(({ media: m }) => (
                  <div className="attached-media" key={m.id}>
                    <img src={m.url} alt={m.alt} />
                    <small>{m.attribution}</small>
                    {!locked && (
                      <button
                        className="text-button danger-text"
                        disabled={a.busy || dirty}
                        onClick={() =>
                          a.run(async () => {
                            await api("/articles/" + id + "/media/" + m.id, {
                              method: "DELETE",
                            });
                            await r.reload();
                          })
                        }
                      >
                        Remove image
                      </button>
                    )}
                  </div>
                ))}
                {!locked && (
                  <Field label="Attach / replace with licensed image">
                    <select
                      value=""
                      disabled={a.busy || dirty}
                      onChange={(e) => {
                        if (e.target.value)
                          void a.run(async () => {
                            await post("/articles/" + id + "/media", {
                              mediaId: e.target.value,
                            });
                            await r.reload();
                          }, "Image attached. Recheck the preview before approval.");
                      }}
                    >
                      <option value="">Select from media library</option>
                      {library.data
                        ?.filter(
                          (m) =>
                            !article.media?.some((x) => x.media.id === m.id),
                        )
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.title}
                          </option>
                        ))}
                    </select>
                  </Field>
                )}
                <Link className="text-link small" href="/media">
                  Open media library
                  <ExternalLink size={13} />
                </Link>
              </section>
            </aside>
          </div>
          {approve && (
            <Modal
              title="Your editorial approval"
              onClose={() => setApprove(false)}
            >
              <Notice>
                Confirm you have checked the facts, cited sources, code
                examples, image rights, attribution and applicable policies. A
                passing score alone cannot verify these.
              </Notice>
              <Field label="Review notes">
                <textarea
                  required
                  minLength={5}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe what you verified and any remaining limitations."
                />
              </Field>
              <div className="form-actions">
                <button className="secondary" onClick={() => setApprove(false)}>
                  Keep reviewing
                </button>
                {[
                  "PLANNED",
                  "RESEARCHING",
                  "DRAFTING",
                  "NEEDS_REVIEW",
                ].includes(article.status) && (
                  <button
                    className="secondary danger-text"
                    disabled={a.busy || reason.trim().length < 5}
                    onClick={() =>
                      a.run(async () => {
                        await post("/articles/" + id + "/transition", {
                          status: "REJECTED",
                          reason,
                        });
                        setApprove(false);
                        await refresh();
                      }, "Article rejected with review notes.")
                    }
                  >
                    Reject draft
                  </button>
                )}
                <button
                  className="primary"
                  disabled={a.busy || reason.trim().length < 5}
                  onClick={() =>
                    a.run(async () => {
                      if (article.status !== "NEEDS_REVIEW")
                        await post("/articles/" + id + "/transition", {
                          status: "NEEDS_REVIEW",
                          reason: "Owner opened editorial review.",
                        });
                      await post("/articles/" + id + "/transition", {
                        status: "APPROVED",
                        reason,
                      });
                      setApprove(false);
                      await refresh();
                    }, "Article approved.")
                  }
                >
                  <Check size={16} />
                  Approve article
                </button>
              </div>
            </Modal>
          )}
          {linkOpen && (
            <Modal
              title="Link an existing Blogger post"
              onClose={() => setLinkOpen(false)}
            >
              <Notice>
                This only links the existing post. Its content and date stay on
                Blogger. Review the title and time to avoid linking the wrong
                post.
              </Notice>
              <Field label="Matching Blogger post">
                <select
                  value={remoteId}
                  onChange={(e) => setRemoteId(e.target.value)}
                >
                  <option value="">Choose matching post</option>
                  {matchingPosts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} · {p.status} ·{" "}
                      {p.published
                        ? formatDate(p.published, true)
                        : "Date unavailable"}{" "}
                      · {p.id}
                    </option>
                  ))}
                </select>
              </Field>
              {!matchingPosts.length && (
                <Notice>
                  No scheduled or published post with this exact title was found
                  on the selected blog.
                </Notice>
              )}
              <Field label="Type LINK EXISTING BLOGGER POST">
                <input
                  value={reconcileConfirm}
                  onChange={(e) => setReconcileConfirm(e.target.value)}
                />
              </Field>
              <div className="form-actions">
                <button
                  className="secondary"
                  onClick={() => setLinkOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="primary"
                  disabled={
                    a.busy ||
                    !remoteId ||
                    reconcileConfirm !== "LINK EXISTING BLOGGER POST"
                  }
                  onClick={() =>
                    a.run(async () => {
                      await post("/blogger/articles/" + id + "/link", {
                        postId: remoteId,
                        confirmation: reconcileConfirm,
                      });
                      setLinkOpen(false);
                      await refresh();
                    }, "Existing Blogger post linked. No new post was created.")
                  }
                >
                  Link Blogger post
                </button>
              </div>
            </Modal>
          )}
          {schedule && (
            <Modal
              title="Publish or schedule approved article"
              onClose={() => setSchedule(false)}
            >
              <Notice tone="warning">
                {integrations?.bloggerMode === "live"
                  ? "This can create a real public Blogger post. The first live test requires separate explicit authorization in Blog connections."
                  : "Mock mode: this exercises the worker without creating a real Blogger post."}
              </Notice>
              {canCloud && (
                <Field label="Where to schedule">
                  <select
                    value={scheduleWhere}
                    onChange={(e) => setScheduleWhere(e.target.value)}
                  >
                    <option value="blogger">
                      On Blogger · computer can be off
                    </option>
                    <option value="local">
                      On this computer · must stay running
                    </option>
                  </select>
                </Field>
              )}
              <Field
                label={
                  cloudSchedule
                    ? "Schedule time · Asia/Colombo (at least five minutes ahead)"
                    : "Schedule time · Asia/Colombo (leave empty for now)"
                }
              >
                <input
                  type="datetime-local"
                  value={at}
                  onChange={(e) => setAt(e.target.value)}
                />
              </Field>
              {integrations?.bloggerMode === "live" &&
                !integrations.google?.liveTestSucceededAt && (
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={firstTest}
                      onChange={(e) => setFirstTest(e.target.checked)}
                    />
                    Run the explicitly authorized first live test
                  </label>
                )}
              <Notice>
                {cloudSchedule
                  ? "Studio sends the approved article and date to Google now. Once Blogger confirms the schedule, your computer can be off. Local pause does not cancel Google's accepted schedule; manage changes on Blogger."
                  : "This computer and Docker must be running at publication time, and local automation must be resumed. Quality and daily-limit checks run again in the worker."}
              </Notice>
              <div className="form-actions">
                <button
                  className="secondary"
                  onClick={() => setSchedule(false)}
                >
                  Cancel
                </button>
                <button
                  className="primary"
                  disabled={a.busy || dirty || (cloudSchedule && !at)}
                  onClick={() =>
                    a.run(
                      async () => {
                        try {
                          await post(
                            (cloudSchedule ? "/blogger" : "") +
                              "/articles/" +
                              id +
                              "/schedule",
                            {
                              at: at
                                ? new Date(at + ":00+05:30").toISOString()
                                : new Date().toISOString(),
                              liveTest: firstTest,
                            },
                          );
                        } finally {
                          await refresh();
                        }
                        setSchedule(false);
                      },
                      cloudSchedule
                        ? "Blogger confirmed the schedule. Your computer can be off."
                        : "Local publishing job saved.",
                    )
                  }
                >
                  <CalendarDays size={16} />
                  {cloudSchedule
                    ? "Schedule on Blogger"
                    : at
                      ? "Schedule article"
                      : "Queue publication now"}
                </button>
              </div>
            </Modal>
          )}
        </>
      )}
    </>
  );
}

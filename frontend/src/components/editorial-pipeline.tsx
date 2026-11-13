"use client";
import { useState } from "react";
import Link from "next/link";
import { api, post, formatDate } from "@/lib/api";
import { useAction, useResource } from "./hooks";
import { Field, Notice, Badge } from "./ui";
import type { Notify } from "./studio";
type Policy = {
  enabled: boolean;
  autoPublish: boolean;
  autoPlan?: boolean;
  times: string[];
  revision: number;
};
type PoolPhoto = {
  id: string;
  title: string;
  url: string;
  alt: string;
  license: string;
  provider: string;
  sourceUrl: string;
  eligible: boolean;
  metadata: { editorialPhoto?: { enabled: boolean; tags: string[] } };
};
export type EditorialStatus = {
  settings: Policy;
  blogUrl: string | null;
  paidReady: boolean;
  monthlyLimitUsd: number | null;
  draftBlockers: string[];
  publishingBlockers: string[];
  readyBriefs: { id: string; title: string; sources: number }[];
  pool: PoolPhoto[];
  workerLastSeen: string | null;
  nextSlots: { key: string; at: string }[];
  runs: {
    id: string;
    slotKey: string;
    slotAt: string;
    state: string;
    stage: string;
    message: string;
    article: null | {
      id: string;
      title: string;
      status: string;
      publishedUrl: string | null;
    };
    candidates: { title: string; sourceUrl: string }[];
  }[];
};
export function EditorialPipeline({ notify }: { notify: Notify }) {
  const r = useResource<EditorialStatus>("/editorial"),
    a = useAction(notify);
  const [draft, setDraft] = useState<Policy | null>(null),
    [confirmation, setConfirmation] = useState("");
  const [photoId, setPhotoId] = useState(""),
    [tags, setTags] = useState(""),
    [photoConfirmed, setPhotoConfirmed] = useState(false);
  const data = r.data,
    policy = draft || data?.settings;
  const phrase = policy?.autoPublish
    ? "AUTHORIZE AUTOMATIC EDITORIAL PUBLISHING"
    : "ENABLE PAID EDITORIAL DRAFTS";
  const selected = data?.pool.find((photo) => photo.id === photoId);
  return (
    <section
      className="panel padded spaced editorial-pipeline"
      aria-label="Editorial pipeline"
    >
      <div className="inline spread">
        <h2>Article and photo workflow</h2>
        <button className="secondary" onClick={() => void r.reload()}>
          Refresh workflow
        </button>
      </div>
      <p>
        Prepare up to two source-backed articles a day, choose related real
        photographs from your reviewed pool, and optionally hand the posts to
        Blogger's scheduler.
      </p>
      <Notice>
        Natural, original writing is the goal. AI detectors cannot be
        guaranteed. No synthetic-image service is used. Automatic-policy
        approval is recorded separately from human editorial review.
      </Notice>
      {r.error && <Notice tone="warning">{r.error}</Notice>}
      {data && policy && (
        <>
          <p className="small subtle">
            Destination: {data.blogUrl || "No blog selected"}. Text provider:{" "}
            {data.paidReady
              ? "Configured with billing authorization"
              : "Disabled or incomplete"}
            . Monthly text cap:{" "}
            {data.monthlyLimitUsd == null
              ? "Not configured"
              : `$${data.monthlyLimitUsd} USD`}
            . Worker last seen:{" "}
            {data.workerLastSeen
              ? formatDate(data.workerLastSeen, true)
              : "Not seen"}
            .
          </p>
          {!data.paidReady && (
            <section
              className="preparation-checklist"
              aria-label="Prepare without an AI key"
            >
              <h3>Prepare now; connect AI later</h3>
              <p>
                An AI key is needed to generate new text automatically. You can
                prepare briefs, write articles, review photographs and schedule
                approved articles using the existing article editor now.
              </p>
              <ul>
                <li>
                  {data.readyBriefs.length} source-backed empty briefs ready for
                  writing.
                </li>
                <li>
                  {data.pool.filter((photo) => photo.eligible).length}{" "}
                  photographs eligible for automatic selection. Eligibility does
                  not guarantee a relevant, unused match for every article.
                </li>
                <li>
                  Paid generation is unavailable. Keep its settings off until
                  you are ready to configure billing.
                </li>
              </ul>
              {data.readyBriefs.length > 0 && (
                <details>
                  <summary>Open a ready brief</summary>
                  <ul>
                    {data.readyBriefs.map((brief) => (
                      <li key={brief.id}>
                        <Link
                          className="text-link"
                          href={`/articles/${brief.id}`}
                        >
                          {brief.title}
                        </Link>
                        <span className="small subtle">
                          {" "}
                          · {brief.sources} reference URLs
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="inline wrap">
                <Link className="text-link" href="/articles">
                  Write or review articles
                </Link>
                <Link
                  className="text-link"
                  href="/media?provider=wikimedia&q=laptop%20keyboard"
                >
                  Find real photographs
                </Link>
                <Link className="text-link" href="/calendar">
                  Check existing schedules
                </Link>
              </div>
              <p className="small subtle">
                These links do not generate, approve or publish anything.
                Blogger-hosted schedules already accepted by Google do not need
                an AI key.
              </p>
            </section>
          )}
          <div className="two-column">
            <div>
              <h3>1. Source-backed briefs</h3>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={policy.autoPlan || false}
                  onChange={(event) =>
                    setDraft({ ...policy, autoPlan: event.target.checked })
                  }
                />
                Refill an empty brief queue from the curated official Git
                reference packs
              </label>
              <p className="small subtle">
                Refill uses the same draft call to choose a fresh
                source-supported reader problem and natural title. It adds no
                separate topic-generation call. Unsupported claims, duplicate
                topics and uncertain examples still stop for review.
              </p>
              <p>
                {data.readyBriefs.length} briefs ready. Each needs an empty
                body, at least two sources and reference support notes. Used
                briefs are not automatically recycled.
              </p>
              <button
                className="secondary"
                disabled={a.busy}
                onClick={() =>
                  a.run(async () => {
                    const result = await post<{ created: number }>(
                      "/editorial/starter-briefs",
                    );
                    notify(
                      `${result.created} reference briefs added. Review their scope before unattended use.`,
                    );
                    await r.reload();
                  })
                }
              >
                Add starter reference briefs
              </button>
              <p>
                <Link href="/planner" className="text-link">
                  Review topic planner
                </Link>
              </p>
              <p className="small subtle">
                Starter briefs are reference suggestions, not verified search
                demand, factual review or executed code tests. Add more useful
                briefs when the queue runs out.
              </p>
            </div>
            <div>
              <h3>2. Real-photo pool</h3>
              <p className="small subtle">
                First search and import a licensed photograph in{" "}
                <Link href="/media" className="text-link">
                  Media library
                </Link>
                . Then confirm its real-photo origin and rights here. The
                workflow reuses eligible pool photos only when keywords match;
                photos used in the last seven days are skipped.
              </p>
              <p className="small subtle">
                Unsplash's current API guidelines specify non-automated use, so
                its picker remains manual. Commons discovery provides
                candidates, not automatic license or photo-origin certification.
              </p>
              <Field label="Reviewed photograph">
                <select
                  value={photoId}
                  onChange={(event) => {
                    const photo = data.pool.find(
                      (photo) => photo.id === event.target.value,
                    );
                    setPhotoId(event.target.value);
                    setTags(
                      photo?.metadata?.editorialPhoto?.tags?.join(", ") || "",
                    );
                    setPhotoConfirmed(false);
                  }}
                >
                  <option value="">Choose an imported photograph</option>
                  {data.pool.map((photo) => (
                    <option key={photo.id} value={photo.id}>
                      {photo.title} ·{" "}
                      {photo.eligible ? "Pool ready" : "Needs pool review"}
                    </option>
                  ))}
                </select>
              </Field>
              {selected && (
                <>
                  <p className="small">
                    {selected.title} · {selected.license} · {selected.provider}
                  </p>
                  <Field label="Photo keywords (comma-separated)">
                    <input
                      maxLength={500}
                      value={tags}
                      onChange={(event) => setTags(event.target.value)}
                      placeholder="laptop, programming, keyboard"
                    />
                  </Field>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={photoConfirmed}
                      onChange={(event) =>
                        setPhotoConfirmed(event.target.checked)
                      }
                    />
                    I reviewed this real photograph, its commercial reuse rights
                    and any person, trademark or location restrictions.
                  </label>
                  <div className="inline">
                    <button
                      className="secondary"
                      disabled={a.busy || !photoConfirmed || !tags.trim()}
                      onClick={() =>
                        a.run(async () => {
                          await post(`/editorial/photos/${selected.id}`, {
                            enabled: true,
                            tags: tags
                              .split(",")
                              .map((tag) => tag.trim())
                              .filter(Boolean),
                            confirmation: "CONFIRM REAL PHOTO RIGHTS",
                          });
                          notify("Real-photo pool review saved for 90 days.");
                          setPhotoConfirmed(false);
                          await r.reload();
                        })
                      }
                    >
                      Allow reviewed photo in automatic pool
                    </button>
                    <button
                      className="text-button"
                      disabled={a.busy}
                      onClick={() =>
                        a.run(async () => {
                          await post(`/editorial/photos/${selected.id}`, {
                            enabled: false,
                            tags: [],
                            confirmation: "",
                          });
                          await r.reload();
                          notify("Photo removed from automatic selection.");
                        })
                      }
                    >
                      Remove from pool
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          <h3>3. Workflow policy</h3>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={policy.enabled}
              onChange={(event) =>
                setDraft({ ...policy, enabled: event.target.checked })
              }
            />
            Enable paid preparation (maximum two slot attempts per day)
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={policy.autoPublish}
              onChange={(event) => {
                setDraft({ ...policy, autoPublish: event.target.checked });
                setConfirmation("");
              }}
            />
            Publish under standing owner policy after automated gates pass
          </label>
          <p className="small subtle">
            Without automatic publishing, drafts stop for owner review. With it,
            individual manual approval is skipped only under the saved policy;
            uncertainty, quality, image, budget or destination failures still
            stop the run. Token pricing, spending caps and billing consent
            remain required in private .env.
          </p>
          <div className="two-column">
            {policy.times.map((time, index) => (
              <Field
                key={index}
                label={`Daily publication time ${index + 1} · Sri Lanka`}
              >
                <input
                  type="time"
                  value={time}
                  onChange={(event) =>
                    setDraft({
                      ...policy,
                      times: policy.times.map((value, i) =>
                        i === index ? event.target.value : value,
                      ),
                    })
                  }
                />
              </Field>
            ))}
          </div>
          <p className="small subtle">
            The worker starts automatic preparation 5–30 minutes before a slot.
            It must stay running for generation and upload. Once Blogger
            confirms a future schedule, the computer can be off. Missed slots
            are skipped; they are not backfilled in a burst.
          </p>
          {(policy.autoPublish ? data.publishingBlockers : data.draftBlockers)
            .length > 0 && (
            <Notice tone="warning">
              <strong>Before enabling:</strong>
              <ul>
                {(policy.autoPublish
                  ? data.publishingBlockers
                  : data.draftBlockers
                ).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </Notice>
          )}
          {policy.enabled && (
            <Field label={`Type ${phrase}`}>
              <input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
              />
            </Field>
          )}
          <div className="inline">
            <button
              className="primary"
              disabled={a.busy || (policy.enabled && confirmation !== phrase)}
              onClick={() =>
                a.run(async () => {
                  await api("/editorial", {
                    method: "PATCH",
                    body: JSON.stringify({
                      enabled: policy.enabled,
                      autoPublish: policy.autoPublish,
                      autoPlan: policy.autoPlan || false,
                      times: policy.times,
                      revision: policy.revision,
                      confirmation,
                    }),
                  });
                  setDraft(null);
                  setConfirmation("");
                  await r.reload();
                  notify("Editorial policy saved.");
                })
              }
            >
              Save workflow settings
            </button>
            <button
              className="secondary"
              disabled={
                a.busy ||
                !data.settings.enabled ||
                data.draftBlockers.length > 0
              }
              onClick={() =>
                a.run(async () => {
                  const result = await post<{ queued: boolean; note?: string }>(
                    "/editorial/queue",
                  );
                  notify(
                    result.queued
                      ? "Next future slot queued. The running worker will prepare it; refresh workflow to see progress."
                      : result.note || "No slot queued.",
                  );
                  await r.reload();
                })
              }
            >
              Prepare next future slot
            </button>
          </div>
          {(!data.settings.enabled || data.draftBlockers.length > 0) && (
            <p className="small subtle">
              Prepare next future slot is unavailable until the workflow is
              enabled and its preparation blockers are cleared. You can continue
              writing and reviewing articles in the editor.
            </p>
          )}
          <h3>Run history</h3>
          {data.runs.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Slot · Asia/Colombo</th>
                    <th>State / stage</th>
                    <th>Article and next action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.runs.map((run) => (
                    <tr key={run.id}>
                      <td className="nowrap">{formatDate(run.slotAt, true)}</td>
                      <td>
                        <Badge value={run.state} />
                        <p className="small subtle">{run.stage}</p>
                      </td>
                      <td>
                        {run.article && (
                          <Link
                            href={`/articles/${run.article.id}`}
                            className="text-link"
                          >
                            {run.article.title}
                          </Link>
                        )}
                        <p className="small">{run.message}</p>
                        {run.state === "BLOCKED_MEDIA" && (
                          <>
                            <p className="small subtle">
                              {run.candidates.length} Commons candidates
                              discovered. Verify each photo's source and import
                              through Media library.
                            </p>
                            <Link href="/media" className="text-link">
                              Review candidate photos
                            </Link>
                            <button
                              className="secondary compact"
                              disabled={a.busy}
                              onClick={() =>
                                a.run(async () => {
                                  await post(
                                    `/editorial/runs/${run.id}/resume-photo`,
                                  );
                                  await r.reload();
                                  notify(
                                    "Photo-stage retry queued; text will not be regenerated.",
                                  );
                                })
                              }
                            >
                              Resume saved photo stage
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="subtle small">
              No editorial runs. Nothing will generate or publish while this
              workflow is disabled.
            </p>
          )}
        </>
      )}
    </section>
  );
}

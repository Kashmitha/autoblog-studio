"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Check,
  ExternalLink,
  FileImage,
  ImageIcon,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import { api, post } from "@/lib/api";
import { Media, Integrations } from "@/lib/types";
import { ViewProps, PageHeading, ResourceState } from "./views";
import { Badge, Empty, Field, Modal, Notice } from "./ui";
import { useAction, useResource } from "./hooks";
import { ContentArchive } from "./content-archive";
const initial = {
  title: "",
  url: "",
  alt: "",
  creator: "",
  sourceUrl: "",
  profileUrl: "",
  provider: "ORIGINAL",
  license: "Original work",
  licenseUrl: "",
  attribution: "",
  rightsConfirmed: false,
  providerPhotoId: "",
};
export function MediaLibrary({ notify }: ViewProps) {
  const r = useResource<Media[]>("/media"),
    integrations = useResource<Integrations>("/integrations"),
    a = useAction(notify);
  const [q, setQ] = useState(""),
    [provider, setProvider] = useState("wikimedia"),
    [results, setResults] = useState<Partial<Media>[]>([]),
    [form, setForm] = useState(initial),
    [modal, setModal] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [delivery, setDelivery] = useState<Media | null>(null),
    [publicUrl, setPublicUrl] = useState("");
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const initialQuery = query.get("q");
    if (initialQuery) setQ(initialQuery.slice(0, 120));
    const initialProvider = query.get("provider");
    if (initialProvider === "wikimedia" || initialProvider === "unsplash")
      setProvider(initialProvider);
  }, []);
  const unsplashUnavailable = integrations.data
    ? !integrations.data.unsplashConfigured
    : true;
  const importBlocked =
    form.provider === "UNSPLASH" &&
    (unsplashUnavailable || !form.providerPhotoId);
  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (provider === "unsplash" && unsplashUnavailable) return;
    await a.run(async () => {
      const { api } = await import("@/lib/api");
      setResults(
        await api<Partial<Media>[]>(
          "/media/search?q=" + encodeURIComponent(q) + "&provider=" + provider,
        ),
      );
    });
  }
  function edit(item?: Partial<Media>) {
    setFile(null);
    setForm({
      ...initial,
      ...item,
      profileUrl: item?.profileUrl || "",
      rightsConfirmed: false,
    });
    setModal(true);
  }
  return (
    <>
      <PageHeading
        eyebrow="REAL IMAGES, CLEAR RIGHTS"
        title="Media library"
        description="Useful screenshots, your original photos, and reviewed commercial-use stock images. No AI images."
      >
        <button className="primary" onClick={() => edit()}>
          <Plus size={16} />
          Import original / licensed image
        </button>
      </PageHeading>
      <section className="panel padded spaced" aria-label="Media import guide">
        <h2>Choose a photo for your workflow</h2>
        <p>
          For the automatic photo pool, search Wikimedia Commons or use
          photographs you took yourself. Unsplash imports are for manual article
          attachment.
        </p>
        <ol className="help-list">
          <li>
            Search below and choose <strong>Review &amp; import</strong> to fill
            the image URL, creator, source and license from the provider.
          </li>
          <li>
            Open the original source page. Check the real photograph, exact
            license and any person, trademark or location restrictions. Write
            alt text describing what is visible and record only modifications
            you actually make.
          </li>
          <li>
            Import the reviewed image. For manual use, open an article and
            select it under <strong>Article images</strong>. For automatic use,
            add a Commons or original photo's accurate keywords and confirm it
            in{" "}
            <Link className="text-link" href="/automation">
              Automation → Real-photo pool
            </Link>
            .
          </li>
        </ol>
        <p className="small subtle">
          Search prepares candidates only. Importing does not attach an image to
          an article or authorize publication. Do not label someone else's image
          as your original work.
        </p>
      </section>
      <section className="panel padded">
        <form className="media-search" onSubmit={search}>
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label="Image search"
              required
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search for a useful, relevant photograph…"
              maxLength={120}
            />
          </div>
          <select
            aria-label="Image provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="wikimedia">Wikimedia Commons</option>
            <option value="unsplash">Unsplash API</option>
          </select>
          <button
            className="secondary"
            disabled={
              a.busy || (provider === "unsplash" && unsplashUnavailable)
            }
          >
            {a.busy ? "Searching…" : "Search images"}
          </button>
        </form>
        {provider === "unsplash" && (
          <Notice tone={unsplashUnavailable ? "warning" : undefined}>
            {integrations.error
              ? "Could not check Unsplash configuration. Refresh before importing."
              : !integrations.data
                ? "Checking Unsplash configuration…"
                : unsplashUnavailable
                  ? "Unsplash Access Key is not configured. Use Wikimedia Commons without a key, or configure UNSPLASH_ACCESS_KEY privately before searching and importing."
                  : "Unsplash is configured for manual selection. Choose Review & import from a search result to preserve its photo ID. Unsplash images do not enter the automatic photo pool."}
          </Notice>
        )}
        <p className="subtle small">
          Search results are candidates. Review the source page, exact license,
          attribution, modification notes and third-party rights before import.
        </p>
      </section>
      {results.length > 0 && (
        <section className="spaced">
          <h2>Search candidates</h2>
          <div className="media-grid">
            {results.map((m, i) => (
              <div className="panel media-card" key={i}>
                <img
                  src={m.url}
                  alt={m.alt || m.title || "Candidate image"}
                  loading="lazy"
                />
                <div>
                  <h3>{m.title}</h3>
                  <p className="small subtle">
                    {m.creator} · {m.license}
                  </p>
                  <button className="secondary compact" onClick={() => edit(m)}>
                    Review & import
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="spaced">
        <div className="panel-heading plain">
          <h2>Your media library</h2>
          <span className="subtle small">
            {r.data?.length || 0} rights records
          </span>
        </div>
        <ResourceState {...r} />
        {r.data?.length ? (
          <div className="media-grid">
            {r.data.map((m) => (
              <div className="panel media-card" key={m.id}>
                {m.provider === "ARCHIVE" ? (
                  <div className="padded">
                    <FileImage size={28} />
                    <p className="small subtle">
                      Archived credit reference. Re-add the original before
                      using this image.
                    </p>
                  </div>
                ) : (
                  <img src={m.url} alt={m.alt} loading="lazy" />
                )}
                <div>
                  <h3>{m.title}</h3>
                  <p className="small subtle">{m.attribution}</p>
                  <div className="inline spread">
                    <Badge value={m.provider} />
                    {m.provider !== "ARCHIVE" && (
                      <a
                        className="text-link small"
                        href={m.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Source
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                  <small className="subtle">
                    {m.provider === "ARCHIVE"
                      ? "Rights need a fresh review"
                      : "Rights checked " +
                        new Date(m.checkedAt).toLocaleDateString()}
                  </small>
                  {m.provider === "ARCHIVE" && (
                    <p className="small break-url">
                      {m.creator} · {m.license}. Re-add the image using the
                      import form, review rights, then replace this reference in
                      the article. Source reference:{" "}
                      {m.sourceUrl || "Not recorded"}
                    </p>
                  )}
                  {m.provider === "ORIGINAL" && (
                    <button
                      className="text-button small"
                      onClick={() => {
                        setDelivery(m);
                        setPublicUrl(m.url.startsWith("https://") ? m.url : "");
                      }}
                    >
                      Set public delivery URL
                    </button>
                  )}
                  {m.provider !== "ARCHIVE" &&
                    !m.url.startsWith("https://") && (
                      <Notice tone="warning">
                        Private original. Public HTTPS hosting is required
                        before publication.
                      </Notice>
                    )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <section className="panel">
            <Empty
              title="Images that add something useful"
              description="Choose an original screenshot or a relevant, commercially licensed photograph. Preserve real creator credits and clear alt text."
              action={
                <button className="secondary" onClick={() => edit()}>
                  <ImageIcon size={16} />
                  Import an image
                </button>
              }
            />
          </section>
        )}
      </section>
      {modal && (
        <Modal
          title="Review image rights & attribution"
          onClose={() => setModal(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (importBlocked) return;
              void a.run(async () => {
                if (file) {
                  const body = new FormData();
                  body.append("file", file);
                  for (const key of [
                    "title",
                    "alt",
                    "creator",
                    "attribution",
                  ] as const)
                    body.append(key, form[key]);
                  body.append("rightsConfirmed", String(form.rightsConfirmed));
                  if (form.url) body.append("publicUrl", form.url);
                  await api("/media/upload", { method: "POST", body });
                } else {
                  const { profileUrl, ...data } = form;
                  await post("/media", {
                    ...data,
                    ...(profileUrl ? { profileUrl } : {}),
                  });
                }
                setModal(false);
                await r.reload();
              }, "Licensed image imported. Attribution is saved with the asset.");
            }}
          >
            {form.provider === "UNSPLASH" && (
              <Notice tone={importBlocked ? "warning" : undefined}>
                {unsplashUnavailable
                  ? "Unsplash import is unavailable until its Access Key configuration is confirmed. Wikimedia Commons needs no key."
                  : !form.providerPhotoId
                    ? "Close this form, search using Unsplash API, and choose Review & import. A pasted image URL does not include the required API photo ID."
                    : "Manual-use Unsplash image: verify its source, attribution and license before importing."}
              </Notice>
            )}
            {form.provider === "ORIGINAL" && (
              <Field
                label="Upload my original photo / screenshot (optional)"
                hint="PNG, JPEG or WebP, up to 5 MB. Stored privately; you can add public delivery before approval."
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const chosen = e.target.files?.[0] || null;
                    if (chosen && chosen.size > 5 * 1024 * 1024) {
                      notify("Maximum original image size is 5 MB.", true);
                      return;
                    }
                    setFile(chosen);
                  }}
                />
              </Field>
            )}
            {form.url && (
              <img
                className="media-import-preview"
                src={form.url}
                alt={form.alt || "Import preview"}
              />
            )}
            <div className="form-grid">
              <Field label="Image title">
                <input
                  required
                  minLength={2}
                  maxLength={200}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </Field>
              <Field label="Provider">
                <select
                  value={form.provider}
                  onChange={(e) => {
                    setFile(null);
                    setForm({ ...form, provider: e.target.value });
                  }}
                >
                  <option value="ORIGINAL">
                    My original photo / screenshot
                  </option>
                  <option value="WIKIMEDIA">Wikimedia Commons</option>
                  <option value="UNSPLASH">Unsplash</option>
                </select>
              </Field>
            </div>
            <Field
              label="Public HTTPS image URL"
              hint="For your original photographs/screenshots, use a URL from hosting you control. Local files cannot be embedded in a public Blogger post."
            >
              <input
                required={!file}
                type="url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            </Field>
            <Field label="Descriptive alt text">
              <input
                required
                minLength={8}
                maxLength={500}
                value={form.alt}
                onChange={(e) => setForm({ ...form, alt: e.target.value })}
              />
            </Field>
            <div className="form-grid">
              <Field label="Actual creator / photographer">
                <input
                  required
                  minLength={2}
                  value={form.creator}
                  onChange={(e) =>
                    setForm({ ...form, creator: e.target.value })
                  }
                />
              </Field>
              <Field label="License">
                <select
                  disabled={!!file}
                  value={form.license}
                  onChange={(e) =>
                    setForm({ ...form, license: e.target.value })
                  }
                >
                  {[
                    "Original work",
                    "CC0",
                    "Public domain",
                    "CC BY 4.0",
                    "CC BY-SA 4.0",
                    "Unsplash",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Original source page URL">
              <input
                required={!file}
                type="url"
                value={form.sourceUrl}
                onChange={(e) =>
                  setForm({ ...form, sourceUrl: e.target.value })
                }
              />
            </Field>
            <Field label="Creator profile URL (optional)">
              <input
                type="url"
                value={form.profileUrl}
                onChange={(e) =>
                  setForm({ ...form, profileUrl: e.target.value })
                }
              />
            </Field>
            <Field label="License / permission evidence URL">
              <input
                required={!file}
                type="url"
                value={form.licenseUrl}
                onChange={(e) =>
                  setForm({ ...form, licenseUrl: e.target.value })
                }
              />
            </Field>
            <Field label="Visible attribution, including any modifications">
              <textarea
                required
                minLength={5}
                value={form.attribution}
                onChange={(e) =>
                  setForm({ ...form, attribution: e.target.value })
                }
                placeholder="Creator · image title · license · cropped, if applicable"
              />
            </Field>
            <label className="checkbox-label">
              <input
                type="checkbox"
                required
                checked={form.rightsConfirmed}
                onChange={(e) =>
                  setForm({ ...form, rightsConfirmed: e.target.checked })
                }
              />
              I reviewed the original source, commercial reuse rights,
              attribution and any third-party restrictions.
            </label>
            <Notice>
              License metadata is evidence for your review, not a legal
              guarantee. Reject unclear or noncommercial-only images.
            </Notice>
            <div className="form-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setModal(false)}
              >
                Cancel
              </button>
              <button className="primary" disabled={a.busy || importBlocked}>
                Import reviewed image
              </button>
            </div>
          </form>
        </Modal>
      )}
      {delivery && (
        <Modal
          title="Public delivery for original image"
          onClose={() => setDelivery(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void a.run(async () => {
                await api("/media/" + delivery.id + "/public-url", {
                  method: "PATCH",
                  body: JSON.stringify({ url: publicUrl }),
                });
                setDelivery(null);
                await r.reload();
              }, "Public delivery saved. Attached drafts need fresh review.");
            }}
          >
            <Notice>
              The URL must serve your original image over public HTTPS. Keep the
              original file and rights evidence. Changing an attached asset
              invalidates article approval.
            </Notice>
            <Field label="Public HTTPS image URL">
              <input
                required
                type="url"
                value={publicUrl}
                onChange={(e) => setPublicUrl(e.target.value)}
              />
            </Field>
            <button className="primary" disabled={a.busy}>
              Save delivery URL
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function Preferences({ integrations, notify }: ViewProps) {
  return (
    <>
      <PageHeading
        eyebrow="YOUR WORKSPACE"
        title="Workspace settings"
        description="Local-first settings with explicit controls for external services."
      />
      <div className="two-column">
        <section className="panel padded">
          <h2>Workspace preferences</h2>
          <div className="config-summary">
            <div>
              <span>Owner</span>
              <strong>Kashmitha Madushan</strong>
            </div>
            <div>
              <span>Timezone</span>
              <strong>Asia/Colombo</strong>
            </div>
            <div>
              <span>Reporting currency</span>
              <strong>USD</strong>
            </div>
            <div>
              <span>Audience</span>
              <strong>Single owner</strong>
            </div>
            <div>
              <span>Publishing adapter</span>
              <strong>{integrations?.bloggerMode || "mock"}</strong>
            </div>
          </div>
          <p className="subtle small">
            Use the theme button in the top bar to switch light/dark mode.
            Secrets and integration keys are configured server-side in .env.
          </p>
        </section>
        <section className="panel padded">
          <h2>Operations & access</h2>
          <div className="help-links">
            <Link href="/automation">
              Publishing rhythm & emergency stop
              <ExternalLink size={15} />
            </Link>
            <Link href="/integrations">
              Integration credentials & first-live-test authorization
              <ExternalLink size={15} />
            </Link>
            <Link href="/jobs">
              Queue health, job failures & audit logs
              <ExternalLink size={15} />
            </Link>
            <a href="/api/docs" target="_blank" rel="noreferrer">
              Backend OpenAPI documentation
              <ExternalLink size={15} />
            </a>
            <a href="/api/health" target="_blank" rel="noreferrer">
              Service health
              <ExternalLink size={15} />
            </a>
          </div>
        </section>
      </div>
      <ContentArchive notify={notify} />
      <Notice>
        Changing OWNER_PASSWORD in .env does not silently reset an existing
        database account. Use the documented local owner-password reset script.
      </Notice>
    </>
  );
}
export function Help() {
  return (
    <>
      <PageHeading
        eyebrow="A LITTLE GUIDANCE"
        title="Help & documentation"
        description="Your local workspace, from research to responsible automation."
      />
      <div className="two-column">
        <section className="panel padded">
          <BookOpen size={26} className="positive" />
          <h2 className="spaced">Your first article</h2>
          <ol className="help-list">
            <li>Create a specific topic in Articles or Topic planner.</li>
            <li>
              Add primary source URLs and notes describing the claims they
              support.
            </li>
            <li>
              Write HTML manually, or configure an AI provider to prepare a
              draft.
            </li>
            <li>
              Check all source links, review facts and code, and resolve the
              blocking quality issues.
            </li>
            <li>
              Add licensed images only when they make the article more useful.
              Review the preview and credits.
            </li>
            <li>
              Approve with editorial notes, then schedule the approved article.
            </li>
            <li>
              Resume automation. Mock mode exercises the worker without creating
              an external post.
            </li>
          </ol>
        </section>
        <section className="panel padded">
          <ShieldCheck size={26} className="positive" />
          <h2 className="spaced">Before a real publication</h2>
          <ol className="help-list">
            <li>
              Follow local <code>docs/CHECKPOINTS.md</code> to enable Blogger
              API and configure Google OAuth.
            </li>
            <li>Connect your account, test it and select the actual blog.</li>
            <li>
              Explicitly authorize the first live test in Blog connections.
            </li>
            <li>
              Set BLOGGER_MODE=live locally and restart the backend and worker.
            </li>
            <li>Queue a reviewed article as the first authorized live test.</li>
            <li>
              Inspect the public URL, content, images and credits. Subsequent
              approved content can follow your configured schedule.
            </li>
          </ol>
          <Link href="/connections" className="text-link">
            Open connections
            <ExternalLink size={14} />
          </Link>
        </section>
      </div>
      <section className="panel padded spaced">
        <h2>Project documentation</h2>
        <p className="subtle">
          Detailed operator documentation is included in your local repository.
        </p>
        <div className="doc-grid">
          {[
            ["SETUP.md", "Installation and Windows troubleshooting"],
            ["ARCHITECTURE.md", "Application and worker design"],
            ["INTEGRATIONS.md", "Official integration references"],
            ["CHECKPOINTS.md", "Owner account and credential actions"],
            ["OPERATING_COSTS.md", "Budget controls and profitability"],
            ["TESTING.md", "Executed checks and live-test limits"],
            ["DEPLOYMENT.md", "Docker, backups and production configuration"],
            ["PROGRESS.md", "Current work, blockers and next actions"],
          ].map(([name, text]) => (
            <div key={name}>
              <code>docs/{name}</code>
              <p className="subtle small">{text}</p>
            </div>
          ))}
        </div>
      </section>
      <Notice>
        Revenue goals are experiments. Automated content checks do not guarantee
        factual accuracy, policy compliance, advertising approval, readership or
        search rankings.
      </Notice>
    </>
  );
}

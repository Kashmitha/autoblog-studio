"use client";
import { useState } from "react";
import {
  Check,
  ExternalLink,
  FlaskConical,
  Globe2,
  Link2,
  Plug,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api, post } from "@/lib/api";
import { Integrations } from "@/lib/types";
import { ViewProps, PageHeading, ResourceState } from "./views";
import { useAction, useResource } from "./hooks";
import { Badge, Field, Modal, Notice } from "./ui";
export function Connections({ notify }: ViewProps) {
  const r = useResource<Integrations>("/integrations"),
    a = useAction(notify);
  const [blogs, setBlogs] = useState<
      { id: string; name: string; url: string }[]
    >([]),
    [blogsLoaded, setBlogsLoaded] = useState(false),
    [blogId, setBlogId] = useState(""),
    [confirm, setConfirm] = useState(""),
    [disconnect, setDisconnect] = useState(false),
    [posts, setPosts] = useState<
      { id: string; title: string; url: string; status: string }[]
    >([]);
  const d = r.data;
  return (
    <>
      <PageHeading
        eyebrow="CONNECTED, ON YOUR TERMS"
        title="A studio that works with your tools."
        description="Credentials stay on the backend. Your accounts remain under your control."
      />
      <ResourceState {...r} />
      {d && (
        <>
          <div className="two-column">
            <section className="panel padded">
              <div className="integration-heading">
                <div className="provider-icon blogger">B</div>
                <div>
                  <h2>Google Blogger</h2>
                  <p className="subtle small">Official API v3 · OAuth 2.0</p>
                </div>
                <Badge value={d.google ? "CONNECTED" : "NOT_CONNECTED"} />
              </div>
              <Notice tone={d.bloggerMode === "live" ? "warning" : "info"}>
                {d.bloggerMode === "mock"
                  ? "Mock publishing is enabled. No real blog posts will be created."
                  : "Live mode is enabled. Only approved content can publish; the initial test is separately gated."}
              </Notice>
              {d.google ? (
                <>
                  <p className="small subtle">
                    Selected blog:{" "}
                    {d.google.blogUrl ? (
                      <a
                        href={d.google.blogUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {d.google.blogUrl}
                      </a>
                    ) : (
                      "Not selected"
                    )}
                  </p>
                  <div className="inline wrap">
                    <button
                      className="secondary"
                      disabled={a.busy}
                      onClick={() =>
                        a.run(async () => {
                          const result = await api<{ ownedBlogs: number }>(
                            "/integrations/google/test",
                          );
                          notify(
                            result.ownedBlogs > 0
                              ? `Google connection verified. ${result.ownedBlogs} owned blog${result.ownedBlogs === 1 ? "" : "s"} found.`
                              : "Google connection verified, but no owned blogs were returned. Check your Blogger account.",
                          );
                        })
                      }
                    >
                      <Check size={15} />
                      Test connection
                    </button>
                    <button
                      className="secondary"
                      disabled={a.busy}
                      onClick={() =>
                        a.run(async () => {
                          setBlogs(await api("/integrations/google/blogs"));
                          setBlogsLoaded(true);
                        })
                      }
                    >
                      Load owned blogs
                    </button>
                  </div>
                  {blogs.length > 0 && (
                    <>
                      <Field label="Owned blog">
                        <select
                          value={blogId}
                          onChange={(e) => setBlogId(e.target.value)}
                        >
                          <option value="">Choose blog</option>
                          {blogs.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name} · {b.url}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <button
                        className="primary"
                        disabled={!blogId || a.busy}
                        onClick={() =>
                          a.run(async () => {
                            await post("/integrations/google/blog", { blogId });
                            await r.reload();
                          }, "Blog selected; initial test authorization reset.")
                        }
                      >
                        Select blog
                      </button>
                    </>
                  )}
                  {blogsLoaded && blogs.length === 0 && (
                    <Notice tone="warning">
                      <strong>No owned blogs found.</strong>
                      <p>
                        Open{" "}
                        <a
                          href="https://www.blogger.com/"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Blogger
                        </a>{" "}
                        and confirm your blog appears under the Google account
                        you connected. If it belongs to another account,
                        reconnect using that account. Then load the list again.
                      </p>
                    </Notice>
                  )}
                  <div className="form-actions">
                    <button
                      className="text-button"
                      disabled={a.busy}
                      onClick={() =>
                        a.run(async () => {
                          setPosts(await api("/integrations/google/posts"));
                        })
                      }
                    >
                      Read existing posts
                    </button>
                    <button
                      className="text-button danger-text"
                      onClick={() => setDisconnect(true)}
                    >
                      Disconnect account
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="subtle">
                    Connect your account, select a blog, and test access before
                    authorizing a first real publication.
                  </p>
                  <button
                    className="primary"
                    disabled={a.busy || !d.googleConfigured}
                    onClick={() =>
                      a.run(async () => {
                        const x = await api<{ url: string }>(
                          "/integrations/google/connect",
                        );
                        window.location.href = x.url;
                      })
                    }
                  >
                    <Link2 size={16} />
                    Connect Blogger
                  </button>
                  {!d.googleConfigured && (
                    <p className="subtle small spaced">
                      Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in local
                      .env. See the setup guide below.
                    </p>
                  )}
                </>
              )}
            </section>
            <section className="panel padded">
              <div className="integration-heading">
                <div className="provider-icon ai">
                  <Sparkles size={23} />
                </div>
                <div>
                  <h2>AI writing provider</h2>
                  <p className="subtle small">Pluggable backend provider</p>
                </div>
                <Badge value={d.aiEnabled ? "ENABLED" : "DISABLED"} />
              </div>
              <p className="subtle">
                Paid generation stays disabled until you explicitly authorize
                API billing. A ChatGPT subscription does not imply API credits.
              </p>
              <div className="config-summary">
                <div>
                  <span>Model</span>
                  <strong>{d.aiModel || "Not configured"}</strong>
                </div>
                <div>
                  <span>Monthly ceiling</span>
                  <strong>${d.aiMonthlyLimit} USD</strong>
                </div>
                <div>
                  <span>Key configured</span>
                  <strong>
                    {d.aiConfigured ? "Yes (never exposed)" : "No"}
                  </strong>
                </div>
              </div>
              <Notice>
                Configure AI_API_KEY, current model token prices, AI_ENABLED and
                AI_BILLING_AUTHORIZED locally. Keep the monthly limit within
                your budget.
              </Notice>
              <a
                className="text-link"
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noreferrer"
              >
                Open provider account
                <ExternalLink size={14} />
              </a>
            </section>
          </div>
          {d.google?.blogId && (
            <section className="panel padded spaced">
              <div className="integration-heading">
                <ShieldCheck size={23} />
                <div>
                  <h2>First live publishing test</h2>
                  <p className="subtle">
                    An explicit owner checkpoint before a real public post.
                  </p>
                </div>
                <Badge
                  value={
                    d.google.liveTestSucceededAt
                      ? "SUCCEEDED"
                      : d.google.firstLiveTestAuthorizedAt
                        ? "AUTHORIZED"
                        : "LOCKED"
                  }
                />
              </div>
              {!d.google.firstLiveTestAuthorizedAt && (
                <>
                  <Notice tone="warning">
                    Authorize only after verifying the selected blog. This
                    authorizes one initial test through the article editor; it
                    does not immediately publish anything.
                  </Notice>
                  <Field label="Type AUTHORIZE FIRST LIVE BLOGGER TEST">
                    <input
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      autoComplete="off"
                    />
                  </Field>
                  <button
                    className="primary"
                    disabled={
                      a.busy || confirm !== "AUTHORIZE FIRST LIVE BLOGGER TEST"
                    }
                    onClick={() =>
                      a.run(async () => {
                        await post(
                          "/integrations/blogger/authorize-first-test",
                          { confirmation: confirm },
                        );
                        await r.reload();
                        setConfirm("");
                      }, "Initial live test explicitly authorized.")
                    }
                  >
                    Authorize first live test
                  </button>
                </>
              )}
              {d.google.firstLiveTestAuthorizedAt &&
                !d.google.liveTestSucceededAt && (
                  <p className="subtle">
                    After you set BLOGGER_MODE=live and restart both backend and
                    worker, choose an approved article in the editor, select
                    “Run the explicitly authorized first live test”, and queue
                    it. Resume automation to execute it.
                  </p>
                )}
            </section>
          )}
          {posts.length > 0 && (
            <section className="panel padded spaced">
              <h2>Existing Blogger posts</h2>
              {posts.map((p) => (
                <div className="list-row" key={p.id}>
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {p.title}
                  </a>
                  <div>
                    <Badge value={p.status || "DRAFT"} />
                    <p className="subtle small">Post ID: {p.id}</p>
                  </div>
                </div>
              ))}
            </section>
          )}
          <section className="panel padded spaced">
            <h2>Reporting & image integrations</h2>
            <div className="integration-grid">
              <IntegrationTile
                name="Google Search Console"
                status={d.searchConsoleConfigured}
                text="Read search impressions and clicks after property verification and reporting authorization."
              />
              <IntegrationTile
                name="Google Analytics"
                status={d.analyticsConfigured}
                text="Read pageviews from an authorized GA4 property. No synthetic visitors or traffic."
              />
              <IntegrationTile
                name="Wikimedia Commons"
                status
                text="No key needed. Commercial license metadata must be reviewed for every selected image."
              />
              <IntegrationTile
                name="Unsplash"
                status={d.unsplashConfigured}
                text="Developer API key required. Hotlink images and preserve download tracking and attribution."
              />
            </div>
            <button
              className="secondary"
              disabled={!d.googleConfigured || a.busy}
              onClick={() =>
                a.run(async () => {
                  const x = await api<{ url: string }>(
                    "/integrations/google/connect?analytics=true",
                  );
                  window.location.href = x.url;
                })
              }
            >
              <Plug size={16} />
              Authorize Google reporting scopes
            </button>
          </section>
          <section className="panel padded spaced">
            <h2>Local configuration checklist</h2>
            <ol className="help-list">
              <li>
                Open{" "}
                <a
                  href="https://console.cloud.google.com/apis/library/blogger.googleapis.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  Google Cloud API Library
                </a>
                , create a project, and enable Blogger API v3.
              </li>
              <li>
                Configure OAuth consent with your account as a test user. Create
                a Web application OAuth client.
              </li>
              <li>
                Register the exact redirect URI{" "}
                <code>
                  http://localhost:3100/api/integrations/google/callback
                </code>
                .
              </li>
              <li>
                Put the client ID and secret in local <code>.env</code>, restart
                backend and worker, then connect above.
              </li>
              <li>
                For reporting, enable Search Console API and Analytics Data API;
                set SEARCH_CONSOLE_SITE_URL and GA_PROPERTY_ID. Authorize
                reporting scopes separately.
              </li>
              <li>
                Never post secrets in chat or commit .env. Detailed instructions
                are in <code>docs/CHECKPOINTS.md</code>.
              </li>
            </ol>
          </section>
        </>
      )}
      {disconnect && (
        <Modal
          title="Disconnect your Google account?"
          onClose={() => setDisconnect(false)}
        >
          <p>
            Stored tokens will be deleted, Google revocation will be attempted,
            and automation will pause. Your articles remain available locally.
          </p>
          <div className="form-actions">
            <button className="secondary" onClick={() => setDisconnect(false)}>
              Keep connection
            </button>
            <button
              className="danger"
              disabled={a.busy}
              onClick={() =>
                a.run(async () => {
                  await post("/integrations/google/disconnect");
                  setDisconnect(false);
                  await r.reload();
                }, "Google account disconnected.")
              }
            >
              Disconnect
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function IntegrationTile({
  name,
  status,
  text,
}: {
  name: string;
  status: boolean;
  text: string;
}) {
  return (
    <div className="integration-tile">
      <div className="inline">
        <Globe2 size={18} />
        <strong>{name}</strong>
        <span className={"status-dot " + (!status ? "inactive" : "")} />
      </div>
      <p>{text}</p>
      <small className="subtle">
        {status ? "Available / configured" : "Configuration needed"}
      </small>
    </div>
  );
}

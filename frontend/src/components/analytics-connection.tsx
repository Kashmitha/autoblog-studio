"use client";
import { useState } from "react";
import { api, post, formatDate } from "@/lib/api";
import { Field, Notice, Badge } from "./ui";
import { useAction, useResource } from "./hooks";
import type { Notify } from "./studio";

type Configuration = {
  propertyId: string | null;
  measurementId: string | null;
  blogUrl: string | null;
  configured: boolean;
  readAccess: boolean;
  googleConnected: boolean;
  googleConfigured: boolean;
  propertyTimeZone: string | null;
  verifiedAt: string | null;
  revision: number;
  destinationChanged: boolean;
  note: string;
};
type TestResult = {
  readable: boolean;
  matchingReportRows: number;
  propertyTimeZone: string | null;
  message: string;
};

export function AnalyticsConnection({ notify }: { notify: Notify }) {
  const r = useResource<Configuration>("/integrations/analytics/configuration"),
    action = useAction(notify);
  const [propertyId, setPropertyId] = useState<string | null>(null),
    [measurementId, setMeasurementId] = useState<string | null>(null),
    [test, setTest] = useState<TestResult | null>(null);
  const d = r.data;
  return (
    <section
      className="panel padded spaced"
      aria-label="Google Analytics connection"
    >
      <div className="inline spread wrap">
        <h2>Google Analytics connection</h2>
        <Badge
          value={
            d?.configured && d?.readAccess ? "CONNECTED" : "NOT_CONFIGURED"
          }
        />
      </div>
      <p>
        Measure actual blog pageviews with GA4. Your public blog's Google tag
        collects visits; Studio reads the reports. Analytics setup keeps your
        articles and publishing workflow in place.
      </p>
      {r.error && <Notice tone="warning">{r.error}</Notice>}
      {r.loading && !d && <p role="status">Loading Analytics configuration…</p>}
      <ol className="help-list">
        <li>
          Open{" "}
          <a
            className="text-link"
            href="https://analytics.google.com/"
            target="_blank"
            rel="noreferrer"
          >
            Google Analytics
          </a>
          . Create a GA4 property and a Web data stream for{" "}
          <strong>{d?.blogUrl || "your Blogger URL"}</strong>. Select your
          reporting timezone and currency.
        </li>
        <li>
          In Blogger, open{" "}
          <strong>Settings → Basic → Google Analytics Measurement ID</strong>,
          paste the stream’s <strong>G- Measurement ID</strong> and save.
          Install it once; avoid adding duplicate tracking tags in the theme.
        </li>
        <li>
          In your existing{" "}
          <a
            className="text-link"
            href="https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com"
            target="_blank"
            rel="noreferrer"
          >
            Google Cloud project, enable Google Analytics Data API
          </a>
          . Then authorize read access below with the same account that owns
          your connected blog and can view the Analytics property.
        </li>
        <li>
          Enter both IDs below. The numeric Property ID is under{" "}
          <strong>Analytics Admin → Property details</strong>; the Measurement
          ID beginning with <strong>G-</strong> is under{" "}
          <strong>Admin → Data streams → your Web stream</strong>.
        </li>
      </ol>
      {d && (
        <>
          {!d.googleConnected && (
            <Notice tone="warning">
              Connect Google and select your owned Blogger blog above first.
            </Notice>
          )}
          {d.destinationChanged && (
            <Notice tone="warning">
              The selected blog changed. Save the Analytics property for the
              current blog before importing.
            </Notice>
          )}
          <button
            className="secondary"
            disabled={action.busy || !d.googleConfigured || !d.googleConnected}
            onClick={() =>
              void action.run(async () => {
                const result = await api<{ url: string }>(
                  "/integrations/google/connect?analytics=true",
                );
                window.location.href = result.url;
              })
            }
          >
            {d.readAccess
              ? "Reauthorize Analytics read access"
              : "Authorize Google Analytics read access"}
          </button>
          <p className="small subtle">
            Read access: {d.readAccess ? "granted" : "not granted"}. This grants
            reporting access and preserves the existing Blogger connection.
          </p>
          <form
            className="spaced"
            onSubmit={(event) => {
              event.preventDefault();
              setTest(null);
              void action.run(async () => {
                const saved = await api<Configuration & { test: TestResult }>(
                  "/integrations/analytics/configuration",
                  {
                    method: "PATCH",
                    body: JSON.stringify({
                      propertyId: (propertyId ?? d.propertyId ?? "").trim(),
                      measurementId: (
                        measurementId ??
                        d.measurementId ??
                        ""
                      ).trim(),
                      revision: d.revision,
                    }),
                  },
                );
                setTest(saved.test);
                setPropertyId(null);
                setMeasurementId(null);
                await r.reload();
                window.dispatchEvent(new Event("reporting-config-changed"));
              }, "Analytics configuration saved after a successful read-access test.");
            }}
          >
            <div className="form-grid">
              <Field
                label="GA4 Property ID"
                hint="Numbers only, for example 123456789. This is not the G- ID."
              >
                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9]{1,20}"
                  maxLength={20}
                  placeholder="123456789"
                  value={propertyId ?? d.propertyId ?? ""}
                  onChange={(event) => {
                    setPropertyId(event.target.value);
                    setTest(null);
                  }}
                />
              </Field>
              <Field
                label="Blogger Measurement ID"
                hint="Starts with G-. Copy this same ID into Blogger Settings."
              >
                <input
                  required
                  pattern="G-[A-Z0-9]{4,20}"
                  maxLength={22}
                  placeholder="G-XXXXXXXXXX"
                  value={measurementId ?? d.measurementId ?? ""}
                  onChange={(event) => {
                    setMeasurementId(event.target.value.toUpperCase());
                    setTest(null);
                  }}
                />
              </Field>
            </div>
            <button
              className="primary"
              disabled={action.busy || !d.readAccess || !d.googleConnected}
            >
              Save Analytics configuration
            </button>
          </form>
          {d.configured && (
            <div className="spaced">
              <p className="small">
                Selected property: <strong>{d.propertyId}</strong>. Blog:{" "}
                {d.blogUrl}. Property timezone:{" "}
                {d.propertyTimeZone || "not returned yet"}.
              </p>
              {d.verifiedAt && (
                <p className="small subtle">
                  Configuration read test: {formatDate(d.verifiedAt, true)}.
                  Tracking installation is checked separately.
                </p>
              )}
              {d.measurementId && (
                <p className="small">
                  Measurement ID for Blogger: <code>{d.measurementId}</code>
                </p>
              )}
              <button
                className="secondary"
                disabled={
                  action.busy ||
                  !d.readAccess ||
                  propertyId !== null ||
                  measurementId !== null
                }
                onClick={() =>
                  void action.run(async () => {
                    setTest(
                      await post<TestResult>("/integrations/analytics/test"),
                    );
                  })
                }
              >
                Test Analytics read access
              </button>
            </div>
          )}
        </>
      )}
      {test && <Notice>{test.message}</Notice>}
      <p className="small subtle">
        After adding the tag, open your public blog normally and check{" "}
        <strong>Analytics → Reports → Realtime</strong>. Standard reports can
        take time to process. A successful read test does not verify that the G-
        ID belongs to the numeric property or that the tag is installed.
      </p>
      <p className="small subtle">
        To import pageviews in Studio, open{" "}
        <strong>Traffic &amp; SEO → Sync official Google reports</strong>,
        select dates and click <strong>Google Analytics</strong>. Empty reports
        remain unreported; they do not create zero-traffic records.
      </p>
      <a
        className="text-link small"
        href="https://support.google.com/analytics/answer/14854594?hl=en"
        target="_blank"
        rel="noreferrer"
      >
        Official Blogger tracking setup instructions
      </a>
    </section>
  );
}

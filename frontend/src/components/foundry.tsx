"use client";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, CalendarDays, Plus } from "lucide-react";

/** Four-point printer's ornament, adapted from the supplied Seraph specimen. */
export function PrinterStar({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="-12 -12 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M0-12C1.5-3 3-1.5 12 0 3 1.5 1.5 3 0 12-1.5 3-3 1.5-12 0-3-1.5-1.5-3 0-12Z"
      />
    </svg>
  );
}

/** Code-native line engraving: no generated photograph or third-party image. */
function PressEngraving() {
  return (
    <svg className="press-engraving" viewBox="0 0 420 420" aria-hidden="true">
      <defs>
        <pattern
          id="press-hatch"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(27)"
        >
          <path d="M0 0V6" stroke="currentColor" strokeWidth=".8" />
        </pattern>
        <pattern
          id="press-fine"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-32)"
        >
          <path d="M0 0V4" stroke="currentColor" strokeWidth=".6" />
        </pattern>
      </defs>
      <g fill="none" stroke="currentColor">
        <circle cx="210" cy="208" r="161" strokeWidth=".6" />
        <circle
          cx="210"
          cy="208"
          r="153"
          strokeWidth=".5"
          strokeDasharray="1 6"
        />
        <path
          d="M63 284Q48 240 71 213M58 260Q27 239 40 208Q64 217 58 260ZM64 238Q35 203 53 179Q79 199 64 238ZM75 215Q54 176 76 156Q96 181 75 215ZM88 193Q75 156 101 137Q118 168 88 193ZM101 174Q98 133 127 124Q137 155 101 174Z"
          fill="url(#press-fine)"
        />
        <path
          d="M357 284Q372 240 349 213M362 260Q393 239 380 208Q356 217 362 260ZM356 238Q385 203 367 179Q341 199 356 238ZM345 215Q366 176 344 156Q324 181 345 215ZM332 193Q345 156 319 137Q302 168 332 193ZM319 174Q322 133 293 124Q283 155 319 174Z"
          fill="url(#press-fine)"
        />
        <path
          d="M90 248L210 286 331 248 341 280 210 328 79 280Z"
          fill="url(#press-hatch)"
          strokeWidth="2"
        />
        <path
          d="M86 238L210 276 334 238 331 264 210 307 89 264Z"
          fill="var(--paper)"
          strokeWidth="2"
        />
        {Array.from({ length: 8 }, (_, i) => (
          <path
            key={i}
            d={`M${90 + i / 2} ${244 + i * 2.5}L210 ${282 + i * 2.5} ${332 - i / 2} ${244 + i * 2.5}`}
            strokeWidth=".5"
          />
        ))}
        <path
          d="M96 160Q163 143 210 186Q258 144 324 161L334 238Q264 221 210 272 158 221 86 238Z"
          fill="var(--paper)"
          strokeWidth="2"
        />
        <path d="M210 186V272M100 167Q159 154 203 190M219 190Q265 156 321 167" />
        {Array.from({ length: 12 }, (_, i) => (
          <g key={i} strokeWidth=".65">
            <path
              d={`M${101 - i * 0.75} ${174 + i * 4.7}Q154 ${164 + i * 4.5} 200 ${199 + i * 4.7}`}
            />
            <path
              d={`M220 ${199 + i * 4.7}Q271 ${165 + i * 4.5} ${318 + i * 0.65} ${174 + i * 4.7}`}
            />
          </g>
        ))}
        <path
          d="M207 231Q223 149 293 61Q302 136 227 205L207 231ZM217 210L293 61M230 171L237 129M243 157L254 108M256 143L270 87M237 161L278 129M249 145L288 110"
          fill="url(#press-fine)"
          strokeWidth="1.2"
        />
        <path
          d="M109 323Q208 372 309 323M135 343Q210 371 285 343M167 363H253"
          strokeWidth=".8"
        />
        <path
          d="M138 111Q121 74 150 66Q182 58 182 91Q183 110 158 100Q143 94 153 84M289 307Q318 292 327 314Q335 338 315 345"
          strokeWidth="1.2"
        />
      </g>
      <text
        x="210"
        y="386"
        textAnchor="middle"
        fill="currentColor"
        fontSize="8"
        letterSpacing="4"
        fontFamily="Poppins"
      >
        THE EDITORIAL DESK
      </text>
    </svg>
  );
}

export function FoundryHero() {
  return (
    <section className="foundry-hero" aria-label="Publishing overview">
      <div className="foundry-hero-kicker">
        <PrinterStar />
        <div>
          <strong>Your words. Your world.</strong>
          <span>AN INDEPENDENT PUBLISHING WORKSPACE</span>
        </div>
      </div>
      <div className="foundry-tint" aria-hidden="true" />
      <PressEngraving />
      <div className="foundry-title-wrap">
        <h1 aria-label="Publishing overview">
          <span>Publishing</span>
          <span className="foundry-join">the next chapter</span>
          <span className="foundry-title-bottom">
            Stu<span>dio</span>
          </span>
        </h1>
        <svg className="foundry-swash" viewBox="0 0 700 300" aria-hidden="true">
          <path
            d="M18 85C-18 12 110-12 158 33S153 144 89 126C53 115 68 82 90 90M378 239C451 187 598 186 672 233S652 314 607 267"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M22 85C-2 32 74 6 134 27L139 34C72 17 1 40 22 85ZM378 239C463 208 582 188 649 220L659 228C584 199 466 217 378 239Z"
            fill="currentColor"
          />
        </svg>
        <PrinterStar className="hero-star-one" />
        <PrinterStar className="hero-star-two" />
      </div>
      <div className="foundry-hero-foot">
        <div className="foundry-editor-note">
          <span>FROM FIRST IDEA TO FINAL EDITION</span>
          <p>
            Plan the story. Review the details.
            <br />
            Publish on your own terms.
          </p>
        </div>
        <div className="foundry-hero-actions">
          <Link className="button primary" href="/articles?new=1">
            <Plus size={16} />
            New article
            <ArrowUpRight size={16} />
          </Link>
          <Link className="button secondary" href="/calendar">
            <CalendarDays size={16} />
            View calendar
          </Link>
        </div>
      </div>
      <a className="foundry-scroll" href="#publishing-desk">
        YOUR DESK <ArrowDown size={14} />
      </a>
    </section>
  );
}

export function DeskNavigation() {
  return (
    <nav className="desk-navigation" aria-label="Publishing shortcuts">
      {[
        ["01", "Write & review", "/articles"],
        ["02", "Find a photograph", "/media"],
        ["03", "Plan your editions", "/calendar"],
        ["04", "Read the results", "/analytics"],
      ].map(([n, label, href]) => (
        <Link href={href} key={n}>
          <span>{n}</span>
          {label}
          <ArrowUpRight size={18} />
        </Link>
      ))}
    </nav>
  );
}

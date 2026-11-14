"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Plus,
  FileText,
  ImageIcon,
  BarChart3,
  PenLine,
} from "lucide-react";
import { StudioMark } from "./studio-mark";

export function FoundryHero() {
  return (
    <section
      className="foundry-hero glass-hero"
      aria-label="Publishing overview"
    >
      <div className="glass-hero-copy">
        <span className="glass-kicker">
          <span /> YOUR PUBLISHING WORKSPACE
        </span>
        <h1 aria-label="Publishing overview">
          Make room for
          <br />
          <em>your next story.</em>
        </h1>
        <p>
          A clear space to shape your ideas, find the right photograph, and get
          your next article ready for the world.
        </p>
        <div className="glass-hero-actions">
          <Link className="button primary" href="/articles?new=1">
            <Plus size={18} />
            New article
            <ArrowUpRight size={17} />
          </Link>
          <Link className="button secondary" href="/calendar">
            <CalendarDays size={17} />
            View calendar
          </Link>
        </div>
        <div className="glass-hero-caption">
          <span />
          Your words. Your editorial control.
        </div>
      </div>
      <div className="edition-art" aria-hidden="true">
        <div className="edition-orbit" />
        <div className="edition-sheet sheet-back" />
        <div className="edition-sheet sheet-front">
          <div className="edition-sheet-top">
            <StudioMark />
            <span>AUTOBLOG / STUDIO</span>
            <span>01</span>
          </div>
          <div className="edition-art-title">
            Every idea
            <br />
            has a story.
          </div>
          <div className="edition-photo">
            <div />
            <div />
            <div />
          </div>
          <div className="edition-lines">
            <i />
            <i />
            <i />
          </div>
          <div className="edition-sheet-foot">
            THE NEXT EDITION
            <ArrowUpRight size={20} />
          </div>
        </div>
        <div className="edition-chip chip-plan">
          <PenLine size={17} />
          <span>Shape the idea</span>
          <span>01</span>
        </div>
        <div className="edition-chip chip-publish">
          <FileText size={17} />
          <span>Make it yours</span>
          <span>02</span>
        </div>
      </div>
    </section>
  );
}

export function DeskNavigation() {
  return (
    <nav className="desk-navigation" aria-label="Publishing shortcuts">
      {[
        {
          label: "Write & review",
          href: "/articles",
          note: "Your articles",
          Icon: FileText,
        },
        {
          label: "Find a photograph",
          href: "/media",
          note: "Media library",
          Icon: ImageIcon,
        },
        {
          label: "Plan your editions",
          href: "/calendar",
          note: "Publishing calendar",
          Icon: CalendarDays,
        },
        {
          label: "Read the results",
          href: "/analytics",
          note: "Traffic & SEO",
          Icon: BarChart3,
        },
      ].map(({ label, href, note, Icon }) => (
        <Link href={href} key={href} aria-label={label}>
          <span className="desk-icon">
            <Icon size={20} />
          </span>
          <div>
            <small>{note}</small>
            <strong>{label}</strong>
          </div>
          <ArrowUpRight size={18} />
        </Link>
      ))}
    </nav>
  );
}

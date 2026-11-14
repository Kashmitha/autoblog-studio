"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Command,
  Check,
  ChevronRight,
  Menu,
  X,
  Pause,
  Play,
  GitBranch,
  Code2,
  Layers3,
  Globe2,
  ShieldCheck,
  ImageIcon,
  CalendarDays,
  CheckCheck,
  CircleHelp,
} from "lucide-react";
import s from "./landing.module.css";

const articles = [
  {
    kind: "GIT & GITHUB",
    title: "Small changes.\nBetter commits.",
    detail: "How to unstage a file without losing your work",
    skin: "mint",
    icon: GitBranch,
  },
  {
    kind: "DEVELOPER GUIDES",
    title: "Every line\nhas a history.",
    detail: "How to find which Git commit last changed a line",
    skin: "paper",
    icon: Code2,
  },
  {
    kind: "DOCKER",
    title: "Your first\ncontainer.",
    detail: "Docker for beginners: run your first container",
    skin: "forest",
    icon: Layers3,
  },
];
const steps = [
  {
    name: "Shape",
    tag: "01 / THE IDEA",
    title: "Start with a question.\nMake it worth reading.",
    body: "Turn a reader’s real problem into a focused brief. Keep your references, outline and article in one place, with room for your own voice.",
    label: "A better starting point",
    rows: [
      "A question worth answering",
      "Primary references attached",
      "Your voice, from the first line",
    ],
    file: "git-troubleshooting.md",
    code: [
      "# Why is my Git diff empty?",
      "",
      "1. Check the working tree",
      "2. Compare the staged snapshot",
      "3. Explain what happens next",
    ],
  },
  {
    name: "Refine",
    tag: "02 / THE DETAILS",
    title: "Give every article\nyour final say.",
    body: "Inspect the examples. Check the sources. Choose a photograph with a real origin and clear rights. Keep your editorial decisions in the loop.",
    label: "Ready for a closer look",
    rows: [
      "Source links checked",
      "Photo credits kept with the image",
      "Editorial approval required",
    ],
    file: "editorial-review.md",
    code: [
      "# Before this goes live",
      "",
      "[✓] Useful, specific answer",
      "[✓] Examples checked",
      "[ ] Final editorial approval",
    ],
  },
  {
    name: "Publish",
    tag: "03 / THE NEXT READER",
    title: "Your next post.\nRight on schedule.",
    body: "Send an approved article to Blogger or hand it over as a draft for final SEO settings. Once Google accepts a future schedule, your computer can take a break.",
    label: "A deliberate publishing rhythm",
    rows: [
      "Connected to your Blogger blog",
      "Final metadata review on Blogger",
      "Google-hosted scheduling",
    ],
    file: "publishing-plan.md",
    code: [
      "# The next publishing window",
      "",
      "Destination   Google Blogger",
      "Time zone     Asia / Colombo",
      "Status        Ready for your review",
    ],
  },
];
const questions = [
  [
    "Can I use Studio without an AI API key?",
    "Yes. Write and edit your own articles, attach reviewed media, approve content and use the existing Blogger publishing tools. Automatic text generation needs a configured, supported provider.",
  ],
  [
    "Does it publish everything automatically?",
    "You choose the workflow. Manual editorial approval is available, and optional standing-policy automation has separate authorization and quality gates. Connecting an account does not automatically publish your drafts.",
  ],
  [
    "Where do the photographs come from?",
    "Use your original photographs or reviewed licensed media. Commons photographs can join the automatic pool after rights and relevance review. Imported Unsplash photographs are currently for manual article attachment. Studio does not need generated images.",
  ],
  [
    "Will my computer need to stay on?",
    "Local generation and worker jobs need a running computer or host. A future publishing schedule already accepted by Blogger runs on Google’s side, even when your computer is off.",
  ],
  [
    "Does Studio guarantee traffic or income?",
    "No. It helps you do the publishing work consistently. Search inclusion, reader interest, ad delivery and earnings depend on factors outside the app. There are no guaranteed rankings or AI-detector results.",
  ],
];

function Brand() {
  return (
    <span className={s.brand}>
      <span className={s.brandIcon}>
        <Command size={22} />
      </span>
      autoblog<span className={s.brandLight}>studio</span>
      <span className={s.brandDot} />
    </span>
  );
}
function ArticleCard({
  index,
  small = false,
}: {
  index: number;
  small?: boolean;
}) {
  const article = articles[index % articles.length],
    Icon = article.icon;
  return (
    <div
      className={`${s.articleCard} ${s[article.skin]} ${small ? s.smallCard : ""}`}
    >
      <div className={s.cardTop}>
        <span>THE TOOLBOX</span>
        <ArrowUpRight size={16} />
      </div>
      <span className={s.cardCategory}>{article.kind}</span>
      <h3>{article.title}</h3>
      <div className={s.coverArt}>
        <Icon strokeWidth={1} size={90} />
        <i />
        <i />
        <i />
      </div>
      <div className={s.cardBottom}>
        <span>{article.detail}</span>
        <span>↗</span>
      </div>
    </div>
  );
}

export function Landing() {
  const [menu, setMenu] = useState(false),
    [paused, setPaused] = useState(false),
    [step, setStep] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = steps[step];
  return (
    <div className={s.page} data-motion={paused ? "paused" : "running"}>
      <a className={s.skip} href="#main-content">
        Skip to content
      </a>
      <header className={s.header}>
        <Link href="/welcome" aria-label="AutoBlog Studio home">
          <Brand />
        </Link>
        <nav
          className={`${s.nav} ${menu ? s.navOpen : ""}`}
          aria-label="Landing navigation"
        >
          <a href="#workflow" onClick={() => setMenu(false)}>
            The workflow
          </a>
          <a href="#craft" onClick={() => setMenu(false)}>
            Made for you
          </a>
          <a href="#questions" onClick={() => setMenu(false)}>
            Good questions
          </a>
          <Link href="/" className={s.mobileStudio}>
            Open studio ↗
          </Link>
        </nav>
        <Link href="/" className={s.navCta}>
          Open studio <ArrowUpRight size={16} />
        </Link>
        <button
          className={s.menuButton}
          onClick={() => setMenu(!menu)}
          aria-label={menu ? "Close navigation" : "Open navigation"}
          aria-expanded={menu}
        >
          {menu ? <X /> : <Menu />}
        </button>
      </header>
      <main id="main-content">
        <section className={s.hero}>
          <div className={s.heroGrid} aria-hidden="true" />
          <div className={`${s.floater} ${s.floatLeft}`} aria-hidden="true">
            <ArticleCard index={0} />
          </div>
          <div className={`${s.floater} ${s.floatRight}`} aria-hidden="true">
            <ArticleCard index={1} />
          </div>
          <div className={`${s.floater} ${s.floatBack}`} aria-hidden="true">
            <ArticleCard index={2} />
          </div>
          <div className={s.heroContent}>
            <span className={s.eyebrow}>
              <span /> INDEPENDENT IDEAS. SERIOUS PUBLISHING.
            </span>
            <h1>
              Your ideas.
              <br />
              Their next
              <br />
              <em>great read.</em>
            </h1>
            <p>
              A little less busywork. A lot more voice.
              <br />
              Your command center for articles that deserve to be read.
            </p>
            <div className={s.heroActions}>
              <Link className={s.buttonLime} href="/">
                Enter your studio <ArrowUpRight size={20} />
              </Link>
              <a className={s.buttonGhost} href="#workflow">
                See how it flows <ArrowRight size={18} />
              </a>
            </div>
            <span className={s.heroNote}>
              Your content. Your accounts. Your call.
            </span>
          </div>
          <div className={s.heroFoot}>
            <span>
              <span className={s.liveDot} /> BUILT FOR THE WAY YOU CREATE
            </span>
            <button
              onClick={() => setPaused(!paused)}
              className={s.motionButton}
            >
              {paused ? <Play size={13} /> : <Pause size={13} />}{" "}
              {paused ? "Play motion" : "Pause motion"}
            </button>
            <a href="#workflow" aria-label="Explore the workflow">
              SCROLL TO EXPLORE <span>↓</span>
            </a>
          </div>
        </section>
        <section className={s.ribbon} aria-label="Publishing capabilities">
          <span>ONE CONNECTED WORKFLOW</span>
          <div>
            <GitBranch /> Source-backed ideas
          </div>
          <b>✳</b>
          <div>
            <ImageIcon /> Real photographs
          </div>
          <b>✳</b>
          <div>
            <ShieldCheck /> Your approval
          </div>
          <b>✳</b>
          <div>
            <Globe2 /> Google Blogger
          </div>
        </section>
        <section className={s.intro} id="craft">
          <span className={s.kicker}>LESS FRICTION. MORE INTENTION.</span>
          <h2>
            You bring the point of view.
            <br />
            We bring <span>the publishing flow.</span>
          </h2>
          <div className={s.introBottom}>
            <p>
              Good blogging is more than pressing publish. It’s a sharp idea, a
              clear answer, the right image, and the care to get it right. Bring
              it all together in a studio that works on your terms.
            </p>
            <span className={s.numberStamp}>
              A → B<br />
              <small>IDEA TO IMPACT</small>
            </span>
          </div>
        </section>
        <section className={s.workflow} id="workflow">
          <div className={s.sectionTop}>
            <span className={s.kicker}>THE WORKFLOW</span>
            <span className={s.tinyLabel}>
              A REAL PROCESS. NOT A MAGIC BUTTON.
            </span>
          </div>
          <div
            className={s.tabs}
            role="tablist"
            aria-label="Explore the publishing workflow"
          >
            {steps.map((item, index) => (
              <button
                key={item.name}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                role="tab"
                id={`workflow-tab-${index}`}
                aria-selected={index === step}
                aria-controls="workflow-panel"
                tabIndex={index === step ? 0 : -1}
                onClick={() => setStep(index)}
                onKeyDown={(event) => {
                  let next: number | undefined;
                  if (event.key === "ArrowRight") next = (step + 1) % 3;
                  if (event.key === "ArrowLeft") next = (step + 2) % 3;
                  if (event.key === "Home") next = 0;
                  if (event.key === "End") next = 2;
                  if (next !== undefined) {
                    event.preventDefault();
                    setStep(next);
                    tabRefs.current[next]?.focus();
                  }
                }}
              >
                <span>0{index + 1}</span>
                {item.name}
                <ArrowUpRight size={26} />
              </button>
            ))}
          </div>
          <div
            id="workflow-panel"
            role="tabpanel"
            aria-labelledby={`workflow-tab-${step}`}
            className={s.workflowPanel}
          >
            <div className={s.workflowText}>
              <span className={s.kicker}>{current.tag}</span>
              <h2>{current.title}</h2>
              <p>{current.body}</p>
              <ul>
                {current.rows.map((row) => (
                  <li key={row}>
                    <Check size={16} />
                    {row}
                  </li>
                ))}
              </ul>
              <Link href="/" className={s.textLink}>
                Make it your workflow <ArrowRight size={18} />
              </Link>
            </div>
            <div className={s.demoWindow}>
              <div className={s.windowBar}>
                <span>
                  <i />
                  <i />
                  <i />
                </span>
                <span>AUTOBLOG STUDIO / WORKFLOW PREVIEW</span>
                <Command size={16} />
              </div>
              <div className={s.demoInner}>
                <div className={s.demoAside}>
                  <Command size={19} />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className={s.demoEditor}>
                  <span className={s.demoPath}>
                    WORKSPACE <ChevronRight size={11} /> {current.file}
                  </span>
                  <div className={s.demoStatus}>
                    <span className={s.liveDot} /> {current.label}
                  </div>
                  <h3>
                    {step === 0
                      ? "A useful answer\nstarts here."
                      : step === 1
                        ? "The details make\nthe difference."
                        : "A little rhythm.\nA bigger reach."}
                  </h3>
                  <div className={s.codePreview}>
                    {current.code.map((line, i) => (
                      <div key={i}>
                        <span>{String(i + 1).padStart(2, "0")}</span>
                        <code>{line || " "}</code>
                      </div>
                    ))}
                  </div>
                  <div className={s.demoBottom}>
                    <span>
                      <ShieldCheck size={13} /> YOU’RE IN CONTROL
                    </span>
                    <span>Illustrative preview</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className={s.editorial}>
          <div className={s.editorialHead}>
            <span className={s.kicker}>BUILT AROUND YOUR CONTENT</span>
            <h2>
              A studio with
              <br />
              <em>something to say.</em>
            </h2>
            <p>
              Practical tutorials. Clear explanations.
              <br />
              Distinctive articles, from first idea to final read.
            </p>
          </div>
          <div className={s.conveyor} aria-hidden="true">
            <div className={s.conveyorTrack}>
              {[0, 1, 2, 0, 1, 2].map((index, i) => (
                <ArticleCard key={i} index={index} small />
              ))}
            </div>
          </div>
          <a
            className={s.editorialLink}
            href="https://devaitoolbox.blogspot.com/"
            target="_blank"
            rel="noreferrer"
          >
            Explore Dev &amp; AI Toolbox <ArrowUpRight size={19} />
          </a>
        </section>
        <section className={s.control}>
          <div className={s.controlCopy}>
            <span className={s.kicker}>AUTOMATION. WITH A POINT OF VIEW.</span>
            <h2>
              More momentum.
              <br />
              <span>Still your move.</span>
            </h2>
            <p>
              Keep the repetitive work moving without losing the decisions that
              matter. Sources, image rights, quality checks and publishing
              permissions stay part of the process.
            </p>
            <Link href="/" className={s.buttonDark}>
              Take the controls <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className={s.controlDiagram}>
            <div className={s.diagramOrbit} />
            <div className={s.diagramCore}>
              <Command size={44} />
              <span>YOUR STUDIO</span>
            </div>
            <div className={`${s.node} ${s.nodeOne}`}>
              <ShieldCheck size={20} />
              <span>Editorial approval</span>
              <Check size={14} />
            </div>
            <div className={`${s.node} ${s.nodeTwo}`}>
              <ImageIcon size={20} />
              <span>Reviewed photographs</span>
              <Check size={14} />
            </div>
            <div className={`${s.node} ${s.nodeThree}`}>
              <CalendarDays size={20} />
              <span>Intentional scheduling</span>
              <Check size={14} />
            </div>
            <span className={s.diagramCaption}>
              CONNECTED TOOLS. INDEPENDENT VOICE.
            </span>
          </div>
        </section>
        <section className={s.stack}>
          <div>
            <span className={s.kicker}>YOUR WORKSPACE. YOUR STACK.</span>
            <h2>
              Start with what
              <br />
              you already have.
            </h2>
          </div>
          <div className={s.stackList}>
            <div>
              <span className={s.stackIcon}>
                <Code2 />
              </span>
              <p>
                <strong>Write it your way</strong>
                <span>
                  Draft by hand or use a configured text provider. An AI key
                  isn’t required to start writing.
                </span>
              </p>
              <ArrowUpRight />
            </div>
            <div>
              <span className={s.stackIcon}>
                <Globe2 />
              </span>
              <p>
                <strong>Your Blogger, connected</strong>
                <span>
                  Keep your blog and Google account. Send approved content
                  through the official publishing connection.
                </span>
              </p>
              <ArrowUpRight />
            </div>
            <div>
              <span className={s.stackIcon}>
                <CheckCheck />
              </span>
              <p>
                <strong>A clear picture of progress</strong>
                <span>
                  Review publishing activity and connected reports. Measured
                  results stay separate from promises.
                </span>
              </p>
              <ArrowUpRight />
            </div>
          </div>
        </section>
        <section className={s.faq} id="questions">
          <div>
            <span className={s.kicker}>
              <CircleHelp size={15} /> BEFORE YOU DIVE IN
            </span>
            <h2>
              Good questions.
              <br />
              Clear answers.
            </h2>
            <p>
              No mystery settings.
              <br />
              No overnight-success promises.
            </p>
          </div>
          <div className={s.faqList}>
            {questions.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span>+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className={s.closing}>
          <div className={s.closingHalo} aria-hidden="true" />
          <span className={s.eyebrow}>YOUR NEXT CHAPTER STARTS HERE</span>
          <h2>
            Less waiting.
            <br />
            More <em>publishing.</em>
          </h2>
          <Link href="/" className={s.buttonLime}>
            Make your next move <ArrowUpRight size={21} />
          </Link>
          <p>One good idea is a great place to start.</p>
          <span className={s.closingWord} aria-hidden="true">
            AUTOBLOG
          </span>
        </section>
      </main>
      <footer className={s.footer}>
        <Link href="/welcome" aria-label="AutoBlog Studio home">
          <Brand />
        </Link>
        <span>Independent ideas. Thoughtfully published.</span>
        <div>
          <a
            href="https://devaitoolbox.blogspot.com/"
            target="_blank"
            rel="noreferrer"
          >
            The blog ↗
          </a>
          <Link href="/">Your workspace ↗</Link>
          <a href="#questions">Questions</a>
        </div>
        <p>
          © {new Date().getFullYear()} AutoBlog Studio. Your content stays
          yours.
        </p>
      </footer>
    </div>
  );
}

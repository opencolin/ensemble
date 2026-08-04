"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { startHeroAnimation } from "./heroAnimation";
import "./hero.css";

/** Where the live sandbox demo is served. `#deploy` opens its deploy view directly. */
export const DEPLOY_URL =
  process.env.NEXT_PUBLIC_DEPLOY_URL ??
  "https://we63yhph64ktkihshohnn7dsrbguglxx.us.sb.tenki.sh/#deploy";

const TAGLINES = [
  "code reviews by agents",
  "github runners on demand",
  "sandboxes in an instant",
];

const PRODUCTS = [
  {
    title: "Instant Sandbox",
    body: "A full dev environment in milliseconds. Use it, break it, walk away — it turns to sand.",
  },
  {
    title: "Code Reviewer",
    body: "An agent reviews every pull request in a sandbox that exists only as long as the review does.",
  },
  {
    title: "GitHub Runner",
    body: "CI runners that materialize for your workflow and vanish the moment the job is green.",
  },
];

export function HomeHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tagIdx, setTagIdx] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    return startHeroAnimation(canvasRef.current);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTagIdx((i) => (i + 1) % TAGLINES.length), 2800);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="tk-home">
      <nav className={scrolled ? "scrolled" : undefined}>
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <i /><i /><i /><i className="gap" /><i /><i className="gap" /><i className="gap" /><i className="gap" /><i />
          </div>
          <span className="brand-name">ixio</span>
        </div>
        <div className="nav-links">
          <Link href="/leaderboard">Benchmarks</Link>
          <a href="https://tenki.cloud/docs" target="_blank" rel="noopener noreferrer">Docs</a>
          <a href={DEPLOY_URL} className="nav-cta">Deploy</a>
        </div>
      </nav>

      <main id="view-hero" style={{ display: "flex" }}>
        <div className="hero-top">
          <div className="hero-canvas-wrap">
            <div className="hero-glow" />
            <canvas id="logoCanvas" ref={canvasRef} width={640} height={380} />
          </div>

          <h1 className="hero-title">Agent Native Infrastructure</h1>

          <div className="tagline" aria-live="polite">
            {TAGLINES.map((t, i) => (
              <span key={t} className={i === tagIdx ? "on" : undefined}>
                {t}
              </span>
            ))}
          </div>

          <div className="hero-ctas">
            <a className="btn btn-primary" href={DEPLOY_URL}>Deploy now</a>
            <a className="btn btn-ghost" href="mailto:hello@tenki.cloud">Talk to sales</a>
          </div>
        </div>

        <div className="hero-products">
          {PRODUCTS.map((p) => (
            <div className="cell" key={p.title}>
              <h3><span className="dot" />{p.title}</h3>
              <p>{p.body}</p>
            </div>
          ))}
        </div>
      </main>

      <footer>
        <div className="foot-grid">
          <div className="foot-brand">
            <div className="brand">
              <div className="brand-mark" aria-hidden="true">
                <i /><i /><i /><i className="gap" /><i /><i className="gap" /><i className="gap" /><i className="gap" /><i />
              </div>
              <span className="brand-name">ixio</span>
            </div>
            <p className="foot-tag mono">infrastructure, then sand.</p>
          </div>
          <div className="foot-col">
            <h4>Products</h4>
            <a href={DEPLOY_URL}>Instant Sandbox</a>
            <a href={DEPLOY_URL}>Code Reviewer</a>
            <a href={DEPLOY_URL}>GitHub Runner</a>
          </div>
          <div className="foot-col">
            <h4>Benchmarks</h4>
            <Link href="/leaderboard">Top Model</Link>
            <Link href="/agents">Top Agent</Link>
            <Link href="/benchmarks">Top Benchmark</Link>
          </div>
          <div className="foot-col">
            <h4>Connect</h4>
            <a href="mailto:hello@tenki.cloud">hello@tenki.cloud</a>
            <a href="https://tenki.cloud/docs" target="_blank" rel="noopener noreferrer">Docs</a>
          </div>
        </div>
        <div className="foot-bottom">© 2026 ixio. All rights reserved.</div>
      </footer>
    </div>
  );
}

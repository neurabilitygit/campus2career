"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return reduced;
}

export function IntroWelcomeSplash(props: {
  onContinue: () => void;
  onSkip: () => void;
}) {
  const reducedMotion = useReducedMotionPreference();
  const [secondsRemaining, setSecondsRemaining] = useState(5);
  const continueRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsRemaining((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          props.onContinue();
          return 0;
        }
        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [props]);

  useEffect(() => {
    const timer = window.setTimeout(() => continueRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const orbitDots = useMemo(() => Array.from({ length: 3 }, (_, index) => index), []);

  return (
    <div className="intro-onboarding intro-onboarding--splash" role="dialog" aria-modal="true" aria-labelledby="intro-welcome-title">
      <div className="intro-welcome">
        <div className="intro-welcome__eyebrow">Welcome</div>
        <div
          className="intro-welcome__animation"
          data-reduced-motion={reducedMotion ? "true" : "false"}
          aria-hidden="true"
        >
          <span className="intro-welcome__core" />
          {orbitDots.map((dot) => (
            <span key={dot} className="intro-welcome__orbit" style={{ ["--orbit-index" as string]: dot }} />
          ))}
        </div>
        <h2 id="intro-welcome-title">Welcome to Rising Senior</h2>
        <p>
          A guided workspace for turning student information into clearer next steps toward graduation,
          employment, and independence.
        </p>
        <div className="intro-welcome__actions">
          <button ref={continueRef} type="button" className="ui-button ui-button--primary" onClick={props.onContinue}>
            Continue
          </button>
          <button type="button" className="ui-button ui-button--ghost" onClick={props.onSkip}>
            Skip intro
          </button>
        </div>
        <div className="intro-welcome__countdown">Starting automatically in {secondsRemaining}s</div>
      </div>
    </div>
  );
}

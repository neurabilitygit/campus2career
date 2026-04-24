"use client";

import { useEffect, useRef, useState } from "react";
import type { IntroTourStepConfig } from "../../lib/introOnboarding";
import { IntroTourStep } from "./IntroTourStep";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function resolvePanelPosition(target: HTMLElement | null, placement: IntroTourStepConfig["placement"]) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const panelWidth = Math.min(380, viewportWidth - 24);
  const panelHeight = 260;

  if (!target || placement === "center") {
    return {
      top: clamp((viewportHeight - panelHeight) / 2, 12, viewportHeight - panelHeight - 12),
      left: clamp((viewportWidth - panelWidth) / 2, 12, viewportWidth - panelWidth - 12),
      width: panelWidth,
    };
  }

  const rect = target.getBoundingClientRect();
  const gap = 16;

  switch (placement) {
    case "top":
      return {
        top: clamp(rect.top - panelHeight - gap, 12, viewportHeight - panelHeight - 12),
        left: clamp(rect.left, 12, viewportWidth - panelWidth - 12),
        width: panelWidth,
      };
    case "left":
      return {
        top: clamp(rect.top, 12, viewportHeight - panelHeight - 12),
        left: clamp(rect.left - panelWidth - gap, 12, viewportWidth - panelWidth - 12),
        width: panelWidth,
      };
    case "right":
      return {
        top: clamp(rect.top, 12, viewportHeight - panelHeight - 12),
        left: clamp(rect.right + gap, 12, viewportWidth - panelWidth - 12),
        width: panelWidth,
      };
    case "bottom":
    default:
      return {
        top: clamp(rect.bottom + gap, 12, viewportHeight - panelHeight - 12),
        left: clamp(rect.left, 12, viewportWidth - panelWidth - 12),
        width: panelWidth,
      };
  }
}

export function IntroTourOverlay(props: {
  step: IntroTourStepConfig;
  stepIndex: number;
  totalSteps: number;
  target: HTMLElement | null;
  canGoBack: boolean;
  isLastStep: boolean;
  busy?: boolean;
  error?: string | null;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  onFinish: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState({ top: 24, left: 24, width: 380 });

  useEffect(() => {
    const update = () => {
      setPosition(resolvePanelPosition(props.target, props.step.placement || "bottom"));
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [props.step.placement, props.target]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>("[data-intro-primary='true']")?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      previousFocusRef.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        props.onSkip();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (props.isLastStep) {
          props.onFinish();
        } else {
          props.onNext();
        }
        return;
      }

      if (event.key === "ArrowLeft" && props.canGoBack) {
        event.preventDefault();
        props.onBack();
        return;
      }

      if (event.key === "Tab" && panelRef.current) {
        const focusable = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((item) => !item.hasAttribute("disabled"));

        if (!focusable.length) {
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        } else if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [props]);

  const counterLabel = `${props.stepIndex + 1} of ${props.totalSteps}`;

  return (
    <div className="intro-onboarding intro-onboarding--tour" role="dialog" aria-modal="true" aria-labelledby="intro-tour-title">
      <div className="intro-onboarding__scrim" aria-hidden="true" />
      <div
        ref={panelRef}
        className="intro-tour"
        style={{
          top: position.top,
          left: position.left,
          width: position.width,
        }}
      >
        <IntroTourStep
          counterLabel={counterLabel}
          title={props.step.title}
          body={props.step.body}
          error={props.error}
        />
        <div className="intro-tour__actions">
          <button type="button" className="ui-button ui-button--ghost" onClick={props.onSkip}>
            Skip
          </button>
          <div className="intro-tour__actions-group">
            <button
              type="button"
              className="ui-button ui-button--secondary"
              onClick={props.onBack}
              disabled={!props.canGoBack || props.busy}
            >
              Back
            </button>
            <button
              type="button"
              className="ui-button ui-button--primary"
              data-intro-primary="true"
              onClick={props.isLastStep ? props.onFinish : props.onNext}
              disabled={props.busy}
            >
              {props.busy ? "Saving..." : props.isLastStep ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

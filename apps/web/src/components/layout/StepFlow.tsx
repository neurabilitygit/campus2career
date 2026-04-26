"use client";

export type StepFlowItem = {
  key: string;
  label: string;
  description?: string;
};

export function StepFlowHeader(props: {
  title: string;
  subtitle?: string;
  steps: StepFlowItem[];
  currentStepKey: string;
  onStepSelect: (key: string) => void;
}) {
  const currentIndex = Math.max(
    0,
    props.steps.findIndex((step) => step.key === props.currentStepKey)
  );
  const currentStep = props.steps[currentIndex] || props.steps[0];

  return (
    <div
      style={{
        display: "grid",
        gap: 14,
        padding: "18px 18px 20px",
        borderRadius: 20,
        background: "#f8fbff",
        border: "1px solid #dbe4f0",
      }}
      data-testid="step-flow-header"
    >
      <div style={{ display: "grid", gap: 6 }}>
        <div className="ui-pill">Step {currentIndex + 1} of {props.steps.length}</div>
        <strong style={{ color: "#183153", fontSize: 18 }}>{props.title}</strong>
        {props.subtitle ? (
          <p style={{ margin: 0, color: "#52657d", lineHeight: 1.6 }}>{props.subtitle}</p>
        ) : null}
        {currentStep?.description ? (
          <p style={{ margin: 0, color: "#334155", lineHeight: 1.6 }}>{currentStep.description}</p>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {props.steps.map((step, index) => {
          const active = step.key === props.currentStepKey;
          return (
            <button
              key={step.key}
              type="button"
              className={`ui-button ${active ? "ui-button--primary" : "ui-button--secondary"}`}
              onClick={() => props.onStepSelect(step.key)}
              aria-current={active ? "step" : undefined}
              data-testid={`step-flow-chip-${step.key}`}
            >
              {index + 1}. {step.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StepFlowFooter(props: {
  steps: StepFlowItem[];
  currentStepKey: string;
  onStepSelect: (key: string) => void;
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;
  nextAction?: () => void;
  backAction?: () => void;
  nextButtonType?: "button" | "submit";
  trailing?: React.ReactNode;
}) {
  const currentIndex = Math.max(
    0,
    props.steps.findIndex((step) => step.key === props.currentStepKey)
  );
  const previousStep = currentIndex > 0 ? props.steps[currentIndex - 1] : null;
  const nextStep = currentIndex < props.steps.length - 1 ? props.steps[currentIndex + 1] : null;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        paddingTop: 4,
      }}
      data-testid="step-flow-footer"
    >
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {previousStep ? (
          <button
            type="button"
            className="ui-button ui-button--secondary"
            onClick={() => (props.backAction ? props.backAction() : props.onStepSelect(previousStep.key))}
          >
            {props.backLabel || `Back: ${previousStep.label}`}
          </button>
        ) : null}

        {nextStep ? (
          <button
            type={props.nextButtonType || "button"}
            className="ui-button ui-button--primary"
            onClick={() => (props.nextAction ? props.nextAction() : props.onStepSelect(nextStep.key))}
            disabled={props.nextDisabled}
          >
            {props.nextLabel || `Next: ${nextStep.label}`}
          </button>
        ) : null}
      </div>

      {props.trailing ? <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{props.trailing}</div> : null}
    </div>
  );
}

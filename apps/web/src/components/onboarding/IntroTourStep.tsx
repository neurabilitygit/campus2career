"use client";

export function IntroTourStep(props: {
  counterLabel: string;
  title: string;
  body: string;
  error?: string | null;
}) {
  return (
    <>
      <div className="intro-tour__counter">{props.counterLabel}</div>
      <h2 id="intro-tour-title">{props.title}</h2>
      <p>{props.body}</p>
      {props.error ? <div className="intro-tour__error">{props.error}</div> : null}
    </>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { COPY } from "@/lib/content";
import { useJourney } from "@/lib/store";
import { sound } from "@/lib/audio";
import { TIME_WORDS, UI, type VisitHome, type VisitRequest, type VisitTime } from "@/lib/ui-copy";
import { debugParam } from "@/lib/ui-media";
import { formatVisitDate, isoDate, visitDays, type VisitDay } from "@/lib/ui-time";
import { HOMES } from "@/lib/content";
import { InvitationCard } from "./InvitationCard";

type Status = "idle" | "sending" | "sent";
type Errors = Partial<Record<"name" | "email" | "date", string>>;

/** Next Saturday (at least two days out) — the demo invitation's date. */
const demoDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  return isoDate(d);
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(v: VisitRequest, days: VisitDay[]): Errors {
  const e: Errors = {};
  if (v.name.trim().length < 2) e.name = UI.form.errors.name;
  if (!EMAIL.test(v.email.trim())) e.email = UI.form.errors.email;
  if (!v.date || !days.some((d) => d.value === v.date)) e.date = UI.form.errors.date;
  return e;
}

/**
 * The private-visit request (no backend: a calm ~900 ms pause), replaced by the
 * invitation card. `?invite=demo` shows the card pre-filled for screenshots.
 * `preset` chooses a home from outside (the classic site's villas); `at` makes
 * the same choice count again.
 */
export function Invitation({ preset }: { preset?: { home: VisitHome; at: number } } = {}) {
  const [status, setStatus] = useState<Status>("idle");
  const [values, setValues] = useState<VisitRequest>({ name: "", email: "", phone: "", home: "v3", date: "", time: "evening" });
  const [errors, setErrors] = useState<Errors>({});
  const [tried, setTried] = useState(false);
  const [announce, setAnnounce] = useState("");
  // The next two weeks, from tomorrow (computed on the client: "today" is the visitor's).
  const [days, setDays] = useState<VisitDay[]>([]);
  const uid = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timer = useRef(0);

  useEffect(() => {
    setDays(visitDays(14));
    if (debugParam("invite") === "demo") {
      setValues({ name: "Inês Almeida", email: "ines@example.com", phone: "", home: "v4", date: demoDate(), time: "evening" });
      setStatus("sent");
    }
    return () => window.clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (!preset) return;
    setStatus((s) => (s === "sent" ? "idle" : s));
    setValues((v) => ({ ...v, home: preset.home }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset?.at]);

  const set = <K extends keyof VisitRequest>(k: K, v: VisitRequest[K]) => {
    const next = { ...values, [k]: v };
    setValues(next);
    if (tried) setErrors(validate(next, days));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== "idle") return;
    setTried(true);
    const errs = validate(values, days);
    setErrors(errs);
    const firstBad = (["name", "email", "date"] as const).find((k) => errs[k]);
    if (firstBad) {
      const sel = firstBad === "date" ? 'input[name="date"]' : `[name="${firstBad}"]`;
      formRef.current?.querySelector<HTMLInputElement>(sel)?.focus();
      return;
    }
    setStatus("sending");
    timer.current = window.setTimeout(() => {
      setStatus("sent");
      const home = HOMES.find((h) => h.id === values.home);
      setAnnounce(
        `${UI.card.title} ${UI.card.for} ${values.name}: ${UI.card.visit} ${home ? "the " + home.name : UI.card.anyHome}, ${formatVisitDate(values.date)}, ${TIME_WORDS[values.time]}. ${COPY.night.confirmBody}`,
      );
      if (useJourney.getState().soundOn) sound.chime();
      // Keep the visitor's place: focus lands on the card (its label reads the invitation).
      requestAnimationFrame(() => cardRef.current?.focus({ preventScroll: true }));
    }, 900);
  };

  const edit = () => {
    setStatus("idle");
    setAnnounce("");
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>('[name="name"]')?.focus());
  };

  const field = (name: "name" | "email" | "phone", label: string, type: string, auto: string, optional = false) => {
    const id = `${uid}-${name}`;
    const err = name !== "phone" ? errors[name] : undefined;
    return (
      <div className={`vl-field vl-field--${name}`} data-invalid={err ? "1" : undefined}>
        <input
          id={id}
          name={name}
          type={type}
          autoComplete={auto}
          placeholder=" "
          value={values[name]}
          onChange={(e) => set(name, e.target.value)}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `${id}-err` : undefined}
          required={!optional}
          inputMode={type === "tel" ? "tel" : type === "email" ? "email" : undefined}
        />
        <label htmlFor={id}>
          {label}
          {optional && <span className="vl-field__opt"> · {UI.form.optional}</span>}
        </label>
        <span className="vl-field__line" aria-hidden="true" />
        {err && (
          <span className="vl-field__err" id={`${id}-err`}>
            {err}
          </span>
        )}
      </div>
    );
  };

  const choice = <T extends string>(name: "home" | "time", legend: string, options: readonly { id: T; label: string }[], current: T, onPick: (v: T) => void) => (
    <fieldset className="vl-choice">
      <legend>{legend}</legend>
      <div className="vl-choice__opts">
        {options.map((o) => {
          const id = `${uid}-${name}-${o.id}`;
          return (
            <span key={o.id} className="vl-choice__opt">
              <input type="radio" id={id} name={name} value={o.id} checked={current === o.id} onChange={() => onPick(o.id)} />
              <label htmlFor={id}>{o.label}</label>
            </span>
          );
        })}
      </div>
    </fieldset>
  );

  // Months the strip spans ("october · november"), shown beside the legend.
  const months = [...new Set(days.map((d) => d.month))].join(" · ");
  const dateErrId = `${uid}-date-err`;

  return (
    <div className="vl-invite" data-status={status}>
      {status !== "sent" ? (
        <form ref={formRef} className="vl-form" onSubmit={submit} noValidate aria-busy={status === "sending"}>
          <h3 className="vl-form__legend">{UI.form.legend}</h3>
          <div className="vl-form__grid">
            {field("name", UI.form.name, "text", "name")}
            {field("email", UI.form.email, "email", "email")}
            {field("phone", UI.form.phone, "tel", "tel", true)}
          </div>
          {choice<VisitHome>("home", UI.form.home, UI.form.homeOptions, values.home, (v) => set("home", v))}
          <fieldset className="vl-choice vl-days" data-invalid={errors.date ? "1" : undefined} aria-describedby={errors.date ? dateErrId : undefined}>
            <legend>
              {UI.form.date}
              {months && <span className="vl-days__month" aria-hidden="true">{months}</span>}
            </legend>
            <div className="vl-days__grid">
              {days.map((d) => {
                const id = `${uid}-date-${d.value}`;
                return (
                  <span key={d.value} className="vl-days__opt">
                    <input type="radio" id={id} name="date" value={d.value} checked={values.date === d.value} onChange={() => set("date", d.value)} />
                    <label htmlFor={id}>
                      <span className="vl-days__wd" aria-hidden="true">
                        {d.weekday}
                      </span>
                      <span className="vl-days__n" aria-hidden="true">
                        {d.day}
                      </span>
                      <span className="sr-only">{d.label}</span>
                    </label>
                  </span>
                );
              })}
            </div>
            {errors.date && (
              <span className="vl-field__err" id={dateErrId}>
                {errors.date}
              </span>
            )}
          </fieldset>
          {choice<VisitTime>("time", UI.form.time, UI.form.timeOptions, values.time, (v) => set("time", v))}
          <button type="submit" className="vl-btn vl-btn--solid vl-form__submit" disabled={status === "sending"}>
            <span>{status === "sending" ? UI.form.sending : COPY.night.submit}</span>
            {status === "sending" && <span className="vl-btn__progress" aria-hidden="true" />}
          </button>
        </form>
      ) : (
        <>
          <InvitationCard ref={cardRef} data={values} />
          <button type="button" className="vl-link vl-invite__edit" onClick={edit}>
            {UI.form.edit}
          </button>
        </>
      )}
      <p className="sr-only" aria-live="polite" role="status">
        {announce}
      </p>
    </div>
  );
}

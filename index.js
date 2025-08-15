import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Rocket, FileText, CheckCircle2, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Blossom.Launch – Single‑file App (Landing + Wizard + Scheduler)
 *
 * Fix for 405 error: This file now includes a resilient submit() that
 * attempts the POST to /api/brief and automatically falls back to a
 * "preview/mock" mode when the backend is not available (405/404/5xx
 * or network error). This lets you run the Canvas without a server.
 *
 * Tests: lightweight inline tests run in dev/preview to verify payload
 * shape and mock fallback behavior (see runInlineTests()).
 */

// Brand colors (hex)
const COLORS = {
  primaryGreen: "#00C853",
  primaryDark: "#0B0E14",
  primaryLight: "#F9FAFB",
};

// External: your HubSpot meeting URL (embedded after submit)
const HUBSPOT_MEETING_URL =
  "https://meetings.hubspot.com/oscar8/meet-with-oscar-from-blossom?uuid=11fb153a-154a-44f5-890c-349bd6ec4939";

// Serverless endpoint (Next.js / Vercel or Netlify function)
const SUBMIT_ENDPOINT = "/api/brief";

// ---------- Small UI helpers ----------
const Section = ({ id, className = "", children }) => (
  <section id={id} className={`mx-auto w-full max-w-6xl px-4 sm:px-6 ${className}`}>{children}</section>
);

const Field = ({ label, required, hint, children }) => (
  <label className="block">
    <span className="mb-2 block text-sm font-medium" style={{ color: COLORS.primaryDark }}>
      {label}
      {required ? <span className="text-red-500">*</span> : null}
    </span>
    {children}
    {hint ? <span className="mt-1 block text-xs text-neutral-500">{hint}</span> : null}
  </label>
);

const StepHeader = ({ stepIndex, steps }) => {
  const pct = Math.round(((stepIndex + 1) / steps.length) * 100);
  return (
    <div className="mb-6">
      <h2 className="text-3xl font-bold sm:text-4xl" style={{ color: COLORS.primaryDark }}>Start Your Sprint</h2>
      <p className="mt-2 max-w-2xl text-slate-700">
        This is your quick launch plan. <strong>No buzzwords, no tech overwhelm</strong> — just your idea, your
        vision, and the essentials we need to get you live in 14 days.
      </p>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS.primaryGreen }} />
      </div>
      <div className="mt-1 text-xs text-slate-600">Progress saved ✅</div>
    </div>
  );
};

// Plans
const plans = [
  { id: "pilot", name: "Pilot – Maintenance", price: "$100/mo", sub: "Setup fee waived (first 10)", details: ["Hosting/security/updates", "Backups & uptime monitoring", "Bug fixes"] },
  { id: "standard", name: "Standard – Setup + Maintenance", price: "$2,000 + $100/mo", sub: "After pilot", details: ["Everything in Pilot", "Handoff & training", "Launch checklist"] },
  { id: "pro", name: "Pro – Growth", price: "$500/mo", sub: "Optional upgrade", details: ["Monthly analytics review", "Content updates", "Automations"] },
];

const PlanCard = ({ plan, selected, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(plan.id)}
    className={`w-full rounded-xl border p-5 text-left shadow-sm transition hover:shadow-md ${selected ? "ring-2 ring-offset-1" : ""}`}
    style={{ borderColor: selected ? COLORS.primaryGreen : "#e5e7eb", boxShadow: selected ? `0 0 0 2px ${COLORS.primaryGreen}33` : undefined }}
  >
    <div className="flex items-center justify-between">
      <div>
        <div className="text-lg font-semibold" style={{ color: COLORS.primaryDark }}>{plan.name}</div>
        <div className="text-sm text-slate-600">{plan.sub}</div>
      </div>
      <div className="text-lg font-bold" style={{ color: COLORS.primaryGreen }}>{plan.price}</div>
    </div>
    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
      {plan.details.map((d, i) => (
        <li key={String(i)}>{d}</li>
      ))}
    </ul>
  </button>
);

// ---------- Submit helper with graceful fallback ----------
function normalizePayload(d) {
  // Ensure all values are serializable strings/bools for HubSpot/Notion
  return {
    name: String(d.name || ""),
    email: String(d.email || ""),
    company: String(d.company || ""),
    oneLiner: String(d.oneLiner || ""),
    customer: String(d.customer || ""),
    problem: String(d.problem || ""),
    success: String(d.success || ""),
    mustHaves: String(d.mustHaves || ""),
    niceToHaves: String(d.niceToHaves || ""),
    integrations: String(d.integrations || ""),
    assets: String(d.assets || ""),
    targetDate: String(d.targetDate || ""),
    deadline: String(d.deadline || ""),
    availability: String(d.availability || "same-day"),
    plan: String(d.plan || "pilot"),
    agreeScope: !!d.agreeScope,
    caseStudyOptIn: !!d.caseStudyOptIn,
  };
}

async function submitBrief(payload, endpoint = SUBMIT_ENDPOINT) {
  const body = JSON.stringify(normalizePayload(payload));
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (res.ok) return { ok: true, mode: "server" };
    // Non-OK: allow graceful preview if server rejects method/path
    if ([404, 405, 501].includes(res.status)) {
      console.warn(`[preview] Backend not available (${res.status}). Falling back to mock.`);
      await new Promise((r) => setTimeout(r, 400));
      return { ok: true, mode: "mock" };
    }
    // Other error codes are surfaced
    const text = await res.text();
    return { ok: false, error: `HTTP ${res.status}: ${text}` };
  } catch (err) {
    console.warn(`[preview] Network error. Falling back to mock.`, err);
    await new Promise((r) => setTimeout(r, 400));
    return { ok: true, mode: "mock" };
  }
}

// ---------- App ----------
export default function App() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [schedulerReady, setSchedulerReady] = useState(false);
  const [submitMode, setSubmitMode] = useState("server"); // "server" | "mock"
  const confirmRef = useRef(null);

  const [data, setData] = useState({
    name: "",
    email: "",
    company: "",
    oneLiner: "",
    customer: "",
    problem: "",
    success: "",
    mustHaves: "",
    niceToHaves: "",
    integrations: "",
    assets: "",
    targetDate: "",
    deadline: "",
    availability: "same-day",
    plan: "pilot",
    agreeScope: false,
    caseStudyOptIn: false,
  });

  const steps = [
    { id: "contact", title: "Contact" },
    { id: "vision", title: "Vision & Goals" },
    { id: "scope", title: "Scope" },
    { id: "timeline", title: "Timeline" },
    { id: "plan", title: "Plan" },
    { id: "review", title: "Review" },
    { id: "confirm", title: "Confirmation" },
  ];

  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  async function onSubmitBrief() {
    // Simple required validation before network
    if (!data.name || !data.email || !data.oneLiner || !data.customer || !data.problem || !data.success || !data.mustHaves || !data.integrations || !data.agreeScope) {
      alert("Please complete all required fields and confirm scope.");
      return;
    }

    setLoading(true);
    const result = await submitBrief(data);
    setLoading(false);

    if (result.ok) {
      setSubmitMode(result.mode || "server");
      setStep(steps.findIndex((x) => x.id === "confirm"));
      setTimeout(() => confirmRef.current && (confirmRef.current).scrollIntoView({ behavior: "smooth" }), 50);
    } else {
      console.error(result.error);
      alert(`We couldn't submit your brief. ${result.error}`);
    }
  }

  useEffect(() => {
    document.title = "Blossom.Launch – Let’s build it";
    runInlineTests();
  }, []);

  // ---- Step bodies ----
  const ContactStep = (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <Field label="Let’s start with your contact info 🌱" required>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input className="w-full rounded-md border px-3 py-2" style={{ borderColor: "#e5e7eb" }} placeholder="Your name" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} required />
          <input className="w-full rounded-md border px-3 py-2" style={{ borderColor: "#e5e7eb" }} placeholder="Your email" type="email" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} required />
        </div>
      </Field>
      <div className="mt-3">
        <input className="w-full rounded-md border px-3 py-2" style={{ borderColor: "#e5e7eb" }} placeholder="Company (optional)" value={data.company} onChange={(e) => setData({ ...data, company: e.target.value })} />
      </div>
      <NavButtons onBack={back} onNext={next} />
    </div>
  );

  const VisionGoalsStep = (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <Field label="Your idea in one sentence" required>
        <textarea rows={2} className="w-full rounded-md border px-3 py-2" style={{ borderColor: "#e5e7eb" }} value={data.oneLiner} onChange={(e) => setData({ ...data, oneLiner: e.target.value })} required />
      </Field>
      <div className="mt-4 grid grid-cols-1 gap-4">
        <Field label="Primary customer/user" required>
          <input className="w-full rounded-md border px-3 py-2" style={{ borderColor: "#e5e7eb" }} value={data.customer} onChange={(e) => setData({ ...data, customer: e.target.value })} required />
        </Field>
        <Field label="What problem are you solving?" required>
          <textarea rows={3} className="w-full rounded-md border px-3 py-2" style={{ borderColor: "#e5e7eb" }} value={data.problem} onChange={(e) => setData({ ...data, problem: e.target.value })} required />
        </Field>
        <Field label="What does success look like? (e.g., more qualified leads, bookings)" required>
          <input className="w-full rounded-md border px-3 py-2" style={{ borderColor: "#e5e7eb" }} value={data.success} onChange={(e) => setData({ ...data, success: e.target.value })} required />
        </Field>
      </div>
      <NavButtons onBack={back} onNext={next} />
    </div>
  );

  const ScopeStep = (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <Field label="Must‑have features for Day 1" required>
        <textarea rows={3} className="w-full rounded-md border px-3 py-2" style={{ borderColor: "#e5e7eb" }} value={data.mustHaves} onChange={(e) => setData({ ...data, mustHaves: e.target.value })} required />
      </Field>
      <div className="mt-4 grid grid-cols-1 gap-4">
        <Field label="Nice‑to‑haves for later (optional)">
          <textarea rows={3} className="w-full rounded-md border px-3 py-2" style={{ borderColor: "#e5e7eb" }} value={data.niceToHaves} onChange={(e) => setData({ ...data, niceToHaves: e.target.value })} />
        </Field>
        <Field label="Key integrations (Stripe, CRM, email, booking)" required>
          <input className="w-full rounded-md border px-3 py-2" style={{ borderColor: "#e5e7eb" }} value={data.integrations} onChange={(e) => setData({ ...data, integrations: e.target.value })} required />
        </Field>
        <Field label="Existing assets or links (brand, copy, images) (optional)">
          <input className="w-full rounded-md border px-3 py-2" style={{ borderColor: "#e5e7eb" }} placeholder="Paste any links (Drive, Figma, etc.)" value={data.assets} onChange={(e) => setData({ ...data, assets: e.target.value })} />
        </Field>
      </div>
      <NavButtons onBack={back} onNext={next} />
    </div>
  );

  const TimelineStep = (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="grid grid-cols-1 gap-4">
        <Field label="Target launch date (optional)">
          <input type="date" className="w-full rounded-md border px-3 py-2" style={{ borderColor: "#e5e7eb" }} value={data.targetDate} onChange={(e) => setData({ ...data, targetDate: e.target.value })} />
        </Field>
        <Field label="Hard deadlines/events (if any)">
          <input className="w-full rounded-md border px-3 py-2" style={{ borderColor: "#e5e7eb" }} value={data.deadline} onChange={(e) => setData({ ...data, deadline: e.target.value })} />
        </Field>
        <Field label="Availability for quick feedback">
          <select className="w-full rounded-md border px-3 py-2 bg-white" style={{ borderColor: "#e5e7eb" }} value={data.availability} onChange={(e) => setData({ ...data, availability: e.target.value })}>
            <option value="same-day">Same‑day</option>
            <option value="next-day">Next‑day</option>
            <option value="72hr">Within 72 hrs</option>
          </select>
        </Field>
      </div>
      <NavButtons onBack={back} onNext={next} />
    </div>
  );

  const PlanStep = (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <p className="mb-4 text-sm text-slate-600">Choose your plan. Pilot pricing is limited to the first 10 clients and waives the setup fee.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} selected={data.plan === p.id} onSelect={(id) => setData({ ...data, plan: id })} />
        ))}
      </div>
      <div className="mt-6 space-y-3">
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" className="mt-1" checked={data.agreeScope} onChange={(e) => setData({ ...data, agreeScope: e.target.checked })} />
          <span>
            I agree to the <strong>Included vs Additional</strong> scope: Day‑1 build, hosting/security/updates, backups, and bug fixes are included; new features, content production, SEO campaigns, and complex integrations may require a quote.
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" className="mt-1" checked={data.caseStudyOptIn} onChange={(e) => setData({ ...data, caseStudyOptIn: e.target.checked })} />
          <span>Okay to use my project as a case study (anonymously).</span>
        </label>
      </div>
      <NavButtons onBack={back} onNext={next} nextDisabled={!data.agreeScope} />
    </div>
  );

  const ReviewStep = (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold" style={{ color: COLORS.primaryDark }}>Review & confirm</h3>
      <p className="mb-4 text-sm text-slate-600">We’ll use this to kick off your sprint and prep your scheduler.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SummaryCard title="Contact" items={{ Name: data.name, Email: data.email, Company: data.company || "—" }} />
        <SummaryCard title="Vision & Goals" items={{ "One‑liner": data.oneLiner || "—", Customer: data.customer || "—", Problem: data.problem || "—", Success: data.success || "—" }} />
        <SummaryCard title="Scope" items={{ Musts: data.mustHaves || "—", Nice: data.niceToHaves || "—", Integrations: data.integrations || "—", Assets: data.assets || "—" }} />
        <SummaryCard title="Timeline & Plan" items={{ "Target date": data.targetDate || "—", Deadlines: data.deadline || "—", Availability: data.availability, Plan: plans.find((p) => p.id === data.plan)?.name || "" }} />
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button onClick={back} className="inline-flex items-center gap-2 rounded-md border px-5 py-3 font-semibold transition hover:bg-white" style={{ borderColor: "#e5e7eb", color: COLORS.primaryDark }}>
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <button onClick={onSubmitBrief} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 font-semibold text-white shadow-md transition hover:shadow-lg disabled:opacity-60" style={{ backgroundColor: COLORS.primaryGreen }}>
          {loading ? "Submitting…" : "Submit brief & continue"}
        </button>
      </div>
    </div>
  );

  const ConfirmationStep = (
    <div ref={confirmRef} className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5" style={{ color: COLORS.primaryGreen }} />
        <h3 className="text-lg font-semibold" style={{ color: COLORS.primaryDark }}>We’ve got your brief 🌱</h3>
      </div>
      <p className="mb-4 text-sm text-slate-700">Thanks! We’ll review and reply within 24 hours. Next, lock in your kickoff call so we can set your start date.</p>
      {submitMode === "mock" && (
        <div className="mb-4 rounded-md border p-3 text-sm" style={{ background: "#FFF8E1", borderColor: "#FDE68A", color: "#92400E" }}>
          Preview mode: backend is not connected in this Canvas, so your data wasn’t saved. The live site will create HubSpot & Notion records.
        </div>
      )}
      <div className="mt-4">
        {!schedulerReady ? (
          <div className="mb-3 rounded-md border bg-slate-50 p-4 text-sm text-slate-600" style={{ borderColor: "#e5e7eb" }}>
            Preparing your kickoff calendar…
          </div>
        ) : null}
        <iframe
          src={HUBSPOT_MEETING_URL}
          title="HubSpot Scheduler"
          className="h-[900px] w-full rounded-md border"
          style={{ borderColor: "#e5e7eb" }}
          onLoad={() => setSchedulerReady(true)}
          allow="geolocation *; microphone *; camera *;"
        />
      </div>
    </div>
  );

  const stepBody = [ContactStep, VisionGoalsStep, ScopeStep, TimelineStep, PlanStep, ReviewStep, ConfirmationStep][step];

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: COLORS.primaryLight }}>
      {/* HEADER */}
      <header className="border-b bg-white/80 backdrop-blur">
        <Section className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md" style={{ backgroundColor: COLORS.primaryGreen }} />
            <span className="text-sm font-semibold" style={{ color: COLORS.primaryDark }}>Blossom.Launch</span>
          </div>
          <nav className="hidden gap-6 sm:flex text-sm">
            <a href="#why" className="underline-offset-4 hover:underline">Why us</a>
            <a href="#how" className="underline-offset-4 hover:underline">How it works</a>
            <a href="#plans" className="underline-offset-4 hover:underline">Plans</a>
            <a href="#wizard" className="underline-offset-4 hover:underline">Start your sprint</a>
          </nav>
          <a href="#wizard" className="rounded-md px-4 py-2 font-semibold text-white shadow-sm" style={{ backgroundColor: COLORS.primaryGreen }}>Start your sprint</a>
        </Section>
      </header>

      {/* HERO (dark) */}
      <div className="relative overflow-hidden border-b" style={{ backgroundColor: COLORS.primaryDark }}>
        <Section className="grid items-center gap-10 py-16 sm:grid-cols-2 sm:py-20 text-white">
          <div>
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium" style={{ backgroundColor: `#00C8531a`, color: "#fff" }}>Let’s build it — without the overwhelm.</span>
            <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">A done‑for‑you website sprint that ships in 14 days</h1>
            <p className="mt-4 max-w-xl text-base sm:text-lg text-slate-200">
              We handle the tech, templates, and launch checklists — you focus on the business. No janky hand‑offs, no endless emails, just a clean build you own.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#wizard" className="inline-flex items-center gap-2 rounded-md px-5 py-3 font-semibold text-white shadow-md transition hover:shadow-lg" style={{ backgroundColor: COLORS.primaryGreen }}>
                Start Your Sprint <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#how" className="inline-flex items-center gap-2 rounded-md border px-5 py-3 font-semibold transition hover:bg-white/5" style={{ borderColor: "#334155", color: "#fff" }}>
                How it works
              </a>
            </div>
            <div className="mt-6 text-sm text-slate-300">Pilot: first 10 clients at <strong>$100/mo</strong>, setup fee waived.</div>
          </div>
          <div className="rounded-xl border p-6 shadow-sm" style={{ background: "rgba(255,255,255,0.04)", borderColor: "#334155" }}>
            <div className="mb-2 text-sm font-semibold">What you get</div>
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-200">
              <li>Clean, minimal design with delightful details</li>
              <li>Hosting, security updates, backups included</li>
              <li>Kickoff → build → launch in 14 days</li>
              <li>Handoff you can actually own</li>
            </ul>
          </div>
        </Section>
      </div>

      {/* WHY US */}
      <Section id="why" className="py-14">
        <h2 className="mb-6 text-2xl font-bold sm:text-3xl" style={{ color: COLORS.primaryDark }}>Why choose Blossom.Launch?</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { title: "No tech overwhelm", text: "We manage the stack, updates, and integrations. You get a working site." },
            { title: "Speed without shortcuts", text: "Opinionated templates + QA checklist = quality in 14 days." },
            { title: "You own it", text: "Fully transferable build with docs. Keep us, or run it yourself." },
          ].map((f, i) => (
            <div key={String(i)} className="rounded-xl border bg-white p-6 shadow-sm">
              <div className="text-lg font-semibold" style={{ color: COLORS.primaryDark }}>{f.title}</div>
              <p className="mt-2 text-sm text-slate-700">{f.text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* HOW IT WORKS */}
      <Section id="how" className="py-14">
        <h2 className="mb-6 text-2xl font-bold sm:text-3xl" style={{ color: COLORS.primaryDark }}>How it works</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            { icon: <FileText className="h-6 w-6" />, title: "Share your brief", text: "Tell us goals, vibe, and must‑haves. Keep it simple." },
            { icon: <Calendar className="h-6 w-6" />, title: "Book kickoff", text: "Pick a time right after submitting your brief." },
            { icon: <Rocket className="h-6 w-6" />, title: "Sprint + launch", text: "We build fast with beautiful defaults and QA." },
          ].map((item, i) => (
            <div key={String(i)} className="rounded-xl border bg-white p-6 shadow-sm">
              <div className="mb-3 inline-flex rounded-lg p-2" style={{ backgroundColor: `#00C8531a`, color: COLORS.primaryGreen }}>
                {item.icon}
              </div>
              <div className="text-lg font-semibold" style={{ color: COLORS.primaryDark }}>{item.title}</div>
              <p className="mt-1 text-sm text-slate-700">{item.text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* PLANS TEASER */}
      <Section id="plans" className="py-14">
        <h2 className="mb-6 text-2xl font-bold sm:text-3xl" style={{ color: COLORS.primaryDark }}>Pilot pricing</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {plans.map((p) => (
            <div key={p.id} className="rounded-xl border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold" style={{ color: COLORS.primaryDark }}>{p.name}</div>
                  <div className="text-sm text-slate-600">{p.sub}</div>
                </div>
                <div className="text-lg font-bold" style={{ color: COLORS.primaryGreen }}>{p.price}</div>
              </div>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {p.details.map((d, i) => (<li key={String(i)}>{d}</li>))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <a href="#wizard" className="rounded-md px-5 py-3 font-semibold text-white shadow-md" style={{ backgroundColor: COLORS.primaryGreen }}>Claim a pilot spot</a>
          <div className="mt-2 text-xs text-slate-600">Only 10 spots at $100/mo — setup fee waived.</div>
        </div>
      </Section>

      {/* INTAKE WIZARD */}
      <Section id="wizard" className="pt-10 pb-8">
        <StepHeader stepIndex={step} steps={steps} />
        <AnimatePresence mode="wait">
          <motion.div key={String(step)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
            {stepBody}
          </motion.div>
        </AnimatePresence>
      </Section>

      {/* FOOTER */}
      <footer className="border-t py-8">
        <Section>
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-sm text-neutral-600">© {String(new Date().getFullYear())} Blossom.Launch</p>
            <div className="flex items-center gap-3 text-sm">
              <a href="#why" className="underline-offset-4 hover:underline">Why us</a>
              <a href="#how" className="underline-offset-4 hover:underline">How it works</a>
              <a href="#wizard" className="underline-offset-4 hover:underline">Start your sprint</a>
            </div>
          </div>
        </Section>
      </footer>
    </div>
  );
}

function SummaryCard({ title, items }) {
  return (
    <div className="rounded-xl border p-4 shadow-sm" style={{ borderColor: "#e5e7eb", background: "white" }}>
      <div className="mb-2 text-sm font-semibold" style={{ color: COLORS.primaryDark }}>{title}</div>
      <dl className="space-y-1 text-sm text-slate-700">
        {Object.entries(items).map(([k, v]) => (
          <div key={String(k)} className="grid grid-cols-3 gap-2">
            <dt className="col-span-1 text-slate-500">{String(k)}</dt>
            <dd className="col-span-2">{String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function NavButtons({ onBack, onNext, nextDisabled }) {
  return (
    <div className="mt-6 flex items-center justify-between">
      <button onClick={onBack} className="inline-flex items-center gap-2 rounded-md border px-5 py-3 font-semibold transition hover:bg-white" style={{ borderColor: "#e5e7eb", color: COLORS.primaryDark }}>
        <ChevronLeft className="h-4 w-4" /> Back
      </button>
      <button onClick={onNext} disabled={!!nextDisabled} className="inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 font-semibold text-white shadow-md transition hover:shadow-lg disabled:opacity-60" style={{ backgroundColor: COLORS.primaryGreen }}>
        Next <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ---------- Inline tests (run in preview) ----------
function runInlineTests() {
  try {
    const base = {
      name: "Jane Founder",
      email: "jane@demo.co",
      oneLiner: "A thing",
      customer: "SMBs",
      problem: "No time",
      success: "More leads",
      mustHaves: "Booking form",
      integrations: "Stripe, HubSpot",
      agreeScope: true,
    };

    // Test 1: normalizePayload produces strings/bools only
    const n = normalizePayload(base);
    const onlyValid = Object.values(n).every((v) => typeof v === "string" || typeof v === "boolean");
    if (!onlyValid) throw new Error("normalizePayload produced invalid types");

    // Test 2: mock fallback triggers on invalid endpoint
    submitBrief(base, "/__invalid__").then((r) => {
      if (!(r.ok && r.mode === "mock")) {
        console.warn("Test 2 failed: mock fallback not triggered");
      } else {
        console.log("Tests OK: payload + mock fallback working");
      }
    });
  } catch (err) {
    console.warn("Inline tests encountered an error", err);
  }
}

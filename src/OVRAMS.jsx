import React, { useState, useMemo, useEffect } from "react";
import { supabase } from "./supabaseClient";
import {
  Truck, Users, Calendar, FileText, Bell, LayoutGrid,
  ClipboardCheck, CheckCircle2, XCircle, ArrowLeftRight, Plus, Trash2,
  Search, ChevronRight, User, Gauge, ShieldCheck, AlertTriangle, Printer,
  Menu, Lock, LogOut, Eye, EyeOff,
} from "lucide-react";

/* ----------------------------------------------------------------------
   OVRAMS — Organization Vehicle Request & Approval Management System
   Interactive demo: login for each role, role-based views, full
   MOYAS-F07 workflow, conflict detection, dashboard, request list.
   In-memory state only.
------------------------------------------------------------------------*/

const SERIF = "'Source Serif 4', Georgia, serif";
const SANS = "'IBM Plex Sans', system-ui, sans-serif";

const COLORS = {
  ink: "#2C2C2C",
  inkSoft: "#5B5B54",
  paper: "#F6F4EE",
  paperDark: "#EDEAE1",
  line: "#D9D4C6",
  green: "#1B3A2F",
  greenSoft: "#3D5A4C",
  amber: "#B5842E",
  amberBg: "#F3E7D2",
  red: "#7A1F1F",
  redBg: "#F3E1DF",
  blueGrey: "#3D5568",
};

/* ---------------- Status model ---------------- */
const STATUS = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  DIVISION_REVIEW: "Division Head Review",
  DIVISION_APPROVED: "Division Head Approved",
  VEHICLE_REVIEW: "Vehicle Division Review",
  VEHICLE_ASSIGNED: "Vehicle & Driver Assigned",
  FINAL_REVIEW: "Final Approval Pending",
  APPROVED: "Approved / Vehicle Allocated",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  RETURNED: "Returned for Correction",
  CANCELLED: "Cancelled",
  UNAVAILABLE: "Vehicle Unavailable",
};

const STATUS_STYLE = (s) => {
  if (s === STATUS.APPROVED || s === STATUS.COMPLETED)
    return { bg: "#E4EAE3", fg: COLORS.green, border: COLORS.green };
  if (s === STATUS.REJECTED || s === STATUS.UNAVAILABLE)
    return { bg: COLORS.redBg, fg: COLORS.red, border: COLORS.red };
  if (s === STATUS.RETURNED || s === STATUS.CANCELLED)
    return { bg: "#EDEAE1", fg: COLORS.inkSoft, border: COLORS.line };
  return { bg: COLORS.amberBg, fg: COLORS.amber, border: COLORS.amber };
};

const WORKFLOW_ORDER = [
  STATUS.DRAFT, STATUS.SUBMITTED, STATUS.DIVISION_REVIEW, STATUS.DIVISION_APPROVED,
  STATUS.VEHICLE_REVIEW, STATUS.VEHICLE_ASSIGNED, STATUS.FINAL_REVIEW,
  STATUS.APPROVED, STATUS.COMPLETED,
];

/* ---------------- Demo data ---------------- */
const DIVISIONS = ["Administration", "Finance", "Engineering", "Human Resources", "Legal Affairs"];

/* USERS (plaintext demo credentials) has been removed — Stage 1B replaced
   it with real Supabase Auth. Identity data now lives in app_users (loaded
   into DB_USERS_BY_ID at runtime), and passwords are handled entirely by
   Supabase Auth, never stored or checked in this file. */

const ROLE_LABEL = {
  applicant: "Applicant",
  division_head: "Division Head",
  transport_officer: "Transport Officer",
  final_approver: "Final Approving Officer",
  admin: "System Administrator",
};

const VEHICLES_SEED = [
  { id: "v1", reg: "WP-KA-1234", type: "Van", model: "Toyota HiAce (2019)", status: "Available", meter: 82011 },
  { id: "v2", reg: "WP-KB-5566", type: "Car", model: "Toyota Axio (2021)", status: "Available", meter: 41302 },
  { id: "v3", reg: "WP-CAB-8890", type: "Double Cab", model: "Mitsubishi L200 (2018)", status: "Maintenance", meter: 63120 },
  { id: "v4", reg: "WP-KC-2210", type: "Car", model: "Nissan Sunny (2020)", status: "Available", meter: 58790 },
  { id: "v5", reg: "WP-NB-4471", type: "Bus", model: "Ashok Leyland (2016)", status: "Available", meter: 121004 },
];

const DRIVERS_SEED = [
  { id: "d1", name: "P. Silva", empNo: "DRV-0021", contact: "071-2223344", license: "B1122334", expiry: "2027-04-10", status: "Active" },
  { id: "d2", name: "T. Kumara", empNo: "DRV-0033", contact: "077-5566778", license: "B2233445", expiry: "2026-11-02", status: "Active" },
  { id: "d3", name: "L. Rathnayake", empNo: "DRV-0041", contact: "070-9988776", license: "B3344556", expiry: "2027-01-18", status: "On Leave" },
];

/* ---------------- Supabase <-> app data mapping ----------------
   The database uses snake_case columns and separate tables for
   officers/history; the rest of the app expects the original
   camelCase shape used by REQUESTS_SEED. These helpers translate
   both ways so the rest of the app doesn't need to change. */
function dbRequestToApp(row, officersRows, historyRows) {
  return {
    id: row.id,
    applicantId: row.applicant_id,
    division: row.division,
    purpose: row.purpose,
    startingLocation: row.starting_location,
    destinationLocation: row.destination_location,
    start: row.start_time,
    end: row.end_time,
    officers: (officersRows || [])
      .filter((o) => o.request_id === row.id)
      .map((o) => ({ name: o.name, designation: o.designation, dept: o.dept })),
    adequateSpace: row.adequate_space,
    status: row.status,
    history: (historyRows || [])
      .filter((h) => h.request_id === row.id)
      .sort((a, b) => new Date(a.at) - new Date(b.at))
      .map((h) => ({ who: h.who, action: h.action, at: h.at, comment: h.comment })),
    vehicleId: row.vehicle_id,
    driverId: row.driver_id,
    meter: row.meter,
    observation: row.observation,
  };
}

async function loadRequestsFromDb() {
  const [{ data: reqRows, error: reqErr }, { data: offRows, error: offErr }, { data: histRows, error: histErr }] =
    await Promise.all([
      supabase.from("requests").select("*").order("created_at", { ascending: false }),
      supabase.from("request_officers").select("*"),
      supabase.from("request_history").select("*"),
    ]);
  if (reqErr || offErr || histErr) {
    console.error(reqErr || offErr || histErr);
    return { data: null, error: reqErr || offErr || histErr };
  }
  return { data: reqRows.map((r) => dbRequestToApp(r, offRows, histRows)), error: null };
}

const REQUESTS_SEED = [
  {
    id: "REQ-2026-0142", applicantId: "u1", division: "Administration",
    purpose: "Attend inter-ministerial coordination meeting",
    startingLocation: "Ministry HQ", destinationLocation: "BMICH, Colombo 07",
    start: "2026-09-05T08:00", end: "2026-09-05T17:00",
    officers: [{ name: "R. Jayasuriya", designation: "Assistant Registrar", dept: "Administration" }],
    adequateSpace: "Yes",
    status: STATUS.SUBMITTED,
    history: [{ who: "R. Jayasuriya", action: "Submitted request", at: "2026-09-01T09:12" }],
    vehicleId: null, driverId: null, meter: null, observation: "",
  },
  {
    id: "REQ-2026-0139", applicantId: "u2", division: "Engineering",
    purpose: "Site inspection of bridge construction project",
    startingLocation: "Ministry HQ", destinationLocation: "Kalutara District",
    start: "2026-09-04T06:30", end: "2026-09-04T19:00",
    officers: [
      { name: "N. Fernando", designation: "Programme Officer", dept: "Engineering" },
      { name: "D. Gunasekara", designation: "Site Engineer", dept: "Engineering" },
    ],
    adequateSpace: "Yes",
    status: STATUS.DIVISION_APPROVED,
    history: [
      { who: "N. Fernando", action: "Submitted request", at: "2026-08-30T10:03" },
      { who: "S. Perera", action: "Approved (Division Head)", at: "2026-08-30T15:40" },
    ],
    vehicleId: null, driverId: null, meter: null, observation: "",
  },
  {
    id: "REQ-2026-0136", applicantId: "u1", division: "Administration",
    purpose: "Deliver documents to Provincial Office",
    startingLocation: "Ministry HQ", destinationLocation: "Kandy Provincial Office",
    start: "2026-09-03T07:00", end: "2026-09-03T18:00",
    officers: [{ name: "R. Jayasuriya", designation: "Assistant Registrar", dept: "Administration" }],
    adequateSpace: "Yes", status: STATUS.VEHICLE_ASSIGNED,
    history: [
      { who: "R. Jayasuriya", action: "Submitted request", at: "2026-08-28T09:00" },
      { who: "K. Wickramasinghe", action: "Approved (Division Head)", at: "2026-08-28T14:22" },
      { who: "M. Bandara", action: "Vehicle & driver assigned", at: "2026-08-29T08:15" },
    ],
    vehicleId: "v2", driverId: "d1", meter: 41302, observation: "Vehicle in good condition, full tank.",
  },
  {
    id: "REQ-2026-0128", applicantId: "u2", division: "Engineering",
    purpose: "Training workshop attendance",
    startingLocation: "Ministry HQ", destinationLocation: "NIBM, Colombo 07",
    start: "2026-08-25T08:00", end: "2026-08-25T16:00",
    officers: [{ name: "N. Fernando", designation: "Programme Officer", dept: "Engineering" }],
    adequateSpace: "Yes",
    status: STATUS.APPROVED,
    history: [
      { who: "N. Fernando", action: "Submitted request", at: "2026-08-20T09:00" },
      { who: "S. Perera", action: "Approved (Division Head)", at: "2026-08-20T13:00" },
      { who: "M. Bandara", action: "Vehicle & driver assigned", at: "2026-08-21T09:00" },
      { who: "A. Additional Secretary", action: "Final approval granted", at: "2026-08-21T15:00" },
    ],
    vehicleId: "v4", driverId: "d2", meter: 58790, observation: "Routine local trip.",
  },
  {
    id: "REQ-2026-0119", applicantId: "u1", division: "Administration",
    purpose: "Personal errand request (test rejection)",
    startingLocation: "Ministry HQ", destinationLocation: "Negombo",
    start: "2026-08-15T08:00", end: "2026-08-15T12:00",
    officers: [{ name: "R. Jayasuriya", designation: "Assistant Registrar", dept: "Administration" }],
    adequateSpace: "No",
    status: STATUS.REJECTED,
    history: [
      { who: "R. Jayasuriya", action: "Submitted request", at: "2026-08-10T09:00" },
      { who: "K. Wickramasinghe", action: "Rejected (Division Head)", at: "2026-08-10T11:00", comment: "Not an official duty." },
    ],
    vehicleId: null, driverId: null, meter: null, observation: "",
  },
  {
    id: "REQ-2026-0101", applicantId: "u2", division: "Engineering",
    purpose: "Quarterly asset audit visit",
    startingLocation: "Ministry HQ", destinationLocation: "Galle Regional Office",
    start: "2026-07-20T07:00", end: "2026-07-20T19:00",
    officers: [{ name: "N. Fernando", designation: "Programme Officer", dept: "Engineering" }],
    adequateSpace: "Yes",
    status: STATUS.COMPLETED,
    history: [
      { who: "N. Fernando", action: "Submitted request", at: "2026-07-15T09:00" },
      { who: "S. Perera", action: "Approved (Division Head)", at: "2026-07-15T12:00" },
      { who: "M. Bandara", action: "Vehicle & driver assigned", at: "2026-07-16T09:00" },
      { who: "A. Additional Secretary", action: "Final approval granted", at: "2026-07-16T14:00" },
      { who: "M. Bandara", action: "Trip marked completed", at: "2026-07-20T20:00" },
    ],
    vehicleId: "v1", driverId: "d1", meter: 82011, observation: "Completed without incident.",
  },
];

/* ---------------- Helpers ---------------- */
function fmtDT(s) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function fmtD(s) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}
function overlaps(aStart, aEnd, bStart, bEnd) {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}
/* userById resolves against DB_USERS_BY_ID, populated at runtime from the
   live app_users table (see the loadAll effect in the main app component). */
let DB_USERS_BY_ID = {};
function userById(id) {
  return DB_USERS_BY_ID[id];
}
/* A Division Head account can either be scoped to one specific division
   (division === that division's exact name) or be the shared account with
   authority over all divisions (division === "All Divisions"). */
function divisionHeadCanAct(user, requestDivision) {
  return user.division === "All Divisions" || user.division === requestDivision;
}
/* vehicleById/driverById resolve against live Supabase-loaded arrays,
   populated at runtime (see DB_VEHICLES_BY_ID / DB_DRIVERS_BY_ID below),
   since request.vehicleId/driverId are now real database UUIDs rather
   than the old hardcoded seed ids. */
let DB_VEHICLES_BY_ID = {};
let DB_DRIVERS_BY_ID = {};
function vehicleById(id) {
  return DB_VEHICLES_BY_ID[id] || VEHICLES_SEED.find((v) => v.id === id);
}
function driverById(id) {
  return DB_DRIVERS_BY_ID[id] || DRIVERS_SEED.find((d) => d.id === id);
}

/* ---------------- Small UI atoms ---------------- */
function Badge({ status }) {
  const s = STATUS_STYLE(status);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 10px", fontSize: 12.5, fontFamily: SANS, fontWeight: 600,
      color: s.fg, background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 3, letterSpacing: 0.1, whiteSpace: "nowrap",
    }}>
      {status}
    </span>
  );
}

function SectionCard({ label, title, children, right }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 4, marginBottom: 16 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 20px", background: COLORS.paperDark, borderBottom: `1px solid ${COLORS.line}`,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          {label && (
            <span style={{ fontFamily: SANS, fontSize: 11.5, fontWeight: 700, color: COLORS.greenSoft }}>
              {label}
            </span>
          )}
          <h3 style={{ fontFamily: SERIF, fontSize: 17, margin: 0, color: COLORS.ink, fontWeight: 600 }}>{title}</h3>
        </div>
        {right}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: SANS, fontSize: 12, color: COLORS.inkSoft, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", icon: Icon, disabled, small, type }) {
  const styles = {
    primary: { bg: COLORS.green, fg: "#fff", border: COLORS.green },
    danger: { bg: "#fff", fg: COLORS.red, border: COLORS.red },
    ghost: { bg: "#fff", fg: COLORS.ink, border: COLORS.line },
    amber: { bg: COLORS.amber, fg: "#fff", border: COLORS.amber },
  }[variant];
  return (
    <button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        fontFamily: SANS, fontSize: small ? 12.5 : 13.5, fontWeight: 600,
        padding: small ? "6px 12px" : "9px 16px", borderRadius: 3,
        background: disabled ? "#E4E1D8" : styles.bg,
        color: disabled ? "#9A9686" : styles.fg,
        border: `1px solid ${disabled ? "#D9D4C6" : styles.border}`,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "opacity .15s",
      }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.opacity = "0.85"; }}
      onMouseUp={(e) => { e.currentTarget.style.opacity = "1"; }}
    >
      {Icon && <Icon size={small ? 14 : 15} />}
      {children}
    </button>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      style={{
        width: "100%", fontFamily: SANS, fontSize: 14, padding: "8px 10px",
        border: `1px solid ${COLORS.line}`, borderRadius: 3, color: COLORS.ink,
        background: "#fff", boxSizing: "border-box",
        ...(props.style || {}),
      }}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      style={{
        width: "100%", fontFamily: SANS, fontSize: 14, padding: "8px 10px",
        border: `1px solid ${COLORS.line}`, borderRadius: 3, color: COLORS.ink,
        background: "#fff", boxSizing: "border-box",
        ...(props.style || {}),
      }}
    >
      {props.children}
    </select>
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%", fontFamily: SANS, fontSize: 14, padding: "8px 10px",
        border: `1px solid ${COLORS.line}`, borderRadius: 3, color: COLORS.ink,
        background: "#fff", boxSizing: "border-box", resize: "vertical", minHeight: 70,
        ...(props.style || {}),
      }}
    />
  );
}

function Stat({ label, value, accent }) {
  return (
    <div style={{ flex: "1 1 140px", background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 4, padding: "14px 16px" }}>
      <div style={{ fontFamily: SERIF, fontSize: 28, color: accent || COLORS.ink, fontWeight: 600, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: SANS, fontSize: 12.5, color: COLORS.inkSoft, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function MiniBars({ data, colorFn }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 120, padding: "0 4px" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ fontFamily: SANS, fontSize: 11, color: COLORS.inkSoft }}>{d.value}</div>
          <div style={{
            width: "100%", maxWidth: 34, height: Math.max(6, (d.value / max) * 84),
            background: colorFn ? colorFn(d) : COLORS.greenSoft, borderRadius: "2px 2px 0 0",
          }} />
          <div style={{ fontFamily: SANS, fontSize: 10.5, color: COLORS.inkSoft, textAlign: "center" }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ================= AUTH SCREENS ================= */
/* Stage 1B: real authentication via Supabase Auth.
   - Applicants can sign up for their own account, or log in, or reset a
     forgotten password.
   - The four fixed-role accounts (Division Head, Transport Officer, Final
     Approving Officer, System Administrator) are created once by an admin
     directly in Supabase and never self-register; they can only log in or
     reset a forgotten password.
   Login is by username (not email) for a friendlier experience, so we
   first look up the username's associated email in app_users, then hand
   that email + the entered password to Supabase Auth to actually verify. */

async function lookupEmailByUsername(username) {
  const { data, error } = await supabase
    .from("app_users")
    .select("email, role")
    .ilike("username", username.trim())
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

function AuthGate({ onLogin }) {
  const [mode, setMode] = useState("login"); // 'login' | 'signup' | 'forgot'
  const [checkingConfirmation, setCheckingConfirmation] = useState(true);

  /* If someone arrives here with a valid Supabase Auth session but no
     matching app_users row yet, it means they just clicked an email
     confirmation link from signup. Finish creating their profile now
     (using the metadata stashed at signup time) and log them straight in,
     instead of making them log in a second time. */
  useEffect(() => {
    let cancelled = false;
    async function finishPendingSignup() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        if (!cancelled) setCheckingConfirmation(false);
        return;
      }

      const { data: existingProfile } = await supabase
        .from("app_users")
        .select("*")
        .eq("auth_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (existingProfile) {
        onLogin(existingProfile);
        return;
      }

      // No profile yet but a real session exists — this must be a
      // freshly-confirmed applicant signup. Create their profile from the
      // metadata we saved during signUp().
      const meta = user.user_metadata || {};
      if (meta.username) {
        const { data: newProfile, error: insertError } = await supabase
          .from("app_users")
          .insert({
            auth_id: user.id,
            name: meta.name || meta.username,
            designation: meta.designation || null,
            division: meta.division || null,
            role: "applicant",
            username: meta.username,
            email: user.email,
          })
          .select()
          .single();

        if (!cancelled) {
          setCheckingConfirmation(false);
          if (!insertError && newProfile) {
            onLogin(newProfile);
          }
          // If it failed (e.g. username taken by the time they confirmed),
          // fall through to the normal login screen; they can contact the
          // administrator or try logging in directly.
        }
        return;
      }

      if (!cancelled) setCheckingConfirmation(false);
    }
    finishPendingSignup();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checkingConfirmation) {
    return (
      <AuthShell title="One moment…">
        <div style={{ fontFamily: SANS, fontSize: 13, color: COLORS.inkSoft, textAlign: "center", padding: "20px 0" }}>
          Checking your account…
        </div>
      </AuthShell>
    );
  }

  if (mode === "signup") return <SignupScreen onDone={() => setMode("login")} onLogin={onLogin} />;
  if (mode === "forgot") return <ForgotPasswordScreen onBack={() => setMode("login")} />;
  return <LoginScreen onLogin={onLogin} onGoSignup={() => setMode("signup")} onGoForgot={() => setMode("forgot")} />;
}

function AuthShell({ title, children }) {
  return (
    <div style={{
      fontFamily: SANS, background: COLORS.paper, minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::selection { background: ${COLORS.amberBg}; }
      `}</style>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 22 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 8, background: COLORS.green,
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12,
          }}>
            <Truck size={26} color="#fff" />
          </div>
          <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 21, color: COLORS.ink }}>OVRAMS</div>
          <div style={{ fontFamily: SANS, fontSize: 12, color: COLORS.inkSoft, letterSpacing: 0.2, marginTop: 2 }}>
            Vehicle Request &amp; Approval Management System
          </div>
        </div>
        <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 5, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px 16px", borderBottom: `1px solid ${COLORS.line}`, background: COLORS.paperDark }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Lock size={15} color={COLORS.greenSoft} />
              <h2 style={{ fontFamily: SERIF, fontSize: 17, margin: 0, color: COLORS.ink, fontWeight: 600 }}>
                {title}
              </h2>
            </div>
          </div>
          <div style={{ padding: 24 }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

function ErrorBanner({ children }) {
  if (!children) return null;
  return (
    <div style={{
      display: "flex", gap: 8, alignItems: "center", background: COLORS.redBg,
      color: COLORS.red, padding: "9px 12px", borderRadius: 3, fontSize: 12.5,
      marginBottom: 14, fontFamily: SANS,
    }}>
      <AlertTriangle size={14} style={{ flexShrink: 0 }} /> {children}
    </div>
  );
}
function SuccessBanner({ children }) {
  if (!children) return null;
  return (
    <div style={{
      display: "flex", gap: 8, alignItems: "center", background: "#eaf6ec",
      color: COLORS.green, padding: "9px 12px", borderRadius: 3, fontSize: 12.5,
      marginBottom: 14, fontFamily: SANS,
    }}>
      <CheckCircle2 size={14} style={{ flexShrink: 0 }} /> {children}
    </div>
  );
}

function PasswordField({ value, onChange, placeholder, autoFocus }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <Input
        autoFocus={autoFocus}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder || "Enter password"}
        style={{ paddingRight: 38 }}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        style={{
          position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", cursor: "pointer", color: COLORS.inkSoft,
          display: "flex", alignItems: "center", padding: 4,
        }}
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function LoginScreen({ onLogin, onGoSignup, onGoForgot }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    setLoading(true);

    const lookup = await lookupEmailByUsername(username);
    if (!lookup || !lookup.email) {
      setLoading(false);
      setError("Incorrect username or password.");
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: lookup.email,
      password,
    });

    if (authError || !authData.user) {
      setLoading(false);
      setError("Incorrect username or password.");
      return;
    }

    // Fetch the full profile row to pass into the app.
    const { data: profile, error: profileError } = await supabase
      .from("app_users")
      .select("*")
      .eq("auth_id", authData.user.id)
      .maybeSingle();

    setLoading(false);

    if (profileError || !profile) {
      setError("Your account could not be found. Contact the system administrator.");
      return;
    }

    onLogin(profile);
  }

  return (
    <AuthShell title="Log In">
      <form onSubmit={handleSubmit}>
        <Field label="Username">
          <Input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. rjayasuriya"
          />
        </Field>
        <Field label="Password">
          <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>

        <ErrorBanner>{error}</ErrorBanner>

        <Btn type="submit" onClick={handleSubmit} icon={Lock} disabled={loading}>
          {loading ? "Checking…" : "Log In"}
        </Btn>

        <div style={{
          marginTop: 16, display: "flex", justifyContent: "space-between",
          fontFamily: SANS, fontSize: 12.5,
        }}>
          <button type="button" onClick={onGoForgot} style={{ background: "none", border: "none", color: COLORS.greenSoft, cursor: "pointer", padding: 0, fontFamily: SANS, fontSize: 12.5 }}>
            Forgot password?
          </button>
          <button type="button" onClick={onGoSignup} style={{ background: "none", border: "none", color: COLORS.greenSoft, cursor: "pointer", padding: 0, fontFamily: SANS, fontSize: 12.5 }}>
            New applicant? Create an account
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

function SignupScreen({ onDone, onLogin }) {
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [division, setDivision] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!name.trim() || !username.trim() || !email.trim() || !password) {
      setError("Please fill in all required fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    // Make sure the username isn't already taken.
    const { data: existing } = await supabase
      .from("app_users")
      .select("id")
      .ilike("username", username.trim())
      .maybeSingle();
    if (existing) {
      setLoading(false);
      setError("That username is already taken. Please choose another.");
      return;
    }

    // The profile fields are stored as Supabase Auth user metadata at
    // signup time. We can't create the app_users row yet if email
    // confirmation is required (there's no active session, so RLS
    // correctly blocks the insert) — instead, the row gets created right
    // after they successfully enter the 6-digit code we email them (see
    // handleVerifyCode below).
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          name: name.trim(),
          designation: designation.trim() || null,
          division: division.trim() || null,
          username: username.trim(),
        },
      },
    });

    setLoading(false);

    if (authError || !authData.user) {
      setError(authError ? authError.message : "Could not create account. Please try again.");
      return;
    }

    if (authData.session) {
      // Email confirmation is off — session exists immediately, so we can
      // create the profile row right now without needing a code at all.
      const { data: profile, error: profileError } = await supabase
        .from("app_users")
        .insert({
          auth_id: authData.user.id,
          name: name.trim(),
          designation: designation.trim() || null,
          division: division.trim() || null,
          role: "applicant",
          username: username.trim(),
          email: email.trim(),
        })
        .select()
        .single();

      if (profileError || !profile) {
        setError("Account created, but your profile could not be saved. Contact the system administrator.");
        return;
      }
      onLogin(profile);
    } else {
      // Email confirmation is required — show the code-entry screen next.
      setAwaitingConfirmation(true);
      setResendCooldown(30);
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault();
    setVerifyError("");
    if (!code.trim()) {
      setVerifyError("Enter the 6-digit code from your email.");
      return;
    }
    setVerifying(true);

    const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "signup",
    });

    if (verifyErr || !verifyData.session) {
      setVerifying(false);
      setVerifyError("That code is incorrect or has expired. Please check your email and try again, or request a new code.");
      return;
    }

    // Session is now active — create the profile row.
    const { data: profile, error: profileError } = await supabase
      .from("app_users")
      .insert({
        auth_id: verifyData.user.id,
        name: name.trim(),
        designation: designation.trim() || null,
        division: division.trim() || null,
        role: "applicant",
        username: username.trim(),
        email: email.trim(),
      })
      .select()
      .single();

    setVerifying(false);

    if (profileError || !profile) {
      setVerifyError("Verified, but your profile could not be saved. Contact the system administrator.");
      return;
    }

    onLogin(profile);
  }

  async function handleResendCode() {
    if (resendCooldown > 0) return;
    setVerifyError("");
    const { error: resendErr } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
    });
    if (resendErr) {
      setVerifyError("Could not resend the code. Please wait a moment and try again.");
      return;
    }
    setResendCooldown(30);
  }

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  if (awaitingConfirmation) {
    return (
      <AuthShell title="Enter Confirmation Code">
        <form onSubmit={handleVerifyCode}>
          <div style={{ fontFamily: SANS, fontSize: 12.5, color: COLORS.inkSoft, marginBottom: 14, lineHeight: 1.6 }}>
            We've sent a 6-digit code to <strong>{email}</strong>. Enter it below to activate your account.
          </div>
          <Field label="Confirmation Code">
            <Input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              style={{ letterSpacing: 3, fontSize: 18, textAlign: "center" }}
            />
          </Field>
          <ErrorBanner>{verifyError}</ErrorBanner>
          <Btn type="submit" onClick={handleVerifyCode} icon={Lock} disabled={verifying}>
            {verifying ? "Verifying…" : "Verify & Activate Account"}
          </Btn>
          <div style={{ marginTop: 16, textAlign: "center", fontFamily: SANS, fontSize: 12.5 }}>
            <button
              type="button"
              onClick={handleResendCode}
              disabled={resendCooldown > 0}
              style={{
                background: "none", border: "none", padding: 0, fontFamily: SANS, fontSize: 12.5,
                color: resendCooldown > 0 ? COLORS.inkSoft : COLORS.greenSoft,
                cursor: resendCooldown > 0 ? "default" : "pointer",
              }}
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
            </button>
          </div>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create Applicant Account">
      <form onSubmit={handleSubmit}>
        <Field label="Full Name"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. R. Jayasuriya" /></Field>
        <Field label="Designation"><Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Assistant Registrar" /></Field>
        <Field label="Division"><Input value={division} onChange={(e) => setDivision(e.target.value)} placeholder="e.g. Administration" /></Field>
        <Field label="Username"><Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Choose a username" /></Field>
        <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
        <Field label="Password"><PasswordField value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" /></Field>
        <Field label="Confirm Password"><PasswordField value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></Field>

        <ErrorBanner>{error}</ErrorBanner>

        <Btn type="submit" onClick={handleSubmit} icon={Lock} disabled={loading}>
          {loading ? "Creating account…" : "Create Account"}
        </Btn>

        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button type="button" onClick={onDone} style={{ background: "none", border: "none", color: COLORS.greenSoft, cursor: "pointer", padding: 0, fontFamily: SANS, fontSize: 12.5 }}>
            Already have an account? Log in
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

function ForgotPasswordScreen({ onBack }) {
  const [step, setStep] = useState("request"); // 'request' | 'verify' | 'done'
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function handleRequestCode(e) {
    e.preventDefault();
    setError("");
    if (!username.trim()) {
      setError("Enter your username.");
      return;
    }
    setLoading(true);

    const lookup = await lookupEmailByUsername(username);
    setLoading(false);

    if (!lookup || !lookup.email) {
      // Don't reveal whether the username exists — but there's genuinely
      // nowhere to send a code, so we can't proceed to the code step.
      setError("If that username exists, it doesn't have a registered email on file. Contact the system administrator.");
      return;
    }

    setEmail(lookup.email);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(lookup.email);
    if (resetError) {
      setError("Could not send a reset code. Please try again later.");
      return;
    }
    setStep("verify");
    setResendCooldown(30);
  }

  async function handleResendCode() {
    if (resendCooldown > 0) return;
    setError("");
    const { error: resendErr } = await supabase.auth.resetPasswordForEmail(email);
    if (resendErr) {
      setError("Could not resend the code. Please wait a moment and try again.");
      return;
    }
    setResendCooldown(30);
  }

  async function handleVerifyAndReset(e) {
    e.preventDefault();
    setError("");
    if (!code.trim()) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);

    const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "recovery",
    });

    if (verifyErr || !verifyData.session) {
      setLoading(false);
      setError("That code is incorrect or has expired. Please check your email and try again, or request a new code.");
      return;
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (updateErr) {
      setError("Your code was verified, but the password could not be updated. Please try again.");
      return;
    }

    // Sign out of this recovery session so they log in fresh with the new
    // password via the normal login screen.
    await supabase.auth.signOut();
    setStep("done");
  }

  return (
    <AuthShell title="Reset Password">
      {step === "done" ? (
        <div>
          <SuccessBanner>Your password has been updated. You can now log in with your new password.</SuccessBanner>
          <Btn onClick={onBack} icon={Lock}>Back to Log In</Btn>
        </div>
      ) : step === "verify" ? (
        <form onSubmit={handleVerifyAndReset}>
          <div style={{ fontFamily: SANS, fontSize: 12.5, color: COLORS.inkSoft, marginBottom: 14, lineHeight: 1.6 }}>
            We've sent a 6-digit code to <strong>{email}</strong>. Enter it below along with your new password.
          </div>
          <Field label="Confirmation Code">
            <Input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              style={{ letterSpacing: 3, fontSize: 18, textAlign: "center" }}
            />
          </Field>
          <Field label="New Password">
            <PasswordField value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" />
          </Field>
          <Field label="Confirm New Password">
            <PasswordField value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} />
          </Field>
          <ErrorBanner>{error}</ErrorBanner>
          <Btn type="submit" onClick={handleVerifyAndReset} icon={Lock} disabled={loading}>
            {loading ? "Updating…" : "Verify & Set New Password"}
          </Btn>
          <div style={{ marginTop: 16, textAlign: "center", fontFamily: SANS, fontSize: 12.5 }}>
            <button
              type="button"
              onClick={handleResendCode}
              disabled={resendCooldown > 0}
              style={{
                background: "none", border: "none", padding: 0, fontFamily: SANS, fontSize: 12.5,
                color: resendCooldown > 0 ? COLORS.inkSoft : COLORS.greenSoft,
                cursor: resendCooldown > 0 ? "default" : "pointer",
              }}
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleRequestCode}>
          <div style={{ fontFamily: SANS, fontSize: 12.5, color: COLORS.inkSoft, marginBottom: 14, lineHeight: 1.6 }}>
            Enter your username. If your account has a registered email address, we'll send a code to reset your password.
          </div>
          <Field label="Username">
            <Input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. rjayasuriya" />
          </Field>
          <ErrorBanner>{error}</ErrorBanner>
          <Btn type="submit" onClick={handleRequestCode} icon={Lock} disabled={loading}>
            {loading ? "Sending…" : "Send Reset Code"}
          </Btn>
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <button type="button" onClick={onBack} style={{ background: "none", border: "none", color: COLORS.greenSoft, cursor: "pointer", padding: 0, fontFamily: SANS, fontSize: 12.5 }}>
              Back to Log In
            </button>
          </div>
        </form>
      )}
    </AuthShell>
  );
}

/* ================= MAIN APP ================= */
export default function OVRAMS() {
  /* Added: session state. No one sees any page until authenticated.
     Persisted to localStorage so refreshing the page (or closing and
     reopening the tab) doesn't log the person out. */
  const [session, setSession] = useState(() => {
    try {
      const saved = localStorage.getItem("ovrams_session");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  /* Verify the underlying Supabase Auth session is still valid on load.
     If it's expired or was signed out elsewhere, clear our local copy too
     so the person is correctly sent back to the login screen rather than
     seeing a stale, now-unauthenticated view of the app. */
  useEffect(() => {
    if (!session) return;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setSession(null);
        try { localStorage.removeItem("ovrams_session"); } catch {}
      }
    });
    // Also react to sign-outs that happen elsewhere (e.g. another tab).
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
        try { localStorage.removeItem("ovrams_session"); } catch {}
      }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [vehicles, setVehicles] = useState(VEHICLES_SEED);
  const [drivers, setDrivers] = useState(DRIVERS_SEED);
  const [page, setPage] = useState("dashboard");
  const [selectedReqId, setSelectedReqId] = useState(null);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [toast, setToast] = useState(null);

  /* Load live data from Supabase once someone is logged in, and again
     whenever they log in fresh. This replaces the old REQUESTS_SEED /
     VEHICLES_SEED / DRIVERS_SEED in-memory-only data. */
  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    async function loadAll() {
      setRequestsLoading(true);
      const [reqResult, vehResult, drvResult, usersResult] = await Promise.all([
        loadRequestsFromDb(),
        supabase.from("vehicles").select("*"),
        supabase.from("drivers").select("*"),
        supabase.from("app_users").select("*"),
      ]);
      if (cancelled) return;

      if (usersResult.data) {
        DB_USERS_BY_ID = {};
        usersResult.data.forEach((u) => {
          DB_USERS_BY_ID[u.id] = {
            id: u.id, name: u.name, designation: u.designation,
            division: u.division, role: u.role, username: u.username,
          };
        });
      }
      if (reqResult.data) setRequests(reqResult.data);
      if (vehResult.data) {
        const mapped = vehResult.data.map((v) => ({
          id: v.id, reg: v.reg, type: v.type, model: v.model, status: v.status, meter: v.meter,
        }));
        setVehicles(mapped);
        DB_VEHICLES_BY_ID = {};
        mapped.forEach((v) => { DB_VEHICLES_BY_ID[v.id] = v; });
      }
      if (drvResult.data) {
        const mapped = drvResult.data.map((d) => ({
          id: d.id, name: d.name, empNo: d.emp_no, contact: d.contact,
          license: d.license, expiry: d.expiry, status: d.status,
        }));
        setDrivers(mapped);
        DB_DRIVERS_BY_ID = {};
        mapped.forEach((d) => { DB_DRIVERS_BY_ID[d.id] = d; });
      }
      setRequestsLoading(false);
    }
    loadAll();
    return () => { cancelled = true; };
  }, [session]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }
  function pushHistory(req, action, comment) {
    return {
      ...req,
      history: [...req.history, { who: session.name, action, at: new Date().toISOString(), comment }],
    };
  }
  /* updateRequest now persists changes to Supabase (so every device sees
     the same data) and only updates local state after the database write
     succeeds. `updater` is the same pure function used before — it returns
     the new shape of the request, including any newly appended history
     entry from pushHistory(). */
  function updateRequest(id, updater) {
    setRequests((rs) => {
      const current = rs.find((r) => r.id === id);
      if (!current) return rs;
      const updated = updater(current);

      // Persist the request's own fields.
      supabase
        .from("requests")
        .update({
          status: updated.status,
          vehicle_id: updated.vehicleId,
          driver_id: updated.driverId,
          meter: updated.meter,
          observation: updated.observation,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .then(({ error }) => {
          if (error) {
            console.error("Failed to save request update:", error);
            showToast("Warning: change may not have saved. Check your connection.");
          }
        });

      // Persist any newly appended history entry (there's at most one new
      // entry per call, since updater() is only ever called once per action).
      const newEntry = updated.history[updated.history.length - 1];
      const alreadyHadIt = current.history.some(
        (h) => h.at === newEntry.at && h.action === newEntry.action
      );
      if (newEntry && !alreadyHadIt) {
        supabase
          .from("request_history")
          .insert({
            request_id: id,
            who: newEntry.who,
            action: newEntry.action,
            comment: newEntry.comment || null,
            at: newEntry.at,
          })
          .then(({ error }) => {
            if (error) console.error("Failed to save history entry:", error);
          });
      }

      return rs.map((r) => (r.id === id ? updated : r));
    });
  }

  function handleLogin(user) {
    setSession(user);
    try {
      localStorage.setItem("ovrams_session", JSON.stringify(user));
    } catch (e) {
      console.error("Could not save session:", e);
    }
    setPage("dashboard");
    setSelectedReqId(null);
    showToast(`Welcome, ${user.name}.`);
  }
  function handleLogout() {
    supabase.auth.signOut();
    setSession(null);
    try {
      localStorage.removeItem("ovrams_session");
    } catch (e) {
      console.error("Could not clear session:", e);
    }
    setPage("dashboard");
    setSelectedReqId(null);
    setNavOpen(false);
  }

  /* All hooks must run on every render, in the same order, whether or not
     someone is logged in — otherwise React throws error #310. So the
     useMemo calls stay here, unconditionally, and the login-screen
     early-return happens further down, after every hook has run. */
  const currentUser = session; // may be null when logged out
  const roleKey = currentUser ? currentUser.role : null;

  const stats = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => ![STATUS.APPROVED, STATUS.COMPLETED, STATUS.REJECTED, STATUS.CANCELLED, STATUS.RETURNED, STATUS.UNAVAILABLE].includes(r.status)).length;
    const approved = requests.filter((r) => r.status === STATUS.APPROVED).length;
    const rejected = requests.filter((r) => r.status === STATUS.REJECTED).length;
    const completed = requests.filter((r) => r.status === STATUS.COMPLETED).length;
    return { total, pending, approved, rejected, completed };
  }, [requests]);

  const byDivision = useMemo(() => {
    return DIVISIONS.map((d) => ({ label: d.split(" ")[0], value: requests.filter((r) => r.division === d).length }));
  }, [requests]);

  const byMonth = useMemo(() => {
    const m = {};
    requests.forEach((r) => {
      const key = new Date(r.start).toLocaleString(undefined, { month: "short" });
      m[key] = (m[key] || 0) + 1;
    });
    return Object.entries(m).map(([label, value]) => ({ label, value }));
  }, [requests]);

  /* If nobody is logged in, show the login/signup/forgot-password flow. */
  if (!session) {
    return <AuthGate onLogin={handleLogin} />;
  }

  const NAV = {
    applicant: [
      { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
      { key: "my-requests", label: "My Requests", icon: FileText },
    ],
    division_head: [
      { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
      { key: "approvals", label: "Approvals", icon: ClipboardCheck },
    ],
    transport_officer: [
      { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
      { key: "vehicle-review", label: "Vehicle Assignment", icon: Truck },
      { key: "schedule", label: "Schedule", icon: Calendar },
      { key: "vehicles", label: "Vehicles", icon: Truck },
      { key: "drivers", label: "Drivers", icon: Users },
    ],
    final_approver: [
      { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
      { key: "final-approval", label: "Final Approval", icon: ShieldCheck },
    ],
    admin: [
      { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
      { key: "all-requests", label: "All Requests", icon: FileText },
      { key: "vehicles", label: "Vehicles", icon: Truck },
      { key: "drivers", label: "Drivers", icon: Users },
      { key: "schedule", label: "Schedule", icon: Calendar },
      { key: "users", label: "Users", icon: Users },
      { key: "audit", label: "Audit Log", icon: ShieldCheck },
    ],
  };
  const nav = NAV[roleKey];

  return (
    <div style={{ fontFamily: SANS, background: COLORS.paper, minHeight: "100vh", color: COLORS.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::selection { background: ${COLORS.amberBg}; }

        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area {
            position: absolute; left: 0; top: 0; width: 100%;
            padding: 0; margin: 0;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* ---- Top bar ---- */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 20px", background: COLORS.green, color: "#fff",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setNavOpen((v) => !v)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", display: "flex" }}>
            <Menu size={20} />
          </button>
          <Truck size={20} />
          <div>
            <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 16, lineHeight: 1 }}>OVRAMS</div>
            <div style={{ fontSize: 10, opacity: 0.75, letterSpacing: 0.3 }}>Vehicle Request &amp; Approval Management</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Bell size={17} style={{ opacity: 0.85 }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{currentUser.name}</div>
            <div style={{ fontSize: 10.5, opacity: 0.75 }}>{ROLE_LABEL[roleKey]}</div>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            style={{
              display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.3)", color: "#fff", cursor: "pointer",
              borderRadius: 3, padding: "6px 10px", fontFamily: SANS, fontSize: 12, fontWeight: 600,
            }}
          >
            <LogOut size={14} /> Log Out
          </button>
        </div>
      </div>

      <div style={{ display: "flex" }}>
        {/* ---- Sidebar ---- */}
        <div style={{
          width: navOpen ? 210 : 0, overflow: "hidden", transition: "width .15s",
          borderRight: navOpen ? `1px solid ${COLORS.line}` : "none", background: "#fff", minHeight: "calc(100vh - 49px)",
        }}>
          <div style={{ padding: "14px 10px", width: 210 }}>
            {nav.map((item) => {
              const Icon = item.icon;
              const active = page === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => { setPage(item.key); setSelectedReqId(null); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    padding: "9px 12px", marginBottom: 2, border: "none", borderRadius: 3,
                    background: active ? COLORS.paperDark : "transparent",
                    color: active ? COLORS.green : COLORS.ink,
                    fontFamily: SANS, fontSize: 13.5, fontWeight: active ? 700 : 500,
                    cursor: "pointer", textAlign: "left",
                    borderLeft: active ? `3px solid ${COLORS.green}` : "3px solid transparent",
                  }}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ---- Main content ---- */}
        <div style={{ flex: 1, padding: "22px 26px", minWidth: 0 }}>
          {selectedReqId ? (
            <RequestDetail
              req={requests.find((r) => r.id === selectedReqId)}
              onBack={() => setSelectedReqId(null)}
              roleKey={roleKey}
              currentUser={currentUser}
              vehicles={vehicles}
              drivers={drivers}
              requests={requests}
              updateRequest={updateRequest}
              pushHistory={pushHistory}
              showToast={showToast}
            />
          ) : page === "dashboard" ? (
            <Dashboard
              roleKey={roleKey}
              currentUser={currentUser}
              requests={requests}
              stats={stats}
              byDivision={byDivision}
              byMonth={byMonth}
              vehicles={vehicles}
              onOpen={setSelectedReqId}
              onNewRequest={() => setShowNewRequest(true)}
            />
          ) : page === "my-requests" ? (
            <RequestList
              title="My Requests"
              requests={requests.filter((r) => r.applicantId === currentUser.id)}
              onOpen={setSelectedReqId}
              onNewRequest={() => setShowNewRequest(true)}
              showNew
              showFilters
            />
          ) : page === "approvals" ? (
            <RequestList
              title="Pending Division Approvals"
              requests={requests.filter((r) => divisionHeadCanAct(currentUser, r.division) && r.status === STATUS.SUBMITTED)}
              onOpen={setSelectedReqId}
              emptyMsg="No requests awaiting your review."
            />
          ) : page === "vehicle-review" ? (
            <RequestList
              title="Requests Awaiting Vehicle Assignment"
              requests={requests.filter((r) => r.status === STATUS.DIVISION_APPROVED)}
              onOpen={setSelectedReqId}
              emptyMsg="No requests awaiting vehicle assignment."
            />
          ) : page === "final-approval" ? (
            <RequestList
              title="Requests Awaiting Final Approval"
              requests={requests.filter((r) => r.status === STATUS.VEHICLE_ASSIGNED)}
              onOpen={setSelectedReqId}
              emptyMsg="No requests awaiting final approval."
            />
          ) : page === "all-requests" ? (
            <RequestList title="All Vehicle Requests" requests={requests} onOpen={setSelectedReqId} showFilters />
          ) : page === "vehicles" ? (
            <VehiclePanel vehicles={vehicles} requests={requests} />
          ) : page === "drivers" ? (
            <DriverPanel drivers={drivers} requests={requests} />
          ) : page === "schedule" ? (
            <SchedulePanel requests={requests} vehicles={vehicles} drivers={drivers} />
          ) : page === "users" ? (
            <UsersPanel />
          ) : page === "audit" ? (
            <AuditPanel requests={requests} />
          ) : null}
        </div>
      </div>

      {showNewRequest && (
        <NewRequestModal
          currentUser={currentUser}
          onClose={() => setShowNewRequest(false)}
          onSubmit={async (newReq) => {
            // 1. Insert the main request row.
            const { error: reqError } = await supabase.from("requests").insert({
              id: newReq.id,
              applicant_id: newReq.applicantId,
              division: newReq.division,
              purpose: newReq.purpose,
              starting_location: newReq.startingLocation,
              destination_location: newReq.destinationLocation,
              start_time: newReq.start,
              end_time: newReq.end,
              adequate_space: newReq.adequateSpace,
              status: newReq.status,
              vehicle_id: newReq.vehicleId,
              driver_id: newReq.driverId,
              meter: newReq.meter,
              observation: newReq.observation,
            });
            if (reqError) {
              console.error("Failed to save new request:", reqError);
              showToast("Could not submit request — check your connection and try again.");
              return;
            }

            // 2. Insert travelling officers.
            if (newReq.officers.length) {
              const { error: offError } = await supabase.from("request_officers").insert(
                newReq.officers.map((o) => ({
                  request_id: newReq.id, name: o.name, designation: o.designation, dept: o.dept,
                }))
              );
              if (offError) console.error("Failed to save officers:", offError);
            }

            // 3. Insert the initial history entry.
            const firstHistory = newReq.history[0];
            const { error: histError } = await supabase.from("request_history").insert({
              request_id: newReq.id, who: firstHistory.who, action: firstHistory.action, at: firstHistory.at,
            });
            if (histError) console.error("Failed to save history:", histError);

            // 4. Update local state only after the database write succeeds.
            setRequests((rs) => [newReq, ...rs]);
            setShowNewRequest(false);
            showToast(`Request ${newReq.id} submitted for division review.`);
          }}
        />
      )}

      {toast && (
        <div style={{
          position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)",
          background: COLORS.ink, color: "#fff", padding: "10px 18px", borderRadius: 4,
          fontFamily: SANS, fontSize: 13, boxShadow: "0 4px 16px rgba(0,0,0,.25)", zIndex: 1000,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

/* ================= DASHBOARD ================= */
function Dashboard({ roleKey, currentUser, requests, stats, byDivision, byMonth, vehicles, onOpen, onNewRequest }) {
  const mine = requests.filter((r) => r.applicantId === currentUser.id);
  const available = vehicles.filter((v) => v.status === "Available").length;
  const assigned = requests.filter((r) => [STATUS.VEHICLE_ASSIGNED, STATUS.FINAL_REVIEW, STATUS.APPROVED].includes(r.status)).length;

  return (
    <div>
      <PageHeader
        title={roleKey === "applicant" ? "My Dashboard" : "Dashboard"}
        subtitle={`Overview for ${currentUser.name} — ${currentUser.designation}`}
        action={roleKey === "applicant" && <Btn icon={Plus} onClick={onNewRequest}>New Vehicle Request</Btn>}
      />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        {roleKey === "applicant" ? (
          <>
            <Stat label="Total Requests" value={mine.length} />
            <Stat label="Pending" value={mine.filter((r) => ![STATUS.APPROVED, STATUS.COMPLETED, STATUS.REJECTED, STATUS.CANCELLED].includes(r.status)).length} accent={COLORS.amber} />
            <Stat label="Approved" value={mine.filter((r) => r.status === STATUS.APPROVED).length} />
            <Stat label="Rejected" value={mine.filter((r) => r.status === STATUS.REJECTED).length} accent={COLORS.red} />
            <Stat label="Completed" value={mine.filter((r) => r.status === STATUS.COMPLETED).length} />
          </>
        ) : (
          <>
            <Stat label="Total Requests" value={stats.total} />
            <Stat label="Pending Approval" value={stats.pending} accent={COLORS.amber} />
            <Stat label="Approved" value={stats.approved} />
            <Stat label="Rejected" value={stats.rejected} accent={COLORS.red} />
            <Stat label="Vehicles Available" value={available} />
            <Stat label="Vehicles Assigned" value={assigned} />
          </>
        )}
      </div>
      {roleKey !== "applicant" && (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
          <div style={{ flex: "1 1 320px", background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 4, padding: 16 }}>
            <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Requests by Division</div>
            <MiniBars data={byDivision} colorFn={() => COLORS.greenSoft} />
          </div>
          <div style={{ flex: "1 1 320px", background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 4, padding: 16 }}>
            <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Requests by Month</div>
            <MiniBars data={byMonth} colorFn={() => COLORS.amber} />
          </div>
        </div>
      )}
      <SectionCard title="Recent Requests" label="">
        <RequestTable requests={(roleKey === "applicant" ? mine : requests).slice(0, 6)} onOpen={onOpen} />
      </SectionCard>
    </div>
  );
}

function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
      <div>
        <h1 style={{ fontFamily: SERIF, fontSize: 24, margin: 0, color: COLORS.ink, fontWeight: 700 }}>{title}</h1>
        {subtitle && <div style={{ fontFamily: SANS, fontSize: 13, color: COLORS.inkSoft, marginTop: 4 }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

/* ================= REQUEST TABLE / LIST ================= */
function RequestTable({ requests, onOpen }) {
  if (requests.length === 0) {
    return <div style={{ fontFamily: SANS, fontSize: 13.5, color: COLORS.inkSoft, padding: "24px 0" }}>No requests to show.</div>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: SANS, fontSize: 13.5 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${COLORS.ink}` }}>
            {["Request ID", "Starting Location", "Destination", "Start", "End", "Status", ""].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600, color: COLORS.inkSoft, fontSize: 11.5 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id} style={{ borderBottom: `1px solid ${COLORS.line}` }}>
              <td style={{ padding: "10px 10px", fontWeight: 600 }}>{r.id}</td>
              <td style={{ padding: "10px 10px" }}>{r.startingLocation}</td>
              <td style={{ padding: "10px 10px" }}>{r.destinationLocation}</td>
              <td style={{ padding: "10px 10px" }}>{fmtD(r.start)}</td>
              <td style={{ padding: "10px 10px" }}>{fmtD(r.end)}</td>
              <td style={{ padding: "10px 10px" }}><Badge status={r.status} /></td>
              <td style={{ padding: "10px 10px" }}>
                <Btn small variant="ghost" onClick={() => onOpen(r.id)}>View</Btn>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RequestList({ title, requests, onOpen, onNewRequest, showNew, emptyMsg, showFilters }) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const filtered = requests.filter((r) => {
    const matchQ = !q || r.id.toLowerCase().includes(q.toLowerCase()) ||
      (r.startingLocation || "").toLowerCase().includes(q.toLowerCase()) ||
      (r.destinationLocation || "").toLowerCase().includes(q.toLowerCase());
    const matchS = !statusFilter || r.status === statusFilter;
    return matchQ && matchS;
  });
  return (
    <div>
      <PageHeader title={title} action={showNew && <Btn icon={Plus} onClick={onNewRequest}>New Vehicle Request</Btn>} />
      {showFilters && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 220px" }}>
            <Search size={14} style={{ position: "absolute", left: 9, top: 10, color: COLORS.inkSoft }} />
            <Input placeholder="Search by ID, starting location, or destination…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 30 }} />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="">All statuses</option>
            {Object.values(STATUS).map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
      )}
      {filtered.length === 0 ? (
        <div style={{ fontFamily: SANS, fontSize: 13.5, color: COLORS.inkSoft, padding: "40px 0", textAlign: "center" }}>
          {emptyMsg || "No requests found."}
        </div>
      ) : (
        <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 4, padding: "6px 16px" }}>
          <RequestTable requests={filtered} onOpen={onOpen} />
        </div>
      )}
    </div>
  );
}

/* ================= REQUEST DETAIL ================= */
function RequestDetail({ req, onBack, roleKey, currentUser, vehicles, drivers, requests, updateRequest, pushHistory, showToast }) {
  const applicant = userById(req.applicantId);
  const [comment, setComment] = useState("");
  const [vehicleId, setVehicleId] = useState(req.vehicleId || "");
  const [driverId, setDriverId] = useState(req.driverId || "");
  const [meter, setMeter] = useState(req.meter || "");
  const [observation, setObservation] = useState(req.observation || "");
  const [finalRemarks, setFinalRemarks] = useState("");

  const conflict = useMemo(() => {
    if (!vehicleId) return null;
    return requests.find((r) =>
      r.id !== req.id && r.vehicleId === vehicleId &&
      [STATUS.VEHICLE_ASSIGNED, STATUS.FINAL_REVIEW, STATUS.APPROVED].includes(r.status) &&
      overlaps(req.start, req.end, r.start, r.end)
    );
  }, [vehicleId, requests, req]);

  const driverConflict = useMemo(() => {
    if (!driverId) return null;
    return requests.find((r) =>
      r.id !== req.id && r.driverId === driverId &&
      [STATUS.VEHICLE_ASSIGNED, STATUS.FINAL_REVIEW, STATUS.APPROVED].includes(r.status) &&
      overlaps(req.start, req.end, r.start, r.end)
    );
  }, [driverId, requests, req]);

  const isOwnRequest = applicant ? applicant.id === currentUser.id : false;

  return (
    <div>
      <button onClick={onBack} className="no-print" style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: COLORS.greenSoft, fontFamily: SANS, fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 16 }}>
        <ChevronRight size={15} style={{ transform: "rotate(180deg)" }} /> Back to list
      </button>

      <div id="print-area">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontFamily: SANS, fontSize: 11.5, color: COLORS.inkSoft, letterSpacing: 0.3 }}>MOYAS-F07</div>
          <h1 style={{ fontFamily: SERIF, fontSize: 24, margin: "2px 0 0", fontWeight: 700 }}>{req.id}</h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }} className="no-print">
          <Badge status={req.status} />
          <Btn variant="ghost" small icon={Printer} onClick={() => window.print()}>Print / PDF</Btn>
        </div>
      </div>

      {/* Workflow tracker */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 24, fontFamily: SANS, fontSize: 11 }}>
        {WORKFLOW_ORDER.map((s, i) => {
          const currentIdx = WORKFLOW_ORDER.indexOf(req.status);
          const done = currentIdx >= 0 && i <= currentIdx && ![STATUS.REJECTED, STATUS.RETURNED, STATUS.CANCELLED].includes(req.status);
          const isRejectedPath = [STATUS.REJECTED, STATUS.RETURNED, STATUS.CANCELLED].includes(req.status);
          return (
            <div key={s} style={{
              padding: "5px 9px", borderRadius: 3, whiteSpace: "nowrap",
              background: done ? COLORS.green : "#fff",
              color: done ? "#fff" : COLORS.inkSoft,
              border: `1px solid ${done ? COLORS.green : COLORS.line}`,
              opacity: isRejectedPath && !done ? 0.4 : 1,
            }}>
              {s}
            </div>
          );
        })}
        {[STATUS.REJECTED, STATUS.RETURNED, STATUS.CANCELLED].includes(req.status) && (
          <div style={{ padding: "5px 9px", borderRadius: 3, background: COLORS.red, color: "#fff" }}>{req.status}</div>
        )}
      </div>

      {/* Section A */}
      <SectionCard label="Section A" title="Applicant Information">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 14 }}>
          <Field label="Applicant Name"><div>{applicant ? applicant.name : "—"}</div></Field>
          <Field label="Officer / Designation"><div>{applicant ? applicant.designation : "—"}</div></Field>
          <Field label="Division / Section"><div>{req.division}</div></Field>
          <Field label="Purpose"><div>{req.purpose}</div></Field>
        </div>
      </SectionCard>

      {/* Section B */}
      <SectionCard label="Section B" title="Journey Information">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 14 }}>
          <Field label="Starting Location"><div>{req.startingLocation}</div></Field>
          <Field label="Destination Location"><div>{req.destinationLocation}</div></Field>
          <Field label="Starting Date/Time"><div>{fmtDT(req.start)}</div></Field>
          <Field label="Ending Date/Time"><div>{fmtDT(req.end)}</div></Field>
        </div>
      </SectionCard>

      {/* Section C */}
      <SectionCard label="Section C" title="Travelling Officers">
        {req.officers.map((o, i) => (
          <div key={i} style={{ display: "flex", gap: 20, padding: "8px 0", borderBottom: i < req.officers.length - 1 ? `1px solid ${COLORS.line}` : "none", fontSize: 13.5, flexWrap: "wrap" }}>
            <div style={{ flex: 1 }}><strong>{o.name}</strong></div>
            <div style={{ flex: 1, color: COLORS.inkSoft }}>{o.designation}</div>
            <div style={{ flex: 1, color: COLORS.inkSoft }}>{o.dept}</div>
          </div>
        ))}
      </SectionCard>

      {/* Section D */}
      <SectionCard label="Section D" title="Approval Information">
        <Field label="Adequate space available for approval?"><div>{req.adequateSpace}</div></Field>
      </SectionCard>

      {/* History / audit trail */}
      <SectionCard label="History" title="Approval History & Audit Trail">
        {req.history.map((h, i) => (
          <div key={i} style={{ display: "flex", gap: 12, padding: "9px 0", borderBottom: i < req.history.length - 1 ? `1px solid ${COLORS.line}` : "none" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.green, marginTop: 6, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{h.action}</div>
              <div style={{ fontSize: 12, color: COLORS.inkSoft }}>{h.who} · {fmtDT(h.at)}</div>
              {h.comment && <div style={{ fontSize: 12.5, color: COLORS.ink, marginTop: 3, fontStyle: "italic" }}>"{h.comment}"</div>}
            </div>
          </div>
        ))}
      </SectionCard>
      </div>
      {/* ^ end of #print-area — everything below is workflow actions, not part of the printed record */}

      {/* -------- ROLE-SPECIFIC ACTION PANELS -------- */}
      {roleKey === "division_head" && req.status === STATUS.SUBMITTED && divisionHeadCanAct(currentUser, req.division) && (
        <SectionCard label="Action" title="Division Head Review">
          {isOwnRequest && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", background: COLORS.redBg, color: COLORS.red, padding: "9px 12px", borderRadius: 3, fontSize: 12.5, marginBottom: 14 }}>
              <AlertTriangle size={15} /> You cannot approve your own request.
            </div>
          )}
          <Field label="Comments"><TextArea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional remarks" /></Field>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn icon={CheckCircle2} disabled={isOwnRequest} onClick={() => {
              updateRequest(req.id, (r) => pushHistory({ ...r, status: STATUS.DIVISION_APPROVED }, "Approved (Division Head)", comment));
              showToast(`${req.id} approved and routed to Vehicle Division.`);
              onBack();
            }}>Approve</Btn>
            <Btn variant="danger" icon={XCircle} disabled={isOwnRequest} onClick={() => {
              updateRequest(req.id, (r) => pushHistory({ ...r, status: STATUS.REJECTED }, "Rejected (Division Head)", comment));
              showToast(`${req.id} rejected.`);
              onBack();
            }}>Reject</Btn>
            <Btn variant="ghost" icon={ArrowLeftRight} disabled={isOwnRequest} onClick={() => {
              updateRequest(req.id, (r) => pushHistory({ ...r, status: STATUS.RETURNED }, "Returned for correction", comment));
              showToast(`${req.id} returned to applicant for correction.`);
              onBack();
            }}>Return for Correction</Btn>
          </div>
        </SectionCard>
      )}

      {roleKey === "transport_officer" && req.status === STATUS.DIVISION_APPROVED && (
        <SectionCard label="Action" title="Vehicle Division — Assignment">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 14 }}>
            <Field label="Assign Vehicle">
              <Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                <option value="">Select a vehicle…</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id} disabled={v.status !== "Available"}>
                    {v.reg} — {v.model} {v.status !== "Available" ? `(${v.status})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Assign Driver">
              <Select value={driverId} onChange={(e) => setDriverId(e.target.value)}>
                <option value="">Select a driver…</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id} disabled={d.status !== "Active"}>
                    {d.name} {d.status !== "Active" ? `(${d.status})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Current Meter Reading (km)">
              <Input type="number" value={meter} onChange={(e) => setMeter(e.target.value)} placeholder="e.g. 42000" />
            </Field>
          </div>
          {conflict && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: COLORS.redBg, color: COLORS.red, padding: "9px 12px", borderRadius: 3, fontSize: 12.5, marginBottom: 14 }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>This vehicle is already booked for <strong>{conflict.id}</strong> ({fmtDT(conflict.start)} – {fmtDT(conflict.end)}). Choose another vehicle.</div>
            </div>
          )}
          {driverConflict && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: COLORS.redBg, color: COLORS.red, padding: "9px 12px", borderRadius: 3, fontSize: 12.5, marginBottom: 14 }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>This driver is already assigned to <strong>{driverConflict.id}</strong> during an overlapping period.</div>
            </div>
          )}
          <Field label="Transport Officer Observation"><TextArea value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="Vehicle condition, fuel level, etc." /></Field>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn
              icon={Truck}
              disabled={!vehicleId || !driverId || !meter || !!conflict || !!driverConflict}
              onClick={() => {
                updateRequest(req.id, (r) => pushHistory(
                  { ...r, status: STATUS.VEHICLE_ASSIGNED, vehicleId, driverId, meter: Number(meter), observation },
                  "Vehicle & driver assigned"
                ));
                showToast(`${req.id} routed to final approval.`);
                onBack();
              }}
            >
              Confirm Assignment
            </Btn>
            <Btn variant="danger" icon={XCircle} onClick={() => {
              updateRequest(req.id, (r) => pushHistory({ ...r, status: STATUS.UNAVAILABLE }, "Marked vehicle unavailable", observation));
              showToast(`${req.id} marked as vehicle unavailable.`);
              onBack();
            }}>No Vehicle Available</Btn>
          </div>
        </SectionCard>
      )}

      {(req.vehicleId || req.status === STATUS.VEHICLE_ASSIGNED || req.status === STATUS.FINAL_REVIEW || req.status === STATUS.APPROVED || req.status === STATUS.COMPLETED) && (
        <SectionCard label="Vehicle Division" title="Vehicle & Driver Allocation">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 14 }}>
            <Field label="Vehicle">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Truck size={14} color={COLORS.greenSoft} />
                {req.vehicleId && vehicleById(req.vehicleId)
                  ? `${vehicleById(req.vehicleId).reg} — ${vehicleById(req.vehicleId).model}`
                  : "—"}
              </div>
            </Field>
            <Field label="Driver">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <User size={14} color={COLORS.greenSoft} />
                {req.driverId && driverById(req.driverId) ? driverById(req.driverId).name : "—"}
              </div>
            </Field>
            <Field label="Meter Reading">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Gauge size={14} color={COLORS.greenSoft} />
                {req.meter ? `${req.meter.toLocaleString()} km` : "—"}
              </div>
            </Field>
          </div>
          {req.observation && <Field label="Observation"><div style={{ fontStyle: "italic", color: COLORS.inkSoft }}>{req.observation}</div></Field>}
        </SectionCard>
      )}

      {roleKey === "final_approver" && req.status === STATUS.VEHICLE_ASSIGNED && (
        <SectionCard label="Action" title="Final Approval">
          <div style={{ fontFamily: SERIF, fontSize: 15, marginBottom: 14, color: COLORS.ink, fontStyle: "italic" }}>
            &ldquo;I approve / do not approve providing a vehicle for the above observation.&rdquo;
          </div>
          <Field label="Remarks"><TextArea value={finalRemarks} onChange={(e) => setFinalRemarks(e.target.value)} placeholder="Optional remarks" /></Field>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn icon={ShieldCheck} onClick={() => {
              updateRequest(req.id, (r) => pushHistory({ ...r, status: STATUS.APPROVED }, "Final approval granted", finalRemarks));
              showToast(`${req.id} approved — vehicle allocated.`);
              onBack();
            }}>Approve</Btn>
            <Btn variant="danger" icon={XCircle} onClick={() => {
              updateRequest(req.id, (r) => pushHistory({ ...r, status: STATUS.REJECTED }, "Rejected at final approval", finalRemarks));
              showToast(`${req.id} rejected at final approval.`);
              onBack();
            }}>Reject</Btn>
          </div>
        </SectionCard>
      )}

      {roleKey === "transport_officer" && req.status === STATUS.APPROVED && (
        <SectionCard label="Action" title="Mark Trip Completed">
          <Btn icon={CheckCircle2} onClick={() => {
            updateRequest(req.id, (r) => pushHistory({ ...r, status: STATUS.COMPLETED }, "Trip marked completed"));
            showToast(`${req.id} marked completed.`);
            onBack();
          }}>Mark as Completed</Btn>
        </SectionCard>
      )}

      {roleKey === "applicant" && isOwnRequest && [STATUS.SUBMITTED, STATUS.DIVISION_REVIEW].includes(req.status) && (
        <SectionCard label="Action" title="Applicant Actions">
          <Btn variant="danger" icon={Trash2} onClick={() => {
            updateRequest(req.id, (r) => pushHistory({ ...r, status: STATUS.CANCELLED }, "Cancelled by applicant"));
            showToast(`${req.id} cancelled.`);
            onBack();
          }}>Cancel Request</Btn>
        </SectionCard>
      )}
    </div>
  );
}

/* ================= NEW REQUEST MODAL ================= */
function NewRequestModal({ currentUser, onClose, onSubmit }) {
  const [purpose, setPurpose] = useState("");
  const [startingLocation, setStartingLocation] = useState("");
  const [destinationLocation, setDestinationLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [adequateSpace, setAdequateSpace] = useState("Yes");
  const [officers, setOfficers] = useState([{ name: currentUser.name, designation: currentUser.designation, dept: currentUser.division }]);
  const [declared, setDeclared] = useState(false);
  const [error, setError] = useState("");

  function addOfficer() {
    if (officers.length >= 8) return;
    setOfficers([...officers, { name: "", designation: "", dept: "" }]);
  }
  function updateOfficer(i, field, val) {
    setOfficers(officers.map((o, idx) => (idx === i ? { ...o, [field]: val } : o)));
  }
  function removeOfficer(i) {
    setOfficers(officers.filter((_, idx) => idx !== i));
  }
  function submit() {
    setError("");
    if (!purpose || !startingLocation || !destinationLocation || !startDate || !startTime || !endDate || !endTime) {
      setError("Please complete all required fields.");
      return;
    }
    const start = `${startDate}T${startTime}`;
    const end = `${endDate}T${endTime}`;
    if (new Date(end) <= new Date(start)) {
      setError("Ending date/time cannot be earlier than or equal to the starting date/time.");
      return;
    }
    if (!declared) {
      setError("Please confirm the applicant declaration before submitting.");
      return;
    }
    const id = `REQ-2026-0${Math.floor(150 + Math.random() * 800)}`;
    onSubmit({
      id, applicantId: currentUser.id, division: currentUser.division,
      purpose, startingLocation, destinationLocation, start, end, adequateSpace,
      officers: officers.filter((o) => o.name),
      status: STATUS.SUBMITTED,
      history: [{ who: currentUser.name, action: "Submitted request", at: new Date().toISOString() }],
      vehicleId: null, driverId: null, meter: null, observation: "",
    });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,28,22,.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "40px 16px", zIndex: 2000 }}>
      <div style={{ background: "#fff", borderRadius: 5, width: "100%", maxWidth: 720, marginBottom: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px", borderBottom: `1px solid ${COLORS.line}`, background: COLORS.paperDark }}>
          <div>
            <div style={{ fontFamily: SANS, fontSize: 11, color: COLORS.inkSoft }}>MOYAS-F07</div>
            <h2 style={{ fontFamily: SERIF, fontSize: 19, margin: 0 }}>New Vehicle Request</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.ink }}><Truck style={{ display: "none" }} /><span style={{ fontSize: 20, lineHeight: 1 }}>×</span></button>
        </div>
        <div style={{ padding: 22 }}>
          <SectionCard label="Section A" title="Applicant Information">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 14 }}>
              <Field label="Applicant Name"><Input value={currentUser.name} disabled /></Field>
              <Field label="Officer / Designation"><Input value={currentUser.designation} disabled /></Field>
              <Field label="Division / Section"><Input value={currentUser.division} disabled /></Field>
            </div>
            <Field label="Purpose for which vehicle is required *">
              <TextArea value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Describe the purpose of travel" />
            </Field>
          </SectionCard>

          <SectionCard label="Section B" title="Journey Information">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 14 }}>
              <Field label="Starting Point *"><Input value={startingLocation} onChange={(e) => setStartingLocation(e.target.value)} /></Field>
              <Field label="Destination *"><Input value={destinationLocation} onChange={(e) => setDestinationLocation(e.target.value)} /></Field>
              <Field label="Starting Date *"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
              <Field label="Starting Time *"><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></Field>
              <Field label="Ending Date *"><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
              <Field label="Ending Time *"><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></Field>
            </div>
          </SectionCard>

          <SectionCard label="Section C" title="Travelling Officers" right={<Btn small variant="ghost" icon={Plus} onClick={addOfficer}>Add Officer</Btn>}>
            {officers.map((o, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
                <Input placeholder="Officer name" value={o.name} onChange={(e) => updateOfficer(i, "name", e.target.value)} style={{ flex: "1 1 160px" }} />
                <Input placeholder="Designation" value={o.designation} onChange={(e) => updateOfficer(i, "designation", e.target.value)} style={{ flex: "1 1 160px" }} />
                <Input placeholder="Department" value={o.dept} onChange={(e) => updateOfficer(i, "dept", e.target.value)} style={{ flex: "1 1 160px" }} />
                {officers.length > 1 && (
                  <button onClick={() => removeOfficer(i)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.red, display: "flex" }}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </SectionCard>

          <SectionCard label="Section D" title="Approval Information">
            <Field label="Is there adequate space for approval?">
              <div style={{ display: "flex", gap: 16 }}>
                {["Yes", "No"].map((opt) => (
                  <label key={opt} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5 }}>
                    <input type="radio" checked={adequateSpace === opt} onChange={() => setAdequateSpace(opt)} /> {opt}
                  </label>
                ))}
              </div>
            </Field>
          </SectionCard>

          <SectionCard label="Section E" title="Applicant Declaration">
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13.5 }}>
              <input type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)} style={{ marginTop: 3 }} />
              I declare that the information provided above is true and correct to the best of my knowledge.
            </label>
          </SectionCard>

          {error && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", background: COLORS.redBg, color: COLORS.red, padding: "9px 12px", borderRadius: 3, fontSize: 12.5, marginBottom: 14 }}>
              <AlertTriangle size={15} /> {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn onClick={submit}>Submit Request</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= VEHICLES PANEL ================= */
function VehiclePanel({ vehicles, requests }) {
  const statusColor = { Available: COLORS.green, Maintenance: COLORS.amber, Assigned: COLORS.blueGrey };
  return (
    <div>
      <PageHeader title="Vehicles" subtitle={`${vehicles.length} vehicles registered`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px,1fr))", gap: 14 }}>
        {vehicles.map((v) => {
          const active = requests.find((r) => r.vehicleId === v.id && [STATUS.VEHICLE_ASSIGNED, STATUS.FINAL_REVIEW, STATUS.APPROVED].includes(r.status));
          return (
            <div key={v.id} style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 4, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Truck size={18} color={COLORS.greenSoft} />
                  <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 15 }}>{v.reg}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: statusColor[v.status] || COLORS.inkSoft }}>{v.status}</span>
              </div>
              <div style={{ fontSize: 12.5, color: COLORS.inkSoft, marginTop: 8 }}>{v.type} · {v.model}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: COLORS.inkSoft, marginTop: 6 }}>
                <Gauge size={13} /> {v.meter.toLocaleString()} km
              </div>
              {active && <div style={{ fontSize: 11.5, marginTop: 8, color: COLORS.blueGrey }}>Currently on {active.id}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================= DRIVERS PANEL ================= */
function DriverPanel({ drivers, requests }) {
  return (
    <div>
      <PageHeader title="Drivers" subtitle={`${drivers.length} drivers registered`} />
      <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 4, padding: "6px 16px", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: SANS, fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: COLORS.paperDark, borderBottom: `1px solid ${COLORS.line}` }}>
              {["Name", "Employee No.", "Contact", "License", "Expiry", "Status"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontSize: 11.5, color: COLORS.inkSoft }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.id} style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                <td style={{ padding: "10px 12px", fontWeight: 600 }}>{d.name}</td>
                <td style={{ padding: "10px 12px" }}>{d.empNo}</td>
                <td style={{ padding: "10px 12px" }}>{d.contact}</td>
                <td style={{ padding: "10px 12px" }}>{d.license}</td>
                <td style={{ padding: "10px 12px" }}>{fmtD(d.expiry)}</td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: d.status === "Active" ? COLORS.green : COLORS.amber }}>{d.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= SCHEDULE PANEL ================= */
function SchedulePanel({ requests }) {
  const scheduled = requests.filter((r) => r.vehicleId).sort((a, b) => new Date(a.start) - new Date(b.start));
  return (
    <div>
      <PageHeader title="Vehicle Schedule" subtitle="All confirmed and pending vehicle bookings" />
      <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 4, padding: "6px 16px" }}>
        {scheduled.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: COLORS.inkSoft, fontSize: 13.5 }}>No scheduled trips.</div>
        ) : scheduled.map((r) => {
          const v = vehicleById(r.vehicleId);
          const d = driverById(r.driverId);
          return (
            <div key={r.id} style={{ display: "flex", gap: 16, alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${COLORS.line}`, flexWrap: "wrap" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: STATUS_STYLE(r.status).fg }} />
              <div style={{ minWidth: 110, fontWeight: 600, fontSize: 13 }}>{r.id}</div>
              <div style={{ flex: "1 1 140px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Truck size={13} color={COLORS.greenSoft} /> {v ? v.reg : "—"}</div>
              <div style={{ flex: "1 1 120px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><User size={13} color={COLORS.greenSoft} /> {d ? d.name : "—"}</div>
              <div style={{ flex: "1 1 160px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>{fmtDT(r.start)}</div>
              <div style={{ flex: "1 1 220px", fontSize: 12.5, color: COLORS.inkSoft }}>{r.destinationLocation}</div>
              <Badge status={r.status} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================= USERS PANEL ================= */
function UsersPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("app_users")
      .select("*")
      .order("role", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setUsers(data);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <PageHeader title="Users" subtitle={loading ? "Loading…" : `${users.length} accounts`} />
      <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 4, padding: "6px 16px", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: SANS, fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: COLORS.paperDark, borderBottom: `1px solid ${COLORS.line}` }}>
              {["Name", "Designation", "Division", "Role", "Username"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontSize: 11.5, color: COLORS.inkSoft }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                <td style={{ padding: "10px 12px", fontWeight: 600 }}>{u.name}</td>
                <td style={{ padding: "10px 12px" }}>{u.designation}</td>
                <td style={{ padding: "10px 12px" }}>{u.division}</td>
                <td style={{ padding: "10px 12px" }}>{ROLE_LABEL[u.role]}</td>
                <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12.5 }}>{u.username}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= AUDIT PANEL ================= */
function AuditPanel({ requests }) {
  const entries = requests
    .flatMap((r) => r.history.map((h) => ({ ...h, reqId: r.id })))
    .sort((a, b) => new Date(b.at) - new Date(a.at));
  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Complete history of actions across all requests" />
      <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 4, padding: "6px 16px" }}>
        {entries.map((e, i) => (
          <div key={i} style={{ display: "flex", gap: 14, padding: "11px 16px", borderBottom: i < entries.length - 1 ? `1px solid ${COLORS.line}` : "none", flexWrap: "wrap", fontSize: 13 }}>
            <div style={{ minWidth: 130, color: COLORS.inkSoft, fontSize: 12 }}>{fmtDT(e.at)}</div>
            <div style={{ minWidth: 110, fontWeight: 600 }}>{e.reqId}</div>
            <div style={{ minWidth: 130 }}>{e.who}</div>
            <div style={{ flex: 1, color: COLORS.inkSoft }}>{e.action}{e.comment ? ` — "${e.comment}"` : ""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

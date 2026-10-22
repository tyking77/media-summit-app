import { useEffect, useState } from "react";
import { signInAnonymously, signOut, type User } from "firebase/auth";
import { addDoc, collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, firebaseConfigured } from "../firebase";
import { EVENT_THEME, STUDENT_DOMAIN } from "../config";
import { useAttendee, useAuthUser, useMyQuestions, usePolls, useVotes } from "../lib/data";
import { tally } from "../lib/tally";
import { Bars, Logo, SpeakerPhoto } from "../components/common";
import speakers from "../data/speakers.json";
import type { Attendee, Poll, Speaker } from "../types";

const isOswego = (email: string) => email.toLowerCase().endsWith("@" + STUDENT_DOMAIN);
const looksLikeEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

function touch(uid: string) {
  updateDoc(doc(db, "attendees", uid), { lastSeenAt: serverTimestamp() }).catch(() => {});
}

export default function AttendeePage() {
  const { user, ready } = useAuthUser();
  const { attendee, loaded } = useAttendee(user?.uid);

  if (!firebaseConfigured) return <SetupNeeded />;
  if (!ready || (user && !loaded)) return <Loading />;
  if (!user || !attendee) return <Login user={user} />;
  return <Main user={user} attendee={attendee} />;
}

function Loading() {
  return (
    <div className="att-page center">
      <Logo className="att-loading-logo" />
    </div>
  );
}

function SetupNeeded() {
  return (
    <div className="att-page center">
      <div className="card">
        <h2>Almost ready</h2>
        <p>Firebase isn't configured yet. Paste your web app config into <code>src/firebase.ts</code>.</p>
      </div>
    </div>
  );
}

export function Login({ user }: { user: User | null }) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const addr = email.trim().toLowerCase();
  const student = isOswego(addr);

  const join = async () => {
    setError("");
    if (!first.trim() || !last.trim()) return setError("Please enter your first and last name.");
    if (!looksLikeEmail(addr)) return setError("Please enter a valid email address.");
    setBusy(true);
    try {
      const u = user ?? (await signInAnonymously(auth)).user;
      const firstName = first.trim().slice(0, 40);
      const lastName = last.trim().slice(0, 40);
      await setDoc(doc(db, "attendees", u.uid), {
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        email: addr.slice(0, 120),
        type: student ? "student" : "guest",
        firstSeenAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
        professors: "",
      });
    } catch (e: unknown) {
      setError("Couldn't sign you in. Check your connection and try again.");
      console.warn(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="att-page">
      <div className="login">
        <Logo className="login-logo" />
        <div className="login-kicker">22nd annual Dr. Lewis B. O'Donnell</div>
        <h1 className="login-title">Media Summit</h1>
        <div className="login-theme">{EVENT_THEME}</div>

        <form
          className="login-actions"
          onSubmit={(e) => {
            e.preventDefault();
            join();
          }}
        >
          <div className="name-row">
            <div>
              <label className="label">First name</label>
              <input className="input" value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" />
            </div>
            <div>
              <label className="label">Last name</label>
              <input className="input" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" />
            </div>
          </div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoCapitalize="none"
            placeholder={`you@${STUDENT_DOMAIN}`}
          />
          <div className={`student-note ${student ? "ok" : ""}`}>
            {student
              ? "Oswego email recognized. Your attendance will be recorded."
              : `SUNY Oswego students: use your @${STUDENT_DOMAIN} email to get attendance credit.`}
          </div>
          {error && <div className="alert">{error}</div>}
          <button className="btn btn-primary full" type="submit" disabled={busy}>
            Join the Summit
          </button>
        </form>
      </div>
    </div>
  );
}

/* ---------------- signed in ---------------- */

function Main({ user, attendee }: { user: User; attendee: Attendee }) {
  useEffect(() => touch(user.uid), [user.uid]);
  return (
    <div className="att-page">
      <header className="att-header">
        <Logo className="att-header-logo" />
        <div className="att-header-text">
          <div className="att-header-title">Media Summit 2026</div>
          <div className="att-header-theme">{EVENT_THEME}</div>
        </div>
      </header>
      <div className="att-user">
        <span>
          Signed in as <strong>{attendee.name}</strong>
          {attendee.type === "student" ? "" : " (guest)"}
        </span>
        <button className="link inline" onClick={() => signOut(auth)}>
          Not you?
        </button>
      </div>

      <PollCard user={user} />
      <AskCard user={user} attendee={attendee} />
      {attendee.type === "student" && <ExtraCreditCard user={user} attendee={attendee} />}
      <PanelCard />
      <div className="att-foot">22nd annual Dr. Lewis B. O'Donnell Media Summit · SUNY Oswego</div>
    </div>
  );
}

function PollCard({ user }: { user: User }) {
  const polls = usePolls();
  const open = polls.find((p) => p.status === "open");
  const [recentId, setRecentId] = useState<string | null>(null);
  const recent = polls.find((p) => p.id === recentId);

  useEffect(() => {
    if (open) setRecentId(open.id);
  }, [open?.id]);

  // Keep final results up for 30 seconds after voting closes.
  useEffect(() => {
    if (!open && recent?.status === "closed") {
      const t = setTimeout(() => setRecentId(null), 30000);
      return () => clearTimeout(t);
    }
  }, [open?.id, recent?.status]);

  const poll = open ?? (recent && recent.status === "closed" ? recent : undefined);

  if (!poll)
    return (
      <section className="card card-quiet">
        <div className="card-kicker">Live poll</div>
        <p className="quiet">No live poll right now. Keep this page open.</p>
      </section>
    );
  return <PollVoting key={poll.id} poll={poll} uid={user.uid} />;
}

function PollVoting({ poll, uid }: { poll: Poll; uid: string }) {
  const votes = useVotes(poll.id);
  const [mine, setMine] = useState<string[] | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const isOpen = poll.status === "open";

  useEffect(
    () =>
      onSnapshot(doc(db, "polls", poll.id, "votes", uid), (s) => {
        const c = s.exists() ? ((s.data().choices as string[]) ?? []) : null;
        setMine(c);
        if (c) setSel(c);
      }),
    [poll.id, uid]
  );

  const toggle = (id: string) => {
    if (!isOpen) return;
    setMsg("");
    if (poll.multiSelect) setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    else setSel([id]);
  };

  const submit = async () => {
    if (!sel.length) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "polls", poll.id, "votes", uid), { choices: sel, updatedAt: serverTimestamp() });
      touch(uid);
      setMsg("Vote saved. You can change it while voting is open.");
    } catch {
      setMsg("Voting just closed, or the connection dropped. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const t = tally(poll, votes);
  const changed = !mine || mine.slice().sort().join() !== sel.slice().sort().join();

  return (
    <section className="card card-poll">
      <div className="card-kicker">{isOpen ? "Live poll" : "Final results"}</div>
      <h2 className="poll-q">{poll.prompt}</h2>
      {isOpen && (
        <>
          {poll.multiSelect && <div className="hint">Select all that apply</div>}
          <div className="options">
            {poll.options.map((o) => (
              <button
                key={o.id}
                className={`option ${sel.includes(o.id) ? "selected" : ""} ${poll.multiSelect ? "multi" : ""}`}
                onClick={() => toggle(o.id)}
              >
                <span className="option-mark" />
                <span>{o.text}</span>
              </button>
            ))}
          </div>
          <button className="btn btn-primary full" onClick={submit} disabled={saving || !sel.length || !changed}>
            {mine ? (changed ? "Update my vote" : "Vote saved") : "Submit vote"}
          </button>
          {msg && <div className="hint ok">{msg}</div>}
        </>
      )}
      {(mine || !isOpen) && (
        <div className="att-results">
          <div className="hint">
            {isOpen ? "Live results" : "Results"} · {t.total} {poll.multiSelect ? "respondents" : "votes"}
          </div>
          <Bars rows={t.rows} leaderId={isOpen ? null : t.leaderId} variant="phone" showCount={false} />
        </div>
      )}
    </section>
  );
}

function AskCard({ user, attendee }: { user: User; attendee: Attendee }) {
  const mine = useMyQuestions(user.uid);
  const [text, setText] = useState("");
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [msg, setMsg] = useState("");

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    try {
      await addDoc(collection(db, "questions"), {
        uid: user.uid,
        name: attendee.name,
        type: attendee.type,
        anonymous: anon,
        text: t.slice(0, 280),
        createdAt: serverTimestamp(),
        status: "pending",
      });
      touch(user.uid);
      setText("");
      setMsg("Sent! Watch the screen.");
      setCooldown(true);
      setTimeout(() => setCooldown(false), 8000);
    } catch {
      setMsg("That didn't send. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const label = (s: string) => (s === "approved" ? "Selected for the panel" : s === "answered" ? "Answered" : "Sent");

  return (
    <section className="card">
      <div className="card-kicker">Ask the panel</div>
      <textarea
        className="input textarea"
        maxLength={280}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setMsg("");
        }}
        placeholder="Type a question for the panel"
        rows={3}
      />
      <div className="row-between">
        <label className="check">
          <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
          <span>Ask anonymously</span>
        </label>
        <span className="counter">{280 - text.length}</span>
      </div>
      {anon && <p className="fine">Your name won't appear on screen. Organizers can still see who asked.</p>}
      <button className="btn btn-primary full" onClick={submit} disabled={busy || cooldown || !text.trim()}>
        {cooldown ? "Sent" : "Send question"}
      </button>
      {msg && <div className="hint ok">{msg}</div>}
      {mine.length > 0 && (
        <div className="my-qs">
          <div className="hint">Your questions</div>
          {mine.map((q) => (
            <div key={q.id} className="my-q">
              <div className="my-q-text">{q.text}</div>
              <span className={`pill pill-${q.status === "rejected" ? "pending" : q.status}`}>{label(q.status)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ExtraCreditCard({ user, attendee }: { user: User; attendee: Attendee }) {
  const [val, setVal] = useState(attendee.professors || "");
  const [saved, setSaved] = useState(false);
  const save = async () => {
    await updateDoc(doc(db, "attendees", user.uid), { professors: val.trim().slice(0, 500), lastSeenAt: serverTimestamp() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };
  return (
    <section className="card">
      <div className="card-kicker">Extra credit</div>
      <label className="label">Which professors should know you attended?</label>
      <input className="input" value={val} onChange={(e) => setVal(e.target.value)} placeholder="e.g. Prof. Smith, Prof. Jones" maxLength={500} />
      <p className="fine">Separate names with commas. You can update this any time.</p>
      <button className="btn btn-primary full" onClick={save} disabled={val.trim() === (attendee.professors || "")}>
        {saved ? "Saved" : "Save"}
      </button>
    </section>
  );
}

export function PanelCard() {
  const list = speakers as Speaker[];
  return (
    <section className="card">
      <div className="card-kicker">Meet the panel</div>
      {list.map((s) => (
        <details key={s.id} className="speaker-acc">
          <summary>
            <SpeakerPhoto src={s.photo} name={s.name} size={56} />
            <span className="speaker-acc-text">
              <span className="speaker-acc-name">
                {s.name}
                {s.classYear ? ` ${s.classYear}` : ""}
              </span>
              <span className="speaker-acc-title">
                {s.role} · {s.title}
              </span>
            </span>
          </summary>
          <p className="speaker-acc-bio">{s.bio}</p>
        </details>
      ))}
    </section>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentReference,
} from "firebase/firestore";
import { auth, db, firebaseConfigured } from "../firebase";
import { ADMIN_EMAIL } from "../config";
import { useAuthUser, useCollection, useLive, usePolls, useScreened, useVotes } from "../lib/data";
import { tally } from "../lib/tally";
import { downloadCsv, fmtTime, randomInt } from "../lib/csv";
import { BroadcastScreen, Stage } from "../components/Broadcast";
import seedPolls from "../data/seedPolls.json";
import { DEFAULT_LIVE, type Attendee, type LiveState, type Mode, type Poll, type Question, type Screened } from "../types";

const liveRef = () => doc(db, "live", "state");
const setLive = (patch: Partial<LiveState>) =>
  setDoc(liveRef(), { ...patch, updatedAt: serverTimestamp() }, { merge: true });

export default function AdminPage() {
  const { user, ready } = useAuthUser();
  const [err, setErr] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const isAdmin = !!user && !user.isAnonymous && user.email?.toLowerCase() === ADMIN_EMAIL;

  const login = async () => {
    setErr("");
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, pw);
      setPw("");
    } catch {
      setErr("Wrong password, or the admin account hasn't been created in Firebase yet.");
    } finally {
      setBusy(false);
    }
  };

  if (!firebaseConfigured) return <div className="admin-gate">Paste the Firebase config into src/firebase.ts first.</div>;
  if (!ready) return <div className="admin-gate">Loading…</div>;
  if (!isAdmin)
    return (
      <div className="admin-gate">
        <h1>Media Summit admin</h1>
        <form
          className="admin-login"
          onSubmit={(e) => {
            e.preventDefault();
            login();
          }}
        >
          <label className="label">{ADMIN_EMAIL}</label>
          <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" autoComplete="current-password" />
          <button className="btn btn-primary" type="submit" disabled={busy || !pw}>
            Sign in
          </button>
          {err && <p className="alert">{err}</p>}
        </form>
        <p className="fine">Signing in here replaces any attendee sign-in in this browser. Use a separate browser or private window for testing the attendee view.</p>
      </div>
    );
  return <Console />;
}

function Console() {
  const { live } = useLive();
  const polls = usePolls();
  const screened = useScreened();
  const attendees = useCollection<Attendee>("attendees", true);
  const questions = useCollection<Question>("questions", true);
  const [tab, setTab] = useState<"polls" | "questions" | "prizes" | "export">("questions");

  useEffect(() => {
    getDoc(liveRef()).then((s) => {
      if (!s.exists()) setDoc(liveRef(), { ...DEFAULT_LIVE, updatedAt: serverTimestamp() });
    });
  }, []);

  const people = attendees.filter((a) => a.email !== ADMIN_EMAIL);
  const pending = questions.filter((q) => q.status === "pending").length;

  return (
    <div className="admin">
      <ControlBar live={live} polls={polls} screened={screened} people={people} />
      <nav className="admin-tabs">
        {(
          [
            ["questions", `Questions${pending ? ` (${pending} new)` : ""}`],
            ["polls", "Polls"],
            ["prizes", "Prize draw"],
            ["export", "Export & reset"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={`admin-tab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
        <span className="spacer" />
        <button className="link inline" onClick={() => signOut(auth)}>
          Sign out
        </button>
      </nav>
      <div className="admin-body">
        {tab === "polls" && <PollsPanel polls={polls} live={live} />}
        {tab === "questions" && <QuestionsPanel questions={questions} live={live} screened={screened} />}
        {tab === "prizes" && <PrizePanel questions={questions} attendees={people} live={live} />}
        {tab === "export" && <ExportPanel attendees={people} questions={questions} polls={polls} live={live} />}
      </div>
    </div>
  );
}

/* ---------------- control bar ---------------- */

function ControlBar({ live, polls, screened, people }: { live: LiveState; polls: Poll[]; screened: Screened[]; people: Attendee[] }) {
  const uniq = (t: string) => new Set(people.filter((p) => p.type === t).map((p) => p.email || p.id)).size;
  const students = uniq("student");
  const guests = uniq("guest");
  const openPoll = polls.find((p) => p.status === "open");
  const votes = useVotes(openPoll?.id);
  const onScreenPoll = polls.find((p) => p.id === live.pollId);
  const onScreenQ = screened.find((s) => s.id === live.questionId);

  const modes: { mode: Mode; label: string; disabled?: boolean; title?: string }[] = [
    { mode: "idle", label: "Logo" },
    { mode: "poll", label: "Poll", disabled: !live.pollId, title: onScreenPoll?.prompt },
    { mode: "question", label: "Question", disabled: !onScreenQ, title: onScreenQ?.text },
    { mode: "speakers", label: "Speakers" },
    { mode: "thankyou", label: "Thank you" },
  ];

  return (
    <div className="control-bar">
      <div className="control-left">
        <div className="control-modes">
          {modes.map((m) => (
            <button
              key={m.mode}
              className={`mode-btn ${live.mode === m.mode ? "on" : ""}`}
              disabled={m.disabled}
              title={m.title}
              onClick={() => setLive({ mode: m.mode })}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="control-stats">
          <Stat n={students} label="students" />
          <Stat n={guests} label="guests" />
          <Stat n={openPoll ? votes.length : "–"} label={openPoll ? "votes on open poll" : "no poll open"} />
        </div>
        <div className="control-links">
          <a href="#/broadcast" target="_blank" rel="noreferrer">
            Open broadcast view ↗
          </a>
          <a href="#/moderator" target="_blank" rel="noreferrer">
            Open moderator view ↗
          </a>
          <a href="#/" target="_blank" rel="noreferrer">
            Open attendee view ↗
          </a>
        </div>
      </div>
      <div className="control-preview">
        <div className="control-preview-label">On the projector</div>
        <Stage className="preview-box">
          <BroadcastScreen live={live} polls={polls} screened={screened} />
        </Stage>
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="stat">
      <div className="stat-n">{n}</div>
      <div className="stat-l">{label}</div>
    </div>
  );
}

/* ---------------- polls ---------------- */

const newId = (text: string) =>
  (text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "opt") + "-" + Math.random().toString(36).slice(2, 6);

function PollsPanel({ polls, live }: { polls: Poll[]; live: LiveState }) {
  const [editing, setEditing] = useState<Poll | "new" | null>(null);
  const [msg, setMsg] = useState("");

  const loadSeeds = async () => {
    let added = 0;
    for (const s of seedPolls as Omit<Poll, "status">[]) {
      const ref = doc(db, "polls", s.id);
      if (!(await getDoc(ref)).exists()) {
        await setDoc(ref, { prompt: s.prompt, options: s.options, multiSelect: s.multiSelect, order: s.order, status: "draft", adjustments: {} });
        added++;
      }
    }
    setMsg(added ? `Loaded ${added} poll${added > 1 ? "s" : ""}.` : "All seed polls are already loaded.");
  };

  const move = async (i: number, dir: -1 | 1) => {
    const a = polls[i];
    const b = polls[i + dir];
    if (!a || !b) return;
    const batch = writeBatch(db);
    batch.update(doc(db, "polls", a.id), { order: b.order });
    batch.update(doc(db, "polls", b.id), { order: a.order === b.order ? a.order + dir : a.order });
    await batch.commit();
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Polls</h2>
        <button className="btn btn-ghost" onClick={loadSeeds}>
          Load seed polls
        </button>
        <button className="btn btn-primary" onClick={() => setEditing("new")}>
          New poll
        </button>
        {msg && <span className="hint ok">{msg}</span>}
      </div>
      {editing && <PollEditor poll={editing === "new" ? null : editing} nextOrder={(polls[polls.length - 1]?.order ?? 0) + 1} onDone={() => setEditing(null)} />}
      {polls.length === 0 && <p className="quiet">No polls yet. Load the seed polls or make a new one.</p>}
      {polls.map((p, i) => (
        <PollItem
          key={p.id}
          poll={p}
          polls={polls}
          live={live}
          onEdit={() => setEditing(p)}
          onUp={i > 0 ? () => move(i, -1) : undefined}
          onDown={i < polls.length - 1 ? () => move(i, 1) : undefined}
        />
      ))}
    </div>
  );
}

function PollEditor({ poll, nextOrder, onDone }: { poll: Poll | null; nextOrder: number; onDone: () => void }) {
  const [prompt, setPrompt] = useState(poll?.prompt ?? "");
  const [opts, setOpts] = useState((poll?.options ?? []).map((o) => o.text).join("\n"));
  const [multi, setMulti] = useState(poll?.multiSelect ?? false);
  const [err, setErr] = useState("");

  const save = async () => {
    const lines = opts.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!prompt.trim()) return setErr("Add a prompt.");
    if (lines.length < 2 || lines.length > 6) return setErr("Use 2 to 6 options, one per line.");
    // Keep option ids stable by position so existing votes still line up.
    const options = lines.map((text, i) => ({ id: poll?.options[i]?.id ?? newId(text), text }));
    if (poll) {
      await updateDoc(doc(db, "polls", poll.id), { prompt: prompt.trim(), options, multiSelect: multi });
    } else {
      const ref = doc(collection(db, "polls"));
      await setDoc(ref, { prompt: prompt.trim(), options, multiSelect: multi, order: nextOrder, status: "draft", adjustments: {} });
    }
    onDone();
  };

  return (
    <div className="editor">
      <label className="label">Prompt</label>
      <input className="input" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <label className="label">Options (one per line, 2 to 6)</label>
      <textarea className="input textarea" rows={6} value={opts} onChange={(e) => setOpts(e.target.value)} />
      <label className="check">
        <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} />
        <span>Multiple selection (select all that apply)</span>
      </label>
      {poll && <p className="fine">Editing options after people vote: votes follow the option's position in the list.</p>}
      {err && <p className="alert">{err}</p>}
      <div className="row">
        <button className="btn btn-primary" onClick={save}>
          Save poll
        </button>
        <button className="btn btn-ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function PollItem({
  poll,
  polls,
  live,
  onEdit,
  onUp,
  onDown,
}: {
  poll: Poll;
  polls: Poll[];
  live: LiveState;
  onEdit: () => void;
  onUp?: () => void;
  onDown?: () => void;
}) {
  const votes = useVotes(poll.id);
  const t = tally(poll, votes);
  const onScreen = live.mode === "poll" && live.pollId === poll.id;

  const openVoting = async () => {
    const batch = writeBatch(db);
    polls.filter((p) => p.status === "open" && p.id !== poll.id).forEach((p) => batch.update(doc(db, "polls", p.id), { status: "closed" }));
    batch.update(doc(db, "polls", poll.id), { status: "open" });
    await batch.commit();
  };
  const closeVoting = () => updateDoc(doc(db, "polls", poll.id), { status: "closed" });
  const openAndShow = async () => {
    await openVoting();
    await setLive({ mode: "poll", pollId: poll.id });
  };
  const adjust = (optId: string, d: number) => updateDoc(doc(db, "polls", poll.id), { [`adjustments.${optId}`]: increment(d) });
  const resetAdj = () => updateDoc(doc(db, "polls", poll.id), { adjustments: {} });
  const remove = async () => {
    if (!confirm(`Delete "${poll.prompt}" and its votes?`)) return;
    const vs = await getDocs(collection(db, "polls", poll.id, "votes"));
    await deleteInChunks(vs.docs.map((d) => d.ref));
    await deleteDoc(doc(db, "polls", poll.id));
    if (live.pollId === poll.id) await setLive({ mode: live.mode === "poll" ? "idle" : live.mode, pollId: null });
  };

  return (
    <div className={`poll-item status-${poll.status} ${onScreen ? "on-screen" : ""}`}>
      <div className="poll-item-head">
        <div className="poll-item-order">
          <button className="icon-btn" disabled={!onUp} onClick={onUp} title="Move up">
            ▲
          </button>
          <button className="icon-btn" disabled={!onDown} onClick={onDown} title="Move down">
            ▼
          </button>
        </div>
        <div className="poll-item-title">
          <div className="poll-item-prompt">{poll.prompt}</div>
          <div className="poll-item-meta">
            <span className={`pill pill-${poll.status}`}>{poll.status === "open" ? "Voting open" : poll.status === "closed" ? "Closed" : "Draft"}</span>
            {poll.multiSelect && <span className="pill">Multi-select</span>}
            {onScreen && <span className="pill pill-live">On screen</span>}
            <span className="muted">
              {t.realRespondents} real {t.realRespondents === 1 ? "voter" : "voters"}
            </span>
          </div>
        </div>
        <div className="poll-item-actions">
          {poll.status !== "open" ? (
            <>
              <button className="btn btn-primary" onClick={openAndShow}>
                Open + show
              </button>
              <button className="btn btn-ghost" onClick={openVoting}>
                Open voting
              </button>
            </>
          ) : (
            <button className="btn btn-warn" onClick={closeVoting}>
              Close voting
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => setLive({ mode: "poll", pollId: poll.id })} disabled={onScreen}>
            Show on screen
          </button>
          <button className="btn btn-ghost" onClick={onEdit}>
            Edit
          </button>
          <button className="btn btn-ghost danger" onClick={remove}>
            Delete
          </button>
        </div>
      </div>
      <table className="results">
        <thead>
          <tr>
            <th>Option</th>
            <th>Real</th>
            <th>Adjust</th>
            <th>Shown</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r) => (
            <tr key={r.id}>
              <td>{r.text}</td>
              <td>{r.real}</td>
              <td className="adj">
                <button onClick={() => adjust(r.id, -10)}>−10</button>
                <button onClick={() => adjust(r.id, -1)}>−1</button>
                <span className={r.adjustment ? "adj-val on" : "adj-val"}>{r.adjustment > 0 ? `+${r.adjustment}` : r.adjustment}</span>
                <button onClick={() => adjust(r.id, 1)}>+1</button>
                <button onClick={() => adjust(r.id, 10)}>+10</button>
              </td>
              <td>
                <strong>{r.count}</strong>
              </td>
              <td>{Math.round(r.pct)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      {t.rows.some((r) => r.adjustment) && (
        <button className="link" onClick={resetAdj}>
          Reset adjustments
        </button>
      )}
    </div>
  );
}

/* ---------------- questions ---------------- */

type QFilter = "pending" | "approved" | "answered" | "rejected" | "all";

function QuestionsPanel({ questions, live, screened }: { questions: Question[]; live: LiveState; screened: Screened[] }) {
  const [filter, setFilter] = useState<QFilter>("pending");
  const seen = useRef<Set<string> | null>(null);
  const mountedAt = useRef(Date.now());
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  // Flash questions that arrive while this panel is open.
  useEffect(() => {
    const ids = questions.map((q) => q.id);
    if (seen.current === null) {
      // Wait for the first real snapshot so existing questions don't all flash.
      if (questions.length || Date.now() - mountedAt.current > 2500) seen.current = new Set(ids);
      return;
    }
    const arrived = ids.filter((id) => !seen.current!.has(id));
    if (!arrived.length) return;
    arrived.forEach((id) => seen.current!.add(id));
    setFresh((f) => new Set([...f, ...arrived]));
    const t = setTimeout(() => setFresh((f) => new Set([...f].filter((id) => !arrived.includes(id)))), 6000);
    return () => clearTimeout(t);
  }, [questions]);

  const sorted = useMemo(
    () => [...questions].sort((a, b) => (b.createdAt?.toMillis() ?? Date.now()) - (a.createdAt?.toMillis() ?? Date.now())),
    [questions]
  );
  const counts = (s: QFilter) => (s === "all" ? questions.length : questions.filter((q) => q.status === s).length);
  const list = filter === "all" ? sorted : filter === "approved" ? [...sorted].reverse().filter((q) => q.status === "approved") : sorted.filter((q) => q.status === filter);
  const screenedIds = new Set(screened.map((s) => s.id));

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Questions</h2>
        <div className="filters">
          {(["pending", "approved", "answered", "rejected", "all"] as QFilter[]).map((f) => (
            <button key={f} className={`filter ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>
              {f[0].toUpperCase() + f.slice(1)} ({counts(f)})
            </button>
          ))}
        </div>
      </div>
      {list.length === 0 && <p className="quiet">Nothing here.</p>}
      {list.map((q) => (
        <QuestionItem key={q.id} q={q} live={live} fresh={fresh.has(q.id)} hasScreened={screenedIds.has(q.id)} />
      ))}
    </div>
  );
}

const displayName = (q: Question) => (q.anonymous ? "Anonymous" : q.name);
const shownText = (q: Question) => (q.editedText ?? q.text).trim();

async function approve(q: Question) {
  const batch = writeBatch(db);
  batch.update(doc(db, "questions", q.id), { status: "approved" });
  batch.set(
    doc(db, "screened", q.id),
    { displayName: displayName(q), text: shownText(q), approvedAt: serverTimestamp(), order: Date.now(), answered: false },
    { merge: true }
  );
  await batch.commit();
}

function QuestionItem({ q, live, fresh, hasScreened }: { q: Question; live: LiveState; fresh: boolean; hasScreened: boolean }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(shownText(q));
  const onScreen = live.mode === "question" && live.questionId === q.id;
  const isNext = live.upNextId === q.id;

  const saveEdit = async () => {
    const t = text.trim();
    if (!t) return;
    const batch = writeBatch(db);
    batch.update(doc(db, "questions", q.id), { editedText: t });
    if (hasScreened) batch.update(doc(db, "screened", q.id), { text: t });
    await batch.commit();
    setEditing(false);
  };
  const reject = async () => {
    await updateDoc(doc(db, "questions", q.id), { status: "rejected" });
    await deleteDoc(doc(db, "screened", q.id)).catch(() => {});
    const patch: Partial<LiveState> = {};
    if (live.questionId === q.id) Object.assign(patch, { questionId: null, ...(live.mode === "question" ? { mode: "idle" } : {}) });
    if (isNext) patch.upNextId = null;
    if (Object.keys(patch).length) await setLive(patch);
  };
  const push = async () => {
    if (q.status !== "approved") await approve({ ...q, editedText: text.trim() || q.editedText });
    await setLive({ mode: "question", questionId: q.id, ...(isNext ? { upNextId: null } : {}) });
  };
  const upNext = async () => {
    if (q.status !== "approved") await approve(q);
    await setLive({ upNextId: isNext ? null : q.id });
  };
  const answered = async () => {
    const batch = writeBatch(db);
    batch.update(doc(db, "questions", q.id), { status: "answered" });
    if (hasScreened) batch.update(doc(db, "screened", q.id), { answered: true });
    await batch.commit();
    if (isNext) await setLive({ upNextId: null });
  };
  const restore = () => updateDoc(doc(db, "questions", q.id), { status: "pending" });

  return (
    <div className={`q-item status-${q.status} ${fresh ? "fresh" : ""} ${onScreen ? "on-screen" : ""}`}>
      <div className="q-meta">
        <strong>{q.name}</strong>
        <span className={`pill pill-${q.type}`}>{q.type}</span>
        {q.anonymous && <span className="pill">anonymous on screen</span>}
        {onScreen && <span className="pill pill-live">On screen</span>}
        {isNext && <span className="pill pill-next">Up next</span>}
        <span className="muted">{fmtTime(q.createdAt)}</span>
      </div>
      {editing ? (
        <div className="q-edit">
          <textarea className="input textarea" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="row">
            <button className="btn btn-primary" onClick={saveEdit}>
              Save
            </button>
            <button className="btn btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="q-text">
          {shownText(q)}
          {q.editedText !== undefined && q.editedText !== q.text && <div className="q-orig">Original: {q.text}</div>}
        </div>
      )}
      <div className="q-actions">
        {q.status === "pending" && (
          <button className="btn btn-primary" onClick={() => approve(q)}>
            Approve
          </button>
        )}
        {q.status !== "rejected" && (
          <>
            <button className="btn btn-gold" onClick={push} disabled={onScreen}>
              Push to screen
            </button>
            {q.status !== "answered" && (
              <button className="btn btn-ghost" onClick={upNext}>
                {isNext ? "Clear up next" : "Set as up next"}
              </button>
            )}
          </>
        )}
        {!editing && (
          <button className="btn btn-ghost" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
        {(q.status === "approved" || onScreen) && (
          <button className="btn btn-ghost" onClick={answered}>
            Mark answered
          </button>
        )}
        {q.status !== "rejected" ? (
          <button className="btn btn-ghost danger" onClick={reject}>
            Reject
          </button>
        ) : (
          <button className="btn btn-ghost" onClick={restore}>
            Restore
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- prizes ---------------- */

function PrizePanel({ questions, attendees, live }: { questions: Question[]; attendees: Attendee[]; live: LiveState }) {
  const byId = useMemo(() => new Map(attendees.map((a) => [a.id, a])), [attendees]);
  // One entry per student email, even if they joined on two devices.
  const eligible = useMemo(() => {
    const askers = new Set(questions.map((q) => q.uid));
    const byEmail = new Map<string, Attendee>();
    for (const a of attendees) {
      if (a.type !== "student" || !askers.has(a.id)) continue;
      const key = (a.email || a.id).toLowerCase();
      if (!byEmail.has(key)) byEmail.set(key, a);
    }
    return [...byEmail.values()];
  }, [questions, attendees]);
  const [n, setN] = useState(3);
  const [picked, setPicked] = useState<string[]>(live.winnerUids ?? []);

  const draw = () => {
    const pool = [...eligible];
    const out: string[] = [];
    while (out.length < Math.min(n, pool.length)) {
      const i = randomInt(pool.length);
      out.push(pool[i].id);
      pool.splice(i, 1);
    }
    setPicked(out);
  };
  const redrawOne = (idx: number) => {
    const pool = eligible.filter((a) => !picked.includes(a.id));
    if (!pool.length) return alert("Nobody else is eligible.");
    const next = [...picked];
    next[idx] = pool[randomInt(pool.length)].id;
    setPicked(next);
  };
  const publish = () =>
    setLive({ winners: picked.map((u) => byId.get(u)?.name ?? "").filter(Boolean), winnerUids: picked });

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Prize draw</h2>
      </div>
      <p>
        <strong>{eligible.length}</strong> eligible: people who joined with an @oswego.edu email and submitted at least one question (any status, including anonymous).
      </p>
      <div className="row">
        <label className="label inline">Number of winners</label>
        <input className="input small" type="number" min={1} max={50} value={n} onChange={(e) => setN(Math.max(1, Number(e.target.value) || 1))} />
        <button className="btn btn-primary" onClick={draw} disabled={!eligible.length}>
          Draw
        </button>
      </div>
      {picked.length > 0 && (
        <ol className="winners-list">
          {picked.map((u, i) => {
            const a = byId.get(u);
            return (
              <li key={u}>
                <strong>{a?.name}</strong> <span className="muted">{a?.email}</span>
                <button className="link inline" onClick={() => redrawOne(i)}>
                  Re-draw this one
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <div className="row">
        <button className="btn btn-gold" onClick={publish} disabled={!picked.length}>
          Publish winners to Thank You screen
        </button>
        <button className="btn btn-ghost" onClick={() => setLive({ mode: "thankyou" })}>
          Show Thank You screen
        </button>
        {live.winners?.length > 0 && (
          <button className="btn btn-ghost danger" onClick={() => setLive({ winners: [], winnerUids: [] })}>
            Clear published winners
          </button>
        )}
      </div>
      {live.winners?.length > 0 && <p className="hint ok">Published: {live.winners.join(", ")}</p>}
    </div>
  );
}

/* ---------------- export & reset ---------------- */

async function deleteInChunks(refs: DocumentReference[]) {
  for (let i = 0; i < refs.length; i += 400) {
    const b = writeBatch(db);
    refs.slice(i, i + 400).forEach((r) => b.delete(r));
    await b.commit();
  }
}

function ExportPanel({ attendees, questions, polls, live }: { attendees: Attendee[]; questions: Question[]; polls: Poll[]; live: LiveState }) {
  const [busy, setBusy] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [msg, setMsg] = useState("");
  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

  const exportAttendance = async () => {
    setBusy(true);
    try {
      const votesByPoll = new Map<string, Set<string>>();
      for (const p of polls) {
        const s = await getDocs(collection(db, "polls", p.id, "votes"));
        votesByPoll.set(p.id, new Set(s.docs.filter((d) => (d.data().choices || []).length).map((d) => d.id)));
      }
      const winners = new Set(live.winnerUids ?? []);
      // Someone who joined on two devices has two records; merge them by email.
      const groups = new Map<string, Attendee[]>();
      for (const a of attendees) {
        const key = (a.email || a.id).toLowerCase();
        groups.set(key, [...(groups.get(key) ?? []), a]);
      }
      const ms = (t?: { toMillis: () => number }) => t?.toMillis() ?? 0;
      const header = [
        "First name",
        "Last name",
        "Email",
        "Type",
        "First seen",
        "Last seen",
        `Polls answered (of ${polls.length})`,
        ...polls.map((p, i) => `Poll ${i + 1}: ${p.prompt}`),
        "Questions submitted",
        "Questions selected for panel",
        "Professors to notify",
        "Prize winner",
      ];
      const rows = [...groups.values()]
        .map((recs) => {
          const latest = [...recs].sort((x, y) => ms(y.lastSeenAt) - ms(x.lastSeenAt))[0];
          const uids = new Set(recs.map((r) => r.id));
          const first = [...recs].sort((x, y) => ms(x.firstSeenAt) - ms(y.firstSeenAt))[0];
          const answered = polls.map((p) => [...uids].some((u) => votesByPoll.get(p.id)?.has(u)));
          const mine = questions.filter((q) => uids.has(q.uid));
          const profs = [...new Set(recs.map((r) => (r.professors || "").trim()).filter(Boolean))].join("; ");
          const [fallbackFirst, ...rest] = latest.name.split(" ");
          return [
            latest.firstName ?? fallbackFirst,
            latest.lastName ?? rest.join(" "),
            latest.email ?? "",
            latest.type,
            fmtTime(first.firstSeenAt),
            fmtTime(latest.lastSeenAt),
            answered.filter(Boolean).length,
            ...answered.map((x) => (x ? "Y" : "N")),
            mine.length,
            mine.filter((q) => q.status === "approved" || q.status === "answered").length,
            profs,
            [...uids].some((u) => winners.has(u)) ? "Y" : "N",
          ];
        })
        .sort((x, y) => String(y[3]).localeCompare(String(x[3])) || String(x[1]).localeCompare(String(y[1])));
      downloadCsv(`media-summit-attendance-${stamp()}.csv`, [header, ...rows]);
    } finally {
      setBusy(false);
    }
  };

  const exportQuestions = () => {
    const emails = new Map(attendees.map((a) => [a.id, a.email ?? ""]));
    const rows = [...questions]
      .sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0))
      .map((q) => [fmtTime(q.createdAt), q.name, emails.get(q.uid) ?? "", q.type, q.anonymous ? "Y" : "N", q.text, q.editedText ?? "", q.status]);
    downloadCsv(`media-summit-questions-${stamp()}.csv`, [["Time", "Name", "Email", "Type", "Anonymous", "Question", "Edited text", "Status"], ...rows]);
  };

  const resetAll = async () => {
    if (confirmText !== "RESET") return;
    setBusy(true);
    setMsg("");
    try {
      const refs: DocumentReference[] = [];
      for (const p of polls) {
        const s = await getDocs(collection(db, "polls", p.id, "votes"));
        refs.push(...s.docs.map((d) => d.ref));
      }
      for (const c of ["questions", "screened", "attendees"]) {
        const s = await getDocs(collection(db, c));
        refs.push(...s.docs.map((d) => d.ref));
      }
      await deleteInChunks(refs);
      const b = writeBatch(db);
      polls.forEach((p) => b.update(doc(db, "polls", p.id), { status: "draft", adjustments: {} }));
      b.set(liveRef(), { ...DEFAULT_LIVE, winnerUids: [], updatedAt: serverTimestamp() });
      await b.commit();
      setConfirmText("");
      setMsg(`Cleared ${refs.length} records. Polls kept and set back to draft. You'll need to sign in again on the attendee view.`);
    } catch (e: unknown) {
      setMsg("Reset failed: " + ((e as Error)?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Export</h2>
      </div>
      <p>
        {new Set(attendees.filter((a) => a.type === "student").map((a) => a.email)).size} students and {new Set(attendees.filter((a) => a.type === "guest").map((a) => a.email)).size} guests signed in (unique emails). {questions.length} questions.
      </p>
      <div className="row">
        <button className="btn btn-primary" onClick={exportAttendance} disabled={busy}>
          Download attendance CSV
        </button>
        <button className="btn btn-ghost" onClick={exportQuestions}>
          Download questions CSV
        </button>
      </div>

      <div className="danger-zone">
        <h3>Clear test data</h3>
        <p>
          Run this after tonight's dry run. It deletes every vote, question, and attendee record, and sets polls back to draft. The polls themselves stay. Type <strong>RESET</strong> to confirm.
        </p>
        <div className="row">
          <input className="input small" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="RESET" />
          <button className="btn btn-warn" onClick={resetAll} disabled={busy || confirmText !== "RESET"}>
            Clear everything
          </button>
        </div>
        {msg && <p className="hint ok">{msg}</p>}
      </div>
    </div>
  );
}

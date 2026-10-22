import { useEffect, useRef, useState } from "react";
import { BroadcastScreen, Stage } from "../components/Broadcast";
import { Bars } from "../components/common";
import { useLive, usePolls, useScreened, useSilentAuth, useVotes } from "../lib/data";
import { tally } from "../lib/tally";

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return <div className="mod-clock">{now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</div>;
}

function WakeLockButton() {
  const lock = useRef<{ release: () => Promise<void> } | null>(null);
  const [on, setOn] = useState(false);
  const supported = typeof navigator !== "undefined" && "wakeLock" in navigator;
  const request = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lock.current = await (navigator as any).wakeLock.request("screen");
      setOn(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (lock.current as any).addEventListener?.("release", () => setOn(false));
    } catch {
      setOn(false);
    }
  };
  useEffect(() => {
    const vis = () => {
      if (document.visibilityState === "visible" && on && !lock.current) request();
    };
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, [on]);
  if (!supported) return <span className="mod-wake-note">Set auto-lock to Never on this device</span>;
  return (
    <button className={`mod-wake ${on ? "on" : ""}`} onClick={request}>
      {on ? "Screen stays on" : "Keep screen on"}
    </button>
  );
}

export default function ModeratorPage() {
  const user = useSilentAuth();
  const ready = !!user;
  const { live, offline } = useLive(ready);
  const polls = usePolls(ready);
  const screened = useScreened(ready);
  const poll = live.mode === "poll" ? polls.find((p) => p.id === live.pollId) : undefined;
  const votes = useVotes(poll?.id);
  const t = poll ? tally(poll, votes) : null;
  const upNext = screened.find((s) => s.id === live.upNextId && !s.answered);
  const queue = screened.filter((s) => !s.answered && s.id !== live.questionId);
  const onScreen = live.mode === "question" ? screened.find((s) => s.id === live.questionId) : undefined;

  return (
    <div className="mod-page">
      <header className="mod-top">
        <div className="mod-title">Moderator</div>
        <Clock />
        <WakeLockButton />
        {offline && <span className="mod-offline">Reconnecting…</span>}
      </header>

      <section className="mod-section">
        <div className="mod-label">On screen now</div>
        <Stage className="mod-preview">
          <BroadcastScreen live={live} polls={polls} screened={screened} />
        </Stage>
        {onScreen && (
          <div className="mod-card mod-onscreen">
            <div className="mod-q">{onScreen.text}</div>
            <div className="mod-name">{onScreen.displayName}</div>
          </div>
        )}
        {poll && t && (
          <div className="mod-card">
            <div className="mod-poll-prompt">{poll.prompt}</div>
            <Bars rows={t.rows} leaderId={poll.status === "closed" ? t.leaderId : null} variant="dark" />
            <div className="mod-sub">
              {t.total} {poll.multiSelect ? "respondents" : "votes"} · {poll.status === "open" ? "voting open" : "voting closed"}
            </div>
          </div>
        )}
      </section>

      <section className="mod-section">
        <div className="mod-label gold">Up next</div>
        {upNext ? (
          <div className="mod-card mod-upnext">
            <div className="mod-q big">{upNext.text}</div>
            <div className="mod-name">{upNext.displayName}</div>
          </div>
        ) : (
          <div className="mod-empty">Nothing queued yet</div>
        )}
      </section>

      <section className="mod-section">
        <div className="mod-label">Approved questions ({queue.length})</div>
        {queue.length === 0 && <div className="mod-empty">No approved questions waiting</div>}
        {queue.map((q) => (
          <div key={q.id} className={`mod-card mod-queue-item ${q.id === live.upNextId ? "is-next" : ""}`}>
            <div className="mod-q">{q.text}</div>
            <div className="mod-name">{q.displayName}</div>
          </div>
        ))}
      </section>
    </div>
  );
}

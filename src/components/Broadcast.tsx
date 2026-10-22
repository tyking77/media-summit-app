import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { EVENT_THEME, PUBLIC_URL_LABEL, THANK_YOU } from "../config";
import { useVotes } from "../lib/data";
import { tally } from "../lib/tally";
import speakers from "../data/speakers.json";
import type { LiveState, Poll, Screened, Speaker } from "../types";
import { Bars, Logo, QR, SpeakerPhoto } from "./common";

/** Fixed 1920x1080 canvas scaled to fit whatever box it's in, letterboxed. */
export function Stage({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.25);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setScale(Math.min(el.clientWidth / 1920, el.clientHeight / 1080) || 0.01);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={wrap} className={`stage-wrap ${className}`}>
      <div className="stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

function Kicker({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div className={`kicker ${light ? "kicker-light" : ""}`}>
      <span className="kicker-dot" />
      {children}
    </div>
  );
}

/** Winding "path" lines that slowly draw themselves; the theme motif. */
function PathMotif({ opacity = 0.18 }: { opacity?: number }) {
  return (
    <svg className="path-motif" viewBox="0 0 1920 1080" preserveAspectRatio="none" style={{ opacity }} aria-hidden>
      <path
        className="path-line p1"
        d="M-40 980 C 300 900, 420 760, 700 780 S 1100 900, 1300 700 S 1600 380, 1980 420"
      />
      <path className="path-line p2" d="M-40 1040 C 360 1000, 520 880, 820 900 S 1250 980, 1450 820 S 1760 560, 1980 600" />
      <path className="path-line p3" d="M-40 160 C 260 220, 520 120, 760 180 S 1180 300, 1420 220 S 1760 80, 1980 120" />
    </svg>
  );
}

function FitText({ text, max, min, className }: { text: string; max: number; min: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let size = max;
    el.style.fontSize = `${size}px`;
    while ((el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth) && size > min) {
      size -= 3;
      el.style.fontSize = `${size}px`;
    }
  }, [text, max, min]);
  return (
    <div ref={ref} className={className}>
      <span>{text}</span>
    </div>
  );
}

function IdleScreen() {
  return (
    <div className="screen screen-idle">
      <PathMotif opacity={0.14} />
      <div className="idle-logo-zone">
        <div className="sun-rays" />
        <Logo className="idle-logo" />
      </div>
      <div className="idle-strip">
        <div className="qr-card">
          <QR size={210} />
        </div>
        <div className="idle-strip-text">
          <Kicker>Join in</Kicker>
          <div className="idle-url">{PUBLIC_URL_LABEL}</div>
          <div className="idle-sub">Vote in live polls and send your questions to the panel</div>
        </div>
      </div>
    </div>
  );
}

function PollScreen({ poll }: { poll: Poll }) {
  const votes = useVotes(poll.id);
  const t = tally(poll, votes);
  const final = poll.status === "closed";
  return (
    <div className="screen screen-poll">
      <PathMotif opacity={0.1} />
      <div className="poll-head">
        <div className="poll-head-text">
          <Kicker>{final ? "Final results" : "Live poll"}</Kicker>
          <div className="poll-prompt">{poll.prompt}</div>
          {poll.multiSelect && <div className="poll-note">Select all that apply</div>}
        </div>
        {!final && (
          <div className="poll-qr">
            <div className="qr-card qr-card-small">
              <QR size={130} />
            </div>
            <div className="poll-qr-url">{PUBLIC_URL_LABEL}</div>
          </div>
        )}
      </div>
      <div className={`poll-bars rows-${poll.options.length}`}>
        <Bars rows={t.rows} leaderId={final ? t.leaderId : null} variant="stage" />
      </div>
      <div className="poll-foot">
        <TotalCount n={t.total} label={poll.multiSelect ? "respondents" : "votes"} />
        {poll.multiSelect && <span className="poll-foot-note">Percent of respondents who picked each option</span>}
      </div>
    </div>
  );
}

function TotalCount({ n, label }: { n: number; label: string }) {
  return (
    <span className="poll-total">
      <strong>{n}</strong> {n === 1 ? label.replace(/s$/, "") : label}
    </span>
  );
}

function QuestionScreen({ q }: { q: Screened }) {
  return (
    <div className="screen screen-question">
      <PathMotif opacity={0.12} />
      <div className="question-inner">
        <Kicker>Audience question</Kicker>
        <FitText text={q.text} max={112} min={56} className="question-text" />
        <div className="question-name">{q.displayName}</div>
      </div>
    </div>
  );
}

function SpeakersScreen() {
  const list = speakers as Speaker[];
  return (
    <div className="screen screen-speakers">
      <PathMotif opacity={0.1} />
      <div className="speakers-head">
        <Kicker>{EVENT_THEME}</Kicker>
        <div className="speakers-title">Meet the panel</div>
      </div>
      <div className="speakers-row">
        {list.map((s) => (
          <div className="speaker-card" key={s.id}>
            <SpeakerPhoto src={s.photo} name={s.name} size={290} />
            <div className="speaker-role">{s.role}</div>
            <div className="speaker-name">
              {s.name}
              {s.classYear ? <span className="speaker-year"> {s.classYear}</span> : null}
            </div>
            <div className="speaker-title">{s.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ThankYouScreen({ winners }: { winners: string[] }) {
  return (
    <div className="screen screen-thanks">
      <PathMotif opacity={0.14} />
      <Logo className="thanks-logo" />
      <div className="thanks-headline">{THANK_YOU.headline}</div>
      <div className="thanks-reminder">{THANK_YOU.reminder}</div>
      {winners.length > 0 && (
        <div className="thanks-winners">
          <div className="thanks-winners-label">Prize winners</div>
          <div className="thanks-winners-list">
            {winners.map((w, i) => (
              <span key={w + i} className="winner" style={{ animationDelay: `${0.4 + i * 0.35}s` }}>
                {w}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ModeView({ live, polls, screened }: { live: LiveState; polls: Poll[]; screened: Screened[] }) {
  if (live.mode === "poll") {
    const p = polls.find((x) => x.id === live.pollId);
    if (p) return <PollScreen poll={p} />;
  }
  if (live.mode === "question") {
    const q = screened.find((x) => x.id === live.questionId);
    if (q) return <QuestionScreen q={q} />;
  }
  if (live.mode === "speakers") return <SpeakersScreen />;
  if (live.mode === "thankyou") return <ThankYouScreen winners={live.winners || []} />;
  return <IdleScreen />;
}

function layerKey(live: LiveState) {
  if (live.mode === "poll") return `poll:${live.pollId}`;
  if (live.mode === "question") return `question:${live.questionId}`;
  return live.mode;
}

/** The full broadcast picture, with a ~600ms crossfade between modes. */
export function BroadcastScreen({ live, polls, screened }: { live: LiveState; polls: Poll[]; screened: Screened[] }) {
  const key = layerKey(live);
  const [layers, setLayers] = useState<{ key: string; live: LiveState }[]>([{ key, live }]);
  useEffect(() => {
    setLayers((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.key === key) return [...prev.slice(0, -1), { key, live }];
      return [...prev.slice(-1), { key, live }];
    });
    const t = setTimeout(() => setLayers((prev) => prev.slice(-1)), 700);
    return () => clearTimeout(t);
  }, [key, live]);
  return (
    <div className="broadcast-root">
      {layers.map((l, i) => (
        <div key={l.key} className={`layer ${i === layers.length - 1 ? "layer-in" : "layer-out"}`}>
          <ModeView live={l.live} polls={polls} screened={screened} />
        </div>
      ))}
    </div>
  );
}

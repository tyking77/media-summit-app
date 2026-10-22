import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { LOGO, LOGO_FALLBACK, QR_TARGET } from "../config";
import type { TallyRow } from "../lib/tally";

export function Logo({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const [src, setSrc] = useState(LOGO);
  return (
    <img
      src={src}
      onError={() => src !== LOGO_FALLBACK && setSrc(LOGO_FALLBACK)}
      alt="Media Summit logo"
      className={className}
      style={style}
      draggable={false}
    />
  );
}

export function QR({ size, dark = "#0b3d22", light = "#00000000" }: { size: number; dark?: string; light?: string }) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(QR_TARGET, { margin: 0, width: size * 2, color: { dark, light }, errorCorrectionLevel: "M" })
      .then(setUrl)
      .catch(() => {});
  }, [size, dark, light]);
  return url ? <img src={url} width={size} height={size} alt="QR code to join" /> : <div style={{ width: size, height: size }} />;
}

/** Eases a number toward its target so counts roll up instead of jumping. */
export function useAnimatedNumber(target: number, duration = 900) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const raf = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const begin = from.current;
    cancelAnimationFrame(raf.current);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = begin + (target - begin) * eased;
      from.current = v;
      setValue(v);
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

function BarRow({
  row,
  leader,
  variant,
  showCount,
}: {
  row: TallyRow;
  leader: boolean;
  variant: "stage" | "phone" | "dark";
  showCount: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const pct = useAnimatedNumber(row.pct);
  const count = useAnimatedNumber(row.count);
  return (
    <div className={`bar-row bar-${variant} ${leader ? "is-leader" : ""}`}>
      <div className="bar-label">{row.text}</div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: mounted ? `${Math.max(row.pct, 0.6)}%` : "0%" }} />
      </div>
      <div className="bar-value">
        <span className="bar-pct">{Math.round(pct)}%</span>
        {showCount && <span className="bar-count">{Math.round(count)}</span>}
      </div>
    </div>
  );
}

export function Bars({
  rows,
  leaderId,
  variant,
  showCount = true,
}: {
  rows: TallyRow[];
  leaderId: string | null;
  variant: "stage" | "phone" | "dark";
  showCount?: boolean;
}) {
  return (
    <div className={`bars bars-${variant}`}>
      {rows.map((r) => (
        <BarRow key={r.id} row={r} leader={leaderId === r.id} variant={variant} showCount={showCount} />
      ))}
    </div>
  );
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function SpeakerPhoto({ src, name, size }: { src: string; name: string; size: number }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <div className="speaker-initials" style={{ width: size, height: size, fontSize: size * 0.36 }}>
        {initials(name)}
      </div>
    );
  return (
    <img
      className="speaker-photo"
      src={src}
      alt={name}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}

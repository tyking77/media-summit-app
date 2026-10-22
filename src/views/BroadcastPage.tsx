import { useEffect, useState } from "react";
import { BroadcastScreen, Stage } from "../components/Broadcast";
import { useLive, usePolls, useScreened, useSilentAuth } from "../lib/data";

export default function BroadcastPage() {
  const user = useSilentAuth();
  const ready = !!user;
  const { live, offline } = useLive(ready);
  const polls = usePolls(ready);
  const screened = useScreened(ready);
  const [cursorHidden, setCursorHidden] = useState(false);

  useEffect(() => {
    let t = setTimeout(() => setCursorHidden(true), 3000);
    const move = () => {
      setCursorHidden(false);
      clearTimeout(t);
      t = setTimeout(() => setCursorHidden(true), 3000);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("keydown", key);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("keydown", key);
    };
  }, []);

  return (
    <div className={`broadcast-page ${cursorHidden ? "no-cursor" : ""}`}>
      <Stage>
        <BroadcastScreen live={live} polls={polls} screened={screened} />
      </Stage>
      {offline && <div className="offline-dot" title="Reconnecting" />}
      {!cursorHidden && <div className="broadcast-hint">Press F for full screen</div>}
    </div>
  );
}

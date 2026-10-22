import { useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { auth, db, firebaseConfigured } from "../firebase";
import {
  DEFAULT_LIVE,
  type Attendee,
  type LiveState,
  type Poll,
  type Question,
  type Screened,
  type Vote,
} from "../types";

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [ready, setReady] = useState(false);
  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setReady(true);
      }),
    []
  );
  return { user, ready };
}

/** For broadcast/moderator: make sure we have *some* identity so rules allow reads. */
export function useSilentAuth() {
  const { user, ready } = useAuthUser();
  useEffect(() => {
    if (ready && !user && firebaseConfigured) {
      signInAnonymously(auth).catch((e) => console.warn("anon sign-in failed", e));
    }
  }, [ready, user]);
  return user;
}

const withId = <T,>(d: { id: string; data: () => DocumentData }) => ({ id: d.id, ...d.data() }) as T;

export function useLive(enabled = true) {
  const [live, setLive] = useState<LiveState>(DEFAULT_LIVE);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      doc(db, "live", "state"),
      { includeMetadataChanges: true },
      (s) => {
        setOffline(s.metadata.fromCache);
        if (s.exists()) setLive({ ...DEFAULT_LIVE, ...(s.data() as Partial<LiveState>) });
      },
      () => setOffline(true)
    );
  }, [enabled]);
  return { live, offline };
}

export function usePolls(enabled = true) {
  const [polls, setPolls] = useState<Poll[]>([]);
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      collection(db, "polls"),
      (s) => setPolls(s.docs.map((d) => withId<Poll>(d)).sort((a, b) => a.order - b.order)),
      (e) => console.warn("polls", e)
    );
  }, [enabled]);
  return polls;
}

export function useVotes(pollId: string | null | undefined) {
  const [votes, setVotes] = useState<Vote[]>([]);
  useEffect(() => {
    setVotes([]);
    if (!pollId) return;
    return onSnapshot(
      collection(db, "polls", pollId, "votes"),
      (s) => setVotes(s.docs.map((d) => withId<Vote>(d))),
      (e) => console.warn("votes", e)
    );
  }, [pollId]);
  return votes;
}

export function useScreened(enabled = true) {
  const [items, setItems] = useState<Screened[]>([]);
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      collection(db, "screened"),
      (s) => setItems(s.docs.map((d) => withId<Screened>(d)).sort((a, b) => a.order - b.order)),
      (e) => console.warn("screened", e)
    );
  }, [enabled]);
  return items;
}

export function useAttendee(uid: string | undefined) {
  const [attendee, setAttendee] = useState<Attendee | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setAttendee(null);
    setLoaded(false);
    if (!uid) return;
    return onSnapshot(
      doc(db, "attendees", uid),
      (s) => {
        setAttendee(s.exists() ? withId<Attendee>(s) : null);
        setLoaded(true);
      },
      () => setLoaded(true)
    );
  }, [uid]);
  return { attendee, loaded };
}

export function useMyQuestions(uid: string | undefined) {
  const [qs, setQs] = useState<Question[]>([]);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collection(db, "questions"), where("uid", "==", uid)),
      (s) =>
        setQs(
          s.docs
            .map((d) => withId<Question>(d))
            .sort((a, b) => (b.createdAt?.toMillis() ?? Date.now()) - (a.createdAt?.toMillis() ?? Date.now()))
        ),
      (e) => console.warn("my questions", e)
    );
  }, [uid]);
  return qs;
}

export function useCollection<T>(path: string, enabled: boolean) {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      collection(db, path),
      (s) => setItems(s.docs.map((d) => withId<T>(d))),
      (e) => console.warn(path, e)
    );
  }, [path, enabled]);
  return items;
}

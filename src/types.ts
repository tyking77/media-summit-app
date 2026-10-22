import type { Timestamp } from "firebase/firestore";

export type Mode = "idle" | "poll" | "question" | "speakers" | "thankyou";

export interface Attendee {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string | null;
  type: "student" | "guest";
  firstSeenAt?: Timestamp;
  lastSeenAt?: Timestamp;
  professors?: string;
}

export interface PollOption {
  id: string;
  text: string;
}

export interface Poll {
  id: string;
  prompt: string;
  options: PollOption[];
  multiSelect: boolean;
  order: number;
  status: "draft" | "open" | "closed";
  adjustments?: Record<string, number>;
}

export interface Vote {
  id: string; // uid
  choices: string[];
  updatedAt?: Timestamp;
}

export interface Question {
  id: string;
  uid: string;
  name: string;
  type: "student" | "guest";
  anonymous: boolean;
  text: string;
  editedText?: string;
  createdAt?: Timestamp;
  status: "pending" | "approved" | "rejected" | "answered";
}

export interface Screened {
  id: string;
  displayName: string;
  text: string;
  approvedAt?: Timestamp;
  order: number;
  answered: boolean;
}

export interface LiveState {
  mode: Mode;
  pollId: string | null;
  questionId: string | null;
  upNextId: string | null;
  winners: string[];
  winnerUids?: string[];
}

export const DEFAULT_LIVE: LiveState = {
  mode: "idle",
  pollId: null,
  questionId: null,
  upNextId: null,
  winners: [],
};

export interface Speaker {
  id: string;
  name: string;
  role: string;
  classYear: string;
  title: string;
  bio: string;
  photo: string;
}

// Small helpers for what each device remembers. Wrapped in try/catch because storage can be blocked.
export interface MemberSession {
  memberId: string;
  memberToken: string;
  surveyId: string;
  surveyName: string;
  name: string;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export const getMember = (): MemberSession | null => {
  const raw = read("tt-member");
  try {
    return raw ? (JSON.parse(raw) as MemberSession) : null;
  } catch {
    return null;
  }
};
export const setMember = (m: MemberSession) => write("tt-member", JSON.stringify(m));

export const getLeaderToken = (surveyId: string) => read(`tt-leader-${surveyId}`);
export const setLeader = (surveyId: string, token: string, name: string) => {
  write(`tt-leader-${surveyId}`, token);
  write(`tt-leader-name-${surveyId}`, name);
};

export function listLeaderSurveys(): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || "";
      if (k.startsWith("tt-leader-name-")) {
        const id = k.slice("tt-leader-name-".length);
        out.push({ id, name: localStorage.getItem(k) || id });
      }
    }
  } catch {}
  return out;
}

export const getRoom = () => read("tt-room") || "";
export const setRoom = (r: string) => write("tt-room", r);

export const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

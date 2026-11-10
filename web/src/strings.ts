// Общие типы. Тексты интерфейса на обоих языках лежат в i18n.ts.

export type Kind = "thing" | "book" | "help";
export type Direction = "offer" | "want";
export type ItemStatus = "draft" | "available" | "busy" | "hidden";
export type ReqStatus = "pending" | "accepted" | "declined" | "handed" | "done" | "cancelled";
export type Action = "accept" | "decline" | "cancel" | "handover" | "complete";

export const KINDS: Kind[] = ["thing", "book", "help"];
export const kindEmoji: Record<Kind, string> = { thing: "🧰", book: "📚", help: "🤝" };

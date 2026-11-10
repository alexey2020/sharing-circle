import type { Direction, Kind } from "./types";

export type ReqStatus = "pending" | "accepted" | "declined" | "handed" | "done" | "cancelled";
export type Action = "accept" | "decline" | "cancel" | "handover" | "complete";
export type Role = "owner" | "requester";

export const ACTIONS: Action[] = ["accept", "decline", "cancel", "handover", "complete"];
export const ACTIVE: ReqStatus[] = ["pending", "accepted", "handed"];

/**
 * «Одалживаемое» — вещь или книга, которую предлагают: она одна, её передают и возвращают.
 * Помощь и объявления «ищу» не блокируются одним запросом и не имеют шага передачи.
 */
export const isLendable = (item: { kind: Kind; direction: Direction }) =>
  item.direction === "offer" && (item.kind === "thing" || item.kind === "book");

/**
 * Переходы статусов запроса. Возвращает null, если действие недопустимо.
 *
 *   pending  → accepted | declined (владелец), cancelled (просящий)
 *   accepted → handed (владелец, только одалживаемое), cancelled (любой),
 *              done (любой, только неодалживаемое)
 *   handed   → done (владелец подтверждает возврат)
 */
export function nextStatus(status: ReqStatus, action: Action, role: Role, lendable: boolean): ReqStatus | null {
  switch (status) {
    case "pending":
      if (role === "owner" && action === "accept") return "accepted";
      if (role === "owner" && action === "decline") return "declined";
      if (role === "requester" && action === "cancel") return "cancelled";
      return null;
    case "accepted":
      if (action === "cancel") return "cancelled";
      if (lendable && role === "owner" && action === "handover") return "handed";
      if (!lendable && action === "complete") return "done";
      return null;
    case "handed":
      if (role === "owner" && action === "complete") return "done";
      return null;
    default:
      return null;
  }
}

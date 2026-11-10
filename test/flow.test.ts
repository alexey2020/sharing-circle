import { describe, expect, it } from "vitest";
import { isLendable, nextStatus } from "../worker/src/flow";

describe("isLendable", () => {
  it("одалживаются только предлагаемые вещи и книги", () => {
    expect(isLendable({ kind: "thing", direction: "offer" })).toBe(true);
    expect(isLendable({ kind: "book", direction: "offer" })).toBe(true);
    expect(isLendable({ kind: "help", direction: "offer" })).toBe(false);
    expect(isLendable({ kind: "help", direction: "offer" })).toBe(false);
    expect(isLendable({ kind: "thing", direction: "want" })).toBe(false);
  });
});

describe("nextStatus", () => {
  it("вещь проходит путь: запрос → принят → передано → возвращено", () => {
    expect(nextStatus("pending", "accept", "owner", true)).toBe("accepted");
    expect(nextStatus("accepted", "handover", "owner", true)).toBe("handed");
    expect(nextStatus("handed", "complete", "owner", true)).toBe("done");
  });

  it("помощь завершается без передачи, любой из сторон", () => {
    expect(nextStatus("accepted", "handover", "owner", false)).toBeNull();
    expect(nextStatus("accepted", "complete", "owner", false)).toBe("done");
    expect(nextStatus("accepted", "complete", "requester", false)).toBe("done");
  });

  it("просящий не может сам принять, передать или подтвердить возврат", () => {
    expect(nextStatus("pending", "accept", "requester", true)).toBeNull();
    expect(nextStatus("pending", "decline", "requester", true)).toBeNull();
    expect(nextStatus("accepted", "handover", "requester", true)).toBeNull();
    expect(nextStatus("handed", "complete", "requester", true)).toBeNull();
    expect(nextStatus("accepted", "complete", "owner", true)).toBeNull();
  });

  it("отмена: до принятия — только просящий, после — любой, после передачи — никто", () => {
    expect(nextStatus("pending", "cancel", "requester", true)).toBe("cancelled");
    expect(nextStatus("pending", "cancel", "owner", true)).toBeNull();
    expect(nextStatus("accepted", "cancel", "owner", true)).toBe("cancelled");
    expect(nextStatus("accepted", "cancel", "requester", true)).toBe("cancelled");
    expect(nextStatus("handed", "cancel", "requester", true)).toBeNull();
  });

  it("завершённые запросы не меняются", () => {
    for (const s of ["declined", "done", "cancelled"] as const) {
      for (const a of ["accept", "decline", "cancel", "handover", "complete"] as const) {
        expect(nextStatus(s, a, "owner", true)).toBeNull();
        expect(nextStatus(s, a, "requester", false)).toBeNull();
      }
    }
  });
});

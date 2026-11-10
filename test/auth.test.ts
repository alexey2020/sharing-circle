import { describe, expect, it } from "vitest";
import { signInitData, verifyInitData } from "../worker/src/auth";

const TOKEN = "123456:TEST-TOKEN";
const now = 1_800_000_000_000;
const fields = (extra: Record<string, string> = {}) => ({
  auth_date: String(now / 1000 - 60),
  query_id: "AAE",
  user: JSON.stringify({ id: 42, first_name: "Аня", username: "anya" }),
  ...extra,
});

describe("verifyInitData", () => {
  it("принимает корректно подписанные данные", async () => {
    const data = await signInitData(fields({ start_param: "c7" }), TOKEN);
    const result = await verifyInitData(data, TOKEN, 86400, now);
    expect(result?.user).toMatchObject({ id: 42, first_name: "Аня" });
    expect(result?.startParam).toBe("c7");
  });

  it("отклоняет подделанного пользователя", async () => {
    const data = await signInitData(fields(), TOKEN);
    const params = new URLSearchParams(data);
    params.set("user", JSON.stringify({ id: 1, first_name: "Злоумышленник" }));
    expect(await verifyInitData(params.toString(), TOKEN, 86400, now)).toBeNull();
  });

  it("отклоняет подпись другим токеном", async () => {
    const data = await signInitData(fields(), "999:OTHER");
    expect(await verifyInitData(data, TOKEN, 86400, now)).toBeNull();
  });

  it("отклоняет устаревшие данные", async () => {
    const data = await signInitData(fields({ auth_date: String(now / 1000 - 90000) }), TOKEN);
    expect(await verifyInitData(data, TOKEN, 86400, now)).toBeNull();
  });

  it("отклоняет данные без подписи", async () => {
    expect(await verifyInitData("user=%7B%22id%22%3A1%7D&auth_date=1", TOKEN, 86400, now)).toBeNull();
  });
});

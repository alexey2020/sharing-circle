import { t, type Lang } from "./i18n";
import type { Action, Direction, ItemStatus, Kind, ReqStatus } from "./strings";

declare global {
  interface Window {
    Telegram?: { WebApp?: any };
  }
}

export const tgApp = window.Telegram?.WebApp;
const initData: string = tgApp?.initData || "";
// Только для локальной разработки: http://localhost:8787/?user=1
const devUser = new URLSearchParams(location.search).get("user");

export const hasAuth = !!initData || !!devUser;

function authHeaders(): Record<string, string> {
  if (initData) return { Authorization: `tma ${initData}` };
  if (devUser) return { "X-Dev-User": devUser };
  return {};
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { ...authHeaders(), ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as any).error ?? t.errGeneric);
  return json as T;
}

export interface Circle {
  id: number;
  title: string;
}
export interface Me {
  user: { id: number; name: string };
  circles: Circle[];
  botUsername: string;
  canCreate: boolean;
  lang: Lang;
  openItem: number | null;
}
export interface ItemCard {
  id: number;
  kind: Kind;
  direction: Direction;
  title: string;
  status: ItemStatus;
  ownerId: number;
  ownerName: string;
  photo: string | null;
}
export interface Req {
  id: number;
  status: ReqStatus;
  message: string;
  dueDate: string | null;
  name: string;
  username: string | null;
}
export interface Item {
  id: number;
  kind: Kind;
  direction: Direction;
  title: string;
  description: string;
  status: ItemStatus;
  lendable: boolean;
  isOwner: boolean;
  owner: { id: number; name: string; username: string | null };
  photos: string[];
  circles: Circle[];
  holder: { name: string; dueDate: string | null; status: ReqStatus } | null;
  myRequest: Req | null;
  requests: Req[];
}
export interface ReqRow {
  id: number;
  status: ReqStatus;
  message: string;
  dueDate: string | null;
  itemId: number;
  title: string;
  lendable: boolean;
  direction: Direction;
  person: { name: string; username: string | null };
}
export interface ItemInput {
  kind: Kind;
  direction: Direction;
  title: string;
  description: string;
  status: "available" | "hidden" | "draft";
  circleIds: number[];
  photoKeys: string[];
  announce?: boolean;
}

export const api = {
  me: () => request<Me>("GET", "/me"),
  setLang: (lang: Lang) => request<{ lang: Lang }>("PUT", "/lang", { lang }),
  items: (params: Record<string, string>) => request<{ items: ItemCard[] }>("GET", `/items?${new URLSearchParams(params)}`),
  item: (id: number) => request<Item>("GET", `/items/${id}`),
  createItem: (input: ItemInput) => request<{ id: number }>("POST", "/items", input),
  updateItem: (id: number, input: ItemInput) => request<{ id: number }>("PUT", `/items/${id}`, input),
  deleteItem: (id: number) => request<{ ok: true }>("DELETE", `/items/${id}`),
  ask: (id: number, message: string, dueDate: string | null) =>
    request<{ id: number }>("POST", `/items/${id}/requests`, { message, dueDate }),
  requests: () => request<{ incoming: ReqRow[]; outgoing: ReqRow[] }>("GET", "/requests"),
  act: (id: number, action: Action) => request<{ status: ReqStatus }>("POST", `/requests/${id}/${action}`),
  async uploadPhoto(blob: Blob): Promise<string> {
    const res = await fetch("/api/photos", { method: "POST", headers: { ...authHeaders(), "content-type": blob.type }, body: blob });
    const json = (await res.json().catch(() => ({}))) as { key?: string; error?: string };
    if (!res.ok || !json.key) throw new Error(json.error ?? t.errUpload);
    return json.key;
  },
};

export const photoUrl = (key: string) => `/api/photos/${key}`;

/** Уменьшает фото до 1600 px по длинной стороне, чтобы не грузить оригиналы с телефона. */
export async function shrinkPhoto(file: File, maxSide = 1600): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

export function confirmDialog(text: string): Promise<boolean> {
  if (tgApp?.showConfirm && tgApp.isVersionAtLeast?.("6.2")) {
    return new Promise((resolve) => tgApp.showConfirm(text, resolve));
  }
  return Promise.resolve(window.confirm(text));
}

export interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  ASSETS: Fetcher;
  BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  /** Секрет ссылки, по которой владелец сервиса становится администратором бота */
  ADMIN_KEY?: string;
  BOT_USERNAME: string;
  APP_URL: string;
  /** Telegram username администратора для связи — показывается на лендинге */
  ADMIN_CONTACT?: string;
  /** Адрес репозитория с кодом — показывается на лендинге */
  REPO_URL?: string;
  /** "1" только при локальной разработке: вход по заголовку X-Dev-User */
  DEV_AUTH?: string;
}

export interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  allows_write_to_pm?: boolean;
}

export type Kind = "thing" | "book" | "help";
export type Direction = "offer" | "want";
export type ItemStatus = "draft" | "available" | "busy" | "hidden";

export const KINDS: Kind[] = ["thing", "book", "help"];
export const DIRECTIONS: Direction[] = ["offer", "want"];

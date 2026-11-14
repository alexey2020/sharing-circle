/**
 * История версий — единственный источник: отсюда берётся номер версии в приложении,
 * а тест сверяет его с package.json. Новая запись — сверху.
 *
 * Нумерация: 1.x.0 — новые возможности, 1.x.y — исправления.
 * Каждой версии в git соответствует тег v<номер>.
 */
export interface Release {
  version: string;
  date: string; // YYYY-MM-DD
  en: string[];
  ru: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: "1.4.1",
    date: "2026-11-14",
    en: ["Whoever adds the bot to a chat joins the new circle right away — no need to open the catalog from the chat first."],
    ru: ["Тот, кто добавил бота в чат, сразу состоит в новом круге — не нужно сначала открывать каталог из чата."],
  },
  {
    version: "1.4.0",
    date: "2026-11-12",
    en: [
      "Version number and this list of changes at the bottom of the Help tab.",
      "Completed requests stay on the entry's card instead of disappearing.",
      "A fulfilled “Looking for” entry is hidden from the catalog automatically; you can turn it back on in editing.",
    ],
    ru: [
      "Номер версии и этот список изменений внизу вкладки «Помощь».",
      "Завершённые запросы остаются в карточке записи, а не пропадают.",
      "Выполненное «Ищу» само скрывается из каталога; включить его снова можно в редактировании.",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-11-12",
    en: [
      "“Add my entries to a circle” button in “Mine” — publish several of your entries in a new circle at once.",
      "Opened from a group chat, the catalog shows that circle's entries.",
      "The request message is fully optional, with no prompts.",
      "“What shares best” list on the Help tab and the start page.",
    ],
    ru: [
      "Кнопка «Добавить мои записи в круг» во «Моё» — сразу несколько своих записей в новый круг.",
      "Каталог, открытый из чата, показывает записи этого круга.",
      "Сообщение к запросу — полностью необязательное, без подсказок.",
      "Список «Чем лучше всего делиться» во вкладке «Помощь» и на стартовой странице.",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-11-12",
    en: [
      "Photos are shown in full, without cropping.",
      "The app retries once if the network hiccups while loading.",
    ],
    ru: [
      "Фотографии показываются целиком, без обрезки.",
      "При сбое сети приложение повторяет загрузку.",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-11-10",
    en: [
      "Help tab: how to use the service, rules and privacy.",
      "The “Help” category is now called “Favours”.",
      "“+” picks the category selected in the catalog.",
    ],
    ru: [
      "Вкладка «Помощь»: как пользоваться, правила и данные.",
      "Категория «Помощь» теперь называется «Руки».",
      "«+» сразу выбирает категорию, открытую в каталоге.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-11-10",
    en: [
      "First version: circles from Telegram group chats, a catalog of items, books and favours, requests and handovers.",
      "Notifications and return reminders from the bot.",
      "Rules, responsibility and privacy with one-time consent.",
    ],
    ru: [
      "Первая версия: круги из групповых чатов Telegram, каталог вещей, книг и помощи, запросы и передачи.",
      "Уведомления и напоминания о возврате от бота.",
      "Правила, ответственность и данные с однократным согласием.",
    ],
  },
];

export const VERSION = CHANGELOG[0].version;

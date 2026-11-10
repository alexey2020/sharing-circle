import { useSyncExternalStore } from "react";
import type { Action, Direction, Kind, ReqStatus } from "./strings";

// Все тексты интерфейса на двух языках. Английский — основной.

export type Lang = "en" | "ru";
export const LANGS: Lang[] = ["en", "ru"];

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const en = {
  appName: "Share Circle",
  date: (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${Number(d)} ${MONTHS_EN[Number(m) - 1]} ${y}`;
  },

  kind: { thing: "Item", book: "Book", help: "Favour" } as Record<Kind, string>,
  kindPlural: { thing: "Items", book: "Books", help: "Favours" } as Record<Kind, string>,
  direction: { offer: "Offering", want: "Looking for" } as Record<Direction, string>,
  itemStatus: { draft: "Draft", available: "Available", busy: "Taken", hidden: "Hidden" },
  reqStatus: {
    pending: "Awaiting reply",
    accepted: "Accepted",
    handed: "Handed over",
    done: "Completed",
    declined: "Declined",
    cancelled: "Cancelled",
  } as Record<ReqStatus, string>,

  tabs: { catalog: "Catalog", requests: "Requests", mine: "Mine", help: "Help" },
  back: "← Back",
  add: "Add",
  language: "Language",
  errGeneric: "That didn't work. Please try again.",
  errUpload: "Couldn't upload the photo",
  errLogin: "Couldn't sign in",

  // Каталог
  search: "Search",
  all: "All",
  anyDirection: "Any",
  offered: "Offered",
  wanted: "Wanted",
  allCircles: "All circles",
  circle: "Circle",
  wantBadge: "Wanted",
  noCirclesTitle: "You aren't in any circle yet",
  noCirclesWhat: "A circle is a Telegram group chat that has a shared catalog.",
  noCirclesCreate: (bot: string) => `Add the bot @${bot} to a chat of friends, colleagues or a club — and the chat becomes a circle.`,
  noCirclesInvite: "New circles are created by invitation. Ask the person who told you about the bot for an invite link.",
  noCirclesAlready: "If the bot is already in your chat, open the catalog with the button under its message there.",
  emptyFiltered: "Nothing found",
  emptyFilteredHint: "Try changing the filters.",
  emptyCatalog: "The catalog is empty so far",
  emptyCatalogHint: "Add the first listing with the “+” button below.",
  mineEmpty: "You haven't added anything yet",
  mineEmptyHint: "Tap “+” or send the bot a photo of an item with a caption.",

  // Карточка
  owner: "Owner",
  seeker: "Who's looking",
  you: "You",
  circles: "Circles",
  heldBy: "Currently with",
  promisedTo: "Promised to",
  until: (date: string) => `, until ${date}`,
  draftNotice: "This is a draft: only you can see it. Open editing to publish it.",
  requests: "Requests",
  returnsBy: (date: string) => `Will return by ${date}`,
  edit: "Edit",
  delete: "Delete",
  deleteConfirm: (title: string) => `Delete “${title}”?`,
  requestSent: "Request sent. The owner got a notification in Telegram.",
  requestAccepted: "Request accepted. Arrange the handover in a private chat.",
  withYou: (date: string | null) => "The item is with you." + (date ? ` Return by ${date}.` : ""),
  messageTo: (name: string) => `Message ${name}`,
  busyNotice: "Taken right now. Check back later.",
  message: "Message",
  messagePlaceholder: "When and what for",
  returnBy: "I'll return it by",
  sendRequest: "Send request",
  cancel: "Cancel",
  ask: { want: "I can help", lend: "Ask to borrow", other: "Get in touch" },
  act: {
    accept: "Accept",
    decline: "Decline",
    cancelRequest: "Cancel request",
    handed: "Handed over",
    cancel: "Cancel",
    done: "Done",
    returned: "Returned",
  },

  // Форма
  newEntry: "New listing",
  editing: "Edit listing",
  title: "Title",
  description: "Description",
  descriptionPlaceholder: "Condition, terms, when it suits you",
  photos: "Photos",
  removePhoto: "Remove photo",
  visibleTo: "Visible to",
  showInCatalog: "Show in the catalog",
  announce: "Announce in the circle's chat",
  publish: "Publish",
  save: "Save",
  needTitle: "Enter a title",
  needCircle: "Choose at least one circle",
  needCircleFirst: "To share, you need at least one circle. Open the catalog with the button under the bot's message in your chat.",
  placeholder: {
    want: { book: "Looking for “Dune”", other: "Need a stepladder for the weekend" },
    offer: { thing: "Drill, tent, projector…", book: "Author and title", help: "Help with moving, teach knitting…" },
  },

  // Запросы
  requestsEmpty: "No requests yet",
  requestsEmptyHint: "Everything people ask of you and everything you ask for will show up here.",
  incoming: "Asked of me",
  outgoing: "My requests",

  landing: {
    headline: "Share items, books and favours with your own people",
    lead: "A Telegram bot that turns a group chat into a shared catalog. Someone in your chat surely has what you need for one evening — you just have to find out.",
    cta: "Open in Telegram",
    howTitle: "How it works",
    steps: [
      { title: "A chat becomes a circle", text: "The bot is added to a group chat of friends, colleagues or a club. The chat gets a shared catalog that only its members can see." },
      { title: "Everyone adds their own", text: "A drill, a tent, a book, or an offer to fix a bike or help with a move. A photo and a few words are enough." },
      { title: "Asking takes one tap", text: "The owner gets the request in a private message and answers with a button. Then you agree on how to meet." },
    ],
    kindsTitle: "What you can share",
    kinds: [
      { emoji: "🧰", title: "Items", text: "Tools, gadgets, gear, kids' stuff — anything you rarely need and would rather not buy." },
      { emoji: "📚", title: "Books", text: "Everyone's home library becomes a shared one." },
      { emoji: "🤝", title: "Favours", text: "Look after a cat, give a lift, teach knitting or explain spreadsheets — any favour or know-how. Free, between friends." },
    ],
    featuresTitle: "What the bot does",
    features: [
      { title: "See who has what", text: "Each listing shows whether it's available, who has it now and until when." },
      { title: "You can ask, too", text: "Besides “offering” there is “looking for”: say what you need and whoever has it will respond." },
      { title: "Nothing gets lost", text: "The bot reminds you about return dates and reports every step: accepted, handed over, returned." },
      { title: "No sign-up", text: "Everything works inside Telegram. No separate app, login or password." },
      { title: "Several circles", text: "You can be in several circles and choose who sees each listing." },
      { title: "Stays quiet", text: "New listings can go to a separate chat topic or be added silently." },
    ],
    startTitle: "How to start",
    startHave: "The bot is already in your chat.",
    startHaveText: "Tap “Open catalog” under its message in the chat, or send the command",
    startNew: "You want a circle in your own chat.",
    startNewText: "New circles are created by invitation: ask the person who told you about the bot for a link, follow it and add the bot to your chat.",
    contactTitle: "Contact",
    contactText: "Questions, ideas or want your own circle — write to the admin:",
    repoText: "The code is open:",
  },
};

const ru: typeof en = {
  appName: "Share Circle",
  date: (iso) => iso.split("-").reverse().join("."),

  kind: { thing: "Вещь", book: "Книга", help: "Руки" },
  kindPlural: { thing: "Вещи", book: "Книги", help: "Руки" },
  direction: { offer: "Предлагаю", want: "Ищу" },
  itemStatus: { draft: "Черновик", available: "Свободно", busy: "Занято", hidden: "Скрыто" },
  reqStatus: { pending: "Ждёт ответа", accepted: "Принят", handed: "На руках", done: "Завершён", declined: "Отклонён", cancelled: "Отменён" },

  tabs: { catalog: "Каталог", requests: "Запросы", mine: "Моё", help: "Помощь" },
  back: "← Назад",
  add: "Добавить",
  language: "Язык",
  errGeneric: "Не получилось. Попробуйте ещё раз.",
  errUpload: "Не удалось загрузить фото",
  errLogin: "Не получилось войти",

  search: "Поиск",
  all: "Всё",
  anyDirection: "Любые",
  offered: "Предлагают",
  wanted: "Ищут",
  allCircles: "Все круги",
  circle: "Круг",
  wantBadge: "Ищу",
  noCirclesTitle: "Вы пока не состоите ни в одном круге",
  noCirclesWhat: "Круг — это групповой чат в Telegram, у которого есть общий каталог.",
  noCirclesCreate: (bot) => `Добавьте бота @${bot} в чат друзей, коллег или клуба — и чат станет кругом.`,
  noCirclesInvite: "Новые круги создаются по приглашению. Попросите ссылку-приглашение у того, кто рассказал вам о боте.",
  noCirclesAlready: "Если бот уже есть в вашем чате, откройте каталог по кнопке из его сообщения в чате.",
  emptyFiltered: "Ничего не нашлось",
  emptyFilteredHint: "Попробуйте изменить фильтры.",
  emptyCatalog: "В каталоге пока пусто",
  emptyCatalogHint: "Добавьте первую запись — кнопка «+» внизу.",
  mineEmpty: "Вы ещё ничего не добавили",
  mineEmptyHint: "Нажмите «+» или пришлите боту фото вещи с подписью.",

  owner: "Владелец",
  seeker: "Кто ищет",
  you: "Вы",
  circles: "Круги",
  heldBy: "Сейчас у",
  promisedTo: "Обещано",
  until: (date) => `, до ${date}`,
  draftNotice: "Это черновик: его видите только вы. Откройте редактирование, чтобы опубликовать.",
  requests: "Запросы",
  returnsBy: (date) => `Вернёт до ${date}`,
  edit: "Редактировать",
  delete: "Удалить",
  deleteConfirm: (title) => `Удалить «${title}»?`,
  requestSent: "Запрос отправлен. Владелец получил уведомление в Telegram.",
  requestAccepted: "Запрос принят. Договоритесь о встрече в личных сообщениях.",
  withYou: (date) => "Вещь у вас." + (date ? ` Вернуть до ${date}.` : ""),
  messageTo: (name) => `Написать: ${name}`,
  busyNotice: "Сейчас занято. Загляните позже.",
  message: "Сообщение",
  messagePlaceholder: "Когда и зачем нужно",
  returnBy: "Верну до",
  sendRequest: "Отправить запрос",
  cancel: "Отмена",
  ask: { want: "Могу помочь", lend: "Попросить", other: "Обратиться" },
  act: {
    accept: "Принять",
    decline: "Отклонить",
    cancelRequest: "Отменить запрос",
    handed: "Вещь передана",
    cancel: "Отменить",
    done: "Готово",
    returned: "Вещь вернули",
  },

  newEntry: "Новая запись",
  editing: "Редактирование",
  title: "Название",
  description: "Описание",
  descriptionPlaceholder: "Состояние, условия, когда удобно",
  photos: "Фото",
  removePhoto: "Убрать фото",
  visibleTo: "Кому видно",
  showInCatalog: "Показывать в каталоге",
  announce: "Сообщить в чат круга",
  publish: "Опубликовать",
  save: "Сохранить",
  needTitle: "Напишите название",
  needCircle: "Выберите хотя бы один круг",
  needCircleFirst: "Чтобы делиться, нужен хотя бы один круг. Откройте каталог по кнопке из сообщения бота в вашем чате.",
  placeholder: {
    want: { book: "Ищу «Мастера и Маргариту»", other: "Нужна стремянка на выходные" },
    offer: { thing: "Дрель, палатка, проектор…", book: "Автор и название", help: "Помогу с переездом, научу вязать…" },
  },

  requestsEmpty: "Запросов пока нет",
  requestsEmptyHint: "Здесь появится всё, что просят у вас и что просите вы.",
  incoming: "Просят у меня",
  outgoing: "Прошу я",

  landing: {
    headline: "Делитесь вещами, книгами и помощью со своими",
    lead: "Бот для Telegram, который превращает групповой чат в общий каталог. У соседа по чату наверняка есть то, что вам нужно на один вечер, — осталось об этом узнать.",
    cta: "Открыть в Telegram",
    howTitle: "Как это работает",
    steps: [
      { title: "Чат становится кругом", text: "Бота добавляют в групповой чат друзей, коллег или клуба. У чата появляется общий каталог, который видят только его участники." },
      { title: "Каждый добавляет своё", text: "Дрель, палатка, книга или готовность починить велосипед и помочь с переездом. Хватит фото и пары слов." },
      { title: "Попросить — одна кнопка", text: "Владелец получает запрос в личные сообщения и отвечает кнопкой. Дальше вы договариваетесь, как удобно встретиться." },
    ],
    kindsTitle: "Чем можно делиться",
    kinds: [
      { emoji: "🧰", title: "Вещи", text: "Инструменты, техника, снаряжение, детские вещи — всё, что нужно редко и жалко покупать." },
      { emoji: "📚", title: "Книги", text: "Домашняя библиотека каждого становится общей." },
      { emoji: "🤝", title: "Руки", text: "Посидеть с кошкой, подвезти, научить вязанию или разобраться с таблицами — любая помощь или умение. Бесплатно, по-дружески." },
    ],
    featuresTitle: "Что умеет бот",
    features: [
      { title: "Видно, что у кого", text: "На карточке написано, свободна ли вещь, у кого она сейчас и до какого числа." },
      { title: "Можно и попросить", text: "Кроме «предлагаю» есть «ищу»: напишите, что вам нужно, и откликнется тот, у кого это есть." },
      { title: "Ничего не теряется", text: "Бот напомнит о сроке возврата и сообщит о каждом шаге: запрос принят, вещь передана, вещь вернулась." },
      { title: "Без регистрации", text: "Всё работает внутри Telegram. Отдельного приложения, логина и пароля нет." },
      { title: "Несколько кругов", text: "Можно состоять в нескольких кругах и для каждой записи выбирать, кому она видна." },
      { title: "Не шумит", text: "Новинки можно направить в отдельную тему чата или добавлять молча." },
    ],
    startTitle: "Как начать",
    startHave: "Бот уже есть в вашем чате.",
    startHaveText: "Нажмите «Открыть каталог» под его сообщением в чате или отправьте там команду",
    startNew: "Хотите завести круг в своём чате.",
    startNewText: "Новые круги создаются по приглашению: попросите ссылку у того, кто рассказал вам о боте, перейдите по ней и добавьте бота в свой чат.",
    contactTitle: "Связь",
    contactText: "Вопросы, идеи или хотите свой круг — пишите администратору:",
    repoText: "Код открыт:",
  },
};

const dict = { en, ru };

function initialLang(): Lang {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem("lang");
  } catch {
    // хранилище может быть недоступно — тогда определяем язык заново
  }
  if (saved === "en" || saved === "ru") return saved;
  const code: string = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.language_code ?? navigator.language ?? "en";
  return code.toLowerCase().startsWith("ru") ? "ru" : "en";
}

let current: Lang = initialLang();
/** Тексты на текущем языке. Переменная обновляется при смене языка, поэтому читать её нужно во время отрисовки. */
export let t = dict[current];
document.documentElement.lang = current;

const listeners = new Set<() => void>();

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  t = dict[lang];
  document.documentElement.lang = lang;
  try {
    localStorage.setItem("lang", lang);
  } catch {
    // не страшно: язык просто не запомнится до следующего открытия
  }
  listeners.forEach((fn) => fn());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
  );
}

/** Какие кнопки показать под запросом, в зависимости от роли и статуса. */
export function requestActions(status: ReqStatus, role: "owner" | "requester", lendable: boolean): { action: Action; label: string; primary?: boolean }[] {
  const a = t.act;
  if (status === "pending") {
    return role === "owner"
      ? [{ action: "accept", label: a.accept, primary: true }, { action: "decline", label: a.decline }]
      : [{ action: "cancel", label: a.cancelRequest }];
  }
  if (status === "accepted") {
    if (lendable) {
      return role === "owner"
        ? [{ action: "handover", label: a.handed, primary: true }, { action: "cancel", label: a.cancel }]
        : [{ action: "cancel", label: a.cancelRequest }];
    }
    return [{ action: "complete", label: a.done, primary: true }, { action: "cancel", label: a.cancel }];
  }
  if (status === "handed" && role === "owner") return [{ action: "complete", label: a.returned, primary: true }];
  return [];
}

export function askLabel(item: { kind: Kind; direction: Direction }): string {
  if (item.direction === "want") return t.ask.want;
  return item.kind === "thing" || item.kind === "book" ? t.ask.lend : t.ask.other;
}

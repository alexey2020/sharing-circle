// Тексты бота и сервера на двух языках. Английский — основной.

export type Lang = "en" | "ru";
export const LANGS: Lang[] = ["en", "ru"];
export const LANG_NAMES: Record<Lang, string> = { en: "English", ru: "Русский" };

/** Язык по коду из Telegram (language_code): русский — для ru, иначе английский. */
export const pickLang = (code?: string | null): Lang => (code?.toLowerCase().startsWith("ru") ? "ru" : "en");
export const asLang = (v: unknown): Lang | null => (v === "en" || v === "ru" ? v : null);

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(iso: string, lang: Lang): string {
  const [y, m, d] = iso.split("-");
  return lang === "ru" ? `${d}.${m}.${y}` : `${Number(d)} ${MONTHS_EN[Number(m) - 1]} ${y}`;
}

const en = {
  kind: { thing: "Item", book: "Book", help: "Service" },
  direction: { offer: "offered", want: "wanted" },
  view: "View",
  open: "Open",
  openCatalog: "Open catalog",
  circleDefault: "Circle",
  untitled: "Untitled",

  // Запросы
  newRequestOffer: (name: string, title: string) => `🙋 <b>${name}</b> is asking for “${title}”`,
  newRequestWant: (name: string, title: string) => `🙋 <b>${name}</b> is responding to your request “${title}”`,
  returnsBy: (date: string) => `Will return by ${date}`,
  accept: "✅ Accept",
  decline: "❌ Decline",
  cbAccepted: "✅ Accepted",
  cbDeclined: "Declined",
  writeTo: (name: string) => `Message ${name}`,
  accepted: (who: string, title: string) => `✅ ${who}: your request for “${title}” is accepted. Agree on how and when to meet.`,
  declined: (who: string, title: string) => `${who}: “${title}” isn't possible right now.`,
  handed: (title: string, due: string | null) =>
    `📦 “${title}” is now with you.` + (due ? ` Return by ${due}.` : "") + "\nPlease take good care of it and return it clean and in working order.",
  doneLend: (title: string) => `🙌 “${title}” is back with its owner. Thank you!`,
  doneOther: (who: string, title: string) => `🙌 ${who}: “${title}” is all done. Thank you!`,
  cancelled: (who: string, title: string) => `${who}: the request for “${title}” was cancelled.`,

  // Напоминания
  dueSoon: (title: string) => `⏰ “${title}” is due back tomorrow.`,
  overdueRequester: (title: string) => `⏰ “${title}” was due back yesterday. Please get in touch with the owner.`,
  overdueOwner: (name: string, title: string, date: string) => `⏰ ${name} was due to return “${title}” yesterday (${date}).`,

  // Чаты
  intro:
    "👋 This chat now has a shared catalog: items, books and favours that members are happy to share.\n\n" +
    "Open the catalog, see what's there, and add something of your own.",
  inviteOnly: "Circles can only be created by invitation. Ask the bot's owner for an invite link and add me to the chat again.",
  topicDenied: "Only a chat admin or the person who added the bot can choose the topic for new listings.",
  topicSet: "I'll post new catalog listings in this topic.",
  topicUnset: "I'll post new catalog listings in the main chat.",
  chooseCircleLang: "Which language should I use in this chat?",
  circleLangSet: "Done. I'll write in English in this chat.",
  langDenied: "Only a chat admin or the person who added the bot can change the chat language.",

  // Личные сообщения
  helpHead: "Share items, books and favours with your circles.\n",
  helpCreate: "• To start a circle, add me to a group chat.",
  helpInvited: "• A circle is a group chat with me in it. New circles are created by invitation.",
  helpPhoto: "• To add an item quickly, send me its photo with a caption.",
  helpRest: "• Everything else is in the catalog.",
  helpLang: "• /lang — change language.",
  helpRules: (url: string) => `\nBy using the bot you agree to the <a href="${url}">rules and privacy notice</a>.`,
  helpAdmin: "\nYou are the admin: /invite — invite someone to create circles, /circles — list of circles, /setup — refresh the command menu.",
  addToChat: "Add to a chat",
  badLink: "This link isn't valid.",
  adminWelcome: "You are now the bot's admin.\n\n/invite — an invite link: whoever gets it can create their own circles\n/circles — list of all circles",
  inviteText: (link: string) => `One-time invitation. Forward this link to one person — they'll be able to create their own circles:\n\n<code>${link}</code>`,
  forward: "Forward",
  alreadyCan: "You can already create circles: just add me to a group chat.",
  inviteUsed: "This invitation has already been used or doesn't exist.",
  inviteAccepted:
    "Invitation accepted. You can now create circles: add me to a group chat of friends, colleagues or a club — and the chat gets a shared catalog.",
  circlesEmpty: "No circles yet.",
  circleDisabled: " (disabled)",
  circleStats: (members: number, entries: number) => `   members in catalog: ${members}, listings: ${entries}`,
  circleCreatedBy: (name: string) => `, created by: ${name}`,
  commandsUpdated: "Command menu updated.",
  photoFail: "I couldn't fetch the photo. Please try again or add the item through the catalog.",
  draftReady: (title: string) => `Draft “${title}” is ready. Just pick the circles and publish.`,
  reviewPublish: "Review and publish",
  chooseLang: "Choose your language:",
  langSet: "Done. I'll write to you in English.",

  cmd: { start: "Open the catalog", lang: "Change language", catalog: "Show the catalog button", here: "Post new listings in this topic" },

  err: {
    unauthorized: "Couldn't verify your Telegram sign-in",
    generic: "Something went wrong. Please try again.",
    photoType: "Only JPEG, PNG and WebP are supported",
    photoSize: "The photo is too large",
    badData: "Invalid data",
    pickKind: "Choose a type",
    pickDirection: "Choose: offering or looking for",
    titleLen: "Title: 1 to 100 characters",
    descLen: "The description is too long",
    badStatus: "Invalid status",
    ownCirclesOnly: "You can only choose your own circles",
    needCircle: "Choose at least one circle",
    badPhotos: "Invalid photos",
    itemUnavailable: "Listing not found or not available to you",
    itemNotFound: "Listing not found",
    finishFirst: "Finish the accepted request first",
    ownItem: "This is your own listing",
    unavailable: "Not available right now",
    duplicate: "You've already sent a request",
    unknownAction: "Unknown action",
    reqNotFound: "Request not found",
    notYours: "This isn't your request",
    notNow: "This action isn't available right now",
    promised: "This item is already promised to someone else",
    termsRequired: "Please accept the rules first",
  },
};

const ru: typeof en = {
  kind: { thing: "Вещь", book: "Книга", help: "Услуга" },
  direction: { offer: "предлагаю", want: "ищу" },
  view: "Посмотреть",
  open: "Открыть",
  openCatalog: "Открыть каталог",
  circleDefault: "Круг",
  untitled: "Без названия",

  newRequestOffer: (name, title) => `🙋 <b>${name}</b> просит «${title}»`,
  newRequestWant: (name, title) => `🙋 <b>${name}</b> откликается на ваш запрос «${title}»`,
  returnsBy: (date) => `Вернёт до ${date}`,
  accept: "✅ Принять",
  decline: "❌ Отклонить",
  cbAccepted: "✅ Принято",
  cbDeclined: "Отклонено",
  writeTo: (name) => `Написать: ${name}`,
  accepted: (who, title) => `✅ ${who}: запрос на «${title}» принят. Договоритесь, как и когда встретиться.`,
  declined: (who, title) => `${who}: сейчас не получится с «${title}».`,
  handed: (title, due) =>
    `📦 «${title}» теперь у вас.` + (due ? ` Вернуть до ${due}.` : "") + "\nОбращайтесь бережно и верните в чистом и исправном состоянии.",
  doneLend: (title) => `🙌 «${title}» снова у владельца. Спасибо!`,
  doneOther: (who, title) => `🙌 ${who}: по «${title}» всё сделано. Спасибо!`,
  cancelled: (who, title) => `${who}: запрос на «${title}» отменён.`,

  dueSoon: (title) => `⏰ Завтра срок возврата: «${title}».`,
  overdueRequester: (title) => `⏰ Срок возврата «${title}» прошёл вчера. Свяжитесь с владельцем.`,
  overdueOwner: (name, title, date) => `⏰ ${name} должен был вернуть «${title}» вчера (${date}).`,

  intro:
    "👋 Теперь у этого чата есть общий каталог: вещи, книги и услуги, которыми участники готовы делиться.\n\n" +
    "Откройте каталог, посмотрите, что уже есть, и добавьте своё.",
  inviteOnly: "Создавать круги можно только по приглашению. Попросите ссылку-приглашение у владельца бота и добавьте меня в чат снова.",
  topicDenied: "Выбрать тему для новинок может администратор чата или тот, кто добавил бота.",
  topicSet: "Новинки каталога буду присылать в эту тему.",
  topicUnset: "Новинки каталога буду присылать в общий чат.",
  chooseCircleLang: "На каком языке писать в этом чате?",
  circleLangSet: "Готово. В этом чате пишу по-русски.",
  langDenied: "Сменить язык чата может администратор чата или тот, кто добавил бота.",

  helpHead: "Здесь можно делиться вещами, книгами и услугами со своими кругами.\n",
  helpCreate: "• Чтобы завести круг, добавьте меня в групповой чат.",
  helpInvited: "• Круг — это групповой чат со мной. Новые круги создаются по приглашению.",
  helpPhoto: "• Чтобы быстро добавить вещь, пришлите её фото с подписью.",
  helpRest: "• Всё остальное — в каталоге.",
  helpLang: "• /lang — сменить язык.",
  helpRules: (url) => `\nПользуясь ботом, вы соглашаетесь с <a href="${url}">правилами и условиями обработки данных</a>.`,
  helpAdmin: "\nВы администратор: /invite — пригласить человека создавать круги, /circles — список кругов, /setup — обновить меню команд.",
  addToChat: "Добавить в чат",
  badLink: "Эта ссылка не подходит.",
  adminWelcome:
    "Вы администратор бота.\n\n/invite — ссылка-приглашение: её получатель сможет создавать свои круги\n/circles — список всех кругов",
  inviteText: (link) =>
    `Одноразовое приглашение. Перешлите эту ссылку одному человеку — он сможет создавать свои круги:\n\n<code>${link}</code>`,
  forward: "Переслать",
  alreadyCan: "Вы уже можете создавать круги: просто добавьте меня в групповой чат.",
  inviteUsed: "Это приглашение уже использовано или не существует.",
  inviteAccepted:
    "Приглашение принято. Теперь вы можете создавать круги: добавьте меня в групповой чат друзей, коллег или клуба — и у чата появится общий каталог.",
  circlesEmpty: "Кругов пока нет.",
  circleDisabled: " (отключён)",
  circleStats: (members, entries) => `   участников в каталоге: ${members}, записей: ${entries}`,
  circleCreatedBy: (name) => `, создал(а): ${name}`,
  commandsUpdated: "Меню команд обновлено.",
  photoFail: "Не получилось забрать фото. Попробуйте ещё раз или добавьте вещь через каталог.",
  draftReady: (title) => `Черновик «${title}» готов. Осталось выбрать круги и опубликовать.`,
  reviewPublish: "Проверить и опубликовать",
  chooseLang: "Выберите язык:",
  langSet: "Готово. Буду писать вам по-русски.",

  cmd: { start: "Открыть каталог", lang: "Сменить язык", catalog: "Показать кнопку каталога", here: "Присылать новинки в эту тему" },

  err: {
    unauthorized: "Не удалось подтвердить вход через Telegram",
    generic: "Что-то пошло не так. Попробуйте ещё раз.",
    photoType: "Подходят только JPEG, PNG и WebP",
    photoSize: "Фото слишком большое",
    badData: "Некорректные данные",
    pickKind: "Выберите тип",
    pickDirection: "Выберите: предлагаю или ищу",
    titleLen: "Название: от 1 до 100 символов",
    descLen: "Описание слишком длинное",
    badStatus: "Некорректный статус",
    ownCirclesOnly: "Можно выбрать только свои круги",
    needCircle: "Выберите хотя бы один круг",
    badPhotos: "Некорректные фото",
    itemUnavailable: "Запись не найдена или недоступна вам",
    itemNotFound: "Запись не найдена",
    finishFirst: "Сначала завершите принятый запрос",
    ownItem: "Это ваша запись",
    unavailable: "Сейчас недоступно",
    duplicate: "Вы уже отправили запрос",
    unknownAction: "Неизвестное действие",
    reqNotFound: "Запрос не найден",
    notYours: "Это не ваш запрос",
    notNow: "Это действие сейчас недоступно",
    promised: "Вещь уже обещана другому человеку",
    termsRequired: "Сначала согласитесь с правилами",
  },
};

export type ErrKey = keyof typeof en.err;
export const tr = (lang: Lang) => (lang === "ru" ? ru : en);

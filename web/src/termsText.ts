import type { Lang } from "./i18n";

// Правила, отказ от ответственности и уведомление о данных.
// При существенном изменении текста увеличьте TERMS_VERSION в worker/src/types.ts —
// тогда всех попросят согласиться заново.

export interface TermsText {
  title: string;
  intro: string;
  rulesTitle: string;
  rules: string[];
  responsibilityTitle: string;
  responsibility: string[];
  privacyTitle: string;
  privacy: { term: string; text: string }[];
  contact: { before: string; after: string; none: string };
  agree: string;
  continue: string;
  updated: string;
  link: string;
}

const en: TermsText = {
  title: "Rules, responsibility and privacy",
  intro: "Share Circle helps people in a group chat lend things and help each other. Please read this before you start — it takes a minute.",
  rulesTitle: "How we share",
  rules: [
    "Treat other people's things as carefully as your own — or more so.",
    "Return things on time, clean and in working order. If you can't make it, let the owner know in advance.",
    "If something breaks or gets lost, tell the owner honestly and agree together: repair, replace or compensate.",
    "Owners: describe the condition honestly and don't lend what you couldn't bear to lose.",
    "Help is offered on mutual agreement, with no obligations on either side.",
    "Be kind. Only list things that are yours to share and that are legal.",
  ],
  responsibilityTitle: "Responsibility",
  responsibility: [
    "The service only connects people. Its administrator does not own, inspect or insure the listed items and is not a party to the arrangements between members.",
    "Responsibility for the items, their condition and their return, and for any help given, lies entirely with the members involved. The administrator is not liable for damage, loss or disputes, and does not mediate them.",
    "The service is free and provided as is, without guarantees that it will always be available or free of errors.",
  ],
  privacyTitle: "Your data",
  privacy: [
    { term: "What is stored", text: "Your Telegram ID, name, username and language; the listings, photos and requests you create; which circles you belong to; and when you accepted these rules." },
    { term: "Why", text: "Only to run the service: show the catalog to members of your circles and send you notifications. No advertising, no selling, no profiling." },
    { term: "Who sees it", text: "Members of your circles see your name, username and listings. The administrator has technical access to all data. The service runs on Cloudflare (hosting, database and photo storage) and Telegram (messages)." },
    { term: "How long", text: "While you use the service. Deleting a listing deletes its photos. Leaving a chat removes your access to that circle's catalog." },
    { term: "Your rights", text: "You can ask to see, correct or delete your data, or object to its use. Write to the administrator and it will be done." },
  ],
  contact: { before: "Administrator:", after: "on Telegram.", none: "Contact the administrator via the bot." },
  agree: "I have read the rules and agree to them",
  continue: "Continue",
  updated: "Last updated: November 2026",
  link: "Rules and privacy",
};

const ru: TermsText = {
  title: "Правила, ответственность и данные",
  intro: "Share Circle помогает участникам группового чата одалживать вещи и помогать друг другу. Прочитайте, пожалуйста, перед началом — это займёт минуту.",
  rulesTitle: "Как мы делимся",
  rules: [
    "Обращайтесь с чужими вещами так же бережно, как со своими, а лучше — ещё бережнее.",
    "Возвращайте вовремя, в чистом и исправном состоянии. Если не успеваете — предупредите владельца заранее.",
    "Если что-то сломалось или потерялось, честно скажите владельцу и договоритесь: починить, заменить или компенсировать.",
    "Владельцам: честно описывайте состояние и не давайте то, что жалко потерять.",
    "Помощь — по взаимной договорённости, без обязательств с обеих сторон.",
    "Будьте доброжелательны. Выкладывайте только своё и только законное.",
  ],
  responsibilityTitle: "Ответственность",
  responsibility: [
    "Сервис только соединяет людей. Администратор не владеет вещами из каталога, не проверяет и не страхует их и не участвует в договорённостях между участниками.",
    "Ответственность за вещи, их состояние и возврат, а также за оказанную помощь полностью лежит на самих участниках. Администратор не отвечает за порчу, утерю и споры и не разбирает их.",
    "Сервис бесплатный и предоставляется как есть, без гарантий бесперебойной и безошибочной работы.",
  ],
  privacyTitle: "Ваши данные",
  privacy: [
    { term: "Что хранится", text: "Ваш Telegram ID, имя, username и язык; записи, фото и запросы, которые вы создаёте; в каких кругах вы состоите; когда вы согласились с этими правилами." },
    { term: "Зачем", text: "Только для работы сервиса: показывать каталог участникам ваших кругов и присылать уведомления. Без рекламы, продажи данных и профилирования." },
    { term: "Кто видит", text: "Участники ваших кругов видят ваше имя, username и записи. У администратора есть технический доступ ко всем данным. Сервис работает на Cloudflare (хостинг, база данных и хранилище фото) и Telegram (сообщения)." },
    { term: "Как долго", text: "Пока вы пользуетесь сервисом. При удалении записи удаляются и её фото. Выйдя из чата, вы теряете доступ к каталогу этого круга." },
    { term: "Ваши права", text: "Вы можете попросить показать, исправить или удалить ваши данные либо возразить против их использования. Напишите администратору — это будет сделано." },
  ],
  contact: { before: "Администратор:", after: "в Telegram.", none: "Связаться с администратором можно через бота." },
  agree: "Я прочитал(а) правила и согласен(на) с ними",
  continue: "Продолжить",
  updated: "Обновлено: ноябрь 2026",
  link: "Правила и данные",
};

export const termsText = (lang: Lang): TermsText => (lang === "ru" ? ru : en);

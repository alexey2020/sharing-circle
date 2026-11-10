import { useLang, type Lang } from "./i18n";
import { TermsContent } from "./Terms";
import { LangSwitch } from "./ui";

interface Section {
  title: string;
  text: string[];
}

interface HelpText {
  title: string;
  guideTitle: string;
  sections: Section[];
}

const en: HelpText = {
  title: "Help",
  guideTitle: "How to use Share Circle",
  sections: [
    {
      title: "🗂 Catalog",
      text: [
        "The catalog shows what members of your circles offer and what they are looking for: items, books and favours.",
        "Use the filters at the top to narrow it down by category, by “Offered / Wanted” or by circle, and the search box to find something by name.",
      ],
    },
    {
      title: "➕ Adding an entry",
      text: [
        "Tap “+”, choose “Offering” or “Looking for”, pick a category, write a title, add a photo and choose the circles that will see it. Tick “Announce in the circle's chat” if you want the chat to hear about it.",
        "Quick way: send the bot a photo with a caption in a private chat. It becomes a draft — open it in “Mine”, check it and publish.",
      ],
    },
    {
      title: "🙋 Borrowing and helping",
      text: [
        "Open an entry and tap “Ask to borrow” (or “Get in touch”, “I can help”). Add a message and, for items, the date you will return it by.",
        "The owner gets a notification and accepts or declines. Once accepted, arrange the details in Telegram private messages.",
      ],
    },
    {
      title: "🔁 Handover and return",
      text: [
        "When the item changes hands, the owner taps “Handed over”; when it comes back — “Returned”. The bot reminds the borrower a day before the return date and if it is overdue.",
        "Favours and “Looking for” entries have no handover step: either side taps “Done” when it's over.",
        "Everything you ask for and everything asked of you is in the “Requests” tab.",
      ],
    },
    {
      title: "📦 Your entries",
      text: ["The “Mine” tab lists your entries. Open one to edit, hide it from the catalog or delete it. You can also switch the language there."],
    },
    {
      title: "👥 Circles",
      text: [
        "A circle is a Telegram group chat with the bot in it; everyone in the chat is in the circle. New circles are created by invitation.",
        "Commands in the chat: /catalog — open the catalog, /here — post announcements to the current topic, /lang — change the chat language.",
        "Notifications come from the bot in a private chat. If they don't arrive, open the bot and tap “Start”.",
      ],
    },
  ],
};

const ru: HelpText = {
  title: "Помощь",
  guideTitle: "Как пользоваться",
  sections: [
    {
      title: "🗂 Каталог",
      text: [
        "В каталоге — то, что предлагают и ищут участники ваших кругов: вещи, книги и «руки».",
        "Фильтры сверху помогают выбрать категорию, «Предлагают / Ищут» или круг, а поиск — найти запись по названию.",
      ],
    },
    {
      title: "➕ Как добавить запись",
      text: [
        "Нажмите «+», выберите «Предлагаю» или «Ищу», категорию, напишите название, добавьте фото и отметьте круги, которым будет видно. Поставьте галочку «Сообщить в чат круга», если хотите, чтобы чат узнал о новинке.",
        "Быстрый способ: пришлите боту в личку фото с подписью. Получится черновик — откройте его во «Моё», проверьте и опубликуйте.",
      ],
    },
    {
      title: "🙋 Как попросить или помочь",
      text: [
        "Откройте запись и нажмите «Попросить» (или «Обратиться», «Могу помочь»). Напишите сообщение, а для вещи — до какого числа вернёте.",
        "Владелец получит уведомление и примет или отклонит запрос. После принятия договоритесь о встрече в личных сообщениях Telegram.",
      ],
    },
    {
      title: "🔁 Передача и возврат",
      text: [
        "Когда вещь передали, владелец нажимает «Вещь передана», а когда вернули — «Вещь вернули». Бот напомнит о возврате за день до срока и если срок прошёл.",
        "У «рук» и записей «Ищу» передачи нет: когда всё сделано, любая из сторон нажимает «Готово».",
        "Все запросы — ваши и к вам — во вкладке «Запросы».",
      ],
    },
    {
      title: "📦 Свои записи",
      text: ["Во вкладке «Моё» — всё, что вы добавили. Откройте запись, чтобы изменить её, скрыть из каталога или удалить. Там же можно сменить язык."],
    },
    {
      title: "👥 Круги",
      text: [
        "Круг — это групповой чат в Telegram с ботом; все участники чата состоят в круге. Новые круги создаются по приглашению.",
        "Команды в чате: /catalog — открыть каталог, /here — публиковать новинки в текущую тему, /lang — язык чата.",
        "Уведомления бот присылает в личку. Если они не приходят, откройте бота и нажмите «Start».",
      ],
    },
  ],
};

const texts: Record<Lang, HelpText> = { en, ru };

/** Вкладка «Помощь»: как пользоваться, правила, ответственность и данные. */
export function Help() {
  const h = texts[useLang()];
  return (
    <>
      <div className="row">
        <h1>{h.title}</h1>
        <LangSwitch />
      </div>
      <div className="help">
        <h2>{h.guideTitle}</h2>
        {h.sections.map((s) => (
          <section key={s.title}>
            <h3>{s.title}</h3>
            {s.text.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </section>
        ))}
      </div>
      <TermsContent />
    </>
  );
}

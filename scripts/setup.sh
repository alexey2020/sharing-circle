#!/bin/bash
# Подключает бота к уже развёрнутому сервису: сохраняет секреты в Cloudflare,
# ставит вебхук, команды и кнопку меню.
#
#   ./scripts/setup.sh https://sharing-circle.<ваш-поддомен>.workers.dev
#
# Токен вводится скрыто и никуда, кроме Telegram и Cloudflare, не уходит.
set -euo pipefail

APP_URL="${1:?Укажите адрес сервиса: ./scripts/setup.sh https://...workers.dev}"
APP_URL="${APP_URL%/}"
cd "$(dirname "$0")/.."

read -rsp "Токен бота от @BotFather: " BOT_TOKEN
echo
API="https://api.telegram.org/bot${BOT_TOKEN}"

BOT_USERNAME=$(curl -fsS "$API/getMe" | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"]["username"])')
echo "Бот: @${BOT_USERNAME}"

WEBHOOK_SECRET=$(openssl rand -hex 24)
ADMIN_KEY=$(openssl rand -hex 16)

put() { printf '%s' "$2" | npx wrangler secret put "$1" >/dev/null && echo "  секрет $1 сохранён"; }
put BOT_TOKEN "$BOT_TOKEN"
put WEBHOOK_SECRET "$WEBHOOK_SECRET"
put ADMIN_KEY "$ADMIN_KEY"
put BOT_USERNAME "$BOT_USERNAME"
put APP_URL "$APP_URL"

curl -fsS "$API/setWebhook" \
  --data-urlencode "url=${APP_URL}/bot/webhook" \
  --data-urlencode "secret_token=${WEBHOOK_SECRET}" \
  --data-urlencode 'allowed_updates=["message","my_chat_member","callback_query"]' >/dev/null
echo "  вебхук установлен"

curl -fsS "$API/setChatMenuButton" \
  --data-urlencode "menu_button={\"type\":\"web_app\",\"text\":\"Каталог\",\"web_app\":{\"url\":\"${APP_URL}\"}}" >/dev/null
echo "  кнопка меню настроена"

cat <<EOF

Осталось два шага вручную.

1. В @BotFather:
     /mybots → @${BOT_USERNAME} → Bot Settings → Configure Mini App → Enable Mini App
   и укажите адрес: ${APP_URL}
   Без этого не откроются ссылки на каталог из групповых чатов.

2. Откройте эту ссылку в Telegram и нажмите «Запустить» — вы станете администратором бота:
     https://t.me/${BOT_USERNAME}?start=admin_${ADMIN_KEY}
   Ссылку никому не передавайте. Повторный запуск скрипта выдаст новую, старая перестанет работать.
EOF

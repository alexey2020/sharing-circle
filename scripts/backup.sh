#!/usr/bin/env bash
# Резервная копия данных сервиса: база D1 и фотографии из R2.
#
#   scripts/backup.sh [папка]
#
# По умолчанию копии кладутся в ~/Documents/sharing-circle-backups:
#   db/2026-11-12_10-30.sql   — полная выгрузка базы на момент запуска (каждый раз новый файл)
#   photos/<ключ>.jpg         — фотографии; уже скачанные повторно не качаются
#
# Нужен вход в Cloudflare (npx wrangler login). Скрипт только читает данные, ничего не меняет.
#
# Восстановление базы (в пустую D1):
#   npx wrangler d1 execute DB --remote --file <файл.sql>
# Восстановление фото:
#   for f in photos/*; do npx wrangler r2 object put "sharing-circle-photos/$(basename "$f")" --remote --file "$f"; done
set -euo pipefail

cd "$(dirname "$0")/.."
DB_NAME="sharing-circle"
BUCKET="sharing-circle-photos"
DEST="${1:-$HOME/Documents/sharing-circle-backups}"
STAMP="$(date +%Y-%m-%d_%H-%M)"

mkdir -p "$DEST/db" "$DEST/photos"
export CI=1 # без интерактивных вопросов wrangler

# API Cloudflare иногда отвечает разовой ошибкой (например, при обновлении токена) — пробуем ещё раз.
retry() {
  local i
  for i in 1 2 3; do
    "$@" && return 0
    [ "$i" -lt 3 ] && sleep 3
  done
  return 1
}

echo "→ База данных…"
retry npx wrangler d1 export "$DB_NAME" --remote --output "$DEST/db/$STAMP.sql" >/dev/null 2>&1 ||
  { echo "  не удалось выгрузить базу — проверьте вход: npx wrangler login"; exit 1; }
echo "  $DEST/db/$STAMP.sql ($(du -h "$DEST/db/$STAMP.sql" | cut -f1))"

echo "→ Список фотографий…"
KEYS="$(retry npx wrangler d1 execute "$DB_NAME" --remote --json --command "SELECT key FROM item_photos ORDER BY id" 2>/dev/null |
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const r of JSON.parse(s)[0].results)console.log(r.key)})')"

total=0
new=0
failed=0
while IFS= read -r key; do
  [ -z "$key" ] && continue
  total=$((total + 1))
  # Ключи генерирует сервер (uuid.расширение), но на всякий случай не пускаем пути
  case "$key" in */* | .*) echo "  пропущен подозрительный ключ: $key"; continue ;; esac
  file="$DEST/photos/$key"
  [ -s "$file" ] && continue
  if retry npx wrangler r2 object get "$BUCKET/$key" --remote --file "$file" >/dev/null 2>&1; then
    new=$((new + 1))
  else
    rm -f "$file"
    failed=$((failed + 1))
    echo "  не удалось скачать: $key"
  fi
done <<<"$KEYS"

echo "  фото в базе: $total, скачано новых: $new, ошибок: $failed"
echo "✓ Готово: $DEST"
[ "$failed" -eq 0 ]

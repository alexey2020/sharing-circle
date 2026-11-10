-- Язык интерфейса человека и язык сообщений бота в чате круга ('en' | 'ru').
ALTER TABLE users ADD COLUMN lang TEXT;
ALTER TABLE circles ADD COLUMN lang TEXT;

-- Всё, что появилось до двуязычности, работало по-русски — сохраняем это для уже существующих людей и кругов.
UPDATE users SET lang = 'ru' WHERE lang IS NULL;
UPDATE circles SET lang = 'ru' WHERE lang IS NULL;

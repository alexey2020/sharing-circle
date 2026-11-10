-- Тема (подгруппа) чата, куда бот присылает новинки каталога. NULL — в общий чат.
ALTER TABLE circles ADD COLUMN thread_id INTEGER;

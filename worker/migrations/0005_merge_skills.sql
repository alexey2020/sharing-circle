-- «Навыки» объединены с «Помощью»: научить чему-то — тоже помощь.
UPDATE items SET kind = 'help' WHERE kind = 'skill';

# PRIDE Seating — Next.js + Supabase

Полноценный веб-сервис рассадки за покерные столы.

## Возможности

- Вход администратора через Supabase Auth.
- 6 столов по 10 мест.
- Игрок приходит, админ вводит имя и нажимает «Выдать место».
- Случайное свободное место закрепляется в общей базе.
- Занятое место повторно не выпадает.
- Все устройства видят одну общую рассадку.
- Удаление игрока.
- Сброс турнира.
- Копирование списка для Telegram.
- Печать рассадки.

## 1. Supabase

Открой Supabase → SQL Editor → New snippet.

Вставь содержимое файла:

```text
supabase.sql
```

Нажми Run.

## 2. Создай администратора

Supabase → Authentication → Users → Add user.

Укажи email и пароль администратора.

## 3. Переменные окружения

Создай файл `.env.local` на основе `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Значения брать в Supabase → Settings → API.

## 4. Локальный запуск

```bash
npm install
npm run dev
```

Открыть:

```text
http://localhost:3000
```

## 5. Публикация на Vercel

1. Создай репозиторий на GitHub и загрузи файлы проекта.
2. Открой vercel.com.
3. Import Project → выбери репозиторий.
4. Добавь Environment Variables:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
5. Deploy.

После публикации сервис будет доступен с iPhone как обычный сайт.

## Важно

Текущие политики доступа разрешают работать с таблицей всем авторизованным пользователям Supabase.
Не создавай аккаунты игрокам. Создавай только администраторам.

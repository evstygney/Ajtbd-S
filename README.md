# AJTBD Builder

Статическое веб-приложение для проведения AJTBD-интервью по шаблонам.

Приложение работает полностью на клиенте:
- без бэкенда
- без сборки
- с хранением данных в `localStorage`
- с экспортом результатов в `JSON` и `CSV`
- с импортом и экспортом самих шаблонов в `JSON`

## Что умеет

- подставлять значения из графа в вопросы через поля вида `{...}`
- хранить ответы по категориям из полей вида `[...]`
- создавать новые шаблоны и сессии
- редактировать структуру шаблона прямо в браузере
- добавлять секции, заметки, поля и повторяемые блоки
- менять порядок секций и полей через drag-and-drop
- очищать все сессии

## Файлы

- [index.html](./index.html) — структура интерфейса
- [styles.css](./styles.css) — стили
- [app.js](./app.js) — логика приложения

## Локальный запуск

Откройте `index.html` напрямую в браузере.

Если нужен локальный сервер, можно использовать любой статический сервер. Например:

```powershell
cd "C:\Users\evstygney\Documents\AJTBD S"
python -m http.server 8080
```

После этого откройте:

`http://localhost:8080`

## Публикация на GitHub Pages

Целевой репозиторий:

[https://github.com/evstygney/Ajtbd-S/](https://github.com/evstygney/Ajtbd-S/)

### 1. Клонировать репозиторий

```powershell
git clone https://github.com/evstygney/Ajtbd-S.git
cd .\Ajtbd-S
```

### 2. Скопировать файлы приложения в корень репозитория

Нужны файлы:

- `index.html`
- `styles.css`
- `app.js`
- `README.md`

### 3. Проверить результат локально

Можно просто открыть `index.html` или поднять статический сервер:

```powershell
python -m http.server 8080
```

### 4. Закоммитить и отправить

```powershell
git add .
git commit -m "Add AJTBD interview builder"
git push origin main
```

### 5. Включить GitHub Pages

В репозитории GitHub:

1. Откройте `Settings`
2. Перейдите в `Pages`
3. В `Build and deployment` выберите:
   `Source` → `Deploy from a branch`
4. Выберите:
   `Branch` → `main`
   `Folder` → `/ (root)`
5. Нажмите `Save`

Через некоторое время сайт станет доступен по адресу вида:

`https://evstygney.github.io/Ajtbd-S/`

## Обновление приложения

После изменений:

```powershell
git add .
git commit -m "Update AJTBD builder"
git push origin main
```

GitHub Pages автоматически обновит опубликованную версию.

## Ограничения

- данные хранятся только в браузере пользователя
- очистка `localStorage` или смена браузера удалит локальные сессии
- если шаблон сильно меняется, старые сессии автоматически синхронизируются с новой структурой, но удалённые поля не восстанавливаются

const STORAGE_KEYS = {
  templates: "ajtbd.templates.v1",
  sessions: "ajtbd.sessions.v1",
  state: "ajtbd.ui-state.v1",
};

const DEFAULT_TEMPLATE_ID = "template-ajtbd-b2c-v33";

const elements = {
  templateList: document.getElementById("template-list"),
  sessionList: document.getElementById("session-list"),
  workspaceTitle: document.getElementById("workspace-title"),
  workspaceSubtitle: document.getElementById("workspace-subtitle"),
  sessionNameInput: document.getElementById("session-name-input"),
  respondentInput: document.getElementById("session-respondent-input"),
  graphFields: document.getElementById("graph-fields"),
  templateEditor: document.getElementById("template-editor"),
  templateSections: document.getElementById("template-sections"),
  exportJsonBtn: document.getElementById("export-json-btn"),
  exportCsvBtn: document.getElementById("export-csv-btn"),
  exportTemplateBtn: document.getElementById("export-template-btn"),
  importTemplateBtn: document.getElementById("import-template-btn"),
  templateImportInput: document.getElementById("template-import-input"),
  renameTemplateBtn: document.getElementById("rename-template-btn"),
  newTemplateBtn: document.getElementById("new-template-btn"),
  newSessionBtn: document.getElementById("new-session-btn"),
  clearSessionsBtn: document.getElementById("clear-sessions-btn"),
  duplicateTemplateBtn: document.getElementById("duplicate-template-btn"),
  addGraphVarBtn: document.getElementById("add-graph-var-btn"),
  addSectionBtn: document.getElementById("add-section-btn"),
};

const state = {
  templates: [],
  sessions: [],
  activeTemplateId: null,
  activeSessionId: null,
  drag: null,
};

const TOKEN_ALIASES = {
  [normalizeKey("ожидаемого результата")]: normalizeKey("ожидаемый результат"),
  [normalizeKey("ожидаемому результату")]: normalizeKey("ожидаемый результат"),
  [normalizeKey("решения")]: normalizeKey("решение"),
  [normalizeKey("решению")]: normalizeKey("решение"),
  [normalizeKey("решением")]: normalizeKey("решение"),
  [normalizeKey("изучаемому решению")]: normalizeKey("изучаемое решение"),
  [normalizeKey("изучаемым решением")]: normalizeKey("изучаемое решение"),
  [normalizeKey("результата работ выше уровнем")]: normalizeKey("ожидаемый результат работы выше уровнем"),
};

function uid(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeKey(label) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/(^-|-$)/g, "");
}

function createField(category, prompt, options = {}) {
  return {
    type: "field",
    id: uid("field"),
    category,
    prompt,
    hint: options.hint || "",
    rows: options.rows || 5,
  };
}

function createNote(text) {
  return {
    type: "note",
    id: uid("note"),
    text,
  };
}

function createRepeatable(key, title, description, itemTitle, prototype, addLabel) {
  return {
    type: "repeatable",
    id: uid("repeatable"),
    key,
    title,
    description,
    itemTitle,
    addLabel,
    prototype,
  };
}

function createSection(title, description, items) {
  return {
    id: uid("section"),
    title,
    description,
    items,
  };
}

function sanitizeField(field) {
  return {
    type: "field",
    id: field?.id || uid("field"),
    category: field?.category || "новая категория",
    prompt: field?.prompt || "",
    hint: field?.hint || "",
    rows: field?.rows || 5,
  };
}

function sanitizeNote(note) {
  return {
    type: "note",
    id: note?.id || uid("note"),
    text: note?.text || "",
  };
}

function sanitizeRepeatable(repeatable) {
  const nextKey = repeatable?.key ? normalizeKey(repeatable.key) : normalizeKey(uid("repeatable"));
  return {
    type: "repeatable",
    id: repeatable?.id || uid("repeatable"),
    key: nextKey,
    title: repeatable?.title || "Новый повторяемый блок",
    description: repeatable?.description || "",
    itemTitle: repeatable?.itemTitle || "Элемент",
    addLabel: repeatable?.addLabel || "Добавить элемент",
    prototype: Array.isArray(repeatable?.prototype) && repeatable.prototype.length
      ? repeatable.prototype.map((field) => sanitizeField(field))
      : [createEmptyField()],
  };
}

function sanitizeSection(section) {
  return {
    id: section?.id || uid("section"),
    title: section?.title || "Новая секция",
    description: section?.description || "",
    items: Array.isArray(section?.items)
      ? section.items.map((item) => sanitizeTemplateItem(item))
      : [createEmptyField()],
  };
}

function sanitizeTemplateItem(item) {
  if (item?.type === "note") {
    return sanitizeNote(item);
  }
  if (item?.type === "repeatable") {
    return sanitizeRepeatable(item);
  }
  return sanitizeField(item);
}

function sanitizeTemplate(template) {
  return {
    id: template?.id || uid("template"),
    name: template?.name || "Импортированный шаблон",
    description: template?.description || "",
    graph: Array.isArray(template?.graph)
      ? template.graph.map((field, index) => ({
          key: field?.key ? normalizeKey(field.key) : normalizeKey(field?.label || `переменная-${index + 1}`),
          label: field?.label || `переменная ${index + 1}`,
          placeholder: field?.placeholder || "",
        }))
      : [],
    sections: Array.isArray(template?.sections)
      ? template.sections.map((section) => sanitizeSection(section))
      : [],
  };
}

function createEmptyField() {
  return createField("новая категория", "Новый вопрос");
}

function createEmptyNote() {
  return createNote("Новая заметка по структуре");
}

function createEmptyRepeatable() {
  return createRepeatable(
    normalizeKey(uid("repeatable")),
    "Новый повторяемый блок",
    "Описание блока",
    "Элемент",
    [createEmptyField()],
    "Добавить элемент"
  );
}

function buildDefaultTemplate() {
  const detailedWorkPrototype = [
    createField("ожидаемый результат", "Интервьюер, перенеси в поле ниже ожидаемый результат, который выбрал для изучения. При необходимости задай вопрос: какой результат вы обычно получаете от использования {решение}? Какие у вас задачи?"),
    createField("критерии ожидаемого результата", "Расскажите, пожалуйста, по каким критериям вы оцениваете, что вы достаточно хорошо получили {ожидаемый результат}? Как вы хотели получить {ожидаемый результат}?", {
      hint: "Полезно, если респондент дал слишком общий ответ на ожидаемый результат.",
    }),
    createField("активирующее знание", "Что такого вы узнали, после чего вы захотели получить {ожидаемый результат}? Может быть, это случилось после какого-то опыта?", {
      hint: "Опционально. Актуально для спящей работы.",
    }),
    createField("решение", "Расскажите, пожалуйста, кратко историю про то, как вы обычно покупаете и используете {изучаемое решение} для получения {ожидаемый результат}."),
    createField("контекст", "Расскажите, пожалуйста, подробнее, в какой ситуации вы обычно находитесь, когда решаете использовать {решение}, чтобы получить {ожидаемый результат}?"),
    createField("триггер", "В какой момент времени вы обычно начинаете использовать {решение}, чтобы получить {ожидаемый результат}? Что становится триггером?"),
    createField("ожидаемый результат работы выше уровнем", "Зачем вы хотите получить {ожидаемый результат}? Чтобы что?"),
    createField("прийти к позитивным эмоциям в «чтобы»", "Как вы хотите себя чувствовать после того, как получите {ожидаемый результат}? Какая это эмоция?"),
    createField("избежать негативные эмоции", "Пока вы не получаете {ожидаемый результат}, вы испытываете какие-то негативные эмоции?"),
    createField("частотность работы", "Сколько раз в месяц или год вы используете {решение}, чтобы получить {ожидаемый результат}?"),
    createField("важность работы", "Насколько вам было важно получить {ожидаемый результат}, где 10 — вопрос жизни и смерти, безопасность ваша и вашей семьи?"),
    createField("удовлетворенность решением", "Насколько по 10-балльной шкале вы были удовлетворены тем, как {решение} позволяет вам получить {ожидаемый результат}, где 10 — идеально подходит, а 1 — совсем не подходит?"),
    createField("ценность", "В чём ценность {решения} для {ожидаемого результата}?"),
    createField("aha-moment", "В какой момент вы поняли ценность {решения}?"),
    createField("стоимость + соответствие цены и ценности", "Сколько вы заплатили за {изучаемое решение}? Насколько по 10-балльной шкале цена {решения} соответствует ценности?"),
    createField("проблемы", "Были ли проблемы в процессе получения {ожидаемого результата} с помощью {решения}? Сталкивались ли вы с тем, что вы не можете получить желаемый результат?"),
    createField("барьеры к решению", "Было ли что-то, что останавливало вас от того, чтобы начать использовать {изучаемое решение}?"),
    createField("альтернативные решения", "Рассматривали ли вы другие продукты, чтобы получить {ожидаемый результат}? Если да, расскажите, пожалуйста, про них."),
  ];

  const shortWorkPrototype = [
    createField("решение", "Заносим сюда ответ на вопрос выше. При необходимости уточните детали: расскажите, пожалуйста, больше про {изучаемое решение}."),
    createField("ожидаемый результат", "Какой результат вы хотели получить от использования {решение}? Какие у вас были задачи?"),
    createField("контекст", "В каких ситуациях вы обычно находились, когда решали использовать {решение}, чтобы получить {ожидаемый результат}?"),
    createField("триггер", "В какой момент вы обычно начинали что-то делать, чтобы получить {ожидаемый результат}? Что было триггером?"),
    createField("ожидаемый результат работы выше уровнем", "Зачем вы хотели получить {ожидаемый результат}? Чтобы что?"),
    createField("удовлетворенность решением", "Насколько по 10-балльной шкале вы были удовлетворены тем, как {решение} позволяет вам получить {ожидаемый результат}, где 10 — идеально подходит, а 1 — совсем не подходит?"),
    createField("проблемы", "Были ли проблемы в процессе получения {ожидаемого результата} с помощью {решения}? Сталкивались ли вы с тем, что вы не можете получить желаемый результат?"),
  ];

  const lowerLevelFrequentPrototype = [
    createField("ожидаемый результат", "Какой результат вы хотели получить от использования {решение}? Какие у вас были задачи?"),
    createField("решение", "Расскажите, пожалуйста, кратко историю про то, с помощью чего вы получаете {ожидаемый результат}."),
    createField("контекст", "В какой ситуации вы обычно находитесь, когда решаете начать использовать {решение}, чтобы получить {ожидаемый результат}?"),
    createField("триггер", "В какой момент вы обычно начинаете что-то делать, чтобы получить {ожидаемый результат}? Что становится триггером?"),
    createField("удовлетворенность решением", "Насколько по 10-балльной шкале вы были удовлетворены тем, как {решение} позволяет вам получить {ожидаемый результат}, где 10 — идеально подходит, а 1 — совсем не подходит?"),
    createField("проблемы", "Были ли проблемы в процессе получения {ожидаемого результата} с помощью {решения}? Сталкивались ли вы с тем, что вы не можете получить желаемый результат?"),
  ];

  return {
    id: DEFAULT_TEMPLATE_ID,
    name: "AJTBD B2C v3.3",
    description: "Структура по гайду AJTBD-интервью для B2C-продуктов с графом переменных, повторяемыми блоками работ и экспортом.",
    graph: [
      { key: normalizeKey("гипотеза работы"), label: "гипотеза работы", placeholder: "Например: заказать продукты" },
      { key: normalizeKey("решения"), label: "решения", placeholder: "Например: приложения, звонок, сайт" },
      { key: normalizeKey("решение"), label: "решение", placeholder: "Текущее решение в вопросе" },
      { key: normalizeKey("изучаемое решение"), label: "изучаемое решение", placeholder: "Например: Самокат" },
      { key: normalizeKey("решение работы выше уровнем"), label: "решение работы выше уровнем", placeholder: "Решение для верхнеуровневой работы" },
      { key: normalizeKey("ожидаемый результат"), label: "ожидаемый результат", placeholder: "Главный ожидаемый результат" },
      { key: normalizeKey("ожидаемый результат работы выше уровнем"), label: "ожидаемый результат работы выше уровнем", placeholder: "Результат верхнего уровня" },
    ],
    sections: [
      createSection(
        "[3 минуты] Знакомство и правила",
        "Первый блок документа: эмоциональный контакт, границы интервью, тайминг, заметки, эмоции и при необходимости запись.",
        [
          createNote("Приветствуем и благодарим за участие. Кратко объясняем, о чём пойдёт разговор, напоминаем о тайминге, предупреждаем про заметки и возможные вопросы про эмоции."),
          createField("заметки интервьюера", "Коротко зафиксируйте, как прошёл старт интервью: какие договорённости и рамки были проговорены?", {
            hint: "Это служебное поле, чтобы структура документа не терялась в интерфейсе.",
          }),
        ]
      ),
      createSection(
        "[10 минут] Квалифицирующий блок",
        "Блок для психологических особенностей респондента и прошлого опыта, который поможет уточнять описания работ.",
        [
          createField("квалифицирующие наблюдения", "Какие особенности респондента и его прошлого опыта важно учитывать при дальнейшем прокапывании работ?"),
        ]
      ),
      createSection(
        "[5 минут] Навигация в работы",
        "Определяем основные решения и работы. Цель не в глубине, а в выборе 1-2 наиболее важных и проблемных работ для детального изучения.",
        [
          createField("все решения", "Расскажите, пожалуйста, про то, как вы выполняете {гипотеза работы}."),
          createField("все контексты", "В каких ситуациях вы обычно находитесь, когда используете {решения}?"),
          createField("все ожидаемые результаты", "Какие результаты вы обычно ждёте от использования {решения}?"),
          createField("приоритизация работ", "Если в ответе несколько ожидаемых результатов: что из этого самое важное, проблемное и частотное для получения? Что стоит на 2 и 3 месте?"),
        ]
      ),
      createSection(
        "[30 минут] Детальное изучение работы",
        "Основной блок для прокапывания того, как на самом деле звучит работа, на которую человек нанимает изучаемое решение.",
        [
          createRepeatable(
            "detailed-works",
            "Полный набор вопросов для изучения работы",
            "Добавляйте столько работ, сколько нужно. Внутри каждой работы поля из квадратных скобок являются отдельными категориями для структурированного ввода.",
            "Работа",
            detailedWorkPrototype,
            "Добавить работу"
          ),
        ]
      ),
      createSection(
        "[Опционально] Навигация в работы выше уровнем",
        "Блок для перехода к предыдущим или следующим работам относительно текущей.",
        [
          createField("предыдущие работы", "Как вы в прошлом по-другому получали {ожидаемый результат работы выше уровнем}?"),
          createField("следующие работы", "Что вы делали после того, как использовали {изучаемое решение}, чтобы получить {ожидаемый результат работы выше уровнем}?"),
          createRepeatable(
            "upper-level-works",
            "Краткое описание работы",
            "Краткие карточки для работ выше уровнем по структуре документа.",
            "Работа выше уровнем",
            shortWorkPrototype,
            "Добавить работу выше уровнем"
          ),
        ]
      ),
      createSection(
        "[Опционально] Навигация в работы ниже уровнем: частотные",
        "Используйте, если работы ниже уровнем частотные и человек получает результат каждый раз, когда их выполняет.",
        [
          createField("сценарии использования решения выше уровнем", "Для каких задач или сценариев вы используете {решение работы выше уровнем}?"),
          createRepeatable(
            "lower-level-frequent-works",
            "Краткое описание работы",
            "Карточки для частотных работ ниже уровнем.",
            "Работа ниже уровнем",
            lowerLevelFrequentPrototype,
            "Добавить частотную работу ниже уровнем"
          ),
        ]
      ),
      createSection(
        "[Опционально] Навигация в работы ниже уровнем: последовательные",
        "Используйте, если выполнение работ ниже уровнем похоже на проект со связанными шагами.",
        [
          createField("последовательные шаги", "Расскажите, пожалуйста, по шагам, что вы делаете для того, чтобы получить {ожидаемый результат работы выше уровнем}."),
          createRepeatable(
            "lower-level-sequence-works",
            "Краткое описание работы",
            "Карточки для последовательных работ ниже уровнем.",
            "Шаг работы",
            shortWorkPrototype,
            "Добавить шаг последовательной работы"
          ),
        ]
      ),
      createSection(
        "Закрытие интервью",
        "Финальный вопрос из гайда для добора того, что могло не прозвучать в основной части.",
        [
          createField("дополнительная важная информация", "Есть ли ещё что-то важное, что я у вас не спросил(а)?"),
        ]
      ),
    ],
  };
}

function ensureDefaults() {
  const templates = readStorage(STORAGE_KEYS.templates);
  const sessions = readStorage(STORAGE_KEYS.sessions);
  const uiState = readStorage(STORAGE_KEYS.state);

  state.templates = Array.isArray(templates) && templates.length > 0
    ? templates.map((template) => sanitizeTemplate(template))
    : [buildDefaultTemplate()];
  state.sessions = Array.isArray(sessions) ? sessions : [];
  state.activeTemplateId = uiState?.activeTemplateId || state.templates[0]?.id || null;
  state.activeSessionId = uiState?.activeSessionId || state.sessions[0]?.id || null;

  if (!state.sessions.length) {
    const initial = createSession(state.templates[0].id);
    state.sessions.push(initial);
    state.activeSessionId = initial.id;
  }

  if (!state.activeSessionId || !findSession(state.activeSessionId)) {
    state.activeSessionId = state.sessions[0]?.id || null;
  }

  if (!state.activeTemplateId || !findTemplate(state.activeTemplateId)) {
    state.activeTemplateId = state.templates[0]?.id || null;
  }

  persistAll();
}

function readStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error(`Failed to parse storage key ${key}`, error);
    return null;
  }
}

function persistAll() {
  localStorage.setItem(STORAGE_KEYS.templates, JSON.stringify(state.templates));
  localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(state.sessions));
  localStorage.setItem(
    STORAGE_KEYS.state,
    JSON.stringify({
      activeTemplateId: state.activeTemplateId,
      activeSessionId: state.activeSessionId,
    })
  );
}

function syncSessionToTemplate(session, template) {
  if (!session || !template) {
    return;
  }

  const nextGraph = {};
  template.graph.forEach((field) => {
    nextGraph[field.key] = session.graph?.[field.key] || "";
  });
  session.graph = nextGraph;

  const nextFields = {};
  const nextRepeatables = {};

  template.sections.forEach((section) => {
    section.items.forEach((item) => {
      if (item.type === "field") {
        nextFields[item.id] = session.fields?.[item.id] || "";
      }

      if (item.type === "repeatable") {
        const previousEntries = session.repeatables?.[item.key] || [];
        nextRepeatables[item.key] = previousEntries.length
          ? previousEntries.map((entry) => syncRepeatableEntry(entry, item))
          : [createRepeatableEntry(item)];
      }
    });
  });

  session.fields = nextFields;
  session.repeatables = nextRepeatables;
}

function syncRepeatableEntry(entry, repeatable) {
  const nextEntry = {
    id: entry?.id || uid("entry"),
    fields: {},
  };

  repeatable.prototype.forEach((field) => {
    nextEntry.fields[field.id] = entry?.fields?.[field.id] || "";
  });

  return nextEntry;
}

function findTemplate(templateId) {
  return state.templates.find((item) => item.id === templateId) || null;
}

function findSession(sessionId) {
  return state.sessions.find((item) => item.id === sessionId) || null;
}

function createSession(templateId) {
  const template = findTemplate(templateId);
  const session = {
    id: uid("session"),
    templateId,
    name: `Сессия ${new Date().toLocaleString("ru-RU")}`,
    respondent: "",
    updatedAt: new Date().toISOString(),
    graph: Object.fromEntries((template?.graph || []).map((field) => [field.key, ""])),
    fields: {},
    repeatables: {},
  };

  (template?.sections || []).forEach((section) => {
    section.items.forEach((item) => {
      if (item.type === "repeatable") {
        session.repeatables[item.key] = [createRepeatableEntry(item)];
      } else if (item.type === "field") {
        session.fields[item.id] = "";
      }
    });
  });

  return session;
}

function createRepeatableEntry(repeatable) {
  const entry = {
    id: uid("entry"),
    fields: {},
  };
  repeatable.prototype.forEach((field) => {
    entry.fields[field.id] = "";
  });
  return entry;
}

function getActiveSession() {
  return findSession(state.activeSessionId);
}

function getActiveTemplate() {
  const session = getActiveSession();
  return findTemplate(session?.templateId || state.activeTemplateId);
}

function touchSession(session, options = {}) {
  session.updatedAt = new Date().toISOString();
  persistAll();
  if (options.rerender) {
    render();
  }
}

function render() {
  const activeTemplate = getActiveTemplate();
  state.sessions.forEach((session) => {
    const template = findTemplate(session.templateId) || activeTemplate;
    syncSessionToTemplate(session, template);
  });
  persistAll();
  renderTemplateList();
  renderSessionList();
  renderWorkspace();
}

function renderTemplateList() {
  elements.templateList.innerHTML = "";
  const tpl = document.getElementById("list-item-template");

  state.templates.forEach((template) => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.querySelector(".list-item-title").textContent = template.name;
    node.querySelector(".list-item-meta").textContent = template.description;
    node.classList.toggle("active", template.id === state.activeTemplateId);
    node.addEventListener("click", () => {
      state.activeTemplateId = template.id;
      persistAll();
      render();
    });
    elements.templateList.appendChild(node);
  });
}

function renderSessionList() {
  elements.sessionList.innerHTML = "";
  const tpl = document.getElementById("list-item-template");

  state.sessions
    .slice()
    .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))
    .forEach((session) => {
      const template = findTemplate(session.templateId);
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.querySelector(".list-item-title").textContent = session.name;
      node.querySelector(".list-item-meta").textContent = `${template?.name || "Без шаблона"} · ${new Date(session.updatedAt).toLocaleString("ru-RU")}`;
      node.classList.toggle("active", session.id === state.activeSessionId);
      node.addEventListener("click", () => {
        state.activeSessionId = session.id;
        state.activeTemplateId = session.templateId;
        persistAll();
        render();
      });
      elements.sessionList.appendChild(node);
    });
}

function renderWorkspace() {
  const session = getActiveSession();
  const template = getActiveTemplate();

  if (!session || !template) {
    elements.workspaceTitle.textContent = "Нет активной сессии";
    elements.workspaceSubtitle.textContent = "Создайте шаблон и сессию.";
    return;
  }

  elements.workspaceTitle.textContent = template.name;
  elements.workspaceSubtitle.textContent = template.description;

  elements.sessionNameInput.value = session.name;
  elements.respondentInput.value = session.respondent;

  renderGraph(template, session);
  renderTemplateEditor(template);
  renderSections(template, session);
}

function renderGraph(template, session) {
  elements.graphFields.innerHTML = "";
  template.graph.forEach((field) => {
    const wrapper = document.createElement("label");
    wrapper.className = "field-shell";
    const title = document.createElement("span");
    title.textContent = field.label;
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = field.placeholder || "";
    input.value = session.graph[field.key] || "";
    input.addEventListener("input", (event) => {
      session.graph[field.key] = event.target.value;
      touchSession(session);
    });
    input.addEventListener("change", () => render());
    wrapper.append(title, input);
    elements.graphFields.appendChild(wrapper);
  });
}

function renderTemplateEditor(template) {
  elements.templateEditor.innerHTML = "";

  const graphCard = document.createElement("section");
  graphCard.className = "editor-card panel";
  graphCard.innerHTML = `
    <div>
      <p class="eyebrow">Переменные</p>
      <h3>Граф шаблона</h3>
      <p class="panel-copy">Эти переменные доступны для подстановки в вопросах через фигурные скобки.</p>
    </div>
  `;

  const graphList = document.createElement("div");
  graphList.className = "editor-items";

  template.graph.forEach((field, index) => {
    graphList.appendChild(renderGraphVariableEditor(template, field, index));
  });

  graphCard.appendChild(graphList);
  elements.templateEditor.appendChild(graphCard);

  template.sections.forEach((section, index) => {
    elements.templateEditor.appendChild(renderSectionEditor(template, section, index));
  });
}

function renderGraphVariableEditor(template, field, index) {
  const item = document.createElement("div");
  item.className = "editor-item";

  const top = document.createElement("div");
  top.className = "editor-item-top";
  top.innerHTML = `<span class="editor-item-type">Переменная ${index + 1}</span>`;

  const tools = document.createElement("div");
  tools.className = "editor-toolbar";
  tools.appendChild(createActionButton("Удалить", () => {
    template.graph.splice(index, 1);
    afterTemplateMutation(template);
  }));
  top.appendChild(tools);

  const grid = document.createElement("div");
  grid.className = "editor-inline-grid";
  grid.appendChild(createEditorInput("Метка", field.label, (value) => {
    renameGraphField(template, field, value);
  }));
  grid.appendChild(createEditorInput("Placeholder", field.placeholder || "", (value) => {
    field.placeholder = value;
    afterTemplateMutation(template);
  }));

  item.append(top, grid);
  return item;
}

function renameGraphField(template, field, nextLabel) {
  const trimmed = nextLabel.trim();
  if (!trimmed) {
    return;
  }

  const oldKey = field.key;
  const newKey = normalizeKey(trimmed);
  field.label = trimmed;
  field.key = newKey;

  state.sessions
    .filter((session) => session.templateId === template.id)
    .forEach((session) => {
      if (oldKey !== newKey) {
        session.graph[newKey] = session.graph[oldKey] || session.graph[newKey] || "";
        delete session.graph[oldKey];
      }
    });

  afterTemplateMutation(template);
}

function renderSectionEditor(template, section, sectionIndex) {
  const card = document.createElement("section");
  card.className = "editor-card panel";
  attachDragSource(card, { kind: "section", templateId: template.id, fromIndex: sectionIndex });
  attachDropTarget(card, (drag) => {
    if (drag.kind !== "section" || drag.templateId !== template.id) {
      return;
    }
    reorderList(template.sections, drag.fromIndex, sectionIndex);
    afterTemplateMutation(template);
  });

  const head = document.createElement("div");
  head.className = "panel-head";
  head.innerHTML = `<div><p class="eyebrow">Секция ${sectionIndex + 1}</p><h3>${escapeHtml(section.title)}</h3><p class="panel-copy">${escapeHtml(section.description || "")}</p></div>`;

  const tools = document.createElement("div");
  tools.className = "toolbar";
  const handle = document.createElement("span");
  handle.className = "drag-handle";
  handle.textContent = "⋮⋮";
  tools.appendChild(handle);
  tools.appendChild(createActionButton("Добавить поле", () => {
    section.items.push(createEmptyField());
    afterTemplateMutation(template);
  }));
  tools.appendChild(createActionButton("Добавить блок", () => {
    section.items.push(createEmptyRepeatable());
    afterTemplateMutation(template);
  }));
  tools.appendChild(createActionButton("Добавить заметку", () => {
    section.items.push(createEmptyNote());
    afterTemplateMutation(template);
  }));
  tools.appendChild(createActionButton("Удалить секцию", () => {
    template.sections.splice(sectionIndex, 1);
    afterTemplateMutation(template);
  }));
  head.appendChild(tools);
  card.appendChild(head);

  const meta = document.createElement("div");
  meta.className = "editor-inline-grid";
  meta.appendChild(createEditorInput("Название секции", section.title, (value) => {
    section.title = value;
    afterTemplateMutation(template);
  }));
  meta.appendChild(createEditorTextarea("Описание секции", section.description || "", (value) => {
    section.description = value;
    afterTemplateMutation(template);
  }, 3));
  card.appendChild(meta);

  const itemsRoot = document.createElement("div");
  itemsRoot.className = "editor-items";
  section.items.forEach((item, itemIndex) => {
    itemsRoot.appendChild(renderSectionItemEditor(template, section, item, itemIndex));
  });
  card.appendChild(itemsRoot);

  return card;
}

function renderSectionItemEditor(template, section, item, itemIndex) {
  const box = document.createElement("div");
  box.className = "editor-item";
  attachDragSource(box, { kind: "section-item", templateId: template.id, sectionId: section.id, fromIndex: itemIndex });
  attachDropTarget(box, (drag) => {
    if (drag.kind !== "section-item" || drag.templateId !== template.id || drag.sectionId !== section.id) {
      return;
    }
    reorderList(section.items, drag.fromIndex, itemIndex);
    afterTemplateMutation(template);
  });

  const top = document.createElement("div");
  top.className = "editor-item-top";
  top.innerHTML = `<div><span class="drag-handle">⋮⋮</span> <span class="editor-item-type">${item.type === "field" ? "Поле" : item.type === "repeatable" ? "Повторяемый блок" : "Заметка"}</span></div>`;

  const tools = document.createElement("div");
  tools.className = "editor-toolbar";
  tools.appendChild(createActionButton("Удалить", () => {
    section.items.splice(itemIndex, 1);
    afterTemplateMutation(template);
  }));
  top.appendChild(tools);
  box.appendChild(top);

  if (item.type === "note") {
    box.appendChild(createEditorTextarea("Текст заметки", item.text, (value) => {
      item.text = value;
      afterTemplateMutation(template);
    }, 4));
    return box;
  }

  if (item.type === "field") {
    box.appendChild(createEditorInput("Категория", item.category, (value) => {
      item.category = value;
      afterTemplateMutation(template);
    }));
    box.appendChild(createEditorTextarea("Формулировка вопроса", item.prompt, (value) => {
      item.prompt = value;
      afterTemplateMutation(template);
    }, 4));
    box.appendChild(createEditorInput("Подсказка", item.hint || "", (value) => {
      item.hint = value;
      afterTemplateMutation(template);
    }));
    return box;
  }

  box.appendChild(createEditorInput("Название блока", item.title, (value) => {
    item.title = value;
    afterTemplateMutation(template);
  }));
  box.appendChild(createEditorTextarea("Описание блока", item.description || "", (value) => {
    item.description = value;
    afterTemplateMutation(template);
  }, 3));
  box.appendChild(createEditorInput("Подпись элемента", item.itemTitle, (value) => {
    item.itemTitle = value;
    afterTemplateMutation(template);
  }));
  box.appendChild(createEditorInput("Кнопка добавления", item.addLabel || "", (value) => {
    item.addLabel = value;
    afterTemplateMutation(template);
  }));

  const fieldsRoot = document.createElement("div");
  fieldsRoot.className = "editor-items";
  item.prototype.forEach((field, fieldIndex) => {
    const fieldCard = document.createElement("div");
    fieldCard.className = "editor-item";
    attachDragSource(fieldCard, { kind: "repeatable-field", templateId: template.id, repeatableId: item.id, fromIndex: fieldIndex });
    attachDropTarget(fieldCard, (drag) => {
      if (drag.kind !== "repeatable-field" || drag.templateId !== template.id || drag.repeatableId !== item.id) {
        return;
      }
      reorderList(item.prototype, drag.fromIndex, fieldIndex);
      afterTemplateMutation(template);
    });
    fieldCard.innerHTML = `<div class="editor-item-top"><div><span class="drag-handle">⋮⋮</span> <span class="editor-item-type">Поле блока ${fieldIndex + 1}</span></div></div>`;

    const fieldTools = document.createElement("div");
    fieldTools.className = "editor-toolbar";
    fieldTools.appendChild(createActionButton("Удалить", () => {
      item.prototype.splice(fieldIndex, 1);
      afterTemplateMutation(template);
    }));
    fieldCard.firstElementChild.appendChild(fieldTools);

    fieldCard.appendChild(createEditorInput("Категория", field.category, (value) => {
      field.category = value;
      afterTemplateMutation(template);
    }));
    fieldCard.appendChild(createEditorTextarea("Формулировка вопроса", field.prompt, (value) => {
      field.prompt = value;
      afterTemplateMutation(template);
    }, 4));
    fieldCard.appendChild(createEditorInput("Подсказка", field.hint || "", (value) => {
      field.hint = value;
      afterTemplateMutation(template);
    }));
    fieldsRoot.appendChild(fieldCard);
  });

  const addFieldBtn = createActionButton("Добавить поле в блок", () => {
    item.prototype.push(createEmptyField());
    afterTemplateMutation(template);
  });
  box.append(fieldsRoot, addFieldBtn);

  return box;
}

function createEditorInput(label, value, onCommit) {
  const wrapper = document.createElement("label");
  wrapper.className = "field-shell";
  const title = document.createElement("span");
  title.textContent = label;
  const input = document.createElement("input");
  input.type = "text";
  input.value = value || "";
  input.addEventListener("change", (event) => onCommit(event.target.value.trim()));
  wrapper.append(title, input);
  return wrapper;
}

function createEditorTextarea(label, value, onCommit, rows = 4) {
  const wrapper = document.createElement("label");
  wrapper.className = "field-shell";
  const title = document.createElement("span");
  title.textContent = label;
  const textarea = document.createElement("textarea");
  textarea.rows = rows;
  textarea.value = value || "";
  textarea.addEventListener("change", (event) => onCommit(event.target.value));
  wrapper.append(title, textarea);
  return wrapper;
}

function createActionButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mini-btn";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function attachDragSource(node, payload) {
  node.draggable = true;
  node.addEventListener("dragstart", (event) => {
    state.drag = payload;
    node.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", JSON.stringify(payload));
  });
  node.addEventListener("dragend", () => {
    node.classList.remove("dragging");
    clearDropTargets();
    state.drag = null;
  });
}

function attachDropTarget(node, onDrop) {
  node.addEventListener("dragover", (event) => {
    if (!state.drag) {
      return;
    }
    event.preventDefault();
    node.classList.add("drop-target");
  });
  node.addEventListener("dragleave", () => {
    node.classList.remove("drop-target");
  });
  node.addEventListener("drop", (event) => {
    if (!state.drag) {
      return;
    }
    event.preventDefault();
    node.classList.remove("drop-target");
    onDrop(state.drag);
  });
}

function clearDropTargets() {
  document.querySelectorAll(".drop-target").forEach((node) => node.classList.remove("drop-target"));
}

function reorderList(list, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) {
    return;
  }
  const [item] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, item);
}

function moveItem(list, index, delta, template) {
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= list.length) {
    return;
  }
  reorderList(list, index, nextIndex);
  afterTemplateMutation(template);
}

function afterTemplateMutation(template) {
  state.sessions
    .filter((session) => session.templateId === template.id)
    .forEach((session) => syncSessionToTemplate(session, template));
  persistAll();
  render();
}

function renderSections(template, session) {
  elements.templateSections.innerHTML = "";
  const sectionTpl = document.getElementById("section-template");

  template.sections.forEach((section, sectionIndex) => {
    const node = sectionTpl.content.firstElementChild.cloneNode(true);
    node.querySelector(".section-kicker").textContent = `Секция ${sectionIndex + 1}`;
    node.querySelector(".section-title").textContent = section.title;
    node.querySelector(".section-description").textContent = section.description || "";
    const itemsRoot = node.querySelector(".section-items");

    section.items.forEach((item) => {
      if (item.type === "note") {
        itemsRoot.appendChild(renderNote(item));
      }

      if (item.type === "field") {
        itemsRoot.appendChild(renderField(item, session, null));
      }

      if (item.type === "repeatable") {
        itemsRoot.appendChild(renderRepeatable(item, session));
      }
    });

    elements.templateSections.appendChild(node);
  });
}

function renderNote(item) {
  const note = document.createElement("article");
  note.className = "note-card";
  note.innerHTML = `<strong>Комментарий по структуре</strong><p>${escapeHtml(item.text)}</p>`;
  return note;
}

function renderField(item, session, repeatableContext) {
  const card = document.createElement("article");
  card.className = "question-card panel";

  const chip = document.createElement("div");
  chip.className = "question-chip";
  chip.textContent = `[${item.category}]`;

  const label = document.createElement("div");
  label.className = "question-label";
  label.textContent = item.category;

  const copy = document.createElement("p");
  copy.className = "question-copy";
  copy.textContent = renderPrompt(item.prompt, session, repeatableContext);

  const textareaShell = document.createElement("label");
  textareaShell.className = "field-shell";
  const textareaTitle = document.createElement("span");
  textareaTitle.textContent = "Ответ";
  const textarea = document.createElement("textarea");
  textarea.rows = item.rows || 5;
  textarea.value = getFieldValue(item, session, repeatableContext);
  textarea.addEventListener("input", (event) => {
    setFieldValue(item, session, repeatableContext, event.target.value);
    touchSession(session);
  });
  textarea.addEventListener("change", () => render());
  textareaShell.append(textareaTitle, textarea);

  card.append(chip, label, copy);

  if (item.hint) {
    const hint = document.createElement("p");
    hint.className = "question-copy";
    hint.textContent = item.hint;
    card.appendChild(hint);
  }

  card.appendChild(textareaShell);
  return card;
}

function renderRepeatable(item, session) {
  const card = document.createElement("article");
  card.className = "repeat-card";

  const head = document.createElement("div");
  head.className = "repeat-head";
  head.innerHTML = `<div><div class="repeat-title">${escapeHtml(item.title)}</div><p class="repeat-copy">${escapeHtml(item.description || "")}</p></div>`;

  const addBtn = document.createElement("button");
  addBtn.className = "add-btn";
  addBtn.type = "button";
  addBtn.textContent = item.addLabel || "Добавить";
  addBtn.addEventListener("click", () => {
    session.repeatables[item.key].push(createRepeatableEntry(item));
    touchSession(session, { rerender: true });
  });

  head.appendChild(addBtn);
  card.appendChild(head);

  const entries = session.repeatables[item.key] || [];

  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Пока нет элементов в этом блоке.";
    card.appendChild(empty);
    return card;
  }

  entries.forEach((entry, entryIndex) => {
    const entryNode = document.createElement("section");
    entryNode.className = "repeat-entry";

    const top = document.createElement("div");
    top.className = "repeat-entry-top";
    const title = document.createElement("div");
    title.className = "repeat-title";
    title.textContent = resolveEntryTitle(item, entry, entryIndex);

    const controls = document.createElement("div");
    controls.className = "repeat-toolbar";

    const duplicate = document.createElement("button");
    duplicate.type = "button";
    duplicate.className = "mini-btn";
    duplicate.textContent = "Дублировать";
    duplicate.addEventListener("click", () => {
      session.repeatables[item.key].splice(entryIndex + 1, 0, deepClone(entry));
      session.repeatables[item.key][entryIndex + 1].id = uid("entry");
      touchSession(session, { rerender: true });
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "mini-btn";
    remove.textContent = "Удалить";
    remove.addEventListener("click", () => {
      session.repeatables[item.key].splice(entryIndex, 1);
      touchSession(session, { rerender: true });
    });

    controls.append(duplicate, remove);
    top.append(title, controls);
    entryNode.appendChild(top);

    item.prototype.forEach((field) => {
      entryNode.appendChild(renderField(field, session, { repeatable: item, entry }));
    });

    card.appendChild(entryNode);
  });

  return card;
}

function resolveEntryTitle(repeatable, entry, entryIndex) {
  const firstNamed = Object.values(entry.fields).find((value) => value && value.trim());
  return firstNamed ? `${repeatable.itemTitle} ${entryIndex + 1}: ${truncate(firstNamed, 72)}` : `${repeatable.itemTitle} ${entryIndex + 1}`;
}

function truncate(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}…`;
}

function getFieldValue(item, session, repeatableContext) {
  if (repeatableContext) {
    return repeatableContext.entry.fields[item.id] || "";
  }
  return session.fields[item.id] || "";
}

function setFieldValue(item, session, repeatableContext, value) {
  if (repeatableContext) {
    repeatableContext.entry.fields[item.id] = value;
    return;
  }
  session.fields[item.id] = value;
}

function renderPrompt(prompt, session, repeatableContext) {
  const substitutions = {};

  Object.entries(session.graph).forEach(([key, value]) => {
    substitutions[key] = value;
  });

  if (repeatableContext) {
    repeatableContext.repeatable.prototype.forEach((field) => {
      substitutions[normalizeKey(field.category)] = repeatableContext.entry.fields[field.id] || "";
    });
  }

  return prompt.replace(/\{([^}]+)\}/g, (_, token) => {
    const key = resolveTokenKey(token);
    return substitutions[key] || `{${token}}`;
  });
}

function resolveTokenKey(token) {
  const normalized = normalizeKey(token);
  return TOKEN_ALIASES[normalized] || normalized;
}

function exportSessionAsJson() {
  const session = getActiveSession();
  const template = getActiveTemplate();
  if (!session || !template) {
    return;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    template: {
      id: template.id,
      name: template.name,
      description: template.description,
    },
    session: buildStructuredSession(session, template),
  };

  downloadFile(`${slugify(session.name || "session")}.json`, JSON.stringify(payload, null, 2), "application/json");
}

function buildStructuredSession(session, template) {
  return {
    id: session.id,
    name: session.name,
    respondent: session.respondent,
    updatedAt: session.updatedAt,
    graph: Object.fromEntries(
      template.graph.map((field) => [field.label, session.graph[field.key] || ""])
    ),
    sections: template.sections.map((section) => ({
      title: section.title,
      description: section.description,
      items: section.items.map((item) => {
        if (item.type === "note") {
          return { type: "note", text: item.text };
        }

        if (item.type === "field") {
          return {
            type: "field",
            category: item.category,
            prompt: renderPrompt(item.prompt, session, null),
            answer: session.fields[item.id] || "",
          };
        }

        if (item.type === "repeatable") {
          return {
            type: "repeatable",
            title: item.title,
            entries: (session.repeatables[item.key] || []).map((entry, index) => ({
              title: resolveEntryTitle(item, entry, index),
              fields: item.prototype.map((field) => ({
                category: field.category,
                prompt: renderPrompt(field.prompt, session, { repeatable: item, entry }),
                answer: entry.fields[field.id] || "",
              })),
            })),
          };
        }

        return item;
      }),
    })),
  };
}

function exportSessionAsCsv() {
  const session = getActiveSession();
  const template = getActiveTemplate();
  if (!session || !template) {
    return;
  }

  const rows = [];

  template.graph.forEach((field) => {
    rows.push({
      section: "graph",
      block: "graph",
      entry: "",
      category: field.label,
      prompt: "",
      answer: session.graph[field.key] || "",
    });
  });

  template.sections.forEach((section) => {
    section.items.forEach((item) => {
      if (item.type === "field") {
        rows.push({
          section: section.title,
          block: "field",
          entry: "",
          category: item.category,
          prompt: renderPrompt(item.prompt, session, null),
          answer: session.fields[item.id] || "",
        });
      }

      if (item.type === "repeatable") {
        (session.repeatables[item.key] || []).forEach((entry, index) => {
          item.prototype.forEach((field) => {
            rows.push({
              section: section.title,
              block: item.title,
              entry: `${index + 1}`,
              category: field.category,
              prompt: renderPrompt(field.prompt, session, { repeatable: item, entry }),
              answer: entry.fields[field.id] || "",
            });
          });
        });
      }
    });
  });

  const header = ["section", "block", "entry", "category", "prompt", "answer"];
  const csv = [
    header.join(","),
    ...rows.map((row) => header.map((key) => csvCell(row[key] || "")).join(",")),
  ].join("\n");

  downloadFile(`${slugify(session.name || "session")}.csv`, csv, "text/csv;charset=utf-8");
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/(^-|-$)/g, "");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function duplicateActiveTemplate() {
  const activeTemplate = findTemplate(state.activeTemplateId);
  if (!activeTemplate) {
    return;
  }

  const duplicated = deepClone(activeTemplate);
  duplicated.id = uid("template");
  duplicated.name = `${activeTemplate.name} copy`;
  state.templates.push(duplicated);
  state.activeTemplateId = duplicated.id;
  persistAll();
  render();
}

function renameActiveTemplate() {
  const activeTemplate = findTemplate(state.activeTemplateId);
  if (!activeTemplate) {
    return;
  }

  const nextName = window.prompt("Название шаблона", activeTemplate.name);
  if (!nextName) {
    return;
  }

  const trimmed = nextName.trim();
  if (!trimmed) {
    return;
  }

  activeTemplate.name = trimmed;
  persistAll();
  render();
}

function exportActiveTemplate() {
  const template = getActiveTemplate();
  if (!template) {
    return;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    template: sanitizeTemplate(deepClone(template)),
  };

  downloadFile(`${slugify(template.name || "template")}.template.json`, JSON.stringify(payload, null, 2), "application/json");
}

function triggerTemplateImport() {
  elements.templateImportInput.click();
}

function importTemplateFromFile(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const importedRaw = parsed?.template || parsed;
      const imported = sanitizeTemplate(importedRaw);
      imported.id = uid("template");
      imported.name = imported.name || `Импорт ${state.templates.length + 1}`;
      state.templates.push(imported);
      state.activeTemplateId = imported.id;

      const session = createSession(imported.id);
      state.sessions.unshift(session);
      state.activeSessionId = session.id;

      persistAll();
      render();
    } catch (error) {
      window.alert("Не удалось импортировать шаблон JSON.");
      console.error(error);
    } finally {
      elements.templateImportInput.value = "";
    }
  };
  reader.readAsText(file, "utf-8");
}

function createNewTemplate() {
  const base = findTemplate(state.activeTemplateId) || buildDefaultTemplate();
  const copy = deepClone(base);
  copy.id = uid("template");
  copy.name = `Новый шаблон ${state.templates.length + 1}`;
  copy.description = "Копия базовой структуры, которую можно использовать как отдельный шаблон интервью.";
  state.templates.push(copy);
  state.activeTemplateId = copy.id;

  const session = createSession(copy.id);
  state.sessions.unshift(session);
  state.activeSessionId = session.id;

  persistAll();
  render();
}

function createNewSession() {
  const templateId = state.activeTemplateId || state.templates[0]?.id;
  if (!templateId) {
    return;
  }

  const session = createSession(templateId);
  state.sessions.unshift(session);
  state.activeSessionId = session.id;
  persistAll();
  render();
}

function clearAllSessions() {
  const confirmed = window.confirm("Удалить все сохранённые сессии из localStorage?");
  if (!confirmed) {
    return;
  }

  state.sessions = [];
  const replacement = createSession(state.activeTemplateId || state.templates[0]?.id);
  state.sessions.push(replacement);
  state.activeSessionId = replacement.id;
  persistAll();
  render();
}

function addGraphVariable() {
  const template = getActiveTemplate();
  if (!template) {
    return;
  }

  template.graph.push({
    key: normalizeKey(`новая переменная ${template.graph.length + 1}`),
    label: `новая переменная ${template.graph.length + 1}`,
    placeholder: "",
  });
  afterTemplateMutation(template);
}

function addSection() {
  const template = getActiveTemplate();
  if (!template) {
    return;
  }

  template.sections.push(createSection("Новая секция", "Описание секции", [createEmptyField()]));
  afterTemplateMutation(template);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function bindEvents() {
  elements.sessionNameInput.addEventListener("input", (event) => {
    const session = getActiveSession();
    if (!session) {
      return;
    }
    session.name = event.target.value;
    touchSession(session);
  });
  elements.sessionNameInput.addEventListener("change", () => render());

  elements.respondentInput.addEventListener("input", (event) => {
    const session = getActiveSession();
    if (!session) {
      return;
    }
    session.respondent = event.target.value;
    touchSession(session);
  });
  elements.respondentInput.addEventListener("change", () => render());

  elements.exportJsonBtn.addEventListener("click", exportSessionAsJson);
  elements.exportCsvBtn.addEventListener("click", exportSessionAsCsv);
  elements.exportTemplateBtn.addEventListener("click", exportActiveTemplate);
  elements.importTemplateBtn.addEventListener("click", triggerTemplateImport);
  elements.templateImportInput.addEventListener("change", importTemplateFromFile);
  elements.renameTemplateBtn.addEventListener("click", renameActiveTemplate);
  elements.newTemplateBtn.addEventListener("click", createNewTemplate);
  elements.newSessionBtn.addEventListener("click", createNewSession);
  elements.clearSessionsBtn.addEventListener("click", clearAllSessions);
  elements.duplicateTemplateBtn.addEventListener("click", duplicateActiveTemplate);
  elements.addGraphVarBtn.addEventListener("click", addGraphVariable);
  elements.addSectionBtn.addEventListener("click", addSection);
}

ensureDefaults();
bindEvents();
render();

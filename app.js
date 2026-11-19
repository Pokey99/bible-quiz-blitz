(() => {
  'use strict';

  const HISTORY_KEY = 'bible-quiz-blitz-history-v1';
  const SCORES_KEY = 'bible-quiz-blitz-high-scores-v1';
  const LEGACY_STORAGE_KEYS = [
    ['word-recall-history-v1', HISTORY_KEY, []],
    ['word-recall-high-scores-v1', SCORES_KEY, {}],
  ];
  const THEME_KEY = 'bible-quiz-blitz-theme-v1';
  const UPCOMING_YEARS = [{ year: 2026, label: '2026 · Acts (coming soon)' }];
  const STUDY_WEEKS = [{
    year: 2027,
    entries: [
      { week: 1, label: '1 Samuel 16–18', start: ['1 Samuel', 16, 1], end: ['1 Samuel', 18, Infinity] },
      { week: 2, label: '1 Samuel 19–22:10', start: ['1 Samuel', 19, 1], end: ['1 Samuel', 22, 10] },
      { week: 3, label: '1 Samuel 22:11–25', start: ['1 Samuel', 22, 11], end: ['1 Samuel', 25, Infinity] },
      { week: 4, label: '1 Samuel 26–30', start: ['1 Samuel', 26, 1], end: ['1 Samuel', 30, Infinity] },
      { week: 5, label: '1 Samuel 31–2 Samuel 3:25', start: ['1 Samuel', 31, 1], end: ['2 Samuel', 3, 25] },
      { week: 6, label: '2 Samuel 3:26–7', start: ['2 Samuel', 3, 26], end: ['2 Samuel', 7, Infinity] },
      { week: 7, label: '2 Samuel 8–12', start: ['2 Samuel', 8, 1], end: ['2 Samuel', 12, Infinity] },
      { week: 8, label: '1 Kings 1:28–2', start: ['1 Kings', 1, 28], end: ['1 Kings', 2, Infinity] },
    ],
  }];
  const BOOK_ORDER = new Map([['1 Samuel', 1], ['2 Samuel', 2], ['1 Kings', 3]]);
  const elements = {
    setupPanel: document.getElementById('setup-panel'),
    historyPanel: document.getElementById('history-panel'),
    setupForm: document.getElementById('setup-form'),
    yearSelect: document.getElementById('year-select'),
    chapterSelect: document.getElementById('chapter-select'),
    weekSelect: document.getElementById('week-select'),
    weekHelp: document.getElementById('week-help'),
    includePrior: document.getElementById('include-prior'),
    countInput: document.getElementById('question-count'),
    durationInput: document.getElementById('duration-minutes'),
    countField: document.getElementById('count-field'),
    durationField: document.getElementById('duration-field'),
    availableCount: document.getElementById('available-count'),
    formMessage: document.getElementById('form-message'),
    quizPanel: document.getElementById('quiz-panel'),
    resultPanel: document.getElementById('result-panel'),
    resultDuration: document.getElementById('result-duration'),
    modeLabel: document.getElementById('session-mode-label'),
    progress: document.getElementById('session-progress'),
    sessionScope: document.getElementById('session-scope'),
    timerWrap: document.getElementById('timer-wrap'),
    timerDisplay: document.getElementById('timer-display'),
    timerProgress: document.getElementById('timer-progress'),
    timerBar: document.getElementById('timer-bar'),
    question: document.getElementById('quiz-heading'),
    answerArea: document.getElementById('answer-area'),
    answer: document.getElementById('answer-text'),
    revealButton: document.getElementById('reveal-button'),
    nextButton: document.getElementById('next-button'),
    verseLink: document.getElementById('verse-link'),
    resultSummary: document.getElementById('result-summary'),
    highScoreNote: document.getElementById('high-score-note'),
    saveMessage: document.getElementById('save-message'),
    resultTitle: document.getElementById('result-title'),
    historyList: document.getElementById('history-list'),
    historyEmpty: document.getElementById('history-empty'),
    sessionsTotal: document.getElementById('sessions-total'),
    questionsTotal: document.getElementById('questions-total'),
    timedBest: document.getElementById('timed-best'),
    installButton: document.getElementById('install-button'),
    menuButton: document.getElementById('menu-button'),
    appMenu: document.getElementById('app-menu'),
    themeChoices: [...document.querySelectorAll('[data-theme-choice]')],
    themeMeta: document.querySelector('meta[name="theme-color"]'),
    brandHome: document.getElementById('brand-home'),
  };

  let questions = [];
  let session = null;
  let lastSessionConfig = null;
  let timerInterval = null;
  let installPrompt = null;

  function readStorage(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      if (!value) return fallback;
      const parsed = JSON.parse(value);
      if (Array.isArray(fallback)) {
        return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) : fallback;
      }
      if (fallback && typeof fallback === 'object') {
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback;
        return Object.fromEntries(Object.entries(parsed)
          .filter(([duration, score]) => /^\d+$/.test(duration) && Number.isFinite(score) && score >= 0));
      }
      return parsed;
    } catch (error) {
      console.error(`Unable to read ${key} from local storage.`, error);
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Unable to save ${key} to local storage.`, error);
      elements.formMessage.textContent = 'This browser could not save your history. The session can still continue.';
      return false;
    }
  }

  function migrateLegacyStorage() {
    LEGACY_STORAGE_KEYS.forEach(([legacyKey, currentKey, fallback]) => {
      try {
        if (localStorage.getItem(currentKey) !== null || localStorage.getItem(legacyKey) === null) return;
        writeStorage(currentKey, readStorage(legacyKey, fallback));
      } catch (error) {
        console.error(`Unable to migrate ${legacyKey} in local storage.`, error);
      }
    });
  }

  function selectedTypes() {
    return [...document.querySelectorAll('input[name="type"]:checked')].map((input) => input.value);
  }

  function selectedYear() {
    return elements.yearSelect.value === 'all' ? null : Number(elements.yearSelect.value);
  }

  function chapterKeys(year) {
    return [...new Set(questions
      .filter((question) => year === null || question.year === year)
      .map((question) => `${question.book}:${question.chapter}`))];
  }

  function canonicalBook(book) {
    const normalized = book.trim().replace(/\s+/g, ' ');
    return normalized
      .replace(/^I\s+Samuel$/i, '1 Samuel')
      .replace(/^II\s+Samuel$/i, '2 Samuel')
      .replace(/^I\s+Kings$/i, '1 Kings');
  }

  function compareReferences(left, right) {
    const bookDifference = (BOOK_ORDER.get(canonicalBook(left[0])) || 0)
      - (BOOK_ORDER.get(canonicalBook(right[0])) || 0);
    if (bookDifference) return bookDifference;
    return left[1] - right[1] || left[2] - right[2];
  }

  function questionInWeek(question, week) {
    const reference = [question.book, question.chapter, question.verse];
    return compareReferences(reference, week.start) >= 0
      && compareReferences(reference, week.end) <= 0;
  }

  function weekEntries(year) {
    return STUDY_WEEKS
      .filter((study) => year === null || study.year === year)
      .flatMap((study) => study.entries.map((entry) => ({
        ...entry,
        year: study.year,
        key: `${study.year}:${entry.week}`,
        available: questions.some((question) => question.year === study.year && questionInWeek(question, entry)),
      })));
  }

  function weekLabel(entry) {
    return `${entry.year} · Week ${entry.week} · ${entry.label}${entry.available ? '' : ' (questions not added yet)'}`;
  }

  function selectedQuestions() {
    const year = selectedYear();
    const chapterKey = elements.chapterSelect.value;
    const prior = elements.includePrior.checked;
    const selectedWeek = elements.weekSelect.value;
    const types = selectedTypes();
    const includedChapters = new Map();
    if (chapterKey !== 'all' && prior) {
      const years = year === null ? [...new Set(questions.map((question) => question.year))] : [year];
      years.forEach((chapterYear) => {
        const keys = chapterKeys(chapterYear);
        const selectedIndex = keys.indexOf(chapterKey);
        if (selectedIndex >= 0) includedChapters.set(chapterYear, new Set(keys.slice(0, selectedIndex + 1)));
      });
    }
    const weeks = weekEntries(year);
    const selectedWeekIndex = weeks.findIndex((entry) => entry.key === selectedWeek);
    const includedWeeks = selectedWeekIndex >= 0
      ? (prior ? weeks.slice(0, selectedWeekIndex + 1) : [weeks[selectedWeekIndex]])
      : [];

    return questions.filter((question) => {
      if ((year !== null && question.year !== year) || !types.includes(question.type)) return false;
      const questionChapterKey = `${question.book}:${question.chapter}`;
      if (chapterKey !== 'all') {
        const allowed = prior
          ? includedChapters.get(question.year)
          : new Set([chapterKey]);
        if (!allowed || !allowed.has(questionChapterKey)) return false;
      }
      if (selectedWeek && !includedWeeks.some((week) => (
        question.year === week.year && questionInWeek(question, week)
      ))) return false;
      return true;
    });
  }

  function populateYears() {
    const years = [...new Set(questions.map((question) => question.year))].sort((a, b) => a - b);
    const allYears = document.createElement('option');
    allYears.value = 'all';
    allYears.textContent = 'All Years';
    const options = [allYears, ...years.map((year) => {
      const option = document.createElement('option');
      option.value = String(year);
      option.textContent = year === 2027
        ? 'The Life of David (1 Sam, 2 Sam, 1 Kin)'
        : `${year} · ${[...new Set(questions.filter((question) => question.year === year).map((question) => question.book))].join(', ')}`;
      return option;
    })];
    UPCOMING_YEARS.filter(({ year }) => !years.includes(year)).forEach(({ year, label }) => {
      const comingSoon = document.createElement('option');
      comingSoon.value = String(year);
      comingSoon.disabled = true;
      comingSoon.textContent = label;
      options.push(comingSoon);
    });
    elements.yearSelect.replaceChildren(...options);
    elements.yearSelect.value = String(years[years.length - 1]);
  }

  function updateChapterOptions() {
    const year = selectedYear();
    const chapters = [...new Map(questions.filter((question) => year === null || question.year === year)
      .map((question) => [`${question.book}:${question.chapter}`, question])).entries()];
    const allChapters = document.createElement('option');
    allChapters.value = 'all';
    allChapters.textContent = 'All chapters';
    elements.chapterSelect.replaceChildren(allChapters, ...chapters.map(([key, question]) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = `${question.book} ${question.chapter}`;
      return option;
    }));
    elements.chapterSelect.disabled = chapters.length === 0;
    elements.chapterSelect.value = 'all';
    updateWeekOptions();
    updateAvailableQuestions();
  }

  function updateWeekOptions() {
    const weeks = weekEntries(selectedYear());
    if (!weeks.length) {
      const unavailable = document.createElement('option');
      unavailable.value = '';
      unavailable.disabled = true;
      unavailable.textContent = 'Weeks not defined for this year';
      elements.weekSelect.replaceChildren(unavailable);
      elements.weekSelect.disabled = true;
      elements.weekHelp.textContent = 'Week ranges have not been defined for this study year.';
      return;
    }
    const allWeeks = document.createElement('option');
    allWeeks.value = '';
    allWeeks.textContent = 'All weeks';
    elements.weekSelect.replaceChildren(allWeeks, ...weeks.map((entry) => {
      const option = document.createElement('option');
      option.value = entry.key;
      option.textContent = weekLabel(entry);
      option.disabled = !entry.available;
      return option;
    }));
    elements.weekSelect.disabled = false;
    const unavailableWeeks = weeks.filter((week) => !week.available);
    const notImplemented = unavailableWeeks.length
      ? ` Weeks ${unavailableWeeks.map((week) => week.week).join(', ')} are not implemented yet.`
      : '';
    elements.weekHelp.textContent = `Choose a week to narrow the cards. The prior-material checkbox includes earlier weeks.${notImplemented}`;
  }

  function updateAvailableQuestions() {
    const available = selectedQuestions().length;
    elements.availableCount.textContent = `${available} ${available === 1 ? 'question' : 'questions'} match these selections.`;
  }

  function shuffle(items) {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function scopeDescription() {
    const yearLabel = elements.yearSelect.selectedOptions[0].textContent;
    let chapter = elements.chapterSelect.selectedOptions[0].textContent;
    if (elements.chapterSelect.value !== 'all') {
      const [book, selectedChapterValue] = elements.chapterSelect.value.split(':');
      const selectedChapter = Number(selectedChapterValue);
      const availableChapters = [...new Set(questions
        .filter((question) => (selectedYear() === null || question.year === selectedYear())
          && question.book === book
          && (!elements.includePrior.checked || question.chapter <= selectedChapter))
        .map((question) => question.chapter))]
        .sort((a, b) => a - b);
      const consecutive = availableChapters.every((value, index) => index === 0 || value === availableChapters[index - 1] + 1);
      const chapterNumbers = consecutive && availableChapters.length > 1
        ? `${availableChapters[0]}–${availableChapters[availableChapters.length - 1]}`
        : availableChapters.join(', ');
      chapter = `${book} ${chapterNumbers}`;
    }
    const week = elements.weekSelect.value
      ? elements.weekSelect.selectedOptions[0].textContent
      : 'All weeks';
    return [yearLabel, chapter, week].filter(Boolean).join(' · ');
  }

  function startSession(event, continuous = false) {
    if (event) event.preventDefault();
    elements.formMessage.textContent = '';
    const pool = selectedQuestions();
    if (!pool.length) {
      elements.formMessage.textContent = 'Choose at least one question type with available questions.';
      return;
    }

    if (session) finishSession();
    const mode = continuous ? 'continuous' : document.querySelector('input[name="mode"]:checked').value;
    const goal = mode === 'continuous'
      ? null
      : mode === 'count' ? Number(elements.countInput.value) : Number(elements.durationInput.value);
    if (mode !== 'continuous' && (!Number.isInteger(goal) || goal < 1)) return;
    if (timerInterval !== null) window.clearInterval(timerInterval);

    lastSessionConfig = {
      year: elements.yearSelect.value,
      chapter: elements.chapterSelect.value,
      week: elements.weekSelect.value,
      includePrior: elements.includePrior.checked,
      types: selectedTypes(),
      mode,
      goal,
    };
    session = {
      mode,
      goal,
      pool,
      deck: shuffle(pool),
      index: 0,
      asked: 0,
      current: null,
      startedAt: Date.now(),
      deadline: mode === 'timed' ? Date.now() + goal * 60 * 1000 : null,
      scope: scopeDescription(),
      year: selectedYear(),
      types: selectedTypes(),
    };
    showPage('quiz-panel');
    elements.modeLabel.textContent = mode === 'timed'
      ? `${goal}-minute practice`
      : mode === 'continuous' ? 'Continuous practice' : 'Question practice';
    elements.sessionScope.textContent = scopeDescription();
    elements.timerWrap.hidden = mode !== 'timed';
    closeAppMenu();
    showNextQuestion(Boolean(event));
    if (mode === 'timed') {
      updateTimer();
      timerInterval = window.setInterval(updateTimer, 1000);
    }
    elements.quizPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showNextQuestion(focusQuestion = false) {
    if (!session) return;
    if (session.mode === 'count' && session.asked >= session.goal) {
      finishSession();
      return;
    }
    if (session.index >= session.deck.length) {
      session.deck = shuffle(session.pool);
      session.index = 0;
    }

    session.current = session.deck[session.index];
    session.index += 1;
    session.asked += 1;
    const item = session.current;
    elements.question.textContent = item.question;
    elements.answer.textContent = item.answer;
    elements.answerArea.hidden = true;
    elements.revealButton.hidden = false;
    elements.nextButton.hidden = true;
    elements.progress.textContent = session.mode === 'count'
      ? `Question ${session.asked} of ${session.goal}`
      : `${session.asked} ${session.asked === 1 ? 'question' : 'questions'}`;
    const reference = `${item.book} ${item.chapter}:${item.verse}`;
    const esvReference = `${item.book}+${item.chapter}:${item.verse}`.replace(/ /g, '+');
    elements.verseLink.href = `https://www.esv.org/verses/${esvReference}/`;
    elements.verseLink.setAttribute('aria-label', `Open ${reference} in the ESV`);
    if (focusQuestion) elements.revealButton.focus();
  }

  function revealAnswer() {
    if (!session || elements.answerArea.hidden === false) return;
    elements.answerArea.hidden = false;
    elements.revealButton.hidden = true;
    elements.nextButton.hidden = false;
    elements.nextButton.focus();
  }

  function updateTimer() {
    if (!session || session.mode !== 'timed') return;
    const remaining = Math.max(0, session.deadline - Date.now());
    const seconds = Math.ceil(remaining / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    const percentage = Math.max(0, (remaining / (session.goal * 60 * 1000)) * 100);
    elements.timerDisplay.textContent = `${minutes}:${String(remainder).padStart(2, '0')}`;
    elements.timerBar.style.width = `${percentage}%`;
    elements.timerProgress.setAttribute('aria-valuenow', String(Math.round(percentage)));
    elements.timerProgress.classList.toggle('is-low', percentage <= 15);
    if (remaining <= 0) finishSession();
  }

  function finishSession() {
    if (!session) return;
    if (timerInterval !== null) {
      window.clearInterval(timerInterval);
      timerInterval = null;
    }

    const completed = session;
    const durationSeconds = Math.max(0, Math.round((Date.now() - completed.startedAt) / 1000));
    const record = {
      date: new Date().toISOString(),
      mode: completed.mode,
      goal: completed.goal,
      asked: completed.asked,
      scope: completed.scope,
      year: completed.year,
      durationSeconds,
    };
    const history = readStorage(HISTORY_KEY, []);
    history.unshift(record);
    const historySaved = writeStorage(HISTORY_KEY, history);
    let newRecord = false;
    let scoreSaved = true;
    if (completed.mode === 'timed') {
      const scores = readStorage(SCORES_KEY, {});
      const scoreKey = String(completed.goal);
      newRecord = completed.asked > (scores[scoreKey] || 0);
      scores[scoreKey] = Math.max(scores[scoreKey] || 0, completed.asked);
      scoreSaved = writeStorage(SCORES_KEY, scores);
    }

    showPage('result-panel');
    elements.resultSummary.textContent = completed.mode === 'timed'
      ? `You practiced ${completed.asked} ${completed.asked === 1 ? 'question' : 'questions'} in ${completed.goal} minutes.`
      : `You completed ${completed.asked} ${completed.asked === 1 ? 'question' : 'questions'} in ${completed.scope}.`;
    elements.resultDuration.textContent = `Time: ${formatDuration(durationSeconds)}`;
    elements.highScoreNote.hidden = !newRecord;
    elements.highScoreNote.textContent = newRecord ? `A new personal best for a ${completed.goal}-minute session!` : '';
    elements.saveMessage.textContent = historySaved && scoreSaved ? '' : 'Your session ended, but some history or high-score data could not be saved in this browser.';
    session = null;
    renderHistory();
    elements.resultTitle.focus();
    elements.resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Recently' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
  }

  function formatDuration(seconds) {
    const wholeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(wholeSeconds / 60);
    const remainingSeconds = wholeSeconds % 60;
    return minutes ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
  }

  function renderHistory() {
    const history = readStorage(HISTORY_KEY, []);
    const scores = readStorage(SCORES_KEY, {});
    const best = Math.max(0, ...Object.values(scores).filter(Number.isFinite));
    elements.sessionsTotal.textContent = String(history.length);
    elements.questionsTotal.textContent = String(history.reduce((total, item) => total + (Number(item.asked) || 0), 0));
    elements.timedBest.textContent = best ? `${best} Qs` : '—';
    elements.historyList.replaceChildren(...history.slice(0, 5).map((item) => {
      const row = document.createElement('li');
      const details = document.createElement('span');
      const score = document.createElement('strong');
      const date = document.createElement('time');
      details.textContent = item.mode === 'timed'
        ? `${item.goal}-min timed`
        : item.mode === 'continuous' ? 'Continuous practice' : `${item.scope || 'Study'} · count`;
      score.textContent = `${Number(item.asked) || 0} Q`;
      date.dateTime = item.date || '';
      date.textContent = formatDate(item.date);
      row.append(details, score, date);
      return row;
    }));
    elements.historyEmpty.hidden = history.length > 0;
  }

  function setMode(mode) {
    const timed = mode === 'timed';
    elements.countField.hidden = timed;
    elements.durationField.hidden = !timed;
    elements.countInput.disabled = timed;
    elements.durationInput.disabled = !timed;
  }

  function openPanel(panelId) {
    showPage(panelId);
    closeAppMenu();
    document.getElementById(panelId).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showPage(panelId) {
    [elements.setupPanel, elements.historyPanel, elements.quizPanel, elements.resultPanel]
      .forEach((panel) => { panel.hidden = panel.id !== panelId; });
    document.body.classList.toggle('is-fixed-practice-page', panelId === 'quiz-panel' || panelId === 'result-panel');
  }

  function closeAppMenu() {
    elements.appMenu.hidden = true;
    elements.menuButton.setAttribute('aria-expanded', 'false');
  }

  function showQuestionView() {
    const panelId = session ? 'quiz-panel' : 'result-panel';
    showPage(panelId);
    closeAppMenu();
    const activeView = document.getElementById(panelId);
    activeView.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function setTheme(theme, save = true) {
    if (!['system', 'light', 'dark'].includes(theme)) theme = 'system';
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.dataset.theme = theme;
    elements.themeChoices.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
    });
    const systemDark = theme === 'system' && systemColorScheme.matches;
    elements.themeMeta.content = theme === 'dark' || systemDark ? '#111111' : '#A0D8F3';
    if (save) {
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch (error) {
        console.error('Unable to save the selected color theme.', error);
      }
    }
  }

  function returnToDefault() {
    if (session && session.mode === 'continuous') {
      showQuestionView();
      return;
    }
    const newestYear = [...new Set(questions.map((question) => question.year))].sort((a, b) => a - b).pop();
    elements.yearSelect.value = String(newestYear);
    updateChapterOptions();
    elements.chapterSelect.value = 'all';
    elements.weekSelect.value = '';
    elements.includePrior.checked = false;
    document.querySelectorAll('input[name="type"]').forEach((input) => { input.checked = true; });
    document.querySelector('input[name="mode"][value="count"]').checked = true;
    setMode('count');
    elements.countInput.value = '10';
    updateAvailableQuestions();
    startSession(null, true);
  }

  function restartSession() {
    if (!lastSessionConfig || lastSessionConfig.mode === 'continuous') {
      openPanel('setup-panel');
      return;
    }
    const config = lastSessionConfig;
    elements.yearSelect.value = config.year;
    updateChapterOptions();
    elements.chapterSelect.value = config.chapter;
    elements.weekSelect.value = config.week;
    elements.includePrior.checked = config.includePrior;
    document.querySelectorAll('input[name="type"]').forEach((input) => {
      input.checked = config.types.includes(input.value);
    });
    document.querySelector(`input[name="mode"][value="${config.mode}"]`).checked = true;
    if (config.mode === 'count') elements.countInput.value = String(config.goal);
    if (config.mode === 'timed') elements.durationInput.value = String(config.goal);
    setMode(config.mode);
    updateAvailableQuestions();
    startSession(null);
  }

  function parseQuestionFile(text, source, year) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
    const records = [];
    let book = '';
    let chapter = null;
    let verse = null;
    let pending = null;
    const fail = (lineNumber, message) => {
      throw new Error(`${source}:${lineNumber}: ${message}`);
    };

    lines.forEach((rawLine, index) => {
      const lineNumber = index + 1;
      const line = rawLine.trim();
      if (!line) return;

      const chapterMatch = line.match(/^Chapter\s+(\d+)$/i);
      if (chapterMatch) {
        if (pending) fail(lineNumber, 'question is missing its A. answer line');
        const bookLine = lines.slice(0, index).reverse()
          .map((candidate) => candidate.trim())
          .find((candidate) => candidate && !/^MANUAL REVIEW:/i.test(candidate));
        if (!bookLine) fail(lineNumber, 'could not find the book name before the chapter heading');
        book = bookLine;
        chapter = Number(chapterMatch[1]);
        verse = null;
        return;
      }

      const verseMatch = line.match(/^(\d+):(\d+)$/);
      if (verseMatch) {
        if (pending) fail(lineNumber, 'question is missing its A. answer line');
        if (chapter === null) fail(lineNumber, 'verse appears before a Chapter heading');
        if (Number(verseMatch[1]) !== chapter) {
          fail(lineNumber, `verse chapter ${verseMatch[1]} does not match Chapter ${chapter}`);
        }
        verse = Number(verseMatch[2]);
        return;
      }

      const questionMatch = line.match(/^(Q|FQ|SitQ)\.\s*(.+)$/);
      if (questionMatch) {
        if (pending) fail(lineNumber, 'question is missing its A. answer line');
        if (!book || chapter === null || verse === null) {
          fail(lineNumber, 'question appears before its book, chapter, or verse heading');
        }
        pending = {
          year,
          book,
          chapter,
          verse,
          type: { Q: 'regular', FQ: 'footnote', SitQ: 'situation' }[questionMatch[1]],
          question: questionMatch[2].trim(),
          lineNumber,
        };
        return;
      }

      const answerMatch = line.match(/^A\.\s*(.*)$/);
      if (answerMatch) {
        if (!pending) fail(lineNumber, 'answer appears without a preceding Q., FQ., or SitQ. line');
        const record = { ...pending, answer: answerMatch[1].trim() };
        delete record.lineNumber;
        records.push(record);
        pending = null;
        return;
      }

      if (pending) {
        pending.question += ` ${line}`;
        return;
      }
      if (verse !== null) fail(lineNumber, 'unrecognized content inside the question list');
    });

    if (pending) fail(pending.lineNumber, 'question is missing its A. answer line');
    if (!records.length) throw new Error(`${source}: no question-and-answer pairs were found`);
    return records;
  }

  async function loadQuestions() {
    try {
      const manifestResponse = await fetch('./question-files.json');
      if (!manifestResponse.ok) {
        throw new Error(`Question file list request failed with status ${manifestResponse.status}`);
      }
      const manifest = await manifestResponse.json();
      if (!manifest || !Array.isArray(manifest.files) || manifest.files.length === 0) {
        throw new Error('Question file list is empty or invalid');
      }

      const filePaths = new Set();
      const questionSets = await Promise.all(manifest.files.map(async (file) => {
        if (!file || typeof file.path !== 'string'
          || !file.path.startsWith('questions/')
          || file.path.split('/').includes('..')
          || !file.path.toLowerCase().endsWith('.txt')
          || !Number.isInteger(file.year)
          || file.year < 1) {
          throw new Error('Question file list contains an invalid .txt file entry');
        }
        if (filePaths.has(file.path)) throw new Error(`Question file list contains duplicate path ${file.path}`);
        filePaths.add(file.path);
        const response = await fetch(`./${file.path}`);
        if (!response.ok) throw new Error(`${file.path} request failed with status ${response.status}`);
        return parseQuestionFile(await response.text(), file.path, file.year);
      }));
      questions = questionSets.flat();
      if (!questions.length) throw new Error('No questions were found in the registered .txt files');
      populateYears();
      updateChapterOptions();
      renderHistory();
      startSession(null, true);
    } catch (error) {
      console.error('Unable to load quiz questions.', error);
      elements.setupPanel.hidden = false;
      elements.formMessage.textContent = 'The question set could not be loaded. Please reload this page while online.';
      elements.setupForm.querySelector('button[type="submit"]').disabled = true;
    }
  }

  elements.setupForm.addEventListener('submit', startSession);
  elements.yearSelect.addEventListener('change', updateChapterOptions);
  elements.chapterSelect.addEventListener('change', updateAvailableQuestions);
  elements.weekSelect.addEventListener('change', updateAvailableQuestions);
  elements.includePrior.addEventListener('change', updateAvailableQuestions);
  document.querySelectorAll('input[name="type"]').forEach((input) => input.addEventListener('change', updateAvailableQuestions));
  document.querySelectorAll('input[name="mode"]').forEach((input) => input.addEventListener('change', () => setMode(input.value)));
  elements.revealButton.addEventListener('click', revealAnswer);
  elements.nextButton.addEventListener('click', () => showNextQuestion(true));
  document.getElementById('restart-button').addEventListener('click', restartSession);
  document.getElementById('again-button').addEventListener('click', () => {
    elements.resultPanel.hidden = true;
    openPanel('setup-panel');
  });
  elements.menuButton.addEventListener('click', () => {
    const expanded = elements.menuButton.getAttribute('aria-expanded') === 'true';
    elements.menuButton.setAttribute('aria-expanded', String(!expanded));
    elements.appMenu.hidden = expanded;
  });
  elements.appMenu.querySelectorAll('[data-panel]').forEach((button) => {
    button.addEventListener('click', () => {
      if (document.getElementById(button.dataset.panel).hidden) openPanel(button.dataset.panel);
      else showQuestionView();
    });
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.menu-wrap')) closeAppMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !elements.appMenu.hidden) {
      closeAppMenu();
      elements.menuButton.focus();
      return;
    }
    if (event.code !== 'Space' || event.repeat || elements.quizPanel.hidden || !elements.appMenu.hidden) return;
    const target = event.target;
    if (target instanceof Element && target.closest('button, a, input, select, textarea, [contenteditable="true"]')) return;
    const primaryButton = elements.answerArea.hidden ? elements.revealButton : elements.nextButton;
    if (primaryButton.hidden) return;
    event.preventDefault();
    primaryButton.click();
  });
  elements.brandHome.addEventListener('click', (event) => {
    event.preventDefault();
    returnToDefault();
  });
  elements.themeChoices.forEach((button) => {
    button.addEventListener('click', () => setTheme(button.dataset.themeChoice));
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    elements.installButton.hidden = false;
  });
  elements.installButton.addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    elements.installButton.hidden = true;
  });

  let savedTheme = 'system';
  const systemColorScheme = window.matchMedia('(prefers-color-scheme: dark)');
  const standaloneDisplay = window.matchMedia('(display-mode: standalone)');
  if (standaloneDisplay.matches || window.navigator.standalone === true) {
    document.body.classList.add('is-installed-pwa');
  }
  try {
    savedTheme = localStorage.getItem(THEME_KEY) || 'system';
  } catch (error) {
    console.error('Unable to read the saved color theme.', error);
  }
  setTheme(savedTheme, false);
  const updateSystemTheme = () => {
    if (document.documentElement.dataset.theme === undefined) setTheme('system', false);
  };
  if (systemColorScheme.addEventListener) systemColorScheme.addEventListener('change', updateSystemTheme);
  else systemColorScheme.addListener(updateSystemTheme);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch((error) => {
        console.error('Service worker registration failed.', error);
      });
    });
  }

  migrateLegacyStorage();
  loadQuestions();
})();

/* Spelling, grammar and punctuation checking for every tool that puts free
   text on a graphic. One implementation, no DOM, no framework.

   The design is deliberately cautious: it flags only what it can be close to
   certain about. These are display graphics -- headlines are fragments by
   design, eyebrows are shouted in caps, and copy is often conversational --
   so a checker that nags at correct editorial writing is worse than no
   checker at all. Rules that cannot be made precise without a parser are
   left out rather than faked; see the README for the list.

   Exposed as window.proofreader. */
(function (global) {
  'use strict';

  const BASE = (function () {
    // Resolve the dictionary against THIS script, so every tool folder depth
    // works without each page knowing where assets live.
    const s = document.currentScript;
    const src = s && s.src ? s.src : '';
    return src ? src.replace(/\/[^/]*$/, '/dictionary/') : 'assets/dictionary/';
  })();

  const STORE = 'today-toolbox.dictionary.v1';

  /* ---------- state ---------- */

  let words = null;          // Set of known forms, lower case
  let wordsCased = null;     // Set of forms that carry a capital in the source
  let rank = null;           // Map word -> frequency rank (0 = commonest)
  const terms = new Set();   // shipped TODAY terms, lower case
  const personal = new Set();// this browser's additions, lower case
  let loading = null;
  let loadFailed = false;

  /* ---------- the personal dictionary ---------- */

  function readStore() {
    try {
      const raw = localStorage.getItem(STORE);
      if (!raw) return;
      const list = JSON.parse(raw);
      if (Array.isArray(list)) list.forEach((w) => personal.add(String(w).toLowerCase()));
    } catch (err) { /* a blocked or corrupt store simply means no additions */ }
  }

  function writeStore() {
    try { localStorage.setItem(STORE, JSON.stringify([...personal])); } catch (err) { /* noop */ }
  }

  readStore();

  /* ---------- loading ---------- */

  // The word list is front-coded: the first character of each line says how
  // many characters it shares with the line before, the rest is the
  // remainder. It halves the file, and this is the whole decoder.
  function decodeWords(text) {
    const out = new Set(), cased = new Set();
    let prev = '';
    for (const line of text.split('\n')) {
      if (!line) continue;
      const w = prev.slice(0, line.charCodeAt(0) - 48) + line.slice(1);
      prev = w;
      out.add(w.toLowerCase());
      if (w !== w.toLowerCase()) cased.add(w.toLowerCase());
    }
    return { out, cased };
  }

  function parseTerms(text) {
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      terms.add(t.toLowerCase());
    }
  }

  // Idempotent. Spelling is unavailable until this resolves; the grammar and
  // punctuation rules need no dictionary and run from the first keystroke.
  function load() {
    if (loading) return loading;
    const get = (f) => fetch(BASE + f).then((r) => {
      if (!r.ok) throw new Error(f + ' ' + r.status);
      return r.text();
    });
    loading = Promise.all([get('en-words.txt'), get('en-freq.txt'), get('today-terms.txt')])
      .then(([w, f, t]) => {
        const d = decodeWords(w);
        words = d.out; wordsCased = d.cased;
        rank = new Map();
        f.split('\n').forEach((line, i) => { const x = line.trim(); if (x) rank.set(x, i); });
        parseTerms(t);
        return true;
      })
      .catch((err) => {
        // Spelling stands down; everything else keeps working.
        loadFailed = true;
        words = null;
        if (global.console) console.warn('proofreader: dictionary unavailable —', err.message);
        return false;
      });
    return loading;
  }

  const ready = () => !!words;

  /* ---------- what counts as a word ---------- */

  const APOS = '’';

  // Tokens that are never spell-checked: they are not English words and
  // flagging them would be noise on every card.
  function skipToken(raw) {
    if (!raw) return true;
    if (/\d/.test(raw)) return true;                       // 5K, 2026, 9a
    if (/^[A-Z]{1,5}$/.test(raw)) return true;             // NFL, IYKYK, MRI
    if (/^[@#]/.test(raw)) return true;                    // @handle, #hashtag
    if (/^(https?:|www\.)/i.test(raw)) return true;
    if (/\S+@\S+\.\S+/.test(raw)) return true;             // an email
    if (raw.length < 2) return true;
    return false;
  }

  function inDictionary(w) {
    const lower = w.toLowerCase();
    if (terms.has(lower) || personal.has(lower)) return true;
    if (!words) return true;                               // no list, no verdict
    if (words.has(lower)) return true;
    // Possessive and contracted forms built on a known stem.
    const m = lower.match(new RegExp('^(.+?)(?:[' + APOS + "'](?:s|re|ve|ll|d|m)|s[" + APOS + "'])$"));
    if (m && words.has(m[1])) return true;
    // A hyphenated compound is fine when every part is.
    if (lower.includes('-')) {
      const parts = lower.split('-').filter(Boolean);
      if (parts.length > 1 && parts.every((p) => p.length < 2 || words.has(p) || terms.has(p) || personal.has(p))) return true;
    }
    return false;
  }

  /* ---------- spelling suggestions ---------- */

  // Real misspelling pairs out of the SCOWL affix file's REP table, which is
  // exactly "what people actually type instead". A hit here outranks
  // everything else.
  const REP = [['a','ei'],['ei','a'],['a','ey'],['ey','a'],['ai','ie'],['ie','ai'],['alot','a lot'],
    ['are','air'],['are','ear'],['are','eir'],['air','are'],['ear','are'],['eir','are'],['ch','k'],
    ['k','ch'],['ch','tch'],['tch','ch'],['ck','k'],['k','ck'],['cc','ct'],['ct','cc'],['e','ee'],
    ['ee','e'],['ea','ee'],['ee','ea'],['ea','e'],['e','ea'],['f','ph'],['ph','f'],['ff','ph'],
    ['ph','ff'],['gh','f'],['f','gh'],['i','igh'],['igh','i'],['i','ee'],['ee','i'],['ie','ee'],
    ['ee','ie'],['ier','ear'],['ear','ier'],['j','g'],['g','j'],['ck','ke'],['le','el'],['el','le'],
    ['ance','ence'],['ence','ance'],['ant','ent'],['ent','ant'],['o','oh'],['oh','o'],['o','ou'],
    ['ou','o'],['oo','ou'],['ou','oo'],['ough','o'],['ow','ou'],['ou','ow'],['ngth','nth'],
    ['s','c'],['c','s'],['s','ss'],['ss','s'],['shun','tion'],['tion','shun'],['sion','tion'],
    ['tion','sion'],['su','ssu'],['ssu','su'],['ti','ci'],['ci','ti'],['u','oo'],['oo','u'],
    ['u','you'],['you','u'],['x','cks'],['cks','x'],['z','s'],['s','z'],['able','ible'],
    ['ible','able'],['ary','ery'],['ery','ary'],['ally','ly'],['ly','ally'],['ize','ise'],
    ['ise','ize'],['yze','yse'],['ical','icle']];

  // Letters in rough English frequency order, from the affix file's TRY line:
  // trying the common ones first puts better candidates in front.
  const ALPHA = "esianrtolcdugmphbyfvkwzxqj'" + APOS;

  // Penalty by kind of slip, because they are not equally likely. Leaving a
  // letter out is much the commonest, so a candidate that simply restores one
  // outranks a candidate that needs a letter changed -- which is what puts
  // "which" above "with" for "wich", where raw frequency alone would not.
  const COST = { insert: 0, transpose: 300, replace: 800, remove: 1200 };

  function edits1(w) {
    const out = new Map();   // candidate -> cheapest edit kind
    const put = (c, kind) => {
      if (c === w) return;
      if (!out.has(c) || COST[out.get(c)] > COST[kind]) out.set(c, kind);
    };
    for (let i = 0; i <= w.length; i++) {
      if (i < w.length) {
        put(w.slice(0, i) + w.slice(i + 1), 'remove');                          // one too many
        if (i < w.length - 1) {
          put(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2), 'transpose');
        }
        for (const c of ALPHA) put(w.slice(0, i) + c + w.slice(i + 1), 'replace');
      }
      for (const c of ALPHA) put(w.slice(0, i) + c + w.slice(i), 'insert');     // one left out
    }
    return out;
  }

  // Candidate generation is the expensive half, so it runs only when a popup
  // opens -- never on the typing path, which is a Set lookup per word.
  function suggest(word, limit) {
    const max = limit || 5;
    if (!words) return [];
    const w = word.toLowerCase();
    if (!w) return [];

    // Lower is better. Frequency leads -- the word a writer meant is usually
    // the commoner one -- and the edit cost moves it from there. A rank of
    // 60000 stands for "outside the top 20k".
    const scored = new Map();
    const add = (cand, penalty) => {
      if (cand === w || !words.has(cand)) return;
      const score = (rank.has(cand) ? rank.get(cand) : 60000) + penalty;
      if (!scored.has(cand) || scored.get(cand) > score) scored.set(cand, score);
    };

    // 1. One edit away, priced by the kind of slip.
    const e1 = edits1(w);
    for (const [cand, kind] of e1) add(cand, COST[kind]);

    // 2. The affix file's REP table: real phonetic confusions ("ph" for "f",
    //    "c" for "s"). Priced as a CHEAPER SUBSTITUTION, never cheaper than a
    //    dropped letter. A flat discount let a substitution beat an omission
    //    and put "wish" ahead of "which" for "wich"; the frequency list comes
    //    from subtitles, so conversational words outrank formal ones and the
    //    edit cost has to be the thing that decides.
    for (const [from, to] of REP) {
      let i = w.indexOf(from);
      while (i !== -1) {
        add(w.slice(0, i) + to + w.slice(i + from.length), COST.replace - 300);
        i = w.indexOf(from, i + 1);
      }
    }

    // 3. Two edits away, only when nothing closer turned up: the expensive
    //    branch, and rarely needed.
    if (!scored.size) {
      for (const a of e1.keys()) {
        if (a.length < 3) continue;
        for (const [cand, kind] of edits1(a)) add(cand, 3000 + COST[kind]);
      }
    }

    const out = [...scored.entries()].sort((a, b) => a[1] - b[1]).slice(0, max).map((e) => e[0]);
    // Give back the writer's own capitalisation.
    const capped = /^[A-Z]/.test(word);
    const upper = word === word.toUpperCase() && word.length > 1;
    return out.map((c) => (upper ? c.toUpperCase() : capped ? c[0].toUpperCase() + c.slice(1) : c));
  }

  /* ---------- rules ---------- */

  // Each rule is { key, type, register, run(text, push) }. `display` rules run
  // everywhere; `prose` rules are skipped in headline-style fields, where a
  // fragment with no full stop is correct writing, not an error.
  // `prio` decides who wins when two rules mark overlapping text: lower wins.
  // A contraction missing its apostrophe is also an unknown word, and the
  // specific message with a one-click fix beats "not in the dictionary".
  const RULES = [];
  const rule = (key, type, register, run, prio) =>
    RULES.push({ key, type, register, run, prio: prio === undefined ? 0 : prio });

  const WORD_RE = new RegExp("[A-Za-z" + APOS + "'\\-]+", 'g');

  function tokens(text) {
    const out = [];
    let m;
    WORD_RE.lastIndex = 0;
    while ((m = WORD_RE.exec(text))) {
      let w = m[0], start = m.index;
      // Trim hyphens and apostrophes that are punctuation, not part of the word.
      while (w && /^[-'’]/.test(w)) { w = w.slice(1); start++; }
      while (w && /[-'’]$/.test(w)) w = w.slice(0, -1);
      if (w) out.push({ w, start, end: start + w.length });
    }
    return out;
  }

  /* -- spelling -- */
  rule('spelling', 'spelling', 'display', (text, push, ctx) => {
    if (!words) return;
    for (const t of ctx.tokens) {
      const raw = text.slice(t.start, t.end);
      if (skipToken(raw)) continue;
      if (inDictionary(raw)) continue;
      push({
        start: t.start, end: t.end, type: 'spelling', rule: 'spelling',
        message: '“' + raw + '” is not in the dictionary.',
        lazySuggest: true,
      });
    }
  }, 9);

  /* -- confusables -- */
  // Each entry only fires in a context where the call is safe to make.
  const CONFUSABLE = [
    [/\bits\s+(?=(?:going|gonna|been|a|the|not|just|time|too|so|really)\b)/gi, 'it’s',
      '“Its” is possessive. Before a verb you want “it’s” — it is.'],
    [/\bit’s\s+(?=own\b)/gi, 'its', '“It’s” means “it is”. The possessive is “its”, with no apostrophe.'],
    [/\byour\s+(?=(?:welcome|going|gonna|right|wrong|the|a)\b)/gi, 'you’re',
      '“Your” is possessive. You want “you’re” — you are.'],
    [/\byou’re\s+(?=(?:car|house|turn|book|phone|idea|name|job)\b)/gi, 'your',
      '“You’re” means “you are”. The possessive is “your”.'],
    [/\btheir\s+(?=(?:is|are|was|were)\b)/gi, 'there',
      '“Their” is possessive. For a statement of fact you want “there”.'],
    [/\bthere\s+(?=(?:own)\b)/gi, 'their', 'Possession takes “their”.'],
    [/\bthey’re\s+(?=(?:car|house|own|turn|book)\b)/gi, 'their',
      '“They’re” means “they are”. The possessive is “their”.'],
    [/\b(?:more|less|better|worse|bigger|smaller|faster|slower|older|younger|rather)\s+then\b/gi, null,
      'A comparison takes “than”, not “then”.', (m) => m.replace(/then$/i, 'than')],
    [/\bwho’s\s+(?=(?:car|house|turn|book|idea|name)\b)/gi, 'whose',
      '“Who’s” means “who is”. The possessive is “whose”.'],
    [/\bloose\s+(?=(?:the|a|his|her|their|my|your|it)\b)/gi, 'lose',
      '“Loose” is the opposite of tight. To mislay something is to “lose” it.'],
    [/\bto\s+(?=(?:much|many|late|early|big|small|hot|cold|good)\b)/gi, 'too',
      'Before an adjective of excess you want “too”.'],
    [/\ba\s+lot\b/gi, null, null],   // placeholder removed below
  ];
  CONFUSABLE.pop();

  rule('confusable', 'grammar', 'display', (text, push) => {
    for (const [re, fix, message, build] of CONFUSABLE) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) {
        const hit = m[0];
        // Mark the confused word itself, not the trailing context.
        const trimmed = hit.replace(/\s+$/, '');
        const replacement = build ? build(trimmed) : (fix + hit.slice(trimmed.length));
        push({
          start: m.index, end: m.index + trimmed.length,
          type: 'grammar', rule: 'confusable', message,
          replacement: build ? replacement : fix,
        });
        if (re.lastIndex === m.index) re.lastIndex++;
      }
    }
  });

  /* -- subject/verb agreement, closed-class pronouns only -- */
  const SING = /\b(he|she|it)\s+(are|were|have|do|go|say|know|think|want|need|make|take|come|see|get)\b/gi;
  const PLUR = /\b(they|we|you)\s+(is|was|has|does|goes|says|knows|thinks|wants|needs|makes|takes|comes|sees|gets)\b/gi;
  const FIX_SING = { are: 'is', were: 'was', have: 'has', do: 'does', go: 'goes', say: 'says',
    know: 'knows', think: 'thinks', want: 'wants', need: 'needs', make: 'makes', take: 'takes',
    come: 'comes', see: 'sees', get: 'gets' };
  const FIX_PLUR = { is: 'are', was: 'were', has: 'have', does: 'do', goes: 'go', says: 'say',
    knows: 'know', thinks: 'think', wants: 'want', needs: 'need', makes: 'make', takes: 'take',
    comes: 'come', sees: 'see', gets: 'get' };

  rule('agreement', 'grammar', 'display', (text, push) => {
    const scan = (re, table) => {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) {
        const verb = m[2];
        const fixed = table[verb.toLowerCase()];
        if (!fixed) continue;
        const at = m.index + m[0].toLowerCase().lastIndexOf(verb.toLowerCase());
        push({
          start: at, end: at + verb.length, type: 'grammar', rule: 'agreement',
          message: '“' + m[1] + ' ' + verb + '” does not agree. Try “' + m[1] + ' ' + fixed + '”.',
          replacement: /^[A-Z]/.test(verb) ? fixed[0].toUpperCase() + fixed.slice(1) : fixed,
        });
      }
    };
    scan(SING, FIX_SING);
    scan(PLUR, FIX_PLUR);
  });

  /* -- doubled words -- */
  rule('doubled', 'grammar', 'display', (text, push) => {
    const re = /\b([A-Za-z]+)(\s+)\1\b/gi;
    let m;
    while ((m = re.exec(text))) {
      // "had had" and "that that" are legitimate; so is a doubled single letter.
      if (/^(had|that|is|is|very|no|so)$/i.test(m[1])) continue;
      if (m[1].length < 2) continue;
      push({
        start: m.index, end: m.index + m[0].length, type: 'grammar', rule: 'doubled',
        message: '“' + m[1] + '” is repeated.',
        replacement: m[1],
      });
    }
  });

  /* -- a / an -- */
  const AN_EXCEPT = /^(hour|honest|honor|honour|heir|herb|x-ray|mri|nfl|nba|fbi|ms|hr)/i;
  const A_EXCEPT = /^(uni|use|usu|user|euro|one|once|ubiquit|utens|unit)/i;
  rule('article', 'grammar', 'display', (text, push) => {
    const re = /\b(a|an)\s+([A-Za-z][\w'’-]*)/gi;
    let m;
    while ((m = re.exec(text))) {
      const art = m[1], next = m[2];
      const vowel = /^[aeiou]/i.test(next);
      const wantAn = (vowel && !A_EXCEPT.test(next)) || AN_EXCEPT.test(next);
      const isAn = art.toLowerCase() === 'an';
      if (wantAn === isAn) continue;
      const fixed = wantAn ? 'an' : 'a';
      push({
        start: m.index, end: m.index + art.length, type: 'grammar', rule: 'article',
        message: 'Before “' + next + '” the article is “' + fixed + '”.',
        replacement: /^[A-Z]/.test(art) ? fixed[0].toUpperCase() + fixed.slice(1) : fixed,
      });
    }
  });

  /* -- missing apostrophe in common contractions -- */
  const CONTRACT = { dont: 'don', cant: 'can', wont: 'won', isnt: 'isn', arent: 'aren',
    wasnt: 'wasn', werent: 'weren', didnt: 'didn', doesnt: 'doesn', couldnt: 'couldn',
    shouldnt: 'shouldn', wouldnt: 'wouldn', hasnt: 'hasn', havent: 'haven', hadnt: 'hadn',
    thats: 'that', whats: 'what', lets: 'let', youre: 'you', theyre: 'they', weve: 'we',
    ive: 'I', im: 'I' };
  rule('apostrophe', 'punctuation', 'display', (text, push, ctx) => {
    for (const t of ctx.tokens) {
      const raw = text.slice(t.start, t.end);
      const stem = CONTRACT[raw.toLowerCase()];
      if (!stem) continue;
      const tail = raw.slice(stem.length);
      const fixed = raw.slice(0, stem.length) + APOS + tail;
      push({
        start: t.start, end: t.end, type: 'punctuation', rule: 'apostrophe',
        message: '“' + raw + '” is missing its apostrophe.',
        replacement: fixed,
      });
    }
  });

  /* -- spacing around punctuation -- */
  rule('space-before', 'punctuation', 'display', (text, push) => {
    const re = /\s+([,.;:!?])/g;
    let m;
    while ((m = re.exec(text))) {
      push({
        start: m.index, end: m.index + m[0].length, type: 'punctuation', rule: 'space-before',
        message: 'No space belongs before “' + m[1] + '”.',
        replacement: m[1],
      });
    }
  });

  rule('space-after', 'punctuation', 'display', (text, push) => {
    // A comma or semicolon run straight into the next word. Decimals, times
    // and ellipses are excluded by requiring a letter on the right.
    const re = /([,;])([A-Za-z])/g;
    let m;
    while ((m = re.exec(text))) {
      push({
        start: m.index, end: m.index + 2, type: 'punctuation', rule: 'space-after',
        message: 'A space belongs after “' + m[1] + '”.',
        replacement: m[1] + ' ' + m[2],
      });
    }
  });

  rule('doubled-punct', 'punctuation', 'display', (text, push) => {
    const re = /([,;:])\1+|(?:!{3,}|\?{3,})/g;
    let m;
    while ((m = re.exec(text))) {
      push({
        start: m.index, end: m.index + m[0].length, type: 'punctuation', rule: 'doubled-punct',
        message: 'Repeated punctuation.',
        replacement: m[0][0],
      });
    }
  });

  /* -- lone lowercase i -- */
  rule('lowercase-i', 'punctuation', 'display', (text, push) => {
    const re = /(^|[^\w'’])i(?=[^\w'’]|$)/g;
    let m;
    while ((m = re.exec(text))) {
      const at = m.index + m[1].length;
      push({
        start: at, end: at + 1, type: 'punctuation', rule: 'lowercase-i',
        message: 'The pronoun “I” is capitalised.', replacement: 'I',
      });
    }
  });

  /* -- balance -- */
  rule('balance', 'punctuation', 'display', (text, push) => {
    const pairs = [['(', ')', 'parenthesis'], ['[', ']', 'bracket']];
    for (const [open, close, name] of pairs) {
      let depth = 0, lastOpen = -1;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === open) { depth++; lastOpen = i; }
        else if (text[i] === close) {
          if (depth === 0) {
            push({ start: i, end: i + 1, type: 'punctuation', rule: 'balance',
              message: 'This closing ' + name + ' has no opening one.' });
          } else depth--;
        }
      }
      if (depth > 0 && lastOpen >= 0) {
        push({ start: lastOpen, end: lastOpen + 1, type: 'punctuation', rule: 'balance',
          message: 'This opening ' + name + ' is never closed.' });
      }
    }
    // Curly quotes come in pairs once smart punctuation has run.
    const opens = (text.match(/“/g) || []).length;
    const closes = (text.match(/”/g) || []).length;
    if (opens !== closes) {
      const at = text.lastIndexOf(opens > closes ? '“' : '”');
      if (at >= 0) {
        push({ start: at, end: at + 1, type: 'punctuation', rule: 'balance',
          message: 'Quotation marks are unbalanced.' });
      }
    }
  });

  /* -- American style: commas and periods sit inside the closing quote -- */
  rule('quote-punct', 'punctuation', 'display', (text, push) => {
    const re = /”\s*([,.])/g;
    let m;
    while ((m = re.exec(text))) {
      push({
        start: m.index, end: m.index + m[0].length, type: 'punctuation', rule: 'quote-punct',
        message: 'In American style the ' + (m[1] === ',' ? 'comma' : 'period') + ' goes inside the closing quotation mark.',
        replacement: m[1] + '”',
      });
    }
  });

  /* -- sentence-level rules: prose fields only -- */
  rule('sentence-case', 'punctuation', 'prose', (text, push) => {
    const re = /(^|[.!?]\s+)([a-z])/g;
    let m;
    while ((m = re.exec(text))) {
      const at = m.index + m[1].length;
      push({
        start: at, end: at + 1, type: 'punctuation', rule: 'sentence-case',
        message: 'A sentence starts with a capital letter.',
        replacement: m[2].toUpperCase(),
      });
    }
  });

  rule('terminal', 'punctuation', 'prose', (text, push) => {
    const t = text.replace(/\s+$/, '');
    if (!t) return;
    if (/[.!?…”)]$/.test(t)) return;
    if (t.split(/\s+/).length < 4) return;        // a short label is not a sentence
    // Only when the copy punctuates sentences elsewhere. A dek that never
    // uses a full stop has made a style choice, and in display copy that is a
    // normal one -- flagging it would nag at our own placeholder on load.
    if (!/[.!?][^.!?]*\S/.test(t)) return;
    push({
      start: t.length - 1, end: t.length, type: 'punctuation', rule: 'terminal',
      message: 'This sentence has no end punctuation.',
      replacement: t[t.length - 1] + '.',
    });
  });

  rule('comma-splice', 'grammar', 'prose', (text, push) => {
    // Narrow on purpose: both halves must begin with a pronoun followed by a
    // finite verb, which is the one shape that is reliably a splice.
    const re = /,\s+(I|he|she|it|we|they|you)\s+(is|are|was|were|has|have|will|can|did|does|do)\b/g;
    let m;
    while ((m = re.exec(text))) {
      push({
        start: m.index, end: m.index + 1, type: 'grammar', rule: 'comma-splice',
        message: 'Two complete sentences joined by a comma. Use a semicolon or a full stop.',
        replacement: ';',
      });
    }
  });

  /* ---------- the check ---------- */

  const ignored = new Set();

  function check(text, opts) {
    const o = opts || {};
    const register = o.register === 'prose' ? 'prose' : 'display';
    if (typeof text !== 'string' || !text.trim()) return [];
    const ctx = { tokens: tokens(text) };
    const found = [];
    let prio = 0;
    const push = (issue) => {
      if (issue.start >= issue.end) return;
      issue.prio = prio;
      found.push(issue);
    };
    for (const r of RULES) {
      if (r.register === 'prose' && register !== 'prose') continue;
      if (ignored.has(r.key)) continue;
      prio = r.prio;
      try { r.run(text, push, ctx); } catch (err) { /* one bad rule must not stop the rest */ }
    }
    // Earliest first; where two marks overlap the more specific rule wins.
    found.sort((a, b) => a.start - b.start || a.prio - b.prio || a.end - b.end);
    const out = [];
    for (const f of found) {
      const clash = out.some((g) => f.start < g.end && g.start < f.end);
      if (!clash) out.push(f);
    }
    for (const f of out) f.text = text.slice(f.start, f.end);
    return out;
  }

  /* ---------- api ---------- */

  const proofreader = {
    load, ready,
    failed: () => loadFailed,
    check,
    suggest,
    addTerm: (w) => { personal.add(String(w).toLowerCase()); writeStore(); },
    removeTerm: (w) => { personal.delete(String(w).toLowerCase()); writeStore(); },
    personal: () => [...personal],
    ignoreRule: (key) => ignored.add(key),
    unignoreRule: (key) => ignored.delete(key),
    isWord: (w) => inDictionary(w),
    rules: () => RULES.map((r) => ({ key: r.key, type: r.type, register: r.register })),
    size: () => (words ? words.size : 0),
  };

  global.proofreader = proofreader;
})(window);

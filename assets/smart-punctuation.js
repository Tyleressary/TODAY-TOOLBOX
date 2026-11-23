/* Shared editorial punctuation for every tool that puts free text on a
   graphic. One implementation, because three copies would drift.

   Straight quotation marks and apostrophes must never reach a finished
   graphic; dashes and ellipses must use the real characters. Wording,
   spelling and meaning are never touched -- only punctuation characters.

   Exposed as window.smartPunctuation(text). */
(function (global) {
  'use strict';

  // Words that open with an elided letter, where the leading mark is a
  // closing-form apostrophe rather than an opening single quote.
  const ELISIONS = [
    'n', 'tis', 'twas', 'em', 'cause', 'round', 'til', 'till', 'bout',
    'nother', 'gainst', 'neath', 'ere', 'twere',
  ];

  const DAYS = 'Mon|Monday|Tue|Tues|Tuesday|Wed|Wednesday|Thu|Thur|Thurs|Thursday'
             + '|Fri|Friday|Sat|Saturday|Sun|Sunday';
  const MONTHS = 'Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June'
               + '|Jul|July|Aug|August|Sep|Sept|September|Oct|October'
               + '|Nov|November|Dec|December';

  const isAlnum = (ch) => !!ch && /[0-9A-Za-zÀ-ɏ]/.test(ch);

  function smartQuotes(s) {
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch !== '"' && ch !== "'") { out += ch; continue; }
      const prev = i > 0 ? s[i - 1] : '';
      const next = i + 1 < s.length ? s[i + 1] : '';

      if (ch === '"') {
        // Opens at the start, after whitespace, or after an opening bracket
        // or a dash; closes everywhere else.
        const opening = !prev || /\s/.test(prev) || /[([{—–‘“]/.test(prev);
        out += opening ? '“' : '”';
        continue;
      }

      // Single quote.
      if (isAlnum(prev)) {
        // it's, dogs' -- an apostrophe either way.
        out += '’';
        continue;
      }
      // Start of a word.
      if (/[0-9]/.test(next)) {
        out += '’';          // '90s
        continue;
      }
      const rest = s.slice(i + 1).toLowerCase();
      const elided = ELISIONS.some((w) => {
        if (!rest.startsWith(w)) return false;
        const after = rest[w.length];
        return after === undefined || !isAlnum(after);
      });
      out += elided ? '’' : '‘';
    }
    return out;
  }

  function smartPunctuation(text) {
    if (typeof text !== 'string' || !text) return text;
    let s = text;

    // 1. Ellipsis, before anything else touches runs of periods.
    s = s.replace(/\.{3,}/g, '…');

    // 2. En dash for ranges ONLY. This must run before the spaced-hyphen em
    //    dash below, or "9 a.m. - 5 p.m." becomes an em dash before the
    //    range rule ever sees it.
    s = s.replace(/(\d)\s*-\s*(?=\d)/g, '$1–');
    s = s.replace(
      new RegExp('\\b(' + DAYS + ')\\s*-\\s*(?=(?:' + DAYS + ')\\b)', 'g'),
      '$1–');
    s = s.replace(
      new RegExp('\\b(' + MONTHS + ')\\s*-\\s*(?=(?:' + MONTHS + ')\\b)', 'g'),
      '$1–');
    s = s.replace(/([ap]\.m\.)\s*-\s*/gi, '$1–');

    // 3. Em dash. A doubled hyphen, then a hyphen standing alone between
    //    words -- American style sets it closed up, so the spaces go.
    s = s.replace(/-{2,}/g, '—');
    s = s.replace(/(\S) +- +(?=\S)/g, '$1—');
    //    " -- " leaves its spaces behind, and the standard sets em dashes
    //    closed up, so take them off. Literal spaces only: a newline is a
    //    line break the caller depends on.
    s = s.replace(/ *— */g, '—');

    // 4. Quotation marks and apostrophes.
    s = smartQuotes(s);

    return s;
  }

  // What a final proofread looks for: anything the standard forbids.
  smartPunctuation.findStraight = function (text) {
    const found = [];
    if (typeof text !== 'string') return found;
    if (/"/.test(text)) found.push('straight double quote');
    if (/'/.test(text)) found.push('straight apostrophe');
    if (/\.{3,}/.test(text)) found.push('three periods');
    if (/-{2,}/.test(text)) found.push('double hyphen');
    if (/(\S) +- +(?=\S)/.test(text)) found.push('spaced hyphen');
    return found;
  };

  global.smartPunctuation = smartPunctuation;
})(window);

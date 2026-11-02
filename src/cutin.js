// Telling the owner's voice from the agent's own. While the agent speaks, the
// microphone hears it too, and recognition writes those words down, often
// with a slip or two ("noon" heard as "new"). Words the agent said (or nearly
// said) and filler are the echo. The owner is talking over it when a plain
// cue to stop is the newest word, when three of their own words come in a row,
// or when four of the last six are theirs. Slips come one or two at a time,
// so they are neither; nor is a lone "okay", which is listening, not
// interrupting.
const FILLER = new Set(["a", "an", "the", "and", "or", "to", "of", "in", "on", "at", "it", "is",
  "i", "you", "uh", "um", "oh", "ah", "so", "that", "this", "yeah", "mm", "hmm"]);
const CUES = new Set(["stop", "wait", "hold", "pause", "hang", "sorry", "no", "hey", "excuse",
  "actually", "quiet", "enough"]);

export const norm = (w) => w.toLowerCase().replace(/[^a-z0-9']/g, "");

// at most one slip for a short word, two for a long one
function near(a, b) {
  if (Math.abs(a.length - b.length) > 2) return false;
  const limit = Math.max(a.length, b.length) <= 5 ? 1 : 2;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, row[j]);
    }
    if (best > limit) return false;
    prev = row;
  }
  return prev[b.length] <= limit;
}

function echoOf(word, said) {
  if (said.has(word)) return true;
  if (word.length < 3) return false;
  for (const s of said) {
    if (s.length < 3) continue;
    // the same start is the same word misheard ("past" for "passed")
    if (word.length >= 4 && s.length >= 4 && word.slice(0, 3) === s.slice(0, 3)) return true;
    if (near(word, s)) return true;
  }
  return false;
}

// where in these (normalised) words the owner started talking over the agent, or -1
export function cutInAt(words, said) {
  // [index in words, is it the owner's?] for the newest words that are not
  // filler: what was misheard a minute ago has no say in what happens now
  const content = [];
  words.forEach((w, i) => { if (w && !FILLER.has(w)) content.push([i, !echoOf(w, said)]); });
  content.splice(0, Math.max(0, content.length - 8));
  const runStart = (k) => {
    while (k > 0 && content[k - 1][1]) k -= 1;
    return content[k][0];
  };
  const last = content.length - 1;
  if (last >= 0 && content[last][1] && CUES.has(words[content[last][0]])) return runStart(last);
  for (let k = 2; k < content.length; k++) {
    if (content[k][1] && content[k - 1][1] && content[k - 2][1]) return runStart(k);
  }
  const theirs = content.slice(-6).filter(([, own]) => own);
  return theirs.length >= 4 ? theirs[0][0] : -1;
}

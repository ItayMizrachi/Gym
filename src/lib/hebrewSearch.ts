/*
 * Hebrew in the exercise search: "לחיצת חזה" finds Bench Press, "סקוואט מוט" finds Barbell Squat.
 * Gym Hebrew is turned into the English words the library uses; phrases first (longest wins), then single words.
 * Anything not known stays as typed, so mixed queries ("לחיצת חזה incline") still work.
 */

const PHRASES: [string, string][] = [
  ['לחיצת חזה בשיפוע', 'incline press'],
  ['לחיצת חזה', 'bench press'],
  ['לחיצת כתפיים', 'shoulder press'],
  ['לחיצת רגליים', 'leg press'],
  ['כפיפת מרפקים', 'curl'],
  ['כפיפת מרפק', 'curl'],
  ['פשיטת מרפקים', 'triceps'],
  ['פשיטת מרפק', 'triceps'],
  ['פשיטת ברכיים', 'leg extension'],
  ['פשיטת ברך', 'leg extension'],
  ['כפיפת ברכיים', 'leg curl'],
  ['כפיפת ברך', 'leg curl'],
  ['הרחקת כתפיים', 'lateral raise'],
  ['הרחקה לצדדים', 'lateral raise'],
  ['פולי עליון', 'pulldown'],
  ['פולי תחתון', 'cable row'],
  ['דדליפט רומני', 'romanian deadlift'],
  ['היפ טראסט', 'hip thrust'],
  ['כפיפות בטן', 'crunch'],
  ['הרמות רגליים', 'leg raise'],
  ['גוד מורנינג', 'good morning'],
  ['פרפר הפוך', 'rear delt'],
  ['מקבילים', 'dips'],
  ['פיסוק בולגרי', 'split squat'],
  ['סקוואט בולגרי', 'split squat'],
  ['רגל אחת', 'single']
]

const WORDS: Record<string, string> = {
  סקוואט: 'squat',
  דדליפט: 'deadlift',
  מתח: 'pull up',
  חתירה: 'row',
  חתירות: 'row',
  לחיצה: 'press',
  לחיצת: 'press',
  פרפר: 'fly',
  תאומים: 'calf',
  לאנג: 'lunge',
  'לאנג׳': 'lunge',
  לאנגים: 'lunge',
  מכרעים: 'lunge',
  פלאנק: 'plank',
  שכיבות: 'push up',
  שכיבת: 'push up',
  שראגס: 'shrug',
  הרחקה: 'raise',
  הרמה: 'raise',
  הרמת: 'raise',
  כפיפה: 'curl',
  פשיטה: 'extension',
  // muscles
  חזה: 'chest',
  גב: 'back',
  כתפיים: 'shoulders',
  כתף: 'shoulders',
  'יד קדמית': 'biceps',
  ביספס: 'biceps',
  טריספס: 'triceps',
  רגליים: 'legs',
  ישבן: 'glutes',
  בטן: 'abs',
  אמות: 'forearms',
  // equipment
  מוט: 'barbell',
  משקולות: 'dumbbell',
  משקולת: 'dumbbell',
  מכונה: 'machine',
  מכשיר: 'machine',
  כבל: 'cable',
  כבלים: 'cable',
  פולי: 'cable',
  סמית: 'smith',
  'סמית׳': 'smith',
  קטלבל: 'kettlebell',
  גומייה: 'band',
  גומיה: 'band',
  'משקל גוף': 'bodyweight',
  // sides
  עליון: 'upper',
  תחתון: 'lower',
  שיפוע: 'incline',
  'שיפוע שלילי': 'decline',
  ישיבה: 'seated',
  שכיבה: 'lying',
  עמידה: 'standing'
}

const HEBREW = /[֐-׿]/

/** a query with Hebrew in it, in the library's English words; other queries come back unchanged */
export function englishQuery(q: string): string {
  if (!HEBREW.test(q)) return q
  let s = ' ' + q.trim().replace(/\s+/g, ' ') + ' '
  for (const [he, en] of [...PHRASES, ...Object.entries(WORDS).filter(([k]) => k.includes(' '))].sort((a, b) => b[0].length - a[0].length)) {
    s = s.split(' ' + he + ' ').join(' ' + en + ' ')
  }
  return s
    .trim()
    .split(' ')
    .map((w) => WORDS[w] ?? WORDS[w.replace(/^[והבלמש]/, '')] ?? w)
    .join(' ')
}

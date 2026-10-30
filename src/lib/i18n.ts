/*
 * Language: English (default) or Hebrew, right to left. Chosen in Settings, kept on this device.
 * Strings are written in English in the code and wrapped in t(): t('Up next'). Hebrew comes from the HE table
 * below; anything missing there stays English, so screens can be translated a few at a time.
 * Placeholders: t('{n} sets', { n: 3 }).
 */

export type Lang = 'en' | 'he'
const KEY = 'gymlog:lang'

function read(): Lang {
  try {
    return localStorage.getItem(KEY) === 'he' ? 'he' : 'en'
  } catch {
    return 'en'
  }
}

// read() guards every access: in some runtimes (tests) even touching localStorage throws
export const lang: Lang = read()

/** switch language: saved, then the app reloads so every screen picks it up */
export function setLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l)
  } catch {
    /* ignore */
  }
  location.reload()
}

/** set <html lang dir> once at start-up */
export function applyLang() {
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr'
}

export function t(s: string, vars?: Record<string, string | number>): string {
  let out = lang === 'he' ? HE[s] ?? s : s
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v))
  return out
}

/** plural: t2(n, '{n} set', '{n} sets') */
export const t2 = (n: number, one: string, many: string) => t(n === 1 ? one : many, { n })

const HE: Record<string, string> = {
  "Late session?": "אימון מאוחר?",
  "{a} of {b} sets": "{a} מתוך {b} סטים",
  "Pick a program to begin": "בחר תוכנית כדי להתחיל",
  "Choose a ready-made plan, start it, and tick each set as you go. Weights fill in from last time.": "בחר תוכנית מוכנה, התחל, וסמן כל סט תוך כדי. המשקלים מתמלאים מהפעם הקודמת.",
  "Load my starter plan (4 days)": "טען תוכנית התחלה (4 ימים)",
  "Build your own": "בנה בעצמך",
  "Empty workout": "אימון ריק",
  "exercises": "תרגילים",
  "sets": "סטים",
  "about": "בערך",
  "new": "חדש",
  "Started at {time}": "התחיל ב-{time}",
  "Started {date}": "התחיל {date}",
  "today": "היום",
  "yesterday": "אתמול",
  "{n} days ago": "לפני {n} ימים",
  "{n} weeks ago": "לפני {n} שבועות",
  "English": "English",
  "Hebrew": "עברית",
  "Some screens are still in English.": "חלק מהמסכים עדיין באנגלית.",
  "Units & plates": "יחידות ופלטות",
  "Data & backup": "נתונים וגיבוי",
  "Help": "עזרה",
  "last: {v}": "בפעם הקודמת: {v}",
  "Kept at {w} kg": "נשאר על {w} ק\"ג",
  "+{w} kg today": "+{w} ק\"ג היום",
  "Redo": "החזר",
  "Undo": "בטל",
  "Hold {w} kg · aim for {r}+ reps": "להישאר על {w} ק\"ג · לכוון ל-{r}+ חזרות",
  "Train once this week to keep your {n}-week streak.": "התאמן פעם אחת השבוע כדי לשמור על רצף של {n} שבועות.",
  "{a} and {b}": "{a} ו{b}",
  "this week": "השבוע",
  "goal met": "היעד הושג",
  "{a} of {b}": "{a} מתוך {b}",
  "Getting started": "צעדים ראשונים",
  "{a} of {b} done": "{a} מתוך {b} בוצעו",
  "Next: {x}": "הבא: {x}",
  "Pick a program": "בחר תוכנית",
  "Or build your own workout": "או בנה אימון משלך",
  "Finish your first workout": "סיים את האימון הראשון",
  "Tick each set as you go": "סמן כל סט תוך כדי",
  "Log your body weight": "רשום את משקל הגוף",
  "Track it next to your lifts": "עקוב אחריו לצד ההרמות",
  "Add GymLog to your home screen": "הוסף את GymLog למסך הבית",
  "Opens full screen, works offline": "נפתח במסך מלא ועובד בלי אינטרנט",
  "Sunday": "ראשון",
  "Monday": "שני",
  "Tuesday": "שלישי",
  "Wednesday": "רביעי",
  "Thursday": "חמישי",
  "Friday": "שישי",
  "Saturday": "שבת",
  "Chest": "חזה",
  "Shoulders": "כתפיים",
  "Biceps": "יד קדמית",
  "Triceps": "יד אחורית",
  "Quads": "ארבע ראשי",
  "Hamstrings": "מיתר הברך",
  "Glutes": "ישבן",
  "Calves": "תאומים",
  "Abs": "בטן",
  "Forearms": "אמות",
  "Other": "אחר",
  "work": "עבודה",
  "warm-up": "חימום",
  "drop": "דרופ",
  "failure": "כשל",
  // tab bar
  Train: 'אימון',
  Progress: 'התקדמות',
  History: 'היסטוריה',
  Body: 'גוף',
  Settings: 'הגדרות',

  // Train
  'Good morning': 'בוקר טוב',
  'Good afternoon': 'צהריים טובים',
  'Good evening': 'ערב טוב',
  'Good night': 'לילה טוב',
  'Up next': 'הבא בתור',
  "Today's workout": 'האימון של היום',
  'Workout in progress': 'אימון בתהליך',
  'Resume workout': 'המשך אימון',
  'Your workouts': 'האימונים שלך',
  New: 'חדש',
  Start: 'התחל',
  'Start {name}': 'התחל {name}',
  'last done {when}': 'בוצע לאחרונה {when}',
  '{m} still recovering': '{m} עדיין בהתאוששות',
  Coaching: 'אימון מתאמנים',
  'Browse programs': 'תוכניות מוכנות',
  'Single workouts and weekly plans, ready to go': 'אימונים בודדים ותוכניות שבועיות, מוכנים לשימוש',
  Records: 'שיאים',
  'Your best lifts for every exercise': 'ההרמות הטובות שלך בכל תרגיל',
  Exercises: 'תרגילים',
  'Your exercise list, photos, setup notes and records': 'רשימת התרגילים, תמונות, הערות כיוונון ושיאים',
  'How it works': 'איך זה עובד',
  'Short answers about every part of GymLog': 'תשובות קצרות על כל חלק ב-GymLog',
  'Last week': 'השבוע שעבר',
  '{n} workout': 'אימון {n}',
  '{n} workouts': '{n} אימונים',
  '{n} sets': '{n} סטים',
  '{n} record': 'שיא {n}',
  '{n} records': '{n} שיאים',
  'Hide until next week': 'הסתר עד השבוע הבא',
  Today: 'היום',
  Yesterday: 'אתמול',

  // live workout
  Finish: 'סיום',
  'Finish workout': 'סיום אימון',
  'Discard workout': 'מחיקת אימון',
  Duration: 'משך',
  Volume: 'נפח',
  Sets: 'סטים',
  Set: 'סט',
  Previous: 'קודם',
  Reps: 'חזרות',
  kg: 'ק"ג',
  'Add set': 'הוסף סט',
  Drop: 'דרופ',
  'Warm-up': 'חימום',
  'Add exercise': 'הוסף תרגיל',
  'Reorder exercises': 'סידור תרגילים',
  'Workout notes': 'הערות לאימון',
  'How did it feel? Anything to remember next time...': 'איך הרגיש? משהו לזכור לפעם הבאה...',
  'How the workout screen works': 'איך עובד מסך האימון',
  Resting: 'מנוחה',
  Skip: 'דלג',
  'Beat last time': 'עקפת את הפעם הקודמת',
  'Add exercises': 'הוספת תרגילים',
  'My exercises': 'התרגילים שלי',
  Library: 'ספרייה',
  'Search exercises': 'חיפוש תרגילים',
  'All muscles': 'כל השרירים',
  'All equipment': 'כל הציוד',

  // settings
  Account: 'חשבון',
  Workout: 'אימון',
  Language: 'שפה',
  'Rest timer sound': 'צליל בסוף מנוחה',
  'Beeps and vibrates when rest is over': 'צפצוף ורטט כשהמנוחה נגמרת',
  'Keep screen awake': 'מסך דולק',
  'During a workout, where the phone allows it': 'בזמן אימון, כשהטלפון מאפשר',
  'Log RPE': 'רישום RPE',
  'Rate how hard each set felt, from 6 to 10': 'דירוג קושי של כל סט, מ-6 עד 10',
  'Warm-up sets automatically': 'סטים של חימום אוטומטית',
  'Before the first heavy barbell or plate-loaded lift for each muscle': 'לפני ההרמה הכבדה הראשונה עם מוט או פלטות לכל שריר',
  'Weight increase': 'תוספת משקל',
  'Sign out': 'התנתקות',
  'Delete account': 'מחיקת חשבון',
  'I coach other people': 'אני מאמן אחרים',
  'Plans and progress for your trainees. Free for now.': 'תוכניות ומעקב למתאמנים שלך. בחינם בינתיים.',
  'My trainees': 'המתאמנים שלי',
  'My coach': 'המאמן שלי',
  'Code from your coach': 'קוד מהמאמן',
  Connect: 'התחבר',
  Remove: 'הסר',
  'Suggested exercises': 'תרגילים שהוצעו',
  Add: 'הוסף',
  Cancel: 'ביטול',
  Save: 'שמירה',
  Edit: 'עריכה',
  Back: 'חזרה'
}

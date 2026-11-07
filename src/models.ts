export interface Topic { id: string; title: string }
export interface Module { id: string; title: string; topics: Topic[] }
export type Status = 'draft' | 'published'
export interface Course {
  id: string; title: string; category: string; description: string; duration: string
  status: Status; price: number; teacher: string; modules: Module[]
}
export interface Review { teacher: string; rating: number; text: string } // без автора: відгуки анонімні
export interface TeacherStat { teacher: string; completion: number; plan: number }
export interface Question { q: string; options: string[]; answer: number }
export interface User { name: string; email: string; role: 'student' | 'teacher' | 'manager'; confirmed: boolean }
export interface Format { id: string; name: string; k: number }
export interface Extra { id: string; name: string; price: number }
export interface Data {
  courses: Course[]; quiz: Question[]; formats: Format[]; extras: Extra[]; promos: Record<string, number>
  reviews: Review[]; teacherStats: TeacherStat[]
}

export const PASS_SCORE = 60

// JSON можна віддавати з хмарного сховища: задайте VITE_DATA_URL у файлі .env
const DATA_URL: string = import.meta.env.VITE_DATA_URL || '/data/data.json'

export function load<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? '') as T } catch { return fallback }
}
export const save = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value))
export const percent = (right: number, total: number) => Math.round((right / total) * 100)

export async function loadData(): Promise<Data> {
  let res = await fetch(DATA_URL).catch(() => null)
  if (!res?.ok) res = await fetch('/data/data.json') // запасний варіант: локальний файл
  const data: Data = await res.json()
  const stored = load<Course[] | null>('courses', null) // курси, якими керує менеджер
  if (stored) data.courses = stored
  else save('courses', data.courses)
  return data
}

// ---- Користувачі ----
// Сумісність зі старими даними: роль «admin» тепер називається «manager»
export function fixRole<T extends { role: string; name?: string } | null>(u: T): T {
  if (u && u.role === 'admin') return { ...u, role: 'manager', name: u.name === 'Адмін' ? 'Менеджер' : u.name }
  return u
}
export const getUsers = (): User[] => load<User[]>('users', [
  { name: 'Викладач', email: 'teacher@edu.ua', role: 'teacher', confirmed: true },
  { name: 'Менеджер', email: 'manager@edu.ua', role: 'manager', confirmed: true }]).map((u) => fixRole(u))

// ---- Вартість навчання (аналог розрахунку вартості букета) ----
export class PriceCalculator {
  constructor(private course: Course, private format: Format, private extras: Extra[], private discount = 0) {}
  get base() { return Math.round(this.course.price * this.format.k) }
  get extrasSum() { return this.extras.reduce((s, e) => s + e.price, 0) }
  get discountSum() { return Math.round(((this.base + this.extrasSum) * this.discount) / 100) }
  get total() { return this.base + this.extrasSum - this.discountSum }
}

// ---- Керування курсами (User Story 1 і 2) ----
export function validateCourse(c: Pick<Course, 'id' | 'title' | 'status' | 'modules'>, all: Course[]): string | null {
  const title = c.title.trim()
  if (title.length < 3 || title.length > 100) return 'Назва курсу має містити від 3 до 100 символів'
  if (all.some((x) => x.id !== c.id && x.title.trim().toLowerCase() === title.toLowerCase())) return 'Курс із такою назвою вже існує'
  if (c.status === 'published' && c.modules.length === 0) return 'Курс не можна опублікувати без жодного модуля'
  return null
}
export function move<T>(arr: T[], i: number, dir: -1 | 1): void {
  const j = i + dir
  if (j < 0 || j >= arr.length) return
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
}

// ---- Підсумковий бал студента (User Story 9) ----
export const average = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const round2 = (n: number) => Math.round(n * 100) / 100
export interface ScoreResult { status: 'final' | 'in-progress'; score: number }

/** Тести — середнє всіх проміжних тестів; проєкт може бути ще не оцінений (null). Ваги за замовчуванням 40/60. */
export function finalScore(tests: number[], project: number | null, wTests = 40, wProject = 60): ScoreResult {
  if (wTests + wProject !== 100) throw new Error('Помилка конфігурації: сума вагових коефіцієнтів має дорівнювати 100 %')
  const t = average(tests)
  if (project === null) return { status: 'in-progress', score: round2((t * wTests) / 100) }
  return { status: 'final', score: round2((t * wTests + project * wProject) / 100) }
}

// ---- KPI викладача (User Story 10) ----
export interface KpiWeights { rating: number; completion: number; plan: number }
export const KPI_WEIGHTS: KpiWeights = { rating: 40, completion: 40, plan: 20 }

/** rating — середній бал відгуків 1–5 (null, якщо відгуків немає); completion і plan — у відсотках. */
export function teacherKpi(rating: number | null, completion: number, plan: number, w: KpiWeights = KPI_WEIGHTS) {
  if (w.rating + w.completion + w.plan !== 100) throw new Error('Помилка конфігурації: сума ваг має дорівнювати 100 %')
  const parts: [number, number][] = [[completion, w.completion], [plan, w.plan]]
  if (rating !== null) parts.push([(rating / 5) * 100, w.rating])
  const used = parts.reduce((s, [, k]) => s + k, 0)
  const sum = parts.reduce((s, [v, k]) => s + v * k, 0)
  return { kpi: Math.round((sum / used) * 10) / 10, noReviews: rating === null }
}

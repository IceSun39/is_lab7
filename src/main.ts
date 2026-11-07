import './scss/main.scss'
import { Course, Data, Status, User, PASS_SCORE, PriceCalculator, finalScore, teacherKpi, validateCourse, move, getUsers, fixRole, average, load, save, percent, loadData } from './models'

const root = document.documentElement
const themeBtn = document.querySelector<HTMLButtonElement>('.js-theme-toggle')
const burger = document.querySelector<HTMLButtonElement>('.js-burger')
const nav = document.querySelector<HTMLElement>('.js-nav')

type Theme = 'light' | 'dark'

// ---- Світла / темна тема ----
const saved = localStorage.getItem('theme')
if (saved === 'light' || saved === 'dark') root.dataset.theme = saved

function currentTheme(): Theme {
  const manual = root.dataset.theme as Theme | undefined
  if (manual) return manual
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

themeBtn?.addEventListener('click', () => {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark'
  root.dataset.theme = next
  localStorage.setItem('theme', next)
})

// ---- Мобільне меню ----
burger?.addEventListener('click', () => {
  const open = nav?.classList.toggle('is-open') ?? false
  burger.setAttribute('aria-expanded', String(open))
})

// ================= Сторінки =================
const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!
const page = document.body.dataset.page
const go = (url: string) => location.assign(url)
const user = fixRole(load<User | null>('session', null))
const li = (html: string) => `<li>${html}</li>`

// Шапка: вхід / вихід
const auth = document.querySelector<HTMLAnchorElement>('.js-auth')
if (user && auth) {
  auth.textContent = `Вийти (${user.name})`
  auth.addEventListener('click', (e) => { e.preventDefault(); localStorage.removeItem('session'); go('index.html') })
}
const need = (...roles: User['role'][]) => { if (!user || (roles.length && !roles.includes(user.role))) go('login.html') }

if (page === 'courses') {
  const grid = $('#courses'), search = $<HTMLInputElement>('#search'), cat = $<HTMLSelectElement>('#category')
  loadData().then(({ courses: all }) => {
    const manager = user?.role === 'manager'
    const courses = manager ? all : all.filter((c) => c.status === 'published') // студенти бачать лише опубліковані
    ;[...new Set(courses.map((c) => c.category))].forEach((c) => cat.add(new Option(c, c)))
    const draw = () => {
      const q = search.value.toLowerCase()
      const list = courses.filter((c) => c.title.toLowerCase().includes(q) && (!cat.value || c.category === cat.value))
      grid.innerHTML = list.map((c) => `<article class="card"><span class="tag">${c.category}</span>
        <h3 class="card__title">${c.title}</h3><p class="card__text">${c.description}</p>
        <p class="card__text">Викладач: ${c.teacher} · ${c.duration}</p>
        <details><summary>Програма курсу</summary><ol>${c.modules.map((m) => `<li>${m.title}<ul>${m.topics.map((t) => `<li>${t.title}</li>`).join('')}</ul></li>`).join('') || '<li>Програма ще не розроблена</li>'}</ol></details>
        <b>${c.price} грн</b><button class="btn btn--primary" data-id="${c.id}">Записатись</button>
        ${manager ? `<span class="tag">${c.status === 'published' ? 'Опубліковано' : 'Чернетка'}</span><a class="btn btn--secondary" href="admin.html">Керувати</a>` : ''}</article>`).join('') || '<p>Нічого не знайдено</p>'
    }
    search.oninput = cat.onchange = draw
    draw()
    grid.addEventListener('click', (e) => {
      const id = (e.target as HTMLElement).dataset.id
      if (!id) return
      if (!user) return go('login.html')
      const mine = load<string[]>('enrolled:' + user.email, [])
      if (!mine.includes(id)) save('enrolled:' + user.email, [...mine, id])
      go('cabinet.html')
    })
  })
}

if (page === 'login') {
  const msg = $('#msg'), confirmBtn = $<HTMLButtonElement>('#confirm')
  const forms = document.querySelectorAll<HTMLFormElement>('form[data-tab]')
  const show = (tab: string) => forms.forEach((f) => (f.hidden = f.dataset.tab !== tab))
  document.querySelectorAll<HTMLElement>('.js-tab').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab!)))
  show(location.hash === '#reg' ? 'reg' : 'login')
  const say = (t: string) => { msg.hidden = false; msg.textContent = t }
  const users = getUsers
  let pending = ''
  $<HTMLFormElement>('#reg').addEventListener('submit', (e) => {
    e.preventDefault()
    const email = $<HTMLInputElement>('#r-email').value.trim()
    if ($<HTMLInputElement>('#r-pass').value.length < 6) return say('Пароль має містити щонайменше 6 символів')
    if (users().some((u) => u.email === email)) return say('Такий email уже зареєстровано')
    save('users', [...users(), { name: $<HTMLInputElement>('#r-name').value, email, role: 'student', confirmed: false }])
    pending = email
    say(`Лист із підтвердженням надіслано на ${email}`)
    confirmBtn.hidden = false
  })
  confirmBtn.addEventListener('click', () => {
    save('users', users().map((u) => (u.email === pending ? { ...u, confirmed: true } : u)))
    confirmBtn.hidden = true
    say('Email підтверджено. Тепер можна увійти.')
    show('login')
  })
  $<HTMLFormElement>('#login').addEventListener('submit', (e) => {
    e.preventDefault()
    const u = users().find((x) => x.email === $<HTMLInputElement>('#l-email').value.trim())
    if (!u) return say('Користувача не знайдено. Зареєструйтесь.')
    if (!u.confirmed) return say('Спочатку підтвердіть email.')
    save('session', u)
    go(u.role === 'manager' ? 'admin.html' : u.role === 'teacher' ? 'teacher.html' : 'cabinet.html')
  })
}

if (page === 'cabinet') {
  need()
  loadData().then(({ courses }) => {
    $('#hello').textContent = `Вітаємо, ${user!.name}!`
    const mine = load<string[]>('enrolled:' + user!.email, [])
    $('#my').innerHTML = mine.map((id) => courses.find((c) => c.id === id)).filter((c): c is Course => !!c)
      .map((c) => li(`${c.title} <a class="btn btn--secondary" href="test.html?course=${c.id}">Пройти тест</a>`)).join('') || li('Ви ще не записані на курси')
    const certs = load<string[]>('certs:' + user!.email, [])
    $('#certs').innerHTML = certs.map((t) => li(`🎓 Сертифікат: ${t}`)).join('') || li('Сертифікатів поки немає')
  })
}

if (page === 'test') {
  need()
  const id = new URLSearchParams(location.search).get('course')
  loadData().then(({ courses, quiz }) => {
    const course = courses.find((c) => c.id === id)
    if (!course) return go('cabinet.html')
    $('#course').textContent = `Курс: ${course.title}. Прохідний бал — ${PASS_SCORE}%`
    const form = $<HTMLFormElement>('#quiz')
    form.innerHTML = quiz.map((q, i) => `<fieldset class="panel"><legend>${i + 1}. ${q.q}</legend>${q.options.map((o, k) =>
      `<label class="opt"><input type="radio" name="q${i}" value="${k}" required> ${o}</label>`).join('')}</fieldset>`).join('')
      + '<button class="btn btn--primary" type="submit">Завершити тест</button>'
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      const right = quiz.filter((q, i) => Number(new FormData(form).get('q' + i)) === q.answer).length
      const score = percent(right, quiz.length), res = $('#result')
      res.hidden = false
      if (score >= PASS_SCORE) {
        const key = 'certs:' + user!.email
        save(key, [...load<string[]>(key, []), course.title])
        res.textContent = `Результат: ${score}%. Тест складено! Сертифікат «${course.title}» додано в кабінет.`
      } else res.textContent = `Результат: ${score}%. Прохідний бал не набрано — повторіть матеріал і спробуйте ще раз.`
    })
  })
}

if (page === 'teacher') {
  need('teacher', 'manager')
  const list = $('#rooms'), sel = $<HTMLSelectElement>('#room-course')
  const draw = () => (list.innerHTML = load<string[]>('rooms', []).map(li).join('') || li('Занять поки немає'))
  loadData().then(({ courses }) => courses.forEach((c) => sel.add(new Option(c.title, c.title))))
  draw()
  $<HTMLFormElement>('#room').addEventListener('submit', (e) => {
    e.preventDefault()
    const code = Math.random().toString(36).slice(2, 8)
    save('rooms', [...load<string[]>('rooms', []),
      `${sel.value} — ${$<HTMLInputElement>('#room-title').value}, ${$<HTMLInputElement>('#room-date').value.replace('T', ' ')} · кімната <b>${code}</b>`])
    draw()
  })
}

if (page === 'admin') {
  need('manager')
  const f = (id: string) => $<HTMLInputElement>('#' + id)
  const form = $<HTMLFormElement>('#course-form'), err = $('#course-err'), list = $('#courses-list')
  const tsel = $<HTMLSelectElement>('#t-course'), tlist = $('#teachers')
  let data: Data
  const drawTeachers = () => (tlist.innerHTML = load<string[]>('teachers', []).map(li).join('') || li('Викладачів ще не додано'))
  const drawCourses = () => {
    list.innerHTML = data.courses.map((c) => li(`<span><b>${c.title}</b> <span class="tag">${c.status === 'published' ? 'Опубліковано' : 'Чернетка'}</span> модулів: ${c.modules.length}</span>
      <span><button class="btn btn--secondary" data-edit="${c.id}">Редагувати</button>
      <a class="btn btn--secondary" href="curriculum.html?course=${c.id}">Програма</a></span>`)).join('')
    tsel.innerHTML = ''
    data.courses.forEach((c) => tsel.add(new Option(c.title, c.title)))
  }
  const drawKpi = () => {
    const month = new Date().toISOString().slice(0, 7)
    let cache = load<{ month: string; rows: string[] }>('kpi', { month: '', rows: [] })
    if (cache.month !== month) { // автоматичний щомісячний перерахунок
      const rows = data.teacherStats.map((s) => {
        const rs = data.reviews.filter((r) => r.teacher === s.teacher).map((r) => r.rating)
        const rating = rs.length ? average(rs) : null
        const { kpi, noReviews } = teacherKpi(rating, s.completion, s.plan)
        return `<span><b>${s.teacher}</b>: KPI <b>${kpi}</b> (відгуки ${rating === null ? '—' : rating.toFixed(1)}, завершення ${s.completion}%, план ${s.plan}%)</span>${noReviews ? '<span class="tag">немає відгуків</span>' : ''}`
      })
      cache = { month, rows }
      save('kpi', cache)
    }
    $('#kpi-month').textContent = `Розраховано автоматично за ${cache.month}`
    $('#kpi-list').innerHTML = cache.rows.map(li).join('')
    $('#reviews').innerHTML = data.reviews.map((r) => li(`${r.teacher}: ${'★'.repeat(r.rating)} — ${r.text}`)).join('') // автор не показується
  }
  loadData().then((d) => { data = d; drawCourses(); drawKpi() })
  drawTeachers()

  list.addEventListener('click', (e) => {
    const c = data.courses.find((x) => x.id === (e.target as HTMLElement).dataset.edit)
    if (!c) return
    f('c-id').value = c.id; f('c-title').value = c.title; f('c-desc').value = c.description
    f('c-cat').value = c.category; f('c-dur').value = c.duration; f('c-price').value = String(c.price)
    $<HTMLSelectElement>('#c-status').value = c.status
    form.scrollIntoView({ behavior: 'smooth' })
  })
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const id = f('c-id').value
    const old = data.courses.find((c) => c.id === id)
    const course: Course = { id: id || 'c' + Date.now(), title: f('c-title').value.trim(), description: f('c-desc').value.trim(),
      category: f('c-cat').value.trim(), duration: f('c-dur').value.trim(), price: Number(f('c-price').value) || 0,
      status: $<HTMLSelectElement>('#c-status').value as Status, teacher: old?.teacher ?? 'Не призначено', modules: old?.modules ?? [] }
    const problem = validateCourse(course, data.courses)
    err.hidden = !problem
    if (problem) { err.textContent = problem; return }
    data.courses = old ? data.courses.map((c) => (c.id === id ? course : c)) : [...data.courses, course]
    save('courses', data.courses) // зміни зберігаються одразу і видимі студентам
    form.reset(); f('c-id').value = ''
    drawCourses()
  })
  $<HTMLFormElement>('#new-teacher').addEventListener('submit', (e) => {
    e.preventDefault()
    const email = f('t-email').value.trim()
    if (getUsers().some((u) => u.email === email)) return void alert('Користувач із таким email уже існує')
    // обліковий запис викладача: одразу підтверджений, може входити через login.html
    save('users', [...getUsers(), { name: f('t-name').value.trim(), email, role: 'teacher', confirmed: true }])
    save('teachers', [...load<string[]>('teachers', []), `${f('t-name').value} (${email}) → ${tsel.value}`])
    ;(e.target as HTMLFormElement).reset()
    drawTeachers()
  })
}

if (page === 'curriculum') {
  need('manager', 'teacher')
  loadData().then((data) => {
    const course = data.courses.find((c) => c.id === new URLSearchParams(location.search).get('course'))
    if (!course) return go(user?.role === 'manager' ? 'admin.html' : 'teacher.html')
    $('#cur-title').textContent = `Курс: ${course.title}`
    const btn = (act: string, m: string, t: string, label: string) => `<button class="btn btn--secondary btn--sm" data-act="${act}" data-m="${m}" data-t="${t}">${label}</button>`
    const draw = () => {
      save('courses', data.courses)
      $('#modules').innerHTML = course.modules.map((m, i) => `<li class="module"><div class="module__head"><b>${i + 1}. ${m.title}</b>
        <span>${btn('m-up', m.id, '', '↑')}${btn('m-down', m.id, '', '↓')}${btn('m-ren', m.id, '', '✎')}${btn('m-del', m.id, '', '✕')}${btn('t-add', m.id, '', '+ тема')}</span></div>
        <ul class="topics">${m.topics.map((t) => `<li class="topic"><span>${t.title}</span>
        <span>${btn('t-up', m.id, t.id, '↑')}${btn('t-down', m.id, t.id, '↓')}${btn('t-ren', m.id, t.id, '✎')}${btn('t-del', m.id, t.id, '✕')}</span></li>`).join('')}</ul></li>`).join('')
        || '<li>Модулів ще немає</li>'
    }
    draw()
    $<HTMLFormElement>('#add-module').addEventListener('submit', (e) => {
      e.preventDefault()
      const input = $<HTMLInputElement>('#mod-title')
      course.modules.push({ id: 'm' + Date.now(), title: input.value.trim(), topics: [] })
      input.value = ''
      draw()
    })
    $('#modules').addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')
      if (!el) return
      const { act, m, t } = el.dataset as { act: string; m: string; t: string }
      const mi = course.modules.findIndex((x) => x.id === m), mod = course.modules[mi]
      const ti = mod.topics.findIndex((x) => x.id === t)
      const ask = (old: string) => prompt('Нова назва:', old)?.trim()
      if (act === 'm-up') move(course.modules, mi, -1)
      else if (act === 'm-down') move(course.modules, mi, 1)
      else if (act === 'm-ren') { const v = ask(mod.title); if (v) mod.title = v }
      else if (act === 'm-del') course.modules.splice(mi, 1)
      else if (act === 't-add') { const v = ask(''); if (v) mod.topics.push({ id: 't' + Date.now(), title: v }) }
      else if (act === 't-up') move(mod.topics, ti, -1)
      else if (act === 't-down') move(mod.topics, ti, 1)
      else if (act === 't-ren') { const v = ask(mod.topics[ti].title); if (v) mod.topics[ti].title = v }
      else if (act === 't-del') mod.topics.splice(ti, 1)
      draw()
    })
  })
}

if (page === 'calc') {
  const course = $<HTMLSelectElement>('#calc-course'), format = $<HTMLSelectElement>('#calc-format')
  const extrasBox = $('#extras'), promo = $<HTMLInputElement>('#promo')
  const uah = (n: number) => `${n.toLocaleString('uk-UA')} грн`
  loadData().then(({ courses, formats, extras, promos }) => {
    courses.forEach((c) => course.add(new Option(`${c.title} — ${uah(c.price)}`, c.id)))
    formats.forEach((f) => format.add(new Option(`${f.name} (×${f.k})`, f.id)))
    extrasBox.insertAdjacentHTML('beforeend', extras.map((e) =>
      `<label class="opt"><input type="checkbox" value="${e.id}"> ${e.name} (+${uah(e.price)})</label>`).join(''))
    const recalc = () => {
      const chosen = extras.filter((e) => extrasBox.querySelector<HTMLInputElement>(`input[value="${e.id}"]`)?.checked)
      const discount = promos[promo.value.trim().toUpperCase()] ?? 0
      const calc = new PriceCalculator(courses.find((c) => c.id === course.value)!, formats.find((f) => f.id === format.value)!, chosen, discount)
      $('#breakdown').innerHTML = [li(`Курс × формат: <b>${uah(calc.base)}</b>`), li(`Додаткові послуги: <b>${uah(calc.extrasSum)}</b>`),
        li(`Знижка ${discount}%: <b>−${uah(calc.discountSum)}</b>`)].join('')
      $('#total').innerHTML = `Разом до сплати: <b>${uah(calc.total)}</b>`
    }
    $('#cost').addEventListener('input', recalc)
    recalc()
  })
  const num = (id: string) => { const v = $<HTMLInputElement>('#' + id).value.trim(); return v === '' ? null : Number(v) }
  const bad = (...xs: (number | null)[]) => xs.some((x) => x !== null && (Number.isNaN(x) || x < 0 || x > 100))
  $<HTMLFormElement>('#score').addEventListener('submit', (e) => {
    e.preventDefault()
    const res = $('#score-res'); res.hidden = false
    const tests = $<HTMLInputElement>('#s-tests').value.split(',').map((x) => Number(x.trim())).filter((n) => !Number.isNaN(n))
    const project = num('s-project')
    if (bad(project, ...tests)) return void (res.textContent = 'Оцінки мають бути від 0 до 100')
    try {
      const r = finalScore(tests, project, num('s-w-tests') ?? 0, num('s-w-project') ?? 0)
      res.textContent = r.status === 'in-progress' ? `Статус: у процесі (оцінки за проєкт ще немає). Поточний внесок тестів: ${r.score}%`
        : `Підсумковий бал: ${r.score}%. ${r.score >= PASS_SCORE ? 'Сертифікат буде видано.' : 'Прохідний бал не набрано.'}`
    } catch (err) { res.textContent = (err as Error).message }
  })
  $<HTMLFormElement>('#kpi').addEventListener('submit', (e) => {
    e.preventDefault()
    const res = $('#kpi-res'); res.hidden = false
    const rating = num('k-rating'), done = num('k-done') ?? 0, plan = num('k-plan') ?? 0
    if (bad(done, plan) || (rating !== null && (rating < 1 || rating > 5))) return void (res.textContent = 'Відгуки — від 1 до 5, відсотки — від 0 до 100')
    try {
      const { kpi, noReviews } = teacherKpi(rating, done, plan, { rating: num('k-w-r') ?? 0, completion: num('k-w-c') ?? 0, plan: num('k-w-p') ?? 0 })
      res.textContent = `KPI викладача: ${kpi} з 100${noReviews ? ' (немає відгуків — враховано решту показників)' : ''}`
    } catch (err) { res.textContent = (err as Error).message }
  })
}

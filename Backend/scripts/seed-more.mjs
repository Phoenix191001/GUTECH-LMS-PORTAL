// Extra demo data on top of `npm run seed`: more teachers, students, courses, resources, assignments with graded
// submissions, quizzes, announcements, chat and complaints. Idempotent (skips rows that already exist).
// Usage: `npm run seed:more` (needs SEED_PASSWORD in Backend/.env). Dev/demo only.
import { admin, ensureUser } from './_client.mjs'

const password = process.env.SEED_PASSWORD
if (!password) {
  console.error('Set SEED_PASSWORD in Backend/.env first.')
  process.exit(1)
}

const day = 86_400_000
const at = (days, hours = 0) => new Date(Date.now() + days * day + hours * 3_600_000).toISOString()
const must = (label, { data, error }) => {
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}
/** Insert `row` into `table` unless a row matching `match` exists. Returns the row id. */
async function once(table, match, row) {
  let q = admin.from(table).select('id')
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v)
  const found = must(`${table} lookup`, await q.limit(1))
  if (found.length) return found[0].id
  return must(`${table} insert`, await admin.from(table).insert(row).select('id').single()).id
}

// ---------------------------------------------------------------- people
const adminProfile = must('admin', await admin.from('profiles').select('id').eq('role', 'admin').limit(1).single())
const adminId = adminProfile.id

const teacherDefs = [
  ['teacher3@example.edu', 'Dr. Sana Rehman'],
  ['teacher4@example.edu', 'Prof. Imran Qureshi'],
  ['teacher5@example.edu', 'Dr. Nadia Farooq'],
]
const T = {}
for (const [i, [email, name]] of teacherDefs.entries()) T[i + 3] = await ensureUser({ email, password, fullName: name, role: 'teacher' })
const t1 = must('t1', await admin.from('profiles').select('id').eq('email', 'teacher1@example.edu').single()).id
const t2 = must('t2', await admin.from('profiles').select('id').eq('email', 'teacher2@example.edu').single()).id

const studentNames = [
  'Maryam Siddiqui', 'Ali Raza', 'Hira Baig', 'Danish Iqbal', 'Sara Anwar',
  'Bilal Hussain', 'Noor Fatima', 'Ahmed Yousuf', 'Iqra Shahid', 'Taha Mirza',
]
const S = []
for (const [i, name] of studentNames.entries()) {
  const n = i + 6
  S.push(
    await ensureUser({
      email: `student${n}@example.edu`,
      password,
      fullName: name,
      role: 'student',
      rollNo: `2026-${n <= 10 ? 'CS' : n <= 13 ? 'EE' : 'BBA'}-${String(n).padStart(3, '0')}`,
    }),
  )
}
const originals = must('students 1-5', await admin.from('profiles').select('id, email').in('email', ['student1', 'student2', 'student3', 'student4', 'student5'].map((s) => `${s}@example.edu`)))
const S1_5 = originals.sort((a, b) => a.email.localeCompare(b.email)).map((p) => p.id)
const all = [...S1_5, ...S] // 15 students

// ---------------------------------------------------------------- courses
const courseDefs = [
  { code: 'CS-210', title: 'Data Structures and Algorithms', description: 'Lists, trees, graphs, sorting and complexity analysis.', teacher_id: T[3], students: all.slice(0, 11) },
  { code: 'CS-301', title: 'Web Technologies', description: 'HTML, CSS, JavaScript, React and full-stack deployment.', teacher_id: T[4], students: all.slice(3, 15) },
  { code: 'MT-110', title: 'Calculus I', description: 'Limits, derivatives and integrals.', teacher_id: T[5], students: all.slice(5, 15) },
  { code: 'EN-102', title: 'Technical Writing', description: 'Reports, documentation and professional communication.', teacher_id: t1, students: all.slice(0, 8) },
]
const C = {}
for (const c of courseDefs) {
  const { students, ...row } = c
  C[c.code] = must(`course ${c.code}`, await admin.from('courses').upsert(row, { onConflict: 'code' }).select('id').single()).id
  must('enrol', await admin.from('enrollments').upsert(students.map((s) => ({ course_id: C[c.code], student_id: s })), { onConflict: 'course_id,student_id', ignoreDuplicates: true }))
}
// existing courses: enrol the new students too
const base = must('base courses', await admin.from('courses').select('id, code').in('code', ['CS-101', 'CS-205']))
for (const b of base) {
  C[b.code] = b.id
  const extra = b.code === 'CS-101' ? S : S.slice(0, 5)
  must('enrol base', await admin.from('enrollments').upsert(extra.map((s) => ({ course_id: b.id, student_id: s })), { onConflict: 'course_id,student_id', ignoreDuplicates: true }))
}
const teacherOf = { 'CS-101': t1, 'CS-205': t2, 'CS-210': T[3], 'CS-301': T[4], 'MT-110': T[5], 'EN-102': t1 }

// ---------------------------------------------------------------- resources (links)
const links = [
  ['CS-101', 'Python official tutorial', 'https://docs.python.org/3/tutorial/'],
  ['CS-205', 'PostgreSQL documentation', 'https://www.postgresql.org/docs/'],
  ['CS-210', 'Visualgo: algorithm animations', 'https://visualgo.net/'],
  ['CS-301', 'MDN Web Docs', 'https://developer.mozilla.org/'],
  ['CS-301', 'React documentation', 'https://react.dev/'],
  ['MT-110', 'Paul’s Online Math Notes: Calculus I', 'https://tutorial.math.lamar.edu/Classes/CalcI/CalcI.aspx'],
  ['EN-102', 'Google Technical Writing course', 'https://developers.google.com/tech-writing'],
]
for (const [code, title, url] of links) {
  await once('resources', { course_id: C[code], title }, { course_id: C[code], uploaded_by: teacherOf[code], title, description: 'Recommended reading for this course.', kind: 'link', external_url: url })
}

// ---------------------------------------------------------------- assignments + graded submissions
const assignmentDefs = [
  { code: 'CS-101', title: 'Lab 1: Variables and Loops', due: 10, max: 20, late: false, instructions: 'Write a program that prints the multiplication table of a number entered by the user.' },
  { code: 'CS-101', title: 'Lab 2: Functions', due: -3, max: 20, late: true, instructions: 'Implement five utility functions and document them.' },
  { code: 'CS-205', title: 'ER Diagram for a Library', due: 7, max: 25, late: false, instructions: 'Design an ER diagram for a library system and normalise it to 3NF.' },
  { code: 'CS-210', title: 'Linked List Implementation', due: 5, max: 30, late: false, instructions: 'Implement a singly linked list with insert, delete and reverse.' },
  { code: 'CS-210', title: 'Sorting Benchmark Report', due: -5, max: 25, late: true, instructions: 'Compare bubble, merge and quick sort on inputs of increasing size.' },
  { code: 'CS-301', title: 'Personal Portfolio Page', due: 12, max: 40, late: false, instructions: 'Build a responsive portfolio page with HTML, CSS and JavaScript.' },
  { code: 'MT-110', title: 'Problem Set 1: Limits', due: 4, max: 15, late: false, instructions: 'Solve problems 1 to 12 from the handout. Show your working.' },
  { code: 'EN-102', title: 'Write a Project Proposal', due: 14, max: 20, late: false, instructions: 'Write a two-page proposal for a software project of your choice.' },
]
const feedbacks = ['Good work, clear structure.', 'Solid effort. Check edge cases next time.', 'Excellent, well documented.', 'Needs more detail in the explanation.']
const answers = [
  'I solved it step by step and tested it with several inputs. The code and notes are attached.',
  'My solution follows the lecture approach. I also added comments explaining each part.',
  'Completed all parts. One part was tricky, so I added an extra explanation.',
]
let submissionsMade = 0
for (const a of assignmentDefs) {
  const id = await once('assignments', { course_id: C[a.code], title: a.title }, {
    course_id: C[a.code], created_by: teacherOf[a.code], title: a.title, instructions: a.instructions,
    due_at: at(a.due), max_marks: a.max, allow_late: a.late, is_published: true,
  })
  const enrolled = must('enrolled', await admin.from('enrollments').select('student_id').eq('course_id', C[a.code]))
  const pastDue = a.due < 0
  for (const [i, e] of enrolled.slice(0, pastDue ? 7 : 4).entries()) {
    const graded = pastDue || i % 2 === 0
    const row = {
      assignment_id: id, student_id: e.student_id,
      text_answer: answers[i % answers.length],
      submitted_at: at(a.due - 1 - (i % 3)), is_late: false,
      ...(graded && {
        marks_obtained: Math.round(a.max * (0.62 + ((i * 7) % 35) / 100) * 2) / 2,
        feedback: feedbacks[i % feedbacks.length], graded_by: teacherOf[a.code], graded_at: at(a.due < 0 ? a.due + 1 : -0.2),
      }),
    }
    const exists = must('sub lookup', await admin.from('submissions').select('id').eq('assignment_id', id).eq('student_id', e.student_id).limit(1))
    if (!exists.length) { must('submission', await admin.from('submissions').insert(row)); submissionsMade++ }
  }
}

// ---------------------------------------------------------------- quizzes
const quizDefs = [
  {
    code: 'CS-210', title: 'Quiz 1: Big-O Basics', minutes: 15, questions: [
      { type: 'mcq_single', prompt: 'What is the time complexity of binary search on a sorted array?', marks: 2, options: [['O(n)', false], ['O(log n)', true], ['O(n log n)', false], ['O(1)', false]] },
      { type: 'true_false', prompt: 'Merge sort has a worst-case time complexity of O(n log n).', marks: 1, options: [['True', true], ['False', false]] },
      { type: 'mcq_multi', prompt: 'Which of these are stable sorting algorithms?', marks: 2, options: [['Merge sort', true], ['Quick sort', false], ['Insertion sort', true], ['Heap sort', false]] },
    ],
  },
  {
    code: 'CS-301', title: 'Quiz 1: HTML and CSS', minutes: 10, questions: [
      { type: 'mcq_single', prompt: 'Which HTML tag is used for the largest heading?', marks: 1, options: [['<h6>', false], ['<head>', false], ['<h1>', true], ['<title>', false]] },
      { type: 'true_false', prompt: 'CSS Flexbox is designed for one-dimensional layouts.', marks: 1, options: [['True', true], ['False', false]] },
      { type: 'short_answer', prompt: 'Name one advantage of responsive design.', marks: 3, options: [] },
    ],
  },
  {
    code: 'MT-110', title: 'Quiz 1: Derivatives', minutes: 20, questions: [
      { type: 'mcq_single', prompt: 'What is the derivative of x^2?', marks: 1, options: [['x', false], ['2x', true], ['x^2', false], ['2', false]] },
      { type: 'mcq_single', prompt: 'What is the derivative of a constant?', marks: 1, options: [['1', false], ['The constant itself', false], ['0', true], ['Undefined', false]] },
    ],
  },
]
for (const q of quizDefs) {
  const exists = must('quiz lookup', await admin.from('quizzes').select('id').eq('course_id', C[q.code]).eq('title', q.title).limit(1))
  if (exists.length) continue
  const quizId = must('quiz', await admin.from('quizzes').insert({
    course_id: C[q.code], created_by: teacherOf[q.code], title: q.title, description: 'Auto-graded where possible. One attempt.',
    duration_minutes: q.minutes, opens_at: at(-1), closes_at: at(6), max_attempts: 1, shuffle_questions: true, is_published: true,
  }).select('id').single()).id
  for (const [pos, qu] of q.questions.entries()) {
    const qid = must('question', await admin.from('quiz_questions').insert({ quiz_id: quizId, position: pos + 1, type: qu.type, prompt: qu.prompt, marks: qu.marks }).select('id').single()).id
    if (qu.options.length) must('options', await admin.from('quiz_options').insert(qu.options.map(([text, ok], p) => ({ question_id: qid, position: p + 1, text, is_correct: ok }))))
  }
}

// ---------------------------------------------------------------- announcements
const announcements = [
  [null, adminId, 'Mid-term examination schedule', 'The mid-term schedule has been published. Check your course pages for dates and venues. Contact your teacher for clarification.', true],
  [null, adminId, 'Campus Wi-Fi maintenance on Saturday', 'The campus network will be unavailable from 2 AM to 6 AM on Saturday for scheduled maintenance.', false],
  [null, adminId, 'Library opening hours extended', 'During exams the library will stay open until 11 PM, Monday to Friday.', false],
  ['CS-101', t1, 'Lab 1 submissions are open', 'Submit Lab 1 before the deadline. Late work loses marks unless you have approval.', true],
  ['CS-205', t2, 'ER diagram tips', 'Remember to mark primary keys and cardinalities on every relationship. Examples are in the resources tab.', false],
  ['CS-210', T[3], 'Quiz 1 is open', 'Quiz 1 covers Big-O notation. You have 15 minutes and one attempt.', true],
  ['CS-301', T[4], 'Bring your laptops on Monday', 'We will build the portfolio page live in class. Install Node.js and VS Code beforehand.', false],
  ['MT-110', T[5], 'Extra tutorial session', 'An extra tutorial on limits will be held on Thursday after class. Attendance is optional.', false],
  ['EN-102', t1, 'Proposal template available', 'A proposal template is in the resources tab. Use it as the base for your assignment.', false],
]
for (const [code, author, title, body, pinned] of announcements) {
  await once('announcements', { title }, { course_id: code ? C[code] : null, author_id: author, title, body, is_pinned: pinned })
}

// ---------------------------------------------------------------- chat
const chats = [
  ['CS-101', S1_5[0], 'Has anyone started Lab 2? Not sure how to document the functions.'],
  ['CS-101', t1, 'Use docstrings: a short description, the parameters and the return value.'],
  ['CS-101', S1_5[1], 'Thank you, that helps!'],
  ['CS-301', S[2], 'Can we use Bootstrap for the portfolio or only plain CSS?'],
  ['CS-301', T[4], 'Either is fine, but you must write some custom CSS as well.'],
  ['CS-210', S1_5[2], 'Is the quiz open book?'],
  ['CS-210', T[3], 'No, it is closed book. You have 15 minutes.'],
  ['MT-110', S[6], 'Will the extra tutorial cover the epsilon-delta definition?'],
  ['MT-110', T[5], 'Yes, we will do two worked examples.'],
]
for (const [i, [code, sender, body]] of chats.entries()) {
  const found = must('chat lookup', await admin.from('chat_messages').select('id').eq('course_id', C[code]).eq('body', body).limit(1))
  if (!found.length) must('chat', await admin.from('chat_messages').insert({ course_id: C[code], sender_id: sender, body, created_at: at(-1, -(chats.length - i)) }))
}

// ---------------------------------------------------------------- complaints
const complaints = [
  { by: S1_5[0], code: 'CS-101', category: 'academic', subject: 'Marks not updated for Lab 1', description: 'My Lab 1 marks still show as pending even though the submission date has passed.', status: 'open' },
  { by: S1_5[3], code: null, category: 'facility', subject: 'Projector not working in Room B-12', description: 'The projector in Room B-12 has been flickering for a week, which makes lectures hard to follow.', status: 'in_review' },
  { by: S[1], code: 'CS-301', category: 'technical', subject: 'Unable to open the resource link', description: 'The MDN link in the resources tab opens a blank page on my phone.', status: 'resolved', response: 'The link was checked and works on mobile. Please clear your browser cache and try again.' },
  { by: S[4], code: null, category: 'other', subject: 'Request for extra library hours', description: 'Could the library stay open later during exam weeks? Many students need a quiet place to study.', status: 'resolved', response: 'Library hours have been extended until 11 PM during exams. See the announcement.' },
  { by: S[7], code: 'MT-110', category: 'teacher', subject: 'Request for a recorded lecture', description: 'I missed last week because of illness. Could the lecture be recorded or the slides shared?', status: 'rejected', response: 'Lectures are not recorded. The slides are in the resources tab, and the extra tutorial covers the same topics.' },
  { by: S1_5[4], code: 'CS-205', category: 'academic', subject: 'Unclear grading criteria for the ER diagram', description: 'The rubric does not say how many marks go to normalisation versus the diagram itself.', status: 'open' },
]
for (const c of complaints) {
  const done = c.status === 'resolved' || c.status === 'rejected'
  await once('complaints', { subject: c.subject }, {
    submitted_by: c.by, course_id: c.code ? C[c.code] : null, category: c.category, subject: c.subject, description: c.description,
    status: c.status, admin_response: c.response ?? null,
    resolved_by: done ? adminId : null, resolved_at: done ? at(-1) : null,
  })
}

const count = async (t) => {
  const { count: n, error } = await admin.from(t).select('*', { count: 'exact', head: true })
  if (error) throw new Error(`${t}: ${error.message}`)
  return n
}
console.log('Extra seed complete. Totals now:')
for (const t of ['profiles', 'courses', 'enrollments', 'resources', 'assignments', 'submissions', 'quizzes', 'quiz_questions', 'announcements', 'chat_messages', 'complaints']) {
  console.log(`  ${t.padEnd(16)} ${await count(t)}`)
}
console.log(`  (new submissions this run: ${submissionsMade})`)

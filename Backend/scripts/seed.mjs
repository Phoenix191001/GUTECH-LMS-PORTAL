// Local development seed (spec Section 6): 1 admin, 2 teachers, 5 students, 2 courses.
// Idempotent: safe to run more than once. Usage: `npm run seed`.
import { admin, ensureUser } from './_client.mjs'

const password = process.env.SEED_PASSWORD || 'Welcome-12345'

const adminId = await ensureUser({
  email: process.env.ADMIN_EMAIL || 'admin@example.edu',
  password: process.env.ADMIN_PASSWORD || password,
  fullName: process.env.ADMIN_NAME || 'System Administrator',
  role: 'admin',
})

const teachers = []
for (const [i, name] of ['Dr. Amna Siddiqui', 'Prof. Bilal Ahmed'].entries()) {
  teachers.push(
    await ensureUser({ email: `teacher${i + 1}@example.edu`, password, fullName: name, role: 'teacher' }),
  )
}

const studentNames = ['Hamza Khan', 'Ayesha Noor', 'Usman Tariq', 'Fatima Zahra', 'Zain Malik']
const students = []
for (const [i, name] of studentNames.entries()) {
  students.push(
    await ensureUser({
      email: `student${i + 1}@example.edu`,
      password,
      fullName: name,
      role: 'student',
      rollNo: `2026-CS-${String(i + 1).padStart(3, '0')}`,
    }),
  )
}

const courseRows = [
  { code: 'CS-101', title: 'Introduction to Programming', description: 'Foundations of programming.', teacher_id: teachers[0] },
  { code: 'CS-205', title: 'Database Systems', description: 'Relational modelling and SQL.', teacher_id: teachers[1] },
]
const { data: courses, error: courseError } = await admin
  .from('courses')
  .upsert(courseRows, { onConflict: 'code' })
  .select('id, code')
if (courseError) throw courseError

const byCode = Object.fromEntries(courses.map((c) => [c.code, c.id]))
const enrollments = [
  ...students.map((s) => ({ course_id: byCode['CS-101'], student_id: s })),
  ...students.slice(0, 3).map((s) => ({ course_id: byCode['CS-205'], student_id: s })),
]
const { error: enrollError } = await admin
  .from('enrollments')
  .upsert(enrollments, { onConflict: 'course_id,student_id', ignoreDuplicates: true })
if (enrollError) throw enrollError

await admin.from('announcements').insert({
  course_id: null,
  author_id: adminId,
  title: 'Welcome to the LMS',
  body: 'Your account was created by the administrator. Please keep your password private.',
  is_pinned: true,
})

console.log('Seed complete.')
console.log(`  admin    ${process.env.ADMIN_EMAIL || 'admin@example.edu'}`)
console.log('  teachers teacher1@example.edu, teacher2@example.edu')
console.log('  students student1..5@example.edu')
console.log(`  password ${password} (admin uses ADMIN_PASSWORD if set)`)

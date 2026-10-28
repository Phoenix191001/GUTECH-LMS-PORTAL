'use client'

import { useRouter } from 'next/navigation'
import { Play, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAction } from '@/hooks/use-action'
import { startAttempt } from '../actions'

/** Starts a new attempt, or resumes the open one (the server never creates two in parallel). */
export function StartQuizButton({ courseId, quizId, resume }: { courseId: string; quizId: string; resume: boolean }) {
  const router = useRouter()
  const { pending, run } = useAction()
  return (
    <Button
      size="lg"
      loading={pending}
      onClick={() =>
        run(() => startAttempt(quizId), {
          onSuccess: (data) => router.push(`/courses/${courseId}/quizzes/${quizId}/attempt/${data.attemptId}`),
          onError: () => router.refresh(),
        })
      }
    >
      {resume ? <RotateCw /> : <Play />} {resume ? 'Resume quiz' : 'Start quiz'}
    </Button>
  )
}

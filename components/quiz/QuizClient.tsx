'use client'

import { useState, useCallback } from 'react'
import { questions, type Question } from '@/lib/quiz/questions'

type Phase = 'start' | 'question' | 'result'

interface Answer {
  questionId: number
  selectedIndex: number
  correct: boolean
}

export function QuizClient() {
  const [phase, setPhase] = useState<Phase>('start')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [showFeedback, setShowFeedback] = useState(false)
  const [sliding, setSliding] = useState(false)

  const current = questions[currentIndex]
  const total = questions.length
  const score = answers.filter((a) => a.correct).length

  function handleStart() {
    setPhase('question')
    setCurrentIndex(0)
    setSelectedIndex(null)
    setShowFeedback(false)
    setSliding(false)
    setAnswers([])
  }

  function handleSelect(index: number) {
    if (selectedIndex !== null) return
    setSelectedIndex(index)
    setAnswers((prev) => [
      ...prev,
      {
        questionId: current.id,
        selectedIndex: index,
        correct: index === current.correctIndex,
      },
    ])
    // Small delay then slide in the feedback
    setTimeout(() => setShowFeedback(true), 300)
  }

  function handleNext() {
    // Slide out both panels
    setSliding(true)
    setTimeout(() => {
      if (currentIndex + 1 >= total) {
        setPhase('result')
      } else {
        setCurrentIndex((i) => i + 1)
        setSelectedIndex(null)
        setShowFeedback(false)
        setSliding(false)
      }
    }, 400)
  }

  function getResultMessage() {
    if (score >= 13) return 'Excelent! Cunoști foarte bine drepturile tale civice.'
    if (score >= 9) return 'Bine! Ai o bază solidă, dar mai sunt lucruri de învățat.'
    if (score >= 5) return 'Un început bun. Explorează platforma pentru a afla mai multe.'
    return 'Nu-i nimic — tocmai de-aia există această platformă!'
  }

  // --- START ---
  if (phase === 'start') {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-civic-blue-50 dark:bg-civic-blue-900/30 text-civic-blue-600 dark:text-civic-blue-400 text-sm font-medium mb-6">
          {total} întrebări
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
          Quiz: Instituții și
          <br />
          <span className="text-civic-blue-500 dark:text-civic-blue-400">
            responsabilități civice
          </span>
        </h1>
        <p className="mt-6 text-lg text-gray-600 dark:text-gray-400 leading-relaxed max-w-lg mx-auto">
          Testează-ți cunoștințele despre Legea 544/2001, instituțiile publice
          din România și drepturile tale ca cetățean.
        </p>
        <button
          onClick={handleStart}
          className="mt-8 px-8 py-3.5 bg-civic-blue-500 text-white font-semibold rounded-md hover:bg-civic-blue-600 transition-colors text-base"
        >
          Începe quiz-ul
        </button>
      </div>
    )
  }

  // --- QUESTION ---
  if (phase === 'question') {
    const answered = selectedIndex !== null
    const isCorrect = selectedIndex === current.correctIndex

    return (
      <div className="max-w-2xl mx-auto">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
            <span className="font-medium text-civic-blue-600 dark:text-civic-blue-400">
              {current.categoryLabel}
            </span>
            <span>
              {currentIndex + 1} / {total}
            </span>
          </div>
          <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-civic-blue-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
            />
          </div>
        </div>

        {/* Slide Stack Container */}
        <div className="relative overflow-hidden">
          {/* Question card — slides left when feedback appears, slides out on next */}
          <div
            className="transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              transform: sliding
                ? 'translateX(-120%)'
                : showFeedback
                  ? 'translateX(-105%) scale(0.95)'
                  : 'translateX(0)',
              opacity: sliding ? 0 : showFeedback ? 0 : 1,
            }}
          >
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white leading-snug mb-6">
              {current.text}
            </h2>
            <div className="space-y-3">
              {current.options.map((option, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  disabled={answered}
                  className="w-full text-left px-5 py-4 rounded-lg border-2 transition-all duration-200 text-base border-gray-200 dark:border-gray-700 hover:border-civic-blue-400 dark:hover:border-civic-blue-500 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 cursor-pointer"
                >
                  <span className="font-medium mr-3 text-sm opacity-60">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Feedback card — slides in from right */}
          {answered && (
            <div
              className="absolute inset-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                transform: sliding
                  ? 'translateX(-120%)'
                  : showFeedback
                    ? 'translateX(0)'
                    : 'translateX(110%)',
                opacity: sliding ? 0 : 1,
              }}
            >
              <div
                className={`rounded-xl border-2 p-8 min-h-[280px] flex flex-col justify-center ${
                  isCorrect
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-red-500 bg-red-50 dark:bg-red-900/20'
                }`}
              >
                {/* Status */}
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold ${
                      isCorrect
                        ? 'bg-green-100 dark:bg-green-800/40 text-green-600 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-800/40 text-red-600 dark:text-red-400'
                    }`}
                  >
                    {isCorrect ? '\u2713' : '\u2717'}
                  </div>
                  <div>
                    <p
                      className={`text-xl font-bold ${
                        isCorrect
                          ? 'text-green-700 dark:text-green-400'
                          : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      {isCorrect ? 'Corect!' : 'Greșit'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {currentIndex + 1} din {total}
                    </p>
                  </div>
                </div>

                {/* Correct answer (shown when wrong) */}
                {!isCorrect && (
                  <div className="mb-4 px-4 py-3 rounded-lg bg-green-100/60 dark:bg-green-800/20 border border-green-300 dark:border-green-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      Răspunsul corect:
                    </p>
                    <p className="font-semibold text-green-800 dark:text-green-300">
                      {current.options[current.correctIndex]}
                    </p>
                  </div>
                )}

                {/* Explanation */}
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-6">
                  {current.explanation}
                </p>

                {/* Next button */}
                <div className="flex justify-end">
                  <button
                    onClick={handleNext}
                    className="px-6 py-3 bg-civic-blue-500 text-white font-semibold rounded-md hover:bg-civic-blue-600 transition-colors"
                  >
                    {currentIndex + 1 >= total
                      ? 'Vezi rezultatul'
                      : 'Următoarea \u2192'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // --- RESULT ---
  const wrongAnswers = answers.filter((a) => !a.correct)

  return (
    <div className="max-w-2xl mx-auto">
      {/* Score */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-civic-blue-50 dark:bg-civic-blue-900/30 mb-6">
          <span className="text-3xl font-bold text-civic-blue-600 dark:text-civic-blue-400">
            {score}/{total}
          </span>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3">
          Rezultatul tău
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          {getResultMessage()}
        </p>
      </div>

      {/* Wrong answers review */}
      {wrongAnswers.length > 0 && (
        <div className="mb-10">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">
            Unde ai greșit
          </h3>
          <div className="space-y-4">
            {wrongAnswers.map((a) => {
              const q = questions.find((q) => q.id === a.questionId)!
              return (
                <div
                  key={a.questionId}
                  className="p-5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                >
                  <p className="font-medium text-gray-900 dark:text-white mb-2">
                    {q.text}
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400 mb-1">
                    Răspunsul tău: {q.options[a.selectedIndex]}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400 mb-2">
                    Corect: {q.options[q.correctIndex]}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {q.explanation}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={handleStart}
          className="px-6 py-3 bg-civic-blue-500 text-white font-semibold rounded-md hover:bg-civic-blue-600 transition-colors"
        >
          Reia quiz-ul
        </button>
        <a
          href="/"
          className="px-6 py-3 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-md hover:border-civic-blue-400 transition-colors text-center"
        >
          Înapoi la pagina principală
        </a>
      </div>
    </div>
  )
}

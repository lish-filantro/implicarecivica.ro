'use client'

import { useState } from 'react'
import { questions } from '@/lib/quiz/questions'

type Phase = 'start' | 'question' | 'result'
// After selecting: 'selected' briefly, then 'revealed' shows explanation
type AnswerPhase = 'idle' | 'selected' | 'revealed'

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
  const [answerPhase, setAnswerPhase] = useState<AnswerPhase>('idle')
  const [exiting, setExiting] = useState(false)

  const current = questions[currentIndex]
  const total = questions.length
  const score = answers.filter((a) => a.correct).length

  function handleStart() {
    setPhase('question')
    setCurrentIndex(0)
    setSelectedIndex(null)
    setAnswerPhase('idle')
    setExiting(false)
    setAnswers([])
  }

  function handleSelect(index: number) {
    if (answerPhase !== 'idle') return
    setSelectedIndex(index)
    setAnswerPhase('selected')
    setAnswers((prev) => [
      ...prev,
      {
        questionId: current.id,
        selectedIndex: index,
        correct: index === current.correctIndex,
      },
    ])
    // After options collapse, reveal explanation
    setTimeout(() => setAnswerPhase('revealed'), 500)
  }

  function handleNext() {
    setExiting(true)
    setTimeout(() => {
      if (currentIndex + 1 >= total) {
        setPhase('result')
      } else {
        setCurrentIndex((i) => i + 1)
        setSelectedIndex(null)
        setAnswerPhase('idle')
        setExiting(false)
      }
    }, 350)
  }

  function getResultMessage() {
    if (score >= 13)
      return 'Excelent! Cunoști foarte bine drepturile tale civice.'
    if (score >= 9)
      return 'Bine! Ai o bază solidă, dar mai sunt lucruri de învățat.'
    if (score >= 5)
      return 'Un început bun. Explorează platforma pentru a afla mai multe.'
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
    const isCorrect =
      selectedIndex !== null && selectedIndex === current.correctIndex

    return (
      <div
        className="max-w-2xl mx-auto transition-all duration-300"
        style={{
          opacity: exiting ? 0 : 1,
          transform: exiting ? 'translateY(-20px)' : 'translateY(0)',
        }}
      >
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

        {/* Question text */}
        <h2
          className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white leading-snug mb-6 transition-opacity duration-300"
          style={{ opacity: answerPhase === 'revealed' ? 0.4 : 1 }}
        >
          {current.text}
        </h2>

        {/* Options */}
        <div className="space-y-3">
          {current.options.map((option, i) => {
            const isSelected = selectedIndex === i
            const isCorrectOption = i === current.correctIndex
            const idle = answerPhase === 'idle'
            const selected = answerPhase === 'selected'
            const revealed = answerPhase === 'revealed'
            const otherOption =
              !isSelected && !isCorrectOption && !idle

            // Determine styles per phase
            let containerStyle: React.CSSProperties = {}
            let classes =
              'w-full text-left px-5 py-4 rounded-lg border-2 text-base transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] origin-center'

            if (idle) {
              // Default interactive state
              classes +=
                ' border-gray-200 dark:border-gray-700 hover:border-civic-blue-400 dark:hover:border-civic-blue-500 hover:shadow-md bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 cursor-pointer'
            } else if (isSelected && isCorrectOption) {
              // Selected AND correct — grow into hero
              classes +=
                ' border-green-500 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200'
              if (revealed) {
                containerStyle = { transform: 'scale(1.02)' }
              }
            } else if (isSelected && !isCorrectOption) {
              // Selected but wrong — shrink with red
              classes +=
                ' border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
              if (revealed) {
                containerStyle = {
                  opacity: 0.6,
                  transform: 'scale(0.97)',
                }
              }
            } else if (isCorrectOption) {
              // Not selected but IS the correct answer — highlight it
              classes +=
                ' border-green-500 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200'
              if (revealed) {
                containerStyle = { transform: 'scale(1.02)' }
              }
            } else {
              // Other wrong options — collapse away
              classes +=
                ' border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500'
              if (selected) {
                containerStyle = { opacity: 0.5, transform: 'scale(0.97)' }
              }
              if (revealed) {
                containerStyle = {
                  opacity: 0,
                  maxHeight: 0,
                  marginTop: 0,
                  padding: 0,
                  border: 'none',
                  overflow: 'hidden',
                  transform: 'scale(0.9)',
                }
              }
            }

            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={!idle}
                className={classes}
                style={{
                  ...containerStyle,
                  transitionProperty:
                    'all',
                  transitionDuration: revealed ? '500ms' : '300ms',
                  transitionTimingFunction:
                    'cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium mr-3 text-sm opacity-60">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    {option}
                  </div>
                  {/* Indicator icons after selection */}
                  {!idle && isCorrectOption && (
                    <span className="ml-3 text-green-600 dark:text-green-400 font-bold text-lg flex-shrink-0">
                      &#x2713;
                    </span>
                  )}
                  {!idle && isSelected && !isCorrectOption && (
                    <span className="ml-3 text-red-500 dark:text-red-400 font-bold text-lg flex-shrink-0">
                      &#x2717;
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Explanation — grows in below the surviving options */}
        <div
          className="overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            maxHeight: answerPhase === 'revealed' ? '300px' : '0px',
            opacity: answerPhase === 'revealed' ? 1 : 0,
            marginTop: answerPhase === 'revealed' ? '24px' : '0px',
          }}
        >
          <div
            className={`p-5 rounded-lg border-l-4 ${
              isCorrect
                ? 'border-green-500 bg-green-50/50 dark:bg-green-900/10'
                : 'border-red-500 bg-red-50/50 dark:bg-red-900/10'
            }`}
          >
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {current.explanation}
            </p>
          </div>

          {/* Next button */}
          <div className="mt-5 flex justify-end">
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

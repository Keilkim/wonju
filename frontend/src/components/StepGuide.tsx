'use client'

interface StepGuideProps {
  stepNumber: number
  currentStep: number
  title: string
  instruction: string
}

export function StepGuide({ stepNumber, currentStep, title, instruction }: StepGuideProps) {
  const isActive = currentStep === stepNumber
  const isCompleted = currentStep > stepNumber
  const isPending = currentStep < stepNumber

  if (isPending) {
    return (
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 mb-4">
        <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
          {stepNumber}
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-400">{title}</div>
          <div className="text-xs text-gray-400">이전 단계를 먼저 완료해주세요</div>
        </div>
      </div>
    )
  }

  if (isCompleted) {
    return (
      <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200 mb-4">
        <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-green-700">{title}</div>
          <div className="text-xs text-green-600">완료</div>
        </div>
      </div>
    )
  }

  // isActive
  return (
    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border-2 border-blue-400 mb-4">
      <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm flex-shrink-0 ring-4 ring-blue-200">
        {stepNumber}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-blue-700">{title}</div>
        <div className="text-xs text-blue-600">{instruction}</div>
      </div>
      <div className="flex-shrink-0">
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 animate-pulse">
          현재 단계
        </span>
      </div>
    </div>
  )
}

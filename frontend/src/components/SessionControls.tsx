'use client'

import { useState } from 'react'
import { ConnectionStatus } from '@/lib/types'
import { StepGuide } from './StepGuide'

interface SessionControlsProps {
  connectionStatus: ConnectionStatus
  isAnalyzing: boolean
  latency: number
  currentStep: number
  onStartSession: (dogId: string, notes: string) => void
  onEndSession: () => void
  onConnect: () => void
  onDisconnect: () => void
}

export function SessionControls({
  connectionStatus,
  isAnalyzing,
  latency,
  currentStep,
  onStartSession,
  onEndSession,
  onConnect,
  onDisconnect
}: SessionControlsProps) {
  const [dogId, setDogId] = useState('')
  const [notes, setNotes] = useState('')

  const handleStart = () => {
    if (!dogId.trim()) {
      alert('Please enter a dog ID')
      return
    }
    onStartSession(dogId.trim(), notes.trim())
  }

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'connected'
      case 'connecting': return 'connecting'
      default: return 'disconnected'
    }
  }

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected'
      case 'connecting': return 'Connecting...'
      case 'error': return 'Error'
      default: return 'Disconnected'
    }
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Session Control</h2>

      {/* Step 1: Connect */}
      <StepGuide
        stepNumber={1}
        currentStep={currentStep}
        title="Step 1: 서버 연결"
        instruction="아래 Connect 버튼을 눌러 분석 서버에 연결하세요"
      />

      {/* Connection status */}
      <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <span className={`status-indicator ${getStatusColor()}`} />
          <span className="text-sm">{getStatusText()}</span>
        </div>
        {connectionStatus === 'connected' && (
          <span className="text-xs text-gray-500">
            Latency: {latency}ms
          </span>
        )}
      </div>

      {/* Connection buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={onConnect}
          disabled={connectionStatus === 'connected' || connectionStatus === 'connecting'}
          className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
        >
          Connect
        </button>
        <button
          onClick={onDisconnect}
          disabled={connectionStatus === 'disconnected'}
          className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
        >
          Disconnect
        </button>
      </div>

      {/* Step 3: Start Session */}
      <StepGuide
        stepNumber={3}
        currentStep={currentStep}
        title="Step 3: 세션 시작"
        instruction="반려견 정보를 입력하고 분석을 시작하세요"
      />

      {/* Session form */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dog ID
          </label>
          <input
            type="text"
            value={dogId}
            onChange={(e) => setDogId(e.target.value)}
            placeholder="e.g., dog-001"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            disabled={isAnalyzing}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Session notes..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            disabled={isAnalyzing}
          />
        </div>

        {!isAnalyzing ? (
          <button
            onClick={handleStart}
            disabled={connectionStatus !== 'connected'}
            className="w-full px-4 py-3 bg-secondary text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-green-600 transition-colors"
          >
            Start Analysis Session
          </button>
        ) : (
          <button
            onClick={onEndSession}
            className="w-full px-4 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
          >
            End Session
          </button>
        )}
      </div>

      {isAnalyzing && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="status-indicator connected" />
            <span className="text-sm text-green-700 font-medium">
              Session in progress
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

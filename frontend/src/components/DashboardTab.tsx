'use client'

import { VideoStream } from './VideoStream'
import { JointAngleChart } from './JointAngleChart'
import { GaitAnalysis } from './GaitAnalysis'
import { TrajectoryCanvas } from './TrajectoryCanvas'
import { ProgressChart } from './ProgressChart'
import { SessionHistory } from './SessionHistory'
import {
  DogKeypoints,
  JointAngles,
  GaitMetrics,
  TrajectoryPoint,
  Session,
  DetectionMode,
} from '@/lib/types'

interface DashboardTabProps {
  // Session info
  dogId: string
  notes: string
  isAnalyzing: boolean
  isConnected: boolean
  detectionMode: DetectionMode

  // Analysis data
  keypoints: DogKeypoints | null
  jointAngleHistory: Array<{ timestamp: number; angles: JointAngles }>
  gaitMetrics: GaitMetrics | null
  trajectories: {
    left_front: TrajectoryPoint[]
    right_front: TrajectoryPoint[]
    left_back: TrajectoryPoint[]
    right_back: TrajectoryPoint[]
  }
  sessions: Session[]

  // Actions
  onFrame: (frame: string) => void
  onStartSession: () => void
  onEndSession: () => void
  onLoadSession: (session: Session) => void
  onDeleteSession: (sessionId: string) => void
  onGoToSettings: () => void
}

export function DashboardTab({
  dogId,
  notes,
  isAnalyzing,
  isConnected,
  detectionMode,
  keypoints,
  jointAngleHistory,
  gaitMetrics,
  trajectories,
  sessions,
  onFrame,
  onStartSession,
  onEndSession,
  onLoadSession,
  onDeleteSession,
  onGoToSettings
}: DashboardTabProps) {
  const canStartAnalysis = isConnected && dogId.trim().length > 0

  return (
    <div className="space-y-6">
      {/* Analysis Control Bar */}
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Session Info */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`} />
              <span className="text-sm font-medium">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="h-6 w-px bg-gray-200" />
            <div className="text-sm">
              <span className="text-gray-500">반려견:</span>{' '}
              <span className="font-medium">{dogId || '-'}</span>
            </div>
            {/* Detection mode badge */}
            <div className="h-6 w-px bg-gray-200" />
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              detectionMode === 'color_marker'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {detectionMode === 'color_marker' ? '컬러 마커' : 'AI 포즈'}
            </span>
            {notes && (
              <>
                <div className="h-6 w-px bg-gray-200" />
                <div className="text-sm text-gray-500 max-w-xs truncate">
                  {notes}
                </div>
              </>
            )}
          </div>

          {/* Control Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={onGoToSettings}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
            >
              설정 변경
            </button>

            {!isAnalyzing ? (
              <button
                onClick={onStartSession}
                disabled={!canStartAnalysis}
                className="px-6 py-2 bg-secondary text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-green-600 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                분석 시작
              </button>
            ) : (
              <button
                onClick={onEndSession}
                className="px-6 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" />
                </svg>
                분석 중지
              </button>
            )}
          </div>
        </div>

        {/* Warning if not ready */}
        {!canStartAnalysis && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
            분석을 시작하려면 먼저 설정 탭에서 서버 연결과 반려견 정보를 입력해주세요.
          </div>
        )}

        {/* Analyzing indicator */}
        {isAnalyzing && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="status-indicator connected animate-pulse" />
              <span className="text-sm text-green-700 font-medium">
                분석 진행 중...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Video & Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Video Feed */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">실시간 영상</h3>
            <VideoStream
              onFrame={onFrame}
              keypoints={keypoints}
              isAnalyzing={isAnalyzing}
              detectionMode={detectionMode}
            />
          </div>

          {/* Analysis Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <JointAngleChart data={jointAngleHistory} detectionMode={detectionMode} />
            <TrajectoryCanvas trajectories={trajectories} />
          </div>
        </div>

        {/* Right: Metrics & History */}
        <div className="space-y-6">
          <GaitAnalysis metrics={gaitMetrics} />
          <ProgressChart sessions={sessions} />
          <SessionHistory
            sessions={sessions}
            onLoad={onLoadSession}
            onDelete={onDeleteSession}
          />
        </div>
      </div>
    </div>
  )
}

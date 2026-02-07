'use client'

import { useState, useCallback, useEffect } from 'react'
import { SettingsTab } from '@/components/SettingsTab'
import { DashboardTab } from '@/components/DashboardTab'
import { useWebSocket } from '@/hooks/useWebSocket'
import {
  AnalysisResult,
  DogKeypoints,
  JointAngles,
  GaitMetrics,
  TrajectoryPoint,
  Session
} from '@/lib/types'
import { createSession, endSession, getSessionHistory, deleteSession, getSessionResults } from '@/lib/supabase'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws'

type MainTab = 'settings' | 'dashboard'
type VideoSource = 'camera' | 'upload'

export default function Dashboard() {
  // Main tab state
  const [mainTab, setMainTab] = useState<MainTab>('settings')

  // Settings state
  const [dogId, setDogId] = useState('')
  const [notes, setNotes] = useState('')
  const [videoSource, setVideoSource] = useState<VideoSource>('camera')
  const [isPreviewing, setIsPreviewing] = useState(true)

  // Session state
  const [currentSession, setCurrentSession] = useState<{ id: string; dogId: string } | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])

  // Analysis data
  const [currentKeypoints, setCurrentKeypoints] = useState<DogKeypoints | null>(null)
  const [jointAngleHistory, setJointAngleHistory] = useState<Array<{ timestamp: number; angles: JointAngles }>>([])
  const [currentGaitMetrics, setCurrentGaitMetrics] = useState<GaitMetrics | null>(null)
  const [trajectories, setTrajectories] = useState({
    left_front: [] as TrajectoryPoint[],
    right_front: [] as TrajectoryPoint[],
    left_back: [] as TrajectoryPoint[],
    right_back: [] as TrajectoryPoint[],
  })

  // Handle analysis results from WebSocket
  const handleResult = useCallback((result: AnalysisResult) => {
    if (!result) return

    // Update keypoints (always, for preview and analysis)
    if (result.keypoints) {
      setCurrentKeypoints(result.keypoints)

      // Only update trajectories when analyzing (not previewing)
      if (isAnalyzing) {
        const kp = result.keypoints as unknown as Record<string, { x: number; y: number; confidence: number }>
        const ts = result.timestamp

        setTrajectories(prev => ({
          left_front: [...prev.left_front.slice(-199), { x: kp.left_front_paw?.x || 0, y: kp.left_front_paw?.y || 0, timestamp: ts }],
          right_front: [...prev.right_front.slice(-199), { x: kp.right_front_paw?.x || 0, y: kp.right_front_paw?.y || 0, timestamp: ts }],
          left_back: [...prev.left_back.slice(-199), { x: kp.left_back_paw?.x || 0, y: kp.left_back_paw?.y || 0, timestamp: ts }],
          right_back: [...prev.right_back.slice(-199), { x: kp.right_back_paw?.x || 0, y: kp.right_back_paw?.y || 0, timestamp: ts }],
        }))
      }
    }

    // Update joint angles (only when analyzing)
    if (result.joint_angles && isAnalyzing) {
      setJointAngleHistory(prev => [
        ...prev.slice(-99),
        { timestamp: result.timestamp, angles: result.joint_angles! }
      ])
    }

    // Update gait metrics (only when analyzing)
    if (result.gait_metrics && isAnalyzing) {
      setCurrentGaitMetrics(result.gait_metrics)
    }
  }, [isAnalyzing])

  // WebSocket connection
  const {
    status: connectionStatus,
    latency,
    connect,
    disconnect,
    sendFrame,
    isConnected
  } = useWebSocket({
    url: WS_URL,
    onResult: handleResult,
    onError: (error) => console.error('WebSocket error:', error)
  })

  // Load session history when dogId changes
  useEffect(() => {
    if (dogId.trim()) {
      getSessionHistory(dogId.trim())
        .then(setSessions)
        .catch(console.error)
    }
  }, [dogId])

  // Handle frame for preview (in settings) or analysis (in dashboard)
  const handleFrame = useCallback((frame: string) => {
    if (isConnected) {
      sendFrame(frame)
    }
  }, [isConnected, sendFrame])

  // Start new session
  const handleStartSession = useCallback(async () => {
    if (!dogId.trim()) return

    try {
      const session = await createSession(dogId.trim(), notes.trim())
      setCurrentSession({ id: session.id, dogId: dogId.trim() })
      setIsAnalyzing(true)

      // Clear previous data
      setJointAngleHistory([])
      setCurrentGaitMetrics(null)
      setCurrentKeypoints(null)
      setTrajectories({
        left_front: [],
        right_front: [],
        left_back: [],
        right_back: [],
      })
    } catch (error) {
      console.error('Failed to create session:', error)
      // Continue without Supabase for demo
      setCurrentSession({ id: 'local-' + Date.now(), dogId: dogId.trim() })
      setIsAnalyzing(true)
    }
  }, [dogId, notes])

  // End current session
  const handleEndSession = useCallback(async () => {
    if (currentSession && currentGaitMetrics) {
      try {
        await endSession(currentSession.id, currentGaitMetrics)
        // Refresh session history
        const history = await getSessionHistory(currentSession.dogId)
        setSessions(history)
      } catch (error) {
        console.error('Failed to end session:', error)
      }
    }

    setIsAnalyzing(false)
    setCurrentSession(null)
  }, [currentSession, currentGaitMetrics])

  // Load session from history
  const handleLoadSession = useCallback(async (session: Session) => {
    try {
      const results = await getSessionResults(session.id)

      setJointAngleHistory([])
      setTrajectories({
        left_front: [],
        right_front: [],
        left_back: [],
        right_back: [],
      })

      setCurrentSession({ id: session.id, dogId: session.dog_id })
      setDogId(session.dog_id)

      if (session.metrics_summary) {
        setCurrentGaitMetrics(session.metrics_summary)
      }

      if (results && results.length > 0) {
        const angleHistory: Array<{ timestamp: number; angles: JointAngles }> = []

        results.forEach((result: { timestamp: string; joint_angles?: JointAngles; keypoints_json?: DogKeypoints }) => {
          if (result.joint_angles) {
            angleHistory.push({
              timestamp: new Date(result.timestamp).getTime(),
              angles: result.joint_angles
            })
          }
          if (result.keypoints_json) {
            setCurrentKeypoints(result.keypoints_json)
          }
        })

        setJointAngleHistory(angleHistory)
      }

      setIsAnalyzing(false)
      setMainTab('dashboard')
    } catch (error) {
      console.error('Failed to load session:', error)
    }
  }, [])

  // Delete session from history
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    try {
      await deleteSession(sessionId)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  }, [])

  // Navigate to dashboard when settings complete
  const handleSettingsComplete = useCallback(() => {
    setMainTab('dashboard')
  }, [])

  // Navigate to settings
  const handleGoToSettings = useCallback(() => {
    setMainTab('settings')
  }, [])

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header with Tabs */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Running Dog Analysis
              </h1>
            </div>

            {/* Main Tabs */}
            <div className="flex">
              <button
                onClick={() => setMainTab('settings')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  mainTab === 'settings'
                    ? 'text-primary border-primary'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  설정
                </span>
              </button>
              <button
                onClick={() => setMainTab('dashboard')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  mainTab === 'dashboard'
                    ? 'text-primary border-primary'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  분석 대시보드
                  {isAnalyzing && (
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4 lg:p-6">
        {mainTab === 'settings' ? (
          <SettingsTab
            connectionStatus={connectionStatus}
            latency={latency}
            isConnected={isConnected}
            dogId={dogId}
            notes={notes}
            videoSource={videoSource}
            keypoints={currentKeypoints}
            isPreviewing={isPreviewing}
            onConnect={connect}
            onDisconnect={disconnect}
            onDogIdChange={setDogId}
            onNotesChange={setNotes}
            onVideoSourceChange={setVideoSource}
            onPreviewFrame={handleFrame}
            onSettingsComplete={handleSettingsComplete}
          />
        ) : (
          <DashboardTab
            dogId={dogId}
            notes={notes}
            isAnalyzing={isAnalyzing}
            isConnected={isConnected}
            videoSource={videoSource}
            keypoints={currentKeypoints}
            jointAngleHistory={jointAngleHistory}
            gaitMetrics={currentGaitMetrics}
            trajectories={trajectories}
            sessions={sessions}
            onFrame={handleFrame}
            onStartSession={handleStartSession}
            onEndSession={handleEndSession}
            onLoadSession={handleLoadSession}
            onDeleteSession={handleDeleteSession}
            onGoToSettings={handleGoToSettings}
          />
        )}
      </div>

      {/* Footer */}
      <footer className="mt-8 py-4 border-t border-gray-200 text-center text-sm text-gray-500">
        Running Dog Analysis - Real-time Analysis System
      </footer>
    </main>
  )
}

'use client'

import { useState, useCallback, useEffect } from 'react'
import { VideoStream } from '@/components/VideoStream'
import { JointAngleChart } from '@/components/JointAngleChart'
import { GaitAnalysis } from '@/components/GaitAnalysis'
import { TrajectoryCanvas } from '@/components/TrajectoryCanvas'
import { ProgressChart } from '@/components/ProgressChart'
import { SessionControls } from '@/components/SessionControls'
import { useWebSocket } from '@/hooks/useWebSocket'
import {
  AnalysisResult,
  DogKeypoints,
  JointAngles,
  GaitMetrics,
  TrajectoryPoint,
  Session
} from '@/lib/types'
import { createSession, endSession, getSessionHistory } from '@/lib/supabase'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws'

export default function Dashboard() {
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

    // Update keypoints
    if (result.keypoints) {
      setCurrentKeypoints(result.keypoints)

      // Update trajectories from paw positions
      const kp = result.keypoints as unknown as Record<string, { x: number; y: number; confidence: number }>
      const ts = result.timestamp

      setTrajectories(prev => ({
        left_front: [...prev.left_front.slice(-199), { x: kp.left_front_paw?.x || 0, y: kp.left_front_paw?.y || 0, timestamp: ts }],
        right_front: [...prev.right_front.slice(-199), { x: kp.right_front_paw?.x || 0, y: kp.right_front_paw?.y || 0, timestamp: ts }],
        left_back: [...prev.left_back.slice(-199), { x: kp.left_back_paw?.x || 0, y: kp.left_back_paw?.y || 0, timestamp: ts }],
        right_back: [...prev.right_back.slice(-199), { x: kp.right_back_paw?.x || 0, y: kp.right_back_paw?.y || 0, timestamp: ts }],
      }))
    }

    // Update joint angles
    if (result.joint_angles) {
      setJointAngleHistory(prev => [
        ...prev.slice(-99),
        { timestamp: result.timestamp, angles: result.joint_angles! }
      ])
    }

    // Update gait metrics
    if (result.gait_metrics) {
      setCurrentGaitMetrics(result.gait_metrics)
    }
  }, [])

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

  // Load session history
  useEffect(() => {
    if (currentSession?.dogId) {
      getSessionHistory(currentSession.dogId)
        .then(setSessions)
        .catch(console.error)
    }
  }, [currentSession?.dogId])

  // Start new session
  const handleStartSession = useCallback(async (dogId: string, notes: string) => {
    try {
      const session = await createSession(dogId, notes)
      setCurrentSession({ id: session.id, dogId })
      setIsAnalyzing(true)

      // Clear previous data
      setJointAngleHistory([])
      setCurrentGaitMetrics(null)
      setTrajectories({
        left_front: [],
        right_front: [],
        left_back: [],
        right_back: [],
      })
    } catch (error) {
      console.error('Failed to create session:', error)
      // Continue without Supabase for demo
      setCurrentSession({ id: 'local-' + Date.now(), dogId })
      setIsAnalyzing(true)
    }
  }, [])

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

  // Handle frame from camera
  const handleFrame = useCallback((frame: string) => {
    if (isConnected && isAnalyzing) {
      sendFrame(frame)
    }
  }, [isConnected, isAnalyzing, sendFrame])

  return (
    <main className="min-h-screen p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            Dog Rehabilitation Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Real-time underwater treadmill analysis
          </p>
        </header>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Left column - Video and controls */}
          <div className="lg:col-span-2 space-y-4 lg:space-y-6">
            <VideoStream
              onFrame={handleFrame}
              keypoints={currentKeypoints}
              isAnalyzing={isAnalyzing}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
              <JointAngleChart data={jointAngleHistory} />
              <TrajectoryCanvas trajectories={trajectories} />
            </div>
          </div>

          {/* Right column - Controls and metrics */}
          <div className="space-y-4 lg:space-y-6">
            <SessionControls
              connectionStatus={connectionStatus}
              isAnalyzing={isAnalyzing}
              latency={latency}
              onStartSession={handleStartSession}
              onEndSession={handleEndSession}
              onConnect={connect}
              onDisconnect={disconnect}
            />

            <GaitAnalysis metrics={currentGaitMetrics} />

            <ProgressChart sessions={sessions} />
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 pt-4 border-t border-gray-200 text-center text-sm text-gray-500">
          Dog Rehab Dashboard - Real-time Analysis System
        </footer>
      </div>
    </main>
  )
}

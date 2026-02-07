'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { VideoStream } from '@/components/VideoStream'
import { VideoUpload } from '@/components/VideoUpload'
import { JointAngleChart } from '@/components/JointAngleChart'
import { GaitAnalysis } from '@/components/GaitAnalysis'
import { TrajectoryCanvas } from '@/components/TrajectoryCanvas'
import { ProgressChart } from '@/components/ProgressChart'
import { SessionControls } from '@/components/SessionControls'
import { Stepper } from '@/components/Stepper'
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

const STEPS = [
  { number: 1, title: 'Connect', description: 'Connect to server' },
  { number: 2, title: 'Select Source', description: 'Camera or video' },
  { number: 3, title: 'Start Session', description: 'Enter dog info' },
  { number: 4, title: 'Analyze', description: 'View results' },
]

type VideoSource = 'camera' | 'upload'

export default function Dashboard() {
  // Video source tab
  const [videoSource, setVideoSource] = useState<VideoSource>('camera')

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

  // Calculate current step
  const currentStep = useMemo(() => {
    if (!isConnected) return 1
    if (!isAnalyzing) return 2
    if (jointAngleHistory.length === 0) return 3
    return 4
  }, [isConnected, isAnalyzing, jointAngleHistory.length])

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

  // Handle frame from camera or video
  const handleFrame = useCallback((frame: string) => {
    if (isConnected && isAnalyzing) {
      sendFrame(frame)
    }
  }, [isConnected, isAnalyzing, sendFrame])

  return (
    <main className="min-h-screen p-4 lg:p-6 bg-gradient-to-b from-gray-50 to-white">
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

        {/* Stepper */}
        <Stepper steps={STEPS} currentStep={currentStep} />

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Left column - Video and controls */}
          <div className="lg:col-span-2 space-y-4 lg:space-y-6">
            {/* Video Source Tabs */}
            <div className="card">
              <div className="flex border-b border-gray-200 mb-4">
                <button
                  onClick={() => setVideoSource('camera')}
                  className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
                    videoSource === 'camera'
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Live Camera
                  </span>
                </button>
                <button
                  onClick={() => setVideoSource('upload')}
                  className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
                    videoSource === 'upload'
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload Video
                  </span>
                </button>
              </div>

              {/* Video content based on selected tab */}
              <div className="p-0">
                {videoSource === 'camera' ? (
                  <VideoStream
                    onFrame={handleFrame}
                    keypoints={currentKeypoints}
                    isAnalyzing={isAnalyzing}
                  />
                ) : (
                  <VideoUpload
                    onFrame={handleFrame}
                    isAnalyzing={isAnalyzing}
                  />
                )}
              </div>
            </div>

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

'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useCamera } from '@/hooks/useCamera'
import { DogKeypoints } from '@/lib/types'

interface VideoStreamProps {
  onFrame?: (frame: string) => void
  keypoints?: DogKeypoints | null
  isAnalyzing: boolean
}

// Keypoint connections for skeleton drawing
const SKELETON_CONNECTIONS = [
  ['nose', 'left_eye'], ['nose', 'right_eye'],
  ['left_eye', 'left_ear'], ['right_eye', 'right_ear'],
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'], ['right_knee', 'right_ankle'],
  ['tail_base', 'tail_mid'], ['tail_mid', 'tail_tip'],
  ['left_wrist', 'left_front_paw'], ['right_wrist', 'right_front_paw'],
  ['left_ankle', 'left_back_paw'], ['right_ankle', 'right_back_paw'],
]

export function VideoStream({ onFrame, keypoints, isAnalyzing }: VideoStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [selectedDevice, setSelectedDevice] = useState<string>('')

  const {
    isStreaming,
    error,
    devices,
    startCamera,
    stopCamera,
    startCapture,
    stopCapture,
    setVideoElement,
    setCanvasElement,
    getDevices
  } = useCamera({ fps: 8 })

  useEffect(() => {
    if (videoRef.current) setVideoElement(videoRef.current)
    if (canvasRef.current) setCanvasElement(canvasRef.current)
  }, [setVideoElement, setCanvasElement])

  // Handle start/stop
  const handleToggle = useCallback(async () => {
    if (isStreaming) {
      stopCapture()
      stopCamera()
    } else {
      await startCamera(selectedDevice || undefined)
    }
  }, [isStreaming, selectedDevice, startCamera, stopCamera, stopCapture])

  // Start frame capture when streaming and analyzing
  useEffect(() => {
    if (isStreaming && isAnalyzing && onFrame) {
      startCapture(onFrame)
    } else {
      stopCapture()
    }
  }, [isStreaming, isAnalyzing, onFrame, startCapture, stopCapture])

  // Draw keypoints overlay
  useEffect(() => {
    if (!overlayRef.current || !keypoints) return

    const canvas = overlayRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear previous frame
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const kp = keypoints as unknown as Record<string, { x: number; y: number; confidence: number }>

    // Draw skeleton connections
    ctx.strokeStyle = '#10B981'
    ctx.lineWidth = 2
    for (const [start, end] of SKELETON_CONNECTIONS) {
      const p1 = kp[start]
      const p2 = kp[end]
      if (p1?.confidence > 0.5 && p2?.confidence > 0.5) {
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
      }
    }

    // Draw keypoints
    for (const [name, point] of Object.entries(kp)) {
      if (point.confidence > 0.5) {
        ctx.beginPath()
        ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI)
        ctx.fillStyle = name.includes('left') ? '#3B82F6' :
                        name.includes('right') ? '#EF4444' : '#8B5CF6'
        ctx.fill()
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }
  }, [keypoints])

  return (
    <div>
      {/* Status indicator */}
      {isStreaming && (
        <div className="flex items-center gap-1 text-sm text-green-600 mb-3">
          <span className="status-indicator connected" />
          Streaming
        </div>
      )}

      {/* Camera selection */}
      <div className="flex gap-2 mb-4">
        <select
          className="flex-1 px-3 py-2 border rounded-lg text-sm"
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
          onClick={getDevices}
        >
          <option value="">Default Camera</option>
          {devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>
        <button
          onClick={handleToggle}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            isStreaming
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-primary hover:bg-blue-600 text-white'
          }`}
        >
          {isStreaming ? 'Stop' : 'Start'}
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Video container */}
      <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain"
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="hidden"
        />
        <canvas
          ref={overlayRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          width={640}
          height={480}
        />

        {!isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p>Click Start to begin</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

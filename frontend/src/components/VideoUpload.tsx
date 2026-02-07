'use client'

import { useState, useRef, useCallback } from 'react'

interface VideoUploadProps {
  onFrame: (frame: string) => void
  isAnalyzing: boolean
}

export function VideoUpload({ onFrame, isAnalyzing }: VideoUploadProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file)
      setProgress(0)
      setIsPlaying(false)

      if (videoRef.current) {
        videoRef.current.src = URL.createObjectURL(file)
      }
    }
  }

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    return canvas.toDataURL('image/jpeg', 0.7)
  }, [])

  const startAnalysis = useCallback(() => {
    if (!videoRef.current || !isAnalyzing) return

    const video = videoRef.current
    video.currentTime = 0
    video.play()
    setIsPlaying(true)

    // Capture frames at ~8 fps
    intervalRef.current = setInterval(() => {
      if (video.ended || video.paused) {
        stopAnalysis()
        return
      }

      const frame = captureFrame()
      if (frame) {
        onFrame(frame)
      }

      setProgress((video.currentTime / video.duration) * 100)
    }, 125)
  }, [isAnalyzing, captureFrame, onFrame])

  const stopAnalysis = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.pause()
    }

    setIsPlaying(false)
  }, [])

  const handleVideoEnd = () => {
    stopAnalysis()
    setProgress(100)
  }

  return (
    <div>
      {/* Status indicator */}
      {isPlaying && (
        <div className="flex items-center gap-1 text-sm text-green-600 mb-3">
          <span className="status-indicator connected" />
          Analyzing...
        </div>
      )}

      {/* File input */}
      <div className="mb-4">
        <label className="block w-full">
          <div className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            videoFile ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-primary'
          }`}>
            {videoFile ? (
              <div>
                <svg className="w-8 h-8 mx-auto text-green-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm font-medium text-green-700">{videoFile.name}</p>
                <p className="text-xs text-gray-500 mt-1">Click to change file</p>
              </div>
            ) : (
              <div>
                <svg className="w-10 h-10 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm text-gray-600">Drop video file or click to upload</p>
                <p className="text-xs text-gray-400 mt-1">MP4, MOV, AVI supported</p>
              </div>
            )}
          </div>
          <input
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="hidden"
            disabled={isPlaying}
          />
        </label>
      </div>

      {/* Video preview */}
      <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden mb-4">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain"
          muted
          playsInline
          onEnded={handleVideoEnd}
        />
        <canvas ref={canvasRef} className="hidden" />

        {!videoFile && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p>Upload a video to analyze</p>
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {videoFile && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Control buttons */}
      <div className="flex gap-2">
        {!isPlaying ? (
          <button
            onClick={startAnalysis}
            disabled={!videoFile || !isAnalyzing}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
          >
            Start Analysis
          </button>
        ) : (
          <button
            onClick={stopAnalysis}
            className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
          >
            Stop
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500 mt-3 text-center">
        Video is processed locally and not stored on server
      </p>
    </div>
  )
}

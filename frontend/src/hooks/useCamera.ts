'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

interface UseCameraOptions {
  width?: number
  height?: number
  fps?: number
  facingMode?: 'user' | 'environment'
}

export function useCamera({
  width = 640,
  height = 480,
  fps = 10,
  facingMode = 'environment'
}: UseCameraOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Get available cameras
  const getDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = allDevices.filter(device => device.kind === 'videoinput')
      setDevices(videoDevices)
    } catch (e) {
      console.error('Failed to enumerate devices:', e)
    }
  }, [])

  // Start camera stream
  const startCamera = useCallback(async (deviceId?: string) => {
    try {
      setError(null)

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: width },
          height: { ideal: height },
          facingMode: deviceId ? undefined : facingMode,
          deviceId: deviceId ? { exact: deviceId } : undefined
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setIsStreaming(true)
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to access camera'
      setError(errorMessage)
      setIsStreaming(false)
    }
  }, [width, height, facingMode])

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setIsStreaming(false)
  }, [])

  // Capture single frame as base64
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null
    if (!isStreaming) return null

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (!ctx) return null

    canvas.width = video.videoWidth || width
    canvas.height = video.videoHeight || height
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Return base64 encoded JPEG (smaller than PNG)
    return canvas.toDataURL('image/jpeg', 0.7)
  }, [isStreaming, width, height])

  // Start continuous frame capture
  const startCapture = useCallback((onFrame: (frame: string) => void) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    const interval = 1000 / fps
    intervalRef.current = setInterval(() => {
      const frame = captureFrame()
      if (frame) {
        onFrame(frame)
      }
    }, interval)
  }, [fps, captureFrame])

  // Stop continuous frame capture
  const stopCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Set refs from external elements
  const setVideoElement = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el
  }, [])

  const setCanvasElement = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    getDevices()
    return () => {
      stopCamera()
    }
  }, [getDevices, stopCamera])

  return {
    isStreaming,
    error,
    devices,
    startCamera,
    stopCamera,
    captureFrame,
    startCapture,
    stopCapture,
    setVideoElement,
    setCanvasElement,
    getDevices
  }
}

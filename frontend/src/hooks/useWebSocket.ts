'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { ConnectionStatus, AnalysisResult, DetectionMode, DetectedPoint, ColorMarkerConfig } from '@/lib/types'

interface UseWebSocketOptions {
  url: string
  onResult?: (result: AnalysisResult) => void
  onCalibrationResult?: (points: DetectedPoint[]) => void
  onModeSet?: (mode: DetectionMode) => void
  onCalibrationConfirmed?: () => void
  onError?: (error: string) => void
  reconnectInterval?: number
}

export function useWebSocket({
  url,
  onResult,
  onCalibrationResult,
  onModeSet,
  onCalibrationConfirmed,
  onError,
  reconnectInterval = 3000
}: UseWebSocketOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [latency, setLatency] = useState<number>(0)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSendTimeRef = useRef<number>(0)
  // Cache calibration state for reconnection
  const cachedModeRef = useRef<DetectionMode | null>(null)
  const cachedLabelMappingRef = useRef<Record<string, string> | null>(null)
  const cachedMarkerConfigsRef = useRef<ColorMarkerConfig[] | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setStatus('connecting')

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        setStatus('connected')
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
        // Restore cached calibration state on reconnect
        if (cachedModeRef.current) {
          ws.send(JSON.stringify({ type: 'set_mode', data: { mode: cachedModeRef.current } }))
          if (cachedMarkerConfigsRef.current) {
            ws.send(JSON.stringify({ type: 'update_marker_config', data: { markers: cachedMarkerConfigsRef.current } }))
          }
          if (cachedLabelMappingRef.current) {
            ws.send(JSON.stringify({ type: 'confirm_calibration', data: { label_mapping: cachedLabelMappingRef.current } }))
          }
        }
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          switch (message.type) {
            case 'result':
              if (onResult) {
                const now = Date.now()
                if (lastSendTimeRef.current > 0) {
                  setLatency(now - lastSendTimeRef.current)
                }
                onResult(message.data as AnalysisResult)
              }
              break
            case 'calibration_result':
              onCalibrationResult?.(message.data.detected_points as DetectedPoint[])
              break
            case 'mode_set':
              onModeSet?.(message.data.mode as DetectionMode)
              break
            case 'calibration_confirmed':
              onCalibrationConfirmed?.()
              break
            case 'error':
              onError?.(message.data)
              break
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e)
        }
      }

      ws.onclose = () => {
        setStatus('disconnected')
        wsRef.current = null

        // Auto reconnect
        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, reconnectInterval)
      }

      ws.onerror = () => {
        setStatus('error')
        onError?.('WebSocket connection error')
      }
    } catch (e) {
      setStatus('error')
      onError?.(`Failed to connect: ${e}`)
    }
  }, [url, onResult, onCalibrationResult, onModeSet, onCalibrationConfirmed, onError, reconnectInterval])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setStatus('disconnected')
  }, [])

  const sendFrame = useCallback((frameData: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      lastSendTimeRef.current = Date.now()
      wsRef.current.send(JSON.stringify({
        type: 'frame',
        data: frameData,
        timestamp: lastSendTimeRef.current
      }))
    }
  }, [])

  const setDetectionMode = useCallback((mode: DetectionMode) => {
    cachedModeRef.current = mode
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'set_mode',
        data: { mode }
      }))
    }
  }, [])

  const sendCalibrationFrame = useCallback((frameData: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'calibrate_frame',
        data: frameData,
        timestamp: Date.now()
      }))
    }
  }, [])

  const confirmCalibration = useCallback((labelMapping: Record<string, string>) => {
    cachedLabelMappingRef.current = labelMapping
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'confirm_calibration',
        data: { label_mapping: labelMapping }
      }))
    }
  }, [])

  const updateMarkerConfig = useCallback((markers: ColorMarkerConfig[]) => {
    cachedMarkerConfigsRef.current = markers
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'update_marker_config',
        data: { markers }
      }))
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    status,
    latency,
    connect,
    disconnect,
    sendFrame,
    setDetectionMode,
    sendCalibrationFrame,
    confirmCalibration,
    updateMarkerConfig,
    isConnected: status === 'connected'
  }
}

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { ConnectionStatus, AnalysisResult } from '@/lib/types'

interface UseWebSocketOptions {
  url: string
  onResult?: (result: AnalysisResult) => void
  onError?: (error: string) => void
  reconnectInterval?: number
}

export function useWebSocket({
  url,
  onResult,
  onError,
  reconnectInterval = 3000
}: UseWebSocketOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [latency, setLatency] = useState<number>(0)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSendTimeRef = useRef<number>(0)

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
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          if (message.type === 'result' && onResult) {
            // Calculate latency
            const now = Date.now()
            if (lastSendTimeRef.current > 0) {
              setLatency(now - lastSendTimeRef.current)
            }
            onResult(message.data as AnalysisResult)
          } else if (message.type === 'error' && onError) {
            onError(message.data)
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
  }, [url, onResult, onError, reconnectInterval])

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
    isConnected: status === 'connected'
  }
}

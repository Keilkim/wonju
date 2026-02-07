'use client'

import { useState } from 'react'
import { Session } from '@/lib/types'

interface SessionHistoryProps {
  sessions: Session[]
  onLoad: (session: Session) => void
  onDelete: (sessionId: string) => void
}

export function SessionHistory({ sessions, onLoad, onDelete }: SessionHistoryProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    if (confirm('이 세션을 삭제하시겠습니까?')) {
      setDeletingId(sessionId)
      try {
        await onDelete(sessionId)
      } finally {
        setDeletingId(null)
      }
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (sessions.length === 0) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Session History</h2>
        <div className="text-center py-8 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>No session history</p>
          <p className="text-sm">Complete sessions to see history</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Session History</h2>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => onLoad(session)}
            className="flex items-center justify-between p-3 bg-gray-50 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 truncate">
                  {session.dog_id}
                </span>
                {session.ended_at ? (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                    Completed
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">
                    In Progress
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {formatDate(session.started_at)}
              </div>
              {session.metrics_summary && (
                <div className="flex gap-3 mt-1 text-xs text-gray-600">
                  <span>Symmetry: {((session.metrics_summary.symmetry || 0) * 100).toFixed(0)}%</span>
                  <span>Smoothness: {((session.metrics_summary.smoothness || 0) * 100).toFixed(0)}%</span>
                </div>
              )}
              {session.notes && (
                <p className="text-xs text-gray-400 mt-1 truncate">{session.notes}</p>
              )}
            </div>
            <div className="flex items-center gap-2 ml-2">
              <button
                onClick={() => onLoad(session)}
                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                title="Load session"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </button>
              <button
                onClick={(e) => handleDelete(e, session.id)}
                disabled={deletingId === session.id}
                className="p-2 text-red-600 hover:bg-red-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                title="Delete session"
              >
                {deletingId === session.id ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

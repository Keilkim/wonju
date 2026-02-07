'use client'

import { useState } from 'react'
import { VideoStream } from './VideoStream'
import { VideoUpload } from './VideoUpload'
import { StepGuide } from './StepGuide'
import { ConnectionStatus, DogKeypoints } from '@/lib/types'

interface SettingsTabProps {
  connectionStatus: ConnectionStatus
  latency: number
  isConnected: boolean
  dogId: string
  notes: string
  videoSource: 'camera' | 'upload'
  keypoints: DogKeypoints | null
  isPreviewing: boolean
  onConnect: () => void
  onDisconnect: () => void
  onDogIdChange: (id: string) => void
  onNotesChange: (notes: string) => void
  onVideoSourceChange: (source: 'camera' | 'upload') => void
  onPreviewFrame: (frame: string) => void
  onSettingsComplete: () => void
}

export function SettingsTab({
  connectionStatus,
  latency,
  isConnected,
  dogId,
  notes,
  videoSource,
  keypoints,
  isPreviewing,
  onConnect,
  onDisconnect,
  onDogIdChange,
  onNotesChange,
  onVideoSourceChange,
  onPreviewFrame,
  onSettingsComplete
}: SettingsTabProps) {
  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'connected'
      case 'connecting': return 'connecting'
      default: return 'disconnected'
    }
  }

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected'
      case 'connecting': return 'Connecting...'
      case 'error': return 'Error'
      default: return 'Disconnected'
    }
  }

  // Calculate current setup step
  const currentStep = !isConnected ? 1 : !dogId.trim() ? 2 : 3

  // Check if settings are complete
  const isSettingsComplete = isConnected && dogId.trim().length > 0

  return (
    <div className="space-y-6">
      {/* Setup Progress */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">설정 진행 상황</h2>
        <div className="flex items-center justify-between mb-2">
          {[1, 2, 3].map((step, idx) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                currentStep > step
                  ? 'bg-green-500 text-white'
                  : currentStep === step
                  ? 'bg-primary text-white ring-2 ring-blue-200'
                  : 'bg-gray-200 text-gray-400'
              }`}>
                {currentStep > step ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : step}
              </div>
              {idx < 2 && (
                <div className={`w-16 h-1 mx-2 rounded ${currentStep > step ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>서버 연결</span>
          <span>반려견 정보</span>
          <span>카메라 확인</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Connection & Dog Info */}
        <div className="space-y-6">
          {/* Step 1: Server Connection */}
          <div className="card">
            <StepGuide
              stepNumber={1}
              currentStep={currentStep}
              title="Step 1: 서버 연결"
              instruction="분석 서버에 연결하여 실시간 분석을 준비합니다"
            />

            <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className={`status-indicator ${getStatusColor()}`} />
                <span className="text-sm font-medium">{getStatusText()}</span>
              </div>
              {connectionStatus === 'connected' && (
                <span className="text-xs text-gray-500">Latency: {latency}ms</span>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={onConnect}
                disabled={connectionStatus === 'connected' || connectionStatus === 'connecting'}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
              >
                Connect
              </button>
              <button
                onClick={onDisconnect}
                disabled={connectionStatus === 'disconnected'}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>

          {/* Step 2: Dog Info */}
          <div className="card">
            <StepGuide
              stepNumber={2}
              currentStep={currentStep}
              title="Step 2: 반려견 정보"
              instruction="분석할 반려견의 ID와 메모를 입력하세요"
            />

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  반려견 ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={dogId}
                  onChange={(e) => onDogIdChange(e.target.value)}
                  placeholder="예: dog-001, 바둑이"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={!isConnected}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  메모 (선택)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => onNotesChange(e.target.value)}
                  placeholder="세션 관련 메모..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  disabled={!isConnected}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Camera Preview */}
        <div className="card">
          <StepGuide
            stepNumber={3}
            currentStep={currentStep}
            title="Step 3: 카메라 확인"
            instruction="카메라가 정상 작동하는지 확인하고 인식 포인트를 확인하세요"
          />

          {/* Video Source Tabs */}
          <div className="flex border-b border-gray-200 mb-4">
            <button
              onClick={() => onVideoSourceChange('camera')}
              className={`flex-1 py-2 px-3 text-center text-sm font-medium transition-colors ${
                videoSource === 'camera'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="flex items-center justify-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Live Camera
              </span>
            </button>
            <button
              onClick={() => onVideoSourceChange('upload')}
              className={`flex-1 py-2 px-3 text-center text-sm font-medium transition-colors ${
                videoSource === 'upload'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="flex items-center justify-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload Video
              </span>
            </button>
          </div>

          {/* Video Preview */}
          <div className="mb-4">
            {videoSource === 'camera' ? (
              <VideoStream
                onFrame={onPreviewFrame}
                keypoints={keypoints}
                isAnalyzing={isPreviewing}
              />
            ) : (
              <VideoUpload
                onFrame={onPreviewFrame}
                isAnalyzing={isPreviewing}
              />
            )}
          </div>

          {/* Keypoint Legend */}
          {keypoints && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm font-medium text-gray-700 mb-2">인식 포인트</div>
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  <span>왼쪽</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <span>오른쪽</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                  <span>중심</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Complete Setup Button */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">설정 완료</h3>
            <p className="text-sm text-gray-500">
              {isSettingsComplete
                ? '모든 설정이 완료되었습니다. 분석 대시보드로 이동하세요.'
                : '위의 모든 단계를 완료해주세요.'}
            </p>
          </div>
          <button
            onClick={onSettingsComplete}
            disabled={!isSettingsComplete}
            className="px-6 py-3 bg-secondary text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-green-600 transition-colors flex items-center gap-2"
          >
            분석 대시보드로 이동
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

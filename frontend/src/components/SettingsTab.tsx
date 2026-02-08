'use client'

import { StepGuide } from './StepGuide'
import { CalibrationPanel } from './CalibrationPanel'
import { ConnectionStatus, DetectionMode, DetectedPoint, ColorMarkerConfig } from '@/lib/types'

interface SettingsTabProps {
  connectionStatus: ConnectionStatus
  latency: number
  isConnected: boolean
  dogId: string
  notes: string
  detectionMode: DetectionMode
  detectedPoints: DetectedPoint[]
  isCalibrated: boolean
  markerConfigs: ColorMarkerConfig[]
  onConnect: () => void
  onDisconnect: () => void
  onDogIdChange: (id: string) => void
  onNotesChange: (notes: string) => void
  onDetectionModeChange: (mode: DetectionMode) => void
  onCalibrationFrame: (frame: string) => void
  onConfirmCalibration: (labelMapping: Record<string, string>) => void
  onUpdateMarkerConfig: (configs: ColorMarkerConfig[]) => void
  onSettingsComplete: () => void
}

export function SettingsTab({
  connectionStatus,
  latency,
  isConnected,
  dogId,
  notes,
  detectionMode,
  detectedPoints,
  isCalibrated,
  markerConfigs,
  onConnect,
  onDisconnect,
  onDogIdChange,
  onNotesChange,
  onDetectionModeChange,
  onCalibrationFrame,
  onConfirmCalibration,
  onUpdateMarkerConfig,
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

  // Calculate current setup step (5 steps now)
  const currentStep = !isConnected ? 1 : !dogId.trim() ? 2 : !detectionMode ? 3 : !isCalibrated ? 4 : 5

  // Check if settings are complete
  const isSettingsComplete = isConnected && dogId.trim().length > 0 && isCalibrated

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Connection & Dog Info & Mode Selection */}
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

          {/* Step 3: Detection Mode Selection */}
          <div className="card">
            <StepGuide
              stepNumber={3}
              currentStep={currentStep}
              title="Step 3: 감지 모드 선택"
              instruction="관절 추적 방식을 선택하세요"
            />

            <div className="grid grid-cols-2 gap-3">
              {/* AI Pose Card */}
              <button
                onClick={() => onDetectionModeChange('ai_pose')}
                disabled={!isConnected || !dogId.trim()}
                className={`p-4 rounded-lg border-2 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  detectionMode === 'ai_pose'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="font-medium text-sm">AI 포즈 감지</span>
                </div>
                <p className="text-xs text-gray-500">
                  AI가 자동으로 관절을 감지합니다. 마커가 필요 없습니다.
                </p>
              </button>

              {/* Color Marker Card */}
              <button
                onClick={() => onDetectionModeChange('color_marker')}
                disabled={!isConnected || !dogId.trim()}
                className={`p-4 rounded-lg border-2 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  detectionMode === 'color_marker'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex -space-x-1">
                    <span className="w-3 h-3 rounded-full bg-red-500 border border-white" />
                    <span className="w-3 h-3 rounded-full bg-blue-500 border border-white" />
                    <span className="w-3 h-3 rounded-full bg-green-500 border border-white" />
                  </div>
                  <span className="font-medium text-sm">컬러 마커 추적</span>
                </div>
                <p className="text-xs text-gray-500">
                  색깔 밴드로 8개 관절을 마킹하여 추적합니다.
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Calibration (Step 4) */}
        <div className="card">
          <StepGuide
            stepNumber={4}
            currentStep={currentStep}
            title="Step 4: 세팅 및 테스트용 카메라"
            instruction={detectionMode === 'color_marker'
              ? '마커를 부착한 후 카메라를 시작하여 감지를 확인하세요'
              : '카메라가 정상 작동하는지 확인하고 인식 포인트를 확인하세요'
            }
          />

          {currentStep >= 4 ? (
            <CalibrationPanel
              mode={detectionMode}
              detectedPoints={detectedPoints}
              markerConfigs={markerConfigs}
              isConnected={isConnected}
              onCalibrationFrame={onCalibrationFrame}
              onConfirm={onConfirmCalibration}
              onUpdateMarkerConfig={onUpdateMarkerConfig}
            />
          ) : (
            <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-400">이전 단계를 먼저 완료해주세요</p>
            </div>
          )}

          {/* Calibration status */}
          {isCalibrated && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-green-700">
                캘리브레이션 완료 ({detectionMode === 'color_marker' ? '컬러 마커' : 'AI 포즈'} 모드)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Complete Setup Button (Step 5) */}
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

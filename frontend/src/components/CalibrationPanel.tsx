'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  DetectionMode,
  DetectedPoint,
  ColorMarkerConfig,
  HSVRange,
  MarkerPreset,
  JOINT_LABELS,
  AVAILABLE_COLORS,
  DEFAULT_MARKER_CONFIGS,
  JOINT_ANATOMICAL_ORDER,
} from '@/lib/types'

interface CalibrationPanelProps {
  mode: DetectionMode
  detectedPoints: DetectedPoint[]
  markerConfigs: ColorMarkerConfig[]
  isConnected: boolean
  onCalibrationFrame: (frame: string) => void
  onConfirm: (labelMapping: Record<string, string>) => void
  onUpdateMarkerConfig: (configs: ColorMarkerConfig[]) => void
}

// Joint groups for left/right display
const LEFT_JOINTS = ['left_shoulder', 'left_elbow', 'left_hip', 'left_knee']
const RIGHT_JOINTS = ['right_shoulder', 'right_elbow', 'right_hip', 'right_knee']

const PRESET_STORAGE_KEY = 'marker_presets'

function loadPresets(): MarkerPreset[] {
  try {
    const stored = localStorage.getItem(PRESET_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function savePresets(presets: MarkerPreset[]) {
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets))
}

/** Calculate position_order for configs: within same color, sorted by anatomical order */
function recalcPositionOrders(configs: ColorMarkerConfig[]): ColorMarkerConfig[] {
  const colorGroups: Record<string, ColorMarkerConfig[]> = {}
  for (const c of configs) {
    if (!colorGroups[c.color_name]) colorGroups[c.color_name] = []
    colorGroups[c.color_name].push(c)
  }

  const result: ColorMarkerConfig[] = []
  for (const group of Object.values(colorGroups)) {
    // Sort by anatomical order (top to bottom)
    group.sort((a, b) => (JOINT_ANATOMICAL_ORDER[a.joint_name] || 0) - (JOINT_ANATOMICAL_ORDER[b.joint_name] || 0))
    group.forEach((c, i) => {
      result.push({ ...c, position_order: i + 1 })
    })
  }

  return result
}

export function CalibrationPanel({
  mode,
  detectedPoints,
  markerConfigs,
  isConnected,
  onCalibrationFrame,
  onConfirm,
  onUpdateMarkerConfig,
}: CalibrationPanelProps) {
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [presets, setPresets] = useState<MarkerPreset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState<string>('')
  const [presetName, setPresetName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [expandedColor, setExpandedColor] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Load presets from localStorage on mount
  useEffect(() => {
    setPresets(loadPresets())
  }, [])

  // Build color lookup for current configs: joint_name -> color_name
  const jointColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    markerConfigs.forEach(c => { map[c.joint_name] = c.color_name })
    return map
  }, [markerConfigs])

  // Count same-color markers and their position labels
  const colorPositionLabels = useMemo(() => {
    const labels: Record<string, string> = {} // joint_name -> "빨간색 2번째 ↑"
    const colorGroups: Record<string, string[]> = {}
    // Group joints by color, in anatomical order
    for (const joint of [...LEFT_JOINTS, ...RIGHT_JOINTS]) {
      const color = jointColorMap[joint]
      if (color) {
        if (!colorGroups[color]) colorGroups[color] = []
        colorGroups[color].push(joint)
      }
    }
    for (const [color, joints] of Object.entries(colorGroups)) {
      if (joints.length > 1) {
        const colorLabel = AVAILABLE_COLORS.find(c => c.name === color)?.name || color
        joints.forEach((j, i) => {
          labels[j] = `${colorLabel} ${i + 1}번째 ↑`
        })
      }
    }
    return labels
  }, [jointColorMap])

  // Start camera
  const startCalibration = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'environment' }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setIsCalibrating(true)
      captureIntervalRef.current = setInterval(() => {
        if (videoRef.current && canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d')
          if (ctx) {
            canvasRef.current.width = videoRef.current.videoWidth || 640
            canvasRef.current.height = videoRef.current.videoHeight || 480
            ctx.drawImage(videoRef.current, 0, 0)
            const frame = canvasRef.current.toDataURL('image/jpeg', 0.7)
            const base64 = frame.replace(/^data:image\/\w+;base64,/, '')
            onCalibrationFrame(base64)
          }
        }
      }, 250)
    } catch (err) {
      console.error('Camera access failed:', err)
    }
  }, [onCalibrationFrame])

  const stopCalibration = useCallback(() => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current)
      captureIntervalRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setIsCalibrating(false)
  }, [])

  // Draw detected points overlay
  useEffect(() => {
    const overlay = overlayCanvasRef.current
    const video = videoRef.current
    if (!overlay || !video) return

    const ctx = overlay.getContext('2d')
    if (!ctx) return

    overlay.width = video.videoWidth || 640
    overlay.height = video.videoHeight || 480
    ctx.clearRect(0, 0, overlay.width, overlay.height)

    detectedPoints.forEach(pt => {
      const jointName = pt.suggested_label
      const label = JOINT_LABELS[jointName] || jointName
      const posOrder = (pt as { position_order?: number }).position_order

      // Draw circle
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, 14, 0, Math.PI * 2)
      ctx.fillStyle = pt.display_color || getColorForName(pt.color_name || '')
      ctx.globalAlpha = 0.7
      ctx.fill()
      ctx.globalAlpha = 1.0
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 2
      ctx.stroke()

      // Draw label with position order
      const displayLabel = posOrder && posOrder > 0 ? `${posOrder} ${label}` : label
      ctx.font = 'bold 11px sans-serif'
      const textWidth = ctx.measureText(displayLabel).width
      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      ctx.fillRect(pt.x - textWidth / 2 - 4, pt.y - 28, textWidth + 8, 18)
      ctx.fillStyle = '#FFFFFF'
      ctx.textAlign = 'center'
      ctx.fillText(displayLabel, pt.x, pt.y - 14)
    })
  }, [detectedPoints])

  useEffect(() => {
    return () => { stopCalibration() }
  }, [stopCalibration])

  // Handle color change for a joint
  const handleColorChange = useCallback((jointName: string, newColorName: string) => {
    const colorDef = AVAILABLE_COLORS.find(c => c.name === newColorName)
    if (!colorDef) return

    const updated = markerConfigs.map(c => {
      if (c.joint_name === jointName) {
        return {
          ...c,
          color_name: newColorName,
          display_color: colorDef.display_color,
          hsv_range: colorDef.hsv_range,
        }
      }
      return c
    })

    onUpdateMarkerConfig(recalcPositionOrders(updated))
  }, [markerConfigs, onUpdateMarkerConfig])

  // Handle HSV range update for a color (shared across all joints using that color)
  const handleHSVChange = useCallback((colorName: string, field: keyof HSVRange, value: number) => {
    const updated = markerConfigs.map(c => {
      if (c.color_name === colorName) {
        return { ...c, hsv_range: { ...c.hsv_range, [field]: value } }
      }
      return c
    })
    onUpdateMarkerConfig(updated)
  }, [markerConfigs, onUpdateMarkerConfig])

  // Preset save
  const handleSavePreset = useCallback(() => {
    if (!presetName.trim()) return
    const newPreset: MarkerPreset = {
      id: `preset_${Date.now()}`,
      name: presetName.trim(),
      configs: markerConfigs,
      created_at: new Date().toISOString(),
    }
    const updated = [...presets, newPreset]
    setPresets(updated)
    savePresets(updated)
    setSelectedPresetId(newPreset.id)
    setPresetName('')
    setShowSaveInput(false)
  }, [presetName, markerConfigs, presets])

  // Preset load
  const handleLoadPreset = useCallback((presetId: string) => {
    setSelectedPresetId(presetId)
    if (presetId === 'default') {
      onUpdateMarkerConfig([...DEFAULT_MARKER_CONFIGS])
      return
    }
    const preset = presets.find(p => p.id === presetId)
    if (preset) {
      onUpdateMarkerConfig(recalcPositionOrders(preset.configs))
    }
  }, [presets, onUpdateMarkerConfig])

  // Preset delete
  const handleDeletePreset = useCallback(() => {
    if (!selectedPresetId || selectedPresetId === 'default') return
    const updated = presets.filter(p => p.id !== selectedPresetId)
    setPresets(updated)
    savePresets(updated)
    setSelectedPresetId('')
  }, [selectedPresetId, presets])

  const handleConfirm = () => {
    stopCalibration()
    // Build label mapping from configs
    const mapping: Record<string, string> = {}
    markerConfigs.forEach(c => { mapping[c.color_name] = c.joint_name })
    onConfirm(mapping)
  }

  // Detected color names
  const detectedColorNames = new Set(detectedPoints.map(p => p.color_name).filter(Boolean))

  // Get unique colors used (for HSV panel)
  const uniqueColors = useMemo(() => {
    const seen = new Set<string>()
    return markerConfigs.filter(c => {
      if (seen.has(c.color_name)) return false
      seen.add(c.color_name)
      return true
    })
  }, [markerConfigs])

  // AI Pose mode
  if (mode === 'ai_pose') {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2">AI 포즈 감지 모드</h4>
          <p className="text-sm text-blue-700">
            AI가 자동으로 강아지의 관절을 감지합니다. 카메라에 강아지가 보이는지 확인하고,
            감지가 정상적으로 작동하면 확인 버튼을 누르세요.
          </p>
        </div>

        <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
          <video ref={videoRef} className="w-full h-full object-contain" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />
          <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }} />
        </div>

        <div className="flex gap-2">
          {!isCalibrating ? (
            <button onClick={startCalibration} disabled={!isConnected}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium disabled:bg-gray-300 hover:bg-blue-600 transition-colors">
              카메라 시작
            </button>
          ) : (
            <>
              <button onClick={stopCalibration}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 transition-colors">
                카메라 중지
              </button>
              <button onClick={handleConfirm}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors">
                감지 확인 완료
              </button>
            </>
          )}
        </div>

        {detectedPoints.length > 0 && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">
              감지된 포인트: <span className="font-bold text-green-600">{detectedPoints.length}개</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  // === Color Marker Mode ===
  return (
    <div className="space-y-4">
      {/* Preset management */}
      <div className="p-3 bg-gray-50 rounded-lg border">
        <div className="flex items-center gap-2 mb-2">
          <label className="text-xs font-medium text-gray-600">마커 프리셋</label>
        </div>
        <div className="flex gap-2">
          <select
            className="flex-1 px-3 py-1.5 border rounded-lg text-sm"
            value={selectedPresetId}
            onChange={(e) => handleLoadPreset(e.target.value)}
          >
            <option value="">-- 프리셋 선택 --</option>
            <option value="default">8색 기본 (1색:1관절)</option>
            {presets.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {!showSaveInput ? (
            <button onClick={() => setShowSaveInput(true)}
              className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors">
              저장
            </button>
          ) : (
            <div className="flex gap-1">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="프리셋 이름..."
                className="w-32 px-2 py-1.5 border rounded-lg text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                autoFocus
              />
              <button onClick={handleSavePreset} disabled={!presetName.trim()}
                className="px-2 py-1.5 bg-green-500 text-white rounded-lg text-sm disabled:bg-gray-300 hover:bg-green-600">
                OK
              </button>
              <button onClick={() => setShowSaveInput(false)}
                className="px-2 py-1.5 bg-gray-400 text-white rounded-lg text-sm hover:bg-gray-500">
                X
              </button>
            </div>
          )}
          {selectedPresetId && selectedPresetId !== 'default' && (
            <button onClick={handleDeletePreset}
              className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors">
              삭제
            </button>
          )}
        </div>
      </div>

      {/* Joint color assignment - 2 columns */}
      <div className="border rounded-lg">
        <div className="p-3 bg-orange-50 border-b">
          <h4 className="text-sm font-medium text-orange-900">관절별 색상 설정</h4>
          <p className="text-xs text-orange-700 mt-1">
            각 관절에 사용할 밴드 색상을 선택하세요. 같은 색은 위→아래 순서로 자동 구분됩니다.
          </p>
        </div>

        <div className="grid grid-cols-2 divide-x">
          {/* Left side joints */}
          <div className="divide-y">
            <div className="p-2 bg-gray-50 text-xs font-medium text-gray-500 text-center">왼쪽</div>
            {LEFT_JOINTS.map(joint => (
              <JointColorRow
                key={joint}
                jointName={joint}
                colorName={jointColorMap[joint] || 'Red'}
                positionLabel={colorPositionLabels[joint]}
                isDetected={detectedColorNames.has(jointColorMap[joint])}
                onColorChange={handleColorChange}
              />
            ))}
          </div>
          {/* Right side joints */}
          <div className="divide-y">
            <div className="p-2 bg-gray-50 text-xs font-medium text-gray-500 text-center">오른쪽</div>
            {RIGHT_JOINTS.map(joint => (
              <JointColorRow
                key={joint}
                jointName={joint}
                colorName={jointColorMap[joint] || 'Blue'}
                positionLabel={colorPositionLabels[joint]}
                isDetected={detectedColorNames.has(jointColorMap[joint])}
                onColorChange={handleColorChange}
              />
            ))}
          </div>
        </div>
      </div>

      {/* HSV tuning per unique color */}
      <div className="border rounded-lg">
        <div className="p-2 bg-gray-50 border-b">
          <h4 className="text-xs font-medium text-gray-600">HSV 범위 조정 (조명 환경에 맞게)</h4>
        </div>
        <div className="divide-y">
          {uniqueColors.map(config => (
            <div key={config.color_name}>
              <button
                onClick={() => setExpandedColor(expandedColor === config.color_name ? null : config.color_name)}
                className="w-full p-2 flex items-center gap-2 hover:bg-gray-50 text-sm"
              >
                <span className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0"
                  style={{ backgroundColor: config.display_color }} />
                <span className="flex-1 text-left">{config.color_name}</span>
                <svg className={`w-4 h-4 transition-transform ${expandedColor === config.color_name ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {expandedColor === config.color_name && (
                <div className="p-3 bg-gray-50 space-y-2">
                  {(['hue_low', 'hue_high', 'sat_low', 'sat_high', 'val_low', 'val_high'] as (keyof HSVRange)[]).map(field => (
                    <div key={field} className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 w-16">{field}</label>
                      <input
                        type="range"
                        min={0}
                        max={field.startsWith('hue') ? 179 : 255}
                        value={config.hsv_range[field]}
                        onChange={(e) => handleHSVChange(config.color_name, field, parseInt(e.target.value))}
                        className="flex-1 h-1"
                      />
                      <span className="text-xs text-gray-600 w-8 text-right">{config.hsv_range[field]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Camera preview */}
      <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
        <video ref={videoRef} className="w-full h-full object-contain" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />
        <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }} />
      </div>

      {/* Camera controls + confirm */}
      <div className="flex gap-2">
        {!isCalibrating ? (
          <button onClick={startCalibration} disabled={!isConnected}
            className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium disabled:bg-gray-300 hover:bg-orange-600 transition-colors">
            카메라 시작
          </button>
        ) : (
          <>
            <button onClick={stopCalibration}
              className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 transition-colors">
              카메라 중지
            </button>
            <button onClick={handleConfirm}
              className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors">
              캘리브레이션 확인 ({detectedPoints.length}개 감지)
            </button>
          </>
        )}
      </div>

      {/* Detection status */}
      {detectedPoints.length > 0 && (
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="text-sm text-green-700">
            감지된 마커: <span className="font-bold">{detectedPoints.length}개</span>
            {detectedPoints.length < markerConfigs.length && (
              <span className="text-yellow-600 ml-2">
                ({markerConfigs.length - detectedPoints.length}개 미감지)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Single joint row with color dropdown */
function JointColorRow({
  jointName,
  colorName,
  positionLabel,
  isDetected,
  onColorChange,
}: {
  jointName: string
  colorName: string
  positionLabel?: string
  isDetected: boolean
  onColorChange: (joint: string, color: string) => void
}) {
  const colorDef = AVAILABLE_COLORS.find(c => c.name === colorName)
  const shortLabel = JOINT_LABELS[jointName]?.replace('왼쪽 ', '').replace('오른쪽 ', '') || jointName

  return (
    <div className="p-2 flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800 truncate">{shortLabel}</div>
        {positionLabel && (
          <div className="text-xs text-orange-600">{positionLabel}</div>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className={`w-3 h-3 rounded-full border flex-shrink-0 ${isDetected ? 'border-green-500' : 'border-gray-300'}`}
          style={{ backgroundColor: colorDef?.display_color || '#ccc' }}
        />
        <select
          className="px-1.5 py-1 border rounded text-xs w-20"
          value={colorName}
          onChange={(e) => onColorChange(jointName, e.target.value)}
        >
          {AVAILABLE_COLORS.map(c => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

function getColorForName(name: string): string {
  const found = AVAILABLE_COLORS.find(c => c.name === name)
  return found?.display_color || '#6B7280'
}

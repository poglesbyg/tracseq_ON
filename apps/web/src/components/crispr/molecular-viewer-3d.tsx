/* eslint-disable react/no-unknown-property */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  OrbitControls,
  PerspectiveCamera,
  Environment,
  Html,
  Text,
} from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { motion } from 'framer-motion'
import { Maximize2, RotateCcw, ZoomIn, Eye, EyeOff } from 'lucide-react'
import { useState, useRef, useMemo } from 'react'
import * as THREE from 'three'

import type { GuideRNA } from '../../lib/crispr/guide-design'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

interface MolecularViewer3DProps {
  sequence: string
  selectedGuide?: GuideRNA
  onGuideSelect?: (guide: GuideRNA) => void
  guides?: GuideRNA[]
}

// DNA base pair colors
const baseColors = {
  A: '#FF6B6B', // Red
  T: '#4ECDC4', // Teal
  G: '#45B7D1', // Blue
  C: '#96CEB4', // Green
  N: '#95A5A6', // Gray
}

// Create DNA helix geometry
function DNAHelix({
  sequence,
  selectedGuide,
  guides = [],
}: {
  sequence: string
  selectedGuide?: GuideRNA
  guides: GuideRNA[]
}) {
  const helixRef = useRef<THREE.Group>(null)

  const helixData = useMemo(() => {
    const radius = 2
    const height = sequence.length * 0.3
    const turns = sequence.length / 10 // One turn per 10 base pairs

    const bases: Array<{
      position: THREE.Vector3
      rotation: number
      base: string
      index: number
      isPAM: boolean
      isGuideBinding: boolean
      guideId?: string
    }> = []

    for (let i = 0; i < sequence.length; i++) {
      const angle = (i / sequence.length) * turns * Math.PI * 2
      const y = (i / sequence.length) * height - height / 2

      // Check if this position is a PAM site
      const isPAM = guides.some((guide) => {
        const pamStart =
          guide.strand === '+'
            ? guide.position + 20
            : guide.position - guide.pamSequence.length
        const pamEnd =
          guide.strand === '+'
            ? guide.position + 20 + guide.pamSequence.length
            : guide.position
        return i >= Math.min(pamStart, pamEnd) && i < Math.max(pamStart, pamEnd)
      })

      // Check if this position is where a guide RNA binds
      const bindingGuide = guides.find((guide) => {
        const guideStart =
          guide.strand === '+' ? guide.position : guide.position
        const guideEnd =
          guide.strand === '+' ? guide.position + 20 : guide.position + 20
        return (
          i >= Math.min(guideStart, guideEnd) &&
          i < Math.max(guideStart, guideEnd)
        )
      })

      // Create both strands
      bases.push({
        position: new THREE.Vector3(
          Math.cos(angle) * radius,
          y,
          Math.sin(angle) * radius,
        ),
        rotation: angle,
        base: sequence[i] || 'N',
        index: i,
        isPAM,
        isGuideBinding: !!bindingGuide,
        guideId: bindingGuide?.id,
      })

      // Complementary strand
      const complement =
        { A: 'T', T: 'A', G: 'C', C: 'G', N: 'N' }[sequence[i]] || 'N'
      bases.push({
        position: new THREE.Vector3(
          Math.cos(angle + Math.PI) * radius,
          y,
          Math.sin(angle + Math.PI) * radius,
        ),
        rotation: angle + Math.PI,
        base: complement,
        index: i,
        isPAM,
        isGuideBinding: !!bindingGuide,
        guideId: bindingGuide?.id,
      })
    }

    return bases
  }, [sequence, guides])

  return (
    <group ref={helixRef}>
      {helixData.map((base, index) => (
        <Base
          key={index}
          position={base.position}
          rotation={base.rotation}
          base={base.base}
          baseIndex={base.index}
          isPAM={base.isPAM}
          isGuideBinding={base.isGuideBinding}
          isSelected={selectedGuide?.id === base.guideId}
        />
      ))}

      {/* DNA backbone */}
      <DNABackbone helixData={helixData} />

      {/* Guide RNA visualization */}
      {selectedGuide && (
        <GuideRNAVisualization guide={selectedGuide} sequence={sequence} />
      )}
    </group>
  )
}

// Individual DNA base component
function Base({
  position,
  rotation,
  base,
  baseIndex,
  isPAM,
  isGuideBinding,
  isSelected,
}: {
  position: THREE.Vector3
  rotation: number
  base: string
  baseIndex: number
  isPAM: boolean
  isGuideBinding: boolean
  isSelected: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  const color = useMemo(() => {
    if (isPAM) {
      return '#FFD700'
    } // Gold for PAM sites
    if (isGuideBinding && isSelected) {
      return '#FF4081'
    } // Pink for selected guide binding
    if (isGuideBinding) {
      return '#9C27B0'
    } // Purple for guide binding
    return baseColors[base as keyof typeof baseColors] || baseColors.N
  }, [base, isPAM, isGuideBinding, isSelected])

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={[0, rotation, 0]}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      scale={hovered ? 1.2 : 1}
    >
      <sphereGeometry args={[0.15, 16, 16]} />
      <meshPhongMaterial
        color={color}
        emissive={isPAM ? '#331000' : isGuideBinding ? '#1a0033' : '#000000'}
        emissiveIntensity={isPAM ? 0.3 : isGuideBinding ? 0.2 : 0}
      />

      {hovered && (
        <Html>
          <div className="bg-black/80 text-white text-xs px-2 py-1 rounded pointer-events-none">
            {base}
            {baseIndex}
            {isPAM && <div className="text-yellow-400">PAM Site</div>}
            {isGuideBinding && (
              <div className="text-purple-400">Guide Binding</div>
            )}
          </div>
        </Html>
      )}
    </mesh>
  )
}

// DNA backbone connecting lines
function DNABackbone({ helixData }: { helixData: any[] }) {
  const points = useMemo(() => {
    const strand1Points = []
    const strand2Points = []

    for (let i = 0; i < helixData.length; i += 2) {
      if (helixData[i]) {
        strand1Points.push(helixData[i].position)
      }
      if (helixData[i + 1]) {
        strand2Points.push(helixData[i + 1].position)
      }
    }

    return { strand1Points, strand2Points }
  }, [helixData])

  return (
    <>
      {/* Strand 1 backbone */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[
              new Float32Array(
                points.strand1Points.flatMap((p) => [p.x, p.y, p.z]),
              ),
              3,
            ]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#E0E0E0" linewidth={2} />
      </line>

      {/* Strand 2 backbone */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[
              new Float32Array(
                points.strand2Points.flatMap((p) => [p.x, p.y, p.z]),
              ),
              3,
            ]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#E0E0E0" linewidth={2} />
      </line>
    </>
  )
}

// Guide RNA visualization
function GuideRNAVisualization({
  guide,
  sequence,
}: {
  guide: GuideRNA
  sequence: string
}) {
  const points = useMemo(() => {
    const radius = 2.5 // Slightly larger radius for guide RNA
    const height = sequence.length * 0.3
    const turns = sequence.length / 10

    const guidePoints = []
    for (let i = 0; i < 20; i++) {
      // 20bp guide
      const seqIndex = guide.position + i
      const angle = (seqIndex / sequence.length) * turns * Math.PI * 2
      const y = (seqIndex / sequence.length) * height - height / 2

      guidePoints.push(
        new THREE.Vector3(
          Math.cos(angle) * radius,
          y,
          Math.sin(angle) * radius,
        ),
      )
    }

    return guidePoints
  }, [guide, sequence])

  return (
    <group>
      {/* Guide RNA strand */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array(points.flatMap((p) => [p.x, p.y, p.z])), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#FF4081" linewidth={4} />
      </line>

      {/* Guide RNA label */}
      <Text
        position={[
          points[10]?.x || 0,
          (points[10]?.y || 0) + 0.5,
          points[10]?.z || 0,
        ]}
        fontSize={0.3}
        color="#FF4081"
        anchorX="center"
        anchorY="middle"
      >
        Guide RNA
      </Text>
    </group>
  )
}

// Main 3D viewer component
export function MolecularViewer3D({
  sequence,
  selectedGuide,
  onGuideSelect,
  guides = [],
}: MolecularViewer3DProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const cameraRef = useRef<THREE.PerspectiveCamera>(null)
  const controlsRef = useRef<any>(null)

  const resetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(5, 0, 5)
      cameraRef.current.lookAt(0, 0, 0)
      controlsRef.current.reset()
    }
  }

  const ViewerContent = () => (
    <div
      className={`relative ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-900' : 'h-96'}`}
    >
      <Canvas shadows>
        <PerspectiveCamera
          ref={cameraRef}
          makeDefault
          position={[5, 0, 5]}
          fov={60}
        />

        <OrbitControls
          ref={controlsRef}
          enableZoom
          enablePan
          enableRotate
          maxDistance={20}
          minDistance={2}
        />

        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <pointLight position={[-10, -10, -5]} intensity={0.3} />

        {/* Environment */}
        <Environment preset="night" />

        {/* DNA Helix */}
        <DNAHelix
          sequence={sequence}
          selectedGuide={selectedGuide}
          guides={guides}
        />

        {/* Coordinate axes helper */}
        <primitive object={new THREE.AxesHelper(1)} />
      </Canvas>

      {/* 3D Viewer Controls */}
      {showControls && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 right-4 flex flex-col gap-2"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="bg-black/50 border-white/20 text-white hover:bg-white/10"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={resetCamera}
            className="bg-black/50 border-white/20 text-white hover:bg-white/10"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowControls(false)}
            className="bg-black/50 border-white/20 text-white hover:bg-white/10"
          >
            <EyeOff className="h-4 w-4" />
          </Button>
        </motion.div>
      )}

      {/* Show controls button when hidden */}
      {!showControls && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowControls(true)}
          className="absolute top-4 right-4 bg-black/50 border-white/20 text-white hover:bg-white/10"
        >
          <Eye className="h-4 w-4" />
        </Button>
      )}

      {/* Legend */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-sm rounded-lg p-3"
      >
        <h4 className="text-white font-semibold text-sm mb-2">Legend</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <span className="text-white">Adenine (A)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-teal-400"></div>
            <span className="text-white">Thymine (T)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-400"></div>
            <span className="text-white">Guanine (G)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
            <span className="text-white">Cytosine (C)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <span className="text-white">PAM Site</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-400"></div>
            <span className="text-white">Guide Binding</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-pink-400"></div>
            <span className="text-white">Selected Guide</span>
          </div>
        </div>
      </motion.div>
    </div>
  )

  if (isFullscreen) {
    return <ViewerContent />
  }

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <div className="p-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded">
            <ZoomIn className="h-4 w-4 text-white" />
          </div>
          3D Molecular Viewer
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ViewerContent />
      </CardContent>
    </Card>
  )
}

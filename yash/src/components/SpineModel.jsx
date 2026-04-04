import React, { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Environment, Float, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { REGION_DATA } from '../data/regionData'

const VertMesh = ({ region, index, y, z, rl, isSelected, hoveredRegion, onSelect }) => {
  const meshRef = useRef()
  const glowRef = useRef()
  
  const sizeT = region === 'lumbar' ? 1 + index / 5 * 0.15 : region === 'sacral' ? 1 - index / 5 * 0.12 : 1
  const w = rl.baseW * sizeT
  const h = rl.baseH * 0.9
  const d = 0.22 * sizeT

  const isHovered = hoveredRegion === region
  
  useFrame((state) => {
    const time = state.clock.getElapsedTime()
    if (isSelected) {
      meshRef.current.material.emissiveIntensity = 0.8 + Math.sin(time * 4) * 0.2
      glowRef.current.visible = true
      glowRef.current.material.opacity = 0.2 + Math.sin(time * 3) * 0.1
    } else if (isHovered) {
      meshRef.current.material.emissiveIntensity = 0.4
      glowRef.current.visible = false
    } else {
      meshRef.current.material.emissiveIntensity = 0
      glowRef.current.visible = false
    }
  })

  // Create rounded box geometry using a subdivided box or similar
  const geometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(w * 2.2, h, d, 4, 4, 4)
    const pos = geo.attributes.position
    const cornerR = w * 0.4
    for (let i = 0; i < pos.count; i++) {
        let vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i)
        const ax = Math.abs(vx) - (w * 2.2 / 2 - cornerR)
        const ay = Math.abs(vy) - (h / 2 - cornerR)
        if (ax > 0 && ay > 0) {
            const mag = Math.sqrt(ax * ax + ay * ay)
            pos.setX(i, Math.sign(vx) * (w * 2.2 / 2 - cornerR + ax / mag * cornerR))
            pos.setY(i, Math.sign(vy) * (h / 2 - cornerR + ay / mag * cornerR))
        }
    }
    geo.computeVertexNormals()
    return geo
  }, [w, h, d])

  return (
    <group position={[0, y, z]}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        onClick={(e) => { e.stopPropagation(); onSelect(region); }}
        onPointerOver={() => onSelect(region, true)}
        onPointerOut={() => onSelect(null, true)}
        castShadow
      >
        <meshStandardMaterial
          color={REGION_DATA[region].colorHex}
          emissive={REGION_DATA[region].colorHex}
          emissiveIntensity={0}
          roughness={0.1}
          metalness={0.9}
          envMapIntensity={2}
        />
      </mesh>
      
      {/* Spinous Process - Improved Shape */}
      {(region !== 'sacral' || index < 3) && (
        <mesh position={[0, h * 0.2, d * 0.5 + h * 0.3]} rotation={[-Math.PI / 2 + 0.1, 0, 0]} castShadow>
          <coneGeometry args={[h * 0.25, h * 1.2, 8]} />
          <meshStandardMaterial color={REGION_DATA[region].colorHex} roughness={0.2} metalness={0.7} />
        </mesh>
      )}

      {/* Glow Aura Layer */}
      <mesh ref={glowRef} scale={1.4} visible={false}>
        <boxGeometry args={[w * 2.2, h, d]} />
        <meshBasicMaterial color={REGION_DATA[region].colorHex} transparent opacity={0.1} side={THREE.BackSide} />
      </mesh>
    </group>
  )
}

const Spine = ({ selectedRegion, hoveredRegion, onSelect }) => {
  const regionLayout = {
    cervical: { yTop: 3.15, yBot: 1.55, count: 7, curve: 0.12, baseW: 0.18, baseH: 0.22 },
    thoracic: { yTop: 1.45, yBot: -1.0, count: 12, curve: -0.08, baseW: 0.20, baseH: 0.18 },
    lumbar: { yTop: -1.1, yBot: -2.45, count: 5, curve: 0.10, baseW: 0.26, baseH: 0.22 },
    sacral: { yTop: -2.55, yBot: -3.4, count: 5, curve: -0.04, baseW: 0.28, baseH: 0.16 },
  }

  const vertebrae = useMemo(() => {
    const items = []
    Object.keys(regionLayout).forEach((key) => {
      const rl = regionLayout[key]
      const totalH = rl.yTop - rl.yBot
      const gap = totalH / (rl.count - 0.5)
      for (let i = 0; i < rl.count; i++) {
        const t = i / Math.max(rl.count - 1, 1)
        const y = rl.yTop - i * gap
        const z = 0.9 + rl.curve * Math.sin(t * Math.PI)
        items.push({ region: key, index: i, y, z, rl })
      }
    })
    return items
  }, [])

  return (
    <group>
      {vertebrae.map((v, i) => (
        <VertMesh
          key={i}
          {...v}
          isSelected={selectedRegion === v.region}
          hoveredRegion={hoveredRegion}
          onSelect={onSelect}
        />
      ))}
    </group>
  )
}

const Scene = ({ selectedRegion, onSelect, setHoveredRegion, hoveredRegion }) => {
  const { camera } = useThree()
  const targetPos = useRef(new THREE.Vector3(0, 0, 7.5))
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0))

  useFrame((state) => {
    const t = 0.08 // lerp factor
    
    if (selectedRegion) {
      // In docked state, we want a punchier side view of the model
      targetPos.current.set(3, 0, 6)
      targetLookAt.current.set(0, 0, 0)
    } else {
      targetPos.current.set(0, 0, 8)
      targetLookAt.current.set(0, 0, 0)
    }
    
    camera.position.lerp(targetPos.current, t)
    camera.lookAt(targetLookAt.current)
  })

  return (
    <>
      <PerspectiveCamera makeDefault fov={40} />
      <OrbitControls 
        enablePan={false} 
        enableZoom={!selectedRegion} 
        enableRotate={!selectedRegion}
        minDistance={4}
        maxDistance={12}
        autoRotate={!selectedRegion}
        autoRotateSpeed={0.5}
      />
      
      <ambientLight intensity={1.2} color="#1a2a4a" />
      <directionalLight position={[10, 10, 5]} intensity={3} color="#ffffff" castShadow />
      <pointLight position={[-10, 5, -5]} intensity={2} color="#3a8fff" />
      <spotLight position={[0, 10, 0]} intensity={1.5} angle={0.5} penumbra={1} color="#ffffff" />
      
      <Environment preset="night" />

      <group rotation={[0, -0.3, 0]}>
        <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
          <Spine 
            selectedRegion={selectedRegion} 
            hoveredRegion={hoveredRegion} 
            onSelect={(r, isHover) => isHover ? setHoveredRegion(r) : onSelect(r)} 
          />
        </Float>
      </group>

      <ContactShadows position={[0, -4, 0]} opacity={0.4} scale={20} blur={2.5} far={4.5} />
    </>
  )
}

const SpineModel = ({ selectedRegion, onSelect }) => {
  const [hoveredRegion, setHoveredRegion] = useState(null)

  return (
    <div className={`spine-canvas-container transition-all duration-1000 ease-in-out ${selectedRegion ? 'docked' : 'full'}`}>
      <Canvas shadows dpr={[1, 2]}>
        <Scene 
          selectedRegion={selectedRegion} 
          hoveredRegion={hoveredRegion}
          onSelect={onSelect} 
          setHoveredRegion={setHoveredRegion}
        />
      </Canvas>
      
      {!selectedRegion && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-5 text-[15vw] font-serif select-none uppercase tracking-tighter">
          Vertebra
        </div>
      )}
    </div>
  )
}

export default SpineModel

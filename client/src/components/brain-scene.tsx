import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

function BrainMesh() {
  const groupRef = useRef<THREE.Group>(null);

  // Smooth mouse-tracking rotation
  useFrame(({ pointer }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += (pointer.x * 0.6 - groupRef.current.rotation.y) * 0.04;
      groupRef.current.rotation.x += (-pointer.y * 0.35 - groupRef.current.rotation.x) * 0.04;
    }
  });

  // Glossy iridescent material for hemispheres
  const leftMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#a78bfa"),
    metalness: 0.1,
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    transmission: 0.6,
    thickness: 1.5,
    ior: 1.45,
    iridescence: 1.0,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [100, 800],
    transparent: true,
    opacity: 0.92,
    envMapIntensity: 1.5,
    side: THREE.DoubleSide,
  }), []);

  const rightMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#818cf8"),
    metalness: 0.1,
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    transmission: 0.6,
    thickness: 1.5,
    ior: 1.45,
    iridescence: 1.0,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [100, 800],
    transparent: true,
    opacity: 0.92,
    envMapIntensity: 1.5,
    side: THREE.DoubleSide,
  }), []);

  const innerMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#6366f1"),
    metalness: 0.15,
    roughness: 0.12,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
    transmission: 0.4,
    thickness: 1.0,
    ior: 1.4,
    iridescence: 0.7,
    iridescenceIOR: 1.2,
    iridescenceThicknessRange: [100, 600],
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
  }), []);

  const stemMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#7c3aed"),
    metalness: 0.2,
    roughness: 0.15,
    clearcoat: 0.6,
    clearcoatRoughness: 0.15,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  }), []);

  return (
    <Float speed={1.5} rotationIntensity={0.15} floatIntensity={0.4}>
      <group ref={groupRef} scale={1.4}>
        {/* Left hemisphere */}
        <mesh position={[-0.35, 0.05, 0]} material={leftMat}>
          <sphereGeometry args={[1.05, 64, 64]} />
        </mesh>

        {/* Right hemisphere */}
        <mesh position={[0.35, 0.05, 0]} material={rightMat}>
          <sphereGeometry args={[1.05, 64, 64]} />
        </mesh>

        {/* Central fissure glow line */}
        <mesh position={[0, 0.1, 0.6]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, 1.6, 8]} />
          <meshStandardMaterial
            color="#c4b5fd"
            emissive="#c4b5fd"
            emissiveIntensity={3}
            transparent
            opacity={0.5}
          />
        </mesh>

        {/* Cerebellum */}
        <mesh position={[0, -0.6, -0.45]} material={innerMat}>
          <sphereGeometry args={[0.5, 32, 32]} />
        </mesh>

        {/* Brain stem */}
        <mesh position={[0, -1.05, -0.2]} material={stemMat}>
          <cylinderGeometry args={[0.12, 0.18, 0.5, 16]} />
        </mesh>

        {/* Neural particles */}
        <NeuralParticles />
      </group>
    </Float>
  );
}

function NeuralParticles() {
  const particlesRef = useRef<THREE.Points>(null);
  const count = 200;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const r = 0.8 + Math.random() * 0.8;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi) * 0.8 - 0.2;
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) * 0.7;
    }
    return pos;
  }, []);

  useFrame(({ clock }) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y = clock.getElapsedTime() * 0.05;
      const mat = particlesRef.current.material as THREE.PointsMaterial;
      mat.opacity = 0.3 + Math.sin(clock.getElapsedTime() * 2) * 0.15;
    }
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.025}
        color="#a78bfa"
        transparent
        opacity={0.4}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

export default function BrainScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.5], fov: 45 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
      dpr={[1, 2]}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} />
      <directionalLight position={[-5, -5, -5]} intensity={0.4} color="#818cf8" />
      <pointLight position={[0, 2, 3]} intensity={2} color="#a78bfa" distance={10} />
      <pointLight position={[0, -2, -2]} intensity={0.8} color="#6366f1" distance={8} />
      <pointLight position={[3, 0, 2]} intensity={0.6} color="#c4b5fd" distance={8} />
      <BrainMesh />
    </Canvas>
  );
}

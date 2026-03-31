import { useRef, useMemo } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Float, Environment } from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import brainModelUrl from "@assets/brain.stl?url";

function BrainModel() {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);

  // Load the real brain STL model
  const geometry = useLoader(STLLoader, brainModelUrl);

  // Process geometry
  const processedGeometry = useMemo(() => {
    if (!geometry) return null;
    const geo = geometry.clone();
    geo.computeVertexNormals();
    // Already centered and scaled during export, but ensure it
    geo.center();
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const s = 2.8 / maxDim;
      geo.scale(s, s, s);
    }
    return geo;
  }, [geometry]);

  // Base rotation to orient brain facing viewer (front-facing, slightly tilted)
  const baseRotation = useMemo(() => new THREE.Euler(-Math.PI * 0.5, 0, Math.PI), []);

  // Mouse-tracking rotation + subtle iridescence animation
  useFrame(({ pointer, clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = baseRotation.y + pointer.x * 0.4;
      groupRef.current.rotation.x = baseRotation.x + pointer.y * 0.15;
      groupRef.current.rotation.z = baseRotation.z;
    }
    if (materialRef.current) {
      materialRef.current.iridescenceIOR = 1.3 + Math.sin(clock.getElapsedTime() * 0.4) * 0.1;
    }
  });

  if (!processedGeometry) return null;

  return (
    <Float speed={1.2} rotationIntensity={0.08} floatIntensity={0.25}>
      <group ref={groupRef}>
        {/* Main brain — high-gloss iridescent material */}
        <mesh geometry={processedGeometry} castShadow receiveShadow>
          <meshPhysicalMaterial
            ref={materialRef}
            color="#c4b5fd"
            metalness={0.08}
            roughness={0.04}
            clearcoat={1.0}
            clearcoatRoughness={0.02}
            iridescence={1.0}
            iridescenceIOR={1.3}
            iridescenceThicknessRange={[100, 900]}
            sheen={0.6}
            sheenRoughness={0.25}
            sheenColor={new THREE.Color("#a78bfa")}
            envMapIntensity={2.2}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Subtle inner glow — backface-only emissive shell */}
        <mesh geometry={processedGeometry} scale={0.99}>
          <meshStandardMaterial
            color="#7c3aed"
            emissive="#6366f1"
            emissiveIntensity={0.12}
            transparent
            opacity={0.25}
            side={THREE.BackSide}
          />
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
      const r = 1.2 + Math.random() * 0.7;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi) * 0.85;
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) * 0.7;
    }
    return pos;
  }, []);

  useFrame(({ clock }) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y = clock.getElapsedTime() * 0.04;
      const mat = particlesRef.current.material as THREE.PointsMaterial;
      mat.opacity = 0.2 + Math.sin(clock.getElapsedTime() * 1.5) * 0.12;
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
        size={0.02}
        color="#a78bfa"
        transparent
        opacity={0.3}
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
      camera={{ position: [0, 0, 4.2], fov: 42 }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.3,
      }}
      style={{ background: "transparent" }}
      dpr={[1, 2]}
    >
      {/* Key light — soft warm from top-right */}
      <directionalLight position={[4, 5, 5]} intensity={1.6} color="#f5f0ff" />
      {/* Fill — cool indigo from left */}
      <directionalLight position={[-5, -2, -4]} intensity={0.5} color="#818cf8" />
      {/* Rim lights for glossy edge highlights */}
      <pointLight position={[0, 3, 4]} intensity={2.5} color="#a78bfa" distance={12} />
      <pointLight position={[-3, -1, -3]} intensity={1.0} color="#6366f1" distance={10} />
      <pointLight position={[3, -2, 2]} intensity={0.6} color="#c4b5fd" distance={8} />
      {/* Ambient */}
      <ambientLight intensity={0.25} />
      {/* Environment for realistic reflections on the glossy surface */}
      <Environment preset="city" environmentIntensity={0.5} />
      <BrainModel />
    </Canvas>
  );
}

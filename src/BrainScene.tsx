import { useRef, useMemo } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Float, Environment } from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

function BrainModel() {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);

  const basePath = import.meta.env.BASE_URL || "/";
  const geometry = useLoader(STLLoader, `${basePath}brain.stl`);

  const processedGeometry = useMemo(() => {
    if (!geometry) return null;
    const geo = geometry.clone();
    geo.computeVertexNormals();
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

  const targetQuat = useRef(new THREE.Quaternion());
  const currentQuat = useRef(new THREE.Quaternion());

  const baseQuat = useMemo(() => {
    const q = new THREE.Quaternion();
    const euler = new THREE.Euler(-Math.PI * 0.5, 0, Math.PI, "XYZ");
    q.setFromEuler(euler);
    return q;
  }, []);

  useMemo(() => {
    currentQuat.current.copy(baseQuat);
  }, [baseQuat]);

  useFrame(({ pointer, clock }) => {
    if (!groupRef.current) return;
    const rotY = pointer.x * 0.6;
    const rotX = -pointer.y * 0.3;
    const offsetEuler = new THREE.Euler(rotX, rotY, 0, "YXZ");
    const offsetQuat = new THREE.Quaternion().setFromEuler(offsetEuler);
    targetQuat.current.copy(offsetQuat).multiply(baseQuat);
    currentQuat.current.slerp(targetQuat.current, 0.05);
    groupRef.current.quaternion.copy(currentQuat.current);

    if (materialRef.current) {
      const t = clock.getElapsedTime();
      materialRef.current.iridescenceIOR = 1.3 + Math.sin(t * 0.4) * 0.15;
    }
  });

  if (!processedGeometry) return null;

  return (
    <Float speed={0.8} rotationIntensity={0.03} floatIntensity={0.15}>
      <group ref={groupRef}>
        <mesh geometry={processedGeometry} castShadow receiveShadow>
          <meshPhysicalMaterial
            ref={materialRef}
            color="#b07cc8"
            metalness={0.08}
            roughness={0.02}
            clearcoat={1.0}
            clearcoatRoughness={0.01}
            reflectivity={1.0}
            iridescence={1.0}
            iridescenceIOR={1.3}
            iridescenceThicknessRange={[100, 600]}
            sheen={1.0}
            sheenRoughness={0.15}
            sheenColor={new THREE.Color("#8b5cf6")}
            envMapIntensity={1.5}
            side={THREE.DoubleSide}
            transparent={false}
          />
        </mesh>
        <mesh geometry={processedGeometry}>
          <meshPhysicalMaterial
            color="#1a0a2e"
            emissive="#7c3aed"
            emissiveIntensity={0.15}
            metalness={0.0}
            roughness={1.0}
            transparent
            opacity={0.12}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>
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
      const r = 1.2 + Math.random() * 0.5;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi) * 0.85;
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) * 0.7;
    }
    return pos;
  }, []);

  useFrame(({ clock }) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y = clock.getElapsedTime() * 0.03;
      const mat = particlesRef.current.material as THREE.PointsMaterial;
      mat.opacity = 0.18 + Math.sin(clock.getElapsedTime() * 1.2) * 0.08;
    }
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.02}
        color="#c4b5fd"
        transparent
        opacity={0.2}
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
      camera={{ position: [0, 0, 4.2], fov: 38 }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
      }}
      style={{ background: "transparent" }}
      dpr={[1, 2]}
    >
      <directionalLight position={[4, 5, 5]} intensity={1.5} color="#fff5f0" />
      <directionalLight position={[-5, 0, -2]} intensity={0.5} color="#a78bfa" />
      <spotLight position={[0, 6, 4]} intensity={3.0} color="#e0d4ff" distance={16} angle={0.6} penumbra={0.5} />
      <pointLight position={[-5, 1, 4]} intensity={1.0} color="#818cf8" distance={12} />
      <pointLight position={[5, -1, 3]} intensity={0.8} color="#c4b5fd" distance={12} />
      <pointLight position={[0, 0, 6]} intensity={0.6} color="#ede9fe" distance={14} />
      <pointLight position={[0, -4, 2]} intensity={0.3} color="#7c3aed" distance={10} />
      <ambientLight intensity={0.08} />
      <Environment preset="city" environmentIntensity={0.6} />
      <BrainModel />
    </Canvas>
  );
}

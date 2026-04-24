import { useRef, useMemo } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Float, Environment } from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

// ── Breathing cycle constants ──
const BREATH_PERIOD = 6; // seconds per full breath cycle

function BrainModel() {
  const groupRef = useRef<THREE.Group>(null);
  const solidRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const wireRef = useRef<THREE.MeshBasicMaterial>(null);
  const glowRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const innerGlowRef = useRef<THREE.MeshBasicMaterial>(null);

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

  // Wireframe geometry (edges)
  const wireGeometry = useMemo(() => {
    if (!processedGeometry) return null;
    return new THREE.WireframeGeometry(processedGeometry);
  }, [processedGeometry]);

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

    // Mouse-follow rotation
    const rotY = pointer.x * 0.6;
    const rotX = -pointer.y * 0.3;
    const offsetEuler = new THREE.Euler(rotX, rotY, 0, "YXZ");
    const offsetQuat = new THREE.Quaternion().setFromEuler(offsetEuler);
    targetQuat.current.copy(offsetQuat).multiply(baseQuat);
    currentQuat.current.slerp(targetQuat.current, 0.05);
    groupRef.current.quaternion.copy(currentQuat.current);

    const t = clock.getElapsedTime();

    // Breathing curve: smooth sine wave
    // 0 = fully solid, 1 = fully wireframe
    const rawBreath = Math.sin((t / BREATH_PERIOD) * Math.PI * 2);
    // Transform to spend more time solid, brief transitions to wire
    const breath = Math.pow(Math.max(0, rawBreath), 0.7); // 0→1 wireframe amount

    // Solid material breathing
    if (solidRef.current) {
      solidRef.current.opacity = 1.0 - breath * 0.85;
      solidRef.current.metalness = 0.08 + breath * 0.3;
      solidRef.current.roughness = 0.02 + breath * 0.6;
      solidRef.current.iridescenceIOR = 1.3 + Math.sin(t * 0.4) * 0.15;
      solidRef.current.clearcoat = 1.0 - breath * 0.8;
      solidRef.current.envMapIntensity = 1.5 - breath * 1.2;
      solidRef.current.sheenRoughness = 0.15 + breath * 0.5;
      solidRef.current.emissiveIntensity = breath * 0.15;
    }

    // Wireframe breathing
    if (wireRef.current) {
      wireRef.current.opacity = breath * 0.5;
    }

    // Outer glow pulse
    if (glowRef.current) {
      glowRef.current.emissiveIntensity = 0.1 + breath * 0.25 + Math.sin(t * 1.5) * 0.05;
      glowRef.current.opacity = 0.08 + breath * 0.12;
    }

    // Inner glow (visible during wireframe phase)
    if (innerGlowRef.current) {
      innerGlowRef.current.opacity = breath * 0.2;
    }

    // Subtle scale breathing
    const scaleBreath = 1.0 + Math.sin(t * 0.8) * 0.012;
    groupRef.current.scale.setScalar(scaleBreath);
  });

  if (!processedGeometry) return null;

  return (
    <Float speed={0.8} rotationIntensity={0.03} floatIntensity={0.15}>
      <group ref={groupRef}>
        {/* Primary solid brain */}
        <mesh geometry={processedGeometry} castShadow receiveShadow>
          <meshPhysicalMaterial
            ref={solidRef}
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
            transparent
            opacity={1.0}
            emissive="#7c3aed"
            emissiveIntensity={0}
          />
        </mesh>

        {/* Wireframe overlay (spiderweb) */}
        {wireGeometry && (
          <lineSegments geometry={wireGeometry}>
            <lineBasicMaterial
              ref={wireRef}
              color="#c4b5fd"
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </lineSegments>
        )}

        {/* Inner glow sphere (visible through wireframe) */}
        <mesh scale={[0.85, 0.75, 0.6]}>
          <sphereGeometry args={[1.4, 32, 32]} />
          <meshBasicMaterial
            ref={innerGlowRef}
            color="#8b5cf6"
            transparent
            opacity={0}
            side={THREE.FrontSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* Outer emissive glow shell */}
        <mesh geometry={processedGeometry}>
          <meshPhysicalMaterial
            ref={glowRef}
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
        <NeuralPulseRings />
      </group>
    </Float>
  );
}

// ── Neural particles with breathing ──
function NeuralParticles() {
  const particlesRef = useRef<THREE.Points>(null);
  const count = 350;

  const { positions, phases } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const ph = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const r = 1.0 + Math.random() * 0.8;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi) * 0.85;
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) * 0.7;
      sz[i] = 0.01 + Math.random() * 0.025;
      ph[i] = Math.random() * Math.PI * 2;
    }
    void sz;
    return { positions: pos, phases: ph };
  }, []);

  const basePositions = useMemo(() => new Float32Array(positions), [positions]);

  useFrame(({ clock }) => {
    if (!particlesRef.current) return;
    const t = clock.getElapsedTime();

    // Breathing: particles expand outward during wireframe phase
    const rawBreath = Math.sin((t / BREATH_PERIOD) * Math.PI * 2);
    const breath = Math.pow(Math.max(0, rawBreath), 0.7);

    const posAttr = particlesRef.current.geometry.attributes.position;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const bx = basePositions[i * 3];
      const by = basePositions[i * 3 + 1];
      const bz = basePositions[i * 3 + 2];
      // Expand outward during wire phase + gentle orbit
      const expand = 1.0 + breath * 0.15;
      const orbit = Math.sin(t * 0.5 + phases[i]) * 0.04;
      arr[i * 3] = bx * expand + orbit;
      arr[i * 3 + 1] = by * expand + Math.cos(t * 0.3 + phases[i]) * 0.03;
      arr[i * 3 + 2] = bz * expand;
    }
    posAttr.needsUpdate = true;

    particlesRef.current.rotation.y = t * 0.03;
    const mat = particlesRef.current.material as THREE.PointsMaterial;
    mat.opacity = 0.15 + breath * 0.2 + Math.sin(t * 1.2) * 0.05;
    mat.size = 0.018 + breath * 0.012;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
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

// ── Pulse rings that radiate outward ──
function NeuralPulseRings() {
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    const animateRing = (ref: React.RefObject<THREE.Mesh | null>, offset: number) => {
      if (!ref.current) return;
      const cycle = ((t + offset) % 3.5) / 3.5; // 3.5s per ring cycle
      const scale = 0.6 + cycle * 1.8;
      ref.current.scale.setScalar(scale);
      const mat = ref.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.12 * (1 - cycle));
    };

    animateRing(ring1Ref, 0);
    animateRing(ring2Ref, 1.17);
    animateRing(ring3Ref, 2.34);
  });

  const ringGeo = useMemo(() => new THREE.RingGeometry(1.3, 1.35, 64), []);

  return (
    <>
      {[ring1Ref, ring2Ref, ring3Ref].map((ref, i) => (
        <mesh key={i} ref={ref} rotation-x={-Math.PI * 0.5} geometry={ringGeo}>
          <meshBasicMaterial
            color="#8b5cf6"
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
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

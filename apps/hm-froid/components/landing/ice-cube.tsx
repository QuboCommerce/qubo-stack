"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Float,
  Lightformer,
  MeshTransmissionMaterial,
  RoundedBox,
  Text,
} from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import { useTheme } from "next-themes";
import * as THREE from "three";

/* A single melt drop: grows at the cube's lower edge, falls, fades, loops. */
function Drip({
  offset,
  x,
  z,
  speed,
}: {
  offset: number;
  x: number;
  z: number;
  speed: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    const t = ((clock.elapsedTime * speed + offset) % 4) / 4; // 0..1 cycle
    const mesh = ref.current;
    if (!mesh) return;

    if (t < 0.35) {
      // swell on the cube's underside
      const s = (t / 0.35) * 0.09;
      mesh.position.set(x, -1.42, z);
      mesh.scale.setScalar(s);
    } else {
      // free fall + slight stretch
      const f = (t - 0.35) / 0.65;
      mesh.position.set(x, -1.42 - f * 2.2, z);
      mesh.scale.set(0.07, 0.07 + f * 0.05, 0.07);
    }
    const material = mesh.material as THREE.MeshPhysicalMaterial;
    material.opacity = t < 0.35 ? 0.9 : 0.9 * (1 - (t - 0.35) / 0.65);
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshPhysicalMaterial
        transparent
        roughness={0}
        metalness={0}
        transmission={0.6}
        color="#bfe6ff"
        ior={1.33}
      />
    </mesh>
  );
}

/* Tiny air bubbles trapped in the ice. */
function Bubbles() {
  const bubbles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        position: [
          (Math.sin(i * 12.9898) * 0.5) * 2.1,
          (Math.sin(i * 78.233) * 0.5) * 2.1,
          (Math.sin(i * 43.758) * 0.5) * 2.1,
        ] as [number, number, number],
        scale: 0.02 + Math.abs(Math.sin(i * 7.13)) * 0.045,
      })),
    []
  );

  return (
    <>
      {bubbles.map((b, i) => (
        <mesh key={i} position={b.position} scale={b.scale}>
          <sphereGeometry args={[1, 10, 10]} />
          <meshStandardMaterial
            color="#eaf7ff"
            roughness={0.1}
            transparent
            opacity={0.55}
          />
        </mesh>
      ))}
    </>
  );
}

function Cube({ dark }: { dark: boolean }) {
  const group = useRef<THREE.Group>(null!);
  // The transmission buffer has no page behind it, so we tint it to match the site background
  const bufferBackground = useMemo(
    () => new THREE.Color(dark ? "#101c30" : "#eef7ff"),
    [dark]
  );

  useFrame((state, delta) => {
    if (!group.current) return;
    // Resting tilt shows two faces; the pointer nudges it around that pose
    const targetY = 0.32 + state.pointer.x * 0.4;
    const targetX = -0.1 - state.pointer.y * 0.25;
    group.current.rotation.y = THREE.MathUtils.damp(
      group.current.rotation.y,
      targetY,
      3,
      delta
    );
    group.current.rotation.x = THREE.MathUtils.damp(
      group.current.rotation.x,
      targetX,
      3,
      delta
    );
  });

  return (
    <group ref={group}>
      <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.6}>
        {/* The "HM" frozen inside */}
        <Suspense fallback={null}>
          <Text
            font="/fonts/Anton-Regular.ttf"
            fontSize={1.5}
            letterSpacing={-0.02}
            position={[0, 0, 0]}
            anchorX="center"
            anchorY="middle"
          >
            HM
            <meshStandardMaterial
              color={dark ? "#bfe4ff" : "#0d3a6e"}
              roughness={0.25}
              metalness={0.35}
            />
          </Text>
        </Suspense>

        <Bubbles />

        {/* The ice block itself */}
        <RoundedBox args={[2.85, 2.85, 2.85]} radius={0.32} smoothness={10}>
          <MeshTransmissionMaterial
            transmission={1}
            thickness={2}
            roughness={0.04}
            ior={1.31}
            chromaticAberration={0.06}
            anisotropicBlur={0.04}
            distortion={0.16}
            distortionScale={0.5}
            temporalDistortion={0.06}
            color="#ecf8ff"
            attenuationColor="#a8d8ff"
            attenuationDistance={2.8}
            background={bufferBackground}
          />
        </RoundedBox>
      </Float>

      {/* Melt drips */}
      <Drip offset={0} x={-0.9} z={0.4} speed={0.9} />
      <Drip offset={1.7} x={0.7} z={-0.5} speed={0.7} />
      <Drip offset={3.1} x={0.2} z={0.9} speed={1.1} />
    </group>
  );
}

export default function IceCube() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.2, 7.5], fov: 32 }}
      gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 6, 4]} intensity={1.4} />

      <Cube dark={dark} />

      <ContactShadows
        position={[0, -2.6, 0]}
        opacity={0.35}
        scale={9}
        blur={2.6}
        far={3}
        color="#0a2a52"
      />

      {/* Studio-style reflections without fetching an HDRI over the network */}
      <Environment resolution={256}>
        <Lightformer
          intensity={2}
          position={[0, 5, -9]}
          rotation-x={Math.PI / 2}
          scale={[10, 10, 1]}
        />
        <Lightformer
          intensity={1.6}
          position={[-5, 1, -1]}
          rotation-y={Math.PI / 2}
          scale={[12, 2, 1]}
          color="#cfeaff"
        />
        <Lightformer
          intensity={1.2}
          position={[6, 2, 1]}
          rotation-y={-Math.PI / 2}
          scale={[12, 2, 1]}
        />
        <Lightformer
          intensity={0.8}
          position={[0, -4, 6]}
          scale={[8, 3, 1]}
          color="#9fd4ff"
        />
      </Environment>
    </Canvas>
  );
}

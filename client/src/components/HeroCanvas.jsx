import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Cylinder, Box, Torus, Sphere, Trail, Stars } from '@react-three/drei';
import * as THREE from 'three';

const WifiSignal = () => {
    const group = useRef();

    useFrame((state) => {
        if (group.current) {
            // Pulse effect scaling
            const t = state.clock.getElapsedTime();
            group.current.children.forEach((child, i) => {
                const offset = i * 0.5;
                const scale = (Math.sin(t * 2 - offset) + 1) / 2 * 0.5 + 0.8;
                child.scale.set(scale, scale, 1);
                child.material.opacity = 1 - scale + 0.2;
            });
            group.current.rotation.z = Math.sin(t * 0.5) * 0.1;
        }
    });

    return (
        <group ref={group} position={[0, 0, 0]} rotation={[0.5, 0, 0]}>
            {[0, 1, 2].map((i) => (
                <Torus key={i} args={[2 + i * 0.8, 0.15, 16, 100, Math.PI / 1.5]} rotation={[0, 0, 0.52]} position={[0, -1, 0]}>
                    <meshStandardMaterial
                        color="#20B2AA"
                        transparent
                        opacity={0.8}
                        emissive="#20B2AA"
                        emissiveIntensity={2}
                        toneMapped={false}
                    />
                </Torus>
            ))}
            <Sphere args={[0.6, 32, 32]} position={[0, -1, 0]}>
                <meshStandardMaterial color="white" emissive="#20B2AA" emissiveIntensity={1} />
            </Sphere>
        </group>
    );
};

const FloatingFile = ({ position, color = "white", delay = 0 }) => {
    const ref = useRef();

    useFrame((state) => {
        const t = state.clock.getElapsedTime() + delay;
        // Floating animation
        ref.current.position.y += Math.sin(t) * 0.002;
        ref.current.rotation.x = Math.sin(t * 0.5) * 0.2;
        ref.current.rotation.y += 0.01;
    });

    return (
        <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
            <group ref={ref} position={position}>
                {/* File Body */}
                <Box args={[1.5, 2, 0.2]}>
                    <meshStandardMaterial color={color} metalness={0.5} roughness={0.2} />
                </Box>
                {/* File Label Line */}
                <Box args={[0.8, 0.1, 0.22]} position={[0, 0.2, 0]}>
                    <meshStandardMaterial color="#20B2AA" />
                </Box>
                <Box args={[0.8, 0.1, 0.22]} position={[0, -0.2, 0]}>
                    <meshStandardMaterial color="#cccccc" />
                </Box>
            </group>
        </Float>
    );
};

const DataParticles = () => {
    const count = 20;
    const mesh = useRef();

    // Generate random positions using useMemo to keep them stable
    const particles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < count; i++) {
            const t = Math.random() * 100;
            const factor = 20 + Math.random() * 100;
            const speed = 0.01 + Math.random() / 200;
            const xFactor = -5 + Math.random() * 10;
            const yFactor = -5 + Math.random() * 10;
            const zFactor = -5 + Math.random() * 10;
            temp.push({ t, factor, speed, xFactor, yFactor, zFactor, mx: 0, my: 0 });
        }
        return temp;
    }, [count]);

    useFrame((state) => {
        particles.forEach((particle, i) => {
            let { t, factor, speed, xFactor, yFactor, zFactor } = particle
            t = particle.t += speed / 2
            const a = Math.cos(t) + Math.sin(t * 1) / 10
            const b = Math.sin(t) + Math.cos(t * 2) / 10
            const s = Math.cos(t)

            // Move particles randomly
            const dummy = new THREE.Object3D();
            dummy.position.set(
                (particle.mx += (state.mouse.x * 10 - particle.mx) * 0.02) + xFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 1) * factor) / 10,
                (particle.my += (state.mouse.y * 10 - particle.my) * 0.02) + yFactor + Math.sin((t / 10) * factor) + (Math.cos(t * 2) * factor) / 10,
                (particle.my += (state.mouse.y * 10 - particle.my) * 0.02) + zFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 3) * factor) / 10
            )
            dummy.scale.set(s, s, s)
            dummy.updateMatrix();
            mesh.current.setMatrixAt(i, dummy.matrix);
        })
        mesh.current.instanceMatrix.needsUpdate = true
    });

    return (
        <instancedMesh ref={mesh} args={[null, null, count]}>
            <sphereGeometry args={[0.1, 10, 10]} />
            <meshBasicMaterial color="#20B2AA" transparent opacity={0.6} />
        </instancedMesh>
    );
}

const Scene = () => {
    const { viewport } = useThree();
    // Scale down if viewport width is small (e.g. mobile)
    // Viewport width at z=0 with default camera is roughly 8-10 units on standard screens.
    // On mobile portrait it might be ~3-5 units.
    const isMobile = viewport.width < 6;
    const scale = isMobile ? 0.55 : 1;
    const positionX = isMobile ? 0 : 1;
    const positionY = isMobile ? 0.5 : 0; // Slight uplift on mobile

    return (
        <group position={[positionX, positionY, 0]} rotation={[0, -0.3, 0]} scale={[scale, scale, scale]}>
            <WifiSignal />

            {/* Floating Files representing transfer */}
            <FloatingFile position={[-3.5, 2, 0]} color="white" delay={0} />
            <FloatingFile position={[3.5, -1.5, 1]} color="#e0e7ff" delay={2} />
            <FloatingFile position={[-2, -2.5, -1]} color="#20B2AA" delay={4} />

            {/* Connecting Particles */}
            <DataParticles />
        </group>
    );
};

const HeroCanvas = () => {
    return (
        <div className="absolute inset-0 z-[-1] overflow-hidden pointer-events-none opacity-80 md:opacity-100">
            <Canvas camera={{ position: [0, 0, 10], fov: 45 }} dpr={[1, 2]}> {/* dpr for better mobile sharpness */}
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} intensity={1} color="white" />
                <pointLight position={[-10, 0, -10]} intensity={2} color="#20B2AA" />

                <Scene />

                {/* Background Stars/Noise for depth */}
                <Stars radius={100} depth={50} count={1000} factor={4} saturation={0} fade speed={1} />
            </Canvas>
        </div>
    );
};

export default HeroCanvas;

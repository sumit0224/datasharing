import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial, OrbitControls, Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

const LocalGlobe = ({ color, wireframe }) => {
    const meshRef = useRef();

    useFrame((state, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * 0.5;
            meshRef.current.rotation.x += delta * 0.2;
        }
    });

    return (
        <Sphere args={[1, 32, 32]} ref={meshRef} scale={2}>
            <MeshDistortMaterial
                color={color}
                attach="material"
                distort={0.4}
                speed={2}
                roughness={0}
                wireframe={wireframe}
            />
        </Sphere>
    );
};

const OnlineGlobe = ({ color }) => {
    const pointsRef = useRef();

    // Generate random points on a sphere surface
    const particlesPosition = useMemo(() => {
        const count = 3000;
        const positions = new Float32Array(count * 3);
        const radius = 2.2;

        for (let i = 0; i < count; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
        }

        return positions;
    }, []);

    useFrame((state, delta) => {
        if (pointsRef.current) {
            pointsRef.current.rotation.y += delta * 0.8; // Faster rotation
        }
    });

    return (
        <group rotation={[0, 0, Math.PI / 4]}>
            <Points ref={pointsRef} positions={particlesPosition} stride={3} frustumCulled={false}>
                <PointMaterial
                    transparent
                    color={color}
                    size={0.05}
                    sizeAttenuation={true}
                    depthWrite={false}
                />
            </Points>
            {/* Core Sphere */}
            <Sphere args={[1.8, 32, 32]} scale={1}>
                <meshBasicMaterial color={color} wireframe opacity={0.1} transparent />
            </Sphere>
        </group>
    );
};

const Globe3D = ({
    className,
    color = "#20B2AA",
    wireframe = true,
    size = '100px',
    variant = 'default' // 'default' or 'online'
}) => {
    return (
        <div style={{ width: size, height: size }} className={className}>
            <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} />

                {variant === 'online' ? (
                    <OnlineGlobe color={color} />
                ) : (
                    <LocalGlobe color={color} wireframe={wireframe} />
                )}

                <OrbitControls enableZoom={false} enablePan={false} autoRotate={variant !== 'online'} autoRotateSpeed={5} />
            </Canvas>
        </div>
    );
};

export default Globe3D;

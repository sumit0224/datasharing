import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial, Float } from '@react-three/drei';

const AnimatedSphere = () => {
    const sphereRef = useRef();

    useFrame((state) => {
        if (sphereRef.current) {
            // Slow rotation
            sphereRef.current.rotation.y += 0.005;
            sphereRef.current.rotation.x += 0.002;

            // Slight interaction with mouse
            const { x, y } = state.mouse;
            sphereRef.current.rotation.x += y * 0.01;
            sphereRef.current.rotation.y += x * 0.01;
        }
    });

    return (
        <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
            <Sphere args={[1, 100, 200]} scale={2.4} ref={sphereRef}>
                <MeshDistortMaterial
                    color="#8b5cf6" // Purple-500
                    attach="material"
                    distort={0.4}
                    speed={1.5}
                    roughness={0.2}
                    metalness={0.8}
                />
            </Sphere>
        </Float>
    );
};

const HeroCanvas = () => {
    return (
        <div className="absolute inset-0 z-[-1] overflow-hidden pointer-events-none opacity-60 md:opacity-100">
            <Canvas>
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} intensity={1} />
                <pointLight position={[-10, -10, -5]} intensity={1} color="#c084fc" />
                <AnimatedSphere />
            </Canvas>
        </div>
    );
};

export default HeroCanvas;

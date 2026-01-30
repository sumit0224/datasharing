import React, { useEffect, useState } from 'react';

const MouseGlow = () => {
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (event) => {
            setMousePos({ x: event.clientX, y: event.clientY });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    return (
        <div
            className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-300"
            aria-hidden="true"
        >
            <div
                className="absolute rounded-full bg-purple-500/20 blur-[100px] transition-transform duration-75 ease-out"
                style={{
                    width: '400px',
                    height: '400px',
                    transform: `translate(${mousePos.x - 200}px, ${mousePos.y - 200}px)`,
                    willChange: 'transform',
                }}
            />
        </div>
    );
};

export default MouseGlow;

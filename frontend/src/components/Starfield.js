import { jsx as _jsx } from "react/jsx-runtime";
// DOM-based starfield background with cursor-reactive parallax.
import { useEffect, useMemo, useRef } from 'react';
const LAYER_CONFIGS = [
    { id: 'far', count: 160, size: [0.8, 2.2], alpha: [0.25, 0.6], twinkle: [4.5, 9.5], depth: 6, drift: 80 },
    { id: 'mid', count: 140, size: [1.2, 2.8], alpha: [0.4, 0.75], twinkle: [3.5, 8], depth: 12, drift: 60 },
    { id: 'near', count: 120, size: [1.6, 3.8], alpha: [0.6, 0.95], twinkle: [2.8, 6.2], depth: 20, drift: 44 }
];
function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}
function createStars(count, size, alpha, twinkle) {
    return Array.from({ length: count }, () => {
        const base = randomBetween(alpha[0], alpha[1]);
        const alphaMin = Math.max(0.25, base * 0.6);
        const alphaMax = Math.min(1, base + 0.25);
        const twinkleDuration = randomBetween(twinkle[0], twinkle[1]);
        return {
            left: Math.random() * 100,
            top: Math.random() * 100,
            size: randomBetween(size[0], size[1]),
            twinkle: twinkleDuration,
            delay: Math.random() * twinkleDuration,
            alphaMin,
            alphaMax
        };
    });
}
export default function Starfield() {
    const containerRef = useRef(null);
    const frameRef = useRef(null);
    const pendingRef = useRef(null);
    const layers = useMemo(() => LAYER_CONFIGS.map((layer) => ({
        id: layer.id,
        depth: layer.depth,
        drift: layer.drift,
        stars: createStars(layer.count, layer.size, layer.alpha, layer.twinkle)
    })), []);
    useEffect(() => {
        const handlePointer = (event) => {
            const width = window.innerWidth || 1;
            const height = window.innerHeight || 1;
            const x = (event.clientX / width) * 2 - 1;
            const y = (event.clientY / height) * 2 - 1;
            pendingRef.current = { x, y };
            if (frameRef.current !== null) {
                return;
            }
            frameRef.current = window.requestAnimationFrame(() => {
                const container = containerRef.current;
                if (container && pendingRef.current) {
                    container.style.setProperty('--px', pendingRef.current.x.toFixed(3));
                    container.style.setProperty('--py', pendingRef.current.y.toFixed(3));
                }
                frameRef.current = null;
                pendingRef.current = null;
            });
        };
        const resetPointer = () => {
            const container = containerRef.current;
            if (container) {
                container.style.setProperty('--px', '0');
                container.style.setProperty('--py', '0');
            }
        };
        window.addEventListener('pointermove', handlePointer);
        window.addEventListener('pointerleave', resetPointer);
        resetPointer();
        return () => {
            if (frameRef.current) {
                window.cancelAnimationFrame(frameRef.current);
            }
            window.removeEventListener('pointermove', handlePointer);
            window.removeEventListener('pointerleave', resetPointer);
        };
    }, []);
    return (_jsx("div", { className: "starfield", ref: containerRef, "aria-hidden": "true", children: layers.map((layer) => (_jsx("div", { className: `star-layer layer-${layer.id}`, style: { '--depth': `${layer.depth}px` }, children: _jsx("div", { className: "star-drift", style: { animationDuration: `${layer.drift}s` }, children: layer.stars.map((star, index) => (_jsx("span", { className: "star", style: {
                        left: `${star.left}%`,
                        top: `${star.top}%`,
                        width: `${star.size.toFixed(2)}px`,
                        height: `${star.size.toFixed(2)}px`,
                        '--glow': `${(star.size * 2.2).toFixed(2)}px`,
                        '--alpha-min': star.alphaMin.toFixed(2),
                        '--alpha-max': star.alphaMax.toFixed(2),
                        animationDuration: `${star.twinkle}s`,
                        animationDelay: `${star.delay}s`
                    } }, `${layer.id}-${index}`))) }) }, layer.id))) }));
}

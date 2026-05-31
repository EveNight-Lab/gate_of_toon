import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Webtoon, GameState } from '../types';
import PlaceholderImage from './PlaceholderImage';

type PermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

interface DynamicBackgroundProps {
  webtoons: Webtoon[];
  allWebtoons: Webtoon[];
  gameState: GameState;
  parallaxCoordsRef: React.RefObject<{ x: number; y: number; }>;
  permissionState: PermissionState;
}

interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  depth: number;
}

interface Streak {
  id: string;
  points: { x: number; y: number }[];
  opacity: number; 
  color: string;
  width: number;
  fullPath: { x: number; y: number }[];
  progress: number;
  speed: number;
  totalLength: number; 
}

const PARTICLE_COLORS = [
  'rgba(14, 165, 233, 0.2)', // sky-500
  'rgba(139, 92, 246, 0.2)', // violet-500
  'rgba(236, 72, 153, 0.2)', // pink-500
  'rgba(16, 185, 129, 0.2)', // emerald-500
  'rgba(249, 115, 22, 0.2)',  // orange-500
];

const STREAK_COLOR = 'rgba(56, 189, 248, 1)'; // sky-400 with full opacity

const PARALLAX_ACCELERATION = 0.02;
const PARALLAX_DAMPING = 0.98;
const PARALLAX_MAX_VELOCITY = 2.0;
const FLOATING_SPEED_MIN = 0.3; 
const FLOATING_SPEED_MAX = 0.7; 

const calculatePathLength = (path: {x: number, y: number}[]) => {
    let length = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i+1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        length += Math.sqrt(dx*dx + dy*dy);
    }
    return length;
};

const useParticles = (
    allWebtoons: Webtoon[], 
    targetCoordsRef: React.RefObject<{x: number; y: number}>,
    permissionState: PermissionState,
    gameState: GameState
) => {
    const [particles, setParticles] = useState<Particle[]>([]);
    const [streaks, setStreaks] = useState<Streak[]>([]);
    const animationFrameId = useRef<number | null>(null);

    const gameStateRef = useRef(gameState);
    const permissionStateRef = useRef(permissionState);

    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    useEffect(() => {
        permissionStateRef.current = permissionState;
    }, [permissionState]);

    useEffect(() => {
        if (allWebtoons.length === 0) return;

        const newParticles = allWebtoons.map((w, index) => {
            const x = Math.random() * window.innerWidth;
            const y = Math.random() * window.innerHeight;
            return {
                id: `${w.title}-${index}`,
                x: x,
                y: y,
                vx: 0,
                vy: 0,
                size: 100 + (index % 3) * 20,
                color: PARTICLE_COLORS[index % PARTICLE_COLORS.length],
                depth: 0.2 + Math.random() * 0.8,
            };
        });
        setParticles(newParticles);
    }, [allWebtoons]);

    const animate = useCallback(() => {
        const isGyroActive = permissionStateRef.current === 'granted';
        const tilt = targetCoordsRef.current ?? { x: 0, y: 0 };
        const w = window.innerWidth;
        const h = window.innerHeight;

        // 1. 파티클 애니메이션 업데이트 
        setParticles(prevParticles => prevParticles.map(p => {
            const floatSpeed = FLOATING_SPEED_MIN + (p.depth * FLOATING_SPEED_MAX);
            const driftVx = (p.vx + (Math.random() - 0.5) * 0.02) * 0.95;
            let newVx = driftVx;
            let newVy = -floatSpeed;

            if (isGyroActive) {
                const parallaxVx = -(tilt.x * p.depth * PARALLAX_ACCELERATION);
                const parallaxVy = -(tilt.y * p.depth * PARALLAX_ACCELERATION);
                newVx += parallaxVx * PARALLAX_DAMPING;
                newVy += parallaxVy * PARALLAX_DAMPING;
            }
            
            newVx = Math.max(-PARALLAX_MAX_VELOCITY, Math.min(PARALLAX_MAX_VELOCITY, newVx));
            newVy = Math.max(-PARALLAX_MAX_VELOCITY, Math.min(PARALLAX_MAX_VELOCITY, newVy));

            let newX = p.x + newVx;
            let newY = p.y + newVy;

            if (newX > w + p.size) newX = -p.size;
            if (newX < -p.size) newX = w + p.size;
            
            if (newY < -p.size) newY = h + p.size;
            if (newY > h + p.size) newY = -p.size;

            return { ...p, x: newX, y: newY, vx: newVx, vy: newVy };
        }));

        // 2. 빛줄기(Streak) 애니메이션 로직 업데이트
        setStreaks(prevStreaks => {
            const updatedStreaks = prevStreaks.filter(s => s.progress <= s.totalLength)
            .map(s => {
                s.progress += s.speed;

                let progressLeft = s.progress;
                let head = { ...s.fullPath[0] };
                
                for (let i = 0; i < s.fullPath.length - 1; i++) {
                    const start = s.fullPath[i];
                    const end = s.fullPath[i+1];
                    const dx = end.x - start.x;
                    const dy = end.y - start.y;
                    const segmentLength = Math.sqrt(dx*dx + dy*dy);

                    if (progressLeft <= segmentLength) {
                        const ratio = progressLeft / segmentLength;
                        head = { x: start.x + dx * ratio, y: start.y + dy * ratio };
                        break;
                    }
                    progressLeft -= segmentLength;
                    head = end; 
                }
                
                if (s.progress > s.totalLength) {
                     head = s.fullPath[s.fullPath.length - 1];
                }

                s.points.push(head);

                if (s.points.length > 25) {
                    s.points.shift();
                }
                
                return s;
            });

            // 3. 새로운 빛줄기 생성
            // 🚨 수정: 빛줄기 생성 빈도를 다시 절반으로 줄입니다. (0.04 -> 0.02)
            if (Math.random() < 0.02) { 
                const side = Math.floor(Math.random() * 4);
                const pathType = Math.floor(Math.random() * 3);
                let fullPath: {x: number, y: number}[] = [];
                
                const turnLength = 100 + Math.random() * 200; 
                const travelLength = 500 + Math.random() * 700;
                const exitDistance = 400;
                const turnSign = Math.random() < 0.5 ? 1 : -1;

                let p1, p2, p3, p4;

                switch (side) {
                    case 0: // 위쪽 시작
                        p1 = { x: Math.random() * w, y: -10 };
                        if (pathType === 0) {
                            p2 = { x: p1.x, y: h + exitDistance };
                            fullPath = [p1, p2];
                        } else if (pathType === 1) {
                            p2 = { x: p1.x, y: p1.y + turnLength };
                            p3 = { x: p2.x + travelLength * turnSign, y: p2.y };
                            p4 = { x: p3.x + exitDistance * turnSign, y: p3.y };
                            fullPath = [p1, p2, p3, p4];
                        } else {
                            p2 = { x: p1.x, y: p1.y + turnLength };
                            p3 = { x: p2.x + travelLength * turnSign, y: p2.y };
                            p4 = { x: p3.x, y: h + exitDistance };
                            fullPath = [p1, p2, p3, p4];
                        }
                        break;

                    case 1: // 오른쪽 시작
                        p1 = { x: w + 10, y: Math.random() * h };
                        if (pathType === 0) {
                            p2 = { x: -exitDistance, y: p1.y };
                            fullPath = [p1, p2];
                        } else if (pathType === 1) {
                            p2 = { x: p1.x - turnLength, y: p1.y };
                            p3 = { x: p2.x, y: p2.y + travelLength * turnSign };
                            p4 = { x: p3.x, y: p3.y + exitDistance * turnSign };
                            fullPath = [p1, p2, p3, p4];
                        } else {
                            p2 = { x: p1.x - turnLength, y: p1.y };
                            p3 = { x: p2.x, y: p2.y + travelLength * turnSign };
                            p4 = { x: -exitDistance, y: p3.y };
                            fullPath = [p1, p2, p3, p4];
                        }
                        break;

                    case 2: // 아래쪽 시작
                        p1 = { x: Math.random() * w, y: h + 10 };
                        if (pathType === 0) {
                            p2 = { x: p1.x, y: -exitDistance };
                            fullPath = [p1, p2];
                        } else if (pathType === 1) {
                            p2 = { x: p1.x, y: p1.y - turnLength };
                            p3 = { x: p2.x + travelLength * turnSign, y: p2.y };
                            p4 = { x: p3.x + exitDistance * turnSign, y: p3.y };
                            fullPath = [p1, p2, p3, p4];
                        } else {
                            p2 = { x: p1.x, y: p1.y - turnLength };
                            p3 = { x: p2.x + travelLength * turnSign, y: p2.y };
                            p4 = { x: p3.x, y: -exitDistance };
                            fullPath = [p1, p2, p3, p4];
                        }
                        break;

                    case 3: // 왼쪽 시작
                        p1 = { x: -10, y: Math.random() * h };
                        if (pathType === 0) {
                            p2 = { x: w + exitDistance, y: p1.y };
                            fullPath = [p1, p2];
                        } else if (pathType === 1) {
                            p2 = { x: p1.x + turnLength, y: p1.y };
                            p3 = { x: p2.x, y: p2.y + travelLength * turnSign };
                            p4 = { x: p3.x, y: p3.y + exitDistance * turnSign };
                            fullPath = [p1, p2, p3, p4];
                        } else {
                            p2 = { x: p1.x + turnLength, y: p1.y };
                            p3 = { x: p2.x, y: p2.y + travelLength * turnSign };
                            p4 = { x: w + exitDistance, y: p3.y };
                            fullPath = [p1, p2, p3, p4];
                        }
                        break;
                }

                const totalLength = calculatePathLength(fullPath);

                updatedStreaks.push({
                    id: `streak-${Date.now()}-${Math.random()}`,
                    points: [fullPath[0]],
                    fullPath: fullPath, 
                    opacity: 1, 
                    color: STREAK_COLOR,
                    width: 5,
                    progress: 0,
                    speed: 10 + Math.random() * 3,
                    totalLength: totalLength,
                });
            }
            return updatedStreaks;
        });

        animationFrameId.current = requestAnimationFrame(animate); 
    }, [targetCoordsRef]);

    useEffect(() => {
        animationFrameId.current = requestAnimationFrame(animate);
        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [animate]);

    return { particles, streaks };
};

const DynamicBackground: React.FC<DynamicBackgroundProps> = ({ webtoons, allWebtoons, gameState, parallaxCoordsRef, permissionState }) => {
    
    const { particles, streaks } = useParticles(allWebtoons, parallaxCoordsRef, permissionState, gameState);
    const webtoonSet = new Set(webtoons.map(w => w.title));
    const isInteractiveState = gameState === GameState.QUESTIONS;

    return (
        <div className="absolute inset-0 w-full h-full overflow-hidden z-0 bg-gray-900">
            {particles.map(p => {
                const title = p.id.substring(0, p.id.lastIndexOf('-'));
                const isActive = webtoonSet.has(title);
                const opacity = isInteractiveState ? (isActive ? 0.35 : 0.05) : 0.25; 

                return (
                    <div
                        key={p.id}
                        className="absolute rounded-lg shadow-lg transition-opacity duration-1000 ease-in-out"
                        style={{
                            width: `${p.size}px`,
                            height: `${p.size * 1.25}px`,
                            top: 0,
                            left: 0,
                            willChange: 'transform, opacity',
                            transform: `translate3d(${p.x}px, ${p.y}px, 0)`,
                            opacity: opacity,
                            zIndex: Math.floor(p.depth * 10), 
                        }}
                    >
                        <PlaceholderImage 
                            text={title} 
                            className="rounded-lg"
                            backgroundColor={p.color}
                        />
                    </div>
                );
            })}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
                <defs>
                    {streaks.map(s => {
                        if (s.points.length < 2) return null;
                        const tail = s.points[0];
                        const head = s.points[s.points.length - 1];
                        
                        return (
                            <linearGradient 
                                key={`grad-${s.id}`} 
                                id={`grad-${s.id}`} 
                                x1={tail.x} y1={tail.y}
                                x2={head.x} y2={head.y}
                                gradientUnits="userSpaceOnUse"
                            >
                                <stop offset="0%" stopColor={s.color} stopOpacity="0" />
                                <stop offset="50%" stopColor={s.color} stopOpacity={s.opacity * 0.5} />
                                <stop offset="100%" stopColor={s.color} stopOpacity={s.opacity} />
                            </linearGradient>
                        );
                    })}
                </defs>
                <g>
                    {streaks.map(s => {
                        if (s.points.length < 2) return null;
                        return (
                            <polyline
                                key={s.id}
                                points={s.points.map(p => `${p.x},${p.y}`).join(' ')}
                                fill="none"
                                stroke={`url(#grad-${s.id})`}
                                strokeWidth={s.width}
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                            />
                        );
                    })}
                </g>
            </svg>
             <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fade-in-slow {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
                .animate-fade-in-slow { animation: fade-in-slow 0.8s ease-out forwards; }
             `}</style>
        </div>
    );
};

export default DynamicBackground;

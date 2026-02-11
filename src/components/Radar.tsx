import React, { useEffect, useRef } from 'react';

interface RadarProps {
    threats: { label: string; score: number; timestamp: number }[];
    distance?: number; // 0-1 (Close-Far)
    direction?: number; // -1 to 1 (Left-Right)
    isRecording: boolean;
}

export const Radar: React.FC<RadarProps> = ({ threats, distance = 0, direction = 0, isRecording }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrame: number;
        let angle = 0;

        const render = () => {
            // 1. Setup
            const { width, height } = canvas;
            const centerX = width / 2;
            const centerY = height / 2;
            const maxRadius = Math.min(width, height) / 2 - 10;

            // Clear
            ctx.clearRect(0, 0, width, height);

            // 2. Draw Radar Circles
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
            ctx.lineWidth = 1;

            // Outer circle
            ctx.beginPath();
            ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
            ctx.stroke();

            // Middle circle
            ctx.beginPath();
            ctx.arc(centerX, centerY, maxRadius * 0.66, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.15)';
            ctx.stroke();

            // Inner circle
            ctx.beginPath();
            ctx.arc(centerX, centerY, maxRadius * 0.33, 0, Math.PI * 2);
            ctx.stroke();

            // Crosshairs
            ctx.beginPath();
            ctx.moveTo(centerX - maxRadius, centerY);
            ctx.lineTo(centerX + maxRadius, centerY);
            ctx.moveTo(centerX, centerY - maxRadius);
            ctx.lineTo(centerX, centerY + maxRadius);
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.1)';
            ctx.stroke();

            if (isRecording) {
                // 3. Draw Sweep
                angle += 0.05;
                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate(angle);

                const gradient = ctx.createLinearGradient(0, 0, maxRadius, 0);
                gradient.addColorStop(0, 'rgba(0, 255, 0, 0)');
                gradient.addColorStop(1, 'rgba(0, 255, 0, 0.5)');

                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, maxRadius, 0, 0.5); // 0.5 radians sector
                ctx.lineTo(0, 0);
                ctx.fillStyle = gradient;
                ctx.fill();
                ctx.restore();

                // 4. Draw Threat Blips
                // If we have active threats, draw them based on direction/distance
                if (threats.length > 0) {
                    // We only show the latest/strongest threat for clarity
                    const latestThreat = threats[0];

                    // Map direction (-1 to 1) to Angle (-PI/2 to PI/2, with 0 being UP)
                    // Standard math: 0 is Right. 
                    // Let's say: 0 (Center) -> -PI/2 (Up)
                    // -1 (Left) -> -PI (Left)
                    // 1 (Right) -> 0 (Right)
                    // Actually, let's map: 
                    // 0 -> Up (270 deg / 1.5 PI)
                    // -1 -> Left (180 deg / PI)
                    // 1 -> Right (0 deg / 2 PI) - wait, typically right is 0. 
                    // Let's strictly map -1..1 to the upper semi-circle for simplicity.
                    // -1 = Left (180 deg), 0 = Up (270 deg / -90), 1 = Right (360/0 deg)

                    // Simpler mapping for top-down 2D view:
                    // Up = -PI/2. 
                    // Map direction (-1..1) to angle offset from Up.
                    // Angle = -PI/2 + (direction * PI/4) -> This gives a 90 degree cone.
                    // Let's give it a 180 degree cone. 
                    // Angle = -PI/2 + (direction * PI/2)

                    const blipAngle = -Math.PI / 2 + (direction * (Math.PI / 2));

                    // Distance: 0 (Far) -> 1 (Close). 
                    // UI Radius: 1 (Close) -> Inner, 0 (Far) -> Outer?
                    // Actually loudness 1.0 is CLOSE (Center). Loudness 0 is FAR (Edge).
                    // So Radius = maxRadius * (1 - distance);
                    const blipDist = Math.max(0.1, distance); // Clamp minimum
                    const blipRadius = maxRadius * (1 - blipDist);

                    const blipX = centerX + Math.cos(blipAngle) * blipRadius;
                    const blipY = centerY + Math.sin(blipAngle) * blipRadius;

                    // Draw Blip
                    ctx.beginPath();
                    ctx.arc(blipX, blipY, 8, 0, Math.PI * 2);
                    ctx.fillStyle = latestThreat.label.toLowerCase().includes('gunshot') ? '#ef4444' : '#f97316'; // Red or Orange
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = ctx.fillStyle;
                    ctx.fill();

                    // Draw label
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.font = '10px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText(`${(blipDist * 100).toFixed(0)}m`, blipX, blipY + 20);
                }
            }

            animationFrame = requestAnimationFrame(render);
        };

        render();

        return () => cancelAnimationFrame(animationFrame);
    }, [isRecording, threats, distance, direction]);

    return (
        <div className="relative w-64 h-64 mx-auto">
            <canvas
                ref={canvasRef}
                width={300}
                height={300}
                className="w-full h-full bg-black/80 rounded-full border-2 border-slate-700 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            />
            <div className="absolute inset-0 pointer-events-none rounded-full border border-white/10 shadow-inner" />
            <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] text-green-500 font-mono tracking-widest opacity-80">RADAR ACTIVE</div>
        </div>
    );
};

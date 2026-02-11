import React, { useRef, useEffect } from 'react';

interface SpectrogramProps {
    analyser: AnalyserNode | null;
    isRecording: boolean;
}

export const Spectrogram: React.FC<SpectrogramProps> = ({ analyser, isRecording }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !analyser || !isRecording) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set dimensions if not set
        if (canvas.width !== canvas.offsetWidth) {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        }

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        // We only want to visualize up to roughly 8kHz since most relevant sounds are there.
        // YAMNet uses 16kHz sample rate, so Nyquist is 8kHz.
        // bufferLength usually 512 for fftSize 1024.

        const draw = () => {
            animationRef.current = requestAnimationFrame(draw);

            // Handle resizing explicitly or check bounds
            if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
            }

            if (canvas.height < 1 || canvas.width < 1) return;

            analyser.getByteFrequencyData(dataArray);

            // 1. Draw the current state (shift down)
            try {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height - 1);
                ctx.putImageData(imageData, 0, 1);
            } catch (e) {
                // Ignore transient sizing errors
                return;
            }

            // 2. Draw the new line at the top
            const width = canvas.width;

            // Map freq bins to pixels
            // Low frequencies on left, high on right? Or just simple linear?
            // Let's do linear for simplicity, but maybe skip the very top empty bins

            for (let x = 0; x < width; x++) {
                // Map x position to frequency bin
                const i = Math.floor((x / width) * bufferLength);
                const value = dataArray[i];

                // Color mapping: Purple (quiet) -> Blue -> Green -> Yellow -> Red (Loud)
                // We'll use HSL for a cool sci-fi effect
                // value is 0-255

                let color = `rgb(0,0,0)`; // Background

                if (value > 10) {
                    // Normalize 0-1
                    const t = value / 255;

                    // Hue: 280 (Purple) -> 0 (Red)
                    // Saturation: 100%
                    // Lightness: scaled by intensity
                    const hue = 260 - (t * 260); // 260=Purple -> 0=Red
                    const lightness = (t * 60) + 10;

                    color = `hsl(${hue}, 100%, ${lightness}%)`;
                }

                ctx.fillStyle = color;
                ctx.fillRect(x, 0, 1, 1);
            }
        };

        draw();

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [analyser, isRecording]);

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-full bg-black/90 rounded-lg shadow-inner border border-white/10"
        />
    );
};

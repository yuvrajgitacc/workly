'use client';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function DottedSurface({ className, ...props }) {
	let theme = 'light';
	try {
		const context = useTheme();
		theme = context?.theme || 'light';
	} catch (e) {
		// Fallback if useTheme is called outside a next-themes Provider
		theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
	}

	const containerRef = useRef(null);
	const sceneRef = useRef(null);

	useEffect(() => {
		if (!containerRef.current) return;

		const SEPARATION = 150;
		const AMOUNTX = 40;
		const AMOUNTY = 60;

		// Scene setup
		const scene = new THREE.Scene();
		// Fog helps fade out particles in the distance
		scene.fog = new THREE.Fog(theme === 'dark' ? 0x0a0a0a : 0xffffff, 2000, 10000);

		const camera = new THREE.PerspectiveCamera(
			60,
			window.innerWidth / window.innerHeight,
			1,
			10000,
		);
		camera.position.set(0, 355, 1220);

		const renderer = new THREE.WebGLRenderer({
			alpha: true,
			antialias: true,
		});
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setClearColor(scene.fog.color, 0);

		containerRef.current.appendChild(renderer.domElement);

		// Create particles
		const positions = [];
		const colors = [];

		// Predefined palette of vibrant colors (Google brand colors & neon accents)
		const colorsList = [
			new THREE.Color('#4285F4'), // Google Blue
			new THREE.Color('#8B5CF6'), // Purple
			new THREE.Color('#EC4899'), // Pink
			new THREE.Color('#EA4335'), // Google Red
			new THREE.Color('#FBBC05'), // Google Yellow
			new THREE.Color('#34A853'), // Google Green
		];

		// Create geometry for all particles
		const geometry = new THREE.BufferGeometry();

		for (let ix = 0; ix < AMOUNTX; ix++) {
			for (let iy = 0; iy < AMOUNTY; iy++) {
				const x = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2;
				const y = 0; // Will be animated in the loop
				const z = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2;

				positions.push(x, y, z);

				// Compute a beautiful, colorful gradient across the coordinate grid
				const xRatio = ix / AMOUNTX;
				const yRatio = iy / AMOUNTY;

				// Interpolate across the color list to make it colorful like Antigravity
				const colorIndex1 = Math.floor(xRatio * (colorsList.length - 1));
				const colorIndex2 = Math.min(colorsList.length - 1, colorIndex1 + 1);
				const t = (xRatio * (colorsList.length - 1)) % 1;

				const tempColor = new THREE.Color().copy(colorsList[colorIndex1]).lerp(colorsList[colorIndex2], t);

				// Blend in a bit of Y-direction color shift
				const colorY = colorsList[Math.floor(yRatio * (colorsList.length - 1))];
				tempColor.lerp(colorY, 0.35);

				// If light theme, we want slightly less neon/vibrant for readability, but still colourful
				if (theme !== 'dark') {
					tempColor.multiplyScalar(0.85); // soften colors
				}

				colors.push(tempColor.r, tempColor.g, tempColor.b);
			}
		}

		geometry.setAttribute(
			'position',
			new THREE.Float32BufferAttribute(positions, 3),
		);
		geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

		// Create material
		const material = new THREE.PointsMaterial({
			size: 7,
			vertexColors: true,
			transparent: true,
			opacity: 0.85,
			sizeAttenuation: true,
		});

		// Create points object
		const points = new THREE.Points(geometry, material);
		scene.add(points);

		let count = 0;
		let animationId;

		// Animation function
		const animate = () => {
			animationId = requestAnimationFrame(animate);

			const positionAttribute = geometry.attributes.position;
			const positionsArray = positionAttribute.array;

			let i = 0;
			for (let ix = 0; ix < AMOUNTX; ix++) {
				for (let iy = 0; iy < AMOUNTY; iy++) {
					const index = i * 3;

					// Animate Y position with sine waves to mimic wave motion
					positionsArray[index + 1] =
						Math.sin((ix + count) * 0.3) * 60 +
						Math.sin((iy + count) * 0.5) * 60;

					i++;
				}
			}

			positionAttribute.needsUpdate = true;
			renderer.render(scene, camera);
			count += 0.08; // smooth flow speed
		};

		// Handle window resize
		const handleResize = () => {
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(window.innerWidth, window.innerHeight);
		};

		window.addEventListener('resize', handleResize);

		// Start animation
		animate();

		// Store references for cleanup
		sceneRef.current = {
			scene,
			camera,
			renderer,
			particles: [points],
			animationId,
			count,
		};

		// Cleanup function
		return () => {
			window.removeEventListener('resize', handleResize);

			if (sceneRef.current) {
				cancelAnimationFrame(sceneRef.current.animationId);

				// Clean up Three.js WebGL objects
				sceneRef.current.scene.traverse((object) => {
					if (object instanceof THREE.Points) {
						object.geometry.dispose();
						if (Array.isArray(object.material)) {
							object.material.forEach((mat) => mat.dispose());
						} else {
							object.material.dispose();
						}
					}
				});

				sceneRef.current.renderer.dispose();

				if (containerRef.current && sceneRef.current.renderer.domElement) {
					containerRef.current.removeChild(
						sceneRef.current.renderer.domElement,
					);
				}
			}
		};
	}, [theme]);

	return (
		<div
			ref={containerRef}
			className={cn('pointer-events-none absolute inset-0 -z-10', className)}
			{...props}
		/>
	);
}

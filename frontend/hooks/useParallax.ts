import { useRef, useEffect, useCallback, useState } from 'react';

type Coords = { x: number; y: number };
type PermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

// Sensitivity for mobile device orientation
const STRENGTH = 40; // 🚨 수정: 반응성을 높이기 위해 값을 10배 상향 조정했습니다.

export const useParallax = () => {
  const coordsRef = useRef<Coords>({ x: 0, y: 0 });
  const [permissionState, setPermissionState] = useState<PermissionState | null>(null);

  const calibrationRef = useRef<{ beta: number; gamma: number } | null>(null);
  const latestOrientationRef = useRef<{ beta: number; gamma: number } | null>(null);
  const orientationReceivedRef = useRef(false);

  // Detect environment (mobile with orientation vs. desktop/unsupported)
  useEffect(() => {
    const supportsOrientation = 'DeviceOrientationEvent' in window;
    const isMobile = ('ontouchstart' in window || navigator.maxTouchPoints > 0) && supportsOrientation;
    if (isMobile) {
      // iOS 13+ requires explicit permission for device orientation events
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        setPermissionState('prompt');
      } else {
        // Other mobile browsers grant permission by default
        setPermissionState('granted');
      }
    } else {
      // Desktop or devices without orientation sensors
      setPermissionState('unsupported');
    }
  }, []);

  // Function to request permission on iOS
  const requestPermission = useCallback(async () => {
    if (permissionState !== 'prompt') return;
    try {
      const permission = await (DeviceOrientationEvent as any).requestPermission();
      setPermissionState(permission === 'granted' ? 'granted' : 'denied');
    } catch (error) {
      console.error('DeviceOrientationEvent permission request failed:', error);
      setPermissionState('denied');
    }
  }, [permissionState]);

  const calibrate = useCallback(() => {
    if (latestOrientationRef.current) {
      calibrationRef.current = {
        beta: latestOrientationRef.current.beta,
        gamma: latestOrientationRef.current.gamma,
      };
    }
  }, []);

  // Effect to add/remove the device orientation event listener
  useEffect(() => {
    // Only run if permission has been granted
    if (permissionState !== 'granted') {
      return;
    }
    
    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      const { beta, gamma } = event; 
      if (beta === null || gamma === null) return;
      
      orientationReceivedRef.current = true;
      latestOrientationRef.current = { beta, gamma };

      // Before calibration, use a (0,0) baseline for 'fierce' raw movement.
      // After calibration, use the calibrated point for relative movement.
      const baseBeta = calibrationRef.current?.beta ?? 0;
      const baseGamma = calibrationRef.current?.gamma ?? 0;

      // Calculate relative tilt
      const deltaBeta = beta - baseBeta;
      const deltaGamma = gamma - baseGamma;

      // Clamp values to prevent extreme jumps
      const limitedGamma = Math.max(-90, Math.min(90, deltaGamma));
      const limitedBeta = Math.max(-90, Math.min(90, deltaBeta));

      // Calculate parallax effect based on device tilt
      const x = (limitedGamma / 45) * STRENGTH;
      const y = (limitedBeta / 45) * STRENGTH;
      coordsRef.current = { x, y };
    };
    
    window.addEventListener('deviceorientation', handleDeviceOrientation);

    // Cleanup listener on component unmount or if permission changes
    return () => {
      window.removeEventListener('deviceorientation', handleDeviceOrientation);
    };
  }, [permissionState]);

  useEffect(() => {
    if (permissionState !== 'granted') {
      orientationReceivedRef.current = false;
      return;
    }

    orientationReceivedRef.current = false;
    const timeoutId = window.setTimeout(() => {
      if (!orientationReceivedRef.current) {
        setPermissionState('unsupported');
      }
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [permissionState]);

  // 🚨 수정: PC 환경을 위한 마우스 기반 패럴랙스 효과 추가
  useEffect(() => {
    if (permissionState !== 'unsupported') {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      // 🚨 수정: 마우스 위치에 따라 -1에서 1 사이의 값을 coordsRef에 직접 할당합니다.
      // STRENGTH를 곱해 움직임의 강도를 조절합니다.
      const { clientX, clientY } = event;
      const x = (clientX / window.innerWidth - 0.5) * 2; // -1 to 1
      const y = (clientY / window.innerHeight - 0.5) * 2; // -1 to 1
      coordsRef.current = { x: x * STRENGTH, y: y * STRENGTH }; // 🚨 수정: STRENGTH를 곱하여 움직임 강도 조절
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [permissionState]);

  return { coordsRef, requestPermission, permissionState: permissionState ?? 'unsupported', calibrate };
};
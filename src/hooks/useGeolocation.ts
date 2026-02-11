import { useState, useEffect } from 'react';

interface Location {
    latitude: number | null;
    longitude: number | null;
    error: string | null;
}

export const useGeolocation = () => {
    const [location, setLocation] = useState<Location>({
        latitude: null,
        longitude: null,
        error: null,
    });

    useEffect(() => {
        if (!navigator.geolocation) {
            setLocation(prev => ({ ...prev, error: 'Geolocation is not supported by your browser' }));
            return;
        }

        const handleSuccess = (position: GeolocationPosition) => {
            setLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                error: null,
            });
        };

        const handleError = (error: GeolocationPositionError) => {
            setLocation(prev => ({ ...prev, error: error.message }));
        };

        const watcher = navigator.geolocation.watchPosition(handleSuccess, handleError, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        });

        return () => navigator.geolocation.clearWatch(watcher);
    }, []);

    return location;
};

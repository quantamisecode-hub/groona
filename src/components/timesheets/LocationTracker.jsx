import React, { useState, useEffect } from "react";
import { MapPin, AlertCircle, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function LocationTracker({ onLocationCaptured, showMap = false }) {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState('prompt');

  const captureLocation = () => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }

    // === CRITICAL FIX: Location Settings ===
    const options = {
      // FALSE helps prevent timeout errors (doesn't force GPS)
      enableHighAccuracy: false, 
      // 30 Seconds timeout to account for slow network location lookup
      timeout: 30000, 
      maximumAge: 30000 
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString(),
        };

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${locationData.latitude}&lon=${locationData.longitude}`
          );
          const data = await response.json();
          
          locationData.address = data.display_name;
          locationData.city = data.address?.city || data.address?.town || data.address?.village;
          locationData.country = data.address?.country;
        } catch (err) {
          console.error('Failed to get address:', err);
          locationData.address = `${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)}`;
        }

        setLocation(locationData);
        setPermissionStatus('granted');
        setLoading(false);
        
        if (onLocationCaptured) {
          onLocationCaptured(locationData);
        }
      },
      (error) => {
        let errorMessage = 'Unable to retrieve your location';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please check your browser settings.';
            setPermissionStatus('denied');
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Please try again.';
            break;
        }
        
        console.warn("Location error:", error);
        setError(errorMessage);
        setLoading(false);
      },
      options
    );
  };

  useEffect(() => {
    if (onLocationCaptured && !location) {
      captureLocation();
    }
  }, []);

  return (
    <div className="space-y-3">
      {!location && !loading && !error && (
        <Alert className="border-blue-200 bg-blue-50">
          <MapPin className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900 text-sm">
            Click to capture location for this timesheet entry.
          </AlertDescription>
        </Alert>
      )}

      {loading && (
        <Alert className="border-slate-200 bg-slate-50">
          <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
          <AlertDescription className="text-slate-900 text-sm">
            Detecting your location...
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex justify-between items-center">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={captureLocation} className="h-6 px-2 text-white hover:text-white/80 hover:bg-white/20">
              <RefreshCw className="h-3 w-3 mr-1" /> Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {location && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-900">
            <div className="space-y-1">
              <p className="font-semibold">Location Captured</p>
              <p className="text-xs">{location.address}</p>
              <p className="text-xs text-green-700">Accuracy: ±{Math.round(location.accuracy)}m</p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {showMap && location && (
        <div className="rounded-lg overflow-hidden border border-slate-200">
          <iframe
            width="100%"
            height="200"
            frameBorder="0"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.longitude - 0.01},${location.latitude - 0.01},${location.longitude + 0.01},${location.latitude + 0.01}&layer=mapnik&marker=${location.latitude},${location.longitude}`}
            title="Location Map"
          />
        </div>
      )}

      {!location && (
        <Button
          type="button"
          variant="outline"
          onClick={captureLocation}
          disabled={loading}
          className="w-full"
        >
          {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Capturing...</> : <><MapPin className="h-4 w-4 mr-2" /> Capture Location</>}
        </Button>
      )}

      {location && (
        <Button
          type="button"
          variant="outline"
          onClick={captureLocation}
          disabled={loading}
          className="w-full"
        >
          <MapPin className="h-4 w-4 mr-2" />
          Update Location
        </Button>
      )}
    </div>
  );
}
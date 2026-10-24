export type VehicleType = 'Bike' | 'Scooter' | 'Car' | 'Other';
export type RecordingLimit = 'time' | 'distance' | 'manual';
export type SessionMode = 'pin' | 'path';
export type SessionStatus = 'active' | 'ready' | 'completed';

export interface Coordinate {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
}

export interface Vehicle {
  id: string;
  type: VehicleType;
  name: string;
  details?: string;
}

export interface ParkingSession {
  id: string;
  mode: SessionMode;
  status: SessionStatus;
  vehicleId: string;
  vehicleName: string;
  createdAt: number;
  anchor: Coordinate;
  trail: Coordinate[];
  rawTrail: Coordinate[];
  photoData?: string;
  notes: string;
  limitType: RecordingLimit;
  limitValue: number | null;
  elapsedSeconds: number;
  distanceMeters: number;
  label: string;
}

export interface AppState {
  vehicles: Vehicle[];
  sessions: ParkingSession[];
  activeSessionId: string | null;
  selectedVehicleId: string;
  profileName: string;
  profileEmail: string;
}
import type { AppState, ParkingSession, Vehicle } from './types';

const DB_NAME = 'parkmate-db';
const DB_VERSION = 1;
const STORE = 'app';

const defaultState: AppState = {
  vehicles: [
    { id: 'vehicle-bike', type: 'Bike', name: 'My Bike', details: '' },
    { id: 'vehicle-scooter', type: 'Scooter', name: 'My Scooter', details: '' },
    { id: 'vehicle-car', type: 'Car', name: 'My Car', details: '' }
  ],
  sessions: [],
  activeSessionId: null,
  selectedVehicleId: 'vehicle-bike',
  profileName: 'ParkMate User',
  profileEmail: 'local account'
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadState(): Promise<AppState> {
  try {
    const db = await openDb();
    const result = await new Promise<AppState | undefined>((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get('state');
      request.onsuccess = () => resolve(request.result as AppState | undefined);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result ?? defaultState;
  } catch {
    return defaultState;
  }
}

export async function saveState(state: AppState): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put(state, 'state');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  } catch (error) {
    console.error('ParkMate could not persist state:', error);
  }
}

export function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function vehicleLabel(vehicle: Vehicle): string {
  return `${vehicle.type} · ${vehicle.name}`;
}

export function getSession(state: AppState, id: string | null): ParkingSession | undefined {
  return state.sessions.find(session => session.id === id);
}
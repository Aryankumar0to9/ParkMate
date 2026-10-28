import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft, ArrowLeft, ArrowUp, Bike, Bookmark, CarFront, Check, ChevronRight,
  CircleHelp, Clock3, Compass, Crosshair, Flag, History, House, LocateFixed, MapPin,
  Menu, MoreVertical, Navigation, Pause, Play, Plus, Route, Settings, Share2,
  ShieldCheck, SlidersHorizontal, Smartphone, Timer, Trash2, UserRound, X
} from 'lucide-react';
import MapView from './components/MapView';
import { Geolocation } from '@capacitor/geolocation';
import { acceptGpsPoint, bearingDegrees, distanceMeters, formatDistance, formatDuration, mapsUrl, smoothTrail } from './geo';
import { getSession, loadState, makeId, saveState } from './storage';
import type { AppState, Coordinate, ParkingSession, RecordingLimit, SessionMode, Vehicle, VehicleType } from './types';

type Page = 'home' | 'return' | 'profile' | 'history';
const initialState: AppState = {
  vehicles: [{ id: 'vehicle-bike', type: 'Bike', name: 'My Bike' }, { id: 'vehicle-scooter', type: 'Scooter', name: 'My Scooter' }, { id: 'vehicle-car', type: 'Car', name: 'My Car' }],
  sessions: [], activeSessionId: null, selectedVehicleId: 'vehicle-bike',
  profileName: 'ParkMate User', profileEmail: 'local account'
};

function vehicleIcon(type: VehicleType) {
  if (type === 'Bike') return <Bike size={23} />;
  if (type === 'Scooter') return <Smartphone size={22} />;
  return <CarFront size={23} />;
}
function makeCoordinate(position: GeolocationPosition): Coordinate {
  return { lat: position.coords.latitude, lng: position.coords.longitude, timestamp: position.timestamp, accuracy: position.coords.accuracy };
}
function makeSession(mode: SessionMode, vehicle: Vehicle, anchor: Coordinate, limitType: RecordingLimit = 'manual', limitValue: number | null = null): ParkingSession {
  return {
    id: makeId(), mode, status: mode === 'path' ? 'active' : 'ready', vehicleId: vehicle.id,
    vehicleName: vehicle.name, createdAt: Date.now(), anchor, trail: mode === 'path' ? [anchor] : [],
    rawTrail: mode === 'path' ? [anchor] : [], notes: '', limitType, limitValue,
    elapsedSeconds: 0, distanceMeters: 0, label: `${vehicle.type} parking`
  };
}

export default function App() {
  const [state, setState] = useState<AppState>(initialState);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState<Page>('home');
  const [current, setCurrent] = useState<Coordinate | undefined>();
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'ready' | 'error'>('idle');
  const [gpsMessage, setGpsMessage] = useState('Location permission is needed for live GPS.');
  const [limitType, setLimitType] = useState<RecordingLimit>('distance');
  const [limitValue, setLimitValue] = useState(200);
  const [showRecorder, setShowRecorder] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [pinStep, setPinStep] = useState<'vehicle' | 'preview'>('vehicle');
  const [pinVehicleType, setPinVehicleType] = useState<VehicleType>('Bike');
  const [pinAnchor, setPinAnchor] = useState<Coordinate | null>(null);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vehicleName, setVehicleName] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('Bike');
  const [notice, setNotice] = useState('');
  const [returnSessionId, setReturnSessionId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTick, setElapsedTick] = useState(0);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    loadState().then(saved => {
      setState(saved);
      setProfileName(saved.profileName);
      setProfileEmail(saved.profileEmail);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) void saveState({ ...state, profileName, profileEmail });
  }, [state, loaded, profileName, profileEmail]);

  const updateState = useCallback((updater: (prev: AppState) => AppState) => {
    setState(prev => updater(prev));
  }, []);

  const activeSession = useMemo(() => getSession(state, state.activeSessionId), [state]);
  const returnSession = useMemo(() => getSession(state, returnSessionId), [state, returnSessionId]);
  const latestSession = useMemo(() => [...state.sessions].sort((a, b) => b.createdAt - a.createdAt)[0], [state.sessions]);
  const selectedVehicle = state.vehicles.find(v => v.id === state.selectedVehicleId) ?? state.vehicles[0];


  const locate = useCallback(async (onSuccess: (point: Coordinate) => void) => {
    setGpsStatus('locating');
    setGpsMessage('Finding your location…');

    try {
      const permission = await Geolocation.checkPermissions();

      if (
        permission.location !== 'granted' &&
        permission.coarseLocation !== 'granted'
      ) {
        const requested = await Geolocation.requestPermissions();

        if (
          requested.location !== 'granted' &&
          requested.coarseLocation !== 'granted'
        ) {
          setGpsStatus('error');
          setGpsMessage('Location permission denied. Enable location access in your phone settings.');
          return;
        }
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 3000
      });

      const point: Coordinate = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        timestamp: position.timestamp,
        accuracy: position.coords.accuracy
      };

      setCurrent(point);
      setGpsStatus('ready');
      setGpsMessage(`GPS accuracy ±${Math.round(point.accuracy ?? 0)} m`);
      onSuccess(point);
    } catch (error) {
      console.error('GPS location error:', error);
      setGpsStatus('error');
      setGpsMessage('Could not get your location. Check GPS permissions and try again.');
    }
  }, []);


  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null) navigator.geolocation?.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const finishRecording = useCallback((reason: string) => {
    stopWatch();
    const currentState = stateRef.current;
    const session = getSession(currentState, currentState.activeSessionId);
    if (!session) return;
    const updated: ParkingSession = { ...session, status: 'ready', trail: smoothTrail(session.rawTrail), elapsedSeconds: session.elapsedSeconds + elapsedTick };
    updateState(prev => ({
      ...prev, activeSessionId: null,
      sessions: prev.sessions.map(item => item.id === updated.id ? updated : item)
    }));
    setIsPaused(false);
    setNotice(reason);
    setShowRecorder(false);
  }, [stopWatch, updateState, elapsedTick]);

  const beginWatch = useCallback((sessionId: string) => {
    stopWatch();
    if (!navigator.geolocation) { setNotice('GPS is not supported in this browser.'); return; }
    const startedAt = Date.now();
    watchIdRef.current = navigator.geolocation.watchPosition(position => {
      const point = makeCoordinate(position);
      setCurrent(point);
      setGpsStatus('ready');
      setGpsMessage(`GPS accuracy ±${Math.round(point.accuracy ?? 0)} m`);
      const currentState = stateRef.current;
      const session = getSession(currentState, sessionId);
      if (!session || session.status !== 'active') return;
      const previous = session.rawTrail[session.rawTrail.length - 1];
      if (!acceptGpsPoint(point, previous)) return;
      const segment = previous ? distanceMeters(previous, point) : 0;
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const nextRaw = [...session.rawTrail, point];
      const nextDistance = session.distanceMeters + segment;
      const updated = { ...session, rawTrail: nextRaw, trail: smoothTrail(nextRaw), distanceMeters: nextDistance, elapsedSeconds: elapsed };
      updateState(prev => ({ ...prev, sessions: prev.sessions.map(item => item.id === sessionId ? updated : item) }));
      if (session.limitType === 'distance' && session.limitValue && nextDistance >= session.limitValue) finishRecording(`Your ${formatDistance(session.limitValue)} path limit was reached. Trail saved for return.`);
      if (session.limitType === 'time' && session.limitValue && elapsed >= session.limitValue * 60) finishRecording(`Your ${session.limitValue}-minute path limit was reached. Trail saved for return.`);
    }, error => {
      setGpsStatus('error');
      setGpsMessage(error.code === 1 ? 'Location permission was denied.' : 'GPS signal lost. Recording will resume when a fix returns.');
    }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 12000 });
    timerRef.current = window.setInterval(() => setElapsedTick(v => v + 1), 1000);
  }, [stopWatch, updateState, finishRecording]);

  useEffect(() => () => stopWatch(), [stopWatch]);

  const startPath = () => {
    if (!selectedVehicle) { setNotice('Add a vehicle first.'); return; }
    locate(anchor => {
      const session = makeSession('path', selectedVehicle, anchor, limitType, limitType === 'manual' ? null : limitValue);
      updateState(prev => ({
        ...prev, activeSessionId: session.id,
        sessions: [session, ...prev.sessions.filter(s => s.status !== 'active')]
      }));
      setElapsedTick(0); setIsPaused(false); setShowRecorder(false); setPage('home');
      setNotice('Path recording started. Walk away from your vehicle; your parking anchor is fixed.');
      // start watch after React state update has committed
      window.setTimeout(() => beginWatch(session.id), 50);
    });
  };

  const openPinFlow = () => {
    setPinVehicleType(selectedVehicle?.type ?? 'Bike');
    setPinAnchor(null);
    setPinStep('vehicle');
    setShowPin(true);
  };

  const previewPinLocation = (skipVehicle = false) => {
    if (skipVehicle && selectedVehicle) setPinVehicleType(selectedVehicle.type);
    locate(anchor => {
      setPinAnchor(anchor);
      setPinStep('preview');
    });
  };

  const confirmPinLocation = () => {
    if (!pinAnchor) return;
    const existing = state.vehicles.find(v => v.type === pinVehicleType);
    const vehicle: Vehicle = existing ?? { id: makeId(), type: pinVehicleType, name: `My ${pinVehicleType}` };
    const session = makeSession('pin', vehicle, pinAnchor);
    updateState(prev => ({
      ...prev,
      vehicles: existing ? prev.vehicles : [...prev.vehicles, vehicle],
      selectedVehicleId: vehicle.id,
      sessions: [session, ...prev.sessions], activeSessionId: null
    }));
    setShowPin(false);
    setPinAnchor(null);
    setNotice(`Parking location confirmed and saved (${pinAnchor.lat.toFixed(6)}, ${pinAnchor.lng.toFixed(6)}).`);
  };

  const pauseRecording = () => {
    setIsPaused(true);
    stopWatch();
    setNotice('Recording paused. Resume when you are ready.');
  };

  const resumeRecording = () => {
    if (!activeSession) return;
    setIsPaused(false);
    beginWatch(activeSession.id);
    setNotice('Recording resumed.');
  };

  const saveManualStop = () => finishRecording('Path saved. You can now return along the recorded trail.');

  const shareSession = async (session: ParkingSession) => {
    const url = mapsUrl(session.anchor);
    const text = `My parked vehicle location — ${session.vehicleName}\n${url}`;
    try {
      if (navigator.share) await navigator.share({ title: 'ParkMate parking location', text, url });
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); setNotice('Parking location link copied.'); }
      else { window.prompt('Copy this parking location link:', url); }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') setNotice('Could not open sharing. Try copying the location link.');
    }
  };

  const openReturn = (session: ParkingSession) => {
    setReturnSessionId(session.id);
    setPage(session.mode === 'path' ? 'return' : 'return');
    if (session.mode === 'pin') {
      // Keep a return page with a direct Google Maps action, while still allowing the user to share the anchor.
      setNotice('Pin Location is ready. Open Google Maps for walking directions.');
    }
  };

  const completeReturn = () => {
    if (!returnSession) return;
    updateState(prev => ({
      ...prev,
      activeSessionId: prev.activeSessionId === returnSession.id ? null : prev.activeSessionId,
      sessions: prev.sessions.map(s => s.id === returnSession.id ? { ...s, status: 'completed', trail: [], rawTrail: [] } : s)
    }));
    setReturnSessionId(null); setPage('home');
    setNotice('Vehicle reached. Active trail cleared; parking history retained.');
  };

  const deleteSession = (id: string) => {
    updateState(prev => ({ ...prev, sessions: prev.sessions.filter(s => s.id !== id), activeSessionId: prev.activeSessionId === id ? null : prev.activeSessionId }));
    setNotice('Parking session deleted.');
  };

  const addVehicle = () => {
    if (!vehicleName.trim()) return;
    const vehicle: Vehicle = { id: makeId(), type: vehicleType, name: vehicleName.trim() };
    updateState(prev => ({ ...prev, vehicles: [...prev.vehicles, vehicle], selectedVehicleId: vehicle.id }));
    setVehicleName(''); setShowVehicleForm(false);
    setNotice('Vehicle added.');
  };

  const saveProfile = () => {
    updateState(prev => ({ ...prev, profileName: profileName.trim() || 'ParkMate User', profileEmail: profileEmail.trim() || 'local account' }));
    setNotice('Profile updated on this device.');
  };

  const activeRoute = activeSession?.trail ?? [];
  const pathToDisplay = returnSession?.trail ?? [];
 const returnGuidance = useMemo(() => {
  if (!returnSession || returnSession.trail.length < 2 || !current) {
    return { bearing: 0, distanceToNext: null as number | null };
  }

  // Build the route from the parking anchor back along the recorded trail.
  const reversed = [...returnSession.trail].reverse();

  // Find the route point closest to the user's current position.
  let nearest = 0;
  let min = Infinity;

  reversed.forEach((point, index) => {
    const distance = distanceMeters(current, point);
    if (distance < min) {
      min = distance;
      nearest = index;
    }
  });

  // Move forward along the reversed route toward the parking anchor.
  const targetIndex = Math.min(nearest + 1, reversed.length - 1);
  const target = reversed[targetIndex];

  return {
    bearing: bearingDegrees(current, target),
    distanceToNext: distanceMeters(current, target)
  };
}, [returnSession, current]);

  const requestReturnLocation = () => locate(() => setNotice('Location updated.'));
  const startReturn = (session: ParkingSession) => {
    setReturnSessionId(session.id); setPage('return');
    locate(() => {});
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand-button" onClick={() => setPage('home')} aria-label="ParkMate home">
          <span className="brand-mark"><MapPin size={21} /></span>
          <span><strong>ParkMate</strong><small>Remember your parking.</small></span>
        </button>
        <button className="icon-button" aria-label="Profile and settings" onClick={() => setPage('profile')}><Settings size={21} /></button>
      </header>

      {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss"><X size={16}/></button></div>}

      {page === 'home' && (
        <main className="page-content">
          <section className="live-map-card"><div className="live-map-heading"><div><span className="live-dot"/><strong>Live map</strong><small>{current ? `GPS accuracy ±${Math.round(current.accuracy ?? 0)} m` : 'Locate yourself to see your current position'}</small></div><button className="button-secondary locate-button" onClick={() => locate(() => setNotice('Live map location updated.'))}><LocateFixed size={16}/> Locate me</button></div><MapView current={current} height="230px" /></section>

          <div className="section-heading"><div><h2>Save your parking</h2><p>Choose the way that works for you.</p></div></div>
          <section className="mode-grid">
            <button className="mode-card pin-mode" onClick={openPinFlow}>
              <span className="mode-icon"><MapPin size={25}/></span>
              <span className="mode-title">Pin Location</span>
              <span className="mode-desc">Save your vehicle's coordinates. Use Google Maps to navigate back.</span>
              <span className="mode-cta">Save a pin <ChevronRight size={17}/></span>
            </button>
            <button className="mode-card path-mode" onClick={() => setShowRecorder(true)}>
              <span className="mode-icon"><Route size={25}/></span>
              <span className="mode-title">Path Recording</span>
              <span className="mode-desc">Record your walking trail and follow it in reverse to return.</span>
              <span className="mode-cta">Record a path <ChevronRight size={17}/></span>
            </button>
          </section>

          {activeSession && (
            <section className="active-card">
              <div className="active-top">
                <div className="vehicle-badge">{vehicleIcon(state.vehicles.find(v => v.id === activeSession.vehicleId)?.type ?? 'Bike')}</div>
                <div className="active-title"><span className="eyebrow">ACTIVE SESSION</span><h3>{activeSession.vehicleName} · Path Recording</h3><p>{new Date(activeSession.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} · Today</p></div>
                <button className="share-button" onClick={() => void shareSession(activeSession)} aria-label="Share parking location" title="Share parking location"><Share2 size={19}/><span>Share</span></button>
              </div>
              <div className="stats-row">
                <div><Route size={17}/><span><small>Path length</small><b>{formatDistance(activeSession.distanceMeters)}</b></span></div>
                <div><Clock3 size={17}/><span><small>Duration</small><b>{formatDuration(activeSession.elapsedSeconds + elapsedTick)}</b></span></div>
                <div><Crosshair size={17}/><span><small>GPS points</small><b>{activeSession.rawTrail.length}</b></span></div>
              </div>
              <div className="mini-map"><MapView anchor={activeSession.anchor} current={current} trail={activeRoute} height="190px"/></div>
              <div className="active-actions">
                {isPaused
                  ? <button className="button-primary" onClick={resumeRecording}><Play size={17}/> Resume recording</button>
                  : <button className="button-danger" onClick={pauseRecording}><Pause size={17}/> Pause recording</button>}
                <button className="button-outline" onClick={saveManualStop}><Check size={17}/> Finish trail</button>
              </div>
              <p className="microcopy"><ShieldCheck size={14}/> Parking anchor is fixed. Only the trail changes while recording.</p>
            </section>
          )}

          <section className="section-heading history-heading">
            <div><h2>Recent parking</h2><p>Your saved locations and paths.</p></div>
            <button className="text-button" onClick={() => setPage('history')}>View all <ChevronRight size={16}/></button>
          </section>
          {state.sessions.filter(s => s.status !== 'active').length === 0 ? (
            <div className="empty-state"><span className="empty-icon"><Bookmark size={24}/></span><h3>No saved parking yet</h3><p>Your parking sessions will appear here after you save your first location.</p></div>
          ) : (
            <div className="session-list">
              {state.sessions.filter(s => s.status !== 'active').slice(0, 3).map(session => (
                <article className="session-row" key={session.id}>
                  <div className="vehicle-badge">{vehicleIcon(state.vehicles.find(v => v.id === session.vehicleId)?.type ?? 'Bike')}</div>
                  <div className="session-info"><h3>{session.vehicleName} · {session.mode === 'pin' ? 'Pin Location' : 'Path Recording'}</h3><p>{new Date(session.createdAt).toLocaleString([], {dateStyle:'medium', timeStyle:'short'})}</p><small>{session.mode === 'path' ? formatDistance(session.distanceMeters) : 'Coordinates saved'}</small></div>
                  <button className="icon-button compact" onClick={() => openReturn(session)} aria-label="Open parking session"><ChevronRight size={19}/></button>
                </article>
              ))}
            </div>
          )}
        </main>
      )}

      {page === 'return' && returnSession && (
        <main className="page-content return-page">
          <button className="back-link" onClick={() => setPage('home')}><ArrowLeft size={18}/> Back to Home</button>
          <div className="return-heading"><div><span className="eyebrow">RETURN MODE</span><h1>Find your vehicle</h1><p>Follow your saved route back to your parking spot.</p></div><button className="icon-button" onClick={requestReturnLocation} aria-label="Refresh location"><LocateFixed size={20}/></button></div>
          <div className="return-session-card">
            <div className="vehicle-badge">{vehicleIcon(state.vehicles.find(v => v.id === returnSession.vehicleId)?.type ?? 'Bike')}</div>
            <div className="session-info"><h3>{returnSession.vehicleName}</h3><p>{returnSession.mode === 'pin' ? 'Pin Location' : 'Path Recording'} · {new Date(returnSession.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p></div>
            <span className="distance-pill"><MapPin size={14}/>{current ? formatDistance(distanceMeters(current, returnSession.anchor)) : '—'}</span>
          </div>
          {returnSession.mode === 'pin' ? (
            <>
              <MapView anchor={returnSession.anchor} current={current} height="43vh"/>
              <div className="return-action-card"><div className="return-action-icon"><Navigation size={23}/></div><div className="return-action-copy"><h3>Continue with Google Maps</h3><p>Get walking directions to your saved parking coordinates.</p></div><a className="button-primary link-button" href={mapsUrl(returnSession.anchor)} target="_blank" rel="noreferrer">Navigate <ChevronRight size={16}/></a></div>
              <button className="button-outline full-button" onClick={() => void shareSession(returnSession)}><Share2 size={17}/> Share parking location</button>
              <button className="button-danger full-button" onClick={completeReturn}><Check size={17}/> Mark vehicle found</button>
            </>
          ) : (
            <>
              <div className="return-map"><MapView anchor={returnSession.anchor} current={current} trail={pathToDisplay} reverse height="44vh"/></div>
              <div className="direction-card">
                <div className="direction-arrow"style={{ transform: `rotate(${returnGuidance.bearing}deg)` }}><ArrowUp size={28}/></div>
                <div className="direction-copy"><span className="eyebrow">FOLLOW THE RECORDED PATH</span><h3>Head toward the next point</h3><p>Use the green trail as your route reference.</p></div>
              </div>
              <div className="return-stats">
                <div><Flag size={18}/><span><small>Distance to anchor</small><b>{current ? formatDistance(distanceMeters(current, returnSession.anchor)) : 'Waiting for GPS'}</b></span></div>
                <div><Clock3 size={18}/><span><small>Recorded path</small><b>{formatDistance(returnSession.distanceMeters)}</b></span></div>
              </div>
              <button className="button-secondary full-button" onClick={requestReturnLocation}><LocateFixed size={17}/> Update my location</button>
              <button className="button-danger full-button" onClick={completeReturn}><Check size={17}/> I've reached my vehicle</button>
            </>
          )}
        </main>
      )}

      {page === 'profile' && (
        <main className="page-content profile-page">
          <div className="page-title-row"><div><span className="eyebrow">YOUR ACCOUNT</span><h1>Profile</h1></div><span className="profile-avatar"><UserRound size={29}/></span></div>
          <section className="profile-card">
            <label>Display name<input value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Your name"/></label>
            <label>Email or contact (optional)<input value={profileEmail} onChange={e => setProfileEmail(e.target.value)} placeholder="Email or contact"/></label>
            <button className="button-primary" onClick={saveProfile}><Check size={17}/> Save profile</button>
            <p className="microcopy">Profile details are stored on this device in this first build. Cloud accounts are a future phase.</p>
          </section>

          <section className="section-heading"><div><h2>My vehicles</h2><p>Choose a vehicle for your next parking session.</p></div><button className="text-button" onClick={() => setShowVehicleForm(v => !v)}><Plus size={16}/> Add</button></section>
          {showVehicleForm && (
            <form className="vehicle-form" onSubmit={e => { e.preventDefault(); addVehicle(); }}>
              <label>Vehicle name<input value={vehicleName} onChange={e => setVehicleName(e.target.value)} placeholder="e.g. Honda CB350" required/></label>
              <label>Type<select value={vehicleType} onChange={e => setVehicleType(e.target.value as VehicleType)}><option>Bike</option><option>Scooter</option><option>Car</option><option>Bus</option><option>Truck</option><option>Tesla</option><option>Thar</option><option>Other</option></select></label>
              <div className="inline-actions"><button className="button-primary" type="submit">Add vehicle</button><button className="button-outline" type="button" onClick={() => setShowVehicleForm(false)}>Cancel</button></div>
            </form>
          )}
          <div className="vehicle-list">
            {state.vehicles.map(vehicle => (
              <button className={`vehicle-row ${state.selectedVehicleId === vehicle.id ? 'selected' : ''}`} key={vehicle.id} onClick={() => updateState(prev => ({ ...prev, selectedVehicleId: vehicle.id }))}>
                <span className="vehicle-badge">{vehicleIcon(vehicle.type)}</span><span className="vehicle-details"><b>{vehicle.name}</b><small>{vehicle.type}</small></span>
                {state.selectedVehicleId === vehicle.id ? <span className="selected-check"><Check size={16}/></span> : <ChevronRight size={18}/>}
              </button>
            ))}
          </div>

          <div className="settings-list">
            <button onClick={() => setPage('history')}><History size={19}/><span>Parking history</span><ChevronRight size={18}/></button>
            <button onClick={() => setNotice('Location is requested only when you start or update a location-based feature. Manage browser permission in your device settings.')}><ShieldCheck size={19}/><span>Location & privacy</span><ChevronRight size={18}/></button>
            <button onClick={() => setNotice('ParkMate 0.1 — mobile-first prototype. Background GPS is not guaranteed in browser mode.')}><CircleHelp size={19}/><span>Help & about</span><ChevronRight size={18}/></button>
          </div>
        </main>
      )}

      {page === 'history' && (
        <main className="page-content history-page">
          <button className="back-link" onClick={() => setPage('home')}><ArrowLeft size={18}/> Back to Home</button>
          <div className="page-title-row"><div><span className="eyebrow">YOUR PARKING</span><h1>History</h1><p>Saved parking anchors and recorded paths.</p></div><History size={26}/></div>
          {state.sessions.length === 0 ? <div className="empty-state"><Bookmark size={26}/><h3>No parking history</h3><p>Save a pin or record a path to see it here.</p></div> :
            <div className="session-list">{[...state.sessions].sort((a,b) => b.createdAt-a.createdAt).map(session => (
              <article className="history-card" key={session.id}>
                <div className="history-card-top"><div className="vehicle-badge">{vehicleIcon(state.vehicles.find(v => v.id === session.vehicleId)?.type ?? 'Bike')}</div><div className="session-info"><h3>{session.vehicleName}</h3><p>{session.mode === 'pin' ? 'Pin Location' : 'Path Recording'} · {new Date(session.createdAt).toLocaleString([], {dateStyle:'medium',timeStyle:'short'})}</p></div><button className="icon-button compact" onClick={() => deleteSession(session.id)} aria-label="Delete parking session"><Trash2 size={17}/></button></div>
                <div className="history-meta"><span><MapPin size={15}/>{session.anchor.lat.toFixed(5)}, {session.anchor.lng.toFixed(5)}</span><span><Route size={15}/>{session.mode === 'path' ? formatDistance(session.distanceMeters) : 'Pin saved'}</span></div>
                <div className="inline-actions"><button className="button-primary" onClick={() => startReturn(session)}><Navigation size={16}/> Return</button><button className="button-outline" onClick={() => void shareSession(session)}><Share2 size={16}/> Share</button></div>
              </article>
            ))}</div>}
        </main>
      )}

      {showPin && (
        <div className="modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) setShowPin(false); }}>
          <section className="modal pin-modal" role="dialog" aria-modal="true" aria-labelledby="pin-title">
            <div className="modal-header"><div><span className="eyebrow">PIN LOCATION</span><h2 id="pin-title">{pinStep === 'vehicle' ? 'What are you parking?' : 'Confirm your parking spot'}</h2><p>{pinStep === 'vehicle' ? 'Choose a vehicle or skip this step.' : 'Check the map marker before saving the coordinates.'}</p></div><button className="icon-button" onClick={() => setShowPin(false)} aria-label="Close"><X size={19}/></button></div>
            {pinStep === 'vehicle' ? <>
              <div className="vehicle-choice-grid">
                {(['Car','Scooter','Bike','Bus','Truck','Tesla','Thar'] as VehicleType[]).map(type => <button key={type} className={`vehicle-choice ${pinVehicleType === type ? 'chosen' : ''}`} onClick={() => setPinVehicleType(type)}><span>{vehicleIcon(type)}</span><b>{type}</b>{pinVehicleType === type && <Check size={15}/>}</button>)}
              </div>
              <button className="button-primary full-button" onClick={() => previewPinLocation(false)}><LocateFixed size={17}/> Continue to map</button>
              <button className="button-outline full-button" onClick={() => previewPinLocation(true)}>Skip vehicle selection</button>
            </> : <>
              {pinAnchor && <div className="pin-preview-map"><MapView anchor={pinAnchor} current={pinAnchor} height="280px" /></div>}
              {pinAnchor && <div className="coordinate-box"><MapPin size={17}/><span><b>Detected coordinates</b><small>{pinAnchor.lat.toFixed(6)}, {pinAnchor.lng.toFixed(6)} · Accuracy ±{Math.round(pinAnchor.accuracy ?? 0)} m</small></span></div>}
              <button className="button-primary full-button" disabled={!pinAnchor} onClick={confirmPinLocation}><Check size={17}/> Confirm and save location</button>
              <button className="button-outline full-button" onClick={() => previewPinLocation(false)}><LocateFixed size={17}/> Refresh current location</button>
              <button className="text-button pin-back-button" onClick={() => setPinStep('vehicle')}><ArrowLeft size={16}/> Change vehicle</button>
            </>}
          </section>
        </div>
      )}

      {showRecorder && (
        <div className="modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) setShowRecorder(false); }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="record-title">
            <div className="modal-header"><div><span className="eyebrow">PATH MEMORY</span><h2 id="record-title">Record your path</h2><p>Choose how long the trail should record.</p></div><button className="icon-button" onClick={() => setShowRecorder(false)} aria-label="Close"><X size={19}/></button></div>
            <label>Vehicle<select value={state.selectedVehicleId} onChange={e => updateState(prev => ({ ...prev, selectedVehicleId: e.target.value }))}>{state.vehicles.map(v => <option key={v.id} value={v.id}>{v.type} · {v.name}</option>)}</select></label>
            <div className="limit-options">
              <button className={limitType === 'time' ? 'limit-option chosen' : 'limit-option'} onClick={() => setLimitType('time')}><Timer size={19}/><b>Time</b><small>Stop after a duration</small></button>
              <button className={limitType === 'distance' ? 'limit-option chosen' : 'limit-option'} onClick={() => setLimitType('distance')}><Route size={19}/><b>Distance</b><small>Stop after a distance</small></button>
              <button className={limitType === 'manual' ? 'limit-option chosen' : 'limit-option'} onClick={() => setLimitType('manual')}><Play size={19}/><b>Manual</b><small>I'll stop it</small></button>
            </div>
            {limitType !== 'manual' && <label>{limitType === 'time' ? 'Duration' : 'Distance'}
              <select value={limitValue} onChange={e => setLimitValue(Number(e.target.value))}>
                {(limitType === 'time' ? [{v:5,l:'5 minutes'},{v:15,l:'15 minutes'},{v:30,l:'30 minutes'}] : [{v:100,l:'100 metres'},{v:200,l:'200 metres'},{v:500,l:'500 metres'},{v:1000,l:'1 kilometre'}]).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </label>}
            <div className="modal-note"><ShieldCheck size={18}/><span>Your parking anchor is fixed at the start. Time or distance limits stop recording; they do not delete the saved trail.</span></div>
            <button className="button-primary full-button" onClick={startPath}><Route size={18}/> Start path recording</button>
          </section>
        </div>
      )}

      <nav className="bottom-nav" aria-label="Main navigation">
        <button className={page === 'home' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('home')}><House size={21}/><span>Home</span></button>
        <button className={page === 'history' || page === 'return' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('history')}><History size={21}/><span>History</span></button>
        <button className={page === 'profile' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('profile')}><UserRound size={21}/><span>Profile</span></button>
      </nav>
      {!loaded && <div className="loading-screen"><span className="brand-mark"><MapPin size={22}/></span><b>ParkMate</b><p>Loading your parking memory…</p></div>}
    </div>
  );
}
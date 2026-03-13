import * as L_module from 'leaflet';
import PouchDB from 'pouchdb';
import 'leaflet/dist/leaflet.css';

if (typeof window !== 'undefined') {
  // Handle different module formats (ESM, CJS, UMD)
  let Leaflet = (L_module as any).default || L_module;
  
  // Some UMD wrappers in Vite/ESM might nest the object or return a namespace
  if (Leaflet && !Leaflet.version) {
    if (Leaflet.L && Leaflet.L.version) {
      Leaflet = Leaflet.L;
    } else {
      // Search for the object that looks like Leaflet
      for (const key in L_module) {
        const val = (L_module as any)[key];
        if (val && val.version && typeof val.Class === 'function') {
          Leaflet = val;
          break;
        }
      }
    }
  }
  
  (window as any).L = Leaflet;
  (window as any).PouchDB = PouchDB;
  
  // Diagnostic
  if (Leaflet && typeof Leaflet.Class !== 'function') {
    console.error('Leaflet.Class is not a function! Plugins will fail.', Leaflet);
  }
}


export type TerrainType = 'plano' | 'aclive' | 'declive';
export type ExperienceLevel = 'iniciante' | 'intermediario' | 'experiente';
export type BackpackStatus = 'sem_mochila' | 'com_mochila';

interface SpeedRange {
  min: number;
  max: number;
}

const SPEED_TABLE: Record<TerrainType, Record<BackpackStatus, Record<ExperienceLevel, SpeedRange>>> = {
  plano: {
    sem_mochila: {
      iniciante: { min: 2.4, max: 3.2 },
      intermediario: { min: 3.2, max: 4.0 },
      experiente: { min: 4.8, max: 6.4 }
    },
    com_mochila: {
      iniciante: { min: 1.6, max: 2.4 },
      intermediario: { min: 2.4, max: 3.2 },
      experiente: { min: 4.8, max: 4.8 }
    }
  },
  aclive: {
    sem_mochila: {
      iniciante: { min: 1.2, max: 1.2 },
      intermediario: { min: 1.6, max: 1.6 },
      experiente: { min: 2.0, max: 3.5 }
    },
    com_mochila: {
      iniciante: { min: 0.8, max: 0.8 },
      intermediario: { min: 1.2, max: 1.2 },
      experiente: { min: 1.6, max: 2.4 }
    }
  },
  declive: {
    sem_mochila: {
      iniciante: { min: 3.2, max: 3.2 },
      intermediario: { min: 3.2, max: 4.8 },
      experiente: { min: 4.0, max: 5.6 }
    },
    com_mochila: {
      iniciante: { min: 2.4, max: 2.4 },
      intermediario: { min: 3.2, max: 3.2 },
      experiente: { min: 3.2, max: 4.0 }
    }
  }
};

export const searchPlanningService = {
  calculateSpeed(terrain: TerrainType, backpack: BackpackStatus, experience: ExperienceLevel): number {
    const range = SPEED_TABLE[terrain][backpack][experience];
    return (range.min + range.max) / 2;
  },

  calculateAutonomy(speed: number, hours: number): number {
    return speed * hours;
  },

  nmToKm(nm: number): number {
    return nm * 1.852;
  },

  /**
   * Calcula os pontos de um retângulo ao redor de uma rota (LKP -> Destino)
   * @param lkp [lat, lng]
   * @param dest [lat, lng]
   * @param sideOffsetKm Distância para cada lado da rota
   * @param startOffsetKm Distância antes do LKP
   * @param endOffsetKm Distância após o Destino
   */
  calculateRouteRectangle(
    lkp: [number, number],
    dest: [number, number],
    sideOffsetKm: number,
    startOffsetKm: number,
    endOffsetKm: number
  ): [number, number][] {
    // Implementação simplificada usando aproximação plana para distâncias curtas
    // Em um sistema real, usaríamos bibliotecas como 'turf' para precisão esférica
    
    const lat1 = lkp[0] * Math.PI / 180;
    const lon1 = lkp[1] * Math.PI / 180;
    const lat2 = dest[0] * Math.PI / 180;
    const lon2 = dest[1] * Math.PI / 180;

    // Rumo (Bearing)
    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    const bearing = Math.atan2(y, x);

    const R = 6371; // Raio da Terra em km

    const getPoint = (startLat: number, startLon: number, dist: number, brng: number): [number, number] => {
      const lat = Math.asin(Math.sin(startLat) * Math.cos(dist / R) + Math.cos(startLat) * Math.sin(dist / R) * Math.cos(brng));
      const lon = startLon + Math.atan2(Math.sin(brng) * Math.sin(dist / R) * Math.cos(startLat), Math.cos(dist / R) - Math.sin(startLat) * Math.sin(lat));
      return [lat * 180 / Math.PI, lon * 180 / Math.PI];
    };

    // Ponto de início ajustado (antes do LKP)
    const startAdjusted = getPoint(lat1, lon1, -startOffsetKm, bearing);
    // Ponto final ajustado (após o Destino)
    const endAdjusted = getPoint(lat2, lon2, endOffsetKm, bearing);

    const latStartAdj = startAdjusted[0] * Math.PI / 180;
    const lonStartAdj = startAdjusted[1] * Math.PI / 180;
    const latEndAdj = endAdjusted[0] * Math.PI / 180;
    const lonEndAdj = endAdjusted[1] * Math.PI / 180;

    // Cantos
    const p1 = getPoint(latStartAdj, lonStartAdj, sideOffsetKm, bearing + Math.PI / 2);
    const p2 = getPoint(latStartAdj, lonStartAdj, sideOffsetKm, bearing - Math.PI / 2);
    const p3 = getPoint(latEndAdj, lonEndAdj, sideOffsetKm, bearing - Math.PI / 2);
    const p4 = getPoint(latEndAdj, lonEndAdj, sideOffsetKm, bearing + Math.PI / 2);

    return [p1, p2, p3, p4];
  }
};

import * as THREE from 'three';
import { DensityGrid } from '@/types';

export interface IsosurfaceGeometry {
  vertices: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
  triangleCount: number;
}

interface VoxelData {
  values: Float32Array;
  positions: Float32Array;
}

interface CacheEntry {
  geometry: IsosurfaceGeometry;
  timestamp: number;
}

export class IsosurfaceGenerator {
  private static readonly MAX_VERTICES = 5000000;
  private static readonly CACHE_MAX_ENTRIES = 10;
  private static readonly geometryCache = new Map<string, CacheEntry>();
  private static voxelCache = new WeakMap<DensityGrid, Float32Array>();
  private static lastGridHash = '';

  private static calculateGridHash(grid: DensityGrid, isoValue: number): string {
    const [nx, ny, nz] = grid.dimensions;
    const dataSample = grid.data.length > 1000 
      ? `${grid.data[0]},${grid.data[Math.floor(grid.data.length/2)]},${grid.data[grid.data.length-1]}`
      : grid.data.join(',');
    return `${nx},${ny},${nz},${grid.origin.x},${grid.origin.y},${grid.origin.z},${grid.spacing.x},${isoValue.toFixed(6)},${dataSample.substring(0, 100)}`;
  }

  private static getCacheKey(grid: DensityGrid, isoValue: number, type: 'full' | 'positive' | 'negative'): string {
    const gridHash = this.calculateGridHash(grid, isoValue);
    return `${type}_${gridHash}`;
  }

  private static getFromCache(key: string): IsosurfaceGeometry | null {
    const entry = this.geometryCache.get(key);
    if (entry) {
      entry.timestamp = Date.now();
      return entry.geometry;
    }
    return null;
  }

  private static addToCache(key: string, geometry: IsosurfaceGeometry): void {
    if (this.geometryCache.size >= this.CACHE_MAX_ENTRIES) {
      let oldestKey = '';
      let oldestTime = Infinity;
      for (const [k, v] of this.geometryCache.entries()) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp;
          oldestKey = k;
        }
      }
      if (oldestKey) {
        this.geometryCache.delete(oldestKey);
      }
    }
    this.geometryCache.set(key, {
      geometry,
      timestamp: Date.now(),
    });
  }

  public static clearCache(): void {
    this.geometryCache.clear();
    this.voxelCache = new WeakMap();
  }

  public static getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.geometryCache.size,
      maxSize: this.CACHE_MAX_ENTRIES,
    };
  }

  public static generate(
    grid: DensityGrid,
    isoValue: number
  ): IsosurfaceGeometry {
    const cacheKey = this.getCacheKey(grid, isoValue, 'full');
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }
    const [nx, ny, nz] = grid.dimensions;
    const totalVoxels = (nx - 1) * (ny - 1) * (nz - 1);

    const maxVertices = Math.min(totalVoxels * 15, IsosurfaceGenerator.MAX_VERTICES);
    const maxIndices = Math.min(totalVoxels * 15, IsosurfaceGenerator.MAX_VERTICES);

    const positions = new Float32Array(maxVertices * 3);
    const normals = new Float32Array(maxVertices * 3);
    const indices = new Uint32Array(maxIndices);

    let vertexIndex = 0;
    let indexIndex = 0;

    const voxelData: VoxelData = {
      values: new Float32Array(8),
      positions: new Float32Array(24),
    };

    const edgeVertices = new Float32Array(36);
    const edgeFlags = new Uint8Array(12);

    const ox = grid.origin.x;
    const oy = grid.origin.y;
    const oz = grid.origin.z;
    const sx = grid.spacing.x;
    const sy = grid.spacing.y;
    const sz = grid.spacing.z;
    const nxy = nx * ny;

    for (let iz = 0; iz < nz - 1; iz++) {
      const z0 = oz + iz * sz;
      const z1 = z0 + sz;
      const izOffset = iz * nxy;
      const iz1Offset = (iz + 1) * nxy;

      for (let iy = 0; iy < ny - 1; iy++) {
        const y0 = oy + iy * sy;
        const y1 = y0 + sy;
        const iyOffset = iy * nx;
        const iy1Offset = (iy + 1) * nx;

        for (let ix = 0; ix < nx - 1; ix++) {
          const x0 = ox + ix * sx;
          const x1 = x0 + sx;

          voxelData.values[0] = grid.data[izOffset + iyOffset + ix];
          voxelData.values[1] = grid.data[izOffset + iyOffset + ix + 1];
          voxelData.values[2] = grid.data[izOffset + iy1Offset + ix + 1];
          voxelData.values[3] = grid.data[izOffset + iy1Offset + ix];
          voxelData.values[4] = grid.data[iz1Offset + iyOffset + ix];
          voxelData.values[5] = grid.data[iz1Offset + iyOffset + ix + 1];
          voxelData.values[6] = grid.data[iz1Offset + iy1Offset + ix + 1];
          voxelData.values[7] = grid.data[iz1Offset + iy1Offset + ix];

          let cubeIndex = 0;
          for (let i = 0; i < 8; i++) {
            if (voxelData.values[i] <= isoValue) {
              cubeIndex |= (1 << i);
            }
          }

          if (cubeIndex === 0 || cubeIndex === 255) continue;

          voxelData.positions[0] = x0; voxelData.positions[1] = y0; voxelData.positions[2] = z0;
          voxelData.positions[3] = x1; voxelData.positions[4] = y0; voxelData.positions[5] = z0;
          voxelData.positions[6] = x1; voxelData.positions[7] = y1; voxelData.positions[8] = z0;
          voxelData.positions[9] = x0; voxelData.positions[10] = y1; voxelData.positions[11] = z0;
          voxelData.positions[12] = x0; voxelData.positions[13] = y0; voxelData.positions[14] = z1;
          voxelData.positions[15] = x1; voxelData.positions[16] = y0; voxelData.positions[17] = z1;
          voxelData.positions[18] = x1; voxelData.positions[19] = y1; voxelData.positions[20] = z1;
          voxelData.positions[21] = x0; voxelData.positions[22] = y1; voxelData.positions[23] = z1;

          const edgeTableVal = edgeTable[cubeIndex];
          for (let i = 0; i < 12; i++) {
            if (edgeTableVal & (1 << i)) {
              const v1 = edgeConnection[i][0];
              const v2 = edgeConnection[i][1];
              const d1 = voxelData.values[v1];
              const d2 = voxelData.values[v2];
              
              const t = (isoValue - d1) / (d2 - d1);
              const tInv = 1 - t;
              
              const p1Offset = v1 * 3;
              const p2Offset = v2 * 3;
              const eOffset = i * 3;
              
              edgeVertices[eOffset] = voxelData.positions[p1Offset] * tInv + voxelData.positions[p2Offset] * t;
              edgeVertices[eOffset + 1] = voxelData.positions[p1Offset + 1] * tInv + voxelData.positions[p2Offset + 1] * t;
              edgeVertices[eOffset + 2] = voxelData.positions[p1Offset + 2] * tInv + voxelData.positions[p2Offset + 2] * t;
              edgeFlags[i] = 1;
            } else {
              edgeFlags[i] = 0;
            }
          }

          const triRow = triTable[cubeIndex];
          for (let i = 0; triRow[i] !== -1; i += 3) {
            const i0 = triRow[i];
            const i1 = triRow[i + 1];
            const i2 = triRow[i + 2];

            if (edgeFlags[i0] && edgeFlags[i1] && edgeFlags[i2]) {
              const e0 = i0 * 3;
              const e1 = i1 * 3;
              const e2 = i2 * 3;

              const v0x = edgeVertices[e0];
              const v0y = edgeVertices[e0 + 1];
              const v0z = edgeVertices[e0 + 2];
              
              const v1x = edgeVertices[e1];
              const v1y = edgeVertices[e1 + 1];
              const v1z = edgeVertices[e1 + 2];
              
              const v2x = edgeVertices[e2];
              const v2y = edgeVertices[e2 + 1];
              const v2z = edgeVertices[e2 + 2];

              const vOffset = vertexIndex * 3;
              positions[vOffset] = v0x;
              positions[vOffset + 1] = v0y;
              positions[vOffset + 2] = v0z;
              positions[vOffset + 3] = v1x;
              positions[vOffset + 4] = v1y;
              positions[vOffset + 5] = v1z;
              positions[vOffset + 6] = v2x;
              positions[vOffset + 7] = v2y;
              positions[vOffset + 8] = v2z;

              const e1x = v1x - v0x;
              const e1y = v1y - v0y;
              const e1z = v1z - v0z;
              const e2x = v2x - v0x;
              const e2y = v2y - v0y;
              const e2z = v2z - v0z;

              const nx = e1y * e2z - e1z * e2y;
              const ny = e1z * e2x - e1x * e2z;
              const nz = e1x * e2y - e1y * e2x;
              const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
              const nxn = nx / len;
              const nyn = ny / len;
              const nzn = nz / len;

              normals[vOffset] = nxn;
              normals[vOffset + 1] = nyn;
              normals[vOffset + 2] = nzn;
              normals[vOffset + 3] = nxn;
              normals[vOffset + 4] = nyn;
              normals[vOffset + 5] = nzn;
              normals[vOffset + 6] = nxn;
              normals[vOffset + 7] = nyn;
              normals[vOffset + 8] = nzn;

              indices[indexIndex] = vertexIndex;
              indices[indexIndex + 1] = vertexIndex + 1;
              indices[indexIndex + 2] = vertexIndex + 2;

              vertexIndex += 3;
              indexIndex += 3;

              if (vertexIndex >= maxVertices) break;
            }
          }
        }
      }
    }

    const geometry = {
      vertices: positions.subarray(0, vertexIndex * 3),
      normals: normals.subarray(0, vertexIndex * 3),
      indices: indices.subarray(0, indexIndex),
      vertexCount: vertexIndex,
      triangleCount: indexIndex / 3,
    };

    this.addToCache(cacheKey, geometry);
    return geometry;
  }

  public static generatePositiveNegative(
    differenceGrid: DensityGrid,
    isoValue: number
  ): { positive: IsosurfaceGeometry; negative: IsosurfaceGeometry } {
    const posCacheKey = this.getCacheKey(differenceGrid, isoValue, 'positive');
    const negCacheKey = this.getCacheKey(differenceGrid, isoValue, 'negative');
    
    const cachedPositive = this.getFromCache(posCacheKey);
    const cachedNegative = this.getFromCache(negCacheKey);
    
    if (cachedPositive && cachedNegative) {
      return { positive: cachedPositive, negative: cachedNegative };
    }

    const positiveData = new Float32Array(differenceGrid.data.length);
    const negativeData = new Float32Array(differenceGrid.data.length);

    for (let i = 0; i < differenceGrid.data.length; i++) {
      const val = differenceGrid.data[i];
      positiveData[i] = val > 0 ? val : 0;
      negativeData[i] = val < 0 ? -val : 0;
    }

    const positiveGrid = { ...differenceGrid, data: positiveData };
    const negativeGrid = { ...differenceGrid, data: negativeData };

    const positive = cachedPositive || this.generate(positiveGrid, isoValue);
    const negative = cachedNegative || this.generate(negativeGrid, isoValue);

    if (!cachedPositive) this.addToCache(posCacheKey, positive);
    if (!cachedNegative) this.addToCache(negCacheKey, negative);

    return { positive, negative };
  }

  public static toThreeGeometry(surface: IsosurfaceGeometry): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    
    if (surface.vertexCount > 0) {
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(surface.vertices, 3)
      );
      geometry.setAttribute(
        'normal',
        new THREE.BufferAttribute(surface.normals, 3)
      );
      geometry.setIndex(new THREE.BufferAttribute(surface.indices, 1));
      geometry.computeBoundingSphere();
    }

    return geometry;
  }
}

const edgeTable = new Uint16Array([
  0x0, 0x109, 0x203, 0x30a, 0x406, 0x50f, 0x605, 0x70c,
  0x80c, 0x905, 0xa0f, 0xb06, 0xc0a, 0xd03, 0xe09, 0xf00,
  0x190, 0x99, 0x393, 0x29a, 0x596, 0x49f, 0x795, 0x69c,
  0x99c, 0x895, 0xb9f, 0xa96, 0xd9a, 0xc93, 0xf99, 0xe90,
  0x230, 0x339, 0x33, 0x13a, 0x636, 0x73f, 0x435, 0x53c,
  0xa3c, 0xb35, 0x83f, 0x936, 0xe3a, 0xf33, 0xc39, 0xd30,
  0x3a0, 0x2a9, 0x1a3, 0xaa, 0x7a6, 0x6af, 0x5a5, 0x4ac,
  0xbac, 0xaa5, 0x9af, 0x8a6, 0xfaa, 0xea3, 0xda9, 0xca0,
  0x460, 0x569, 0x663, 0x76a, 0x66, 0x16f, 0x265, 0x36c,
  0xc6c, 0xd65, 0xe6f, 0xf66, 0x86a, 0x963, 0xa69, 0xb60,
  0x5f0, 0x4f9, 0x7f3, 0x6fa, 0x1f6, 0xff, 0x3f5, 0x2fc,
  0xdfc, 0xcf5, 0xfff, 0xef6, 0x9fa, 0x8f3, 0xbf9, 0xaf0,
  0x650, 0x759, 0x453, 0x55a, 0x256, 0x35f, 0x55, 0x15c,
  0xe5c, 0xf55, 0xc5f, 0xd56, 0xa5a, 0xb53, 0x859, 0x950,
  0x7c0, 0x6c9, 0x5c3, 0x4ca, 0x3c6, 0x2cf, 0x1c5, 0xcc,
  0xfcc, 0xec5, 0xdcf, 0xcc6, 0xbca, 0xac3, 0x9c9, 0x8c0,
  0x8c0, 0x9c9, 0xac3, 0xbca, 0xcc6, 0xdcf, 0xec5, 0xfcc,
  0xcc, 0x1c5, 0x2cf, 0x3c6, 0x4ca, 0x5c3, 0x6c9, 0x7c0,
  0x950, 0x859, 0xb53, 0xa5a, 0xd56, 0xc5f, 0xf55, 0xe5c,
  0x15c, 0x55, 0x35f, 0x256, 0x55a, 0x453, 0x759, 0x650,
  0xaf0, 0xbf9, 0x8f3, 0x9fa, 0xef6, 0xfff, 0xcf5, 0xdfc,
  0x2fc, 0x3f5, 0xff, 0x1f6, 0x6fa, 0x7f3, 0x4f9, 0x5f0,
  0xb60, 0xa69, 0x963, 0x86a, 0xf66, 0xe6f, 0xd65, 0xc6c,
  0x36c, 0x265, 0x16f, 0x66, 0x76a, 0x663, 0x569, 0x460,
  0xca0, 0xda9, 0xea3, 0xfaa, 0x8a6, 0x9af, 0xaa5, 0xbac,
  0x4ac, 0x5a5, 0x6af, 0x7a6, 0xaa, 0x1a3, 0x2a9, 0x3a0,
  0xd30, 0xc39, 0xf33, 0xe3a, 0x936, 0x83f, 0xb35, 0xa3c,
  0x53c, 0x435, 0x73f, 0x636, 0x13a, 0x33, 0x339, 0x230,
  0xe90, 0xf99, 0xc93, 0xd9a, 0xa96, 0xb9f, 0x895, 0x99c,
  0x69c, 0x795, 0x49f, 0x596, 0x29a, 0x393, 0x99, 0x190,
  0xf00, 0xe09, 0xd03, 0xc0a, 0xb06, 0xa0f, 0x905, 0x80c,
  0x70c, 0x605, 0x50f, 0x406, 0x30a, 0x203, 0x109, 0x0,
]);

const edgeConnection: number[][] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

const triTable: number[][] = [
  [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [0,8,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [0,1,9,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [1,8,3,9,8,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [1,2,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [0,8,3,1,2,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [9,2,10,0,2,9,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [2,8,3,2,10,8,10,9,8,-1,-1,-1,-1,-1,-1,-1],
  [3,11,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [0,11,2,8,11,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [1,9,0,2,3,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [1,11,2,1,9,11,9,8,11,-1,-1,-1,-1,-1,-1,-1],
  [3,10,1,11,10,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [0,10,1,0,8,10,8,11,10,-1,-1,-1,-1,-1,-1,-1],
  [3,9,0,3,11,9,11,10,9,-1,-1,-1,-1,-1,-1,-1],
  [9,8,10,10,8,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [4,7,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [4,3,0,7,3,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [0,1,9,8,4,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [4,1,9,4,7,1,7,3,1,-1,-1,-1,-1,-1,-1,-1],
  [1,2,10,8,4,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [3,4,7,3,0,4,1,2,10,-1,-1,-1,-1,-1,-1,-1],
  [9,2,10,9,0,2,8,4,7,-1,-1,-1,-1,-1,-1,-1],
  [2,10,9,2,9,7,2,7,3,7,9,4,-1,-1,-1,-1],
  [8,4,7,3,11,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [11,4,7,11,2,4,2,0,4,-1,-1,-1,-1,-1,-1,-1],
  [9,0,1,8,4,7,2,3,11,-1,-1,-1,-1,-1,-1,-1],
  [4,7,11,9,4,11,9,11,2,9,2,1,-1,-1,-1,-1],
  [3,10,1,3,11,10,7,8,4,-1,-1,-1,-1,-1,-1,-1],
  [1,11,10,1,4,11,1,0,4,7,11,4,-1,-1,-1,-1],
  [4,7,8,9,0,11,9,11,10,11,0,3,-1,-1,-1,-1],
  [4,7,11,4,11,9,9,11,10,-1,-1,-1,-1,-1,-1,-1],
  [9,5,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [9,5,4,0,8,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [0,5,4,1,5,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [8,5,4,8,3,5,3,1,5,-1,-1,-1,-1,-1,-1,-1],
  [1,2,10,9,5,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [3,0,8,1,2,10,4,9,5,-1,-1,-1,-1,-1,-1,-1],
  [5,2,10,5,4,2,4,0,2,-1,-1,-1,-1,-1,-1,-1],
  [2,10,5,3,2,5,3,5,4,3,4,8,-1,-1,-1,-1],
  [9,5,4,2,3,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [0,11,2,0,8,11,4,9,5,-1,-1,-1,-1,-1,-1,-1],
  [0,5,4,0,1,5,2,3,11,-1,-1,-1,-1,-1,-1,-1],
  [2,1,5,2,5,8,2,8,11,4,8,5,-1,-1,-1,-1],
  [10,3,11,10,1,3,9,5,4,-1,-1,-1,-1,-1,-1,-1],
  [4,9,5,0,8,1,8,10,1,8,11,10,-1,-1,-1,-1],
  [5,4,0,5,0,11,5,11,10,11,0,3,-1,-1,-1,-1],
  [5,4,8,5,8,10,10,8,11,-1,-1,-1,-1,-1,-1,-1],
  [9,7,8,5,7,9,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [9,3,0,9,5,3,5,7,3,-1,-1,-1,-1,-1,-1,-1],
  [0,7,8,0,1,7,1,5,7,-1,-1,-1,-1,-1,-1,-1],
  [1,5,3,3,5,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [9,7,8,9,5,7,10,1,2,-1,-1,-1,-1,-1,-1,-1],
  [10,1,2,9,5,0,5,3,0,5,7,3,-1,-1,-1,-1],
  [8,0,2,8,2,5,8,5,7,10,5,2,-1,-1,-1,-1],
  [2,10,5,2,5,3,3,5,7,-1,-1,-1,-1,-1,-1,-1],
  [7,9,5,7,8,9,3,11,2,-1,-1,-1,-1,-1,-1,-1],
  [9,5,7,9,7,2,9,2,0,2,7,11,-1,-1,-1,-1],
  [2,3,11,0,1,8,1,7,8,1,5,7,-1,-1,-1,-1],
  [11,2,1,11,1,7,7,1,5,-1,-1,-1,-1,-1,-1,-1],
  [9,5,8,8,5,7,10,1,3,10,3,11,-1,-1,-1,-1],
  [5,7,0,5,0,9,7,11,0,1,0,10,11,10,0,-1],
  [11,10,0,11,0,3,10,5,0,8,0,7,5,7,0,-1],
  [11,10,5,7,11,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [10,6,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [0,8,3,5,10,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [9,0,1,5,10,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [1,8,3,1,9,8,5,10,6,-1,-1,-1,-1,-1,-1,-1],
  [1,6,5,2,6,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [1,6,5,1,2,6,3,0,8,-1,-1,-1,-1,-1,-1,-1],
  [9,6,5,9,0,6,0,2,6,-1,-1,-1,-1,-1,-1,-1],
  [5,9,8,5,8,2,5,2,6,3,2,8,-1,-1,-1,-1],
  [2,3,11,10,6,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [11,0,8,11,2,0,10,6,5,-1,-1,-1,-1,-1,-1,-1],
  [0,1,9,2,3,11,5,10,6,-1,-1,-1,-1,-1,-1,-1],
  [5,10,6,1,9,2,9,11,2,9,8,11,-1,-1,-1,-1],
  [6,3,11,6,5,3,5,1,3,-1,-1,-1,-1,-1,-1,-1],
  [0,8,11,0,11,5,0,5,1,5,11,6,-1,-1,-1,-1],
  [3,11,6,0,3,6,0,6,5,0,5,9,-1,-1,-1,-1],
  [6,5,9,6,9,11,11,9,8,-1,-1,-1,-1,-1,-1,-1],
  [5,10,6,4,7,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [4,3,0,4,7,3,6,5,10,-1,-1,-1,-1,-1,-1,-1],
  [1,9,0,5,10,6,8,4,7,-1,-1,-1,-1,-1,-1,-1],
  [10,6,5,1,9,7,1,7,3,7,9,4,-1,-1,-1,-1],
  [4,7,8,5,1,2,5,2,6,-1,-1,-1,-1,-1,-1,-1],
  [0,4,7,0,7,3,1,2,5,2,6,5,-1,-1,-1,-1],
  [9,0,2,9,2,5,9,5,7,6,5,2,8,4,7,-1],
  [7,3,9,7,9,4,3,2,9,5,9,6,2,6,9,-1],
  [3,11,2,7,8,4,10,6,5,-1,-1,-1,-1,-1,-1,-1],
  [5,10,6,4,7,2,4,2,0,2,7,11,-1,-1,-1,-1],
  [0,1,9,4,7,8,2,3,11,5,10,6,-1,-1,-1,-1],
  [9,2,1,9,11,2,9,4,11,7,11,4,5,10,6,-1],
  [8,4,7,3,11,5,3,5,1,5,11,6,-1,-1,-1,-1],
  [5,1,11,5,11,6,1,0,11,7,11,4,0,4,11,-1],
  [0,5,9,0,3,5,0,7,3,5,6,11,3,11,7,8,4,7],
  [6,5,9,6,9,11,4,7,9,7,11,9,-1,-1,-1,-1],
  [10,4,9,6,4,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [4,10,6,4,9,10,0,8,3,-1,-1,-1,-1,-1,-1,-1],
  [10,0,1,10,6,0,6,4,0,-1,-1,-1,-1,-1,-1,-1],
  [8,3,1,8,1,6,8,6,4,6,1,10,-1,-1,-1,-1],
  [1,4,9,1,2,4,2,6,4,-1,-1,-1,-1,-1,-1,-1],
  [3,0,8,1,2,9,2,4,9,2,6,4,-1,-1,-1,-1],
  [0,2,4,4,2,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [8,3,2,8,2,4,4,2,6,-1,-1,-1,-1,-1,-1,-1],
  [10,4,9,10,6,4,11,2,3,-1,-1,-1,-1,-1,-1,-1],
  [0,8,2,2,8,11,4,9,10,4,10,6,-1,-1,-1,-1],
  [3,11,2,0,1,6,0,6,4,6,1,10,-1,-1,-1,-1],
  [6,4,1,6,1,10,4,8,1,2,1,11,8,11,1,-1],
  [9,6,4,9,3,6,9,1,3,11,6,3,-1,-1,-1,-1],
  [8,11,1,8,1,0,11,6,1,9,1,4,6,4,1,-1],
  [3,11,6,3,6,0,0,6,4,-1,-1,-1,-1,-1,-1,-1],
  [6,4,8,11,6,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [7,10,6,7,8,10,8,9,10,-1,-1,-1,-1,-1,-1,-1],
  [0,7,3,0,10,7,0,9,10,6,7,10,-1,-1,-1,-1],
  [10,6,7,1,10,7,1,7,8,1,8,0,-1,-1,-1,-1],
  [10,6,7,10,7,1,1,7,3,-1,-1,-1,-1,-1,-1,-1],
  [1,2,6,1,6,8,1,8,9,8,6,7,-1,-1,-1,-1],
  [2,6,9,2,9,1,6,7,9,0,9,3,7,3,9,-1],
  [7,8,0,7,0,6,6,0,2,-1,-1,-1,-1,-1,-1,-1],
  [7,3,2,6,7,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [2,3,11,10,6,8,10,8,9,8,6,7,-1,-1,-1,-1],
  [2,0,7,2,7,11,0,9,7,6,7,10,9,10,7,-1],
  [1,8,0,1,7,8,1,10,7,6,7,10,2,3,11,-1],
  [11,2,1,11,1,7,10,6,1,6,7,1,-1,-1,-1,-1],
  [8,9,6,8,6,7,9,1,6,11,6,3,1,3,6,-1],
  [0,9,1,11,6,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [7,8,0,7,0,6,3,11,0,11,6,0,-1,-1,-1,-1],
  [7,11,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [7,6,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [3,0,8,11,7,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [0,1,9,11,7,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [8,1,9,8,3,1,11,7,6,-1,-1,-1,-1,-1,-1,-1],
  [10,1,2,6,11,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [1,2,10,3,0,8,6,11,7,-1,-1,-1,-1,-1,-1,-1],
  [2,9,0,2,10,9,6,11,7,-1,-1,-1,-1,-1,-1,-1],
  [6,11,7,2,10,3,10,8,3,10,9,8,-1,-1,-1,-1],
  [7,2,3,6,2,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [7,0,8,7,6,0,6,2,0,-1,-1,-1,-1,-1,-1,-1],
  [2,7,6,2,3,7,0,1,9,-1,-1,-1,-1,-1,-1,-1],
  [1,6,2,1,8,6,1,9,8,8,7,6,-1,-1,-1,-1],
  [10,7,6,10,1,7,1,3,7,-1,-1,-1,-1,-1,-1,-1],
  [10,7,6,1,7,10,1,8,7,1,0,8,-1,-1,-1,-1],
  [0,3,7,0,7,10,0,10,9,6,10,7,-1,-1,-1,-1],
  [7,6,10,7,10,8,8,10,9,-1,-1,-1,-1,-1,-1,-1],
  [6,8,4,11,8,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [3,6,11,3,0,6,0,4,6,-1,-1,-1,-1,-1,-1,-1],
  [8,6,11,8,4,6,9,0,1,-1,-1,-1,-1,-1,-1,-1],
  [9,4,6,9,6,3,9,3,1,11,3,6,-1,-1,-1,-1],
  [6,8,4,6,11,8,2,10,1,-1,-1,-1,-1,-1,-1,-1],
  [1,2,10,3,0,11,0,6,11,0,4,6,-1,-1,-1,-1],
  [4,11,8,4,6,11,0,2,9,2,10,9,-1,-1,-1,-1],
  [10,9,3,10,3,2,9,6,3,11,3,4,6,4,3,-1],
  [8,2,3,8,4,2,4,6,2,-1,-1,-1,-1,-1,-1,-1],
  [0,4,2,4,6,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [1,9,0,2,3,4,2,4,6,4,3,8,-1,-1,-1,-1],
  [1,9,4,1,4,2,2,4,6,-1,-1,-1,-1,-1,-1,-1],
  [8,1,3,8,6,1,8,4,6,6,10,1,-1,-1,-1,-1],
  [10,1,0,10,0,6,6,0,4,-1,-1,-1,-1,-1,-1,-1],
  [4,6,3,4,3,8,6,10,3,0,3,9,10,9,3,-1],
  [10,9,4,6,10,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [4,9,5,7,6,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [0,8,3,4,9,5,7,6,11,-1,-1,-1,-1,-1,-1,-1],
  [5,0,1,5,4,0,7,6,11,-1,-1,-1,-1,-1,-1,-1],
  [11,7,6,8,3,4,3,5,4,3,1,5,-1,-1,-1,-1],
  [9,5,4,10,1,2,7,6,11,-1,-1,-1,-1,-1,-1,-1],
  [6,11,7,1,2,10,0,8,3,4,9,5,-1,-1,-1,-1],
  [7,6,11,5,4,10,4,2,10,4,0,2,-1,-1,-1,-1],
  [3,4,8,3,5,4,3,2,5,10,5,2,11,7,6,-1],
  [7,2,3,7,6,2,5,4,9,-1,-1,-1,-1,-1,-1,-1],
  [9,5,4,0,8,6,0,6,2,6,8,7,-1,-1,-1,-1],
  [3,6,2,3,7,6,1,5,0,5,4,0,-1,-1,-1,-1],
  [6,2,8,6,8,7,2,1,8,4,8,5,1,5,8,-1],
  [9,5,4,10,1,6,1,7,6,1,3,7,-1,-1,-1,-1],
  [1,6,10,1,7,6,1,0,7,8,7,0,9,5,4,-1],
  [4,0,10,4,10,5,0,3,10,6,10,7,3,7,10,-1],
  [7,6,10,7,10,8,5,4,10,4,8,10,-1,-1,-1,-1],
  [6,9,5,6,11,9,11,8,9,-1,-1,-1,-1,-1,-1,-1],
  [3,6,11,0,6,3,0,5,6,0,9,5,-1,-1,-1,-1],
  [0,11,8,0,5,11,0,1,5,5,6,11,-1,-1,-1,-1],
  [6,11,3,6,3,5,5,3,1,-1,-1,-1,-1,-1,-1,-1],
  [1,2,10,9,5,11,9,11,8,11,5,6,-1,-1,-1,-1],
  [0,11,3,0,6,11,0,9,6,5,6,9,1,2,10,-1],
  [11,8,5,11,5,6,8,0,5,10,5,2,0,2,5,-1],
  [6,11,3,6,3,5,2,10,3,10,5,3,-1,-1,-1,-1],
  [5,8,9,5,2,8,5,6,2,3,8,2,-1,-1,-1,-1],
  [9,5,6,9,6,0,0,6,2,-1,-1,-1,-1,-1,-1,-1],
  [1,5,8,1,8,0,5,6,8,3,8,2,6,2,8,-1],
  [1,5,6,2,1,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [1,3,6,1,6,10,3,8,6,5,6,9,8,9,6,-1],
  [10,1,0,10,0,6,9,5,0,5,6,0,-1,-1,-1,-1],
  [0,3,8,5,6,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [10,5,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [11,5,10,7,5,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [11,5,10,11,7,5,8,3,0,-1,-1,-1,-1,-1,-1,-1],
  [5,11,7,5,10,11,1,9,0,-1,-1,-1,-1,-1,-1,-1],
  [10,7,5,10,11,7,9,8,1,8,3,1,-1,-1,-1,-1],
  [11,1,2,11,7,1,7,5,1,-1,-1,-1,-1,-1,-1,-1],
  [0,8,3,1,2,7,1,7,5,7,2,11,-1,-1,-1,-1],
  [9,7,5,9,2,7,9,0,2,2,11,7,-1,-1,-1,-1],
  [7,5,2,7,2,11,5,9,2,3,2,8,9,8,2,-1],
  [2,5,10,2,3,5,3,7,5,-1,-1,-1,-1,-1,-1,-1],
  [8,2,0,8,5,2,8,7,5,10,2,5,-1,-1,-1,-1],
  [9,0,1,5,10,3,5,3,7,3,10,2,-1,-1,-1,-1],
  [9,8,2,9,2,1,8,7,2,10,2,5,7,5,2,-1],
  [1,3,5,3,7,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [0,8,7,0,7,1,1,7,5,-1,-1,-1,-1,-1,-1,-1],
  [9,0,3,9,3,5,5,3,7,-1,-1,-1,-1,-1,-1,-1],
  [9,8,7,5,9,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [5,8,4,5,10,8,10,11,8,-1,-1,-1,-1,-1,-1,-1],
  [5,0,4,5,11,0,5,10,11,11,3,0,-1,-1,-1,-1],
  [0,1,9,8,4,10,8,10,11,10,4,5,-1,-1,-1,-1],
  [10,11,4,10,4,5,11,3,4,9,4,1,3,1,4,-1],
  [2,5,1,2,8,5,2,11,8,4,5,8,-1,-1,-1,-1],
  [0,4,11,0,11,3,4,5,11,2,11,1,5,1,11,-1],
  [0,2,5,0,5,9,2,11,5,4,5,8,11,8,5,-1],
  [9,4,5,2,11,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [2,5,10,3,5,2,3,4,5,3,8,4,-1,-1,-1,-1],
  [5,10,2,5,2,4,4,2,0,-1,-1,-1,-1,-1,-1,-1],
  [3,10,2,3,5,10,3,8,5,4,5,8,0,1,9,-1],
  [5,10,2,5,2,4,1,9,2,9,4,2,-1,-1,-1,-1],
  [8,4,5,8,5,3,3,5,1,-1,-1,-1,-1,-1,-1,-1],
  [0,4,5,1,0,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [8,4,5,8,5,3,9,0,5,0,3,5,-1,-1,-1,-1],
  [9,4,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [4,11,7,4,9,11,9,10,11,-1,-1,-1,-1,-1,-1,-1],
  [0,8,3,4,9,7,9,11,7,9,10,11,-1,-1,-1,-1],
  [1,10,11,1,11,4,1,4,0,7,4,11,-1,-1,-1,-1],
  [3,1,4,3,4,8,1,10,4,7,4,11,10,11,4,-1],
  [4,11,7,9,11,4,9,2,11,9,1,2,-1,-1,-1,-1],
  [9,7,4,9,11,7,9,1,11,2,11,1,0,8,3,-1],
  [11,7,4,11,4,2,2,4,0,-1,-1,-1,-1,-1,-1,-1],
  [11,7,4,11,4,2,8,3,4,3,2,4,-1,-1,-1,-1],
  [2,9,10,2,7,9,2,3,7,7,4,9,-1,-1,-1,-1],
  [9,10,7,9,7,4,10,2,7,8,7,0,2,0,7,-1],
  [3,7,10,3,10,2,7,4,10,1,10,0,4,0,10,-1],
  [1,10,2,8,7,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [4,9,1,4,1,7,7,1,3,-1,-1,-1,-1,-1,-1,-1],
  [4,9,1,4,1,7,0,8,1,8,7,1,-1,-1,-1,-1],
  [4,0,3,7,4,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [4,8,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [9,10,8,10,11,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [3,0,9,3,9,11,11,9,10,-1,-1,-1,-1,-1,-1,-1],
  [0,1,10,0,10,8,8,10,11,-1,-1,-1,-1,-1,-1,-1],
  [3,1,10,11,3,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [1,2,11,1,11,9,9,11,8,-1,-1,-1,-1,-1,-1,-1],
  [3,0,9,3,9,11,1,2,9,2,11,9,-1,-1,-1,-1],
  [0,2,11,8,0,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [3,2,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [2,3,8,2,8,10,10,8,9,-1,-1,-1,-1,-1,-1,-1],
  [9,10,2,0,9,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [2,3,8,2,8,10,0,1,8,1,10,8,-1,-1,-1,-1],
  [1,10,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [1,3,8,9,1,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [0,9,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [0,3,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
  [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
];

export interface OfflineImageItem {
  key: string;
  url: string;
  data: Blob;
  timestamp: number;
  expires: number;
  size: {
    width: number;
    height: number;
  };
}

export interface OfflineCacheConfig {
  maxStorageSize: number;
  defaultExpiry: number;
  cleanupInterval: number;
}

class BlobUrlManager {
  private blobUrls: Map<string, string> = new Map();

  createUrl(key: string, blob: Blob): string {
    this.revokeUrl(key);
    const url = URL.createObjectURL(blob);
    this.blobUrls.set(key, url);
    return url;
  }

  getUrl(key: string): string | undefined {
    return this.blobUrls.get(key);
  }

  revokeUrl(key: string): void {
    const url = this.blobUrls.get(key);
    if (url) {
      URL.revokeObjectURL(url);
      this.blobUrls.delete(key);
    }
  }

  revokeAll(): void {
    for (const url of this.blobUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.blobUrls.clear();
  }

  getSize(): number {
    return this.blobUrls.size;
  }
}

export const blobUrlManager = new BlobUrlManager();

export class ImageOfflineCache {
  private dbName = 'ImageCacheDB';
  private storeName = 'images';
  private db: IDBDatabase | null = null;
  private config: OfflineCacheConfig;
  private cleanupIntervalId: number | null = null;

  constructor(config: Partial<OfflineCacheConfig> = {}) {
    this.config = {
      maxStorageSize: config.maxStorageSize || 50 * 1024 * 1024,
      defaultExpiry: config.defaultExpiry || 7 * 24 * 60 * 60 * 1000,
      cleanupInterval: config.cleanupInterval || 60000,
      ...config
    } as OfflineCacheConfig;
    this.startCleanupInterval();
  }

  private async openDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('expires', 'expires', { unique: false });
        }
      };
    });
  }

  async addImage(key: string, url: string, data: Blob, size?: { width: number; height: number }): Promise<void> {
    const db = await this.openDB();
    
    await this.checkStorageLimit(data.size);

    const item: OfflineImageItem = {
      key,
      url,
      data,
      timestamp: Date.now(),
      expires: Date.now() + this.config.defaultExpiry,
      size: size || { width: 0, height: 0 }
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getImage(key: string): Promise<OfflineImageItem | null> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        const item = request.result as OfflineImageItem | undefined;
        if (!item) {
          resolve(null);
          return;
        }

        if (Date.now() > item.expires) {
          this.removeImage(key);
          resolve(null);
          return;
        }

        resolve(item);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async removeImage(key: string): Promise<void> {
    blobUrlManager.revokeUrl(key);
    
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearExpired(): Promise<number> {
    const db = await this.openDB();
    const now = Date.now();
    let removedCount = 0;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('expires');
      const request = index.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const item = cursor.value as OfflineImageItem;
          if (now > item.expires) {
            blobUrlManager.revokeUrl(item.key);
            cursor.delete();
            removedCount++;
          }
          cursor.continue();
        } else {
          resolve(removedCount);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getTotalSize(): Promise<number> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      let totalSize = 0;

      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const item = cursor.value as OfflineImageItem;
          totalSize += item.data.size;
          cursor.continue();
        } else {
          resolve(totalSize);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async checkStorageLimit(newImageSize: number = 0): Promise<void> {
    const currentSize = await this.getTotalSize();
    if (currentSize + newImageSize >= this.config.maxStorageSize) {
      await this.clearOldestImages(20);
    }
  }

  async clearOldestImages(percentage: number): Promise<number> {
    const db = await this.openDB();
    const items: Array<{ key: string; timestamp: number }> = [];

    await new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const item = cursor.value as OfflineImageItem;
          items.push({ key: item.key, timestamp: item.timestamp });
          cursor.continue();
        } else {
          resolve(undefined);
        }
      };

      request.onerror = () => reject(request.error);
    });

    items.sort((a, b) => a.timestamp - b.timestamp);
    const count = Math.ceil((items.length * percentage) / 100);
    const toRemove = items.slice(0, count);

    for (const item of toRemove) {
      blobUrlManager.revokeUrl(item.key);
      await this.removeImage(item.key);
    }

    return toRemove.length;
  }

  getBlobUrl(key: string, blob: Blob): string {
    return blobUrlManager.createUrl(key, blob);
  }

  revokeBlobUrl(key: string): void {
    blobUrlManager.revokeUrl(key);
  }

  async downloadAndCache(url: string, cacheKey: string): Promise<string | null> {
    let tempBlobUrl: string | null = null;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error('下载图片失败:', response.status);
        return null;
      }

      const blob = await response.blob();
      const img = new Image();
      
      return new Promise((resolve) => {
        img.onload = async () => {
          try {
            await this.addImage(cacheKey, url, blob, {
              width: img.width,
              height: img.height
            });
            const localUrl = blobUrlManager.createUrl(cacheKey, blob);
            resolve(localUrl);
          } catch (addError) {
            console.error('存储到IndexedDB失败:', addError);
            const localUrl = blobUrlManager.createUrl(cacheKey, blob);
            resolve(localUrl);
          }
        };

        img.onerror = async () => {
          console.warn('图片加载验证失败，但仍然缓存');
          try {
            await this.addImage(cacheKey, url, blob);
            const localUrl = blobUrlManager.createUrl(cacheKey, blob);
            resolve(localUrl);
          } catch (addError) {
            console.error('存储到IndexedDB失败:', addError);
            const localUrl = blobUrlManager.createUrl(cacheKey, blob);
            resolve(localUrl);
          }
        };

        tempBlobUrl = URL.createObjectURL(blob);
        img.src = tempBlobUrl;
      });
    } catch (error) {
      console.error('下载图片异常:', error);
      if (tempBlobUrl) {
        URL.revokeObjectURL(tempBlobUrl);
      }
      return null;
    }
  }

  async getCachedOrDownload(url: string, cacheKey: string): Promise<string> {
    const cached = await this.getImage(cacheKey);
    
    if (cached) {
      return blobUrlManager.createUrl(cacheKey, cached.data);
    }

    const downloadedUrl = await this.downloadAndCache(url, cacheKey);
    if (downloadedUrl) {
      return downloadedUrl;
    }

    return url;
  }

  async clearAll(): Promise<void> {
    blobUrlManager.revokeAll();
    
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getStats(): Promise<{ total: number; size: number; expired: number }> {
    const db = await this.openDB();
    const now = Date.now();
    let total = 0;
    let size = 0;
    let expired = 0;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const item = cursor.value as OfflineImageItem;
          total++;
          size += item.data.size;
          if (now > item.expires) {
            expired++;
          }
          cursor.continue();
        } else {
          resolve({ total, size, expired });
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  private startCleanupInterval(): void {
    this.cleanupIntervalId = window.setInterval(async () => {
      await this.clearExpired();
    }, this.config.cleanupInterval);
  }

  stopCleanup(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }

  destroy(): void {
    this.stopCleanup();
    blobUrlManager.revokeAll();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const imageOfflineCache = new ImageOfflineCache({
  maxStorageSize: 50 * 1024 * 1024,
  defaultExpiry: 7 * 24 * 60 * 60 * 1000,
  cleanupInterval: 60000
});

export const downloadAndCacheImage = async (url: string, cacheKey: string): Promise<string | null> => {
  return imageOfflineCache.downloadAndCache(url, cacheKey);
};

export const getCachedImageUrl = async (cacheKey: string): Promise<string | null> => {
  const cached = await imageOfflineCache.getImage(cacheKey);
  if (cached) {
    return blobUrlManager.createUrl(cacheKey, cached.data);
  }
  return null;
};

export const getOfflineImageStats = async (): Promise<{ total: number; size: number; expired: number }> => {
  return imageOfflineCache.getStats();
};

export const clearOfflineCache = async (): Promise<void> => {
  return imageOfflineCache.clearAll();
};

export const revokeOfflineBlobUrl = (cacheKey: string): void => {
  blobUrlManager.revokeUrl(cacheKey);
};
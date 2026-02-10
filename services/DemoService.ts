import { db } from '../db';
import { SettingsService } from './SettingsService';
import { supabase } from '../supabase';

type DemoRole = 'admin' | 'manager' | 'staff';

const LS = {
  enabled: 'nepos_demo_enabled',
  role: 'nepos_demo_role',
  startedAt: 'nepos_demo_started_at',
  expiresAt: 'nepos_demo_expires_at',
  syncEnabled: 'nepos_demo_sync_enabled',
  syncRequestId: 'nepos_demo_sync_request_id',
} as const;

export type DemoInfo = {
  enabled: boolean;
  role: DemoRole;
  startedAt: string;
  expiresAt: string;
  daysLeft: number;
  shouldWarn: boolean;
  isExpired: boolean;
  syncRequested: boolean;
  syncEnabled: boolean;
};

const daysBetween = (from: Date, to: Date) => {
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

export class DemoService {
  static isDemo(): boolean {
    return localStorage.getItem(LS.enabled) === '1';
  }

  static getDemoRole(): DemoRole {
    const r = (localStorage.getItem(LS.role) || 'staff') as DemoRole;
    return (r === 'admin' || r === 'manager' || r === 'staff') ? r : 'staff';
  }

  static isSyncEnabled(): boolean {
    return localStorage.getItem(LS.syncEnabled) === '1';
  }

  static getSyncRequestId(): string | null {
    return localStorage.getItem(LS.syncRequestId);
  }

  static ensureDemoLifecycle(role: DemoRole) {
    const now = new Date();
    const existingStarted = localStorage.getItem(LS.startedAt);
    const existingExpires = localStorage.getItem(LS.expiresAt);
    if (!existingStarted || !existingExpires) {
      const startedAt = now.toISOString();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      localStorage.setItem(LS.startedAt, startedAt);
      localStorage.setItem(LS.expiresAt, expiresAt);
    }
    localStorage.setItem(LS.enabled, '1');
    localStorage.setItem(LS.role, role);
  }

  static getInfo(): DemoInfo {
    const enabled = DemoService.isDemo();
    const role = DemoService.getDemoRole();
    const startedAt = localStorage.getItem(LS.startedAt) || new Date().toISOString();
    const expiresAt = localStorage.getItem(LS.expiresAt) || new Date().toISOString();
    const now = new Date();
    const exp = new Date(expiresAt);
    const daysLeft = daysBetween(now, exp);
    const isExpired = enabled && (exp.getTime() <= now.getTime());
    const shouldWarn = enabled && !isExpired && daysLeft <= 5;
    const syncRequested = !!DemoService.getSyncRequestId();
    const syncEnabled = DemoService.isSyncEnabled();
    return { enabled, role, startedAt, expiresAt, daysLeft: Math.max(0, daysLeft), shouldWarn, isExpired, syncRequested, syncEnabled };
  }

  static async wipeLocalDemoData() {
    try {
      await db.delete();
    } catch (e) {
      console.warn('[DEMO] db.delete failed', e);
    }

    // clear demo flags
    Object.values(LS).forEach((k) => localStorage.removeItem(k));
  }

  static async enforceExpiry(): Promise<{ expired: boolean }>{
    const info = DemoService.getInfo();
    if (info.enabled && info.isExpired) {
      await DemoService.wipeLocalDemoData();
      return { expired: true };
    }
    return { expired: false };
  }

  static async seedDemoTablesIfEmpty() {
    if (!DemoService.isDemo()) return;
    const count = await db.pos_tables.count();
    if (count > 0) return;

    // 12 tables laid out in a visible grid (percent-based coordinates)
    const tables: any[] = [];
    const cols = 4;
    const rows = 3;
    const startX = 14;
    const startY = 16;
    const gapX = 18;
    const gapY = 20;
    let idx = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        tables.push({
          id: `T${idx}`,
          label: `Bàn ${idx}`,
          status: 'Available',
          shape: 'square',
          x: startX + c * gapX,
          y: startY + r * gapY,
          width: 100,
          height: 100,
          seats: 4,
        });
        idx++;
      }
    }

    // Takeaway table for ordering
    tables.push({
      id: 'Takeaway',
      label: 'Takeaway',
      status: 'Available',
      shape: 'rectangle',
      x: 78,
      y: 78,
      width: 130,
      height: 90,
      seats: 0,
    });

    await db.pos_tables.bulkAdd(tables);
  }

  static async startDemo(role: DemoRole) {
    DemoService.ensureDemoLifecycle(role);
    await DemoService.seedDemoTablesIfEmpty();
  }

  /**
   * Send one request to server to register this device for sync.
   * We store returned id locally, but we DO NOT display it in UI.
   */
  static async requestSyncOnce(): Promise<{ ok: boolean; message?: string }>{
    if (DemoService.getSyncRequestId()) {
      return { ok: true, message: 'Đã gửi yêu cầu trước đó.' };
    }
    if (!navigator.onLine) return { ok: false, message: 'Đang offline, không thể gửi yêu cầu.' };

    const deviceId = SettingsService.getDeviceId();
    try {
      const { data, error } = await supabase
        .from('demo_codes')
        .insert([{ device_id: deviceId, status: 'pending', requested_at: new Date().toISOString() }])
        .select('id')
        .single();
      if (error) throw error;
      if (!data?.id) return { ok: false, message: 'Không nhận được ID từ server.' };
      localStorage.setItem(LS.syncRequestId, String(data.id));
      return { ok: true };
    } catch (e: any) {
      console.error('[DEMO] requestSyncOnce error', e);
      return { ok: false, message: e?.message || 'Gửi yêu cầu thất bại.' };
    }
  }

  static enableSyncWithId(inputId: string): { ok: boolean; message?: string } {
    const code = (inputId || '').trim();
    if (!code) return { ok: false, message: 'Vui lòng nhập ID.' };
    const expected = DemoService.getSyncRequestId();
    if (!expected) return { ok: false, message: 'Chưa có yêu cầu đồng bộ. Vui lòng bấm “YÊU CẦU ĐỒNG BỘ” trước.' };
    if (code !== expected) return { ok: false, message: 'ID không đúng. Vui lòng kiểm tra lại.' };
    localStorage.setItem(LS.syncEnabled, '1');
    return { ok: true };
  }
}

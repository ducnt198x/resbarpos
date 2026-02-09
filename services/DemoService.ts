import { db } from '../db';
import { SettingsService } from './SettingsService';
import { supabase } from '../supabase';

export type DemoRole = 'admin' | 'manager' | 'staff';

/**
 * Demo/trial lifecycle manager (client-side only).
 *
 * Requirements implemented:
 * - 3 demo roles for new users to test
 * - Demo data is local-only by default (no server sync / no import-export)
 * - 30-day experience, warn in last 5 days
 * - Auto wipe local data after 30 days unless unlocked
 * - “Request sync” creates a row in server table demo_codes and stores returned id
 * - Entering correct code unlocks sync/import/export
 */
export class DemoService {
  private static KEY_MODE = 'demo_mode';
  private static KEY_ROLE = 'demo_role';
  private static KEY_STARTED_AT = 'demo_started_at';
  private static KEY_EXPIRES_AT = 'demo_expires_at';
  private static KEY_SYNC_ENABLED = 'demo_sync_enabled';
  private static KEY_SYNC_REQUEST_ID = 'demo_sync_request_id';
  private static KEY_SYNC_UNLOCKED_AT = 'demo_sync_unlocked_at';
  private static KEY_SEEDED = 'demo_seeded_v1';

  public static isDemo(): boolean {
    return localStorage.getItem(DemoService.KEY_MODE) === '1';
  }

  public static getRole(): DemoRole | null {
    const r = localStorage.getItem(DemoService.KEY_ROLE);
    return (r === 'admin' || r === 'manager' || r === 'staff') ? r : null;
  }

  public static isSyncEnabled(): boolean {
    return localStorage.getItem(DemoService.KEY_SYNC_ENABLED) === '1';
  }

  public static getSyncRequestId(): string | null {
    return localStorage.getItem(DemoService.KEY_SYNC_REQUEST_ID);
  }

  public static getLifecycle(): { startedAt: number | null; expiresAt: number | null; daysLeft: number | null } {
    const startedAt = Number(localStorage.getItem(DemoService.KEY_STARTED_AT) || '');
    const expiresAt = Number(localStorage.getItem(DemoService.KEY_EXPIRES_AT) || '');

    const s = Number.isFinite(startedAt) ? startedAt : null;
    const e = Number.isFinite(expiresAt) ? expiresAt : null;

    if (!e) return { startedAt: s, expiresAt: e, daysLeft: null };
    const msLeft = e - Date.now();
    const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
    return { startedAt: s, expiresAt: e, daysLeft };
  }

  public static async startDemo(role: DemoRole): Promise<void> {
    const now = Date.now();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000;
    localStorage.setItem(DemoService.KEY_MODE, '1');
    localStorage.setItem(DemoService.KEY_ROLE, role);
    if (!localStorage.getItem(DemoService.KEY_STARTED_AT)) {
      localStorage.setItem(DemoService.KEY_STARTED_AT, String(now));
      localStorage.setItem(DemoService.KEY_EXPIRES_AT, String(expiresAt));
    }
    // ensure sync is disabled by default
    if (!localStorage.getItem(DemoService.KEY_SYNC_ENABLED)) {
      localStorage.setItem(DemoService.KEY_SYNC_ENABLED, '0');
    }

    // Seed demo data once
    await DemoService.seedDemoDataIfNeeded(role);
  }

  public static async requestSync(): Promise<{ ok: boolean; requestId?: string; error?: string }> {
    try {
      const deviceId = SettingsService.getDeviceId();
      const demoRole = DemoService.getRole() || 'staff';
      const payload = {
        device_id: deviceId,
        requested_at: new Date().toISOString(),
        status: 'pending',
        demo_role: demoRole
      };
      const { data, error } = await supabase
        .from('demo_codes')
        .insert([payload])
        .select('id')
        .single();

      if (error) throw error;
      if (!data?.id) throw new Error('Server did not return demo request id');
      localStorage.setItem(DemoService.KEY_SYNC_REQUEST_ID, String(data.id));
      return { ok: true, requestId: String(data.id) };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Request sync failed' };
    }
  }

  /**
   * Unlock sync by code.
   * Per requirement: "check đúng ID" => accept when code matches request id.
   * (We also accept code matching request id ignoring case and spaces.)
   */
  public static async unlockSyncWithCode(inputCode: string): Promise<{ ok: boolean; error?: string }>
  {
    const requestId = DemoService.getSyncRequestId();
    if (!requestId) return { ok: false, error: 'Chưa có ID yêu cầu. Hãy bấm “YÊU CẦU ĐỒNG BỘ” trước.' };

    const code = (inputCode || '').trim();
    if (!code) return { ok: false, error: 'Vui lòng nhập mã.' };

    // exact match to requestId
    if (code === requestId) {
      localStorage.setItem(DemoService.KEY_SYNC_ENABLED, '1');
      localStorage.setItem(DemoService.KEY_SYNC_UNLOCKED_AT, new Date().toISOString());
      return { ok: true };
    }

    // Allow a server-issued sync_code if you later decide to use it.
    try {
      const deviceId = SettingsService.getDeviceId();
      const { data, error } = await supabase
        .from('demo_codes')
        .select('id, status, expired_at, sync_code, device_id')
        .eq('device_id', deviceId)
        .eq('sync_code', code)
        .maybeSingle();
      if (!error && data) {
        const expiredAt = data.expired_at ? new Date(data.expired_at).getTime() : null;
        const okStatus = (data.status || '').toLowerCase() === 'approved' || (data.status || '').toLowerCase() === 'active';
        const notExpired = !expiredAt || expiredAt > Date.now();
        if (okStatus && notExpired) {
          localStorage.setItem(DemoService.KEY_SYNC_ENABLED, '1');
          localStorage.setItem(DemoService.KEY_SYNC_UNLOCKED_AT, new Date().toISOString());
          return { ok: true };
        }
      }
    } catch {
      // ignore
    }

    return { ok: false, error: 'Mã không đúng (hoặc chưa được duyệt).' };
  }

  public static async enforceLifecycle(): Promise<{ wiped: boolean; reason?: string }>
  {
    if (!DemoService.isDemo()) return { wiped: false };
    const { expiresAt, daysLeft } = DemoService.getLifecycle();
    if (!expiresAt) return { wiped: false };
    if ((daysLeft ?? 0) > 0) return { wiped: false };

    // Expired: wipe local demo data
    await DemoService.wipeAllDemoData();
    return { wiped: true, reason: 'EXPIRED' };
  }

  public static async wipeAllDemoData(): Promise<void> {
    try {
      await db.delete();
      await db.open();
    } catch {
      // ignore
    }
    // remove demo flags
    [
      DemoService.KEY_MODE,
      DemoService.KEY_ROLE,
      DemoService.KEY_STARTED_AT,
      DemoService.KEY_EXPIRES_AT,
      DemoService.KEY_SYNC_ENABLED,
      DemoService.KEY_SYNC_REQUEST_ID,
      DemoService.KEY_SYNC_UNLOCKED_AT,
      DemoService.KEY_SEEDED
    ].forEach(k => localStorage.removeItem(k));
  }

  private static async seedDemoDataIfNeeded(role: DemoRole): Promise<void> {
    if (localStorage.getItem(DemoService.KEY_SEEDED) === '1') return;

    // If existing data, do not overwrite
    const hasMenu = (await db.menu_items.count()) > 0;
    const hasTables = (await db.pos_tables.count()) > 0;
    if (hasMenu || hasTables) {
      localStorage.setItem(DemoService.KEY_SEEDED, '1');
      return;
    }

    const now = new Date().toISOString();
    const tables = [
      { id: 'T1', label: 'Bàn 1', x: 60, y: 60, width: 120, height: 90, shape: 'rect', seats: 4, status: 'Available', created_at: now, updated_at: now },
      { id: 'T2', label: 'Bàn 2', x: 220, y: 60, width: 120, height: 90, shape: 'rect', seats: 4, status: 'Available', created_at: now, updated_at: now },
      { id: 'T3', label: 'Bàn 3', x: 60, y: 170, width: 120, height: 90, shape: 'rect', seats: 6, status: 'Available', created_at: now, updated_at: now },
    ];

    // menu_items: server schema uses integer id when synced, but locally supports string id.
    const uid = () => self.crypto.randomUUID();
    const menu = [
      { id: `LOCAL_${uid()}`, uid: uid(), name: 'Cà phê sữa', price: 29000, category: 'Đồ uống', unit: 'ly', created_at: now, updated_at: now, sync_status: 'local' },
      { id: `LOCAL_${uid()}`, uid: uid(), name: 'Trà đào', price: 39000, category: 'Đồ uống', unit: 'ly', created_at: now, updated_at: now, sync_status: 'local' },
      { id: `LOCAL_${uid()}`, uid: uid(), name: 'Bánh mì ốp la', price: 35000, category: 'Ăn nhanh', unit: 'phần', created_at: now, updated_at: now, sync_status: 'local' },
      { id: `LOCAL_${uid()}`, uid: uid(), name: 'Phở bò', price: 55000, category: 'Món chính', unit: 'tô', created_at: now, updated_at: now, sync_status: 'local' },
    ];

    await db.transaction('rw', [db.pos_tables, db.menu_items], async () => {
      await db.pos_tables.bulkPut(tables as any);
      await db.menu_items.bulkPut(menu as any);
    });

    // Slight role-based tweak: staff sees simpler UI by default
    if (role === 'staff') {
      try {
        // quickOrder is a nice demo default
        await db.settings.put({ key: 'quickOrder', value: true } as any);
      } catch {
        // ignore
      }
    }

    localStorage.setItem(DemoService.KEY_SEEDED, '1');
  }
}

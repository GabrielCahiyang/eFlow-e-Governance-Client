import { beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ session: vi.fn(), sign: vi.fn() }));
vi.mock('../../src/lib/supabase', () => ({ supabase: {
  auth: { getSession: api.session }, storage: { from: () => ({ createSignedUrl: api.sign }) },
} }));
import { getProfileAvatarUrl } from '../../src/app/services/userSettingsService';
beforeEach(() => {
  vi.clearAllMocks();
  api.session.mockResolvedValue({ data: { session: { user: { id: 'owner' } } }, error: null });
  api.sign.mockResolvedValue({ data: { signedUrl: 'https://example.invalid/signed' }, error: null });
});
describe('private avatar access', () => {
  it('uses initials for another participant without a denied Storage request', async () => {
    expect(await getProfileAvatarUrl('other-person/avatar.jpg')).toBeNull();
    expect(api.sign).not.toHaveBeenCalled();
  });
  it('signs the current owner photo with the existing expiration', async () => {
    expect(await getProfileAvatarUrl('owner/avatar.jpg')).toBe('https://example.invalid/signed');
    expect(api.sign).toHaveBeenCalledExactlyOnceWith('owner/avatar.jpg', 3600);
  });
  it('makes no Storage request for an empty path or signed-out session', async () => {
    expect(await getProfileAvatarUrl(null)).toBeNull();
    expect(api.session).not.toHaveBeenCalled();
    api.session.mockResolvedValue({ data: { session: null }, error: null });
    expect(await getProfileAvatarUrl('owner/avatar.jpg')).toBeNull();
    expect(api.sign).not.toHaveBeenCalled();
  });
  it('retains errors for a failed authorized owner request', async () => {
    const error = { message: 'Storage unavailable' };
    api.sign.mockResolvedValue({ data: null, error });
    await expect(getProfileAvatarUrl('owner/avatar.jpg')).rejects.toEqual(error);
  });
});

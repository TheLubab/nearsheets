import { afterEach,describe,expect,it,vi } from 'vitest';
import { cookieAuthApi,createServiceAuth } from '../src/features/auth/session';
import type { AuthPorts } from '../src/features/auth/session';
const session={accountId:'alice.testnet',network:'testnet' as const,expiresAt:'2099-01-01T00:00:00Z'};
function ports():AuthPorts {return {challenge:vi.fn(async()=>({payload:'server challenge'})),authorize:vi.fn(async()=>({accountId:'alice.testnet',authorization:'NEP-641 blob'})),login:vi.fn(async()=>session),me:vi.fn(async()=>session),logout:vi.fn(async()=>{})};}
afterEach(()=>vi.useRealTimers());
describe('server verified service session',()=>{
 it('keeps optional auth unavailable without blocking local wallet use',()=>{const auth=createServiceAuth(null);expect(auth.getState().status).toBe('unavailable');auth.dispose();});
 it('authorizes a server challenge before accepting a matching server session',async()=>{
  const api=ports(),auth=createServiceAuth(api);await auth.login('alice.testnet','testnet');
  expect(api.authorize).toHaveBeenCalledWith('server challenge','testnet');expect(api.login).toHaveBeenCalledWith({accountId:'alice.testnet',authorization:'NEP-641 blob',network:'testnet'});
  expect(auth.getState().status).toBe('authenticated');await auth.logout();expect(api.logout).toHaveBeenCalledOnce();expect(auth.getState().session).toBeNull();auth.dispose();
 });
 it('restores only server state and handles expiry',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-11T12:00:00Z'));
  const api=ports();api.me=async()=>({...session,expiresAt:'2026-11-11T12:00:01Z'});
  const auth=createServiceAuth(api);await auth.restore();expect(auth.getState().status).toBe('authenticated');
  await vi.advanceTimersByTimeAsync(1001);expect(auth.getState().status).toBe('anonymous');auth.dispose();
 });
 it('recovers from cancellation and refuses account/network mismatches',async()=>{
  const api=ports();api.authorize=async()=>{throw new Error('User rejected');};const auth=createServiceAuth(api);
  await auth.login('alice.testnet','testnet');expect(auth.getState().status).toBe('anonymous');expect(api.login).not.toHaveBeenCalled();
  api.authorize=async()=>({accountId:'other.testnet',authorization:'blob'});await auth.login('alice.testnet','testnet');expect(auth.getState().error).toMatch(/account changed/);
  api.authorize=async()=>({accountId:'alice.testnet',authorization:'blob'});api.login=async()=>({...session,network:'mainnet'});await auth.login('alice.testnet','testnet');expect(auth.getState().error).toMatch(/does not match/);auth.dispose();
 });
 it('supersedes a late restore after logout',async()=>{
  let resolve!:(value:typeof session)=>void;const api=ports();api.me=()=>new Promise(r=>{resolve=r;});const auth=createServiceAuth(api);
  const pending=auth.restore();await auth.logout();resolve(session);await pending;expect(auth.getState().status).toBe('anonymous');auth.dispose();
 });
 it('uses credentialed requests and treats expired server sessions as anonymous',async()=>{
  const request=vi.fn<typeof fetch>(async()=>new Response(null,{status:401}));
  const api=cookieAuthApi('https://auth.invalid',async()=>({accountId:'alice.testnet',authorization:'blob'}),request);
  expect(await api.me()).toBeNull();expect(request).toHaveBeenCalledWith('https://auth.invalid/auth/me',expect.objectContaining({credentials:'include',cache:'no-store'}));
 });
});

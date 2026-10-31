import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createPinia, setActivePinia } from 'pinia';

// Exercise the real store/API code without spawning Vite/esbuild processes.
const moduleUrl = (source) => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const compile = (file) => ts.transpileModule(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const apiUrl = moduleUrl(compile('src/lib/api.ts').replace('import.meta.env.VITE_API_BASE_URL', JSON.stringify('http://localhost:5000')));
let storeSource = compile('src/stores/auth.ts');
for (const [name, url] of [['vue', import.meta.resolve('vue')], ['pinia', import.meta.resolve('pinia')], ['@/lib/api', apiUrl]]) storeSource = storeSource.replaceAll(`from '${name}'`, `from '${url}'`);
const { useAuthStore } = await import(moduleUrl(storeSource));
const { canVisit } = await import(moduleUrl(compile('src/lib/access.ts')));
const api = await import(apiUrl);
const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
globalThis.window = new EventTarget();

test('Role cache, route/action permissions, 403 vs 401, obsolete sessions and logout', async () => {
  const originalFetch = globalThis.fetch;
  setActivePinia(createPinia());
  const auth = useAuthStore();
  const permission = { is_read: true, is_create: false, is_update: false, is_delete: false, is_print: false };
  const user = { id: 'u1', name: 'Worker', username: 'worker', is_active: true, role: { id: 'r1', nama_role: 'Karyawan', system_key: null, is_active: true }, menus: [{id:'m1', name:'Work',path:'/work',seq:'1',icon:null,modul:null,sub_modul:null}], permissions: {m1: permission} };
  try {
    auth.login('token', user);
    assert.equal(auth.isAuthenticated, true);
    assert.equal(auth.hasPermission('m1', 'read'), true);
    assert.equal(auth.hasPermission('m1', 'create'), false);
    assert.equal(canVisit(user, '/work', 'Work', false), true);
    assert.equal(canVisit(user, '/work-other', 'Work', false), false);
    assert.equal(canVisit(user, '/work/form', 'WorkForm', false), false);
    assert.equal(canVisit(user, '/work/form/1', 'WorkForm', true), false);
    assert.equal(canVisit(user, '/setup/user_default', 'UserDefault', false), false);
    assert.equal(canVisit(user, '/setup/menu', 'Menu', false, true), false);
    assert.equal(canVisit(user, '/', 'Dashboard', false), true);
    const allowed = {...user, permissions:{m1:{...permission,is_create:true}}};
    globalThis.fetch = async () => new Response(JSON.stringify({status:'success',data:allowed}),{status:200});
    await auth.refreshUserData();
    assert.equal(auth.hasPermission('m1','create'),true);
    assert.equal(JSON.parse(localStorage.getItem('SelectRespo')).permissions.m1.is_create,true);
    let expired = 0;
    api.setTokenExpiredCallback(() => { expired++; });
    globalThis.fetch = async () => new Response(JSON.stringify({status:'error',message:'Forbidden'}),{status:403});
    await assert.rejects(api.apiCall('/dynamic/m_menu'), error => error.statusCode === 403);
    assert.equal(expired,0);
    assert.equal(auth.isAuthenticated,true);
    globalThis.fetch = async () => new Response(JSON.stringify({status:'error',message:'Expired'}),{status:401});
    await assert.rejects(auth.refreshUserData());
    assert.equal(auth.isAuthenticated,false);
    assert.equal(expired,1);
    localStorage.setItem('auth_bb',JSON.stringify({token:'legacy',user:{id:'u1'}}));
    assert.equal(auth.checkAuth(),false);
    auth.login('token',user);
    globalThis.fetch = async () => new Response(JSON.stringify({status:'success'}),{status:200});
    await auth.logoutWithServer();
    assert.equal(auth.isAuthenticated,false);
    assert.equal(localStorage.getItem('SelectRespo'),null);
  } finally { globalThis.fetch = originalFetch; storage.clear(); }
});

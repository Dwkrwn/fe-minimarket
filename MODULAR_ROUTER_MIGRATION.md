# 🎉 Modular Router System - Migration Guide

## 📊 Perubahan Besar

File router lama (1,429 baris) telah di-refactor menjadi **5 file modular** dengan total 671 baris.

### File Structure Baru

```
src/router/
├── index.ts              (249 lines) - Main router + navigation guards
├── helpers.ts            (125 lines) - Helper functions untuk generate routes
├── notifications.ts       (73 lines) - Notification routes
├── crud-routes.ts        (207 lines) - Auto-generated CRUD routes
├── special-routes.ts      (17 lines) - Special non-CRUD routes
└── index.ts.backup      (1429 lines) - Backup file lama
```

### Pengurangan Code

- **Main Router**: 1,429 → 249 baris (**-82.6%**)
- **Net Total**: 1,429 → 671 baris (**-53%**)
- **Lebih modular**: 1 file → 5 files

## 🔧 Cara Kerja add_route.cjs

Script `add_route.cjs` sekarang otomatis menambahkan routes ke file yang tepat:

### 1. CRUD Routes (Landing, Form, View)

Untuk module dengan pattern CRUD standard, route akan ditambahkan ke **`crud-routes.ts`**:

```bash
node add_route.cjs setup/m_new_module
```

Script akan menambahkan config di `crud-routes.ts`:
```typescript
{
  path: '/setup/m_new_module',
  name: 'NewModule',
  title: 'New Module',
  basePath: '/setup/m_new_module',
}
```

Yang secara otomatis generate 3 routes:
- Landing: `/setup/m_new_module`
- Form: `/setup/m_new_module/form/:id?`
- View: `/setup/m_new_module/view/:id`

### 2. Notification Routes

Jika module menggunakan **approval workflow**, script akan menambahkan ke **`notifications.ts`**:

```typescript
{
  path: 'new_module',
  name: 'NotifikasiNewModuleDetail',
  component: 'NotifikasiNewModuleDetail.vue',
  title: 'Notifikasi New Module',
}
```

Yang akan generate route:
- `/notifikasi/new_module/:id`

### 3. Special Routes

Untuk route yang tidak follow CRUD pattern (misalnya hanya landing page tanpa form), gunakan function `addSpecialRoute()` di script.

## ✅ Keuntungan Sistem Baru

1. **Mudah Maintenance**
   - Setiap module type di file terpisah
   - Lebih mudah mencari dan update routes

2. **Auto-Generation**
   - CRUD routes di-generate otomatis dari config
   - Tidak perlu copy-paste 3 route objects lagi

3. **Type-Safe**
   - Helper functions dengan TypeScript
   - Compile-time error checking

4. **DRY Principle**
   - Tidak ada duplikasi kode repetitif
   - Route pattern di-define sekali di helpers

5. **Scalable**
   - Mudah menambahkan route baru
   - Mudah menambahkan route type baru

## 📝 Manual Route Addition

### Tambah CRUD Routes Manual

Edit `crud-routes.ts` dan tambahkan config:

```typescript
const crudRoutesConfig = [
  // ... existing configs
  {
    path: '/your/path',
    name: 'YourModule',
    title: 'Your Module',
    basePath: '/your/path',
  },
]
```

### Tambah Notification Routes Manual

Edit `notifications.ts` di array `generateNotificationRoutes()`:

```typescript
...generateNotificationRoutes([
  // ... existing routes
  {
    path: 'your_module',
    name: 'NotifikasiYourModuleDetail',
    component: 'NotifikasiYourModuleDetail.vue',
    title: 'Notifikasi Your Module',
  },
]),
```

### Tambah Special Routes Manual

Edit `special-routes.ts`:

```typescript
export const specialRoutes: RouteRecordRaw[] = [
  // ... existing routes
  {
    path: '/your/special/path',
    name: 'YourSpecial',
    component: () => import('@/views/your/path/YourSpecialLanding.vue'),
    meta: {
      title: 'Your Special Page',
      requiresAuth: true,
    },
  },
]
```

## 🔄 Rollback Instructions

Jika ada masalah, restore backup:

```powershell
# Backup file baru
Copy-Item "src\router\index.ts" "src\router\index.new.ts"

# Restore file lama
Copy-Item "src\router\index.ts.backup" "src\router\index.ts"

# Delete modular files (opsional)
Remove-Item "src\router\helpers.ts"
Remove-Item "src\router\notifications.ts"
Remove-Item "src\router\crud-routes.ts"
Remove-Item "src\router\special-routes.ts"
```

## 🧪 Testing

Setelah migration, pastikan:

1. ✅ Aplikasi bisa compile tanpa error
2. ✅ Semua routes masih bisa diakses
3. ✅ Navigation guards masih bekerja (auth, permissions)
4. ✅ Script `add_route.cjs` bisa menambahkan route baru

```powershell
# Test compile
npm run build

# Test dev server
npm run dev

# Test add route
node add_route.cjs dev/test_module
```

## 📚 Related Files

- `ADD_ROUTE_README.md` - Full documentation untuk add_route.cjs
- `QUICK_START.md` - Quick start guide
- `src/router/index.ts.backup` - Backup of original router

## 🎯 Next Steps

1. Update team documentation
2. Test dengan environment production
3. Monitor for any routing issues
4. Consider creating automated tests for routes

---

**Status**: ✅ Completed  
**Date**: January 27, 2026  
**Impact**: High (Architecture Change)  
**Backward Compatible**: Yes (semua routes tetap sama)

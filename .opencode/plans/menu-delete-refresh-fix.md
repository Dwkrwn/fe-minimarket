# Problem: menu deletion requires manual refresh to reflect

## Root cause
When deleting from the setup menu list, the code only removes the item from `menuData` (paginated list). If the user is viewing a filtered tab (by `modul`) or if `filteredData` is reading from `allMenuData`, the deleted item remains in `allMenuData` and stays visible until `handleRefresh()` reloads both lists. Also the delete flow doesn't update `allMenuData` at all.

## Solution
In `src/views/setup/menu/MenuLanding.vue` `confirmDelete()`, also filter out the deleted item from `allMenuData.value` so both lists stay in sync regardless of active filter/tab.

## Implementation
Update the success block in `confirmDelete()`:
```ts
if (response.status === 'success') {
    // Remove item from lists
    menuData.value = menuData.value.filter(m => m.id !== itemToDelete.value!.id)
    allMenuData.value = allMenuData.value.filter(m => m.id !== itemToDelete.value!.id)
    ...
}
```

Also consider that when deleting and the tab uses `allMenuData`, the UI updates immediately. Sidebar refresh already happens via `triggerRefresh()`.

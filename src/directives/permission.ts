import type { Directive, DirectiveBinding } from "vue";
import { useAuthStore } from "@/stores/auth";

type PermissionType = "read" | "create" | "update" | "delete" | "print";

interface PermissionValue {
  menuId: string;
  action: PermissionType;
  behavior?: "hide" | "disable"; // default: 'disable'
}

/**
 * v-permission directive
 *
 * Usage:
 * v-permission="{ menuId: 'menu-id', action: 'create' }"
 * v-permission="{ menuId: 'menu-id', action: 'delete', behavior: 'hide' }"
 *
 * Behavior:
 * - 'disable' (default): Disables the element but keeps it visible
 * - 'hide': Completely removes the element from DOM
 *
 * SUPER ADMIN always has full access
 */
// Store click handler for cleanup
const clickBlockers = new WeakMap<HTMLElement, (e: Event) => void>();
// Store respo change listeners for cleanup
const respoChangeListeners = new WeakMap<HTMLElement, () => void>();
// Store original title attribute
const originalTitles = new WeakMap<HTMLElement, string | null>();

// Helper to check permission from SelectRespo cache
const checkCachedPermission = (
  menuId: string,
  action: PermissionType,
): boolean => {
  const authStore = useAuthStore();

  // SUPER ADMIN always has access
  if (authStore.isSuperAdmin) return true;

  try {
    const cached = localStorage.getItem("SelectRespo");
    if (!cached) return false;

    const selectRespo = JSON.parse(cached);
    const permissions = selectRespo.permissions;
    if (!permissions) return false;

    const menuPerms = permissions[menuId];
    if (!menuPerms) return false;

    switch (action) {
      case "read":
        return menuPerms.is_read;
      case "create":
        return menuPerms.is_create;
      case "update":
        return menuPerms.is_update;
      case "delete":
        return menuPerms.is_delete;
      case "print":
        return menuPerms.is_print;
      default:
        return false;
    }
  } catch (e) {
    return false;
  }
};

// Helper to apply/remove permission restrictions
const applyPermission = (
  el: HTMLElement,
  menuId: string,
  action: PermissionType,
  behavior: "hide" | "disable",
) => {
  const authStore = useAuthStore();

  // Remove old click blocker if exists
  const oldBlocker = clickBlockers.get(el);
  if (oldBlocker) {
    el.removeEventListener("click", oldBlocker, true);
    clickBlockers.delete(el);
  }

  // SUPER ADMIN always has access
  if (authStore.isSuperAdmin) {
    // Remove any restrictions applied by permission directive
    if (el.hasAttribute("data-perm-disabled")) {
      el.removeAttribute("disabled");
      el.style.cursor = "";
      el.style.opacity = "";
      el.style.pointerEvents = "";
      el.removeAttribute("data-perm-disabled");
    }
    el.style.display = "";

    // Restore original title if exists
    const originalTitle = originalTitles.get(el);
    if (originalTitle) {
      el.setAttribute("title", originalTitle);
    }
    return;
  }

  // Check permission from cache
  const hasPermission = checkCachedPermission(menuId, action);

  if (!hasPermission) {
    if (behavior === "hide") {
      el.style.display = "none";
    } else {
      el.setAttribute("disabled", "true");
      el.setAttribute("data-perm-disabled", "true");
      el.style.cursor = "not-allowed";
      el.style.opacity = "0.5";
      el.style.pointerEvents = "none";
      el.setAttribute("title", "Anda tidak memiliki akses untuk aksi ini");

      // Block all click events
      const blockClick = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      };
      el.addEventListener("click", blockClick, true);
      clickBlockers.set(el, blockClick);
    }
  } else {
    // Remove restrictions applied by permission directive
    if (el.hasAttribute("data-perm-disabled")) {
      el.removeAttribute("disabled");
      el.style.cursor = "";
      el.style.opacity = "";
      el.style.pointerEvents = "";
      el.removeAttribute("data-perm-disabled");
    }
    el.style.display = "";

    // Restore original title if exists
    const originalTitle = originalTitles.get(el);
    if (originalTitle) {
      el.setAttribute("title", originalTitle);
    }
  }
};

export const vPermission: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding<PermissionValue>) {
    const { menuId, action, behavior = "disable" } = binding.value;

    // Store original title attribute before applying permission
    const originalTitle = el.getAttribute("title");
    if (originalTitle) {
      originalTitles.set(el, originalTitle);
    }

    // Apply initial permission
    applyPermission(el, menuId, action, behavior);

    // Listen for respo changes to update permission dynamically
    const handleRespoChange = () => {
      applyPermission(el, menuId, action, behavior);
    };
    window.addEventListener("respoChanged", handleRespoChange);
    respoChangeListeners.set(el, handleRespoChange);
  },

  updated(el: HTMLElement, binding: DirectiveBinding<PermissionValue>) {
    const { menuId, action, behavior = "disable" } = binding.value;

    // Re-apply permission when directive binding updates
    applyPermission(el, menuId, action, behavior);
  },

  unmounted(el: HTMLElement) {
    // Cleanup: remove click blocker when element is unmounted
    const blocker = clickBlockers.get(el);
    if (blocker) {
      el.removeEventListener("click", blocker, true);
      clickBlockers.delete(el);
    }

    // Cleanup: remove respo change listener
    const listener = respoChangeListeners.get(el);
    if (listener) {
      window.removeEventListener("respoChanged", listener);
      respoChangeListeners.delete(el);
    }

    // Cleanup: remove stored original title
    originalTitles.delete(el);
  },
};

export default vPermission;

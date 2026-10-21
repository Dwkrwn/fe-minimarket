import { reactive } from "vue";

export const navigationGuardState = reactive({
  isOpen: false,
  title: "Konfirmasi Perpindahan",
  description: "Ada perubahan yang belum disimpan. Apakah Anda yakin ingin meninggalkan halaman ini?",
  resolve: null as ((value: boolean) => void) | null,
});

export const showConfirmDialog = (): Promise<boolean> => {
  navigationGuardState.isOpen = true;
  return new Promise((resolve) => {
    navigationGuardState.resolve = resolve;
  });
};

export const handleConfirm = () => {
  navigationGuardState.isOpen = false;
  if (navigationGuardState.resolve) {
    navigationGuardState.resolve(true);
    navigationGuardState.resolve = null;
  }
};

export const handleCancel = () => {
  navigationGuardState.isOpen = false;
  if (navigationGuardState.resolve) {
    navigationGuardState.resolve(false);
    navigationGuardState.resolve = null;
  }
};

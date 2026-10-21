import { ref, computed } from 'vue'

export function useActionButtons() {
    const selectedItem = ref<any>(null)
    const selectedIndex = ref<number | null>(null)

    const isActive = computed(() => selectedItem.value !== null)

    const selectItem = (item: any, index: number) => {
        selectedItem.value = item
        selectedIndex.value = index
    }

    const deselectItem = () => {
        selectedItem.value = null
        selectedIndex.value = null
    }

    const handleEdit = (item?: any) => {
        if (item) selectItem(item, 0)
        if (!isActive.value) return
        return selectedItem.value
    }

    const handleDelete = (item?: any) => {
        if (item) selectItem(item, 0)
        if (!isActive.value) return
        return selectedItem.value
    }

    const handleCopy = (item?: any) => {
        if (item) selectItem(item, 0)
        if (!isActive.value) return
        return selectedItem.value
    }

    return {
        selectedItem,
        selectedIndex,
        isActive,
        selectItem,
        deselectItem,
        handleEdit,
        handleDelete,
        handleCopy
    }
}

import re
from pathlib import Path

DRAFT_ACTIVE_CLASS = "bg-gray-700 text-white border-gray-800"

DRAFT_COLORMAP_CLASS = "border-gray-800 bg-gray-700 text-white hover:bg-gray-800"

DRAFT_APPROVAL_CLASS = "bg-gray-700 text-white border-gray-800"

TARGET_FILES = [
    "src/views/inventory/t_penerimaan_gudang/PenerimaanGudangLanding.vue",
    "src/views/inventory/t_sj_gudang/SjGudangLanding.vue",
    "src/views/inventory/t_stock_adj/StockAdjLanding.vue",
    "src/views/inventory/t_transfer_gudang/TransferGudangLanding.vue",
    "src/views/inventory/t_transform_item/TransformItemLanding.vue",
    "src/views/purchasing/master/m_supplier/SupplierLanding.vue",
    "src/views/purchasing/master/m_items/ItemsLanding.vue",
    "src/views/purchasing/subcon/t_biaya_kirim_subcon/BiayaKirimSubconLanding.vue",
    "src/views/purchasing/subcon/t_penerimaan_subcon/PenerimaanSubconLanding.vue",
    "src/views/purchasing/subcon/t_purchase_invoice_subcon/PurchaseInvoiceSubconLanding.vue",
    "src/views/purchasing/subcon/t_purchase_order_subcon/PurchaseOrderSubconLanding.vue",
    "src/views/purchasing/subcon/t_purchase_request_subcon/PurchaseRequestSubconLanding.vue",
    "src/views/purchasing/subcon/t_purchase_return_subcon/PurchaseReturnSubconLanding.vue",
    "src/views/purchasing/subcon/t_surat_jalan_subcon/SuratJalanSubconLanding.vue",
    "src/views/purchasing/transaksi/t_import_cost/ImportCostLanding.vue",
    "src/views/purchasing/transaksi/t_penerimaan/TPenerimaanLanding.vue",
    "src/views/purchasing/transaksi/t_purchase_invoice/TPurchaseInvoiceLanding.vue",
    "src/views/purchasing/transaksi/t_purchase_order/TPurchaseOrderLanding.vue",
    "src/views/purchasing/transaksi/t_purchase_order_close/TPurchaseOrderCloseLanding.vue",
    "src/views/purchasing/transaksi/t_purchase_request/TPurchaseRequestLanding.vue",
    "src/views/purchasing/transaksi/t_purchase_request_close/TPurchaseRequestCloseLanding.vue",
    "src/views/purchasing/transaksi/t_purchase_return/TPurchaseReturnLanding.vue",
    "src/views/purchasing/transaksi/t_rfq/RfqLanding.vue",
    "src/views/purchasing/transaksi/t_supplier_quotation/SupplierQuotationLanding.vue",
    "src/views/marketing/transaksi/t_sales_quotation/TSalesQuotationLanding.vue",
]

OLD_CLASSES = [
    "border-primary text-primary",
    "border-blue-600 text-blue-600",
    "border-gray-500 bg-gray-100 text-gray-800",
    "border-gray-500 bg-gray-200 text-gray-900",
    "bg-slate-700 text-white border-slate-800",
]

OLD_COLORMAP_CLASSES = [
    "border-gray-400 bg-gray-100 text-gray-700 hover:bg-gray-200",
    "border-gray-500 bg-gray-100 text-gray-700 hover:bg-gray-200",
    "bg-slate-700 text-white border-slate-800 hover:bg-slate-800",
]


def replace_filterStatus_draft(content: str) -> tuple[str, int]:
    """Pola 1-5: :class dengan filterStatus === 'DRAFT' atau 'Draft'"""
    total = 0
    new = DRAFT_ACTIVE_CLASS

    for old_cls in OLD_CLASSES:
        if old_cls == new:
            continue
        esc = re.escape(old_cls)

        p = rf":class=\"filterStatus === 'DRAFT' \? '{esc}' : ''\""
        r = f":class=\"filterStatus === 'DRAFT' ? '{new}' : ''\""
        content, n = re.subn(p, r, content); total += n

        p = rf":class=\"filterStatus === 'Draft' \? '{esc}' : ''\""
        r = f":class=\"filterStatus === 'Draft' ? '{new}' : ''\""
        content, n = re.subn(p, r, content); total += n

        p = rf":class=\"filterApprovalStatus === 'DRAFT' \? '{esc}' : ''\""
        r = f":class=\"filterApprovalStatus === 'DRAFT' ? '{new}' : ''\""
        content, n = re.subn(p, r, content); total += n

        for var in ("filterStatus", "filterApprovalStatus"):
            p = rf":class=\"{var} === 'DRAFT'\n(\s*)\? '{esc}'\n(\s*): ''\n(\s*)\""
            r = lambda m, c=new, v=var: (
                f":class=\"{v} === 'DRAFT'\n"
                f"{m.group(1)}? '{c}'\n"
                f"{m.group(2)}: ''\n"
                f"{m.group(3)}\""
            )
            content, n = re.subn(p, r, content); total += n

        for var in ("filterStatus", "filterApprovalStatus"):
            p = (
                rf":class=\"\n"
                rf"(\s*){var} === 'DRAFT'\n"
                rf"(\s*)\? '{esc}'\n"
                rf"(\s*): ''\n"
                rf"(\s*)\""
            )
            r = lambda m, c=new, v=var: (
                f":class=\"\n"
                f"{m.group(1)}{v} === 'DRAFT'\n"
                f"{m.group(2)}? '{c}'\n"
                f"{m.group(3)}: ''\n"
                f"{m.group(4)}\""
            )
            content, n = re.subn(p, r, content); total += n

        p = (
            rf":class=\"\n"
            rf"(\s*)filterStatus === 'Draft'\n"
            rf"(\s*)\? '{esc}'\n"
            rf"(\s*): ''\n"
            rf"(\s*)\""
        )
        r = lambda m, c=new: (
            f":class=\"\n"
            f"{m.group(1)}filterStatus === 'Draft'\n"
            f"{m.group(2)}? '{c}'\n"
            f"{m.group(3)}: ''\n"
            f"{m.group(4)}\""
        )
        content, n = re.subn(p, r, content); total += n

    return content, total


def replace_statusColorMap_draft(content: str) -> tuple[str, int]:
    """Pola khusus SupplierLanding: DRAFT di dalam TypeScript object statusColorMap"""
    total = 0
    new = DRAFT_COLORMAP_CLASS

    for old_cls in OLD_COLORMAP_CLASSES:
        if old_cls == new:
            continue
        esc = re.escape(old_cls)

        p = rf'DRAFT:\s*"{esc}"'
        r = f'DRAFT: "{new}"'
        content, n = re.subn(p, r, content); total += n

        # Versi single-quote
        p = rf"DRAFT:\s*'{esc}'"
        r = f"DRAFT: '{new}'"
        content, n = re.subn(p, r, content); total += n

    return content, total


def replace_draft_classes(content: str) -> tuple[str, int]:
    total = 0
    content, n = replace_filterStatus_draft(content);    total += n
    content, n = replace_statusColorMap_draft(content);  total += n
    return content, total


def main() -> None:
    root = Path(__file__).parent
    changed      = 0
    replacements = 0
    skipped: list[str] = []

    print("=" * 65)
    print("update_draft_button.py — mulai proses")
    print(f"Target warna  : {DRAFT_ACTIVE_CLASS}")
    print(f"Total file    : {len(TARGET_FILES)}")
    print("=" * 65)

    for rel in TARGET_FILES:
        fp = root / rel
        if not fp.exists():
            skipped.append(rel)
            print(f"  [SKIP]  {rel} — tidak ditemukan")
            continue

        original = fp.read_text(encoding="utf-8")
        updated, count = replace_draft_classes(original)

        if count == 0:
            print(f"  [OK]    {fp.name} — tidak ada perubahan (sudah benar)")
            continue

        fp.write_text(updated, encoding="utf-8")
        changed      += 1
        replacements += count
        print(f"  [DONE]  {fp.name} — {count} penggantian")

    print("=" * 65)
    print(f"Selesai  : {changed} file diubah, {replacements} penggantian total")
    if skipped:
        print(f"Dilewati : {len(skipped)} file tidak ditemukan")
        for s in skipped:
            print(f"           - {s}")
    print("=" * 65)


if __name__ == "__main__":
    main()

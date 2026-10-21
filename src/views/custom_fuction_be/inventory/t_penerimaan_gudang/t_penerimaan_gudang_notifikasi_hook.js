// Hooks for t_penerimaan_gudang_notifikasi model
import t_penerimaan_gudang_notifikasi from '../models/t_penerimaan_gudang_notifikasi.js';

export function registert_penerimaan_gudang_notifikasiHooks() {
  // beforeValidate
  t_penerimaan_gudang_notifikasi.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
  });

  // afterValidate
  t_penerimaan_gudang_notifikasi.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate - SEND APPROVAL LOGIC
  t_penerimaan_gudang_notifikasi.addHook("beforeCreate", async (instance, options) => {
    console.log("\n===== [HOOK beforeCreate t_penerimaan_gudang_notifikasi] =====");

    try {
      const models = instance.sequelize.models;

      console.log("[1] Data notifikasi yang masuk:", instance.dataValues);

      if (!instance.t_penerimaan_gudang_id) {
        console.log("[2] t_penerimaan_gudang_id TIDAK ADA → skip hook");
        return;
      }

      const pgId = instance.t_penerimaan_gudang_id;

      // Update semua notif lama
      console.log("[3] Update semua notifikasi lama menjadi TRUE untuk Penerimaan Gudang:", pgId);

      await models.t_penerimaan_gudang_notifikasi.update(
        { status: true },
        {
          where: { t_penerimaan_gudang_id: pgId },
          transaction: options.transaction,
          logging: (sql) => console.log("[SQL Update Notif Lama] →", sql)
        }
      );

      // Ambil Penerimaan Gudang
      console.log("[4] Mencari t_penerimaan_gudang:", pgId);

      const pg = await models.t_penerimaan_gudang.findOne({
        where: { id: pgId },
        transaction: options.transaction,
        logging: (sql) => console.log("[SQL findOne PG] →", sql)
      });

      if (!pg) {
        console.log("[5] Penerimaan Gudang tidak ditemukan → skip");
        return;
      }

      console.log("[6] Data Penerimaan Gudang ditemukan:", pg.toJSON());

      // Update Penerimaan Gudang status
      console.log("[7] Update status Penerimaan Gudang menjadi IN APPROVAL");

      await pg.update(
        { status: "IN APPROVAL" },
        {
          transaction: options.transaction,
          logging: (sql) => console.log("[SQL update PG status] →", sql)
        }
      );

      // =============================================
      // AUTO TITLE + MESSAGE FIX — pakai no_penerimaan_gudang !!!
      // =============================================
      const pgName = pg.no_penerimaan_gudang;

      const autoTitle = `Request Approval Penerimaan Gudang: ${pgName}`;
      const autoMessage = `Penerimaan Gudang "${pgName}" membutuhkan persetujuan.`;

      console.log("[8] Auto generate title & message");

      if (!instance.title) instance.title = autoTitle;
      if (!instance.approval_level) instance.approval_level = 0;
      if (!instance.status_name) instance.status_name = "IN APPROVAL";
      if (!instance.approval_message) instance.approval_message = autoMessage;

      console.log("[9] Final data sebelum create:", instance.dataValues);

      console.log("===== [END HOOK t_penerimaan_gudang_notifikasi] =====\n");

    } catch (err) {
      console.error("[ERROR HOOK t_penerimaan_gudang_notifikasi] →", err);
    }
  });

  // afterCreate
  t_penerimaan_gudang_notifikasi.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  t_penerimaan_gudang_notifikasi.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  t_penerimaan_gudang_notifikasi.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
  });

  // beforeUpdate
  t_penerimaan_gudang_notifikasi.addHook('beforeUpdate', async (instance, options) => {
    // Custom logic sebelum update
  });

  // afterUpdate - HANDLE AUTO APPROVE LOGIC + SYNC STOCK
  t_penerimaan_gudang_notifikasi.addHook("afterUpdate", async (instance, options) => {
    console.log("\n===== [HOOK afterUpdate t_penerimaan_gudang_notifikasi] =====");

    const trx = options.transaction || undefined;
    const models = instance.sequelize.models;

    try {
      console.log("[1] Data notifikasi setelah update:", instance.dataValues);

      // ✅ SKIP jika belum ada user_approved_id
      if (!instance.user_approved_id) {
        console.log("[2] Belum ada user_approved_id → SKIP");
        return;
      }

      if (!instance.t_penerimaan_gudang_id) {
        console.log("[2.1] t_penerimaan_gudang_id tidak ada → STOP");
        return;
      }

      const pgId = instance.t_penerimaan_gudang_id;
      const currentLevel = Number(instance.approval_level);
      console.log("[3] Current Approval Level:", currentLevel);

      // =====================================================
      //  GET PENERIMAAN GUDANG DATA
      // =====================================================
      const penerimaanGudang = await models.t_penerimaan_gudang.findOne({
        where: { id: pgId },
        include: [
          {
            model: models.t_penerimaan_gudang_d,
            as: 't_penerimaan_gudang_ds',
            required: false
          }
        ],
        transaction: trx
      });

      if (!penerimaanGudang) {
        console.log("[3.1] Penerimaan Gudang tidak ditemukan → STOP");
        return;
      }

      // =====================================================
      //  FETCH APPROVAL RULE (m_approval + m_approval_ds)
      // =====================================================
      const approvalRule = await models.m_approval.findOne({
        where: { nama_approval: "Approval Penerimaan Gudang" },
        include: [
          {
            model: models.m_approval_d,
            as: "m_approval_ds",
            required: false,
            where: { is_active: true },
            order: [["level", "ASC"]]
          },
        ],
        logging: (sql) => console.log("[SQL find approval] →", sql),
        transaction: trx,
      });

      // =====================================================
      //  HELPER FUNCTION: SYNC STOCK GUDANG
      // =====================================================
      const syncStockToGudang = async () => {
        console.log("🔄 SYNC STOCK TO GUDANG PENERIMAAN...");

        const gudangTerimaId = penerimaanGudang.warehouse_terima_id;
        if (!gudangTerimaId) {
          console.log("⚠️ No warehouse_terima_id, skip sync");
          return;
        }

        // Check if already synced
        const existingSync = await models.stock_gudang_d.findOne({
          where: { t_penerimaan_gudang_id: pgId },
          transaction: trx
        });

        if (existingSync) {
          console.log("⚠️ Already synced, skip");
          return;
        }

        const details = penerimaanGudang.t_penerimaan_gudang_ds || [];
        if (details.length === 0) {
          console.log("⚠️ No details, skip sync");
          return;
        }

        for (const detail of details) {
          const itemId = detail.m_items_id;
          const qtyDiterima = Number(detail.qty_diterima || 0);

          if (!itemId || qtyDiterima <= 0) continue;

          // Find or create stock_gudang
          let stockGudangRecord = await models.stock_gudang.findOne({
            where: {
              m_gudang_id: gudangTerimaId,
              m_items_id: itemId
            },
            transaction: trx
          });

          if (!stockGudangRecord) {
            stockGudangRecord = await models.stock_gudang.create({
              m_gudang_id: gudangTerimaId,
              m_items_id: itemId,
              free_stock: 0
            }, { transaction: trx });
          }

          // Create stock_gudang_d entry - STOCK MASUK
          await models.stock_gudang_d.create({
            stock_gudang_id: stockGudangRecord.id,
            t_penerimaan_gudang_id: pgId,
            m_items_id: itemId,
            stock_masuk: qtyDiterima,
            stock_keluar: 0
          }, { transaction: trx });

          // Recalculate free_stock
          const totalMasuk = await models.stock_gudang_d.sum('stock_masuk', {
            where: { stock_gudang_id: stockGudangRecord.id },
            transaction: trx
          }) || 0;

          const totalKeluar = await models.stock_gudang_d.sum('stock_keluar', {
            where: { stock_gudang_id: stockGudangRecord.id },
            transaction: trx
          }) || 0;

          await stockGudangRecord.update({
            free_stock: totalMasuk - totalKeluar
          }, { transaction: trx });

          console.log(`✅ Synced item ${itemId}: +${qtyDiterima}`);
        }

        console.log("✅ Stock sync completed");
      };

      // =====================================================
      //  AUTO APPROVE + SYNC STOCK
      // =====================================================
      if (!approvalRule) {
        console.log("[4] Approval rule tidak ditemukan → AUTO APPROVE");
        
        await models.t_penerimaan_gudang.update(
          { status: "APPROVED" },
          { where: { id: pgId }, transaction: trx, hooks: false }
        );

        await syncStockToGudang();

        console.log("===== [END afterUpdate → AUTO APPROVED] =====\n");
        return;
      }

      console.log("[4] Approval Rule ditemukan:", approvalRule.dataValues);

      // =====================================================
      //  JIKA TIDAK ADA DETAIL → AUTO APPROVE
      // =====================================================
      if (!approvalRule.m_approval_ds || approvalRule.m_approval_ds.length === 0) {
        console.log("➡ Tidak ada approval detail → AUTO APPROVE");

        await models.t_penerimaan_gudang.update(
          { status: "APPROVED" },
          { where: { id: pgId }, transaction: trx, hooks: false }
        );

        await syncStockToGudang();

        console.log("===== [END afterUpdate → AUTO APPROVED] =====\n");
        return;
      }

      // =====================================================
      //  CEK is_full PADA LEVEL SEKARANG
      // =====================================================
      const currentRule = approvalRule.m_approval_ds.find(d => Number(d.level) === currentLevel);
      const isFull = currentRule?.is_full || false;

      console.log("[5] Current Level Rule:", currentRule?.dataValues);
      console.log("[6] is_full:", isFull);

      // =====================================================
      //  HITUNG LEVEL MAX
      // =====================================================
      const levels = approvalRule.m_approval_ds.map((d) => Number(d.level));
      const maxLevel = Math.max(...levels);

      console.log("[7] Max Level:", maxLevel, "Current:", currentLevel);

      // =====================================================
      //  JIKA is_full = true ATAU CURRENT >= MAX → FINAL APPROVE
      // =====================================================
      if (isFull || currentLevel >= maxLevel) {
        console.log("➡ Level terakhir → FINAL APPROVE + SYNC STOCK");

        await models.t_penerimaan_gudang.update(
          { status: "APPROVED" },
          { where: { id: pgId }, transaction: trx, hooks: false }
        );

        await syncStockToGudang();

        console.log("===== [END afterUpdate → FINAL APPROVED] =====\n");
        return;
      }

      console.log("➡ Belum level terakhir, menunggu approval berikutnya");
      console.log("===== [END afterUpdate t_penerimaan_gudang_notifikasi] =====\n");

    } catch (err) {
      console.error("❌ [ERROR afterUpdate t_penerimaan_gudang_notifikasi] →", err);
    }
  });

  // beforeSave
  t_penerimaan_gudang_notifikasi.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  t_penerimaan_gudang_notifikasi.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  t_penerimaan_gudang_notifikasi.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  t_penerimaan_gudang_notifikasi.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  t_penerimaan_gudang_notifikasi.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  t_penerimaan_gudang_notifikasi.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  t_penerimaan_gudang_notifikasi.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  t_penerimaan_gudang_notifikasi.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}

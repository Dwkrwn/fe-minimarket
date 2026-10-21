// Hooks for t_purchase_order_close_notifikasi model
import t_purchase_order_close_notifikasi from '../models/t_purchase_order_close_notifikasi.js';

export function registert_purchase_order_close_notifikasiHooks() {
  // beforeValidate
  t_purchase_order_close_notifikasi.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
  });

  // afterValidate
  t_purchase_order_close_notifikasi.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  t_purchase_order_close_notifikasi.addHook("beforeCreate", async (instance, options) => {
    console.log("\n===== [HOOK beforeCreate t_purchase_order_close_notifikasi] =====");

    try {
      const models = instance.sequelize.models;

      console.log("[1] Data notifikasi yang masuk:", instance.dataValues);

      if (!instance.t_purchase_order_close_id) {
        console.log("[2] t_purchase_order_close_id TIDAK ADA → skip hook");
        return;
      }

      // ✅ SKIP jika ini adalah record APPROVED/REJECT/REVISI (status=true)
      // Karena record ini hanya untuk history, bukan untuk approval baru
      if (instance.status === true) {
        console.log("[2.1] Status = TRUE (history record) → SKIP update POC status");
        console.log("===== [END HOOK beforeCreate - SKIPPED] =====\n");
        return;
      }

      const pocId = instance.t_purchase_order_close_id;

      // Update semua notif lama
      console.log("[3] Update semua notifikasi lama menjadi TRUE untuk POC:", pocId);

      await models.t_purchase_order_close_notifikasi.update(
        { status: true },
        {
          where: { t_purchase_order_close_id: pocId },
          transaction: options.transaction,
          logging: (sql) => console.log("[SQL Update Notif Lama] →", sql)
        }
      );

      // Ambil POC
      console.log("[4] Mencari t_purchase_order_close:", pocId);

      const poc = await models.t_purchase_order_close.findOne({
        where: { id: pocId },
        transaction: options.transaction,
        logging: (sql) => console.log("[SQL findOne POC] →", sql)
      });

      if (!poc) {
        console.log("[5] Purchase Order Close tidak ditemukan → skip");
        return;
      }

      console.log("[6] Data POC ditemukan:", poc.toJSON());

      // Update POC status HANYA jika notifikasi ini untuk approval (status=false)
      console.log("[7] Update status POC menjadi IN APPROVAL");

      await poc.update(
        { status: "IN APPROVAL" },
        {
          transaction: options.transaction,
          logging: (sql) => console.log("[SQL update POC status] →", sql)
        }
      );

      // =============================================
      // AUTO TITLE + MESSAGE FIX — pakai no_po_close !!!
      // =============================================
      const pocName = poc.no_po_close;

      const autoTitle = `Request Approval Purchase Order Close: ${pocName}`;
      const autoMessage = `Purchase Order Close "${pocName}" membutuhkan persetujuan.`;

      console.log("[8] Auto generate title & message");

      if (!instance.title) instance.title = autoTitle;
      if (!instance.approval_level) instance.approval_level = 0;
      if (!instance.status_name) instance.status_name = "IN APPROVAL";
      if (!instance.approval_message) instance.approval_message = autoMessage;

      console.log("[9] Final data sebelum create:", instance.dataValues);

      console.log("===== [END HOOK t_purchase_order_close_notifikasi] =====\n");

    } catch (err) {
      console.error("[ERROR HOOK t_purchase_order_close_notifikasi] →", err);
    }
  });

  // afterCreate
  t_purchase_order_close_notifikasi.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  t_purchase_order_close_notifikasi.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  t_purchase_order_close_notifikasi.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
  });

  // beforeUpdate
  t_purchase_order_close_notifikasi.addHook('beforeUpdate', async (instance, options) => {
    // Custom logic sebelum update
  });

  // afterUpdate
  t_purchase_order_close_notifikasi.addHook("afterUpdate", async (instance, options) => {
    console.log("\n===== [HOOK afterUpdate t_purchase_order_close_notifikasi] =====");

    try {
      const models = instance.sequelize.models;
      console.log("[1] Data notifikasi setelah update:", instance.dataValues);

      // Cek status: jika true = sudah di-approve
      if (instance.status !== true) {
        console.log("[2] Notifikasi status bukan TRUE (belum di-approve) → skip afterUpdate");
        return;
      }

      const pocId = instance.t_purchase_order_close_id;
      const currentLevel = instance.approval_level;

      console.log("[3] Approval level saat ini:", currentLevel);
      console.log("[4] POC ID:", pocId);

      // Ambil approval rules
      console.log("[5] Fetch m_approval: 'Approval Purchase Order Close'");

      const approvalRules = await models.m_approval.findOne({
        where: { nama: "Approval Purchase Order Close" },
        include: [
          {
            model: models.m_approval_d,
            as: "m_approval_ds",
          },
        ],
        transaction: options.transaction,
        logging: (sql) => console.log("[SQL findOne m_approval] →", sql),
      });

      if (!approvalRules || !approvalRules.m_approval_ds) {
        console.log("[6] Approval rules tidak ditemukan → skip");
        return;
      }

      const levels = approvalRules.m_approval_ds.map((d) => d.level);
      const maxLevel = Math.max(...levels);

      console.log("[7] Max approval level:", maxLevel);
      console.log("[8] Current approval level:", currentLevel);

      // Jika sudah mencapai level maksimal, auto approve POC
      if (currentLevel >= maxLevel) {
        console.log("[9] ✅ Sudah di approval level TERAKHIR → AUTO APPROVE POC");

        await models.t_purchase_order_close.update(
          { status: "APPROVED" },
          {
            where: { id: pocId },
            transaction: options.transaction,
            logging: (sql) => console.log("[SQL update POC status APPROVED] →", sql),
          }
        );

        console.log("[10] POC status berhasil di-update ke APPROVED");
      } else {
        console.log("[9] ⏳ Belum mencapai level max → tunggu approval level berikutnya");
      }

      console.log("===== [END HOOK afterUpdate t_purchase_order_close_notifikasi] =====\n");

    } catch (err) {
      console.error("[ERROR HOOK afterUpdate t_purchase_order_close_notifikasi] →", err);
    }
  });

  // beforeSave
  t_purchase_order_close_notifikasi.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  t_purchase_order_close_notifikasi.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  t_purchase_order_close_notifikasi.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  t_purchase_order_close_notifikasi.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  t_purchase_order_close_notifikasi.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  t_purchase_order_close_notifikasi.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  t_purchase_order_close_notifikasi.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  t_purchase_order_close_notifikasi.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}

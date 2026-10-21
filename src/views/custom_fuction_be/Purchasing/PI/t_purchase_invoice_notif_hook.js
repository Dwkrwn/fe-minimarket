// Hooks for t_purchase_invoice_notifikasi model
import t_purchase_invoice_notifikasi from '../models/t_purchase_invoice_notifikasi.js';

export function registert_purchase_invoice_notifikasiHooks() {
  // beforeValidate
  t_purchase_invoice_notifikasi.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
  });

  // afterValidate
  t_purchase_invoice_notifikasi.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  t_purchase_invoice_notifikasi.addHook("beforeCreate", async (instance, options) => {
    console.log("\n===== [HOOK beforeCreate t_purchase_invoice_notifikasi] =====");

    try {
      const models = instance.sequelize.models;

      console.log("[1] Data notifikasi yang masuk:", instance.dataValues);

      if (!instance.t_purchase_invoice_id) {
        console.log("[2] t_purchase_invoice_id TIDAK ADA → skip hook");
        return;
      }

      // ✅ SKIP jika notifikasi ini sudah APPROVED/REJECT/REVISI (hasil keputusan atasan)
      // Jangan update PI status ke IN APPROVAL jika ini adalah record keputusan
      const statusName = instance.status_name?.toUpperCase();
      if (statusName === 'APPROVED' || statusName === 'REJECT' || statusName === 'REVISI') {
        console.log(`[2.1] Notifikasi adalah keputusan (${statusName}) → SKIP update PI status`);
        return;
      }

      const piId = instance.t_purchase_invoice_id;

      // Update semua notif lama
      console.log("[3] Update semua notifikasi lama menjadi TRUE untuk PI:", piId);

      await models.t_purchase_invoice_notifikasi.update(
        { status: true },
        {
          where: { t_purchase_invoice_id: piId },
          transaction: options.transaction,
          logging: (sql) => console.log("[SQL Update Notif Lama] →", sql)
        }
      );

      // Ambil PI
      console.log("[4] Mencari t_purchase_invoice:", piId);

      const pi = await models.t_purchase_invoice.findOne({
        where: { id: piId },
        transaction: options.transaction,
        logging: (sql) => console.log("[SQL findOne PI] →", sql)
      });

      if (!pi) {
        console.log("[5] Purchase Invoice tidak ditemukan → skip");
        return;
      }

      console.log("[6] Data PI ditemukan:", pi.toJSON());

      // ✅ SKIP update status PI jika PI sudah APPROVED (jangan revert!)
      if (pi.status === 'APPROVED') {
        console.log("[6.1] PI sudah APPROVED → SKIP update status");
        return;
      }

      // Update PI status
      console.log("[7] Update status PI menjadi IN APPROVAL");

      await pi.update(
        { status: "IN APPROVAL" },
        {
          transaction: options.transaction,
          logging: (sql) => console.log("[SQL update PI status] →", sql)
        }
      );

      // =============================================
      // AUTO TITLE + MESSAGE FIX — pakai no_pi !!!
      // =============================================
      const piName = pi.no_pi;

      const autoTitle = `Request Approval Purchase Invoice: ${piName}`;
      const autoMessage = `Purchase Invoice "${piName}" membutuhkan persetujuan.`;

      console.log("[8] Auto generate title & message");

      if (!instance.title) instance.title = autoTitle;
      if (!instance.approval_level) instance.approval_level = 0;
      if (!instance.status_name) instance.status_name = "IN APPROVAL";
      if (!instance.approval_message) instance.approval_message = autoMessage;

      console.log("[9] Final data sebelum create:", instance.dataValues);

      console.log("===== [END HOOK t_purchase_invoice_notifikasi] =====\n");

    } catch (err) {
      console.error("[ERROR HOOK t_purchase_invoice_notifikasi] →", err);
    }
  });

  // afterCreate
  t_purchase_invoice_notifikasi.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  t_purchase_invoice_notifikasi.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  t_purchase_invoice_notifikasi.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
  });

  // beforeUpdate
  t_purchase_invoice_notifikasi.addHook('beforeUpdate', async (instance, options) => {
    // Custom logic sebelum update
  });

  // afterUpdate
  t_purchase_invoice_notifikasi.addHook("afterUpdate", async (instance, options) => {
    console.log("\n===== [HOOK afterUpdate t_purchase_invoice_notifikasi] =====");

    const trx = options.transaction || undefined;
    const models = instance.sequelize.models;

    try {
      console.log("[1] Data notifikasi setelah update:", instance.dataValues);

      if (!instance.t_purchase_invoice_id) {
        console.log("[2] t_purchase_invoice_id tidak ada → STOP");
        return;
      }

      const currentLevel = Number(instance.approval_level);
      console.log("[3] Current Approval Level:", currentLevel, typeof currentLevel);

      // =====================================================
      //  FETCH APPROVAL RULE PI (m_approval + m_approval_ds)
      // =====================================================
      const approvalRule = await models.m_approval.findOne({
        where: { nama_approval: "Approval Purchase Invoice" },
        include: [
          {
            model: models.m_approval_d,
            as: "m_approval_ds",
            required: false,
          },
        ],
        logging: (sql) => console.log("[SQL find approval] →", sql),
        transaction: trx,
      });

      console.log("SAMPAI SINI");

      if (!approvalRule) {
        console.log("[4] Approval rule tidak ditemukan → AUTO APPROVE PI");
      } else {
        console.log("[4] Approval Rule ditemukan:", approvalRule.dataValues);
        console.log(
          "[4.1] Approval Details:",
          approvalRule.m_approval_ds?.map((d) => d.dataValues)
        );
      }

      // =====================================================
      //  JIKA TIDAK ADA DETAIL → AUTO APPROVE
      // =====================================================
      if (!approvalRule || !approvalRule.m_approval_ds) {
        console.log("➡ Tidak ada approval detail → AUTO APPROVE");

        await instance.update(
          { status: true, status_name: "APPROVED" },
          { transaction: trx, hooks: false }
        );

        await models.t_purchase_invoice.update(
          { status: "APPROVED" },
          { where: { id: instance.t_purchase_invoice_id }, transaction: trx, hooks: false }
        );

        console.log("===== [END afterUpdate → AUTO APPROVED PI] =====\n");
        return;
      }

      // =====================================================
      //  HITUNG LEVEL MAX DARI APPROVAL DETAIL
      // =====================================================
      const levels = approvalRule.m_approval_ds.map((d) => Number(d.level));
      console.log("[5] Semua level ditemukan:", levels);

      const maxLevel = Math.max(...levels);
      console.log("[6] Max Level:", maxLevel);

      console.log("[7] Current Level:", currentLevel);

      // =====================================================
      //  JIKA CURRENT >= MAX → AUTO APPROVE
      // =====================================================
      if (currentLevel >= maxLevel) {
        console.log("➡ Current level adalah level terakhir → AUTO APPROVE PI");

        await instance.update(
          { status: true, status_name: "APPROVED" },
          {
            transaction: trx,
            hooks: false,
            logging: (sql) => console.log("[SQL update notif] →", sql),
          }
        );

        const pi = await models.t_purchase_invoice.findOne({
          where: { id: instance.t_purchase_invoice_id },
          transaction: trx,
          logging: (sql) => console.log("[SQL find PI] →", sql),
        });

        if (pi) {
          console.log("➡ Update t_purchase_invoice → APPROVED");

          await pi.update(
            { status: "APPROVED" },
            {
              transaction: trx,
              hooks: false,
              logging: (sql) => console.log("[SQL update PI APPROVED] →", sql),
            }
          );
        }

        console.log("===== [END afterUpdate → AUTO APPROVED PI] =====\n");
        return;
      }

      // =====================================================
      //  MASIH ADA LEVEL SELANJUTNYA → STOP
      // =====================================================
      console.log("➡ Masih ada level berikutnya → tidak di-approve otomatis");

      console.log("===== [END afterUpdate no auto-approve PI] =====\n");

    } catch (err) {
      console.error("[ERROR afterUpdate t_purchase_invoice_notifikasi] →", err);
    }
  });

  // beforeSave
  t_purchase_invoice_notifikasi.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  t_purchase_invoice_notifikasi.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  t_purchase_invoice_notifikasi.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  t_purchase_invoice_notifikasi.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  t_purchase_invoice_notifikasi.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  t_purchase_invoice_notifikasi.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  t_purchase_invoice_notifikasi.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  t_purchase_invoice_notifikasi.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}

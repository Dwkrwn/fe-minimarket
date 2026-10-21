// Hooks for t_purchase_request_notifikasi model
import t_purchase_request_notifikasi from '../models/t_purchase_request_notifikasi.js';

export function registert_purchase_request_notifikasiHooks() {
  // beforeValidate
  t_purchase_request_notifikasi.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
  });

  // afterValidate
  t_purchase_request_notifikasi.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });


  // beforeCreate
t_purchase_request_notifikasi.addHook("beforeCreate", async (instance, options) => {
  console.log("\n===== [HOOK beforeCreate t_purchase_request_notifikasi] =====");

  try {
    const models = instance.sequelize.models;

    console.log("[1] Data notifikasi yang masuk:", instance.dataValues);

    if (!instance.t_purchase_request_id) {
      console.log("[2] t_purchase_request_id TIDAK ADA → skip hook");
      return;
    }

    const prId = instance.t_purchase_request_id;

    // Update semua notif lama
    console.log("[3] Update semua notifikasi lama menjadi TRUE untuk PR:", prId);

    await models.t_purchase_request_notifikasi.update(
      { status: true },
      {
        where: { t_purchase_request_id: prId },
        transaction: options.transaction,
        logging: (sql) => console.log("[SQL Update Notif Lama] →", sql)
      }
    );

    // Ambil PR
    console.log("[4] Mencari t_purchase_request:", prId);

    const pr = await models.t_purchase_request.findOne({
      where: { id: prId },
      transaction: options.transaction,
      logging: (sql) => console.log("[SQL findOne PR] →", sql)
    });

    if (!pr) {
      console.log("[5] Purchase Request tidak ditemukan → skip");
      return;
    }

    console.log("[6] Data PR ditemukan:", pr.toJSON());

    // Update PR status
    // Jangan override status jika notifikasi ini adalah keputusan final (APPROVED/REJECT/REVISI)
    const finalStatuses = ["APPROVED", "REJECT", "REVISI"];
    const notifStatusName = (instance.status_name || "").toUpperCase();
    const isFinalDecision = finalStatuses.includes(notifStatusName);

    if (!isFinalDecision) {
      console.log("[7] Update status PR menjadi IN APPROVAL");

      await pr.update(
        { status: "IN APPROVAL" },
        {
          transaction: options.transaction,
          logging: (sql) => console.log("[SQL update PR status] →", sql)
        }
      );
    } else {
      console.log("[7] Skip update status PR → notif final decision:", notifStatusName);
    }

    // =============================================
    // AUTO TITLE + MESSAGE FIX — pakai no_pr !!!
    // =============================================
    const prName = pr.no_pr; // FIXED!

    const autoTitle = `Request Approval Purchase Request: ${prName}`;
    const autoMessage = `Purchase Request "${prName}" membutuhkan persetujuan.`;

    console.log("[8] Auto generate title & message");

    if (!instance.title) instance.title = autoTitle;
    if (!instance.approval_level) instance.approval_level = 0;
    if (!instance.status_name) instance.status_name = "IN APPROVAL";
    if (!instance.approval_message) instance.approval_message = autoMessage;

    console.log("[9] Final data sebelum create:", instance.dataValues);

    console.log("===== [END HOOK t_purchase_request_notifikasi] =====\n");

  } catch (err) {
    console.error("[ERROR HOOK t_purchase_request_notifikasi] →", err);
  }
});



  // afterCreate
  t_purchase_request_notifikasi.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  t_purchase_request_notifikasi.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  t_purchase_request_notifikasi.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
  });

  // beforeUpdate
  t_purchase_request_notifikasi.addHook('beforeUpdate', async (instance, options) => {
    // Custom logic sebelum update
  });

  // afterUpdate
  t_purchase_request_notifikasi.addHook("afterUpdate", async (instance, options) => {
    console.log("\n===== [HOOK afterUpdate t_purchase_request_notifikasi] =====");

    const trx = options.transaction || undefined;
    const models = instance.sequelize.models;

    try {
      console.log("[1] Data notifikasi setelah update:", instance.dataValues);

      if (!instance.t_purchase_request_id) {
        console.log("[2] t_purchase_request_id tidak ada → STOP");
        return;
      }

      const currentLevel = Number(instance.approval_level);
      console.log("[3] Current Approval Level:", currentLevel, typeof currentLevel);

      // =====================================================
      //  FETCH APPROVAL RULE PR (m_approval + m_approval_ds)
      // =====================================================
      const approvalRule = await models.m_approval.findOne({
        where: { nama_approval: "Approval Purchase Request" },
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
        console.log("[4] Approval rule tidak ditemukan → AUTO APPROVE PR");
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

        await models.t_purchase_request.update(
          { status: "APPROVED" },
          { where: { id: instance.t_purchase_request_id }, transaction: trx, hooks: false }
        );

        console.log("===== [END afterUpdate → AUTO APPROVED PR] =====\n");
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
        console.log("➡ Current level adalah level terakhir → AUTO APPROVE PR");

        await instance.update(
          { status: true, status_name: "APPROVED" },
          {
            transaction: trx,
            hooks: false,
            logging: (sql) => console.log("[SQL update notif] →", sql),
          }
        );

        const pr = await models.t_purchase_request.findOne({
          where: { id: instance.t_purchase_request_id },
          transaction: trx,
          logging: (sql) => console.log("[SQL find PR] →", sql),
        });

        if (pr) {
          console.log("➡ Update t_purchase_request → APPROVED");

          await pr.update(
            { status: "APPROVED" },
            {
              transaction: trx,
              hooks: false,
              logging: (sql) => console.log("[SQL update PR APPROVED] →", sql),
            }
          );
        }

        console.log("===== [END afterUpdate → AUTO APPROVED PR] =====\n");
        return;
      }

      // =====================================================
      //  MASIH ADA LEVEL SELANJUTNYA → STOP
      // =====================================================
      console.log("➡ Masih ada level berikutnya → tidak di-approve otomatis");

      console.log("===== [END afterUpdate no auto-approve PR] =====\n");

    } catch (err) {
      console.error("[ERROR afterUpdate t_purchase_request_notifikasi] →", err);
    }
  });


  // beforeSave
  t_purchase_request_notifikasi.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  t_purchase_request_notifikasi.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  t_purchase_request_notifikasi.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  t_purchase_request_notifikasi.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  t_purchase_request_notifikasi.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  t_purchase_request_notifikasi.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  t_purchase_request_notifikasi.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  t_purchase_request_notifikasi.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}

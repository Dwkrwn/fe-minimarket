// Hooks for t_purchase_request_close_notifikasi model
import t_purchase_request_close_notifikasi from '../models/t_purchase_request_close_notifikasi.js';

export function registert_purchase_request_close_notifikasiHooks() {
  // beforeValidate
  t_purchase_request_close_notifikasi.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
  });

  // afterValidate
  t_purchase_request_close_notifikasi.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  t_purchase_request_close_notifikasi.addHook("beforeCreate", async (instance, options) => {
    console.log("\n===== [HOOK beforeCreate t_purchase_request_close_notifikasi] =====");

    try {
      const models = instance.sequelize.models;

      console.log("[1] Data notifikasi yang masuk:", instance.dataValues);

      if (!instance.t_purchase_request_close_id) {
        console.log("[2] t_purchase_request_close_id TIDAK ADA → skip hook");
        return;
      }

      // ✅ SKIP jika ini adalah record APPROVED/REJECT/REVISI (status=true)
      // Karena record ini hanya untuk history, bukan untuk approval baru
      if (instance.status === true) {
        console.log("[2.1] Status = TRUE (history record) → SKIP update PRC status");
        console.log("===== [END HOOK beforeCreate - SKIPPED] =====\n");
        return;
      }

      const prcId = instance.t_purchase_request_close_id;

      // Update semua notif lama
      console.log("[3] Update semua notifikasi lama menjadi TRUE untuk PRC:", prcId);

      await models.t_purchase_request_close_notifikasi.update(
        { status: true },
        {
          where: { t_purchase_request_close_id: prcId },
          transaction: options.transaction,
          logging: (sql) => console.log("[SQL Update Notif Lama] →", sql)
        }
      );

      // Ambil PRC (Purchase Request Close)
      console.log("[4] Mencari t_purchase_request_close:", prcId);

      const prc = await models.t_purchase_request_close.findOne({
        where: { id: prcId },
        transaction: options.transaction,
        logging: (sql) => console.log("[SQL findOne PRC] →", sql)
      });

      if (!prc) {
        console.log("[5] Purchase Request Close tidak ditemukan → skip");
        return;
      }

      console.log("[6] Data PRC ditemukan:", prc.toJSON());

      // Update PRC status HANYA jika notifikasi ini untuk approval (status=false)
      console.log("[7] Update status PRC menjadi IN APPROVAL");

      await prc.update(
        { status: "IN APPROVAL" },
        {
          transaction: options.transaction,
          logging: (sql) => console.log("[SQL update PRC status] →", sql)
        }
      );

      // =============================================
      // AUTO TITLE + MESSAGE FIX — pakai no_preq_close !!!
      // =============================================
      const prcName = prc.no_preq_close;

      const autoTitle = `Request Approval Purchase Request Close: ${prcName}`;
      const autoMessage = `Purchase Request Close "${prcName}" membutuhkan persetujuan.`;

      console.log("[8] Auto generate title & message");

      if (!instance.title) instance.title = autoTitle;
      if (!instance.approval_level) instance.approval_level = 0;
      if (!instance.status_name) instance.status_name = "IN APPROVAL";
      if (!instance.approval_message) instance.approval_message = autoMessage;

      console.log("[9] Final data sebelum create:", instance.dataValues);

      console.log("===== [END HOOK t_purchase_request_close_notifikasi] =====\n");

    } catch (err) {
      console.error("[ERROR HOOK t_purchase_request_close_notifikasi] →", err);
    }
  });

  // afterCreate
  t_purchase_request_close_notifikasi.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  t_purchase_request_close_notifikasi.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  t_purchase_request_close_notifikasi.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
  });

  // beforeUpdate
  t_purchase_request_close_notifikasi.addHook('beforeUpdate', async (instance, options) => {
    // Custom logic sebelum update
  });

  // afterUpdate
  t_purchase_request_close_notifikasi.addHook("afterUpdate", async (instance, options) => {
    console.log("\n===== [HOOK afterUpdate t_purchase_request_close_notifikasi] =====");

    const trx = options.transaction || undefined;
    const models = instance.sequelize.models;

    try {
      console.log("[1] Data notifikasi setelah update:", instance.dataValues);
      console.log("[1.1] Changed fields:", instance.changed());

      if (!instance.t_purchase_request_close_id) {
        console.log("[2] t_purchase_request_close_id tidak ada → STOP");
        return;
      }

      // Skip jika sudah status false (sedang menunggu approval)
      if (instance.status === false) {
        console.log("[2.1] Status masih false (menunggu approval) → SKIP");
        return;
      }

      // Hanya proses jika ada user_approved_id (artinya sudah di-approve oleh seseorang)
      if (!instance.user_approved_id) {
        console.log("[2.2] Belum ada user_approved_id → SKIP");
        return;
      }

      const currentLevel = Number(instance.approval_level);
      console.log("[3] Current Approval Level:", currentLevel, typeof currentLevel);

      // =====================================================
      //  FETCH APPROVAL RULE PRC (m_approval + m_approval_ds)
      // =====================================================
      const approvalRule = await models.m_approval.findOne({
        where: { 
          nama_approval: {
            [models.Sequelize.Op.iLike]: "%PURCHASE REQUEST CLOSE%"
          }
        },
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
        console.log("[4] Approval rule tidak ditemukan → AUTO APPROVE PRC");
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

        await models.t_purchase_request_close.update(
          { status: "APPROVED" },
          { where: { id: instance.t_purchase_request_close_id }, transaction: trx, hooks: false }
        );

        console.log("===== [END afterUpdate → AUTO APPROVED PRC] =====\n");
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

      // Cek apakah ada is_full di level current
      const currentRuleDetail = approvalRule.m_approval_ds.find((d) => Number(d.level) === currentLevel);
      const isFull = currentRuleDetail?.is_full || false;
      console.log("[7.1] Current rule is_full:", isFull);

      // =====================================================
      //  JIKA CURRENT >= MAX ATAU is_full = true → AUTO APPROVE
      // =====================================================
      if (currentLevel >= maxLevel || isFull || levels.length === 1) {
        console.log("➡ Current level adalah level terakhir atau is_full=true → AUTO APPROVE PRC");

        await instance.update(
          { status: true, status_name: "APPROVED" },
          {
            transaction: trx,
            hooks: false,
            logging: (sql) => console.log("[SQL update notif] →", sql),
          }
        );

        const prc = await models.t_purchase_request_close.findOne({
          where: { id: instance.t_purchase_request_close_id },
          include: [
            {
              model: models.t_purchase_request,
              attributes: ['id']
            }
          ],
          transaction: trx,
          logging: (sql) => console.log("[SQL find PRC] →", sql),
        });

        if (prc) {
          console.log("➡ Update t_purchase_request_close → APPROVED");

          await prc.update(
            { status: "APPROVED" },
            {
              transaction: trx,
              hooks: false,
              logging: (sql) => console.log("[SQL update PRC APPROVED] →", sql),
            }
          );

          // Update PR status_transaksi menjadi CLOSED
          if (prc.t_purchase_request) {
            console.log("➡ Update t_purchase_request status_transaksi → CLOSED");
            
            await models.t_purchase_request.update(
              { status_transaksi: "CLOSED" },
              {
                where: { id: prc.t_purchase_request.id },
                transaction: trx,
                hooks: false,
                logging: (sql) => console.log("[SQL update PR CLOSED] →", sql),
              }
            );
          }
        }

        console.log("===== [END afterUpdate → AUTO APPROVED PRC] =====\n");
        return;
      }

      // =====================================================
      //  MASIH ADA LEVEL SELANJUTNYA → STOP
      // =====================================================
      console.log("➡ Masih ada level berikutnya → tidak di-approve otomatis");

      console.log("===== [END afterUpdate no auto-approve PRC] =====\n");

    } catch (err) {
      console.error("[ERROR afterUpdate t_purchase_request_close_notifikasi] →", err);
    }
  });

  // beforeSave
  t_purchase_request_close_notifikasi.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  t_purchase_request_close_notifikasi.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  t_purchase_request_close_notifikasi.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  t_purchase_request_close_notifikasi.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  t_purchase_request_close_notifikasi.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  t_purchase_request_close_notifikasi.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  t_purchase_request_close_notifikasi.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  t_purchase_request_close_notifikasi.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}

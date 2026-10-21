// Controller for t_purchase_request_close
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_request_close
//
// Tambahkan custom function di bawah ini

export const t_purchase_request_closeController = {
  // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
  async uploadImage(req, res) {
    const fileFields = Object.keys(req.models.t_purchase_request_close.rawAttributes).filter(
      key => req.models.t_purchase_request_close.rawAttributes[key].type && req.models.t_purchase_request_close.rawAttributes[key].type.key === 'STRING'
    );
    let data = req.body;
    if (fileFields.length > 0 && req.files && req.files.length > 0) {
      for (const field of fileFields) {
        const fileObj = req.files.find(f => f.fieldname === field);
        if (fileObj && fileObj.path) {
          // Simpan path apa adanya dari multer
          data[field] = fileObj.path;
        }
      }
    }
    try {
      const inserted = await req.models.t_purchase_request_close.create(data);
      res.json({ message: 'Image uploaded', data: inserted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Contoh: Import Excel ke database
  async importExcel(req, res) {
    if (!req.excelData) return res.status(400).json({ error: 'No Excel data' });
    const [header, ...rows] = req.excelData;
    const records = rows.map(row => Object.fromEntries(header.map((h, i) => [h, row[i]])));
    try {
      const inserted = await req.models.t_purchase_request_close.bulkCreate(records);
      res.json({ message: 'Excel imported', data: inserted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Contoh: Custom function
  async customFunction(req, res) {
    res.json({ message: 'Custom function untuk t_purchase_request_close', body: req.body, query: req.query });
  },

  // =====================================================================
  // APPROVE (DINAMIS LEVEL + is_full)
  // =====================================================================
  async approve(req, res) {
    const debugLogs = []; // Array untuk simpan semua log debug
    
    try {
      const {
        purchase_request_close_id,
        purchase_request_close_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id,
        sender_id,
        m_approval_id
      } = req.body;

      // ------------------ VALIDASI DASAR ------------------
      if (
        !purchase_request_close_id ||
        !purchase_request_close_notifikasi_id ||
        approval_level === undefined ||
        !user_approved_id ||
        !m_approval_id
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "purchase_request_close_id, purchase_request_close_notifikasi_id, approval_level, user_approved_id, dan m_approval_id wajib diisi"
        });
      }

      const {
        t_purchase_request_close,
        t_purchase_request_close_notifikasi,
        m_approval_d
      } = req.models;

      // ------------------ AMBIL RULE APPROVAL ------------------
      const approvalDetails = await m_approval_d.findAll({
        where: {
          m_approval_id: m_approval_id,
          is_active: true
        },
        order: [["level", "ASC"]]
      });

      if (!approvalDetails || approvalDetails.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "Approval rule tidak ditemukan untuk m_approval_id tersebut"
        });
      }

      // cari rule level saat ini
      const currentLevel = Number(approval_level);
      const currentRuleIndex = approvalDetails.findIndex(
        (r) => Number(r.level) === currentLevel
      );

      if (currentRuleIndex === -1) {
        return res.status(400).json({
          status: "error",
          message: `Approval rule untuk level ${currentLevel} tidak ditemukan`
        });
      }

      const currentRule = approvalDetails[currentRuleIndex];
      const isFull = !!currentRule.is_full;

      // cari next rule (kalau ada)
      const nextRule = approvalDetails[currentRuleIndex + 1] || null;
      
      // ✅ FIX: Jika approval rule cuma punya 1 level, otomatis jadikan last level
      const isLastLevel = isFull || !nextRule || approvalDetails.length === 1;

      debugLogs.push({
        step: "APPROVAL DEBUG",
        data: {
          currentLevel,
          currentRuleIndex,
          totalLevels: approvalDetails.length,
          isFull,
          hasNextRule: !!nextRule,
          isLastLevel
        }
      });

      // ------------------ GET OLD NOTIFICATION ------------------
      const oldNotif = await t_purchase_request_close_notifikasi.findOne({
        where: { id: purchase_request_close_notifikasi_id }
      });

      if (!oldNotif) {
        return res.status(404).json({
          status: "error",
          message: "Notification not found"
        });
      }

      const oldSenderId = oldNotif.sender_id;

      // ------------------ UPDATE STATUS T_PRC ------------------
      const newStatus = isLastLevel ? "APPROVED" : "IN APPROVAL";

      const updateData = {
        status: newStatus,
        updated_by: user_approved_id
      };

      debugLogs.push({
        step: "UPDATING PRC STATUS",
        data: {
          purchase_request_close_id,
          newStatus,
          isLastLevel
        }
      });

      await t_purchase_request_close.update(
        updateData,
        { where: { id: purchase_request_close_id } }
      );

      // Validasi status PRC berhasil diupdate
      const prcAfterUpdate = await t_purchase_request_close.findByPk(
        purchase_request_close_id,
        { attributes: ['id', 'status'] }
      );

      debugLogs.push({
        step: "PRC STATUS AFTER UPDATE",
        data: {
          expected: newStatus,
          actual: prcAfterUpdate?.status,
          success: prcAfterUpdate?.status === newStatus
        }
      });

      if (!prcAfterUpdate || prcAfterUpdate.status !== newStatus) {
        debugLogs.push({
          step: "ERROR UPDATE PRC STATUS",
          data: {
            expected: newStatus,
            got: prcAfterUpdate?.status
          }
        });
        throw new Error(`Gagal mengubah status Purchase Request Close menjadi ${newStatus}. Silakan coba lagi.`);
      }

      // ------------------ CLOSE NOTIF LAMA & SET USER APPROVED ------------------
      await t_purchase_request_close_notifikasi.update(
        {
          status: true,  // tandai sudah diproses
          status_name: "APPROVED",  // update status name untuk trigger hook
          user_approved_id: user_approved_id  // set user yang approve
        },
        { 
          where: { id: purchase_request_close_notifikasi_id },
          individualHooks: true  // ✅ CRITICAL: trigger afterUpdate hook per instance
        }
      );

      // ------------------ VALIDASI STATUS SUDAH APPROVED ------------------
      const updatedNotif = await t_purchase_request_close_notifikasi.findByPk(
        purchase_request_close_notifikasi_id,
        { attributes: ['status', 'status_name', 'user_approved_id'] }
      );

      debugLogs.push({
        step: "NOTIF AFTER UPDATE",
        data: {
          status: updatedNotif?.status,
          status_name: updatedNotif?.status_name,
          user_approved_id: updatedNotif?.user_approved_id,
          expected_status_name: "APPROVED"
        }
      });

      if (!updatedNotif || updatedNotif.status_name !== "APPROVED" || !updatedNotif.user_approved_id) {
        debugLogs.push({
          step: "ERROR APPROVAL NOTIF",
          data: updatedNotif?.toJSON()
        });
        throw new Error("Gagal mengubah status menjadi APPROVED. Silakan coba lagi.");
      }

      // ------------------ CREATE RECORD BARU UNTUK KEPUTUSAN APPROVED ------------------
      await t_purchase_request_close_notifikasi.create({
        title: "Approved Purchase Request Close",
        approval_message: isLastLevel ? "PR Close telah disetujui" : "Approved, lanjut ke level berikutnya",
        approval_catatan: approval_catatan || null,
        t_purchase_request_close_id: purchase_request_close_id,
        sender_id: oldSenderId,
        approval_level: currentLevel,
        status: true,
        status_name: "APPROVED",
        user_approved_id: user_approved_id
      });

      // ------------------ BUAT NOTIF LEVEL BERIKUTNYA (JIKA ADA) ------------------
      if (!isLastLevel && nextRule) {
        await t_purchase_request_close_notifikasi.create({
          title: "Approval Purchase Request Close",
          approval_message: "Waiting for next approval",
          approval_catatan: "",
          t_purchase_request_close_id: purchase_request_close_id,
          sender_id: user_approved_id,
          approval_level: Number(nextRule.level),
          status: false,
          status_name: "IN APPROVAL",
          user_approved_id: null
        });
      }

      // ------------------ UPDATE STATUS TRANSAKSI PR → CLOSED (JIKA LAST LEVEL) ------------------
      // NOTE: Hook akan handle update PRC status dan PR status_transaksi
      // Kita tidak perlu validasi lagi karena sudah dihandle oleh hook
      if (isLastLevel) {
        debugLogs.push({
          step: "LAST LEVEL DETECTED",
          data: {
            message: "Hook will auto-update PRC to APPROVED and PR to CLOSED"
          }
        });
      }

      return res.json({
        status: "success",
        message: "Purchase Request Close APPROVED",
        data: {
          purchase_request_close_id,
          new_status: newStatus,
          is_last_level: isLastLevel,
          next_level: nextRule ? Number(nextRule.level) : null
        },
        debug: debugLogs
      });

    } catch (error) {
      console.error("APPROVE ERROR:", error);
      return res.status(500).json({ 
        status: "error", 
        message: error.message,
        debug: debugLogs
      });
    }
  },

  // =====================================================================
  // REJECT (TIDAK PAKAI RULE, LANGSUNG FINAL)
  // =====================================================================
  async reject(req, res) {
    try {
      const {
        purchase_request_close_id,
        purchase_request_close_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id
      } = req.body;

      if (
        !purchase_request_close_id ||
        !purchase_request_close_notifikasi_id ||
        approval_level === undefined ||
        !user_approved_id
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "purchase_request_close_id, purchase_request_close_notifikasi_id, approval_level, dan user_approved_id wajib diisi"
        });
      }

      const {
        t_purchase_request_close,
        t_purchase_request_close_notifikasi
      } = req.models;

      const oldNotif = await t_purchase_request_close_notifikasi.findOne({
        where: { id: purchase_request_close_notifikasi_id }
      });

      if (!oldNotif) {
        return res.status(404).json({
          status: "error",
          message: "Notification not found"
        });
      }

      // UPDATE PRC → REJECT
      await t_purchase_request_close.update(
        {
          status: "REJECT",
          updated_by: user_approved_id
        },
        { where: { id: purchase_request_close_id } }
      );

      // ------------------ CLOSE NOTIF LAMA (JANGAN UBAH status_name) ------------------
      await t_purchase_request_close_notifikasi.update(
        {
          status: true  // hanya tandai sudah diproses
        },
        { where: { id: purchase_request_close_notifikasi_id } }
      );

      // ------------------ CREATE RECORD BARU UNTUK KEPUTUSAN REJECT ------------------
      await t_purchase_request_close_notifikasi.create({
        title: "Rejected Purchase Request Close",
        approval_message: "PR Close ditolak",
        approval_catatan: approval_catatan || null,
        t_purchase_request_close_id: purchase_request_close_id,
        sender_id: oldNotif.sender_id,
        approval_level: approval_level,
        status: true,
        status_name: "REJECT",
        user_approved_id: user_approved_id
      });

      return res.json({
        status: "success",
        message: "Purchase Request Close REJECTED",
        data: {
          purchase_request_close_id,
          new_status: "REJECT"
        }
      });

    } catch (error) {
      console.error("REJECT ERROR:", error);
      return res.status(500).json({ status: "error", message: error.message });
    }
  },

  // =====================================================================
  // REVISI (CREATE RECORD BARU UNTUK KEPUTUSAN ATASAN)
  // =====================================================================
  async revisi(req, res) {
    try {
      const {
        purchase_request_close_id,
        purchase_request_close_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id
      } = req.body;

      if (
        !purchase_request_close_id ||
        !purchase_request_close_notifikasi_id ||
        approval_level === undefined ||
        !user_approved_id
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "purchase_request_close_id, purchase_request_close_notifikasi_id, approval_level, dan user_approved_id wajib diisi"
        });
      }

      const {
        t_purchase_request_close,
        t_purchase_request_close_notifikasi
      } = req.models;

      const oldNotif = await t_purchase_request_close_notifikasi.findOne({
        where: { id: purchase_request_close_notifikasi_id }
      });

      if (!oldNotif) {
        return res.status(404).json({
          status: "error",
          message: "Notification not found"
        });
      }

      // ============================
      // UPDATE PRC → REVISI
      // ============================
      await t_purchase_request_close.update(
        {
          status: "REVISI",
          updated_by: user_approved_id
        },
        { where: { id: purchase_request_close_id } }
      );

      // ============================
      // CLOSE NOTIF PENGAJU (SET status=true)
      // ============================
      await t_purchase_request_close_notifikasi.update(
        {
          status: true
        },
        { where: { id: purchase_request_close_notifikasi_id } }
      );

      // ============================
      // CREATE RECORD BARU UNTUK NOTIFIKASI REVISI KE PENGAJU
      // ============================
      await t_purchase_request_close_notifikasi.create({
        title: "Revisi Purchase Request Close",
        approval_message: "PR Close membutuhkan revisi",
        approval_catatan: approval_catatan || null,
        t_purchase_request_close_id: purchase_request_close_id,
        sender_id: oldNotif.sender_id,       // pengaju awal (supaya muncul di notif dia)
        approval_level: approval_level,       // level atasan yang revisi
        status: false,                        // ✅ FALSE = belum diproses, muncul di notif pengaju
        status_name: "REVISI",
        user_approved_id: user_approved_id    // atasan yang minta revisi
      });

      return res.json({
        status: "success",
        message: "Purchase Request Close REVISED",
        update_status_to: "REVISI",
        data: {
          purchase_request_close_id,
          new_status: "REVISI"
        }
      });

    } catch (error) {
      console.error("REVISI ERROR:", error);
      return res.status(500).json({ status: "error", message: error.message });
    }
  }
};



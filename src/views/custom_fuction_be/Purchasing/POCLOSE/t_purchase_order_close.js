// Controller for t_purchase_order_close
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_order_close
//
// Tambahkan custom function di bawah ini

export const t_purchase_order_closeController = {
  // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
  async uploadImage(req, res) {
    const fileFields = Object.keys(req.models.t_purchase_order_close.rawAttributes).filter(
      key => req.models.t_purchase_order_close.rawAttributes[key].type && req.models.t_purchase_order_close.rawAttributes[key].type.key === 'STRING'
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
      const inserted = await req.models.t_purchase_order_close.create(data);
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
      const inserted = await req.models.t_purchase_order_close.bulkCreate(records);
      res.json({ message: 'Excel imported', data: inserted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Contoh: Custom function
  async customFunction(req, res) {
    res.json({ message: 'Custom function untuk t_purchase_order_close', body: req.body, query: req.query });
  },

  // =====================================================================
  // APPROVE POC (DINAMIS LEVEL + is_full)
  // =====================================================================
  async approve(req, res) {
    try {
      const {
        t_purchase_order_close_id,
        t_purchase_order_close_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id,
        sender_id,
        m_approval_id
      } = req.body;

      // Alias untuk backward compatibility
      const purchase_order_close_id = t_purchase_order_close_id;
      const purchase_order_close_notifikasi_id = t_purchase_order_close_notifikasi_id;

      // ------------------ VALIDASI DASAR ------------------
      if (
        !purchase_order_close_id ||
        !purchase_order_close_notifikasi_id ||
        approval_level === undefined ||
        !user_approved_id ||
        !m_approval_id
      ) {
        return res.status(400).json({
          status: "error",
          message: "t_purchase_order_close_id, t_purchase_order_close_notifikasi_id, approval_level, user_approved_id, dan m_approval_id wajib diisi"
        });
      }

      const {
        t_purchase_order_close,
        t_purchase_order_close_notifikasi,
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
      const isLastLevel = isFull || !nextRule;

      // ------------------ GET OLD NOTIFICATION ------------------
      const oldNotif = await t_purchase_order_close_notifikasi.findOne({
        where: {
          id: purchase_order_close_notifikasi_id
        }
      });

      if (!oldNotif) {
        return res.status(404).json({
          status: "error",
          message: "Notification not found"
        });
      }

      const oldSenderId = oldNotif.sender_id;

      // ------------------ UPDATE STATUS POC ------------------
      const newStatus = isLastLevel ? "APPROVED" : "IN APPROVAL";

      await t_purchase_order_close.update({
        status: newStatus,
        updated_by: user_approved_id
      }, {
        where: {
          id: purchase_order_close_id
        }
      });

      // ------------------ CLOSE NOTIF LAMA ------------------
      await t_purchase_order_close_notifikasi.update({
        status: true
      }, {
        where: {
          id: purchase_order_close_notifikasi_id
        }
      });

      // ------------------ CREATE RECORD BARU UNTUK KEPUTUSAN APPROVED ------------------
      await t_purchase_order_close_notifikasi.create({
        title: "Approved Purchase Order Close",
        approval_message: isLastLevel ? "PO Close telah disetujui" : "Approved, lanjut ke level berikutnya",
        approval_catatan: approval_catatan || null,
        t_purchase_order_close_id: purchase_order_close_id,
        sender_id: oldSenderId,
        approval_level: currentLevel,
        status: true,
        status_name: "APPROVED",
        user_approved_id: user_approved_id
      });

      // ------------------ BUAT NOTIF LEVEL BERIKUTNYA (JIKA ADA) ------------------
      if (!isLastLevel && nextRule) {
        await t_purchase_order_close_notifikasi.create({
          title: "Approval Purchase Order Close",
          approval_message: "Waiting for next approval",
          approval_catatan: "",
          t_purchase_order_close_id: purchase_order_close_id,
          sender_id: user_approved_id,
          approval_level: Number(nextRule.level),
          status: false,
          status_name: "IN APPROVAL",
          user_approved_id: null
        });
      }

      // ------------------ UPDATE PO STATUS_TRANSAKSI (JIKA LAST LEVEL) ------------------
      if (isLastLevel) {
        // Get POC data untuk ambil t_purchase_order_id
        const pocData = await t_purchase_order_close.findByPk(purchase_order_close_id, {
          attributes: ['id', 'no_po_close', 't_purchase_order_id']
        });
        
        if (!pocData || !pocData.t_purchase_order_id) {
          throw new Error('Data PO Close tidak ditemukan atau t_purchase_order_id kosong!');
        }

        const t_purchase_order = req.models.t_purchase_order;
        if (!t_purchase_order) {
          throw new Error('Model t_purchase_order tidak ditemukan!');
        }

        // Update PO status_transaksi to CLOSED
        const [updatedCount] = await t_purchase_order.update(
          { 
            status_transaksi: 'CLOSED',
            updated_by: user_approved_id
          },
          { where: { id: pocData.t_purchase_order_id } }
        );

        if (updatedCount === 0) {
          throw new Error(`Gagal update status_transaksi PO menjadi CLOSED untuk PO ID: ${pocData.t_purchase_order_id}`);
        }

        console.log(`✅ PO ${pocData.t_purchase_order_id} status_transaksi updated to CLOSED by POC ${pocData.no_po_close}`);
      }

      return res.json({
        status: "success",
        message: "Purchase Order Close APPROVED",
        data: {
          purchase_order_close_id,
          new_status: newStatus,
          is_last_level: isLastLevel,
          next_level: nextRule ? Number(nextRule.level) : null
        }
      });

    } catch (error) {
      console.error("APPROVE POC ERROR:", error);
      return res.status(500).json({
        status: "error",
        message: error.message
      });
    }
  },

  // =====================================================================
  // REJECT POC (TIDAK PAKAI RULE, LANGSUNG FINAL)
  // =====================================================================
  async reject(req, res) {
    try {
      const {
        t_purchase_order_close_id,
        t_purchase_order_close_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id
      } = req.body;

      // Alias untuk backward compatibility
      const purchase_order_close_id = t_purchase_order_close_id;
      const purchase_order_close_notifikasi_id = t_purchase_order_close_notifikasi_id;

      if (
        !purchase_order_close_id ||
        !purchase_order_close_notifikasi_id ||
        approval_level === undefined ||
        !user_approved_id
      ) {
        return res.status(400).json({
          status: "error",
          message: "t_purchase_order_close_id, t_purchase_order_close_notifikasi_id, approval_level, dan user_approved_id wajib diisi"
        });
      }

      const {
        t_purchase_order_close,
        t_purchase_order_close_notifikasi
      } = req.models;

      const oldNotif = await t_purchase_order_close_notifikasi.findOne({
        where: {
          id: purchase_order_close_notifikasi_id
        }
      });

      if (!oldNotif) {
        return res.status(404).json({
          status: "error",
          message: "Notification not found"
        });
      }

      // UPDATE POC → REJECT
      await t_purchase_order_close.update({
        status: "REJECT",
        updated_by: user_approved_id
      }, {
        where: {
          id: purchase_order_close_id
        }
      });

      // ------------------ CLOSE NOTIF LAMA ------------------
      await t_purchase_order_close_notifikasi.update({
        status: true
      }, {
        where: {
          id: purchase_order_close_notifikasi_id
        }
      });

      // ------------------ CREATE RECORD BARU UNTUK KEPUTUSAN REJECT ------------------
      await t_purchase_order_close_notifikasi.create({
        title: "Rejected Purchase Order Close",
        approval_message: "PO Close ditolak",
        approval_catatan: approval_catatan || null,
        t_purchase_order_close_id: purchase_order_close_id,
        sender_id: oldNotif.sender_id,
        approval_level: approval_level,
        status: true,
        status_name: "REJECT",
        user_approved_id: user_approved_id
      });

      return res.json({
        status: "success",
        message: "Purchase Order Close REJECTED",
        data: {
          purchase_order_close_id,
          new_status: "REJECT"
        }
      });

    } catch (error) {
      console.error("REJECT POC ERROR:", error);
      return res.status(500).json({
        status: "error",
        message: error.message
      });
    }
  },

  // =====================================================================
  // REVISI POC (CREATE RECORD BARU UNTUK KEPUTUSAN ATASAN)
  // =====================================================================
  async revisi(req, res) {
    try {
      const {
        t_purchase_order_close_id,
        t_purchase_order_close_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id
      } = req.body;

      // Alias untuk backward compatibility
      const purchase_order_close_id = t_purchase_order_close_id;
      const purchase_order_close_notifikasi_id = t_purchase_order_close_notifikasi_id;

      if (
        !purchase_order_close_id ||
        !purchase_order_close_notifikasi_id ||
        approval_level === undefined ||
        !user_approved_id
      ) {
        return res.status(400).json({
          status: "error",
          message: "t_purchase_order_close_id, t_purchase_order_close_notifikasi_id, approval_level, dan user_approved_id wajib diisi"
        });
      }

      const {
        t_purchase_order_close,
        t_purchase_order_close_notifikasi
      } = req.models;

      const oldNotif = await t_purchase_order_close_notifikasi.findOne({
        where: {
          id: purchase_order_close_notifikasi_id
        }
      });

      if (!oldNotif) {
        return res.status(404).json({
          status: "error",
          message: "Notification not found"
        });
      }

      // UPDATE POC → REVISI
      await t_purchase_order_close.update({
        status: "REVISI",
        updated_by: user_approved_id
      }, {
        where: {
          id: purchase_order_close_id
        }
      });

      // CLOSE NOTIF PENGAJU (SET status=true)
      await t_purchase_order_close_notifikasi.update({
        status: true
      }, {
        where: {
          id: purchase_order_close_notifikasi_id
        }
      });

      // CREATE RECORD BARU UNTUK NOTIFIKASI REVISI KE PENGAJU
      await t_purchase_order_close_notifikasi.create({
        title: "Revisi Purchase Order Close",
        approval_message: "PO Close membutuhkan revisi",
        approval_catatan: approval_catatan || null,
        t_purchase_order_close_id: purchase_order_close_id,
        sender_id: oldNotif.sender_id,
        approval_level: approval_level,
        status: false, // FALSE = belum diproses, muncul di notif pengaju
        status_name: "REVISI",
        user_approved_id: user_approved_id
      });

      return res.json({
        status: "success",
        message: "Purchase Order Close REVISED",
        update_status_to: "REVISI",
        data: {
          purchase_order_close_id,
          new_status: "REVISI"
        }
      });

    } catch (error) {
      console.error("REVISI POC ERROR:", error);
      return res.status(500).json({
        status: "error",
        message: error.message
      });
    }
  }
};

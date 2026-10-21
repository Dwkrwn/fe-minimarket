// Controller for t_purchase_request
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_request
//
// Tambahkan custom function di bawah ini

export const t_purchase_requestController = {
  // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
  async uploadImage(req, res) {
    const fileFields = Object.keys(req.models.t_purchase_request.rawAttributes).filter(
      key => req.models.t_purchase_request.rawAttributes[key].type && req.models.t_purchase_request.rawAttributes[key].type.key === 'STRING'
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
      const inserted = await req.models.t_purchase_request.create(data);
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
      const inserted = await req.models.t_purchase_request.bulkCreate(records);
      res.json({ message: 'Excel imported', data: inserted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Contoh: Custom function
  async customFunction(req, res) {
    res.json({ message: 'Custom function untuk t_purchase_request', body: req.body, query: req.query });
  },

  // =====================================================================
  // GET FOR CLOSED - Get APPROVED PR yang belum pernah di-close
  // =====================================================================
  async GetForClosed(req, res) {
    try {
      const {
        page = 1,
        paginate = 20,
        order_by = 'createdAt',
        order_type = 'DESC',
        filter_column_status = 'APPROVED'
      } = req.query;

      const {
        t_purchase_request,
        t_purchase_request_d,
        t_purchase_request_close,
        t_purchase_order_d,
        m_unit_bisnis
      } = req.models;

      // Build where clause
      const whereClause = {
        status: filter_column_status
      };

      // Pagination
      const limit = parseInt(paginate);
      const offset = (parseInt(page) - 1) * limit;

      // Order
      const order = [[order_by, order_type.toUpperCase()]];

      // Step 1: Get all PR IDs yang sudah pernah di-close
      const closedPRIds = await t_purchase_request_close.findAll({
        attributes: ['t_purchase_request_id'],
        raw: true
      });

      const closedIds = closedPRIds.map(item => item.t_purchase_request_id).filter(Boolean);

      // Step 2: Add NOT IN clause untuk exclude yang sudah di-close
      if (closedIds.length > 0) {
        whereClause.id = {
          [t_purchase_request.sequelize.Sequelize.Op.notIn]: closedIds
        };
      }

      // Step 3: Query dengan where clause yang sudah di-filter
      const { count, rows } = await t_purchase_request.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: m_unit_bisnis,
            attributes: [
              'id',
              'kode_unit_bisnis',
              'is_active',
              'nama_comp',
              'provinsi',
              'kota',
              'kecamatan',
              'kodepos',
              'email',
              'pic',
              'no_telp_pic',
              'catatan',
              'created_by',
              'updated_by',
              'createdAt',
              'updatedAt'
            ]
          },
          {
            model: t_purchase_request_d,
            attributes: [
              'id',
              't_purchase_request_id',
              'm_items_id',
              'qty_pr',
              'alasan',
              'catatan',
              'created_by',
              'updated_by',
              'createdAt',
              'updatedAt'
            ]
          }
        ],
        order,
        limit,
        offset,
        distinct: true
      });

      const totalPages = Math.ceil(count / limit);

      // Format response + Add PO ID info
      const formattedData = await Promise.all(rows.map(async (pr) => {
        const prJson = pr.toJSON();
        
        // Get PO ID from t_purchase_order_d
        const poDetail = await t_purchase_order_d.findOne({
          where: { t_purchase_request_id: prJson.id },
          attributes: ['t_purchase_order_id'],
          raw: true
        });
        
        prJson.t_purchase_order_id = poDetail?.t_purchase_order_id || null;
        return prJson;
      }));

      return res.json({
        status: 'success',
        data: formattedData,
        pagination: {
          total: count,
          page: parseInt(page),
          totalPages: totalPages,
          limit: limit,
          currentRowsCount: formattedData.length,
          next_page: parseInt(page) < totalPages ? parseInt(page) + 1 : null,
          prev_page: parseInt(page) > 1 ? parseInt(page) - 1 : null
        }
      });

    } catch (error) {
      console.error('GET FOR CLOSED ERROR:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  },


// =====================================================================
// APPROVE (DINAMIS LEVEL + is_full)
// =====================================================================
async approve(req, res) {
  try {
    const {
      purchase_request_id,
      purchase_request_notifikasi_id,
      approval_level,
      approval_catatan,
      user_approved_id,
      sender_id,
      m_approval_id
    } = req.body;

    // ------------------ VALIDASI DASAR ------------------
    if (
      !purchase_request_id ||
      !purchase_request_notifikasi_id ||
      approval_level === undefined ||
      !user_approved_id ||
      !m_approval_id
    ) {
      return res.status(400).json({
        status: "error",
        message:
          "purchase_request_id, purchase_request_notifikasi_id, approval_level, user_approved_id, dan m_approval_id wajib diisi"
      });
    }

    const {
      t_purchase_request,
      t_purchase_request_notifikasi,
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
    const oldNotif = await t_purchase_request_notifikasi.findOne({
      where: { id: purchase_request_notifikasi_id }
    });

    if (!oldNotif) {
      return res.status(404).json({
        status: "error",
        message: "Notification not found"
      });
    }

    const oldSenderId = oldNotif.sender_id;

    // ------------------ UPDATE STATUS T_PR ------------------
    const newStatus = isLastLevel ? "APPROVED" : "IN APPROVAL";

    console.log(`[APPROVE] Updating PR ${purchase_request_id} to status: ${newStatus}, isLastLevel: ${isLastLevel}`);

    const updateData = {
      status: newStatus,
      updated_by: user_approved_id
    };

    // Use hooks: false to prevent beforeUpdate hook from interfering
    const [affectedRows] = await t_purchase_request.update(
      updateData,
      { 
        where: { id: purchase_request_id },
        hooks: false 
      }
    );

    console.log(`[APPROVE] Affected rows: ${affectedRows}`);

    if (affectedRows === 0) {
      console.log(`[APPROVE] WARNING: No rows updated! Trying direct update...`);
      // Fallback: try findOne + update on instance
      const prInstance = await t_purchase_request.findByPk(purchase_request_id);
      if (prInstance) {
        await prInstance.update(updateData, { hooks: false });
        console.log(`[APPROVE] Direct instance update completed`);
      }
    }

    // ------------------ CLOSE NOTIF LAMA (JANGAN UBAH status_name) ------------------
    await t_purchase_request_notifikasi.update(
      {
        status: true  // hanya tandai sudah diproses
      },
      { 
        where: { id: purchase_request_notifikasi_id },
        hooks: false 
      }
    );

    // ------------------ CREATE RECORD BARU UNTUK KEPUTUSAN APPROVED ------------------
    await t_purchase_request_notifikasi.create({
      title: "Approved Purchase Request",
      approval_message: isLastLevel ? "PR telah disetujui" : "Approved, lanjut ke level berikutnya",
      approval_catatan: approval_catatan || null,
      t_purchase_request_id: purchase_request_id,
      sender_id: oldSenderId,
      approval_level: currentLevel,
      status: true,
      status_name: "APPROVED",
      user_approved_id: user_approved_id
    });

    // ------------------ BUAT NOTIF LEVEL BERIKUTNYA (JIKA ADA) ------------------
    if (!isLastLevel && nextRule) {
      await t_purchase_request_notifikasi.create({
        title: "Approval Purchase Request",
        approval_message: "Waiting for next approval",
        approval_catatan: "",
        t_purchase_request_id: purchase_request_id,
        sender_id: user_approved_id,
        approval_level: Number(nextRule.level),
        status: false,
        status_name: "IN APPROVAL",
        user_approved_id: null
      });
    }

    return res.json({
      status: "success",
      message: "Purchase Request APPROVED",
      data: {
        purchase_request_id,
        new_status: newStatus,
        is_last_level: isLastLevel,
        next_level: nextRule ? Number(nextRule.level) : null
      }
    });

  } catch (error) {
    console.error("APPROVE ERROR:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
},

// =====================================================================
// REJECT (TIDAK PAKAI RULE, LANGSUNG FINAL)
// =====================================================================
async reject(req, res) {
  try {
    const {
      purchase_request_id,
      purchase_request_notifikasi_id,
      approval_level,
      approval_catatan,
      user_approved_id
    } = req.body;

    if (
      !purchase_request_id ||
      !purchase_request_notifikasi_id ||
      approval_level === undefined ||
      !user_approved_id
    ) {
      return res.status(400).json({
        status: "error",
        message:
          "purchase_request_id, purchase_request_notifikasi_id, approval_level, dan user_approved_id wajib diisi"
      });
    }

    const {
      t_purchase_request,
      t_purchase_request_notifikasi
    } = req.models;

    const oldNotif = await t_purchase_request_notifikasi.findOne({
      where: { id: purchase_request_notifikasi_id }
    });

    if (!oldNotif) {
      return res.status(404).json({
        status: "error",
        message: "Notification not found"
      });
    }

    // UPDATE PR → REJECT
    await t_purchase_request.update(
      {
        status: "REJECT",
        updated_by: user_approved_id
      },
      { where: { id: purchase_request_id } }
    );

    // ------------------ CLOSE NOTIF LAMA (JANGAN UBAH status_name) ------------------
    await t_purchase_request_notifikasi.update(
      {
        status: true  // hanya tandai sudah diproses
      },
      { where: { id: purchase_request_notifikasi_id } }
    );

    // ------------------ CREATE RECORD BARU UNTUK KEPUTUSAN REJECT ------------------
    await t_purchase_request_notifikasi.create({
      title: "Rejected Purchase Request",
      approval_message: "PR ditolak",
      approval_catatan: approval_catatan || null,
      t_purchase_request_id: purchase_request_id,
      sender_id: oldNotif.sender_id,
      approval_level: approval_level,
      status: true,
      status_name: "REJECT",
      user_approved_id: user_approved_id
    });

    return res.json({
      status: "success",
      message: "Purchase Request REJECTED",
      data: {
        purchase_request_id,
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
      purchase_request_id,
      purchase_request_notifikasi_id,
      approval_level,
      approval_catatan,
      user_approved_id
    } = req.body;

    if (
      !purchase_request_id ||
      !purchase_request_notifikasi_id ||
      approval_level === undefined ||
      !user_approved_id
    ) {
      return res.status(400).json({
        status: "error",
        message:
          "purchase_request_id, purchase_request_notifikasi_id, approval_level, dan user_approved_id wajib diisi"
      });
    }

    const {
      t_purchase_request,
      t_purchase_request_notifikasi
    } = req.models;

    const oldNotif = await t_purchase_request_notifikasi.findOne({
      where: { id: purchase_request_notifikasi_id }
    });

    if (!oldNotif) {
      return res.status(404).json({
        status: "error",
        message: "Notification not found"
      });
    }

    // ============================
    // UPDATE PR → REVISI
    // ============================
    await t_purchase_request.update(
      {
        status: "REVISI",
        updated_by: user_approved_id
      },
      { where: { id: purchase_request_id } }
    );

    // ============================
    // CLOSE NOTIF PENGAJU (SET status=true)
    // ============================
    await t_purchase_request_notifikasi.update(
      {
        status: true
      },
      { where: { id: purchase_request_notifikasi_id } }
    );

    // ============================
    // CREATE RECORD BARU UNTUK NOTIFIKASI REVISI KE PENGAJU
    // ============================
    await t_purchase_request_notifikasi.create({
      title: "Revisi Purchase Request",
      approval_message: "PR membutuhkan revisi",
      approval_catatan: approval_catatan || null,
      t_purchase_request_id: purchase_request_id,
      sender_id: oldNotif.sender_id,       // pengaju awal (supaya muncul di notif dia)
      approval_level: approval_level,       // level atasan yang revisi
      status: false,                        // ✅ FALSE = belum diproses, muncul di notif pengaju
      status_name: "REVISI",
      user_approved_id: user_approved_id    // atasan yang minta revisi
    });

    return res.json({
      status: "success",
      message: "Purchase Request REVISED",
      update_status_to: "REVISI",
      data: {
        purchase_request_id,
        new_status: "REVISI"
      }
    });

  } catch (error) {
    console.error("REVISI ERROR:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
}


};

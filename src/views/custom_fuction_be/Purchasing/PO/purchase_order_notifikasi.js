// Controller for t_purchase_order_notifikasi
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_order_notifikasi
//
// Tambahkan custom function di bawah ini

export const t_purchase_order_notifikasiController = {
  // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
  async uploadImage(req, res) {
    const fileFields = Object.keys(req.models.t_purchase_order_notifikasi.rawAttributes).filter(
      key => req.models.t_purchase_order_notifikasi.rawAttributes[key].type && req.models.t_purchase_order_notifikasi.rawAttributes[key].type.key === 'STRING'
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
      const inserted = await req.models.t_purchase_order_notifikasi.create(data);
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
      const inserted = await req.models.t_purchase_order_notifikasi.bulkCreate(records);
      res.json({ message: 'Excel imported', data: inserted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Contoh: Custom function
  async customFunction(req, res) {
    res.json({ message: 'Custom function untuk t_purchase_order_notifikasi', body: req.body, query: req.query });
  },




async getUserApprovalPurchaseOrder(req, res) {
  try {
    console.log("🔥 START GET USER APPROVAL PO");

    const userId = req.query.id || req.params.id;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    if (!userId) {
      return res.status(400).json({
        status: "error",
        message: "Missing user ID"
      });
    }

    const {
      t_purchase_order,
      t_purchase_order_d,
      t_purchase_order_notifikasi,
      t_purchase_order_lampiran,
      user_default,
      m_items,
      m_general,
      m_supplier,
      m_currency,
      m_currency_d,
      money
    } = req.models;

    console.log("➡ Models OK");

    // =======================================================
    // GET USER APPROVAL RULES (DARI CONTROLLER m_approval)
    // =======================================================
    let approvalRaw = null;
    
    // Import m_approvalController
    const { m_approvalController } = await import('../controllers/m_approvalController.js');
    
    const fakeReq = { query: { id: userId }, models: req.models };
    const fakeRes = {
      status: (code) => fakeRes,  // Return self for method chaining
      json: (d) => (approvalRaw = d)
    };
    await m_approvalController.getUserApprovalData(fakeReq, fakeRes);

    console.log("📌 approvalRaw:", JSON.stringify(approvalRaw, null, 2));

    if (!approvalRaw || !approvalRaw.menu) {
      console.log("⚠️ No approval menu found for user");
      return res.json({ status: "success", approval: [], pagination: null });
    }

    // AMBIL HANYA MENU PO
    const menus = approvalRaw.menu.filter(
      m => m.menu_path && m.menu_path.toLowerCase().includes("t_purchase_order")
    );

    console.log("📌 PO menu:", menus.length);
    console.log("📌 PO menu details:", JSON.stringify(menus, null, 2));

    if (menus.length === 0) {
      return res.json({
        status: "success",
        approval: [],
        pagination: null
      });
    }

    // =======================================================
    // UNION RESULT
    // =======================================================
    let results = [];
    const seen = new Set();

    // =======================================================
    // LOOP LEVEL APPROVAL USER
    // =======================================================
    for (const menu of menus) {
      const userLevel = Number(menu.level);
      if (isNaN(userLevel)) continue;

      const targetLevel = userLevel - 1;
      if (targetLevel < 0) continue;

      console.log(`🔎 Level user=${userLevel}, target=${targetLevel}`);

      // =======================================================
      // QUERY DASAR (TANPA FILTER ADVANCED)
      // =======================================================
      const notifList = await t_purchase_order_notifikasi.findAll({
        where: {
          approval_level: targetLevel,
          status: false // BELUM APPROVE
        },
        include: [
          { model: user_default, as: "tpo_sender", attributes: ["id", "name"] },
          { model: user_default, as: "tpo_approval", attributes: ["id", "name"] },
          {
            model: t_purchase_order,
            required: true,
            where: {
              status: ["IN APPROVAL", "WAITING", "PENDING"]
            },
            include: [
              { model: m_general, as: "top_po" },
              { model: m_supplier },
              { model: user_default, as: "po_ctr", attributes: ["id", "name"] },
              { model: user_default, as: "po_updt", attributes: ["id", "name"] },
              // Include currency data with symbol (money)
              { 
                model: m_currency, 
                as: "uang_po",
                include: [
                  { 
                    model: money,
                    attributes: ["id", "group", "key1", "code", "value1", "value2", "value3", "value4", "value5", "is_active"]
                  }
                ]
              },
              {
                model: m_currency_d,
                as: "det_uang_po"
              }
            ]
          }
        ],
        order: [["createdAt", "DESC"]]
      });

      console.log(`📌 Ditemukan ${notifList.length} notif di DB`);

      // =======================================================
      // FILTER MANUAL (PENGGANTI Op DAN literal)
      // =======================================================
      const filtered = notifList.filter((n) => {
        const data = n.toJSON();

        // NOTE: sender_id TIDAK di-filter, karena user bisa approve ajuan sendiri
        // jika punya level approval > 0

        // status revisi tidak boleh masuk
        if (data.status_name === "WAITING REVISE") {
          return false;
        }

        // sudah di-approve oleh orang lain tidak boleh muncul
        if (data.user_approved_id) {
          return false;
        }

        return true;
      });

      console.log(`👉 Setelah filter: ${filtered.length}`);

      // SIMPAN TANPA DUPLIKAT
      for (const notif of filtered) {
        if (!seen.has(notif.id)) {
          seen.add(notif.id);
          results.push({
            ...notif.toJSON(),
            menu_info: menu
          });
        }
      }
    }

    console.log("📌 FINAL RESULT:", results.length);

    // =======================================================
    // PAGINATION FINAL
    // =======================================================
    const total = results.length;
    const totalPages = Math.ceil(total / limit);

    const paginated = results.slice(offset, offset + limit);

    return res.json({
      status: "success",
      approval: paginated,
      pagination: {
        total,
        page,
        totalPages,
        limit,
        currentRowsCount: paginated.length,
        next_page: page < totalPages ? page + 1 : null,
        prev_page: page > 1 ? page - 1 : null
      }
    });

  } catch (err) {
    console.error("❌ Fatal Error GET USER APPROVAL PO:", err);
    return res.status(500).json({
      status: "error",
      message: err.message
    });
  }
}









};

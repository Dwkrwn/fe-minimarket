// Controller for t_purchase_order_close_notifikasi
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_order_close_notifikasi
//
// Tambahkan custom function di bawah ini

export const t_purchase_order_close_notifikasiController = {
  // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
  async uploadImage(req, res) {
    const fileFields = Object.keys(req.models.t_purchase_order_close_notifikasi.rawAttributes).filter(
      key => req.models.t_purchase_order_close_notifikasi.rawAttributes[key].type && req.models.t_purchase_order_close_notifikasi.rawAttributes[key].type.key === 'STRING'
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
      const inserted = await req.models.t_purchase_order_close_notifikasi.create(data);
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
      const inserted = await req.models.t_purchase_order_close_notifikasi.bulkCreate(records);
      res.json({ message: 'Excel imported', data: inserted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Contoh: Custom function
  async customFunction(req, res) {
    res.json({ message: 'Custom function untuk t_purchase_order_close_notifikasi', body: req.body, query: req.query });
  },


  // =====================================================================
  // GET USER APPROVAL PURCHASE ORDER CLOSE (untuk approval inbox)
  // =====================================================================
  async getUserApprovalPurchaseOrderClose(req, res) {
    try {
      console.log("🔥 START GET USER APPROVAL POC");

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
        t_purchase_order_close,
        t_purchase_order_close_d,
        t_purchase_order_close_notifikasi,
        t_purchase_order,
        user_default,
        m_items,
        m_supplier,
        m_unit_bisnis,
        m_general
      } = req.models;

      console.log("➡ Models OK");

      // =======================================================
      // GET USER APPROVAL RULES
      // =======================================================
      const { m_approvalController } = await import('../controllers/m_approvalController.js');
      
      let approvalRaw = null;
      const fakeReq = { query: { id: userId }, models: req.models };
      const fakeRes = { json: (d) => (approvalRaw = d) };
      await m_approvalController.getUserApprovalData(fakeReq, fakeRes);

      if (!approvalRaw || !approvalRaw.menu) {
        return res.json({ status: "success", approval: [], pagination: null });
      }

      // AMBIL HANYA MENU POC
      const menus = approvalRaw.menu.filter(
        m => m.menu_path && m.menu_path.toLowerCase().includes("t_purchase_order_close")
      );

      console.log("📌 POC menu:", menus.length);

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
        const notifList = await t_purchase_order_close_notifikasi.findAll({
          where: {
            approval_level: targetLevel,
            status: false // BELUM APPROVE
          },
          include: [
            { model: user_default, as: "tpoc_sender", attributes: ["id", "name"] },
            { model: user_default, as: "tpoc_approval", attributes: ["id", "name"] },

            {
              model: t_purchase_order_close,
              required: true,
              where: {
                status: ["IN APPROVAL", "WAITING", "PENDING"]
              },
              include: [
                { model: m_unit_bisnis, attributes: ["id", "nama_comp"] },
                {
                  model: t_purchase_order,
                  attributes: ["id", "no_po", "tgl_po"],
                  include: [
                    { model: m_supplier, attributes: ["id", "nama_supp"] }
                  ]
                },
                {
                  model: t_purchase_order_close_d,
                  include: [
                    {
                      model: m_items
                    }
                  ]
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
          if (data.status_name === "WAITING REVISE") return false;

          // sudah di-approve oleh orang lain tidak boleh muncul
          if (data.user_approved_id) return false;

          return true;
        });

        console.log(`👉 Setelah filter: ${filtered.length}`);

        // SIMPAN TANPA DUPLIKAT
        for (const notif of filtered) {
          if (!seen.has(notif.id)) {
            seen.add(notif.id);
            
            // FLATTEN DATA: Gabungkan field item ke level detail
            const notifData = notif.toJSON();
            
            // Transform detail items jika ada
            if (notifData.t_purchase_order_close?.t_purchase_order_close_ds) {
              // Ambil semua satuan_id unik untuk query m_general (satuan)
              const satuanIds = notifData.t_purchase_order_close.t_purchase_order_close_ds
                .map(d => d.m_item?.satuan_id || d.m_item?.satuan_)
                .filter(id => id);
              
              // Query m_general untuk satuan
              let satuanMap = {};
              if (satuanIds.length > 0 && m_general) {
                try {
                  const satuanList = await m_general.findAll({
                    where: { id: satuanIds }
                  });
                  satuanMap = Object.fromEntries(
                    satuanList.map(s => [s.id, s.value1 || s.nama_satuan || s.name || '-'])
                  );
                } catch (err) {
                  console.warn("⚠️ Error query satuan dari m_general:", err.message);
                }
              }
              
              notifData.t_purchase_order_close.t_purchase_order_close_ds = 
                notifData.t_purchase_order_close.t_purchase_order_close_ds.map((detail, index) => {
                  const satuanId = detail.m_item?.satuan_id || detail.m_item?.satuan_;
                  
                  return {
                    no: index + 1,
                    id: detail.id,
                    t_purchase_order_close_id: detail.t_purchase_order_close_id,
                    m_items_id: detail.m_items_id,
                    t_penerimaan_barangs_id: detail.t_penerimaan_barangs_id,
                    
                    // Data dari m_item (flatten)
                    kode_item: detail.m_item?.kode_item || detail.m_item?.kode_it || '-',
                    nama_item: detail.m_item?.nama_item || detail.m_item?.nama_it || '-',
                    
                    // Data dari m_general (satuan)
                    nama_satuan: satuanMap[satuanId] || '-',
                    
                    // Data qty
                    qty_close: detail.qty_close || 0,
                    
                    // Catatan
                    catatan: detail.catatan || '-',
                    
                    // Timestamp
                    createdAt: detail.createdAt,
                    updatedAt: detail.updatedAt
                  };
                });
            }
            
            results.push({
              ...notifData,
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
      console.error("❌ Fatal Error GET USER APPROVAL POC:", err);
      return res.status(500).json({
        status: "error",
        message: err.message
      });
    }
  }
};

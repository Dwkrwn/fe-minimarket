// Controller for t_purchase_return_notifikasi
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_return_notifikasi
//
// Tambahkan custom function di bawah ini

export const t_purchase_return_notifikasiController = {
  // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
  async uploadImage(req, res) {
    const fileFields = Object.keys(req.models.t_purchase_return_notifikasi.rawAttributes).filter(
      key => req.models.t_purchase_return_notifikasi.rawAttributes[key].type && req.models.t_purchase_return_notifikasi.rawAttributes[key].type.key === 'STRING'
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
      const inserted = await req.models.t_purchase_return_notifikasi.create(data);
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
      const inserted = await req.models.t_purchase_return_notifikasi.bulkCreate(records);
      res.json({ message: 'Excel imported', data: inserted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Contoh: Custom function
  async customFunction(req, res) {
    res.json({ message: 'Custom function untuk t_purchase_return_notifikasi', body: req.body, query: req.query });
  },

  // =====================================================================
  // GET USER APPROVAL PURCHASE RETURN
  // =====================================================================
  async getUserApprovalPurchaseReturn(req, res) {
    try {
      console.log("🔥 START GET USER APPROVAL PURCHASE RETURN");

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
        t_purchase_return,
        t_purchase_return_d,
        t_purchase_return_notifikasi,
        t_purchase_invoice,
        t_purchase_invoice_d,
        t_purchase_order,
        t_purchase_order_d,
        t_penerimaan_barangs,
        t_penerimaan_barang_d,
        user_default,
        m_items,
        m_general,
        m_unit_bisnis,
        m_supplier,
        m_gudang,
        m_currency,
        m_currency_d
      } = req.models;

      console.log("➡ Models OK");

      // =======================================================
      // GET USER APPROVAL RULES
      // =======================================================
      let approvalRaw = null;

      const { m_approvalController } = await import('../controllers/m_approvalController.js');

      const fakeReq = { query: { id: userId }, models: req.models };
      const fakeRes = {
        status: (code) => fakeRes,
        json: (d) => (approvalRaw = d)
      };
      await m_approvalController.getUserApprovalData(fakeReq, fakeRes);

      console.log("📌 approvalRaw:", JSON.stringify(approvalRaw, null, 2));

      if (!approvalRaw || !approvalRaw.menu) {
        console.log("⚠️ No approval menu found for user");
        return res.json({ status: "success", approval: [], pagination: null });
      }

      // AMBIL HANYA MENU PURCHASE RETURN
      const menus = approvalRaw.menu.filter(
        m => m.menu_path && m.menu_path.toLowerCase().includes("t_purchase_return")
      );

      console.log("📌 PURCHASE RETURN menu:", menus.length);

      if (menus.length === 0) {
        return res.json({
          status: "success",
          approval: [],
          pagination: null
        });
      }

      let results = [];
      const seen = new Set();

      for (const menu of menus) {
        const userLevel = Number(menu.level);
        if (isNaN(userLevel)) continue;

        const targetLevel = userLevel - 1;
        if (targetLevel < 0) continue;

        console.log(`🔎 Level user=${userLevel}, target=${targetLevel}`);

        const notifList = await t_purchase_return_notifikasi.findAll({
          where: {
            approval_level: targetLevel,
            status: false
          },
          include: [
            { model: user_default, as: "tp_return_sender", attributes: ["id", "name"] },
            { model: user_default, as: "tp_return_approval", attributes: ["id", "name"] },
            {
              model: t_purchase_return,
              as: "t_purchase_return",
              required: true,
              where: {
                status: ["IN APPROVAL", "WAITING", "PENDING"]
              },
              include: [
                { model: m_supplier, as: "m_supplier", required: false },
                { 
                  model: m_gudang, 
                  as: "m_gudang", 
                  required: false,
                  attributes: [
                    "id",
                    "nama_gudang",
                    "alamat_gudang",
                    "provinsi",
                    "kota",
                    "kecamatan",
                    "kode_pos"
                  ]
                },
                { model: t_penerimaan_barangs, as: "t_penerimaan_barang", required: false },
                { 
                  model: t_purchase_invoice, 
                  as: "t_purchase_invoice", 
                  required: false,
                  include: [
                    {
                      model: t_purchase_order,
                      as: "t_purchase_order",
                      attributes: ["id", "no_po"],
                      required: false,
                      include: [
                        {
                          model: t_purchase_order_d,
                          required: false
                        }
                      ]
                    }
                  ]
                },
                { 
                  model: m_currency, 
                  as: "m_currency", 
                  required: false,
                  include: [
                    { model: m_currency_d, as: "m_currency_ds", required: false }
                  ]
                },
                { model: m_general, as: "t_pr_retur", attributes: ["id", "value1", "value2", "value3"], required: false },
                { model: m_general, as: "t_pr_ppn", attributes: ["id", "value1", "value2", "value3"], required: false },
                { model: m_general, as: "t_pr_pph", attributes: ["id", "value1", "value2", "value3"], required: false },
                {
                  model: t_purchase_return_d,
                  as: "t_purchase_return_ds",
                  required: false,
                  include: [
                    { 
                      model: m_items, 
                      as: "m_item",
                      attributes: ["id", "kode_item", "nama_item"],
                      required: false,
                      include: [
                        { model: m_general, as: "uom", attributes: ["id", "value1"], required: false }
                      ]
                    },
                    {
                      model: t_purchase_invoice_d,
                      as: "pi_d",
                      attributes: ["id", "qty_pi"],
                      required: false,
                      include: [
                        {
                          model: t_penerimaan_barang_d,
                          attributes: ["id", "qty_diterima"],
                          required: false
                        },
                        {
                          model: t_purchase_order_d,
                          attributes: ["id", "qty_po", "harga", "disc_1", "disc_2", "amt_disc"],
                          required: false
                        }
                      ]
                    },
                    {
                      model: t_penerimaan_barang_d,
                      as: "pb_d",
                      required: false
                    }
                  ]
                }
              ]
            }
          ],
          order: [["createdAt", "DESC"]]
        });

        console.log(`📌 Ditemukan ${notifList.length} notif di DB`);

        const filtered = notifList.filter((n) => {
          const data = n.toJSON();
          // NOTE: sender_id TIDAK di-filter, karena user bisa approve ajuan sendiri
          if (data.status_name === "WAITING REVISE") return false;
          if (data.user_approved_id) return false;
          return true;
        });

        console.log(`👉 Setelah filter: ${filtered.length}`);

        for (const notif of filtered) {
          if (!seen.has(notif.id)) {
            seen.add(notif.id);
            
            const notifJson = notif.toJSON();
            
            // Remap t_purchase_return_ds untuk detail tabel
            if (notifJson.t_purchase_return?.t_purchase_return_ds) {
              notifJson.t_purchase_return.t_purchase_return_ds = 
                notifJson.t_purchase_return.t_purchase_return_ds.map(detail => {
                  const item = detail.m_item || {};
                  const uom = item.uom || {};
                  const piD = detail.pi_d || {};
                  const pbD = piD.t_penerimaan_barang_d || {};
                  const poD = piD.t_purchase_order_d || {};
                  
                  const kode_item = item.kode_item || '-';
                  const nama_item = item.nama_item || '-';
                  const qty_pb = Number(pbD.qty_diterima || 0);
                  const qty_pi = Number(piD.qty_pi || 0);
                  const qty_retur = Number(detail.qty_retur || 0);
                  const satuan = uom.value1 || 'PCS';
                  const harga = Number(detail.harga || poD.harga || 0);
                  const disc_1_percent = Number(poD.disc_1 || 0);
                  const disc_2_percent = Number(poD.disc_2 || 0);
                  const amt_disc = Number(poD.amt_disc || 0);
                  
                  // Calculations
                  const subtotal_before_disc = qty_retur * harga;
                  const disc_1_amount = (subtotal_before_disc * disc_1_percent) / 100;
                  const after_disc_1 = subtotal_before_disc - disc_1_amount;
                  const disc_2_amount = (after_disc_1 * disc_2_percent) / 100;
                  const total_diskon = disc_1_amount + disc_2_amount + amt_disc;
                  const subtotal = subtotal_before_disc - total_diskon;
                  
                  // PPN calculation (from header ppn_id value3)
                  const ppn_percent = Number(notifJson.t_purchase_return?.t_pr_ppn?.value3 || 0);
                  const ppn = (subtotal * ppn_percent) / 100;
                  const grand_total = subtotal + ppn;
                  
                  return {
                    id: detail.id,
                    kode_item,
                    nama_item,
                    qty_pb,
                    qty_pi,
                    qty_retur,
                    satuan,
                    harga,
                    disc_1_percent,
                    disc_2_percent,
                    disc_amount: amt_disc,
                    total_diskon,
                    subtotal,
                    ppn,
                    grand_total,
                    alasan: detail.alasan || '',
                    catatan: detail.catatan || ''
                  };
                });
            }
            
            results.push({
              ...notifJson,
              menu_info: menu
            });
          }
        }
      }

      console.log("📌 FINAL RESULT:", results.length);

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
      console.error("❌ Fatal Error GET USER APPROVAL PURCHASE RETURN:", err);
      return res.status(500).json({
        status: "error",
        message: err.message
      });
    }
  },


};

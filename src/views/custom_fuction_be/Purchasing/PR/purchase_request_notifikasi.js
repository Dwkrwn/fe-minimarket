import { Sequelize } from 'sequelize';
import { m_approvalController } from "../controllers/m_approvalController.js";

// Controller for t_purchase_request_notifikasi
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_request_notifikasi
//
// Tambahkan custom function di bawah ini

export const t_purchase_request_notifikasiController = {
  // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
  async uploadImage(req, res) {
    const fileFields = Object.keys(req.models.t_purchase_request_notifikasi.rawAttributes).filter(
      key => req.models.t_purchase_request_notifikasi.rawAttributes[key].type && req.models.t_purchase_request_notifikasi.rawAttributes[key].type.key === 'STRING'
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
      const inserted = await req.models.t_purchase_request_notifikasi.create(data);
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
      const inserted = await req.models.t_purchase_request_notifikasi.bulkCreate(records);
      res.json({ message: 'Excel imported', data: inserted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Contoh: Custom function
  async customFunction(req, res) {
    res.json({ message: 'Custom function untuk t_purchase_request_notifikasi', body: req.body, query: req.query });
  },




async getUserApprovalPurchaseRequest(req, res) {
  try {
    console.log("🔥 START GET USER APPROVAL PR");

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
      t_purchase_request,
      t_purchase_request_d,
      t_purchase_request_notifikasi,
      t_purchase_request_lampiran,
      user_default,
      m_items,
      m_general
    } = req.models;

    console.log("➡ Models OK");

    // =======================================================
    // GET USER APPROVAL RULES (DARI CONTROLLER KAMU)
    // =======================================================
    let approvalRaw = null;
    const fakeReq = { query: { id: userId }, models: req.models };
    const fakeRes = { json: (d) => (approvalRaw = d) };
    await m_approvalController.getUserApprovalData(fakeReq, fakeRes);

    if (!approvalRaw || !approvalRaw.menu) {
      return res.json({ 
        status: "success", 
        approval: [], 
        pagination: null,
        debug: {
          reason: "No approval data or menu",
          approvalRaw: approvalRaw
        }
      });
    }

    // DEBUG: Log semua menu yang ada
    console.log("📌 All menus from approvalRaw:", JSON.stringify(approvalRaw.menu, null, 2));

    // AMBIL HANYA MENU PR (EXACT MATCH untuk t_purchase_request, BUKAN t_purchase_order dll)
    // Cek field path ATAU menu_path (tergantung struktur data)
    const menus = approvalRaw.menu.filter(m => {
      const pathValue = m.menu_path || m.path || '';
      const pathLower = pathValue.toLowerCase();
      // Exact match: harus ends with t_purchase_request (bukan t_purchase_request_close, t_purchase_order, dll)
      const isMatch = pathLower.endsWith('/t_purchase_request') || pathLower === 't_purchase_request';
      console.log(`  Checking menu: path="${pathValue}", isMatch=${isMatch}`);
      return isMatch;
    });

    console.log("📌 PR menu found:", menus.length, menus.map(m => ({ path: m.menu_path || m.path, level: m.level, tipe: m.tipe_approve })));

    // FILTER HANYA YANG LEVEL > 0 (MENYETUJUI), karena level 0 adalah MENGAJUKAN
    const approverMenus = menus.filter(m => {
      const level = Number(m.level);
      return !isNaN(level) && level > 0;
    });

    console.log("📌 Approver menus (level > 0):", approverMenus.length);

    if (approverMenus.length === 0) {
      console.log("❌ User tidak punya akses approval (level > 0) untuk Purchase Request");
      return res.json({
        status: "success",
        approval: [],
        pagination: null,
        debug: {
          reason: "No approver menus with level > 0 for Purchase Request",
          allMenusCount: approvalRaw.menu.length,
          allMenuPaths: approvalRaw.menu.map(m => ({ path: m.menu_path || m.path, level: m.level, tipe: m.tipe_approve })),
          prMenusFound: menus.length,
          prMenus: menus.map(m => ({ path: m.menu_path || m.path, level: m.level, tipe: m.tipe_approve }))
        }
      });
    }

    // =======================================================
    // UNION RESULT
    // =======================================================
    let results = [];
    const seen = new Set();
    let debugLogs = [];

    // =======================================================
    // LOOP LEVEL APPROVAL USER (HANYA YANG LEVEL > 0)
    // =======================================================
    for (const menu of approverMenus) {
      const userLevel = Number(menu.level);
      // targetLevel adalah level notifikasi yang harus di-approve oleh user ini
      // User level 1 approve notifikasi level 0
      // User level 2 approve notifikasi level 1
      const targetLevel = userLevel - 1;

      debugLogs.push(`User approval level=${userLevel}, mencari notifikasi dengan approval_level=${targetLevel}`);

      // =======================================================
      // QUERY DASAR (TANPA FILTER ADVANCED)
      // =======================================================
      const notifList = await t_purchase_request_notifikasi.findAll({
        where: {
          approval_level: targetLevel,
          status: false // BELUM APPROVE
        },
        include: [
          { model: user_default, as: "tpr_sender", attributes: ["id", "name"] },
          { model: user_default, as: "tpr_approval", attributes: ["id", "name"] },

          {
            model: t_purchase_request,
            required: true,
            where: {
              status: ["IN APPROVAL", "WAITING", "PENDING"]
            },
            include: [
              { model: m_general },
              { model: user_default, as: "prq_ctr", attributes: ["id", "name"] },
              { model: user_default, as: "prq_update", attributes: ["id", "name"] },

              {
                model: t_purchase_request_d,
                include: [{ model: m_items }]
              },

              { model: t_purchase_request_lampiran }
            ]
          }
        ],
        order: [["createdAt", "DESC"]]
      });

      debugLogs.push(`Ditemukan ${notifList.length} notif di DB untuk approval_level=${targetLevel}`);

      // =======================================================
      // FILTER MANUAL (PENGGANTI Op DAN literal)
      // =======================================================
      const filtered = notifList.filter((n) => {
        const data = n.toJSON();

        // NOTE: sender_id TIDAK di-filter, karena user bisa approve ajuan sendiri
        // jika punya level approval > 0

        // status revisi tidak boleh masuk
        if (data.status_name === "WAITING REVISE") {
          debugLogs.push(`  - Notif ${data.id} SKIP: status WAITING REVISE`);
          return false;
        }

        // sudah di-approve oleh orang lain tidak boleh muncul
        if (data.user_approved_id) {
          debugLogs.push(`  - Notif ${data.id} SKIP: sudah di-approve oleh ${data.user_approved_id}`);
          return false;
        }

        debugLogs.push(`  - Notif ${data.id} OK: masuk hasil`);
        return true;
      });

      debugLogs.push(`Setelah filter: ${filtered.length}`);

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

    debugLogs.push(`FINAL RESULT: ${results.length}`);

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
      },
      debug: {
        userId: userId,
        approverMenusCount: approverMenus.length,
        approverMenus: approverMenus.map(m => ({ path: m.menu_path || m.path, level: m.level })),
        logs: debugLogs
      }
    });

  } catch (err) {
    console.error("❌ Fatal Error GET USER APPROVAL:", err);
    return res.status(500).json({
      status: "error",
      message: err.message
    });
  }
}









};

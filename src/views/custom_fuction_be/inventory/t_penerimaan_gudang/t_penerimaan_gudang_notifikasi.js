// Controller for t_penerimaan_gudang_notifikasi
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_penerimaan_gudang_notifikasi
//
// Tambahkan custom function di bawah ini

import { m_approvalController } from "../controllers/m_approvalController.js";

export const t_penerimaan_gudang_notifikasiController = {
  // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
  async uploadImage(req, res) {
    const fileFields = Object.keys(req.models.t_penerimaan_gudang_notifikasi.rawAttributes).filter(
      key => req.models.t_penerimaan_gudang_notifikasi.rawAttributes[key].type && req.models.t_penerimaan_gudang_notifikasi.rawAttributes[key].type.key === 'STRING'
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
      const inserted = await req.models.t_penerimaan_gudang_notifikasi.create(data);
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
      const inserted = await req.models.t_penerimaan_gudang_notifikasi.bulkCreate(records);
      res.json({ message: 'Excel imported', data: inserted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Contoh: Custom function
  async customFunction(req, res) {
    res.json({ message: 'Custom function untuk t_penerimaan_gudang_notifikasi', body: req.body, query: req.query });
  },

  // =====================================================================
  // GET USER APPROVAL PENERIMAAN GUDANG
  // Mendapatkan list approval yang perlu diproses oleh user tertentu
  // =====================================================================
  async getUserApprovalPenerimaanGudang(req, res) {
    try {
      console.log("🔥 START GET USER APPROVAL PENERIMAAN GUDANG");

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
        t_penerimaan_gudang,
        t_penerimaan_gudang_d,
        t_penerimaan_gudang_notifikasi,
        t_penerimaan_gudang_lampiran,
        user_default,
        m_items,
        m_unit_bisnis,
        m_kary,
        t_sj_gudang,
        t_sj_gudang_d,
        m_gudang
      } = req.models;

      console.log("➡ Models OK");

      // =======================================================
      // GET USER APPROVAL RULES (DARI CONTROLLER)
      // =======================================================
      let approvalRaw = null;
      const fakeReq = { query: { id: userId }, models: req.models };
      const fakeRes = { json: (d) => (approvalRaw = d) };
      await m_approvalController.getUserApprovalData(fakeReq, fakeRes);

      if (!approvalRaw || !approvalRaw.menu) {
        return res.json({ status: "success", approval: [], pagination: null });
      }

      // AMBIL HANYA MENU PENERIMAAN GUDANG
      const menus = approvalRaw.menu.filter(
        m => m.menu_path && m.menu_path.toLowerCase().includes("t_penerimaan_gudang")
      );

      console.log("📌 Penerimaan Gudang menu:", menus.length);

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
        const approvalIncludes = [];

        if (user_default) {
          approvalIncludes.push({ model: user_default, as: "tpen_gudang_send", attributes: ["id", "name"] });
          approvalIncludes.push({ model: user_default, as: "tpen_gudang_approval", attributes: ["id", "name"] });
        }

        if (t_penerimaan_gudang) {
          const penerimaanIncludes = [];

          if (m_unit_bisnis) penerimaanIncludes.push({ model: m_unit_bisnis, as: "m_unit_bisni" });
          if (m_kary) penerimaanIncludes.push({ model: m_kary, as: "pic_penerima_gudang" });
          
          // GUDANG ASAL DAN GUDANG TERIMA DARI PENERIMAAN
          if (m_gudang) {
            penerimaanIncludes.push({ model: m_gudang, as: "pen_gd_asl" });
            penerimaanIncludes.push({ model: m_gudang, as: "pen_gd_trm" });
          }

          // SURAT JALAN GUDANG DENGAN GUDANG ASAL DAN TERIMA
          if (t_sj_gudang) {
            const sjGudangIncludes = [];
            if (m_gudang) {
              sjGudangIncludes.push({ model: m_gudang, as: "sj_gd_asl" });
              sjGudangIncludes.push({ model: m_gudang, as: "sj_gd_trm" });
            }
            penerimaanIncludes.push({ 
              model: t_sj_gudang, 
              as: "surat_jalan_gudang",
              include: sjGudangIncludes
            });
          }

          if (t_penerimaan_gudang_d) {
            const detailInclude = { model: t_penerimaan_gudang_d, include: [] };
            if (m_items) detailInclude.include.push({ model: m_items });
            if (t_sj_gudang_d) detailInclude.include.push({ model: t_sj_gudang_d, as: "detail_sj" });
            penerimaanIncludes.push(detailInclude);
          }

          if (t_penerimaan_gudang_lampiran) {
            penerimaanIncludes.push({ model: t_penerimaan_gudang_lampiran });
          }

          approvalIncludes.push({
            model: t_penerimaan_gudang,
            required: true,
            where: {
              status: ["IN APPROVAL", "WAITING", "PENDING"]
            },
            include: penerimaanIncludes
          });
        }

        const notifList = await t_penerimaan_gudang_notifikasi.findAll({
          where: {
            approval_level: targetLevel,
            status: false // BELUM APPROVE
          },
          include: approvalIncludes,
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
      console.error("❌ Fatal Error GET USER APPROVAL:", err);
      return res.status(500).json({
        status: "error",
        message: err.message
      });
    }
  }
};

// Controller for t_purchase_request_d
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_request_d
//
// Tambahkan custom function di bawah ini

export const t_purchase_request_dController = {
  // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
  async uploadImage(req, res) {
    const fileFields = Object.keys(req.models.t_purchase_request_d.rawAttributes).filter(
      key => req.models.t_purchase_request_d.rawAttributes[key].type && req.models.t_purchase_request_d.rawAttributes[key].type.key === 'STRING'
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
      const inserted = await req.models.t_purchase_request_d.create(data);
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
      const inserted = await req.models.t_purchase_request_d.bulkCreate(records);
      res.json({ message: 'Excel imported', data: inserted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Contoh: Custom function
  async customFunction(req, res) {
    res.json({ message: 'Custom function untuk t_purchase_request_d', body: req.body, query: req.query });
  },

  // =====================================================================
  // GET AVAILABLE PURCHASE REQUEST DETAIL (TIDAK DIPAKAI DI PO YANG APPROVED)
  // =====================================================================
  async ItemPR(req, res) {
    try {
      console.log("🔥 START GET AVAILABLE PRD FOR PO");

      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const {
        t_purchase_request_d,
        t_purchase_order,
        t_purchase_order_d,
        m_items,
        t_purchase_request,
        user_default,
        m_general
      } = req.models;

      console.log("➡ Models OK");

      // =======================================================
      // STEP 1: AMBIL SEMUA t_purchase_request_d YANG SUDAH DIPAKAI DI PO
      // (filter: status PO = APPROVED, IN APPROVAL, REVISI)
      // =======================================================
      const usedPRDInApprovedPO = await t_purchase_order_d.findAll({
        attributes: ['t_purchase_request_d_id'],
        include: [
          {
            model: t_purchase_order,
            required: true,
            attributes: ['id', 'status'],
            where: {
              status: ['APPROVED', 'IN APPROVAL', 'REVISI']
            }
          }
        ],
        raw: true
      });

      console.log(`📌 Total PRD yang sudah dipakai di PO (APPROVED/IN APPROVAL/REVISI): ${usedPRDInApprovedPO.length}`);

      // Extract unique t_purchase_request_d_id yang sudah dipakai
      const usedPRDIds = new Set(
        usedPRDInApprovedPO
          .map(pod => pod.t_purchase_request_d_id)
          .filter(id => id !== null)
      );

      console.log(`🎯 Unique PRD IDs yang sudah dipakai: ${usedPRDIds.size}`);

      // =======================================================
      // STEP 2: QUERY SEMUA t_purchase_request_d DENGAN RELASI LENGKAP
      // =======================================================
      const allPRD = await t_purchase_request_d.findAll({
        include: [
          {
            model: m_items,
            as: 'm_item',
            include: [
              {
                model: m_general,
                as: 'uom'
              }
            ]
          },
          {
            model: t_purchase_request,
            as: 't_purchase_request',
            include: [
              {
                model: user_default,
                as: 'prq_ctr',
                attributes: ['id', 'name']
              },
              {
                model: user_default,
                as: 'prq_update',
                attributes: ['id', 'name']
              },
              {
                model: m_general
              }
            ]
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      console.log(`📌 Total PRD dari database: ${allPRD.length}`);

      // =======================================================
      // STEP 3: FILTER - HANYA TAMPILKAN YANG BELUM DIPAKAI
      // =======================================================
      const availablePRD = allPRD.filter(prd => {
        // Jangan tampilkan jika PRD ini sudah dipakai di PO (APPROVED/IN APPROVAL/REVISI)
        return !usedPRDIds.has(prd.id);
      });

      console.log(`✅ Available PRD (belum dipakai): ${availablePRD.length}`);

      // =======================================================
      // STEP 4: PAGINATION
      // =======================================================
      const total = availablePRD.length;
      const totalPages = Math.ceil(total / limit);

      const paginated = availablePRD.slice(offset, offset + limit);

      return res.json({
        status: "success",
        data: paginated.map(prd => prd.toJSON()),
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
      console.error("❌ Fatal Error GET AVAILABLE PRD:", err);
      return res.status(500).json({
        status: "error",
        message: err.message
      });
    }
  }

};

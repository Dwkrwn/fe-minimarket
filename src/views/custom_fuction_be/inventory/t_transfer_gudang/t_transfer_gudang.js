// Controller for t_transfer_gudang
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_transfer_gudang
//
// Tambahkan custom function di bawah ini

import { Op } from 'sequelize';

export const t_transfer_gudangController = {
  // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
  async uploadImage(req, res) {
    const fileFields = Object.keys(req.models.t_transfer_gudang.rawAttributes).filter(
      key => req.models.t_transfer_gudang.rawAttributes[key].type && req.models.t_transfer_gudang.rawAttributes[key].type.key === 'STRING'
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
      const inserted = await req.models.t_transfer_gudang.create(data);
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
      const inserted = await req.models.t_transfer_gudang.bulkCreate(records);
      res.json({ message: 'Excel imported', data: inserted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Contoh: Custom function
  async customFunction(req, res) {
    res.json({ message: 'Custom function untuk t_transfer_gudang', body: req.body, query: req.query });
  },

  /**
   * Get Data Unpost - Transfer Gudang yang belum sepenuhnya masuk ke SJ Gudang
   * 
   * Logic:
   * 1. Ambil semua t_transfer_gudang dengan status POST untuk unit bisnis tertentu
   * 2. Untuk setiap transfer gudang, cek apakah sudah ada SJ Gudang yang mereferensikan-nya
   * 3. Hitung total qty yang sudah masuk ke SJ Gudang (dari t_sj_gudang_d dengan status POST)
   * 4. Jika masih ada sisa qty yang belum masuk SJ, tampilkan data tersebut
   * 5. Jika semua qty sudah masuk SJ (dan SJ sudah POST), jangan tampilkan
   * 
   * Query params:
   * - m_unit_bisnis_id (required): Filter by unit bisnis
   * - page (optional): Page number, default 1
   * - paginate (optional): Items per page, default 20
   */
  async getDataUnpost(req, res) {
    try {
      const { m_unit_bisnis_id, page = 1, paginate = 20 } = req.query;
      
      // Build where clause
      const whereClause = {
        status: 'POST'
      };
      
      // Add m_unit_bisnis_id filter if provided
      if (m_unit_bisnis_id) {
        whereClause.m_unit_bisnis_id = m_unit_bisnis_id;
      }
      
      // Get all transfer gudang with status POST
      // Include details and relations
      const transferGudangList = await req.models.t_transfer_gudang.findAll({
        where: whereClause,
        include: [
          { 
            model: req.models.m_gudang, 
            as: 'warehouse_asal',
            required: false
          },
          { 
            model: req.models.m_gudang, 
            as: 'warehouse_tujuan',
            required: false
          },
          { 
            model: req.models.m_kary, 
            as: 'm_kary',
            required: false
          },
          {
            model: req.models.t_transfer_gudang_d,
            as: 't_transfer_gudang_ds',
            required: false,
            include: [
              {
                model: req.models.m_items,
                as: 'm_item',
                required: false,
                include: [
                  {
                    model: req.models.m_group_batch,
                    as: 'm_group_batch',
                    required: false
                  },
                  {
                    model: req.models.m_general,
                    as: 'uom',
                    required: false
                  }
                ]
              }
            ]
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      // For each transfer gudang, check if it's fully processed into SJ Gudang
      const unprocessedList = [];
      
      for (const tg of transferGudangList) {
        const tgPlain = tg.get({ plain: true });
        
        // Get all SJ Gudang with status POST that reference this transfer gudang
        const sjGudangList = await req.models.t_sj_gudang.findAll({
          where: {
            t_transfer_gudang_id: tg.id,
            status: 'POST'
          },
          include: [{
            model: req.models.t_sj_gudang_d,
            as: 't_sj_gudang_ds',
            required: false
          }]
        });

        // Sum up qty_sj_gudang per t_transfer_gudang_d_id from all POST SJ
        const qtyUsedMap = {};
        for (const sj of sjGudangList) {
          const sjPlain = sj.get({ plain: true });
          if (sjPlain.t_sj_gudang_ds && Array.isArray(sjPlain.t_sj_gudang_ds)) {
            for (const sjd of sjPlain.t_sj_gudang_ds) {
              const detailId = sjd.t_transfer_gudang_d_id;
              if (detailId) {
                if (!qtyUsedMap[detailId]) {
                  qtyUsedMap[detailId] = 0;
                }
                qtyUsedMap[detailId] += sjd.qty_sj_gudang || 0;
              }
            }
          }
        }

        // Check if any transfer gudang detail still has remaining qty
        let hasRemaining = false;
        const details = tgPlain.t_transfer_gudang_ds || [];
        
        if (details.length === 0) {
          // No details at all, still show it (edge case)
          hasRemaining = true;
        } else {
          for (const detail of details) {
            const qtyTotal = detail.qty || 0;
            const qtyUsed = qtyUsedMap[detail.id] || 0;
            const qtyRemaining = qtyTotal - qtyUsed;
            
            // Add remaining qty info to detail for frontend reference
            detail.qty_used_sj = qtyUsed;
            detail.qty_remaining = qtyRemaining;
            
            if (qtyRemaining > 0) {
              hasRemaining = true;
            }
          }
        }

        // Only include if there's still remaining qty to be processed
        if (hasRemaining) {
          unprocessedList.push(tgPlain);
        }
      }

      // Manual pagination since we filtered in memory
      const pageNum = parseInt(page) || 1;
      const limit = parseInt(paginate) || 20;
      const offset = (pageNum - 1) * limit;
      
      const paginatedData = unprocessedList.slice(offset, offset + limit);
      const total = unprocessedList.length;
      const totalPages = Math.ceil(total / limit);

      res.json({
        status: 'success',
        data: paginatedData,
        pagination: {
          total,
          page: pageNum,
          totalPages,
          limit,
          currentRowsCount: paginatedData.length,
          next_page: pageNum < totalPages ? pageNum + 1 : null,
          prev_page: pageNum > 1 ? pageNum - 1 : null
        }
      });
    } catch (err) {
      console.error('getDataUnpost error:', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  }
};

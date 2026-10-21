// Controller for t_sj_gudang
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_sj_gudang
//
// Tambahkan custom function di bawah ini

export const t_sj_gudangController = {
  // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
  async uploadImage(req, res) {
    const fileFields = Object.keys(req.models.t_sj_gudang.rawAttributes).filter(
      key => req.models.t_sj_gudang.rawAttributes[key].type && req.models.t_sj_gudang.rawAttributes[key].type.key === 'STRING'
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
      const inserted = await req.models.t_sj_gudang.create(data);
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
      const inserted = await req.models.t_sj_gudang.bulkCreate(records);
      res.json({ message: 'Excel imported', data: inserted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Contoh: Custom function
  async customFunction(req, res) {
    res.json({ message: 'Custom function untuk t_sj_gudang', body: req.body, query: req.query });
  },

  // POST Data: Update status dari DRAFT ke POST
  async PostData(req, res) {
    const { t_sj_gudang_id } = req.body;

    // Validasi input
    if (!t_sj_gudang_id) {
      return res.status(400).json({ error: 't_sj_gudang_id is required' });
    }

    try {
      // Cek apakah t_sj_gudang exist
      const sjGudang = await req.models.t_sj_gudang.findByPk(t_sj_gudang_id);
      
      if (!sjGudang) {
        return res.status(404).json({ error: 't_sj_gudang not found' });
      }

      // Cek apakah sudah POST
      if (sjGudang.status === 'POST') {
        return res.status(400).json({ error: 'Data already posted' });
      }

      // Update status ke POST
      await sjGudang.update({ status: 'POST' });

      res.json({
        message: 'Data posted successfully',
        data: {
          t_sj_gudang_id,
          status: 'POST'
        }
      });

    } catch (err) {
      console.error('PostData Error:', err);
      res.status(500).json({
        error: 'Failed to post data',
        reason: err.message
      });
    }
  },

  // =====================================================================
  // SYNC STOCK DARI SJ GUDANG YANG SUDAH POST
  // Untuk memperbaiki data SJ yang POST tapi belum punya stock_gudang_d
  // =====================================================================
  async syncStockFromSjGudang(req, res) {
    const sequelize = req.models.t_sj_gudang.sequelize;
    const transaction = await sequelize.transaction();

    try {
      console.log('🔥 START SYNC STOCK FROM SJ GUDANG');

      const {
        t_sj_gudang,
        t_sj_gudang_d,
        t_transfer_gudang,
        stock_gudang,
        stock_gudang_d
      } = req.models;

      const { Op } = sequelize.Sequelize;

      // 1. Get all SJ Gudang with status POST
      const allSjPost = await t_sj_gudang.findAll({
        where: { status: 'POST' },
        include: [
          {
            model: t_sj_gudang_d,
            as: 't_sj_gudang_ds',
            required: false
          },
          {
            model: t_transfer_gudang,
            as: 'no_tg',
            required: false
          }
        ],
        transaction
      });

      console.log(`📋 Found ${allSjPost.length} SJ Gudang with POST status`);

      const syncResults = {
        total_sj: allSjPost.length,
        already_synced: 0,
        newly_synced: 0,
        skipped: 0,
        errors: [],
        details: []
      };

      for (const sjGudang of allSjPost) {
        try {
          // Check if this SJ already has stock_gudang_d entries
          const existingStockD = await stock_gudang_d.findOne({
            where: { t_sj_gudang_id: sjGudang.id },
            transaction
          });

          if (existingStockD) {
            syncResults.already_synced++;
            syncResults.details.push({
              sj_id: sjGudang.id,
              no_sj_gudang: sjGudang.no_sj_gudang,
              status: 'ALREADY_SYNCED'
            });
            continue;
          }

          // Get gudang asal from transfer gudang
          const gudangAsalId = sjGudang.no_tg?.warehouse_asal_id;
          if (!gudangAsalId) {
            syncResults.skipped++;
            syncResults.details.push({
              sj_id: sjGudang.id,
              no_sj_gudang: sjGudang.no_sj_gudang,
              status: 'SKIPPED',
              reason: 'No gudang asal found in transfer gudang'
            });
            continue;
          }

          // Get details
          const details = sjGudang.t_sj_gudang_ds || [];

          if (details.length === 0) {
            syncResults.skipped++;
            syncResults.details.push({
              sj_id: sjGudang.id,
              no_sj_gudang: sjGudang.no_sj_gudang,
              status: 'SKIPPED',
              reason: 'No items found'
            });
            continue;
          }

          // Process each item
          let itemsProcessed = 0;
          for (const detail of details) {
            const itemId = detail.m_items_id;
            const qtySj = Number(detail.qty_sj_gudang || 0);

            if (!itemId || qtySj <= 0) continue;

            // Find or create stock_gudang
            let stockGudangRecord = await stock_gudang.findOne({
              where: {
                m_gudang_id: gudangAsalId,
                m_items_id: itemId
              },
              transaction
            });

            if (!stockGudangRecord) {
              stockGudangRecord = await stock_gudang.create({
                m_gudang_id: gudangAsalId,
                m_items_id: itemId,
                free_stock: 0
              }, { transaction });
            }

            // Create stock_gudang_d entry
            await stock_gudang_d.create({
              stock_gudang_id: stockGudangRecord.id,
              t_sj_gudang_id: sjGudang.id,
              m_items_id: itemId,
              stock_masuk: 0,
              stock_keluar: qtySj
            }, { transaction });

            // Recalculate free_stock
            const totalMasuk = await stock_gudang_d.sum('stock_masuk', {
              where: { stock_gudang_id: stockGudangRecord.id },
              transaction
            }) || 0;

            const totalKeluar = await stock_gudang_d.sum('stock_keluar', {
              where: { stock_gudang_id: stockGudangRecord.id },
              transaction
            }) || 0;

            await stockGudangRecord.update({
              free_stock: totalMasuk - totalKeluar
            }, { transaction });

            itemsProcessed++;
          }

          syncResults.newly_synced++;
          syncResults.details.push({
            sj_id: sjGudang.id,
            no_sj_gudang: sjGudang.no_sj_gudang,
            status: 'NEWLY_SYNCED',
            items_processed: itemsProcessed,
            gudang_asal_id: gudangAsalId
          });

        } catch (itemError) {
          syncResults.errors.push({
            sj_id: sjGudang.id,
            no_sj_gudang: sjGudang.no_sj_gudang,
            error: itemError.message
          });
        }
      }

      await transaction.commit();

      console.log('✅ SYNC STOCK FROM SJ GUDANG COMPLETED');
      console.log(`📊 Already synced: ${syncResults.already_synced}`);
      console.log(`📊 Newly synced: ${syncResults.newly_synced}`);
      console.log(`📊 Skipped: ${syncResults.skipped}`);
      console.log(`📊 Errors: ${syncResults.errors.length}`);

      return res.json({
        status: 'success',
        message: 'Stock sync from SJ Gudang completed',
        data: syncResults
      });

    } catch (error) {
      await transaction.rollback();
      console.error('❌ SYNC STOCK FROM SJ GUDANG ERROR:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  }
};

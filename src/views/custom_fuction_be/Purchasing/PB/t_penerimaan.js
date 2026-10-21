// Controller for t_penerimaan_barangs
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_penerimaan_barangs
//
// Tambahkan custom function di bawah ini

export const t_penerimaan_barangsController = {
  // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
  async uploadImage(req, res) {
    const fileFields = Object.keys(req.models.t_penerimaan_barangs.rawAttributes).filter(
      key => req.models.t_penerimaan_barangs.rawAttributes[key].type && req.models.t_penerimaan_barangs.rawAttributes[key].type.key === 'STRING'
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
      const inserted = await req.models.t_penerimaan_barangs.create(data);
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
      const inserted = await req.models.t_penerimaan_barangs.bulkCreate(records);
      res.json({ message: 'Excel imported', data: inserted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Contoh: Custom function
  async customFunction(req, res) {
    res.json({ message: 'Custom function untuk t_penerimaan_barangs', body: req.body, query: req.query });
  },

  // Get All Data PB - Deduplicate and merge details into array
  // Filter out data yang sudah dibuat Purchase Invoice
  async GetAllDataPB(req, res) {
    try {
      const {
        page = 1,
        paginate = 20,
        no_pagination,
        search,
        searchfield,
        order_by,
        order_type = 'DESC'
      } = req.query;

      const {
        t_penerimaan_barangs,
        t_penerimaan_barang_d,
        t_purchase_order,
        m_supplier,
        t_purchase_invoices,
        t_purchase_invoice_d
      } = req.models;

      const { Op } = t_penerimaan_barangs.sequelize.Sequelize;

      // Build WHERE clause untuk t_penerimaan_barangs
      // ALWAYS filter status = POST (hard-coded)
      const where = {
        status: 'POST'
      };

      // Apply column filters (except status - already hard-coded)
      Object.keys(req.query).forEach(key => {
        if (key.startsWith('filter_column_')) {
          const column = key.replace('filter_column_', '');
          // Skip status filter - already hard-coded to POST
          if (column !== 'status') {
            where[column] = req.query[key];
          }
        }
      });

      // Apply search
      if (search && searchfield) {
        const searchFields = searchfield.split(',').map(f => f.trim());
        const searchConditions = searchFields.map(field => ({
          [field]: { [Op.iLike]: `%${search}%` }
        }));
        where[Op.or] = searchConditions;
      }

      // Build order
      let order = [];
      if (order_by) {
        order.push([order_by, order_type.toUpperCase()]);
      } else {
        order.push(['createdAt', 'DESC']);
      }

      // Query all penerimaan with details (will have duplicates)
      const rawData = await t_penerimaan_barangs.findAll({
        where,
        include: [
          {
            model: m_supplier,
            attributes: ['id', 'nama_supp'],
            required: false
          },
          {
            model: t_penerimaan_barang_d,
            as: 't_penerimaan_barang_d',
            required: false,
            include: [
              {
                model: t_purchase_order,
                attributes: ['id', 'no_po'],
                required: false
              }
            ]
          }
        ],
        order,
        raw: false
      });

      // Deduplicate: Group by parent ID and merge details
      const groupedMap = {};
      
      for (const row of rawData) {
        const parentData = row.toJSON();
        const parentId = parentData.id;
        
        if (!groupedMap[parentId]) {
          // First occurrence: initialize with parent data
          groupedMap[parentId] = {
            ...parentData,
            t_penerimaan_barang_ds: [] // Array untuk details
          };
          delete groupedMap[parentId].t_penerimaan_barang_d; // Remove singular
        }
        
        // Add detail to array if exists
        if (parentData.t_penerimaan_barang_d) {
          groupedMap[parentId].t_penerimaan_barang_ds.push(parentData.t_penerimaan_barang_d);
        }
      }

      // Convert to array
      let deduplicatedData = Object.values(groupedMap);

      // DEBUG INFO untuk response
      const debugInfo = {
        models_available: {
          t_purchase_invoice_d: !!t_purchase_invoice_d,
          t_purchase_invoices: !!t_purchase_invoices
        },
        query_status: '',
        raw_query_result: [],
        found_approved_count: 0,
        approved_detail_ids: [],
        filtering_details: [],
        final_result_count: 0
      };

      // Filter berdasarkan DETAIL level (t_penerimaan_barang_d_id)
      // PB hanya di-hide jika SEMUA detail itemnya sudah dibuat Invoice dengan status APPROVED
      // Jika masih ada detail yang belum jadi PI APPROVED, PB tetap muncul
      
      // Get semua t_penerimaan_barang_d_id yang sudah ada di Purchase Invoice dengan status APPROVED
      let usedDetailIds = [];
      
      try {
        // Check if required models exist
        if (!t_purchase_invoice_d) {
          debugInfo.query_status = '❌ Model t_purchase_invoice_d tidak ditemukan di req.models';
          throw new Error('Model t_purchase_invoice_d tidak tersedia. Pastikan model sudah terdaftar di system.');
        }

        // Try different table name possibilities
        let rawQuery = `
          SELECT DISTINCT pid.t_penerimaan_barang_d_id 
          FROM t_purchase_invoice_d pid
          INNER JOIN t_purchase_invoice pi ON pi.id = pid.t_purchase_invoice_id
          WHERE pi.status = 'APPROVED' 
          AND pid.t_penerimaan_barang_d_id IS NOT NULL
        `;
        
        let results;
        try {
          [results] = await t_purchase_invoice_d.sequelize.query(rawQuery);
          debugInfo.query_status = `✅ Query t_purchase_invoice berhasil, found ${results.length} rows`;
        } catch (err) {
          // Try plural table name
          if (err.message.includes('does not exist') || err.message.includes('tidak ada') || err.message.includes('relation') || err.message.includes('table')) {
            debugInfo.query_status = '⚠️ Table t_purchase_invoice not found, trying t_purchase_invoices...';
            rawQuery = `
              SELECT DISTINCT pid.t_penerimaan_barang_d_id 
              FROM t_purchase_invoice_d pid
              INNER JOIN t_purchase_invoices pi ON pi.id = pid.t_purchase_invoice_id
              WHERE pi.status = 'APPROVED' 
              AND pid.t_penerimaan_barang_d_id IS NOT NULL
            `;
            [results] = await t_purchase_invoice_d.sequelize.query(rawQuery);
            debugInfo.query_status += ` | ✅ Query t_purchase_invoices berhasil, found ${results.length} rows`;
          } else {
            throw err;
          }
        }
        
        usedDetailIds = results;
        debugInfo.raw_query_result = usedDetailIds;
        
      } catch (err) {
        debugInfo.query_status = `❌ CRITICAL ERROR: ${err.message}`;
        throw new Error(`Gagal query Purchase Invoice APPROVED: ${err.message}. Tidak bisa memfilter data PB yang sudah di-invoice.`);
      }

      if (usedDetailIds.length > 0) {
        const usedDetailIdsSet = new Set(
          usedDetailIds
            .map(d => d.t_penerimaan_barang_d_id)
            .filter(id => id) // Remove null/undefined
        );

        debugInfo.found_approved_count = usedDetailIdsSet.size;
        debugInfo.approved_detail_ids = Array.from(usedDetailIdsSet);

        // Filter HANYA detail items yang sudah ada di PI APPROVED
        // PB tetap ditampilkan dengan items yang tersisa (tidak di-exclude meskipun semua items sudah invoiced)
        deduplicatedData = deduplicatedData.map(pb => {
          // Filter out detail items yang sudah ada di PI APPROVED
          const remainingDetails = (pb.t_penerimaan_barang_ds || []).filter(
            detail => {
              const isInvoiced = usedDetailIdsSet.has(detail.id);
              if (isInvoiced) {
                debugInfo.filtering_details.push(`🚫 Filtering out detail ${detail.id} - already in APPROVED PI`);
              }
              return !isInvoiced;
            }
          );
          
          debugInfo.filtering_details.push(`📦 PB ${pb.no_penerimaan}: ${pb.t_penerimaan_barang_ds?.length || 0} total items, ${remainingDetails.length} remaining after filter`);
          
          return {
            ...pb,
            t_penerimaan_barang_ds: remainingDetails
          };
        });
        
        debugInfo.final_result_count = deduplicatedData.length;
      } else {
        debugInfo.query_status += ' | 📋 No approved PI details found - returning all PB data';
      }

      // Pagination
      let result;
      if (no_pagination === 'true') {
        result = {
          data: deduplicatedData,
          pagination: {
            total: deduplicatedData.length,
            page: 1,
            totalPages: 1,
            limit: deduplicatedData.length,
            currentRowsCount: deduplicatedData.length,
            next_page: null,
            prev_page: null
          }
        };
      } else {
        const total = deduplicatedData.length;
        const limit = parseInt(paginate);
        const currentPage = parseInt(page);
        const totalPages = Math.ceil(total / limit);
        const offset = (currentPage - 1) * limit;
        
        const paginatedData = deduplicatedData.slice(offset, offset + limit);
        
        result = {
          data: paginatedData,
          pagination: {
            total,
            page: currentPage,
            totalPages,
            limit,
            currentRowsCount: paginatedData.length,
            next_page: currentPage < totalPages ? currentPage + 1 : null,
            prev_page: currentPage > 1 ? currentPage - 1 : null
          }
        };
      }

      return res.json({
        status: 'success',
        debug_info: debugInfo, // DEBUGGING: Lihat log filtering disini
        ...result
      });

    } catch (error) {
      console.error('GetAllDataPB ERROR:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  },

  // Get PB Return - Get PB data yang belum dipakai di Purchase Invoice
  async GetPBReturn(req, res) {
    try {
      const {
        page = 1,
        paginate = 20,
        no_pagination,
        search,
        searchfield,
        order_by,
        order_type = 'DESC'
      } = req.query;

      const {
        t_penerimaan_barangs,
        t_penerimaan_barang_d,
        t_purchase_order,
        m_supplier,
        t_purchase_invoices,
        t_purchase_invoice
      } = req.models;

      const { Op } = t_penerimaan_barangs.sequelize.Sequelize;

      // Build WHERE clause - filter status = POST
      const where = {
        status: 'POST'
      };

      // Apply column filters (except status)
      Object.keys(req.query).forEach(key => {
        if (key.startsWith('filter_column_')) {
          const column = key.replace('filter_column_', '');
          if (column !== 'status') {
            where[column] = req.query[key];
          }
        }
      });

      // Apply search
      if (search && searchfield) {
        const searchFields = searchfield.split(',').map(f => f.trim());
        const searchConditions = searchFields.map(field => ({
          [field]: { [Op.iLike]: `%${search}%` }
        }));
        where[Op.or] = searchConditions;
      }

      // Build order
      let order = [];
      if (order_by) {
        order.push([order_by, order_type.toUpperCase()]);
      } else {
        order.push(['createdAt', 'DESC']);
      }

      // Get all PB IDs yang sudah dipakai di Purchase Invoice
      const PIModel = t_purchase_invoice || t_purchase_invoices;
      let usedPBIds = [];
      
      if (PIModel) {
        try {
          const usedPIs = await PIModel.findAll({
            attributes: ['t_penerimaan_barang_id'],
            where: {
              t_penerimaan_barang_id: { [Op.ne]: null }
            },
            raw: true
          });
          
          usedPBIds = usedPIs
            .map(pi => pi.t_penerimaan_barang_id)
            .filter(id => id); // Remove null/undefined
          
          console.log(`📋 Found ${usedPBIds.length} PB IDs already used in Purchase Invoice`);
        } catch (err) {
          console.error('Error querying Purchase Invoice:', err.message);
        }
      }

      // Add filter to exclude PB yang sudah dipakai di PI
      if (usedPBIds.length > 0) {
        where.id = { [Op.notIn]: usedPBIds };
      }

      // Query PB with details
      const rawData = await t_penerimaan_barangs.findAll({
        where,
        include: [
          {
            model: m_supplier,
            attributes: ['id', 'nama_supp'],
            required: false
          },
          {
            model: t_penerimaan_barang_d,
            as: 't_penerimaan_barang_d',
            required: false,
            include: [
              {
                model: t_purchase_order,
                attributes: ['id', 'no_po'],
                required: false
              },
              {
                model: req.models.m_items,
                attributes: ['id', 'kode_item', 'nama_item', 'nama_singkat', 'satuan_id'],
                required: false
              }
            ]
          }
        ],
        order,
        raw: false
      });

      // Deduplicate: Group by parent ID and merge details
      const groupedMap = {};
      
      for (const row of rawData) {
        const parentData = row.toJSON();
        const parentId = parentData.id;
        
        if (!groupedMap[parentId]) {
          // First occurrence: initialize with parent data
          groupedMap[parentId] = {
            ...parentData,
            t_penerimaan_barang_ds: [] // Array for details
          };
          delete groupedMap[parentId].t_penerimaan_barang_d; // Remove singular
        }
        
        // Add detail to array if exists
        if (parentData.t_penerimaan_barang_d) {
          groupedMap[parentId].t_penerimaan_barang_ds.push(parentData.t_penerimaan_barang_d);
        }
      }

      // Convert to array
      let deduplicatedData = Object.values(groupedMap);

      // Pagination
      let result;
      if (no_pagination === 'true') {
        result = {
          data: deduplicatedData,
          pagination: {
            total: deduplicatedData.length,
            page: 1,
            totalPages: 1,
            limit: deduplicatedData.length,
            currentRowsCount: deduplicatedData.length,
            next_page: null,
            prev_page: null
          }
        };
      } else {
        const total = deduplicatedData.length;
        const limit = parseInt(paginate);
        const currentPage = parseInt(page);
        const totalPages = Math.ceil(total / limit);
        const offset = (currentPage - 1) * limit;
        
        const paginatedData = deduplicatedData.slice(offset, offset + limit);
        
        result = {
          data: paginatedData,
          pagination: {
            total,
            page: currentPage,
            totalPages,
            limit,
            currentRowsCount: paginatedData.length,
            next_page: currentPage < totalPages ? currentPage + 1 : null,
            prev_page: currentPage > 1 ? currentPage - 1 : null
          }
        };
      }

      return res.json({
        status: 'success',
        message: 'Data PB yang belum dipakai di Purchase Invoice',
        excluded_pb_count: usedPBIds.length,
        ...result
      });

    } catch (error) {
      console.error('GetPBReturn ERROR:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  },

  // POST penerimaan - create stock_gudang_d entries and update stock_gudang free_stock
  async postPenerimaan(req, res) {
    const { penerimaan_id } = req.body;

    if (!penerimaan_id) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'penerimaan_id is required' 
      });
    }

    const transaction = await req.models.t_penerimaan_barangs.sequelize.transaction();

    try {
      // 1. Get penerimaan data
      const penerimaan = await req.models.t_penerimaan_barangs.findByPk(penerimaan_id, {
        transaction
      });

      if (!penerimaan) {
        await transaction.rollback();
        return res.status(404).json({ 
          status: 'error', 
          message: 'Penerimaan not found' 
        });
      }

      // Check if already POST
      if (penerimaan.status === 'POST') {
        await transaction.rollback();
        return res.status(400).json({ 
          status: 'error', 
          message: 'Penerimaan already posted' 
        });
      }

      // Validate gudang exists
      if (!penerimaan.m_gudang_id) {
        await transaction.rollback();
        return res.status(400).json({ 
          status: 'error', 
          message: 'Gudang not found in penerimaan data' 
        });
      }

      // 2. Get ALL detail items (t_penerimaan_barang_d or t_penerimaan_barangs_d)
      const DetailModel = req.models.t_penerimaan_barang_d || req.models.t_penerimaan_barangs_d;
      if (!DetailModel) {
        await transaction.rollback();
        return res.status(500).json({ 
          status: 'error', 
          message: 'Detail model not found in system' 
        });
      }

      const detailItems = await DetailModel.findAll({
        where: { t_penerimaan_barangs_id: penerimaan_id },
        transaction
      });

      // 3. Get ALL bonus items (t_penerimaan_barang_bonu or t_penerimaan_barangs_bonu)
      const BonusModel = req.models.t_penerimaan_barang_bonu || req.models.t_penerimaan_barangs_bonu;
      let bonusItems = [];
      if (BonusModel) {
        bonusItems = await BonusModel.findAll({
          where: { t_penerimaan_barangs_id: penerimaan_id },
          transaction
        });
      }

      // 4. Combine all items for validation
      const allItems = [
        ...detailItems.map(d => ({ 
          m_items_id: d.m_items_id, 
          qty: d.qty_diterima,
          type: 'detail'
        })),
        ...bonusItems.map(b => ({ 
          m_items_id: b.m_items_id, 
          qty: b.qty_bonus,
          type: 'bonus'
        }))
      ];

      // 5. VALIDATE: All items must have m_items_id and qty > 0
      const invalidItems = allItems.filter(item => !item.m_items_id || !item.qty || item.qty <= 0);
      if (invalidItems.length > 0) {
        await transaction.rollback();
        return res.status(400).json({ 
          status: 'error', 
          message: `Invalid item data found: ${invalidItems.length} item(s) missing m_items_id or qty. All items must have valid data.`,
          invalid_count: invalidItems.length
        });
      }

      // Check if no items at all
      if (allItems.length === 0) {
        await transaction.rollback();
        return res.status(400).json({ 
          status: 'error', 
          message: 'No items found in penerimaan. Cannot post empty penerimaan.' 
        });
      }

      // 6. Process ALL items and create stock_gudang + stock_gudang_d entries
      // IMPORTANT: Each combination of (gudang + item) must have its own stock_gudang row
      const stockGudangDEntries = [];
      const processedStockGudang = [];

      for (const item of allItems) {
        const { m_items_id, qty } = item;

        // 6.1. Find or create stock_gudang for THIS gudang + item combination
        let stockGudang = await req.models.stock_gudang.findOne({
          where: {
            m_gudang_id: penerimaan.m_gudang_id,
            m_items_id: m_items_id  // CRITICAL: Stock gudang per item
          },
          transaction
        });

        if (!stockGudang) {
          // Create new stock_gudang for this gudang + item with free_stock = 0
          stockGudang = await req.models.stock_gudang.create({
            m_gudang_id: penerimaan.m_gudang_id,
            m_items_id: m_items_id,  // CRITICAL: Field name is m_items_id
            free_stock: 0  // Will be recalculated below
          }, { transaction });

          // VALIDATION: Ensure m_items_id is saved correctly in stock_gudang
          if (!stockGudang.m_items_id || stockGudang.m_items_id !== m_items_id) {
            await transaction.rollback();
            return res.status(500).json({ 
              status: 'error', 
              message: `CRITICAL ERROR: Failed to save m_items_id in stock_gudang. Expected: ${m_items_id}, Got: ${stockGudang.m_items_id || 'NULL'}. Database integrity check failed.`
            });
          }
        }

        // VALIDATION: Double check stock_gudang has correct m_items_id
        if (!stockGudang.m_items_id) {
          await transaction.rollback();
          return res.status(500).json({ 
            status: 'error', 
            message: `CRITICAL ERROR: stock_gudang m_items_id is NULL for item ${m_items_id}. Cannot proceed with incomplete data.`
          });
        }

        if (stockGudang.m_items_id !== m_items_id) {
          await transaction.rollback();
          return res.status(500).json({ 
            status: 'error', 
            message: `CRITICAL ERROR: stock_gudang m_items_id mismatch. Expected: ${m_items_id}, Found: ${stockGudang.m_items_id}. Data integrity violation.`
          });
        }

        // 6.2. Check if this penerimaan already has stock_gudang_d entry for this item
        const existingStockD = await req.models.stock_gudang_d.findOne({
          where: {
            stock_gudang_id: stockGudang.id,
            t_penerimaan_barangs_id: penerimaan_id,
            m_items_id: m_items_id
          },
          transaction
        });

        if (existingStockD) {
          await transaction.rollback();
          return res.status(400).json({ 
            status: 'error', 
            message: `Item ${m_items_id} already posted for this penerimaan` 
          });
        }

        // 6.3. Create stock_gudang_d entry
        const stockGudangD = await req.models.stock_gudang_d.create({
          stock_gudang_id: stockGudang.id,
          t_penerimaan_barangs_id: penerimaan_id,
          m_items_id: m_items_id,
          stock_masuk: qty
        }, { transaction });

        // VALIDATION: Ensure stock_gudang_d created successfully with correct data
        if (!stockGudangD || !stockGudangD.id) {
          await transaction.rollback();
          return res.status(500).json({ 
            status: 'error', 
            message: `CRITICAL ERROR: Failed to create stock_gudang_d entry for item ${m_items_id}. Transaction aborted.`
          });
        }

        if (stockGudangD.m_items_id !== m_items_id) {
          await transaction.rollback();
          return res.status(500).json({ 
            status: 'error', 
            message: `CRITICAL ERROR: stock_gudang_d m_items_id mismatch. Expected: ${m_items_id}, Got: ${stockGudangD.m_items_id}. Data integrity violation.`
          });
        }

        if (stockGudangD.stock_masuk !== qty) {
          await transaction.rollback();
          return res.status(500).json({ 
            status: 'error', 
            message: `CRITICAL ERROR: stock_gudang_d stock_masuk mismatch. Expected: ${qty}, Got: ${stockGudangD.stock_masuk}. Data integrity violation.`
          });
        }

        stockGudangDEntries.push(stockGudangD);

        // 6.4. Recalculate free_stock for THIS stock_gudang (gudang + item)
        // Sum all stock_masuk for this specific stock_gudang
        const totalFreeStockForItem = await req.models.stock_gudang_d.sum('stock_masuk', {
          where: {
            stock_gudang_id: stockGudang.id
          },
          transaction
        });

        // VALIDATION: Ensure free_stock calculation is valid
        if (totalFreeStockForItem === null || totalFreeStockForItem === undefined) {
          await transaction.rollback();
          return res.status(500).json({ 
            status: 'error', 
            message: `CRITICAL ERROR: Failed to calculate free_stock for item ${m_items_id}. SUM returned NULL/undefined.`
          });
        }

        if (totalFreeStockForItem < qty) {
          await transaction.rollback();
          return res.status(500).json({ 
            status: 'error', 
            message: `CRITICAL ERROR: Calculated free_stock (${totalFreeStockForItem}) is less than current qty (${qty}) for item ${m_items_id}. Data integrity violation.`
          });
        }

        // 6.5. Update stock_gudang free_stock for THIS item
        const [updateCount] = await req.models.stock_gudang.update({
          free_stock: totalFreeStockForItem
        }, { 
          where: { id: stockGudang.id },
          transaction 
        });

        // VALIDATION: Ensure update was successful
        if (updateCount === 0) {
          await transaction.rollback();
          return res.status(500).json({ 
            status: 'error', 
            message: `CRITICAL ERROR: Failed to update free_stock for stock_gudang ${stockGudang.id}. No rows updated.`
          });
        }

        // Refresh stock_gudang to get updated values
        await stockGudang.reload({ transaction });

        // VALIDATION: Verify free_stock was updated correctly
        if (stockGudang.free_stock !== totalFreeStockForItem) {
          await transaction.rollback();
          return res.status(500).json({ 
            status: 'error', 
            message: `CRITICAL ERROR: free_stock verification failed. Expected: ${totalFreeStockForItem}, Got: ${stockGudang.free_stock}. Data integrity violation.`
          });
        }

        // FINAL VALIDATION: Verify m_items_id is still correct after all operations
        if (!stockGudang.m_items_id || stockGudang.m_items_id !== m_items_id) {
          await transaction.rollback();
          return res.status(500).json({ 
            status: 'error', 
            message: `CRITICAL ERROR: m_items_id verification failed after update. Expected: ${m_items_id}, Got: ${stockGudang.m_items_id || 'NULL'}. Data integrity violation.`
          });
        }

        processedStockGudang.push({
          stock_gudang_id: stockGudang.id,
          m_items_id: m_items_id,
          free_stock: totalFreeStockForItem
        });
      }

      // FINAL VALIDATION: Ensure all items were processed successfully
      if (processedStockGudang.length !== allItems.length) {
        await transaction.rollback();
        return res.status(500).json({ 
          status: 'error', 
          message: `CRITICAL ERROR: Not all items were processed. Expected: ${allItems.length}, Processed: ${processedStockGudang.length}. Transaction aborted.`
        });
      }

      if (stockGudangDEntries.length !== allItems.length) {
        await transaction.rollback();
        return res.status(500).json({ 
          status: 'error', 
          message: `CRITICAL ERROR: Not all stock_gudang_d entries created. Expected: ${allItems.length}, Created: ${stockGudangDEntries.length}. Transaction aborted.`
        });
      }

      // 10. Update penerimaan status to POST
      await penerimaan.update({ 
        status: 'POST' 
      }, { transaction });

      // 11. Update PO status_transaksi based on total received qty vs qty_po
      // Get unique PO IDs from detail items
      const poIds = [...new Set(detailItems.map(d => d.t_purchase_order_id).filter(Boolean))];
      
      if (poIds.length > 0) {
        const t_purchase_order = req.models.t_purchase_order;
        const t_purchase_order_d = req.models.t_purchase_order_d;
        
        if (!t_purchase_order) {
          throw new Error('CRITICAL ERROR: Model t_purchase_order tidak ditemukan.');
        }
        if (!t_purchase_order_d) {
          throw new Error('CRITICAL ERROR: Model t_purchase_order_d tidak ditemukan.');
        }

        // Process each PO to determine status
        const partialPOs = [];
        const receivedPOs = [];

        for (const poId of poIds) {
          // Get total qty_po from t_purchase_order_d for this PO
          const totalQtyPO = await t_purchase_order_d.sum('qty_po', {
            where: { t_purchase_order_id: poId },
            transaction
          }) || 0;

          // Get all penerimaan detail for this PO and calculate total received
          const allPenerimaanForPO = await DetailModel.findAll({
            where: { t_purchase_order_id: poId },
            include: [{
              model: req.models.t_penerimaan_barangs,
              as: 't_penerimaan_barang',
              attributes: ['id', 'status']
            }],
            transaction
          });

          // Sum qty_diterima from all penerimaan that are POST
          const totalReceived = allPenerimaanForPO
            .filter(d => d.t_penerimaan_barang?.status === 'POST')
            .reduce((sum, d) => sum + (d.qty_diterima || 0), 0);

          console.log(`📦 PO ${poId}: qty_po=${totalQtyPO}, total_diterima=${totalReceived}`);

          // Determine status: RECEIVED if total diterima >= qty_po, else PARTIAL
          if (totalReceived >= totalQtyPO) {
            receivedPOs.push(poId);
          } else if (totalReceived > 0) {
            partialPOs.push(poId);
          }
        }

        // Update POs to PARTIAL
        if (partialPOs.length > 0) {
          const [partialCount] = await t_purchase_order.update(
            { status_transaksi: 'PARTIAL' },
            {
              where: { id: partialPOs },
              transaction
            }
          );
          console.log(`✅ Updated ${partialCount} PO(s) to PARTIAL:`, partialPOs);
        }

        // Update POs to RECEIVED
        if (receivedPOs.length > 0) {
          const [receivedCount] = await t_purchase_order.update(
            { status_transaksi: 'RECEIVED' },
            {
              where: { id: receivedPOs },
              transaction
            }
          );
          console.log(`✅ Updated ${receivedCount} PO(s) to RECEIVED:`, receivedPOs);
        }
      }

      // Commit transaction
      await transaction.commit();

      res.json({ 
        status: 'success', 
        message: 'Penerimaan posted successfully',
        data: {
          penerimaan_id: penerimaan.id,
          no_penerimaan: penerimaan.no_penerimaan,
          status: 'POST',
          total_items_processed: allItems.length,
          stock_gudang_d_created: stockGudangDEntries.length,
          processed_stock_gudang: processedStockGudang
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error('Error posting penerimaan:', error);
      
      // Return detailed error message
      const errorMessage = error.message || 'Failed to post penerimaan';
      const errorDetails = error.errors ? error.errors.map(e => e.message).join(', ') : null;
      
      return res.status(500).json({ 
        status: 'error', 
        message: errorDetails || errorMessage,
        error: errorMessage
      });
    }
  },

  // =====================================================================
  // SYNC STOCK DARI PENERIMAAN YANG SUDAH POST
  // Untuk memperbaiki data penerimaan yang POST tapi belum punya stock_gudang_d
  // =====================================================================
  async syncStockFromPenerimaan(req, res) {
    const transaction = await req.models.t_penerimaan_barangs.sequelize.transaction();

    try {
      console.log('🔥 START SYNC STOCK FROM PENERIMAAN');

      const {
        t_penerimaan_barangs,
        stock_gudang,
        stock_gudang_d
      } = req.models;

      const { Op } = t_penerimaan_barangs.sequelize.Sequelize;

      // 1. Get all penerimaan with status POST
      const DetailModel = req.models.t_penerimaan_barang_d || req.models.t_penerimaan_barangs_d;
      const BonusModel = req.models.t_penerimaan_barang_bonu || req.models.t_penerimaan_barangs_bonu;

      const allPenerimaanPOST = await t_penerimaan_barangs.findAll({
        where: { status: 'POST' },
        transaction
      });

      console.log(`📋 Found ${allPenerimaanPOST.length} penerimaan with POST status`);

      const syncResults = {
        total_penerimaan: allPenerimaanPOST.length,
        already_synced: 0,
        newly_synced: 0,
        skipped: 0,
        errors: [],
        details: []
      };

      for (const penerimaan of allPenerimaanPOST) {
        try {
          // Check if this penerimaan already has stock_gudang_d entries
          const existingStockD = await stock_gudang_d.findOne({
            where: { t_penerimaan_barangs_id: penerimaan.id },
            transaction
          });

          if (existingStockD) {
            syncResults.already_synced++;
            syncResults.details.push({
              penerimaan_id: penerimaan.id,
              no_penerimaan: penerimaan.no_penerimaan,
              status: 'ALREADY_SYNCED'
            });
            continue;
          }

          // Get detail items
          const detailItems = await DetailModel.findAll({
            where: { t_penerimaan_barangs_id: penerimaan.id },
            transaction
          });

          // Get bonus items if model exists
          let bonusItems = [];
          if (BonusModel) {
            bonusItems = await BonusModel.findAll({
              where: { t_penerimaan_barangs_id: penerimaan.id },
              transaction
            });
          }

          // Combine all items
          const allItems = [
            ...detailItems.map(d => ({ 
              m_items_id: d.m_items_id, 
              qty: d.qty_diterima,
              type: 'detail'
            })),
            ...bonusItems.map(b => ({ 
              m_items_id: b.m_items_id, 
              qty: b.qty_bonus,
              type: 'bonus'
            }))
          ];

          if (allItems.length === 0) {
            syncResults.skipped++;
            syncResults.details.push({
              penerimaan_id: penerimaan.id,
              no_penerimaan: penerimaan.no_penerimaan,
              status: 'SKIPPED',
              reason: 'No items found'
            });
            continue;
          }

          // Process each item
          let itemsProcessed = 0;
          for (const item of allItems) {
            const { m_items_id, qty } = item;

            if (!m_items_id || !qty || qty <= 0) continue;

            // Find or create stock_gudang
            let stockGudangRecord = await stock_gudang.findOne({
              where: {
                m_gudang_id: penerimaan.m_gudang_id,
                m_items_id: m_items_id
              },
              transaction
            });

            if (!stockGudangRecord) {
              stockGudangRecord = await stock_gudang.create({
                m_gudang_id: penerimaan.m_gudang_id,
                m_items_id: m_items_id,
                free_stock: 0
              }, { transaction });
            }

            // Create stock_gudang_d entry
            await stock_gudang_d.create({
              stock_gudang_id: stockGudangRecord.id,
              t_penerimaan_barangs_id: penerimaan.id,
              m_items_id: m_items_id,
              stock_masuk: qty,
              stock_keluar: 0
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
            penerimaan_id: penerimaan.id,
            no_penerimaan: penerimaan.no_penerimaan,
            status: 'NEWLY_SYNCED',
            items_processed: itemsProcessed
          });

        } catch (itemError) {
          syncResults.errors.push({
            penerimaan_id: penerimaan.id,
            no_penerimaan: penerimaan.no_penerimaan,
            error: itemError.message
          });
        }
      }

      await transaction.commit();

      console.log('✅ SYNC STOCK COMPLETED');
      console.log(`📊 Already synced: ${syncResults.already_synced}`);
      console.log(`📊 Newly synced: ${syncResults.newly_synced}`);
      console.log(`📊 Skipped: ${syncResults.skipped}`);
      console.log(`📊 Errors: ${syncResults.errors.length}`);

      return res.json({
        status: 'success',
        message: 'Stock sync from penerimaan completed',
        data: syncResults
      });

    } catch (error) {
      await transaction.rollback();
      console.error('❌ SYNC STOCK ERROR:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  }

};

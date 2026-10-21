// Controller for t_purchase_order_d
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_order_d
//
// Tambahkan custom function di bawah ini

export const t_purchase_order_dController = {
  // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
  async uploadImage(req, res) {
    const fileFields = Object.keys(req.models.t_purchase_order_d.rawAttributes).filter(
      key => req.models.t_purchase_order_d.rawAttributes[key].type && req.models.t_purchase_order_d.rawAttributes[key].type.key === 'STRING'
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
      const inserted = await req.models.t_purchase_order_d.create(data);
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
      const inserted = await req.models.t_purchase_order_d.bulkCreate(records);
      res.json({ message: 'Excel imported', data: inserted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Contoh: Custom function
  async customFunction(req, res) {
    res.json({ message: 'Custom function untuk t_purchase_order_d', body: req.body, query: req.query });
  },

  // Get Detail PO with penerimaan data (qty_diterima, qty_sisa)
  async GetDetail(req, res) {
    try {
      const {
        page = 1,
        paginate = 20,
        search,
        searchfield,
        order_by = 'createdAt',
        order_type = 'DESC'
      } = req.query;

      const {
        t_purchase_order_d,
        t_purchase_order,
        t_penerimaan_barang_d,
        t_penerimaan_barangs,
        m_items,
        m_general,
        m_gudang
      } = req.models;

      const { Op } = t_purchase_order_d.sequelize.Sequelize;

      // Build WHERE clause for t_purchase_order_d
      const where = {};

      // Build WHERE clause for t_purchase_order (nested filter)
      const poWhere = {};

      // Default filter: PO status must be APPROVED
      poWhere.status = 'APPROVED';

      // Apply column filters from query params
      Object.keys(req.query).forEach(key => {
        if (key.startsWith('filter_column_')) {
          const column = key.replace('filter_column_', '');
          
          // Check if filter is for nested t_purchase_order
          if (column.startsWith('t_purchase_order.')) {
            const poColumn = column.replace('t_purchase_order.', '');
            poWhere[poColumn] = req.query[key];
          } else {
            // Filter untuk t_purchase_order_d langsung
            where[column] = req.query[key];
          }
        }
      });

      // Build search conditions
      let searchConditions = [];
      if (search && searchfield) {
        const searchFields = searchfield.split(',').map(f => f.trim());
        
        searchFields.forEach(field => {
          // Handle nested search (e.g., t_purchase_order.no_po, m_item.kode_item)
          if (field.includes('.')) {
            // Search akan di-handle di include filter
            // Sequelize tidak support nested search di main where
          } else {
            searchConditions.push({
              [field]: { [Op.iLike]: `%${search}%` }
            });
          }
        });
      }

      if (searchConditions.length > 0) {
        where[Op.or] = searchConditions;
      }

      // Build include with nested filters
      const include = [
        {
          model: t_purchase_order,
          where: poWhere,
          required: true
        },
        {
          model: m_items,
          as: 'm_item',
          include: [
            {
              model: m_general,
              as: 'uom',
              attributes: ['id', 'value1']
            }
          ]
        }
      ];

      // Build order
      const order = [[order_by, order_type.toUpperCase()]];

      // Pagination
      const limit = parseInt(paginate);
      const offset = (parseInt(page) - 1) * limit;

      // Query t_purchase_order_d
      const { count, rows } = await t_purchase_order_d.findAndCountAll({
        where,
        include,
        order,
        limit,
        offset,
        distinct: true
      });

      // Convert to JSON
      let data = rows.map(row => row.toJSON());

      // For each item, get all penerimaan history (only POST status)
      for (let item of data) {
        // Find all penerimaan data for this PO detail (only POST status)
        const penerimaanDetails = await t_penerimaan_barang_d.findAll({
          where: {
            t_purchase_order_d_id: item.id
          },
          include: [
            {
              model: t_penerimaan_barangs,
              attributes: ['id', 'no_penerimaan', 'status', 'm_gudang_id'],
              where: {
                status: 'POST'  // Only get POST status
              },
              required: true,  // Inner join - only items with POST penerimaan
              include: [
                {
                  model: m_gudang,
                  attributes: ['id', 'kode_gudang', 'nama_gudang']
                }
              ]
            }
          ],
          order: [['createdAt', 'DESC']]
        });

        // Build history array and calculate totals
        if (penerimaanDetails && penerimaanDetails.length > 0) {
          // Calculate accumulated qty for each history entry (from oldest to newest)
          const reversedDetails = [...penerimaanDetails].reverse(); // Oldest first
          let accumulatedQty = 0;
          
          const historyArray = reversedDetails.map(detail => {
            const detailJSON = detail.toJSON();
            const qtyDiterima = detailJSON.qty_diterima || 0;
            accumulatedQty += qtyDiterima;
            
            return {
              qty_po: item.qty_po || 0,  // Add qty_po to each history
              qty_diterima: qtyDiterima,
              qty_sisa: (item.qty_po || 0) - accumulatedQty,  // Calculate qty_sisa based on accumulated qty
              t_penerimaan_id: detailJSON.t_penerimaan_barang?.id || null,
              no_penerimaan: detailJSON.t_penerimaan_barang?.no_penerimaan || null,
              gudang_id: detailJSON.t_penerimaan_barang?.m_gudang?.id || null,
              kode_gudang: detailJSON.t_penerimaan_barang?.m_gudang?.kode_gudang || null,
              nama_gudang: detailJSON.t_penerimaan_barang?.m_gudang?.nama_gudang || null
            };
          }).reverse(); // Reverse back to newest first

          // Calculate total qty_diterima from all POST penerimaan
          const totalQtyDiterima = historyArray.reduce((sum, h) => sum + (h.qty_diterima || 0), 0);
          
          // Calculate qty_sisa: qty_po - total qty_diterima from all penerimaan
          item.qty_diterima = totalQtyDiterima;
          item.qty_sisa = (item.qty_po || 0) - totalQtyDiterima;
          
          // Add full history array
          item.history_penerimaan = historyArray;
        } else {
          // If no POST penerimaan yet, qty_diterima = 0, qty_sisa = qty_po
          item.qty_diterima = 0;
          item.qty_sisa = item.qty_po || 0;
          item.history_penerimaan = [];
        }
      }

      // Filter out items with qty_sisa = 0 (already fully received)
      const filteredData = data.filter(item => (item.qty_sisa || 0) > 0);

      // Optimize response - only send necessary fields
      const optimizedData = filteredData.map(item => ({
        id: item.id,
        t_purchase_order_id: item.t_purchase_order_id,
        m_items_id: item.m_items_id,
        qty_po: item.qty_po,
        qty_diterima: item.qty_diterima,
        qty_sisa: item.qty_sisa,
        // Simplified t_purchase_order - only no_po
        t_purchase_order: {
          no_po: item.t_purchase_order?.no_po || '-'
        },
        // Simplified m_item - only essential fields
        m_item: {
          kode_item: item.m_item?.kode_item || '-',
          nama_item: item.m_item?.nama_item || '-',
          uom: {
            value1: item.m_item?.uom?.value1 || '-'
          }
        },
        // Full history array
        history_penerimaan: item.history_penerimaan || []
      }));

      // Calculate pagination based on filtered data
      const totalPages = Math.ceil(count / limit);

      return res.json({
        status: 'success',
        message: 'Data purchase order detail berhasil diambil',
        data: optimizedData,
        pagination: {
          total: optimizedData.length,
          page: parseInt(page),
          totalPages,
          limit,
          currentRowsCount: optimizedData.length,
          next_page: parseInt(page) < totalPages ? parseInt(page) + 1 : null,
          prev_page: parseInt(page) > 1 ? parseInt(page) - 1 : null
        }
      });

    } catch (error) {
      console.error('GetDetail ERROR:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  },

  // Get Detail PO Done - Items yang sudah fully received (qty_sisa = 0)
  async GetDetailDone(req, res) {
    try {
      const {
        page = 1,
        paginate = 20,
        search,
        searchfield,
        order_by = 'createdAt',
        order_type = 'DESC'
      } = req.query;

      const {
        t_purchase_order_d,
        t_purchase_order,
        t_penerimaan_barang_d,
        t_penerimaan_barangs,
        m_items,
        m_general,
        m_gudang
      } = req.models;

      const { Op } = t_purchase_order_d.sequelize.Sequelize;

      // Build WHERE clause for t_purchase_order_d
      const where = {};

      // Build WHERE clause for t_purchase_order (nested filter)
      const poWhere = {};

      // Default filter: PO status must be APPROVED
      poWhere.status = 'APPROVED';

      // Apply column filters from query params
      Object.keys(req.query).forEach(key => {
        if (key.startsWith('filter_column_')) {
          const column = key.replace('filter_column_', '');
          
          // Check if filter is for nested t_purchase_order
          if (column.startsWith('t_purchase_order.')) {
            const poColumn = column.replace('t_purchase_order.', '');
            poWhere[poColumn] = req.query[key];
          } else {
            // Filter untuk t_purchase_order_d langsung
            where[column] = req.query[key];
          }
        }
      });

      // Build search conditions
      let searchConditions = [];
      if (search && searchfield) {
        const searchFields = searchfield.split(',').map(f => f.trim());
        
        searchFields.forEach(field => {
          // Handle nested search (e.g., t_purchase_order.no_po, m_item.kode_item)
          if (field.includes('.')) {
            // Search akan di-handle di include filter
            // Sequelize tidak support nested search di main where
          } else {
            searchConditions.push({
              [field]: { [Op.iLike]: `%${search}%` }
            });
          }
        });
      }

      if (searchConditions.length > 0) {
        where[Op.or] = searchConditions;
      }

      // Build include with nested filters
      const include = [
        {
          model: t_purchase_order,
          where: poWhere,
          required: true
        },
        {
          model: m_items,
          as: 'm_item',
          include: [
            {
              model: m_general,
              as: 'uom',
              attributes: ['id', 'value1']
            }
          ]
        }
      ];

      // Build order
      const order = [[order_by, order_type.toUpperCase()]];

      // Pagination
      const limit = parseInt(paginate);
      const offset = (parseInt(page) - 1) * limit;

      // Query t_purchase_order_d
      const { count, rows } = await t_purchase_order_d.findAndCountAll({
        where,
        include,
        order,
        limit,
        offset,
        distinct: true
      });

      // Convert to JSON
      let data = rows.map(row => row.toJSON());

      // For each item, get all penerimaan history (only POST status)
      for (let item of data) {
        // Find all penerimaan data for this PO detail (only POST status)
        const penerimaanDetails = await t_penerimaan_barang_d.findAll({
          where: {
            t_purchase_order_d_id: item.id
          },
          include: [
            {
              model: t_penerimaan_barangs,
              attributes: ['id', 'no_penerimaan', 'status', 'm_gudang_id'],
              where: {
                status: 'POST'  // Only get POST status
              },
              required: true,  // Inner join - only items with POST penerimaan
              include: [
                {
                  model: m_gudang,
                  attributes: ['id', 'kode_gudang', 'nama_gudang']
                }
              ]
            }
          ],
          order: [['createdAt', 'DESC']]
        });

        // Build history array and calculate totals
        if (penerimaanDetails && penerimaanDetails.length > 0) {
          // Calculate accumulated qty for each history entry (from oldest to newest)
          const reversedDetails = [...penerimaanDetails].reverse(); // Oldest first
          let accumulatedQty = 0;
          
          const historyArray = reversedDetails.map(detail => {
            const detailJSON = detail.toJSON();
            const qtyDiterima = detailJSON.qty_diterima || 0;
            accumulatedQty += qtyDiterima;
            
            return {
              qty_po: item.qty_po || 0,  // Add qty_po to each history
              qty_diterima: qtyDiterima,
              qty_sisa: (item.qty_po || 0) - accumulatedQty,  // Calculate qty_sisa based on accumulated qty
              t_penerimaan_id: detailJSON.t_penerimaan_barang?.id || null,
              no_penerimaan: detailJSON.t_penerimaan_barang?.no_penerimaan || null,
              gudang_id: detailJSON.t_penerimaan_barang?.m_gudang?.id || null,
              kode_gudang: detailJSON.t_penerimaan_barang?.m_gudang?.kode_gudang || null,
              nama_gudang: detailJSON.t_penerimaan_barang?.m_gudang?.nama_gudang || null
            };
          }).reverse(); // Reverse back to newest first

          // Calculate total qty_diterima from all POST penerimaan
          const totalQtyDiterima = historyArray.reduce((sum, h) => sum + (h.qty_diterima || 0), 0);
          
          // Calculate qty_sisa: qty_po - total qty_diterima from all penerimaan
          item.qty_diterima = totalQtyDiterima;
          item.qty_sisa = (item.qty_po || 0) - totalQtyDiterima;
          
          // Add full history array
          item.history_penerimaan = historyArray;
        } else {
          // If no POST penerimaan yet, qty_diterima = 0, qty_sisa = qty_po
          item.qty_diterima = 0;
          item.qty_sisa = item.qty_po || 0;
          item.history_penerimaan = [];
        }
      }

      // Filter ONLY items with qty_sisa = 0 (fully received / DONE)
      const filteredData = data.filter(item => (item.qty_sisa || 0) === 0);

      // Optimize response - only send necessary fields
      const optimizedData = filteredData.map(item => ({
        id: item.id,
        t_purchase_order_id: item.t_purchase_order_id,
        m_items_id: item.m_items_id,
        qty_po: item.qty_po,
        qty_diterima: item.qty_diterima,
        qty_sisa: item.qty_sisa,
        // Simplified t_purchase_order - only no_po
        t_purchase_order: {
          no_po: item.t_purchase_order?.no_po || '-'
        },
        // Simplified m_item - only essential fields
        m_item: {
          kode_item: item.m_item?.kode_item || '-',
          nama_item: item.m_item?.nama_item || '-',
          uom: {
            value1: item.m_item?.uom?.value1 || '-'
          }
        },
        // Full history array
        history_penerimaan: item.history_penerimaan || []
      }));

      // Calculate pagination based on filtered data
      const totalPages = Math.ceil(count / limit);

      return res.json({
        status: 'success',
        message: 'Data purchase order detail yang sudah selesai diterima berhasil diambil',
        data: optimizedData,
        pagination: {
          total: optimizedData.length,
          page: parseInt(page),
          totalPages,
          limit,
          currentRowsCount: optimizedData.length,
          next_page: parseInt(page) < totalPages ? parseInt(page) + 1 : null,
          prev_page: parseInt(page) > 1 ? parseInt(page) - 1 : null
        }
      });

    } catch (error) {
      console.error('GetDetailDone ERROR:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  }
};

// Controller for t_purchase_invoice_d
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_invoice_d
//
// Tambahkan custom function di bawah ini

export const t_purchase_invoice_dController = {
  // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
  async uploadImage(req, res) {
    const fileFields = Object.keys(req.models.t_purchase_invoice_d.rawAttributes).filter(
      key => req.models.t_purchase_invoice_d.rawAttributes[key].type && req.models.t_purchase_invoice_d.rawAttributes[key].type.key === 'STRING'
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
      const inserted = await req.models.t_purchase_invoice_d.create(data);
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
      const inserted = await req.models.t_purchase_invoice_d.bulkCreate(records);
      res.json({ message: 'Excel imported', data: inserted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Contoh: Custom function
  async customFunction(req, res) {
    res.json({ message: 'Custom function untuk t_purchase_invoice_d', body: req.body, query: req.query });
  },

  // Get Purchase Invoice Detail dengan data lengkap dari PO, PB, dan Items
  async GetPIDetailReturn(req, res) {
    try {
      const {
        page = 1,
        paginate = 20,
        no_pagination,
        search,
        searchfield,
        order_by,
        order_type = 'DESC',
        t_purchase_invoice_id
      } = req.query;

      const {
        t_purchase_invoice_d,
        t_purchase_order_d,
        t_purchase_order,
        t_penerimaan_barang_d,
        m_rak_d,
        m_rak,
        m_items
      } = req.models;

      const { Op } = t_purchase_invoice_d.sequelize.Sequelize;

      // Build WHERE clause
      const where = {};

      // Filter by t_purchase_invoice_id if provided
      if (t_purchase_invoice_id) {
        where.t_purchase_invoice_id = t_purchase_invoice_id;
      }

      // Apply column filters
      Object.keys(req.query).forEach(key => {
        if (key.startsWith('filter_column_')) {
          const column = key.replace('filter_column_', '');
          where[column] = req.query[key];
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

      // Query with all relations
      const { count, rows } = await t_purchase_invoice_d.findAndCountAll({
        where,
        include: [
          {
            model: t_purchase_order_d,
            attributes: ['id', 't_purchase_order_id', 'qty_po', 'harga', 'disc_1', 'disc_2', 'amt_disc'],
            required: false,
            include: [
              {
                model: t_purchase_order,
                attributes: ['id', 'no_po', 'tgl_po', 'status', 'status_transaksi'],
                required: false
              }
            ]
          },
          {
            model: t_penerimaan_barang_d,
            attributes: ['id', 't_penerimaan_barangs_id', 'm_items_id', 'qty_diterima', 'catatan', 'rak_d_id'],
            required: false,
            include: (m_rak_d && m_rak) ? [
              {
                model: m_rak_d,
                attributes: ['id', 'kode'],
                required: false,
                include: [
                  {
                    model: m_rak,
                    attributes: ['id', 'nama_rak'],
                    required: false
                  }
                ]
              }
            ] : []
          },
          {
            model: m_items,
            attributes: ['id', 'kode_item', 'nama_item', 'nama_singkat', 'satuan_id'],
            required: false
          }
        ],
        order,
        distinct: true,
        ...(no_pagination !== 'true' && {
          limit: parseInt(paginate),
          offset: (parseInt(page) - 1) * parseInt(paginate)
        })
      });

      // Transform data untuk response yang lebih clean
      const transformedData = rows.map(row => {
        const data = row.toJSON();
        
        return {
          id: data.id,
          t_purchase_invoice_id: data.t_purchase_invoice_id,
          t_purchase_order_d_id: data.t_purchase_order_d_id,
          t_penerimaan_barang_d_id: data.t_penerimaan_barang_d_id,

          t_purchase_order: data.t_purchase_order_d?.t_purchase_order || null,
          t_purchase_order_d: data.t_purchase_order_d || null,
          t_penerimaan_barang_d: data.t_penerimaan_barang_d || null,
          rak_d_id: data.t_penerimaan_barang_d?.rak_d_id || null,
          nama_rak_detail: data.t_penerimaan_barang_d?.m_rak_d?.kode
            ? `${data.t_penerimaan_barang_d.m_rak_d.kode} (${data.t_penerimaan_barang_d?.m_rak_d?.m_rak?.nama_rak || '-'})`
            : null,
          m_items_id: data.m_items_id || data.t_penerimaan_barang_d?.m_items_id || null,
          kode_item: data.m_item?.kode_item || null,
          nama_item: data.m_item?.nama_item || null,
          nama_singkat: data.m_item?.nama_singkat || null,
          qty_diterima: data.t_penerimaan_barang_d?.qty_diterima || 0,
          qty_po: data.t_purchase_order_d?.qty_po || 0,
          qty_pi: data.qty_pi !== null && data.qty_pi !== undefined ? data.qty_pi : 0,
          qty_retur: data.qty_retur !== null && data.qty_retur !== undefined ? data.qty_retur : 0,
          harga: data.harga || data.t_purchase_order_d?.harga || 0,
          disc_1: data.disc_1 || data.t_purchase_order_d?.disc_1 || 0,
          disc_2: data.disc_2 || data.t_purchase_order_d?.disc_2 || 0,
          amt_disc: data.amt_disc || data.t_purchase_order_d?.amt_disc || 0,
          catatan: data.catatan || null,
          catatan_pb: data.t_penerimaan_barang_d?.catatan || null,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        };
      });

      // Pagination info
      let result;
      if (no_pagination === 'true') {
        result = {
          data: transformedData,
          pagination: {
            total: count,
            page: 1,
            totalPages: 1,
            limit: count,
            currentRowsCount: transformedData.length,
            next_page: null,
            prev_page: null
          }
        };
      } else {
        const limit = parseInt(paginate);
        const currentPage = parseInt(page);
        const totalPages = Math.ceil(count / limit);
        
        result = {
          data: transformedData,
          pagination: {
            total: count,
            page: currentPage,
            totalPages,
            limit,
            currentRowsCount: transformedData.length,
            next_page: currentPage < totalPages ? currentPage + 1 : null,
            prev_page: currentPage > 1 ? currentPage - 1 : null
          }
        };
      }

      return res.json({
        status: 'success',
        message: 'Purchase Invoice Detail retrieved successfully',
        ...result
      });

    } catch (error) {
      console.error('GetPIDetailFull ERROR:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  }
};

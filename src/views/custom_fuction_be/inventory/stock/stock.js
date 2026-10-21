// Controller for stock_gudang
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.stock_gudang
//
// Tambahkan custom function di bawah ini

export const stock_gudangController = {
  // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
  async uploadImage(req, res) {
    const fileFields = Object.keys(req.models.stock_gudang.rawAttributes).filter(
      key => req.models.stock_gudang.rawAttributes[key].type && req.models.stock_gudang.rawAttributes[key].type.key === 'STRING'
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
      const inserted = await req.models.stock_gudang.create(data);
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
      const inserted = await req.models.stock_gudang.bulkCreate(records);
      res.json({ message: 'Excel imported', data: inserted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Contoh: Custom function
  async customFunction(req, res) {
    res.json({ message: 'Custom function untuk stock_gudang', body: req.body, query: req.query });
  },

  // =====================================================================
  // GET STOCK GUDANG DENGAN INCLUDE LENGKAP
  // Include: m_gudang, m_items, stock_gudang_d dengan nested includes
  // Support: pagination, search, filter, ordering
  // =====================================================================
  async getStockGudang(req, res) {
    try {
      console.log('🔥 START GET STOCK GUDANG');

      const {
        page = 1,
        paginate = 10,
        no_pagination,
        search,
        searchfield,
        order_by,
        order_type = 'ASC'
      } = req.query;

      const {
        stock_gudang,
        stock_gudang_d,
        m_gudang,
        m_items,
        m_general,
        m_group_jenis,
        m_group_merek,
        m_group_tipe,
        m_group_ukuran,
        m_group_batch,
        t_penerimaan_barangs,
        t_purchase_return,
        t_sj_gudang
      } = req.models;

      const { Op } = stock_gudang.sequelize.Sequelize;

      // Build WHERE clause untuk stock_gudang
      const where = {};

      // Apply column filters
      Object.keys(req.query).forEach(key => {
        if (key.startsWith('filter_column_')) {
          const column = key.replace('filter_column_', '');
          // Hanya filter yang belong to stock_gudang (tidak ada titik)
          if (!column.includes('.')) {
            where[column] = req.query[key];
          }
        }
      });

      // Apply search
      if (search && searchfield) {
        const searchFields = searchfield.split(',');
        const searchConditions = [];

        searchFields.forEach(field => {
          const trimmedField = field.trim();

          // Direct field search di stock_gudang
          if (!trimmedField.includes('.')) {
            searchConditions.push({
              [trimmedField]: { [Op.iLike]: `%${search}%` }
            });
          }
          // Nested search di m_gudang
          else if (trimmedField.includes('m_gudang.')) {
            const fieldName = trimmedField.split('.').pop();
            searchConditions.push({
              [`$m_gudang.${fieldName}$`]: { [Op.iLike]: `%${search}%` }
            });
          }
          // Nested search di m_item
          else if (trimmedField.includes('m_item.')) {
            const fieldName = trimmedField.split('.').pop();
            searchConditions.push({
              [`$m_item.${fieldName}$`]: { [Op.iLike]: `%${search}%` }
            });
          }
        });

        if (searchConditions.length > 0) {
          where[Op.or] = searchConditions;
        }
      }

      // Build ORDER
      let order = [];
      if (order_by) {
        order.push([order_by, order_type.toUpperCase()]);
      } else {
        order.push(['createdAt', 'DESC']);
      }

      // Build includes
      const includes = [];

      // Include m_gudang
      if (m_gudang) {
        includes.push({
          model: m_gudang,
          required: false
        });
      }

      // Include m_items di parent level (as m_item)
      if (m_items) {
        includes.push({
          model: m_items,
          as: 'm_item',
          attributes: ['id', 'nama_item'],
          required: false
        });
      }

      // Include stock_gudang_d dengan nested includes
      if (stock_gudang_d) {
        const detailInclude = {
          model: stock_gudang_d,
          as: 'stock_gudang_ds',
          required: false,
          include: []
        };

        // Include t_penerimaan_barangs
        if (t_penerimaan_barangs) {
          detailInclude.include.push({
            model: t_penerimaan_barangs,
            as: 't_penerimaan_barang',
            attributes: ['id', 'no_penerimaan'],
            required: false
          });
        }

        // Include m_items di detail level dengan nested relations
        if (m_items) {
          const itemInclude = {
            model: m_items,
            as: 'm_item',
            attributes: ['id', 'nama_item', 'min_stock', 'max_stock'],
            required: false,
            include: []
          };

          // Include UOM (m_general)
          if (m_general) {
            itemInclude.include.push({
              model: m_general,
              as: 'uom',
              attributes: ['id', 'value1'],
              required: false
            });
          }

          // Include m_group_jenis
          if (m_group_jenis) {
            itemInclude.include.push({
              model: m_group_jenis,
              as: 'm_group_jeni',
              attributes: ['id', 'nama_jenis'],
              required: false
            });
          }

          // Include m_group_merek
          if (m_group_merek) {
            itemInclude.include.push({
              model: m_group_merek,
              attributes: ['id', 'nama_merek'],
              required: false
            });
          }

          // Include m_group_tipe
          if (m_group_tipe) {
            itemInclude.include.push({
              model: m_group_tipe,
              attributes: ['id', 'nama_tipe'],
              required: false
            });
          }

          // Include m_group_ukuran
          if (m_group_ukuran) {
            itemInclude.include.push({
              model: m_group_ukuran,
              attributes: ['id', 'nama_ukuran'],
              required: false
            });
          }

          // Include m_group_batch
          if (m_group_batch) {
            itemInclude.include.push({
              model: m_group_batch,
              attributes: ['id', 'nama_batch'],
              required: false
            });
          }

          detailInclude.include.push(itemInclude);
        }

        // Include t_purchase_return (as dat_retur)
        if (t_purchase_return) {
          detailInclude.include.push({
            model: t_purchase_return,
            as: 'dat_retur',
            attributes: ['id', 'no_return'],
            required: false
          });
        }

        // Include t_sj_gudang (as dat_sj_gudang)
        if (t_sj_gudang) {
          detailInclude.include.push({
            model: t_sj_gudang,
            as: 'dat_sj_gudang',
            attributes: ['id', 'no_sj_gudang', 'tgl_sj_gudang'],
            required: false
          });
        }

        // Include t_penerimaan_gudang (as penerimaan_gudang)
        const t_penerimaan_gudang = req.models.t_penerimaan_gudang;
        if (t_penerimaan_gudang) {
          detailInclude.include.push({
            model: t_penerimaan_gudang,
            as: 'penerimaan_gudang',
            attributes: ['id', 'no_penerimaan_gudang', 'tgl_penerimaan_gudang'],
            required: false
          });
        }

        includes.push(detailInclude);
      }

      console.log('📌 Total includes:', includes.length);

      // Query options
      let queryOptions = {
        where,
        include: includes,
        order,
        distinct: true
      };

      console.log('📌 Query where:', JSON.stringify(where, null, 2));

      // Execute query with or without pagination
      let result;
      if (no_pagination === 'true') {
        const data = await stock_gudang.findAll(queryOptions);

        result = {
          data,
          pagination: null
        };
      } else {
        const currentPage = parseInt(page);
        const limit = parseInt(paginate);
        const offset = (currentPage - 1) * limit;

        queryOptions.limit = limit;
        queryOptions.offset = offset;

        const { count, rows } = await stock_gudang.findAndCountAll(queryOptions);
        const totalPages = Math.ceil(count / limit);

        result = {
          data: rows,
          pagination: {
            total: count,
            page: currentPage,
            totalPages,
            limit,
            currentRowsCount: rows.length,
            next_page: currentPage < totalPages ? currentPage + 1 : null,
            prev_page: currentPage > 1 ? currentPage - 1 : null
          }
        };
      }

      console.log('✅ Stock Gudang found:', result.data.length);

      return res.json({
        status: 'success',
        ...result
      });

    } catch (err) {
      console.error('❌ GET STOCK GUDANG ERROR:', err);
      return res.status(500).json({
        status: 'error',
        message: err.message,
        details: err.stack
      });
    }
  },

  // =====================================================================
  // GET HISTORY MASUK (Stock Masuk dari Penerimaan Barang & Penerimaan Gudang)
  // Query: stock_gudang_d WHERE t_penerimaan_barangs_id IS NOT NULL OR t_penerimaan_gudang_id IS NOT NULL
  // Include: m_item (nested), t_penerimaan_barang, t_penerimaan_gudang, stock_gudang (m_gudang)
  // Support: pagination, search, filter, ordering
  // =====================================================================
  async stock_masuk(req, res) {
    try {
      console.log('🔥 START GET HISTORY MASUK');

      const {
        page = 1,
        paginate = 10,
        no_pagination,
        search,
        searchfield,
        order_by,
        order_type = 'DESC'
      } = req.query;

      const {
        stock_gudang_d,
        stock_gudang,
        m_gudang,
        m_items,
        m_general,
        m_group_jenis,
        m_group_merek,
        m_group_tipe,
        m_group_ukuran,
        m_group_batch,
        t_penerimaan_barangs,
        t_penerimaan_gudang
      } = req.models;

      const { Op } = stock_gudang_d.sequelize.Sequelize;

      // WHERE: stock masuk dari Penerimaan Barang ATAU Penerimaan Gudang
      const where = {
        [Op.or]: [
          { t_penerimaan_barangs_id: { [Op.not]: null } },
          { t_penerimaan_gudang_id: { [Op.not]: null } }
        ]
      };

      // Apply column filters
      // Track nested filters for includes
      const nestedFilters = {};
      
      Object.keys(req.query).forEach(key => {
        if (key.startsWith('filter_column_')) {
          const column = key.replace('filter_column_', '');
          if (!column.includes('.')) {
            // Tambahkan ke kondisi AND agar tidak overwrite Op.or
            if (!where[Op.and]) where[Op.and] = [];
            where[Op.and].push({ [column]: req.query[key] });
          } else {
            // Handle nested filter seperti stock_gudang.m_gudang_id
            const parts = column.split('.');
            if (parts.length === 2) {
              const [relation, field] = parts;
              nestedFilters[relation] = nestedFilters[relation] || {};
              nestedFilters[relation][field] = req.query[key];
            }
          }
        }
      });

      // Apply search - JANGAN TIMPA where[Op.or]!
      if (search && searchfield) {
        const searchFields = searchfield.split(',');
        const searchConditions = [];

        searchFields.forEach(field => {
          const trimmedField = field.trim();

          // Direct field
          if (!trimmedField.includes('.')) {
            searchConditions.push({
              [trimmedField]: { [Op.iLike]: `%${search}%` }
            });
          }
          // Nested search
          else if (trimmedField.includes('m_item.')) {
            const fieldName = trimmedField.split('.').pop();
            searchConditions.push({
              [`$m_item.${fieldName}$`]: { [Op.iLike]: `%${search}%` }
            });
          }
          else if (trimmedField.includes('t_penerimaan_barang.')) {
            const fieldName = trimmedField.split('.').pop();
            searchConditions.push({
              [`$t_penerimaan_barang.${fieldName}$`]: { [Op.iLike]: `%${search}%` }
            });
          }
          else if (trimmedField.includes('penerimaan_gudang.')) {
            const fieldName = trimmedField.split('.').pop();
            searchConditions.push({
              [`$penerimaan_gudang.${fieldName}$`]: { [Op.iLike]: `%${search}%` }
            });
          }
          else if (trimmedField.includes('stock_gudang.m_gudang.')) {
            const fieldName = trimmedField.split('.').pop();
            searchConditions.push({
              [`$stock_gudang.m_gudang.${fieldName}$`]: { [Op.iLike]: `%${search}%` }
            });
          }
        });

        if (searchConditions.length > 0) {
          // Gabungkan dengan AND: (kondisi_utama) AND (search_conditions)
          const mainCondition = where[Op.or];
          delete where[Op.or];
          
          if (!where[Op.and]) where[Op.and] = [];
          where[Op.and].push({ [Op.or]: mainCondition });
          where[Op.and].push({ [Op.or]: searchConditions });
        }
      }

      // Build ORDER
      let order = [];
      if (order_by) {
        order.push([order_by, order_type.toUpperCase()]);
      } else {
        order.push(['createdAt', 'DESC']);
      }

      // Build includes
      const includes = [];

      // Include t_penerimaan_barangs
      if (t_penerimaan_barangs) {
        includes.push({
          model: t_penerimaan_barangs,
          as: 't_penerimaan_barang',
          attributes: ['id', 'no_penerimaan', 'tgl_penerimaan'],
          required: false
        });
      }

      // Include t_penerimaan_gudang
      if (t_penerimaan_gudang) {
        includes.push({
          model: t_penerimaan_gudang,
          as: 'penerimaan_gudang',
          attributes: ['id', 'no_penerimaan_gudang', 'tgl_penerimaan_gudang'],
          required: false
        });
      }

      // Include m_items dengan nested
      if (m_items) {
        const itemInclude = {
          model: m_items,
          as: 'm_item',
          attributes: ['id', 'nama_item', 'min_stock', 'max_stock'],
          required: false,
          include: []
        };

        // Nested includes untuk m_item
        if (m_general) {
          itemInclude.include.push({
            model: m_general,
            as: 'uom',
            attributes: ['id', 'value1'],
            required: false
          });
        }

        if (m_group_jenis) {
          itemInclude.include.push({
            model: m_group_jenis,
            as: 'm_group_jeni',
            attributes: ['id', 'nama_jenis'],
            required: false
          });
        }

        if (m_group_merek) {
          itemInclude.include.push({
            model: m_group_merek,
            attributes: ['id', 'nama_merek'],
            required: false
          });
        }

        if (m_group_tipe) {
          itemInclude.include.push({
            model: m_group_tipe,
            attributes: ['id', 'nama_tipe'],
            required: false
          });
        }

        if (m_group_ukuran) {
          itemInclude.include.push({
            model: m_group_ukuran,
            attributes: ['id', 'nama_ukuran'],
            required: false
          });
        }

        if (m_group_batch) {
          itemInclude.include.push({
            model: m_group_batch,
            attributes: ['id', 'nama_batch'],
            required: false
          });
        }

        includes.push(itemInclude);
      }

      // Include stock_gudang (untuk dapat m_gudang) - WITH nested filter support
      if (stock_gudang && m_gudang) {
        const stockGudangInclude = {
          model: stock_gudang,
          attributes: ['id', 'm_gudang_id'],
          required: nestedFilters.stock_gudang ? true : false,
          include: [
            {
              model: m_gudang,
              attributes: ['id', 'kode_gudang', 'nama_gudang', 'alamat_gudang'],
              required: false
            }
          ]
        };
        
        // Apply nested filter: stock_gudang.m_gudang_id
        if (nestedFilters.stock_gudang?.m_gudang_id) {
          stockGudangInclude.where = {
            m_gudang_id: nestedFilters.stock_gudang.m_gudang_id
          };
        }
        
        includes.push(stockGudangInclude);
      }

      console.log('📌 History Masuk - Total includes:', includes.length);

      // Query options
      let queryOptions = {
        where,
        include: includes,
        order,
        distinct: true
      };

      // Execute query
      let result;
      if (no_pagination === 'true') {
        const data = await stock_gudang_d.findAll(queryOptions);

        result = {
          data,
          pagination: null
        };
      } else {
        const currentPage = parseInt(page);
        const limit = parseInt(paginate);
        const offset = (currentPage - 1) * limit;

        queryOptions.limit = limit;
        queryOptions.offset = offset;

        const { count, rows } = await stock_gudang_d.findAndCountAll(queryOptions);
        const totalPages = Math.ceil(count / limit);

        result = {
          data: rows,
          pagination: {
            total: count,
            page: currentPage,
            totalPages,
            limit,
            currentRowsCount: rows.length,
            next_page: currentPage < totalPages ? currentPage + 1 : null,
            prev_page: currentPage > 1 ? currentPage - 1 : null
          }
        };
      }

      console.log('✅ History Masuk found:', result.data.length);

      // Transform data menjadi flat structure yang mudah dibaca
      // Support both Penerimaan Barang and Penerimaan Gudang
      const transformedData = result.data.map(item => {
        // Determine source: Penerimaan Barang or Penerimaan Gudang
        const isPenerimaanBarang = !!item.t_penerimaan_barang;
        const isPenerimaanGudang = !!item.penerimaan_gudang;
        
        let noTransaksi = null;
        let tglTransaksi = null;
        let tipeTransaksi = null;
        
        if (isPenerimaanBarang) {
          noTransaksi = item.t_penerimaan_barang.no_penerimaan;
          tglTransaksi = item.t_penerimaan_barang.tgl_penerimaan;
          tipeTransaksi = 'PENERIMAAN BARANG';
        } else if (isPenerimaanGudang) {
          noTransaksi = item.penerimaan_gudang.no_penerimaan_gudang;
          tglTransaksi = item.penerimaan_gudang.tgl_penerimaan_gudang;
          tipeTransaksi = 'PENERIMAAN GUDANG';
        }
        
        return {
          id: item.id,
          tanggal: tglTransaksi,
          no_penerimaan: noTransaksi,
          tipe_transaksi: tipeTransaksi,
          nama_item: item.m_item?.nama_item || null,
          jenis: item.m_item?.m_group_jeni?.nama_jenis || null,
          merek: item.m_item?.m_group_merek?.nama_merek || null,
          tipe: item.m_item?.m_group_tipe?.nama_tipe || null,
          ukuran: item.m_item?.m_group_ukuran?.nama_ukuran || null,
          batch: item.m_item?.m_group_batch?.nama_batch || null,
          uom: item.m_item?.uom?.value1 || null,
          stock_masuk: item.stock_masuk,
          nama_gudang: item.stock_gudang?.m_gudang?.nama_gudang || null,
          kode_gudang: item.stock_gudang?.m_gudang?.kode_gudang || null,
          alamat_gudang: item.stock_gudang?.m_gudang?.alamat_gudang || null,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        };
      });

      return res.json({
        status: 'success',
        data: transformedData,
        pagination: result.pagination
      });

    } catch (err) {
      console.error('❌ GET HISTORY MASUK ERROR:', err);
      return res.status(500).json({
        status: 'error',
        message: err.message,
        details: err.stack
      });
    }
  },

  // =====================================================================
  // GET HISTORY KELUAR (Stock Keluar dari Purchase Return)
  // Query: stock_gudang_d WHERE t_purchase_return_id IS NOT NULL
  // Include: m_item (nested), dat_retur, stock_gudang (m_gudang)
  // Support: pagination, search, filter, ordering
  // =====================================================================
  async stock_keluar(req, res) {
    try {
      console.log('🔥 START GET HISTORY KELUAR');

      const {
        page = 1,
        paginate = 10,
        no_pagination,
        search,
        searchfield,
        order_by,
        order_type = 'DESC'
      } = req.query;

      const {
        stock_gudang_d,
        stock_gudang,
        m_gudang,
        m_items,
        m_general,
        m_group_jenis,
        m_group_merek,
        m_group_tipe,
        m_group_ukuran,
        m_group_batch,
        t_purchase_return,
        t_sj_gudang
      } = req.models;

      const { Op } = stock_gudang_d.sequelize.Sequelize;

      // WHERE: stock keluar dari Purchase Return ATAU Surat Jalan Gudang
      const where = {
        [Op.or]: [
          { t_purchase_return_id: { [Op.not]: null } },
          { t_sj_gudang_id: { [Op.not]: null } }
        ]
      };

      // Apply column filters - Track nested filters for includes
      const nestedFilters = {};
      
      Object.keys(req.query).forEach(key => {
        if (key.startsWith('filter_column_')) {
          const column = key.replace('filter_column_', '');
          if (!column.includes('.')) {
            // Tambahkan ke kondisi AND agar tidak overwrite Op.or
            if (!where[Op.and]) where[Op.and] = [];
            where[Op.and].push({ [column]: req.query[key] });
          } else {
            // Handle nested filter seperti stock_gudang.m_gudang_id
            const parts = column.split('.');
            if (parts.length === 2) {
              const [relation, field] = parts;
              nestedFilters[relation] = nestedFilters[relation] || {};
              nestedFilters[relation][field] = req.query[key];
            }
          }
        }
      });

      // Apply search - JANGAN TIMPA where[Op.or]!
      if (search && searchfield) {
        const searchFields = searchfield.split(',');
        const searchConditions = [];

        searchFields.forEach(field => {
          const trimmedField = field.trim();

          // Direct field
          if (!trimmedField.includes('.')) {
            searchConditions.push({
              [trimmedField]: { [Op.iLike]: `%${search}%` }
            });
          }
          // Nested search
          else if (trimmedField.includes('m_item.')) {
            const fieldName = trimmedField.split('.').pop();
            searchConditions.push({
              [`$m_item.${fieldName}$`]: { [Op.iLike]: `%${search}%` }
            });
          }
          else if (trimmedField.includes('dat_retur.')) {
            const fieldName = trimmedField.split('.').pop();
            searchConditions.push({
              [`$dat_retur.${fieldName}$`]: { [Op.iLike]: `%${search}%` }
            });
          }
          else if (trimmedField.includes('dat_sj_gudang.')) {
            const fieldName = trimmedField.split('.').pop();
            searchConditions.push({
              [`$dat_sj_gudang.${fieldName}$`]: { [Op.iLike]: `%${search}%` }
            });
          }
          else if (trimmedField.includes('stock_gudang.m_gudang.')) {
            const fieldName = trimmedField.split('.').pop();
            searchConditions.push({
              [`$stock_gudang.m_gudang.${fieldName}$`]: { [Op.iLike]: `%${search}%` }
            });
          }
        });

        if (searchConditions.length > 0) {
          // Gabungkan dengan AND: (kondisi_utama) AND (search_conditions)
          const mainCondition = where[Op.or];
          delete where[Op.or];
          
          where[Op.and] = [
            { [Op.or]: mainCondition },
            { [Op.or]: searchConditions }
          ];
        }
      }

      // Build ORDER
      let order = [];
      if (order_by) {
        order.push([order_by, order_type.toUpperCase()]);
      } else {
        order.push(['createdAt', 'DESC']);
      }

      // Build includes
      const includes = [];

      // Include t_purchase_return (as dat_retur)
      if (t_purchase_return) {
        includes.push({
          model: t_purchase_return,
          as: 'dat_retur',
          attributes: ['id', 'no_return', 'createdAt'],
          required: false
        });
      }

      // Include t_sj_gudang (as dat_sj_gudang)
      if (t_sj_gudang) {
        includes.push({
          model: t_sj_gudang,
          as: 'dat_sj_gudang',
          attributes: ['id', 'no_sj_gudang', 'tgl_sj_gudang'],
          required: false
        });
      }

      // Include m_items dengan nested
      if (m_items) {
        const itemInclude = {
          model: m_items,
          as: 'm_item',
          attributes: ['id', 'nama_item', 'min_stock', 'max_stock'],
          required: false,
          include: []
        };

        // Nested includes untuk m_item
        if (m_general) {
          itemInclude.include.push({
            model: m_general,
            as: 'uom',
            attributes: ['id', 'value1'],
            required: false
          });
        }

        if (m_group_jenis) {
          itemInclude.include.push({
            model: m_group_jenis,
            as: 'm_group_jeni',
            attributes: ['id', 'nama_jenis'],
            required: false
          });
        }

        if (m_group_merek) {
          itemInclude.include.push({
            model: m_group_merek,
            attributes: ['id', 'nama_merek'],
            required: false
          });
        }

        if (m_group_tipe) {
          itemInclude.include.push({
            model: m_group_tipe,
            attributes: ['id', 'nama_tipe'],
            required: false
          });
        }

        if (m_group_ukuran) {
          itemInclude.include.push({
            model: m_group_ukuran,
            attributes: ['id', 'nama_ukuran'],
            required: false
          });
        }

        if (m_group_batch) {
          itemInclude.include.push({
            model: m_group_batch,
            attributes: ['id', 'nama_batch'],
            required: false
          });
        }

        includes.push(itemInclude);
      }

      // Include stock_gudang (untuk dapat m_gudang) - WITH nested filter support
      if (stock_gudang && m_gudang) {
        const stockGudangInclude = {
          model: stock_gudang,
          attributes: ['id', 'm_gudang_id'],
          required: nestedFilters.stock_gudang ? true : false,
          include: [
            {
              model: m_gudang,
              attributes: ['id', 'kode_gudang', 'nama_gudang', 'alamat_gudang'],
              required: false
            }
          ]
        };
        
        // Apply nested filter: stock_gudang.m_gudang_id
        if (nestedFilters.stock_gudang?.m_gudang_id) {
          stockGudangInclude.where = {
            m_gudang_id: nestedFilters.stock_gudang.m_gudang_id
          };
        }
        
        includes.push(stockGudangInclude);
      }

      console.log('📌 History Keluar - Total includes:', includes.length);

      // Query options
      let queryOptions = {
        where,
        include: includes,
        order,
        distinct: true
      };

      // Execute query
      let result;
      if (no_pagination === 'true') {
        const data = await stock_gudang_d.findAll(queryOptions);

        result = {
          data,
          pagination: null
        };
      } else {
        const currentPage = parseInt(page);
        const limit = parseInt(paginate);
        const offset = (currentPage - 1) * limit;

        queryOptions.limit = limit;
        queryOptions.offset = offset;

        const { count, rows } = await stock_gudang_d.findAndCountAll(queryOptions);
        const totalPages = Math.ceil(count / limit);

        result = {
          data: rows,
          pagination: {
            total: count,
            page: currentPage,
            totalPages,
            limit,
            currentRowsCount: rows.length,
            next_page: currentPage < totalPages ? currentPage + 1 : null,
            prev_page: currentPage > 1 ? currentPage - 1 : null
          }
        };
      }

      console.log('✅ History Keluar found:', result.data.length);

      // Transform data menjadi flat structure yang mudah dibaca
      const transformedData = result.data.map(item => ({
        id: item.id,
        tanggal: item.dat_retur?.createdAt || item.dat_sj_gudang?.tgl_sj_gudang || null,
        no_transaksi: item.dat_retur?.no_return || item.dat_sj_gudang?.no_sj_gudang || null,
        tipe_transaksi: item.dat_retur ? 'PURCHASE RETURN' : item.dat_sj_gudang ? 'SURAT JALAN GUDANG' : null,
        nama_item: item.m_item?.nama_item || null,
        jenis: item.m_item?.m_group_jeni?.nama_jenis || null,
        merek: item.m_item?.m_group_merek?.nama_merek || null,
        tipe: item.m_item?.m_group_tipe?.nama_tipe || null,
        ukuran: item.m_item?.m_group_ukuran?.nama_ukuran || null,
        batch: item.m_item?.m_group_batch?.nama_batch || null,
        uom: item.m_item?.uom?.value1 || null,
        stock_keluar: item.stock_keluar,
        nama_gudang: item.stock_gudang?.m_gudang?.nama_gudang || null,
        kode_gudang: item.stock_gudang?.m_gudang?.kode_gudang || null,
        alamat_gudang: item.stock_gudang?.m_gudang?.alamat_gudang || null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }));

      return res.json({
        status: 'success',
        data: transformedData,
        pagination: result.pagination
      });

    } catch (err) {
      console.error('❌ GET HISTORY KELUAR ERROR:', err);
      return res.status(500).json({
        status: 'error',
        message: err.message,
        details: err.stack
      });
    }
  },


  async stock_item(req, res) {
    try {
      const {
        stock_gudang,
        m_gudang,
        m_items,
        m_general,
        m_group_jenis,
        m_group_merek,
        m_group_tipe,
        m_group_ukuran,
        m_group_batch,
        user_default
      } = req.models;

      const { Op } = stock_gudang.sequelize.Sequelize;
     
      const {
        gudang_id,
        page = 1,
        paginate = 10,
        no_pagination = "false",

        search = null,
        searchfield = null,

        order_by = "createdAt",
        order_type = "DESC",

        ...restQuery
      } = req.query;

      // Validasi gudang_id wajib
      if (!gudang_id) {
        return res.status(400).json({
          status: "error",
          message: "Parameter gudang_id wajib diisi"
        });
      }

      const pageNum = Number(page);
      const limitNum = Number(paginate);
      const offset = (pageNum - 1) * limitNum;

     
      const where = {
        m_gudang_id: gudang_id
      };

     
      Object.keys(restQuery).forEach(key => {
        if (key.startsWith("filter_column_")) {
          const column = key.replace("filter_column_", "");
          where[column] = restQuery[key];
        }
      });

    
      if (search && searchfield) {
        const fields = searchfield.split(",");

        where[Op.or] = fields.map(field => ({
          [field]: {
            [Op.iLike]: `%${search}%`
          }
        }));
      }

      
      const include = [
        {
          model: m_gudang,
          as: "m_gudang",
          required: false
        },
        {
          model: m_items,
          as: "m_item",
          required: false,
          include: [
            {
              model: m_general,
              as: 'uom',
              attributes: ['id', 'value1'],
              required: false
            },
            {
              model: m_group_jenis,
              as: 'm_group_jeni',
              attributes: ['id', 'nama_jenis'],
              required: false
            },
            {
              model: m_group_merek,
              attributes: ['id', 'nama_merek'],
              required: false
            },
            {
              model: m_group_tipe,
              attributes: ['id', 'nama_tipe'],
              required: false
            },
            {
              model: m_group_ukuran,
              attributes: ['id', 'nama_ukuran'],
              required: false
            },
            {
              model: m_group_batch,
              attributes: ['id', 'nama_batch'],
              required: false
            },
            {
              model: user_default,
              as: 'as_creator',
              attributes: ['id', 'username', 'name'],
              required: false
            },
            {
              model: user_default,
              as: 'as_updator',
              attributes: ['id', 'username', 'name'],
              required: false
            }
          ]
        },
      ];

      
      const findOptions = {
        where,
        include,
        order: [[order_by, order_type.toUpperCase()]],
        distinct: true
      };

      
      if (no_pagination !== "true") {
        findOptions.limit = limitNum;
        findOptions.offset = offset;
      }

      
      const { rows, count } = await stock_gudang.findAndCountAll(findOptions);

      const totalPages = no_pagination === "true"
        ? 1
        : Math.ceil(count / limitNum);

      // Transform data to flat structure
      const transformedData = rows.map(item => ({
        id: item.id,
        m_gudang_id: item.m_gudang_id,
        nama_gudang: item.m_gudang?.nama_gudang || null,
        kode_gudang: item.m_gudang?.kode_gudang || null,
        free_stock: item.free_stock || 0,
        m_items_id: item.m_items_id,
        kode_item: item.m_item?.kode_item || null,
        nama_item: item.m_item?.nama_item || null,
        uom: item.m_item?.uom?.value1 || null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }));

      return res.json({
        status: "success",
        data: transformedData,
        filter: {
          search,
          searchfield,
          order_by,
          order_type,
          applied_filters: where
        },
        pagination: no_pagination === "true" ? null : {
          total: count,
          page: pageNum,
          totalPages,
          limit: limitNum,
          currentRowsCount: rows.length,
          next_page: pageNum < totalPages ? pageNum + 1 : null,
          prev_page: pageNum > 1 ? pageNum - 1 : null
        }
      });

    } catch (error) {
      console.error("[stock_item]", error);
      return res.status(500).json({
        status: "error",
        message: error.message
      });
    }
  }

};

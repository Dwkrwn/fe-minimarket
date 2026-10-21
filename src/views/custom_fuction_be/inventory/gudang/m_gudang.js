// Controller for m_gudang
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.m_gudang
//
// Tambahkan custom function di bawah ini

export const m_gudangController = {
  // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
  async uploadImage(req, res) {
    const fileFields = Object.keys(req.models.m_gudang.rawAttributes).filter(
      key => req.models.m_gudang.rawAttributes[key].type && req.models.m_gudang.rawAttributes[key].type.key === 'STRING'
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
      const inserted = await req.models.m_gudang.create(data);
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
      const inserted = await req.models.m_gudang.bulkCreate(records);
      res.json({ message: 'Excel imported', data: inserted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Contoh: Custom function
  async customFunction(req, res) {
    res.json({ message: 'Custom function untuk m_gudang', body: req.body, query: req.query });
  },

  // Get Free Stock per Gudang berdasarkan Item ID
  async getFreeStock(req, res) {
    try {
      const { m_item_id } = req.query;

      // Validasi m_item_id wajib ada
      if (!m_item_id) {
        return res.status(400).json({ 
          status: 'error',
          message: 'm_item_id parameter is required' 
        });
      }

      // Query gudang dengan include stock_gudang (filtered by m_item_id) dan m_unit_bisnis
      // NO PAGINATION - return ALL data
      const gudangList = await req.models.m_gudang.findAll({
        include: [
          {
            model: req.models.stock_gudang,
            as: 'stock_gudangs',
            where: { m_items_id: m_item_id },
            required: true, // INNER JOIN - hanya gudang yang punya stock untuk item ini
            attributes: ['id', 'm_items_id', 'free_stock']
          },
          {
            model: req.models.m_unit_bisnis,
            as: 'm_unit_bisni',
            attributes: ['id', 'nama_comp']
          }
        ],
        attributes: ['id', 'kode_gudang', 'nama_gudang', 'm_unit_bisnis_id'],
        order: [['nama_gudang', 'ASC']],
        limit: null, // No limit - get all records
        offset: null // No offset - start from beginning
      });

      // Transform data ke format custom
      const customData = gudangList.map(gudang => {
        const stockGudang = gudang.stock_gudangs?.[0] || {}; // Ambil first record (harusnya cuma 1 per item per gudang)
        
        return {
          id: gudang.id,
          kode_gudang: gudang.kode_gudang,
          company: gudang.m_unit_bisni?.nama_comp || '-',
          nama_gudang: gudang.nama_gudang,
          free_stock: stockGudang.free_stock || 0
        };
      });

      res.json({
        status: 'success',
        message: `Found ${customData.length} gudang(s) with stock for item ${m_item_id}`,
        data: customData
      });

    } catch (error) {
      console.error('Error in getFreeStock:', error);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Internal server error'
      });
    }
  }
};

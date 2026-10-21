// Controller for t_purchase_invoice_notifikasi
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_invoice_notifikasi
//
// Tambahkan custom function di bawah ini

export const t_purchase_invoice_notifikasiController = {
  // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
  async uploadImage(req, res) {
    const fileFields = Object.keys(req.models.t_purchase_invoice_notifikasi.rawAttributes).filter(
      key => req.models.t_purchase_invoice_notifikasi.rawAttributes[key].type && req.models.t_purchase_invoice_notifikasi.rawAttributes[key].type.key === 'STRING'
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
      const inserted = await req.models.t_purchase_invoice_notifikasi.create(data);
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
      const inserted = await req.models.t_purchase_invoice_notifikasi.bulkCreate(records);
      res.json({ message: 'Excel imported', data: inserted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Contoh: Custom function
  async customFunction(req, res) {
    res.json({ message: 'Custom function untuk t_purchase_invoice_notifikasi', body: req.body, query: req.query });
  },

  // =====================================================================
  // GET USER APPROVAL PURCHASE INVOICE
  // =====================================================================
  // GET USER APPROVAL PURCHASE INVOICE - WITH FULL NESTED RELATIONS
  // =====================================================================
  // COMPLETE FUNCTION - Ready to use
  // COMPLETE FUNCTION - Ready to use (safe model references)
  // COMPLETE FUNCTION - Ensures nested relations by manual enrichment
  async getUserApprovalPurchaseInvoice(req, res) {
    try {
      console.log("🔥 START GET USER APPROVAL PI (ENRICH MANUALLY)");

      const userId = req.query.id || req.params.id;
      const tpiId = req.query.t_purchase_invoice_id || null;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      if (!userId) return res.status(400).json({ status: "error", message: "Missing user ID" });

      const M = req.models;
      const { m_approvalController } = await import('../controllers/m_approvalController.js');

      const getField = (obj, candidates = []) => candidates.map(c => obj[c]).find(v => v !== undefined && v !== null);

      // Enrichment helper: returns enriched PI object (PO, supplier, currency, details+items+groups)
      async function enrichPIObject(piRaw) {
        const pi = (piRaw && piRaw.toJSON) ? piRaw.toJSON() : { ...piRaw };
        // Supplier
        const supplierId = getField(pi, ['m_supplier_id', 'supplier_id', 'm_supplierId', 'm_supplier']);
        if (supplierId && M.m_supplier) {
          const s = await M.m_supplier.findByPk(supplierId);
          pi.m_supplier = s ? s.toJSON() : null;
        }
        // Currency / currency_d
        const mCurrencyId = getField(pi, ['m_currency_id', 'currency_id']);
        if (mCurrencyId && M.m_currency) {
          const c = await M.m_currency.findByPk(mCurrencyId);
          pi.m_currency = c ? c.toJSON() : null;
        }
        const mCurrencyDId = getField(pi, ['m_currency_d_id']);
        if (mCurrencyDId && M.m_currency_d) {
          const cd = await M.m_currency_d.findByPk(mCurrencyDId);
          if (cd) {
            pi.m_currency_d = cd.toJSON();
            if (cd.m_currency_id && M.m_currency) {
              const c2 = await M.m_currency.findByPk(cd.m_currency_id);
              pi.m_currency_d.m_currency = c2 ? c2.toJSON() : null;
            }
          }
        }
        // Unit business
        const unitId = getField(pi, ['m_unit_bisnis_id', 'unit_bussiness_id', 'unit_bussiness_id']);
        if (unitId && M.m_unit_bisnis) {
          const u = await M.m_unit_bisnis.findByPk(unitId);
          pi.m_unit_bisnis = u ? u.toJSON() : null;
        }
        // Purchase Order
        const poId = getField(pi, ['t_purchase_order_id', 'purchase_order_id']);
        if (poId && M.t_purchase_order) {
          const po = await M.t_purchase_order.findByPk(poId);
          if (po) {
            const poObj = po.toJSON();
            // PO supplier
            const poSuppId = getField(poObj, ['m_supplier_id', 'supplier_id']);
            if (poSuppId && M.m_supplier) {
              const ps = await M.m_supplier.findByPk(poSuppId);
              poObj.m_supplier = ps ? ps.toJSON() : null;
            }
            // PO currency
            const poCurId = getField(poObj, ['m_currency_id', 'currency_id']);
            if (poCurId && M.m_currency) {
              const pc = await M.m_currency.findByPk(poCurId);
              poObj.m_currency = pc ? pc.toJSON() : null;
            }
            pi.t_purchase_order = poObj;
          }
        }
        // Invoice Details + items + item groups
        if (M.t_purchase_invoice_d) {
          const details = await M.t_purchase_invoice_d.findAll({ where: { t_purchase_invoice_id: pi.id } });
          pi.t_purchase_invoice_d = await Promise.all(details.map(async d => {
            const di = d.toJSON();
            const itemId = getField(di, ['m_items_id', 'item_id']);
            if (itemId && M.m_items) {
              const it = await M.m_items.findByPk(itemId);
              if (it) {
                const itObj = it.toJSON();
                // Attach groups if present
                const groupPairs = [
                  ['m_group_batch_id', 'm_group_batch'],
                  ['m_group_jenis_id', 'm_group_jenis'],
                  ['m_group_merek_id', 'm_group_merek'],
                  ['m_group_tipe_id', 'm_group_tipe'],
                  ['m_group_ukuran_id', 'm_group_ukuran'],
                  ['satuan_id', 'm_general']
                ];
                for (const [fk, modelName] of groupPairs) {
                  const gid = itObj[fk];
                  if (gid && M[modelName]) {
                    const g = await M[modelName].findByPk(gid);
                    itObj[modelName] = g ? g.toJSON() : null;
                  }
                }
                di.m_items = itObj;
              }
            }
            // If detail links to penerimaan or po d, try to attach minimal info
            if (di.t_penerimaan_barang_d_id && M.t_penerimaan_barang_d) {
              const pr = await M.t_penerimaan_barang_d.findByPk(di.t_penerimaan_barang_d_id);
              di.t_penerimaan_barang_d = pr ? pr.toJSON() : null;
            }
            if (di.t_purchase_order_d_id && M.t_purchase_order_d) {
              const pod = await M.t_purchase_order_d.findByPk(di.t_purchase_order_d_id);
              di.t_purchase_order_d = pod ? pod.toJSON() : null;
            }
            return di;
          }));
        }
        return pi;
      }

      // Build base filter for notifications
      const baseNotifWhere = { status: false };
      if (tpiId) baseNotifWhere.t_purchase_invoice_id = tpiId;

      // If a specific PI id is requested, shortcut and enrich results
      if (tpiId) {
        const notifList = await M.t_purchase_invoice_notifikasi.findAll({
          where: baseNotifWhere,
          order: [["createdAt", "DESC"]],
          include: [M.user_default ? { model: M.user_default, required: false } : null].filter(Boolean)
        });

        const filtered = notifList.filter(n => {
          const d = n.toJSON();
          // NOTE: sender_id TIDAK di-filter, karena user bisa approve ajuan sendiri
          if (d.status_name === "WAITING REVISE") return false;
          if (d.user_approved_id) return false;
          return true;
        });

        // Collect invoice ids and fetch/enrich manually (batch)
        const invoiceIds = [...new Set(filtered.map(f => f.t_purchase_invoice_id).filter(Boolean))];
        const piFetch = invoiceIds.length && M.t_purchase_invoice ? await M.t_purchase_invoice.findAll({ where: { id: invoiceIds } }) : [];
        const enrichedMap = {};
        for (const p of piFetch) {
          enrichedMap[p.id] = await enrichPIObject(p);
        }

        // Attach enriched PI & sender/approval info
        for (const n of filtered) {
          const obj = n.toJSON();
          obj.t_purchase_invoice = obj.t_purchase_invoice_id ? (enrichedMap[obj.t_purchase_invoice_id] || null) : null;
          if (obj.sender_id && M.user_default) {
            const s = await M.user_default.findByPk(obj.sender_id);
            obj.tpi_sender = s ? s.toJSON() : null;
          }
          if (obj.user_approved_id && M.user_default) {
            const a = await M.user_default.findByPk(obj.user_approved_id);
            obj.tpi_approval = a ? a.toJSON() : null;
          }
          // replace the notification object in list with enriched object
          // (we'll use the plain obj for output)
          Object.assign(n, obj);
        }

        const total = filtered.length;
        const totalPages = Math.ceil(total / limit);
        const paginated = filtered.slice(offset, offset + limit).map(n => (n.toJSON ? n.toJSON() : n));

        return res.json({
          status: "success",
          approval: paginated,
          pagination: { total, page, totalPages, limit, currentRowsCount: paginated.length, next_page: page < totalPages ? page + 1 : null, prev_page: page > 1 ? page - 1 : null }
        });
      }

      // Original approval-menu flow (same as before), but enrich PIs manually
      let approvalRaw = null;
      const fakeReq = { query: { id: userId }, models: req.models };
      const fakeRes = { status: (c) => fakeRes, json: (d) => (approvalRaw = d) };
      await m_approvalController.getUserApprovalData(fakeReq, fakeRes);

      if (!approvalRaw || !approvalRaw.menu) return res.json({ status: "success", approval: [], pagination: null });

      const menus = approvalRaw.menu.filter(m => m.menu_path && m.menu_path.toLowerCase().includes("t_purchase_invoice"));
      if (menus.length === 0) return res.json({ status: "success", approval: [], pagination: null });

      let results = [];
      const seen = new Set();

      for (const menu of menus) {
        const userLevel = Number(menu.level);
        if (isNaN(userLevel)) continue;
        const targetLevel = userLevel - 1;
        if (targetLevel < 0) continue;

        const notifList = await M.t_purchase_invoice_notifikasi.findAll({
          where: { approval_level: targetLevel, status: false },
          order: [["createdAt", "DESC"]]
        });

        const filtered = notifList.filter(n => {
          const d = n.toJSON();
          // NOTE: sender_id TIDAK di-filter, karena user bisa approve ajuan sendiri
          if (d.status_name === "WAITING REVISE") return false;
          if (d.user_approved_id) return false;
          return true;
        });

        // Batch invoice enrichment
        const ids = [...new Set(filtered.map(f => f.t_purchase_invoice_id).filter(Boolean))];
        const rawPis = ids.length && M.t_purchase_invoice ? await M.t_purchase_invoice.findAll({ where: { id: ids } }) : [];
        const enrichedMap = {};
        for (const p of rawPis) enrichedMap[p.id] = await enrichPIObject(p);

        for (const n of filtered) {
          if (!seen.has(n.id)) {
            seen.add(n.id);
            const obj = n.toJSON();
            obj.menu_info = menu;
            obj.t_purchase_invoice = obj.t_purchase_invoice_id ? enrichedMap[obj.t_purchase_invoice_id] || null : null;
            if (obj.sender_id && M.user_default) {
              const s = await M.user_default.findByPk(obj.sender_id);
              obj.tpi_sender = s ? s.toJSON() : null;
            }
            if (obj.user_approved_id && M.user_default) {
              const a = await M.user_default.findByPk(obj.user_approved_id);
              obj.tpi_approval = a ? a.toJSON() : null;
            }
            results.push(obj);
          }
        }
      }

      const total = results.length;
      const totalPages = Math.ceil(total / limit);
      const paginated = results.slice(offset, offset + limit);

      return res.json({
        status: "success",
        approval: paginated,
        pagination: { total, page, totalPages, limit, currentRowsCount: paginated.length, next_page: page < totalPages ? page + 1 : null, prev_page: page > 1 ? page - 1 : null }
      });

    } catch (err) {
      console.error("❌ Fatal Error GET USER APPROVAL PI (ENRICH):", err);
      return res.status(500).json({ status: "error", message: err.message });
    }
  }
};

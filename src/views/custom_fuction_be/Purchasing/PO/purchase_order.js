// Controller for t_purchase_order
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_order
//
// Tambahkan custom function di bawah ini
import m_currency_d from "../models/m_currency_d.js";

export const t_purchase_orderController = {
    // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
    async uploadImage(req, res) {
        const fileFields = Object.keys(req.models.t_purchase_order.rawAttributes).filter(
            key => req.models.t_purchase_order.rawAttributes[key].type && req.models.t_purchase_order.rawAttributes[key].type.key === 'STRING'
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
            const inserted = await req.models.t_purchase_order.create(data);
            res.json({
                message: 'Image uploaded',
                data: inserted
            });
        } catch (err) {
            res.status(500).json({
                error: err.message
            });
        }
    },

    // Contoh: Import Excel ke database
    async importExcel(req, res) {
        if (!req.excelData) return res.status(400).json({
            error: 'No Excel data'
        });
        const [header, ...rows] = req.excelData;
        const records = rows.map(row => Object.fromEntries(header.map((h, i) => [h, row[i]])));
        try {
            const inserted = await req.models.t_purchase_order.bulkCreate(records);
            res.json({
                message: 'Excel imported',
                data: inserted
            });
        } catch (err) {
            res.status(500).json({
                error: err.message
            });
        }
    },

    // Contoh: Custom function
    async customFunction(req, res) {
        res.json({
            message: 'Custom function untuk t_purchase_order',
            body: req.body,
            query: req.query
        });
    },

    // =====================================================================
    // GET REQUEST DATA (untuk ButtonMultiSelect PO)
    // Filter: PR status = APPROVED dan status_transaksi != CLOSED
    // =====================================================================
    async getRequestData(req, res) {
        try {
            const {
                page = 1,
                paginate = 10,
                no_pagination,
                search,
                searchfield,
                selectfield,
                order_by,
                order_type = 'ASC'
            } = req.query;

            const {
                t_purchase_request_d,
                t_purchase_request,
                m_items,
                m_general,
                user_default
            } = req.models;

            const { Op } = t_purchase_request_d.sequelize.Sequelize;

            // Build WHERE clause untuk t_purchase_request_d
            const where = {};

            // Apply column filters
            Object.keys(req.query).forEach(key => {
                if (key.startsWith('filter_column_')) {
                    const column = key.replace('filter_column_', '');
                    where[column] = req.query[key];
                }
            });

            // Build WHERE untuk t_purchase_request (filter PR APPROVED dan NOT CLOSED/ORDERED)
            // ORDERED = sudah digunakan di PO yang APPROVED
            // CLOSED = sudah di-close oleh PR Close
            const prWhere = {
                status: 'APPROVED',
                [Op.or]: [
                    { status_transaksi: { [Op.notIn]: ['CLOSED', 'ORDERED'] } },
                    { status_transaksi: { [Op.is]: null } }
                ]
            };

            // Apply search across tables
            let searchConditions = [];
            if (search && searchfield) {
                const searchFields = searchfield.split(',');
                searchFields.forEach(field => {
                    const trimmedField = field.trim();
                    
                    // Search di t_purchase_request
                    if (trimmedField.includes('t_purchase_request.')) {
                        const prField = trimmedField.replace('t_purchase_request.', '');
                        searchConditions.push({
                            ['$t_purchase_request.' + prField + '$']: { [Op.iLike]: `%${search}%` }
                        });
                    }
                    // Search di m_items
                    else if (trimmedField.includes('m_items.') || trimmedField.includes('m_item.')) {
                        const itemField = trimmedField.replace('m_items.', '').replace('m_item.', '');
                        searchConditions.push({
                            ['$m_item.' + itemField + '$']: { [Op.iLike]: `%${search}%` }
                        });
                    }
                    // Search di t_purchase_request_d
                    else {
                        searchConditions.push({
                            [trimmedField]: { [Op.iLike]: `%${search}%` }
                        });
                    }
                });
                
                if (searchConditions.length > 0) {
                    where[Op.or] = searchConditions;
                }
            }

            // Build attributes (selectfield)
            let attributes = undefined;
            if (selectfield) {
                // Only select fields that belong to t_purchase_request_d
                const fields = selectfield.split(',')
                    .map(f => f.trim())
                    .filter(f => !f.includes('.'));
                if (fields.length > 0) {
                    attributes = fields;
                }
            }

            // Build order
            let order = [];
            if (order_by) {
                order.push([order_by, order_type.toUpperCase()]);
            } else {
                order.push(['createdAt', 'DESC']);
            }

            // Build include
            const include = [
                {
                    model: m_items,
                    as: 'm_item',
                    include: [
                        {
                            model: m_general,
                            as: 'uom',
                            attributes: ['id', 'group', 'key1', 'code', 'value1', 'value2', 'value3', 'value4', 'value5', 'is_active']
                        }
                    ]
                },
                {
                    model: t_purchase_request,
                    as: 't_purchase_request',
                    where: prWhere,
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
                            model: m_general,
                            as: 'm_general',
                            attributes: ['id', 'group', 'key1', 'code', 'value1', 'value2', 'value3', 'value4', 'value5', 'is_active']
                        }
                    ]
                }
            ];

            // Query options
            let queryOptions = {
                where,
                include,
                order,
                distinct: true
            };

            if (attributes) {
                queryOptions.attributes = attributes;
            }

            // Pagination
            let result;
            if (no_pagination === 'true') {
                const data = await t_purchase_request_d.findAll(queryOptions);
                result = {
                    data: data.map(d => d.toJSON()),
                    pagination: {
                        total: data.length,
                        page: 1,
                        totalPages: 1,
                        limit: data.length,
                        currentRowsCount: data.length,
                        next_page: null,
                        prev_page: null
                    }
                };
            } else {
                const limit = parseInt(paginate);
                const offset = (parseInt(page) - 1) * limit;
                
                const { count, rows } = await t_purchase_request_d.findAndCountAll({
                    ...queryOptions,
                    limit,
                    offset
                });

                const totalPages = Math.ceil(count / limit);
                
                result = {
                    data: rows.map(r => r.toJSON()),
                    pagination: {
                        total: count,
                        page: parseInt(page),
                        totalPages,
                        limit,
                        currentRowsCount: rows.length,
                        next_page: parseInt(page) < totalPages ? parseInt(page) + 1 : null,
                        prev_page: parseInt(page) > 1 ? parseInt(page) - 1 : null
                    }
                };
            }

            return res.json({
                status: "success",
                ...result
            });

        } catch (err) {
            console.error("getRequestData ERROR:", err);
            return res.status(500).json({
                status: "error",
                message: err.message
            });
        }
    },


    // MENDAPATKAN CUSTOM GET ALL DETAIL
    async getComplete(req, res) {
        try {
            const {
                id
            } = req.query;

            if (!id) {
                return res.status(400).json({
                    status: "error",
                    message: "Parameter id PO tidak ditemukan"
                });
            }

            const {
                t_purchase_order,
                t_purchase_order_d,
                t_purchase_request,
                t_purchase_request_d,
                m_items,
                m_general,
                m_supplier,
                m_currency,
                m_unit_bisnis,
                user_default,
                money,

                m_group_jenis,
                m_group_tipe,
                m_group_merek,
                m_group_ukuran,
                m_group_batch
            } = req.models;

            const data = await t_purchase_order.findOne({
                where: {
                    id
                },
                include: [{
                        model: m_supplier
                    },

                    {
                        model: m_general,
                        as: "top_po"
                    },
                    {
                        model: m_general,
                        as: "pph_po"
                    },
                    {
                        model: m_general,
                        as: "ppn_po"
                    },

                    {
                        model: m_currency,
                        as: "uang_po",
                        include: [
                            {
                                model: money,
                                attributes: ["id", "group", "key1", "code", "value1", "value2", "value3", "value4", "value5", "is_active"]
                            }
                        ]
                    }, // MAIN CURRENCY
                    {
                        model: m_currency_d,
                        as: "det_uang_po"
                    }, // DETAIL CURRENCY (BUY/SELL)

                    {
                        model: user_default,
                        as: "po_ctr"
                    },
                    {
                        model: user_default,
                        as: "po_updt"
                    },

                    {
                        model: m_unit_bisnis,
                        as: "m_unit_bisni"
                    },

                    {
                        model: t_purchase_order_d,
                        include: [
                            {
                                model: t_purchase_request_d,
                                include: [
                                    {
                                        model: t_purchase_request,
                                        as: "t_purchase_request",
                                        include: [{
                                            model: m_general,
                                            as: "m_general"
                                        }]
                                    },
                                    {
                                        model: m_items,
                                        as: "m_item",
                                        include: [{
                                            model: m_general,
                                            as: "uom"
                                        }]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            });

            if (!data) {
                return res.status(404).json({
                    status: "error",
                    message: "Purchase order tidak ditemukan"
                });
            }

            const raw = data.toJSON();

            // Flatten t_purchase_order_ds - hapus nested, langsung kumpulkan semua field yang dibutuhkan
            raw.t_purchase_order_ds = raw.t_purchase_order_ds?.map(pod => {
                const prd = pod.t_purchase_request_d;
                const pr = prd?.t_purchase_request;
                const item = prd?.m_item;

                // Hitung subtotal dan total
                const subtotal = parseFloat(pod.qty_po || 0) * parseFloat(pod.harga || 0);
                const totalDiskon = parseFloat(pod.amt_disc || 0);
                const total = subtotal - totalDiskon;

                // Gabungkan tipe_user dan req_user_by (contoh: "ADMIN PURCHASING - YUUUKI KANATA")
                const tipeUser = pr?.req_type_user || null;
                const reqUserBy = pr?.req || pr?.req_user_by || null;
                let dimintaOleh = null;
                if (tipeUser && reqUserBy) {
                    dimintaOleh = `${tipeUser} - ${reqUserBy}`;
                } else if (reqUserBy) {
                    dimintaOleh = reqUserBy;
                } else if (tipeUser) {
                    dimintaOleh = tipeUser;
                }

                // Flatten semua data yang dibutuhkan
                // NOTE: Field names dari t_purchase_request terpotong karena alias conflict di Sequelize
                return {
                    id: pod.id,
                    t_purchase_order_id: pod.t_purchase_order_id,
                    t_purchase_request_id: pod.t_purchase_request_id,
                    t_purchase_request_d_id: pod.t_purchase_request_d_id,
                    m_items_id: pod.m_items_id,
                    
                    // Data dari PR (field names terpotong: no_ = no_pr, req = req_user_by, pri = prioritas_id)
                    no_pr: pr?.['no_'] || pr?.no_pr || null,
                    diminta_oleh: dimintaOleh,
                    prioritas_id: pr?.pri || pr?.prioritas_id || null,
                    
                    // Data dari Item
                    kode_item: item?.kode_item || null,
                    nama_item: item?.nama_item || null,
                    uom: item?.uom?.value1 || null,
                    
                    // Data dari PR Detail
                    qty_pr: prd?.qty_pr || null,
                    alasan: prd?.alasan || null,
                    
                    // Data dari PO Detail
                    qty_po: pod.qty_po,
                    harga: pod.harga,
                    disc_1: pod.disc_1,
                    disc_2: pod.disc_2,
                    amt_disc: pod.amt_disc,
                    
                    // Calculated fields
                    subtotal: subtotal.toFixed(2),
                    total_diskon: totalDiskon.toFixed(2),
                    total: total.toFixed(2),
                    
                    catatan: pod.catatan,
                    created_by: pod.created_by,
                    updated_by: pod.updated_by,
                    createdAt: pod.createdAt,
                    updatedAt: pod.updatedAt
                };
            });

            // Get prioritas values dari m_general berdasarkan prioritas_id
            const prioritasIds = [...new Set(raw.t_purchase_order_ds?.map(d => d.prioritas_id).filter(Boolean))];
            if (prioritasIds.length > 0) {
                const prioritasData = await m_general.findAll({
                    where: { id: prioritasIds },
                    attributes: ['id', 'value1'],
                    raw: true
                });
                const prioritasMap = Object.fromEntries(prioritasData.map(p => [p.id, p.value1]));
                
                raw.t_purchase_order_ds = raw.t_purchase_order_ds?.map(pod => ({
                    ...pod,
                    prioritas: prioritasMap[pod.prioritas_id] || null
                }));
            }

            return res.json({
                status: "success",
                message: "Data purchase order lengkap",
                data: raw
            });

        } catch (err) {
            return res.status(500).json({
                status: "error",
                message: err.message
            });
        }
    },

    // =====================================================================
    // GET PO BY PB (Penerimaan Barang)
    // =====================================================================
    async getPObyPB(req, res) {
        try {
            const { 
                t_penerimaan_barangs_id,
                page = 1,
                paginate = 10,
                no_pagination,
                search,
                searchfield,
                selectfield,
                order_by,
                order_type = 'ASC'
            } = req.query;

            if (!t_penerimaan_barangs_id) {
                return res.status(400).json({
                    status: "error",
                    message: "Parameter t_penerimaan_barangs_id tidak ditemukan"
                });
            }

            const {
                t_penerimaan_barang_d,
                t_purchase_order,
                t_purchase_order_d,
                m_currency,
                m_currency_d,
                m_general,
                m_supplier,
                m_items,
                money
            } = req.models;

            const { Op } = t_purchase_order.sequelize.Sequelize;

            // Query detail PB untuk ambil PO IDs
            const pbDetails = await t_penerimaan_barang_d.findAll({
                where: { t_penerimaan_barangs_id },
                attributes: ['t_purchase_order_id'],
                raw: true
            });

            if (!pbDetails || pbDetails.length === 0) {
                return res.status(404).json({
                    status: "error",
                    message: "Data penerimaan barang tidak ditemukan"
                });
            }

            // Ambil unique PO IDs
            const poIds = [...new Set(pbDetails.map(d => d.t_purchase_order_id).filter(Boolean))];

            if (poIds.length === 0) {
                return res.json({
                    status: "success",
                    message: "Data purchase order berhasil diambil",
                    data: [],
                    pagination: {
                        total: 0,
                        page: parseInt(page),
                        totalPages: 0,
                        limit: parseInt(paginate)
                    }
                });
            }

            // Build WHERE clause
            const where = { id: { [Op.in]: poIds } };

            // Apply column filters
            Object.keys(req.query).forEach(key => {
                if (key.startsWith('filter_column_')) {
                    const column = key.replace('filter_column_', '');
                    where[column] = req.query[key];
                }
            });

            // Apply search
            if (search && searchfield) {
                const searchFields = searchfield.split(',');
                const searchConditions = searchFields.map(field => ({
                    [field.trim()]: { [Op.iLike]: `%${search}%` }
                }));
                where[Op.or] = searchConditions;
            }

            // Build attributes (selectfield)
            let attributes = undefined;
            if (selectfield) {
                attributes = selectfield.split(',').map(f => f.trim());
            }

            // Build order
            let order = [];
            if (order_by) {
                order.push([order_by, order_type.toUpperCase()]);
            } else {
                order.push(['createdAt', 'DESC']);
            }

            // Build include
            const include = [
                {
                    model: m_currency,
                    as: "uang_po",
                    include: [
                        {
                            model: money,
                            attributes: ["id", "group", "key1", "code", "value1", "value2", "value3", "value4", "value5", "is_active"]
                        }
                    ]
                },
                {
                    model: m_currency_d,
                    as: "det_uang_po"
                },
                {
                    model: m_general,
                    as: "top_po"
                },
                {
                    model: m_general,
                    as: "pph_po"
                },
                {
                    model: m_general,
                    as: "ppn_po"
                },
                {
                    model: m_supplier
                },
                {
                    model: t_purchase_order_d,
                    as: "t_purchase_order_ds",
                    required: false,
                    where: t_penerimaan_barangs_id ? {
                        id: {
                            [Op.in]: t_penerimaan_barang_d.sequelize.literal(
                                `(SELECT DISTINCT t_purchase_order_d_id FROM t_penerimaan_barang_d WHERE t_penerimaan_barangs_id = '${t_penerimaan_barangs_id}')`
                            )
                        }
                    } : undefined,
                    include: [
                        {
                            model: t_penerimaan_barang_d,
                            required: false,
                            where: t_penerimaan_barangs_id ? { t_penerimaan_barangs_id } : undefined,
                            include: [
                                {
                                    model: m_items,
                                    as: "m_item",
                                    required: false,
                                    include: [
                                        {
                                            model: m_general,
                                            as: "uom",
                                            attributes: ["id", "value1"],
                                            required: false
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ];

            // Query PO with filters and pagination
            let queryOptions = {
                where,
                include,
                order,
                distinct: true
            };

            if (attributes) {
                queryOptions.attributes = attributes;
            }

            // Get t_penerimaan_barang_d_id yang sudah ada di PI dengan status APPROVED
            const { t_purchase_invoice_d } = req.models;
            let invoicedDetailIds = new Set();
            
            if (t_purchase_invoice_d) {
                try {
                    // Use raw SQL query (same as GetAllDataPB)
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
                        console.log(`📋 Query t_purchase_invoice berhasil, found ${results.length} APPROVED PI details`);
                    } catch (err) {
                        // Try plural table name
                        if (err.message.includes('does not exist') || err.message.includes('tidak ada') || err.message.includes('relation') || err.message.includes('table')) {
                            console.log('⚠️ Table t_purchase_invoice not found, trying t_purchase_invoices...');
                            rawQuery = `
                                SELECT DISTINCT pid.t_penerimaan_barang_d_id 
                                FROM t_purchase_invoice_d pid
                                INNER JOIN t_purchase_invoices pi ON pi.id = pid.t_purchase_invoice_id
                                WHERE pi.status = 'APPROVED' 
                                AND pid.t_penerimaan_barang_d_id IS NOT NULL
                            `;
                            [results] = await t_purchase_invoice_d.sequelize.query(rawQuery);
                            console.log(`📋 Query t_purchase_invoices berhasil, found ${results.length} APPROVED PI details`);
                        } else {
                            throw err;
                        }
                    }
                    
                    invoicedDetailIds = new Set(
                        results
                            .map(d => d.t_penerimaan_barang_d_id)
                            .filter(id => id)
                    );
                    
                    console.log(`✅ Total ${invoicedDetailIds.size} PB detail IDs already in APPROVED PI:`, Array.from(invoicedDetailIds));
                } catch (err) {
                    console.log('❌ Error querying approved PI details:', err.message);
                }
            }

            // Pagination
            let result;
            if (no_pagination === 'true') {
                const data = await t_purchase_order.findAll(queryOptions);
                
                // Filter HANYA detail items yang sudah ada di PI APPROVED
                // PO tetap muncul dengan items yang tersisa
                let filteredData = data.map(po => {
                    const json = po.toJSON();
                    if (json.t_purchase_order_ds && invoicedDetailIds.size > 0) {
                        json.t_purchase_order_ds = json.t_purchase_order_ds.map(pod => {
                            // Filter t_penerimaan_barang_ds (array) di dalam setiap PO detail
                            if (pod.t_penerimaan_barang_ds && Array.isArray(pod.t_penerimaan_barang_ds)) {
                                const before = pod.t_penerimaan_barang_ds.length;
                                pod.t_penerimaan_barang_ds = pod.t_penerimaan_barang_ds.filter(
                                    pbd => !invoicedDetailIds.has(pbd.id)
                                );
                                const after = pod.t_penerimaan_barang_ds.length;
                                if (before > after) {
                                    console.log(`🚫 Filtered ${before - after} invoiced PB detail(s) from PO detail ${pod.id}`);
                                }
                            }
                            // Filter single t_penerimaan_barang_d jika sudah di-invoice
                            if (pod.t_penerimaan_barang_d && invoicedDetailIds.has(pod.t_penerimaan_barang_d.id)) {
                                console.log(`🚫 Filtered single PB detail ${pod.t_penerimaan_barang_d.id} from PO detail ${pod.id}`);
                                pod.t_penerimaan_barang_d = null;
                            }
                            return pod;
                        }).filter(pod => {
                            // Remove PO detail jika tidak ada PB detail yang tersisa
                            const hasPBDetails = (pod.t_penerimaan_barang_ds && pod.t_penerimaan_barang_ds.length > 0) ||
                                                 (pod.t_penerimaan_barang_d !== null);
                            if (!hasPBDetails) {
                                console.log(`🚫 Removing PO detail ${pod.id} - all PB details already invoiced`);
                            }
                            return hasPBDetails;
                        });
                    }
                    return json;
                }).filter(po => {
                    // CRITICAL: Remove PO jika SEMUA detail sudah di-filter (tidak ada items tersisa)
                    const hasRemainingItems = po.t_purchase_order_ds && po.t_purchase_order_ds.length > 0;
                    if (!hasRemainingItems) {
                        console.log(`🚫 Removing PO ${po.no_po} (${po.id}) - all items already in APPROVED PI`);
                    }
                    return hasRemainingItems;
                });
                
                result = {
                    data: filteredData,
                    pagination: {
                        total: filteredData.length,
                        page: 1,
                        totalPages: 1,
                        limit: filteredData.length,
                        currentRowsCount: filteredData.length,
                        next_page: null,
                        prev_page: null
                    }
                };
            } else {
                const limit = parseInt(paginate);
                const offset = (parseInt(page) - 1) * limit;
                
                const { count, rows } = await t_purchase_order.findAndCountAll({
                    ...queryOptions,
                    limit,
                    offset
                });

                // Filter HANYA detail items yang sudah ada di PI APPROVED
                // PO tetap muncul dengan items yang tersisa
                let filteredRows = rows.map(po => {
                    const json = po.toJSON();
                    if (json.t_purchase_order_ds && invoicedDetailIds.size > 0) {
                        json.t_purchase_order_ds = json.t_purchase_order_ds.map(pod => {
                            // Filter t_penerimaan_barang_ds (array)
                            if (pod.t_penerimaan_barang_ds && Array.isArray(pod.t_penerimaan_barang_ds)) {
                                const before = pod.t_penerimaan_barang_ds.length;
                                pod.t_penerimaan_barang_ds = pod.t_penerimaan_barang_ds.filter(
                                    pbd => !invoicedDetailIds.has(pbd.id)
                                );
                                const after = pod.t_penerimaan_barang_ds.length;
                                if (before > after) {
                                    console.log(`🚫 Filtered ${before - after} invoiced PB detail(s) from PO detail ${pod.id}`);
                                }
                            }
                            // Filter single t_penerimaan_barang_d
                            if (pod.t_penerimaan_barang_d && invoicedDetailIds.has(pod.t_penerimaan_barang_d.id)) {
                                console.log(`🚫 Filtered single PB detail ${pod.t_penerimaan_barang_d.id} from PO detail ${pod.id}`);
                                pod.t_penerimaan_barang_d = null;
                            }
                            return pod;
                        }).filter(pod => {
                            // Remove PO detail jika tidak ada PB detail yang tersisa
                            const hasPBDetails = (pod.t_penerimaan_barang_ds && pod.t_penerimaan_barang_ds.length > 0) ||
                                                 (pod.t_penerimaan_barang_d !== null);
                            if (!hasPBDetails) {
                                console.log(`🚫 Removing PO detail ${pod.id} - all PB details already invoiced`);
                            }
                            return hasPBDetails;
                        });
                    }
                    return json;
                }).filter(po => {
                    // CRITICAL: Remove PO jika SEMUA detail sudah di-filter (tidak ada items tersisa)
                    const hasRemainingItems = po.t_purchase_order_ds && po.t_purchase_order_ds.length > 0;
                    if (!hasRemainingItems) {
                        console.log(`🚫 Removing PO ${po.no_po} (${po.id}) - all items already in APPROVED PI`);
                    }
                    return hasRemainingItems;
                });

                const totalPages = Math.ceil(filteredRows.length / limit);
                
                result = {
                    data: filteredRows,
                    pagination: {
                        total: filteredRows.length,
                        page: parseInt(page),
                        totalPages,
                        limit,
                        currentRowsCount: filteredRows.length,
                        next_page: parseInt(page) < totalPages ? parseInt(page) + 1 : null,
                        prev_page: parseInt(page) > 1 ? parseInt(page) - 1 : null
                    }
                };
            }

            return res.json({
                status: "success",
                message: "Data purchase order berhasil diambil",
                ...result
            });

        } catch (err) {
            return res.status(500).json({
                status: "error",
                message: err.message
            });
        }
    },

    // =====================================================================
    // GET PO DETAIL (untuk detail items dengan include lengkap)
    // Query dari t_purchase_order (parent) dengan include detail-detail nya
    // =====================================================================
    async getPoDetail(req, res) {
        try {
            const {
                t_purchase_order_id,
                t_purchase_request_d_id,
                page = 1,
                paginate = 20,
                no_pagination,
                search,
                searchfield,
                order_by,
                order_type = 'ASC'
            } = req.query;

            const {
                t_purchase_order,
                t_purchase_order_d,
                t_purchase_request_d,
                t_purchase_request,
                m_items,
                m_general,
                m_supplier,
                m_currency,
                m_currency_d,
                money
            } = req.models;

            const { Op } = t_purchase_order.sequelize.Sequelize;

            // Build WHERE clause untuk t_purchase_order (parent)
            const where = {};

            // Filter by PO ID jika ada
            if (t_purchase_order_id) {
                where.id = t_purchase_order_id;
            }

            // Apply column filters untuk PO
            Object.keys(req.query).forEach(key => {
                if (key.startsWith('filter_column_')) {
                    const column = key.replace('filter_column_', '');
                    // Hanya filter yang belong to t_purchase_order
                    if (!column.includes('.')) {
                        // Special handling untuk filter_column_t_purchase_order_id -> map ke 'id'
                        if (column === 't_purchase_order_id') {
                            where.id = req.query[key];
                        } else {
                            where[column] = req.query[key];
                        }
                    }
                }
            });

            // Build WHERE untuk t_purchase_order_d (child/detail)
            const detailWhere = {};
            
            // Filter by PR Detail ID jika ada (di level detail)
            if (t_purchase_request_d_id) {
                detailWhere.t_purchase_request_d_id = t_purchase_request_d_id;
            }

            // Apply search di level detail
            let detailSearchConditions = [];
            if (search && searchfield) {
                const searchFields = searchfield.split(',');
                searchFields.forEach(field => {
                    const trimmedField = field.trim();
                    
                    // Search di m_items via t_purchase_request_d
                    if (trimmedField.includes('m_item')) {
                        const itemField = trimmedField.split('.').pop();
                        detailSearchConditions.push({
                            ['$t_purchase_order_ds.t_purchase_request_d.m_item.' + itemField + '$']: { [Op.iLike]: `%${search}%` }
                        });
                    }
                });
                
                if (detailSearchConditions.length > 0) {
                    where[Op.or] = detailSearchConditions;
                }
            }

            // Build order
            let order = [];
            if (order_by) {
                order.push([order_by, order_type.toUpperCase()]);
            } else {
                order.push(['createdAt', 'DESC']);
            }

            // Build include - Query dari t_purchase_order
            const include = [
                {
                    model: m_currency,
                    as: 'uang_po',
                    attributes: ['id', 'kode_currency', 'nama_currency'],
                    required: false,
                    include: [
                        {
                            model: money,
                            attributes: ['id', 'value1', 'value2', 'value5'],
                            required: false
                        }
                    ]
                },
                {
                    model: m_currency_d,
                    as: 'det_uang_po',
                    attributes: ['id', 'rate', 'tgl_mulai', 'is_active'],
                    required: false
                },
                {
                    model: t_purchase_order_d,
                    as: 't_purchase_order_ds',
                    where: Object.keys(detailWhere).length > 0 ? detailWhere : undefined,
                    required: false,
                    include: [
                        {
                            model: t_purchase_request_d,
                            required: false,
                            include: [
                                {
                                    model: m_items,
                                    as: 'm_item',
                                    required: false,
                                    include: [
                                        {
                                            model: m_general,
                                            as: 'uom',
                                            attributes: ['id', 'value1'],
                                            required: false
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ];

            // Query options
            let queryOptions = {
                where,
                include,
                order,
                distinct: true
            };

            // Pagination
            let result;
            if (no_pagination === 'true') {
                const data = await t_purchase_order.findAll(queryOptions);
                
                // Flatten t_purchase_order_ds structure
                const flattenedData = data.map(po => {
                    const poJson = po.toJSON();
                    if (poJson.t_purchase_order_ds && poJson.t_purchase_order_ds.length > 0) {
                        poJson.t_purchase_order_ds = poJson.t_purchase_order_ds.map(detail => {
                            const prd = detail.t_purchase_request_d || {};
                            const item = prd.m_item || {};
                            
                            return {
                                id: detail.id,
                                t_purchase_order_id: detail.t_purchase_order_id,
                                t_purchase_request_d_id: detail.t_purchase_request_d_id,
                                m_items_id: detail.m_items_id,
                                t_purchase_request_id: detail.t_purchase_request_id,
                                qty_po: detail.qty_po,
                                harga: detail.harga,
                                disc_1: detail.disc_1,
                                disc_2: detail.disc_2,
                                amt_disc: detail.amt_disc,
                                catatan: detail.catatan,
                                // Flattened fields from relations
                                kode_item: item.kode_item || null,
                                nama_item: item.nama_item || null,
                                qty_pr: prd.qty_pr || null,
                                satuan: item.uom?.value1 || null,
                                created_by: detail.created_by,
                                updated_by: detail.updated_by,
                                createdAt: detail.createdAt,
                                updatedAt: detail.updatedAt
                            };
                        });
                    }
                    return poJson;
                });
                
                result = {
                    data: flattenedData,
                    pagination: {
                        total: flattenedData.length,
                        page: 1,
                        totalPages: 1,
                        limit: flattenedData.length,
                        currentRowsCount: flattenedData.length,
                        next_page: null,
                        prev_page: null
                    }
                };
            } else {
                const limit = parseInt(paginate);
                const offset = (parseInt(page) - 1) * limit;
                
                const { count, rows } = await t_purchase_order.findAndCountAll({
                    ...queryOptions,
                    limit,
                    offset
                });

                const totalPages = Math.ceil(count / limit);
                
                // Flatten t_purchase_order_ds structure
                const flattenedRows = rows.map(po => {
                    const poJson = po.toJSON();
                    if (poJson.t_purchase_order_ds && poJson.t_purchase_order_ds.length > 0) {
                        poJson.t_purchase_order_ds = poJson.t_purchase_order_ds.map(detail => {
                            const prd = detail.t_purchase_request_d || {};
                            const item = prd.m_item || {};
                            
                            return {
                                id: detail.id,
                                t_purchase_order_id: detail.t_purchase_order_id,
                                t_purchase_request_d_id: detail.t_purchase_request_d_id,
                                m_items_id: detail.m_items_id,
                                t_purchase_request_id: detail.t_purchase_request_id,
                                qty_po: detail.qty_po,
                                harga: detail.harga,
                                disc_1: detail.disc_1,
                                disc_2: detail.disc_2,
                                amt_disc: detail.amt_disc,
                                catatan: detail.catatan,
                                // Flattened fields from relations
                                kode_item: item.kode_item || null,
                                nama_item: item.nama_item || null,
                                qty_pr: prd.qty_pr || null,
                                satuan: item.uom?.value1 || null,
                                created_by: detail.created_by,
                                updated_by: detail.updated_by,
                                createdAt: detail.createdAt,
                                updatedAt: detail.updatedAt
                            };
                        });
                    }
                    return poJson;
                });
                
                result = {
                    data: flattenedRows,
                    pagination: {
                        total: count,
                        page: parseInt(page),
                        totalPages,
                        limit,
                        currentRowsCount: flattenedRows.length,
                        next_page: parseInt(page) < totalPages ? parseInt(page) + 1 : null,
                        prev_page: parseInt(page) > 1 ? parseInt(page) - 1 : null
                    }
                };
            }

            return res.json({
                status: "success",
                ...result
            });

        } catch (err) {
            console.error("getPoDetail ERROR:", err);
            return res.status(500).json({
                status: "error",
                message: err.message
            });
        }
    },

    // =====================================================================
    // APPROVE (DINAMIS LEVEL + is_full)
    // =====================================================================
    async approve(req, res) {
        try {
            const {
                purchase_order_id,
                purchase_order_notifikasi_id,
                approval_level,
                approval_catatan,
                user_approved_id,
                sender_id,
                m_approval_id
            } = req.body;

            // ------------------ VALIDASI DASAR ------------------
            if (
                !purchase_order_id ||
                !purchase_order_notifikasi_id ||
                approval_level === undefined ||
                !user_approved_id ||
                !m_approval_id
            ) {
                return res.status(400).json({
                    status: "error",
                    message: "purchase_order_id, purchase_order_notifikasi_id, approval_level, user_approved_id, dan m_approval_id wajib diisi"
                });
            }

            const {
                t_purchase_order,
                t_purchase_order_notifikasi,
                m_approval_d
            } = req.models;

            // ------------------ AMBIL RULE APPROVAL ------------------
            const approvalDetails = await m_approval_d.findAll({
                where: {
                    m_approval_id: m_approval_id,
                    is_active: true
                },
                order: [["level", "ASC"]]
            });

            if (!approvalDetails || approvalDetails.length === 0) {
                return res.status(400).json({
                    status: "error",
                    message: "Approval rule tidak ditemukan untuk m_approval_id tersebut"
                });
            }

            // cari rule level saat ini
            const currentLevel = Number(approval_level);
            const currentRuleIndex = approvalDetails.findIndex(
                (r) => Number(r.level) === currentLevel
            );

            if (currentRuleIndex === -1) {
                return res.status(400).json({
                    status: "error",
                    message: `Approval rule untuk level ${currentLevel} tidak ditemukan`
                });
            }

            const currentRule = approvalDetails[currentRuleIndex];
            const isFull = !!currentRule.is_full;

            // cari next rule (kalau ada)
            const nextRule = approvalDetails[currentRuleIndex + 1] || null;
            const isLastLevel = isFull || !nextRule;

            // ------------------ GET OLD NOTIFICATION ------------------
            const oldNotif = await t_purchase_order_notifikasi.findOne({
                where: {
                    id: purchase_order_notifikasi_id
                }
            });

            if (!oldNotif) {
                return res.status(404).json({
                    status: "error",
                    message: "Notification not found"
                });
            }

            const oldSenderId = oldNotif.sender_id;

            // ------------------ UPDATE STATUS T_PO ------------------
            const newStatus = isLastLevel ? "APPROVED" : "IN APPROVAL";

            await t_purchase_order.update({
                status: newStatus,
                updated_by: user_approved_id
            }, {
                where: {
                    id: purchase_order_id
                }
            });

            // ------------------ CLOSE NOTIF LAMA (JANGAN UBAH status_name) ------------------
            await t_purchase_order_notifikasi.update({
                status: true // hanya tandai sudah diproses
            }, {
                where: {
                    id: purchase_order_notifikasi_id
                }
            });

            // ------------------ CREATE RECORD BARU UNTUK KEPUTUSAN APPROVED ------------------
            await t_purchase_order_notifikasi.create({
                title: "Approved Purchase Order",
                approval_message: isLastLevel ? "PO telah disetujui" : "Approved, lanjut ke level berikutnya",
                approval_catatan: approval_catatan || null,
                t_purchase_order_id: purchase_order_id,
                sender_id: oldSenderId,
                approval_level: currentLevel,
                status: true,
                status_name: "APPROVED",
                user_approved_id: user_approved_id
            });

            // ------------------ BUAT NOTIF LEVEL BERIKUTNYA (JIKA ADA) ------------------
            if (!isLastLevel && nextRule) {
                await t_purchase_order_notifikasi.create({
                    title: "Approval Purchase Order",
                    approval_message: "Waiting for next approval",
                    approval_catatan: "",
                    t_purchase_order_id: purchase_order_id,
                    sender_id: user_approved_id,
                    approval_level: Number(nextRule.level),
                    status: false,
                    status_name: "IN APPROVAL",
                    user_approved_id: null
                });
            }

            // ------------------ UPDATE PR STATUS_TRANSAKSI (JIKA LAST LEVEL) - CRITICAL ------------------
            if (isLastLevel) {
                // Get PO details to find related PR
                const t_purchase_order_d = req.models.t_purchase_order_d || req.models.t_purchase_order_ds;
                if (!t_purchase_order_d) {
                    throw new Error("Model t_purchase_order_d tidak ditemukan. Gagal update status PR.");
                }

                // qty_pr TIDAK ADA di t_purchase_order_d, harus ambil dari t_purchase_request_d
                const poDetails = await t_purchase_order_d.findAll({
                    where: { t_purchase_order_id: purchase_order_id },
                    attributes: ['id', 't_purchase_request_id', 't_purchase_request_d_id', 'm_items_id', 'qty_po']
                });

                if (!poDetails || poDetails.length === 0) {
                    throw new Error("Detail PO tidak ditemukan. Gagal update status PR.");
                }

                // Get unique PR IDs
                const prIds = [...new Set(poDetails.map(d => d.t_purchase_request_id).filter(id => id))];
                
                if (prIds.length === 0) {
                    throw new Error("Tidak ada Purchase Request terkait dengan PO ini. Gagal update status PR.");
                }

                const t_purchase_request = req.models.t_purchase_request || req.models.t_purchase_requests;
                if (!t_purchase_request) {
                    throw new Error("Model t_purchase_request tidak ditemukan. Gagal update status PR.");
                }

                // Update PR status_transaksi to ORDERED
                const [updatedCount] = await t_purchase_request.update(
                    { 
                        status_transaksi: 'ORDERED',
                        updated_by: user_approved_id
                    },
                    {
                        where: {
                            id: prIds
                        }
                    }
                );

                // Verify update berhasil
                if (updatedCount === 0) {
                    throw new Error(`Gagal update status_transaksi PR menjadi ORDERED. PR IDs: ${prIds.join(', ')}`);
                }

                console.log(`✅ Berhasil update ${updatedCount} Purchase Request menjadi ORDERED:`, prIds);

                // ==============================================================================
                // AUTO CREATE PR CLOSE UNTUK SEMUA ITEM DI PO (TIDAK PERLU TUNGGU SEMUA TERPENUHI)
                // ==============================================================================
                // Get PO data untuk ambil no_po
                const poData = await t_purchase_order.findByPk(purchase_order_id, {
                    attributes: ['id', 'no_po']
                });
                
                if (!poData || !poData.no_po) {
                    throw new Error('Data PO tidak ditemukan atau no_po kosong!');
                }
                
                const noPO = poData.no_po;
                
                // Group PO details by PR ID
                const poDetailsByPR = {};
                for (const pod of poDetails) {
                    if (!pod.t_purchase_request_id) continue;
                    if (!poDetailsByPR[pod.t_purchase_request_id]) {
                        poDetailsByPR[pod.t_purchase_request_id] = [];
                    }
                    poDetailsByPR[pod.t_purchase_request_id].push(pod);
                }

                // Get models for PR Close
                const t_purchase_request_close = req.models.t_purchase_request_close;
                const t_purchase_request_close_d = req.models.t_purchase_request_close_d || req.models.t_purchase_request_close_ds;
                const t_purchase_request_d = req.models.t_purchase_request_d || req.models.t_purchase_request_ds;

                if (!t_purchase_request_close || !t_purchase_request_close_d) {
                    throw new Error('Model t_purchase_request_close atau t_purchase_request_close_d tidak ditemukan!');
                }

                // Process each PR
                for (const prId of Object.keys(poDetailsByPR)) {
                    const prPODetails = poDetailsByPR[prId];
                    
                    // Get PR data
                    const prData = await t_purchase_request.findByPk(prId);
                    if (!prData) {
                        throw new Error(`PR ${prId} tidak ditemukan!`);
                    }

                    // Get all PR Detail items for this PR
                    let prDetailItems = [];
                    if (t_purchase_request_d) {
                        prDetailItems = await t_purchase_request_d.findAll({
                            where: { t_purchase_request_id: prId },
                            attributes: ['id', 'm_items_id', 'qty_pr']
                        });
                    }

                    if (prDetailItems.length === 0) {
                        throw new Error(`PR Detail untuk PR ${prData.no_pr} tidak ditemukan!`);
                    }

                    // Hitung total qty PR dan qty PO untuk ALASAN
                    let totalQtyPR = 0;
                    let totalQtyPO = 0;
                    const closeItems = [];

                    for (const prDetail of prDetailItems) {
                        // Find matching PO detail
                        const matchingPODetail = prPODetails.find(
                            pod => pod.t_purchase_request_d_id === prDetail.id || 
                                   pod.m_items_id === prDetail.m_items_id
                        );

                        const qtyPR = Number(prDetail.qty_pr) || 0;
                        const qtyPO = matchingPODetail ? (Number(matchingPODetail.qty_po) || 0) : 0;

                        totalQtyPR += qtyPR;
                        totalQtyPO += qtyPO;

                        // SEMUA item di PO dimasukkan ke PR Close (tidak peduli fulfilled atau tidak)
                        if (matchingPODetail) {
                            closeItems.push({
                                t_purchase_order_d_id: matchingPODetail.id,
                                m_items_id: prDetail.m_items_id,
                                qty_prc: qtyPO, // qty yang di-close = qty PO (bukan qty PR)
                                catatan: `PURCHASE REQUEST AUTO CLOSE BY PO-${noPO}`,
                                created_by: user_approved_id
                            });
                        }
                    }

                    console.log(`📊 PR ${prData.no_pr}: Total PR=${totalQtyPR}, Total PO=${totalQtyPO}`);

                    // Create PR Close untuk semua item (tidak perlu cek fulfilled)
                    if (closeItems.length > 0) {
                        console.log(`✅ PR ${prData.no_pr} membuat PR Close otomatis untuk ${closeItems.length} items...`);

                        // Check if PR Close already exists for this PR
                        const existingPRClose = await t_purchase_request_close.findOne({
                            where: { t_purchase_request_id: prId }
                        });

                        if (existingPRClose) {
                            console.log(`⚠️ PR Close sudah ada untuk PR ${prData.no_pr}, skip`);
                            continue;
                        }

                        // Create PR Close header dengan format baru
                        const prCloseData = {
                            m_unit_bisnis_id: prData.m_unit_bisnis_id,
                            t_purchase_request_id: prId,
                            tgl_close: new Date().toISOString().split('T')[0],
                            alasan: `COMPLETE ORDERED ${totalQtyPO}/${totalQtyPR}`,
                            catatan: `PURCHASE REQUEST AUTO CLOSE BY PO-${noPO}`,
                            status: 'APPROVED SYSTEM', // Langsung approved tanpa approval
                            created_by: user_approved_id
                        };

                        const newPRClose = await t_purchase_request_close.create(prCloseData);
                        
                        if (!newPRClose || !newPRClose.id) {
                            throw new Error(`Gagal membuat PR Close untuk PR ${prData.no_pr}!`);
                        }
                        
                        console.log(`✅ PR Close header created: ${newPRClose.id}`);

                        // Create PR Close details untuk SEMUA item di PO
                        for (const item of closeItems) {
                            const newDetail = await t_purchase_request_close_d.create({
                                t_purchase_request_close_id: newPRClose.id,
                                t_purchase_order_d_id: item.t_purchase_order_d_id,
                                m_items_id: item.m_items_id,
                                qty_prc: item.qty_prc,
                                catatan: item.catatan,
                                created_by: user_approved_id
                            });
                            
                            if (!newDetail || !newDetail.id) {
                                throw new Error(`Gagal membuat PR Close Detail untuk item ${item.m_items_id}!`);
                            }
                        }
                        console.log(`✅ PR Close details created: ${closeItems.length} items`);

                        // Update PR status_transaksi to CLOSED
                        const [closedCount] = await t_purchase_request.update(
                            { 
                                status_transaksi: 'CLOSED',
                                updated_by: user_approved_id
                            },
                            { where: { id: prId } }
                        );
                        
                        if (closedCount === 0) {
                            throw new Error(`Gagal update PR ${prData.no_pr} status_transaksi menjadi CLOSED!`);
                        }
                        
                        console.log(`✅ PR ${prData.no_pr} status_transaksi updated to CLOSED`);
                    } else {
                        console.log(`ℹ️ PR ${prData.no_pr} tidak ada item dari PO, skip auto-close`);
                    }
                }
            }

            return res.json({
                status: "success",
                message: "Purchase Order APPROVED",
                data: {
                    purchase_order_id,
                    new_status: newStatus,
                    is_last_level: isLastLevel,
                    next_level: nextRule ? Number(nextRule.level) : null
                }
            });

        } catch (error) {
            console.error("APPROVE ERROR:", error);
            return res.status(500).json({
                status: "error",
                message: error.message
            });
        }
    },

    // =====================================================================
    // REJECT (TIDAK PAKAI RULE, LANGSUNG FINAL)
    // =====================================================================
    async reject(req, res) {
        try {
            const {
                purchase_order_id,
                purchase_order_notifikasi_id,
                approval_level,
                approval_catatan,
                user_approved_id
            } = req.body;

            if (
                !purchase_order_id ||
                !purchase_order_notifikasi_id ||
                approval_level === undefined ||
                !user_approved_id
            ) {
                return res.status(400).json({
                    status: "error",
                    message: "purchase_order_id, purchase_order_notifikasi_id, approval_level, dan user_approved_id wajib diisi"
                });
            }

            const {
                t_purchase_order,
                t_purchase_order_notifikasi
            } = req.models;

            const oldNotif = await t_purchase_order_notifikasi.findOne({
                where: {
                    id: purchase_order_notifikasi_id
                }
            });

            if (!oldNotif) {
                return res.status(404).json({
                    status: "error",
                    message: "Notification not found"
                });
            }

            // UPDATE PO → REJECT
            await t_purchase_order.update({
                status: "REJECT",
                status_transaksi: "REJECT",
                updated_by: user_approved_id
            }, {
                where: {
                    id: purchase_order_id
                }
            });

            // ------------------ CLOSE NOTIF LAMA (JANGAN UBAH status_name) ------------------
            await t_purchase_order_notifikasi.update({
                status: true // hanya tandai sudah diproses
            }, {
                where: {
                    id: purchase_order_notifikasi_id
                }
            });

            // ------------------ CREATE RECORD BARU UNTUK KEPUTUSAN REJECT ------------------
            await t_purchase_order_notifikasi.create({
                title: "Rejected Purchase Order",
                approval_message: "PO ditolak",
                approval_catatan: approval_catatan || null,
                t_purchase_order_id: purchase_order_id,
                sender_id: oldNotif.sender_id,
                approval_level: approval_level,
                status: true,
                status_name: "REJECT",
                user_approved_id: user_approved_id
            });

            return res.json({
                status: "success",
                message: "Purchase Order REJECTED",
                data: {
                    purchase_order_id,
                    new_status: "REJECT"
                }
            });

        } catch (error) {
            console.error("REJECT ERROR:", error);
            return res.status(500).json({
                status: "error",
                message: error.message
            });
        }
    },

    // =====================================================================
    // REVISI (CREATE RECORD BARU UNTUK KEPUTUSAN ATASAN)
    // =====================================================================
    async revisi(req, res) {
        try {
            const {
                purchase_order_id,
                purchase_order_notifikasi_id,
                approval_level,
                approval_catatan,
                user_approved_id
            } = req.body;

            if (
                !purchase_order_id ||
                !purchase_order_notifikasi_id ||
                approval_level === undefined ||
                !user_approved_id
            ) {
                return res.status(400).json({
                    status: "error",
                    message: "purchase_order_id, purchase_order_notifikasi_id, approval_level, dan user_approved_id wajib diisi"
                });
            }

            const {
                t_purchase_order,
                t_purchase_order_notifikasi
            } = req.models;

            const oldNotif = await t_purchase_order_notifikasi.findOne({
                where: {
                    id: purchase_order_notifikasi_id
                }
            });

            if (!oldNotif) {
                return res.status(404).json({
                    status: "error",
                    message: "Notification not found"
                });
            }

            // ============================
            // UPDATE PO → REVISI
            // ============================
            await t_purchase_order.update({
                status: "REVISI",
                status_transaksi: "REVISI",
                updated_by: user_approved_id
            }, {
                where: {
                    id: purchase_order_id
                }
            });

            // ============================
            // CLOSE NOTIF PENGAJU (SET status=true)
            // ============================
            await t_purchase_order_notifikasi.update({
                status: true
            }, {
                where: {
                    id: purchase_order_notifikasi_id
                }
            });

            // ============================
            // CREATE RECORD BARU UNTUK NOTIFIKASI REVISI KE PENGAJU
            // ============================
            await t_purchase_order_notifikasi.create({
                title: "Revisi Purchase Order",
                approval_message: "PO membutuhkan revisi",
                approval_catatan: approval_catatan || null,
                t_purchase_order_id: purchase_order_id,
                sender_id: oldNotif.sender_id, // pengaju awal (supaya muncul di notif dia)
                approval_level: approval_level, // level atasan yang revisi
                status: false, // ✅ FALSE = belum diproses, muncul di notif pengaju
                status_name: "REVISI",
                user_approved_id: user_approved_id // atasan yang minta revisi
            });

            return res.json({
                status: "success",
                message: "Purchase Order REVISED",
                update_status_to: "REVISI",
                data: {
                    purchase_order_id,
                    new_status: "REVISI"
                }
            });

        } catch (error) {
            console.error("REVISI ERROR:", error);
            return res.status(500).json({
                status: "error",
                message: error.message
            });
        }
    }

};
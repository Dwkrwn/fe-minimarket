// Controller for t_purchase_return
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_return
//
// Tambahkan custom function di bawah ini

export const t_purchase_returnController = {
  // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
  async uploadImage(req, res) {
    const fileFields = Object.keys(req.models.t_purchase_return.rawAttributes).filter(
      key => req.models.t_purchase_return.rawAttributes[key].type && req.models.t_purchase_return.rawAttributes[key].type.key === 'STRING'
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
      const inserted = await req.models.t_purchase_return.create(data);
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
      const inserted = await req.models.t_purchase_return.bulkCreate(records);
      res.json({ message: 'Excel imported', data: inserted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Contoh: Custom function
  async customFunction(req, res) {
    res.json({ message: 'Custom function untuk t_purchase_return', body: req.body, query: req.query });
  },

  // Get purchase return by ID dengan include lengkap dan filter is_pi_pb
  async getPReturn(req, res) {
    try {
      const { id, is_pi_pb } = req.query;

      if (!id) {
        return res.status(400).json({
          status: 'error',
          message: 'Parameter id tidak ditemukan'
        });
      }

      // Debug: log available models
      console.log('Available models:', Object.keys(req.models));

      const {
        t_purchase_return,
        t_purchase_return_d,
        m_supplier,
        t_purchase_invoice,
        t_purchase_invoices,
        t_purchase_invoice_d,
        t_penerimaan_barangs,
        t_penerimaan_barang,
        t_penerimaan_barang_d,
        t_purchase_order_d,
        m_rak_d,
        m_rak,
        m_currency,
        m_currency_d,
        m_items,
        m_general
      } = req.models;

      // Build where clause
      const where = { id };
      if (is_pi_pb !== undefined) {
        where.is_pi_pb = is_pi_pb === 'true' || is_pi_pb === true;
      }

      // Gunakan model yang tersedia (handle plural/singular)
      const PI_MODEL = t_purchase_invoice || t_purchase_invoices;
      const PB_MODEL = t_penerimaan_barang || t_penerimaan_barangs;

      // Build includes array dinamis - hanya tambahkan jika model tersedia
      const includes = [];

      if (m_supplier) {
        includes.push({ 
          model: m_supplier, 
          required: false 
        });
      }

      if (PI_MODEL) {
        includes.push({ 
          model: PI_MODEL, 
          required: false 
        });
      }

      if (PB_MODEL) {
        includes.push({ 
          model: PB_MODEL, 
          required: false 
        });
      }

      if (m_currency) {
        const currencyInclude = { 
          model: m_currency, 
          required: false
        };
        if (m_currency_d) {
          currencyInclude.include = [{ 
            model: m_currency_d, 
            required: false 
          }];
        }
        includes.push(currencyInclude);
      }

      // Include m_general untuk tiper_retur (as t_pr_retur)
      if (m_general) {
        includes.push({
          model: m_general,
          as: 't_pr_retur',
          attributes: ['id', 'value1', 'value2', 'value3'],
          required: false
        });
      }

      // Include m_general untuk ppn_id (as t_pr_ppn)
      if (m_general) {
        includes.push({
          model: m_general,
          as: 't_pr_ppn',
          attributes: ['id', 'value1', 'value2', 'value3'],
          required: false
        });
      }

      // Include m_general untuk pph_id (as t_pr_pph)
      if (m_general) {
        includes.push({
          model: m_general,
          as: 't_pr_pph',
          attributes: ['id', 'value1', 'value2', 'value3'],
          required: false
        });
      }

      if (t_purchase_return_d) {
        const detailInclude = {
          model: t_purchase_return_d,
          required: false,
          include: []
        };
        
        // Include m_items di level t_purchase_return_d (langsung, bukan nested di pi_d)
        if (m_items) {
          const itemInclude = {
            model: m_items,
            as: 'm_item',
            attributes: ['id', 'kode_item', 'nama_item'],
            required: false
          };
          
          // Include UOM dari m_general
          if (m_general) {
            itemInclude.include = [{
              model: m_general,
              as: 'uom',
              attributes: ['id', 'value1'],
              required: false
            }];
          }
          
          detailInclude.include.push(itemInclude);
        }
        
        // Include t_purchase_invoice_d dengan nested (sejajar dengan m_item)
        if (t_purchase_invoice_d) {
          const piDInclude = {
            model: t_purchase_invoice_d,
            as: 'pi_d',
            attributes: ['id', 'qty_pi'],
            required: false
          };

          const piDNestedIncludes = [];
          if (t_penerimaan_barang_d) {
            const pbDetailInclude = { 
              model: t_penerimaan_barang_d, 
              attributes: ['id', 'qty_diterima', 'rak_d_id'],
              required: false 
            };
            if (m_rak_d && m_rak) {
              pbDetailInclude.include = [{
                model: m_rak_d,
                attributes: ['id', 'kode'],
                required: false,
                include: [{
                  model: m_rak,
                  attributes: ['id', 'nama_rak'],
                  required: false
                }]
              }];
            }
            piDNestedIncludes.push(pbDetailInclude);
          }
          if (t_purchase_order_d) {
            piDNestedIncludes.push({ 
              model: t_purchase_order_d,
              attributes: ['id', 'qty_po', 'harga', 'disc_1', 'disc_2', 'amt_disc'],
              required: false 
            });
          }
          if (piDNestedIncludes.length > 0) {
            piDInclude.include = piDNestedIncludes;
          }
          detailInclude.include.push(piDInclude);
        }

        if (t_penerimaan_barang_d) {
          const pbDInclude = {
            model: t_penerimaan_barang_d,
            as: 'pb_d',
            attributes: ['id', 'qty_diterima', 'rak_d_id'],
            required: false
          };
          if (m_rak_d && m_rak) {
            pbDInclude.include = [{
              model: m_rak_d,
              attributes: ['id', 'kode'],
              required: false,
              include: [{
                model: m_rak,
                attributes: ['id', 'nama_rak'],
                required: false
              }]
            }];
          }
          detailInclude.include.push(pbDInclude);
        }

        includes.push(detailInclude);
      }

      console.log('Final includes count:', includes.length);

      const data = await t_purchase_return.findOne({
        where,
        include: includes
      });

      if (!data) {
        return res.status(404).json({ 
          status: 'error', 
          message: 'Data purchase return tidak ditemukan' 
        });
      }

      res.json({ 
        status: 'success', 
        data 
      });
    } catch (err) {
      console.error('getPReturn ERROR:', err);
      res.status(500).json({ 
        status: 'error', 
        message: err.message 
      });
    }
  },

  // =====================================================================
  // APPROVE PURCHASE RETURN - Update Stock Gudang (Multi-Level Approval)
  // Referensi: t_purchase_invoice.js approve() - konsep sama, logic untuk Purchase Return
  // =====================================================================
  async approve(req, res) {
    // Get sequelize instance for transaction
    const sequelize = req.models.t_purchase_return.sequelize;
    const { Op } = sequelize.Sequelize;
    const transaction = await sequelize.transaction();
    
    try {
      console.log("🔥 START APPROVE PURCHASE RETURN");
      console.log("📌 Request Body:", JSON.stringify(req.body, null, 2));

      const {
        purchase_return_id,
        purchase_return_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id,
        sender_id,
        m_approval_id
      } = req.body;

      // ------------------ VALIDASI DASAR ------------------
      if (
        !purchase_return_id ||
        !purchase_return_notifikasi_id ||
        approval_level === undefined ||
        !user_approved_id ||
        !m_approval_id
      ) {
        await transaction.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'purchase_return_id, purchase_return_notifikasi_id, approval_level, user_approved_id, dan m_approval_id wajib diisi'
        });
      }

      const {
        t_purchase_return,
        t_purchase_return_d,
        t_purchase_return_notifikasi,
        m_approval_d,
        stock_gudang,
        stock_gudang_d
      } = req.models;

      // ------------------ AMBIL RULE APPROVAL ------------------
      const approvalDetails = await m_approval_d.findAll({
        where: {
          m_approval_id: m_approval_id,
          is_active: true
        },
        order: [["level", "ASC"]],
        transaction
      });

      if (!approvalDetails || approvalDetails.length === 0) {
        await transaction.rollback();
        return res.status(500).json({
          status: "error",
          message: "Approval rule tidak ditemukan untuk m_approval_id tersebut"
        });
      }

      // Cari rule level saat ini
      const currentLevel = Number(approval_level);
      const currentRuleIndex = approvalDetails.findIndex(
        (r) => Number(r.level) === currentLevel
      );

      if (currentRuleIndex === -1) {
        await transaction.rollback();
        return res.status(500).json({
          status: "error",
          message: `Approval rule untuk level ${currentLevel} tidak ditemukan`
        });
      }

      const currentRule = approvalDetails[currentRuleIndex];
      const isFull = !!currentRule.is_full;

      // Cari next rule (kalau ada)
      const nextRule = approvalDetails[currentRuleIndex + 1] || null;
      // Handle single-level approval (approvalDetails.length === 1)
      const isLastLevel = isFull || !nextRule || approvalDetails.length === 1;

      // 🔍 DEBUG INFO
      const debugInfo = {
        total_approval_rules: approvalDetails.length,
        current_level: currentLevel,
        current_rule_index: currentRuleIndex,
        is_full: isFull,
        has_next_rule: !!nextRule,
        next_rule_level: nextRule ? Number(nextRule.level) : null,
        is_last_level_calculated: isLastLevel,
        all_rules_levels: approvalDetails.map(r => ({
          level: r.level,
          is_full: r.is_full,
          tipe_user_id: r.tipe_user_id
        }))
      };

      console.log('🔍 APPROVAL DEBUG:', JSON.stringify(debugInfo, null, 2));

      // ------------------ GET OLD NOTIFICATION ------------------
      const oldNotif = await t_purchase_return_notifikasi.findOne({
        where: { id: purchase_return_notifikasi_id },
        transaction
      });

      if (!oldNotif) {
        await transaction.rollback();
        return res.status(500).json({
          status: "error",
          message: "Notification not found"
        });
      }

      const oldSenderId = oldNotif.sender_id;

      // ------------------ GET PURCHASE RETURN DATA ------------------
      const purchaseReturn = await t_purchase_return.findOne({
        where: { id: purchase_return_id },
        include: [
          {
            model: t_purchase_return_d,
            as: 't_purchase_return_ds',
            required: false
          }
        ],
        transaction
      });

      if (!purchaseReturn) {
        await transaction.rollback();
        return res.status(500).json({
          status: 'error',
          message: 'Purchase Return not found'
        });
      }

      console.log("✅ Purchase Return found:", purchaseReturn.no_return);
      console.log("📦 Gudang ID:", purchaseReturn.m_gudang_id);
      console.log("📋 Details count:", purchaseReturn.t_purchase_return_ds?.length || 0);

      // ------------------ UPDATE STATUS PURCHASE RETURN ------------------
      const newStatus = isLastLevel ? "APPROVED" : "IN APPROVAL";
      
      const statusBefore = purchaseReturn.status;
      console.log(`🔍 BEFORE UPDATE - PR ID: ${purchase_return_id}, Status: ${statusBefore}`);

      purchaseReturn.status = newStatus;
      purchaseReturn.updated_by = user_approved_id;
      await purchaseReturn.save({ transaction });

      console.log(`🔍 AFTER SAVE - PR ID: ${purchase_return_id}, Status: ${purchaseReturn.status}`);

      // Tambahkan ke debugInfo
      debugInfo.update_debug = {
        status_before: statusBefore,
        status_after_save: purchaseReturn.status,
        expected_status: newStatus
      };

      console.log(`✅ Berhasil update Purchase Return status menjadi ${newStatus}: ${purchase_return_id}`);

      // ------------------ CLOSE NOTIF LAMA ------------------
      await t_purchase_return_notifikasi.update({
        status: true
      }, {
        where: { id: purchase_return_notifikasi_id },
        transaction
      });

      // ------------------ CREATE RECORD BARU UNTUK KEPUTUSAN APPROVED ------------------
      await t_purchase_return_notifikasi.create({
        title: "Approved Purchase Return",
        approval_message: isLastLevel ? "Purchase Return telah disetujui" : "Approved, lanjut ke level berikutnya",
        approval_catatan: approval_catatan || null,
        t_purchase_return_id: purchase_return_id,
        sender_id: oldSenderId,
        approval_level: currentLevel,
        status: true,
        status_name: "APPROVED",
        user_approved_id: user_approved_id
      }, { transaction });

      // ------------------ BUAT NOTIF LEVEL BERIKUTNYA (JIKA ADA) ------------------
      if (!isLastLevel && nextRule) {
        await t_purchase_return_notifikasi.create({
          title: "Approval Purchase Return",
          approval_message: "Waiting for next approval",
          approval_catatan: "",
          t_purchase_return_id: purchase_return_id,
          sender_id: user_approved_id,
          approval_level: Number(nextRule.level),
          status: false,
          status_name: "IN APPROVAL",
          user_approved_id: null
        }, { transaction });
      }

      // ------------------ PROCESS STOCK REDUCTION (HANYA JIKA LAST LEVEL) ------------------
      if (isLastLevel) {
        console.log("🔄 LAST LEVEL - Processing stock reduction...");

        if (purchaseReturn.t_purchase_return_ds && purchaseReturn.t_purchase_return_ds.length > 0) {
          for (const detail of purchaseReturn.t_purchase_return_ds) {
            const itemId = detail.m_items_id;
            const qtyRetur = Number(detail.qty_retur || 0);

            if (!itemId || qtyRetur <= 0) {
              console.log(`⚠️ Skip detail ${detail.id}: no item or qty_retur <= 0`);
              continue;
            }

            console.log(`📦 Processing item ${itemId}, qty_retur: ${qtyRetur}`);

            // Find or create stock_gudang
            let stockGudang = await stock_gudang.findOne({
              where: {
                m_gudang_id: purchaseReturn.m_gudang_id,
                m_items_id: itemId
              },
              transaction
            });

            if (!stockGudang) {
              // Create new stock_gudang with 0 initial stock
              stockGudang = await stock_gudang.create(
                {
                  m_gudang_id: purchaseReturn.m_gudang_id,
                  m_items_id: itemId,
                  free_stock: 0
                },
                { transaction }
              );
              console.log(`✅ Created new stock_gudang for item ${itemId}`);
            }

            const currentStock = Number(stockGudang.free_stock || 0);
            const newStock = currentStock - qtyRetur;

            console.log(`📊 Current stock: ${currentStock}, After return: ${newStock}`);

            // Check if stock is sufficient
            if (newStock < 0) {
              await transaction.rollback();
              return res.status(500).json({
                status: 'error',
                message: `Stock tidak mencukupi untuk item ${itemId}. Stock saat ini: ${currentStock}, Qty retur: ${qtyRetur}`
              });
            }

            // Update stock_gudang - reduce free_stock
            await stockGudang.update(
              { free_stock: newStock },
              { transaction }
            );

            console.log(`✅ Stock updated for item ${itemId}: ${currentStock} → ${newStock}`);

            // Insert into stock_gudang_d (history)
            await stock_gudang_d.create(
              {
                stock_gudang_id: stockGudang.id,
                t_penerimaan_barangs_id: null, // NULL for purchase return
                m_items_id: itemId,
                stock_masuk: 0, // 0 for purchase return
                t_purchase_return_id: purchase_return_id,
                stock_keluar: qtyRetur
              },
              { transaction }
            );

            console.log(`✅ Stock history created for item ${itemId}`);
          }

          console.log("✅ All stock reductions completed");

          debugInfo.stock_update = {
            gudang_id: purchaseReturn.m_gudang_id,
            items_processed: purchaseReturn.t_purchase_return_ds.length
          };
        } else {
          console.log("⚠️ No details found in purchase return");
        }
      }

      // ✅ COMMIT TRANSACTION
      await transaction.commit();
      console.log('✅ TRANSACTION COMMITTED SUCCESSFULLY');

      console.log("🎉 APPROVE PURCHASE RETURN SUCCESS");

      return res.json({
        status: 'success',
        message: isLastLevel 
          ? 'Purchase Return APPROVED dan stock berhasil dikurangi' 
          : 'Purchase Return APPROVED, menunggu approval level berikutnya',
        data: {
          purchase_return_id,
          purchase_return_notifikasi_id,
          no_return: purchaseReturn.no_return,
          new_status: newStatus,
          is_last_level: isLastLevel,
          next_level: nextRule ? Number(nextRule.level) : null
        },
        debug: debugInfo
      });

    } catch (err) {
      await transaction.rollback();
      console.error("❌ Fatal Error APPROVE PURCHASE RETURN:", err);
      return res.status(500).json({
        status: 'error',
        message: err.message,
        details: err.stack
      });
    }
  },

  // =====================================================================
  // REJECT PURCHASE RETURN (TIDAK PAKAI RULE, LANGSUNG FINAL)
  // Referensi: t_purchase_invoice.js reject()
  // =====================================================================
  async reject(req, res) {
    const sequelize = req.models.t_purchase_return.sequelize;
    const transaction = await sequelize.transaction();

    try {
      console.log("🔥 START REJECT PURCHASE RETURN");

      const {
        purchase_return_id,
        purchase_return_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id
      } = req.body;

      if (!purchase_return_id || !purchase_return_notifikasi_id || !user_approved_id) {
        await transaction.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'purchase_return_id, purchase_return_notifikasi_id, dan user_approved_id wajib diisi'
        });
      }

      const {
        t_purchase_return,
        t_purchase_return_notifikasi
      } = req.models;

      // Get old notification untuk sender_id
      const oldNotif = await t_purchase_return_notifikasi.findOne({
        where: { id: purchase_return_notifikasi_id },
        transaction
      });

      if (!oldNotif) {
        await transaction.rollback();
        return res.status(500).json({
          status: "error",
          message: "Notification not found"
        });
      }

      // Update Purchase Return status ke REJECTED
      await t_purchase_return.update(
        { 
          status: "REJECTED",
          updated_by: user_approved_id
        },
        {
          where: { id: purchase_return_id },
          transaction
        }
      );

      // Close old notification
      await t_purchase_return_notifikasi.update(
        { status: true },
        {
          where: { id: purchase_return_notifikasi_id },
          transaction
        }
      );

      // Create record baru untuk keputusan REJECTED
      await t_purchase_return_notifikasi.create({
        title: "Rejected Purchase Return",
        approval_message: "Purchase Return ditolak",
        approval_catatan: approval_catatan || null,
        t_purchase_return_id: purchase_return_id,
        sender_id: oldNotif.sender_id,
        approval_level: approval_level,
        status: true,
        status_name: "REJECTED",
        user_approved_id: user_approved_id
      }, { transaction });

      await transaction.commit();
      console.log("✅ REJECT PURCHASE RETURN SUCCESS");

      return res.json({
        status: "success",
        message: "Purchase Return REJECTED",
        data: {
          purchase_return_id,
          purchase_return_notifikasi_id,
          new_status: "REJECTED"
        }
      });

    } catch (err) {
      await transaction.rollback();
      console.error("❌ Fatal Error REJECT PURCHASE RETURN:", err);
      return res.status(500).json({
        status: 'error',
        message: err.message,
        details: err.stack
      });
    }
  },

  // =====================================================================
  // REVISI PURCHASE RETURN (CREATE RECORD BARU UNTUK KEPUTUSAN ATASAN)
  // Referensi: t_purchase_invoice.js revisi()
  // =====================================================================
  async revisi(req, res) {
    const sequelize = req.models.t_purchase_return.sequelize;
    const transaction = await sequelize.transaction();

    try {
      console.log("🔥 START REVISI PURCHASE RETURN");

      const {
        purchase_return_id,
        purchase_return_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id
      } = req.body;

      if (!purchase_return_id || !purchase_return_notifikasi_id || !user_approved_id) {
        await transaction.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'purchase_return_id, purchase_return_notifikasi_id, dan user_approved_id wajib diisi'
        });
      }

      const {
        t_purchase_return,
        t_purchase_return_notifikasi
      } = req.models;

      // Get old notification untuk sender_id
      const oldNotif = await t_purchase_return_notifikasi.findOne({
        where: { id: purchase_return_notifikasi_id },
        transaction
      });

      if (!oldNotif) {
        await transaction.rollback();
        return res.status(500).json({
          status: "error",
          message: "Notification not found"
        });
      }

      // Update Purchase Return status ke WAITING REVISE
      await t_purchase_return.update(
        { 
          status: "WAITING REVISE",
          updated_by: user_approved_id
        },
        {
          where: { id: purchase_return_id },
          transaction
        }
      );

      // Close old notification
      await t_purchase_return_notifikasi.update(
        { status: true },
        {
          where: { id: purchase_return_notifikasi_id },
          transaction
        }
      );

      // Create record baru untuk keputusan REVISI
      await t_purchase_return_notifikasi.create({
        title: "Revise Purchase Return",
        approval_message: "Purchase Return perlu direvisi",
        approval_catatan: approval_catatan || null,
        t_purchase_return_id: purchase_return_id,
        sender_id: oldNotif.sender_id,
        approval_level: approval_level,
        status: true,
        status_name: "WAITING REVISE",
        user_approved_id: user_approved_id
      }, { transaction });

      await transaction.commit();
      console.log("✅ REVISI PURCHASE RETURN SUCCESS");

      return res.json({
        status: "success",
        message: "Purchase Return dikembalikan untuk revisi",
        data: {
          purchase_return_id,
          purchase_return_notifikasi_id,
          new_status: "WAITING REVISE"
        }
      });

    } catch (err) {
      await transaction.rollback();
      console.error("❌ Fatal Error REVISI PURCHASE RETURN:", err);
      return res.status(500).json({
        status: 'error',
        message: err.message,
        details: err.stack
      });
    }
  },

  // =====================================================================
  // SYNC STOCK DARI PURCHASE RETURN YANG SUDAH APPROVED
  // Untuk memperbaiki data return yang APPROVED tapi belum punya stock_gudang_d
  // =====================================================================
  async syncStockFromPurchaseReturn(req, res) {
    const sequelize = req.models.t_purchase_return.sequelize;
    const transaction = await sequelize.transaction();

    try {
      console.log('🔥 START SYNC STOCK FROM PURCHASE RETURN');

      const {
        t_purchase_return,
        t_purchase_return_d,
        stock_gudang,
        stock_gudang_d
      } = req.models;

      const { Op } = sequelize.Sequelize;

      // 1. Get all purchase return with status APPROVED
      const allReturnApproved = await t_purchase_return.findAll({
        where: { status: 'APPROVED' },
        include: [{
          model: t_purchase_return_d,
          as: 't_purchase_return_ds',
          required: false
        }],
        transaction
      });

      console.log(`📋 Found ${allReturnApproved.length} purchase return with APPROVED status`);

      const syncResults = {
        total_return: allReturnApproved.length,
        already_synced: 0,
        newly_synced: 0,
        skipped: 0,
        errors: [],
        details: []
      };

      for (const purchaseReturn of allReturnApproved) {
        try {
          // Check if this return already has stock_gudang_d entries
          const existingStockD = await stock_gudang_d.findOne({
            where: { t_purchase_return_id: purchaseReturn.id },
            transaction
          });

          if (existingStockD) {
            syncResults.already_synced++;
            syncResults.details.push({
              return_id: purchaseReturn.id,
              no_return: purchaseReturn.no_return,
              status: 'ALREADY_SYNCED'
            });
            continue;
          }

          // Get details
          const details = purchaseReturn.t_purchase_return_ds || [];

          if (details.length === 0) {
            syncResults.skipped++;
            syncResults.details.push({
              return_id: purchaseReturn.id,
              no_return: purchaseReturn.no_return,
              status: 'SKIPPED',
              reason: 'No items found'
            });
            continue;
          }

          // Process each item
          let itemsProcessed = 0;
          for (const detail of details) {
            const itemId = detail.m_items_id;
            const qtyRetur = Number(detail.qty_retur || 0);

            if (!itemId || qtyRetur <= 0) continue;

            // Find or create stock_gudang
            let stockGudangRecord = await stock_gudang.findOne({
              where: {
                m_gudang_id: purchaseReturn.m_gudang_id,
                m_items_id: itemId
              },
              transaction
            });

            if (!stockGudangRecord) {
              stockGudangRecord = await stock_gudang.create({
                m_gudang_id: purchaseReturn.m_gudang_id,
                m_items_id: itemId,
                free_stock: 0
              }, { transaction });
            }

            // Create stock_gudang_d entry
            await stock_gudang_d.create({
              stock_gudang_id: stockGudangRecord.id,
              t_purchase_return_id: purchaseReturn.id,
              m_items_id: itemId,
              stock_masuk: 0,
              stock_keluar: qtyRetur
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
            return_id: purchaseReturn.id,
            no_return: purchaseReturn.no_return,
            status: 'NEWLY_SYNCED',
            items_processed: itemsProcessed
          });

        } catch (itemError) {
          syncResults.errors.push({
            return_id: purchaseReturn.id,
            no_return: purchaseReturn.no_return,
            error: itemError.message
          });
        }
      }

      await transaction.commit();

      console.log('✅ SYNC STOCK FROM PURCHASE RETURN COMPLETED');
      console.log(`📊 Already synced: ${syncResults.already_synced}`);
      console.log(`📊 Newly synced: ${syncResults.newly_synced}`);
      console.log(`📊 Skipped: ${syncResults.skipped}`);
      console.log(`📊 Errors: ${syncResults.errors.length}`);

      return res.json({
        status: 'success',
        message: 'Stock sync from purchase return completed',
        data: syncResults
      });

    } catch (error) {
      await transaction.rollback();
      console.error('❌ SYNC STOCK FROM PURCHASE RETURN ERROR:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  }
};

// Controller for t_penerimaan_gudang
//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_penerimaan_gudang
//
// Tambahkan custom function di bawah ini

export const t_penerimaan_gudangController = {
  // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
  async uploadImage(req, res) {
    const fileFields = Object.keys(req.models.t_penerimaan_gudang.rawAttributes).filter(
      key => req.models.t_penerimaan_gudang.rawAttributes[key].type && req.models.t_penerimaan_gudang.rawAttributes[key].type.key === 'STRING'
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
      const inserted = await req.models.t_penerimaan_gudang.create(data);
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
      const inserted = await req.models.t_penerimaan_gudang.bulkCreate(records);
      res.json({ message: 'Excel imported', data: inserted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Contoh: Custom function
  async customFunction(req, res) {
    res.json({ message: 'Custom function untuk t_penerimaan_gudang', body: req.body, query: req.query });
  },

  // =====================================================================
  // APPROVE (DINAMIS LEVEL + is_full + SYNC STOCK GUDANG)
  // =====================================================================
  async approve(req, res) {
    // Get sequelize instance for transaction
    const sequelize = req.models.t_penerimaan_gudang.sequelize;
    const transaction = await sequelize.transaction();

    try {
      console.log("🔥 START APPROVE PENERIMAAN GUDANG");
      console.log("📌 Request Body:", JSON.stringify(req.body, null, 2));

      const {
        penerimaan_gudang_id,
        penerimaan_gudang_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id,
        sender_id,
        m_approval_id
      } = req.body;

      // ------------------ VALIDASI DASAR ------------------
      if (
        !penerimaan_gudang_id ||
        !penerimaan_gudang_notifikasi_id ||
        approval_level === undefined ||
        !user_approved_id ||
        !m_approval_id
      ) {
        await transaction.rollback();
        return res.status(400).json({
          status: "error",
          message:
            "penerimaan_gudang_id, penerimaan_gudang_notifikasi_id, approval_level, user_approved_id, dan m_approval_id wajib diisi"
        });
      }

      const {
        t_penerimaan_gudang,
        t_penerimaan_gudang_d,
        t_penerimaan_gudang_notifikasi,
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
        await transaction.rollback();
        return res.status(400).json({
          status: "error",
          message: `Approval rule untuk level ${currentLevel} tidak ditemukan`
        });
      }

      const currentRule = approvalDetails[currentRuleIndex];
      const isFull = !!currentRule.is_full;

      // cari next rule (kalau ada)
      const nextRule = approvalDetails[currentRuleIndex + 1] || null;
      // Handle single-level approval (approvalDetails.length === 1)
      const isLastLevel = isFull || !nextRule || approvalDetails.length === 1;

      console.log(`🔍 Approval Debug: level=${currentLevel}, isFull=${isFull}, isLastLevel=${isLastLevel}`);

      // ------------------ GET OLD NOTIFICATION ------------------
      const oldNotif = await t_penerimaan_gudang_notifikasi.findOne({
        where: { id: penerimaan_gudang_notifikasi_id },
        transaction
      });

      if (!oldNotif) {
        await transaction.rollback();
        return res.status(404).json({
          status: "error",
          message: "Notification not found"
        });
      }

      const oldSenderId = oldNotif.sender_id;

      // ------------------ GET PENERIMAAN GUDANG DATA WITH DETAILS ------------------
      const penerimaanGudang = await t_penerimaan_gudang.findOne({
        where: { id: penerimaan_gudang_id },
        include: [
          {
            model: t_penerimaan_gudang_d,
            as: 't_penerimaan_gudang_ds',
            required: false
          }
        ],
        transaction
      });

      if (!penerimaanGudang) {
        await transaction.rollback();
        return res.status(404).json({
          status: "error",
          message: "Penerimaan Gudang not found"
        });
      }

      console.log("✅ Penerimaan Gudang found:", penerimaanGudang.no_penerimaan_gudang);
      console.log("📦 Gudang Terima ID:", penerimaanGudang.warehouse_terima_id);
      console.log("📋 Details count:", penerimaanGudang.t_penerimaan_gudang_ds?.length || 0);

      // ------------------ UPDATE STATUS T_PENERIMAAN_GUDANG ------------------
      const newStatus = isLastLevel ? "APPROVED" : "IN APPROVAL";

      await t_penerimaan_gudang.update(
        {
          status: newStatus,
          updated_by: user_approved_id
        },
        { where: { id: penerimaan_gudang_id }, transaction }
      );

      console.log(`✅ Status updated to: ${newStatus}`);

      // ------------------ UPDATE NOTIF DENGAN user_approved_id ------------------
      await t_penerimaan_gudang_notifikasi.update(
        {
          status: true,
          user_approved_id: user_approved_id,
          approval_catatan: approval_catatan || null,
          status_name: "APPROVED"
        },
        { where: { id: penerimaan_gudang_notifikasi_id }, transaction }
      );

      // ------------------ BUAT NOTIF LEVEL BERIKUTNYA (JIKA ADA) ------------------
      if (!isLastLevel && nextRule) {
        await t_penerimaan_gudang_notifikasi.create({
          title: "Approval Penerimaan Gudang",
          approval_message: "Waiting for next approval",
          approval_catatan: "",
          t_penerimaan_gudang_id: penerimaan_gudang_id,
          sender_id: user_approved_id,
          approval_level: Number(nextRule.level),
          status: false,
          status_name: "IN APPROVAL",
          user_approved_id: null
        }, { transaction });
      }

      // ------------------ SYNC STOCK GUDANG (HANYA JIKA LAST LEVEL / APPROVED) ------------------
      let stockSyncResult = null;
      if (isLastLevel) {
        console.log("🔄 LAST LEVEL - Processing stock sync to gudang penerimaan...");

        const gudangTerimaId = penerimaanGudang.warehouse_terima_id;

        if (!gudangTerimaId) {
          await transaction.rollback();
          return res.status(400).json({
            status: "error",
            message: "warehouse_terima_id tidak ditemukan di Penerimaan Gudang"
          });
        }

        const details = penerimaanGudang.t_penerimaan_gudang_ds || [];
        
        if (details.length === 0) {
          console.log("⚠️ No details found, skipping stock sync");
        } else {
          stockSyncResult = {
            gudang_terima_id: gudangTerimaId,
            items_processed: 0,
            stock_entries: []
          };

          for (const detail of details) {
            const itemId = detail.m_items_id;
            const qtyDiterima = Number(detail.qty_diterima || 0);

            if (!itemId || qtyDiterima <= 0) {
              console.log(`⚠️ Skip detail ${detail.id}: no item or qty_diterima <= 0`);
              continue;
            }

            console.log(`📦 Processing item ${itemId}, qty_diterima: ${qtyDiterima}`);

            // Find or create stock_gudang untuk gudang penerimaan
            let stockGudangRecord = await stock_gudang.findOne({
              where: {
                m_gudang_id: gudangTerimaId,
                m_items_id: itemId
              },
              transaction
            });

            if (!stockGudangRecord) {
              stockGudangRecord = await stock_gudang.create({
                m_gudang_id: gudangTerimaId,
                m_items_id: itemId,
                free_stock: 0
              }, { transaction });
              console.log(`✅ Created new stock_gudang for item ${itemId}`);
            }

            // Create stock_gudang_d entry - STOCK MASUK (penerimaan)
            await stock_gudang_d.create({
              stock_gudang_id: stockGudangRecord.id,
              t_penerimaan_gudang_id: penerimaan_gudang_id,
              m_items_id: itemId,
              stock_masuk: qtyDiterima,
              stock_keluar: 0
            }, { transaction });

            console.log(`✅ Created stock_gudang_d: stock_masuk=${qtyDiterima}`);

            // Recalculate free_stock
            const totalMasuk = await stock_gudang_d.sum('stock_masuk', {
              where: { stock_gudang_id: stockGudangRecord.id },
              transaction
            }) || 0;

            const totalKeluar = await stock_gudang_d.sum('stock_keluar', {
              where: { stock_gudang_id: stockGudangRecord.id },
              transaction
            }) || 0;

            const newFreeStock = totalMasuk - totalKeluar;

            await stockGudangRecord.update({
              free_stock: newFreeStock
            }, { transaction });

            console.log(`✅ Updated free_stock: ${newFreeStock} (masuk: ${totalMasuk}, keluar: ${totalKeluar})`);

            stockSyncResult.items_processed++;
            stockSyncResult.stock_entries.push({
              item_id: itemId,
              qty_diterima: qtyDiterima,
              new_free_stock: newFreeStock
            });
          }

          console.log(`🎉 Stock sync completed: ${stockSyncResult.items_processed} items processed`);
        }
      }

      await transaction.commit();

      console.log("🎉 APPROVE PENERIMAAN GUDANG SUCCESS");

      return res.json({
        status: "success",
        message: isLastLevel 
          ? "Penerimaan Gudang APPROVED dan stock berhasil ditambahkan ke gudang penerimaan"
          : "Penerimaan Gudang APPROVED, menunggu approval level berikutnya",
        data: {
          penerimaan_gudang_id,
          new_status: newStatus,
          is_last_level: isLastLevel,
          next_level: nextRule ? Number(nextRule.level) : null,
          stock_sync: stockSyncResult
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error("❌ APPROVE PENERIMAAN GUDANG ERROR:", error);
      return res.status(500).json({ status: "error", message: error.message });
    }
  },

  // =====================================================================
  // REJECT (TIDAK PAKAI RULE, LANGSUNG FINAL)
  // =====================================================================
  async reject(req, res) {
    try {
      const {
        penerimaan_gudang_id,
        penerimaan_gudang_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id
      } = req.body;

      if (
        !penerimaan_gudang_id ||
        !penerimaan_gudang_notifikasi_id ||
        approval_level === undefined ||
        !user_approved_id
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "penerimaan_gudang_id, penerimaan_gudang_notifikasi_id, approval_level, dan user_approved_id wajib diisi"
        });
      }

      const {
        t_penerimaan_gudang,
        t_penerimaan_gudang_notifikasi
      } = req.models;

      const oldNotif = await t_penerimaan_gudang_notifikasi.findOne({
        where: { id: penerimaan_gudang_notifikasi_id }
      });

      if (!oldNotif) {
        return res.status(404).json({
          status: "error",
          message: "Notification not found"
        });
      }

      // UPDATE PENERIMAAN GUDANG → REJECT
      await t_penerimaan_gudang.update(
        {
          status: "REJECT",
          updated_by: user_approved_id
        },
        { where: { id: penerimaan_gudang_id } }
      );

      // ------------------ UPDATE NOTIF DENGAN KEPUTUSAN REJECT ------------------
      await t_penerimaan_gudang_notifikasi.update(
        {
          status: true,
          user_approved_id: user_approved_id,
          approval_catatan: approval_catatan || null,
          status_name: "REJECT"
        },
        { where: { id: penerimaan_gudang_notifikasi_id } }
      );

      return res.json({
        status: "success",
        message: "Penerimaan Gudang REJECTED",
        data: {
          penerimaan_gudang_id,
          new_status: "REJECT"
        }
      });

    } catch (error) {
      console.error("REJECT ERROR:", error);
      return res.status(500).json({ status: "error", message: error.message });
    }
  },

  // =====================================================================
  // REVISI (CREATE RECORD BARU UNTUK KEPUTUSAN ATASAN)
  // =====================================================================
  async revisi(req, res) {
    try {
      const {
        penerimaan_gudang_id,
        penerimaan_gudang_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id
      } = req.body;

      if (
        !penerimaan_gudang_id ||
        !penerimaan_gudang_notifikasi_id ||
        approval_level === undefined ||
        !user_approved_id
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "penerimaan_gudang_id, penerimaan_gudang_notifikasi_id, approval_level, dan user_approved_id wajib diisi"
        });
      }

      const {
        t_penerimaan_gudang,
        t_penerimaan_gudang_notifikasi
      } = req.models;

      const oldNotif = await t_penerimaan_gudang_notifikasi.findOne({
        where: { id: penerimaan_gudang_notifikasi_id }
      });

      if (!oldNotif) {
        return res.status(404).json({
          status: "error",
          message: "Notification not found"
        });
      }

      // ============================
      // UPDATE PENERIMAAN GUDANG → REVISI
      // ============================
      await t_penerimaan_gudang.update(
        {
          status: "REVISI",
          updated_by: user_approved_id
        },
        { where: { id: penerimaan_gudang_id } }
      );

      // ============================
      // UPDATE NOTIF DENGAN KEPUTUSAN REVISI
      // ============================
      await t_penerimaan_gudang_notifikasi.update(
        {
          status: true,
          user_approved_id: user_approved_id,
          approval_catatan: approval_catatan || null,
          status_name: "REVISI"
        },
        { where: { id: penerimaan_gudang_notifikasi_id } }
      );

      // ============================
      // CREATE RECORD BARU UNTUK NOTIFIKASI REVISI KE PENGAJU
      // ============================
      await t_penerimaan_gudang_notifikasi.create({
        title: "Revisi Penerimaan Gudang",
        approval_message: "Penerimaan Gudang membutuhkan revisi",
        approval_catatan: approval_catatan || null,
        t_penerimaan_gudang_id: penerimaan_gudang_id,
        sender_id: oldNotif.sender_id,       // pengaju awal (supaya muncul di notif dia)
        approval_level: approval_level,       // level atasan yang revisi
        status: false,                        // ✅ FALSE = belum diproses, muncul di notif pengaju
        status_name: "WAITING REVISE",
        user_approved_id: null                // belum diproses oleh pengaju
      });

      return res.json({
        status: "success",
        message: "Penerimaan Gudang REVISED",
        update_status_to: "REVISI",
        data: {
          penerimaan_gudang_id,
          new_status: "REVISI"
        }
      });

    } catch (error) {
      console.error("REVISI ERROR:", error);
      return res.status(500).json({ status: "error", message: error.message });
    }
  },

  // =====================================================================
  // DATA GUDANG - Get detail penerimaan gudang dengan flat structure
  // URL: /api/fn/t_penerimaan_gudang/data_gudang?id=ROW_ID
  // =====================================================================
  async data_gudang(req, res) {
    try {
      const id = req.query.id || req.params.id;

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "ID penerimaan gudang wajib diisi"
        });
      }

      const {
        t_penerimaan_gudang,
        t_penerimaan_gudang_d,
        t_sj_gudang,
        t_sj_gudang_d,
        t_transfer_gudang_d,
        m_items,
        m_unit_bisnis,
        m_kary,
        m_gudang,
        m_general
      } = req.models;

      // Fetch main data dengan relations
      const penerimaanGudang = await t_penerimaan_gudang.findOne({
        where: { id },
        include: [
          {
            model: m_unit_bisnis,
            as: 'm_unit_bisni',
            attributes: ['id', 'nama_comp']
          },
          {
            model: m_kary,
            as: 'pic_penerima_gudang',
            attributes: ['id', 'nama_kary']
          },
          {
            model: t_sj_gudang,
            as: 'surat_jalan_gudang',
            attributes: ['id', 'no_sj_gudang'],
            include: [
              {
                model: m_gudang,
                as: 'gudang_sj_tujuan',
                attributes: ['id', 'nama_gudang']
              }
            ]
          },
          {
            model: t_penerimaan_gudang_d,
            as: 't_penerimaan_gudang_ds',
            include: [
              {
                model: t_sj_gudang_d,
                as: 'detail_sj',
                attributes: ['id', 't_sj_gudang_id', 't_transfer_gudang_d_id', 'qty_sj_gudang'],
                include: [
                  {
                    model: t_transfer_gudang_d,
                    as: 'transfer_gudang_d',
                    attributes: ['id', 'm_items_id', 'qty'],
                    include: [
                      {
                        model: m_items,
                        as: 'm_item',
                        attributes: ['id', 'kode_item', 'nama_item', 'satuan_id'],
                        include: [
                          {
                            model: m_general,
                            as: 'uom',
                            attributes: ['id', 'value1']
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      });

      if (!penerimaanGudang) {
        return res.status(404).json({
          status: "error",
          message: "Data penerimaan gudang tidak ditemukan"
        });
      }

      // Convert to plain object
      const data = penerimaanGudang.toJSON();

      // Transform detail array - flatten structure
      if (data.t_penerimaan_gudang_ds && Array.isArray(data.t_penerimaan_gudang_ds)) {
        data.t_penerimaan_gudang_ds = data.t_penerimaan_gudang_ds.map(detail => {
          // Extract data dari nested relations
          const kode_item = detail.detail_sj?.transfer_gudang_d?.m_item?.kode_item || '';
          const nama_item = detail.detail_sj?.transfer_gudang_d?.m_item?.nama_item || '';
          const uom_item = detail.detail_sj?.transfer_gudang_d?.m_item?.uom?.value1 || '';
          const qty_sj = detail.detail_sj?.qty_sj_gudang || 0;

          // Return flat structure
          return {
            id: detail.id,
            t_penerimaan_gudang_id: detail.t_penerimaan_gudang_id,
            t_sj_gudang_d_id: detail.t_sj_gudang_d_id,
            kode_item,
            nama_item,
            uom_item,
            qty_sj,
            qty_diterima: detail.qty_diterima,
            qty_sisa: detail.qty_sisa,
            catatan: detail.catatan,
            createdAt: detail.createdAt,
            updatedAt: detail.updatedAt
          };
        });
      }

      return res.json({
        status: "success",
        data
      });

    } catch (error) {
      console.error("GET DATA GUDANG ERROR:", error);
      return res.status(500).json({
        status: "error",
        message: error.message
      });
    }
  },

  // =====================================================================
  // SYNC STOCK DARI PENERIMAAN GUDANG YANG SUDAH APPROVED
  // Untuk memperbaiki data Penerimaan Gudang yang APPROVED tapi belum punya stock_gudang_d
  // URL: /api/fn/t_penerimaan_gudang/syncStockFromPenerimaanGudang
  // =====================================================================
  async syncStockFromPenerimaanGudang(req, res) {
    const sequelize = req.models.t_penerimaan_gudang.sequelize;
    const transaction = await sequelize.transaction();

    try {
      console.log('🔥 START SYNC STOCK FROM PENERIMAAN GUDANG');

      const {
        t_penerimaan_gudang,
        t_penerimaan_gudang_d,
        stock_gudang,
        stock_gudang_d
      } = req.models;

      // 1. Get all Penerimaan Gudang with status APPROVED
      const allPgApproved = await t_penerimaan_gudang.findAll({
        where: { status: 'APPROVED' },
        include: [
          {
            model: t_penerimaan_gudang_d,
            as: 't_penerimaan_gudang_ds',
            required: false
          }
        ],
        transaction
      });

      console.log(`📋 Found ${allPgApproved.length} Penerimaan Gudang with APPROVED status`);

      const syncResults = {
        total_pg: allPgApproved.length,
        already_synced: 0,
        newly_synced: 0,
        skipped: 0,
        errors: [],
        details: []
      };

      for (const pg of allPgApproved) {
        try {
          // Check if this PG already has stock_gudang_d entries
          const existingStockD = await stock_gudang_d.findOne({
            where: { t_penerimaan_gudang_id: pg.id },
            transaction
          });

          if (existingStockD) {
            syncResults.already_synced++;
            syncResults.details.push({
              pg_id: pg.id,
              no_penerimaan_gudang: pg.no_penerimaan_gudang,
              status: 'ALREADY_SYNCED'
            });
            continue;
          }

          // Get gudang terima
          const gudangTerimaId = pg.warehouse_terima_id;
          if (!gudangTerimaId) {
            syncResults.skipped++;
            syncResults.details.push({
              pg_id: pg.id,
              no_penerimaan_gudang: pg.no_penerimaan_gudang,
              status: 'SKIPPED',
              reason: 'No warehouse_terima_id found'
            });
            continue;
          }

          // Get details
          const details = pg.t_penerimaan_gudang_ds || [];

          if (details.length === 0) {
            syncResults.skipped++;
            syncResults.details.push({
              pg_id: pg.id,
              no_penerimaan_gudang: pg.no_penerimaan_gudang,
              status: 'SKIPPED',
              reason: 'No items found'
            });
            continue;
          }

          // Process each item
          let itemsProcessed = 0;
          for (const detail of details) {
            const itemId = detail.m_items_id;
            const qtyDiterima = Number(detail.qty_diterima || 0);

            if (!itemId || qtyDiterima <= 0) continue;

            // Find or create stock_gudang
            let stockGudangRecord = await stock_gudang.findOne({
              where: {
                m_gudang_id: gudangTerimaId,
                m_items_id: itemId
              },
              transaction
            });

            if (!stockGudangRecord) {
              stockGudangRecord = await stock_gudang.create({
                m_gudang_id: gudangTerimaId,
                m_items_id: itemId,
                free_stock: 0
              }, { transaction });
            }

            // Create stock_gudang_d entry - STOCK MASUK (penerimaan)
            await stock_gudang_d.create({
              stock_gudang_id: stockGudangRecord.id,
              t_penerimaan_gudang_id: pg.id,
              m_items_id: itemId,
              stock_masuk: qtyDiterima,
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
            pg_id: pg.id,
            no_penerimaan_gudang: pg.no_penerimaan_gudang,
            status: 'NEWLY_SYNCED',
            items_processed: itemsProcessed,
            gudang_terima_id: gudangTerimaId
          });

        } catch (itemError) {
          syncResults.errors.push({
            pg_id: pg.id,
            no_penerimaan_gudang: pg.no_penerimaan_gudang,
            error: itemError.message
          });
        }
      }

      await transaction.commit();

      console.log('✅ SYNC STOCK FROM PENERIMAAN GUDANG COMPLETED');
      console.log(`📊 Already synced: ${syncResults.already_synced}`);
      console.log(`📊 Newly synced: ${syncResults.newly_synced}`);
      console.log(`📊 Skipped: ${syncResults.skipped}`);
      console.log(`📊 Errors: ${syncResults.errors.length}`);

      return res.json({
        status: 'success',
        message: 'Stock sync from Penerimaan Gudang completed',
        data: syncResults
      });

    } catch (error) {
      await transaction.rollback();
      console.error('❌ SYNC STOCK FROM PENERIMAAN GUDANG ERROR:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  }
};

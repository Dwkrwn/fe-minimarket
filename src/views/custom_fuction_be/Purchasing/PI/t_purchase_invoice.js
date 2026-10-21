// Controller for t_purchase_invoice
import { Op } from 'sequelize';

//
// Cara penggunaan req di custom function:
// - req.body         : data dari body request (JSON/form)
// - req.query        : data dari query string (?param=value)
// - req.files        : file upload (jika ada, via upload middleware)
//      - Untuk upload foto/gambar, akses req.files.find(f => f.mimetype.startsWith('image/'))
//      - Tidak harus fieldname 'image', yang penting mimetype-nya image/*
//      - Contoh properti file: { fieldname, originalname, mimetype, buffer/path, size }
// - req.excelData    : hasil parsing file Excel (jika upload Excel, via excelImport middleware)
// - req.models       : seluruh model Sequelize (via attachModels middleware), contoh: req.models.t_purchase_invoice
//
// Tambahkan custom function di bawah ini

export const t_purchase_invoiceController = {
  // Upload file dinamis: field file upload boleh apa saja, otomatis simpan path relatif ke field STRING di model
  async uploadImage(req, res) {
    const fileFields = Object.keys(req.models.t_purchase_invoice.rawAttributes).filter(
      key => req.models.t_purchase_invoice.rawAttributes[key].type && req.models.t_purchase_invoice.rawAttributes[key].type.key === 'STRING'
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
      const inserted = await req.models.t_purchase_invoice.create(data);
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
      const inserted = await req.models.t_purchase_invoice.bulkCreate(records);
      res.json({ message: 'Excel imported', data: inserted });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Contoh: Custom function
  async customFunction(req, res) {
    res.json({ message: 'Custom function untuk t_purchase_invoice', body: req.body, query: req.query });
  },

  // =====================================================================
  // PI GET DETAIL PO - Cek PO terhubung ke Penerimaan Barang mana saja
  // =====================================================================
  async PiGetDetailPo(req, res) {
    try {
      const { id } = req.query;

      const {
        t_purchase_invoice,
        t_purchase_order,
        t_penerimaan_barangs,
        t_penerimaan_barang_d,
        m_supplier,
        m_gudang
      } = req.models;

      // Jika ada ID, ambil data spesifik
      if (id) {
        // Ambil PI untuk mendapatkan PO ID
        const pi = await t_purchase_invoice.findOne({
          where: { id },
          attributes: ['id', 'no_pi', 't_purchase_order_id']
        });

        if (!pi) {
          return res.status(404).json({
            status: "error",
            message: "Purchase Invoice tidak ditemukan"
          });
        }

        if (!pi.t_purchase_order_id) {
          return res.status(404).json({
            status: "error",
            message: "PI tidak terhubung dengan PO"
          });
        }

        // Ambil PO details
        const po = await t_purchase_order.findOne({
          where: { id: pi.t_purchase_order_id },
          attributes: ['id', 'no_po', 'tgl_po']
        });

        if (!po) {
          return res.status(404).json({
            status: "error",
            message: "Purchase Order tidak ditemukan"
          });
        }

        // Cari penerimaan barang lewat detail karena t_penerimaan_barangs tidak punya t_purchase_order_id langsung
        const penerimaanDetails = await t_penerimaan_barang_d.findAll({
          where: { t_purchase_order_id: pi.t_purchase_order_id },
          attributes: ['t_penerimaan_barangs_id'],
          group: ['t_penerimaan_barangs_id']
        });

        const penerimaanIds = penerimaanDetails.map(pd => pd.t_penerimaan_barangs_id).filter(Boolean);

        const penerimaanList = await t_penerimaan_barangs.findAll({
          where: { id: penerimaanIds },
          include: [
            {
              model: m_supplier,
              attributes: ['id', 'kode_supplier', 'nama_supp']
            },
            {
              model: m_gudang,
              attributes: ['id', 'kode_gudang', 'nama_gudang']
            }
          ],
          order: [['createdAt', 'ASC']]
        });

        // Format response
        const detail = penerimaanList.map((pb, index) => ({
          no: index + 1,
          id: pb.id,
          no_penerimaan: pb.no_penerimaan,
          tgl_penerimaan: pb.tgl_penerimaan,
          no_sj_supp: pb.no_sj_supp,
          no_inv_supp: pb.no_inv_supp,
          status: pb.status,
          supplier: pb.m_supplier ? {
            id: pb.m_supplier.id,
            kode: pb.m_supplier.kode_supplier,
            nama: pb.m_supplier.nama_supp
          } : null,
          gudang: pb.m_gudang ? {
            id: pb.m_gudang.id,
            kode: pb.m_gudang.kode_gudang,
            nama: pb.m_gudang.nama_gudang
          } : null,
          catatan: pb.catatan
        }));

        return res.json({
          status: "success",
          message: "Data penerimaan barang dari PO berhasil diambil",
          data: {
            id_pi: pi.id,
            no_pi: pi.no_pi,
            id_po: po.id,
            no_po: po.no_po,
            tgl_po: po.tgl_po,
            total_penerimaan: detail.length,
            detail: detail
          }
        });
      }

      // Jika tidak ada ID, ambil semua PI dengan PO dan Penerimaan
      const allPi = await t_purchase_invoice.findAll({
        attributes: ['id', 'no_pi', 't_purchase_order_id'],
        include: [
          {
            model: t_purchase_order,
            attributes: ['id', 'no_po', 'tgl_po']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      const result = [];

      for (const pi of allPi) {
        const po = pi.t_purchase_order;
        
        if (!po || !po.id) {
          result.push({
            id_pi: pi.id,
            no_pi: pi.no_pi,
            id_po: null,
            no_po: null,
            tgl_po: null,
            total_penerimaan: 0,
            detail: []
          });
          continue;
        }

        // Ambil penerimaan barang untuk PO ini lewat detail
        const penerimaanDetails = await t_penerimaan_barang_d.findAll({
          where: { t_purchase_order_id: po.id },
          attributes: ['t_penerimaan_barangs_id'],
          group: ['t_penerimaan_barangs_id']
        });

        const penerimaanIds = penerimaanDetails.map(pd => pd.t_penerimaan_barangs_id).filter(Boolean);

        const penerimaanList = await t_penerimaan_barangs.findAll({
          where: { id: penerimaanIds },
          include: [
            {
              model: m_supplier,
              attributes: ['id', 'kode_supplier', 'nama_supp']
            },
            {
              model: m_gudang,
              attributes: ['id', 'kode_gudang', 'nama_gudang']
            }
          ],
          order: [['createdAt', 'ASC']]
        });

        const detail = penerimaanList.map((pb, index) => ({
          no: index + 1,
          id: pb.id,
          no_penerimaan: pb.no_penerimaan,
          tgl_penerimaan: pb.tgl_penerimaan,
          no_sj_supp: pb.no_sj_supp,
          no_inv_supp: pb.no_inv_supp,
          status: pb.status,
          supplier: pb.m_supplier ? {
            id: pb.m_supplier.id,
            kode: pb.m_supplier.kode_supplier,
            nama: pb.m_supplier.nama_supp
          } : null,
          gudang: pb.m_gudang ? {
            id: pb.m_gudang.id,
            kode: pb.m_gudang.kode_gudang,
            nama: pb.m_gudang.nama_gudang
          } : null,
          catatan: pb.catatan
        }));

        result.push({
          id_pi: pi.id,
          no_pi: pi.no_pi,
          id_po: po.id,
          no_po: po.no_po,
          tgl_po: po.tgl_po,
          total_penerimaan: detail.length,
          detail: detail
        });
      }

      return res.json({
        status: "success",
        message: "Data semua PI dengan penerimaan barang berhasil diambil",
        total: result.length,
        data: result
      });

    } catch (err) {
      return res.status(500).json({
        status: "error",
        message: err.message
      });
    }
  },

  // =====================================================================
  // GET COMPLETE - Get PI dengan semua relasi
  // =====================================================================
  async getComplete(req, res) {
    try {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Parameter id PI tidak ditemukan"
        });
      }

      const {
        t_purchase_invoice,
        t_purchase_invoice_d,
        t_purchase_order,
        t_purchase_order_d,
        t_penerimaan_barang,
        t_penerimaan_barang_d,
        m_items,
        m_general,
        m_supplier,
        m_currency,
        m_currency_d,
        m_unit_bisnis,
        user_default,
        money
      } = req.models;

      const data = await t_purchase_invoice.findOne({
        where: { id },
        include: [
          { model: m_supplier },
          { model: m_general, as: "pph_pi" },
          { model: m_general, as: "ppn_pi" },
          {
            model: m_currency,
            include: [
              {
                model: money,
                attributes: ["id", "group", "key1", "code", "value1", "value2", "value3", "value4", "value5", "is_active"]
              }
            ]
          },
          { model: m_currency_d },
          { model: user_default, as: "pi_ctr" },
          { model: user_default, as: "pi_updt" },
          { model: m_unit_bisnis },
          {
            model: t_purchase_order,
            include: [
              { model: m_general, as: "top_po" },
              { model: m_general, as: "pph_po" },
              { model: m_general, as: "ppn_po" },
              { model: m_currency, as: "uang_po" },
              { model: m_currency_d, as: "det_uang_po" }
            ]
          },
          { model: t_penerimaan_barang },
          {
            model: t_purchase_invoice_d,
            include: [
              {
                model: t_purchase_order_d,
                include: [{ model: m_items, as: "m_item", include: [{ model: m_general, as: "uom" }] }]
              },
              { model: t_penerimaan_barang_d }
            ]
          }
        ]
      });

      if (!data) {
        return res.status(404).json({
          status: "error",
          message: "Purchase invoice tidak ditemukan"
        });
      }

      const raw = data.toJSON();

      // Flatten t_purchase_invoice_ds
      raw.t_purchase_invoice_ds = raw.t_purchase_invoice_ds?.map(pid => {
        const pod = pid.t_purchase_order_d;
        const pbd = pid.t_penerimaan_barang_d;
        const item = pod?.m_item;

        return {
          id: pid.id,
          t_purchase_invoice_id: pid.t_purchase_invoice_id,
          t_purchase_order_d_id: pid.t_purchase_order_d_id,
          t_penerimaan_barang_id: pid.t_penerimaan_barang_id,
          t_penerimaan_barang_d_id: pid.t_penerimaan_barang_d_id,
          m_items_id: pid.m_items_id,

          // Data dari PO Detail
          qty_po: pod?.qty_po || 0,
          harga: pod?.harga || 0,
          disc_1: pod?.disc_1 || 0,
          disc_2: pod?.disc_2 || 0,
          amt_disc: pod?.amt_disc || 0,

          // Data dari Penerimaan Barang Detail
          qty_diterima: pbd?.qty_diterima || 0,

          // Data dari Item
          kode_item: item?.kode_item || null,
          nama_item: item?.nama_item || null,
          uom: item?.uom?.value1 || null,

          catatan: pid.catatan,
          createdAt: pid.createdAt,
          updatedAt: pid.updatedAt
        };
      });

      return res.json({
        status: "success",
        message: "Data purchase invoice lengkap",
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
  // APPROVE (DINAMIS LEVEL + is_full)
  // =====================================================================
  async approve(req, res) {
    // Get sequelize instance for transaction
    const sequelize = req.models.t_purchase_invoice.sequelize;
    const transaction = await sequelize.transaction();
    
    try {
      const {
        purchase_invoice_id,
        purchase_invoice_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id,
        sender_id,
        m_approval_id
      } = req.body;

      // ------------------ VALIDASI DASAR ------------------
      if (
        !purchase_invoice_id ||
        !purchase_invoice_notifikasi_id ||
        approval_level === undefined ||
        !user_approved_id ||
        !m_approval_id
      ) {
        await transaction.rollback();
        return res.status(400).json({
          status: "error",
          message: "purchase_invoice_id, purchase_invoice_notifikasi_id, approval_level, user_approved_id, dan m_approval_id wajib diisi"
        });
      }

      const {
        t_purchase_invoice,
        t_purchase_invoice_notifikasi,
        m_approval_d
      } = req.models;

      // ------------------ AMBIL RULE APPROVAL (GLOBAL - TIDAK FILTER BY UNIT BISNIS) ------------------
      // User dengan role MENYETUJUI bisa approve dari unit bisnis mana saja
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
      // ✅ FIX: Handle single-level approval (approvalDetails.length === 1)
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
      const oldNotif = await t_purchase_invoice_notifikasi.findOne({
        where: {
          id: purchase_invoice_notifikasi_id
        },
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

      // ------------------ UPDATE STATUS T_PI ------------------
      const newStatus = isLastLevel ? "APPROVED" : "IN APPROVAL";

      // 🔍 DEBUG: Cek status SEBELUM update
      const piInstance = await t_purchase_invoice.findByPk(purchase_invoice_id, { transaction });
      if (!piInstance) {
        throw new Error(`Purchase Invoice tidak ditemukan. PI ID: ${purchase_invoice_id}`);
      }
      
      const statusBefore = piInstance.status;
      console.log(`🔍 BEFORE UPDATE - PI ID: ${purchase_invoice_id}, Status: ${statusBefore}`);

      // ✅ UPDATE MENGGUNAKAN INSTANCE.SAVE() - BUKAN Model.update()
      // Model.update() adalah bulk update yang mungkin tidak bekerja dengan transaction dengan benar
      piInstance.status = newStatus;
      piInstance.updated_by = user_approved_id;
      await piInstance.save({ transaction });

      console.log(`🔍 AFTER SAVE - PI ID: ${purchase_invoice_id}, Status: ${piInstance.status}`);

      // ✅ VERIFIKASI: Cek ulang dari database langsung (raw query)
      const [verifyResult] = await sequelize.query(
        `SELECT id, status FROM t_purchase_invoice WHERE id = :id`,
        {
          replacements: { id: purchase_invoice_id },
          type: sequelize.QueryTypes.SELECT,
          transaction
        }
      );
      
      console.log(`🔍 VERIFY (RAW SQL) - PI ID: ${purchase_invoice_id}, Status: ${verifyResult ? verifyResult.status : 'NOT FOUND'}`);
      
      if (!verifyResult || verifyResult.status !== newStatus) {
        throw new Error(`ANOMALI: Status PI tidak berubah di database! Expected: ${newStatus}, Got: ${verifyResult ? verifyResult.status : 'NULL'}. PI ID: ${purchase_invoice_id}`);
      }

      // Tambahkan ke debugInfo
      debugInfo.update_debug = {
        status_before: statusBefore,
        status_after_save: piInstance.status,
        status_verify_raw: verifyResult.status,
        expected_status: newStatus
      };

      console.log(`✅ Berhasil update Purchase Invoice status menjadi ${newStatus}: ${purchase_invoice_id}`);

      // ------------------ CLOSE NOTIF LAMA (JANGAN UBAH status_name) ------------------
      await t_purchase_invoice_notifikasi.update({
        status: true // hanya tandai sudah diproses
      }, {
        where: {
          id: purchase_invoice_notifikasi_id
        },
        transaction
      });

      // ------------------ CREATE RECORD BARU UNTUK KEPUTUSAN APPROVED ------------------
      await t_purchase_invoice_notifikasi.create({
        title: "Approved Purchase Invoice",
        approval_message: isLastLevel ? "PI telah disetujui" : "Approved, lanjut ke level berikutnya",
        approval_catatan: approval_catatan || null,
        t_purchase_invoice_id: purchase_invoice_id,
        sender_id: oldSenderId,
        approval_level: currentLevel,
        status: true,
        status_name: "APPROVED",
        user_approved_id: user_approved_id
      }, { transaction });

      // ------------------ BUAT NOTIF LEVEL BERIKUTNYA (JIKA ADA) ------------------
      if (!isLastLevel && nextRule) {
        await t_purchase_invoice_notifikasi.create({
          title: "Approval Purchase Invoice",
          approval_message: "Waiting for next approval",
          approval_catatan: "",
          t_purchase_invoice_id: purchase_invoice_id,
          sender_id: user_approved_id,
          approval_level: Number(nextRule.level),
          status: false,
          status_name: "IN APPROVAL",
          user_approved_id: null
        }, { transaction });
      }

      // ------------------ UPDATE PO STATUS_TRANSAKSI (JIKA LAST LEVEL) ------------------
      if (isLastLevel) {
        // Get PI details untuk ambil t_purchase_order_id
        // Kita sudah update status PI di atas (newStatus = "APPROVED" karena isLastLevel = true)
        const pi = await t_purchase_invoice.findByPk(purchase_invoice_id, {
          attributes: ['id', 't_purchase_order_id'],
          transaction
        });

        if (!pi) {
          throw new Error('PI tidak ditemukan setelah approval');
        }

        if (!pi.t_purchase_order_id) {
          throw new Error('PI tidak terhubung dengan Purchase Order');
        }

        const t_purchase_order = req.models.t_purchase_order;
        const t_penerimaan_barang_d = req.models.t_penerimaan_barang_d;
        const t_penerimaan_barangs = req.models.t_penerimaan_barangs;

        if (!t_purchase_order || !t_penerimaan_barang_d || !t_penerimaan_barangs) {
          throw new Error('Model tidak ditemukan di sistem');
        }

        // Validasi PO exists
        const poExists = await t_purchase_order.findByPk(pi.t_purchase_order_id, { transaction });
        if (!poExists) {
          throw new Error(`Purchase Order tidak ditemukan: ${pi.t_purchase_order_id}`);
        }

        // 1. Hitung total penerimaan barang untuk PO ini
        const penerimaanDetails = await t_penerimaan_barang_d.findAll({
          where: { t_purchase_order_id: pi.t_purchase_order_id },
          attributes: ['t_penerimaan_barangs_id'],
          group: ['t_penerimaan_barangs_id'],
          transaction
        });

        const totalPenerimaan = penerimaanDetails.length;

        if (totalPenerimaan === 0) {
          throw new Error('Tidak ada penerimaan barang untuk Purchase Order ini');
        }

        // 2. Hitung PI APPROVED yang sudah ada SEBELUM yang ini (exclude current)
        const otherApprovedPIs = await t_purchase_invoice.count({
          where: {
            t_purchase_order_id: pi.t_purchase_order_id,
            status: 'APPROVED',
            id: { [Op.ne]: purchase_invoice_id } // exclude current PI
          },
          transaction
        });

        // 3. Total PI APPROVED = yang lain + current PI (yang baru di-approve)
        const totalApprovedPIs = otherApprovedPIs + 1;

        console.log(`📊 PO Update Debug: Total Penerimaan=${totalPenerimaan}, Other Approved=${otherApprovedPIs}, Current=1, Total=${totalApprovedPIs}`);

        if (totalApprovedPIs > totalPenerimaan) {
          throw new Error(`ANOMALI: Jumlah PI APPROVED (${totalApprovedPIs}) melebihi total penerimaan (${totalPenerimaan})`);
        }

        // 4. Tentukan status_transaksi
        let newStatusTransaksi;
        if (totalPenerimaan === 1) {
          newStatusTransaksi = 'INVOICED';
        } else {
          newStatusTransaksi = `INVOICED ${totalApprovedPIs}/${totalPenerimaan}`;
        }

        // 5. Update PO
        const [poUpdatedRows] = await t_purchase_order.update(
          {
            status_transaksi: newStatusTransaksi,
            updated_by: user_approved_id
          },
          {
            where: {
              id: pi.t_purchase_order_id
            },
            transaction
          }
        );

        if (poUpdatedRows === 0) {
          throw new Error('Gagal update Purchase Order - tidak ada baris yang berubah');
        }

        // 6. Verifikasi perubahan
        const updatedPO = await t_purchase_order.findByPk(pi.t_purchase_order_id, { transaction });
        if (updatedPO.status_transaksi !== newStatusTransaksi) {
          throw new Error(`ANOMALI: Status transaksi tidak berubah. Expected: ${newStatusTransaksi}, Got: ${updatedPO.status_transaksi}`);
        }

        console.log(`✅ Berhasil update Purchase Order status_transaksi menjadi ${newStatusTransaksi}: ${pi.t_purchase_order_id}`);

        debugInfo.po_update = {
          po_id: pi.t_purchase_order_id,
          new_status_transaksi: newStatusTransaksi,
          total_penerimaan: totalPenerimaan,
          total_approved_pi: totalApprovedPIs
        };
      }

      // ✅ COMMIT TRANSACTION - Semua perubahan disimpan ke database
      await transaction.commit();
      console.log('✅ TRANSACTION COMMITTED SUCCESSFULLY');

      return res.json({
        status: "success",
        message: "Purchase Invoice APPROVED",
        data: {
          purchase_invoice_id,
          new_status: newStatus,
          is_last_level: isLastLevel,
          next_level: nextRule ? Number(nextRule.level) : null
        },
        debug: debugInfo // 🔍 Kirim debug info ke frontend
      });

    } catch (error) {
      // ❌ ROLLBACK TRANSACTION - Batalkan semua perubahan
      await transaction.rollback();
      console.error("APPROVE ERROR (ROLLBACK):", error);
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
        purchase_invoice_id,
        purchase_invoice_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id
      } = req.body;

      if (
        !purchase_invoice_id ||
        !purchase_invoice_notifikasi_id ||
        approval_level === undefined ||
        !user_approved_id
      ) {
        return res.status(400).json({
          status: "error",
          message: "purchase_invoice_id, purchase_invoice_notifikasi_id, approval_level, dan user_approved_id wajib diisi"
        });
      }

      const {
        t_purchase_invoice,
        t_purchase_invoice_notifikasi
      } = req.models;

      const oldNotif = await t_purchase_invoice_notifikasi.findOne({
        where: {
          id: purchase_invoice_notifikasi_id
        }
      });

      if (!oldNotif) {
        return res.status(404).json({
          status: "error",
          message: "Notification not found"
        });
      }

      // UPDATE PI → REJECT
      await t_purchase_invoice.update({
        status: "REJECT",
        updated_by: user_approved_id
      }, {
        where: {
          id: purchase_invoice_id
        }
      });

      // ------------------ CLOSE NOTIF LAMA (JANGAN UBAH status_name) ------------------
      await t_purchase_invoice_notifikasi.update({
        status: true // hanya tandai sudah diproses
      }, {
        where: {
          id: purchase_invoice_notifikasi_id
        }
      });

      // ------------------ CREATE RECORD BARU UNTUK KEPUTUSAN REJECT ------------------
      await t_purchase_invoice_notifikasi.create({
        title: "Rejected Purchase Invoice",
        approval_message: "PI ditolak",
        approval_catatan: approval_catatan || null,
        t_purchase_invoice_id: purchase_invoice_id,
        sender_id: oldNotif.sender_id,
        approval_level: approval_level,
        status: true,
        status_name: "REJECT",
        user_approved_id: user_approved_id
      });

      return res.json({
        status: "success",
        message: "Purchase Invoice REJECTED",
        data: {
          purchase_invoice_id,
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
        purchase_invoice_id,
        purchase_invoice_notifikasi_id,
        approval_level,
        approval_catatan,
        user_approved_id
      } = req.body;

      if (
        !purchase_invoice_id ||
        !purchase_invoice_notifikasi_id ||
        approval_level === undefined ||
        !user_approved_id
      ) {
        return res.status(400).json({
          status: "error",
          message: "purchase_invoice_id, purchase_invoice_notifikasi_id, approval_level, dan user_approved_id wajib diisi"
        });
      }

      const {
        t_purchase_invoice,
        t_purchase_invoice_notifikasi
      } = req.models;

      const oldNotif = await t_purchase_invoice_notifikasi.findOne({
        where: {
          id: purchase_invoice_notifikasi_id
        }
      });

      if (!oldNotif) {
        return res.status(404).json({
          status: "error",
          message: "Notification not found"
        });
      }

      // ============================
      // UPDATE PI → REVISI
      // ============================
      await t_purchase_invoice.update({
        status: "REVISI",
        updated_by: user_approved_id
      }, {
        where: {
          id: purchase_invoice_id
        }
      });

      // ============================
      // CLOSE NOTIF PENGAJU (SET status=true)
      // ============================
      await t_purchase_invoice_notifikasi.update({
        status: true
      }, {
        where: {
          id: purchase_invoice_notifikasi_id
        }
      });

      // ============================
      // CREATE RECORD BARU UNTUK NOTIFIKASI REVISI KE PENGAJU
      // ============================
      await t_purchase_invoice_notifikasi.create({
        title: "Revisi Purchase Invoice",
        approval_message: "PI membutuhkan revisi",
        approval_catatan: approval_catatan || null,
        t_purchase_invoice_id: purchase_invoice_id,
        sender_id: oldNotif.sender_id, // pengaju awal (supaya muncul di notif dia)
        approval_level: approval_level, // level atasan yang revisi
        status: false, // ✅ FALSE = belum diproses, muncul di notif pengaju
        status_name: "REVISI",
        user_approved_id: user_approved_id // atasan yang minta revisi
      });

      return res.json({
        status: "success",
        message: "Purchase Invoice REVISED",
        update_status_to: "REVISI",
        data: {
          purchase_invoice_id,
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

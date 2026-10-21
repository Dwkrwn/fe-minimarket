// Hooks for t_transfer_gudang model
import t_transfer_gudang from '../models/t_transfer_gudang.js';
import m_unit_bisnis from '../models/m_unit_bisnis.js';
import m_format_nomor from '../models/m_format_nomor.js';
import m_format_nomor_d from '../models/m_format_nomor_d.js';
import m_prefix from '../models/m_prefix.js';
import m_menu from '../models/m_menu.js';

export function registert_transfer_gudangHooks() {
  // beforeValidate
  t_transfer_gudang.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
  });

  // afterValidate
  t_transfer_gudang.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  t_transfer_gudang.addHook('beforeCreate', async (instance, options) => {
    try {
      if (!instance.no_tw) {

        // 1. Cari menu
        const menu = await m_menu.findOne({
          where: { path: '/inventory/transaksi/t_transfer_gudang' },
          transaction: options.transaction
        });

        if (!menu) {
          throw new Error('Menu /inventory/transaksi/t_transfer_gudang tidak ditemukan');
        }

        // 2. Cari format nomor
        let formatNomor = await m_format_nomor.findOne({
          where: {
            m_menu_id: menu.id,
            m_unit_bisnis_id: instance.m_unit_bisnis_id,
            is_active: true
          },
          include: [{
            model: m_format_nomor_d,
            as: 'm_format_nomor_ds',
            include: [{ model: m_prefix, as: 'm_prefix' }],
            separate: true,
            order: [['index', 'ASC']]
          }],
          transaction: options.transaction
        });

        // fallback unit bisnis NULL
        if (!formatNomor) {
          formatNomor = await m_format_nomor.findOne({
            where: {
              m_menu_id: menu.id,
              m_unit_bisnis_id: null,
              is_active: true
            },
            include: [{
              model: m_format_nomor_d,
              as: 'm_format_nomor_ds',
              include: [{ model: m_prefix, as: 'm_prefix' }],
              separate: true,
              order: [['index', 'ASC']]
            }],
            transaction: options.transaction
          });
        }

        if (!formatNomor?.m_format_nomor_ds?.length) {
          throw new Error('Format nomor Transfer Gudang belum disetting');
        }

        // 3. Ambil singkatan company
        let companyAbbr = '';
        if (instance.m_unit_bisnis_id) {
          const unit = await m_unit_bisnis.findByPk(
            instance.m_unit_bisnis_id,
            { transaction: options.transaction }
          );

          if (unit?.nama_comp) {
            const skip = [
              'PT', 'CV', 'UD', 'FIRMA',
              'KOPERASI', 'YAYASAN',
              'PERSEROAN', 'TERBATAS'
            ];

            companyAbbr = unit.nama_comp
              .toUpperCase()
              .split(' ')
              .filter(w => !skip.includes(w))
              .map(w => w[0])
              .join('');
          }
        }

        // 4. Build prefix (PERSIS mentor)
        const today = new Date();
        let prefix = '';
        let hasSeq = false;
        let seqLength = 4;

        for (const d of formatNomor.m_format_nomor_ds) {
          const { tipe_prefix, value } = d.m_prefix;

          if (tipe_prefix === 'TEXT') {
            prefix += value;
          } else if (tipe_prefix === 'DAY') {
            prefix += String(today.getDate()).padStart(2, '0');
          } else if (tipe_prefix === 'MONTH') {
            prefix += String(today.getMonth() + 1).padStart(2, '0');
          } else if (tipe_prefix === 'YEAR') {
            prefix += today.getFullYear().toString().slice(-2);
          } else if (tipe_prefix === 'COMPANY_AUTO') {
            prefix += companyAbbr;
          } else if (tipe_prefix === 'SEQ') {
            hasSeq = true;
            seqLength = parseInt(value) || 4;
          }
        }

        // ⬅️ INI KUNCI YANG KAMU KELEWAT
        if (companyAbbr && hasSeq) {
          prefix += companyAbbr;
        }

        if (!hasSeq) {
          instance.no_tw = prefix;
          return;
        }

        // 5. Cari record terakhir
        const lastRecord = await t_transfer_gudang.findOne({
          where: {
            no_tw: {
              [t_transfer_gudang.sequelize.Sequelize.Op.like]: `${prefix}%`
            }
          },
          order: [['no_tw', 'DESC']],
          transaction: options.transaction
        });

        let seq = 1;
        if (lastRecord?.no_tw) {
          const num = lastRecord.no_tw.match(/(\d+)$/);
          if (num) {
            seq = parseInt(num[1], 10) + 1;
          }
        }

        // 6. Set no_tw
        instance.no_tw = `${prefix}${String(seq).padStart(seqLength, '0')}`;
      }

    } catch (err) {
      console.error('[beforeCreate t_transfer_gudang]', err);
      throw err;
    }
  });



  // afterCreate
  t_transfer_gudang.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  t_transfer_gudang.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  t_transfer_gudang.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
  });

  // beforeUpdate
  t_transfer_gudang.addHook('beforeUpdate', async (instance, options) => {
    try {
      // Regenerate no_tw jika kosong ATAU unit bisnis berubah
      if (!instance.no_tw || instance.changed('m_unit_bisnis_id')) {

        // 1. Cari menu
        const menu = await m_menu.findOne({
          where: { path: '/inventory/transaksi/t_transfer_gudang' },
          transaction: options.transaction
        });

        if (!menu) {
          throw new Error(
            'Menu not found for /inventory/transaksi/t_transfer_gudang. Please check menu path in m_menu table.'
          );
        }

        // 2. Cari format nomor (unit bisnis baru)
        let formatNomor = await m_format_nomor.findOne({
          where: {
            m_menu_id: menu.id,
            m_unit_bisnis_id: instance.m_unit_bisnis_id,
            is_active: true
          },
          include: [{
            model: m_format_nomor_d,
            as: 'm_format_nomor_ds',
            include: [{ model: m_prefix, as: 'm_prefix' }],
            separate: true,
            order: [['index', 'ASC']]
          }],
          transaction: options.transaction
        });

        // fallback ke unit bisnis NULL
        if (!formatNomor && instance.m_unit_bisnis_id) {
          formatNomor = await m_format_nomor.findOne({
            where: {
              m_menu_id: menu.id,
              m_unit_bisnis_id: null,
              is_active: true
            },
            include: [{
              model: m_format_nomor_d,
              as: 'm_format_nomor_ds',
              include: [{ model: m_prefix, as: 'm_prefix' }],
              separate: true,
              order: [['index', 'ASC']]
            }],
            transaction: options.transaction
          });
        }

        if (!formatNomor?.m_format_nomor_ds?.length) {
          throw new Error(
            'Format nomor not configured for t_transfer_gudang. Please setup format nomor in the system.'
          );
        }

        // 3. Ambil singkatan company
        let companyAbbr = '';
        if (instance.m_unit_bisnis_id) {
          const unitBisnis = await m_unit_bisnis.findByPk(
            instance.m_unit_bisnis_id,
            { transaction: options.transaction }
          );

          if (unitBisnis?.nama_comp) {
            const skipWords = [
              'PT', 'CV', 'UD', 'FIRMA',
              'KOPERASI', 'YAYASAN',
              'PERSEROAN', 'TERBATAS'
            ];

            const words = unitBisnis.nama_comp
              .toUpperCase()
              .split(' ')
              .filter(word => !skipWords.includes(word.trim()));

            companyAbbr = words.map(word => word.charAt(0)).join('');
          }
        }

        // 4. Build prefix (SAMA PERSIS mentor)
        const today = new Date();
        let prefix = '';
        let hasSeq = false;
        let seqLength = 4;

        for (const detail of formatNomor.m_format_nomor_ds) {
          const tipePrefix = detail.m_prefix.tipe_prefix;
          const value = detail.m_prefix.value;

          if (tipePrefix === 'TEXT') {
            prefix += value;
          } else if (tipePrefix === 'DAY') {
            prefix += today.getDate().toString().padStart(2, '0');
          } else if (tipePrefix === 'MONTH') {
            prefix += (today.getMonth() + 1).toString().padStart(2, '0');
          } else if (tipePrefix === 'YEAR') {
            prefix += today.getFullYear().toString().slice(-2);
          } else if (tipePrefix === 'COMPANY_AUTO') {
            prefix += companyAbbr;
          } else if (tipePrefix === 'SEQ') {
            hasSeq = true;
            seqLength = parseInt(value) || 4;
          }
        }

        // ⬅️ KUNCI: auto-inject company sebelum sequence
        if (companyAbbr && hasSeq) {
          prefix += companyAbbr;
        }

        if (!hasSeq) {
          instance.no_tw = prefix;
          return;
        }

        // 5. Cari record terakhir (EXCLUDE diri sendiri)
        const { Op } = t_transfer_gudang.sequelize.Sequelize;

        const lastRecord = await t_transfer_gudang.findOne({
          where: {
            no_tw: { [Op.like]: `${prefix}%` },
            id: { [Op.ne]: instance.id } // ⬅️ FIX UTAMA beforeUpdate
          },
          order: [['no_tw', 'DESC']],
          transaction: options.transaction
        });

        let sequence = 1;
        if (lastRecord?.no_tw) {
          const numericPart = lastRecord.no_tw.match(/(\d+)$/);
          if (numericPart) {
            sequence = parseInt(numericPart[1], 10) + 1;
          }
        }

        // 6. Set no_tw baru
        instance.no_tw = `${prefix}${String(sequence).padStart(seqLength, '0')}`;
      }

    } catch (err) {
      console.error('[beforeUpdate t_transfer_gudang]', err);

      const error = new Error(
        err.message || 'Gagal generate no_tw Transfer Gudang'
      );
      error.statusCode = 500;
      error.originalError = err;

      throw error;
    }
  });





  // afterUpdate
  t_transfer_gudang.addHook('afterUpdate', async (instance, options) => {
    // Custom logic setelah update
  });

  // beforeSave
  t_transfer_gudang.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  t_transfer_gudang.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  t_transfer_gudang.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  t_transfer_gudang.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  t_transfer_gudang.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  t_transfer_gudang.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  t_transfer_gudang.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  t_transfer_gudang.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}

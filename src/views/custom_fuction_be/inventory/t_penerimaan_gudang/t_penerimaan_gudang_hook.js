// Hooks for t_penerimaan_gudang model
import t_penerimaan_gudang from '../models/t_penerimaan_gudang.js';
import m_unit_bisnis from '../models/m_unit_bisnis.js';
import m_format_nomor from '../models/m_format_nomor.js';
import m_format_nomor_d from '../models/m_format_nomor_d.js';
import m_prefix from '../models/m_prefix.js';
import m_menu from '../models/m_menu.js';

export function registert_penerimaan_gudangHooks() {
  // beforeValidate
  t_penerimaan_gudang.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
  });

  // afterValidate
  t_penerimaan_gudang.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  t_penerimaan_gudang.addHook('beforeCreate', async (instance, options) => {
    try {
      // beforeCreate → JANGAN pakai instance.changed()
      if (!instance.no_penerimaan_gudang) {

        // 1. Cari menu
        const menu = await m_menu.findOne({
          where: { path: '/inventory/transaksi/t_penerimaan_gudang' },
          transaction: options.transaction
        });

        if (!menu) {
          throw new Error(
            'Menu not found for /inventory/transaksi/t_penerimaan_gudang. Please check m_menu.'
          );
        }

        // 2. Cari format nomor (prioritas unit bisnis)
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
          throw new Error('Format nomor Penerimaan Gudang belum disetting');
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

        // 4. Build prefix
        const today = new Date();
        let prefix = '';
        let hasSeq = false;
        let seqLength = 4;

        for (const d of formatNomor.m_format_nomor_ds) {
          const { tipe_prefix, value } = d.m_prefix;

          switch (tipe_prefix) {
            case 'TEXT':
              prefix += value;
              break;
            case 'DAY':
              prefix += String(today.getDate()).padStart(2, '0');
              break;
            case 'MONTH':
              prefix += String(today.getMonth() + 1).padStart(2, '0');
              break;
            case 'YEAR':
              prefix += today.getFullYear().toString().slice(-2);
              break;
            case 'COMPANY_AUTO':
              prefix += companyAbbr;
              break;
            case 'SEQ':
              hasSeq = true;
              seqLength = parseInt(value) || 4;
              break;
          }
        }

        // inject company sebelum sequence (sesuai pola mentor)
        if (companyAbbr && hasSeq) {
          prefix += companyAbbr;
        }

        if (!hasSeq) {
          instance.no_penerimaan_gudang = prefix;
          return;
        }

        // 5. Cari nomor terakhir
        const lastRecord = await t_penerimaan_gudang.findOne({
          where: {
            no_penerimaan_gudang: {
              [t_penerimaan_gudang.sequelize.Sequelize.Op.like]: `${prefix}%`
            }
          },
          order: [['no_penerimaan_gudang', 'DESC']],
          transaction: options.transaction
        });

        let seq = 1;
        if (lastRecord?.no_penerimaan_gudang) {
          const match = lastRecord.no_penerimaan_gudang.match(/(\d+)$/);
          if (match) seq = parseInt(match[1], 10) + 1;
        }

        // 6. Set nomor
        instance.no_penerimaan_gudang =
          `${prefix}${String(seq).padStart(seqLength, '0')}`;
      }

    } catch (err) {
      console.error('[beforeCreate t_penerimaan_gudang]', err);

      const error = new Error(
        err.message || 'Gagal generate no_penerimaan_gudang'
      );
      error.statusCode = 500;
      error.originalError = err;

      throw error;
    }
  });


  // afterCreate
  t_penerimaan_gudang.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  t_penerimaan_gudang.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  t_penerimaan_gudang.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
  });

  // beforeUpdate
  t_penerimaan_gudang.addHook('beforeUpdate', async (instance, options) => {
    // Custom logic sebelum update
  });

  // afterUpdate
  t_penerimaan_gudang.addHook('afterUpdate', async (instance, options) => {
    // Custom logic setelah update
  });

  // beforeSave
  t_penerimaan_gudang.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  t_penerimaan_gudang.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  t_penerimaan_gudang.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  t_penerimaan_gudang.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  t_penerimaan_gudang.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  t_penerimaan_gudang.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  t_penerimaan_gudang.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  t_penerimaan_gudang.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}

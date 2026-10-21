// Hooks for t_sj_gudang model
import t_sj_gudang from '../models/t_sj_gudang.js';
import m_format_nomor from '../models/m_format_nomor.js';
import m_format_nomor_d from '../models/m_format_nomor_d.js';
import m_prefix from '../models/m_prefix.js';
import m_menu from '../models/m_menu.js';
import m_unit_bisnis from '../models/m_unit_bisnis.js';

export function registert_sj_gudangHooks() {
  // beforeValidate
  t_sj_gudang.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
  });

  // afterValidate
  t_sj_gudang.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  t_sj_gudang.addHook('beforeCreate', async (instance, options) => {
    try {

      if (!instance.no_sj_gudang) {

        // 1. Cari menu
        const menu = await m_menu.findOne({
          where: { path: '/inventory/transaksi/t_sj_gudang' },
          transaction: options.transaction
        });

        if (!menu) {
          throw new Error(
            'Menu not found for /inventory/transaksi/t_sj_gudang. Please check menu path in m_menu table.'
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
          throw new Error('Format nomor Surat Jalan Gudang belum disetting');
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

        // Inject company sebelum sequence (sesuai mentor)
        if (companyAbbr && hasSeq) {
          prefix += companyAbbr;
        }

        if (!hasSeq) {
          instance.no_sj_gudang = prefix;
          return;
        }

        // 5. Cari nomor terakhir
        const lastRecord = await t_sj_gudang.findOne({
          where: {
            no_sj_gudang: {
              [t_sj_gudang.sequelize.Sequelize.Op.like]: `${prefix}%`
            }
          },
          order: [['no_sj_gudang', 'DESC']],
          transaction: options.transaction
        });

        let seq = 1;
        if (lastRecord?.no_sj_gudang) {
          const match = lastRecord.no_sj_gudang.match(/(\d+)$/);
          if (match) seq = parseInt(match[1], 10) + 1;
        }

        // 6. Set no_sj_gudang
        instance.no_sj_gudang = `${prefix}${String(seq).padStart(seqLength, '0')}`;
      }

    } catch (err) {
      console.error('[beforeCreate t_sj_gudang]', err);

      const error = new Error(
        err.message || 'Gagal generate no_sj_gudang'
      );
      error.statusCode = 500;
      error.originalError = err;

      throw error;
    }
  });


  // afterCreate
  t_sj_gudang.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  t_sj_gudang.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  t_sj_gudang.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
  });

  // beforeUpdate
  t_sj_gudang.addHook('beforeUpdate', async (instance, options) => {
    try {
      // Regenerate jika kosong ATAU unit bisnis berubah
      if (!instance.no_sj_gudang || instance.changed('m_unit_bisnis_id')) {

        // 1. Cari menu
        const menu = await m_menu.findOne({
          where: { path: '/inventory/transaksi/t_sj_gudang' },
          transaction: options.transaction
        });

        if (!menu) {
          throw new Error(
            'Menu not found for /inventory/transaksi/t_sj_gudang. Please check menu path in m_menu table.'
          );
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
          throw new Error('Format nomor Surat Jalan Gudang belum disetting');
        }

        // 3. Company abbreviation
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

          if (tipe_prefix === 'TEXT') prefix += value;
          else if (tipe_prefix === 'DAY') prefix += String(today.getDate()).padStart(2, '0');
          else if (tipe_prefix === 'MONTH') prefix += String(today.getMonth() + 1).padStart(2, '0');
          else if (tipe_prefix === 'YEAR') prefix += today.getFullYear().toString().slice(-2);
          else if (tipe_prefix === 'COMPANY_AUTO') prefix += companyAbbr;
          else if (tipe_prefix === 'SEQ') {
            hasSeq = true;
            seqLength = parseInt(value) || 4;
          }
        }

        if (companyAbbr && hasSeq) {
          prefix += companyAbbr;
        }

        if (!hasSeq) {
          instance.no_sj_gudang = prefix;
          return;
        }

        // 5. Cari nomor terakhir (EXCLUDE diri sendiri)
        const { Op } = t_sj_gudang.sequelize.Sequelize;

        const lastRecord = await t_sj_gudang.findOne({
          where: {
            no_sj_gudang: { [Op.like]: `${prefix}%` },
            id: { [Op.ne]: instance.id }
          },
          order: [['no_sj_gudang', 'DESC']],
          transaction: options.transaction
        });

        let seq = 1;
        if (lastRecord?.no_sj_gudang) {
          const match = lastRecord.no_sj_gudang.match(/(\d+)$/);
          if (match) seq = parseInt(match[1], 10) + 1;
        }

        // 6. Set no_sj_gudang baru
        instance.no_sj_gudang = `${prefix}${String(seq).padStart(seqLength, '0')}`;
      }

    } catch (err) {
      console.error('[beforeUpdate t_sj_gudang]', err);

      const error = new Error(
        err.message || 'Gagal generate no_sj_gudang'
      );
      error.statusCode = 500;
      error.originalError = err;

      throw error;
    }
  });


  // afterUpdate
  t_sj_gudang.addHook('afterUpdate', async (instance, options) => {
    // Custom logic setelah update
  });

  // beforeSave
  t_sj_gudang.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  t_sj_gudang.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  t_sj_gudang.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  t_sj_gudang.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  t_sj_gudang.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  t_sj_gudang.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  t_sj_gudang.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  t_sj_gudang.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}

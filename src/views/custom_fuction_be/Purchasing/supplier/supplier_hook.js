// Hooks for m_supplier model
import m_supplier from '../models/m_supplier.js';
import m_format_nomor from '../models/m_format_nomor.js';
import m_format_nomor_d from '../models/m_format_nomor_d.js';
import m_prefix from '../models/m_prefix.js';
import m_menu from '../models/m_menu.js';
import m_unit_bisnis from '../models/m_unit_bisnis.js';

export function registerm_supplierHooks() {
  // beforeValidate
  m_supplier.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
  });

  // afterValidate
  m_supplier.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  m_supplier.addHook('beforeCreate', async (instance, options) => {
    // Generate auto number untuk kode_supplier based on m_format_nomor configuration
    if (!instance.kode_supplier) {
      // Find menu by path
      const menu = await m_menu.findOne({
        where: { path: '/purchasing/master/m_supplier' },
        transaction: options.transaction
      });
      
      if (!menu) {
        throw new Error('Menu not found for /purchasing/master/m_supplier. Please check menu path in m_menu table.');
      }
      
      // Find format nomor for this menu with business unit
      let formatNomor = await m_format_nomor.findOne({
        where: {
          m_menu_id: menu.id,
          m_unit_bisnis_id: instance.m_unit_bisnis_id,
          is_active: true
        },
        include: [{
          model: m_format_nomor_d,
          as: 'm_format_nomor_ds',
          include: [{
            model: m_prefix,
            as: 'm_prefix'
          }],
          separate: true,
          order: [['index', 'ASC']]
        }],
        transaction: options.transaction
      });
      
      // Fallback to null business unit if not found
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
            include: [{
              model: m_prefix,
              as: 'm_prefix'
            }],
            separate: true,
            order: [['index', 'ASC']]
          }],
          transaction: options.transaction
        });
      }
      
      if (!formatNomor || !formatNomor.m_format_nomor_ds || formatNomor.m_format_nomor_ds.length === 0) {
        throw new Error('Format nomor not configured for m_supplier. Please setup format nomor in the system.');
      }
      
      // Get company abbreviation if business unit exists
      let companyAbbr = '';
      if (instance.m_unit_bisnis_id) {
        const unitBisnis = await m_unit_bisnis.findByPk(instance.m_unit_bisnis_id, {
          transaction: options.transaction
        });
        if (unitBisnis && unitBisnis.nama_comp) {
          const skipWords = ['PT', 'CV', 'UD', 'FIRMA', 'KOPERASI', 'YAYASAN', 'PERSEROAN', 'TERBATAS'];
          const words = unitBisnis.nama_comp
            .toUpperCase()
            .split(' ')
            .filter(word => !skipWords.includes(word.trim()));
          companyAbbr = words.map(word => word.charAt(0)).join('');
        }
      }
      
      // Build prefix from format details
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
      
      // Auto-inject company abbreviation before sequence if company exists
      if (companyAbbr && hasSeq) {
        prefix += companyAbbr;
      }
      
      if (!hasSeq) {
        instance.kode_supplier = prefix;
        return;
      }
      
      // Find last record with this prefix
      const lastRecord = await m_supplier.findOne({
        where: {
          kode_supplier: {
            [m_supplier.sequelize.Sequelize.Op.like]: `${prefix}%`
          }
        },
        order: [['kode_supplier', 'DESC']],
        transaction: options.transaction
      });
      
      let sequence = 1;
      if (lastRecord && lastRecord.kode_supplier) {
        const numericPart = lastRecord.kode_supplier.match(/(\d+)$/);
        if (numericPart) {
          sequence = parseInt(numericPart[1], 10) + 1;
        }
      }
      
      instance.kode_supplier = `${prefix}${String(sequence).padStart(seqLength, '0')}`;
    }
  });

  // afterCreate
  m_supplier.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  m_supplier.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  m_supplier.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
  });

  // beforeUpdate
  m_supplier.addHook('beforeUpdate', async (instance, options) => {
    // Regenerate kode_supplier if business unit changed or if kode_supplier is empty
    if (!instance.kode_supplier || instance.changed('m_unit_bisnis_id')) {
      // Find menu by path
      const menu = await m_menu.findOne({
        where: { path: '/purchasing/master/m_supplier' },
        transaction: options.transaction
      });
      
      if (!menu) {
        throw new Error('Menu not found for /purchasing/master/m_supplier. Please check menu path in m_menu table.');
      }
      
      // Find format nomor for this menu with new business unit
      let formatNomor = await m_format_nomor.findOne({
        where: {
          m_menu_id: menu.id,
          m_unit_bisnis_id: instance.m_unit_bisnis_id,
          is_active: true
        },
        include: [{
          model: m_format_nomor_d,
          as: 'm_format_nomor_ds',
          include: [{
            model: m_prefix,
            as: 'm_prefix'
          }],
          separate: true,
          order: [['index', 'ASC']]
        }],
        transaction: options.transaction
      });
      
      // Fallback to null business unit if not found
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
            include: [{
              model: m_prefix,
              as: 'm_prefix'
            }],
            separate: true,
            order: [['index', 'ASC']]
          }],
          transaction: options.transaction
        });
      }
      
      if (!formatNomor || !formatNomor.m_format_nomor_ds || formatNomor.m_format_nomor_ds.length === 0) {
        throw new Error('Format nomor not configured for m_supplier. Please setup format nomor in the system.');
      }
      
      // Get company abbreviation if business unit exists
      let companyAbbr = '';
      if (instance.m_unit_bisnis_id) {
        const unitBisnis = await m_unit_bisnis.findByPk(instance.m_unit_bisnis_id, {
          transaction: options.transaction
        });
        if (unitBisnis && unitBisnis.nama_comp) {
          const skipWords = ['PT', 'CV', 'UD', 'FIRMA', 'KOPERASI', 'YAYASAN', 'PERSEROAN', 'TERBATAS'];
          const words = unitBisnis.nama_comp
            .toUpperCase()
            .split(' ')
            .filter(word => !skipWords.includes(word.trim()));
          companyAbbr = words.map(word => word.charAt(0)).join('');
        }
      }
      
      // Build prefix from format details
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
      
      // Auto-inject company abbreviation before sequence if company exists
      if (companyAbbr && hasSeq) {
        prefix += companyAbbr;
      }
      
      if (!hasSeq) {
        instance.kode_supplier = prefix;
        return;
      }
      
      // Find last record with this prefix
      const lastRecord = await m_supplier.findOne({
        where: {
          kode_supplier: {
            [m_supplier.sequelize.Sequelize.Op.like]: `${prefix}%`
          }
        },
        order: [['kode_supplier', 'DESC']],
        transaction: options.transaction
      });
      
      let sequence = 1;
      if (lastRecord && lastRecord.kode_supplier) {
        const numericPart = lastRecord.kode_supplier.match(/(\d+)$/);
        if (numericPart) {
          sequence = parseInt(numericPart[1], 10) + 1;
        }
      }
      
      instance.kode_supplier = `${prefix}${String(sequence).padStart(seqLength, '0')}`;
    }
  });

  // afterUpdate
  m_supplier.addHook('afterUpdate', async (instance, options) => {
    // Custom logic setelah update
  });

  // beforeSave
  m_supplier.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  m_supplier.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  m_supplier.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  m_supplier.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  m_supplier.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  m_supplier.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  m_supplier.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  m_supplier.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}

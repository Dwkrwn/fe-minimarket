// Hooks for m_approval model
import m_approval from '../models/m_approval.js';
import m_format_nomor from '../models/m_format_nomor.js';
import m_format_nomor_d from '../models/m_format_nomor_d.js';
import m_prefix from '../models/m_prefix.js';
import m_menu from '../models/m_menu.js';

export function registerm_approvalHooks() {
  // beforeValidate
  m_approval.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
  });

  // afterValidate
  m_approval.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  m_approval.addHook('beforeCreate', async (instance, options) => {
    // Generate auto number untuk kode_approval based on m_format_nomor configuration
    if (!instance.kode_approval) {
      // Find menu by path
      const menu = await m_menu.findOne({
        where: { path: '/setup/m_approval' },
        transaction: options.transaction
      });
      
      if (!menu) {
        throw new Error('Menu not found for /setup/m_approval. Please check menu path in m_menu table.');
      }
      
      // Find format nomor for this menu (no business unit for approval)
      const formatNomor = await m_format_nomor.findOne({
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
      
      if (!formatNomor || !formatNomor.m_format_nomor_ds || formatNomor.m_format_nomor_ds.length === 0) {
        throw new Error('Format nomor not configured for m_approval. Please setup format nomor in the system.');
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
        } else if (tipePrefix === 'SEQ') {
          hasSeq = true;
          seqLength = parseInt(value) || 4;
        }
      }
      
      if (!hasSeq) {
        instance.kode_approval = prefix;
        return;
      }
      
      // Find last record with this prefix
      const lastRecord = await m_approval.findOne({
        where: {
          kode_approval: {
            [m_approval.sequelize.Sequelize.Op.like]: `${prefix}%`
          }
        },
        order: [['kode_approval', 'DESC']],
        transaction: options.transaction
      });
      
      let sequence = 1;
      if (lastRecord && lastRecord.kode_approval) {
        const numericPart = lastRecord.kode_approval.match(/(\d+)$/);
        if (numericPart) {
          sequence = parseInt(numericPart[1], 10) + 1;
        }
      }
      
      instance.kode_approval = `${prefix}${String(sequence).padStart(seqLength, '0')}`;
    }
  });

  // afterCreate
  m_approval.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  m_approval.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  m_approval.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
  });

  // beforeUpdate
  m_approval.addHook('beforeUpdate', async (instance, options) => {
    // Custom logic sebelum update
  });

  // afterUpdate
  m_approval.addHook('afterUpdate', async (instance, options) => {
    // Custom logic setelah update
  });

  // beforeSave
  m_approval.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  m_approval.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  m_approval.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  m_approval.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  m_approval.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  m_approval.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  m_approval.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  m_approval.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}

// Hooks for m_kendaraan model
import m_kendaraan from '../models/m_kendaraan.js';
import {Op,Sequelize} from 'sequelize';
import m_format_nomor from '../models/m_format_nomor.js';
import m_format_nomor_d from '../models/m_format_nomor_d.js';
import m_prefix from '../models/m_prefix.js';
import m_menu from '../models/m_menu.js';

export function registerm_kendaraanHooks() {
  // beforeValidate
  m_kendaraan.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
  });

  // afterValidate
  m_kendaraan.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  m_kendaraan.addHook('beforeCreate', async (instance, options) => {
    // Generate auto number untuk kode_kendaraan based on m_format_nomor configuration
    if (!instance.kode_kendaraan) {
      // Find menu by path
      const menu = await m_menu.findOne({
        where: { path: '/setup/m_kendaraan' },
        transaction: options.transaction
      });
      
      if (!menu) {
        throw new Error('Menu not found for /setup/m_kendaraan. Please check menu path in m_menu table.');
      }
      
      // Find format nomor for this menu (no business unit for kendaraan)
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
        throw new Error('Format nomor not configured for m_kendaraan. Please setup format nomor in the system.');
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
        instance.kode_kendaraan = prefix;
        return;
      }
      
      // Find last record with this prefix
      const lastRecord = await m_kendaraan.findOne({
        where: {
          kode_kendaraan: {
            [Op.like]: `${prefix}%`
          }
        },
        order: [['kode_kendaraan', 'DESC']],
        transaction: options.transaction
      });
      
      let sequence = 1;
      if (lastRecord && lastRecord.kode_kendaraan) {
        const numericPart = lastRecord.kode_kendaraan.match(/(\d+)$/);
        if (numericPart) {
          sequence = parseInt(numericPart[1], 10) + 1;
        }
      }
      
      instance.kode_kendaraan = `${prefix}${String(sequence).padStart(seqLength, '0')}`;
    }
  });

  // afterCreate
  m_kendaraan.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  m_kendaraan.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  m_kendaraan.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
  });

  // beforeUpdate
  m_kendaraan.addHook('beforeUpdate', async (instance, options) => {
    // Custom logic sebelum update
  });

  // afterUpdate
  m_kendaraan.addHook('afterUpdate', async (instance, options) => {
    // Custom logic setelah update
  });

  // beforeSave
  m_kendaraan.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  m_kendaraan.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  m_kendaraan.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  m_kendaraan.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  m_kendaraan.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  m_kendaraan.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  m_kendaraan.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  m_kendaraan.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}

// Hooks for m_unit_bisnis model
import m_unit_bisnis from '../models/m_unit_bisnis.js';
import m_format_nomor from '../models/m_format_nomor.js';
import m_format_nomor_d from '../models/m_format_nomor_d.js';
import m_prefix from '../models/m_prefix.js';
import m_menu from '../models/m_menu.js';

// Helper function to generate company abbreviation
function generateCompanyAbbreviation(companyName) {
  if (!companyName) return '';
  
  const skipWords = ['PT', 'CV', 'UD', 'FIRMA', 'KOPERASI', 'YAYASAN', 'PERSEROAN', 'TERBATAS'];
  
  const words = companyName
    .toUpperCase()
    .split(/\s+/)
    .filter(word => {
      if (!word) return false;
      if (skipWords.includes(word)) return false;
      return true;
    });
  
  if (words.length === 0) {
    return companyName
      .toUpperCase()
      .split(/\s+/)
      .map(w => w.charAt(0))
      .join('')
      .slice(0, 5);
  }
  
  return words.map(word => word.charAt(0)).join('');
}

export function registerm_unit_bisnisHooks() {
  // beforeValidate
  m_unit_bisnis.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
  });

  // afterValidate
  m_unit_bisnis.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  m_unit_bisnis.addHook('beforeCreate', async (instance, options) => {
    // Generate auto number untuk kode_unit_bisnis based on m_format_nomor configuration
    if (!instance.kode_unit_bisnis && instance.nama_comp) {
      // Find menu by path
      const menu = await m_menu.findOne({
        where: { path: '/setup/m_unit_bisnis' },
        transaction: options.transaction
      });
      
      if (!menu) {
        throw new Error('Menu not found for /setup/m_unit_bisnis. Please check menu path in m_menu table.');
      }
      
      // Find format nomor for this menu
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
        throw new Error('Format nomor not configured for m_unit_bisnis. Please setup format nomor in the system.');
      }
      
      // Get company abbreviation
      const companyAbbr = generateCompanyAbbreviation(instance.nama_comp);
      
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
        instance.kode_unit_bisnis = prefix;
        return;
      }
      
      // Find last record with this prefix
      const lastRecord = await m_unit_bisnis.findOne({
        where: {
          kode_unit_bisnis: {
            [m_unit_bisnis.sequelize.Sequelize.Op.like]: `${prefix}%`
          }
        },
        order: [['kode_unit_bisnis', 'DESC']],
        transaction: options.transaction
      });
      
      let sequence = 1;
      if (lastRecord && lastRecord.kode_unit_bisnis) {
        const numericPart = lastRecord.kode_unit_bisnis.match(/(\d+)$/);
        if (numericPart) {
          sequence = parseInt(numericPart[1], 10) + 1;
        }
      }
      
      instance.kode_unit_bisnis = `${prefix}${String(sequence).padStart(seqLength, '0')}`;
    }
  });

  // afterCreate
  m_unit_bisnis.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  m_unit_bisnis.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  m_unit_bisnis.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
  });

  // beforeUpdate
  m_unit_bisnis.addHook('beforeUpdate', async (instance, options) => {
    // Custom logic sebelum update
  });


  // afterUpdate
  m_unit_bisnis.addHook('afterUpdate', async (instance, options) => {
    // Custom logic setelah update
  });

  // beforeSave
  m_unit_bisnis.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  m_unit_bisnis.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  m_unit_bisnis.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  m_unit_bisnis.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  m_unit_bisnis.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  m_unit_bisnis.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  m_unit_bisnis.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  m_unit_bisnis.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}

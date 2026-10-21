// Hooks for m_kary model
import m_kary from '../models/m_kary.js';
import m_format_nomor from '../models/m_format_nomor.js';
import m_format_nomor_d from '../models/m_format_nomor_d.js';
import m_prefix from '../models/m_prefix.js';
import m_menu from '../models/m_menu.js';
import m_unit_bisnis from '../models/m_unit_bisnis.js';

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

export function registerm_karyHooks() {
  // beforeValidate
  m_kary.addHook('beforeValidate', async (instance, options) => {
    // Custom logic sebelum validasi
  });

  // afterValidate
  m_kary.addHook('afterValidate', async (instance, options) => {
    // Custom logic setelah validasi
  });

  // beforeCreate
  m_kary.addHook('beforeCreate', async (instance, options) => {
    // Generate auto number untuk kode_kary based on m_format_nomor configuration
    if (!instance.kode_kary) {
      // Find menu by path
      const menu = await m_menu.findOne({
        where: { path: '/setup/m_kary' },
        transaction: options.transaction
      });
      
      if (!menu) {
        throw new Error('Menu not found for /setup/m_kary. Please check menu path in m_menu table.');
      }
        
        // Find format nomor for this menu
        const whereClause = {
          m_menu_id: menu.id,
          is_active: true
        };
        
        // Try with unit bisnis first, then without
        if (instance.m_unit_bisnis_id) {
          whereClause.m_unit_bisnis_id = instance.m_unit_bisnis_id;
        }
        
        let formatNomor = await m_format_nomor.findOne({
          where: whereClause,
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
        
        // If not found with unit bisnis, try without it
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
          throw new Error('Format nomor not configured for m_kary. Please setup format nomor in the system.');
        }
        
        // Get company abbreviation if needed
        let companyAbbr = '';
        if (instance.m_unit_bisnis_id) {
          const unitBisnis = await m_unit_bisnis.findByPk(instance.m_unit_bisnis_id, {
            attributes: ['nama_comp'],
            transaction: options.transaction
          });
          if (unitBisnis && unitBisnis.nama_comp) {
            companyAbbr = generateCompanyAbbreviation(unitBisnis.nama_comp);
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
          instance.kode_kary = prefix;
          return;
        }
        
        // Find last record with this prefix
        const lastRecord = await m_kary.findOne({
          where: {
            kode_kary: {
              [m_kary.sequelize.Sequelize.Op.like]: `${prefix}%`
            }
          },
          order: [['kode_kary', 'DESC']],
          transaction: options.transaction
        });
        
        let sequence = 1;
        if (lastRecord && lastRecord.kode_kary) {
          const numericPart = lastRecord.kode_kary.match(/(\d+)$/);
          if (numericPart) {
            sequence = parseInt(numericPart[1], 10) + 1;
          }
        }
        
        instance.kode_kary = `${prefix}${String(sequence).padStart(seqLength, '0')}`;
    }
  });

  // afterCreate
  m_kary.addHook('afterCreate', async (instance, options) => {
    // Custom logic setelah create
  });

  // beforeDestroy
  m_kary.addHook('beforeDestroy', async (instance, options) => {
    // Custom logic sebelum destroy
  });

  // afterDestroy
  m_kary.addHook('afterDestroy', async (instance, options) => {
    // Custom logic setelah destroy
  });

  // beforeUpdate
  m_kary.addHook('beforeUpdate', async (instance, options) => {
    // Custom logic sebelum update
  });

  // afterUpdate
  m_kary.addHook('afterUpdate', async (instance, options) => {
    // Custom logic setelah update
  });

  // beforeSave
  m_kary.addHook('beforeSave', async (instance, options) => {
    // Custom logic sebelum save
  });

  // afterSave
  m_kary.addHook('afterSave', async (instance, options) => {
    // Custom logic setelah save
  });

  // beforeBulkCreate
  m_kary.addHook('beforeBulkCreate', async (instances, options) => {
    // Custom logic sebelum bulk create
  });

  // afterBulkCreate
  m_kary.addHook('afterBulkCreate', async (instances, options) => {
    // Custom logic setelah bulk create
  });

  // beforeBulkDestroy
  m_kary.addHook('beforeBulkDestroy', async (options) => {
    // Custom logic sebelum bulk destroy
  });

  // afterBulkDestroy
  m_kary.addHook('afterBulkDestroy', async (options) => {
    // Custom logic setelah bulk destroy
  });

  // beforeBulkUpdate
  m_kary.addHook('beforeBulkUpdate', async (options) => {
    // Custom logic sebelum bulk update
  });

  // afterBulkUpdate
  m_kary.addHook('afterBulkUpdate', async (options) => {
    // Custom logic setelah bulk update
  });
}

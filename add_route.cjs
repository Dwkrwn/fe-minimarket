#!/usr/bin/env node

/**
 * Script untuk membuat module baru dengan struktur file dan route otomatis
 * 
 * Usage:
 *   node add_route.js <module_path> [api_endpoint] [route_path]
 * 
 * Examples:
 *   node add_route.js dev/component
 *   node add_route.js setup/m_general
 *   node add_route.js setup/m_general m_general /setup/m_general
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ============================================================================
// CONFIGURATION
// ============================================================================
const projectRoot = __dirname;
const srcPath = path.join(projectRoot, 'src');
const viewsPath = path.join(srcPath, 'views');
const templatePath = path.join(projectRoot, 'template');  // Use template folder
const m_general_templatePath = path.join(viewsPath, 'setup', 'm_general');  // Fallback to m_general
const routerPath = path.join(srcPath, 'router', 'index.ts');
const crudRoutesPath = path.join(srcPath, 'router', 'crud-routes.ts');
const notificationsRoutesPath = path.join(srcPath, 'router', 'notifications.ts');
const notifikasiPath = path.join(viewsPath, 'notifikasi');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
};

function colorLog(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function getPascalCase(text) {
  // Remove prefix m_ or t_ if exists
  text = text.replace(/^[mt]_/, '');
  
  // Split by underscore or dash
  const words = text.split(/[_-]/);
  
  // Capitalize first letter of each word
  const pascalCase = words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
  
  return pascalCase;
}

// Get readable name (may still have T prefix for display like "T Penerimaan")
function getReadableName(text) {
  // Remove prefix m_ if exists
  text = text.replace(/^m_/, '');
  
  // Split by underscore or dash
  const words = text.split(/[_-]/);
  
  // Capitalize first letter of each word, join with space
  return words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Get readable name WITHOUT prefixes (m_ or t_) - for clean display names
// e.g., "t_penerimaan" → "Penerimaan", "m_supplier" → "Supplier"
function getReadableNameClean(text) {
  // Remove prefix m_ or t_ if exists
  text = text.replace(/^[mt]_/, '');
  
  // Split by underscore or dash
  const words = text.split(/[_-]/);
  
  // Capitalize first letter of each word, join with space
  return words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function generateModuleTitle(routePath) {
  // Parse route path: /setup/m_item_group or /purchasing/transaksi/m_purchase
  const segments = routePath.split('/').filter(s => s);
  
  if (segments.length === 0) return 'Master Module';
  
  const lastSegment = segments[segments.length - 1];
  const moduleName = getReadableName(lastSegment);
  const moduleNameClean = getReadableNameClean(lastSegment);
  
  // If only 2 segments (folder/module)
  if (segments.length === 2) {
    // If module starts with t_, treat as transaksi
    if (lastSegment.startsWith('t_')) {
      return `Transaksi ${moduleNameClean}`;
    }
    return `Master ${moduleName}`;
  }
  
  // If 3+ segments, check if it's a transaksi module
  const prefixSegment = segments[segments.length - 2];
  const prefix = getReadableName(prefixSegment);
  
  // For transaksi modules (starting with t_), remove the t_ prefix from module name
  // purchasing/transaksi/t_purchase → "Transaksi Purchase" (not "Transaksi T Purchase")
  if (lastSegment.startsWith('t_')) {
    return `Transaksi ${moduleNameClean}`;
  }
  
  // For master modules or other types
  // purchasing/master/m_purchase → "Master Purchase"
  return `${prefix} ${moduleName}`;
}

function testPrerequisites() {
  // Check if template folder exists (or fallback to m_general)
  const templateLanding = path.join(templatePath, 'Landing.txt');
  const templateForm = path.join(templatePath, 'Form.txt');
  const templateFormWithDetail = path.join(templatePath, 'FormWithDetail.txt');
  const templateLandingWithApproval = path.join(templatePath, 'LandingWithApproval.txt');
  const templateFormWithApproval = path.join(templatePath, 'FormWithApproval.txt');
  const templateService = path.join(templatePath, 'service.txt');
  const m_generalExists = fs.existsSync(m_general_templatePath);
  
  if (!fs.existsSync(templateLanding) || !fs.existsSync(templateForm) || !fs.existsSync(templateFormWithDetail) || !fs.existsSync(templateService)) {
    colorLog(`❌ Template files tidak lengkap di folder template/`, 'red');
    colorLog(`   Pastikan file berikut ada:`, 'red');
    colorLog(`   - Landing.txt`, 'red');
    colorLog(`   - Form.txt`, 'red');
    colorLog(`   - FormWithDetail.txt`, 'red');
    colorLog(`   - service.txt`, 'red');
    process.exit(1);
  }

  // Check if router file exists
  if (!fs.existsSync(routerPath)) {
    colorLog(`❌ Router file tidak ditemukan: ${routerPath}`, 'red');
    process.exit(1);
  }

  colorLog('✅ Prerequisites check passed', 'green');
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

function generateDetailTabContent(detailTable, index) {
  const methodPrefix = detailTable.varName.charAt(0).toUpperCase() + detailTable.varName.slice(1);
  
  // Check if type is multi-select
  if (detailTable.type === 'multi-select') {
    // Generate ButtonMultiSelect version with API configuration
    return `
        <!-- TAB CONTENT: DETAIL ${index} (MULTI-SELECT) -->
        <TabsContent value="detail${index}" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Detail Tabel ${index}</CardTitle>
                  <CardDescription>Kelola item detail ${detailTable.name} dengan multi select</CardDescription>
                </div>
                <ButtonMultiSelect
                  v-if="!isReadOnly"
                  title="Pilih Data"
                  @add="(items: any[]) => {
                    items.forEach(item => {
                      if (!${detailTable.varName}.find((d: any) => d.id === item.id)) {
                        ${detailTable.varName}.push({
                          id: item.id,
                          group: item.group,
                          key1: item.key1,
                          code: item.code,
                          value1: item.value1,
                          value2: item.value2,
                          is_active: item.is_active
                        })
                      }
                    })
                  }"
                  :api="{
                    url: \`\${API_BASE_URL}/dynamic/m_general\`,
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': \`Bearer \${authStore.token}\`
                    },
                    params: {
                      searchfield: 'group,key1,code,value1',
                      filter_column_is_active: true
                    },
                    onsuccess: (response: any) => {
                      response.hasNext = response.pagination?.next_page ? true : false
                      return response
                    }
                  }"
                  :columns="[
                    {
                      field: 'group',
                      headerName: 'Group',
                      width: '150px',
                      sortable: true,
                      filterable: true
                    },
                    {
                      field: 'key1',
                      headerName: 'Key1',
                      width: '150px',
                      sortable: true,
                      filterable: true
                    },
                    {
                      field: 'code',
                      headerName: 'Code',
                      width: '150px',
                      sortable: true,
                      filterable: true
                    },
                    {
                      field: 'value1',
                      headerName: 'Value1',
                      flex: 1,
                      sortable: false,
                      filterable: false
                    }
                  ]"
                  :disabled="loading"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">No</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Group</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Key1</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Code</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Value1</th>
                      <th class="px-2 py-2 text-center font-medium text-xs sm:text-sm">Aktif</th>
                      <th v-if="!isReadOnly" class="px-2 py-2 text-center font-medium text-xs sm:text-sm">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="${detailTable.varName}.length === 0">
                      <td colspan="7" class="text-center py-8 text-muted-foreground text-xs sm:text-sm">
                        Belum ada item dipilih. Klik "Pilih Data" untuk menambahkan.
                      </td>
                    </tr>
                    <tr v-for="(detail, idx) in ${detailTable.varName}" :key="detail.id || idx" class="border-t hover:bg-muted/50">
                      <td class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap">{{ idx + 1 }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm">{{ detail.group }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm">{{ detail.key1 }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm">{{ detail.code }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm">{{ detail.value1 }}</td>
                      <td class="px-2 py-2 text-center">
                        <span>{{ detail.is_active ? '✓' : '-' }}</span>
                      </td>
                      <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                        <DeleteButton
                          variant="ghost"
                          size="sm"
                          @click="remove${methodPrefix}(idx)"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>`;
  }
  
  // Default: add-to-list version
  return `
        <!-- TAB CONTENT: DETAIL ${index} (ADD-TO-LIST) -->
        <TabsContent value="detail${index}" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Detail Tabel ${index}</CardTitle>
                  <CardDescription>Kelola item detail ${detailTable.name}</CardDescription>
                </div>
                <Button
                  v-if="!isReadOnly"
                  @click="add${methodPrefix}"
                  size="sm"
                  variant="outline"
                >
                  + Tambah
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">No</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Nama</th>
                      <th class="px-3 py-2 text-center font-medium text-xs sm:text-sm">Nilai</th>
                      <th class="px-2 py-2 text-center font-medium text-xs sm:text-sm">Aktif</th>
                      <th v-if="!isReadOnly" class="px-2 py-2 text-center font-medium text-xs sm:text-sm">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="${detailTable.varName}.length === 0">
                      <td colspan="5" class="text-center py-8 text-muted-foreground text-xs sm:text-sm">
                        Belum ada detail ditambahkan
                      </td>
                    </tr>
                    <tr v-for="(detail, index) in ${detailTable.varName}" :key="index" class="border-t hover:bg-muted/50">
                      <td class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap">{{ index + 1 }}</td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <input
                          v-if="!isReadOnly"
                          v-model="detail.name"
                          type="text"
                          class="w-full px-2 py-1 border rounded text-xs sm:text-sm"
                          placeholder="Nama"
                        />
                        <span v-else>{{ detail.name }}</span>
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <input
                          v-if="!isReadOnly"
                          v-model.number="detail.value"
                          type="number"
                          class="w-full px-2 py-1 border rounded text-xs sm:text-sm text-center"
                          placeholder="0"
                        />
                        <span v-else class="block text-center">{{ detail.value }}</span>
                      </td>
                      <td class="px-2 py-2 text-center">
                        <input
                          v-if="!isReadOnly"
                          v-model="detail.is_active"
                          type="checkbox"
                          class="rounded cursor-pointer"
                        />
                        <span v-else>{{ detail.is_active ? '✓' : '-' }}</span>
                      </td>
                      <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          @click="remove${methodPrefix}(index)"
                          class="h-7 w-7 sm:h-8 sm:w-8"
                        >
                          <Trash2 class="h-3 w-3 sm:h-4 sm:w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>`;
}

function createModuleStructure(targetPath, moduleName, apiEndpoint, routePath, hasDetail, detailTables = [], hasApproval = false) {
  colorLog('\n📁 Creating module structure...', 'cyan');

  // Create target directory
  if (fs.existsSync(targetPath)) {
    colorLog(`⚠️  Folder sudah ada: ${targetPath}`, 'yellow');
    // Jika sudah ada, langsung overwrite saja untuk kemudahan
  } else {
    fs.mkdirSync(targetPath, { recursive: true });
    colorLog(`✅ Created folder: ${targetPath}`, 'green');
  }

  // Get Pascal case name
  const pascalName = getPascalCase(moduleName);

  // Choose template based on approval flag
  const templateLanding = hasApproval 
    ? path.join(templatePath, 'LandingWithApproval.txt')
    : path.join(templatePath, 'Landing.txt');
  
  const templateForm = hasApproval && !hasDetail
    ? path.join(templatePath, 'FormWithApproval.txt')
    : path.join(templatePath, hasDetail ? 'FormWithDetail.txt' : 'Form.txt');
  
  if (!fs.existsSync(templateLanding) || !fs.existsSync(templateForm)) {
    colorLog(`❌ Template files tidak ditemukan di folder template/`, 'red');
    colorLog(`   Pastikan file berikut ada:`, 'red');
    colorLog(`   - ${templateLanding}`, 'red');
    colorLog(`   - ${templateForm}`, 'red');
    process.exit(1);
  }

  // Generate Landing file from template
  colorLog(`\n📄 Generating ${pascalName}Landing.vue from template...`, 'cyan');
  let landingContent = fs.readFileSync(templateLanding, 'utf8');
  
  // Generate dynamic title based on route structure
  const moduleTitle = generateModuleTitle(routePath);
  // Use clean readable name (without t_ or m_ prefix) for descriptions
  const moduleReadable = getReadableNameClean(moduleName);
  
  // Replace placeholders in Landing
  landingContent = landingContent.replace(/\[MODULE\]/g, pascalName);
  landingContent = landingContent.replace(/\[module\]/g, moduleName.toLowerCase());
  landingContent = landingContent.replace(/\[MODULE_TITLE\]/g, moduleTitle);
  landingContent = landingContent.replace(/\[MODULE_READABLE\]/g, moduleReadable);
  landingContent = landingContent.replace(/\[endpoint\]/g, apiEndpoint);
  landingContent = landingContent.replace(/\[route_path\]/g, routePath);
  landingContent = landingContent.replace(/\[route_path\]/g, routePath);
  
  const landingFilePath = path.join(targetPath, `${pascalName}Landing.vue`);
  fs.writeFileSync(landingFilePath, landingContent, 'utf8');
  colorLog(`✅ Created: ${pascalName}Landing.vue`, 'green');
  colorLog(`   📌 Title: ${moduleTitle}`, 'gray');

  // Generate Form file from template
  colorLog(`📄 Generating ${pascalName}Form.vue from template...`, 'cyan');
  let formContent = fs.readFileSync(templateForm, 'utf8');
  
  // Replace placeholders in Form
  formContent = formContent.replace(/\[MODULE\]/g, pascalName);
  formContent = formContent.replace(/\[module\]/g, moduleName.toLowerCase());
  formContent = formContent.replace(/\[Module\]/g, pascalName);
  formContent = formContent.replace(/\[MODULE_READABLE\]/g, moduleReadable);
  formContent = formContent.replace(/\[endpoint\]/g, apiEndpoint);
  formContent = formContent.replace(/\[route_path\]/g, routePath);
  
  // If has details, generate dynamic tabs and detail arrays
  if (hasDetail && detailTables.length > 0) {
    colorLog(`   📊 Generating ${detailTables.length} detail table(s)...`, 'cyan');
    
    // Generate detail array declarations
    const detailArrays = detailTables.map(dt => 
      `const ${dt.varName} = ref<any[]>([])`
    ).join('\n');
    
    // Generate detail methods (add/remove)
    const detailMethods = detailTables.map(dt => `
const add${dt.varName.charAt(0).toUpperCase() + dt.varName.slice(1)} = () => {
  ${dt.varName}.value.push({
    name: '',
    value: 0,
    is_active: true,
  })
}

const remove${dt.varName.charAt(0).toUpperCase() + dt.varName.slice(1)} = (index: number) => {
  ${dt.varName}.value.splice(index, 1)
  toast.info('Detail dihapus')
}`).join('\n');

    // Generate tab triggers (responsive)
    const tabTriggers = detailTables.map((dt, idx) => 
      `          <TabsTrigger value="detail${idx + 1}">Detail ${idx + 1}</TabsTrigger>`
    ).join('\n');
    
    // Generate tab contents
    const tabContents = detailTables.map((dt, idx) => generateDetailTabContent(dt, idx + 1)).join('\n');
    
    // Generate payload fields
    const payloadFields = detailTables.map(dt => 
      `      ${dt.name}: ${dt.varName}.value,`
    ).join('\n');
    
    // Generate load detail logic
    const loadDetailLogic = detailTables.map(dt => `
    if (initialValues.${dt.name}) {
      ${dt.varName}.value = initialValues.${dt.name}
    }`).join('');
    
    // Generate reset detail logic
    const resetDetailLogic = detailTables.map(dt => 
      `  ${dt.varName}.value = []`
    ).join('\n');
    
    // Replace placeholders
    formContent = formContent.replace('// [DETAIL_ARRAYS]', detailArrays);
    formContent = formContent.replace('// [DETAIL_METHODS]', detailMethods);
    formContent = formContent.replace('<!-- [TAB_TRIGGERS] -->', tabTriggers);
    formContent = formContent.replace('<!-- [TAB_CONTENTS] -->', tabContents);
    formContent = formContent.replace('// [PAYLOAD_DETAILS]', payloadFields);
    formContent = formContent.replace('// [LOAD_DETAILS]', loadDetailLogic);
    formContent = formContent.replace('// [RESET_DETAILS]', resetDetailLogic);
    
    colorLog(`   ✅ Detail tables configured`, 'green');
  }
  
  const formFilePath = path.join(targetPath, `${pascalName}Form.vue`);
  fs.writeFileSync(formFilePath, formContent, 'utf8');
  colorLog(`✅ Created: ${pascalName}Form.vue`, 'green');
  
  // ============================================================================
  // GENERATE SERVICE.TS - Generate from template
  // ============================================================================
  const templateService = path.join(templatePath, 'service.txt');
  
  if (fs.existsSync(templateService)) {
    colorLog(`📄 Generating service.ts from template...`, 'cyan');
    let serviceContent = fs.readFileSync(templateService, 'utf8');
    
    // Replace placeholders
    serviceContent = serviceContent.replace(/\[MODULE\]/g, pascalName);
    serviceContent = serviceContent.replace(/\[module\]/g, moduleName.toLowerCase());
    serviceContent = serviceContent.replace(/\[endpoint\]/g, apiEndpoint);
    
    const serviceFilePath = path.join(targetPath, 'service.ts');
    fs.writeFileSync(serviceFilePath, serviceContent, 'utf8');
    colorLog(`✅ Created: service.ts (from template)`, 'green');
  } else {
    colorLog(`❌ ERROR: Template file not found: ${templateService}`, 'red');
    throw new Error('service.txt template is required');
  }

  // ============================================================================
  // GENERATE NOTIFICATION FILES IF APPROVAL IS ENABLED
  // ============================================================================
  if (hasApproval) {
    generateNotificationFiles(moduleName, apiEndpoint, routePath, pascalName, moduleReadable);
  }
}


function addRouteToRouter(routePath, viewPath, moduleName) {
  colorLog('\n🛣️  Adding routes to router...', 'cyan');

  // Get Pascal case name
  const pascalName = getPascalCase(moduleName);
  
  // Generate proper module title based on route path
  const moduleTitle = generateModuleTitle(routePath);
  
  // Get clean readable name (without prefix like t_ or m_)
  const cleanName = getReadableName(moduleName.replace(/^[tm]_/, ''));

  // Determine base path for view component
  const viewPathRelative = viewPath.replace(srcPath + path.sep, '').replace(/\\/g, '/');
  const basePath = '/' + viewPathRelative.replace('views', '');

  // ============================================================================
  // ADD TO CRUD-ROUTES.TS (for standard CRUD routes)
  // ============================================================================
  
  // Read crud-routes.ts content
  let content = fs.readFileSync(crudRoutesPath, 'utf8');

  // Check if route already exists
  const routeExists = content.includes(`path: '${routePath}'`);

  if (routeExists) {
    colorLog(`⚠️  Route sudah terdaftar: ${routePath}`, 'yellow');
    colorLog('ℹ️  Skip route registration', 'yellow');
    return;
  }

  // Create new config entry
  const newConfigEntry = `  {
    path: '${routePath}',
    name: '${pascalName}',
    title: '${cleanName}',
    basePath: '${basePath}',
  },`;

  // Find the insertion point (before the closing bracket of crudRoutesConfig array)
  const configArrayPattern = /const crudRoutesConfig = \[([\s\S]*?)\]/;
  const match = content.match(configArrayPattern);
  
  if (!match) {
    colorLog('❌ Could not find crudRoutesConfig array', 'red');
    colorLog('Please add route manually to router/crud-routes.ts', 'yellow');
    colorLog('\nConfig to add manually:', 'yellow');
    colorLog(newConfigEntry, 'gray');
    return;
  }

  // Determine section based on route path
  let sectionComment = '';
  if (routePath.startsWith('/setup/')) {
    sectionComment = '  // Setup Routes';
  } else if (routePath.startsWith('/purchasing/')) {
    sectionComment = '  // Purchasing Routes';
  } else if (routePath.startsWith('/inventory/')) {
    sectionComment = '  // Inventory Routes';
  } else if (routePath.startsWith('/marketing/')) {
    sectionComment = '  // Marketing Routes';
  }

  // Find the appropriate section or the end of the array
  const lines = content.split('\n');
  let insertIndex = -1;

  // Try to find the section
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(sectionComment)) {
      // Find the last entry in this section
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].includes('  },') && !lines[j + 1]?.includes('  {')) {
          insertIndex = j + 1;
          break;
        }
        if (lines[j].includes('  //') && j > i + 1) {
          // Next section found
          insertIndex = j;
          break;
        }
      }
      break;
    }
  }

  // If section not found, add before the closing bracket
  if (insertIndex === -1) {
    insertIndex = lines.findIndex(line => line === ']');
  }

  if (insertIndex === -1) {
    colorLog('❌ Could not find insertion point', 'red');
    return;
  }

  // Insert the new config entry
  const updatedLines = [
    ...lines.slice(0, insertIndex),
    newConfigEntry,
    ...lines.slice(insertIndex),
  ];

  // Write back to file
  fs.writeFileSync(crudRoutesPath, updatedLines.join('\n'), 'utf8');
  
  colorLog('✅ Route added to crud-routes.ts successfully!', 'green');
  colorLog(`   📝 Config: ${pascalName}`, 'gray');
  colorLog(`   📍 Path: ${routePath}`, 'gray');
}

// ============================================================================
// NOTIFICATION FILES GENERATOR
// ============================================================================

function generateNotificationFiles(moduleName, apiEndpoint, routePath, pascalName, moduleReadable) {
  colorLog('\n🔔 Generating notification files...', 'cyan');

  // Determine notification type key (lowercase, underscore separated)
  // e.g., t_purchase_request -> purchase_request, m_items -> items
  const notificationType = apiEndpoint.replace(/^[mt]_/, '');
  
  // Module lower (for file naming)
  const moduleLower = moduleName.toLowerCase().replace(/^[mt]_/, '');
  
  // ============================================================================
  // 1. CREATE SERVICE FILE: service.[module].ts
  // ============================================================================
  const templateNotifService = path.join(templatePath, 'NotifikasiService.txt');
  
  if (fs.existsSync(templateNotifService)) {
    colorLog(`📄 Generating service.${moduleLower}.ts...`, 'cyan');
    let serviceContent = fs.readFileSync(templateNotifService, 'utf8');
    
    // Replace placeholders
    serviceContent = serviceContent.replace(/\[MODULE\]/g, pascalName);
    serviceContent = serviceContent.replace(/\[module_lower\]/g, moduleLower);
    serviceContent = serviceContent.replace(/\[MODULE_READABLE\]/g, moduleReadable);
    serviceContent = serviceContent.replace(/\[endpoint\]/g, apiEndpoint);
    serviceContent = serviceContent.replace(/\[notification_type\]/g, notificationType);
    serviceContent = serviceContent.replace(/\[route_path\]/g, routePath);
    
    const serviceFilePath = path.join(notifikasiPath, `service.${moduleLower}.ts`);
    fs.writeFileSync(serviceFilePath, serviceContent, 'utf8');
    colorLog(`✅ Created: service.${moduleLower}.ts`, 'green');
  } else {
    colorLog(`⚠️  Template NotifikasiService.txt not found, skipping service generation`, 'yellow');
  }
  
  // ============================================================================
  // 2. CREATE DETAIL VUE FILE: Notifikasi[Module]Detail.vue
  // ============================================================================
  const templateNotifDetail = path.join(templatePath, 'NotifikasiDetail.txt');
  
  if (fs.existsSync(templateNotifDetail)) {
    colorLog(`📄 Generating Notifikasi${pascalName}Detail.vue...`, 'cyan');
    let detailContent = fs.readFileSync(templateNotifDetail, 'utf8');
    
    // Replace placeholders
    detailContent = detailContent.replace(/\[MODULE\]/g, pascalName);
    detailContent = detailContent.replace(/\[module_lower\]/g, moduleLower);
    detailContent = detailContent.replace(/\[MODULE_READABLE\]/g, moduleReadable);
    detailContent = detailContent.replace(/\[endpoint\]/g, apiEndpoint);
    detailContent = detailContent.replace(/\[notification_type\]/g, notificationType);
    detailContent = detailContent.replace(/\[route_path\]/g, routePath);
    
    const detailFilePath = path.join(notifikasiPath, `Notifikasi${pascalName}Detail.vue`);
    fs.writeFileSync(detailFilePath, detailContent, 'utf8');
    colorLog(`✅ Created: Notifikasi${pascalName}Detail.vue`, 'green');
  } else {
    colorLog(`⚠️  Template NotifikasiDetail.txt not found, skipping detail generation`, 'yellow');
  }
  
  // ============================================================================
  // 3. UPDATE ROOT service.ts - Add re-exports
  // ============================================================================
  updateRootNotificationService(moduleName, apiEndpoint, pascalName, moduleLower, notificationType);
  
  // ============================================================================
  // 4. UPDATE notifikasi.vue - Add notification section
  // ============================================================================
  updateNotifikasiVue(moduleName, apiEndpoint, pascalName, moduleLower, notificationType, routePath, moduleReadable);
  
  // ============================================================================
  // 5. ADD NOTIFICATION ROUTE TO ROUTER
  // ============================================================================
  addNotificationRoute(pascalName, moduleLower, notificationType);
}

function updateRootNotificationService(moduleName, apiEndpoint, pascalName, moduleLower, notificationType) {
  const serviceFilePath = path.join(notifikasiPath, 'service.ts');
  
  if (!fs.existsSync(serviceFilePath)) {
    colorLog(`⚠️  Root service.ts not found, skipping update`, 'yellow');
    return;
  }
  
  let content = fs.readFileSync(serviceFilePath, 'utf8');
  
  // Check if already exported
  if (content.includes(`from './service.${moduleLower}'`)) {
    colorLog(`ℹ️  service.${moduleLower} already exported in service.ts`, 'gray');
    return;
  }
  
  colorLog(`📄 Updating root service.ts with re-exports...`, 'cyan');
  
  // Find the last re-export block and add new one after
  const reExportPattern = /\/\/ Re-export from .+ service\nexport \{[\s\S]*?\} from '\.\/service\.\w+'/g;
  const matches = content.match(reExportPattern);
  
  if (matches && matches.length > 0) {
    const lastMatch = matches[matches.length - 1];
    const insertPoint = content.indexOf(lastMatch) + lastMatch.length;
    
    const newExport = `

// Re-export from ${moduleLower} service
export {
  type ${pascalName}Notification,
  type ${pascalName}NotificationResponse,
  get${pascalName}Notifications,
  getPending${pascalName}Notifications,
  get${pascalName}RevisiNotifications,
  get${pascalName}CombinedSenderNotifications,
  mark${pascalName}NotificationAsRead,
  approve${pascalName}Notification,
  revise${pascalName},
  reject${pascalName},
  update${pascalName}Status
} from './service.${moduleLower}'`;
    
    content = content.slice(0, insertPoint) + newExport + content.slice(insertPoint);
  }
  
  // Update getNotifications function to include new type
  const importPattern = /import \{ getItemsNotifications.*\} from '\.\/service\.item'/;
  if (importPattern.test(content)) {
    // Add import for new notification type
    const importMatch = content.match(/import \{[^}]+\} from '\.\/service\.item'/);
    if (importMatch) {
      const insertAfter = content.indexOf(importMatch[0]) + importMatch[0].length;
      const newImport = `\nimport { get${pascalName}Notifications, getPending${pascalName}Notifications, get${pascalName}RevisiNotifications, get${pascalName}CombinedSenderNotifications, type ${pascalName}Notification } from './service.${moduleLower}'`;
      
      // Only add if not already present
      if (!content.includes(`from './service.${moduleLower}'`)) {
        content = content.slice(0, insertAfter) + newImport + content.slice(insertAfter);
      }
    }
  }
  
  // Update getNotifications Promise.all to include new type
  const promiseAllPattern = /const \[itemsResponse, prResponse\] = await Promise\.all\(\[/;
  if (promiseAllPattern.test(content) && !content.includes(`${moduleLower}Response`)) {
    // Add new notification fetch to Promise.all
    content = content.replace(
      /const \[itemsResponse, prResponse\] = await Promise\.all\(\[/,
      `const [itemsResponse, prResponse, ${moduleLower}Response] = await Promise.all([`
    );
    
    // Add the actual fetch call
    content = content.replace(
      /getPurchaseRequestNotifications\(page, limit\)\.catch\(\(\) => \(\{ data: \[\], status: 'error' \}\)\)\s*\]/,
      `getPurchaseRequestNotifications(page, limit).catch(() => ({ data: [], status: 'error' })),
    get${pascalName}Notifications(page, limit).catch(() => ({ data: [], status: 'error' }))
  ]`
    );
    
    // Update combinedData to include new type
    content = content.replace(
      /const combinedData = \[\.\.\.\itemsResponse\.data, \.\.\.\prResponse\.data\]/,
      `const combinedData = [...itemsResponse.data, ...prResponse.data, ...${moduleLower}Response.data]`
    );
  }
  
  fs.writeFileSync(serviceFilePath, content, 'utf8');
  colorLog(`✅ Updated: service.ts with ${pascalName} re-exports`, 'green');
}

function updateNotifikasiVue(moduleName, apiEndpoint, pascalName, moduleLower, notificationType, routePath, moduleReadable) {
  const notifikasiVuePath = path.join(notifikasiPath, 'notifikasi.vue');
  
  if (!fs.existsSync(notifikasiVuePath)) {
    colorLog(`⚠️  notifikasi.vue not found, skipping update`, 'yellow');
    return;
  }
  
  let content = fs.readFileSync(notifikasiVuePath, 'utf8');
  
  // Check if already added
  if (content.includes(`notification_type === '${notificationType}'`)) {
    colorLog(`ℹ️  ${notificationType} section already exists in notifikasi.vue`, 'gray');
    return;
  }
  
  colorLog(`📄 Updating notifikasi.vue with ${pascalName} section...`, 'cyan');
  
  // This is complex - for now, just log instructions
  colorLog(`\n⚠️  Please manually add the following to notifikasi.vue:`, 'yellow');
  colorLog(`   1. Import get${pascalName}Notifications from './service.${moduleLower}'`, 'gray');
  colorLog(`   2. Add computed for ${moduleLower}Notifications filtering by notification_type === '${notificationType}'`, 'gray');
  colorLog(`   3. Add AccordionItem section for ${moduleReadable} notifications`, 'gray');
  colorLog(`   4. Update openDetailDialog to handle notification_type === '${notificationType}'`, 'gray');
  colorLog(`\n   Route for detail: /notifikasi/${notificationType}/:id`, 'gray');
  
  // For automated update, we'll add comments as markers for future manual editing
  // This is safer than trying to parse and modify complex Vue template
}

function addNotificationRoute(pascalName, moduleLower, notificationType) {
  colorLog('\n🛣️  Adding notification route to notifications.ts...', 'cyan');
  
  let content = fs.readFileSync(notificationsRoutesPath, 'utf8');
  
  // Check if route already exists
  if (content.includes(`path: '${notificationType}'`)) {
    colorLog(`ℹ️  Notification route already exists: ${notificationType}`, 'gray');
    return;
  }
  
  // Find the generateNotificationRoutes array and add new entry
  const routesArrayPattern = /generateNotificationRoutes\(\[([\s\S]*?)\]\)/;
  const match = content.match(routesArrayPattern);
  
  if (!match) {
    colorLog('❌ Could not find generateNotificationRoutes array', 'red');
    colorLog('Please add route manually to router/notifications.ts', 'yellow');
    return;
  }
  
  // Create new notification route entry
  const newRouteEntry = `    {
      path: '${notificationType}',
      name: 'Notifikasi${pascalName}Detail',
      component: 'Notifikasi${pascalName}Detail.vue',
      title: 'Notifikasi ${pascalName}',
    },`;
  
  // Find the last entry in the array (before the closing bracket and parenthesis)
  const lines = content.split('\n');
  let insertIndex = -1;
  
  for (let i = lines.length - 1; i >= 0; i--) {
    // Look for closing bracket of the array inside generateNotificationRoutes
    if (lines[i].includes('  ])') && !insertIndex) {
      insertIndex = i;
      break;
    }
  }
  
  if (insertIndex === -1) {
    colorLog('❌ Could not find insertion point', 'red');
    return;
  }
  
  // Insert the new route entry
  const updatedLines = [
    ...lines.slice(0, insertIndex),
    newRouteEntry,
    ...lines.slice(insertIndex),
  ];
  
  // Write back to file
  fs.writeFileSync(notificationsRoutesPath, updatedLines.join('\n'), 'utf8');
  colorLog(`✅ Added notification route: /notifikasi/${notificationType}/:id`, 'green');
  colorLog(`   📝 Component: Notifikasi${pascalName}Detail.vue`, 'gray');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  colorLog(`
╔═══════════════════════════════════════════════════════════╗
║           HG - Add Route & Module Generator              ║
╚═══════════════════════════════════════════════════════════╝
`, 'cyan');

  // Parse arguments
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    colorLog('❌ Invalid arguments!', 'red');
    colorLog('Usage: node add_route.js <module_path> [api_endpoint] [route_path]', 'yellow');
    colorLog('Example: node add_route.js dev/component', 'yellow');
    colorLog('Example: node add_route.js setup/m_general', 'yellow');
    colorLog('Example: node add_route.js setup/m_general m_general /setup/m_general', 'yellow');
    process.exit(1);
  }

  const modulePath = args[0];
  let apiEndpoint = args[1] || '';
  let customRoutePath = args[2] || '';

  // Parse module path
  const parts = modulePath.split('/');
  if (parts.length < 2) {
    colorLog('❌ Invalid module path format!', 'red');
    colorLog('Format: module[/submodule]/name', 'yellow');
    colorLog('Example: setup/m_general', 'yellow');
    colorLog('Example: setup/master/m_general', 'yellow');
    colorLog('Example: purchasing/master/m_supplier', 'yellow');
    process.exit(1);
  }

  const moduleName = parts[parts.length - 1];  // Last part is always the module name
  const modulePathParts = parts;

  // Ask for API endpoint if not provided
  if (!apiEndpoint) {
    colorLog('\n📡 API Endpoint Configuration', 'cyan');
    colorLog('   Endpoint akan menjadi: /dynamic/{nama_endpoint}', 'gray');
    colorLog('   Contoh: m_general, m_supplier, m_stock', 'gray');
    console.log('');
    
    // Default suggestion is the module name
    const defaultEndpoint = moduleName.toLowerCase();
    const answer = await askQuestion(`Masukkan nama endpoint API [${defaultEndpoint}]: `);
    
    // Use default if empty
    apiEndpoint = answer.trim() || defaultEndpoint;
  }

  // Ensure endpoint is lowercase
  apiEndpoint = apiEndpoint.toLowerCase();

  // Ask for route path if not provided
  if (!customRoutePath) {
    colorLog('\n🛣️  Route Path Configuration', 'cyan');
    colorLog('   ⚠️  Route path harus sama dengan yang Anda input di Form Menu!', 'yellow');
    colorLog('   Path yang diinput di web: SETUP > MENU > Tambah Menu > Field \'Path\'', 'gray');
    console.log('');
    colorLog('   Format: /module[/submodule]/name', 'gray');
    colorLog('   Contoh: /setup/m_general, /purchasing/master/m_supplier', 'gray');
    console.log('');
    
    // Default suggestion based on module path
    const defaultRoutePath = `/${modulePathParts.join('/')}`;
    const answer = await askQuestion(`Masukkan route path [${defaultRoutePath}]: `);
    
    // Use default if empty
    customRoutePath = answer.trim() || defaultRoutePath;
  }

  // Ensure route path starts with /
  if (!customRoutePath.startsWith('/')) {
    customRoutePath = `/${customRoutePath}`;
  }

  // Ensure route path is lowercase
  customRoutePath = customRoutePath.toLowerCase();

  colorLog('\n📋 Configuration:', 'white');
  colorLog(`   Module Path: ${modulePath}`, 'gray');
  colorLog(`   Module Name: ${moduleName}`, 'gray');
  colorLog(`   Pascal Name: ${getPascalCase(moduleName)}`, 'gray');
  colorLog(`   API Endpoint: /dynamic/${apiEndpoint}`, 'gray');
  colorLog(`   Route Path: ${customRoutePath}`, 'gray');

  // Test prerequisites
  testPrerequisites();

  // Create full paths
  const targetPath = path.join(viewsPath, ...modulePathParts);
  const routePath = customRoutePath;

  colorLog(`\n   Target Path: ${targetPath}`, 'gray');
  colorLog(`   Route Path:  ${routePath}`, 'gray');

  // ====================================================================
  // ASK ABOUT DETAIL ITEMS
  // ====================================================================
  colorLog('\n❓ Detail Items Configuration', 'cyan');
  const hasDetailAns = await askQuestion('Apakah terdapat detail items? (y/n): ');
  const hasDetail = hasDetailAns.toLowerCase() === 'y';

  let detailCount = 0;
  let detailTables = [];

  if (hasDetail) {
    // Ask how many detail tables
    const detailCountAns = await askQuestion('Berapa banyak detail table yang diinginkan? (1-10) [2]: ');
    detailCount = parseInt(detailCountAns.trim() || '2');
    
    // Validate range
    if (detailCount < 1) detailCount = 1;
    if (detailCount > 10) detailCount = 10;
    
    colorLog(`\n   📊 Akan membuat ${detailCount} detail table(s)`, 'green');

    // Collect detail table names and types
    for (let i = 1; i <= detailCount; i++) {
      colorLog(`\n   📋 Konfigurasi Detail Table ${i}:`, 'cyan');
      
      const defaultName = i === 1 ? `${moduleName}_details` : `${moduleName}_details${i}`;
      const detailNameAns = await askQuestion(`   Nama detail table ${i} [${defaultName}]: `);
      const tableName = detailNameAns.trim() || defaultName;
      
      // Ask for detail type
      colorLog('   Tipe detail:', 'gray');
      colorLog('     1. Add To List (biasa - tabel manual)', 'gray');
      colorLog('     2. Button Multi Select (dengan popup)', 'gray');
      const detailTypeAns = await askQuestion('   Pilih tipe (1 atau 2) [1]: ');
      const detailType = detailTypeAns.trim() === '2' ? 'multi-select' : 'add-to-list';
      
      detailTables.push({
        index: i,
        name: tableName,
        varName: i === 1 ? 'detailArr' : `detailArr${i}`,
        type: detailType
      });
    }
  }

  // ====================================================================
  // ASK ABOUT APPROVAL WORKFLOW
  // ====================================================================
  colorLog('\n❓ Approval Workflow Configuration', 'cyan');
  colorLog('   Apakah form ini membutuhkan proses approval?', 'gray');
  colorLog('   Jika ya, akan menggunakan:', 'gray');
  colorLog('   - Status: DRAFT, IN APPROVAL, APPROVED, REJECT, REVISE', 'gray');
  colorLog('   - Send Approval button', 'gray');
  colorLog('   - Status filter dengan warna badge', 'gray');
  colorLog('   - Field req_type_user dan req_user_by (readonly)', 'gray');
  const hasApprovalAns = await askQuestion('Gunakan approval workflow? (y/n) [n]: ');
  const hasApproval = hasApprovalAns.toLowerCase() === 'y';

  colorLog('\n📋 Final Configuration:', 'white');
  colorLog(`   Module Path: ${modulePath}`, 'gray');
  colorLog(`   Module Name: ${moduleName}`, 'gray');
  colorLog(`   Pascal Name: ${getPascalCase(moduleName)}`, 'gray');
  colorLog(`   API Endpoint: /dynamic/${apiEndpoint}`, 'gray');
  colorLog(`   Route Path: ${customRoutePath}`, 'gray');
  colorLog(`   Approval Workflow: ${hasApproval ? 'YES' : 'NO'}`, hasApproval ? 'green' : 'gray');
  if (hasDetail) {
    colorLog(`   Detail Tables Count: ${detailCount}`, 'gray');
    detailTables.forEach((dt) => {
      colorLog(`     - ${dt.name} (${dt.varName}) - ${dt.type}`, 'gray');
    });
  }

  // Confirm
  colorLog('\n⚠️  Press Enter to continue or Ctrl+C to cancel...', 'yellow');
  await askQuestion('');

  // Create module structure
  createModuleStructure(targetPath, moduleName, apiEndpoint, routePath, hasDetail, detailTables, hasApproval);

  // NOTE: Detail files are NOT generated separately
  // Detail tables are already integrated in FormWithDetail.txt template
  // with tabs for multiple detail tables

  // Add routes
  addRouteToRouter(routePath, targetPath, moduleName);

  colorLog(`
╔═══════════════════════════════════════════════════════════╗
║                    ✅ SUCCESS!                            ║
╚═══════════════════════════════════════════════════════════╝

Module created successfully!

📁 Files created:
   - ${getPascalCase(moduleName)}Landing.vue${hasApproval ? ' (with approval workflow)' : ''}
   - ${getPascalCase(moduleName)}Form.vue${hasApproval ? ' (with approval fields)' : ''}
   - service.ts
${hasDetail ? detailTables.map(dt => `   - ${dt.name} (${dt.type})`).join('\n') : ''}

🛣️  Routes registered:
   - ${routePath}
   - ${routePath}/form/:id?
   - ${routePath}/view/:id

📡 API Endpoint:
   - /dynamic/${apiEndpoint}

${hasApproval ? `🔔 Notification Files Created:
   - src/views/notifikasi/Notifikasi${getPascalCase(moduleName)}Detail.vue
   - src/views/notifikasi/service.${moduleName.toLowerCase().replace(/^[mt]_/, '')}.ts
   - Router: /notifikasi/${apiEndpoint.replace(/^[mt]_/, '')}/:id

✅ Approval Workflow:
   - Status: DRAFT, IN APPROVAL, APPROVED, REJECT, REVISE
   - Send Approval Button
   - Status Filter Buttons
   - Auto-filled fields: req_type_user, req_user_by
   - Notification endpoint: /dynamic/${apiEndpoint}_notifikasi

⚠️  Manual steps for notifikasi.vue:
   1. Import get${getPascalCase(moduleName)}Notifications from service
   2. Add computed for filtering by notification_type
   3. Add AccordionItem section in template
   4. Update openDetailDialog handler

` : ''}${hasDetail ? `⚙️  Detail Configuration:\n${detailTables.map(dt => `   - ${dt.name} (${dt.type})`).join('\n')}\n` : ''}
🚀 Next steps:
   1. Verify API endpoint in service.ts
   2. Customize the forms and table columns
${hasApproval ? `   3. Update notifikasi.vue to include new notification type
   4. Setup approval notification endpoint (${apiEndpoint}_notifikasi)` : ''}
${hasDetail ? `   ${hasApproval ? '5' : '3'}. Setup detail items based on type (multi-select or add-to-list)` : ''}
${hasDetail ? `   ${hasApproval ? '6' : '4'}. Configure DataTable columns for detail section` : ''}
   ${hasApproval && hasDetail ? '7' : hasApproval || hasDetail ? '5' : '3'}. Test the routes in your browser
`, 'green');
}

main().catch(err => {
  colorLog(`\n❌ Error: ${err.message}`, 'red');
  process.exit(1);
});

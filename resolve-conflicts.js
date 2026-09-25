import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const files = [
  'backend/src/routes/productRoutes.js',
  'backend/src/routes/parcelRoutes.js',
  'backend/src/routes/parcelManagerRoutes.js',
  'backend/src/routes/whatsappWebhookRoutes.js',
  'backend/prisma/supabase-schema.sql',
  'frontend/src/components/AdminSidebar.jsx',
  'frontend/src/context/CartContext.jsx',
  'frontend/src/context/FavoritesContext.jsx',
  'frontend/src/main.jsx',
  'frontend/src/pages/AdminNetWorthPage.jsx',
  'frontend/src/pages/AdminProductsPage.jsx',
  'frontend/src/pages/AdminProfilePage.jsx',
  'frontend/src/pages/CashierPage.jsx',
  'frontend/src/pages/ProductPage.jsx',
  'frontend/src/services/api.js'
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf-8');
    // Match patterns with or without newlines
    content = content.replace(/<<<<<<< HEAD\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>> [^\r\n]*\r?\n/g, '$2');
    // Also handle cases where separator line is empty
    content = content.replace(/<<<<<<< HEAD\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>> [^\r\n]*\r?\n/g, '$1');
    fs.writeFileSync(filePath, content);
    console.log('✓ Resolved:', file);
  } else {
    console.log('✗ Not found:', file);
  }
});

console.log('Done!');

$files = @(
  "C:\Glosir\backend\src\routes\productRoutes.js",
  "C:\Glosir\backend\src\routes\parcelRoutes.js",
  "C:\Glosir\backend\src\routes\parcelManagerRoutes.js",
  "C:\Glosir\backend\src\routes\whatsappWebhookRoutes.js",
  "C:\Glosir\backend\prisma\supabase-schema.sql",
  "C:\Glosir\frontend\src\components\AdminSidebar.jsx",
  "C:\Glosir\frontend\src\context\CartContext.jsx",
  "C:\Glosir\frontend\src\context\FavoritesContext.jsx",
  "C:\Glosir\frontend\src\main.jsx",
  "C:\Glosir\frontend\src\pages\AdminNetWorthPage.jsx",
  "C:\Glosir\frontend\src\pages\AdminProductsPage.jsx",
  "C:\Glosir\frontend\src\pages\AdminProfilePage.jsx",
  "C:\Glosir\frontend\src\pages\CashierPage.jsx",
  "C:\Glosir\frontend\src\pages\ProductPage.jsx",
  "C:\Glosir\frontend\src\services\api.js"
)

foreach ($file in $files) {
  if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $resolved = $content -replace '<<<<<<< HEAD[\r\n]+([\s\S]*?)[\r\n]+=======([\r\n]+([\s\S]*?)[\r\n]+>>>>>>> [^\r\n]*)?', '$3'
    Set-Content $file $resolved -NoNewline
    Write-Host "Resolved: $file"
  }
}

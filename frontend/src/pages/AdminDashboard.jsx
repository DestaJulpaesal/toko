import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Boxes,
  CircleHelp,
  PackageSearch,
  SearchX,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiFetch } from "@/services/api";
import AdminShell from "@/layouts/AdminShell";
import DatabaseBackupIndicator from "@/components/DatabaseBackupIndicator";
import ExpiryAlertWidget from "@/components/ExpiryAlertWidget";
import DashboardMetricCard from "@/components/dashboard/DashboardMetricCard";
import DashboardTopbar from "@/components/dashboard/DashboardTopbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { logoutSession } from "@/utils/authSession";

const PERIODS = ["Hari ini", "7 hari", "Bulan ini"];

function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatShortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function readCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("glosir_user") || "null");
  } catch {
    return null;
  }
}

function getTransactionType(type) {
  if (type === "INCOME") return "Pemasukan";
  if (type === "EXPENSE") return "Pengeluaran";
  if (type === "DEBT") return "Piutang";
  if (type === "TRANSFER") return "Transfer";
  return type || "Lainnya";
}

function getPaymentStatus(item) {
  const status = item.paymentStatus || item.status;
  if (status === "PAID" || status === "COMPLETED") return { label: "Lunas", variant: "success" };
  if (status === "PARTIAL") return { label: "Sebagian", variant: "warning" };
  if (status === "PENDING") return { label: "Menunggu", variant: "warning" };
  if (status === "FAILED" || status === "VOIDED") return { label: "Gagal", variant: "danger" };
  return { label: "Tercatat", variant: "neutral" };
}

function EmptyState({ icon: Icon = CircleHelp, title, description }) {
  return (
    <div className="dashboard-empty">
      <span><Icon size={20} aria-hidden="true" /></span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3 p-5" aria-label="Memuat data">
      {[0, 1, 2].map((row) => <div key={row} className="h-10 animate-pulse rounded-md bg-muted" />)}
    </div>
  );
}

function CashflowTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dashboard-chart-tooltip">
      <strong>{label}</strong>
      <span><i className="dashboard-chart-income" />Pemasukan: {formatCurrency(payload[0]?.value)}</span>
      <span><i className="dashboard-chart-expense" />Pengeluaran: {formatCurrency(payload[1]?.value)}</span>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [currentUser] = useState(readCurrentUser);
  const [period, setPeriod] = useState("Hari ini");
  const [search, setSearch] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpense: 0,
    totalDebt: 0,
    todaysIncome: 0,
    todaysExpense: 0,
    weekIncome: 0,
    weekExpense: 0,
    monthIncome: 0,
    monthExpense: 0,
  });
  const [transactions, setTransactions] = useState([]);
  const [restockSuggestions, setRestockSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let loadingRequest = false;

    const loadDashboard = async (initial = false) => {
      if (loadingRequest) return;
      loadingRequest = true;
      if (initial) setLoading(true);

      const loadResource = async (path, label, update) => {
        const response = await apiFetch(path, { silentNotify: true });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || `${label} gagal dimuat.`);
        if (active) update(data);
      };

      try {
        const results = await Promise.allSettled([
          loadResource("/finance/summary", "Ringkasan keuangan", (data) => setSummary(data.summary || data)),
          loadResource("/finance/transactions?limit=200", "Transaksi", (data) => {
            if (Array.isArray(data.transactions)) setTransactions(data.transactions);
          }),
          loadResource("/products/restock-suggestions", "Saran restock", (data) => setRestockSuggestions(data.suggestions || [])),
        ]);
        if (!active) return;
        const failures = results.filter((result) => result.status === "rejected");
        if (failures.length) {
          console.error("Some dashboard data failed to load:", failures.map((result) => result.reason));
          setError("Sebagian data dashboard gagal dimuat. Periksa koneksi lalu coba lagi.");
        } else {
          setError("");
          setLastUpdated(new Date());
        }
      } finally {
        loadingRequest = false;
        if (active && initial) setLoading(false);
      }
    };

    loadDashboard(true);
    const timer = window.setInterval(() => loadDashboard(), 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const periodValues = {
    "Hari ini": { income: summary.todaysIncome, expense: summary.todaysExpense },
    "7 hari": { income: summary.weekIncome, expense: summary.weekExpense },
    "Bulan ini": { income: summary.monthIncome, expense: summary.monthExpense },
  }[period];
  const periodIncome = Number(periodValues.income || 0);
  const periodExpense = Number(periodValues.expense || 0);
  const periodNet = periodIncome - periodExpense;
  const normalizedSearch = search.trim().toLocaleLowerCase("id-ID");
  const filteredTransactions = useMemo(() => transactions.filter((item) => {
    if (!normalizedSearch) return true;
    return `${item.description || ""} ${item.type || ""} ${item.id || ""} ${item.customer?.name || ""}`
      .toLocaleLowerCase("id-ID").includes(normalizedSearch);
  }), [transactions, normalizedSearch]);
  const filteredRestock = useMemo(() => restockSuggestions.filter((item) => {
    if (!normalizedSearch) return true;
    return `${item.productName || ""} ${item.sku || ""} ${item.category || ""}`
      .toLocaleLowerCase("id-ID").includes(normalizedSearch);
  }), [restockSuggestions, normalizedSearch]);
  const chartData = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    const daily = transactions.filter((item) => {
      const createdAt = new Date(item.createdAt);
      return createdAt >= date && createdAt < nextDate;
    });
    return {
      label: new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(date),
      income: daily.filter((item) => item.type === "INCOME").reduce((total, item) => total + Number(item.amount || 0), 0),
      expense: daily.filter((item) => item.type === "EXPENSE").reduce((total, item) => total + Number(item.amount || 0), 0),
    };
  }), [transactions]);
  const hasWeeklyCashflow = chartData.some((item) => item.income > 0 || item.expense > 0);
  const weeklyIncome = chartData.reduce((total, item) => total + item.income, 0);
  const weeklyExpense = chartData.reduce((total, item) => total + item.expense, 0);
  const lowStockCount = Number(summary.lowStockCount ?? restockSuggestions.length);

  return (
    <AdminShell active="Dashboard" mainClassName="dashboard-shell-main">
      <div className="dashboard-saas">
        <DashboardTopbar
          search={search}
          onSearch={setSearch}
          healthy={!error && Boolean(lastUpdated)}
          loading={loading}
          lastUpdated={lastUpdated}
          user={currentUser}
          onOpenStatus={() => setStatusOpen(true)}
          onLogout={() => logoutSession(navigate)}
        />

        <div className="dashboard-content">
          <section className="dashboard-intro">
            <div>
              <p className="dashboard-eyebrow">Ringkasan toko</p>
              <h1 className="dashboard-page-title">Selamat datang, {currentUser?.name || "Owner"}.</h1>
              <p className="text-sm text-muted-foreground">Pantau pemasukan, pengeluaran, dan stok toko dengan ringkas.</p>
            </div>
            <div className="dashboard-update-label">
              <span className={`dashboard-status-dot ${!error && lastUpdated ? "is-healthy" : ""}`} />
              {loading ? "Mengambil data terbaru..." : lastUpdated ? `Diperbarui ${lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : "Menunggu data server"}
            </div>
          </section>

          {error && <div className="dashboard-error" role="alert"><AlertTriangle size={17} />{error}</div>}
          <ExpiryAlertWidget />

          <section className="dashboard-controls" aria-label="Filter dashboard">
            <div className="dashboard-period-group">
              <span className="text-sm font-medium text-muted-foreground">Periode:</span>
              <Tabs value={period} onValueChange={setPeriod}>
                <TabsList aria-label="Pilih periode">
                  {PERIODS.map((option) => <TabsTrigger key={option} value={option}>{option}</TabsTrigger>)}
                </TabsList>
              </Tabs>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Ringkasan keuangan">
            <DashboardMetricCard
              icon={Wallet}
              label="Total pemasukan"
              value={loading ? "Memuat..." : formatCurrency(periodIncome)}
              caption={`${period} · pemasukan tercatat`}
              tone="income"
            />
            <DashboardMetricCard
              icon={ArrowDownRight}
              label="Pengeluaran"
              value={loading ? "Memuat..." : formatCurrency(periodExpense)}
              caption="Terhubung ke catatan keuangan"
              tone="expense"
            />
            <DashboardMetricCard
              icon={periodNet >= 0 ? ArrowUpRight : ArrowDownRight}
              label="Laba bersih"
              value={loading ? "Memuat..." : formatCurrency(periodNet)}
              caption={periodNet >= 0 ? "Pemasukan lebih besar dari pengeluaran" : "Pengeluaran lebih besar dari pemasukan"}
              tone={periodNet >= 0 ? "positive" : "negative"}
            />
            <DashboardMetricCard
              icon={Boxes}
              label="Stok perlu diperiksa"
              value={loading ? "Memuat..." : `${lowStockCount} produk`}
              caption="Produk yang disarankan untuk restok"
              tone={lowStockCount ? "warning" : "default"}
            />
          </section>

          <>
              <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
                <Card className="xl:col-span-3">
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle>Arus kas 7 hari terakhir</CardTitle>
                      <CardDescription className="mt-1">Ringkasan dari transaksi keuangan yang tercatat.</CardDescription>
                    </div>
                    <div className="dashboard-chart-totals" aria-label="Total arus kas tujuh hari">
                      <div><span><i className="dashboard-chart-income" /> Masuk 7 hari</span><strong>{loading ? "—" : formatCurrency(weeklyIncome)}</strong></div>
                      <div><span><i className="dashboard-chart-expense" /> Keluar 7 hari</span><strong>{loading ? "—" : formatCurrency(weeklyExpense)}</strong></div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loading ? <div className="dashboard-chart-placeholder" aria-label="Memuat grafik"><div /><div /><div /><div /><div /></div> : hasWeeklyCashflow ? (
                      <div className="dashboard-chart" role="img" aria-label="Grafik pemasukan dan pengeluaran selama tujuh hari terakhir">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ top: 12, right: 8, left: 4, bottom: 0 }} barGap={4}>
                            <CartesianGrid vertical={false} stroke="#e8efeb" strokeDasharray="4 5" />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#71837b", fontSize: 11 }} tickMargin={10} />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              width={48}
                              tick={{ fill: "#71837b", fontSize: 10 }}
                              tickFormatter={(value) => value === 0 ? "0" : `${new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 0 }).format(value)}`}
                            />
                            <Tooltip content={<CashflowTooltip />} cursor={{ stroke: "#c6d8ce", strokeDasharray: "4 4" }} />
                            <Bar dataKey="income" name="Pemasukan" fill="#13845f" radius={[5, 5, 0, 0]} maxBarSize={17} isAnimationActive={false} />
                            <Bar dataKey="expense" name="Pengeluaran" fill="#4389d6" radius={[5, 5, 0, 0]} maxBarSize={17} isAnimationActive={false} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <EmptyState icon={CircleHelp} title="Belum ada arus kas" description="Grafik akan terisi setelah ada transaksi keuangan." />
                    )}
                    <div className="dashboard-chart-legend">
                      <span><i className="dashboard-chart-income" />Pemasukan</span>
                      <span><i className="dashboard-chart-expense" />Pengeluaran</span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="dashboard-stock-card xl:col-span-2">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle>Stok perlu restok</CardTitle>
                        <CardDescription className="mt-1">Produk yang perlu dicek sebelum kehabisan.</CardDescription>
                      </div>
                      <Button asChild variant="ghost" size="sm"><Link to="/admin/restock">Lihat semua</Link></Button>
                    </div>
                  </CardHeader>
                  {loading ? <LoadingRows /> : filteredRestock.length ? (
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Produk</TableHead><TableHead>Stok</TableHead><TableHead>Kondisi</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {filteredRestock.slice(0, 4).map((item, index) => {
                          const stock = Number(item.stockQty) || 0;
                          const minimum = Number(item.stockWarning ?? item.minimumStock);
                          const condition = stock <= 0 ? "Habis" : "Menipis";
                          return (
                            <TableRow key={item.variantId || `${item.productName}-${index}`}>
                              <TableCell className="max-w-40 truncate font-medium">{item.productName || "Produk"}</TableCell>
                              <TableCell className="whitespace-nowrap">{stock}{Number.isFinite(minimum) ? <span className="ml-1 text-xs text-muted-foreground">/ {minimum}</span> : null}</TableCell>
                              <TableCell><Badge className={stock <= 0 ? "dashboard-badge-danger" : "dashboard-badge-warning"}>{condition}</Badge></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <EmptyState
                      icon={normalizedSearch ? SearchX : PackageSearch}
                      title={normalizedSearch ? "Produk tidak ditemukan" : "Stok masih aman"}
                      description={normalizedSearch ? "Coba kata pencarian lain." : "Produk yang perlu direstok akan muncul di sini."}
                    />
                  )}
                </Card>
              </section>

              <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
                <Card className="min-w-0 xl:col-span-3">
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle>Transaksi terbaru</CardTitle>
                      <CardDescription className="mt-1">Catatan keuangan yang baru masuk.</CardDescription>
                    </div>
                    <Button asChild variant="ghost" size="sm"><Link to="/admin/finance">Lihat semua</Link></Button>
                  </CardHeader>
                  {loading ? <LoadingRows /> : filteredTransactions.length ? (
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Catatan</TableHead><TableHead>Jenis</TableHead><TableHead>Status</TableHead><TableHead>Waktu</TableHead><TableHead className="text-right">Total</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {filteredTransactions.slice(0, 6).map((item, index) => {
                          const status = getPaymentStatus(item);
                          const transactionType = getTransactionType(item.type);
                          return (
                            <TableRow key={item.id || `${item.createdAt}-${index}`}>
                              <TableCell className="max-w-48 truncate font-medium">{item.description || item.customer?.name || "Transaksi tanpa keterangan"}</TableCell>
                              <TableCell><Badge variant="outline">{transactionType}</Badge></TableCell>
                              <TableCell><Badge className={`dashboard-badge-${status.variant}`}>{status.label}</Badge></TableCell>
                              <TableCell className="whitespace-nowrap text-muted-foreground">{formatShortDate(item.createdAt)}</TableCell>
                              <TableCell className="whitespace-nowrap text-right font-semibold">{formatCurrency(item.amount)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <EmptyState
                      icon={normalizedSearch ? SearchX : CircleHelp}
                      title={normalizedSearch ? "Tidak ada transaksi yang cocok" : "Belum ada transaksi"}
                      description={normalizedSearch ? "Coba kata pencarian lain." : "Transaksi yang tersimpan akan tampil di sini."}
                    />
                  )}
                </Card>

                <Card className="min-w-0 xl:col-span-2">
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle>Ringkasan operasional</CardTitle>
                      <CardDescription className="mt-1">Info singkat kondisi toko hari ini.</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="dashboard-operational-row">
                      <span className="dashboard-operational-icon"><Banknote size={17} /></span>
                      <div><p>Uang tunai masuk</p><strong>{loading ? "Memuat..." : formatCurrency(summary.todayCashIncome)}</strong></div>
                      <span className="text-xs text-muted-foreground">Hari ini</span>
                    </div>
                    <div className="dashboard-operational-row">
                      <span className="dashboard-operational-icon"><PackageSearch size={17} /></span>
                      <div><p>Transaksi hari ini</p><strong>{loading ? "—" : Number(summary.todayOrderCount) || 0}</strong></div>
                      <Link className="text-xs font-medium text-primary hover:underline" to="/kasir/riwayat">Lihat</Link>
                    </div>
                    <div className="dashboard-operational-row">
                      <span className="dashboard-operational-icon"><AlertTriangle size={17} /></span>
                      <div><p>Tagihan parsel tertunda</p><strong>{loading ? "—" : Number(summary.parcelOverdueCount) || 0}</strong></div>
                      <Link className="text-xs font-medium text-primary hover:underline" to="/admin/parcel-participants">Buka</Link>
                    </div>
                    <Button asChild variant="outline" className="dashboard-operation-button w-full">
                      <Link to="/admin/finance">Buka buku kas</Link>
                    </Button>
                  </CardContent>
                </Card>
              </section>
          </>
          <footer className="dashboard-footer">Glosir · Ringkasan operasional toko</footer>
        </div>

        <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Status sistem</DialogTitle>
              <DialogDescription>Status database, waktu backup terakhir, dan pengujian operasional.</DialogDescription>
            </DialogHeader>
            <div className="dashboard-status-summary">
              <span className={`dashboard-status-dot ${!error && lastUpdated ? "is-healthy" : ""}`} />
              <div>
                <strong>{error ? "Perlu diperiksa" : lastUpdated ? "Database aktif" : "Menghubungkan ke database"}</strong>
                <p>{error || (lastUpdated ? `Data dashboard terakhir diperbarui ${lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}.` : "Status akan diperbarui setelah data server diterima.")}</p>
              </div>
            </div>
            <DatabaseBackupIndicator />
          </DialogContent>
        </Dialog>
      </div>
    </AdminShell>
  );
}

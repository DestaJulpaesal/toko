import { Link } from "react-router-dom";
import { Activity, LogOut, Search, Settings, ShoppingCart, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function DashboardTopbar({ search, onSearch, healthy, loading, lastUpdated, user, onOpenStatus, onLogout }) {
  const displayName = user?.name || "Owner Glosir";
  const initials = displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "OG";

  return (
    <header className="dashboard-topbar">
      <div className="dashboard-topbar-brand flex min-w-0 items-center gap-3">
        <span className="dashboard-brand-mark" aria-hidden="true">G</span>
        <div className="hidden min-w-0 sm:block">
          <p className="text-sm font-semibold leading-tight text-foreground">Glosir</p>
          <p className="text-xs text-muted-foreground">Workspace toko</p>
        </div>
      </div>

      <label className="dashboard-search flex" aria-label="Cari transaksi atau produk">
        <Search size={17} aria-hidden="true" />
        <Input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Cari transaksi atau produk..."
          className="h-9 min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
      </label>

      <div className="dashboard-topbar-actions flex shrink-0 items-center gap-2 sm:gap-3">
        <Button asChild size="sm" className="dashboard-cashier-button h-9 px-3">
          <Link to="/kasir"><ShoppingCart aria-hidden="true" /> <span className="hidden sm:inline">Buka kasir</span><span className="sm:hidden">Kasir</span></Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="dashboard-health-button h-9 gap-2 px-3"
          onClick={onOpenStatus}
          aria-label="Lihat status sistem dan backup"
        >
          <span className={`dashboard-status-dot ${healthy && !loading ? "is-healthy" : ""}`} />
          <span className="hidden sm:inline">{loading ? "Memuat" : healthy ? "Sistem normal" : "Periksa sistem"}</span>
          <Activity className="lg:hidden" size={16} aria-hidden="true" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="dashboard-profile h-10 gap-2 rounded-full px-1.5 sm:pr-2" aria-label="Buka menu profil">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-28 truncate text-sm sm:block">{displayName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <span className="block truncate">{displayName}</span>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">Owner Glosir</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link to="/admin/profile"><UserRound aria-hidden="true" /> Profil</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/admin/settings"><Settings aria-hidden="true" /> Pengaturan</Link></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onLogout}><LogOut aria-hidden="true" /> Keluar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {lastUpdated && <span className="sr-only">Data diperbarui {lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>}
    </header>
  );
}

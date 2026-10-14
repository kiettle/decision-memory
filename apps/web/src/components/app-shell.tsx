import { Box, Building2, Clock3, FileText, Menu, Settings } from "lucide-react"
import { useEffect, useState } from "react"
import { NavLink, Outlet } from "react-router-dom"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { Metadata } from "@/types"

const navigation = [
  { label: "Decisions", icon: FileText, to: "/" },
  { label: "Scopes", icon: Box, to: "/scopes" },
  { label: "Recent", icon: Clock3, to: "/recent" },
  { label: "Settings", icon: Settings, to: "/settings" },
]

const initialsOf = (name = "") =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

export function AppShell() {
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [navigationOpen, setNavigationOpen] = useState(false)
  useEffect(() => {
    api
      .metadata()
      .then(setMetadata)
      .catch(() => setMetadata(null))
  }, [])
  const userName = metadata?.currentUser.displayName ?? ""

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="mobile-header">
        <Brand compact />
        <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
          <SheetTrigger
            render={
              <Button variant="ghost" size="lg" aria-label="Open navigation" />
            }
          >
            <Menu data-icon="inline-start" />
            <Avatar size="sm">
              <AvatarFallback>{initialsOf(userName)}</AvatarFallback>
            </Avatar>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
              <SheetDescription>
                {metadata?.workspace.name ?? "Your workspace"}
              </SheetDescription>
            </SheetHeader>
            <nav
              className="flex flex-col gap-1 px-3"
              aria-label="Mobile navigation"
            >
              <NavigationLinks onNavigate={() => setNavigationOpen(false)} />
            </nav>
            <SheetFooter>
              <div className="flex items-center gap-3">
                <Avatar size="sm">
                  <AvatarFallback>{initialsOf(userName)}</AvatarFallback>
                </Avatar>
                <span>{userName}</span>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </header>

      <aside className="desktop-sidebar">
        <Brand />
        <nav className="flex flex-col gap-1" aria-label="Primary navigation">
          <NavigationLinks />
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <div className="sidebar-meta">
            <Building2 aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-left">
              {metadata?.workspace.name}
            </span>
          </div>
          <div className="h-px bg-border" />
          <div className="sidebar-meta">
            <Avatar size="sm">
              <AvatarFallback>{initialsOf(userName)}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-left">
              {userName}
            </span>
          </div>
        </div>
      </aside>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}

function NavigationLinks({ onNavigate }: { onNavigate?: () => void }) {
  return navigation.map(({ label, icon: Icon, to }) => (
    <NavLink
      key={label}
      to={to}
      end={to === "/"}
      onClick={onNavigate}
      className={({ isActive }: { isActive: boolean }) =>
        cn("sidebar-link", isActive && "sidebar-link-active")
      }
    >
      <Icon aria-hidden="true" />
      {label}
    </NavLink>
  ))
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", !compact && "px-3")}>
      <div className="brand-mark" aria-hidden="true">
        <span />
        <span />
      </div>
      <span
        className={cn(
          "text-[17px] leading-[18px] font-bold tracking-[-0.02em]",
          !compact && "max-w-24"
        )}
      >
        Decision{" "}
        {compact ? (
          "Memory"
        ) : (
          <>
            <br />
            Memory
          </>
        )}
      </span>
    </div>
  )
}

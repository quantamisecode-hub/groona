import React, { createContext, useContext, useState, useEffect } from 'react';
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const SidebarContext = createContext(undefined);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

export function SidebarProvider({ children, defaultOpen = true, open: openProp, onOpenChange: setOpenProp }) {
  const [openState, setOpenState] = useState(defaultOpen);
  const [openMobile, setOpenMobile] = useState(false);

  // Use controlled or uncontrolled state
  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  // Helper to toggle
  const toggleSidebar = () => setOpen(!open);

  // Mobile check
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile(); // Check immediately
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <SidebarContext.Provider value={{
      state: open ? "expanded" : "collapsed",
      open,
      setOpen,
      openMobile,
      setOpenMobile,
      isMobile,
      toggleSidebar
    }}>
      <div className="group/sidebar-wrapper flex min-h-screen w-full bg-slate-50/50">
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function Sidebar({ className, children, side = "left", ...props }) {
  const { isMobile, openMobile, setOpenMobile, open } = useSidebar();

  // Mobile drawer logic
  if (isMobile) {
    return (
      <>
        <div
          className={cn(
            "fixed inset-0 z-[100] bg-black/80 transition-opacity duration-300 ease-in-out",
            openMobile ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={() => setOpenMobile(false)}
        />
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-[100] w-[280px] bg-white shadow-lg transition-transform duration-300 ease-in-out",
            openMobile ? "translate-x-0" : "-translate-x-full",
            className
          )}
          {...props}
        >
          <div className="absolute right-4 top-4 opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpenMobile(false)}>
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
          <div className="flex flex-col h-full">
            {children}
          </div>
        </div>
      </>
    );
  }

  // Desktop sidebar - Always present, width controlled by 'open' state
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen z-30 bg-white border-r transition-all duration-300 ease-in-out flex flex-col",
        open ? "w-[280px]" : "w-[0px] overflow-hidden border-none",
        className
      )}
      {...props}
    >
      <div className="flex flex-col h-full w-full overflow-y-auto overflow-x-hidden">
        {children}
      </div>
    </aside>
  );
}

export function SidebarTrigger({ className, onClick, ...props }) {
  const { toggleSidebar, openMobile, setOpenMobile, isMobile } = useSidebar();

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-9 w-9", className)}
      onClick={(e) => {
        onClick?.(e);
        if (isMobile) {
          setOpenMobile(!openMobile);
        } else {
          toggleSidebar();
        }
      }}
      {...props}
    >
      <Menu className="h-5 w-5" />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
}

export function SidebarHeader({ className, ...props }) {
  return <div className={cn("flex flex-col p-4", className)} {...props} />;
}

export function SidebarContent({ className, ...props }) {
  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col gap-2 overflow-auto", className)}
      {...props}
    />
  );
}

export function SidebarFooter({ className, ...props }) {
  return <div className={cn("flex flex-col p-4", className)} {...props} />;
}

export function SidebarGroup({ className, ...props }) {
  return <div className={cn("relative flex w-full min-w-0 flex-col p-2", className)} {...props} />;
}

export function SidebarGroupLabel({ className, asChild = false, ...props }) {
  const Comp = asChild ? React.Slot : "div";
  return (
    <Comp
      className={cn(
        "flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-slate-500 outline-none ring-sidebar-ring transition-[margin,opa] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        className
      )}
      {...props}
    />
  );
}

export function SidebarGroupContent({ className, ...props }) {
  return <div className={cn("w-full text-sm", className)} {...props} />;
}

export function SidebarMenu({ className, ...props }) {
  return <ul className={cn("flex w-full min-w-0 flex-col gap-1", className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }) {
  return <li className={cn("group/menu-item relative", className)} {...props} />;
}

export function SidebarMenuButton({
  asChild = false,
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}) {
  const Comp = asChild ? React.Fragment : "button";

  if (asChild) {
    const child = React.Children.only(props.children);
    return React.cloneElement(child, {
      className: cn(
        "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:shadow-sm focus-visible:ring-2 active:shadow-sm disabled:pointer-events-none data-[state=open]:hover:shadow-sm",
        className,
        child.props.className
      ),
      "data-active": isActive,
      "data-size": size,
      "data-variant": variant,
    });
  }

  return (
    <button
      data-active={isActive}
      data-size={size}
      data-variant={variant}
      className={cn(
        "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:shadow-sm focus-visible:ring-2 active:shadow-sm disabled:pointer-events-none data-[active=true]:bg-slate-100 data-[active=true]:font-medium data-[active=true]:text-slate-900 data-[state=open]:hover:shadow-sm",
        className
      )}
      {...props}
    />
  );
}
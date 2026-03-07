"use client";
import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"
import { CheckCircle2, XCircle, Info, AlertTriangle } from "lucide-react"

const Toaster = ({
  ...props
}) => {
  const { theme = "system" } = useTheme()

  return (
    (<Sonner
      theme={theme}
      className="toaster group"
      visibleToasts={5} // Nice stacking
      icons={{
        success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
        info: <Info className="h-5 w-5 text-blue-500" />,
        warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
        error: <XCircle className="h-5 w-5 text-red-500" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-900 group-[.toaster]:border-slate-100 group-[.toaster]:shadow-[0_20px_50px_rgba(0,0,0,0.1)] group-[.toaster]:rounded-xl group-[.toaster]:px-6 group-[.toaster]:py-4 group-[.toaster]:font-bold group-[.toaster]:text-base group-[.toaster]:gap-3 group-[.toaster]:backdrop-blur-xl",
          description: "group-[.toast]:text-slate-500",
          actionButton:
            "group-[.toast]:bg-slate-900 group-[.toast]:text-slate-50 group-[.toast]:rounded-lg group-[.toast]:px-4",
          cancelButton:
            "group-[.toast]:bg-slate-100 group-[.toast]:text-slate-500 group-[.toast]:rounded-lg group-[.toast]:px-4",
        },
      }}
      {...props} />)
  );
}

export { Toaster }

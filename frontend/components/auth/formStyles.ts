// Shared field styles for the sign-in, forgot-password and reset-password pages.
// The --auth-* colour tokens are set by <AuthLayout>.

export const authInputCls =
  "h-12 lg:h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-11 text-[15px] lg:text-sm text-slate-900 " +
  "placeholder:text-slate-400 outline-none transition-[border-color,box-shadow] duration-150 hover:border-slate-400 " +
  "focus:border-[var(--auth-600)] focus:ring-[3px] focus:ring-[var(--auth-500)]/25 disabled:cursor-not-allowed disabled:opacity-50"

export const authLabelCls = "block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5"

export const authButtonCls =
  "group flex h-12 lg:h-11 w-full items-center justify-center gap-2.5 rounded-xl text-[15px] lg:text-sm font-semibold text-white " +
  "bg-[var(--auth-600)] transition-[filter,transform] duration-150 hover:brightness-95 enabled:active:scale-[0.98] " +
  "disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--auth-600)] " +
  "shadow-[0_1px_2px_rgb(15_23_42/0.15),0_8px_18px_-6px_rgb(22_163_74/0.6),inset_0_1px_0_rgb(255_255_255/0.15)]"

export const authLinkCls = "font-semibold text-[var(--auth-700)] hover:underline underline-offset-2"

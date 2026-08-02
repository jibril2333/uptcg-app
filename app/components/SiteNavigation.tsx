const navItems = [
  { id: "home", icon: "⌂", label: "首頁", href: "/" },
  { id: "cards", icon: "▱", label: "官方卡表", href: "/cards" },
  { id: "rules", icon: "⚖", label: "規則與禁卡", href: "/rules" },
  { id: "decks", icon: "♧", label: "我的牌組", href: "/decks" },
  { id: "collection", icon: "▦", label: "我的收集", href: "/collection" },
  { id: "settings", icon: "⚙", label: "設定", href: "/settings" },
];

const mobileNavItems = navItems;

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a className={compact ? "brand brand--compact" : "brand"} href="/">
      <img src="/assets/uptcg-logo.png" alt="UPTCG" />
      <span>
        <strong>UPTCG</strong>
        {!compact && <small>UNION ARENA TCG</small>}
      </span>
    </a>
  );
}

export function SiteNavigation({ active }: { active: "home" | "cards" | "rules" | "decks" | "collection" | "settings" }) {
  return (
    <>
      <header className="mobile-header">
        <Brand compact />
        <details className="mobile-menu">
          <summary aria-label="開啟選單"><span /><span /><span /></summary>
          <nav aria-label="行動版選單">
            {navItems.map((item) => (
              <a className={item.id === active ? "is-active" : ""} key={item.id} href={item.href}>
                <span aria-hidden="true">{item.icon}</span>{item.label}
              </a>
            ))}
          </nav>
        </details>
      </header>

      <aside className="sidebar">
        <Brand />
        <p className="sidebar__eyebrow">選單</p>
        <nav className="sidebar__nav" aria-label="主要選單">
          {navItems.map((item) => (
            <a className={item.id === active ? "is-active" : ""} key={item.id} href={item.href}>
              <span aria-hidden="true">{item.icon}</span>{item.label}
            </a>
          ))}
        </nav>
      </aside>

      <nav className="bottom-nav" aria-label="行動版主要選單">
        {mobileNavItems.map((item) => (
          <a className={item.id === active ? "is-active" : ""} key={item.id} href={item.href}>
            <span aria-hidden="true">{item.icon}</span><small>{item.label}</small>
          </a>
        ))}
      </nav>
    </>
  );
}

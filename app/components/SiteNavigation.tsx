import Link from "next/link";

const navItems = [
  { id: "home", label: "首頁", href: "/" },
  { id: "cards", label: "官方卡表", href: "/cards" },
  { id: "rules", label: "規則與禁卡", href: "/rules" },
  { id: "decks", label: "我的牌組", href: "/decks" },
  { id: "collection", label: "我的收集", href: "/collection" },
  { id: "settings", label: "設定", href: "/settings" },
] as const;

const mobileNavItems = navItems;

function NavigationIcon({ name }: { name: typeof navItems[number]["id"] }) {
  const paths = {
    home: "m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
    cards: "M8 3h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM3 7v12a3 3 0 0 0 3 3h10M10 7h7M10 11h5",
    rules: "M12 3v18M7 21h10M4 7h16M5 7l-3 7h6L5 7Zm14 0-3 7h6l-3-7Z",
    decks: "M4 3h16v18l-8-5-8 5V3ZM8 7h8M8 11h6",
    collection: "M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z",
    settings: "M4 7h16M4 17h16M8 4v6M16 14v6",
  };
  return <svg className="navigation-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={compact ? "brand brand--compact" : "brand"} href="/">
      <img src="/assets/uptcg-logo.png" alt="UPTCG" />
      <span>
        <strong>UPTCG</strong>
        {!compact && <small>UNION ARENA TCG</small>}
      </span>
    </Link>
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
              <Link className={item.id === active ? "is-active" : ""} aria-current={item.id === active ? "page" : undefined} key={item.id} href={item.href}>
                <span aria-hidden="true"><NavigationIcon name={item.id} /></span>{item.label}
              </Link>
            ))}
          </nav>
        </details>
      </header>

      <aside className="spatial-sidebar">
        <Brand />
        <div className="spatial-sidebar__context">
          <small>PERSONAL CARD SPACE</small>
          <strong>{navItems.find((item) => item.id === active)?.label}</strong>
        </div>
        <nav className="spatial-sidebar__nav" aria-label="主要選單">
          {navItems.map((item) => (
            <Link className={item.id === active ? "is-active" : ""} aria-current={item.id === active ? "page" : undefined} key={item.id} href={item.href}>
              <span aria-hidden="true"><NavigationIcon name={item.id} /></span><strong>{item.label}</strong>
            </Link>
          ))}
        </nav>
        <span className="spatial-sidebar__status"><i />DATA ONLINE</span>
      </aside>

      <nav className="bottom-nav" aria-label="行動版主要選單">
        {mobileNavItems.map((item) => (
          <Link className={item.id === active ? "is-active" : ""} aria-current={item.id === active ? "page" : undefined} key={item.id} href={item.href}>
            <span aria-hidden="true"><NavigationIcon name={item.id} /></span><small>{item.label}</small>
          </Link>
        ))}
      </nav>
    </>
  );
}

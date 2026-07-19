/**
 * SD-8: Переключатель вкладок страницы SessionDetail.
 *
 * SD-20: Встроен в шапку общей карточки результатов/кругов/прогресса —
 * теперь единственный «заголовок» этой карточки (текст «Итоговые
 * результаты» убран, вкладки сами обозначают текущий раздел).
 */
import type { SessionTabItem, SessionTabKey } from './types';

interface SessionTabsProps {
  tabs: SessionTabItem[];
  active: SessionTabKey;
  onChange: (key: SessionTabKey) => void;
}

export function SessionTabs({ tabs, active, onChange }: SessionTabsProps) {
  return (
    <nav
      role="tablist"
      aria-label="Разделы сессии"
      className="flex gap-1 border-b border-border bg-secondary/40 px-2 pt-2"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.key}`}
            onClick={() => onChange(tab.key)}
            className={[
              'px-4 py-2 text-sm font-medium transition-colors',
              '-mb-px border-b-2',
              isActive
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
            ].join(' ')}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

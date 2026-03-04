import type { Section } from '../hooks/useSections';
import '../styles/section-nav.css';

interface SectionNavProps {
  sections: Section[];
  onSectionClick: (sectionId: string) => void;
}

export function SectionNav({ sections, onSectionClick }: SectionNavProps) {
  if (sections.length === 0) {
    return (
      <nav className="section-nav">
        <div className="section-nav-empty">No sections</div>
      </nav>
    );
  }

  const reviewed = sections.filter(
    (s) => s.status === 'approved' || s.status === 'rejected',
  ).length;

  return (
    <nav className="section-nav">
      <div className="section-nav-summary">
        {reviewed}/{sections.length} reviewed
      </div>
      <ul className="section-nav-list">
        {sections.map((section) => (
          <li key={section.id} className="section-nav-item">
            <button className="section-nav-link" onClick={() => onSectionClick(section.id)}>
              <span className={`section-nav-badge section-nav-badge-${section.status}`} />
              <span className="section-nav-text">{section.heading}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

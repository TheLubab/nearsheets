import { Dialog } from './ui/dialog';
import { ChatRoundDotsIcon } from '@solar-icons/react/linear/chat-round-dots';
import { MapIcon } from '@solar-icons/react/linear/map';
import { HistoryIcon } from '@solar-icons/react/linear/history';
import { FileTextIcon } from '@solar-icons/react/linear/file-text';

const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
const LINKS = [
  { label: 'GitHub', detail: 'Explore the code', href: 'https://github.com/TheLubab/nearsheets', icon: FileTextIcon },
  { label: 'Feedback', detail: 'Share an idea or report a bug', href: 'https://nearsheets.userjot.com/', icon: ChatRoundDotsIcon },
  { label: 'Roadmap', detail: 'See what’s planned', href: 'https://nearsheets.userjot.com/roadmap', icon: MapIcon },
  { label: 'Changelog', detail: 'See the latest updates', href: 'https://nearsheets.userjot.com/updates', icon: HistoryIcon },
];

export function AboutNearSheets({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  return <Dialog className="about-nearsheets" open={open} onOpenChange={onOpenChange} title="About NearSheets" description="Your treasury, in a spreadsheet.">
    <div className="about-nearsheets__intro">
      <img src={`${import.meta.env.BASE_URL}near-sheets-mark.svg`} width={48} height={40} alt=""/>
      <p>Bring NEAR balances, treasury approvals and cross-chain workflows into a familiar spreadsheet. Use cells and formulas to plan budgets, prepare actions and track their outcomes.</p>
    </div>
    <p className="about-nearsheets__note">Formulas read data and prepare drafts. You choose what to review and sign with your wallet. Spreadsheets save in this browser; download a JSON backup to keep a copy.</p>
    <nav className="about-nearsheets__links" aria-label="Project links">
      {LINKS.map(({ label, detail, href, icon: Icon }) => <a key={label} href={href} target="_blank" rel="noreferrer">
        <Icon size={20} aria-hidden="true"/>
        <span><strong>{label}</strong><small>{detail}</small></span>
        <span className="about-nearsheets__external" aria-hidden="true">↗</span>
      </a>)}
    </nav>
    <section className="about-nearsheets__license" aria-label="Project license">
      <h3>License</h3>
      <p>Source-available under the <a href="https://github.com/TheLubab/nearsheets/blob/HEAD/LICENSE" target="_blank" rel="noreferrer">Elastic License 2.0</a>.</p>
      <small>© 2026 NearSheets contributors. Third-party software retains its own licenses.</small>
    </section>
    <details className="about-nearsheets__credits">
      <summary>Credits</summary>
      <p>Built with Univer and React, using NEAR, Sputnik DAO and NEAR Intents.</p>
      <p>Solar icons by <a href="https://www.figma.com/community/file/1166831539721848736" target="_blank" rel="noreferrer">480 Design</a>, used under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. React components by <a href="https://solar-icons.dev" target="_blank" rel="noreferrer">Solar Icons</a>.</p>
    </details>
    <footer className="about-nearsheets__version">Version {VERSION}</footer>
  </Dialog>;
}

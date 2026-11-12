import * as Menubar from '@radix-ui/react-menubar';
import { QuestionCircleIcon } from '@solar-icons/react/linear/question-circle';
import { ChatRoundDotsIcon } from '@solar-icons/react/linear/chat-round-dots';
import { MapIcon } from '@solar-icons/react/linear/map';
import { HistoryIcon } from '@solar-icons/react/linear/history';
import { env } from '../config/env';
import { defaultRpcUrl } from '../integrations/near/network';

const HELP_LINKS = [
  { label: 'Feedback', href: 'https://nearsheets.userjot.com/', icon: ChatRoundDotsIcon },
  { label: 'Roadmap', href: 'https://nearsheets.userjot.com/roadmap', icon: MapIcon },
  { label: 'Changelog', href: 'https://nearsheets.userjot.com/updates', icon: HistoryIcon },
] as const;

const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
const hostOf = (url: string) => { try { return new URL(url).host; } catch { return url; } };
const RPC_HOST = hostOf(env.VITE_NEAR_RPC_URL ?? defaultRpcUrl(env.VITE_NEAR_NETWORK));
const INTENTS_HOST = env.VITE_INTENTS_API_URL ? hostOf(env.VITE_INTENTS_API_URL) : 'Disabled';

export function HelpMenu({ onGettingStarted, onInterfaceTour, onBlockchainTour }: { onGettingStarted?(): void; onInterfaceTour?(): void; onBlockchainTour?(): void }) {
  return <Menubar.Root className="header-menu">
    <Menubar.Menu>
      <Menubar.Trigger className="header-menu__trigger" aria-label="Help and feedback" title="Help and feedback">
        <QuestionCircleIcon size={24} strokeWidth={2} aria-hidden="true"/>
      </Menubar.Trigger>
      <Menubar.Portal>
        <Menubar.Content className="menu-content help-menu__content" align="end" sideOffset={6}>
          {onGettingStarted ? <Menubar.Item className="menu-item" onSelect={onGettingStarted}>Getting started</Menubar.Item> : null}
          {onInterfaceTour ? <Menubar.Item className="menu-item" onSelect={onInterfaceTour}>Tour the interface</Menubar.Item> : null}
          {onBlockchainTour ? <Menubar.Item className="menu-item" onSelect={onBlockchainTour}>Tour Blockchain tools</Menubar.Item> : null}
          {onGettingStarted ? <Menubar.Separator className="menu-separator"/> : null}
          {HELP_LINKS.map(({ label, href, icon: Icon }) => <Menubar.Item key={label} className="menu-item menu-item--link" asChild>
            <a href={href} target="_blank" rel="noreferrer"><Icon size={16} aria-hidden="true"/>{label}</a>
          </Menubar.Item>)}
          <Menubar.Separator className="menu-separator"/>
          <div className="help-menu__about">
            <strong>NearSheets</strong>
            <dl className="help-menu__facts">
              <dt>Version</dt><dd>{VERSION}</dd>
              <dt>Network</dt><dd>{env.VITE_NEAR_NETWORK}</dd>
              <dt>RPC</dt><dd>{RPC_HOST}</dd>
              <dt>Intents API</dt><dd>{INTENTS_HOST}</dd>
            </dl>
          </div>
        </Menubar.Content>
      </Menubar.Portal>
    </Menubar.Menu>
  </Menubar.Root>;
}

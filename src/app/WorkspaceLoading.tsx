import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LOADING_COPY } from './loading-copy';

const PHOTOS = [
  { file: 'startup-flowers.jpg', author: 'Olga Tutunaru', credit: 'https://unsplash.com/photos/white-flowers-with-green-leaves-B9hX9HnTm2Q' },
  { file: 'startup-lavender-field.jpg', author: 'Dimitri Iakymuk', credit: 'https://unsplash.com/photos/purple-flower-field-under-blue-sky-during-daytime-mCR10j_B6sM' },
  { file: 'startup-purple-flowers.jpg', author: 'Isabella Fischer', credit: 'https://unsplash.com/photos/purple-petaled-flower-plants-nBcOnMoP18g' },
] as const;
const startupPhoto = PHOTOS[Math.floor(Math.random() * PHOTOS.length)] ?? PHOTOS[0];
let previousPrefix: string | undefined;

/** Keep the existing scene briefly while the ready editor is revealed beneath it. */
export function WorkspaceLoading({ error, active = true }: { error?: string | null; active?: boolean }) {
  const [mounted, setMounted] = useState(active);
  useLayoutEffect(() => {
    if (active) { setMounted(true); return; }
    if (!mounted) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMounted(false);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), 250);
    return () => window.clearTimeout(timer);
  }, [active, mounted]);
  return mounted ? <LoadingScene error={error} exiting={!active}/> : null;
}

function LoadingScene({ error, exiting }: { error?: string | null; exiting: boolean }) {
  const photoRef = useRef<HTMLImageElement>(null);
  const [appearance, setAppearance] = useState<'pending' | 'photo' | 'fallback'>('pending');
  useEffect(() => {
    let active = true;
    // Decode the photo and load the headline font before revealing the whole scene.
    // A missing asset must not hide progress or recovery controls indefinitely.
    const timeout = window.setTimeout(() => {
      if (active) setAppearance(current => current === 'pending' ? 'fallback' : current);
    }, 2000);
    const imageReady = photoRef.current?.decode().then(() => true, () => false) ?? Promise.resolve(false);
    const fontReady = document.fonts.load('500 27px "Inter Variable"').catch(() => []);
    void Promise.all([imageReady, fontReady]).then(([decoded]) => {
      if (!active) return;
      window.clearTimeout(timeout);
      setAppearance(current => current === 'pending' ? decoded ? 'photo' : 'fallback' : current);
    });
    return () => { active = false; window.clearTimeout(timeout); };
  }, []);
  const visible = !!error || appearance !== 'pending';
  // Choose once for this appearance, not on the subject's React re-renders.
  const [copy] = useState(() => {
    const choices = LOADING_COPY.filter(value => value.prefix !== previousPrefix);
    const selected = choices[Math.floor(Math.random() * choices.length)]!;
    const subjects: string[] = [...selected.subjects];
    for (let index = subjects.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [subjects[index], subjects[other]] = [subjects[other]!, subjects[index]!];
    }
    return { prefix: selected.prefix, subjects };
  });
  useEffect(() => { previousPrefix = copy.prefix; }, [copy]);
  const [subject, setSubject] = useState(0);
  useEffect(() => {
    if (exiting || !visible || error || subject >= copy.subjects.length - 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Walk the shuffled subjects once, then hold the last rather than repeating.
    const timer = window.setTimeout(() => setSubject(previous => previous + 1), 1300);
    return () => window.clearTimeout(timer);
  }, [exiting, visible, error, copy, subject]);

  return <section className="workspace-loading" data-exiting={exiting} data-visible={visible} data-appearance={appearance} inert={exiting} aria-hidden={exiting || undefined} aria-label={error ? 'Spreadsheet could not open' : 'Opening spreadsheet'}>
    <div className="workspace-loading__backdrop" aria-hidden="true">
      <img ref={photoRef} className="workspace-loading__photo" src={`${import.meta.env.BASE_URL}${startupPhoto.file}`} alt="" loading="eager" fetchPriority="high"/>
    </div>
    <div className="workspace-loading__panel">
      {error ? <div role="alert">
        <span className="workspace-loading__eyebrow">Let’s try that again</span>
        <h2>We couldn’t open your spreadsheet.</h2>
        <p>Reload to try again. Your saved spreadsheets will stay on this device.</p>
        <button type="button" onClick={() => window.location.reload()}>Reload NearSheets</button>
        <details><summary>Error details</summary><p>{error}</p></details>
      </div> : <>
        <h2 className="workspace-loading__message" aria-hidden="true">
          <span className="workspace-loading__prefix">{copy.prefix}</span>
          <span className="workspace-loading__subject">{copy.subjects[subject]}</span>
        </h2>
        <p className="workspace-loading__status" role="status" aria-label="Opening your spreadsheet">
          <span className="workspace-loading__pixels" aria-hidden="true">
            {Array.from({ length: 9 }, (_, index) => <span key={index} style={{ animationDelay: `${-((Math.floor(index / 3) + index % 3) * 140)}ms` }}/>) }
          </span>
        </p>
      </>}
    </div>
    <a className="workspace-loading__credit" href={startupPhoto.credit} target="_blank" rel="noopener noreferrer">Photo · {startupPhoto.author} / Unsplash ↗</a>
  </section>;
}

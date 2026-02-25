// App header with title and subtitle.
import { APP_NAME } from '@shared/constants';

type HeaderProps = {
  subtitle?: string;
};

export default function Header({ subtitle }: HeaderProps) {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">Unreal build desk</p>
        <div className="title-wrap">
          <span className="title-star star-1" aria-hidden="true" />
          <span className="title-star star-2" aria-hidden="true" />
          <span className="title-star star-3" aria-hidden="true" />
          <span className="title-star star-4" aria-hidden="true" />
          <h1>{APP_NAME}</h1>
        </div>
      </div>
      <p className="subtitle">{subtitle ?? 'Build, track, and ship Unreal projects without leaving your desktop.'}</p>
    </header>
  );
}

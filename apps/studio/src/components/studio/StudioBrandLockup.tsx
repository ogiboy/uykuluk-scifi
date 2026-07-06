import Image from "next/image";
import Link from "next/link";

import channelLogo from "../../../../../assets/brand/uykulukscifi_channel_logo_square_1024.png";

/**
 * Renders the Studio brand lockup with the committed channel logo asset.
 */
export function StudioBrandLockup() {
  return (
    <Link
      aria-label='Studio home'
      className='mb-7 flex min-w-0 items-center gap-3 rounded-md text-foreground'
      href='/'
    >
      <span
        className='grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-card text-primary ring-1 ring-border/10'
        aria-hidden='true'
      >
        <Image
          alt=''
          className='h-full w-full object-cover'
          height={48}
          preload
          sizes='48px'
          src={channelLogo}
          width={48}
        />
      </span>
      <div>
        <p className='text-sm text-muted-foreground'>UykulukSciFi</p>
        <strong className='mt-0.5 block text-sm font-semibold'>Producer Studio</strong>
      </div>
    </Link>
  );
}

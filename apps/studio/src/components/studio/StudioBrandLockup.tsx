import Image from "next/image";
import Link from "next/link";

import channelLogo from "../../../../../assets/brand/uykulukscifi_channel_logo_square_1024.png";

/**
 * Renders the Studio brand lockup with the committed channel logo asset.
 */
export function StudioBrandLockup() {
  return (
    <Link aria-label='Studio home' className='brand-lockup' href='/'>
      <span className='brand-mark' aria-hidden='true'>
        <Image
          alt=''
          className='brand-mark-image'
          height={40}
          preload
          sizes='40px'
          src={channelLogo}
          width={40}
        />
      </span>
      <div>
        <p>UykulukSciFi</p>
        <strong>Producer Studio</strong>
      </div>
    </Link>
  );
}

export function extractYoutubeVideoId(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    // youtu.be/VIDEO_ID
    if (u.hostname === 'youtu.be' || u.hostname.endsWith('.youtu.be')) {
      const id = u.pathname.slice(1).split('/')[0];
      return id && /^[\w-]{6,}$/.test(id) ? id : null;
    }
    if (u.hostname === 'youtube.com' || u.hostname.endsWith('.youtube.com')) {
      // youtube.com/watch?v=VIDEO_ID
      const v = u.searchParams.get('v');
      if (v && /^[\w-]{6,}$/.test(v)) return v;
      // /embed/VIDEO_ID or /shorts/VIDEO_ID or /live/VIDEO_ID
      const parts = u.pathname.split('/').filter(Boolean);
      if (
        parts.length >= 2 &&
        (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live')
      ) {
        return /^[\w-]{6,}$/.test(parts[1]) ? parts[1] : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export type YoutubeThumbQuality = 'default' | 'mq' | 'hq' | 'sd' | 'maxres';

const THUMB_SLUG: Record<YoutubeThumbQuality, string> = {
  default: 'default',
  mq: 'mqdefault',
  hq: 'hqdefault',
  sd: 'sddefault',
  maxres: 'maxresdefault',
};

export function youtubeThumb(
  videoId: string,
  quality: YoutubeThumbQuality = 'hq',
): string {
  return `https://img.youtube.com/vi/${videoId}/${THUMB_SLUG[quality]}.jpg`;
}

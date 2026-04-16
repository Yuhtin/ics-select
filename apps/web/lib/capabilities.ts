export function hasWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    return gl !== null;
  } catch {
    return false;
  }
}

export function shouldUse3DMap(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.innerWidth < 1024) return false;
  if (localStorage.getItem('ics:map3d') === 'off') return false;
  return hasWebGL();
}

import type { ImgHTMLAttributes } from 'react'

type BrandLogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  variant?: 'light' | 'dark'
}

export function BrandLogo({ variant = 'light', alt = 'Kache Envíos', ...props }: BrandLogoProps) {
  return <img src={`/logo-${variant}.svg`} alt={alt} {...props} />
}
